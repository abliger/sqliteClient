import { describe, it, expect, vi, beforeEach } from 'vitest'
import { schemaService } from './schema'

// Mock the tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('Schema Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should list tables', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockTables = [{ name: 'users' }, { name: 'orders' }]
    vi.mocked(invoke).mockResolvedValue(mockTables)

    const result = await schemaService.listTables('conn-123')

    expect(invoke).toHaveBeenCalledWith('list_tables', { connectionId: 'conn-123' })
    expect(result).toEqual(mockTables)
  })

  it('should get table schema', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockSchema = { name: 'users', columns: [] }
    vi.mocked(invoke).mockResolvedValue(mockSchema)

    const result = await schemaService.getTableSchema('conn-123', 'users')

    expect(invoke).toHaveBeenCalledWith('get_table_schema', {
      connectionId: 'conn-123',
      tableName: 'users'
    })
    expect(result).toEqual(mockSchema)
  })

  it('should get database schema', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockSchema = { tables: [], indexes: [], triggers: [] }
    vi.mocked(invoke).mockResolvedValue(mockSchema)

    const result = await schemaService.getDatabaseSchema('conn-123')

    expect(invoke).toHaveBeenCalledWith('get_database_schema', { connectionId: 'conn-123' })
    expect(result).toEqual(mockSchema)
  })

  it('should get ER diagram data', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockDiagram = { tables: [], relations: [] }
    vi.mocked(invoke).mockResolvedValue(mockDiagram)

    const result = await schemaService.getERDiagramData('conn-123')

    expect(invoke).toHaveBeenCalledWith('get_er_diagram_data', { connectionId: 'conn-123' })
    expect(result).toEqual(mockDiagram)
  })

  it('should list indexes', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockIndexes = [{ name: 'idx_users' }]
    vi.mocked(invoke).mockResolvedValue(mockIndexes)

    const result = await schemaService.listIndexes('conn-123')

    expect(invoke).toHaveBeenCalledWith('list_indexes', { connectionId: 'conn-123' })
    expect(result).toEqual(mockIndexes)
  })

  it('should list triggers', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockTriggers = [{ name: 'trg_insert' }]
    vi.mocked(invoke).mockResolvedValue(mockTriggers)

    const result = await schemaService.listTriggers('conn-123')

    expect(invoke).toHaveBeenCalledWith('list_triggers', { connectionId: 'conn-123' })
    expect(result).toEqual(mockTriggers)
  })
})
