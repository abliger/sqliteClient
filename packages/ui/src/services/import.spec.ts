import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    importService,
    createDefaultImportConfig,
    generateColumnMappings,
    SQLITE_DATA_TYPES,
} from './import'
import * as tauriApi from '@tauri-apps/api/core'
import type { ImportPreview, ImportConfig, ImportResult } from './import'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}))

describe('importService', () => {
    const mockInvoke = vi.mocked(tauriApi.invoke)

    beforeEach(() => {
        mockInvoke.mockClear()
    })

    describe('getSupportedFormats', () => {
        it('should return supported import formats', async () => {
            const mockFormats = [
                { extension: 'csv', name: 'CSV', description: 'Comma Separated Values' },
                { extension: 'xlsx', name: 'Excel', description: 'Excel 2007+' },
            ]
            mockInvoke.mockResolvedValue(mockFormats)

            const result = await importService.getSupportedFormats()

            expect(mockInvoke).toHaveBeenCalledWith('get_supported_import_formats')
            expect(result).toEqual(mockFormats)
        })
    })

    describe('parseImportFile', () => {
        it('should parse import file and return preview', async () => {
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
            mockInvoke.mockResolvedValue(mockPreview)

            const result = await importService.parseImportFile('/path/to/file.csv', 'csv')

            expect(mockInvoke).toHaveBeenCalledWith('parse_import_file', {
                filePath: '/path/to/file.csv',
                fileType: 'csv',
            })
            expect(result).toEqual(mockPreview)
        })
    })

    describe('detectColumnTypes', () => {
        it('should detect column types from preview data', async () => {
            const mockTypes = {
                name: 'TEXT',
                age: 'INTEGER',
                price: 'REAL',
                is_active: 'BOOLEAN',
            }
            mockInvoke.mockResolvedValue(mockTypes)

            const previewData = [{ name: 'Test', age: '30', price: '99.99', is_active: 'true' }]
            const result = await importService.detectColumnTypes(previewData)

            expect(mockInvoke).toHaveBeenCalledWith('detect_column_types', { previewData })
            expect(result).toEqual(mockTypes)
        })
    })

    describe('executeImport', () => {
        it('should execute import and return result', async () => {
            const mockResult: ImportResult = {
                imported_rows: 100,
                failed_rows: 0,
                errors: [],
                table_name: 'users',
                duration_ms: 1500,
            }
            mockInvoke.mockResolvedValue(mockResult)

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

            expect(mockInvoke).toHaveBeenCalledWith('execute_import', {
                connectionId: 'conn-1',
                config,
                previewData,
            })
            expect(result).toEqual(mockResult)
        })

        it('should handle partial import with errors', async () => {
            const mockResult: ImportResult = {
                imported_rows: 95,
                failed_rows: 5,
                errors: ['Row 10: Invalid data', 'Row 20: Type mismatch'],
                table_name: 'products',
                duration_ms: 2000,
            }
            mockInvoke.mockResolvedValue(mockResult)

            const config = createDefaultImportConfig()
            const result = await importService.executeImport('conn-1', config, [])

            expect(result.imported_rows).toBe(95)
            expect(result.failed_rows).toBe(5)
            expect(result.errors).toHaveLength(2)
        })
    })

    describe('validateTableName', () => {
        it('should return true for valid table name', async () => {
            mockInvoke.mockResolvedValue(true)

            const result = await importService.validateTableName('conn-1', 'users')

            expect(mockInvoke).toHaveBeenCalledWith('validate_table_name', {
                connectionId: 'conn-1',
                tableName: 'users',
            })
            expect(result).toBe(true)
        })

        it('should return false for invalid table name', async () => {
            mockInvoke.mockResolvedValue(false)

            const result = await importService.validateTableName('conn-1', 'sqlite_invalid')

            expect(result).toBe(false)
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

            expect(mappings[0].target_column).toBe('column_1')  // Special chars removed
            expect(mappings[1].target_column).toBe('_2nd_column')  // Starting with number, prefixed with _
            expect(mappings[2].target_column).toBe('_special_')  // Multiple underscores deduplicated to single underscores
            expect(mappings[3].target_column).toBe('column')  // Empty becomes 'column'
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

    describe('error handling', () => {
        it('should propagate errors from invoke', async () => {
            const error = new Error('File not found')
            mockInvoke.mockRejectedValue(error)

            await expect(importService.parseImportFile('/invalid/path', 'csv')).rejects.toThrow(
                'File not found',
            )
        })
    })
})
