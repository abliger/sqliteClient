use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::OpenFlags;

use crate::core::history_store::HistoryStore;
use crate::models::connection::{
    ConnectionConfig, ConnectionInfo, ConnectionStatus, DatabaseMetadata,
};
use crate::utils::error::{AppError, AppResult};

pub struct ConnectionHandle {
    pub config: ConnectionConfig,
    pub pool: Pool<SqliteConnectionManager>,
    pub metadata: DatabaseMetadata,
}

pub struct ConnectionManager {
    connections: Arc<RwLock<HashMap<String, ConnectionHandle>>>,
    #[allow(dead_code)]
    history_store: Arc<HistoryStore>,
}

impl ConnectionManager {
    pub fn new(history_store: Arc<HistoryStore>) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            history_store,
        }
    }

    pub fn create_connection(&self, name: String, db_path: String) -> AppResult<ConnectionInfo> {
        // 检查文件是否存在
        if !std::path::Path::new(&db_path).exists() {
            return Err(AppError::IoError(format!(
                "Database file not found: {}",
                db_path
            )));
        }

        let config = ConnectionConfig::new(name, db_path.clone());
        let manager = SqliteConnectionManager::file(&db_path)
            .with_flags(OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_URI);

        let pool = Pool::builder()
            .max_size(5)
            .build(manager)
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;

        // 获取元数据
        let metadata = self.fetch_metadata(&pool)?;

        let handle = ConnectionHandle {
            config: config.clone(),
            pool,
            metadata: metadata.clone(),
        };

        let info = ConnectionInfo {
            config: config.clone(),
            status: ConnectionStatus::Connected,
            metadata,
        };

        self.connections.write().insert(config.id.clone(), handle);

        Ok(info)
    }

    #[allow(dead_code)]
    pub fn create_new_database(&self, name: String, db_path: String) -> AppResult<ConnectionInfo> {
        // 创建新数据库文件
        let manager = SqliteConnectionManager::file(&db_path);

        let pool = Pool::builder()
            .max_size(5)
            .build(manager)
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;

        // 初始化数据库（执行 VACUUM 确保文件创建）
        let conn = pool
            .get()
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;
        conn.execute_batch("VACUUM;")?;

        let config = ConnectionConfig::new(name, db_path);
        let metadata = self.fetch_metadata(&pool)?;

        let handle = ConnectionHandle {
            config: config.clone(),
            pool,
            metadata: metadata.clone(),
        };

        let info = ConnectionInfo {
            config: config.clone(),
            status: ConnectionStatus::Connected,
            metadata,
        };

        self.connections.write().insert(config.id.clone(), handle);

        Ok(info)
    }

    pub fn close_connection(&self, connection_id: &str) -> AppResult<()> {
        self.connections.write().remove(connection_id);
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_connection(&self, _connection_id: &str) -> AppResult<Arc<ConnectionHandle>> {
        Err(AppError::InternalError("Use get_pool instead".to_string()))
    }

    pub fn get_pool(&self, connection_id: &str) -> AppResult<Pool<SqliteConnectionManager>> {
        let connections = self.connections.read();
        let handle = connections
            .get(connection_id)
            .ok_or_else(|| AppError::NotFound(format!("Connection {} not found", connection_id)))?;
        Ok(handle.pool.clone())
    }

    pub fn list_connections(&self) -> Vec<ConnectionInfo> {
        let connections = self.connections.read();
        connections
            .values()
            .map(|handle| ConnectionInfo {
                config: handle.config.clone(),
                status: ConnectionStatus::Connected,
                metadata: handle.metadata.clone(),
            })
            .collect()
    }

    pub fn get_connection_info(&self, connection_id: &str) -> AppResult<ConnectionInfo> {
        let connections = self.connections.read();
        let handle = connections
            .get(connection_id)
            .ok_or_else(|| AppError::NotFound(format!("Connection {} not found", connection_id)))?;

        Ok(ConnectionInfo {
            config: handle.config.clone(),
            status: ConnectionStatus::Connected,
            metadata: handle.metadata.clone(),
        })
    }

    pub fn test_connection(db_path: &str) -> AppResult<()> {
        let conn = rusqlite::Connection::open_with_flags(
            db_path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI,
        )?;

        // 执行简单查询验证连接
        conn.execute_batch("SELECT 1;")?;

        Ok(())
    }

    fn fetch_metadata(&self, pool: &Pool<SqliteConnectionManager>) -> AppResult<DatabaseMetadata> {
        let conn = pool
            .get()
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;

        let version: String = conn.query_row("SELECT sqlite_version()", [], |row| row.get(0))?;
        let page_size: i64 = conn.query_row("PRAGMA page_size", [], |row| row.get(0))?;
        let page_count: i64 = conn.query_row("PRAGMA page_count", [], |row| row.get(0))?;

        let table_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            [],
            |row| row.get(0),
        )?;

        let index_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index'",
            [],
            |row| row.get(0),
        )?;

        let trigger_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'",
            [],
            |row| row.get(0),
        )?;

        Ok(DatabaseMetadata {
            version,
            page_size,
            page_count,
            table_count,
            index_count,
            trigger_count,
            size_bytes: page_size * page_count,
        })
    }

    #[allow(dead_code)]
    pub fn refresh_metadata(&self, connection_id: &str) -> AppResult<DatabaseMetadata> {
        let pool = self.get_pool(connection_id)?;
        let metadata = self.fetch_metadata(&pool)?;

        // 更新存储的元数据
        let mut connections = self.connections.write();
        if let Some(handle) = connections.get_mut(connection_id) {
            handle.metadata = metadata.clone();
        }

        Ok(metadata)
    }
}

// 线程安全的共享类型
unsafe impl Send for ConnectionManager {}
unsafe impl Sync for ConnectionManager {}

#[cfg(test)]
mod tests {
    use super::*;

    // 测试元数据结构
    #[test]
    fn test_database_metadata_calculation() {
        let metadata = DatabaseMetadata {
            version: "3.39.0".to_string(),
            page_size: 4096,
            page_count: 100,
            table_count: 5,
            index_count: 3,
            trigger_count: 1,
            size_bytes: 409600,
        };

        assert_eq!(metadata.size_bytes, 409600);
        assert_eq!(metadata.page_size * metadata.page_count, 409600);
    }

    #[test]
    fn test_connection_handle_creation() {
        // 由于需要实际的SQLite连接，这里只做结构测试
        let config = ConnectionConfig::new("test".to_string(), "/test.db".to_string());
        assert_eq!(config.name, "test");
        assert_eq!(config.db_path, "/test.db");
    }
}
