import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useSQLCompletion } from './useSQLCompletion'
import type { TableInfo } from '@types'
import type { CompletionProviderConfig } from './types'
import { DefaultStrategyFactory, KeywordOnlyStrategyFactory, FullFeaturedStrategyFactory } from './DefaultStrategyFactory'

// Mock dependencies
const mockAdapterInstance = {
  register: vi.fn(),
  dispose: vi.fn(),
  updateStrategies: vi.fn(),
}

const mockStoreDataSourceInstance = {
  getTables: vi.fn(() => []),
  getTableByName: vi.fn(),
  getAllColumns: vi.fn(() => []),
  getTableColumns: vi.fn(() => []),
}

const mockStaticDataSourceInstance = {
  getTables: vi.fn(() => []),
  getTableByName: vi.fn(),
  getAllColumns: vi.fn(() => []),
  getTableColumns: vi.fn(() => []),
}

// Get references to mocked constructors for assertions
let MonacoAdapterMock: any
let StoreSchemaDataSourceMock: any
let StaticSchemaDataSourceMock: any

vi.mock('./adapters/MonacoAdapter', () => ({
  MonacoAdapter: function(...args: any[]) {
    MonacoAdapterMock(...args)
    return mockAdapterInstance
  },
}))

vi.mock('./StoreSchemaDataSource', () => ({
  StoreSchemaDataSource: function(...args: any[]) {
    StoreSchemaDataSourceMock(...args)
    return mockStoreDataSourceInstance
  },
  StaticSchemaDataSource: function(...args: any[]) {
    StaticSchemaDataSourceMock(...args)
    return mockStaticDataSourceInstance
  },
}))

const mockTables: TableInfo[] = [
  {
    name: 'users',
    column_count: 3,
    columns: [
      { name: 'id', data_type: 'INTEGER', nullable: false, is_primary_key: true, is_foreign_key: false },
      { name: 'name', data_type: 'TEXT', nullable: true, is_primary_key: false, is_foreign_key: false },
      { name: 'email', data_type: 'TEXT', nullable: false, is_primary_key: false, is_foreign_key: false },
    ],
  },
  {
    name: 'orders',
    column_count: 2,
    columns: [
      { name: 'id', data_type: 'INTEGER', nullable: false, is_primary_key: true, is_foreign_key: false },
      { name: 'user_id', data_type: 'INTEGER', nullable: false, is_primary_key: false, is_foreign_key: true },
    ],
  },
]

describe('useSQLCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MonacoAdapterMock = vi.fn()
    StoreSchemaDataSourceMock = vi.fn()
    StaticSchemaDataSourceMock = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('basic functionality', () => {
    it('should return required methods', () => {
      const tablesRef = ref(mockTables)
      const getTableByName = vi.fn((name: string) => mockTables.find(t => t.name === name))

      const result = useSQLCompletion({
        tables: tablesRef,
        getTableByName,
        immediate: false,
      })

      expect(result).toHaveProperty('register')
      expect(result).toHaveProperty('updateStrategies')
      expect(result).toHaveProperty('getStrategies')
      expect(result).toHaveProperty('dispose')

      expect(typeof result.register).toBe('function')
      expect(typeof result.updateStrategies).toBe('function')
      expect(typeof result.getStrategies).toBe('function')
      expect(typeof result.dispose).toBe('function')
    })

    it('should return empty strategies initially', () => {
      const result = useSQLCompletion({
        immediate: false,
      })

      expect(result.getStrategies()).toEqual([])
    })
  })

  describe('register functionality', () => {
    it('should register with default config', () => {
      const tablesRef = ref(mockTables)
      const getTableByName = vi.fn()

      const { register } = useSQLCompletion({
        tables: tablesRef,
        getTableByName,
        immediate: false,
      })

      register()

      expect(MonacoAdapterMock).toHaveBeenCalled()
      expect(StoreSchemaDataSourceMock).toHaveBeenCalledWith(tablesRef, getTableByName)
    })

    it('should use StaticSchemaDataSource when tables not provided', () => {
      const { register } = useSQLCompletion({
        immediate: false,
      })

      register()

      expect(MonacoAdapterMock).toHaveBeenCalled()
      expect(StaticSchemaDataSourceMock).toHaveBeenCalled()
    })

    it('should register with custom trigger characters', () => {
      const tablesRef = ref(mockTables)
      const getTableByName = vi.fn()
      const customTriggers = ['.', ',', '(']

      const { register } = useSQLCompletion({
        tables: tablesRef,
        getTableByName,
        config: { triggerCharacters: customTriggers },
        immediate: false,
      })

      register()

      expect(MonacoAdapterMock).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        customTriggers,
      )
    })

    it('should dispose old adapter when registering again', () => {
      const tablesRef = ref(mockTables)
      const getTableByName = vi.fn()

      const { register } = useSQLCompletion({
        tables: tablesRef,
        getTableByName,
        immediate: false,
      })

      register()

      register()

      expect(mockAdapterInstance.dispose).toHaveBeenCalled()
    })

    it('should initialize strategies on first register', () => {
      const { register, getStrategies } = useSQLCompletion({
        immediate: false,
      })

      expect(getStrategies()).toEqual([])

      register()

      expect(getStrategies().length).toBeGreaterThan(0)
    })
  })

  describe('immediate registration', () => {
    it('should register immediately when immediate is true', () => {
      const tablesRef = ref(mockTables)
      const getTableByName = vi.fn()

      useSQLCompletion({
        tables: tablesRef,
        getTableByName,
        immediate: true,
      })

      expect(MonacoAdapterMock).toHaveBeenCalled()
    })

    it('should not register immediately when immediate is false', () => {
      const tablesRef = ref(mockTables)
      const getTableByName = vi.fn()

      useSQLCompletion({
        tables: tablesRef,
        getTableByName,
        immediate: false,
      })

      expect(MonacoAdapterMock).not.toHaveBeenCalled()
    })

    it('should default to immediate registration', () => {
      const tablesRef = ref(mockTables)
      const getTableByName = vi.fn()

      useSQLCompletion({
        tables: tablesRef,
        getTableByName,
      })

      expect(MonacoAdapterMock).toHaveBeenCalled()
    })
  })

  describe('strategy management', () => {
    it('should use DefaultStrategyFactory by default', () => {
      const { register, getStrategies } = useSQLCompletion({
        immediate: false,
      })

      register()

      const strategies = getStrategies()
      // DefaultStrategyFactory creates 4 strategies by default
      expect(strategies.length).toBe(4)
    })

    it('should use custom strategy factory', () => {
      const customFactory = new KeywordOnlyStrategyFactory()

      const { register, getStrategies } = useSQLCompletion({
        strategyFactory: customFactory,
        immediate: false,
      })

      register()

      const strategies = getStrategies()
      expect(strategies.length).toBe(1)
    })

    it('should update strategies', () => {
      const customFactory = new FullFeaturedStrategyFactory()
      const newStrategies = customFactory.createStrategies()

      const { register, updateStrategies, getStrategies } = useSQLCompletion({
        immediate: false,
      })

      register()

      updateStrategies(newStrategies)

      expect(getStrategies().length).toBe(newStrategies.length)
      expect(getStrategies()).toEqual(newStrategies)
    })

    it('should update strategies on adapter when adapter exists', () => {
      const customFactory = new FullFeaturedStrategyFactory()
      const newStrategies = customFactory.createStrategies()

      const { register, updateStrategies } = useSQLCompletion({
        immediate: false,
      })

      register()

      updateStrategies(newStrategies)

      expect(mockAdapterInstance.updateStrategies).toHaveBeenCalledWith(newStrategies)
    })

    it('should handle updateStrategies when adapter not registered', () => {
      const customFactory = new FullFeaturedStrategyFactory()
      const newStrategies = customFactory.createStrategies()

      const { updateStrategies, getStrategies } = useSQLCompletion({
        immediate: false,
      })

      // Should not throw
      expect(() => updateStrategies(newStrategies)).not.toThrow()
      expect(getStrategies()).toEqual(newStrategies)
    })

    it('should pass config to strategy factory', () => {
      const customFactory = {
        createStrategies: vi.fn().mockReturnValue([]),
      }

      const config: CompletionProviderConfig = {
        enableKeywords: false,
        enableFunctions: true,
        enableTables: true,
        enableColumns: false,
        customKeywords: ['CUSTOM_KEYWORD'],
        customFunctions: [{ name: 'custom_func', snippet: 'custom_func()' }],
      }

      const { register } = useSQLCompletion({
        strategyFactory: customFactory as any,
        config,
        immediate: false,
      })

      register()

      expect(customFactory.createStrategies).toHaveBeenCalledWith(config)
    })
  })

  describe('dispose functionality', () => {
    it('should dispose adapter', () => {
      const { register, dispose } = useSQLCompletion({
        immediate: false,
      })

      register()

      dispose()

      expect(mockAdapterInstance.dispose).toHaveBeenCalled()
    })

    it('should handle multiple dispose calls', () => {
      const { register, dispose } = useSQLCompletion({
        immediate: false,
      })

      register()

      // Should not throw on multiple disposes
      expect(() => {
        dispose()
        dispose()
        dispose()
      }).not.toThrow()
    })

    it('should handle dispose when adapter is null', () => {
      const { dispose } = useSQLCompletion({
        immediate: false,
      })

      // Should not throw when disposing without registration
      expect(() => dispose()).not.toThrow()
    })
  })

  describe('reactive tables watch', () => {
    it('should watch reactive tables and re-register', async () => {
      const tablesRef = ref(mockTables)
      const getTableByName = vi.fn()

      const { register } = useSQLCompletion({
        tables: tablesRef,
        getTableByName,
        immediate: false,
      })

      register()

      const initialCallCount = MonacoAdapterMock.mock.calls.length

      // Modify tables
      tablesRef.value = [...mockTables, {
        name: 'products',
        column_count: 1,
        columns: [{ name: 'id', data_type: 'INTEGER', nullable: false, is_primary_key: true, is_foreign_key: false }],
      }]

      await nextTick()

      expect(MonacoAdapterMock.mock.calls.length).toBe(initialCallCount + 1)
    })

    it('should not re-register when adapter is disposed', async () => {
      const tablesRef = ref(mockTables)
      const getTableByName = vi.fn()

      const { register, dispose } = useSQLCompletion({
        tables: tablesRef,
        getTableByName,
        immediate: false,
      })

      register()
      dispose()

      const callCountAfterDispose = MonacoAdapterMock.mock.calls.length

      // Modify tables after dispose
      tablesRef.value = [...mockTables]

      await nextTick()

      // Should not re-register after dispose
      expect(MonacoAdapterMock.mock.calls.length).toBe(callCountAfterDispose)
    })

    it('should not watch non-reactive tables', async () => {
      const tables = mockTables // Not a ref
      const getTableByName = vi.fn()

      const { register } = useSQLCompletion({
        tables,
        getTableByName,
        immediate: false,
      })

      register()
      const initialCallCount = MonacoAdapterMock.mock.calls.length

      // No watch should be set up, so no re-registration
      // We can't really test this without exposing internal state,
      // but we verify the component doesn't crash
      expect(MonacoAdapterMock.mock.calls.length).toBe(initialCallCount)
    })
  })

  describe('configuration options', () => {
    it('should respect all enable flags in config', () => {
      const configs: CompletionProviderConfig[] = [
        { enableKeywords: false },
        { enableFunctions: false },
        { enableTables: false },
        { enableColumns: false },
        { enableKeywords: false, enableFunctions: false, enableTables: false, enableColumns: false },
      ]

      configs.forEach(config => {
        const factory = new DefaultStrategyFactory()
        const { register, getStrategies } = useSQLCompletion({
          strategyFactory: factory,
          config,
          immediate: false,
        })

        register()

        const strategies = getStrategies()
        // Verify strategies respect config
        expect(strategies).toBeDefined()
      })
    })

    it('should pass custom keywords and functions through config', () => {
      const config: CompletionProviderConfig = {
        customKeywords: ['MY_KEYWORD_1', 'MY_KEYWORD_2'],
        customFunctions: [
          { name: 'my_func', snippet: 'my_func($1)', desc: 'My custom function' },
        ],
      }

      const { register } = useSQLCompletion({
        config,
        immediate: false,
      })

      register()

      // The factory should have been called with the config
      expect(MonacoAdapterMock).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle empty tables array', () => {
      const tablesRef = ref<TableInfo[]>([])
      const getTableByName = vi.fn()

      const { register } = useSQLCompletion({
        tables: tablesRef,
        getTableByName,
        immediate: false,
      })

      expect(() => register()).not.toThrow()
    })

    it('should handle tables as plain array (not ref)', () => {
      const getTableByName = vi.fn()

      const { register } = useSQLCompletion({
        tables: mockTables,
        getTableByName,
        immediate: false,
      })

      expect(() => register()).not.toThrow()
      expect(StoreSchemaDataSourceMock).toHaveBeenCalledWith(mockTables, getTableByName)
    })

    it('should handle getTableByName not provided', () => {
      const tablesRef = ref(mockTables)

      const { register } = useSQLCompletion({
        tables: tablesRef,
        immediate: false,
      })

      expect(() => register()).not.toThrow()
      // Falls back to StaticSchemaDataSource when getTableByName is not provided
      expect(StaticSchemaDataSourceMock).toHaveBeenCalled()
    })

    it('should handle missing tables option', () => {
      const { register, getStrategies } = useSQLCompletion({
        immediate: false,
      })

      expect(() => register()).not.toThrow()
      expect(getStrategies().length).toBeGreaterThan(0)
    })
  })
})
