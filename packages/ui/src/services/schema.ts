import { safeInvoke, isTauri } from '@utils/tauri'
import type {
    DatabaseSchema,
    DesignerTable,
    DDLExecutionResult,
    ERDiagram,
    IndexInfo,
    PreviewDDLResult,
    TableChange,
    TableInfo,
    TriggerInfo,
} from '@types'

export class TauriNotAvailableError extends Error {
    constructor(operation: string) {
        super(`${operation} is only available in the desktop app`)
        this.name = 'TauriNotAvailableError'
    }
}

export const schemaService = {
    async listTables(connectionId: string): Promise<TableInfo[]> {
        if (!isTauri()) return []
        return safeInvoke('list_tables', { connectionId }) as Promise<TableInfo[]>
    },

    async getTableSchema(connectionId: string, tableName: string): Promise<TableInfo> {
        if (!isTauri()) throw new TauriNotAvailableError('getTableSchema')
        return safeInvoke('get_table_schema', { connectionId, tableName }) as Promise<TableInfo>
    },

    async getDatabaseSchema(connectionId: string): Promise<DatabaseSchema> {
        if (!isTauri()) throw new TauriNotAvailableError('getDatabaseSchema')
        return safeInvoke('get_database_schema', { connectionId }) as Promise<DatabaseSchema>
    },

    async getERDiagramData(connectionId: string): Promise<ERDiagram> {
        if (!isTauri()) throw new TauriNotAvailableError('getERDiagramData')
        return safeInvoke('get_er_diagram_data', { connectionId }) as Promise<ERDiagram>
    },

    async listIndexes(connectionId: string): Promise<IndexInfo[]> {
        if (!isTauri()) return []
        return safeInvoke('list_indexes', { connectionId }) as Promise<IndexInfo[]>
    },

    async listTriggers(connectionId: string): Promise<TriggerInfo[]> {
        if (!isTauri()) return []
        return safeInvoke('list_triggers', { connectionId }) as Promise<TriggerInfo[]>
    },

    // ============================================
    // DDL 操作
    // ============================================

    /**
     * 预览创建表的DDL
     */
    async previewCreateTable(table: DesignerTable): Promise<PreviewDDLResult> {
        if (!isTauri()) throw new TauriNotAvailableError('previewCreateTable')
        return safeInvoke('preview_create_table', { table }) as Promise<PreviewDDLResult>
    },

    /**
     * 预览修改表的DDL
     */
    async previewAlterTable(
        connectionId: string,
        tableName: string,
        changes: TableChange[],
    ): Promise<PreviewDDLResult> {
        if (!isTauri()) throw new TauriNotAvailableError('previewAlterTable')
        return safeInvoke('preview_alter_table', { connectionId, tableName, changes }) as Promise<PreviewDDLResult>
    },

    /**
     * 预览删除表的DDL
     */
    async previewDropTable(tableName: string): Promise<PreviewDDLResult> {
        if (!isTauri()) throw new TauriNotAvailableError('previewDropTable')
        return safeInvoke('preview_drop_table', { tableName }) as Promise<PreviewDDLResult>
    },

    /**
     * 创建表
     */
    async createTable(connectionId: string, table: DesignerTable): Promise<DDLExecutionResult> {
        if (!isTauri()) throw new TauriNotAvailableError('createTable')
        return safeInvoke('create_table', { connectionId, table }) as Promise<DDLExecutionResult>
    },

    /**
     * 修改表
     */
    async alterTable(
        connectionId: string,
        tableName: string,
        changes: TableChange[],
    ): Promise<DDLExecutionResult> {
        if (!isTauri()) throw new TauriNotAvailableError('alterTable')
        return safeInvoke('alter_table', { connectionId, tableName, changes }) as Promise<DDLExecutionResult>
    },

    /**
     * 删除表
     */
    async dropTable(connectionId: string, tableName: string): Promise<DDLExecutionResult> {
        if (!isTauri()) throw new TauriNotAvailableError('dropTable')
        return safeInvoke('drop_table', { connectionId, tableName }) as Promise<DDLExecutionResult>
    },

    /**
     * 获取SQLite数据类型列表
     */
    async getDataTypes(): Promise<string[]> {
        if (!isTauri()) {
            // 返回默认数据类型列表
            return ['INTEGER', 'REAL', 'TEXT', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATETIME', 'DATE', 'TIME', 'VARCHAR', 'CHAR', 'DECIMAL', 'FLOAT', 'DOUBLE', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT']
        }
        return safeInvoke('get_sqlite_data_types') as Promise<string[]>
    },

    /**
     * 获取外键动作选项
     */
    async getForeignKeyActions(): Promise<string[]> {
        if (!isTauri()) {
            return ['NO ACTION', 'RESTRICT', 'SET NULL', 'SET DEFAULT', 'CASCADE']
        }
        return safeInvoke('get_foreign_key_actions') as Promise<string[]>
    },
}
