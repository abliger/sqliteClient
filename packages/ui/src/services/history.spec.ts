import { describe, it, expect, vi, beforeEach } from 'vitest'
import { historyService } from './history'
import * as tauriApi from '@tauri-apps/api/core'
import type { QueryHistoryItem } from '@types'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))

describe('historyService', () => {
    const mockInvoke = vi.mocked(tauriApi.invoke)

    beforeEach(() => {
        mockInvoke.mockClear()
    })

    describe('getQueryHistory', () => {
        it('should fetch query history with pagination', async () => {
            const mockHistory: QueryHistoryItem[] = [
                {
                    id: 'hist-1',
                    sql: 'SELECT * FROM users',
                    connection_id: 'conn-1',
                    connection_name: 'Test DB',
                    executed_at: '2024-01-15T10:30:00Z',
                    duration_ms: 150,
                    is_success: true,
                    row_count: 10
                },
                {
                    id: 'hist-2',
                    sql: 'UPDATE users SET status = "active"',
                    connection_id: 'conn-1',
                    connection_name: 'Test DB',
                    executed_at: '2024-01-15T10:25:00Z',
                    duration_ms: 50,
                    is_success: true,
                    row_count: 5
                }
            ]
            mockInvoke.mockResolvedValue(mockHistory)

            const result = await historyService.getQueryHistory(10, 0)

            expect(mockInvoke).toHaveBeenCalledWith('get_query_history', {
                limit: 10,
                offset: 0
            })
            expect(result).toHaveLength(2)
            expect(result[0].id).toBe('hist-1')
        })

        it('should fetch history with custom pagination', async () => {
            mockInvoke.mockResolvedValue([])

            await historyService.getQueryHistory(50, 100)

            expect(mockInvoke).toHaveBeenCalledWith('get_query_history', {
                limit: 50,
                offset: 100
            })
        })

        it('should handle empty history', async () => {
            mockInvoke.mockResolvedValue([])

            const result = await historyService.getQueryHistory(10, 0)

            expect(result).toEqual([])
        })
    })

    describe('searchHistory', () => {
        it('should search history by keyword', async () => {
            const mockResults: QueryHistoryItem[] = [
                {
                    id: 'hist-1',
                    sql: 'SELECT * FROM users WHERE name = "John"',
                    connection_id: 'conn-1',
                    executed_at: '2024-01-15T10:30:00Z',
                    duration_ms: 100,
                    is_success: true,
                    row_count: 1
                }
            ]
            mockInvoke.mockResolvedValue(mockResults)

            const result = await historyService.searchHistory('users', 10)

            expect(mockInvoke).toHaveBeenCalledWith('search_history', {
                query: 'users',
                limit: 10
            })
            expect(result).toHaveLength(1)
            expect(result[0].sql).toContain('users')
        })

        it('should search with complex keyword', async () => {
            mockInvoke.mockResolvedValue([])

            await historyService.searchHistory('SELECT * FROM', 20)

            expect(mockInvoke).toHaveBeenCalledWith('search_history', {
                query: 'SELECT * FROM',
                limit: 20
            })
        })

        it('should return empty array for no matches', async () => {
            mockInvoke.mockResolvedValue([])

            const result = await historyService.searchHistory('nonexistent_table_xyz', 10)

            expect(result).toEqual([])
        })
    })

    describe('deleteHistoryItem', () => {
        it('should delete a history item by id', async () => {
            mockInvoke.mockResolvedValue(undefined)

            await historyService.deleteHistoryItem('hist-1')

            expect(mockInvoke).toHaveBeenCalledWith('delete_history_item', {
                id: 'hist-1'
            })
        })

        it('should handle delete of non-existent item', async () => {
            mockInvoke.mockResolvedValue(undefined)

            await historyService.deleteHistoryItem('non-existent-id')

            expect(mockInvoke).toHaveBeenCalled()
        })
    })

    describe('clearHistory', () => {
        it('should clear all history', async () => {
            mockInvoke.mockResolvedValue(undefined)

            await historyService.clearHistory()

            expect(mockInvoke).toHaveBeenCalledWith('clear_history', {})
        })

        it('should handle clear when history is empty', async () => {
            mockInvoke.mockResolvedValue(undefined)

            await historyService.clearHistory()

            expect(mockInvoke).toHaveBeenCalled()
        })
    })

    describe('history item structure', () => {
        it('should handle history with error message', async () => {
            const mockHistory: QueryHistoryItem[] = [
                {
                    id: 'hist-error',
                    sql: 'INVALID SQL',
                    connection_id: 'conn-1',
                    executed_at: '2024-01-15T10:30:00Z',
                    duration_ms: 5,
                    is_success: false,
                    error_message: 'Syntax error near INVALID'
                }
            ]
            mockInvoke.mockResolvedValue(mockHistory)

            const result = await historyService.getQueryHistory({
                limit: 10,
                offset: 0
            })

            expect(result[0].is_success).toBe(false)
            expect(result[0].error_message).toBe('Syntax error near INVALID')
        })

        it('should handle history without connection name', async () => {
            const mockHistory: QueryHistoryItem[] = [
                {
                    id: 'hist-1',
                    sql: 'SELECT 1',
                    executed_at: '2024-01-15T10:30:00Z',
                    duration_ms: 10,
                    is_success: true
                }
            ]
            mockInvoke.mockResolvedValue(mockHistory)

            const result = await historyService.getQueryHistory({
                limit: 10,
                offset: 0
            })

            expect(result[0].connection_id).toBeUndefined()
            expect(result[0].connection_name).toBeUndefined()
        })

        it('should handle history with null row_count', async () => {
            const mockHistory: QueryHistoryItem[] = [
                {
                    id: 'hist-ddl',
                    sql: 'CREATE TABLE test (id INT)',
                    connection_id: 'conn-1',
                    executed_at: '2024-01-15T10:30:00Z',
                    duration_ms: 20,
                    is_success: true,
                    row_count: undefined
                }
            ]
            mockInvoke.mockResolvedValue(mockHistory)

            const result = await historyService.getQueryHistory({
                limit: 10,
                offset: 0
            })

            expect(result[0].row_count).toBeUndefined()
        })
    })

    describe('error handling', () => {
        it('should propagate errors from getQueryHistory', async () => {
            const error = new Error('Database error')
            mockInvoke.mockRejectedValue(error)

            await expect(historyService.getQueryHistory({
                limit: 10,
                offset: 0
            })).rejects.toThrow('Database error')
        })

        it('should propagate errors from searchHistory', async () => {
            const error = new Error('Search service unavailable')
            mockInvoke.mockRejectedValue(error)

            await expect(historyService.searchHistory({
                keyword: 'test',
                limit: 10
            })).rejects.toThrow('Search service unavailable')
        })

        it('should propagate errors from deleteHistoryItem', async () => {
            const error = new Error('Item not found')
            mockInvoke.mockRejectedValue(error)

            await expect(historyService.deleteHistoryItem('invalid-id'))
                .rejects.toThrow('Item not found')
        })

        it('should propagate errors from clearHistory', async () => {
            const error = new Error('Permission denied')
            mockInvoke.mockRejectedValue(error)

            await expect(historyService.clearHistory())
                .rejects.toThrow('Permission denied')
        })
    })
})
