import Database from 'better-sqlite3'
import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import {
    ConnectionConfig,
    ConnectionInfo,
    ConnectionStatus,
    DatabaseMetadata,
    QueryResult,
    QueryResultRows,
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
import {
    validateIdentifier,
    quoteTableName,
    isSelectQuery,
    validateOrderDirection,
    validateLimit,
    validateOffset,
} from './utils/sql'
import { ConnectionError, QueryError, ValidationError, NotFoundError } from './utils/errors'
import { generateId, generateUUID } from './utils/id'

interface Connection {
    config: ConnectionConfig
    db: Database.Database
    status: ConnectionStatus
    metadata: DatabaseMetadata
}

interface DatabaseManagerOptions {
    maxHistorySize?: number
    maxQueryResults?: number
}

export class DatabaseManager {
    private connections: Map<string, Connection> = new Map()
    private queryHistory: QueryHistoryItem[] = []
    private historyPath: string
    private maxHistorySize: number
    private maxQueryResults: number

    constructor(
        private context: vscode.ExtensionContext,
        options: DatabaseManagerOptions = {}
    ) {
        this.maxHistorySize = options.maxHistorySize || 1000
        this.maxQueryResults = options.maxQueryResults || 10000
        
        // Store history in VSCode's global storage (not workspace)
        // This ensures history persists across workspaces and isn't committed
        const globalStoragePath = this.context.globalStorageUri.fsPath
        
        // Ensure storage directory exists
        if (!fs.existsSync(globalStoragePath)) {
            fs.mkdirSync(globalStoragePath, { recursive: true })
        }
        
        this.historyPath = path.join(globalStoragePath, 'query-history.json')
        console.log('[DatabaseManager] History stored at:', this.historyPath)
        this.loadHistory()
    }

    private loadHistory(): void {
        try {
            if (fs.existsSync(this.historyPath)) {
                const data = fs.readFileSync(this.historyPath, 'utf-8')
                this.queryHistory = JSON.parse(data)
            }
        } catch (e) {
            console.error('Failed to load query history:', e)
            this.queryHistory = []
        }
    }

    private saveHistory(): void {
        try {
            fs.writeFileSync(this.historyPath, JSON.stringify(this.queryHistory, null, 2))
        } catch (e) {
            console.error('Failed to save query history:', e)
        }
    }

    private getMetadata(db: Database.Database): DatabaseMetadata {
        const pageSize = db.pragma('page_size', { simple: true }) as number
        const pageCount = db.pragma('page_count', { simple: true }) as number
        const tableCount = db.prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='table'").get() as { 'COUNT(*)': number }
        const indexCount = db.prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='index'").get() as { 'COUNT(*)': number }
        const triggerCount = db.prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'").get() as { 'COUNT(*)': number }
        const versionResult = db.prepare('SELECT sqlite_version() as version').get() as { version: string }

        return {
            version: versionResult.version,
            page_size: pageSize,
            page_count: pageCount,
            table_count: tableCount['COUNT(*)'],
            index_count: indexCount['COUNT(*)'],
            trigger_count: triggerCount['COUNT(*)'],
            size_bytes: pageSize * pageCount,
        }
    }

    private getConnection(connectionId: string): Connection {
        const conn = this.connections.get(connectionId)
        if (!conn) {
            throw new NotFoundError(`Connection not found: ${connectionId}`)
        }
        return conn
    }

    async createConnection(name: string, dbPath: string): Promise<ConnectionInfo> {
        let db: Database.Database | undefined
        try {
            db = new Database(dbPath)
            db.pragma('journal_mode = WAL')

            const id = generateId()
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
            // 确保在失败时关闭连接
            if (db) {
                try {
                    db.close()
                } catch (closeError) {
                    console.error('Failed to close database after failed connection:', closeError)
                }
            }
            throw new ConnectionError(`Failed to connect to database: ${error}`, error as Error)
        }
    }

    async createNewDatabase(name: string, dbPath: string): Promise<ConnectionInfo> {
        let db: Database.Database | undefined
        try {
            // Ensure directory exists
            const dir = path.dirname(dbPath)
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }

            // Create the database
            db = new Database(dbPath)
            db.close()
            db = undefined

            return this.createConnection(name, dbPath)
        } catch (error) {
            if (db) {
                try {
                    db.close()
                } catch (closeError) {
                    console.error('Failed to close database after failed creation:', closeError)
                }
            }
            throw new ConnectionError(`Failed to create database: ${error}`, error as Error)
        }
    }

    async closeConnection(connectionId: string): Promise<void> {
        const conn = this.connections.get(connectionId)
        if (conn) {
            try {
                conn.db.close()
            } catch (error) {
                console.error('Error closing connection:', error)
            } finally {
                this.connections.delete(connectionId)
            }
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
        const conn = this.getConnection(connectionId)
        return {
            config: conn.config,
            status: conn.status,
            metadata: conn.metadata,
        }
    }

    async testConnection(dbPath: string): Promise<void> {
        let db: Database.Database | undefined
        try {
            db = new Database(dbPath, { readonly: true })
            db.prepare('SELECT 1').get()
        } catch (error) {
            throw new ConnectionError(`Failed to connect: ${error}`, error as Error)
        } finally {
            if (db) {
                try {
                    db.close()
                } catch (closeError) {
                    console.error('Error closing test connection:', closeError)
                }
            }
        }
    }

    async executeQuery(
        connectionId: string,
        sql: string,
        limit?: number
    ): Promise<QueryResult> {
        const conn = this.getConnection(connectionId)

        const startTime = Date.now()
        const effectiveLimit = Math.min(limit ?? this.maxQueryResults, this.maxQueryResults)

        try {
            if (isSelectQuery(sql)) {
                const stmt = conn.db.prepare(sql)
                const allRows = stmt.all()
                const rows = allRows.slice(0, effectiveLimit)
                const columns = stmt.columns().map((col) => col.name)

                const executionInfo: QueryExecutionInfo = {
                    execution_time_ms: Date.now() - startTime,
                    rows_returned: rows.length,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                }

                this.addToHistory(sql, connectionId, conn.config.name, executionInfo.execution_time_ms, true, rows.length)

                return {
                    type: 'rows',
                    columns,
                    rows: rows.map((row: any) => ({
                        values: Object.fromEntries(
                            Object.entries(row).map(([key, value]) => [key, this.wrapValue(value)])
                        ),
                    })),
                    has_more: allRows.length > effectiveLimit,
                    execution_info: executionInfo,
                }
            } else {
                // For INSERT, UPDATE, DELETE, CREATE, DROP, etc.
                const stmt = conn.db.prepare(sql)
                const result = stmt.run()

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
            throw new QueryError(`Query execution failed: ${error}`, error as Error)
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
        if (value instanceof Buffer) {
            return { type: 'Blob', value: value.toString('base64') }
        }
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
    ): void {
        const item: QueryHistoryItem = {
            id: generateUUID(),
            sql: sql.substring(0, 10000), // 限制 SQL 长度
            connection_id: connectionId,
            connection_name: connectionName,
            executed_at: new Date().toISOString(),
            duration_ms: durationMs,
            is_success: isSuccess,
            row_count: rowCount,
            error_message: errorMessage,
        }
        this.queryHistory.unshift(item)
        if (this.queryHistory.length > this.maxHistorySize) {
            this.queryHistory = this.queryHistory.slice(0, this.maxHistorySize)
        }
        this.saveHistory()
    }

    async listTables(connectionId: string): Promise<TableInfo[]> {
        const conn = this.getConnection(connectionId)

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
        const conn = this.getConnection(connectionId)

        // 验证表名防止 SQL 注入
        const safeTableName = quoteTableName(tableName)

        const tableInfo = conn.db.prepare(`PRAGMA table_info(${safeTableName})`).all() as any[]
        const foreignKeys = conn.db.prepare(`PRAGMA foreign_key_list(${safeTableName})`).all() as any[]

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
        const countResult = conn.db.prepare(`SELECT COUNT(*) FROM ${safeTableName}`).get() as { 'COUNT(*)': number }

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
        const conn = this.getConnection(connectionId)

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
        const conn = this.getConnection(connectionId)

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
        // 验证参数
        const safeLimit = validateLimit(limit)
        const safeOffset = validateOffset(offset)
        const safeOrderDir = validateOrderDirection(orderDir)
        const safeTableName = quoteTableName(tableName)

        let sql = `SELECT * FROM ${safeTableName}`
        
        if (orderBy) {
            const safeOrderBy = quoteTableName(orderBy)
            sql += ` ORDER BY ${safeOrderBy} ${safeOrderDir}`
        }
        
        sql += ` LIMIT ${safeLimit} OFFSET ${safeOffset}`
        return this.executeQuery(connectionId, sql)
    }

    async insertRow(
        connectionId: string,
        tableName: string,
        data: Record<string, any>
    ): Promise<QueryResult> {
        const conn = this.getConnection(connectionId)
        const safeTableName = quoteTableName(tableName)

        // 开始事务
        const transaction = conn.db.transaction(() => {
            const columns = Object.keys(data)
            const placeholders = columns.map(() => '?').join(', ')
            const columnNames = columns.map(c => quoteTableName(c)).join(', ')
            const sql = `INSERT INTO ${safeTableName} (${columnNames}) VALUES (${placeholders})`
            
            const stmt = conn.db.prepare(sql)
            const values = Object.values(data)
            return stmt.run(...values)
        })

        try {
            const result = transaction()
            return {
                type: 'execution',
                rows_affected: result.changes,
                last_insert_id: Number(result.lastInsertRowid),
                execution_info: {
                    execution_time_ms: 0,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
        } catch (error) {
            throw new QueryError(`Insert failed: ${error}`, error as Error)
        }
    }

    async updateRow(
        connectionId: string,
        tableName: string,
        data: Record<string, any>,
        conditions: Record<string, any>
    ): Promise<QueryResult> {
        const conn = this.getConnection(connectionId)
        const safeTableName = quoteTableName(tableName)

        const transaction = conn.db.transaction(() => {
            const setClause = Object.keys(data)
                .map((k) => `${quoteTableName(k)} = ?`)
                .join(', ')
            const whereClause = Object.keys(conditions)
                .map((k) => `${quoteTableName(k)} = ?`)
                .join(' AND ')
            const sql = `UPDATE ${safeTableName} SET ${setClause} WHERE ${whereClause}`
            
            const stmt = conn.db.prepare(sql)
            const values = [...Object.values(data), ...Object.values(conditions)]
            return stmt.run(...values)
        })

        try {
            const result = transaction()
            return {
                type: 'execution',
                rows_affected: result.changes,
                last_insert_id: undefined,
                execution_info: {
                    execution_time_ms: 0,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
        } catch (error) {
            throw new QueryError(`Update failed: ${error}`, error as Error)
        }
    }

    async deleteRow(
        connectionId: string,
        tableName: string,
        conditions: Record<string, any>
    ): Promise<QueryResult> {
        const conn = this.getConnection(connectionId)
        const safeTableName = quoteTableName(tableName)

        const transaction = conn.db.transaction(() => {
            const whereClause = Object.keys(conditions)
                .map((k) => `${quoteTableName(k)} = ?`)
                .join(' AND ')
            const sql = `DELETE FROM ${safeTableName} WHERE ${whereClause}`
            
            const stmt = conn.db.prepare(sql)
            return stmt.run(...Object.values(conditions))
        })

        try {
            const result = transaction()
            return {
                type: 'execution',
                rows_affected: result.changes,
                last_insert_id: undefined,
                execution_info: {
                    execution_time_ms: 0,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
        } catch (error) {
            throw new QueryError(`Delete failed: ${error}`, error as Error)
        }
    }

    async getQueryHistory(limit?: number, offset?: number): Promise<QueryHistoryItem[]> {
        let history = this.queryHistory
        if (offset !== undefined && offset >= 0) {
            history = history.slice(offset)
        }
        if (limit !== undefined && limit >= 0) {
            history = history.slice(0, Math.min(limit, this.maxHistorySize))
        }
        return history
    }

    async searchHistory(query: string, limit?: number): Promise<QueryHistoryItem[]> {
        if (!query || typeof query !== 'string') {
            return []
        }
        const normalizedQuery = query.toLowerCase()
        const results = this.queryHistory.filter((item) =>
            item.sql.toLowerCase().includes(normalizedQuery)
        )
        return limit !== undefined && limit >= 0 
            ? results.slice(0, Math.min(limit, this.maxHistorySize)) 
            : results
    }

    async deleteHistoryItem(id: string): Promise<void> {
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Invalid history item ID')
        }
        this.queryHistory = this.queryHistory.filter((item) => item.id !== id)
        this.saveHistory()
    }

    async clearHistory(connectionId?: string): Promise<number> {
        const initialCount = this.queryHistory.length
        if (connectionId && typeof connectionId === 'string') {
            this.queryHistory = this.queryHistory.filter((item) => item.connection_id !== connectionId)
        } else {
            this.queryHistory = []
        }
        this.saveHistory()
        return initialCount - this.queryHistory.length
    }

    async previewCreateTable(table: DesignerTable): Promise<PreviewDDLResult> {
        // 验证表名
        const safeTableName = quoteTableName(table.name)

        const columns: string[] = table.columns.map((col) => {
            let def = `${quoteTableName(col.name)} ${col.data_type}`
            if (col.is_primary_key) def += ' PRIMARY KEY'
            if (col.is_auto_increment) def += ' AUTOINCREMENT'
            if (!col.nullable) def += ' NOT NULL'
            if (col.default_value !== undefined) def += ` DEFAULT ${col.default_value}`
            if (col.is_unique && !col.is_primary_key) def += ' UNIQUE'
            if (col.is_foreign_key && col.foreign_key) {
                def += ` REFERENCES ${quoteTableName(col.foreign_key.ref_table)}(${quoteTableName(col.foreign_key.ref_column)})`
            }
            return def
        })

        const sql = `CREATE TABLE ${safeTableName} (${columns.join(', ')})`
        return { sql, warnings: [] }
    }

    async previewAlterTable(
        connectionId: string,
        tableName: string,
        changes: TableChange[]
    ): Promise<PreviewDDLResult> {
        const safeTableName = quoteTableName(tableName)
        const statements: string[] = []
        const warnings: string[] = []

        for (const change of changes) {
            switch (change.type) {
                case 'add_column':
                    statements.push(`ALTER TABLE ${safeTableName} ADD COLUMN ${quoteTableName(change.column.name)} ${change.column.data_type}`)
                    break
                case 'drop_column':
                    warnings.push('SQLite does not support DROP COLUMN directly; table recreation needed')
                    break
                case 'rename_column':
                    statements.push(`ALTER TABLE ${safeTableName} RENAME COLUMN ${quoteTableName(change.old_name)} TO ${quoteTableName(change.new_name)}`)
                    break
                case 'alter_column':
                    warnings.push('SQLite has limited ALTER COLUMN support; table recreation may be needed')
                    break
            }
        }
        return { sql: statements.join(';\n'), warnings }
    }

    async previewDropTable(tableName: string): Promise<PreviewDDLResult> {
        const safeTableName = quoteTableName(tableName)
        return { 
            sql: `DROP TABLE ${safeTableName}`, 
            warnings: ['This will permanently delete the table and all its data'] 
        }
    }

    async createTable(connectionId: string, table: DesignerTable): Promise<DDLExecutionResult> {
        const preview = await this.previewCreateTable(table)
        const startTime = Date.now()
        await this.executeQuery(connectionId, preview.sql)
        return { 
            success: true, 
            sql: preview.sql, 
            execution_time_ms: Date.now() - startTime 
        }
    }

    async alterTable(
        connectionId: string,
        tableName: string,
        changes: TableChange[]
    ): Promise<DDLExecutionResult> {
        const preview = await this.previewAlterTable(connectionId, tableName, changes)
        const startTime = Date.now()
        for (const sql of preview.sql.split(';').filter(s => s.trim())) {
            if (!sql.trim().startsWith('--')) {
                await this.executeQuery(connectionId, sql)
            }
        }
        return { 
            success: true, 
            sql: preview.sql, 
            execution_time_ms: Date.now() - startTime 
        }
    }

    async dropTable(connectionId: string, tableName: string): Promise<DDLExecutionResult> {
        const preview = await this.previewDropTable(tableName)
        const startTime = Date.now()
        await this.executeQuery(connectionId, preview.sql)
        return { 
            success: true, 
            sql: preview.sql, 
            execution_time_ms: Date.now() - startTime 
        }
    }

    async executeSqlFile(connectionId: string, filePath: string): Promise<SqlFileExecutionResult> {
        if (!fs.existsSync(filePath)) {
            throw new NotFoundError(`File not found: ${filePath}`)
        }

        const content = fs.readFileSync(filePath, 'utf-8')
        // 简单的 SQL 分割，可能需要更复杂的解析器来处理多行字符串等
        const statements = content
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'))

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
                    sql: sql.slice(0, 200),
                    success: true,
                    duration_ms: Date.now() - stmtStart,
                })
            } catch (error) {
                errorCount++
                results.push({
                    index: i,
                    sql: sql.slice(0, 200),
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

    dispose(): void {
        for (const [id, conn] of this.connections.entries()) {
            try {
                conn.db.close()
            } catch (error) {
                console.error(`Error closing connection ${id}:`, error)
            }
        }
        this.connections.clear()
    }
}
