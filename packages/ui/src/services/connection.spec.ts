import { describe, it, expect, vi, beforeEach } from 'vitest'
import { connectionService } from './connection'

// Mock the tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('Connection Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create connection', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockConnection = { id: '1', name: 'test' }
    vi.mocked(invoke).mockResolvedValue(mockConnection)

    const result = await connectionService.createConnection('test', '/path/to/db.sqlite')

    expect(invoke).toHaveBeenCalledWith('create_connection', { name: 'test', dbPath: '/path/to/db.sqlite' })
    expect(result).toEqual(mockConnection)
  })

  it('should create new database', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockConnection = { id: '1', name: 'new_db' }
    vi.mocked(invoke).mockResolvedValue(mockConnection)

    const result = await connectionService.createNewDatabase('new_db', '/path/to/new_db.sqlite')

    expect(invoke).toHaveBeenCalledWith('create_new_database', { name: 'new_db', dbPath: '/path/to/new_db.sqlite' })
    expect(result).toEqual(mockConnection)
  })

  it('should close connection', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue(undefined)

    await connectionService.closeConnection('conn-123')

    expect(invoke).toHaveBeenCalledWith('close_connection', { connectionId: 'conn-123' })
  })

  it('should list connections', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockConnections = [{ id: '1' }, { id: '2' }]
    vi.mocked(invoke).mockResolvedValue(mockConnections)

    const result = await connectionService.listConnections()

    expect(invoke).toHaveBeenCalledWith('list_connections')
    expect(result).toEqual(mockConnections)
  })

  it('should get connection info', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockConnection = { id: '1', name: 'test' }
    vi.mocked(invoke).mockResolvedValue(mockConnection)

    const result = await connectionService.getConnectionInfo('conn-123')

    expect(invoke).toHaveBeenCalledWith('get_connection_info', { connectionId: 'conn-123' })
    expect(result).toEqual(mockConnection)
  })

  it('should test connection', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue(undefined)

    await connectionService.testConnection('/path/to/db.sqlite')

    expect(invoke).toHaveBeenCalledWith('test_connection', { dbPath: '/path/to/db.sqlite' })
  })

  it('should refresh metadata', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockMetadata = { size_bytes: 1024, table_count: 5 }
    vi.mocked(invoke).mockResolvedValue(mockMetadata)

    const result = await connectionService.refreshMetadata('conn-123')

    expect(invoke).toHaveBeenCalledWith('refresh_connection_metadata', { connectionId: 'conn-123' })
    expect(result).toEqual(mockMetadata)
  })

  it('should handle errors', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockRejectedValue(new Error('Connection failed'))

    await expect(connectionService.createConnection('test', '/path/to/db.sqlite'))
      .rejects.toThrow('Connection failed')
  })
})
