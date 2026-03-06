use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono::{DateTime, Utc};

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
    },
    #[serde(rename = "execution")]
    Execution {
        rows_affected: usize,
        last_insert_id: Option<i64>,
        execution_time_ms: u64,
    },
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub sql: String,
    pub result: QueryResult,
    pub execution_time_ms: u64,
    pub executed_at: DateTime<Utc>,
}

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
