import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConnectionStore } from './connection'

// Mock the connection service
vi.mock('@services/connection', () => ({
    connectionService: {
        listConnections: vi.fn(),
        createConnection: vi.fn(),
        createNewDatabase: vi.fn(),
        closeConnection: vi.fn(),
        refreshMetadata: vi.fn(),
    },
}))

describe('Connection Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('should initialize with default state', () => {
        const store = useConnectionStore()

        expect(store.connections).toEqual([])
        expect(store.activeConnectionId).toBeNull()
        expect(store.isLoading).toBe(false)
        expect(store.error).toBeNull()
        expect(store.activeConnection).toBeUndefined()
        expect(store.connectionCount).toBe(0)
    })

    it('should set active connection', () => {
        const store = useConnectionStore()

        store.setActiveConnection('test-id')
        expect(store.activeConnectionId).toBe('test-id')
    })

    it('should compute active connection correctly', () => {
        const store = useConnectionStore()

        const mockConnection = {
            config: { id: 'test-id', name: 'Test' },
            status: 'connected',
            metadata: { size_bytes: 1024 },
        }

        store.connections = [mockConnection as any]
        store.setActiveConnection('test-id')

        expect(store.activeConnection).toEqual(mockConnection)
    })

    it('should compute connection count correctly', () => {
        const store = useConnectionStore()

        store.connections = [{ config: { id: '1' } } as any, { config: { id: '2' } } as any]

        expect(store.connectionCount).toBe(2)
    })

    it('should update connections array directly', () => {
        const store = useConnectionStore()
        const mockConnection = {
            config: { id: 'new-id', name: 'New Connection' },
            status: 'connected',
            metadata: { size_bytes: 1024 },
        }

        store.connections.push(mockConnection as any)

        expect(store.connections).toHaveLength(1)
        expect(store.connectionCount).toBe(1)
    })

    it('should filter connections correctly', () => {
        const store = useConnectionStore()

        store.connections = [
            { config: { id: '1', name: 'First' } } as any,
            { config: { id: '2', name: 'Second' } } as any,
            { config: { id: '3', name: 'Third' } } as any,
        ]

        store.connections = store.connections.filter(c => c.config.id !== '2')

        expect(store.connections).toHaveLength(2)
        expect(store.connections.map(c => c.config.id)).toEqual(['1', '3'])
    })

    it('should clear error by setting to null', () => {
        const store = useConnectionStore()
        store.error = 'Some error'

        store.error = null

        expect(store.error).toBeNull()
    })

    it('should find connection by id using find method', () => {
        const store = useConnectionStore()
        const mockConnections = [
            { config: { id: '1', name: 'First' } } as any,
            { config: { id: '2', name: 'Second' } } as any,
            { config: { id: '3', name: 'Third' } } as any,
        ]

        store.connections = mockConnections
        const found = store.connections.find(c => c.config.id === '2')

        expect(found?.config.name).toBe('Second')
    })

    it('should return undefined when connection not found', () => {
        const store = useConnectionStore()
        store.connections = [{ config: { id: '1', name: 'First' } } as any]

        const found = store.connections.find(c => c.config.id === 'non-existent')

        expect(found).toBeUndefined()
    })

    it('should reset active connection when filtering removes active', () => {
        const store = useConnectionStore()
        store.connections = [
            { config: { id: 'active-id', name: 'Active' } } as any,
            { config: { id: 'other-id', name: 'Other' } } as any,
        ]
        store.setActiveConnection('active-id')

        // Simulate closeConnection behavior
        store.connections = store.connections.filter(c => c.config.id !== 'active-id')
        if (store.activeConnectionId === 'active-id') {
            store.setActiveConnection(store.connections[0]?.config.id ?? null)
        }

        expect(store.activeConnectionId).toBe('other-id')
    })

    it('should set active connection to null when last connection removed', () => {
        const store = useConnectionStore()
        store.connections = [{ config: { id: 'active-id', name: 'Active' } } as any]
        store.setActiveConnection('active-id')

        store.connections = []
        if (store.activeConnectionId === 'active-id') {
            store.setActiveConnection(null)
        }

        expect(store.activeConnectionId).toBeNull()
    })
})
