use std::sync::Arc;
use std::time::Instant;

use tauri::{State, AppHandle, Emitter};

use crate::core::connection_manager::ConnectionManager;
use crate::core::history_store::HistoryStore;
use crate::models::history::QueryHistoryItem;
use crate::models::query::{QueryResult, StreamStatus, SqlFileExecutionProgress, SqlFileExecutionResult, StatementExecutionResult};
use crate::utils::error::{AppResult, AppError};

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
    let result =
        crate::core::query_engine::QueryEngine::execute_query(&pool, &sql, Some(batch_size))?;

    match result {
        QueryResult::Rows {
            columns,
            rows,
            has_more,
            ..
        } => Ok(StreamStatus {
            stream_id: uuid::Uuid::new_v4().to_string(),
            total_rows: None,
            fetched_rows: rows.len(),
            has_more,
            columns,
        }),
        QueryResult::Execution { .. } => Err(crate::utils::error::AppError::QueryError(
            "Stream not supported for DDL/DML".to_string(),
        )),
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
pub async fn cancel_query(_query_id: String) -> AppResult<()> {
    // 实现查询取消逻辑
    Ok(())
}

/// 解析 SQL 文件，将内容分割成单独的语句
fn parse_sql_statements(sql_content: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current_statement = String::new();
    let mut in_string = false;
    let mut string_char = ' ';
    let mut prev_char = ' ';

    for ch in sql_content.chars() {
        // 处理字符串边界
        if !in_string && (ch == '\'' || ch == '"') {
            in_string = true;
            string_char = ch;
        } else if in_string && ch == string_char && prev_char != '\\' {
            in_string = false;
        }

        // 检测语句结束（不在字符串内时）
        if !in_string && ch == ';' {
            current_statement.push(ch);
            let stmt = current_statement.trim().to_string();
            if !stmt.is_empty() {
                statements.push(stmt);
            }
            current_statement = String::new();
        } else {
            current_statement.push(ch);
        }

        prev_char = ch;
    }

    // 处理最后一个语句（可能没有分号结尾）
    let last_stmt = current_statement.trim().to_string();
    if !last_stmt.is_empty() {
        statements.push(last_stmt);
    }

    statements
}

/// 执行 SQL 文件
/// 
/// 通过事件发射进度更新：sql-file-execution-progress
/// 事件数据：SqlFileExecutionProgress
#[tauri::command]
pub async fn execute_sql_file(
    app_handle: AppHandle,
    connection_manager: State<'_, ConnectionManager>,
    history_store: State<'_, Arc<HistoryStore>>,
    connection_id: String,
    file_path: String,
) -> AppResult<SqlFileExecutionResult> {
    let start_time = Instant::now();
    
    // 读取文件内容
    let sql_content = std::fs::read_to_string(&file_path)
        .map_err(|e| AppError::FileError(format!("Failed to read SQL file: {}", e)))?;
    
    // 解析 SQL 语句
    let statements = parse_sql_statements(&sql_content);
    let total_statements = statements.len();
    
    if total_statements == 0 {
        return Err(AppError::QueryError("No valid SQL statements found in file".to_string()));
    }
    
    let pool = connection_manager.get_pool(&connection_id)?;
    let mut execution_results = Vec::new();
    let mut success_count = 0;
    let mut error_count = 0;
    
    // 执行每条语句
    for (index, sql) in statements.iter().enumerate() {
        let stmt_start = Instant::now();
        
        // 截断 SQL 用于显示（限制 100 字符）
        let display_sql = if sql.len() > 100 {
            format!("{}...", &sql[..100])
        } else {
            sql.clone()
        };
        
        // 发射进度事件
        let progress = SqlFileExecutionProgress {
            current_statement: index + 1,
            total_statements,
            current_sql: display_sql.clone(),
            success_count,
            error_count,
            is_complete: false,
        };
        
        let _ = app_handle.emit("sql-file-execution-progress", &progress);
        
        // 执行语句
        let result = crate::core::query_engine::QueryEngine::execute_query(&pool, sql, None);
        let duration_ms = stmt_start.elapsed().as_millis() as u64;
        
        let statement_result = match result {
            Ok(QueryResult::Rows { rows, .. }) => {
                success_count += 1;
                StatementExecutionResult {
                    index: index + 1,
                    sql: display_sql,
                    success: true,
                    error_message: None,
                    duration_ms,
                    rows_affected: Some(rows.len()),
                }
            }
            Ok(QueryResult::Execution { rows_affected, execution_info: _, .. }) => {
                success_count += 1;
                StatementExecutionResult {
                    index: index + 1,
                    sql: display_sql,
                    success: true,
                    error_message: None,
                    duration_ms,
                    rows_affected: Some(rows_affected),
                }
            }
            Err(e) => {
                error_count += 1;
                StatementExecutionResult {
                    index: index + 1,
                    sql: display_sql,
                    success: false,
                    error_message: Some(e.to_string()),
                    duration_ms,
                    rows_affected: None,
                }
            }
        };
        
        // 记录到历史
        let history_item = QueryHistoryItem {
            id: uuid::Uuid::new_v4().to_string(),
            sql: sql.clone(),
            connection_id: Some(connection_id.clone()),
            connection_name: None,
            executed_at: chrono::Utc::now(),
            duration_ms: statement_result.duration_ms,
            is_success: statement_result.success,
            error_message: statement_result.error_message.clone(),
            row_count: statement_result.rows_affected,
        };
        let _ = history_store.add_history_item(&history_item);
        
        execution_results.push(statement_result);
    }
    
    // 发射完成事件
    let final_progress = SqlFileExecutionProgress {
        current_statement: total_statements,
        total_statements,
        current_sql: "Complete".to_string(),
        success_count,
        error_count,
        is_complete: true,
    };
    let _ = app_handle.emit("sql-file-execution-progress", &final_progress);
    
    let total_duration_ms = start_time.elapsed().as_millis() as u64;
    
    Ok(SqlFileExecutionResult {
        file_path,
        total_statements,
        success_count,
        error_count,
        statements: execution_results,
        total_duration_ms,
    })
}
