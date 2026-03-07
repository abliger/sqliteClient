import { invoke } from '@tauri-apps/api/core'
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

export const schemaService = {
    async listTables(connectionId: string): Promise<TableInfo[]> {
        return invoke('list_tables', { connectionId })
    },

    async getTableSchema(connectionId: string, tableName: string): Promise<TableInfo> {
        return invoke('get_table_schema', { connectionId, tableName })
    },

    async getDatabaseSchema(connectionId: string): Promise<DatabaseSchema> {
        return invoke('get_database_schema', { connectionId })
    },

    async getERDiagramData(connectionId: string): Promise<ERDiagram> {
        return invoke('get_er_diagram_data', { connectionId })
    },

    async listIndexes(connectionId: string): Promise<IndexInfo[]> {
        return invoke('list_indexes', { connectionId })
    },

    async listTriggers(connectionId: string): Promise<TriggerInfo[]> {
        return invoke('list_triggers', { connectionId })
    },

    // ============================================
    // DDL 操作
    // ============================================

    /**
     * 预览创建表的DDL
     */
    async previewCreateTable(table: DesignerTable): Promise<PreviewDDLResult> {
        return invoke('preview_create_table', { table })
    },

    /**
     * 预览修改表的DDL
     */
    async previewAlterTable(
        connectionId: string,
        tableName: string,
        changes: TableChange[],
    ): Promise<PreviewDDLResult> {
        return invoke('preview_alter_table', { connectionId, tableName, changes })
    },

    /**
     * 预览删除表的DDL
     */
    async previewDropTable(tableName: string): Promise<PreviewDDLResult> {
        return invoke('preview_drop_table', { tableName })
    },

    /**
     * 创建表
     */
    async createTable(connectionId: string, table: DesignerTable): Promise<DDLExecutionResult> {
        return invoke('create_table', { connectionId, table })
    },

    /**
     * 修改表
     */
    async alterTable(
        connectionId: string,
        tableName: string,
        changes: TableChange[],
    ): Promise<DDLExecutionResult> {
        return invoke('alter_table', { connectionId, tableName, changes })
    },

    /**
     * 删除表
     */
    async dropTable(connectionId: string, tableName: string): Promise<DDLExecutionResult> {
        return invoke('drop_table', { connectionId, tableName })
    },

    /**
     * 获取SQLite数据类型列表
     */
    async getDataTypes(): Promise<string[]> {
        return invoke('get_sqlite_data_types')
    },

    /**
     * 获取外键动作选项
     */
    async getForeignKeyActions(): Promise<string[]> {
        return invoke('get_foreign_key_actions')
    },
}
