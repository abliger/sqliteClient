import * as Database from 'better-sqlite3'
import * as vscode from 'vscode'
import * as path from 'path'
import {
    ConnectionConfig,
    ConnectionInfo,
    ConnectionStatus,
    DatabaseMetadata,
    QueryResult,
    QueryResultRows,
    QueryResultExecution,
    QueryRow,
    QueryExecutionInfo,
    TableInfo,
    ColumnInfo,
    ForeignKeyInfo,
    DatabaseSchema,
    IndexInfo,
    TriggerInfo,
    ERDiagram,
    TableNode,
    RelationEdge,
    ColumnNode,
    QueryHistoryItem,
    DesignerTable,
    PreviewDDLResult,
    DDLExecutionResult,
    TableChange,
    SqlFileExecutionResult,
    StatementExecutionResult,
} from './types'

interface Connection {
    config: ConnectionConfig
    db: Database.Database
    status: ConnectionStatus
    metadata: DatabaseMetadata
}

export class DatabaseManager {
    private connections: Map<string, Connection> = new Map()
    private queryHistory: QueryHistoryItem[] = []
    private historyPath: string

    constructor() {
        // Store history in extension storage
        const storagePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || require('os').homedir()
        this.historyPath = path.join(storagePath, '.sqlite-client-history.json')
        this.loadHistory()
    }

    private loadHistory() {
        try {
            const fs = require('fs')
            if (fs.existsSync(this.historyPath)) {
                const data = fs.readFileSync(this.historyPath, 'utf-8')
                this.queryHistory = JSON.parse(data)
            }
        } catch (e) {
            console.error('Failed to load query history:', e)
        }
    }

    private saveHistory() {
        try {
            const fs = require('fs')
            fs.writeFileSync(this.historyPath, JSON.stringify(this.queryHistory, null, 2))
        } catch (e) {
            console.error('Failed to save query history:', e)
        }
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 15)
    }

    private getMetadata(db: Database.Database): DatabaseMetadata {
        const pageSize = db.pragma('page_size', { simple: true }) as number
        const pageCount = db.pragma('page_count', { simple: true }) as number
        const tableCount = db.prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='table'").get() as { 'COUNT(*)': number }
        const indexCount = db.prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='index'").get() as { 'COUNT(*)': number }
        const triggerCount = db.prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'").get() as { 'COUNT(*)': number }

        return {
            version: db.prepare('SELECT sqlite_version()').get() as string,
            page_size: pageSize,
            page_count: pageCount,
            table_count: tableCount['COUNT(*)'],
            index_count: indexCount['COUNT(*)'],
            trigger_count: triggerCount['COUNT(*)'],
            size_bytes: pageSize * pageCount,
        }
    }

    async createConnection(name: string, dbPath: string): Promise<ConnectionInfo> {
        try {
            const db = new Database(dbPath)
            db.pragma('journal_mode = WAL')

            const id = this.generateId()
            const config: ConnectionConfig = {
                id,
                name,
                db_path: dbPath,
                created_at: new Date().toISOString(),
                last_connected: new Date().toISOString(),
            }

            const metadata = this.getMetadata(db)
            const connection: Connection = {
                config,
                db,
                status: 'connected',
                metadata,
            }

            this.connections.set(id, connection)

            return {
                config,
                status: 'connected',
                metadata,
            }
        } catch (error) {
            throw new Error(`Failed to connect to database: ${error}`)
        }
    }

    async createNewDatabase(name: string, dbPath: string): Promise<ConnectionInfo> {
        try {
            // Ensure directory exists
            const fs = require('fs')
            const dir = path.dirname(dbPath)
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }

            // Create the database
            const db = new Database(dbPath)
            db.close()

            return this.createConnection(name, dbPath)
        } catch (error) {
            throw new Error(`Failed to create database: ${error}`)
        }
    }

    async closeConnection(connectionId: string): Promise<void> {
        const conn = this.connections.get(connectionId)
        if (conn) {
            conn.db.close()
            this.connections.delete(connectionId)
        }
    }

    async listConnections(): Promise<ConnectionInfo[]> {
        return Array.from(this.connections.values()).map((conn) => ({
            config: conn.config,
            status: conn.status,
            metadata: conn.metadata,
        }))
    }

    async getConnectionInfo(connectionId: string): Promise<ConnectionInfo> {
        const conn = this.connections.get(connectionId)
        if (!conn) {
            throw new Error('Connection not found')
        }
        return {
            config: conn.config,
            status: conn.status,
            metadata: conn.metadata,
        }
    }

    async testConnection(dbPath: string): Promise<void> {
        try {
            const db = new Database(dbPath, { readonly: true })
            db.prepare('SELECT 1').get()
            db.close()
        } catch (error) {
            throw new Error(`Failed to connect: ${error}`)
        }
    }

    async executeQuery(
        connectionId: string,
        sql: string,
        limit?: number
    ): Promise<QueryResult> {
        const conn = this.connections.get(connectionId)
        if (!conn) {
            throw new Error('Connection not found')
        }

        const startTime = Date.now()
        const trimmedSql = sql.trim().toUpperCase()

        try {
            // Check if it's a SELECT query
            if (trimmedSql.startsWith('SELECT')) {
                const stmt = conn.db.prepare(sql)
                const rows = limit ? stmt.all().slice(0, limit) : stmt.all()
                const columns = stmt.columns().map((col) => col.name)

                const executionInfo: QueryExecutionInfo = {
                    execution_time_ms: Date.now() - startTime,
                    rows_returned: rows.length,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                }

                // Log to history
                this.addToHistory(sql, connectionId, conn.config.name, executionInfo.execution_time_ms, true, rows.length)

                return {
                    type: 'rows',
                    columns,
                    rows: rows.map((row: any) => ({
                        values: Object.fromEntries(
                            Object.entries(row).map(([key, value]) => [key, this.wrapValue(value)])
                        ),
                    })),
                    has_more: false,
                    execution_info: executionInfo,
                }
            } else {
                // For INSERT, UPDATE, DELETE, CREATE, DROP, etc.
                const result = conn.db.prepare(sql).run()

                const executionInfo: QueryExecutionInfo = {
                    execution_time_ms: Date.now() - startTime,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                }

                this.addToHistory(sql, connectionId, conn.config.name, executionInfo.execution_time_ms, true)

                return {
                    type: 'execution',
                    rows_affected: result.changes,
                    last_insert_id: Number(result.lastInsertRowid),
                    execution_info: executionInfo,
                }
            }
        } catch (error) {
            this.addToHistory(sql, connectionId, conn.config.name, Date.now() - startTime, false, undefined, String(error))
            throw error
        }
    }

    private wrapValue(value: any): any {
        if (value === null) return { type: 'Null' }
        if (typeof value === 'number') {
            if (Number.isInteger(value)) return { type: 'Integer', value }
            return { type: 'Real', value }
        }
        if (typeof value === 'boolean') return { type: 'Boolean', value }
        if (typeof value === 'string') return { type: 'Text', value }
        return { type: 'Blob', value: String(value) }
    }

    private addToHistory(
        sql: string,
        connectionId: string,
        connectionName: string,
        durationMs: number,
        isSuccess: boolean,
        rowCount?: number,
        errorMessage?: string
    ) {
        const item: QueryHistoryItem = {
            id: this.generateId(),
            sql,
            connection_id: connectionId,
            connection_name: connectionName,
            executed_at: new Date().toISOString(),
            duration_ms: durationMs,
            is_success: isSuccess,
            row_count: rowCount,
            error_message: errorMessage,
        }
        this.queryHistory.unshift(item)
        if (this.queryHistory.length > 1000) {
            this.queryHistory = this.queryHistory.slice(0, 1000)
        }
        this.saveHistory()
    }

    async listTables(connectionId: string): Promise<TableInfo[]> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Connection not found')

        const tables = conn.db
            .prepare(
                "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
            .all() as { name: string; sql?: string }[]

        return tables.map((t) => ({
            name: t.name,
            sql: t.sql,
            column_count: 0,
            columns: [],
        }))
    }

    async getTableSchema(connectionId: string, tableName: string): Promise<TableInfo> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Connection not found')

        const tableInfo = conn.db.prepare(`PRAGMA table_info("${tableName}")`).all() as any[]
        const foreignKeys = conn.db.prepare(`PRAGMA foreign_key_list("${tableName}")`).all() as any[]

        const fkMap = new Map<string, ForeignKeyInfo>()
        foreignKeys.forEach((fk) => {
            fkMap.set(fk.from, {
                from_column: fk.from,
                to_table: fk.table,
                to_column: fk.to,
                on_update: fk.on_update,
                on_delete: fk.on_delete,
            })
        })

        const columns: ColumnInfo[] = tableInfo.map((col) => {
            const fk = fkMap.get(col.name)
            return {
                name: col.name,
                data_type: col.type,
                nullable: !col.notnull,
                default_value: col.dflt_value,
                is_primary_key: col.pk === 1,
                is_foreign_key: !!fk,
                foreign_key: fk,
            }
        })

        // Get row count
        const countResult = conn.db.prepare(`SELECT COUNT(*) FROM "${tableName}"`).get() as { 'COUNT(*)': number }

        return {
            name: tableName,
            sql: conn.db
                .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
                .get(tableName)?.sql,
            column_count: columns.length,
            row_count: countResult['COUNT(*)'],
            columns,
        }
    }

    async getDatabaseSchema(connectionId: string): Promise<DatabaseSchema> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Connection not found')

        const tables = await this.listTables(connectionId)
        const tablesWithSchema = await Promise.all(
            tables.map((t) => this.getTableSchema(connectionId, t.name))
        )

        const indexes = await this.listIndexes(connectionId)
        const triggers = await this.listTriggers(connectionId)

        return {
            tables: tablesWithSchema,
            indexes,
            triggers,
        }
    }

    async listIndexes(connectionId: string): Promise<IndexInfo[]> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Connection not found')

        const indexes = conn.db
            .prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index'")
            .all() as { name: string; tbl_name: string; sql?: string }[]

        return indexes.map((idx) => ({
            name: idx.name,
            table_name: idx.tbl_name,
            unique: idx.sql?.toUpperCase().includes('UNIQUE') || false,
            columns: [],
            sql: idx.sql,
        }))
    }

    async listTriggers(connectionId: string): Promise<TriggerInfo[]> {
        const conn = this.connections.get(connectionId)
        if (!conn) throw new Error('Connection not found')

        return conn.db
            .prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'")
            .all() as TriggerInfo[]
    }

    async getERDiagramData(connectionId: string): Promise<ERDiagram> {
        const schema = await this.getDatabaseSchema(connectionId)
        const tables: TableNode[] = []
        const relations: RelationEdge[] = []

        schema.tables.forEach((table, index) => {
            const columns: ColumnNode[] = table.columns.map((col) => ({
                name: col.name,
                data_type: col.data_type,
                is_primary_key: col.is_primary_key,
                is_foreign_key: col.is_foreign_key,
                nullable: col.nullable,
            }))

            tables.push({
                id: table.name,
                name: table.name,
                x: 100 + (index % 3) * 300,
                y: 100 + Math.floor(index / 3) * 200,
                width: 200,
                height: 60 + columns.length * 25,
                columns,
            })

            table.columns.forEach((col) => {
                if (col.foreign_key) {
                    relations.push({
                        id: `${table.name}.${col.name}->${col.foreign_key.to_table}.${col.foreign_key.to_column}`,
                        from_table: table.name,
                        from_column: col.name,
                        to_table: col.foreign_key.to_table,
                        to_column: col.foreign_key.to_column,
                        relation_type: 'onetomany',
                    })
                }
            })
        })

        return { tables, relations }
    }

    async getTableData(
        connectionId: string,
        tableName: string,
        limit: number = 100,
        offset: number = 0,
        orderBy?: string,
        orderDir: 'ASC' | 'DESC' = 'ASC'
    ): Promise<QueryResult> {
        let sql = `SELECT * FROM "${tableName}"`
        if (orderBy) {
            sql += ` ORDER BY "${orderBy}" ${orderDir}`
        }
        sql += ` LIMIT ${limit} OFFSET ${offset}`
        return this.executeQuery(connectionId, sql)
    }

    async insertRow(
        connectionId: string,
        tableName: string,
        data: Record<string, any>
    ): Promise<QueryResult> {
        const columns = Object.keys(data)
        const placeholders = columns.map(() => '?').join(', ')
        const sql = `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`
        return this.executeQuery(connectionId, sql)
    }

    async updateRow(
        connectionId: string,
        tableName: string,
        data: Record<string, any>,
        conditions: Record<string, any>
    ): Promise<QueryResult> {
        const setClause = Object.keys(data)
            .map((k) => `"${k}" = ?`)
            .join(', ')
        const whereClause = Object.keys(conditions)
            .map((k) => `"${k}" = ?`)
            .join(' AND ')
        const sql = `UPDATE "${tableName}" SET ${setClause} WHERE ${whereClause}`
        return this.executeQuery(connectionId, sql)
    }

    async deleteRow(
        connectionId: string,
        tableName: string,
        conditions: Record<string, any>
    ): Promise<QueryResult> {
        const whereClause = Object.keys(conditions)
            .map((k) => `"${k}" = ?`)
            .join(' AND ')
        const sql = `DELETE FROM "${tableName}" WHERE ${whereClause}`
        return this.executeQuery(connectionId, sql)
    }

    async getQueryHistory(limit?: number, offset?: number): Promise<QueryHistoryItem[]> {
        let history = this.queryHistory
        if (offset !== undefined) {
            history = history.slice(offset)
        }
        if (limit !== undefined) {
            history = history.slice(0, limit)
        }
        return history
    }

    async searchHistory(query: string, limit?: number): Promise<QueryHistoryItem[]> {
        const results = this.queryHistory.filter((item) =>
            item.sql.toLowerCase().includes(query.toLowerCase())
        )
        return limit ? results.slice(0, limit) : results
    }

    async deleteHistoryItem(id: string): Promise<void> {
        this.queryHistory = this.queryHistory.filter((item) => item.id !== id)
        this.saveHistory()
    }

    async clearHistory(connectionId?: string): Promise<number> {
        const initialCount = this.queryHistory.length
        if (connectionId) {
            this.queryHistory = this.queryHistory.filter((item) => item.connection_id !== connectionId)
        } else {
            this.queryHistory = []
        }
        this.saveHistory()
        return initialCount - this.queryHistory.length
    }

    async previewCreateTable(table: DesignerTable): Promise<PreviewDDLResult> {
        const columns: string[] = table.columns.map((col) => {
            let def = `"${col.name}" ${col.data_type}`
            if (col.is_primary_key) def += ' PRIMARY KEY'
            if (col.is_auto_increment) def += ' AUTOINCREMENT'
            if (!col.nullable) def += ' NOT NULL'
            if (col.default_value !== undefined) def += ` DEFAULT ${col.default_value}`
            if (col.is_unique && !col.is_primary_key) def += ' UNIQUE'
            return def
        })

        const sql = `CREATE TABLE "${table.name}" (${columns.join(', ')})`
        return { sql, warnings: [] }
    }

    async previewAlterTable(
        connectionId: string,
        tableName: string,
        changes: TableChange[]
    ): Promise<PreviewDDLResult> {
        const statements: string[] = []
        for (const change of changes) {
            switch (change.type) {
                case 'add_column':
                    statements.push(`ALTER TABLE "${tableName}" ADD COLUMN "${change.column.name}" ${change.column.data_type}`)
                    break
                case 'drop_column':
                    statements.push(`-- Note: SQLite doesn't support DROP COLUMN directly; table recreation needed`)
                    break
                case 'rename_column':
                    statements.push(`ALTER TABLE "${tableName}" RENAME COLUMN "${change.old_name}" TO "${change.new_name}"`)
                    break
            }
        }
        return { sql: statements.join(';\n'), warnings: [] }
    }

    async previewDropTable(tableName: string): Promise<PreviewDDLResult> {
        return { sql: `DROP TABLE "${tableName}"`, warnings: ['This will permanently delete the table and all its data'] }
    }

    async createTable(connectionId: string, table: DesignerTable): Promise<DDLExecutionResult> {
        const preview = await this.previewCreateTable(table)
        await this.executeQuery(connectionId, preview.sql)
        return { success: true, sql: preview.sql, execution_time_ms: 0 }
    }

    async alterTable(
        connectionId: string,
        tableName: string,
        changes: TableChange[]
    ): Promise<DDLExecutionResult> {
        const preview = await this.previewAlterTable(connectionId, tableName, changes)
        for (const sql of preview.sql.split(';').filter(s => s.trim())) {
            if (!sql.trim().startsWith('--')) {
                await this.executeQuery(connectionId, sql)
            }
        }
        return { success: true, sql: preview.sql, execution_time_ms: 0 }
    }

    async dropTable(connectionId: string, tableName: string): Promise<DDLExecutionResult> {
        const sql = `DROP TABLE "${tableName}"`
        await this.executeQuery(connectionId, sql)
        return { success: true, sql, execution_time_ms: 0 }
    }

    async executeSqlFile(connectionId: string, filePath: string): Promise<SqlFileExecutionResult> {
        const fs = require('fs')
        const content = fs.readFileSync(filePath, 'utf-8')
        const statements = content.split(';').filter((s: string) => s.trim())

        const results: StatementExecutionResult[] = []
        let successCount = 0
        let errorCount = 0
        const startTime = Date.now()

        for (let i = 0; i < statements.length; i++) {
            const sql = statements[i].trim()
            const stmtStart = Date.now()
            try {
                await this.executeQuery(connectionId, sql)
                successCount++
                results.push({
                    index: i,
                    sql: sql.slice(0, 100),
                    success: true,
                    duration_ms: Date.now() - stmtStart,
                })
            } catch (error) {
                errorCount++
                results.push({
                    index: i,
                    sql: sql.slice(0, 100),
                    success: false,
                    error_message: String(error),
                    duration_ms: Date.now() - stmtStart,
                })
            }
        }

        return {
            file_path: filePath,
            total_statements: statements.length,
            success_count: successCount,
            error_count: errorCount,
            statements: results,
            total_duration_ms: Date.now() - startTime,
        }
    }

    dispose() {
        for (const conn of this.connections.values()) {
            conn.db.close()
        }
        this.connections.clear()
    }
}
