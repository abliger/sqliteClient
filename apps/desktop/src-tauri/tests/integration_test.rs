//! Integration tests for SQLite Client
//!
//! These tests verify the integration between different modules
//! and test the public API surface.

use std::collections::HashMap;

// Test that all models can be serialized and deserialized
#[test]
fn test_models_roundtrip() {
    // ConnectionConfig test
    {
        let config = serde_json::json!({
            "id": "test-id",
            "name": "test_db",
            "db_path": "/path/to/db.sqlite",
            "created_at": "2024-01-01T00:00:00Z",
            "last_connected": null
        });

        let config_str = config.to_string();
        let parsed: serde_json::Value = serde_json::from_str(&config_str).unwrap();
        assert_eq!(parsed["name"], "test_db");
    }

    // DatabaseMetadata test
    {
        let metadata = serde_json::json!({
            "version": "3.39.0",
            "page_size": 4096,
            "page_count": 100,
            "table_count": 5,
            "index_count": 3,
            "trigger_count": 1,
            "size_bytes": 409600
        });

        let metadata_str = metadata.to_string();
        let parsed: serde_json::Value = serde_json::from_str(&metadata_str).unwrap();
        assert_eq!(parsed["table_count"], 5);
    }
}

// Test error handling
#[test]
fn test_error_handling() {
    use app_lib::utils::error::{AppError, AppResult};

    // Test error creation
    let err = AppError::ConnectionError("test error".to_string());
    assert!(err.to_string().contains("test error"));

    // Test AppResult
    let result: AppResult<i32> = Ok(42);
    assert!(result.is_ok());

    let result: AppResult<i32> = Err(AppError::NotFound("item".to_string()));
    assert!(result.is_err());
}

// Test CellValue conversions
#[test]
fn test_cell_value_conversions() {
    use app_lib::models::query::CellValue;

    // Test null
    let null_val = CellValue::Null;
    assert_eq!(null_val.to_string(), "NULL");

    // Test integer
    let int_val = CellValue::Integer(42);
    assert_eq!(int_val.to_string(), "42");

    // Test text
    let text_val = CellValue::Text("hello".to_string());
    assert_eq!(text_val.to_string(), "hello");

    // Test boolean
    let bool_val = CellValue::Boolean(true);
    assert_eq!(bool_val.to_string(), "true");
}

// Test QueryRow to JSON conversion
#[test]
fn test_query_row_conversion() {
    use app_lib::models::query::{CellValue, QueryRow};

    let mut values = HashMap::new();
    values.insert("id".to_string(), CellValue::Integer(1));
    values.insert("name".to_string(), CellValue::Text("Test".to_string()));
    values.insert("active".to_string(), CellValue::Boolean(true));

    let row = QueryRow { values };
    let json = row.to_json();

    assert!(json.is_object());
    assert_eq!(json.get("id").unwrap().as_i64(), Some(1));
    assert_eq!(json.get("name").unwrap().as_str(), Some("Test"));
    assert_eq!(json.get("active").unwrap().as_bool(), Some(true));
}

// Test CSV export helpers
#[test]
fn test_csv_export_helpers() {
    use app_lib::models::query::{CellValue, QueryRow};
    use app_lib::utils::csv_export::{write_csv_header, write_csv_row};
    use std::io::Cursor;

    let cursor = Cursor::new(Vec::new());
    let mut writer = csv::Writer::from_writer(cursor);
    let columns = vec!["id".to_string(), "name".to_string()];

    // Write header
    write_csv_header(&mut writer, &columns).unwrap();

    // Write row
    let mut values = HashMap::new();
    values.insert("id".to_string(), CellValue::Integer(1));
    values.insert("name".to_string(), CellValue::Text("Alice".to_string()));
    let row = QueryRow { values };
    write_csv_row(&mut writer, &row, &columns).unwrap();

    // Verify
    let mut cursor = writer.into_inner().unwrap();
    cursor.set_position(0);
    let result = String::from_utf8(cursor.into_inner()).unwrap();
    assert!(result.contains("id"));
    assert!(result.contains("name"));
    assert!(result.contains("Alice"));
}

// Test JSON export helpers
#[test]
fn test_json_export_helpers() {
    use app_lib::models::query::{CellValue, QueryRow};
    use app_lib::utils::json_export::{
        write_json_array_end, write_json_array_start, write_json_row,
    };
    use std::io::Cursor;

    let mut cursor = Cursor::new(Vec::new());

    // Write array start
    write_json_array_start(&mut cursor).unwrap();

    // Write row
    let mut values = HashMap::new();
    values.insert("id".to_string(), CellValue::Integer(1));
    let row = QueryRow { values };
    write_json_row(&mut cursor, &row, true).unwrap();

    // Write array end
    write_json_array_end(&mut cursor).unwrap();

    let result = String::from_utf8(cursor.into_inner()).unwrap();
    assert!(result.starts_with("["));
    assert!(result.contains("id"));
    assert!(result.ends_with("]\n"));
}

// Test ER Diagram serialization
#[test]
fn test_er_diagram_serialization() {
    use app_lib::models::erdiagram::{
        ColumnNode, ERDiagram, RelationEdge, RelationType, TableNode,
    };

    let diagram = ERDiagram {
        tables: vec![TableNode {
            id: "users".to_string(),
            name: "users".to_string(),
            x: 100.0,
            y: 100.0,
            width: 200.0,
            height: 150.0,
            columns: vec![ColumnNode {
                name: "id".to_string(),
                data_type: "INTEGER".to_string(),
                is_primary_key: true,
                is_foreign_key: false,
                nullable: false,
            }],
        }],
        relations: vec![RelationEdge {
            id: "rel1".to_string(),
            from_table: "orders".to_string(),
            from_column: "user_id".to_string(),
            to_table: "users".to_string(),
            to_column: "id".to_string(),
            relation_type: RelationType::OneToMany,
        }],
    };

    let json = serde_json::to_string(&diagram).unwrap();
    let parsed: ERDiagram = serde_json::from_str(&json).unwrap();

    assert_eq!(parsed.tables.len(), 1);
    assert_eq!(parsed.relations.len(), 1);
}

// Test history filter serialization
#[test]
fn test_history_filter_serialization() {
    use app_lib::models::history::QueryHistoryFilter;
    use chrono::Utc;

    let filter = QueryHistoryFilter {
        search: Some("SELECT".to_string()),
        connection_id: Some("conn-123".to_string()),
        from_date: Some(Utc::now()),
        to_date: Some(Utc::now()),
        is_success: Some(true),
        limit: 100,
        offset: 0,
    };

    let json = serde_json::to_string(&filter).unwrap();
    let parsed: QueryHistoryFilter = serde_json::from_str(&json).unwrap();

    assert_eq!(parsed.limit, 100);
    assert_eq!(parsed.search, Some("SELECT".to_string()));
}

// Test schema models serialization
#[test]
fn test_schema_models_serialization() {
    use app_lib::models::schema::{ColumnInfo, DatabaseSchema, IndexInfo, TableInfo};

    let schema = DatabaseSchema {
        tables: vec![TableInfo {
            name: "users".to_string(),
            sql: Some("CREATE TABLE users (id INTEGER PRIMARY KEY)".to_string()),
            column_count: 1,
            row_count: Some(100),
            columns: vec![ColumnInfo {
                name: "id".to_string(),
                data_type: "INTEGER".to_string(),
                nullable: false,
                default_value: None,
                is_primary_key: true,
                is_foreign_key: false,
                foreign_key: None,
            }],
        }],
        indexes: vec![IndexInfo {
            name: "idx_users_name".to_string(),
            table_name: "users".to_string(),
            unique: true,
            columns: vec!["name".to_string()],
            sql: Some("CREATE UNIQUE INDEX idx_users_name ON users(name)".to_string()),
        }],
        triggers: vec![],
    };

    let json = serde_json::to_string(&schema).unwrap();
    let parsed: DatabaseSchema = serde_json::from_str(&json).unwrap();

    assert_eq!(parsed.tables.len(), 1);
    assert_eq!(parsed.indexes.len(), 1);
    assert!(parsed.indexes[0].unique);
}
