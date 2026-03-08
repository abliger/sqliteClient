import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MonacoAdapter } from './MonacoAdapter'
import { CompletionItemKind } from '../types'
import type { SQLCompletionStrategy, SchemaDataSource, CompletionContext, CompletionResult } from '../types'
import * as monaco from 'monaco-editor'

// Mock SchemaDataSource
const createMockSchemaDataSource = (): SchemaDataSource => ({
  getTables: vi.fn(() => [
    { name: 'users', column_count: 2, columns: [{ name: 'id', data_type: 'INTEGER', nullable: false, is_primary_key: true, is_foreign_key: false }] },
    { name: 'orders', column_count: 2, columns: [{ name: 'id', data_type: 'INTEGER', nullable: false, is_primary_key: true, is_foreign_key: false }] },
  ]),
  getTableByName: vi.fn((name: string) => ({ name, column_count: 1, columns: [] })),
  getAllColumns: vi.fn(() => ['id', 'name', 'email']),
  getTableColumns: vi.fn(() => [{ name: 'id', data_type: 'INTEGER', nullable: false, is_primary_key: true, is_foreign_key: false }]),
})

// Mock SQLCompletionStrategy
const createMockStrategy = (name: string, priority: number, canProvideResult: boolean, items: any[] = []): SQLCompletionStrategy => ({
  name,
  priority,
  canProvide: vi.fn().mockReturnValue(canProvideResult),
  provideCompletionItems: vi.fn().mockResolvedValue({
    items: items.length > 0 ? items : [{ label: name, kind: CompletionItemKind.Keyword, insertText: name }],
    isIncomplete: false,
  } as CompletionResult),
})

describe('MonacoAdapter', () => {
  let mockSchemaSource: SchemaDataSource

  beforeEach(() => {
    vi.clearAllMocks()
    mockSchemaSource = createMockSchemaDataSource()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create with default trigger characters', () => {
      const strategies: SQLCompletionStrategy[] = []
      const adapter = new MonacoAdapter(strategies, mockSchemaSource)

      expect(adapter).toBeDefined()
    })

    it('should create with custom trigger characters', () => {
      const strategies: SQLCompletionStrategy[] = []
      const customTriggers = ['.', ',', '(', '[']
      const adapter = new MonacoAdapter(strategies, mockSchemaSource, customTriggers)

      expect(adapter).toBeDefined()
    })
  })

  describe('register', () => {
    it('should register completion provider with Monaco', () => {
      const strategies: SQLCompletionStrategy[] = []
      const adapter = new MonacoAdapter(strategies, mockSchemaSource)

      adapter.register()

      expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith(
        'sql',
        expect.objectContaining({
          triggerCharacters: expect.any(Array),
          provideCompletionItems: expect.any(Function),
        })
      )
    })

    it('should use custom trigger characters when registering', () => {
      const strategies: SQLCompletionStrategy[] = []
      const customTriggers = ['.', ',', '(']
      const adapter = new MonacoAdapter(strategies, mockSchemaSource, customTriggers)

      adapter.register()

      expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith(
        'sql',
        expect.objectContaining({
          triggerCharacters: customTriggers,
        })
      )
    })

    it('should return disposable', () => {
      const strategies: SQLCompletionStrategy[] = []
      const adapter = new MonacoAdapter(strategies, mockSchemaSource)

      const disposable = adapter.register()

      expect(disposable).toHaveProperty('dispose')
      expect(typeof disposable.dispose).toBe('function')
    })

    it('should track disposables for cleanup', () => {
      const mockDispose1 = vi.fn()
      const mockDispose2 = vi.fn()

      // Setup mocks before registering
      vi.mocked(monaco.languages.registerCompletionItemProvider)
        .mockReturnValueOnce({ dispose: mockDispose1 } as any)
        .mockReturnValueOnce({ dispose: mockDispose2 } as any)

      const strategies: SQLCompletionStrategy[] = []
      const adapter = new MonacoAdapter(strategies, mockSchemaSource)

      adapter.register()
      adapter.register() // Register twice

      adapter.dispose()

      // All tracked disposables should be disposed
      expect(mockDispose1).toHaveBeenCalled()
      expect(mockDispose2).toHaveBeenCalled()
    })
  })

  describe('provideCompletionItems', () => {
    const createMockModel = (text: string, position: { lineNumber: number; column: number }): monaco.editor.ITextModel => ({
      getValueInRange: vi.fn().mockReturnValue(text),
      getLineContent: vi.fn().mockReturnValue(text.split('\n')[position.lineNumber - 1] || ''),
      getWordUntilPosition: vi.fn().mockReturnValue({ startColumn: 1, endColumn: position.column }),
    } as any)

    const createMockPosition = (lineNumber: number, column: number): monaco.Position => ({
      lineNumber,
      column,
    } as any)

    it('should provide completions from single strategy', async () => {
      const strategy = createMockStrategy('keywords', 100, true, [
        { label: 'SELECT', kind: CompletionItemKind.Keyword, insertText: 'SELECT' },
        { label: 'FROM', kind: CompletionItemKind.Keyword, insertText: 'FROM' },
      ])
      const adapter = new MonacoAdapter([strategy], mockSchemaSource)

      adapter.register()
      const provider = vi.mocked(monaco.languages.registerCompletionItemProvider).mock.calls[0][1] as any

      const model = createMockModel('SEL', { lineNumber: 1, column: 4 })
      const position = createMockPosition(1, 4)

      const result = await provider.provideCompletionItems(model, position)

      expect(result.suggestions).toHaveLength(2)
      expect(strategy.canProvide).toHaveBeenCalled()
      expect(strategy.provideCompletionItems).toHaveBeenCalled()
    })

    it('should provide completions from multiple strategies', async () => {
      const keywordStrategy = createMockStrategy('keywords', 100, true, [
        { label: 'SELECT', kind: CompletionItemKind.Keyword, insertText: 'SELECT' },
      ])
      const tableStrategy = createMockStrategy('tables', 90, true, [
        { label: 'users', kind: CompletionItemKind.Table, insertText: 'users' },
      ])
      const adapter = new MonacoAdapter([keywordStrategy, tableStrategy], mockSchemaSource)

      adapter.register()
      const provider = vi.mocked(monaco.languages.registerCompletionItemProvider).mock.calls[0][1] as any

      const model = createMockModel('', { lineNumber: 1, column: 1 })
      const position = createMockPosition(1, 1)

      const result = await provider.provideCompletionItems(model, position)

      expect(result.suggestions).toHaveLength(2)
    })

    it('should skip strategies that cannot provide', async () => {
      const keywordStrategy = createMockStrategy('keywords', 100, true, [
        { label: 'SELECT', kind: CompletionItemKind.Keyword, insertText: 'SELECT' },
      ])
      const tableStrategy = createMockStrategy('tables', 90, false, [
        { label: 'users', kind: CompletionItemKind.Table, insertText: 'users' },
      ])
      const adapter = new MonacoAdapter([keywordStrategy, tableStrategy], mockSchemaSource)

      adapter.register()
      const provider = vi.mocked(monaco.languages.registerCompletionItemProvider).mock.calls[0][1] as any

      const model = createMockModel('SELECT ', { lineNumber: 1, column: 8 })
      const position = createMockPosition(1, 8)

      const result = await provider.provideCompletionItems(model, position)

      expect(result.suggestions).toHaveLength(1)
      expect(tableStrategy.provideCompletionItems).not.toHaveBeenCalled()
    })

    it('should stop when strategy returns incomplete', async () => {
      const firstStrategy = createMockStrategy('keywords', 100, true, [
        { label: 'SELECT', kind: CompletionItemKind.Keyword, insertText: 'SELECT' },
      ])
      firstStrategy.provideCompletionItems = vi.fn().mockResolvedValue({
        items: [{ label: 'SELECT', kind: CompletionItemKind.Keyword, insertText: 'SELECT' }],
        isIncomplete: true,
      })

      const secondStrategy = createMockStrategy('tables', 90, true, [
        { label: 'users', kind: CompletionItemKind.Table, insertText: 'users' },
      ])

      const adapter = new MonacoAdapter([firstStrategy, secondStrategy], mockSchemaSource)

      adapter.register()
      const provider = vi.mocked(monaco.languages.registerCompletionItemProvider).mock.calls[0][1] as any

      const model = createMockModel('', { lineNumber: 1, column: 1 })
      const position = createMockPosition(1, 1)

      const result = await provider.provideCompletionItems(model, position)

      expect(result.suggestions).toHaveLength(1)
      expect(secondStrategy.provideCompletionItems).not.toHaveBeenCalled()
    })

    it('should handle strategy returning empty items', async () => {
      const strategy = createMockStrategy('keywords', 100, true, [])
      // Ensure the mock returns truly empty items
      strategy.provideCompletionItems = vi.fn().mockResolvedValue({
        items: [],
        isIncomplete: false,
      })

      const adapter = new MonacoAdapter([strategy], mockSchemaSource)

      adapter.register()
      const provider = vi.mocked(monaco.languages.registerCompletionItemProvider).mock.calls[0][1] as any

      const model = createMockModel('', { lineNumber: 1, column: 1 })
      const position = createMockPosition(1, 1)

      const result = await provider.provideCompletionItems(model, position)

      expect(result.suggestions).toEqual([])
      expect(result.incomplete).toBe(false)
    })

    it('should map CompletionItemKind correctly', async () => {
      const strategy = createMockStrategy('mixed', 100, true, [
        { label: 'SELECT', kind: CompletionItemKind.Keyword, insertText: 'SELECT' },
        { label: 'count', kind: CompletionItemKind.Function, insertText: 'count($1)' },
        { label: 'users', kind: CompletionItemKind.Table, insertText: 'users' },
        { label: 'id', kind: CompletionItemKind.Column, insertText: 'id' },
        { label: 'snippet', kind: CompletionItemKind.Snippet, insertText: '${1:value}' },
      ])
      const adapter = new MonacoAdapter([strategy], mockSchemaSource)

      adapter.register()
      const provider = vi.mocked(monaco.languages.registerCompletionItemProvider).mock.calls[0][1] as any

      const model = createMockModel('', { lineNumber: 1, column: 1 })
      const position = createMockPosition(1, 1)

      const result = await provider.provideCompletionItems(model, position)

      expect(result.suggestions).toHaveLength(5)
      // Verify all suggestions have mapped kinds
      result.suggestions.forEach((item: any) => {
        expect(item.kind).toBeDefined()
        expect(typeof item.kind === 'number').toBe(true)
      })
    })

    it('should handle snippets with insertTextRules', async () => {
      const strategy = createMockStrategy('snippets', 100, true, [
        { label: 'SELECT *', kind: CompletionItemKind.Snippet, insertText: 'SELECT * FROM ${1:table}' },
        { label: 'INSERT', kind: CompletionItemKind.Keyword, insertText: 'INSERT INTO' },
      ])
      const adapter = new MonacoAdapter([strategy], mockSchemaSource)

      adapter.register()
      const provider = vi.mocked(monaco.languages.registerCompletionItemProvider).mock.calls[0][1] as any

      const model = createMockModel('', { lineNumber: 1, column: 1 })
      const position = createMockPosition(1, 1)

      const result = await provider.provideCompletionItems(model, position)

      const snippetItem = result.suggestions.find((s: any) => s.label === 'SELECT *')
      const normalItem = result.suggestions.find((s: any) => s.label === 'INSERT')

      expect(snippetItem.insertTextRules).toBeDefined()
      expect(normalItem.insertTextRules).toBeUndefined()
    })

    it('should create correct range from word info', async () => {
      const strategy = createMockStrategy('keywords', 100, true, [
        { label: 'SELECT', kind: CompletionItemKind.Keyword, insertText: 'SELECT' },
      ])
      const adapter = new MonacoAdapter([strategy], mockSchemaSource)

      adapter.register()
      const provider = vi.mocked(monaco.languages.registerCompletionItemProvider).mock.calls[0][1] as any

      const model = createMockModel('SEL', { lineNumber: 1, column: 4 })
      vi.mocked(model.getWordUntilPosition).mockReturnValue({ startColumn: 1, endColumn: 4 })
      const position = createMockPosition(1, 4)

      const result = await provider.provideCompletionItems(model, position)

      expect(result.suggestions[0].range).toEqual({
        startLineNumber: 1,
        endLineNumber: 1,
        startColumn: 1,
        endColumn: 4,
      })
    })
  })

  describe('updateStrategies', () => {
    it('should update strategies', () => {
      const initialStrategies = [createMockStrategy('keywords', 100, true)]
      const adapter = new MonacoAdapter(initialStrategies, mockSchemaSource)

      const newStrategies = [
        createMockStrategy('keywords', 100, true),
        createMockStrategy('tables', 90, true),
      ]

      adapter.updateStrategies(newStrategies)

      // The update happens internally, we can verify by checking the adapter still works
      expect(() => adapter.register()).not.toThrow()
    })
  })

  describe('dispose', () => {
    it('should dispose all registered providers', () => {
      const mockDispose1 = vi.fn()
      const mockDispose2 = vi.fn()

      vi.mocked(monaco.languages.registerCompletionItemProvider)
        .mockReturnValueOnce({ dispose: mockDispose1 } as any)
        .mockReturnValueOnce({ dispose: mockDispose2 } as any)

      const strategies: SQLCompletionStrategy[] = []
      const adapter = new MonacoAdapter(strategies, mockSchemaSource)

      adapter.register()
      adapter.register() // Register twice
      adapter.dispose()

      expect(mockDispose1).toHaveBeenCalled()
      expect(mockDispose2).toHaveBeenCalled()
    })

    it('should clear disposables after dispose', () => {
      const mockDispose = vi.fn()
      vi.mocked(monaco.languages.registerCompletionItemProvider).mockReturnValue({ dispose: mockDispose } as any)

      const strategies: SQLCompletionStrategy[] = []
      const adapter = new MonacoAdapter(strategies, mockSchemaSource)

      adapter.register()
      adapter.dispose()
      adapter.dispose() // Dispose again

      // Should only call dispose once per disposable
      expect(mockDispose).toHaveBeenCalledTimes(1)
    })

    it('should handle dispose with no registered providers', () => {
      const strategies: SQLCompletionStrategy[] = []
      const adapter = new MonacoAdapter(strategies, mockSchemaSource)

      // Should not throw
      expect(() => adapter.dispose()).not.toThrow()
    })
  })

  describe('context creation', () => {
    it('should create correct context from model', async () => {
      const strategy = createMockStrategy('test', 100, true, [])
      strategy.canProvide = vi.fn().mockReturnValue(true)

      const adapter = new MonacoAdapter([strategy], mockSchemaSource)
      adapter.register()

      const provider = vi.mocked(monaco.languages.registerCompletionItemProvider).mock.calls[0][1] as any

      const fullText = 'SELECT * FROM users WHERE id = 1'
      const lineContent = 'WHERE id = 1'
      const model = {
        getValueInRange: vi.fn().mockReturnValue(fullText),
        getLineContent: vi.fn().mockReturnValue(lineContent),
        getWordUntilPosition: vi.fn().mockReturnValue({ startColumn: 1, endColumn: 1 }),
      } as any

      const position = { lineNumber: 2, column: 15 } as any

      await provider.provideCompletionItems(model, position)

      expect(strategy.provideCompletionItems).toHaveBeenCalledWith(
        expect.objectContaining({
          lineContent,
          textBeforeCursor: fullText,
          textBeforeCursorOnLine: lineContent.substring(0, 14), // column - 1
          position: { line: 2, column: 15 },
        }),
        mockSchemaSource
      )
    })
  })
})
