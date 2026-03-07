use std::fs::File;
use std::io::Write;
use std::path::Path;

use serde_json::Value;

use crate::models::query::QueryRow;
use crate::utils::error::AppResult;

pub fn export_rows_to_json(rows: &[QueryRow], output_path: &Path, pretty: bool) -> AppResult<()> {
    let json_rows: Vec<Value> = rows.iter().map(|row| row.to_json()).collect();

    let output = if pretty {
        serde_json::to_string_pretty(&json_rows)?
    } else {
        serde_json::to_string(&json_rows)?
    };

    let mut file = File::create(output_path)?;
    file.write_all(output.as_bytes())?;

    Ok(())
}

#[allow(dead_code)]
pub fn export_rows_to_jsonl(rows: &[QueryRow], output_path: &Path) -> AppResult<()> {
    let mut file = File::create(output_path)?;

    for row in rows {
        let json_line = serde_json::to_string(&row.to_json())?;
        writeln!(file, "{}", json_line)?;
    }

    Ok(())
}

#[allow(dead_code)]
pub fn write_json_array_start<W: Write>(writer: &mut W) -> AppResult<()> {
    writer.write_all(b"[")?;
    Ok(())
}

#[allow(dead_code)]
pub fn write_json_array_end<W: Write>(writer: &mut W) -> AppResult<()> {
    writer.write_all(b"]\n")?;
    Ok(())
}

#[allow(dead_code)]
pub fn write_json_row<W: Write>(writer: &mut W, row: &QueryRow, is_first: bool) -> AppResult<()> {
    if !is_first {
        writer.write_all(b",")?;
    }
    let json = serde_json::to_vec(&row.to_json())?;
    writer.write_all(&json)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::query::{CellValue, QueryRow};
    use std::collections::HashMap;
    use std::io::Cursor;

    fn create_test_row(id: i64, name: &str) -> QueryRow {
        let mut values = HashMap::new();
        values.insert("id".to_string(), CellValue::Integer(id));
        values.insert("name".to_string(), CellValue::Text(name.to_string()));
        QueryRow { values }
    }

    #[test]
    fn test_write_json_array_start() {
        let mut cursor = Cursor::new(Vec::new());
        write_json_array_start(&mut cursor).unwrap();
        assert_eq!(cursor.into_inner(), b"[");
    }

    #[test]
    fn test_write_json_array_end() {
        let mut cursor = Cursor::new(Vec::new());
        write_json_array_end(&mut cursor).unwrap();
        assert_eq!(cursor.into_inner(), b"]\n");
    }

    #[test]
    fn test_write_json_row_first() {
        let mut cursor = Cursor::new(Vec::new());
        let row = create_test_row(1, "Alice");

        write_json_row(&mut cursor, &row, true).unwrap();

        let result = String::from_utf8(cursor.into_inner()).unwrap();
        assert!(result.contains("Alice"));
        assert!(result.contains("1"));
        assert!(!result.starts_with(","));
    }

    #[test]
    fn test_write_json_row_not_first() {
        let mut cursor = Cursor::new(Vec::new());
        let row = create_test_row(1, "Alice");

        write_json_row(&mut cursor, &row, false).unwrap();

        let result = String::from_utf8(cursor.into_inner()).unwrap();
        assert!(result.starts_with(","));
    }
}
