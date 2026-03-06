import { invoke } from '@tauri-apps/api/core'
import type { DatabaseSchema, ERDiagram, IndexInfo, TableInfo, TriggerInfo } from '@types/index'

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
  }
}
