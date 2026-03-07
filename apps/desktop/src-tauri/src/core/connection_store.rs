use std::fs;
use std::path::PathBuf;

use tauri::Manager;

use crate::models::connection::ConnectionConfig;
use crate::utils::error::{AppError, AppResult};

pub struct ConnectionStore {
    config_dir: PathBuf,
}

impl ConnectionStore {
    pub fn new(app_handle: &tauri::AppHandle) -> AppResult<Self> {
        let config_dir = app_handle
            .path()
            .app_config_dir()
            .map_err(|e| AppError::IoError(e.to_string()))?;

        // Ensure config directory exists
        fs::create_dir_all(&config_dir)?;

        Ok(Self { config_dir })
    }

    fn connections_path(&self) -> PathBuf {
        self.config_dir.join("connections.json")
    }

    /// 加载所有保存的连接配置
    pub fn load_connections(&self) -> AppResult<Vec<ConnectionConfig>> {
        let path = self.connections_path();

        if !path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&path)?;
        let connections: Vec<ConnectionConfig> = serde_json::from_str(&content)?;
        Ok(connections)
    }

    /// 保存所有连接配置
    pub fn save_connections(&self, connections: &[ConnectionConfig]) -> AppResult<()> {
        let path = self.connections_path();
        let content = serde_json::to_string_pretty(connections)?;
        fs::write(&path, content)?;
        Ok(())
    }

    /// 添加或更新单个连接配置
    pub fn save_connection(&self, config: &ConnectionConfig) -> AppResult<()> {
        let mut connections = self.load_connections()?;

        // 更新或添加
        if let Some(index) = connections.iter().position(|c| c.id == config.id) {
            connections[index] = config.clone();
        } else {
            connections.push(config.clone());
        }

        self.save_connections(&connections)
    }

    /// 删除连接配置
    pub fn delete_connection(&self, connection_id: &str) -> AppResult<()> {
        let mut connections = self.load_connections()?;
        connections.retain(|c| c.id != connection_id);
        self.save_connections(&connections)
    }

    /// 获取单个连接配置
    pub fn get_connection(&self, connection_id: &str) -> AppResult<Option<ConnectionConfig>> {
        let connections = self.load_connections()?;
        Ok(connections.into_iter().find(|c| c.id == connection_id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn test_connection_config_roundtrip() {
        let config = ConnectionConfig {
            id: "test-id".to_string(),
            name: "Test DB".to_string(),
            db_path: "/path/to/test.db".to_string(),
            created_at: Utc::now(),
            last_connected: Some(Utc::now()),
        };

        let json = serde_json::to_string_pretty(&vec![config.clone()]).unwrap();
        let loaded: Vec<ConnectionConfig> = serde_json::from_str(&json).unwrap();

        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, config.id);
        assert_eq!(loaded[0].name, config.name);
        assert_eq!(loaded[0].db_path, config.db_path);
    }
}
