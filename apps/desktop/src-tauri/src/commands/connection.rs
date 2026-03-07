use tauri::State;

use crate::core::connection_manager::ConnectionManager;
use crate::core::connection_store::ConnectionStore;
use crate::models::connection::{ConnectionConfig, ConnectionInfo};
use crate::utils::error::AppResult;

#[tauri::command]
pub async fn create_connection(
    connection_manager: State<'_, ConnectionManager>,
    name: String,
    db_path: String,
) -> AppResult<ConnectionInfo> {
    connection_manager.create_connection(name, db_path)
}

#[allow(dead_code)]
#[tauri::command]
pub async fn create_new_database(
    connection_manager: State<'_, ConnectionManager>,
    name: String,
    db_path: String,
) -> AppResult<ConnectionInfo> {
    connection_manager.create_new_database(name, db_path)
}

#[tauri::command]
pub async fn close_connection(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> AppResult<()> {
    connection_manager.close_connection(&connection_id)
}

#[tauri::command]
pub async fn list_connections(
    connection_manager: State<'_, ConnectionManager>,
) -> AppResult<Vec<ConnectionInfo>> {
    Ok(connection_manager.list_connections())
}

#[tauri::command]
pub async fn get_connection_info(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> AppResult<ConnectionInfo> {
    connection_manager.get_connection_info(&connection_id)
}

#[tauri::command]
pub async fn test_connection(db_path: String) -> AppResult<()> {
    ConnectionManager::test_connection(&db_path)
}

#[allow(dead_code)]
#[tauri::command]
pub async fn refresh_connection_metadata(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> AppResult<crate::models::connection::DatabaseMetadata> {
    connection_manager.refresh_metadata(&connection_id)
}

/// 恢复所有保存的连接（应用启动时调用）
#[tauri::command]
pub async fn restore_saved_connections(
    connection_manager: State<'_, ConnectionManager>,
) -> AppResult<Vec<ConnectionInfo>> {
    connection_manager.restore_connections()
}

/// 加载保存的连接配置（不自动连接）
#[tauri::command]
pub async fn load_saved_connection_configs(
    connection_store: State<'_, ConnectionStore>,
) -> AppResult<Vec<ConnectionConfig>> {
    connection_store.load_connections()
}
