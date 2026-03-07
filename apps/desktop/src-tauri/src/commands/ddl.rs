use tauri::State;

use crate::core::connection_manager::ConnectionManager;
use crate::core::ddl_engine::DdlEngine;
use crate::models::ddl::*;
use crate::utils::error::AppResult;

/// 预览创建表的DDL
#[tauri::command]
pub async fn preview_create_table(table: DesignerTable) -> AppResult<PreviewDdlResult> {
    DdlEngine::preview_create_table(&table)
}

/// 预览修改表的DDL
#[tauri::command]
pub async fn preview_alter_table(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table_name: String,
    changes: Vec<TableChange>,
) -> AppResult<PreviewDdlResult> {
    let pool = connection_manager.get_pool(&connection_id)?;
    DdlEngine::preview_alter_table(&pool, &table_name, &changes)
}

/// 预览删除表的DDL
#[tauri::command]
pub async fn preview_drop_table(table_name: String) -> AppResult<PreviewDdlResult> {
    DdlEngine::preview_drop_table(&table_name)
}

/// 创建表
#[tauri::command]
pub async fn create_table(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table: DesignerTable,
) -> AppResult<DdlExecutionResult> {
    let pool = connection_manager.get_pool(&connection_id)?;
    DdlEngine::execute_create_table(&pool, &table)
}

/// 修改表
#[tauri::command]
pub async fn alter_table(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table_name: String,
    changes: Vec<TableChange>,
) -> AppResult<DdlExecutionResult> {
    let pool = connection_manager.get_pool(&connection_id)?;
    DdlEngine::execute_alter_table(&pool, &table_name, &changes)
}

/// 删除表
#[tauri::command]
pub async fn drop_table(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table_name: String,
) -> AppResult<DdlExecutionResult> {
    let pool = connection_manager.get_pool(&connection_id)?;
    DdlEngine::execute_drop_table(&pool, &table_name)
}

/// 获取SQLite支持的数据类型列表
#[tauri::command]
pub async fn get_sqlite_data_types() -> Vec<String> {
    vec![
        "INTEGER".to_string(),
        "REAL".to_string(),
        "TEXT".to_string(),
        "BLOB".to_string(),
        "NUMERIC".to_string(),
        "BOOLEAN".to_string(),
        "DATETIME".to_string(),
        "DATE".to_string(),
        "TIME".to_string(),
        "VARCHAR".to_string(),
        "CHAR".to_string(),
        "DECIMAL".to_string(),
        "FLOAT".to_string(),
        "DOUBLE".to_string(),
        "INT".to_string(),
        "BIGINT".to_string(),
        "SMALLINT".to_string(),
        "TINYINT".to_string(),
    ]
}

/// 获取外键动作选项
#[tauri::command]
pub async fn get_foreign_key_actions() -> Vec<String> {
    vec![
        "NO ACTION".to_string(),
        "RESTRICT".to_string(),
        "SET NULL".to_string(),
        "SET DEFAULT".to_string(),
        "CASCADE".to_string(),
    ]
}
