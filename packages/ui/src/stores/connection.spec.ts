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
  }
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
      metadata: { size_bytes: 1024 }
    }
    
    store.connections = [mockConnection as any]
    store.setActiveConnection('test-id')
    
    expect(store.activeConnection).toEqual(mockConnection)
  })

  it('should compute connection count correctly', () => {
    const store = useConnectionStore()
    
    store.connections = [
      { config: { id: '1' } } as any,
      { config: { id: '2' } } as any,
    ]
    
    expect(store.connectionCount).toBe(2)
  })
})
