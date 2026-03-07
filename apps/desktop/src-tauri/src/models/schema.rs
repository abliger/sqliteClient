use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub sql: Option<String>,
    pub column_count: usize,
    pub row_count: Option<i64>,
    pub columns: Vec<ColumnInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub default_value: Option<String>,
    pub is_primary_key: bool,
    pub is_foreign_key: bool,
    pub foreign_key: Option<ForeignKeyInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
    pub name: String,
    pub table_name: String,
    pub unique: bool,
    pub columns: Vec<String>,
    pub sql: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForeignKeyInfo {
    pub from_column: String,
    pub to_table: String,
    pub to_column: String,
    pub on_update: String,
    pub on_delete: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerInfo {
    pub name: String,
    pub table_name: String,
    pub sql: String,
    pub timing: String, // BEFORE, AFTER, INSTEAD OF
    pub event: String,  // INSERT, UPDATE, DELETE
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseSchema {
    pub tables: Vec<TableInfo>,
    pub indexes: Vec<IndexInfo>,
    pub triggers: Vec<TriggerInfo>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_column() -> ColumnInfo {
        ColumnInfo {
            name: "id".to_string(),
            data_type: "INTEGER".to_string(),
            nullable: false,
            default_value: None,
            is_primary_key: true,
            is_foreign_key: false,
            foreign_key: None,
        }
    }

    fn create_test_table() -> TableInfo {
        TableInfo {
            name: "users".to_string(),
            sql: Some("CREATE TABLE users (id INTEGER PRIMARY KEY)".to_string()),
            column_count: 1,
            row_count: Some(100),
            columns: vec![create_test_column()],
        }
    }

    #[test]
    fn test_column_info_serialization() {
        let col = create_test_column();
        let json = serde_json::to_string(&col).unwrap();
        let deserialized: ColumnInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.name, "id");
        assert_eq!(deserialized.data_type, "INTEGER");
        assert!(!deserialized.nullable);
        assert!(deserialized.is_primary_key);
    }

    #[test]
    fn test_table_info_serialization() {
        let table = create_test_table();
        let json = serde_json::to_string(&table).unwrap();

        assert!(json.contains("users"));
        assert!(json.contains("id"));

        let deserialized: TableInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "users");
        assert_eq!(deserialized.columns.len(), 1);
    }

    #[test]
    fn test_foreign_key_info_serialization() {
        let fk = ForeignKeyInfo {
            from_column: "user_id".to_string(),
            to_table: "users".to_string(),
            to_column: "id".to_string(),
            on_update: "CASCADE".to_string(),
            on_delete: "SET NULL".to_string(),
        };

        let json = serde_json::to_string(&fk).unwrap();
        let deserialized: ForeignKeyInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.from_column, "user_id");
        assert_eq!(deserialized.to_table, "users");
    }

    #[test]
    fn test_column_with_foreign_key() {
        let col = ColumnInfo {
            name: "user_id".to_string(),
            data_type: "INTEGER".to_string(),
            nullable: true,
            default_value: None,
            is_primary_key: false,
            is_foreign_key: true,
            foreign_key: Some(ForeignKeyInfo {
                from_column: "user_id".to_string(),
                to_table: "users".to_string(),
                to_column: "id".to_string(),
                on_update: "CASCADE".to_string(),
                on_delete: "SET NULL".to_string(),
            }),
        };

        let json = serde_json::to_string(&col).unwrap();
        let deserialized: ColumnInfo = serde_json::from_str(&json).unwrap();

        assert!(deserialized.is_foreign_key);
        assert!(deserialized.foreign_key.is_some());
    }

    #[test]
    fn test_index_info_serialization() {
        let index = IndexInfo {
            name: "idx_users_name".to_string(),
            table_name: "users".to_string(),
            unique: true,
            columns: vec!["name".to_string()],
            sql: Some("CREATE UNIQUE INDEX idx_users_name ON users(name)".to_string()),
        };

        let json = serde_json::to_string(&index).unwrap();
        let deserialized: IndexInfo = serde_json::from_str(&json).unwrap();

        assert!(deserialized.unique);
        assert_eq!(deserialized.columns.len(), 1);
    }

    #[test]
    fn test_trigger_info_serialization() {
        let trigger = TriggerInfo {
            name: "trg_users_insert".to_string(),
            table_name: "users".to_string(),
            sql: "CREATE TRIGGER trg_users_insert AFTER INSERT ON users".to_string(),
            timing: "AFTER".to_string(),
            event: "INSERT".to_string(),
        };

        let json = serde_json::to_string(&trigger).unwrap();
        let deserialized: TriggerInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.timing, "AFTER");
        assert_eq!(deserialized.event, "INSERT");
    }

    #[test]
    fn test_database_schema_serialization() {
        let schema = DatabaseSchema {
            tables: vec![create_test_table()],
            indexes: vec![],
            triggers: vec![],
        };

        let json = serde_json::to_string(&schema).unwrap();
        let deserialized: DatabaseSchema = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.tables.len(), 1);
    }
}
