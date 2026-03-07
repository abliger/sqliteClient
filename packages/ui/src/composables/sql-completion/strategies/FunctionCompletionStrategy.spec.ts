import { describe, it, expect } from 'vitest'
import { FunctionCompletionStrategy } from './FunctionCompletionStrategy'
import type { CompletionContext, SchemaDataSource } from '../types'
import { CompletionItemKind } from '../types'

// Mock SchemaDataSource
const mockSchemaSource: SchemaDataSource = {
  getTables: () => [],
  getTableByName: () => undefined,
  getAllColumns: () => [],
  getTableColumns: () => []
}

describe('FunctionCompletionStrategy', () => {
  describe('constructor', () => {
    it('should initialize with default functions', () => {
      const strategy = new FunctionCompletionStrategy()
      
      expect(strategy.name).toBe('functions')
      expect(strategy.priority).toBe(80)
    })

    it('should accept custom functions', () => {
      const customFunctions = [
        { name: 'custom_func', snippet: 'custom_func($1)', desc: 'Custom function' }
      ]
      
      const strategy = new FunctionCompletionStrategy(customFunctions)
      
      expect(strategy).toBeDefined()
    })
  })

  describe('canProvide', () => {
    const strategy = new FunctionCompletionStrategy()

    it('should provide completion after SELECT', () => {
      const context: CompletionContext = {
        lineContent: 'SELECT ',
        textBeforeCursor: 'SELECT ',
        textBeforeCursorOnLine: 'SELECT ',
        position: { line: 1, column: 7 }
      }

      expect(strategy.canProvide(context)).toBe(true)
    })

    it('should provide completion after WHERE', () => {
      const context: CompletionContext = {
        lineContent: 'WHERE ',
        textBeforeCursor: 'SELECT * FROM users WHERE ',
        textBeforeCursorOnLine: 'WHERE ',
        position: { line: 1, column: 6 }
      }

      expect(strategy.canProvide(context)).toBe(true)
    })

    it('should provide completion after AND', () => {
      const context: CompletionContext = {
        lineContent: 'AND ',
        textBeforeCursor: 'SELECT * FROM users WHERE id = 1 AND ',
        textBeforeCursorOnLine: 'AND ',
        position: { line: 1, column: 4 }
      }

      expect(strategy.canProvide(context)).toBe(true)
    })

    it('should provide completion after OR', () => {
      const context: CompletionContext = {
        lineContent: 'OR ',
        textBeforeCursor: 'SELECT * FROM users WHERE id = 1 OR ',
        textBeforeCursorOnLine: 'OR ',
        position: { line: 1, column: 3 }
      }

      expect(strategy.canProvide(context)).toBe(true)
    })

    it('should provide completion after HAVING', () => {
      const context: CompletionContext = {
        lineContent: 'HAVING ',
        textBeforeCursor: 'SELECT * FROM users GROUP BY id HAVING ',
        textBeforeCursorOnLine: 'HAVING ',
        position: { line: 1, column: 7 }
      }

      expect(strategy.canProvide(context)).toBe(true)
    })

    it('should provide completion after ORDER BY', () => {
      const context: CompletionContext = {
        lineContent: 'ORDER BY ',
        textBeforeCursor: 'SELECT * FROM users ORDER BY ',
        textBeforeCursorOnLine: 'ORDER BY ',
        position: { line: 1, column: 9 }
      }

      expect(strategy.canProvide(context)).toBe(true)
    })

    it('should provide completion after GROUP BY', () => {
      const context: CompletionContext = {
        lineContent: 'GROUP BY ',
        textBeforeCursor: 'SELECT * FROM users GROUP BY ',
        textBeforeCursorOnLine: 'GROUP BY ',
        position: { line: 1, column: 9 }
      }

      expect(strategy.canProvide(context)).toBe(true)
    })

    it('should provide completion after operator', () => {
      const contexts: CompletionContext[] = [
        { lineContent: '= ', textBeforeCursor: 'WHERE id = ', textBeforeCursorOnLine: '= ', position: { line: 1, column: 2 } },
        { lineContent: '< ', textBeforeCursor: 'WHERE id < ', textBeforeCursorOnLine: '< ', position: { line: 1, column: 2 } },
        { lineContent: '> ', textBeforeCursor: 'WHERE id > ', textBeforeCursorOnLine: '> ', position: { line: 1, column: 2 } },
        { lineContent: '+ ', textBeforeCursor: 'SELECT 1 + ', textBeforeCursorOnLine: '+ ', position: { line: 1, column: 2 } },
        { lineContent: '- ', textBeforeCursor: 'SELECT 1 - ', textBeforeCursorOnLine: '- ', position: { line: 1, column: 2 } },
        { lineContent: '* ', textBeforeCursor: 'SELECT 1 * ', textBeforeCursorOnLine: '* ', position: { line: 1, column: 2 } },
        { lineContent: '/ ', textBeforeCursor: 'SELECT 1 / ', textBeforeCursorOnLine: '/ ', position: { line: 1, column: 2 } }
      ]

      contexts.forEach(context => {
        expect(strategy.canProvide(context)).toBe(true)
      })
    })

    it('should provide completion after comma', () => {
      const context: CompletionContext = {
        lineContent: ', ',
        textBeforeCursor: 'SELECT id, ',
        textBeforeCursorOnLine: ', ',
        position: { line: 1, column: 2 }
      }

      expect(strategy.canProvide(context)).toBe(true)
    })

    it('should provide completion after opening parenthesis', () => {
      const context: CompletionContext = {
        lineContent: '(',
        textBeforeCursor: 'SELECT COUNT(',
        textBeforeCursorOnLine: '(',
        position: { line: 1, column: 1 }
      }

      expect(strategy.canProvide(context)).toBe(true)
    })

    it('should provide completion after operators', () => {
      // Test that operators trigger function completion
      const contexts: CompletionContext[] = [
        { lineContent: '= ', textBeforeCursor: 'WHERE id = ', textBeforeCursorOnLine: '= ', position: { line: 1, column: 2 } },
        { lineContent: '< ', textBeforeCursor: 'WHERE id < ', textBeforeCursorOnLine: '< ', position: { line: 1, column: 2 } },
        { lineContent: '(', textBeforeCursor: 'SELECT COUNT(', textBeforeCursorOnLine: '(', position: { line: 1, column: 1 } }
      ]

      contexts.forEach(context => {
        expect(strategy.canProvide(context)).toBe(true)
      })
    })

    it('should provide completion in WHERE clause', () => {
      const context: CompletionContext = {
        lineContent: 'WHERE ',
        textBeforeCursor: 'SELECT * FROM users WHERE ',
        textBeforeCursorOnLine: 'WHERE ',
        position: { line: 1, column: 6 }
      }

      // WHERE clause should trigger function completion
      expect(strategy.canProvide(context)).toBe(true)
    })
  })

  describe('provideCompletionItems', () => {
    it('should provide default SQLite functions', async () => {
      const strategy = new FunctionCompletionStrategy()
      const context: CompletionContext = {
        lineContent: 'SELECT ',
        textBeforeCursor: 'SELECT ',
        textBeforeCursorOnLine: 'SELECT ',
        position: { line: 1, column: 7 }
      }

      const result = await strategy.provideCompletionItems(context, mockSchemaSource)

      expect(result.items.length).toBeGreaterThan(0)
      expect(result.items.some(item => item.label === 'count')).toBe(true)
      expect(result.items.some(item => item.label === 'max')).toBe(true)
      expect(result.items.some(item => item.label === 'min')).toBe(true)
      expect(result.items.some(item => item.label === 'sum')).toBe(true)
      expect(result.items.some(item => item.label === 'avg')).toBe(true)
    })

    it('should include function details', async () => {
      const strategy = new FunctionCompletionStrategy()
      const context: CompletionContext = {
        lineContent: 'SELECT ',
        textBeforeCursor: 'SELECT ',
        textBeforeCursorOnLine: 'SELECT ',
        position: { line: 1, column: 7 }
      }

      const result = await strategy.provideCompletionItems(context, mockSchemaSource)
      const countFunc = result.items.find(item => item.label === 'count')

      expect(countFunc).toBeDefined()
      expect(countFunc!.kind).toBe(CompletionItemKind.Function)
      expect(countFunc!.detail).toBe('SQLite Function')
      expect(countFunc!.documentation).toBeDefined()
    })

    it('should include insert text with snippet placeholders', async () => {
      const strategy = new FunctionCompletionStrategy()
      const context: CompletionContext = {
        lineContent: 'SELECT ',
        textBeforeCursor: 'SELECT ',
        textBeforeCursorOnLine: 'SELECT ',
        position: { line: 1, column: 7 }
      }

      const result = await strategy.provideCompletionItems(context, mockSchemaSource)
      const countFunc = result.items.find(item => item.label === 'count')

      expect(countFunc!.insertText).toContain('$1')
    })

    it('should have sort text prefix for functions', async () => {
      const strategy = new FunctionCompletionStrategy()
      const context: CompletionContext = {
        lineContent: 'SELECT ',
        textBeforeCursor: 'SELECT ',
        textBeforeCursorOnLine: 'SELECT ',
        position: { line: 1, column: 7 }
      }

      const result = await strategy.provideCompletionItems(context, mockSchemaSource)
      const func = result.items[0]

      expect(func.sortText).toMatch(/^1_/)
    })

    it('should include custom functions', async () => {
      const customFunctions = [
        { name: 'my_custom_func', snippet: 'my_custom_func($1)', desc: 'My custom function' }
      ]
      const strategy = new FunctionCompletionStrategy(customFunctions)
      const context: CompletionContext = {
        lineContent: 'SELECT ',
        textBeforeCursor: 'SELECT ',
        textBeforeCursorOnLine: 'SELECT ',
        position: { line: 1, column: 7 }
      }

      const result = await strategy.provideCompletionItems(context, mockSchemaSource)

      expect(result.items.some(item => item.label === 'my_custom_func')).toBe(true)
    })

    it('should include common SQLite functions', async () => {
      const strategy = new FunctionCompletionStrategy()
      const context: CompletionContext = {
        lineContent: 'SELECT ',
        textBeforeCursor: 'SELECT ',
        textBeforeCursorOnLine: 'SELECT ',
        position: { line: 1, column: 7 }
      }

      const result = await strategy.provideCompletionItems(context, mockSchemaSource)
      const labels = result.items.map(item => item.label)

      // Common functions
      expect(labels).toContain('abs')
      expect(labels).toContain('coalesce')
      expect(labels).toContain('date')
      expect(labels).toContain('datetime')
      expect(labels).toContain('length')
      expect(labels).toContain('lower')
      expect(labels).toContain('upper')
      expect(labels).toContain('replace')
      expect(labels).toContain('round')
      expect(labels).toContain('substr')
      expect(labels).toContain('trim')
    })

    it('should include JSON functions', async () => {
      const strategy = new FunctionCompletionStrategy()
      const context: CompletionContext = {
        lineContent: 'SELECT ',
        textBeforeCursor: 'SELECT ',
        textBeforeCursorOnLine: 'SELECT ',
        position: { line: 1, column: 7 }
      }

      const result = await strategy.provideCompletionItems(context, mockSchemaSource)
      const labels = result.items.map(item => item.label)

      expect(labels).toContain('json_extract')
      expect(labels).toContain('json_array')
      expect(labels).toContain('json_object')
    })

    it('should include aggregate functions', async () => {
      const strategy = new FunctionCompletionStrategy()
      const context: CompletionContext = {
        lineContent: 'SELECT ',
        textBeforeCursor: 'SELECT ',
        textBeforeCursorOnLine: 'SELECT ',
        position: { line: 1, column: 7 }
      }

      const result = await strategy.provideCompletionItems(context, mockSchemaSource)
      const labels = result.items.map(item => item.label)

      expect(labels).toContain('count')
      expect(labels).toContain('sum')
      expect(labels).toContain('avg')
      expect(labels).toContain('max')
      expect(labels).toContain('min')
    })

    it('should return items array', async () => {
      const strategy = new FunctionCompletionStrategy()
      const context: CompletionContext = {
        lineContent: 'SELECT ',
        textBeforeCursor: 'SELECT ',
        textBeforeCursorOnLine: 'SELECT ',
        position: { line: 1, column: 7 }
      }

      const result = await strategy.provideCompletionItems(context, mockSchemaSource)

      expect(Array.isArray(result.items)).toBe(true)
      expect(result.isIncomplete).toBeUndefined()
    })
  })
})
