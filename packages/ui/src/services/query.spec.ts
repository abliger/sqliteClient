import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryService } from './query'

// Mock the tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('Query Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should execute query', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockResult = { type: 'rows', columns: ['id'], rows: [] }
    vi.mocked(invoke).mockResolvedValue(mockResult)

    const result = await queryService.executeQuery({
      connectionId: 'conn-123',
      sql: 'SELECT * FROM users',
      limit: 100
    })

    expect(invoke).toHaveBeenCalledWith('execute_query', {
      connectionId: 'conn-123',
      sql: 'SELECT * FROM users',
      limit: 100
    })
    expect(result).toEqual(mockResult)
  })

  it('should execute query with default limit', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockResult = { type: 'rows', columns: ['id'], rows: [] }
    vi.mocked(invoke).mockResolvedValue(mockResult)

    await queryService.executeQuery({
      connectionId: 'conn-123',
      sql: 'SELECT * FROM users'
    })

    expect(invoke).toHaveBeenCalledWith('execute_query', {
      connectionId: 'conn-123',
      sql: 'SELECT * FROM users',
      limit: undefined
    })
  })

  it('should execute query stream', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockResult = { streamId: 'stream-123', columns: ['id'], hasMore: true }
    vi.mocked(invoke).mockResolvedValue(mockResult)

    const result = await queryService.executeQueryStream('conn-123', 'SELECT * FROM users', 100)

    expect(invoke).toHaveBeenCalledWith('execute_query_stream', {
      connectionId: 'conn-123',
      sql: 'SELECT * FROM users',
      batchSize: 100
    })
    expect(result).toEqual(mockResult)
  })

  it('should fetch stream batch', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockRows = [{ id: 1 }, { id: 2 }]
    vi.mocked(invoke).mockResolvedValue(mockRows)

    const result = await queryService.fetchStreamBatch('stream-123', 100)

    expect(invoke).toHaveBeenCalledWith('fetch_stream_batch', {
      streamId: 'stream-123',
      batchSize: 100
    })
    expect(result).toEqual(mockRows)
  })

  it('should cancel query', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue(undefined)

    await queryService.cancelQuery('query-123')

    expect(invoke).toHaveBeenCalledWith('cancel_query', { queryId: 'query-123' })
  })
})
