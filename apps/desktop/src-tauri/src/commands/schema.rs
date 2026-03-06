use tauri::State;

use crate::core::connection_manager::ConnectionManager;
use crate::core::schema_analyzer::SchemaAnalyzer;
use crate::models::erdiagram::ERDiagram;
use crate::models::schema::{DatabaseSchema, IndexInfo, TableInfo, TriggerInfo};
use crate::utils::error::AppResult;

#[tauri::command]
pub async fn list_tables(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> AppResult<Vec<TableInfo>> {
    let pool = connection_manager.get_pool(&connection_id)?;
    SchemaAnalyzer::list_tables(&pool)
}

#[tauri::command]
pub async fn get_table_schema(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table_name: String,
) -> AppResult<TableInfo> {
    let pool = connection_manager.get_pool(&connection_id)?;
    let tables = SchemaAnalyzer::list_tables(&pool)?;
    
    tables
        .into_iter()
        .find(|t| t.name == table_name)
        .ok_or_else(|| crate::utils::error::AppError::NotFound(
            format!("Table {} not found", table_name)
        ))
}

#[tauri::command]
pub async fn get_database_schema(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> AppResult<DatabaseSchema> {
    let pool = connection_manager.get_pool(&connection_id)?;
    SchemaAnalyzer::get_database_schema(&pool)
}

#[tauri::command]
pub async fn get_er_diagram_data(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> AppResult<ERDiagram> {
    let pool = connection_manager.get_pool(&connection_id)?;
    SchemaAnalyzer::generate_er_diagram_data(&pool)
}

#[tauri::command]
pub async fn list_indexes(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> AppResult<Vec<IndexInfo>> {
    let pool = connection_manager.get_pool(&connection_id)?;
    SchemaAnalyzer::list_indexes(&pool)
}

#[tauri::command]
pub async fn list_triggers(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> AppResult<Vec<TriggerInfo>> {
    let pool = connection_manager.get_pool(&connection_id)?;
    SchemaAnalyzer::list_triggers(&pool)
}
