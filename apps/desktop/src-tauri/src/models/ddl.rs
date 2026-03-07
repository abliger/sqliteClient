use serde::{Deserialize, Serialize};

/// SQLite 数据类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum SQLiteDataType {
    Integer,
    Real,
    Text,
    Blob,
    Numeric,
    Boolean,
    Datetime,
    Date,
    Time,
    Varchar,
    Char,
    Decimal,
    Float,
    Double,
    Int,
    BigInt,
    SmallInt,
    TinyInt,
}

impl std::fmt::Display for SQLiteDataType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            SQLiteDataType::Integer => "INTEGER",
            SQLiteDataType::Real => "REAL",
            SQLiteDataType::Text => "TEXT",
            SQLiteDataType::Blob => "BLOB",
            SQLiteDataType::Numeric => "NUMERIC",
            SQLiteDataType::Boolean => "BOOLEAN",
            SQLiteDataType::Datetime => "DATETIME",
            SQLiteDataType::Date => "DATE",
            SQLiteDataType::Time => "TIME",
            SQLiteDataType::Varchar => "VARCHAR",
            SQLiteDataType::Char => "CHAR",
            SQLiteDataType::Decimal => "DECIMAL",
            SQLiteDataType::Float => "FLOAT",
            SQLiteDataType::Double => "DOUBLE",
            SQLiteDataType::Int => "INT",
            SQLiteDataType::BigInt => "BIGINT",
            SQLiteDataType::SmallInt => "SMALLINT",
            SQLiteDataType::TinyInt => "TINYINT",
        };
        write!(f, "{}", s)
    }
}

/// 外键约束动作
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ForeignKeyAction {
    NoAction,
    Restrict,
    SetNull,
    SetDefault,
    Cascade,
}

impl std::fmt::Display for ForeignKeyAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            ForeignKeyAction::NoAction => "NO ACTION",
            ForeignKeyAction::Restrict => "RESTRICT",
            ForeignKeyAction::SetNull => "SET NULL",
            ForeignKeyAction::SetDefault => "SET DEFAULT",
            ForeignKeyAction::Cascade => "CASCADE",
        };
        write!(f, "{}", s)
    }
}

/// 设计器中的外键定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignerForeignKey {
    pub ref_table: String,
    pub ref_column: String,
    pub on_update: ForeignKeyAction,
    pub on_delete: ForeignKeyAction,
}

/// 设计器中的字段定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignerColumn {
    pub id: String,
    pub name: String,
    pub data_type: SQLiteDataType,
    pub nullable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
    pub is_primary_key: bool,
    pub is_unique: bool,
    pub is_auto_increment: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    pub is_foreign_key: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub foreign_key: Option<DesignerForeignKey>,
}

/// 设计器中的索引定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignerIndex {
    pub id: String,
    pub name: String,
    pub unique: bool,
    pub columns: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub where_clause: Option<String>,
}

/// 设计器中的表定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignerTable {
    pub name: String,
    pub columns: Vec<DesignerColumn>,
    pub indexes: Vec<DesignerIndex>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_key: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strict_mode: Option<bool>,
}

/// 表变更操作
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TableChange {
    AddColumn {
        column: DesignerColumn,
    },
    DropColumn {
        column_name: String,
    },
    RenameColumn {
        old_name: String,
        new_name: String,
    },
    AlterColumn {
        column_name: String,
        new_column: DesignerColumn,
    },
    AddIndex {
        index: DesignerIndex,
    },
    DropIndex {
        index_name: String,
    },
    RenameTable {
        new_name: String,
    },
}

/// 创建表的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTableRequest {
    pub connection_id: String,
    pub table: DesignerTable,
}

/// 修改表的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlterTableRequest {
    pub connection_id: String,
    pub table_name: String,
    pub changes: Vec<TableChange>,
}

/// 删除表的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DropTableRequest {
    pub connection_id: String,
    pub table_name: String,
    #[serde(default)]
    pub cascade: bool,
}

/// DDL预览请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewDdlRequest {
    pub connection_id: String,
    pub operation: DdlOperation,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub table: Option<DesignerTable>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub changes: Option<Vec<TableChange>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub existing_table_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DdlOperation {
    Create,
    Alter,
    Drop,
}

/// DDL影响评估
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DdlImpact {
    pub will_recreate_table: bool,
    pub data_loss_risk: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub affected_rows: Option<i64>,
}

/// DDL预览结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewDdlResult {
    pub sql: String,
    pub warnings: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_impact: Option<DdlImpact>,
}

/// DDL执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DdlExecutionResult {
    pub success: bool,
    pub sql: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub execution_time_ms: u64,
}
