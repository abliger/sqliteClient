import { describe, it, expect } from 'vitest'
import {
  DefaultStrategyFactory,
  KeywordOnlyStrategyFactory,
  FullFeaturedStrategyFactory
} from './DefaultStrategyFactory'
import {
  KeywordCompletionStrategy,
  FunctionCompletionStrategy,
  TableCompletionStrategy,
  ColumnCompletionStrategy
} from './strategies'

describe('DefaultStrategyFactory', () => {
  describe('DefaultStrategyFactory', () => {
    it('should create all strategies by default', () => {
      const factory = new DefaultStrategyFactory()
      const strategies = factory.createStrategies()

      expect(strategies).toHaveLength(4)
      expect(strategies.some(s => s instanceof KeywordCompletionStrategy)).toBe(true)
      expect(strategies.some(s => s instanceof FunctionCompletionStrategy)).toBe(true)
      expect(strategies.some(s => s instanceof TableCompletionStrategy)).toBe(true)
      expect(strategies.some(s => s instanceof ColumnCompletionStrategy)).toBe(true)
    })

    it('should respect enableKeywords config', () => {
      const factory = new DefaultStrategyFactory()
      const strategies = factory.createStrategies({ enableKeywords: false })

      expect(strategies.some(s => s instanceof KeywordCompletionStrategy)).toBe(false)
      expect(strategies).toHaveLength(3)
    })

    it('should respect enableFunctions config', () => {
      const factory = new DefaultStrategyFactory()
      const strategies = factory.createStrategies({ enableFunctions: false })

      expect(strategies.some(s => s instanceof FunctionCompletionStrategy)).toBe(false)
      expect(strategies).toHaveLength(3)
    })

    it('should respect enableTables config', () => {
      const factory = new DefaultStrategyFactory()
      const strategies = factory.createStrategies({ enableTables: false })

      expect(strategies.some(s => s instanceof TableCompletionStrategy)).toBe(false)
      expect(strategies).toHaveLength(3)
    })

    it('should respect enableColumns config', () => {
      const factory = new DefaultStrategyFactory()
      const strategies = factory.createStrategies({ enableColumns: false })

      expect(strategies.some(s => s instanceof ColumnCompletionStrategy)).toBe(false)
      expect(strategies).toHaveLength(3)
    })

    it('should sort strategies by priority (descending)', () => {
      const factory = new DefaultStrategyFactory()
      const strategies = factory.createStrategies()

      // Check that strategies are sorted by priority (highest first)
      for (let i = 0; i < strategies.length - 1; i++) {
        expect(strategies[i].priority).toBeGreaterThanOrEqual(strategies[i + 1].priority)
      }
    })

    it('should pass custom keywords to KeywordCompletionStrategy', () => {
      const factory = new DefaultStrategyFactory()
      const customKeywords = ['CUSTOM_KEYWORD_1', 'CUSTOM_KEYWORD_2']
      
      const strategies = factory.createStrategies({ customKeywords })
      
      const keywordStrategy = strategies.find(s => s instanceof KeywordCompletionStrategy) as KeywordCompletionStrategy
      // The strategy stores custom keywords internally, we test by checking it was created
      expect(keywordStrategy).toBeDefined()
    })

    it('should pass custom functions to FunctionCompletionStrategy', () => {
      const factory = new DefaultStrategyFactory()
      const customFunctions = [
        { name: 'custom_func', snippet: 'custom_func($1)', desc: 'Custom function' }
      ]
      
      const strategies = factory.createStrategies({ customFunctions })
      
      const funcStrategy = strategies.find(s => s instanceof FunctionCompletionStrategy) as FunctionCompletionStrategy
      expect(funcStrategy).toBeDefined()
    })

    it('should handle empty config', () => {
      const factory = new DefaultStrategyFactory()
      const strategies = factory.createStrategies({})

      expect(strategies).toHaveLength(4)
    })

    it('should disable all strategies when all options are false', () => {
      const factory = new DefaultStrategyFactory()
      const strategies = factory.createStrategies({
        enableKeywords: false,
        enableFunctions: false,
        enableTables: false,
        enableColumns: false
      })

      expect(strategies).toHaveLength(0)
    })
  })

  describe('KeywordOnlyStrategyFactory', () => {
    it('should create only keyword strategy', () => {
      const factory = new KeywordOnlyStrategyFactory()
      const strategies = factory.createStrategies()

      expect(strategies).toHaveLength(1)
      expect(strategies[0]).toBeInstanceOf(KeywordCompletionStrategy)
    })

    it('should pass custom keywords', () => {
      const factory = new KeywordOnlyStrategyFactory()
      const customKeywords = ['MY_CUSTOM_KEYWORD']
      
      const strategies = factory.createStrategies({ customKeywords })
      
      expect(strategies).toHaveLength(1)
      expect(strategies[0]).toBeInstanceOf(KeywordCompletionStrategy)
    })

    it('should ignore other config options', () => {
      const factory = new KeywordOnlyStrategyFactory()
      
      const strategies = factory.createStrategies({
        enableFunctions: true,
        enableTables: true,
        enableColumns: true
      })

      expect(strategies).toHaveLength(1)
      expect(strategies[0]).toBeInstanceOf(KeywordCompletionStrategy)
    })
  })

  describe('FullFeaturedStrategyFactory', () => {
    it('should create all strategies', () => {
      const factory = new FullFeaturedStrategyFactory()
      const strategies = factory.createStrategies()

      expect(strategies).toHaveLength(4)
      expect(strategies.some(s => s instanceof KeywordCompletionStrategy)).toBe(true)
      expect(strategies.some(s => s instanceof FunctionCompletionStrategy)).toBe(true)
      expect(strategies.some(s => s instanceof TableCompletionStrategy)).toBe(true)
      expect(strategies.some(s => s instanceof ColumnCompletionStrategy)).toBe(true)
    })

    it('should sort strategies by priority', () => {
      const factory = new FullFeaturedStrategyFactory()
      const strategies = factory.createStrategies()

      for (let i = 0; i < strategies.length - 1; i++) {
        expect(strategies[i].priority).toBeGreaterThanOrEqual(strategies[i + 1].priority)
      }
    })

    it('should pass custom keywords and functions', () => {
      const factory = new FullFeaturedStrategyFactory()
      const config = {
        customKeywords: ['CUSTOM_KEYWORD'],
        customFunctions: [{ name: 'custom', snippet: 'custom()', desc: '' }]
      }
      
      const strategies = factory.createStrategies(config)

      expect(strategies).toHaveLength(4)
    })

    it('should always return all strategies regardless of enable flags', () => {
      const factory = new FullFeaturedStrategyFactory()
      
      const strategies = factory.createStrategies({
        enableKeywords: false,
        enableFunctions: false
      })

      // FullFeaturedStrategyFactory always creates all strategies
      expect(strategies).toHaveLength(4)
    })
  })

  describe('strategy priorities', () => {
    it('should have strategies sorted by priority descending', () => {
      const factory = new DefaultStrategyFactory()
      const strategies = factory.createStrategies()

      // Verify all strategies are sorted by priority
      for (let i = 0; i < strategies.length - 1; i++) {
        expect(strategies[i].priority).toBeGreaterThanOrEqual(strategies[i + 1].priority)
      }
    })

    it('should include all expected strategy types', () => {
      const factory = new DefaultStrategyFactory()
      const strategies = factory.createStrategies()

      expect(strategies.some(s => s instanceof ColumnCompletionStrategy)).toBe(true)
      expect(strategies.some(s => s instanceof TableCompletionStrategy)).toBe(true)
      expect(strategies.some(s => s instanceof FunctionCompletionStrategy)).toBe(true)
      expect(strategies.some(s => s instanceof KeywordCompletionStrategy)).toBe(true)
    })
  })
})
