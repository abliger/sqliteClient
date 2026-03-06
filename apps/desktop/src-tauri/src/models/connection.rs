use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
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
