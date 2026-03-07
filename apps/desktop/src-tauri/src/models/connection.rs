use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub db_path: String,
    pub created_at: DateTime<Utc>,
    pub last_connected: Option<DateTime<Utc>>,
}

impl ConnectionConfig {
    pub fn new(name: String, db_path: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            db_path,
            created_at: Utc::now(),
            last_connected: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub config: ConnectionConfig,
    pub status: ConnectionStatus,
    pub metadata: DatabaseMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
    Error(String),
    Connecting,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DatabaseMetadata {
    pub version: String,
    pub page_size: i64,
    pub page_count: i64,
    pub table_count: i32,
    pub index_count: i32,
    pub trigger_count: i32,
    pub size_bytes: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_config_new() {
        let config = ConnectionConfig::new("test_db".to_string(), "/path/to/db.sqlite".to_string());

        assert_eq!(config.name, "test_db");
        assert_eq!(config.db_path, "/path/to/db.sqlite");
        assert!(config.last_connected.is_none());
        assert!(!config.id.is_empty());
    }

    #[test]
    fn test_connection_config_serialization() {
        let config = ConnectionConfig {
            id: "test-id".to_string(),
            name: "test".to_string(),
            db_path: "/test.db".to_string(),
            created_at: Utc::now(),
            last_connected: None,
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("test-id"));
        assert!(json.contains("test"));
        assert!(json.contains("/test.db"));

        let deserialized: ConnectionConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "test-id");
        assert_eq!(deserialized.name, "test");
    }

    #[test]
    fn test_connection_status_serialization() {
        let status = ConnectionStatus::Connected;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"connected\"");

        let status = ConnectionStatus::Error("test error".to_string());
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("test error"));
    }

    #[test]
    fn test_database_metadata_default() {
        let metadata = DatabaseMetadata::default();
        assert_eq!(metadata.version, "");
        assert_eq!(metadata.page_size, 0);
        assert_eq!(metadata.page_count, 0);
        assert_eq!(metadata.table_count, 0);
        assert_eq!(metadata.index_count, 0);
        assert_eq!(metadata.trigger_count, 0);
        assert_eq!(metadata.size_bytes, 0);
    }

    #[test]
    fn test_connection_info_serialization() {
        let info = ConnectionInfo {
            config: ConnectionConfig::new("test".to_string(), "/test.db".to_string()),
            status: ConnectionStatus::Connected,
            metadata: DatabaseMetadata::default(),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("connected"));
        let deserialized: ConnectionInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.status, ConnectionStatus::Connected);
    }
}
