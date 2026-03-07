import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useQueryStore } from './query'

// Mock the query service
vi.mock('@services/query', () => ({
    queryService: {
        executeQuery: vi.fn(),
        executeQueryStream: vi.fn(),
        fetchStreamBatch: vi.fn(),
        cancelQuery: vi.fn(),
    },
}))

describe('Query Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    // Helper to setup store with a connection
    function setupStoreWithConnection() {
        const store = useQueryStore()
        store.setCurrentConnection('test-connection-id')
        return store
    }

    it('should initialize with default state', () => {
        const store = setupStoreWithConnection()

        expect(store.tabs).toHaveLength(1)
        expect(store.activeTabId).not.toBeNull()
        expect(store.activeTab).toBeDefined()
    })

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

    it('should remove a tab', () => {
        const store = setupStoreWithConnection()
        store.addTab()
        const initialTabCount = store.tabs.length
        const tabToRemove = store.tabs[0].id

        store.removeTab(tabToRemove)

        expect(store.tabs).toHaveLength(initialTabCount - 1)
        expect(store.tabs.find(t => t.id === tabToRemove)).toBeUndefined()
    })

    it('should set active tab', () => {
        const store = setupStoreWithConnection()
        store.addTab()
        const newTab = store.tabs[store.tabs.length - 1]

        store.setActiveTab(newTab.id)

        expect(store.activeTabId).toBe(newTab.id)
    })

    it('should update tab SQL', () => {
        const store = setupStoreWithConnection()
        const tab = store.tabs[0]
        const newSql = 'SELECT * FROM orders'

        store.updateTabSql(tab.id, newSql)

        expect(tab.sql).toBe(newSql)
    })

    it('should update tab name', () => {
        const store = setupStoreWithConnection()
        const tab = store.tabs[0]
        const newName = 'Custom Query'

        store.updateTabName(tab.id, newName)

        expect(tab.name).toBe(newName)
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
})
