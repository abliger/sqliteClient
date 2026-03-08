import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportService, TauriNotAvailableError } from './export'

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

describe('exportService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Tauri environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(true)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        describe('exportToCSV', () => {
            it('should export query results to CSV file', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(undefined)

                const options = {
                    connectionId: 'conn-1',
                    sql: 'SELECT * FROM users',
                    outputPath: '/exports/users.csv',
                }

                await exportService.exportToCSV(options)

                expect(safeInvoke).toHaveBeenCalledWith('export_to_csv', {
                    connectionId: 'conn-1',
                    sql: 'SELECT * FROM users',
                    outputPath: '/exports/users.csv',
                })
            })

            it('should handle export with complex query', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(undefined)

                const options = {
                    connectionId: 'conn-1',
                    sql: `SELECT u.id, u.name, o.total 
                          FROM users u 
                          JOIN orders o ON u.id = o.user_id 
                          WHERE o.status = 'completed'`,
                    outputPath: '/exports/report.csv',
                }

                await exportService.exportToCSV(options)

                expect(safeInvoke).toHaveBeenCalledWith('export_to_csv', {
                    connectionId: 'conn-1',
                    sql: options.sql,
                    outputPath: '/exports/report.csv',
                })
            })

            it('should handle export error', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const error = new Error('Permission denied')
                vi.mocked(safeInvoke).mockRejectedValue(error)

                const options = {
                    connectionId: 'conn-1',
                    sql: 'SELECT * FROM users',
                    outputPath: '/root/protected.csv',
                }

                await expect(exportService.exportToCSV(options)).rejects.toThrow('Permission denied')
            })

            it('should handle empty result set', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(undefined)

                const options = {
                    connectionId: 'conn-1',
                    sql: 'SELECT * FROM users WHERE 1=0',
                    outputPath: '/exports/empty.csv',
                }

                await exportService.exportToCSV(options)
                expect(safeInvoke).toHaveBeenCalled()
            })
        })

        describe('exportToJSON', () => {
            it('should export query results to JSON file', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(undefined)

                const options = {
                    connectionId: 'conn-1',
                    sql: 'SELECT * FROM products',
                    outputPath: '/exports/products.json',
                }

                await exportService.exportToJSON(options)

                expect(safeInvoke).toHaveBeenCalledWith('export_to_json', {
                    connectionId: 'conn-1',
                    sql: 'SELECT * FROM products',
                    outputPath: '/exports/products.json',
                    pretty: true,
                })
            })

            it('should handle export with aggregation query', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(undefined)

                const options = {
                    connectionId: 'conn-1',
                    sql: 'SELECT COUNT(*) as total, AVG(price) as avg_price FROM products',
                    outputPath: '/exports/stats.json',
                }

                await exportService.exportToJSON(options)

                expect(safeInvoke).toHaveBeenCalledWith('export_to_json', {
                    connectionId: 'conn-1',
                    sql: options.sql,
                    outputPath: '/exports/stats.json',
                    pretty: true,
                })
            })

            it('should handle export error for invalid path', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const error = new Error('Invalid path')
                vi.mocked(safeInvoke).mockRejectedValue(error)

                const options = {
                    connectionId: 'conn-1',
                    sql: 'SELECT * FROM users',
                    outputPath: '',
                }

                await expect(exportService.exportToJSON(options)).rejects.toThrow('Invalid path')
            })
        })

        describe('exportQueryToFile', () => {
            it('should export with specified format', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(undefined)

                await exportService.exportQueryToFile(
                    'conn-1',
                    'SELECT * FROM orders',
                    '/exports/orders.csv',
                    'csv',
                )

                expect(safeInvoke).toHaveBeenCalledWith('export_query_to_file', {
                    connectionId: 'conn-1',
                    sql: 'SELECT * FROM orders',
                    outputPath: '/exports/orders.csv',
                    format: 'csv',
                })
            })

            it('should export with JSON format', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(undefined)

                await exportService.exportQueryToFile(
                    'conn-1',
                    'SELECT * FROM logs',
                    '/exports/logs.json',
                    'json',
                )

                expect(safeInvoke).toHaveBeenCalledWith('export_query_to_file', {
                    connectionId: 'conn-1',
                    sql: 'SELECT * FROM logs',
                    outputPath: '/exports/logs.json',
                    format: 'json',
                })
            })

            it('should handle large dataset export', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(undefined)

                await exportService.exportQueryToFile(
                    'conn-1',
                    'SELECT * FROM large_table LIMIT 100000',
                    '/exports/large.csv',
                    'csv',
                )
                expect(safeInvoke).toHaveBeenCalled()
            })
        })

        describe('error scenarios', () => {
            it('should handle database connection error', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const error = new Error('Connection lost')
                vi.mocked(safeInvoke).mockRejectedValue(error)

                await expect(
                    exportService.exportToCSV({
                        connectionId: 'disconnected',
                        sql: 'SELECT * FROM users',
                        outputPath: '/test.csv',
                    }),
                ).rejects.toThrow('Connection lost')
            })

            it('should handle invalid SQL error', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const error = new Error('SQL syntax error')
                vi.mocked(safeInvoke).mockRejectedValue(error)

                await expect(
                    exportService.exportToJSON({
                        connectionId: 'conn-1',
                        sql: 'INVALID SQL',
                        outputPath: '/test.json',
                    }),
                ).rejects.toThrow('SQL syntax error')
            })

            it('should handle disk full error', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const error = new Error('No space left on device')
                vi.mocked(safeInvoke).mockRejectedValue(error)

                await expect(
                    exportService.exportToCSV({
                        connectionId: 'conn-1',
                        sql: 'SELECT * FROM large_table',
                        outputPath: '/full_disk.csv',
                    }),
                ).rejects.toThrow('No space left on device')
            })
        })
    })

    describe('VS Code environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(true)
        })

        it('should use VS Code bridge for exportToCSV', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            vi.mocked(postVSCodeMessage).mockResolvedValue(undefined)

            await exportService.exportToCSV({
                connectionId: 'conn-1',
                sql: 'SELECT * FROM users',
                outputPath: '/exports/users.csv',
            })

            expect(postVSCodeMessage).toHaveBeenCalledWith('export_to_csv', {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM users',
                outputPath: '/exports/users.csv',
            })
        })

        it('should use VS Code bridge for exportToJSON', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            vi.mocked(postVSCodeMessage).mockResolvedValue(undefined)

            await exportService.exportToJSON({
                connectionId: 'conn-1',
                sql: 'SELECT * FROM products',
                outputPath: '/exports/products.json',
            })

            expect(postVSCodeMessage).toHaveBeenCalledWith('export_to_json', {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM products',
                outputPath: '/exports/products.json',
                pretty: true,
            })
        })

        it('should use VS Code bridge for exportQueryToFile', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            vi.mocked(postVSCodeMessage).mockResolvedValue(undefined)

            await exportService.exportQueryToFile(
                'conn-1',
                'SELECT * FROM orders',
                '/exports/orders.csv',
                'csv',
            )

            expect(postVSCodeMessage).toHaveBeenCalledWith('export_query_to_file', {
                connectionId: 'conn-1',
                sql: 'SELECT * FROM orders',
                outputPath: '/exports/orders.csv',
                format: 'csv',
            })
        })
    })

    describe('Browser environment (no Tauri/VSCode)', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        it('should throw TauriNotAvailableError for exportToCSV', async () => {
            await expect(
                exportService.exportToCSV({
                    connectionId: 'conn-1',
                    sql: 'SELECT * FROM users',
                    outputPath: '/exports/users.csv',
                }),
            ).rejects.toThrow(TauriNotAvailableError)
        })

        it('should throw TauriNotAvailableError for exportToJSON', async () => {
            await expect(
                exportService.exportToJSON({
                    connectionId: 'conn-1',
                    sql: 'SELECT * FROM users',
                    outputPath: '/exports/users.json',
                }),
            ).rejects.toThrow(TauriNotAvailableError)
        })

        it('should throw TauriNotAvailableError for exportQueryToFile', async () => {
            await expect(
                exportService.exportQueryToFile(
                    'conn-1',
                    'SELECT * FROM users',
                    '/exports/users.csv',
                    'csv',
                ),
            ).rejects.toThrow(TauriNotAvailableError)
        })
    })
})
