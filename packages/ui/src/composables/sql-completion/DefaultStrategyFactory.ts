import type { 
  SQLCompletionStrategy, 
  CompletionStrategyFactory, 
  CompletionProviderConfig 
} from './types'
import {
  KeywordCompletionStrategy,
  FunctionCompletionStrategy,
  TableCompletionStrategy,
  ColumnCompletionStrategy
} from './strategies'

/**
 * 默认策略工厂 - 创建标准的 SQL 补全策略集合
 */
export class DefaultStrategyFactory implements CompletionStrategyFactory {
  createStrategies(config: CompletionProviderConfig = {}): SQLCompletionStrategy[] {
    const strategies: SQLCompletionStrategy[] = []
    
    if (config.enableKeywords !== false) {
      strategies.push(new KeywordCompletionStrategy(config.customKeywords))
    }
    
    if (config.enableFunctions !== false) {
      strategies.push(new FunctionCompletionStrategy(config.customFunctions))
    }
    
    if (config.enableTables !== false) {
      strategies.push(new TableCompletionStrategy())
    }
    
    if (config.enableColumns !== false) {
      strategies.push(new ColumnCompletionStrategy())
    }
    
    // 按优先级排序
    return strategies.sort((a, b) => b.priority - a.priority)
  }
}

/**
 * 创建只包含关键字的策略（轻量级模式）
 */
export class KeywordOnlyStrategyFactory implements CompletionStrategyFactory {
  createStrategies(config: CompletionProviderConfig = {}): SQLCompletionStrategy[] {
    return [new KeywordCompletionStrategy(config.customKeywords)]
  }
}

/**
 * 创建包含所有功能的策略
 */
export class FullFeaturedStrategyFactory implements CompletionStrategyFactory {
  createStrategies(config: CompletionProviderConfig = {}): SQLCompletionStrategy[] {
    const strategies: SQLCompletionStrategy[] = [
      new KeywordCompletionStrategy(config.customKeywords),
      new FunctionCompletionStrategy(config.customFunctions),
      new TableCompletionStrategy(),
      new ColumnCompletionStrategy()
    ]
    
    // 可以在这里添加更多策略，如：
    // - SnippetCompletionStrategy（代码片段）
    // - HistoryCompletionStrategy（历史查询）
    // - AICompletionStrategy（AI 智能补全）
    
    return strategies.sort((a, b) => b.priority - a.priority)
  }
}
