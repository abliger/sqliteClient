import { describe, it, expect, vi, beforeEach } from 'vitest'
import { schemaService, TauriNotAvailableError } from './schema'

// Mock the tauri utils
vi.mock('@utils/tauri', () => ({
    isTauri: vi.fn(),
    isVSCode: vi.fn(),
    safeInvoke: vi.fn(),
}))

// Mock vscode-bridge
vi.mock('./vscode-bridge', () => ({
    postVSCodeMessage: vi.fn(),
}))

describe('Schema Service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Tauri environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(true)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        it('should list tables', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockTables = [{ name: 'users' }, { name: 'orders' }]
            vi.mocked(safeInvoke).mockResolvedValue(mockTables)

            const result = await schemaService.listTables('conn-123')

            expect(safeInvoke).toHaveBeenCalledWith('list_tables', { connectionId: 'conn-123' })
            expect(result).toEqual(mockTables)
        })

        it('should get table schema', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockSchema = { name: 'users', columns: [] }
            vi.mocked(safeInvoke).mockResolvedValue(mockSchema)

            const result = await schemaService.getTableSchema('conn-123', 'users')

            expect(safeInvoke).toHaveBeenCalledWith('get_table_schema', {
                connectionId: 'conn-123',
                tableName: 'users',
            })
            expect(result).toEqual(mockSchema)
        })

        it('should get database schema', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockSchema = { tables: [], indexes: [], triggers: [] }
            vi.mocked(safeInvoke).mockResolvedValue(mockSchema)

            const result = await schemaService.getDatabaseSchema('conn-123')

            expect(safeInvoke).toHaveBeenCalledWith('get_database_schema', { connectionId: 'conn-123' })
            expect(result).toEqual(mockSchema)
        })

        it('should get ER diagram data', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockDiagram = { tables: [], relations: [] }
            vi.mocked(safeInvoke).mockResolvedValue(mockDiagram)

            const result = await schemaService.getERDiagramData('conn-123')

            expect(safeInvoke).toHaveBeenCalledWith('get_er_diagram_data', { connectionId: 'conn-123' })
            expect(result).toEqual(mockDiagram)
        })

        it('should list indexes', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockIndexes = [{ name: 'idx_users' }]
            vi.mocked(safeInvoke).mockResolvedValue(mockIndexes)

            const result = await schemaService.listIndexes('conn-123')

            expect(safeInvoke).toHaveBeenCalledWith('list_indexes', { connectionId: 'conn-123' })
            expect(result).toEqual(mockIndexes)
        })

        it('should list triggers', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockTriggers = [{ name: 'trg_insert' }]
            vi.mocked(safeInvoke).mockResolvedValue(mockTriggers)

            const result = await schemaService.listTriggers('conn-123')

            expect(safeInvoke).toHaveBeenCalledWith('list_triggers', { connectionId: 'conn-123' })
            expect(result).toEqual(mockTriggers)
        })
    })

    describe('VS Code environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(true)
        })

        it('should list tables via VS Code bridge', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            const mockTables = [{ name: 'users' }]
            vi.mocked(postVSCodeMessage).mockResolvedValue(mockTables)

            const result = await schemaService.listTables('conn-123')

            expect(postVSCodeMessage).toHaveBeenCalledWith('list_tables', { connectionId: 'conn-123' })
            expect(result).toEqual(mockTables)
        })
    })

    describe('Browser environment (no Tauri/VSCode)', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        it('should return empty array for listTables', async () => {
            const result = await schemaService.listTables('conn-123')
            expect(result).toEqual([])
        })

        it('should return empty array for listIndexes', async () => {
            const result = await schemaService.listIndexes('conn-123')
            expect(result).toEqual([])
        })

        it('should return empty array for listTriggers', async () => {
            const result = await schemaService.listTriggers('conn-123')
            expect(result).toEqual([])
        })

        it('should throw TauriNotAvailableError for getTableSchema', async () => {
            await expect(schemaService.getTableSchema('conn-123', 'users'))
                .rejects.toThrow(TauriNotAvailableError)
        })

        it('should throw TauriNotAvailableError for getERDiagramData', async () => {
            await expect(schemaService.getERDiagramData('conn-123'))
                .rejects.toThrow(TauriNotAvailableError)
        })

        it('should return default data types', async () => {
            const result = await schemaService.getDataTypes()
            expect(result).toContain('INTEGER')
            expect(result).toContain('TEXT')
            expect(result).toContain('BLOB')
        })

        it('should return default foreign key actions', async () => {
            const result = await schemaService.getForeignKeyActions()
            expect(result).toContain('NO ACTION')
            expect(result).toContain('CASCADE')
        })
    })

    describe('DDL operations', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(true)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        it('should preview create table', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockResult = { sql: 'CREATE TABLE...', warnings: [] }
            vi.mocked(safeInvoke).mockResolvedValue(mockResult)

            const table = { name: 'test', columns: [] }
            const result = await schemaService.previewCreateTable(table as any)

            expect(safeInvoke).toHaveBeenCalledWith('preview_create_table', { table })
            expect(result).toEqual(mockResult)
        })

        it('should create table', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockResult = { success: true, sql: 'CREATE TABLE...' }
            vi.mocked(safeInvoke).mockResolvedValue(mockResult)

            const table = { name: 'test', columns: [] }
            const result = await schemaService.createTable('conn-123', table as any)

            expect(safeInvoke).toHaveBeenCalledWith('create_table', { connectionId: 'conn-123', table })
            expect(result).toEqual(mockResult)
        })
    })
})
