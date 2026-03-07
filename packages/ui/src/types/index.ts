// 连接相关类型
export interface ConnectionConfig {
  id: string
  name: string
  db_path: string
  created_at: string
  last_connected?: string
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting'

export interface DatabaseMetadata {
  version: string
  page_size: number
  page_count: number
  table_count: number
  index_count: number
  trigger_count: number
  size_bytes: number
}

export interface ConnectionInfo {
  config: ConnectionConfig
  status: ConnectionStatus
  metadata: DatabaseMetadata
}

// 查询执行详细信息 - 用于性能诊断
export interface QueryExecutionInfo {
  /** 总执行时间（毫秒） */
  execution_time_ms: number
  /** 查询计划分析时间（毫秒） */
  plan_time_ms?: number
  /** 实际执行时间（毫秒，不包括计划分析） */
  query_time_ms?: number
  /** 扫描的行数（估计值） */
  rows_scanned?: number
  /** 返回的行数 */
  rows_returned: number
  /** 是否使用了索引 */
  used_index?: boolean
  /** 使用的索引列表 */
  indexes_used: string[]
  /** 查询计划详情 */
  query_plan: QueryPlanStep[]
  /** 是否全表扫描 */
  is_full_table_scan?: boolean
  /** 警告信息（如慢查询警告） */
  warnings: QueryWarning[]
  /** 优化建议 */
  suggestions: string[]
}

/** 查询警告 */
export interface QueryWarning {
  level: WarningLevel
  message: string
  code?: string
}

export type WarningLevel = 'info' | 'warning' | 'error'

/** 查询计划步骤 */
export interface QueryPlanStep {
  /** 步骤序号 */
  id: number
  /** 父步骤序号 */
  parent?: number
  /** 不使用的列 */
  not_used?: number
  /** 详细信息 */
  detail: string
}

// 查询相关类型
export type CellValue = 
  | { type: 'Null' }
  | { type: 'Integer'; value: number }
  | { type: 'Real'; value: number }
  | { type: 'Text'; value: string }
  | { type: 'Blob'; value: string }
  | { type: 'Boolean'; value: boolean }

export interface QueryRow {
  values: Record<string, CellValue>
}

export interface QueryResultRows {
  type: 'rows'
  columns: string[]
  rows: QueryRow[]
  total_count?: number
  stream_id?: string
  has_more: boolean
  /** 详细的执行信息 */
  execution_info: QueryExecutionInfo
}

export interface QueryResultExecution {
  type: 'execution'
  rows_affected: number
  last_insert_id?: number
  /** 详细的执行信息 */
  execution_info: QueryExecutionInfo
}

export type QueryResult = QueryResultRows | QueryResultExecution

// 表结构相关类型
export interface ForeignKeyInfo {
  from_column: string
  to_table: string
  to_column: string
  on_update: string
  on_delete: string
}

export interface ColumnInfo {
  name: string
  data_type: string
  nullable: boolean
  default_value?: string
  is_primary_key: boolean
  is_foreign_key: boolean
  foreign_key?: ForeignKeyInfo
}

export interface TableInfo {
  name: string
  sql?: string
  column_count: number
  row_count?: number
  columns: ColumnInfo[]
}

export interface IndexInfo {
  name: string
  table_name: string
  unique: boolean
  columns: string[]
  sql?: string
}

export interface TriggerInfo {
  name: string
  table_name: string
  sql: string
  timing: string
  event: string
}

export interface DatabaseSchema {
  tables: TableInfo[]
  indexes: IndexInfo[]
  triggers: TriggerInfo[]
}

// ER图相关类型
export interface ColumnNode {
  name: string
  data_type: string
  is_primary_key: boolean
  is_foreign_key: boolean
  nullable: boolean
}

export interface TableNode {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  columns: ColumnNode[]
}

export interface RelationEdge {
  id: string
  from_table: string
  from_column: string
  to_table: string
  to_column: string
  relation_type: 'oneToOne' | 'oneToMany' | 'manyToMany'
}

export interface ERDiagram {
  tables: TableNode[]
  relations: RelationEdge[]
}

// CRUD 操作日志类型
export type CrudOperationType = 'INSERT' | 'UPDATE' | 'DELETE'

export interface CrudLogFilter {
  connection_id?: string
  tab_id?: string
  table_name?: string
  operation_type?: CrudOperationType
  start_time?: Date
  end_time?: Date
}

export interface CrudOperationLog {
  id: string
  /** 关联的连接 ID */
  connection_id: string
  /** 关联的 Tab ID */
  tab_id: string
  /** 操作的表名 */
  table_name: string
  /** 操作类型 */
  operation_type: CrudOperationType
  /** 执行的 SQL */
  sql: string
  /** 操作的数据（JSON 字符串） */
  row_data?: string
  /** 操作前数据（UPDATE/DELETE 时记录） */
  old_data?: string
  /** 影响行数 */
  rows_affected: number
  /** 执行时间 */
  executed_at: string
  /** 执行耗时（毫秒） */
  duration_ms: number
  /** 是否成功 */
  is_success: boolean
  /** 错误信息 */
  error_message?: string
}

// 历史记录类型
export interface QueryHistoryItem {
  id: string
  sql: string
  connection_id?: string
  connection_name?: string
  executed_at: string
  duration_ms: number
  is_success: boolean
  error_message?: string
  row_count?: number
}

// 编辑器相关类型
export interface QueryTab {
  id: string
  name: string
  sql: string
  result?: QueryResult
  isExecuting: boolean
  executionTime?: number
}

export interface EditorState {
  content: string
  cursorPosition?: { line: number; column: number }
  selection?: { start: number; end: number }
}
