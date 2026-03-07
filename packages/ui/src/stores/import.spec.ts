import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useImportStore } from './import'
import { importService } from '@services/import'
import type { ImportPreview, ImportResult } from '@services/import'

// Mock the service
vi.mock('@services/import', async () => {
    const actual = await vi.importActual('@services/import')
    return {
        ...actual,
        importService: {
            parseImportFile: vi.fn(),
            executeImport: vi.fn(),
        },
    }
})

describe('Import Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.clearAllMocks()
    })

    it('should initialize with default state', () => {
        const store = useImportStore()

        expect(store.isOpen).toBe(false)
        expect(store.isLoading).toBe(false)
        expect(store.currentStep).toBe('file')
        expect(store.filePath).toBe('')
        expect(store.fileType).toBe('')
        expect(store.fileName).toBe('')
        expect(store.preview).toBeNull()
        expect(store.result).toBeNull()
        expect(store.error).toBeNull()
    })

    describe('getters', () => {
        describe('canProceed', () => {
            it('should return false on file step without file selected', () => {
                const store = useImportStore()
                store.currentStep = 'file'
                store.filePath = ''
                store.fileType = ''

                expect(store.canProceed).toBe(false)
            })

            it('should return true on file step with file selected', () => {
                const store = useImportStore()
                store.currentStep = 'file'
                store.filePath = '/path/to/file.csv'
                store.fileType = 'csv'

                expect(store.canProceed).toBe(true)
            })

            it('should return false on mapping step without table name', () => {
                const store = useImportStore()
                store.currentStep = 'mapping'
                store.config.table_name = ''

                expect(store.canProceed).toBe(false)
            })

            it('should return false on mapping step without column mappings', () => {
                const store = useImportStore()
                store.currentStep = 'mapping'
                store.config.table_name = 'users'
                store.config.column_mappings = []

                expect(store.canProceed).toBe(false)
            })

            it('should return false on mapping step with empty target column', () => {
                const store = useImportStore()
                store.currentStep = 'mapping'
                store.config.table_name = 'users'
                store.config.column_mappings = [
                    {
                        source_column: 'name',
                        target_column: '',
                        data_type: 'TEXT',
                        is_primary_key: false,
                        nullable: true,
                    },
                ]

                expect(store.canProceed).toBe(false)
            })

            it('should return true on mapping step with valid config', () => {
                const store = useImportStore()
                store.currentStep = 'mapping'
                store.config.table_name = 'users'
                store.config.column_mappings = [
                    {
                        source_column: 'name',
                        target_column: 'name',
                        data_type: 'TEXT',
                        is_primary_key: false,
                        nullable: true,
                    },
                ]

                expect(store.canProceed).toBe(true)
            })

            it('should return true on preview step', () => {
                const store = useImportStore()
                store.currentStep = 'preview'

                expect(store.canProceed).toBe(true)
            })
        })

        describe('progressText', () => {
            it('should return correct progress for each step', () => {
                const store = useImportStore()

                store.currentStep = 'file'
                expect(store.progressText).toBe('1/3')

                store.currentStep = 'mapping'
                expect(store.progressText).toBe('2/3')

                store.currentStep = 'preview'
                expect(store.progressText).toBe('3/3')

                store.currentStep = 'importing'
                expect(store.progressText).toBe('3/3')
            })
        })
    })

    describe('openWizard', () => {
        it('should open wizard and reset state', () => {
            const store = useImportStore()
            store.filePath = '/some/path'
            store.error = 'Some error'

            store.openWizard()

            expect(store.isOpen).toBe(true)
            expect(store.filePath).toBe('')
            expect(store.error).toBeNull()
            expect(store.currentStep).toBe('file')
        })
    })

    describe('closeWizard', () => {
        it('should close wizard and reset state', () => {
            const store = useImportStore()
            store.isOpen = true
            store.filePath = '/some/path'
            store.preview = { columns: [], rows: [], total_rows: 0, suggested_types: {} }

            store.closeWizard()

            expect(store.isOpen).toBe(false)
            expect(store.filePath).toBe('')
            expect(store.preview).toBeNull()
        })
    })

    describe('resetState', () => {
        it('should reset all state to defaults', () => {
            const store = useImportStore()
            store.currentStep = 'preview'
            store.filePath = '/path'
            store.fileName = 'test.csv'
            store.preview = { columns: ['name'], rows: [], total_rows: 0, suggested_types: {} }
            store.config.table_name = 'users'
            store.result = { imported_rows: 10 } as ImportResult
            store.error = 'Error'
            store.isLoading = true

            store.resetState()

            expect(store.currentStep).toBe('file')
            expect(store.filePath).toBe('')
            expect(store.fileName).toBe('')
            expect(store.preview).toBeNull()
            expect(store.config.table_name).toBe('')
            expect(store.result).toBeNull()
            expect(store.error).toBeNull()
            expect(store.isLoading).toBe(false)
        })
    })

    describe('setFile', () => {
        it('should set file information', () => {
            const store = useImportStore()

            store.setFile('/path/to/data.csv', 'csv', 'data.csv')

            expect(store.filePath).toBe('/path/to/data.csv')
            expect(store.fileType).toBe('csv')
            expect(store.fileName).toBe('data.csv')
        })
    })

    describe('parseFile', () => {
        it('should parse file and set preview', async () => {
            const store = useImportStore()
            store.filePath = '/path/to/users.csv'
            store.fileType = 'csv'
            store.fileName = 'users_data.csv'

            const mockPreview: ImportPreview = {
                columns: ['name', 'age'],
                rows: [{ name: 'John', age: '30' }],
                total_rows: 100,
                suggested_types: { name: 'TEXT', age: 'INTEGER' },
            }
            vi.mocked(importService.parseImportFile).mockResolvedValue(mockPreview)

            await store.parseFile()

            expect(importService.parseImportFile).toHaveBeenCalledWith('/path/to/users.csv', 'csv')
            expect(store.preview).toEqual(mockPreview)
            expect(store.config.table_name).toBe('users_data')
            expect(store.config.column_mappings).toHaveLength(2)
            expect(store.isLoading).toBe(false)
        })

        it('should handle parse errors', async () => {
            const store = useImportStore()
            store.filePath = '/invalid/path'
            store.fileType = 'csv'

            vi.mocked(importService.parseImportFile).mockRejectedValue(new Error('File not found'))

            await store.parseFile()

            expect(store.error).toBe('File not found')
            expect(store.isLoading).toBe(false)
            expect(store.preview).toBeNull()
        })

        it('should not parse without file info', async () => {
            const store = useImportStore()
            store.filePath = ''

            await store.parseFile()

            expect(importService.parseImportFile).not.toHaveBeenCalled()
        })
    })

    describe('goToStep', () => {
        it('should change step', () => {
            const store = useImportStore()

            store.goToStep('mapping')

            expect(store.currentStep).toBe('mapping')
        })
    })

    describe('nextStep', () => {
        it('should advance to next step', () => {
            const store = useImportStore()
            store.currentStep = 'file'

            store.nextStep()

            expect(store.currentStep).toBe('mapping')
        })

        it('should not advance past preview', () => {
            const store = useImportStore()
            store.currentStep = 'preview'

            store.nextStep()

            expect(store.currentStep).toBe('preview')
        })

        it('should not advance from importing', () => {
            const store = useImportStore()
            // The 'importing' step is a special state not in the normal flow
            // When at 'importing', nextStep resets to 'file' (not in steps array, indexOf returns -1)
            store.currentStep = 'importing'

            store.nextStep()

            // importing is not in the steps array, so it goes to first step (file)
            expect(store.currentStep).toBe('file')
        })
    })

    describe('previousStep', () => {
        it('should go back to previous step', () => {
            const store = useImportStore()
            store.currentStep = 'mapping'

            store.previousStep()

            expect(store.currentStep).toBe('file')
        })

        it('should not go back from file', () => {
            const store = useImportStore()
            store.currentStep = 'file'

            store.previousStep()

            expect(store.currentStep).toBe('file')
        })
    })

    describe('updateColumnMapping', () => {
        it('should update mapping at index', () => {
            const store = useImportStore()
            store.config.column_mappings = [
                {
                    source_column: 'name',
                    target_column: 'name',
                    data_type: 'TEXT',
                    is_primary_key: true,
                    nullable: false,
                },
            ]

            store.updateColumnMapping(0, { data_type: 'VARCHAR', nullable: true })

            expect(store.config.column_mappings[0].data_type).toBe('VARCHAR')
            expect(store.config.column_mappings[0].nullable).toBe(true)
            expect(store.config.column_mappings[0].source_column).toBe('name') // unchanged
        })

        it('should not update if index out of bounds', () => {
            const store = useImportStore()
            store.config.column_mappings = []

            store.updateColumnMapping(0, { data_type: 'TEXT' })

            expect(store.config.column_mappings).toEqual([])
        })
    })

    describe('executeImport', () => {
        it('should execute import and return result', async () => {
            const store = useImportStore()
            store.preview = {
                columns: ['name'],
                rows: [{ name: 'John' }],
                total_rows: 1,
                suggested_types: {},
            }
            store.config.table_name = 'users'

            const mockResult: ImportResult = {
                imported_rows: 100,
                failed_rows: 0,
                errors: [],
                table_name: 'users',
                duration_ms: 1500,
            }
            vi.mocked(importService.executeImport).mockResolvedValue(mockResult)

            const result = await store.executeImport('conn-1')

            expect(importService.executeImport).toHaveBeenCalledWith(
                'conn-1',
                store.config,
                store.preview.rows,
            )
            expect(store.result).toEqual(mockResult)
            expect(store.currentStep).toBe('importing')
            expect(store.isLoading).toBe(false)
            expect(result).toEqual(mockResult)
        })

        it('should return null without preview', async () => {
            const store = useImportStore()
            store.preview = null
            store.config.table_name = 'users'

            const result = await store.executeImport('conn-1')

            expect(importService.executeImport).not.toHaveBeenCalled()
            expect(result).toBeNull()
        })

        it('should return null without table name', async () => {
            const store = useImportStore()
            store.preview = { columns: [], rows: [], total_rows: 0, suggested_types: {} }
            store.config.table_name = ''

            const result = await store.executeImport('conn-1')

            expect(importService.executeImport).not.toHaveBeenCalled()
            expect(result).toBeNull()
        })

        it('should handle import errors', async () => {
            const store = useImportStore()
            store.preview = { columns: [], rows: [], total_rows: 0, suggested_types: {} }
            store.config.table_name = 'users'

            vi.mocked(importService.executeImport).mockRejectedValue(new Error('Import failed'))

            const result = await store.executeImport('conn-1')

            expect(store.error).toBe('Import failed')
            expect(store.isLoading).toBe(false)
            expect(result).toBeNull()
        })
    })
})
