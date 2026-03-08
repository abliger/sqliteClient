import { safeInvoke, isTauri } from '@utils/tauri'
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

export class TauriNotAvailableError extends Error {
    constructor(operation: string) {
        super(`${operation} is only available in the desktop app`)
        this.name = 'TauriNotAvailableError'
    }
}

export const crudService = {
    async getTableData(options: GetTableDataOptions): Promise<QueryResult> {
        if (!isTauri()) throw new TauriNotAvailableError('getTableData')
        return safeInvoke('get_table_data', {
            connectionId: options.connectionId,
            tableName: options.tableName,
            limit: options.limit,
            offset: options.offset,
            orderBy: options.orderBy,
            orderDir: options.orderDir,
        }) as Promise<QueryResult>
    },

    async insertRow(options: InsertRowOptions): Promise<QueryResult> {
        if (!isTauri()) throw new TauriNotAvailableError('insertRow')
        return safeInvoke('insert_row', {
            connectionId: options.connectionId,
            tableName: options.tableName,
            data: options.data,
        }) as Promise<QueryResult>
    },

    async updateRow(options: UpdateRowOptions): Promise<QueryResult> {
        if (!isTauri()) throw new TauriNotAvailableError('updateRow')
        return safeInvoke('update_row', {
            connectionId: options.connectionId,
            tableName: options.tableName,
            data: options.data,
            conditions: options.conditions,
        }) as Promise<QueryResult>
    },

    async deleteRow(options: DeleteRowOptions): Promise<QueryResult> {
        if (!isTauri()) throw new TauriNotAvailableError('deleteRow')
        return safeInvoke('delete_row', {
            connectionId: options.connectionId,
            tableName: options.tableName,
            conditions: options.conditions,
        }) as Promise<QueryResult>
    },
}
