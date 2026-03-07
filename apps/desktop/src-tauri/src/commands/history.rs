use std::sync::Arc;

use tauri::State;

use crate::core::history_store::HistoryStore;
use crate::models::history::{QueryHistoryFilter, QueryHistoryItem};
use crate::utils::error::AppResult;

#[tauri::command]
pub async fn get_query_history(
    history_store: State<'_, Arc<HistoryStore>>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> AppResult<Vec<QueryHistoryItem>> {
    let filter = QueryHistoryFilter {
        limit: limit.unwrap_or(100),
        offset: offset.unwrap_or(0),
        ..Default::default()
    };

    history_store.get_history(&filter)
}

#[tauri::command]
pub async fn search_history(
    history_store: State<'_, Arc<HistoryStore>>,
    query: String,
    limit: Option<usize>,
) -> AppResult<Vec<QueryHistoryItem>> {
    history_store.search_history(&query, limit.unwrap_or(50))
}

#[tauri::command]
pub async fn delete_history_item(
    history_store: State<'_, Arc<HistoryStore>>,
    id: String,
) -> AppResult<()> {
    history_store.delete_history_item(&id)
}

#[tauri::command]
pub async fn clear_history(
    history_store: State<'_, Arc<HistoryStore>>,
    connection_id: Option<String>,
) -> AppResult<usize> {
    history_store.clear_history(connection_id.as_deref())
}
