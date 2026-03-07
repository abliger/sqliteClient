import { watch, type MaybeRef } from 'vue'
import type { TableInfo } from '@types'
import type { 
  SQLCompletionStrategy, 
  CompletionProviderConfig,
  CompletionStrategyFactory 
} from './types'
import { MonacoAdapter } from './adapters/MonacoAdapter'
import { StoreSchemaDataSource, StaticSchemaDataSource } from './StoreSchemaDataSource'
import { DefaultStrategyFactory } from './DefaultStrategyFactory'

export interface UseSQLCompletionOptions {
  /** 表数据源 */
  tables?: MaybeRef<TableInfo[]>
  /** 根据表名获取表 */
  getTableByName?: (name: string) => TableInfo | undefined
  /** 自定义策略工厂 */
  strategyFactory?: CompletionStrategyFactory
  /** 配置项 */
  config?: CompletionProviderConfig
  /** 是否立即注册 */
  immediate?: boolean
}

export interface SQLCompletionInstance {
  /** 注册补全 */
  register: () => void
  /** 更新策略 */
  updateStrategies: (strategies: SQLCompletionStrategy[]) => void
  /** 获取当前策略 */
  getStrategies: () => SQLCompletionStrategy[]
  /** 清理资源 */
  dispose: () => void
}

/**
 * SQL 智能提示 Composable
 * 
 * 使用策略模式支持多种补全策略：
 * - KeywordCompletionStrategy: SQL 关键字
 * - FunctionCompletionStrategy: SQL 函数
 * - TableCompletionStrategy: 表名
 * - ColumnCompletionStrategy: 列名
 * 
 * 可通过 strategyFactory 参数自定义策略集合
 * 
 * @example
 * ```ts
 * // 基本用法
 * const { register, dispose } = useSQLCompletion({
 *   tables: schemaStore.tables,
 *   getTableByName: (name) => schemaStore.getTableByName(name)
 * })
 * 
 * // 自定义策略
 * const { register } = useSQLCompletion({
 *   tables: schemaStore.tables,
 *   getTableByName: (name) => schemaStore.getTableByName(name),
 *   strategyFactory: new FullFeaturedStrategyFactory(),
 *   config: {
 *     enableKeywords: true,
 *     enableFunctions: true,
 *     enableTables: true,
 *     enableColumns: true,
 *     customKeywords: ['MY_CUSTOM_KEYWORD']
 *   }
 * })
 * ```
 */
export function useSQLCompletion(options: UseSQLCompletionOptions): SQLCompletionInstance {
  const {
    tables,
    getTableByName,
    strategyFactory = new DefaultStrategyFactory(),
    config = {},
    immediate = true
  } = options
  
  let adapter: MonacoAdapter | null = null
  let strategies: SQLCompletionStrategy[] = []
  
  // 创建数据源
  const createDataSource = () => {
    if (tables && getTableByName) {
      return new StoreSchemaDataSource(tables, getTableByName)
    }
    // 如果没有提供数据源，返回空静态数据源
    return new StaticSchemaDataSource()
  }
  
  // 初始化策略
  const initStrategies = () => {
    strategies = strategyFactory.createStrategies(config)
  }
  
  // 注册补全
  const register = () => {
    // 清理旧的适配器
    if (adapter) {
      adapter.dispose()
    }
    
    // 初始化策略
    if (strategies.length === 0) {
      initStrategies()
    }
    
    // 创建适配器
    const dataSource = createDataSource()
    adapter = new MonacoAdapter(strategies, dataSource, config.triggerCharacters)
    adapter.register()
  }
  
  // 更新策略
  const updateStrategies = (newStrategies: SQLCompletionStrategy[]) => {
    strategies = newStrategies
    if (adapter) {
      adapter.updateStrategies(newStrategies)
    }
  }
  
  // 获取当前策略
  const getStrategies = () => strategies
  
  // 清理资源
  const dispose = () => {
    if (adapter) {
      adapter.dispose()
      adapter = null
    }
  }
  
  // 监听表变化，自动重新注册（仅当是响应式引用时）
  if (tables && typeof tables === 'object' && 'value' in tables) {
    watch(tables as MaybeRef<TableInfo[]>, () => {
      if (adapter) {
        register()
      }
    }, { deep: true })
  }
  
  // 立即注册
  if (immediate) {
    register()
  }
  
  return {
    register,
    updateStrategies,
    getStrategies,
    dispose
  }
}

// 导出类型和类，方便外部使用
export * from './types'
export * from './strategies'
export { MonacoAdapter } from './adapters/MonacoAdapter'
export { StoreSchemaDataSource, StaticSchemaDataSource } from './StoreSchemaDataSource'
export { 
  DefaultStrategyFactory, 
  KeywordOnlyStrategyFactory, 
  FullFeaturedStrategyFactory 
} from './DefaultStrategyFactory'
