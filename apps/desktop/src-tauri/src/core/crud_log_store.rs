use std::path::Path;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use parking_lot::Mutex;
use rusqlite::{params, Connection};

use crate::models::crud_log::{CrudLogFilter, CrudOperationLog, CrudOperationType};
use crate::utils::error::{AppError, AppResult};

/// CRUD 操作日志存储
/// 使用 SQLite 存储在应用数据目录中，重启后数据不丢失
pub struct CrudLogStore {
    conn: Arc<Mutex<Connection>>,
}

impl CrudLogStore {
    /// 创建或打开日志存储
    pub fn new(data_dir: &Path) -> AppResult<Self> {
        let db_path = data_dir.join("crud_logs.db");
        let conn = Connection::open(&db_path)?;

        let store = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        store.init_table()?;

        Ok(store)
    }

    /// 初始化数据库表
    fn init_table(&self) -> AppResult<()> {
        let conn = self.conn.lock();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS crud_logs (
                id TEXT PRIMARY KEY,
                connection_id TEXT NOT NULL,
                tab_id TEXT NOT NULL,
                table_name TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                sql TEXT NOT NULL,
                row_data TEXT,
                old_data TEXT,
                rows_affected INTEGER NOT NULL DEFAULT 0,
                executed_at TEXT NOT NULL,
                duration_ms INTEGER NOT NULL DEFAULT 0,
                is_success INTEGER NOT NULL DEFAULT 1,
                error_message TEXT
            )",
            [],
        )?;

        // 创建索引以优化查询
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_crud_logs_connection ON crud_logs(connection_id)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_crud_logs_tab ON crud_logs(tab_id)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_crud_logs_table ON crud_logs(table_name)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_crud_logs_executed_at ON crud_logs(executed_at DESC)",
            [],
        )?;

        Ok(())
    }

    /// 添加日志记录
    pub fn add_log(&self, log: &CrudOperationLog) -> AppResult<()> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO crud_logs (
                id, connection_id, tab_id, table_name, operation_type,
                sql, row_data, old_data, rows_affected, executed_at,
                duration_ms, is_success, error_message
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                log.id,
                log.connection_id,
                log.tab_id,
                log.table_name,
                log.operation_type.to_string(),
                log.sql,
                log.row_data,
                log.old_data,
                log.rows_affected as i64,
                log.executed_at.to_rfc3339(),
                log.duration_ms as i64,
                if log.is_success { 1 } else { 0 },
                log.error_message
            ],
        )?;

        Ok(())
    }

    /// 查询日志列表
    pub fn query_logs(
        &self,
        filter: &CrudLogFilter,
        limit: usize,
    ) -> AppResult<Vec<CrudOperationLog>> {
        let mut sql = String::from(
            "SELECT 
                id, connection_id, tab_id, table_name, operation_type,
                sql, row_data, old_data, rows_affected, executed_at,
                duration_ms, is_success, error_message
             FROM crud_logs WHERE 1=1",
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(conn_id) = &filter.connection_id {
            sql.push_str(" AND connection_id = ?");
            params.push(Box::new(conn_id.clone()));
        }

        if let Some(tab_id) = &filter.tab_id {
            sql.push_str(" AND tab_id = ?");
            params.push(Box::new(tab_id.clone()));
        }

        if let Some(table) = &filter.table_name {
            sql.push_str(" AND table_name = ?");
            params.push(Box::new(table.clone()));
        }

        if let Some(op_type) = &filter.operation_type {
            sql.push_str(" AND operation_type = ?");
            params.push(Box::new(op_type.to_string()));
        }

        if let Some(start) = filter.start_time {
            sql.push_str(" AND executed_at >= ?");
            params.push(Box::new(start.to_rfc3339()));
        }

        if let Some(end) = filter.end_time {
            sql.push_str(" AND executed_at <= ?");
            params.push(Box::new(end.to_rfc3339()));
        }

        sql.push_str(" ORDER BY executed_at DESC LIMIT ?");
        params.push(Box::new(limit as i64));

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let conn = self.conn.lock();
        let mut stmt = conn.prepare(&sql)?;
        let logs = stmt.query_map(&param_refs[..], |row| {
            Ok(CrudOperationLog {
                id: row.get(0)?,
                connection_id: row.get(1)?,
                tab_id: row.get(2)?,
                table_name: row.get(3)?,
                operation_type: parse_operation_type(&row.get::<_, String>(4)?),
                sql: row.get(5)?,
                row_data: row.get(6)?,
                old_data: row.get(7)?,
                rows_affected: row.get::<_, i64>(8)? as usize,
                executed_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                duration_ms: row.get::<_, i64>(10)? as u64,
                is_success: row.get::<_, i64>(11)? == 1,
                error_message: row.get(12)?,
            })
        })?;

        let result: Result<Vec<_>, _> = logs.collect();
        result.map_err(|e| AppError::DatabaseError(e.to_string()))
    }

    /// 获取指定 Tab 的日志数量
    pub fn count_logs_by_tab(&self, tab_id: &str) -> AppResult<usize> {
        let conn = self.conn.lock();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM crud_logs WHERE tab_id = ?",
            [tab_id],
            |row| row.get(0),
        )?;
        Ok(count as usize)
    }

    /// 删除指定 Tab 的日志（当 Tab 关闭时调用）
    pub fn delete_logs_by_tab(&self, tab_id: &str) -> AppResult<usize> {
        let conn = self.conn.lock();
        let deleted = conn.execute("DELETE FROM crud_logs WHERE tab_id = ?", [tab_id])?;
        Ok(deleted)
    }

    /// 删除指定连接的日志（当连接关闭时调用）
    pub fn delete_logs_by_connection(&self, connection_id: &str) -> AppResult<usize> {
        let conn = self.conn.lock();
        let deleted = conn.execute(
            "DELETE FROM crud_logs WHERE connection_id = ?",
            [connection_id],
        )?;
        Ok(deleted)
    }

    /// 清理旧日志（保留最近 N 条）
    pub fn cleanup_old_logs(&self, keep_count: usize) -> AppResult<usize> {
        let conn = self.conn.lock();

        // 获取需要删除的日志 ID
        let ids_to_delete: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT id FROM crud_logs ORDER BY executed_at DESC LIMIT -1 OFFSET ?")?;
            let ids = stmt.query_map([keep_count as i64], |row| row.get::<_, String>(0))?;
            ids.collect::<Result<Vec<_>, _>>()?
        };

        if ids_to_delete.is_empty() {
            return Ok(0);
        }

        // 批量删除
        let placeholders: Vec<String> = ids_to_delete.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            "DELETE FROM crud_logs WHERE id IN ({})",
            placeholders.join(",")
        );

        let deleted = conn.execute(&sql, rusqlite::params_from_iter(&ids_to_delete))?;
        Ok(deleted)
    }

    /// 获取所有表名（用于筛选）
    pub fn get_table_names(&self) -> AppResult<Vec<String>> {
        let conn = self.conn.lock();
        let mut stmt =
            conn.prepare("SELECT DISTINCT table_name FROM crud_logs ORDER BY table_name")?;
        let names = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let result: Result<Vec<_>, _> = names.collect();
        result.map_err(|e| AppError::DatabaseError(e.to_string()))
    }

    /// 获取统计数据
    pub fn get_stats(&self, connection_id: Option<&str>) -> AppResult<CrudLogStats> {
        let mut sql = String::from(
            "SELECT 
                COUNT(*),
                COUNT(CASE WHEN is_success = 1 THEN 1 END),
                COUNT(CASE WHEN operation_type = 'INSERT' THEN 1 END),
                COUNT(CASE WHEN operation_type = 'UPDATE' THEN 1 END),
                COUNT(CASE WHEN operation_type = 'DELETE' THEN 1 END)
             FROM crud_logs WHERE 1=1",
        );

        let params: Vec<Box<dyn rusqlite::ToSql>> = if let Some(conn_id) = connection_id {
            sql.push_str(" AND connection_id = ?");
            vec![Box::new(conn_id.to_string())]
        } else {
            vec![]
        };

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let conn = self.conn.lock();
        let stats = conn.query_row(&sql, &param_refs[..], |row| {
            Ok(CrudLogStats {
                total: row.get::<_, i64>(0)? as usize,
                success: row.get::<_, i64>(1)? as usize,
                inserts: row.get::<_, i64>(2)? as usize,
                updates: row.get::<_, i64>(3)? as usize,
                deletes: row.get::<_, i64>(4)? as usize,
            })
        })?;

        Ok(stats)
    }
}

/// 统计信息
#[derive(Debug, Clone)]
pub struct CrudLogStats {
    pub total: usize,
    pub success: usize,
    pub inserts: usize,
    pub updates: usize,
    pub deletes: usize,
}

fn parse_operation_type(s: &str) -> CrudOperationType {
    match s {
        "INSERT" => CrudOperationType::Insert,
        "UPDATE" => CrudOperationType::Update,
        "DELETE" => CrudOperationType::Delete,
        _ => CrudOperationType::Insert,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn create_test_store() -> CrudLogStore {
        let temp_dir = std::env::temp_dir().join(format!("crud_log_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();
        CrudLogStore::new(&temp_dir).unwrap()
    }

    fn create_test_log(tab_id: &str) -> CrudOperationLog {
        CrudOperationLog::new(
            "conn-1".to_string(),
            tab_id.to_string(),
            "users".to_string(),
            CrudOperationType::Insert,
            "INSERT INTO users (name) VALUES ('test')".to_string(),
        )
    }

    #[test]
    fn test_add_and_query_log() {
        let store = create_test_store();
        let log = create_test_log("tab-1");

        store.add_log(&log).unwrap();

        let filter = CrudLogFilter {
            tab_id: Some("tab-1".to_string()),
            ..Default::default()
        };
        let logs = store.query_logs(&filter, 10).unwrap();

        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].table_name, "users");
        assert_eq!(logs[0].operation_type, CrudOperationType::Insert);
    }

    #[test]
    fn test_filter_by_operation_type() {
        let store = create_test_store();

        let insert_log = create_test_log("tab-1");
        store.add_log(&insert_log).unwrap();

        let mut update_log = create_test_log("tab-1");
        update_log.operation_type = CrudOperationType::Update;
        store.add_log(&update_log).unwrap();

        let filter = CrudLogFilter {
            operation_type: Some(CrudOperationType::Update),
            ..Default::default()
        };
        let logs = store.query_logs(&filter, 10).unwrap();

        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].operation_type, CrudOperationType::Update);
    }

    #[test]
    fn test_delete_logs_by_tab() {
        let store = create_test_store();

        let log1 = create_test_log("tab-1");
        let log2 = create_test_log("tab-2");
        store.add_log(&log1).unwrap();
        store.add_log(&log2).unwrap();

        let deleted = store.delete_logs_by_tab("tab-1").unwrap();
        assert_eq!(deleted, 1);

        let remaining = store.query_logs(&CrudLogFilter::default(), 10).unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].tab_id, "tab-2");
    }
}
