import { describe, it, expect } from 'vitest'
import { KeywordCompletionStrategy } from './KeywordCompletionStrategy'
import type { CompletionContext, SchemaDataSource } from '../types'

class MockSchemaDataSource implements SchemaDataSource {
    getTables() {
        return []
    }
    getTableByName() {
        return undefined
    }
    getAllColumns() {
        return []
    }
    getTableColumns() {
        return []
    }
}

describe('KeywordCompletionStrategy', () => {
    const strategy = new KeywordCompletionStrategy()
    const mockSchema = new MockSchemaDataSource()

    describe('name and priority', () => {
        it('should have correct name', () => {
            expect(strategy.name).toBe('keywords')
        })

        it('should have priority 100', () => {
            expect(strategy.priority).toBe(100)
        })
    })

    describe('canProvide', () => {
        it('should provide completions for empty context', () => {
            const context: CompletionContext = {
                lineContent: '',
                textBeforeCursor: '',
                textBeforeCursorOnLine: '',
                position: { line: 1, column: 1 },
            }
            expect(strategy.canProvide(context)).toBe(true)
        })

        it('should provide completions at start of line', () => {
            const context: CompletionContext = {
                lineContent: 'SEL',
                textBeforeCursor: 'SEL',
                textBeforeCursorOnLine: 'SEL',
                position: { line: 1, column: 4 },
            }
            expect(strategy.canProvide(context)).toBe(true)
        })

        it('should provide completions after space', () => {
            const context: CompletionContext = {
                lineContent: 'SELECT * FROM ',
                textBeforeCursor: 'SELECT * FROM ',
                textBeforeCursorOnLine: 'FROM ',
                position: { line: 1, column: 15 },
            }
            expect(strategy.canProvide(context)).toBe(true)
        })

        it('should provide completions for partial keyword', () => {
            const context: CompletionContext = {
                lineContent: 'WHERE sta',
                textBeforeCursor: 'WHERE sta',
                textBeforeCursorOnLine: 'sta',
                position: { line: 1, column: 10 },
            }
            expect(strategy.canProvide(context)).toBe(true)
        })
    })

    describe('provideCompletionItems', () => {
        it('should provide SQL keywords', async () => {
            const context: CompletionContext = {
                lineContent: '',
                textBeforeCursor: '',
                textBeforeCursorOnLine: '',
                position: { line: 1, column: 1 },
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            expect(result.items.length).toBeGreaterThan(0)
            // Check for common SQL keywords
            const labels = result.items.map(item => item.label)
            expect(labels).toContain('SELECT')
            expect(labels).toContain('FROM')
            expect(labels).toContain('WHERE')
            expect(labels).toContain('INSERT')
            expect(labels).toContain('UPDATE')
            expect(labels).toContain('DELETE')
        })

        it('should provide all keywords regardless of partial match', async () => {
            const context: CompletionContext = {
                lineContent: 'SEL',
                textBeforeCursor: 'SEL',
                textBeforeCursorOnLine: 'SEL',
                position: { line: 1, column: 4 },
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            // Current implementation returns all keywords without filtering
            expect(result.items.some(item => item.label === 'SELECT')).toBe(true)
            expect(result.items.some(item => item.label === 'INSERT')).toBe(true)
            expect(result.items.length).toBeGreaterThan(10)
        })

        it('should provide basic SQL keywords', async () => {
            const context: CompletionContext = {
                lineContent: '',
                textBeforeCursor: '',
                textBeforeCursorOnLine: '',
                position: { line: 1, column: 1 },
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            expect(result.items.some(item => item.label === 'INSERT')).toBe(true)
            expect(result.items.some(item => item.label === 'UPDATE')).toBe(true)
            expect(result.items.some(item => item.label === 'DELETE')).toBe(true)
            expect(result.items.some(item => item.label === 'JOIN')).toBe(true)
            expect(result.items.some(item => item.label === 'ORDER')).toBe(true)
            expect(result.items.some(item => item.label === 'GROUP')).toBe(true)
            expect(result.items.some(item => item.label === 'CASE')).toBe(true)
        })

        it('should have sortText for ordering', async () => {
            const context: CompletionContext = {
                lineContent: '',
                textBeforeCursor: '',
                textBeforeCursorOnLine: '',
                position: { line: 1, column: 1 },
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            const selectItem = result.items.find(item => item.label === 'SELECT')
            expect(selectItem?.sortText).toBeDefined()
        })

        it('should provide detail for keywords', async () => {
            const context: CompletionContext = {
                lineContent: '',
                textBeforeCursor: '',
                textBeforeCursorOnLine: '',
                position: { line: 1, column: 1 },
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            const selectItem = result.items.find(item => item.label === 'SELECT')
            expect(selectItem?.detail).toBeDefined()
            expect(selectItem?.detail).toContain('Keyword')
        })
    })

    describe('completion item kind', () => {
        it('should mark single keywords as keyword kind', async () => {
            const context: CompletionContext = {
                lineContent: '',
                textBeforeCursor: '',
                textBeforeCursorOnLine: '',
                position: { line: 1, column: 1 },
            }

            const result = await strategy.provideCompletionItems(context, mockSchema)

            const singleKeyword = result.items.find(item => item.label === 'FROM')
            expect(singleKeyword?.kind).toBe('keyword')
        })
    })
})
