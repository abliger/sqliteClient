use std::sync::Arc;

use chrono::{DateTime, Utc};
use parking_lot::Mutex;
use rusqlite::{params, Connection};
use tauri::{AppHandle, Manager};

use crate::models::history::{QueryHistoryFilter, QueryHistoryItem};
use crate::utils::error::{AppError, AppResult};

#[derive(Clone)]
pub struct HistoryStore {
    conn: Arc<Mutex<Connection>>,
}

impl HistoryStore {
    pub async fn new(app_handle: &AppHandle) -> AppResult<Self> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| AppError::IoError(e.to_string()))?;

        std::fs::create_dir_all(&app_dir)?;

        let db_path = app_dir.join("history.db");
        let conn = Connection::open(db_path)?;

        let store = Self {
            conn: Arc::new(Mutex::new(conn)),
        };

        store.init_tables()?;

        Ok(store)
    }

    fn init_tables(&self) -> AppResult<()> {
        let conn = self.conn.lock();

        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS query_history (
                id TEXT PRIMARY KEY,
                sql TEXT NOT NULL,
                connection_id TEXT,
                connection_name TEXT,
                executed_at TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                is_success BOOLEAN NOT NULL,
                error_message TEXT,
                row_count INTEGER
            );
            
            CREATE INDEX IF NOT EXISTS idx_history_executed_at 
            ON query_history(executed_at DESC);
            
            CREATE INDEX IF NOT EXISTS idx_history_connection 
            ON query_history(connection_id);
            
            CREATE INDEX IF NOT EXISTS idx_history_sql 
            ON query_history(sql);
            
            -- FTS5 for full-text search
            CREATE VIRTUAL TABLE IF NOT EXISTS query_history_fts USING fts5(
                sql,
                content='query_history',
                content_rowid='rowid'
            );
            
            -- Triggers to keep FTS index in sync
            CREATE TRIGGER IF NOT EXISTS history_ai AFTER INSERT ON query_history BEGIN
                INSERT INTO query_history_fts(rowid, sql) VALUES (new.rowid, new.sql);
            END;
            
            CREATE TRIGGER IF NOT EXISTS history_ad AFTER DELETE ON query_history BEGIN
                INSERT INTO query_history_fts(query_history_fts, rowid, sql) 
                VALUES ('delete', old.rowid, old.sql);
            END;
            "#,
        )?;

        Ok(())
    }

    pub fn add_history_item(&self, item: &QueryHistoryItem) -> AppResult<()> {
        let conn = self.conn.lock();

        // 检查是否存在相同的 SQL 记录（完全匹配，不区分连接）
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM query_history WHERE sql = ?1 LIMIT 1",
                params![item.sql],
                |_| Ok(true),
            )
            .unwrap_or(false);

        // 如果存在相同的 SQL，则不保存
        if exists {
            return Ok(());
        }

        conn.execute(
            r#"
            INSERT INTO query_history 
            (id, sql, connection_id, connection_name, executed_at, duration_ms, is_success, error_message, row_count)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            params![
                item.id,
                item.sql,
                item.connection_id,
                item.connection_name,
                item.executed_at.to_rfc3339(),
                item.duration_ms as i64,
                item.is_success,
                item.error_message,
                item.row_count.map(|v| v as i64)
            ],
        )?;

        Ok(())
    }

    pub fn get_history(&self, filter: &QueryHistoryFilter) -> AppResult<Vec<QueryHistoryItem>> {
        let conn = self.conn.lock();

        let mut sql = String::from(
            "SELECT id, sql, connection_id, connection_name, executed_at, duration_ms, 
             is_success, error_message, row_count 
             FROM query_history WHERE 1=1",
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(conn_id) = &filter.connection_id {
            sql.push_str(" AND connection_id = ?");
            params.push(Box::new(conn_id.clone()));
        }

        if let Some(is_success) = filter.is_success {
            sql.push_str(" AND is_success = ?");
            params.push(Box::new(is_success));
        }

        if let Some(from_date) = filter.from_date {
            sql.push_str(" AND executed_at >= ?");
            params.push(Box::new(from_date.to_rfc3339()));
        }

        if let Some(to_date) = filter.to_date {
            sql.push_str(" AND executed_at <= ?");
            params.push(Box::new(to_date.to_rfc3339()));
        }

        // Full-text search
        if let Some(search) = &filter.search {
            sql.push_str(
                " AND id IN (SELECT rowid FROM query_history_fts WHERE query_history_fts MATCH ?)",
            );
            params.push(Box::new(search.clone()));
        }

        sql.push_str(" ORDER BY executed_at DESC LIMIT ? OFFSET ?");
        params.push(Box::new(filter.limit as i64));
        params.push(Box::new(filter.offset as i64));

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok(QueryHistoryItem {
                id: row.get(0)?,
                sql: row.get(1)?,
                connection_id: row.get(2)?,
                connection_name: row.get(3)?,
                executed_at: row
                    .get::<_, String>(4)?
                    .parse::<DateTime<Utc>>()
                    .map_err(|_| rusqlite::Error::InvalidQuery)?,
                duration_ms: row.get::<_, i64>(5)? as u64,
                is_success: row.get(6)?,
                error_message: row.get(7)?,
                row_count: row.get::<_, Option<i64>>(8)?.map(|v| v as usize),
            })
        })?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row?);
        }

        Ok(items)
    }

    pub fn delete_history_item(&self, id: &str) -> AppResult<()> {
        let conn = self.conn.lock();
        conn.execute("DELETE FROM query_history WHERE id = ?", params![id])?;
        Ok(())
    }

    pub fn clear_history(&self, connection_id: Option<&str>) -> AppResult<usize> {
        let conn = self.conn.lock();

        let affected = if let Some(conn_id) = connection_id {
            conn.execute(
                "DELETE FROM query_history WHERE connection_id = ?",
                params![conn_id],
            )?
        } else {
            conn.execute("DELETE FROM query_history", [])?
        };

        Ok(affected)
    }

    pub fn search_history(&self, query: &str, limit: usize) -> AppResult<Vec<QueryHistoryItem>> {
        let filter = QueryHistoryFilter {
            search: Some(query.to_string()),
            limit,
            ..Default::default()
        };
        self.get_history(&filter)
    }
}

unsafe impl Send for HistoryStore {}
unsafe impl Sync for HistoryStore {}
