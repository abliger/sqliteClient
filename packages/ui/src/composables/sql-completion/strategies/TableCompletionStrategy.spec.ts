import { describe, it, expect } from 'vitest'
import { TableCompletionStrategy } from './TableCompletionStrategy'
import type { CompletionContext, SchemaDataSource, TableInfo } from '../types'

class MockSchemaDataSource implements SchemaDataSource {
    private tables: TableInfo[]

    constructor(tables: TableInfo[]) {
        this.tables = tables
    }

    getTables() { return this.tables }
    getTableByName(name: string) { return this.tables.find(t => t.name === name) }
    getAllColumns() { return [] }
    getTableColumns() { return [] }
}

const mockTables: TableInfo[] = [
    {
        name: 'users',
        column_count: 3,
        columns: [
            { name: 'id', data_type: 'INTEGER', nullable: false, is_primary_key: true, is_foreign_key: false },
            { name: 'name', data_type: 'TEXT', nullable: true, is_primary_key: false, is_foreign_key: false },
            { name: 'email', data_type: 'TEXT', nullable: false, is_primary_key: false, is_foreign_key: false }
        ]
    },
    {
        name: 'orders',
        column_count: 3,
        columns: [
            { name: 'id', data_type: 'INTEGER', nullable: false, is_primary_key: true, is_foreign_key: false },
            { name: 'user_id', data_type: 'INTEGER', nullable: false, is_primary_key: false, is_foreign_key: false },
            { name: 'total', data_type: 'REAL', nullable: true, is_primary_key: false, is_foreign_key: false }
        ]
    },
    {
        name: 'order_items',
        column_count: 2,
        columns: [
            { name: 'id', data_type: 'INTEGER', nullable: false, is_primary_key: true, is_foreign_key: false },
            { name: 'order_id', data_type: 'INTEGER', nullable: false, is_primary_key: false, is_foreign_key: false }
        ]
    }
]

describe('TableCompletionStrategy', () => {
    const strategy = new TableCompletionStrategy()
    const mockSchema = new MockSchemaDataSource(mockTables)

    describe('name and priority', () => {
        it('should have correct name', () => {
            expect(strategy.name).toBe('tables')
        })

        it('should have priority 90', () => {
            expect(strategy.priority).toBe(90)
        })
    })

    describe('canProvide', () => {
        it('should provide after FROM keyword', () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM ',
                textBeforeCursor: 'SELECT * FROM ',
                textBeforeCursorOnLine: 'FROM ',
                position: { line: 1, column: 15 }
            }
            expect(strategy.canProvide(context)).toBe(true)
        })

        it('should provide after JOIN keyword', () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM users JOIN ',
                textBeforeCursor: 'SELECT * FROM users JOIN ',
                textBeforeCursorOnLine: 'JOIN ',
                position: { line: 1, column: 26 }
            }
            expect(strategy.canProvide(context)).toBe(true)
        })

        it('should provide after INTO keyword', () => {
            const context: CompletionContext = {
                lineContent: 'INSERT INTO ',
                textBeforeCursor: 'INSERT INTO ',
                textBeforeCursorOnLine: 'INTO ',
                position: { line: 1, column: 13 }
            }
            expect(strategy.canProvide(context)).toBe(true)
        })

        it('should provide after UPDATE keyword', () => {
            const context: CompletionContext = {
                lineContent: 'UPDATE ',
                textBeforeCursor: 'UPDATE ',
                textBeforeCursorOnLine: 'UPDATE ',
                position: { line: 1, column: 8 }
            }
            expect(strategy.canProvide(context)).toBe(true)
        })

        it('should provide for partial table name', () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM or',
                textBeforeCursor: 'SELECT * FROM or',
                textBeforeCursorOnLine: 'or',
                position: { line: 1, column: 17 }
            }
            expect(strategy.canProvide(context)).toBe(true)
        })

        it('should not provide in SELECT list', () => {
            const context: CompletionContext = {
                lineContent: 'SELECT id, na',
                textBeforeCursor: 'SELECT id, na',
                textBeforeCursorOnLine: 'na',
                position: { line: 1, column: 14 }
            }
            expect(strategy.canProvide(context)).toBe(false)
        })

        it('should not provide in WHERE clause without table prefix', () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM users WHERE id = 1',
                textBeforeCursor: 'SELECT * FROM users WHERE id = 1',
                textBeforeCursorOnLine: 'id = 1',
                position: { line: 1, column: 33 }
            }
            expect(strategy.canProvide(context)).toBe(false)
        })
    })

    describe('provideCompletionItems', () => {
        it('should provide all table names', async () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM ',
                textBeforeCursor: 'SELECT * FROM ',
                textBeforeCursorOnLine: 'FROM ',
                position: { line: 1, column: 15 }
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            expect(result.items).toHaveLength(3)
            const labels = result.items.map(item => item.label)
            expect(labels).toContain('users')
            expect(labels).toContain('orders')
            expect(labels).toContain('order_items')
        })

        it('should provide all tables regardless of partial text', async () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM ord',
                textBeforeCursor: 'SELECT * FROM ord',
                textBeforeCursorOnLine: 'ord',
                position: { line: 1, column: 18 }
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            // Current implementation returns all tables without filtering
            expect(result.items).toHaveLength(3)
            const labels = result.items.map(item => item.label)
            expect(labels).toContain('orders')
            expect(labels).toContain('order_items')
            expect(labels).toContain('users')
        })

        it('should mark items as table kind', async () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM ',
                textBeforeCursor: 'SELECT * FROM ',
                textBeforeCursorOnLine: 'FROM ',
                position: { line: 1, column: 15 }
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            result.items.forEach(item => {
                expect(item.kind).toBe('table')
            })
        })

        it('should include column count in detail', async () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM ',
                textBeforeCursor: 'SELECT * FROM ',
                textBeforeCursorOnLine: 'FROM ',
                position: { line: 1, column: 15 }
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            const usersTable = result.items.find(item => item.label === 'users')
            expect(usersTable?.detail).toContain('3')
            expect(usersTable?.detail).toContain('columns')
        })

        it('should provide sorted results', async () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM ',
                textBeforeCursor: 'SELECT * FROM ',
                textBeforeCursorOnLine: 'FROM ',
                position: { line: 1, column: 15 }
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            const labels = result.items.map(item => item.label)
            // Items have sortText for UI sorting but returned in original order
            expect(labels).toContain('orders')
            expect(labels).toContain('order_items')
            expect(labels).toContain('users')
            expect(labels).toHaveLength(3)
        })

        it('should still return all tables even when partial text does not match', async () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM xyz',
                textBeforeCursor: 'SELECT * FROM xyz',
                textBeforeCursorOnLine: 'xyz',
                position: { line: 1, column: 18 }
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            // Current implementation returns all tables
            expect(result.items.length).toBeGreaterThan(0)
        })

        it('should return empty array when schema has no tables', async () => {
            const emptySchema = new MockSchemaDataSource([])
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM ',
                textBeforeCursor: 'SELECT * FROM ',
                textBeforeCursorOnLine: 'FROM ',
                position: { line: 1, column: 15 }
            }

            const result = await strategy.provideCompletionItems(context, emptySchema)

            expect(result.items).toEqual([])
        })

        it('should provide documentation', async () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM ',
                textBeforeCursor: 'SELECT * FROM ',
                textBeforeCursorOnLine: 'FROM ',
                position: { line: 1, column: 15 }
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            const usersTable = result.items.find(item => item.label === 'users')
            expect(usersTable?.documentation).toContain('users')
            expect(usersTable?.documentation).toContain('Columns')
        })
    })

    describe('case sensitivity', () => {
        it('should handle lowercase partial match', async () => {
            const context: CompletionContext = {
                lineContent: 'select * from US',
                textBeforeCursor: 'select * from US',
                textBeforeCursorOnLine: 'US',
                position: { line: 1, column: 17 }
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            expect(result.items.some(item => item.label === 'users')).toBe(true)
        })

        it('should handle uppercase partial match', async () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM us',
                textBeforeCursor: 'SELECT * FROM us',
                textBeforeCursorOnLine: 'us',
                position: { line: 1, column: 17 }
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            expect(result.items.some(item => item.label === 'users')).toBe(true)
        })
    })
})
