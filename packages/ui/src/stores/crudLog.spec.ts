import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCrudLogStore } from './crudLog'
import * as crudLogService from '@services/crudLog'
import type { CrudOperationLog, CrudOperationType } from '@types'

// Mock the service
vi.mock('@services/crudLog', () => ({
    addCrudLog: vi.fn(),
    queryCrudLogs: vi.fn(),
    countCrudLogsByTab: vi.fn(),
    deleteCrudLogsByTab: vi.fn(),
    getCrudLogTableNames: vi.fn(),
    getCrudLogStats: vi.fn(),
}))

describe('CrudLog Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.clearAllMocks()
    })

    it('should initialize with default state', () => {
        const store = useCrudLogStore()

        expect(store.logs).toEqual([])
        expect(store.isLoading).toBe(false)
        expect(store.error).toBeNull()
        expect(store.selectedTabId).toBeNull()
        expect(store.tableNames).toEqual([])
        expect(store.stats).toBeNull()
    })

    describe('getters', () => {
        it('filteredLogs should return all logs when no tab selected', () => {
            const store = useCrudLogStore()
            const mockLogs: CrudOperationLog[] = [
                {
                    id: '1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                } as CrudOperationLog,
                {
                    id: '2',
                    tab_id: 'tab-2',
                    table_name: 'products',
                    operation_type: 'UPDATE',
                } as CrudOperationLog,
            ]
            store.logs = mockLogs

            expect(store.filteredLogs).toEqual(mockLogs)
        })

        it('filteredLogs should filter by selected tab', () => {
            const store = useCrudLogStore()
            const mockLogs: CrudOperationLog[] = [
                {
                    id: '1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                } as CrudOperationLog,
                {
                    id: '2',
                    tab_id: 'tab-2',
                    table_name: 'products',
                    operation_type: 'UPDATE',
                } as CrudOperationLog,
            ]
            store.logs = mockLogs
            store.selectedTabId = 'tab-1'

            expect(store.filteredLogs).toHaveLength(1)
            expect(store.filteredLogs[0].id).toBe('1')
        })

        it('logsByTab should group logs by tab_id', () => {
            const store = useCrudLogStore()
            const mockLogs: CrudOperationLog[] = [
                {
                    id: '1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                } as CrudOperationLog,
                {
                    id: '2',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'UPDATE',
                } as CrudOperationLog,
                {
                    id: '3',
                    tab_id: 'tab-2',
                    table_name: 'products',
                    operation_type: 'DELETE',
                } as CrudOperationLog,
            ]
            store.logs = mockLogs

            const grouped = store.logsByTab
            expect(grouped.get('tab-1')).toHaveLength(2)
            expect(grouped.get('tab-2')).toHaveLength(1)
        })

        it('operationTypeCounts should count operations correctly', () => {
            const store = useCrudLogStore()
            store.logs = [
                {
                    id: '1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                } as CrudOperationLog,
                {
                    id: '2',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                } as CrudOperationLog,
                {
                    id: '3',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'UPDATE',
                } as CrudOperationLog,
            ]

            const counts = store.operationTypeCounts
            expect(counts.INSERT).toBe(2)
            expect(counts.UPDATE).toBe(1)
            expect(counts.DELETE).toBe(0)
        })
    })

    describe('loadLogs', () => {
        it('should load logs successfully', async () => {
            const store = useCrudLogStore()
            const mockLogs: CrudOperationLog[] = [
                {
                    id: '1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                } as CrudOperationLog,
            ]
            vi.mocked(crudLogService.queryCrudLogs).mockResolvedValue(mockLogs)

            const result = await store.loadLogs('conn-1', 50)

            expect(crudLogService.queryCrudLogs).toHaveBeenCalledWith(
                { connection_id: 'conn-1' },
                50,
            )
            expect(store.logs).toEqual(mockLogs)
            expect(store.isLoading).toBe(false)
            expect(store.error).toBeNull()
            expect(result).toEqual(mockLogs)
        })

        it('should load all logs when no connection specified', async () => {
            const store = useCrudLogStore()
            vi.mocked(crudLogService.queryCrudLogs).mockResolvedValue([])

            await store.loadLogs()

            expect(crudLogService.queryCrudLogs).toHaveBeenCalledWith({}, 100)
        })

        it('should handle errors', async () => {
            const store = useCrudLogStore()
            vi.mocked(crudLogService.queryCrudLogs).mockRejectedValue(new Error('Database error'))

            const result = await store.loadLogs('conn-1')

            expect(store.error).toBe('Database error')
            expect(store.isLoading).toBe(false)
            expect(result).toEqual([])
        })
    })

    describe('loadLogsByTab', () => {
        it('should load logs for specific tab', async () => {
            const store = useCrudLogStore()
            const mockLogs: CrudOperationLog[] = [
                {
                    id: '1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                } as CrudOperationLog,
            ]
            vi.mocked(crudLogService.queryCrudLogs).mockResolvedValue(mockLogs)

            const result = await store.loadLogsByTab('tab-1', 50)

            expect(crudLogService.queryCrudLogs).toHaveBeenCalledWith({ tab_id: 'tab-1' }, 50)
            expect(store.logs).toEqual(mockLogs)
            expect(store.selectedTabId).toBe('tab-1')
            expect(result).toEqual(mockLogs)
        })
    })

    describe('addLog', () => {
        it('should add log and update local list', async () => {
            const store = useCrudLogStore()
            vi.mocked(crudLogService.addCrudLog).mockResolvedValue(undefined)

            const log: CrudOperationLog = {
                id: '1',
                tab_id: 'tab-1',
                table_name: 'users',
                operation_type: 'INSERT' as CrudOperationType,
            } as CrudOperationLog

            const result = await store.addLog(log)

            expect(crudLogService.addCrudLog).toHaveBeenCalledWith(log)
            // Check by id since object reference may differ due to reactivity
            expect(store.logs.some(l => l.id === log.id)).toBe(true)
            expect(result).toBe(true)
        })

        it('should not add to local list if tab filter is active and log is from different tab', async () => {
            const store = useCrudLogStore()
            store.selectedTabId = 'tab-1'
            store.logs = [
                {
                    id: '0',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                } as CrudOperationLog,
            ]
            vi.mocked(crudLogService.addCrudLog).mockResolvedValue(undefined)

            const log: CrudOperationLog = {
                id: '2',
                tab_id: 'tab-2',
                table_name: 'products',
                operation_type: 'UPDATE' as CrudOperationType,
            } as CrudOperationLog

            await store.addLog(log)

            expect(store.logs).toHaveLength(1)
            expect(store.logs[0].id).toBe('0')
        })

        it('should handle errors gracefully', async () => {
            const store = useCrudLogStore()
            vi.mocked(crudLogService.addCrudLog).mockRejectedValue(new Error('Failed'))

            const log: CrudOperationLog = {
                id: '1',
                tab_id: 'tab-1',
                table_name: 'users',
                operation_type: 'INSERT' as CrudOperationType,
            } as CrudOperationLog

            const result = await store.addLog(log)

            expect(result).toBe(false)
            expect(store.logs).toHaveLength(0)
        })
    })

    describe('deleteLogsByTab', () => {
        it('should delete logs by tab', async () => {
            const store = useCrudLogStore()
            store.logs = [
                {
                    id: '1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                } as CrudOperationLog,
                {
                    id: '2',
                    tab_id: 'tab-2',
                    table_name: 'products',
                    operation_type: 'UPDATE',
                } as CrudOperationLog,
            ]
            vi.mocked(crudLogService.deleteCrudLogsByTab).mockResolvedValue(1)

            const result = await store.deleteLogsByTab('tab-1')

            expect(crudLogService.deleteCrudLogsByTab).toHaveBeenCalledWith('tab-1')
            expect(store.logs).toHaveLength(1)
            expect(store.logs[0].tab_id).toBe('tab-2')
            expect(result).toBe(1)
        })

        it('should reset selectedTabId when deleting current tab logs', async () => {
            const store = useCrudLogStore()
            store.selectedTabId = 'tab-1'
            store.logs = [
                {
                    id: '1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                } as CrudOperationLog,
            ]
            vi.mocked(crudLogService.deleteCrudLogsByTab).mockResolvedValue(1)

            await store.deleteLogsByTab('tab-1')

            expect(store.selectedTabId).toBeNull()
        })

        it('should handle errors', async () => {
            const store = useCrudLogStore()
            vi.mocked(crudLogService.deleteCrudLogsByTab).mockRejectedValue(new Error('Failed'))

            const result = await store.deleteLogsByTab('tab-1')

            expect(result).toBe(0)
        })
    })

    describe('loadTableNames', () => {
        it('should load table names', async () => {
            const store = useCrudLogStore()
            const mockNames = ['users', 'products', 'orders']
            vi.mocked(crudLogService.getCrudLogTableNames).mockResolvedValue(mockNames)

            const result = await store.loadTableNames()

            expect(crudLogService.getCrudLogTableNames).toHaveBeenCalled()
            expect(store.tableNames).toEqual(mockNames)
            expect(result).toEqual(mockNames)
        })

        it('should handle errors', async () => {
            const store = useCrudLogStore()
            vi.mocked(crudLogService.getCrudLogTableNames).mockRejectedValue(new Error('Failed'))

            const result = await store.loadTableNames()

            expect(result).toEqual([])
            expect(store.tableNames).toEqual([])
        })
    })

    describe('loadStats', () => {
        it('should load stats for all connections', async () => {
            const store = useCrudLogStore()
            const mockStats = {
                total: 100,
                success: 95,
                failed: 5,
                inserts: 40,
                updates: 35,
                deletes: 25,
            }
            vi.mocked(crudLogService.getCrudLogStats).mockResolvedValue(mockStats)

            const result = await store.loadStats()

            expect(crudLogService.getCrudLogStats).toHaveBeenCalledWith(undefined)
            expect(store.stats).toEqual(mockStats)
            expect(result).toEqual(mockStats)
        })

        it('should load stats for specific connection', async () => {
            const store = useCrudLogStore()
            const mockStats = {
                total: 50,
                success: 50,
                failed: 0,
                inserts: 20,
                updates: 20,
                deletes: 10,
            }
            vi.mocked(crudLogService.getCrudLogStats).mockResolvedValue(mockStats)

            await store.loadStats('conn-1')

            expect(crudLogService.getCrudLogStats).toHaveBeenCalledWith('conn-1')
        })

        it('should handle errors', async () => {
            const store = useCrudLogStore()
            vi.mocked(crudLogService.getCrudLogStats).mockRejectedValue(new Error('Failed'))

            const result = await store.loadStats()

            expect(result).toBeNull()
            expect(store.stats).toBeNull()
        })
    })

    describe('setSelectedTab', () => {
        it('should set selected tab id', () => {
            const store = useCrudLogStore()

            store.setSelectedTab('tab-1')

            expect(store.selectedTabId).toBe('tab-1')
        })

        it('should clear selected tab when null', () => {
            const store = useCrudLogStore()
            store.selectedTabId = 'tab-1'

            store.setSelectedTab(null)

            expect(store.selectedTabId).toBeNull()
        })
    })

    describe('clearLogs', () => {
        it('should clear all state', () => {
            const store = useCrudLogStore()
            store.logs = [
                {
                    id: '1',
                    tab_id: 'tab-1',
                    table_name: 'users',
                    operation_type: 'INSERT',
                } as CrudOperationLog,
            ]
            store.selectedTabId = 'tab-1'
            store.stats = { total: 10, success: 10, failed: 0, inserts: 5, updates: 3, deletes: 2 }

            store.clearLogs()

            expect(store.logs).toEqual([])
            expect(store.selectedTabId).toBeNull()
            expect(store.stats).toBeNull()
        })
    })
})
