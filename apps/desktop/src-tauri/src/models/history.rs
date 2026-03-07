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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_history_item_serialization() {
        let item = QueryHistoryItem {
            id: "hist-123".to_string(),
            sql: "SELECT * FROM users".to_string(),
            connection_id: Some("conn-456".to_string()),
            connection_name: Some("Test DB".to_string()),
            executed_at: Utc::now(),
            duration_ms: 100,
            is_success: true,
            error_message: None,
            row_count: Some(50),
        };

        let json = serde_json::to_string(&item).unwrap();
        let deserialized: QueryHistoryItem = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, "hist-123");
        assert_eq!(deserialized.sql, "SELECT * FROM users");
        assert_eq!(deserialized.duration_ms, 100);
        assert!(deserialized.is_success);
    }

    #[test]
    fn test_query_history_filter_default() {
        let filter = QueryHistoryFilter::default();
        assert!(filter.search.is_none());
        assert!(filter.connection_id.is_none());
        assert!(filter.from_date.is_none());
        assert!(filter.to_date.is_none());
        assert!(filter.is_success.is_none());
        assert_eq!(filter.limit, 0);
        assert_eq!(filter.offset, 0);
    }

    #[test]
    fn test_query_history_filter_with_limit() {
        let filter = QueryHistoryFilter::with_limit(100);
        assert_eq!(filter.limit, 100);
        assert_eq!(filter.offset, 0);
    }

    #[test]
    fn test_query_history_filter_with_params() {
        let filter = QueryHistoryFilter {
            search: Some("SELECT".to_string()),
            connection_id: Some("conn-123".to_string()),
            from_date: Some(Utc::now()),
            to_date: Some(Utc::now()),
            is_success: Some(true),
            limit: 50,
            offset: 10,
        };

        let json = serde_json::to_string(&filter).unwrap();
        let deserialized: QueryHistoryFilter = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.search, Some("SELECT".to_string()));
        assert_eq!(deserialized.connection_id, Some("conn-123".to_string()));
        assert_eq!(deserialized.limit, 50);
        assert_eq!(deserialized.offset, 10);
    }
}
