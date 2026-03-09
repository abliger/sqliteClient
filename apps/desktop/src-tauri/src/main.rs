// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};

mod commands;
mod core;
mod models;
mod utils;

use commands::settings::SettingsStore;
use core::connection_manager::ConnectionManager;
use core::connection_store::ConnectionStore;
use core::crud_log_store::CrudLogStore;
use core::history_store::HistoryStore;

/// 存储待打开的文件路径
struct PendingOpenFile {
    path: Mutex<Option<String>>,
}

/// 菜单文本定义
struct MenuLabels {
    app: &'static str,
    file: &'static str,
    open_db: &'static str,
    create_db: &'static str,
    settings: &'static str,
    quit: &'static str,
}

/// 获取菜单文本
fn get_menu_labels(locale: &str) -> MenuLabels {
    match locale {
        "zh-CN" => MenuLabels {
            app: "应用",
            file: "文件",
            open_db: "打开数据库",
            create_db: "创建数据库",
            settings: "设置",
            quit: "退出",
        },
        _ => MenuLabels {
            app: "App",
            file: "File",
            open_db: "Open Database",
            create_db: "Create Database",
            settings: "Settings",
            quit: "Quit",
        },
    }
}

/// 创建应用菜单
fn create_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    locale: &str,
) -> Result<Menu<R>, tauri::Error> {
    let labels = get_menu_labels(locale);

    let open_db = MenuItem::with_id(app, "open_db", labels.open_db, true, None::<&str>)?;
    let create_db = MenuItem::with_id(app, "create_db", labels.create_db, true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", labels.settings, true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", labels.quit, true, None::<&str>)?;

    // 应用菜单（作为第一个菜单）- 包含设置和退出
    let app_menu = Submenu::with_items(app, labels.app, true, &[&settings, &separator, &quit])?;

    // 文件菜单
    let file_menu = Submenu::with_items(app, labels.file, true, &[&open_db, &create_db])?;

    let menu = Menu::with_items(app, &[&app_menu, &file_menu])?;

    Ok(menu)
}

/// 更新菜单语言
#[tauri::command]
fn update_menu_locale(app_handle: tauri::AppHandle, locale: String) -> Result<(), String> {
    // 移除旧菜单
    app_handle.remove_menu().map_err(|e| e.to_string())?;

    // 创建新菜单
    let menu = create_menu(&app_handle, &locale).map_err(|e| e.to_string())?;
    app_handle.set_menu(menu).map_err(|e| e.to_string())?;

    Ok(())
}

fn main() {
    // 收集命令行参数中的文件路径
    let args: Vec<String> = std::env::args().collect();
    let file_to_open = args.get(1).cloned();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(PendingOpenFile {
            path: Mutex::new(file_to_open),
        })
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
                ConnectionStore::new(app_handle).expect("Failed to initialize connection store"),
            );

            // 初始化连接管理器
            let connection_manager =
                ConnectionManager::new(connection_store.clone(), history_store.clone());

            // 初始化 CRUD 日志存储
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
            let crud_log_store = Arc::new(
                CrudLogStore::new(&app_data_dir).expect("Failed to initialize CRUD log store"),
            );

            // 初始化设置存储
            let settings_store =
                SettingsStore::new(app_handle).expect("Failed to initialize settings store");

            // 创建菜单（使用当前语言设置，默认为英文）
            let current_locale = settings_store
                .get_locale()
                .unwrap_or_else(|_| "en".to_string());
            let menu = create_menu(app_handle, &current_locale)?;
            app_handle.set_menu(menu)?;

            app.manage(connection_manager);
            app.manage(connection_store);
            app.manage(history_store.clone());
            app.manage(crud_log_store);
            app.manage(settings_store);

            // 检查是否有待打开的文件（来自命令行参数）
            if let Ok(pending) = app.state::<PendingOpenFile>().path.lock() {
                if let Some(path) = pending.as_ref() {
                    println!("[Main] Pending file to open from CLI: {}", path);
                    let _ = app_handle.emit("open-database-file", path.clone());
                }
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "open_db" => {
                    let _ = app.emit("menu-open-db", ());
                }
                "create_db" => {
                    let _ = app.emit("menu-create-db", ());
                }
                "settings" => {
                    let _ = app.emit("menu-settings", ());
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            }
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
            commands::query::execute_sql_file,
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
            // CRUD 日志
            commands::crud_log::add_crud_log,
            commands::crud_log::query_crud_logs,
            commands::crud_log::count_crud_logs_by_tab,
            commands::crud_log::delete_crud_logs_by_tab,
            commands::crud_log::get_crud_log_table_names,
            commands::crud_log::get_crud_log_stats,
            // DDL 操作
            commands::ddl::preview_create_table,
            commands::ddl::preview_alter_table,
            commands::ddl::preview_drop_table,
            commands::ddl::create_table,
            commands::ddl::alter_table,
            commands::ddl::drop_table,
            commands::ddl::get_sqlite_data_types,
            commands::ddl::get_foreign_key_actions,
            // 导入
            commands::import::parse_import_file,
            commands::import::detect_column_types,
            commands::import::execute_import,
            commands::import::get_supported_import_formats,
            commands::import::validate_table_name,
            // 设置
            commands::settings::get_app_settings,
            commands::settings::save_app_settings,
            update_menu_locale,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
