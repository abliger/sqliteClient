import { describe, it, expect, vi, beforeEach } from 'vitest'
import { crudService } from './crud'
import * as tauriApi from '@tauri-apps/api/core'
import type { QueryResult, CellValue } from '@types'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))

describe('crudService', () => {
    const mockInvoke = vi.mocked(tauriApi.invoke)

    beforeEach(() => {
        mockInvoke.mockClear()
    })

    describe('getTableData', () => {
        it('should fetch table data with default parameters', async () => {
            const mockResult: QueryResult = {
                type: 'rows',
                columns: ['id', 'name'],
                rows: [
                    { values: { id: { type: 'Integer', value: 1 }, name: { type: 'Text', value: 'Test' } } }
                ],
                has_more: false,
                execution_info: {
                    execution_time_ms: 10,
                    rows_scanned: 1,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: []
                }
            }
            mockInvoke.mockResolvedValue(mockResult)

            const result = await crudService.getTableData({
                connectionId: 'conn-1',
                tableName: 'users'
            })

            expect(mockInvoke).toHaveBeenCalledWith('get_table_data', {
                connectionId: 'conn-1',
                tableName: 'users',
                limit: undefined,
                offset: undefined,
                orderBy: undefined,
                orderDir: undefined
            })
            expect(result).toEqual(mockResult)
        })

        it('should fetch table data with pagination and sorting', async () => {
            const mockResult: QueryResult = {
                type: 'rows',
                columns: ['id', 'name'],
                rows: [],
                has_more: false,
                execution_info: {
                    execution_time_ms: 5,
                    rows_scanned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: []
                }
            }
            mockInvoke.mockResolvedValue(mockResult)

            await crudService.getTableData({
                connectionId: 'conn-1',
                tableName: 'users',
                limit: 50,
                offset: 100,
                orderBy: 'id',
                orderDir: 'DESC'
            })

            expect(mockInvoke).toHaveBeenCalledWith('get_table_data', {
                connectionId: 'conn-1',
                tableName: 'users',
                limit: 50,
                offset: 100,
                orderBy: 'id',
                orderDir: 'DESC'
            })
        })
    })

    describe('insertRow', () => {
        it('should insert a new row', async () => {
            const mockResult: QueryResult = {
                type: 'execution',
                rows_affected: 1,
                last_insert_id: 42,
                execution_time_ms: 15,
                execution_info: {
                    execution_time_ms: 15,
                    rows_scanned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: []
                }
            }
            mockInvoke.mockResolvedValue(mockResult)

            const data: Record<string, CellValue> = {
                name: { type: 'Text', value: 'John' },
                age: { type: 'Integer', value: 30 }
            }

            const result = await crudService.insertRow({
                connectionId: 'conn-1',
                tableName: 'users',
                data
            })

            expect(mockInvoke).toHaveBeenCalledWith('insert_row', {
                connectionId: 'conn-1',
                tableName: 'users',
                data
            })
            expect(result).toEqual(mockResult)
            expect(result.type).toBe('execution')
            if (result.type === 'execution') {
                expect(result.last_insert_id).toBe(42)
            }
        })

        it('should handle insert with null values', async () => {
            const mockResult: QueryResult = {
                type: 'execution',
                rows_affected: 1,
                execution_time_ms: 10,
                execution_info: {
                    execution_time_ms: 10,
                    rows_scanned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: []
                }
            }
            mockInvoke.mockResolvedValue(mockResult)

            const data: Record<string, CellValue> = {
                name: { type: 'Text', value: 'Test' },
                description: { type: 'Null' }
            }

            await crudService.insertRow({
                connectionId: 'conn-1',
                tableName: 'products',
                data
            })

            expect(mockInvoke).toHaveBeenCalledWith('insert_row', {
                connectionId: 'conn-1',
                tableName: 'products',
                data
            })
        })
    })

    describe('updateRow', () => {
        it('should update rows matching conditions', async () => {
            const mockResult: QueryResult = {
                type: 'execution',
                rows_affected: 3,
                execution_time_ms: 20,
                execution_info: {
                    execution_time_ms: 20,
                    rows_scanned: 3,
                    indexes_used: ['idx_users_status'],
                    query_plan: [],
                    warnings: [],
                    suggestions: []
                }
            }
            mockInvoke.mockResolvedValue(mockResult)

            const data: Record<string, CellValue> = {
                status: { type: 'Text', value: 'active' }
            }
            const conditions: Record<string, CellValue> = {
                id: { type: 'Integer', value: 1 }
            }

            const result = await crudService.updateRow({
                connectionId: 'conn-1',
                tableName: 'users',
                data,
                conditions
            })

            expect(mockInvoke).toHaveBeenCalledWith('update_row', {
                connectionId: 'conn-1',
                tableName: 'users',
                data,
                conditions
            })
            expect(result.type).toBe('execution')
            if (result.type === 'execution') {
                expect(result.rows_affected).toBe(3)
            }
        })

        it('should update with multiple conditions', async () => {
            const mockResult: QueryResult = {
                type: 'execution',
                rows_affected: 1,
                execution_time_ms: 10,
                execution_info: {
                    execution_time_ms: 10,
                    rows_scanned: 1,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: []
                }
            }
            mockInvoke.mockResolvedValue(mockResult)

            const data: Record<string, CellValue> = {
                price: { type: 'Real', value: 99.99 }
            }
            const conditions: Record<string, CellValue> = {
                category: { type: 'Text', value: 'electronics' },
                status: { type: 'Text', value: 'available' }
            }

            await crudService.updateRow({
                connectionId: 'conn-1',
                tableName: 'products',
                data,
                conditions
            })

            expect(mockInvoke).toHaveBeenCalledWith('update_row', {
                connectionId: 'conn-1',
                tableName: 'products',
                data,
                conditions
            })
        })
    })

    describe('deleteRow', () => {
        it('should delete rows matching conditions', async () => {
            const mockResult: QueryResult = {
                type: 'execution',
                rows_affected: 1,
                execution_time_ms: 8,
                execution_info: {
                    execution_time_ms: 8,
                    rows_scanned: 1,
                    indexes_used: ['PRIMARY'],
                    query_plan: [],
                    warnings: [],
                    suggestions: []
                }
            }
            mockInvoke.mockResolvedValue(mockResult)

            const conditions: Record<string, CellValue> = {
                id: { type: 'Integer', value: 5 }
            }

            const result = await crudService.deleteRow({
                connectionId: 'conn-1',
                tableName: 'users',
                conditions
            })

            expect(mockInvoke).toHaveBeenCalledWith('delete_row', {
                connectionId: 'conn-1',
                tableName: 'users',
                conditions
            })
            expect(result.type).toBe('execution')
            if (result.type === 'execution') {
                expect(result.rows_affected).toBe(1)
            }
        })

        it('should handle delete with no matching rows', async () => {
            const mockResult: QueryResult = {
                type: 'execution',
                rows_affected: 0,
                execution_time_ms: 5,
                execution_info: {
                    execution_time_ms: 5,
                    rows_scanned: 0,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: []
                }
            }
            mockInvoke.mockResolvedValue(mockResult)

            const conditions: Record<string, CellValue> = {
                id: { type: 'Integer', value: 9999 }
            }

            const result = await crudService.deleteRow({
                connectionId: 'conn-1',
                tableName: 'users',
                conditions
            })

            expect(result.type).toBe('execution')
            if (result.type === 'execution') {
                expect(result.rows_affected).toBe(0)
            }
        })
    })

    describe('error handling', () => {
        it('should propagate errors from invoke', async () => {
            const error = new Error('Database connection failed')
            mockInvoke.mockRejectedValue(error)

            await expect(crudService.getTableData({
                connectionId: 'invalid',
                tableName: 'users'
            })).rejects.toThrow('Database connection failed')
        })

        it('should handle constraint violation errors', async () => {
            const error = new Error('UNIQUE constraint failed: users.email')
            mockInvoke.mockRejectedValue(error)

            const data: Record<string, CellValue> = {
                email: { type: 'Text', value: 'duplicate@example.com' }
            }

            await expect(crudService.insertRow({
                connectionId: 'conn-1',
                tableName: 'users',
                data
            })).rejects.toThrow('UNIQUE constraint failed')
        })
    })
})
