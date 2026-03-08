import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConnectionStore } from './connection'
import { connectionService } from '@services/connection'

// Mock the connection service
vi.mock('@services/connection', () => ({
    connectionService: {
        listConnections: vi.fn(),
        createConnection: vi.fn(),
        createNewDatabase: vi.fn(),
        closeConnection: vi.fn(),
        refreshMetadata: vi.fn(),
        restoreSavedConnections: vi.fn(),
        loadSavedConnectionConfigs: vi.fn(),
    },
}))

describe('Connection Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.clearAllMocks()
    })

    describe('initialization', () => {
        it('should initialize with default state', () => {
            const store = useConnectionStore()

            expect(store.connections).toEqual([])
            expect(store.activeConnectionId).toBeNull()
            expect(store.isLoading).toBe(false)
            expect(store.error).toBeNull()
            expect(store.activeConnection).toBeUndefined()
            expect(store.connectionCount).toBe(0)
        })
    })

    describe('getters', () => {
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

        it('should return undefined when no active connection', () => {
            const store = useConnectionStore()
            store.setActiveConnection('non-existent')
            expect(store.activeConnection).toBeUndefined()
        })
    })

    describe('loadConnections', () => {
        it('should load connections successfully', async () => {
            const store = useConnectionStore()
            const mockConnections = [
                { config: { id: '1', name: 'Conn 1' }, status: 'connected' },
                { config: { id: '2', name: 'Conn 2' }, status: 'connected' },
            ]
            vi.mocked(connectionService.listConnections).mockResolvedValue(mockConnections as any)

            await store.loadConnections()

            expect(store.connections).toEqual(mockConnections)
            expect(store.isLoading).toBe(false)
            expect(store.error).toBeNull()
        })

        it('should handle load connections error', async () => {
            const store = useConnectionStore()
            vi.mocked(connectionService.listConnections).mockRejectedValue(new Error('Network error'))

            await store.loadConnections()

            expect(store.error).toBe('Network error')
            expect(store.isLoading).toBe(false)
        })

        it('should set isLoading during load', async () => {
            const store = useConnectionStore()
            vi.mocked(connectionService.listConnections).mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve([]), 10))
            )

            const promise = store.loadConnections()
            expect(store.isLoading).toBe(true)
            await promise
            expect(store.isLoading).toBe(false)
        })
    })

    describe('restoreSavedConnections', () => {
        it('should restore saved connections successfully', async () => {
            const store = useConnectionStore()
            const mockConnections = [
                { config: { id: '1', name: 'Conn 1' }, status: 'connected' },
            ]
            vi.mocked(connectionService.restoreSavedConnections).mockResolvedValue(mockConnections as any)

            const result = await store.restoreSavedConnections()

            expect(store.connections).toEqual(mockConnections)
            expect(store.activeConnectionId).toBe('1')
            expect(result).toEqual(mockConnections)
        })

        it('should not change active connection if already set', async () => {
            const store = useConnectionStore()
            store.activeConnectionId = 'existing-id'
            const mockConnections = [{ config: { id: '1', name: 'Conn 1' }, status: 'connected' }]
            vi.mocked(connectionService.restoreSavedConnections).mockResolvedValue(mockConnections as any)

            await store.restoreSavedConnections()

            expect(store.activeConnectionId).toBe('existing-id')
        })

        it('should handle empty restored connections', async () => {
            const store = useConnectionStore()
            vi.mocked(connectionService.restoreSavedConnections).mockResolvedValue([])

            const result = await store.restoreSavedConnections()

            expect(store.connections).toEqual([])
            expect(store.activeConnectionId).toBeNull()
            expect(result).toEqual([])
        })

        it('should handle restore error', async () => {
            const store = useConnectionStore()
            vi.mocked(connectionService.restoreSavedConnections).mockRejectedValue(new Error('Restore failed'))

            const result = await store.restoreSavedConnections()

            expect(store.error).toBe('Restore failed')
            expect(result).toEqual([])
        })

        it('should set isLoading during restore', async () => {
            const store = useConnectionStore()
            vi.mocked(connectionService.restoreSavedConnections).mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve([]), 10))
            )

            const promise = store.restoreSavedConnections()
            expect(store.isLoading).toBe(true)
            await promise
            expect(store.isLoading).toBe(false)
        })
    })

    describe('loadSavedConnectionConfigs', () => {
        it('should load saved connection configs', async () => {
            const store = useConnectionStore()
            const mockConfigs = [{ id: '1', name: 'Conn 1', db_path: '/path/1' }]
            vi.mocked(connectionService.loadSavedConnectionConfigs).mockResolvedValue(mockConfigs as any)

            const result = await store.loadSavedConnectionConfigs()

            expect(result).toEqual(mockConfigs)
        })

        it('should handle error and return empty array', async () => {
            const store = useConnectionStore()
            vi.mocked(connectionService.loadSavedConnectionConfigs).mockRejectedValue(new Error('Load failed'))

            const result = await store.loadSavedConnectionConfigs()

            expect(result).toEqual([])
        })
    })

    describe('createConnection', () => {
        it('should create connection successfully', async () => {
            const store = useConnectionStore()
            const mockConnection = {
                config: { id: 'new-id', name: 'New Conn', db_path: '/path/db.sqlite' },
                status: 'connected',
            }
            vi.mocked(connectionService.createConnection).mockResolvedValue(mockConnection as any)

            const result = await store.createConnection('New Conn', '/path/db.sqlite')

            expect(connectionService.createConnection).toHaveBeenCalledWith('New Conn', '/path/db.sqlite')
            expect(store.connections.some(c => c.config.id === 'new-id')).toBe(true)
            expect(store.activeConnectionId).toBe('new-id')
            expect(result).toEqual(mockConnection)
        })

        it('should handle create connection error', async () => {
            const store = useConnectionStore()
            vi.mocked(connectionService.createConnection).mockRejectedValue(new Error('Create failed'))

            await expect(store.createConnection('Test', '/path')).rejects.toThrow('Create failed')
            expect(store.error).toBe('Create failed')
            expect(store.isLoading).toBe(false)
        })

        it('should set isLoading during create', async () => {
            const store = useConnectionStore()
            vi.mocked(connectionService.createConnection).mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve({ config: { id: '1' } } as any), 10))
            )

            const promise = store.createConnection('Test', '/path')
            expect(store.isLoading).toBe(true)
            await promise
            expect(store.isLoading).toBe(false)
        })
    })

    describe('createNewDatabase', () => {
        it('should create new database successfully', async () => {
            const store = useConnectionStore()
            const mockConnection = {
                config: { id: 'new-db-id', name: 'New DB', db_path: '/path/new.db' },
                status: 'connected',
            }
            vi.mocked(connectionService.createNewDatabase).mockResolvedValue(mockConnection as any)

            const result = await store.createNewDatabase('New DB', '/path/new.db')

            expect(connectionService.createNewDatabase).toHaveBeenCalledWith('New DB', '/path/new.db')
            expect(store.connections.some(c => c.config.id === 'new-db-id')).toBe(true)
            expect(store.activeConnectionId).toBe('new-db-id')
            expect(result).toEqual(mockConnection)
        })

        it('should handle create database error', async () => {
            const store = useConnectionStore()
            vi.mocked(connectionService.createNewDatabase).mockRejectedValue(new Error('Create DB failed'))

            await expect(store.createNewDatabase('Test', '/path')).rejects.toThrow('Create DB failed')
            expect(store.error).toBe('Create DB failed')
            expect(store.isLoading).toBe(false)
        })

        it('should set isLoading during create database', async () => {
            const store = useConnectionStore()
            vi.mocked(connectionService.createNewDatabase).mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve({ config: { id: '1' } } as any), 10))
            )

            const promise = store.createNewDatabase('Test', '/path')
            expect(store.isLoading).toBe(true)
            await promise
            expect(store.isLoading).toBe(false)
        })
    })

    describe('closeConnection', () => {
        it('should close connection successfully', async () => {
            const store = useConnectionStore()
            store.connections = [
                { config: { id: '1', name: 'Conn 1' }, status: 'connected' } as any,
                { config: { id: '2', name: 'Conn 2' }, status: 'connected' } as any,
            ]
            store.activeConnectionId = '1'
            vi.mocked(connectionService.closeConnection).mockResolvedValue(undefined)

            await store.closeConnection('1')

            expect(connectionService.closeConnection).toHaveBeenCalledWith('1')
            expect(store.connections).toHaveLength(1)
            expect(store.connections[0].config.id).toBe('2')
            expect(store.activeConnectionId).toBe('2')
        })

        it('should set active connection to null when closing last connection', async () => {
            const store = useConnectionStore()
            store.connections = [{ config: { id: '1', name: 'Conn 1' }, status: 'connected' } as any]
            store.activeConnectionId = '1'
            vi.mocked(connectionService.closeConnection).mockResolvedValue(undefined)

            await store.closeConnection('1')

            expect(store.connections).toHaveLength(0)
            expect(store.activeConnectionId).toBeNull()
        })

        it('should not change active connection when closing non-active connection', async () => {
            const store = useConnectionStore()
            store.connections = [
                { config: { id: '1', name: 'Conn 1' }, status: 'connected' } as any,
                { config: { id: '2', name: 'Conn 2' }, status: 'connected' } as any,
            ]
            store.activeConnectionId = '1'
            vi.mocked(connectionService.closeConnection).mockResolvedValue(undefined)

            await store.closeConnection('2')

            expect(store.activeConnectionId).toBe('1')
        })

        it('should handle close connection error', async () => {
            const store = useConnectionStore()
            store.connections = [{ config: { id: '1', name: 'Conn 1' }, status: 'connected' } as any]
            vi.mocked(connectionService.closeConnection).mockRejectedValue(new Error('Close failed'))

            await expect(store.closeConnection('1')).rejects.toThrow('Close failed')
            expect(store.error).toBe('Close failed')
        })
    })

    describe('refreshMetadata', () => {
        it('should refresh metadata successfully', async () => {
            const store = useConnectionStore()
            const mockMetadata = {
                version: '3.39.0',
                page_size: 4096,
                page_count: 100,
                table_count: 5,
                index_count: 2,
                trigger_count: 0,
                size_bytes: 409600,
            }
            store.connections = [
                { config: { id: '1', name: 'Conn 1' }, status: 'connected', metadata: null } as any,
            ]
            vi.mocked(connectionService.refreshMetadata).mockResolvedValue(mockMetadata as any)

            const result = await store.refreshMetadata('1')

            expect(connectionService.refreshMetadata).toHaveBeenCalledWith('1')
            expect(store.connections[0].metadata).toEqual(mockMetadata)
            expect(result).toEqual(mockMetadata)
        })

        it('should handle refresh metadata error', async () => {
            const store = useConnectionStore()
            store.connections = [{ config: { id: '1', name: 'Conn 1' }, status: 'connected' } as any]
            vi.mocked(connectionService.refreshMetadata).mockRejectedValue(new Error('Refresh failed'))

            await expect(store.refreshMetadata('1')).rejects.toThrow('Refresh failed')
        })

        it('should not update metadata if connection not found', async () => {
            const store = useConnectionStore()
            const mockMetadata = { version: '3.39.0', page_size: 4096, page_count: 100, table_count: 5, index_count: 2, trigger_count: 0, size_bytes: 409600 }
            vi.mocked(connectionService.refreshMetadata).mockResolvedValue(mockMetadata as any)

            // Connection doesn't exist in store
            const result = await store.refreshMetadata('non-existent')

            expect(result).toEqual(mockMetadata)
        })
    })

    describe('state mutations', () => {
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
    })

    describe('active connection edge cases', () => {
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

        it('should handle setting active connection to null', () => {
            const store = useConnectionStore()
            store.setActiveConnection('test-id')
            store.setActiveConnection(null)
            expect(store.activeConnectionId).toBeNull()
        })
    })
})
