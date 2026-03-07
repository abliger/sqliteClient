use std::io::Write;
use std::path::Path;

use crate::models::query::QueryRow;
use crate::utils::error::AppResult;

pub fn export_rows_to_csv(
    rows: &[QueryRow],
    columns: &[String],
    output_path: &Path,
) -> AppResult<()> {
    let mut writer = csv::Writer::from_path(output_path)?;

    // 写入表头
    writer.write_record(columns)?;

    // 写入数据行
    for row in rows {
        let record: Vec<String> = columns
            .iter()
            .map(|col| {
                row.values
                    .get(col)
                    .map(|v| v.to_string())
                    .unwrap_or_default()
            })
            .collect();
        writer.write_record(&record)?;
    }

    writer.flush()?;
    Ok(())
}

#[allow(dead_code)]
pub fn write_csv_header<W: Write>(
    writer: &mut csv::Writer<W>,
    columns: &[String],
) -> AppResult<()> {
    writer.write_record(columns)?;
    Ok(())
}

#[allow(dead_code)]
pub fn write_csv_row<W: Write>(
    writer: &mut csv::Writer<W>,
    row: &QueryRow,
    columns: &[String],
) -> AppResult<()> {
    let record: Vec<String> = columns
        .iter()
        .map(|col| {
            row.values
                .get(col)
                .map(|v| v.to_string())
                .unwrap_or_default()
        })
        .collect();
    writer.write_record(&record)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::query::CellValue;
    use std::collections::HashMap;
    use std::io::Cursor;

    fn create_test_row(id: i64, name: &str) -> QueryRow {
        let mut values = HashMap::new();
        values.insert("id".to_string(), CellValue::Integer(id));
        values.insert("name".to_string(), CellValue::Text(name.to_string()));
        QueryRow { values }
    }

    #[test]
    fn test_write_csv_header() {
        let cursor = Cursor::new(Vec::new());
        let mut writer = csv::Writer::from_writer(cursor);
        let columns = vec!["id".to_string(), "name".to_string()];

        write_csv_header(&mut writer, &columns).unwrap();

        let mut cursor = writer.into_inner().unwrap();
        cursor.set_position(0);
        let result = String::from_utf8(cursor.into_inner()).unwrap();
        assert!(result.contains("id"));
        assert!(result.contains("name"));
    }

    #[test]
    fn test_write_csv_row() {
        let cursor = Cursor::new(Vec::new());
        let mut writer = csv::Writer::from_writer(cursor);
        let row = create_test_row(1, "Alice");
        let columns = vec!["id".to_string(), "name".to_string()];

        write_csv_row(&mut writer, &row, &columns).unwrap();

        let mut cursor = writer.into_inner().unwrap();
        cursor.set_position(0);
        let result = String::from_utf8(cursor.into_inner()).unwrap();
        assert!(result.contains("1"));
        assert!(result.contains("Alice"));
    }

    #[test]
    fn test_write_csv_row_with_missing_column() {
        let cursor = Cursor::new(Vec::new());
        let mut writer = csv::Writer::from_writer(cursor);
        let mut values = HashMap::new();
        values.insert("id".to_string(), CellValue::Integer(1));
        // name is missing
        let row = QueryRow { values };
        let columns = vec!["id".to_string(), "name".to_string()];

        write_csv_row(&mut writer, &row, &columns).unwrap();

        let mut cursor = writer.into_inner().unwrap();
        cursor.set_position(0);
        let result = String::from_utf8(cursor.into_inner()).unwrap();
        assert!(result.contains("1"));
        // Should have empty value for missing column
    }
}
