import { describe, it, expect, vi, beforeEach } from 'vitest'
import { historyService } from './history'
import type { QueryHistoryItem } from '@types'

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

describe('historyService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Tauri environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(true)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        describe('getQueryHistory', () => {
            it('should fetch query history with pagination', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockHistory: QueryHistoryItem[] = [
                    {
                        id: 'hist-1',
                        sql: 'SELECT * FROM users',
                        connection_id: 'conn-1',
                        connection_name: 'Test DB',
                        executed_at: '2024-01-15T10:30:00Z',
                        duration_ms: 150,
                        is_success: true,
                        row_count: 10,
                    },
                    {
                        id: 'hist-2',
                        sql: 'UPDATE users SET status = "active"',
                        connection_id: 'conn-1',
                        connection_name: 'Test DB',
                        executed_at: '2024-01-15T10:25:00Z',
                        duration_ms: 50,
                        is_success: true,
                        row_count: 5,
                    },
                ]
                vi.mocked(safeInvoke).mockResolvedValue(mockHistory)

                const result = await historyService.getQueryHistory(10, 0)

                expect(safeInvoke).toHaveBeenCalledWith('get_query_history', {
                    limit: 10,
                    offset: 0,
                })
                expect(result).toHaveLength(2)
                expect(result[0].id).toBe('hist-1')
            })

            it('should fetch history with custom pagination', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue([])

                await historyService.getQueryHistory(50, 100)

                expect(safeInvoke).toHaveBeenCalledWith('get_query_history', {
                    limit: 50,
                    offset: 100,
                })
            })

            it('should handle empty history', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue([])

                const result = await historyService.getQueryHistory(10, 0)

                expect(result).toEqual([])
            })
        })

        describe('searchHistory', () => {
            it('should search history by keyword', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockResults: QueryHistoryItem[] = [
                    {
                        id: 'hist-1',
                        sql: 'SELECT * FROM users WHERE name = "John"',
                        connection_id: 'conn-1',
                        executed_at: '2024-01-15T10:30:00Z',
                        duration_ms: 100,
                        is_success: true,
                        row_count: 1,
                    },
                ]
                vi.mocked(safeInvoke).mockResolvedValue(mockResults)

                const result = await historyService.searchHistory('users', 10)

                expect(safeInvoke).toHaveBeenCalledWith('search_history', {
                    query: 'users',
                    limit: 10,
                })
                expect(result).toHaveLength(1)
                expect(result[0].sql).toContain('users')
            })

            it('should search with complex keyword', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue([])

                await historyService.searchHistory('SELECT * FROM', 20)

                expect(safeInvoke).toHaveBeenCalledWith('search_history', {
                    query: 'SELECT * FROM',
                    limit: 20,
                })
            })

            it('should return empty array for no matches', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue([])

                const result = await historyService.searchHistory('nonexistent_table_xyz', 10)

                expect(result).toEqual([])
            })
        })

        describe('deleteHistoryItem', () => {
            it('should delete a history item by id', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(undefined)

                await historyService.deleteHistoryItem('hist-1')

                expect(safeInvoke).toHaveBeenCalledWith('delete_history_item', {
                    id: 'hist-1',
                })
            })

            it('should handle delete of non-existent item', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(undefined)

                await historyService.deleteHistoryItem('non-existent-id')

                expect(safeInvoke).toHaveBeenCalled()
            })
        })

        describe('clearHistory', () => {
            it('should clear all history', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(5)

                const result = await historyService.clearHistory()

                expect(safeInvoke).toHaveBeenCalledWith('clear_history', { connectionId: undefined })
                expect(result).toBe(5)
            })

            it('should clear history for specific connection', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(3)

                const result = await historyService.clearHistory('conn-1')

                expect(safeInvoke).toHaveBeenCalledWith('clear_history', { connectionId: 'conn-1' })
                expect(result).toBe(3)
            })
        })

        describe('history item structure', () => {
            it('should handle history with error message', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockHistory: QueryHistoryItem[] = [
                    {
                        id: 'hist-error',
                        sql: 'INVALID SQL',
                        connection_id: 'conn-1',
                        executed_at: '2024-01-15T10:30:00Z',
                        duration_ms: 5,
                        is_success: false,
                        error_message: 'Syntax error near INVALID',
                    },
                ]
                vi.mocked(safeInvoke).mockResolvedValue(mockHistory)

                const result = await historyService.getQueryHistory(10, 0)

                expect(result[0].is_success).toBe(false)
                expect(result[0].error_message).toBe('Syntax error near INVALID')
            })

            it('should handle history without connection name', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockHistory: QueryHistoryItem[] = [
                    {
                        id: 'hist-1',
                        sql: 'SELECT 1',
                        executed_at: '2024-01-15T10:30:00Z',
                        duration_ms: 10,
                        is_success: true,
                    },
                ]
                vi.mocked(safeInvoke).mockResolvedValue(mockHistory)

                const result = await historyService.getQueryHistory(10, 0)

                expect(result[0].connection_id).toBeUndefined()
                expect(result[0].connection_name).toBeUndefined()
            })

            it('should handle history with null row_count', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockHistory: QueryHistoryItem[] = [
                    {
                        id: 'hist-ddl',
                        sql: 'CREATE TABLE test (id INT)',
                        connection_id: 'conn-1',
                        executed_at: '2024-01-15T10:30:00Z',
                        duration_ms: 20,
                        is_success: true,
                        row_count: undefined,
                    },
                ]
                vi.mocked(safeInvoke).mockResolvedValue(mockHistory)

                const result = await historyService.getQueryHistory(10, 0)

                expect(result[0].row_count).toBeUndefined()
            })
        })

        describe('error handling', () => {
            it('should propagate errors from getQueryHistory', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const error = new Error('Database error')
                vi.mocked(safeInvoke).mockRejectedValue(error)

                await expect(historyService.getQueryHistory(10, 0)).rejects.toThrow('Database error')
            })

            it('should propagate errors from searchHistory', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const error = new Error('Search service unavailable')
                vi.mocked(safeInvoke).mockRejectedValue(error)

                await expect(historyService.searchHistory('test', 10)).rejects.toThrow(
                    'Search service unavailable',
                )
            })

            it('should propagate errors from deleteHistoryItem', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const error = new Error('Item not found')
                vi.mocked(safeInvoke).mockRejectedValue(error)

                await expect(historyService.deleteHistoryItem('invalid-id')).rejects.toThrow(
                    'Item not found',
                )
            })

            it('should propagate errors from clearHistory', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const error = new Error('Permission denied')
                vi.mocked(safeInvoke).mockRejectedValue(error)

                await expect(historyService.clearHistory()).rejects.toThrow('Permission denied')
            })
        })
    })

    describe('VS Code environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(true)
        })

        it('should use VS Code bridge for getQueryHistory', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            const mockHistory: QueryHistoryItem[] = [{ id: '1', sql: 'SELECT 1', executed_at: '2024-01-01', duration_ms: 10, is_success: true }]
            vi.mocked(postVSCodeMessage).mockResolvedValue(mockHistory)

            const result = await historyService.getQueryHistory(10, 0)

            expect(postVSCodeMessage).toHaveBeenCalledWith('get_query_history', { limit: 10, offset: 0 })
            expect(result).toEqual(mockHistory)
        })

        it('should use VS Code bridge for searchHistory', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            vi.mocked(postVSCodeMessage).mockResolvedValue([])

            await historyService.searchHistory('test', 10)

            expect(postVSCodeMessage).toHaveBeenCalledWith('search_history', { query: 'test', limit: 10 })
        })

        it('should use VS Code bridge for clearHistory', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            vi.mocked(postVSCodeMessage).mockResolvedValue(3)

            const result = await historyService.clearHistory('conn-1')

            expect(postVSCodeMessage).toHaveBeenCalledWith('clear_history', { connectionId: 'conn-1' })
            expect(result).toBe(3)
        })
    })

    describe('Browser environment (no Tauri/VSCode)', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        it('should return empty array for getQueryHistory', async () => {
            const result = await historyService.getQueryHistory(10, 0)
            expect(result).toEqual([])
        })

        it('should return empty array for searchHistory', async () => {
            const result = await historyService.searchHistory('test', 10)
            expect(result).toEqual([])
        })

        it('should return 0 for clearHistory', async () => {
            const result = await historyService.clearHistory()
            expect(result).toBe(0)
        })
    })
})
