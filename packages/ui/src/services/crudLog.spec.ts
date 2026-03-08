import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as crudLogService from './crudLog'
import type { CrudOperationLog, CrudOperationType } from '@types'

// Mock the tauri utils
vi.mock('@utils/tauri', () => ({
    isTauri: vi.fn(),
    isVSCode: vi.fn(),
    safeInvoke: vi.fn(),
}))

// Mock vscode-bridge
vi.mock('./vscode-bridge', () => ({
    postVSCodeMessage: vi.fn(),
}))

describe('crudLogService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Tauri environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(true)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        describe('addCrudLog', () => {
            it('should add a CRUD log', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(undefined)

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

                expect(safeInvoke).toHaveBeenCalledWith('add_crud_log', { log })
            })
        })

        describe('queryCrudLogs', () => {
            it('should query logs with default limit', async () => {
                const { safeInvoke } = await import('@utils/tauri')
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
                vi.mocked(safeInvoke).mockResolvedValue(mockLogs)

                const result = await crudLogService.queryCrudLogs({})

                expect(safeInvoke).toHaveBeenCalledWith('query_crud_logs', { filter: {}, limit: 100 })
                expect(result).toEqual(mockLogs)
            })

            it('should query logs with custom limit', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockLogs: CrudOperationLog[] = []
                vi.mocked(safeInvoke).mockResolvedValue(mockLogs)

                await crudLogService.queryCrudLogs({ connection_id: 'conn-1' }, 50)

                expect(safeInvoke).toHaveBeenCalledWith('query_crud_logs', {
                    filter: { connection_id: 'conn-1' },
                    limit: 50,
                })
            })

            it('should query logs with filters', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockLogs: CrudOperationLog[] = []
                vi.mocked(safeInvoke).mockResolvedValue(mockLogs)

                await crudLogService.queryCrudLogs({
                    connection_id: 'conn-1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'UPDATE',
                    start_time: '2024-01-01',
                    end_time: '2024-12-31',
                })

                expect(safeInvoke).toHaveBeenCalledWith('query_crud_logs', {
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
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(5)

                const result = await crudLogService.countCrudLogsByTab('tab-1')

                expect(safeInvoke).toHaveBeenCalledWith('count_crud_logs_by_tab', { tabId: 'tab-1' })
                expect(result).toBe(5)
            })

            it('should return 0 for empty tab', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(0)

                const result = await crudLogService.countCrudLogsByTab('tab-empty')

                expect(result).toBe(0)
            })
        })

        describe('deleteCrudLogsByTab', () => {
            it('should delete logs by tab and return count', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(3)

                const result = await crudLogService.deleteCrudLogsByTab('tab-1')

                expect(safeInvoke).toHaveBeenCalledWith('delete_crud_logs_by_tab', { tabId: 'tab-1' })
                expect(result).toBe(3)
            })
        })

        describe('getCrudLogTableNames', () => {
            it('should return list of table names', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockTables = ['users', 'products', 'orders']
                vi.mocked(safeInvoke).mockResolvedValue(mockTables)

                const result = await crudLogService.getCrudLogTableNames()

                expect(safeInvoke).toHaveBeenCalledWith('get_crud_log_table_names')
                expect(result).toEqual(mockTables)
            })

            it('should return empty array when no tables', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue([])

                const result = await crudLogService.getCrudLogTableNames()

                expect(result).toEqual([])
            })
        })

        describe('getCrudLogStats', () => {
            it('should return stats for all connections', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockStats: crudLogService.CrudLogStats = {
                    total: 100,
                    success: 95,
                    failed: 5,
                    inserts: 40,
                    updates: 35,
                    deletes: 25,
                }
                vi.mocked(safeInvoke).mockResolvedValue(mockStats)

                const result = await crudLogService.getCrudLogStats()

                expect(safeInvoke).toHaveBeenCalledWith('get_crud_log_stats', {
                    connectionId: undefined,
                })
                expect(result).toEqual(mockStats)
            })

            it('should return stats for specific connection', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockStats: crudLogService.CrudLogStats = {
                    total: 50,
                    success: 50,
                    failed: 0,
                    inserts: 20,
                    updates: 20,
                    deletes: 10,
                }
                vi.mocked(safeInvoke).mockResolvedValue(mockStats)

                const result = await crudLogService.getCrudLogStats('conn-1')

                expect(safeInvoke).toHaveBeenCalledWith('get_crud_log_stats', {
                    connectionId: 'conn-1',
                })
                expect(result).toEqual(mockStats)
            })
        })

        describe('error handling', () => {
            it('should propagate errors from invoke', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const error = new Error('Database error')
                vi.mocked(safeInvoke).mockRejectedValue(error)

                await expect(crudLogService.queryCrudLogs({})).rejects.toThrow('Database error')
            })
        })
    })

    describe('VS Code environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(true)
        })

        it('should use VS Code bridge for addCrudLog', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            vi.mocked(postVSCodeMessage).mockResolvedValue(undefined)

            const log: CrudOperationLog = {
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
            }

            await crudLogService.addCrudLog(log)

            expect(postVSCodeMessage).toHaveBeenCalledWith('add_crud_log', { log })
        })

        it('should use VS Code bridge for queryCrudLogs', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            const mockLogs: CrudOperationLog[] = []
            vi.mocked(postVSCodeMessage).mockResolvedValue(mockLogs)

            await crudLogService.queryCrudLogs({ connection_id: 'conn-1' }, 50)

            expect(postVSCodeMessage).toHaveBeenCalledWith('query_crud_logs', {
                filter: { connection_id: 'conn-1' },
                limit: 50,
            })
        })

        it('should use VS Code bridge for getCrudLogStats', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            const mockStats: crudLogService.CrudLogStats = {
                total: 100,
                success: 95,
                failed: 5,
                inserts: 40,
                updates: 35,
                deletes: 25,
            }
            vi.mocked(postVSCodeMessage).mockResolvedValue(mockStats)

            const result = await crudLogService.getCrudLogStats('conn-1')

            expect(postVSCodeMessage).toHaveBeenCalledWith('get_crud_log_stats', {
                connectionId: 'conn-1',
            })
            expect(result).toEqual(mockStats)
        })
    })

    describe('Browser environment (no Tauri/VSCode)', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        it('should return empty array for queryCrudLogs', async () => {
            const result = await crudLogService.queryCrudLogs({})
            expect(result).toEqual([])
        })

        it('should return 0 for countCrudLogsByTab', async () => {
            const result = await crudLogService.countCrudLogsByTab('tab-1')
            expect(result).toBe(0)
        })

        it('should return 0 for deleteCrudLogsByTab', async () => {
            const result = await crudLogService.deleteCrudLogsByTab('tab-1')
            expect(result).toBe(0)
        })

        it('should return empty array for getCrudLogTableNames', async () => {
            const result = await crudLogService.getCrudLogTableNames()
            expect(result).toEqual([])
        })

        it('should return default stats for getCrudLogStats', async () => {
            const result = await crudLogService.getCrudLogStats()
            expect(result).toEqual({
                total: 0,
                success: 0,
                failed: 0,
                inserts: 0,
                updates: 0,
                deletes: 0,
            })
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
})
