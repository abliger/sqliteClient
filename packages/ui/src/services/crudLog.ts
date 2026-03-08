import { safeInvoke, isTauri } from '@utils/tauri'
import type { CrudOperationLog, CrudLogFilter, CrudOperationType } from '@types'

export interface CrudLogStats {
    total: number
    success: number
    failed: number
    inserts: number
    updates: number
    deletes: number
}

/**
 * 添加 CRUD 操作日志
 */
export async function addCrudLog(log: CrudOperationLog): Promise<void> {
    if (!isTauri()) return
    return safeInvoke('add_crud_log', { log }) as Promise<void>
}

/**
 * 查询 CRUD 操作日志
 */
export async function queryCrudLogs(
    filter: CrudLogFilter,
    limit: number = 100,
): Promise<CrudOperationLog[]> {
    if (!isTauri()) return []
    return safeInvoke('query_crud_logs', { filter, limit }) as Promise<CrudOperationLog[]>
}

/**
 * 获取指定 Tab 的日志数量
 */
export async function countCrudLogsByTab(tabId: string): Promise<number> {
    if (!isTauri()) return 0
    return safeInvoke('count_crud_logs_by_tab', { tabId }) as Promise<number>
}

/**
 * 删除指定 Tab 的日志
 */
export async function deleteCrudLogsByTab(tabId: string): Promise<number> {
    if (!isTauri()) return 0
    return safeInvoke('delete_crud_logs_by_tab', { tabId }) as Promise<number>
}

/**
 * 获取所有表名（用于筛选）
 */
export async function getCrudLogTableNames(): Promise<string[]> {
    if (!isTauri()) return []
    return safeInvoke('get_crud_log_table_names') as Promise<string[]>
}

/**
 * 获取 CRUD 日志统计
 */
export async function getCrudLogStats(connectionId?: string): Promise<CrudLogStats> {
    if (!isTauri()) {
        return { total: 0, success: 0, failed: 0, inserts: 0, updates: 0, deletes: 0 }
    }
    return safeInvoke('get_crud_log_stats', { connectionId }) as Promise<CrudLogStats>
}

/**
 * 创建日志对象（辅助函数）
 */
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
