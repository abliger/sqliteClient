use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 支持的导入文件类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportFileInfo {
    pub extension: String,
    pub name: String,
    pub description: String,
}

/// 列映射配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnMapping {
    /// 源列名（来自文件）
    pub source_column: String,
    /// 目标列名（数据库表）
    pub target_column: String,
    /// 数据类型
    pub data_type: String,
    /// 是否主键
    pub is_primary_key: bool,
    /// 是否允许 NULL
    pub nullable: bool,
    /// 默认值
    pub default_value: Option<String>,
}

/// 导入配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportConfig {
    /// 目标表名
    pub table_name: String,
    /// 如果表存在是否覆盖
    pub overwrite_existing: bool,
    /// 列映射配置
    pub column_mappings: Vec<ColumnMapping>,
    /// CSV 分隔符（仅 CSV）
    pub csv_delimiter: Option<String>,
    /// CSV 是否有标题行
    pub csv_has_header: bool,
    /// Excel 工作表索引（仅 Excel）
    pub excel_sheet_index: usize,
    /// 跳过的行数
    pub skip_rows: usize,
    /// 批量插入大小
    pub batch_size: usize,
}

impl Default for ImportConfig {
    fn default() -> Self {
        Self {
            table_name: String::new(),
            overwrite_existing: false,
            column_mappings: Vec::new(),
            csv_delimiter: Some(",".to_string()),
            csv_has_header: true,
            excel_sheet_index: 0,
            skip_rows: 0,
            batch_size: 1000,
        }
    }
}

/// 列统计信息（用于类型检测）
#[derive(Debug, Clone, Default)]
pub struct ColumnStats {
    pub total_count: usize,
    pub null_count: usize,
    pub int_count: usize,
    pub float_count: usize,
    pub bool_count: usize,
    pub date_count: usize,
    pub datetime_count: usize,
}

impl ColumnStats {
    pub fn suggested_type(&self) -> String {
        if self.total_count == 0 || self.total_count == self.null_count {
            return "TEXT".to_string();
        }

        let non_null = self.total_count - self.null_count;

        // 如果全部是布尔值
        if self.bool_count == non_null {
            return "BOOLEAN".to_string();
        }

        // 如果全部是整数
        if self.int_count == non_null {
            return "INTEGER".to_string();
        }

        // 如果全部是浮点数（包含整数）
        if self.float_count + self.int_count == non_null {
            return "REAL".to_string();
        }

        // 如果全部是日期时间
        if self.datetime_count == non_null {
            return "DATETIME".to_string();
        }

        // 如果全部是日期
        if self.date_count == non_null {
            return "DATE".to_string();
        }

        // 默认文本
        "TEXT".to_string()
    }
}

/// 预览数据行
pub type PreviewRow = HashMap<String, String>;
