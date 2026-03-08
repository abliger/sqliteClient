import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryService, TauriNotAvailableError } from './query'

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

describe('Query Service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Tauri environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(true)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        it('should execute query', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockResult = { type: 'rows', columns: ['id'], rows: [] }
            vi.mocked(safeInvoke).mockResolvedValue(mockResult)

            const result = await queryService.executeQuery({
                connectionId: 'conn-123',
                sql: 'SELECT * FROM users',
                limit: 100,
            })

            expect(safeInvoke).toHaveBeenCalledWith('execute_query', {
                connectionId: 'conn-123',
                sql: 'SELECT * FROM users',
                limit: 100,
            })
            expect(result).toEqual(mockResult)
        })

        it('should execute query with default limit', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockResult = { type: 'rows', columns: ['id'], rows: [] }
            vi.mocked(safeInvoke).mockResolvedValue(mockResult)

            await queryService.executeQuery({
                connectionId: 'conn-123',
                sql: 'SELECT * FROM users',
            })

            expect(safeInvoke).toHaveBeenCalledWith('execute_query', {
                connectionId: 'conn-123',
                sql: 'SELECT * FROM users',
                limit: undefined,
            })
        })

        it('should execute query stream', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockResult = { stream_id: 'stream-123', columns: ['id'], has_more: true, fetched_rows: 0 }
            vi.mocked(safeInvoke).mockResolvedValue(mockResult)

            const result = await queryService.executeQueryStream('conn-123', 'SELECT * FROM users', 100)

            expect(safeInvoke).toHaveBeenCalledWith('execute_query_stream', {
                connectionId: 'conn-123',
                sql: 'SELECT * FROM users',
                batchSize: 100,
            })
            expect(result).toEqual(mockResult)
        })

        it('should fetch stream batch', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockRows = [{ values: { id: { type: 'Integer', value: 1 } } }]
            vi.mocked(safeInvoke).mockResolvedValue(mockRows)

            const result = await queryService.fetchStreamBatch('stream-123', 100)

            expect(safeInvoke).toHaveBeenCalledWith('fetch_stream_batch', {
                streamId: 'stream-123',
                batchSize: 100,
            })
            expect(result).toEqual(mockRows)
        })

        it('should cancel query', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            vi.mocked(safeInvoke).mockResolvedValue(undefined)

            await queryService.cancelQuery('query-123')

            expect(safeInvoke).toHaveBeenCalledWith('cancel_query', { queryId: 'query-123' })
        })

        it('should execute SQL file', async () => {
            const { safeInvoke } = await import('@utils/tauri')
            const mockResult = { success: true, executedStatements: 5, totalStatements: 5, errors: [] }
            vi.mocked(safeInvoke).mockResolvedValue(mockResult)

            const result = await queryService.executeSqlFile('conn-123', '/path/to/script.sql')

            expect(safeInvoke).toHaveBeenCalledWith('execute_sql_file', {
                connectionId: 'conn-123',
                filePath: '/path/to/script.sql',
            })
            expect(result).toEqual(mockResult)
        })
    })

    describe('VS Code environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(true)
        })

        it('should use VS Code bridge for executeQuery', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            const mockResult = { type: 'rows', columns: ['id'], rows: [] }
            vi.mocked(postVSCodeMessage).mockResolvedValue(mockResult)

            const result = await queryService.executeQuery({
                connectionId: 'conn-123',
                sql: 'SELECT * FROM users',
                limit: 100,
            })

            expect(postVSCodeMessage).toHaveBeenCalledWith('execute_query', {
                connectionId: 'conn-123',
                sql: 'SELECT * FROM users',
                limit: 100,
            })
            expect(result).toEqual(mockResult)
        })

        it('should use VS Code bridge for executeQueryStream', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            const mockResult = { stream_id: 'stream-123', columns: ['id'], has_more: true, fetched_rows: 0 }
            vi.mocked(postVSCodeMessage).mockResolvedValue(mockResult)

            await queryService.executeQueryStream('conn-123', 'SELECT * FROM users', 100)

            expect(postVSCodeMessage).toHaveBeenCalledWith('execute_query_stream', {
                connectionId: 'conn-123',
                sql: 'SELECT * FROM users',
                batchSize: 100,
            })
        })

        it('should use VS Code bridge for executeSqlFile', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            const mockResult = { success: true, executedStatements: 3, totalStatements: 3, errors: [] }
            vi.mocked(postVSCodeMessage).mockResolvedValue(mockResult)

            await queryService.executeSqlFile('conn-123', '/path/to/script.sql')

            expect(postVSCodeMessage).toHaveBeenCalledWith('execute_sql_file', {
                connectionId: 'conn-123',
                filePath: '/path/to/script.sql',
            })
        })
    })

    describe('Browser environment (no Tauri/VSCode)', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        it('should throw TauriNotAvailableError for executeQuery', async () => {
            await expect(
                queryService.executeQuery({
                    connectionId: 'conn-123',
                    sql: 'SELECT * FROM users',
                }),
            ).rejects.toThrow(TauriNotAvailableError)
        })

        it('should throw TauriNotAvailableError for executeQueryStream', async () => {
            await expect(
                queryService.executeQueryStream('conn-123', 'SELECT * FROM users'),
            ).rejects.toThrow(TauriNotAvailableError)
        })

        it('should throw TauriNotAvailableError for fetchStreamBatch', async () => {
            await expect(
                queryService.fetchStreamBatch('stream-123', 100),
            ).rejects.toThrow(TauriNotAvailableError)
        })

        it('should throw TauriNotAvailableError for cancelQuery', async () => {
            await expect(queryService.cancelQuery('query-123')).rejects.toThrow(TauriNotAvailableError)
        })

        it('should throw TauriNotAvailableError for executeSqlFile', async () => {
            await expect(
                queryService.executeSqlFile('conn-123', '/path/to/script.sql'),
            ).rejects.toThrow(TauriNotAvailableError)
        })
    })
})
