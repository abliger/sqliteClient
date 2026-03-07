import { invoke } from '@tauri-apps/api/core'
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
    return invoke('add_crud_log', { log })
}

/**
 * 查询 CRUD 操作日志
 */
export async function queryCrudLogs(
    filter: CrudLogFilter,
    limit: number = 100,
): Promise<CrudOperationLog[]> {
    return invoke('query_crud_logs', { filter, limit })
}

/**
 * 获取指定 Tab 的日志数量
 */
export async function countCrudLogsByTab(tabId: string): Promise<number> {
    return invoke('count_crud_logs_by_tab', { tabId })
}

/**
 * 删除指定 Tab 的日志
 */
export async function deleteCrudLogsByTab(tabId: string): Promise<number> {
    return invoke('delete_crud_logs_by_tab', { tabId })
}

/**
 * 获取所有表名（用于筛选）
 */
export async function getCrudLogTableNames(): Promise<string[]> {
    return invoke('get_crud_log_table_names')
}

/**
 * 获取 CRUD 日志统计
 */
export async function getCrudLogStats(connectionId?: string): Promise<CrudLogStats> {
    return invoke('get_crud_log_stats', { connectionId })
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
