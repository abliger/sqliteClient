use std::collections::HashMap;
use std::path::Path;

use calamine::{open_workbook_auto, Data, Range, Reader};
use csv::StringRecord;
use serde::Serialize;

use crate::core::connection_manager::ConnectionManager;
use crate::models::import::{ColumnStats, ImportConfig, PreviewRow};
use crate::utils::error::{AppError, AppResult};

/// 转义 SQL 标识符中的双引号
/// 在 SQLite 中，标识符使用双引号包裹，内部的双引号需要转义为两个双引号
fn escape_identifier(ident: &str) -> String {
    ident.replace('"', "\"\"")
}

/// 导入预览结果
#[derive(Debug, Clone, Serialize)]
pub struct ImportPreview {
    /// 文件中的列名
    pub columns: Vec<String>,
    /// 预览数据（前 100 行）
    pub rows: Vec<PreviewRow>,
    /// 总行数估算
    pub total_rows: usize,
    /// 检测到的数据类型建议
    pub suggested_types: HashMap<String, String>,
}

/// 导入结果
#[derive(Debug, Clone, Serialize)]
pub struct ImportResult {
    /// 成功导入的行数
    pub imported_rows: usize,
    /// 失败的行数
    pub failed_rows: usize,
    /// 错误信息
    pub errors: Vec<String>,
    /// 目标表名
    pub table_name: String,
    /// 执行时间（毫秒）
    pub duration_ms: u64,
}

pub struct ImportEngine;

impl ImportEngine {
    pub fn new() -> AppResult<Self> {
        Ok(Self)
    }

    /// 解析导入文件
    pub async fn parse_file(&self, file_path: &str, file_type: &str) -> AppResult<ImportPreview> {
        match file_type.to_lowercase().as_str() {
            "csv" => self.parse_csv(file_path).await,
            "xlsx" | "xls" => self.parse_excel(file_path).await,
            _ => Err(AppError::InvalidParameter(format!(
                "Unsupported file type: {}",
                file_type
            ))),
        }
    }

    /// 解析 CSV 文件
    async fn parse_csv(&self, file_path: &str) -> AppResult<ImportPreview> {
        let path = Path::new(file_path);
        let file = std::fs::File::open(path)?;
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(true)
            .from_reader(file);

        // 获取列名
        let headers: Vec<String> = reader.headers()?.iter().map(|h| h.to_string()).collect();

        // 读取前 100 行作为预览
        let mut rows: Vec<PreviewRow> = Vec::new();
        for result in reader.records().take(100) {
            let record = result?;
            let row = self.record_to_map(&headers, &record);
            rows.push(row);
        }

        // 估算总行数
        let total_rows = rows.len() + reader.records().count();

        // 检测数据类型
        let suggested_types = self.detect_column_types(&rows);

        Ok(ImportPreview {
            columns: headers,
            rows,
            total_rows,
            suggested_types,
        })
    }

    /// 解析 Excel 文件
    async fn parse_excel(&self, file_path: &str) -> AppResult<ImportPreview> {
        let path = Path::new(file_path);
        let mut workbook = open_workbook_auto(path)
            .map_err(|e| AppError::InvalidParameter(format!("Failed to open Excel: {}", e)))?;

        // 获取第一个工作表
        let sheet_name = workbook.sheet_names().first().cloned().ok_or_else(|| {
            AppError::InvalidParameter("No sheets found in Excel file".to_string())
        })?;

        let range: Range<Data> = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| AppError::InvalidParameter(format!("Failed to read sheet: {}", e)))?;

        // 获取列名（第一行）
        let headers: Vec<String> = range
            .rows()
            .next()
            .map(|row| {
                row.iter()
                    .map(|cell| cell.to_string().trim().to_string())
                    .collect()
            })
            .unwrap_or_default();

        // 读取数据行（最多 100 行预览）
        let mut rows: Vec<PreviewRow> = Vec::new();
        for excel_row in range.rows().skip(1).take(100) {
            let mut row = HashMap::new();
            for (i, cell) in excel_row.iter().enumerate() {
                if let Some(header) = headers.get(i) {
                    row.insert(header.clone(), self.cell_to_string(cell));
                }
            }
            rows.push(row);
        }

        // 估算总行数
        let total_rows = range.rows().count().saturating_sub(1);

        // 检测数据类型
        let suggested_types = self.detect_column_types(&rows);

        Ok(ImportPreview {
            columns: headers,
            rows,
            total_rows,
            suggested_types,
        })
    }

    /// 检测列的数据类型
    pub fn detect_column_types(&self, rows: &[PreviewRow]) -> HashMap<String, String> {
        let mut stats_map: HashMap<String, ColumnStats> = HashMap::new();

        // 收集所有列名
        let all_columns: std::collections::HashSet<String> =
            rows.iter().flat_map(|row| row.keys().cloned()).collect();

        for col in &all_columns {
            stats_map.insert(col.clone(), ColumnStats::default());
        }

        // 统计每列的数据类型
        for row in rows {
            for (col, value) in row {
                let stats = stats_map.entry(col.clone()).or_default();
                stats.total_count += 1;

                if value.is_empty() {
                    stats.null_count += 1;
                    continue;
                }

                // 检测布尔值
                if self.is_boolean(value) {
                    stats.bool_count += 1;
                    continue;
                }

                // 检测整数
                if self.is_integer(value) {
                    stats.int_count += 1;
                    continue;
                }

                // 检测浮点数
                if self.is_float(value) {
                    stats.float_count += 1;
                    continue;
                }

                // 检测日期时间
                if self.is_datetime(value) {
                    stats.datetime_count += 1;
                    continue;
                }

                // 检测日期
                if self.is_date(value) {
                    stats.date_count += 1;
                }
            }
        }

        // 生成建议类型
        stats_map
            .into_iter()
            .map(|(col, stats)| (col, stats.suggested_type()))
            .collect()
    }

    /// 执行数据导入
    pub async fn execute_import(
        &self,
        connection_manager: &ConnectionManager,
        connection_id: &str,
        config: &ImportConfig,
        preview_data: &[PreviewRow],
    ) -> AppResult<ImportResult> {
        let start_time = std::time::Instant::now();
        let pool = connection_manager.get_pool(connection_id)?;
        let mut conn = pool.get()?;

        let mut imported_rows = 0usize;
        let mut failed_rows = 0usize;
        let mut errors: Vec<String> = Vec::new();

        // 开始事务
        let tx = conn.transaction()?;

        // 如果表存在且需要覆盖，则删除
        if config.overwrite_existing {
            tx.execute(&format!("DROP TABLE IF EXISTS \"{}\"", escape_identifier(&config.table_name)), [])?;
        }

        // 创建表
        self.create_table(&tx, config)?;

        // 准备 INSERT 语句
        let columns: Vec<&str> = config
            .column_mappings
            .iter()
            .map(|m| m.target_column.as_str())
            .collect();
        let placeholders: Vec<String> = (0..columns.len()).map(|_| "?".to_string()).collect();
        let column_names: Vec<String> = columns.iter()
            .map(|c| format!("\"{}\"", escape_identifier(c)))
            .collect();
        let insert_sql = format!(
            "INSERT INTO \"{}\" ({}) VALUES ({})",
            escape_identifier(&config.table_name),
            column_names.join(", "),
            placeholders.join(", ")
        );
        let mut stmt = tx.prepare(&insert_sql)?;

        // 批量插入数据
        for (idx, row) in preview_data.iter().enumerate() {
            let values: Vec<rusqlite::types::Value> = config
                .column_mappings
                .iter()
                .map(|mapping| {
                    let value = row.get(&mapping.source_column).cloned().unwrap_or_default();
                    self.convert_value(&value, &mapping.data_type)
                })
                .collect();

            let params: Vec<&dyn rusqlite::ToSql> =
                values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();

            if let Err(e) = stmt.execute(&params[..]) {
                failed_rows += 1;
                if errors.len() < 10 {
                    // 只保留前 10 个错误
                    errors.push(format!("Row {}: {}", idx + 1, e));
                }
            } else {
                imported_rows += 1;
            }
        }

        drop(stmt);
        tx.commit()?;

        Ok(ImportResult {
            imported_rows,
            failed_rows,
            errors,
            table_name: config.table_name.clone(),
            duration_ms: start_time.elapsed().as_millis() as u64,
        })
    }

    /// 创建目标表
    fn create_table(&self, tx: &rusqlite::Transaction, config: &ImportConfig) -> AppResult<()> {
        let columns_def: Vec<String> = config
            .column_mappings
            .iter()
            .map(|m| {
                let mut def = format!("\"{}\" {}", escape_identifier(&m.target_column), m.data_type);
                if m.is_primary_key {
                    def.push_str(" PRIMARY KEY");
                }
                if !m.nullable {
                    def.push_str(" NOT NULL");
                }
                if let Some(default) = &m.default_value {
                    def.push_str(&format!(" DEFAULT {}", default));
                }
                def
            })
            .collect();

        let create_sql = format!(
            "CREATE TABLE IF NOT EXISTS \"{}\" ({})",
            escape_identifier(&config.table_name),
            columns_def.join(", ")
        );

        tx.execute(&create_sql, [])?;
        Ok(())
    }

    /// 验证表名是否可用
    pub async fn validate_table_name(
        &self,
        connection_manager: &ConnectionManager,
        connection_id: &str,
        table_name: &str,
    ) -> AppResult<bool> {
        let pool = connection_manager.get_pool(connection_id)?;
        let conn = pool.get()?;

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
            [table_name],
            |row| row.get(0),
        )?;

        Ok(count == 0)
    }

    // 辅助方法

    fn record_to_map(&self, headers: &[String], record: &StringRecord) -> PreviewRow {
        headers
            .iter()
            .zip(record.iter())
            .map(|(h, v)| (h.clone(), v.to_string()))
            .collect()
    }

    fn cell_to_string(&self, cell: &Data) -> String {
        match cell {
            Data::Empty => String::new(),
            Data::String(s) => s.clone(),
            Data::Float(f) => f.to_string(),
            Data::Int(i) => i.to_string(),
            Data::Bool(b) => b.to_string(),
            Data::DateTime(d) => d.to_string(),
            Data::DateTimeIso(s) => s.clone(),
            Data::DurationIso(s) => s.clone(),
            Data::Error(e) => format!("#ERROR: {:?}", e),
        }
    }

    fn is_boolean(&self, value: &str) -> bool {
        let lower = value.to_lowercase();
        matches!(lower.as_str(), "true" | "false" | "yes" | "no" | "1" | "0")
    }

    fn is_integer(&self, value: &str) -> bool {
        value.parse::<i64>().is_ok()
    }

    fn is_float(&self, value: &str) -> bool {
        value.parse::<f64>().is_ok()
    }

    fn is_datetime(&self, value: &str) -> bool {
        // 支持格式: 2024-01-01 12:30:00, 2024-01-01T12:30:00
        let datetime_patterns = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
        ];
        for pattern in &datetime_patterns {
            if chrono::NaiveDateTime::parse_from_str(value, pattern).is_ok() {
                return true;
            }
        }
        false
    }

    fn is_date(&self, value: &str) -> bool {
        // 支持格式: 2024-01-01, 2024/01/01, 01/01/2024
        let date_patterns = ["%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y"];
        for pattern in &date_patterns {
            if chrono::NaiveDate::parse_from_str(value, pattern).is_ok() {
                return true;
            }
        }
        false
    }

    fn convert_value(&self, value: &str, data_type: &str) -> rusqlite::types::Value {
        if value.is_empty() {
            return rusqlite::types::Value::Null;
        }

        match data_type.to_uppercase().as_str() {
            "INTEGER" => value
                .parse::<i64>()
                .map(rusqlite::types::Value::Integer)
                .unwrap_or_else(|_| rusqlite::types::Value::Text(value.to_string())),
            "REAL" | "FLOAT" | "DOUBLE" => value
                .parse::<f64>()
                .map(rusqlite::types::Value::Real)
                .unwrap_or_else(|_| rusqlite::types::Value::Text(value.to_string())),
            "BOOLEAN" => {
                let bool_val = matches!(value.to_lowercase().as_str(), "true" | "yes" | "1");
                rusqlite::types::Value::Integer(if bool_val { 1 } else { 0 })
            }
            "DATE" => rusqlite::types::Value::Text(value.to_string()),
            "DATETIME" => rusqlite::types::Value::Text(value.to_string()),
            "BLOB" => rusqlite::types::Value::Blob(value.as_bytes().to_vec()),
            _ => rusqlite::types::Value::Text(value.to_string()),
        }
    }
}
