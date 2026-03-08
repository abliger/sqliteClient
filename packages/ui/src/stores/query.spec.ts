import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useQueryStore } from './query'
import { queryService } from '@services/query'

// Mock the query service
vi.mock('@services/query', () => ({
    queryService: {
        executeQuery: vi.fn(),
        executeQueryStream: vi.fn(),
        fetchStreamBatch: vi.fn(),
        cancelQuery: vi.fn(),
    },
}))

// Mock uuid - use a counter to generate unique IDs
let uuidCounter = 0
vi.mock('uuid', () => ({
    v4: vi.fn(() => `test-uuid-${++uuidCounter}`),
}))

// Reset counter before each test
beforeEach(() => {
    uuidCounter = 0
})

describe('Query Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        localStorage.clear()
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // Helper to setup store with a connection
    function setupStoreWithConnection() {
        const store = useQueryStore()
        store.setCurrentConnection('test-connection-id')
        return store
    }

    describe('initialization', () => {
        it('should initialize with default state', () => {
            const store = setupStoreWithConnection()

            expect(store.tabs).toHaveLength(1)
            expect(store.activeTabId).not.toBeNull()
            expect(store.activeTab).toBeDefined()
        })

        it('should return empty tabs when no connection', () => {
            const store = useQueryStore()
            expect(store.tabs).toEqual([])
            expect(store.activeTabId).toBe('')
        })
    })

    describe('tab management', () => {
        it('should add a new tab', () => {
            const store = setupStoreWithConnection()
            const initialTabCount = store.tabs.length

            store.addTab()

            expect(store.tabs).toHaveLength(initialTabCount + 1)
        })

        it('should add a new tab with SQL', () => {
            const store = setupStoreWithConnection()
            const sql = 'SELECT * FROM users'

            store.addTab(sql)

            const newTab = store.tabs[store.tabs.length - 1]
            expect(newTab.sql).toBe(sql)
        })

        it('should not add tab without connection', () => {
            const store = useQueryStore()
            const result = store.addTab()
            expect(result).toBeUndefined()
        })

        it('should remove a tab', () => {
            const store = setupStoreWithConnection()
            store.addTab()
            const initialTabCount = store.tabs.length
            const tabToRemove = store.tabs[0].id

            store.removeTab(tabToRemove)

            expect(store.tabs).toHaveLength(initialTabCount - 1)
            expect(store.tabs.find(t => t.id === tabToRemove)).toBeUndefined()
        })

        it('should not remove the last tab', () => {
            const store = setupStoreWithConnection()
            // Ensure only one tab exists
            while (store.tabs.length > 1) {
                store.removeTab(store.tabs[store.tabs.length - 1].id)
            }

            const lastTab = store.tabs[0]
            store.removeTab(lastTab.id)

            expect(store.tabs).toHaveLength(1)
        })

        it('should switch to adjacent tab when removing active tab', () => {
            const store = setupStoreWithConnection()
            const firstTab = store.tabs[0]
            store.addTab()
            store.addTab()
            const tabs = store.tabs
            const secondTab = tabs[1]
            store.setActiveTab(secondTab.id)

            store.removeTab(secondTab.id)

            // Should switch to an adjacent tab (either first or third)
            expect(store.activeTabId).not.toBe(secondTab.id)
            // Should still have an active tab
            expect(store.activeTabId).toBeTruthy()
        })

        it('should set active tab', () => {
            const store = setupStoreWithConnection()
            store.addTab()
            const newTab = store.tabs[store.tabs.length - 1]

            store.setActiveTab(newTab.id)

            expect(store.activeTabId).toBe(newTab.id)
        })

        it('should not set active tab without connection', () => {
            const store = useQueryStore()
            store.setActiveTab('some-id')
            // Should not throw
            expect(store.activeTabId).toBe('')
        })
    })

    describe('tab content updates', () => {
        it('should update tab SQL', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            const newSql = 'SELECT * FROM orders'

            store.updateTabSql(tab.id, newSql)

            expect(tab.sql).toBe(newSql)
        })

        it('should not update SQL without connection', () => {
            const store = useQueryStore()
            store.updateTabSql('some-id', 'SELECT 1')
            // Should not throw
            expect(store.tabs).toEqual([])
        })

        it('should update tab name', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            const newName = 'Custom Query'

            store.updateTabName(tab.id, newName)

            expect(tab.name).toBe(newName)
        })

        it('should not update name without connection', () => {
            const store = useQueryStore()
            store.updateTabName('some-id', 'New Name')
            // Should not throw
        })
    })

    describe('query execution', () => {
        it('should execute query successfully', async () => {
            const store = setupStoreWithConnection()
            const mockResult = {
                type: 'rows' as const,
                columns: ['id', 'name'],
                rows: [],
                has_more: false,
                execution_info: {
                    execution_time_ms: 100,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
            vi.mocked(queryService.executeQuery).mockResolvedValue(mockResult)

            const result = await store.executeQuery('conn-1', 'SELECT * FROM users')

            expect(queryService.executeQuery).toHaveBeenCalledWith({
                connectionId: 'conn-1',
                sql: 'SELECT * FROM users',
                limit: undefined,
            })
            expect(result).toEqual(mockResult)
            expect(store.activeTab?.result).toEqual(mockResult)
            expect(store.activeTab?.isExecuting).toBe(false)
        })

        it('should throw error when no active tab', async () => {
            const store = useQueryStore()
            // No connection, so no active tab

            await expect(store.executeQuery('conn-1', 'SELECT 1')).rejects.toThrow('No active tab')
        })

        it('should handle query error', async () => {
            const store = setupStoreWithConnection()
            vi.mocked(queryService.executeQuery).mockRejectedValue(new Error('Query failed'))

            await expect(store.executeQuery('conn-1', 'INVALID SQL')).rejects.toThrow('Query failed')
            expect(store.activeTab?.isExecuting).toBe(false)
        })

        it('should clear result', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            tab.result = { type: 'rows', columns: [], rows: [], has_more: false, execution_info: {} as any }
            tab.executionTime = 100

            store.clearResult(tab.id)

            expect(tab.result).toBeUndefined()
            expect(tab.executionTime).toBeUndefined()
        })

        it('should clear active tab result when no tabId provided', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            tab.result = { type: 'rows', columns: [], rows: [], has_more: false, execution_info: {} as any }
            store.setActiveTab(tab.id)

            store.clearResult()

            expect(tab.result).toBeUndefined()
        })
    })

    describe('editor state', () => {
        it('should save and get editor state', () => {
            const store = setupStoreWithConnection()
            const tabId = 'tab-1'
            const content = 'SELECT * FROM users'
            const cursorPosition = { line: 1, column: 5 }

            store.saveEditorState(tabId, content, cursorPosition)
            const state = store.getEditorState(tabId)

            expect(state).toEqual({ content, cursorPosition })
        })

        it('should return undefined for non-existent editor state', () => {
            const store = setupStoreWithConnection()
            const state = store.getEditorState('non-existent')
            expect(state).toBeUndefined()
        })
    })

    describe('getters', () => {
        it('should get tabs by connection', () => {
            const store = setupStoreWithConnection()
            store.addTab()

            const tabs = store.getTabsByConnection('test-connection-id')

            expect(tabs.length).toBeGreaterThan(0)
        })

        it('should return empty array for unknown connection', () => {
            const store = setupStoreWithConnection()
            const tabs = store.getTabsByConnection('unknown-id')
            expect(tabs).toEqual([])
        })

        it('should compute activeTabIndex correctly', () => {
            const store = setupStoreWithConnection()
            const firstTab = store.tabs[0]
            store.addTab()
            store.addTab()
            const tabs = store.tabs
            const thirdTab = tabs[2]
            store.setActiveTab(thirdTab.id)

            expect(store.activeTabIndex).toBe(2)
        })

        it('should return -1 for activeTabIndex when no active tab', () => {
            const store = useQueryStore()
            expect(store.activeTabIndex).toBe(-1)
        })

        it('should compute hasUnsavedChanges correctly', () => {
            const store = setupStoreWithConnection()
            expect(store.hasUnsavedChanges).toBe(false)

            store.tabs[0].sql = 'SELECT * FROM users'

            expect(store.hasUnsavedChanges).toBe(true)
        })
    })

    describe('connection management', () => {
        it('should set current connection and create default tab', () => {
            const store = useQueryStore()
            store.setCurrentConnection('new-connection')

            expect(store.currentConnectionId).toBe('new-connection')
            expect(store.tabs).toHaveLength(1)
        })

        it('should restore saved tabs when setting connection', () => {
            const store = useQueryStore()
            // First, create some tabs and persist them
            store.setCurrentConnection('conn-1')
            store.addTab('SELECT 1')
            store.persistConnectionTabs('conn-1')

            // Create a new store instance (simulating page reload)
            const store2 = useQueryStore()
            store2.setCurrentConnection('conn-1')

            // Should restore the saved tabs
            expect(store2.tabs.length).toBeGreaterThan(0)
        })

        it('should clear current connection when setting empty string', () => {
            const store = setupStoreWithConnection()
            store.setCurrentConnection('')

            expect(store.currentConnectionId).toBe('')
        })

        it('should remove connection tabs', () => {
            const store = setupStoreWithConnection()
            store.addTab()
            store.removeConnectionTabs('test-connection-id')

            expect(store.tabs).toEqual([])
        })

        it('should cleanup orphaned tabs', () => {
            const store = useQueryStore()
            store.setCurrentConnection('conn-1')
            store.addTab()
            store.setCurrentConnection('conn-2')
            store.addTab()

            store.cleanupOrphanedTabs(['conn-2'])

            expect(store.getTabsByConnection('conn-1')).toEqual([])
            expect(store.getTabsByConnection('conn-2').length).toBeGreaterThan(0)
        })
    })

    describe('snapshots', () => {
        it('should create snapshot for rows result', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            tab.sql = 'SELECT * FROM users'
            tab.result = {
                type: 'rows',
                columns: ['id', 'name'],
                rows: [],
                has_more: false,
                execution_info: {
                    execution_time_ms: 100,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
            tab.executionTime = 100
            store.setActiveTab(tab.id)

            const snapshot = store.createSnapshot('Test Snapshot')

            expect(snapshot).not.toBeNull()
            expect(snapshot?.name).toBe('Test Snapshot')
            expect(snapshot?.sql).toBe('SELECT * FROM users')
            expect(store.activeTabSnapshots).toHaveLength(1)
        })

        it('should not create snapshot without result', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            tab.result = undefined
            store.setActiveTab(tab.id)

            const snapshot = store.createSnapshot()

            expect(snapshot).toBeNull()
        })

        it('should not create snapshot for non-rows result', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            tab.result = {
                type: 'execution',
                rows_affected: 5,
                execution_info: {
                    execution_time_ms: 50,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
            store.setActiveTab(tab.id)

            const snapshot = store.createSnapshot()

            expect(snapshot).toBeNull()
        })

        it('should delete snapshot', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            tab.result = {
                type: 'rows',
                columns: [],
                rows: [],
                has_more: false,
                execution_info: {
                    execution_time_ms: 100,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
            store.setActiveTab(tab.id)
            const snapshot = store.createSnapshot('To Delete')

            const result = store.deleteSnapshot(snapshot!.id)

            expect(result).toBe(true)
            expect(store.activeTabSnapshots).toHaveLength(0)
        })

        it('should return false when deleting non-existent snapshot', () => {
            const store = setupStoreWithConnection()
            const result = store.deleteSnapshot('non-existent')
            expect(result).toBe(false)
        })

        it('should rename snapshot', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            tab.result = {
                type: 'rows',
                columns: [],
                rows: [],
                has_more: false,
                execution_info: {
                    execution_time_ms: 100,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
            store.setActiveTab(tab.id)
            const snapshot = store.createSnapshot('Old Name')

            const result = store.renameSnapshot(snapshot!.id, 'New Name')

            expect(result).toBe(true)
            expect(store.activeTabSnapshots[0].name).toBe('New Name')
        })

        it('should get snapshot by id', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            tab.result = {
                type: 'rows',
                columns: [],
                rows: [],
                has_more: false,
                execution_info: {
                    execution_time_ms: 100,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
            store.setActiveTab(tab.id)
            const snapshot = store.createSnapshot('Test')

            const retrieved = store.getSnapshot(snapshot!.id)

            expect(retrieved).toEqual(snapshot)
        })

        it('should return undefined for non-existent snapshot', () => {
            const store = setupStoreWithConnection()
            const retrieved = store.getSnapshot('non-existent')
            expect(retrieved).toBeUndefined()
        })
    })

    describe('compare settings', () => {
        it('should update compare settings', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            store.setActiveTab(tab.id)

            store.updateCompareSettings({ enabled: true, highlightDiff: false })

            expect(store.activeTabCompareSettings.enabled).toBe(true)
            expect(store.activeTabCompareSettings.highlightDiff).toBe(false)
        })

        it('should toggle compare mode', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            store.setActiveTab(tab.id)

            store.toggleCompareMode(true)

            expect(store.activeTabCompareSettings.enabled).toBe(true)
        })

        it('should toggle snapshot selection', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            tab.result = {
                type: 'rows',
                columns: [],
                rows: [],
                has_more: false,
                execution_info: {
                    execution_time_ms: 100,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
            store.setActiveTab(tab.id)
            const snapshot1 = store.createSnapshot('Snapshot 1')
            expect(snapshot1).not.toBeNull()
            const snapshot2 = store.createSnapshot('Snapshot 2')
            expect(snapshot2).not.toBeNull()

            store.toggleSnapshotSelection(snapshot1!.id)
            expect(store.activeTabCompareSettings.selectedSnapshotIds).toContain(snapshot1!.id)
            
            store.toggleSnapshotSelection(snapshot2!.id)
            expect(store.activeTabCompareSettings.selectedSnapshotIds).toContain(snapshot2!.id)
            expect(store.activeTabCompareSettings.enabled).toBe(true)
        })

        it('should limit snapshot selection to 2', () => {
            const store = setupStoreWithConnection()
            const tab = store.tabs[0]
            tab.result = {
                type: 'rows',
                columns: [],
                rows: [],
                has_more: false,
                execution_info: {
                    execution_time_ms: 100,
                    rows_returned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
            store.setActiveTab(tab.id)
            const snapshot1 = store.createSnapshot('Snapshot 1')
            const snapshot2 = store.createSnapshot('Snapshot 2')
            const snapshot3 = store.createSnapshot('Snapshot 3')
            
            expect(snapshot1).not.toBeNull()
            expect(snapshot2).not.toBeNull()
            expect(snapshot3).not.toBeNull()

            // Select first snapshot
            store.toggleSnapshotSelection(snapshot1!.id)
            expect(store.activeTabCompareSettings.selectedSnapshotIds).toHaveLength(1)
            
            // Select second snapshot
            store.toggleSnapshotSelection(snapshot2!.id)
            expect(store.activeTabCompareSettings.selectedSnapshotIds).toHaveLength(2)
            
            // Select third snapshot - should evict the first one
            store.toggleSnapshotSelection(snapshot3!.id)
            expect(store.activeTabCompareSettings.selectedSnapshotIds).toHaveLength(2)
            expect(store.activeTabCompareSettings.selectedSnapshotIds).not.toContain(snapshot1!.id)
            expect(store.activeTabCompareSettings.selectedSnapshotIds).toContain(snapshot2!.id)
            expect(store.activeTabCompareSettings.selectedSnapshotIds).toContain(snapshot3!.id)
        })
    })

    describe('persistence', () => {
        it('should persist tabs to localStorage', () => {
            const store = setupStoreWithConnection()
            store.addTab('SELECT 1')

            store.persistConnectionTabs('test-connection-id')

            const saved = localStorage.getItem('sqlite-client-query-tabs-v2')
            expect(saved).toBeTruthy()
            const parsed = JSON.parse(saved!)
            expect(parsed['test-connection-id']).toBeDefined()
        })

        it('should restore tabs from localStorage', () => {
            const savedData = {
                'test-connection-id': {
                    tabs: [
                        { id: 'restored-tab', name: 'Restored', sql: 'SELECT 1' },
                    ],
                    activeTabId: 'restored-tab',
                },
            }
            localStorage.setItem('sqlite-client-query-tabs-v2', JSON.stringify(savedData))

            const store = useQueryStore()
            store.setCurrentConnection('test-connection-id')

            const restored = store.restoreConnectionTabs('test-connection-id')
            expect(restored).toBe(true)
            expect(store.tabs.some(t => t.id === 'restored-tab')).toBe(true)
        })

        it('should return false when no saved tabs to restore', () => {
            const store = useQueryStore()
            const restored = store.restoreConnectionTabs('no-saved-tabs')
            expect(restored).toBe(false)
        })
    })
})
