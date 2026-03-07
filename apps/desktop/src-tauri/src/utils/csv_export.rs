use std::io::Write;
use std::path::Path;

use crate::utils::error::AppResult;
use crate::models::query::QueryRow;

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
