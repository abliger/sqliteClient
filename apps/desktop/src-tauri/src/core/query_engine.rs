use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::types::ValueRef;

use crate::models::query::{CellValue, QueryResult, QueryRow, StreamStatus};
use crate::utils::error::{AppError, AppResult};

pub struct QueryEngine;

impl QueryEngine {
    pub fn execute_query(
        pool: &Pool<SqliteConnectionManager>,
        sql: &str,
        limit: Option<usize>,
    ) -> AppResult<QueryResult> {
        let start = Instant::now();
        let mut conn = pool.get().map_err(|e| AppError::ConnectionError(e.to_string()))?;
        
        // 检查是否是 SELECT 查询
        let trimmed = sql.trim().to_uppercase();
        let is_select = trimmed.starts_with("SELECT") || 
                       trimmed.starts_with("WITH") ||
                       trimmed.starts_with("PRAGMA");
        
        if is_select {
            Self::execute_select(&mut conn, sql, limit)
        } else {
            Self::execute_statement(&mut conn, sql, start.elapsed())
        }
    }

    fn execute_select(
        conn: &mut r2d2::PooledConnection<SqliteConnectionManager>,
        sql: &str,
        limit: Option<usize>,
    ) -> AppResult<QueryResult> {
        let mut stmt = conn.prepare(sql)?;
        let column_names: Vec<String> = stmt
            .column_names()
            .into_iter()
            .map(|s| s.to_string())
            .collect();
        
        let limit = limit.unwrap_or(1000);
        let mut rows = Vec::with_capacity(limit.min(1000));
        
        let mut rows_iter = stmt.query([])?;
        let mut count = 0;
        
        while let Some(row) = rows_iter.next()? {
            if count >= limit {
                break;
            }
            
            let mut values = HashMap::new();
            for (i, col_name) in column_names.iter().enumerate() {
                let value = Self::convert_value(row.get_ref(i)?);
                values.insert(col_name.clone(), value);
            }
            
            rows.push(QueryRow { values });
            count += 1;
        }
        
        // 尝试获取总行数（如果适用）
        let total_count = if count >= limit {
            None // 可能有更多数据
        } else {
            Some(count)
        };
        
        Ok(QueryResult::Rows {
            columns: column_names,
            rows,
            total_count,
            stream_id: None,
            has_more: count >= limit,
        })
    }

    fn execute_statement(
        conn: &mut r2d2::PooledConnection<SqliteConnectionManager>,
        sql: &str,
        elapsed: Duration,
    ) -> AppResult<QueryResult> {
        let changes_before = conn.changes();
        
        conn.execute_batch(sql)?;
        
        let rows_affected = conn.changes() - changes_before;
        let last_insert_id = conn.last_insert_rowid();
        
        Ok(QueryResult::Execution {
            rows_affected: rows_affected as usize,
            last_insert_id: Some(last_insert_id),
            execution_time_ms: elapsed.as_millis() as u64,
        })
    }

    fn convert_value(value: ValueRef) -> CellValue {
        match value {
            ValueRef::Null => CellValue::Null,
            ValueRef::Integer(i) => CellValue::Integer(i),
            ValueRef::Real(f) => CellValue::Real(f),
            ValueRef::Text(t) => CellValue::Text(String::from_utf8_lossy(t).to_string()),
            ValueRef::Blob(b) => CellValue::Blob(base64::encode(b)),
        }
    }
}

// 流式查询管理器
#[allow(dead_code)]
pub struct StreamManager {
    streams: Arc<Mutex<HashMap<String, StreamState>>>,
}

#[allow(dead_code)]
struct StreamState {
    columns: Vec<String>,
    rows: Vec<QueryRow>,
    current_index: usize,
    is_complete: bool,
}

#[allow(dead_code)]
impl StreamManager {
    pub fn new() -> Self {
        Self {
            streams: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[allow(dead_code)]
    pub fn create_stream(
        &self,
        pool: &Pool<SqliteConnectionManager>,
        sql: &str,
        batch_size: usize,
    ) -> AppResult<StreamStatus> {
        let stream_id = uuid::Uuid::new_v4().to_string();
        
        // 执行查询并获取第一批数据
        let result = QueryEngine::execute_query(pool, sql, Some(batch_size))?;
        
        match result {
            QueryResult::Rows { columns, rows, has_more, .. } => {
                let status = StreamStatus {
                    stream_id: stream_id.clone(),
                    total_rows: None, // 未知总数
                    fetched_rows: rows.len(),
                    has_more,
                    columns: columns.clone(),
                };
                
                let state = StreamState {
                    columns,
                    rows,
                    current_index: 0,
                    is_complete: !has_more,
                };
                
                self.streams.lock().insert(stream_id, state);
                
                Ok(status)
            }
            QueryResult::Execution { .. } => {
                Err(AppError::QueryError("Stream not supported for DDL/DML".to_string()))
            }
        }
    }

    #[allow(dead_code)]
    pub fn fetch_batch(&self, stream_id: &str, batch_size: usize) -> AppResult<Vec<QueryRow>> {
        let mut streams = self.streams.lock();
        let state = streams
            .get_mut(stream_id)
            .ok_or_else(|| AppError::NotFound("Stream not found".to_string()))?;
        
        let start = state.current_index;
        let end = (start + batch_size).min(state.rows.len());
        
        if start >= state.rows.len() {
            return Ok(vec![]);
        }
        
        let batch: Vec<QueryRow> = state.rows[start..end].to_vec();
        state.current_index = end;
        
        Ok(batch)
    }

    #[allow(dead_code)]
    pub fn close_stream(&self, stream_id: &str) {
        self.streams.lock().remove(stream_id);
    }
}

// Base64 encoding helper
mod base64 {
    pub fn encode(input: &[u8]) -> String {
        use std::fmt::Write;
        let mut result = String::new();
        for &byte in input {
            write!(&mut result, "{:02x}", byte).unwrap();
        }
        result
    }
}
