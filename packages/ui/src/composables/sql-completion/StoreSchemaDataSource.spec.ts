import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { StoreSchemaDataSource, StaticSchemaDataSource } from './StoreSchemaDataSource'
import type { TableInfo } from '@types'

// Mock table data
const mockTables: TableInfo[] = [
    {
        name: 'users',
        column_count: 3,
        columns: [
            {
                name: 'id',
                data_type: 'INTEGER',
                nullable: false,
                is_primary_key: true,
                is_foreign_key: false,
            },
            {
                name: 'name',
                data_type: 'TEXT',
                nullable: true,
                is_primary_key: false,
                is_foreign_key: false,
            },
            {
                name: 'email',
                data_type: 'TEXT',
                nullable: false,
                is_primary_key: false,
                is_foreign_key: false,
            },
        ],
    },
    {
        name: 'orders',
        column_count: 4,
        columns: [
            {
                name: 'id',
                data_type: 'INTEGER',
                nullable: false,
                is_primary_key: true,
                is_foreign_key: false,
            },
            {
                name: 'user_id',
                data_type: 'INTEGER',
                nullable: false,
                is_primary_key: false,
                is_foreign_key: true,
                foreign_key: {
                    from_column: 'user_id',
                    to_table: 'users',
                    to_column: 'id',
                    on_update: 'CASCADE',
                    on_delete: 'CASCADE',
                },
            },
            {
                name: 'total',
                data_type: 'REAL',
                nullable: true,
                is_primary_key: false,
                is_foreign_key: false,
            },
            {
                name: 'status',
                data_type: 'TEXT',
                nullable: true,
                is_primary_key: false,
                is_foreign_key: false,
            },
        ],
    },
]

describe('StoreSchemaDataSource', () => {
    const createDataSource = () => {
        const tablesRef = ref(mockTables)
        const getTableByName = vi.fn((name: string) => mockTables.find(t => t.name === name))
        return new StoreSchemaDataSource(tablesRef, getTableByName)
    }

    describe('getTables', () => {
        it('should return all tables', () => {
            const dataSource = createDataSource()
            const tables = dataSource.getTables()

            expect(tables).toHaveLength(2)
            expect(tables[0].name).toBe('users')
            expect(tables[1].name).toBe('orders')
        })

        it('should return reactive tables reference', () => {
            const tablesRef = ref([...mockTables])
            const getTableByName = vi.fn()
            const dataSource = new StoreSchemaDataSource(tablesRef, getTableByName)

            expect(dataSource.getTables()).toHaveLength(2)

            // Add a new table
            tablesRef.value = [
                ...tablesRef.value,
                {
                    name: 'products',
                    column_count: 2,
                    columns: [
                        {
                            name: 'id',
                            data_type: 'INTEGER',
                            nullable: false,
                            is_primary_key: true,
                            is_foreign_key: false,
                        },
                        {
                            name: 'name',
                            data_type: 'TEXT',
                            nullable: true,
                            is_primary_key: false,
                            is_foreign_key: false,
                        },
                    ],
                },
            ]

            expect(dataSource.getTables()).toHaveLength(3)
        })
    })

    describe('getTableByName', () => {
        it('should return table by name', () => {
            const dataSource = createDataSource()
            const table = dataSource.getTableByName('users')

            expect(table).toBeDefined()
            expect(table?.name).toBe('users')
            expect(table?.columns).toHaveLength(3)
        })

        it('should return undefined for non-existent table', () => {
            const dataSource = createDataSource()
            const table = dataSource.getTableByName('nonexistent')

            expect(table).toBeUndefined()
        })

        it('should call the provided getter function', () => {
            const getTableByName = vi.fn((name: string) => mockTables.find(t => t.name === name))
            const tablesRef = ref(mockTables)
            const dataSource = new StoreSchemaDataSource(tablesRef, getTableByName)

            dataSource.getTableByName('orders')
            expect(getTableByName).toHaveBeenCalledWith('orders')
        })
    })

    describe('getAllColumns', () => {
        it('should return all unique column names from all tables', () => {
            const dataSource = createDataSource()
            const columns = dataSource.getAllColumns()

            // Should include: id (appears in both), name, email, user_id, total, status
            expect(columns).toContain('id')
            expect(columns).toContain('name')
            expect(columns).toContain('email')
            expect(columns).toContain('user_id')
            expect(columns).toContain('total')
            expect(columns).toContain('status')
        })

        it('should deduplicate column names', () => {
            const dataSource = createDataSource()
            const columns = dataSource.getAllColumns()

            // 'id' appears in both users and orders, should only appear once
            const idCount = columns.filter(c => c === 'id').length
            expect(idCount).toBe(1)
        })

        it('should return empty array when no tables', () => {
            const tablesRef = ref<TableInfo[]>([])
            const getTableByName = vi.fn()
            const dataSource = new StoreSchemaDataSource(tablesRef, getTableByName)

            expect(dataSource.getAllColumns()).toEqual([])
        })
    })

    describe('getTableColumns', () => {
        it('should return columns for specified table', () => {
            const dataSource = createDataSource()
            const columns = dataSource.getTableColumns('users')

            expect(columns).toHaveLength(3)
            expect(columns[0].name).toBe('id')
            expect(columns[1].name).toBe('name')
            expect(columns[2].name).toBe('email')
        })

        it('should return empty array for non-existent table', () => {
            const dataSource = createDataSource()
            const columns = dataSource.getTableColumns('nonexistent')

            expect(columns).toEqual([])
        })

        it('should return columns with correct types', () => {
            const dataSource = createDataSource()
            const columns = dataSource.getTableColumns('orders')

            const totalColumn = columns.find(c => c.name === 'total')
            expect(totalColumn?.data_type).toBe('REAL')
            expect(totalColumn?.nullable).toBe(true)
        })

        it('should identify primary and foreign keys', () => {
            const dataSource = createDataSource()
            const columns = dataSource.getTableColumns('orders')

            const idColumn = columns.find(c => c.name === 'id')
            expect(idColumn?.is_primary_key).toBe(true)
            expect(idColumn?.is_foreign_key).toBe(false)

            const userIdColumn = columns.find(c => c.name === 'user_id')
            expect(userIdColumn?.is_primary_key).toBe(false)
            expect(userIdColumn?.is_foreign_key).toBe(true)
        })
    })
})

// Create fresh copy of tables for each test to avoid mutation issues
const createMockTables = (): TableInfo[] => [
    {
        name: 'users',
        column_count: 3,
        columns: [
            {
                name: 'id',
                data_type: 'INTEGER',
                nullable: false,
                is_primary_key: true,
                is_foreign_key: false,
            },
            {
                name: 'name',
                data_type: 'TEXT',
                nullable: true,
                is_primary_key: false,
                is_foreign_key: false,
            },
            {
                name: 'email',
                data_type: 'TEXT',
                nullable: false,
                is_primary_key: false,
                is_foreign_key: false,
            },
        ],
    },
    {
        name: 'orders',
        column_count: 3,
        columns: [
            {
                name: 'id',
                data_type: 'INTEGER',
                nullable: false,
                is_primary_key: true,
                is_foreign_key: false,
            },
            {
                name: 'user_id',
                data_type: 'INTEGER',
                nullable: false,
                is_primary_key: false,
                is_foreign_key: false,
            },
            {
                name: 'total',
                data_type: 'REAL',
                nullable: true,
                is_primary_key: false,
                is_foreign_key: false,
            },
        ],
    },
]

describe('StaticSchemaDataSource', () => {
    describe('constructor and basic operations', () => {
        it('should create with empty tables by default', () => {
            const dataSource = new StaticSchemaDataSource()
            expect(dataSource.getTables()).toEqual([])
        })

        it('should create with provided tables', () => {
            const dataSource = new StaticSchemaDataSource(createMockTables())
            expect(dataSource.getTables()).toHaveLength(2)
        })
    })

    describe('getTables', () => {
        it('should return all tables', () => {
            const dataSource = new StaticSchemaDataSource(createMockTables())
            const tables = dataSource.getTables()

            expect(tables).toHaveLength(2)
            expect(tables[0].name).toBe('users')
        })
    })

    describe('getTableByName', () => {
        it('should find table by name', () => {
            const dataSource = new StaticSchemaDataSource(createMockTables())
            const table = dataSource.getTableByName('orders')

            expect(table?.name).toBe('orders')
        })

        it('should return undefined for unknown table', () => {
            const dataSource = new StaticSchemaDataSource(createMockTables())
            const table = dataSource.getTableByName('unknown')

            expect(table).toBeUndefined()
        })
    })

    describe('getAllColumns', () => {
        it('should return all unique columns', () => {
            const dataSource = new StaticSchemaDataSource(createMockTables())
            const columns = dataSource.getAllColumns()

            expect(columns.length).toBeGreaterThan(0)
            expect(new Set(columns).size).toBe(columns.length) // No duplicates
        })
    })

    describe('getTableColumns', () => {
        it('should return columns for table', () => {
            const dataSource = new StaticSchemaDataSource(createMockTables())
            const columns = dataSource.getTableColumns('users')

            expect(columns).toHaveLength(3)
        })
    })

    describe('addTable', () => {
        it('should add a new table', () => {
            const dataSource = new StaticSchemaDataSource()
            const newTable: TableInfo = {
                name: 'products',
                column_count: 2,
                columns: [
                    {
                        name: 'id',
                        data_type: 'INTEGER',
                        nullable: false,
                        is_primary_key: true,
                        is_foreign_key: false,
                    },
                    {
                        name: 'name',
                        data_type: 'TEXT',
                        nullable: true,
                        is_primary_key: false,
                        is_foreign_key: false,
                    },
                ],
            }

            dataSource.addTable(newTable)
            expect(dataSource.getTables()).toHaveLength(1)
            expect(dataSource.getTableByName('products')).toBeDefined()
        })

        it('should update existing table', () => {
            const dataSource = new StaticSchemaDataSource(createMockTables())
            const updatedTable: TableInfo = {
                name: 'users',
                column_count: 4,
                columns: [
                    ...createMockTables()[0].columns,
                    {
                        name: 'created_at',
                        data_type: 'TIMESTAMP',
                        nullable: true,
                        is_primary_key: false,
                        is_foreign_key: false,
                    },
                ],
            }

            dataSource.addTable(updatedTable)
            expect(dataSource.getTables()).toHaveLength(2)
            expect(dataSource.getTableByName('users')?.column_count).toBe(4)
        })
    })

    describe('removeTable', () => {
        it('should remove a table', () => {
            const dataSource = new StaticSchemaDataSource(createMockTables())
            dataSource.removeTable('users')

            expect(dataSource.getTables()).toHaveLength(1)
            expect(dataSource.getTableByName('users')).toBeUndefined()
        })

        it('should handle removing non-existent table gracefully', () => {
            const dataSource = new StaticSchemaDataSource(createMockTables())
            const initialCount = dataSource.getTables().length
            // Should not throw when removing non-existent table
            expect(() => dataSource.removeTable('nonexistent')).not.toThrow()
            // Table count should remain unchanged
            expect(dataSource.getTables()).toHaveLength(initialCount)
        })
    })

    describe('clear', () => {
        it('should remove all tables', () => {
            const dataSource = new StaticSchemaDataSource(createMockTables())
            dataSource.clear()

            expect(dataSource.getTables()).toEqual([])
            expect(dataSource.getAllColumns()).toEqual([])
        })
    })
})
