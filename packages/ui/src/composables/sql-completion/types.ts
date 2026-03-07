import type { TableInfo, ColumnInfo } from '@types'

/**
 * 补全项类型
 */
export enum CompletionItemKind {
  Keyword = 'keyword',
  Function = 'function',
  Table = 'table',
  Column = 'column',
  Snippet = 'snippet'
}

/**
 * 补全项
 */
export interface CompletionItem {
  label: string
  kind: CompletionItemKind
  insertText: string
  detail?: string
  documentation?: string
  sortText?: string
}

/**
 * 补全上下文
 */
export interface CompletionContext {
  /** 当前行内容 */
  lineContent: string
  /** 光标前文本 */
  textBeforeCursor: string
  /** 当前行光标前文本 */
  textBeforeCursorOnLine: string
  /** 光标位置 */
  position: { line: number; column: number }
}

/**
 * 补全结果
 */
export interface CompletionResult {
  items: CompletionItem[]
  isIncomplete?: boolean
}

/**
 * Schema 数据源接口
 */
export interface SchemaDataSource {
  /** 获取所有表 */
  getTables(): TableInfo[]
  /** 根据表名获取表信息 */
  getTableByName(name: string): TableInfo | undefined
  /** 获取所有列（去重） */
  getAllColumns(): string[]
  /** 获取表的列 */
  getTableColumns(tableName: string): ColumnInfo[]
}

/**
 * SQL 补全策略接口 - 策略模式核心接口
 */
export interface SQLCompletionStrategy {
  readonly name: string
  readonly priority: number
  
  /** 
   * 判断是否支持当前上下文
   */
  canProvide(context: CompletionContext): boolean
  
  /**
   * 提供补全项
   */
  provideCompletionItems(
    context: CompletionContext,
    schemaSource: SchemaDataSource
  ): CompletionResult | Promise<CompletionResult>
}

/**
 * 补全配置
 */
export interface CompletionProviderConfig {
  /** 是否启用关键字补全 */
  enableKeywords?: boolean
  /** 是否启用函数补全 */
  enableFunctions?: boolean
  /** 是否启用表名补全 */
  enableTables?: boolean
  /** 是否启用列名补全 */
  enableColumns?: boolean
  /** 自定义关键字列表 */
  customKeywords?: string[]
  /** 自定义函数列表 */
  customFunctions?: { name: string; snippet: string; desc?: string }[]
  /** 触发字符 */
  triggerCharacters?: string[]
}

/**
 * 补全策略工厂接口
 */
export interface CompletionStrategyFactory {
  createStrategies(config?: CompletionProviderConfig): SQLCompletionStrategy[]
}
