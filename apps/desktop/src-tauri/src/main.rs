// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;

use tauri::Manager;

mod commands;
mod core;
mod models;
mod utils;

use commands::settings::SettingsStore;
use core::connection_manager::ConnectionManager;
use core::connection_store::ConnectionStore;
use core::history_store::HistoryStore;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 初始化应用状态
            let app_handle = app.handle();

            // 初始化历史记录存储
            let history_store = Arc::new(tauri::async_runtime::block_on(async {
                HistoryStore::new(app_handle)
                    .await
                    .expect("Failed to initialize history store")
            }));

            // 初始化连接配置存储
            let connection_store = Arc::new(
                ConnectionStore::new(app_handle).expect("Failed to initialize connection store")
            );

            // 初始化连接管理器
            let connection_manager = ConnectionManager::new(connection_store.clone(), history_store.clone());

            // 初始化设置存储
            let settings_store =
                SettingsStore::new(app_handle).expect("Failed to initialize settings store");

            app.manage(connection_manager);
            app.manage(connection_store);
            app.manage(history_store.clone());
            app.manage(settings_store);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 连接管理
            commands::connection::create_connection,
            commands::connection::create_new_database,
            commands::connection::close_connection,
            commands::connection::list_connections,
            commands::connection::get_connection_info,
            commands::connection::test_connection,
            commands::connection::restore_saved_connections,
            commands::connection::load_saved_connection_configs,
            // 查询执行
            commands::query::execute_query,
            commands::query::execute_query_stream,
            commands::query::fetch_stream_batch,
            commands::query::cancel_query,
            // 元数据/结构
            commands::schema::list_tables,
            commands::schema::get_table_schema,
            commands::schema::get_database_schema,
            commands::schema::get_er_diagram_data,
            commands::schema::list_indexes,
            commands::schema::list_triggers,
            // CRUD 操作
            commands::crud::insert_row,
            commands::crud::update_row,
            commands::crud::delete_row,
            commands::crud::get_table_data,
            // 导出
            commands::export::export_to_csv,
            commands::export::export_to_json,
            commands::export::export_query_to_file,
            // 历史记录
            commands::history::get_query_history,
            commands::history::search_history,
            commands::history::delete_history_item,
            commands::history::clear_history,
            // 设置
            commands::settings::get_app_settings,
            commands::settings::save_app_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
