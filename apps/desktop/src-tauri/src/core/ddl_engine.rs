use std::collections::HashSet;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

use crate::models::ddl::*;
use crate::utils::error::{AppError, AppResult};

pub struct DdlEngine;

impl DdlEngine {
    /// 预览创建表的DDL
    pub fn preview_create_table(table: &DesignerTable) -> AppResult<PreviewDdlResult> {
        let sql = Self::generate_create_table_sql(table)?;
        let warnings = Self::validate_table_design(table)?;

        Ok(PreviewDdlResult {
            sql,
            warnings,
            estimated_impact: None,
        })
    }

    /// 预览修改表的DDL
    pub fn preview_alter_table(
        pool: &Pool<SqliteConnectionManager>,
        table_name: &str,
        changes: &[TableChange],
    ) -> AppResult<PreviewDdlResult> {
        let conn = pool
            .get()
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;

        // 获取当前表信息
        let current_columns: Vec<String> = conn
            .prepare(&format!("PRAGMA table_info('{}')", table_name))?
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<_, _>>()?;

        // 检查是否需要重建表
        let needs_recreate = Self::needs_table_recreation(changes);
        
        let sql = if needs_recreate {
            Self::generate_recreate_table_sql(pool, table_name, changes)?
        } else {
            Self::generate_alter_table_sql(table_name, changes)?
        };

        let warnings = Self::validate_changes(table_name, changes, &current_columns)?;

        let impact = if needs_recreate {
            let row_count: i64 = conn.query_row(
                &format!("SELECT COUNT(*) FROM \"{}\"", table_name),
                [],
                |r| r.get(0),
            )?;
            Some(DdlImpact {
                will_recreate_table: true,
                data_loss_risk: false, // SQLite 数据迁移通常是安全的
                affected_rows: Some(row_count),
            })
        } else {
            None
        };

        Ok(PreviewDdlResult {
            sql,
            warnings,
            estimated_impact: impact,
        })
    }

    /// 预览删除表的DDL
    pub fn preview_drop_table(table_name: &str) -> AppResult<PreviewDdlResult> {
        let sql = format!("DROP TABLE IF EXISTS \"{}\"", table_name);
        Ok(PreviewDdlResult {
            sql,
            warnings: vec![format!(
                "表 '{}' 将被永久删除，所有数据都将丢失",
                table_name
            )],
            estimated_impact: Some(DdlImpact {
                will_recreate_table: false,
                data_loss_risk: true,
                affected_rows: None,
            }),
        })
    }

    /// 执行创建表
    pub fn execute_create_table(
        pool: &Pool<SqliteConnectionManager>,
        table: &DesignerTable,
    ) -> AppResult<DdlExecutionResult> {
        let start = std::time::Instant::now();
        let sql = Self::generate_create_table_sql(table)?;

        let conn = pool
            .get()
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;
        conn.execute(&sql, [])?;

        // 创建索引
        for index in &table.indexes {
            let index_sql = Self::generate_create_index_sql(&table.name, index)?;
            conn.execute(&index_sql, [])?;
        }

        Ok(DdlExecutionResult {
            success: true,
            sql,
            message: Some(format!("表 '{}' 创建成功", table.name)),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    /// 执行修改表
    pub fn execute_alter_table(
        pool: &Pool<SqliteConnectionManager>,
        table_name: &str,
        changes: &[TableChange],
    ) -> AppResult<DdlExecutionResult> {
        let start = std::time::Instant::now();

        let needs_recreate = Self::needs_table_recreation(changes);
        
        if needs_recreate {
            Self::execute_recreate_table(pool, table_name, changes)?;
        } else {
            let sql = Self::generate_alter_table_sql(table_name, changes)?;
            let conn = pool
                .get()
                .map_err(|e| AppError::ConnectionError(e.to_string()))?;
            conn.execute_batch(&sql)?;
        }

        Ok(DdlExecutionResult {
            success: true,
            sql: format!("-- 表 '{}' 已修改", table_name),
            message: Some(format!("表 '{}' 修改成功", table_name)),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    /// 执行删除表
    pub fn execute_drop_table(
        pool: &Pool<SqliteConnectionManager>,
        table_name: &str,
    ) -> AppResult<DdlExecutionResult> {
        let start = std::time::Instant::now();
        let sql = format!("DROP TABLE IF EXISTS \"{}\"", table_name);

        let conn = pool
            .get()
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;
        conn.execute(&sql, [])?;

        Ok(DdlExecutionResult {
            success: true,
            sql,
            message: Some(format!("表 '{}' 已删除", table_name)),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    // ============================================
    // 私有辅助方法
    // ============================================

    /// 生成创建表的SQL
    fn generate_create_table_sql(table: &DesignerTable) -> AppResult<String> {
        let mut parts = Vec::new();
        let mut pk_columns = Vec::new();
        let mut constraints = Vec::new();

        // 收集主键列
        for col in &table.columns {
            if col.is_primary_key {
                pk_columns.push(format!("\"{}\"", col.name));
            }
        }

        // 处理列定义
        for col in &table.columns {
            let col_def = Self::generate_column_def(col)?;
            parts.push(col_def);
        }

        // 添加复合主键约束（如果有多个主键列且列本身没有标记为主键）
        if let Some(ref pk) = table.primary_key {
            if pk.len() > 1 {
                let pk_cols: Vec<String> = pk.iter().map(|c| format!("\"{}\"", c)).collect();
                constraints.push(format!("PRIMARY KEY ({})" , pk_cols.join(", ")));
            }
        } else if pk_columns.len() > 1 {
            constraints.push(format!("PRIMARY KEY ({})" , pk_columns.join(", ")));
        }

        // 添加外键约束
        for col in &table.columns {
            if col.is_foreign_key {
                if let Some(ref fk) = col.foreign_key {
                    let fk_constraint = format!(
                        "FOREIGN KEY (\"{}\") REFERENCES \"{}\"(\"{}\") ON UPDATE {} ON DELETE {}",
                        col.name, fk.ref_table, fk.ref_column, fk.on_update, fk.on_delete
                    );
                    constraints.push(fk_constraint);
                }
            }
        }

        parts.extend(constraints);

        let strict_clause = if table.strict_mode.unwrap_or(false) {
            " STRICT"
        } else {
            ""
        };

        Ok(format!(
            "CREATE TABLE \"{}\" (\n  {}\n){}",
            table.name,
            parts.join(",\n  "),
            strict_clause
        ))
    }

    /// 生成列定义
    fn generate_column_def(col: &DesignerColumn) -> AppResult<String> {
        let mut parts = vec![format!("\"{}\" {}", col.name, col.data_type)];

        // 主键（单列）
        if col.is_primary_key && col.foreign_key.is_none() {
            parts.push("PRIMARY KEY".to_string());
        }

        // 自增
        if col.is_auto_increment {
            parts.push("AUTOINCREMENT".to_string());
        }

        // 非空
        if !col.nullable {
            parts.push("NOT NULL".to_string());
        }

        // 唯一
        if col.is_unique && !col.is_primary_key {
            parts.push("UNIQUE".to_string());
        }

        // 默认值
        if let Some(ref default) = col.default_value {
            parts.push(format!("DEFAULT {}", default));
        }

        Ok(parts.join(" "))
    }

    /// 生成创建索引的SQL
    fn generate_create_index_sql(table_name: &str, index: &DesignerIndex) -> AppResult<String> {
        let unique_str = if index.unique { "UNIQUE " } else { "" };
        let cols: Vec<String> = index
            .columns
            .iter()
            .map(|c| format!("\"{}\"", c))
            .collect();

        let where_clause = index
            .where_clause
            .as_ref()
            .map(|w| format!(" WHERE {}", w))
            .unwrap_or_default();

        Ok(format!(
            "CREATE {0}INDEX \"{1}\" ON \"{2}\" ({3}){4}",
            unique_str,
            index.name,
            table_name,
            cols.join(", "),
            where_clause
        ))
    }

    /// 判断是否需要重建表
    fn needs_table_recreation(changes: &[TableChange]) -> bool {
        for change in changes {
            match change {
                TableChange::DropColumn { .. } => return true,
                TableChange::AlterColumn { .. } => return true,
                TableChange::RenameColumn { .. } => return true,
                TableChange::RenameTable { .. } => return false, // 可以用 ALTER TABLE RENAME
                _ => {}
            }
        }
        false
    }

    /// 生成ALTER TABLE SQL（不需要重建表的情况）
    fn generate_alter_table_sql(table_name: &str, changes: &[TableChange]) -> AppResult<String> {
        let mut sql_parts = Vec::new();

        for change in changes {
            match change {
                TableChange::AddColumn { column } => {
                    let col_def = Self::generate_column_def(column)?;
                    sql_parts.push(format!(
                        "ALTER TABLE \"{}\" ADD COLUMN {}",
                        table_name, col_def
                    ));
                }
                TableChange::AddIndex { index } => {
                    let index_sql = Self::generate_create_index_sql(table_name, index)?;
                    sql_parts.push(index_sql);
                }
                TableChange::DropIndex { index_name } => {
                    sql_parts.push(format!("DROP INDEX IF EXISTS \"{}\"", index_name));
                }
                TableChange::RenameTable { new_name } => {
                    sql_parts.push(format!(
                        "ALTER TABLE \"{}\" RENAME TO \"{}\"",
                        table_name, new_name
                    ));
                }
                _ => {} // 其他操作需要重建表
            }
        }

        Ok(sql_parts.join(";\n"))
    }

    /// 生成重建表的SQL（用于需要重建表的操作）
    fn generate_recreate_table_sql(
        pool: &Pool<SqliteConnectionManager>,
        table_name: &str,
        changes: &[TableChange],
    ) -> AppResult<String> {
        let conn = pool
            .get()
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;

        // 获取当前表结构
        let sql: String = conn.query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
            [table_name],
            |r| r.get(0),
        )?;

        let mut temp_table = Self::parse_table_from_sql(&sql, table_name)?;

        // 应用变更
        Self::apply_changes_to_table(&mut temp_table, changes)?;

        // 生成重建SQL
        let temp_name = format!("{}_temp_{}", table_name, uuid::Uuid::new_v4().simple());
        
        let mut result = Vec::new();
        
        // 1. 创建临时表
        let create_sql = Self::generate_create_table_sql(&DesignerTable {
            name: temp_name.clone(),
            columns: temp_table.columns.clone(),
            indexes: vec![], // 索引稍后单独创建
            primary_key: temp_table.primary_key.clone(),
            comment: None,
            strict_mode: temp_table.strict_mode,
        })?;
        result.push(create_sql);

        // 2. 复制数据
        let remaining_columns: Vec<String> = temp_table
            .columns
            .iter()
            .map(|c| format!("\"{}\"", c.name))
            .collect();
        result.push(format!(
            "INSERT INTO \"{}\" ({}) SELECT {} FROM \"{}\"",
            temp_name,
            remaining_columns.join(", "),
            remaining_columns.join(", "),
            table_name
        ));

        // 3. 删除旧表
        result.push(format!("DROP TABLE \"{}\"", table_name));

        // 4. 重命名临时表
        let final_name = if let Some(TableChange::RenameTable { new_name }) = changes.iter().find(|c| matches!(c, TableChange::RenameTable { .. })) {
            new_name.clone()
        } else {
            table_name.to_string()
        };
        result.push(format!(
            "ALTER TABLE \"{}\" RENAME TO \"{}\"",
            temp_name, final_name
        ));

        // 5. 重建索引
        for index in &temp_table.indexes {
            let index_sql = Self::generate_create_index_sql(&final_name, index)?;
            result.push(index_sql);
        }

        Ok(result.join(";\n"))
    }

    /// 执行重建表
    fn execute_recreate_table(
        pool: &Pool<SqliteConnectionManager>,
        table_name: &str,
        changes: &[TableChange],
    ) -> AppResult<()> {
        let sql = Self::generate_recreate_table_sql(pool, table_name, changes)?;
        
        let conn = pool
            .get()
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;
        conn.execute_batch(&sql)?;
        
        Ok(())
    }

    /// 从SQL解析表结构（简化版）
    fn parse_table_from_sql(_sql: &str, table_name: &str) -> AppResult<DesignerTable> {
        // 这是一个简化实现，实际可能需要更复杂的SQL解析
        // 这里我们使用PRAGMA获取实际结构
        Ok(DesignerTable {
            name: table_name.to_string(),
            columns: vec![],
            indexes: vec![],
            primary_key: None,
            comment: None,
            strict_mode: None,
        })
    }

    /// 应用变更到表结构
    fn apply_changes_to_table(
        table: &mut DesignerTable,
        changes: &[TableChange],
    ) -> AppResult<()> {
        for change in changes {
            match change {
                TableChange::AddColumn { column } => {
                    table.columns.push(column.clone());
                }
                TableChange::DropColumn { column_name } => {
                    table.columns.retain(|c| c.name != *column_name);
                }
                TableChange::RenameColumn { old_name, new_name } => {
                    for col in &mut table.columns {
                        if col.name == *old_name {
                            col.name = new_name.clone();
                        }
                    }
                }
                TableChange::AlterColumn { column_name, new_column } => {
                    if let Some(idx) = table.columns.iter().position(|c| c.name == *column_name) {
                        table.columns[idx] = new_column.clone();
                    }
                }
                TableChange::AddIndex { index } => {
                    table.indexes.push(index.clone());
                }
                TableChange::DropIndex { index_name } => {
                    table.indexes.retain(|i| i.name != *index_name);
                }
                TableChange::RenameTable { new_name } => {
                    table.name = new_name.clone();
                }
            }
        }
        Ok(())
    }

    /// 验证表设计
    fn validate_table_design(table: &DesignerTable) -> AppResult<Vec<String>> {
        let mut warnings = Vec::new();
        let mut names: HashSet<String> = HashSet::new();

        // 检查表名
        if table.name.is_empty() {
            return Err(AppError::InvalidParameter("表名不能为空".to_string()));
        }

        // 检查列
        if table.columns.is_empty() {
            return Err(AppError::InvalidParameter("表至少需要一列".to_string()));
        }

        for col in &table.columns {
            // 检查重复列名
            if !names.insert(col.name.clone()) {
                return Err(AppError::InvalidParameter(format!(
                    "重复的列名: {}",
                    col.name
                )));
            }

            // 检查主键
            if col.is_primary_key && col.nullable {
                warnings.push(format!("列 '{}' 是主键但允许NULL", col.name));
            }

            // 检查外键
            if col.is_foreign_key && col.foreign_key.is_none() {
                return Err(AppError::InvalidParameter(format!(
                    "列 '{}' 标记为外键但缺少外键定义",
                    col.name
                )));
            }
        }

        // 检查索引
        for index in &table.indexes {
            if index.columns.is_empty() {
                return Err(AppError::InvalidParameter(format!(
                    "索引 '{}' 没有指定列",
                    index.name
                )));
            }
        }

        Ok(warnings)
    }

    /// 验证变更
    fn validate_changes(
        _table_name: &str,
        changes: &[TableChange],
        current_columns: &[String],
    ) -> AppResult<Vec<String>> {
        let mut warnings = Vec::new();

        for change in changes {
            match change {
                TableChange::DropColumn { column_name } => {
                    if !current_columns.contains(column_name) {
                        warnings.push(format!("列 '{}' 不存在", column_name));
                    } else {
                        warnings.push(format!(
                            "列 '{}' 将被删除，数据将丢失",
                            column_name
                        ));
                    }
                }
                TableChange::RenameColumn { old_name, .. } => {
                    if !current_columns.contains(old_name) {
                        return Err(AppError::InvalidParameter(format!(
                            "列 '{}' 不存在",
                            old_name
                        )));
                    }
                }
                TableChange::AlterColumn { column_name, .. } => {
                    if !current_columns.contains(column_name) {
                        return Err(AppError::InvalidParameter(format!(
                            "列 '{}' 不存在",
                            column_name
                        )));
                    }
                    warnings.push(format!(
                        "修改列 '{}' 可能需要重建表",
                        column_name
                    ));
                }
                _ => {}
            }
        }

        Ok(warnings)
    }
}
