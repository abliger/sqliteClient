use std::sync::Arc;

use tauri::State;

use crate::core::crud_log_store::CrudLogStore;
use crate::models::crud_log::{CrudLogFilter, CrudOperationLog, CrudOperationType};
use crate::utils::error::AppResult;

/// 添加 CRUD 操作日志
#[tauri::command]
pub async fn add_crud_log(
    log_store: State<'_, Arc<CrudLogStore>>,
    log: CrudOperationLog,
) -> AppResult<()> {
    log_store.add_log(&log)
}

/// 查询 CRUD 操作日志
#[tauri::command]
pub async fn query_crud_logs(
    log_store: State<'_, Arc<CrudLogStore>>,
    filter: CrudLogFilter,
    limit: usize,
) -> AppResult<Vec<CrudOperationLog>> {
    log_store.query_logs(&filter, limit)
}

/// 获取指定 Tab 的日志数量
#[tauri::command]
pub async fn count_crud_logs_by_tab(
    log_store: State<'_, Arc<CrudLogStore>>,
    tab_id: String,
) -> AppResult<usize> {
    log_store.count_logs_by_tab(&tab_id)
}

/// 删除指定 Tab 的日志
#[tauri::command]
pub async fn delete_crud_logs_by_tab(
    log_store: State<'_, Arc<CrudLogStore>>,
    tab_id: String,
) -> AppResult<usize> {
    log_store.delete_logs_by_tab(&tab_id)
}

/// 获取所有表名（用于筛选）
#[tauri::command]
pub async fn get_crud_log_table_names(
    log_store: State<'_, Arc<CrudLogStore>>,
) -> AppResult<Vec<String>> {
    log_store.get_table_names()
}

/// 获取 CRUD 日志统计
#[tauri::command]
pub async fn get_crud_log_stats(
    log_store: State<'_, Arc<CrudLogStore>>,
    connection_id: Option<String>,
) -> AppResult<CrudLogStatsResponse> {
    let stats = log_store.get_stats(connection_id.as_deref())?;
    Ok(CrudLogStatsResponse {
        total: stats.total,
        success: stats.success,
        failed: stats.total - stats.success,
        inserts: stats.inserts,
        updates: stats.updates,
        deletes: stats.deletes,
    })
}

/// 统计信息响应
#[derive(serde::Serialize)]
pub struct CrudLogStatsResponse {
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub inserts: usize,
    pub updates: usize,
    pub deletes: usize,
}
