use std::sync::Arc;
use std::time::Instant;

use tauri::State;

use crate::core::connection_manager::ConnectionManager;
use crate::core::history_store::HistoryStore;
use crate::models::history::QueryHistoryItem;
use crate::models::query::{QueryResult, StreamStatus};
use crate::utils::error::AppResult;

#[tauri::command]
pub async fn execute_query(
    connection_manager: State<'_, ConnectionManager>,
    history_store: State<'_, Arc<HistoryStore>>,
    connection_id: String,
    sql: String,
    limit: Option<usize>,
) -> AppResult<QueryResult> {
    let start = Instant::now();
    let pool = connection_manager.get_pool(&connection_id)?;
    
    let result = crate::core::query_engine::QueryEngine::execute_query(&pool, &sql, limit);
    
    let duration_ms = start.elapsed().as_millis() as u64;
    
    // 记录历史
    let history_item = QueryHistoryItem {
        id: uuid::Uuid::new_v4().to_string(),
        sql: sql.clone(),
        connection_id: Some(connection_id.clone()),
        connection_name: None,
        executed_at: chrono::Utc::now(),
        duration_ms,
        is_success: result.is_ok(),
        error_message: result.as_ref().err().map(|e| e.to_string()),
        row_count: match &result {
            Ok(QueryResult::Rows { rows, .. }) => Some(rows.len()),
            Ok(QueryResult::Execution { rows_affected, .. }) => Some(*rows_affected),
            Err(_) => None,
        },
    };
    
    let _ = history_store.add_history_item(&history_item);
    
    result
}

#[tauri::command]
pub async fn execute_query_stream(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    sql: String,
    batch_size: usize,
) -> AppResult<StreamStatus> {
    let pool = connection_manager.get_pool(&connection_id)?;
    
    // 简化实现：先返回普通查询结果，标记为流式
    let result = crate::core::query_engine::QueryEngine::execute_query(&pool, &sql, Some(batch_size))?;
    
    match result {
        QueryResult::Rows { columns, rows, has_more, .. } => {
            Ok(StreamStatus {
                stream_id: uuid::Uuid::new_v4().to_string(),
                total_rows: None,
                fetched_rows: rows.len(),
                has_more,
                columns,
            })
        }
        QueryResult::Execution { .. } => {
            Err(crate::utils::error::AppError::QueryError(
                "Stream not supported for DDL/DML".to_string()
            ))
        }
    }
}

#[tauri::command]
pub async fn fetch_stream_batch(
    _stream_id: String,
    _batch_size: usize,
) -> AppResult<Vec<crate::models::query::QueryRow>> {
    // 简化实现：流式查询需要更复杂的存储机制
    // 这里返回空数组，表示没有更多数据
    Ok(vec![])
}

#[tauri::command]
pub async fn cancel_query(
    _query_id: String,
) -> AppResult<()> {
    // 实现查询取消逻辑
    Ok(())
}
