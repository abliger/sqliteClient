use std::collections::HashMap;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::params;

use crate::models::schema::{ColumnInfo, DatabaseSchema, ForeignKeyInfo, IndexInfo, TableInfo, TriggerInfo};
use crate::models::erdiagram::{ColumnNode, ERDiagram, RelationEdge, RelationType, TableNode};
use crate::utils::error::{AppError, AppResult};

pub struct SchemaAnalyzer;

impl SchemaAnalyzer {
    pub fn get_database_schema(
        pool: &Pool<SqliteConnectionManager>,
    ) -> AppResult<DatabaseSchema> {
        let conn = pool.get().map_err(|e| AppError::ConnectionError(e.to_string()))?;
        
        let tables = Self::list_tables(pool)?;
        let indexes = Self::list_indexes(pool)?;
        let triggers = Self::list_triggers(pool)?;
        
        Ok(DatabaseSchema {
            tables,
            indexes,
            triggers,
        })
    }

    pub fn list_tables(pool: &Pool<SqliteConnectionManager>) -> AppResult<Vec<TableInfo>> {
        let conn = pool.get().map_err(|e| AppError::ConnectionError(e.to_string()))?;
        
        let mut stmt = conn.prepare(
            "SELECT name, sql FROM sqlite_master 
             WHERE type='table' AND name NOT LIKE 'sqlite_%' 
             ORDER BY name"
        )?;
        
        let rows = stmt.query_map([], |row| {
            let name: String = row.get(0)?;
            let sql: Option<String> = row.get(1)?;
            Ok((name, sql))
        })?;
        
        let mut tables = Vec::new();
        for row in rows {
            let (name, sql) = row?;
            let columns = Self::get_table_columns(pool, &name)?;
            let column_count = columns.len();
            
            // 尝试获取行数
            let row_count = conn
                .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", name), [], |r| r.get::<_, i64>(0))
                .ok();
            
            tables.push(TableInfo {
                name,
                sql,
                column_count,
                row_count,
                columns,
            });
        }
        
        Ok(tables)
    }

    pub fn get_table_columns(
        pool: &Pool<SqliteConnectionManager>,
        table_name: &str,
    ) -> AppResult<Vec<ColumnInfo>> {
        let conn = pool.get().map_err(|e| AppError::ConnectionError(e.to_string()))?;
        
        // 获取表信息
        let mut stmt = conn.prepare(&format!("PRAGMA table_info('{}')", table_name))?;
        
        let rows = stmt.query_map([], |row| {
            let name: String = row.get(1)?;
            let data_type: String = row.get(2)?;
            let not_null: bool = row.get(3)?;
            let default_value: Option<String> = row.get(4)?;
            let pk: bool = row.get(5)?;
            
            Ok(ColumnInfo {
                name,
                data_type,
                nullable: !not_null,
                default_value,
                is_primary_key: pk,
                is_foreign_key: false,
                foreign_key: None,
            })
        })?;
        
        let mut columns: Vec<ColumnInfo> = rows.collect::<Result<_, _>>()?;
        
        // 获取外键信息
        let mut stmt = conn.prepare(&format!("PRAGMA foreign_key_list('{}')", table_name))?;
        
        let fk_rows = stmt.query_map([], |row| {
            let from_col: String = row.get(3)?;
            let to_table: String = row.get(2)?;
            let to_col: String = row.get(4)?;
            let on_update: String = row.get(5)?;
            let on_delete: String = row.get(6)?;
            
            Ok((from_col.clone(), ForeignKeyInfo {
                from_column: from_col,
                to_table,
                to_column: to_col,
                on_update,
                on_delete,
            }))
        })?;
        
        let fk_map: HashMap<String, ForeignKeyInfo> = fk_rows.collect::<Result<_, _>>()?;
        
        // 更新列的外键信息
        for col in &mut columns {
            if let Some(fk) = fk_map.get(&col.name) {
                col.is_foreign_key = true;
                col.foreign_key = Some(fk.clone());
            }
        }
        
        Ok(columns)
    }

    pub fn list_indexes(pool: &Pool<SqliteConnectionManager>) -> AppResult<Vec<IndexInfo>> {
        let conn = pool.get().map_err(|e| AppError::ConnectionError(e.to_string()))?;
        
        let mut stmt = conn.prepare(
            "SELECT name, tbl_name, sql FROM sqlite_master 
             WHERE type='index' AND name NOT LIKE 'sqlite_%' 
             ORDER BY tbl_name, name"
        )?;
        
        let rows = stmt.query_map([], |row| {
            let name: String = row.get(0)?;
            let table_name: String = row.get(1)?;
            let sql: Option<String> = row.get(2)?;
            
            // 判断是否为唯一索引
            let unique = sql.as_ref().map(|s| s.to_uppercase().contains("UNIQUE")).unwrap_or(false);
            
            Ok(IndexInfo {
                name,
                table_name,
                unique,
                columns: Vec::new(), // 需要通过 PRAGMA index_info 获取
                sql,
            })
        })?;
        
        let mut indexes: Vec<IndexInfo> = rows.collect::<Result<_, _>>()?;
        
        // 获取每个索引的列
        for index in &mut indexes {
            let mut stmt = conn.prepare(&format!("PRAGMA index_info('{}')", index.name))?;
            let col_rows = stmt.query_map([], |row| {
                let col_name: String = row.get(2)?;
                Ok(col_name)
            })?;
            
            index.columns = col_rows.collect::<Result<_, _>>()?;
        }
        
        Ok(indexes)
    }

    pub fn list_triggers(pool: &Pool<SqliteConnectionManager>) -> AppResult<Vec<TriggerInfo>> {
        let conn = pool.get().map_err(|e| AppError::ConnectionError(e.to_string()))?;
        
        let mut stmt = conn.prepare(
            "SELECT name, tbl_name, sql FROM sqlite_master 
             WHERE type='trigger' 
             ORDER BY tbl_name, name"
        )?;
        
        let rows = stmt.query_map([], |row| {
            let name: String = row.get(0)?;
            let table_name: String = row.get(1)?;
            let sql: String = row.get(2)?;
            
            // 解析 SQL 获取 timing 和 event
            let upper_sql = sql.to_uppercase();
            let timing = if upper_sql.contains("BEFORE") {
                "BEFORE"
            } else if upper_sql.contains("AFTER") {
                "AFTER"
            } else if upper_sql.contains("INSTEAD OF") {
                "INSTEAD OF"
            } else {
                "UNKNOWN"
            };
            
            let event = if upper_sql.contains("INSERT") {
                "INSERT"
            } else if upper_sql.contains("UPDATE") {
                "UPDATE"
            } else if upper_sql.contains("DELETE") {
                "DELETE"
            } else {
                "UNKNOWN"
            };
            
            Ok(TriggerInfo {
                name,
                table_name,
                sql,
                timing: timing.to_string(),
                event: event.to_string(),
            })
        })?;
        
        rows.collect::<Result<_, _>>().map_err(|e| e.into())
    }

    pub fn generate_er_diagram_data(
        pool: &Pool<SqliteConnectionManager>,
    ) -> AppResult<ERDiagram> {
        let tables = Self::list_tables(pool)?;
        
        let mut table_nodes = Vec::new();
        let mut relations = Vec::new();
        
        // 创建表节点
        for (i, table) in tables.iter().enumerate() {
            let columns: Vec<ColumnNode> = table.columns.iter().map(|col| ColumnNode {
                name: col.name.clone(),
                data_type: col.data_type.clone(),
                is_primary_key: col.is_primary_key,
                is_foreign_key: col.is_foreign_key,
                nullable: col.nullable,
            }).collect();
            
            // 简单的网格布局
            let x = (i % 4) as f64 * 250.0 + 50.0;
            let y = (i / 4) as f64 * 300.0 + 50.0;
            let height = 40.0 + columns.len() as f64 * 25.0;
            
            table_nodes.push(TableNode {
                id: table.name.clone(),
                name: table.name.clone(),
                x,
                y,
                width: 200.0,
                height,
                columns,
            });
            
            // 创建关系边
            for col in &table.columns {
                if let Some(fk) = &col.foreign_key {
                    relations.push(RelationEdge {
                        id: format!("{}_{}_{}", table.name, col.name, fk.to_table),
                        from_table: table.name.clone(),
                        from_column: col.name.clone(),
                        to_table: fk.to_table.clone(),
                        to_column: fk.to_column.clone(),
                        relation_type: RelationType::OneToMany,
                    });
                }
            }
        }
        
        Ok(ERDiagram {
            tables: table_nodes,
            relations,
        })
    }
}
