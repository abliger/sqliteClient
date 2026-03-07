import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportService } from './export'
import * as tauriApi from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))

describe('exportService', () => {
    const mockInvoke = vi.mocked(tauriApi.invoke)

    beforeEach(() => {
        mockInvoke.mockClear()
    })

    describe('exportToCSV', () => {
        it('should export query results to CSV file', async () => {
            mockInvoke.mockResolvedValue(undefined)

            const options = {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM users',
                outputPath: '/exports/users.csv'
            }

            await exportService.exportToCSV(options)

            expect(mockInvoke).toHaveBeenCalledWith('export_to_csv', {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM users',
                outputPath: '/exports/users.csv'
            })
        })

        it('should handle export with complex query', async () => {
            mockInvoke.mockResolvedValue(undefined)

            const options = {
                connectionId: 'conn-1',
                sql: `SELECT u.id, u.name, o.total 
                      FROM users u 
                      JOIN orders o ON u.id = o.user_id 
                      WHERE o.status = 'completed'`,
                outputPath: '/exports/report.csv'
            }

            await exportService.exportToCSV(options)

            expect(mockInvoke).toHaveBeenCalledWith('export_to_csv', {
                connectionId: 'conn-1',
                sql: options.sql,
                outputPath: '/exports/report.csv'
            })
        })

        it('should handle export error', async () => {
            const error = new Error('Permission denied')
            mockInvoke.mockRejectedValue(error)

            const options = {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM users',
                outputPath: '/root/protected.csv'
            }

            await expect(exportService.exportToCSV(options)).rejects.toThrow('Permission denied')
        })

        it('should handle empty result set', async () => {
            mockInvoke.mockResolvedValue(undefined)

            const options = {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM users WHERE 1=0',
                outputPath: '/exports/empty.csv'
            }

            await exportService.exportToCSV(options)
            expect(mockInvoke).toHaveBeenCalled()
        })
    })

    describe('exportToJSON', () => {
        it('should export query results to JSON file', async () => {
            mockInvoke.mockResolvedValue(undefined)

            const options = {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM products',
                outputPath: '/exports/products.json'
            }

            await exportService.exportToJSON(options)

            expect(mockInvoke).toHaveBeenCalledWith('export_to_json', {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM products',
                outputPath: '/exports/products.json',
                pretty: true
            })
        })

        it('should handle export with aggregation query', async () => {
            mockInvoke.mockResolvedValue(undefined)

            const options = {
                connectionId: 'conn-1',
                sql: 'SELECT COUNT(*) as total, AVG(price) as avg_price FROM products',
                outputPath: '/exports/stats.json'
            }

            await exportService.exportToJSON(options)

            expect(mockInvoke).toHaveBeenCalledWith('export_to_json', {
                connectionId: 'conn-1',
                sql: options.sql,
                outputPath: '/exports/stats.json',
                pretty: true
            })
        })

        it('should handle export error for invalid path', async () => {
            const error = new Error('Invalid path')
            mockInvoke.mockRejectedValue(error)

            const options = {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM users',
                outputPath: ''
            }

            await expect(exportService.exportToJSON(options)).rejects.toThrow('Invalid path')
        })
    })

    describe('exportQueryToFile', () => {
        it('should export with specified format', async () => {
            mockInvoke.mockResolvedValue(undefined)

            await exportService.exportQueryToFile(
                'conn-1',
                'SELECT * FROM orders',
                '/exports/orders.csv',
                'csv'
            )

            expect(mockInvoke).toHaveBeenCalledWith('export_query_to_file', {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM orders',
                outputPath: '/exports/orders.csv',
                format: 'csv'
            })
        })

        it('should export with JSON format', async () => {
            mockInvoke.mockResolvedValue(undefined)

            await exportService.exportQueryToFile(
                'conn-1',
                'SELECT * FROM logs',
                '/exports/logs.json',
                'json'
            )

            expect(mockInvoke).toHaveBeenCalledWith('export_query_to_file', {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM logs',
                outputPath: '/exports/logs.json',
                format: 'json'
            })
        })

        it('should handle large dataset export', async () => {
            mockInvoke.mockResolvedValue(undefined)

            const options = {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM large_table LIMIT 100000',
                outputPath: '/exports/large.csv',
                format: 'csv' as const
            }

            await exportService.exportQueryToFile(options)
            expect(mockInvoke).toHaveBeenCalled()
        })
    })

    describe('error scenarios', () => {
        it('should handle database connection error', async () => {
            const error = new Error('Connection lost')
            mockInvoke.mockRejectedValue(error)

            await expect(exportService.exportToCSV({
                connectionId: 'disconnected',
                sql: 'SELECT * FROM users',
                outputPath: '/test.csv'
            })).rejects.toThrow('Connection lost')
        })

        it('should handle invalid SQL error', async () => {
            const error = new Error('SQL syntax error')
            mockInvoke.mockRejectedValue(error)

            await expect(exportService.exportToJSON({
                connectionId: 'conn-1',
                sql: 'INVALID SQL',
                outputPath: '/test.json'
            })).rejects.toThrow('SQL syntax error')
        })

        it('should handle disk full error', async () => {
            const error = new Error('No space left on device')
            mockInvoke.mockRejectedValue(error)

            await expect(exportService.exportToCSV({
                connectionId: 'conn-1',
                sql: 'SELECT * FROM large_table',
                outputPath: '/full_disk.csv'
            })).rejects.toThrow('No space left on device')
        })
    })
})
