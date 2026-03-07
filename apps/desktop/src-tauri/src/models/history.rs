use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryItem {
    pub id: String,
    pub sql: String,
    pub connection_id: Option<String>,
    pub connection_name: Option<String>,
    pub executed_at: DateTime<Utc>,
    pub duration_ms: u64,
    pub is_success: bool,
    pub error_message: Option<String>,
    pub row_count: Option<usize>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct QueryHistoryFilter {
    pub search: Option<String>,
    pub connection_id: Option<String>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
    pub is_success: Option<bool>,
    pub limit: usize,
    pub offset: usize,
}

impl QueryHistoryFilter {
    #[allow(dead_code)]
    pub fn with_limit(limit: usize) -> Self {
        Self {
            limit,
            ..Default::default()
        }
    }
}
