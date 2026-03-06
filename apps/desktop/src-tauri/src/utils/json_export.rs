use std::fs::File;
use std::io::Write;
use std::path::Path;

use serde_json::Value;

use crate::utils::error::{AppError, AppResult};
use crate::models::query::QueryRow;

pub fn export_rows_to_json(
    rows: &[QueryRow],
    output_path: &Path,
    pretty: bool,
) -> AppResult<()> {
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

pub fn export_rows_to_jsonl(rows: &[QueryRow], output_path: &Path) -> AppResult<()> {
    let mut file = File::create(output_path)?;
    
    for row in rows {
        let json_line = serde_json::to_string(&row.to_json())?;
        writeln!(file, "{}", json_line)?;
    }
    
    Ok(())
}

pub fn write_json_array_start<W: Write>(writer: &mut W) -> AppResult<()> {
    writer.write_all(b"[")?;
    Ok(())
}

pub fn write_json_array_end<W: Write>(writer: &mut W) -> AppResult<()> {
    writer.write_all(b"]\n")?;
    Ok(())
}

pub fn write_json_row<W: Write>(
    writer: &mut W,
    row: &QueryRow,
    is_first: bool,
) -> AppResult<()> {
    if !is_first {
        writer.write_all(b",")?;
    }
    let json = serde_json::to_vec(&row.to_json())?;
    writer.write_all(&json)?;
    Ok(())
}
