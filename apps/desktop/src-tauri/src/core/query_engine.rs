use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use parking_lot::Mutex;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::types::ValueRef;

use crate::models::query::{
    CellValue, QueryExecutionInfo, QueryPlanStep, QueryResult, QueryRow, StreamState, StreamStatus,
};
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

        // 检查 SQL 类型
        let sql_trimmed = sql.trim().to_uppercase();
        let is_select = sql_trimmed.starts_with("SELECT")
            || sql_trimmed.starts_with("WITH")
            || sql_trimmed.starts_with("PRAGMA");

        if is_select {
            Self::execute_select(&mut conn, sql, limit, start)
        } else {
            Self::execute_statement(&mut conn, sql, start)
        }
    }

    fn execute_select(
        conn: &mut r2d2::PooledConnection<SqliteConnectionManager>,
        sql: &str,
        limit: Option<usize>,
        start: Instant,
    ) -> AppResult<QueryResult> {
        // 1. 首先分析查询计划
        let plan_start = Instant::now();
        let query_plan = Self::analyze_query_plan(conn, sql)?;
        let plan_time = plan_start.elapsed();

        // 分析查询计划提取信息
        let (used_index, indexes_used, is_full_table_scan) =
            Self::extract_plan_info(&query_plan);

        // 2. 执行实际查询（在内部作用域中，确保 stmt 被及时释放）
        let query_start = Instant::now();
        let limit_val = limit.unwrap_or(1000);
        let (column_names, rows, count) = {
            let mut stmt = conn.prepare(sql)?;
            let column_names: Vec<String> = stmt
                .column_names()
                .into_iter()
                .map(|s| s.to_string())
                .collect();

            let mut rows = Vec::with_capacity(limit_val.min(1000));

            let mut rows_iter = stmt.query([])?;
            let mut count = 0;

            while let Some(row) = rows_iter.next()? {
                if count >= limit_val {
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

            (column_names, rows, count)
        };
        let query_time = query_start.elapsed();
        let total_time = start.elapsed();

        // 尝试获取总行数（如果适用）
        let total_count = if count >= limit_val {
            None // 可能有更多数据
        } else {
            Some(count)
        };

        // 估算扫描的行数（stmt 已被释放，可以安全调用）
        let rows_scanned = Self::estimate_rows_scanned(conn, sql, &query_plan)?;

        // 构建执行信息
        let mut execution_info = QueryExecutionInfo::new(total_time.as_millis() as u64, count);
        execution_info.plan_time_ms = Some(plan_time.as_millis() as u64);
        execution_info.query_time_ms = Some(query_time.as_millis() as u64);
        execution_info.rows_scanned = rows_scanned;
        execution_info.used_index = Some(used_index);
        execution_info.indexes_used = indexes_used;
        execution_info.query_plan = query_plan;
        execution_info.is_full_table_scan = Some(is_full_table_scan);

        // 检查警告和建议
        execution_info.check_slow_query(1000); // 1秒阈值
        execution_info.check_index_usage();
        execution_info.check_full_table_scan();

        Ok(QueryResult::Rows {
            columns: column_names,
            rows,
            total_count,
            stream_id: None,
            has_more: count >= limit_val,
            execution_info,
        })
    }

    fn execute_statement(
        conn: &mut r2d2::PooledConnection<SqliteConnectionManager>,
        sql: &str,
        start: Instant,
    ) -> AppResult<QueryResult> {
        // 分析查询计划（如果适用）
        let query_plan = Self::analyze_query_plan(conn, sql).unwrap_or_default();
        let (used_index, indexes_used, is_full_table_scan) =
            Self::extract_plan_info(&query_plan);

        let changes_before = conn.changes();

        conn.execute_batch(sql)?;

        let rows_affected = conn.changes() - changes_before;
        let last_insert_id = conn.last_insert_rowid();
        let elapsed = start.elapsed();

        // 构建执行信息
        let mut execution_info =
            QueryExecutionInfo::new(elapsed.as_millis() as u64, rows_affected as usize);
        execution_info.used_index = Some(used_index);
        execution_info.indexes_used = indexes_used;
        execution_info.query_plan = query_plan;
        execution_info.is_full_table_scan = Some(is_full_table_scan);

        // 检查警告
        execution_info.check_slow_query(1000);

        Ok(QueryResult::Execution {
            rows_affected: rows_affected as usize,
            last_insert_id: Some(last_insert_id),
            execution_info,
        })
    }

    /// 分析查询计划
    fn analyze_query_plan(
        conn: &mut r2d2::PooledConnection<SqliteConnectionManager>,
        sql: &str,
    ) -> AppResult<Vec<QueryPlanStep>> {
        let explain_sql = format!("EXPLAIN QUERY PLAN {}", sql);
        let mut stmt = conn.prepare(&explain_sql)?;

        let steps: Result<Vec<QueryPlanStep>, _> = stmt
            .query_map([], |row| {
                Ok(QueryPlanStep {
                    id: row.get(0)?,
                    parent: row.get(1).ok(),
                    not_used: row.get(2).ok(),
                    detail: row.get(3)?,
                })
            })?
            .collect();

        Ok(steps?)
    }

    /// 从查询计划中提取索引和扫描信息
    fn extract_plan_info(plan: &[QueryPlanStep]) -> (bool, Vec<String>, bool) {
        let mut used_index = false;
        let mut indexes_used = Vec::new();
        let mut is_full_table_scan = false;

        for step in plan {
            let detail = step.detail.to_uppercase();

            // 检查是否使用了索引
            if detail.contains("USING INDEX") {
                used_index = true;
                // 提取索引名称
                if let Some(start) = detail.find("USING INDEX ") {
                    let idx_part = &detail[start + 12..];
                    let idx_name = idx_part.split_whitespace().next().unwrap_or("");
                    if !idx_name.is_empty() {
                        indexes_used.push(idx_name.to_string());
                    }
                }
            }

            // 检查是否全表扫描
            if detail.contains("SCAN TABLE") && !detail.contains("USING INDEX") {
                is_full_table_scan = true;
            }
        }

        (used_index, indexes_used, is_full_table_scan)
    }

    /// 估算扫描的行数
    fn estimate_rows_scanned(
        _conn: &mut r2d2::PooledConnection<SqliteConnectionManager>,
        _sql: &str,
        plan: &[QueryPlanStep],
    ) -> AppResult<Option<usize>> {
        // 对于简单的单表查询，尝试获取表行数
        for step in plan {
            let detail = &step.detail;
            if detail.contains("SCAN TABLE") || detail.contains("SEARCH TABLE") {
                // 提取表名
                if let Some(_table_name) = Self::extract_table_name(detail) {
                    // 使用 PRAGMA table_info 来获取表信息，而不是 COUNT(*)
                    // 因为 COUNT(*) 在表大时会很慢
                    return Ok(None);
                }
            }
        }
        Ok(None)
    }

    /// 从计划详情中提取表名
    fn extract_table_name(detail: &str) -> Option<String> {
        // SCAN TABLE table_name
        // SEARCH TABLE table_name USING ...
        if detail.contains("SCAN TABLE") {
            let parts: Vec<_> = detail.split_whitespace().collect();
            if parts.len() >= 3 && parts[0] == "SCAN" && parts[1] == "TABLE" {
                return Some(parts[2].to_string());
            }
        } else if detail.contains("SEARCH TABLE") {
            let parts: Vec<_> = detail.split_whitespace().collect();
            if parts.len() >= 3 && parts[0] == "SEARCH" && parts[1] == "TABLE" {
                return Some(parts[2].to_string());
            }
        }
        None
    }

    fn convert_value(value_ref: ValueRef) -> CellValue {
        match value_ref {
            ValueRef::Null => CellValue::Null,
            ValueRef::Integer(i) => CellValue::Integer(i),
            ValueRef::Real(f) => CellValue::Real(f),
            ValueRef::Text(t) => CellValue::Text(String::from_utf8_lossy(t).to_string()),
            ValueRef::Blob(b) => CellValue::Blob(base64::encode(b)),
        }
    }

    /// 导出查询结果为 CSV
    pub fn export_to_csv(
        pool: &Pool<SqliteConnectionManager>,
        sql: &str,
        output_path: &str,
    ) -> AppResult<()> {
        let result = Self::execute_query(pool, sql, None)?;

        match result {
            QueryResult::Rows {
                columns,
                rows,
                execution_info: _,
                ..
            } => {
                let mut wtr = csv::Writer::from_path(output_path)?;

                // 写入表头
                wtr.write_record(&columns)?;

                // 写入数据
                for row in rows {
                    let record: Vec<String> = columns
                        .iter()
                        .map(|col| match row.values.get(col) {
                            Some(CellValue::Null) => "NULL".to_string(),
                            Some(CellValue::Integer(i)) => i.to_string(),
                            Some(CellValue::Real(f)) => f.to_string(),
                            Some(CellValue::Text(s)) => s.clone(),
                            Some(CellValue::Blob(b)) => b.clone(),
                            Some(CellValue::Boolean(b)) => b.to_string(),
                            None => "".to_string(),
                        })
                        .collect();
                    wtr.write_record(&record)?;
                }

                wtr.flush()?;
                Ok(())
            }
            QueryResult::Execution { .. } => Err(AppError::QueryError(
                "Cannot export DDL/DML results".to_string(),
            )),
        }
    }

    /// 导出查询结果为 JSON
    pub fn export_to_json(
        pool: &Pool<SqliteConnectionManager>,
        sql: &str,
        output_path: &str,
    ) -> AppResult<()> {
        let result = Self::execute_query(pool, sql, None)?;

        match result {
            QueryResult::Rows {
                columns,
                rows,
                execution_info: _,
                ..
            } => {
                let json_rows: Vec<serde_json::Map<String, serde_json::Value>> = rows
                    .into_iter()
                    .map(|row| {
                        let mut map = serde_json::Map::new();
                        for col in &columns {
                            let value = match row.values.get(col) {
                                Some(CellValue::Null) => serde_json::Value::Null,
                                Some(CellValue::Integer(i)) => serde_json::Value::Number((*i).into()),
                                Some(CellValue::Real(f)) => {
                                    serde_json::Number::from_f64(*f)
                                        .map_or(serde_json::Value::Null, serde_json::Value::Number)
                                }
                                Some(CellValue::Text(s)) => serde_json::Value::String(s.clone()),
                                Some(CellValue::Blob(b)) => serde_json::Value::String(b.clone()),
                                Some(CellValue::Boolean(b)) => serde_json::Value::Bool(*b),
                                None => serde_json::Value::Null,
                            };
                            map.insert(col.clone(), value);
                        }
                        map
                    })
                    .collect();

                let json_str = serde_json::to_string_pretty(&json_rows)?;
                std::fs::write(output_path, json_str)?;
                Ok(())
            }
            QueryResult::Execution { .. } => Err(AppError::QueryError(
                "Cannot export DDL/DML results".to_string(),
            )),
        }
    }
}

// Stream Manager for handling large result sets
pub struct StreamManager {
    streams: Arc<Mutex<HashMap<String, StreamState>>>,
}

impl StreamManager {
    pub fn new() -> Self {
        Self {
            streams: Arc::new(Mutex::new(HashMap::new())),
        }
    }

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
            QueryResult::Rows {
                columns,
                rows,
                has_more,
                ..
            } => {
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
            QueryResult::Execution { .. } => Err(AppError::QueryError(
                "Stream not supported for DDL/DML".to_string(),
            )),
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
        for byte in input {
            write!(&mut result, "{:02x}", byte).unwrap();
        }
        result
    }
}
