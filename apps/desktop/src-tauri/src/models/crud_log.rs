use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// CRUD 操作类型
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum CrudOperationType {
    Insert,
    Update,
    Delete,
}

impl std::fmt::Display for CrudOperationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CrudOperationType::Insert => write!(f, "INSERT"),
            CrudOperationType::Update => write!(f, "UPDATE"),
            CrudOperationType::Delete => write!(f, "DELETE"),
        }
    }
}

/// CRUD 操作日志
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrudOperationLog {
    pub id: String,
    /// 关联的连接 ID
    pub connection_id: String,
    /// 关联的 Tab ID
    pub tab_id: String,
    /// 操作的表名
    pub table_name: String,
    /// 操作类型
    pub operation_type: CrudOperationType,
    /// 执行的 SQL
    pub sql: String,
    /// 操作的数据（JSON 字符串）
    pub row_data: Option<String>,
    /// 操作前数据（UPDATE/DELETE 时记录）
    pub old_data: Option<String>,
    /// 影响行数
    pub rows_affected: usize,
    /// 执行时间
    pub executed_at: DateTime<Utc>,
    /// 执行耗时（毫秒）
    pub duration_ms: u64,
    /// 是否成功
    pub is_success: bool,
    /// 错误信息
    pub error_message: Option<String>,
}

impl CrudOperationLog {
    pub fn new(
        connection_id: String,
        tab_id: String,
        table_name: String,
        operation_type: CrudOperationType,
        sql: String,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            connection_id,
            tab_id,
            table_name,
            operation_type,
            sql,
            row_data: None,
            old_data: None,
            rows_affected: 0,
            executed_at: Utc::now(),
            duration_ms: 0,
            is_success: true,
            error_message: None,
        }
    }

    pub fn with_row_data(mut self, row_data: String) -> Self {
        self.row_data = Some(row_data);
        self
    }

    pub fn with_old_data(mut self, old_data: String) -> Self {
        self.old_data = Some(old_data);
        self
    }

    pub fn with_result(mut self, rows_affected: usize, duration_ms: u64) -> Self {
        self.rows_affected = rows_affected;
        self.duration_ms = duration_ms;
        self
    }

    pub fn with_error(mut self, error_message: String) -> Self {
        self.is_success = false;
        self.error_message = Some(error_message);
        self
    }
}

/// 查询日志的过滤条件
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CrudLogFilter {
    pub connection_id: Option<String>,
    pub tab_id: Option<String>,
    pub table_name: Option<String>,
    pub operation_type: Option<CrudOperationType>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crud_operation_type_display() {
        assert_eq!(CrudOperationType::Insert.to_string(), "INSERT");
        assert_eq!(CrudOperationType::Update.to_string(), "UPDATE");
        assert_eq!(CrudOperationType::Delete.to_string(), "DELETE");
    }

    #[test]
    fn test_crud_log_builder() {
        let log = CrudOperationLog::new(
            "conn-1".to_string(),
            "tab-1".to_string(),
            "users".to_string(),
            CrudOperationType::Insert,
            "INSERT INTO users (name) VALUES ('test')".to_string(),
        )
        .with_row_data(r#"{"name":"test"}"#.to_string())
        .with_result(1, 100);

        assert_eq!(log.connection_id, "conn-1");
        assert_eq!(log.tab_id, "tab-1");
        assert_eq!(log.table_name, "users");
        assert_eq!(log.rows_affected, 1);
        assert_eq!(log.duration_ms, 100);
        assert!(log.is_success);
    }

    #[test]
    fn test_crud_log_error() {
        let log = CrudOperationLog::new(
            "conn-1".to_string(),
            "tab-1".to_string(),
            "users".to_string(),
            CrudOperationType::Insert,
            "INSERT INTO users (name) VALUES ('test')".to_string(),
        )
        .with_error("Duplicate key".to_string());

        assert!(!log.is_success);
        assert_eq!(log.error_message, Some("Duplicate key".to_string()));
    }
}
