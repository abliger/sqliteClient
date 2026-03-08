import { safeInvoke, isTauri, isVSCode } from '@utils/tauri'
import { postVSCodeMessage } from './vscode-bridge'
import type { CrudOperationLog, CrudLogFilter, CrudOperationType } from '@types'

export interface CrudLogStats {
    total: number
    success: number
    failed: number
    inserts: number
    updates: number
    deletes: number
}

export async function addCrudLog(log: CrudOperationLog): Promise<void> {
    if (isVSCode()) return postVSCodeMessage<void>('add_crud_log', { log })
    if (isTauri()) return safeInvoke('add_crud_log', { log }) as Promise<void>
}

export async function queryCrudLogs(
    filter: CrudLogFilter,
    limit: number = 100,
): Promise<CrudOperationLog[]> {
    if (isVSCode()) return postVSCodeMessage<CrudOperationLog[]>('query_crud_logs', { filter, limit })
    if (isTauri()) return safeInvoke('query_crud_logs', { filter, limit }) as Promise<CrudOperationLog[]>
    return []
}

export async function countCrudLogsByTab(tabId: string): Promise<number> {
    if (isVSCode()) return postVSCodeMessage<number>('count_crud_logs_by_tab', { tabId })
    if (isTauri()) return safeInvoke('count_crud_logs_by_tab', { tabId }) as Promise<number>
    return 0
}

export async function deleteCrudLogsByTab(tabId: string): Promise<number> {
    if (isVSCode()) return postVSCodeMessage<number>('delete_crud_logs_by_tab', { tabId })
    if (isTauri()) return safeInvoke('delete_crud_logs_by_tab', { tabId }) as Promise<number>
    return 0
}

export async function getCrudLogTableNames(): Promise<string[]> {
    if (isVSCode()) return postVSCodeMessage<string[]>('get_crud_log_table_names')
    if (isTauri()) return safeInvoke('get_crud_log_table_names') as Promise<string[]>
    return []
}

export async function getCrudLogStats(connectionId?: string): Promise<CrudLogStats> {
    if (isVSCode()) return postVSCodeMessage<CrudLogStats>('get_crud_log_stats', { connectionId })
    if (isTauri()) return safeInvoke('get_crud_log_stats', { connectionId }) as Promise<CrudLogStats>
    return { total: 0, success: 0, failed: 0, inserts: 0, updates: 0, deletes: 0 }
}

export function createCrudLog(
    connectionId: string,
    tabId: string,
    tableName: string,
    operationType: CrudOperationType,
    sql: string,
): CrudOperationLog {
    return {
        id: crypto.randomUUID(),
        connection_id: connectionId,
        tab_id: tabId,
        table_name: tableName,
        operation_type: operationType,
        sql,
        row_data: undefined,
        old_data: undefined,
        rows_affected: 0,
        executed_at: new Date().toISOString(),
        duration_ms: 0,
        is_success: true,
        error_message: undefined,
    }
}
