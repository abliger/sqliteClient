use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum QueryResult {
    #[serde(rename = "rows")]
    Rows {
        columns: Vec<String>,
        rows: Vec<QueryRow>,
        total_count: Option<usize>,
        stream_id: Option<String>,
        has_more: bool,
        /// 详细的执行信息
        execution_info: QueryExecutionInfo,
    },
    #[serde(rename = "execution")]
    Execution {
        rows_affected: usize,
        last_insert_id: Option<i64>,
        /// 详细的执行信息
        execution_info: QueryExecutionInfo,
    },
}

/// 查询执行详细信息 - 用于性能诊断
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryExecutionInfo {
    /// 总执行时间（毫秒）
    pub execution_time_ms: u64,
    /// 查询计划分析时间（毫秒）
    pub plan_time_ms: Option<u64>,
    /// 实际执行时间（毫秒，不包括计划分析）
    pub query_time_ms: Option<u64>,
    /// 扫描的行数（估计值）
    pub rows_scanned: Option<usize>,
    /// 返回的行数
    pub rows_returned: usize,
    /// 是否使用了索引
    pub used_index: Option<bool>,
    /// 使用的索引列表
    pub indexes_used: Vec<String>,
    /// 查询计划详情
    pub query_plan: Vec<QueryPlanStep>,
    /// 是否全表扫描
    pub is_full_table_scan: Option<bool>,
    /// 警告信息（如慢查询警告）
    pub warnings: Vec<QueryWarning>,
    /// 优化建议
    pub suggestions: Vec<String>,
}

impl QueryExecutionInfo {
    pub fn new(execution_time_ms: u64, rows_returned: usize) -> Self {
        Self {
            execution_time_ms,
            plan_time_ms: None,
            query_time_ms: None,
            rows_scanned: None,
            rows_returned,
            used_index: None,
            indexes_used: Vec::new(),
            query_plan: Vec::new(),
            is_full_table_scan: None,
            warnings: Vec::new(),
            suggestions: Vec::new(),
        }
    }

    /// 添加慢查询警告（如果执行时间超过阈值）
    pub fn check_slow_query(&mut self, threshold_ms: u64) {
        if self.execution_time_ms > threshold_ms {
            self.warnings.push(QueryWarning {
                level: WarningLevel::Warning,
                message: format!("查询执行时间较长 ({} ms)，建议优化", self.execution_time_ms),
                code: Some("SLOW_QUERY".to_string()),
            });
            self.suggestions
                .push("考虑添加索引或优化查询条件".to_string());
        }
    }

    /// 检查是否使用了索引
    pub fn check_index_usage(&mut self) {
        if let Some(used_index) = self.used_index {
            if !used_index && self.rows_scanned.unwrap_or(0) > 1000 {
                self.warnings.push(QueryWarning {
                    level: WarningLevel::Warning,
                    message: "未使用索引，可能导致全表扫描".to_string(),
                    code: Some("NO_INDEX_USED".to_string()),
                });
                self.suggestions
                    .push("为 WHERE、JOIN、ORDER BY 子句中的列添加索引".to_string());
            }
        }
    }

    /// 检查是否全表扫描
    pub fn check_full_table_scan(&mut self) {
        if self.is_full_table_scan == Some(true) {
            self.warnings.push(QueryWarning {
                level: WarningLevel::Info,
                message: "查询执行了全表扫描".to_string(),
                code: Some("FULL_TABLE_SCAN".to_string()),
            });
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryWarning {
    pub level: WarningLevel,
    pub message: String,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WarningLevel {
    Info,
    Warning,
    Error,
}

/// 查询计划步骤
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryPlanStep {
    /// 步骤序号
    pub id: i32,
    /// 父步骤序号
    pub parent: Option<i32>,
    /// 不使用的列
    pub not_used: Option<i32>,
    /// 详细信息
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryRow {
    pub values: HashMap<String, CellValue>,
}

impl QueryRow {
    pub fn to_json(&self) -> Value {
        let mut map = serde_json::Map::new();
        for (key, value) in &self.values {
            map.insert(key.clone(), value.to_json());
        }
        Value::Object(map)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum CellValue {
    Null,
    Integer(i64),
    Real(f64),
    Text(String),
    Blob(String), // Base64 encoded
    Boolean(bool),
}

impl CellValue {
    pub fn to_json(&self) -> Value {
        match self {
            CellValue::Null => Value::Null,
            CellValue::Integer(v) => Value::Number((*v).into()),
            CellValue::Real(v) => serde_json::Number::from_f64(*v)
                .map(Value::Number)
                .unwrap_or(Value::Null),
            CellValue::Text(v) => Value::String(v.clone()),
            CellValue::Blob(v) => Value::String(format!("<BLOB:{} bytes>", v.len())),
            CellValue::Boolean(v) => Value::Bool(*v),
        }
    }
}

impl std::fmt::Display for CellValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CellValue::Null => write!(f, "NULL"),
            CellValue::Integer(v) => write!(f, "{}", v),
            CellValue::Real(v) => write!(f, "{}", v),
            CellValue::Text(v) => write!(f, "{}", v),
            CellValue::Blob(v) => write!(f, "<BLOB:{} bytes>", v.len()),
            CellValue::Boolean(v) => write!(f, "{}", v),
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub sql: String,
    pub result: QueryResult,
    pub execution_info: QueryExecutionInfo,
    pub executed_at: DateTime<Utc>,
}

#[allow(dead_code)]
#[derive(Debug)]
pub struct StreamHandle {
    pub id: String,
    pub columns: Vec<String>,
    pub statement: rusqlite::Statement<'static>,
    pub created_at: DateTime<Utc>,
}

// 用于流式查询的状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamStatus {
    pub stream_id: String,
    pub total_rows: Option<usize>,
    pub fetched_rows: usize,
    pub has_more: bool,
    pub columns: Vec<String>,
}

/// SQL 文件执行进度
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlFileExecutionProgress {
    /// 当前执行的语句索引
    pub current_statement: usize,
    /// 总语句数
    pub total_statements: usize,
    /// 当前执行的 SQL 语句（截断显示）
    pub current_sql: String,
    /// 已执行成功的语句数
    pub success_count: usize,
    /// 已执行失败的语句数
    pub error_count: usize,
    /// 是否已完成
    pub is_complete: bool,
}

/// SQL 文件执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlFileExecutionResult {
    /// 文件路径
    pub file_path: String,
    /// 总语句数
    pub total_statements: usize,
    /// 成功执行的语句数
    pub success_count: usize,
    /// 执行失败的语句数
    pub error_count: usize,
    /// 执行详情
    pub statements: Vec<StatementExecutionResult>,
    /// 总执行时间（毫秒）
    pub total_duration_ms: u64,
}

/// 单条语句执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatementExecutionResult {
    /// 语句序号
    pub index: usize,
    /// SQL 语句（截断）
    pub sql: String,
    /// 是否成功
    pub success: bool,
    /// 错误信息（失败时）
    pub error_message: Option<String>,
    /// 执行时间（毫秒）
    pub duration_ms: u64,
    /// 影响的行数（如果是 DML）
    pub rows_affected: Option<usize>,
}

/// 流状态（内部使用）
#[derive(Debug)]
pub struct StreamState {
    pub columns: Vec<String>,
    pub rows: Vec<QueryRow>,
    pub current_index: usize,
    pub is_complete: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_value_to_json() {
        assert_eq!(CellValue::Null.to_json(), Value::Null);
        assert_eq!(
            CellValue::Integer(42).to_json(),
            Value::Number(42i64.into())
        );
        assert_eq!(
            CellValue::Text("hello".to_string()).to_json(),
            Value::String("hello".to_string())
        );
        assert_eq!(CellValue::Boolean(true).to_json(), Value::Bool(true));
    }

    #[test]
    fn test_cell_value_real_to_json() {
        let real = CellValue::Real(std::f64::consts::PI);
        let json = real.to_json();
        assert!(json.is_number());
    }

    #[test]
    fn test_cell_value_blob_to_json() {
        let blob = CellValue::Blob("base64data".to_string());
        let json = blob.to_json();
        assert!(json.as_str().unwrap().contains("BLOB"));
    }

    #[test]
    fn test_cell_value_display() {
        assert_eq!(format!("{}", CellValue::Null), "NULL");
        assert_eq!(format!("{}", CellValue::Integer(42)), "42");
        let formatted = format!("{}", CellValue::Real(std::f64::consts::PI));
        assert!(formatted.starts_with("3.14"));
        assert_eq!(format!("{}", CellValue::Text("hello".to_string())), "hello");
        assert_eq!(format!("{}", CellValue::Boolean(true)), "true");
    }

    #[test]
    fn test_query_row_to_json() {
        let mut values = HashMap::new();
        values.insert("id".to_string(), CellValue::Integer(1));
        values.insert("name".to_string(), CellValue::Text("test".to_string()));

        let row = QueryRow { values };
        let json = row.to_json();

        assert!(json.is_object());
        assert_eq!(json.get("id").unwrap(), &Value::Number(1i64.into()));
        assert_eq!(
            json.get("name").unwrap(),
            &Value::String("test".to_string())
        );
    }

    #[test]
    fn test_query_result_rows_serialization() {
        let result = QueryResult::Rows {
            columns: vec!["id".to_string(), "name".to_string()],
            rows: vec![],
            total_count: Some(100),
            stream_id: None,
            has_more: false,
            execution_info: QueryExecutionInfo::new(100, 0),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("rows"));
        assert!(json.contains("id"));
        assert!(json.contains("name"));
        assert!(json.contains("execution_info"));
    }

    #[test]
    fn test_query_result_execution_serialization() {
        let result = QueryResult::Execution {
            rows_affected: 5,
            last_insert_id: Some(42),
            execution_info: QueryExecutionInfo::new(50, 0),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("execution"));
        assert!(json.contains("rows_affected"));
        assert!(json.contains("42"));
        assert!(json.contains("execution_info"));
    }

    #[test]
    fn test_stream_status_serialization() {
        let status = StreamStatus {
            stream_id: "stream-123".to_string(),
            total_rows: Some(1000),
            fetched_rows: 100,
            has_more: true,
            columns: vec!["col1".to_string(), "col2".to_string()],
        };

        let json = serde_json::to_string(&status).unwrap();
        let deserialized: StreamStatus = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.stream_id, "stream-123");
        assert_eq!(deserialized.fetched_rows, 100);
        assert!(deserialized.has_more);
    }

    #[test]
    fn test_execution_result_serialization() {
        let exec_result = ExecutionResult {
            sql: "SELECT * FROM users".to_string(),
            result: QueryResult::Execution {
                rows_affected: 1,
                last_insert_id: Some(1),
                execution_info: QueryExecutionInfo::new(50, 0),
            },
            execution_info: QueryExecutionInfo::new(50, 0),
            executed_at: Utc::now(),
        };

        let json = serde_json::to_string(&exec_result).unwrap();
        assert!(json.contains("SELECT * FROM users"));
    }

    #[test]
    fn test_query_execution_info_warnings() {
        let mut info = QueryExecutionInfo::new(5000, 100);
        info.check_slow_query(1000);
        assert_eq!(info.warnings.len(), 1);
        assert_eq!(info.warnings[0].code, Some("SLOW_QUERY".to_string()));
    }
}
