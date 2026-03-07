import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSchemaStore } from './schema'

// Mock the schema service
vi.mock('@services/schema', () => ({
    schemaService: {
        listTables: vi.fn(),
        getTableSchema: vi.fn(),
        getDatabaseSchema: vi.fn(),
    },
}))

describe('Schema Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('should initialize with default state', () => {
        const store = useSchemaStore()

        expect(store.tables).toEqual([])
        expect(store.selectedTable).toBeNull()
        expect(store.expandedTables).toBeInstanceOf(Set)
        expect(store.expandedTables.size).toBe(0)
        expect(store.isLoading).toBe(false)
        expect(store.error).toBeNull()
    })

    it('should set selected table', () => {
        const store = useSchemaStore()

        store.setSelectedTable('users')
        expect(store.selectedTable).toBe('users')
    })

    it('should toggle table expansion', () => {
        const store = useSchemaStore()

        store.toggleTableExpanded('users')
        expect(store.expandedTables.has('users')).toBe(true)

        store.toggleTableExpanded('users')
        expect(store.expandedTables.has('users')).toBe(false)
    })

    it('should check if table is expanded', () => {
        const store = useSchemaStore()

        expect(store.isTableExpanded('users')).toBe(false)

        store.toggleTableExpanded('users')
        expect(store.isTableExpanded('users')).toBe(true)
    })

    it('should clear schema', () => {
        const store = useSchemaStore()
        store.tables = [{ name: 'users' }] as any
        store.selectedTable = 'users'
        store.expandedTables.add('users')

        store.clearSchema()

        expect(store.tables).toEqual([])
        expect(store.selectedTable).toBeNull()
        expect(store.expandedTables.size).toBe(0)
    })

    it('should compute sorted tables', () => {
        const store = useSchemaStore()
        store.tables = [{ name: 'orders' }, { name: 'users' }, { name: 'products' }] as any

        const sorted = store.sortedTables
        expect(sorted[0].name).toBe('orders')
        expect(sorted[1].name).toBe('products')
        expect(sorted[2].name).toBe('users')
    })
})
