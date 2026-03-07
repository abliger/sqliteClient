use std::path::Path;

use tauri::State;

use crate::core::connection_manager::ConnectionManager;
use crate::models::query::QueryResult;
use crate::utils::csv_export::export_rows_to_csv;
use crate::utils::error::AppResult;
use crate::utils::json_export::export_rows_to_json;

#[tauri::command]
pub async fn export_to_csv(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    sql: String,
    output_path: String,
) -> AppResult<()> {
    let pool = connection_manager.get_pool(&connection_id)?;

    let result = crate::core::query_engine::QueryEngine::execute_query(&pool, &sql, None)?;

    match result {
        QueryResult::Rows { columns, rows, .. } => {
            export_rows_to_csv(&rows, &columns, Path::new(&output_path))?;
            Ok(())
        }
        QueryResult::Execution { .. } => Err(crate::utils::error::AppError::InvalidParameter(
            "Cannot export DDL/DML results".to_string(),
        )),
    }
}

#[tauri::command]
pub async fn export_to_json(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    sql: String,
    output_path: String,
    pretty: Option<bool>,
) -> AppResult<()> {
    let pool = connection_manager.get_pool(&connection_id)?;

    let result = crate::core::query_engine::QueryEngine::execute_query(&pool, &sql, None)?;

    match result {
        QueryResult::Rows { rows, .. } => {
            export_rows_to_json(&rows, Path::new(&output_path), pretty.unwrap_or(true))?;
            Ok(())
        }
        QueryResult::Execution { .. } => Err(crate::utils::error::AppError::InvalidParameter(
            "Cannot export DDL/DML results".to_string(),
        )),
    }
}

#[tauri::command]
pub async fn export_query_to_file(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    sql: String,
    output_path: String,
    format: String,
) -> AppResult<()> {
    match format.as_str() {
        "csv" => export_to_csv(connection_manager, connection_id, sql, output_path).await,
        "json" => {
            export_to_json(
                connection_manager,
                connection_id,
                sql,
                output_path,
                Some(true),
            )
            .await
        }
        _ => Err(crate::utils::error::AppError::InvalidParameter(format!(
            "Unsupported format: {}",
            format
        ))),
    }
}
