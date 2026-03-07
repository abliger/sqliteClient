use std::collections::HashMap;

use tauri::State;

use crate::core::connection_manager::ConnectionManager;
use crate::models::query::{CellValue, QueryResult};
use crate::utils::error::{AppError, AppResult};

/// 验证表名/列名是否合法（防止标识符注入）
fn validate_identifier(name: &str) -> AppResult<()> {
    if name.is_empty() {
        return Err(AppError::InvalidParameter(
            "Identifier cannot be empty".to_string(),
        ));
    }
    // 只允许字母、数字、下划线，且不能以数字开头
    let valid = name.chars().enumerate().all(|(i, c)| {
        if i == 0 {
            c.is_alphabetic() || c == '_'
        } else {
            c.is_alphanumeric() || c == '_'
        }
    });
    if !valid {
        return Err(AppError::InvalidParameter(format!(
            "Invalid identifier: {}. Only alphanumeric and underscore allowed",
            name
        )));
    }
    Ok(())
}

/// 将 CellValue 转换为 rusqlite 参数
fn cell_value_to_param(value: &CellValue) -> rusqlite::types::Value {
    match value {
        CellValue::Null => rusqlite::types::Value::Null,
        CellValue::Integer(i) => rusqlite::types::Value::Integer(*i),
        CellValue::Real(f) => rusqlite::types::Value::Real(*f),
        CellValue::Text(s) => rusqlite::types::Value::Text(s.clone()),
        CellValue::Blob(b) => rusqlite::types::Value::Blob(hex::decode(b).unwrap_or_default()),
        CellValue::Boolean(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
    }
}

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
    // 验证表名
    validate_identifier(&table_name)?;

    let pool = connection_manager.get_pool(&connection_id)?;
    let conn = pool
        .get()
        .map_err(|e| AppError::ConnectionError(e.to_string()))?;

    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);

    // 构建 SQL（表名用双引号包裹，limit/offset 用参数）
    let sql = if let Some(col) = order_by {
        // 验证列名
        validate_identifier(&col)?;
        let dir = order_dir.unwrap_or_else(|| "ASC".to_string());
        // 验证排序方向
        let dir = if dir.eq_ignore_ascii_case("DESC") {
            "DESC"
        } else {
            "ASC"
        };
        format!(
            "SELECT * FROM \"{}\" ORDER BY \"{}\" {} LIMIT ?1 OFFSET ?2",
            table_name, col, dir
        )
    } else {
        format!("SELECT * FROM \"{}\" LIMIT ?1 OFFSET ?2", table_name)
    };

    // 执行参数化查询
    let mut stmt = conn.prepare(&sql)?;
    let column_names: Vec<String> = stmt
        .column_names()
        .into_iter()
        .map(|s| s.to_string())
        .collect();

    let rows_iter = stmt.query_map(rusqlite::params![limit as i64, offset as i64], |row| {
        let mut values = std::collections::HashMap::new();
        for (i, col_name) in column_names.iter().enumerate() {
            let value: rusqlite::types::Value = row.get(i)?;
            let cell_value = match value {
                rusqlite::types::Value::Null => CellValue::Null,
                rusqlite::types::Value::Integer(i) => CellValue::Integer(i),
                rusqlite::types::Value::Real(f) => CellValue::Real(f),
                rusqlite::types::Value::Text(s) => CellValue::Text(s),
                rusqlite::types::Value::Blob(b) => {
                    CellValue::Blob(b.iter().map(|b| format!("{:02x}", b)).collect())
                }
            };
            values.insert(col_name.clone(), cell_value);
        }
        Ok(crate::models::query::QueryRow { values })
    })?;

    let rows: Result<Vec<_>, _> = rows_iter.collect();
    let rows = rows?;
    let row_count = rows.len();

    Ok(QueryResult::Rows {
        columns: column_names,
        rows,
        total_count: Some(row_count),
        stream_id: None,
        has_more: row_count >= limit,
        execution_info: crate::models::query::QueryExecutionInfo::new(0, row_count),
    })
}

#[tauri::command]
pub async fn insert_row(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table_name: String,
    data: HashMap<String, CellValue>,
) -> AppResult<QueryResult> {
    // 验证表名
    validate_identifier(&table_name)?;

    let pool = connection_manager.get_pool(&connection_id)?;
    let conn = pool
        .get()
        .map_err(|e| AppError::ConnectionError(e.to_string()))?;

    if data.is_empty() {
        return Err(AppError::InvalidParameter("No data provided".to_string()));
    }

    // 验证所有列名
    for col in data.keys() {
        validate_identifier(col)?;
    }

    let columns: Vec<String> = data.keys().cloned().collect();
    let params: Vec<rusqlite::types::Value> = columns
        .iter()
        .map(|col| cell_value_to_param(&data[col]))
        .collect();

    // 构建参数化 SQL
    let placeholders: Vec<String> = (1..=columns.len()).map(|i| format!("?{}", i)).collect();

    let sql = format!(
        "INSERT INTO \"{}\" ({}) VALUES ({})",
        table_name,
        columns
            .iter()
            .map(|c| format!("\"{}\"", c))
            .collect::<Vec<_>>()
            .join(", "),
        placeholders.join(", ")
    );

    let changes = conn.execute(&sql, rusqlite::params_from_iter(&params))?;
    let last_id = conn.last_insert_rowid();

    Ok(QueryResult::Execution {
        rows_affected: changes as usize,
        last_insert_id: Some(last_id),
        execution_info: crate::models::query::QueryExecutionInfo::new(0, changes as usize),
    })
}

#[tauri::command]
pub async fn update_row(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table_name: String,
    data: HashMap<String, CellValue>,
    conditions: HashMap<String, CellValue>,
) -> AppResult<QueryResult> {
    // 验证表名
    validate_identifier(&table_name)?;

    let pool = connection_manager.get_pool(&connection_id)?;
    let conn = pool
        .get()
        .map_err(|e| AppError::ConnectionError(e.to_string()))?;

    if data.is_empty() {
        return Err(AppError::InvalidParameter("No data provided".to_string()));
    }

    if conditions.is_empty() {
        return Err(AppError::InvalidParameter(
            "Update requires conditions to prevent accidental updates".to_string(),
        ));
    }

    // 验证列名
    for col in data.keys().chain(conditions.keys()) {
        validate_identifier(col)?;
    }

    let data_cols: Vec<String> = data.keys().cloned().collect();
    let cond_cols: Vec<String> = conditions.keys().cloned().collect();

    // 构建参数列表：先 data 值，再 condition 值
    let mut params: Vec<rusqlite::types::Value> = Vec::new();
    for col in &data_cols {
        params.push(cell_value_to_param(&data[col]));
    }
    for col in &cond_cols {
        params.push(cell_value_to_param(&conditions[col]));
    }

    // 构建占位符
    let set_placeholders: Vec<String> = (1..=data_cols.len())
        .map(|i| format!("\"{}\" = ?{}", data_cols[i - 1], i))
        .collect();

    let where_placeholders: Vec<String> = (data_cols.len() + 1..=data_cols.len() + cond_cols.len())
        .map(|i| format!("\"{}\" = ?{}", cond_cols[i - data_cols.len() - 1], i))
        .collect();

    let sql = format!(
        "UPDATE \"{}\" SET {} WHERE {}",
        table_name,
        set_placeholders.join(", "),
        where_placeholders.join(" AND ")
    );

    let changes = conn.execute(&sql, rusqlite::params_from_iter(&params))?;

    Ok(QueryResult::Execution {
        rows_affected: changes as usize,
        last_insert_id: None,
        execution_info: crate::models::query::QueryExecutionInfo::new(0, changes as usize),
    })
}

#[tauri::command]
pub async fn delete_row(
    connection_manager: State<'_, ConnectionManager>,
    connection_id: String,
    table_name: String,
    conditions: HashMap<String, CellValue>,
) -> AppResult<QueryResult> {
    // 验证表名
    validate_identifier(&table_name)?;

    let pool = connection_manager.get_pool(&connection_id)?;
    let conn = pool
        .get()
        .map_err(|e| AppError::ConnectionError(e.to_string()))?;

    if conditions.is_empty() {
        return Err(AppError::InvalidParameter(
            "Delete requires conditions to prevent accidental deletions".to_string(),
        ));
    }

    // 验证列名
    for col in conditions.keys() {
        validate_identifier(col)?;
    }

    let cond_cols: Vec<String> = conditions.keys().cloned().collect();
    let params: Vec<rusqlite::types::Value> = cond_cols
        .iter()
        .map(|col| cell_value_to_param(&conditions[col]))
        .collect();

    let where_placeholders: Vec<String> = (1..=cond_cols.len())
        .map(|i| format!("\"{}\" = ?{}", cond_cols[i - 1], i))
        .collect();

    let sql = format!(
        "DELETE FROM \"{}\" WHERE {}",
        table_name,
        where_placeholders.join(" AND ")
    );

    let changes = conn.execute(&sql, rusqlite::params_from_iter(&params))?;

    Ok(QueryResult::Execution {
        rows_affected: changes as usize,
        last_insert_id: None,
        execution_info: crate::models::query::QueryExecutionInfo::new(0, changes as usize),
    })
}
