import { invoke } from '@tauri-apps/api/core'
import type { CellValue, QueryResult } from '@types'

export interface GetTableDataOptions {
  connectionId: string
  tableName: string
  limit?: number
  offset?: number
  orderBy?: string
  orderDir?: 'ASC' | 'DESC'
}

export interface InsertRowOptions {
  connectionId: string
  tableName: string
  data: Record<string, CellValue>
}

export interface UpdateRowOptions {
  connectionId: string
  tableName: string
  data: Record<string, CellValue>
  conditions: Record<string, CellValue>
}

export interface DeleteRowOptions {
  connectionId: string
  tableName: string
  conditions: Record<string, CellValue>
}

export const crudService = {
  async getTableData(options: GetTableDataOptions): Promise<QueryResult> {
    return invoke('get_table_data', {
      connectionId: options.connectionId,
      tableName: options.tableName,
      limit: options.limit,
      offset: options.offset,
      orderBy: options.orderBy,
      orderDir: options.orderDir
    })
  },

  async insertRow(options: InsertRowOptions): Promise<QueryResult> {
    return invoke('insert_row', {
      connectionId: options.connectionId,
      tableName: options.tableName,
      data: options.data
    })
  },

  async updateRow(options: UpdateRowOptions): Promise<QueryResult> {
    return invoke('update_row', {
      connectionId: options.connectionId,
      tableName: options.tableName,
      data: options.data,
      conditions: options.conditions
    })
  },

  async deleteRow(options: DeleteRowOptions): Promise<QueryResult> {
    return invoke('delete_row', {
      connectionId: options.connectionId,
      tableName: options.tableName,
      conditions: options.conditions
    })
  }
}
