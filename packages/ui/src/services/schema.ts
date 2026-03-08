import { safeInvoke, isTauri, isVSCode } from '@utils/tauri'
import { postVSCodeMessage } from './vscode-bridge'
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
        if (isVSCode()) return postVSCodeMessage<TableInfo[]>('list_tables', { connectionId })
        if (isTauri()) return safeInvoke('list_tables', { connectionId }) as Promise<TableInfo[]>
        return []
    },

    async getTableSchema(connectionId: string, tableName: string): Promise<TableInfo> {
        if (isVSCode()) return postVSCodeMessage<TableInfo>('get_table_schema', { connectionId, tableName })
        if (isTauri()) return safeInvoke('get_table_schema', { connectionId, tableName }) as Promise<TableInfo>
        throw new TauriNotAvailableError('getTableSchema')
    },

    async getDatabaseSchema(connectionId: string): Promise<DatabaseSchema> {
        if (isVSCode()) return postVSCodeMessage<DatabaseSchema>('get_database_schema', { connectionId })
        if (isTauri()) return safeInvoke('get_database_schema', { connectionId }) as Promise<DatabaseSchema>
        throw new TauriNotAvailableError('getDatabaseSchema')
    },

    async getERDiagramData(connectionId: string): Promise<ERDiagram> {
        if (isVSCode()) return postVSCodeMessage<ERDiagram>('get_er_diagram_data', { connectionId })
        if (isTauri()) return safeInvoke('get_er_diagram_data', { connectionId }) as Promise<ERDiagram>
        throw new TauriNotAvailableError('getERDiagramData')
    },

    async listIndexes(connectionId: string): Promise<IndexInfo[]> {
        if (isVSCode()) return postVSCodeMessage<IndexInfo[]>('list_indexes', { connectionId })
        if (isTauri()) return safeInvoke('list_indexes', { connectionId }) as Promise<IndexInfo[]>
        return []
    },

    async listTriggers(connectionId: string): Promise<TriggerInfo[]> {
        if (isVSCode()) return postVSCodeMessage<TriggerInfo[]>('list_triggers', { connectionId })
        if (isTauri()) return safeInvoke('list_triggers', { connectionId }) as Promise<TriggerInfo[]>
        return []
    },

    // ============================================
    // DDL 操作
    // ============================================

    async previewCreateTable(table: DesignerTable): Promise<PreviewDDLResult> {
        if (isVSCode()) return postVSCodeMessage<PreviewDDLResult>('preview_create_table', { table })
        if (isTauri()) return safeInvoke('preview_create_table', { table }) as Promise<PreviewDDLResult>
        throw new TauriNotAvailableError('previewCreateTable')
    },

    async previewAlterTable(
        connectionId: string,
        tableName: string,
        changes: TableChange[],
    ): Promise<PreviewDDLResult> {
        if (isVSCode()) return postVSCodeMessage<PreviewDDLResult>('preview_alter_table', { connectionId, tableName, changes })
        if (isTauri()) return safeInvoke('preview_alter_table', { connectionId, tableName, changes }) as Promise<PreviewDDLResult>
        throw new TauriNotAvailableError('previewAlterTable')
    },

    async previewDropTable(tableName: string): Promise<PreviewDDLResult> {
        if (isVSCode()) return postVSCodeMessage<PreviewDDLResult>('preview_drop_table', { tableName })
        if (isTauri()) return safeInvoke('preview_drop_table', { tableName }) as Promise<PreviewDDLResult>
        throw new TauriNotAvailableError('previewDropTable')
    },

    async createTable(connectionId: string, table: DesignerTable): Promise<DDLExecutionResult> {
        if (isVSCode()) return postVSCodeMessage<DDLExecutionResult>('create_table', { connectionId, table })
        if (isTauri()) return safeInvoke('create_table', { connectionId, table }) as Promise<DDLExecutionResult>
        throw new TauriNotAvailableError('createTable')
    },

    async alterTable(
        connectionId: string,
        tableName: string,
        changes: TableChange[],
    ): Promise<DDLExecutionResult> {
        if (isVSCode()) return postVSCodeMessage<DDLExecutionResult>('alter_table', { connectionId, tableName, changes })
        if (isTauri()) return safeInvoke('alter_table', { connectionId, tableName, changes }) as Promise<DDLExecutionResult>
        throw new TauriNotAvailableError('alterTable')
    },

    async dropTable(connectionId: string, tableName: string): Promise<DDLExecutionResult> {
        if (isVSCode()) return postVSCodeMessage<DDLExecutionResult>('drop_table', { connectionId, tableName })
        if (isTauri()) return safeInvoke('drop_table', { connectionId, tableName }) as Promise<DDLExecutionResult>
        throw new TauriNotAvailableError('dropTable')
    },

    async getDataTypes(): Promise<string[]> {
        if (isVSCode() || isTauri()) {
            // VS Code 暂时返回默认值，Tauri 可调用后端
            if (isTauri()) {
                try {
                    return safeInvoke('get_sqlite_data_types') as Promise<string[]>
                } catch {
                    // fallback to default
                }
            }
        }
        return ['INTEGER', 'REAL', 'TEXT', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATETIME', 'DATE', 'TIME', 'VARCHAR', 'CHAR', 'DECIMAL', 'FLOAT', 'DOUBLE', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT']
    },

    async getForeignKeyActions(): Promise<string[]> {
        if (isVSCode()) {
            return ['NO ACTION', 'RESTRICT', 'SET NULL', 'SET DEFAULT', 'CASCADE']
        }
        if (isTauri()) {
            try {
                return safeInvoke('get_foreign_key_actions') as Promise<string[]>
            } catch {
                // fallback to default
            }
        }
        return ['NO ACTION', 'RESTRICT', 'SET NULL', 'SET DEFAULT', 'CASCADE']
    },
}
