import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as crudLogService from './crudLog'
import * as tauriApi from '@tauri-apps/api/core'
import type { CrudOperationLog, CrudOperationType } from '@types'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}))

describe('crudLogService', () => {
    const mockInvoke = vi.mocked(tauriApi.invoke)

    beforeEach(() => {
        mockInvoke.mockClear()
    })

    describe('addCrudLog', () => {
        it('should add a CRUD log', async () => {
            mockInvoke.mockResolvedValue(undefined)

            const log: CrudOperationLog = {
                id: 'log-1',
                connection_id: 'conn-1',
                tab_id: 'tab-1',
                table_name: 'users',
                operation_type: 'INSERT' as CrudOperationType,
                sql: "INSERT INTO users (name) VALUES ('John')",
                row_data: { name: 'John' },
                old_data: undefined,
                rows_affected: 1,
                executed_at: new Date().toISOString(),
                duration_ms: 10,
                is_success: true,
                error_message: undefined,
            }

            await crudLogService.addCrudLog(log)

            expect(mockInvoke).toHaveBeenCalledWith('add_crud_log', { log })
        })
    })

    describe('queryCrudLogs', () => {
        it('should query logs with default limit', async () => {
            const mockLogs: CrudOperationLog[] = [
                {
                    id: 'log-1',
                    connection_id: 'conn-1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                    sql: 'INSERT INTO users VALUES (1)',
                    rows_affected: 1,
                    executed_at: new Date().toISOString(),
                    duration_ms: 10,
                    is_success: true,
                },
            ]
            mockInvoke.mockResolvedValue(mockLogs)

            const result = await crudLogService.queryCrudLogs({})

            expect(mockInvoke).toHaveBeenCalledWith('query_crud_logs', { filter: {}, limit: 100 })
            expect(result).toEqual(mockLogs)
        })

        it('should query logs with custom limit', async () => {
            const mockLogs: CrudOperationLog[] = []
            mockInvoke.mockResolvedValue(mockLogs)

            await crudLogService.queryCrudLogs({ connection_id: 'conn-1' }, 50)

            expect(mockInvoke).toHaveBeenCalledWith('query_crud_logs', {
                filter: { connection_id: 'conn-1' },
                limit: 50,
            })
        })

        it('should query logs with filters', async () => {
            const mockLogs: CrudOperationLog[] = []
            mockInvoke.mockResolvedValue(mockLogs)

            await crudLogService.queryCrudLogs({
                connection_id: 'conn-1',
                tab_id: 'tab-1',
                table_name: 'users',
                operation_type: 'UPDATE',
                start_time: '2024-01-01',
                end_time: '2024-12-31',
            })

            expect(mockInvoke).toHaveBeenCalledWith('query_crud_logs', {
                filter: {
                    connection_id: 'conn-1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'UPDATE',
                    start_time: '2024-01-01',
                    end_time: '2024-12-31',
                },
                limit: 100,
            })
        })
    })

    describe('countCrudLogsByTab', () => {
        it('should return count for a tab', async () => {
            mockInvoke.mockResolvedValue(5)

            const result = await crudLogService.countCrudLogsByTab('tab-1')

            expect(mockInvoke).toHaveBeenCalledWith('count_crud_logs_by_tab', { tabId: 'tab-1' })
            expect(result).toBe(5)
        })

        it('should return 0 for empty tab', async () => {
            mockInvoke.mockResolvedValue(0)

            const result = await crudLogService.countCrudLogsByTab('tab-empty')

            expect(result).toBe(0)
        })
    })

    describe('deleteCrudLogsByTab', () => {
        it('should delete logs by tab and return count', async () => {
            mockInvoke.mockResolvedValue(3)

            const result = await crudLogService.deleteCrudLogsByTab('tab-1')

            expect(mockInvoke).toHaveBeenCalledWith('delete_crud_logs_by_tab', { tabId: 'tab-1' })
            expect(result).toBe(3)
        })
    })

    describe('getCrudLogTableNames', () => {
        it('should return list of table names', async () => {
            const mockTables = ['users', 'products', 'orders']
            mockInvoke.mockResolvedValue(mockTables)

            const result = await crudLogService.getCrudLogTableNames()

            expect(mockInvoke).toHaveBeenCalledWith('get_crud_log_table_names')
            expect(result).toEqual(mockTables)
        })

        it('should return empty array when no tables', async () => {
            mockInvoke.mockResolvedValue([])

            const result = await crudLogService.getCrudLogTableNames()

            expect(result).toEqual([])
        })
    })

    describe('getCrudLogStats', () => {
        it('should return stats for all connections', async () => {
            const mockStats: crudLogService.CrudLogStats = {
                total: 100,
                success: 95,
                failed: 5,
                inserts: 40,
                updates: 35,
                deletes: 25,
            }
            mockInvoke.mockResolvedValue(mockStats)

            const result = await crudLogService.getCrudLogStats()

            expect(mockInvoke).toHaveBeenCalledWith('get_crud_log_stats', {
                connectionId: undefined,
            })
            expect(result).toEqual(mockStats)
        })

        it('should return stats for specific connection', async () => {
            const mockStats: crudLogService.CrudLogStats = {
                total: 50,
                success: 50,
                failed: 0,
                inserts: 20,
                updates: 20,
                deletes: 10,
            }
            mockInvoke.mockResolvedValue(mockStats)

            const result = await crudLogService.getCrudLogStats('conn-1')

            expect(mockInvoke).toHaveBeenCalledWith('get_crud_log_stats', {
                connectionId: 'conn-1',
            })
            expect(result).toEqual(mockStats)
        })
    })

    describe('createCrudLog', () => {
        it('should create a log object with all required fields', () => {
            const log = crudLogService.createCrudLog(
                'conn-1',
                'tab-1',
                'users',
                'INSERT',
                "INSERT INTO users (name) VALUES ('John')",
            )

            expect(log.id).toBeDefined()
            expect(log.connection_id).toBe('conn-1')
            expect(log.tab_id).toBe('tab-1')
            expect(log.table_name).toBe('users')
            expect(log.operation_type).toBe('INSERT')
            expect(log.sql).toBe("INSERT INTO users (name) VALUES ('John')")
            expect(log.rows_affected).toBe(0)
            expect(log.is_success).toBe(true)
            expect(log.executed_at).toBeDefined()
            expect(log.row_data).toBeUndefined()
            expect(log.old_data).toBeUndefined()
            expect(log.error_message).toBeUndefined()
        })

        it('should generate unique IDs for different logs', () => {
            const log1 = crudLogService.createCrudLog('conn-1', 'tab-1', 'users', 'INSERT', 'SQL1')
            const log2 = crudLogService.createCrudLog('conn-1', 'tab-1', 'users', 'INSERT', 'SQL2')

            expect(log1.id).not.toBe(log2.id)
        })

        it('should set current timestamp', () => {
            const before = Date.now()
            const log = crudLogService.createCrudLog('conn-1', 'tab-1', 'users', 'UPDATE', 'SQL')
            const after = Date.now()

            const executedTime = new Date(log.executed_at).getTime()
            expect(executedTime).toBeGreaterThanOrEqual(before)
            expect(executedTime).toBeLessThanOrEqual(after)
        })
    })

    describe('error handling', () => {
        it('should propagate errors from invoke', async () => {
            const error = new Error('Database error')
            mockInvoke.mockRejectedValue(error)

            await expect(crudLogService.queryCrudLogs({})).rejects.toThrow('Database error')
        })
    })
})
