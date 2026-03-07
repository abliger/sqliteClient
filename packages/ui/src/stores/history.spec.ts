import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHistoryStore } from './history'

// Mock the history service
vi.mock('@services/history', () => ({
    historyService: {
        getQueryHistory: vi.fn(),
        searchHistory: vi.fn(),
        deleteHistoryItem: vi.fn(),
        clearHistory: vi.fn(),
    },
}))

describe('History Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('should initialize with default state', () => {
        const store = useHistoryStore()

        expect(store.items).toEqual([])
        expect(store.isLoading).toBe(false)
        expect(store.error).toBeNull()
        expect(store.searchQuery).toBe('')
        expect(store.pageSize).toBe(50)
        expect(store.currentPage).toBe(1)
    })

    it('should set search query', () => {
        const store = useHistoryStore()

        store.searchQuery = 'SELECT'
        expect(store.searchQuery).toBe('SELECT')
    })

    it('should clear search query', () => {
        const store = useHistoryStore()
        store.searchQuery = 'SELECT'

        store.searchQuery = ''
        expect(store.searchQuery).toBe('')
    })

    it('should clear history items', async () => {
        const store = useHistoryStore()
        const { historyService } = await import('@services/history')
        vi.mocked(historyService.clearHistory).mockResolvedValue(0)

        store.items = [
            { id: '1', sql: 'SELECT 1' },
            { id: '2', sql: 'SELECT 2' },
        ] as any

        await store.clearHistory()

        expect(store.items).toEqual([])
    })

    it('should filter items based on search query', () => {
        const store = useHistoryStore()
        store.items = [
            { id: '1', sql: 'SELECT * FROM users', connection_name: 'DB1' },
            { id: '2', sql: 'INSERT INTO orders', connection_name: 'DB2' },
        ] as any

        store.searchQuery = 'SELECT'

        expect(store.filteredItems).toHaveLength(1)
        expect(store.filteredItems[0].sql).toContain('SELECT')
    })

    it('should paginate items', () => {
        const store = useHistoryStore()
        store.pageSize = 2
        store.items = [
            { id: '1', sql: 'SELECT 1' },
            { id: '2', sql: 'SELECT 2' },
            { id: '3', sql: 'SELECT 3' },
            { id: '4', sql: 'SELECT 4' },
        ] as any

        store.currentPage = 1
        expect(store.paginatedItems).toHaveLength(2)

        store.currentPage = 2
        expect(store.paginatedItems).toHaveLength(2)
    })

    it('should get recent queries', () => {
        const store = useHistoryStore()
        store.items = [
            { id: '1', sql: 'SELECT 1' },
            { id: '2', sql: 'SELECT 2' },
            { id: '3', sql: 'SELECT 3' },
        ] as any

        expect(store.recentQueries).toHaveLength(3)
    })

    it('should set page', () => {
        const store = useHistoryStore()
        store.items = Array(100).fill({ id: '1', sql: 'SELECT' }) as any

        store.setPage(2)
        expect(store.currentPage).toBe(2)
    })

    it('should set page size', () => {
        const store = useHistoryStore()
        store.currentPage = 5

        store.setPageSize(25)
        expect(store.pageSize).toBe(25)
        expect(store.currentPage).toBe(1) // Should reset to page 1
    })
})
