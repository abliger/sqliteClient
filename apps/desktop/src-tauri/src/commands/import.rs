use std::collections::HashMap;
use std::sync::Arc;

use tauri::State;

use crate::core::connection_manager::ConnectionManager;
use crate::core::import_engine::{ImportEngine, ImportPreview, ImportResult};
use crate::models::import::{ImportConfig, ImportFileInfo};
use crate::utils::error::AppResult;

/// 解析导入文件，获取预览数据
#[tauri::command]
pub async fn parse_import_file(file_path: String, file_type: String) -> AppResult<ImportPreview> {
    let engine = ImportEngine::new()?;
    engine.parse_file(&file_path, &file_type).await
}

/// 检测列数据类型
#[tauri::command]
pub async fn detect_column_types(
    preview_data: Vec<HashMap<String, String>>,
) -> AppResult<HashMap<String, String>> {
    let engine = ImportEngine::new()?;
    Ok(engine.detect_column_types(&preview_data))
}

/// 执行数据导入
#[tauri::command]
pub async fn execute_import(
    connection_manager: State<'_, Arc<ConnectionManager>>,
    connection_id: String,
    config: ImportConfig,
    preview_data: Vec<HashMap<String, String>>,
) -> AppResult<ImportResult> {
    let engine = ImportEngine::new()?;
    engine
        .execute_import(&connection_manager, &connection_id, &config, &preview_data)
        .await
}

/// 获取支持的文件类型
#[tauri::command]
pub async fn get_supported_import_formats() -> AppResult<Vec<ImportFileInfo>> {
    Ok(vec![
        ImportFileInfo {
            extension: "csv".to_string(),
            name: "CSV".to_string(),
            description: "Comma-separated values".to_string(),
        },
        ImportFileInfo {
            extension: "xlsx".to_string(),
            name: "Excel".to_string(),
            description: "Microsoft Excel (.xlsx)".to_string(),
        },
        ImportFileInfo {
            extension: "xls".to_string(),
            name: "Excel 97-2003".to_string(),
            description: "Microsoft Excel 97-2003 (.xls)".to_string(),
        },
    ])
}

/// 验证表名是否可用
#[tauri::command]
pub async fn validate_table_name(
    connection_manager: State<'_, Arc<ConnectionManager>>,
    connection_id: String,
    table_name: String,
) -> AppResult<bool> {
    let engine = ImportEngine::new()?;
    engine
        .validate_table_name(&connection_manager, &connection_id, &table_name)
        .await
}
