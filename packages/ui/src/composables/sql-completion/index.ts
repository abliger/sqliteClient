// 主要导出
export { useSQLCompletion } from './useSQLCompletion'
export type { UseSQLCompletionOptions, SQLCompletionInstance } from './useSQLCompletion'

// 类型导出
export type {
  SQLCompletionStrategy,
  CompletionItem,
  CompletionContext,
  CompletionResult,
  SchemaDataSource,
  CompletionProviderConfig,
  CompletionStrategyFactory
} from './types'
export { CompletionItemKind } from './types'

// 策略导出
export {
  KeywordCompletionStrategy,
  FunctionCompletionStrategy,
  TableCompletionStrategy,
  ColumnCompletionStrategy
} from './strategies'

// 工厂导出
export {
  DefaultStrategyFactory,
  KeywordOnlyStrategyFactory,
  FullFeaturedStrategyFactory
} from './DefaultStrategyFactory'

// 适配器导出
export { MonacoAdapter } from './adapters/MonacoAdapter'

// 数据源导出
export { StoreSchemaDataSource, StaticSchemaDataSource } from './StoreSchemaDataSource'
