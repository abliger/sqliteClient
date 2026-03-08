import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    importService,
    createDefaultImportConfig,
    generateColumnMappings,
    SQLITE_DATA_TYPES,
    TauriNotAvailableError,
} from './import'
import type { ImportPreview, ImportConfig, ImportResult } from './import'

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

describe('importService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Tauri environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(true)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        describe('getSupportedFormats', () => {
            it('should return supported import formats', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockFormats = [
                    { extension: 'csv', name: 'CSV', description: 'Comma Separated Values' },
                    { extension: 'xlsx', name: 'Excel', description: 'Excel 2007+' },
                ]
                vi.mocked(safeInvoke).mockResolvedValue(mockFormats)

                const result = await importService.getSupportedFormats()

                expect(safeInvoke).toHaveBeenCalledWith('get_supported_import_formats')
                expect(result).toEqual(mockFormats)
            })
        })

        describe('parseImportFile', () => {
            it('should parse import file and return preview', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockPreview: ImportPreview = {
                    columns: ['name', 'age', 'email'],
                    rows: [
                        { name: 'John', age: '30', email: 'john@example.com' },
                        { name: 'Jane', age: '25', email: 'jane@example.com' },
                    ],
                    total_rows: 100,
                    suggested_types: {
                        name: 'TEXT',
                        age: 'INTEGER',
                        email: 'TEXT',
                    },
                }
                vi.mocked(safeInvoke).mockResolvedValue(mockPreview)

                const result = await importService.parseImportFile('/path/to/file.csv', 'csv')

                expect(safeInvoke).toHaveBeenCalledWith('parse_import_file', {
                    filePath: '/path/to/file.csv',
                    fileType: 'csv',
                })
                expect(result).toEqual(mockPreview)
            })
        })

        describe('detectColumnTypes', () => {
            it('should detect column types from preview data', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockTypes = {
                    name: 'TEXT',
                    age: 'INTEGER',
                    price: 'REAL',
                    is_active: 'BOOLEAN',
                }
                vi.mocked(safeInvoke).mockResolvedValue(mockTypes)

                const previewData = [{ name: 'Test', age: '30', price: '99.99', is_active: 'true' }]
                const result = await importService.detectColumnTypes(previewData)

                expect(safeInvoke).toHaveBeenCalledWith('detect_column_types', { previewData })
                expect(result).toEqual(mockTypes)
            })
        })

        describe('executeImport', () => {
            it('should execute import and return result', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockResult: ImportResult = {
                    imported_rows: 100,
                    failed_rows: 0,
                    errors: [],
                    table_name: 'users',
                    duration_ms: 1500,
                }
                vi.mocked(safeInvoke).mockResolvedValue(mockResult)

                const config: ImportConfig = {
                    table_name: 'users',
                    overwrite_existing: false,
                    column_mappings: [],
                    csv_has_header: true,
                    excel_sheet_index: 0,
                    skip_rows: 0,
                    batch_size: 1000,
                }
                const previewData = [{ name: 'John', age: '30' }]

                const result = await importService.executeImport('conn-1', config, previewData)

                expect(safeInvoke).toHaveBeenCalledWith('execute_import', {
                    connectionId: 'conn-1',
                    config,
                    previewData,
                })
                expect(result).toEqual(mockResult)
            })

            it('should handle partial import with errors', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const mockResult: ImportResult = {
                    imported_rows: 95,
                    failed_rows: 5,
                    errors: ['Row 10: Invalid data', 'Row 20: Type mismatch'],
                    table_name: 'products',
                    duration_ms: 2000,
                }
                vi.mocked(safeInvoke).mockResolvedValue(mockResult)

                const config = createDefaultImportConfig()
                const result = await importService.executeImport('conn-1', config, [])

                expect(result.imported_rows).toBe(95)
                expect(result.failed_rows).toBe(5)
                expect(result.errors).toHaveLength(2)
            })
        })

        describe('validateTableName', () => {
            it('should return true for valid table name', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(true)

                const result = await importService.validateTableName('conn-1', 'users')

                expect(safeInvoke).toHaveBeenCalledWith('validate_table_name', {
                    connectionId: 'conn-1',
                    tableName: 'users',
                })
                expect(result).toBe(true)
            })

            it('should return false for invalid table name', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                vi.mocked(safeInvoke).mockResolvedValue(false)

                const result = await importService.validateTableName('conn-1', 'sqlite_invalid')

                expect(result).toBe(false)
            })
        })

        describe('error handling', () => {
            it('should propagate errors from invoke', async () => {
                const { safeInvoke } = await import('@utils/tauri')
                const error = new Error('File not found')
                vi.mocked(safeInvoke).mockRejectedValue(error)

                await expect(importService.parseImportFile('/invalid/path', 'csv')).rejects.toThrow(
                    'File not found',
                )
            })
        })
    })

    describe('VS Code environment', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(true)
        })

        it('should use VS Code bridge for getSupportedFormats', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            const mockFormats = [
                { extension: 'csv', name: 'CSV', description: 'Comma Separated Values' },
            ]
            vi.mocked(postVSCodeMessage).mockResolvedValue(mockFormats)

            const result = await importService.getSupportedFormats()

            expect(postVSCodeMessage).toHaveBeenCalledWith('get_supported_import_formats')
            expect(result).toEqual(mockFormats)
        })

        it('should use VS Code bridge for parseImportFile', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            const mockPreview: ImportPreview = {
                columns: ['name'],
                rows: [],
                total_rows: 0,
                suggested_types: {},
            }
            vi.mocked(postVSCodeMessage).mockResolvedValue(mockPreview)

            await importService.parseImportFile('/path/to/file.csv', 'csv')

            expect(postVSCodeMessage).toHaveBeenCalledWith('parse_import_file', {
                filePath: '/path/to/file.csv',
                fileType: 'csv',
            })
        })

        it('should use VS Code bridge for executeImport', async () => {
            const { postVSCodeMessage } = await import('./vscode-bridge')
            const mockResult: ImportResult = {
                imported_rows: 100,
                failed_rows: 0,
                errors: [],
                table_name: 'users',
                duration_ms: 1500,
            }
            vi.mocked(postVSCodeMessage).mockResolvedValue(mockResult)

            const config = createDefaultImportConfig()
            await importService.executeImport('conn-1', config, [])

            expect(postVSCodeMessage).toHaveBeenCalledWith('execute_import', {
                connectionId: 'conn-1',
                config,
                previewData: [],
            })
        })
    })

    describe('Browser environment (no Tauri/VSCode)', () => {
        beforeEach(async () => {
            const { isTauri, isVSCode } = await import('@utils/tauri')
            vi.mocked(isTauri).mockReturnValue(false)
            vi.mocked(isVSCode).mockReturnValue(false)
        })

        it('should return default formats for getSupportedFormats', async () => {
            const result = await importService.getSupportedFormats()
            expect(result).toHaveLength(3)
            expect(result.map(f => f.extension)).toContain('csv')
            expect(result.map(f => f.extension)).toContain('xlsx')
            expect(result.map(f => f.extension)).toContain('xls')
        })

        it('should throw TauriNotAvailableError for parseImportFile', async () => {
            await expect(
                importService.parseImportFile('/path/to/file.csv', 'csv'),
            ).rejects.toThrow(TauriNotAvailableError)
        })

        it('should detect column types locally for detectColumnTypes', async () => {
            const previewData = [
                { name: 'Test', age: '30', price: '99.99' },
            ]
            const result = await importService.detectColumnTypes(previewData)

            expect(result.name).toBe('TEXT')
            expect(result.age).toBe('INTEGER')
            expect(result.price).toBe('REAL')
        })

        it('should throw TauriNotAvailableError for executeImport', async () => {
            const config = createDefaultImportConfig()
            await expect(
                importService.executeImport('conn-1', config, []),
            ).rejects.toThrow(TauriNotAvailableError)
        })

        it('should throw TauriNotAvailableError for validateTableName', async () => {
            await expect(
                importService.validateTableName('conn-1', 'users'),
            ).rejects.toThrow(TauriNotAvailableError)
        })
    })

    describe('SQLITE_DATA_TYPES', () => {
        it('should contain all SQLite data types', () => {
            const typeValues = SQLITE_DATA_TYPES.map(t => t.value)

            expect(typeValues).toContain('TEXT')
            expect(typeValues).toContain('INTEGER')
            expect(typeValues).toContain('REAL')
            expect(typeValues).toContain('NUMERIC')
            expect(typeValues).toContain('BOOLEAN')
            expect(typeValues).toContain('DATE')
            expect(typeValues).toContain('DATETIME')
            expect(typeValues).toContain('BLOB')
        })

        it('should have descriptions for each type', () => {
            SQLITE_DATA_TYPES.forEach(type => {
                expect(type.description).toBeDefined()
                expect(type.description.length).toBeGreaterThan(0)
            })
        })
    })

    describe('createDefaultImportConfig', () => {
        it('should create config with default values', () => {
            const config = createDefaultImportConfig()

            expect(config.table_name).toBe('')
            expect(config.overwrite_existing).toBe(false)
            expect(config.column_mappings).toEqual([])
            expect(config.csv_delimiter).toBe(',')
            expect(config.csv_has_header).toBe(true)
            expect(config.excel_sheet_index).toBe(0)
            expect(config.skip_rows).toBe(0)
            expect(config.batch_size).toBe(1000)
        })
    })

    describe('generateColumnMappings', () => {
        it('should generate mappings from preview columns', () => {
            const preview: ImportPreview = {
                columns: ['User Name', 'Age', 'Email Address'],
                rows: [],
                total_rows: 0,
                suggested_types: {
                    'User Name': 'TEXT',
                    Age: 'INTEGER',
                    'Email Address': 'TEXT',
                },
            }

            const mappings = generateColumnMappings(preview, 'users')

            expect(mappings).toHaveLength(3)
            expect(mappings[0]).toEqual({
                source_column: 'User Name',
                target_column: 'user_name',
                data_type: 'TEXT',
                is_primary_key: true,
                nullable: true,
                default_value: undefined,
            })
            expect(mappings[1].is_primary_key).toBe(false)
        })

        it('should sanitize column names', () => {
            const preview: ImportPreview = {
                columns: ['Column 1!', '2nd Column', '___special___', ''],
                rows: [],
                total_rows: 0,
                suggested_types: {},
            }

            const mappings = generateColumnMappings(preview, 'test')

            expect(mappings[0].target_column).toBe('column_1') // Special chars removed
            expect(mappings[1].target_column).toBe('_2nd_column') // Starting with number, prefixed with _
            expect(mappings[2].target_column).toBe('_special_') // Multiple underscores deduplicated to single underscores
            expect(mappings[3].target_column).toBe('column') // Empty becomes 'column'
        })

        it('should use suggested types when available', () => {
            const preview: ImportPreview = {
                columns: ['id', 'price'],
                rows: [],
                total_rows: 0,
                suggested_types: {
                    id: 'INTEGER',
                    price: 'REAL',
                },
            }

            const mappings = generateColumnMappings(preview, 'products')

            expect(mappings[0].data_type).toBe('INTEGER')
            expect(mappings[1].data_type).toBe('REAL')
        })

        it('should default to TEXT when no suggestion', () => {
            const preview: ImportPreview = {
                columns: ['unknown'],
                rows: [],
                total_rows: 0,
                suggested_types: {},
            }

            const mappings = generateColumnMappings(preview, 'test')

            expect(mappings[0].data_type).toBe('TEXT')
        })
    })
})
