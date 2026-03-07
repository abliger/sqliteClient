use std::collections::HashMap;

use tauri::State;

use crate::core::connection_manager::ConnectionManager;
use crate::models::query::{CellValue, QueryResult};
use crate::utils::error::{AppError, AppResult};

#[tauri::command]
pub async fn get_table_data(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table_name: String,
    limit: Option<usize>,
    offset: Option<usize>,
    order_by: Option<String>,
    order_dir: Option<String>,
) -> AppResult<QueryResult> {
    let pool = connection_manager.get_pool(&connection_id)?;
    
    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);
    
    let order_clause = match order_by {
        Some(col) => {
            let dir = order_dir.unwrap_or_else(|| "ASC".to_string());
            format!("ORDER BY \"{}\" {}", col, dir)
        }
        None => String::new(),
    };
    
    let sql = format!(
        "SELECT * FROM \"{}\" {} LIMIT {} OFFSET {}",
        table_name, order_clause, limit, offset
    );
    
    crate::core::query_engine::QueryEngine::execute_query(&pool, &sql, None)
}

#[tauri::command]
pub async fn insert_row(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table_name: String,
    data: HashMap<String, CellValue>,
) -> AppResult<QueryResult> {
    let pool = connection_manager.get_pool(&connection_id)?;
    
    if data.is_empty() {
        return Err(AppError::InvalidParameter("No data provided".to_string()));
    }
    
    let columns: Vec<String> = data.keys().cloned().collect();
    let values: Vec<String> = data.values().map(|v| cell_value_to_sql(v)).collect();
    
    let sql = format!(
        "INSERT INTO \"{}\" ({}) VALUES ({})",
        table_name,
        columns.iter().map(|c| format!("\"{}\"", c)).collect::<Vec<_>>().join(", "),
        values.join(", ")
    );
    
    crate::core::query_engine::QueryEngine::execute_query(&pool, &sql, None)
}

#[tauri::command]
pub async fn update_row(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table_name: String,
    data: HashMap<String, CellValue>,
    conditions: HashMap<String, CellValue>,
) -> AppResult<QueryResult> {
    let pool = connection_manager.get_pool(&connection_id)?;
    
    if data.is_empty() {
        return Err(AppError::InvalidParameter("No data provided".to_string()));
    }
    
    if conditions.is_empty() {
        return Err(AppError::InvalidParameter(
            "Update requires conditions to prevent accidental updates".to_string()
        ));
    }
    
    let set_clause: Vec<String> = data
        .iter()
        .map(|(k, v)| format!("\"{}\" = {}", k, cell_value_to_sql(v)))
        .collect();
    
    let where_clause: Vec<String> = conditions
        .iter()
        .map(|(k, v)| format!("\"{}\" = {}", k, cell_value_to_sql(v)))
        .collect();
    
    let sql = format!(
        "UPDATE \"{}\" SET {} WHERE {}",
        table_name,
        set_clause.join(", "),
        where_clause.join(" AND ")
    );
    
    crate::core::query_engine::QueryEngine::execute_query(&pool, &sql, None)
}

#[tauri::command]
pub async fn delete_row(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table_name: String,
    conditions: HashMap<String, CellValue>,
) -> AppResult<QueryResult> {
    let pool = connection_manager.get_pool(&connection_id)?;
    
    if conditions.is_empty() {
        return Err(AppError::InvalidParameter(
            "Delete requires conditions to prevent accidental deletions".to_string()
        ));
    }
    
    let where_clause: Vec<String> = conditions
        .iter()
        .map(|(k, v)| format!("\"{}\" = {}", k, cell_value_to_sql(v)))
        .collect();
    
    let sql = format!(
        "DELETE FROM \"{}\" WHERE {}",
        table_name,
        where_clause.join(" AND ")
    );
    
    crate::core::query_engine::QueryEngine::execute_query(&pool, &sql, None)
}

fn cell_value_to_sql(value: &CellValue) -> String {
    match value {
        CellValue::Null => "NULL".to_string(),
        CellValue::Integer(i) => i.to_string(),
        CellValue::Real(f) => f.to_string(),
        CellValue::Text(s) => format!("'{}'", s.replace("'", "''")),
        CellValue::Blob(b) => format!("X'{}'", b),
        CellValue::Boolean(b) => if *b { "1" } else { "0" }.to_string(),
    }
}
