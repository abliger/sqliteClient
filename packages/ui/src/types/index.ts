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

// ============================================
// 查询结果快照 - 用于多结果对比
// ============================================

/** 查询结果快照 */
export interface QueryResultSnapshot {
  id: string
  name: string
  sql: string
  result: QueryResultRows
  createdAt: string
  executionTimeMs: number
}

/** 对比视图设置 */
export interface CompareViewSettings {
  /** 是否启用对比模式 */
  enabled: boolean
  /** 选中的快照ID列表 */
  selectedSnapshotIds: string[]
  /** 是否高亮差异 */
  highlightDiff: boolean
  /** 对比模式：并排 | 差异 */
  mode: 'side-by-side' | 'diff'
}

/** 单元格差异类型 */
export type CellDiffType = 'same' | 'changed' | 'added' | 'removed' | 'empty'

/** 行差异信息 */
export interface RowDiffInfo {
  rowIndex: number
  diffType: 'same' | 'changed' | 'added' | 'removed'
  cellDiffs: Record<string, CellDiffType>
}

/** 快照对比结果 */
export interface SnapshotComparison {
  /** 快照ID */
  snapshotId: string
  /** 快照名称 */
  snapshotName: string
  /** 行差异信息 */
  rowDiffs: RowDiffInfo[]
  /** 统计信息 */
  stats: {
    totalRows: number
    changedRows: number
    addedRows: number
    removedRows: number
  }
}

export interface EditorState {
  content: string
  cursorPosition?: { line: number; column: number }
  selection?: { start: number; end: number }
}

// SQL 文件执行相关类型
export interface SqlFileExecutionProgress {
  /** 当前执行的语句索引 */
  current_statement: number
  /** 总语句数 */
  total_statements: number
  /** 当前执行的 SQL 语句（截断显示） */
  current_sql: string
  /** 已执行成功的语句数 */
  success_count: number
  /** 已执行失败的语句数 */
  error_count: number
  /** 是否已完成 */
  is_complete: boolean
}

export interface StatementExecutionResult {
  /** 语句序号 */
  index: number
  /** SQL 语句（截断） */
  sql: string
  /** 是否成功 */
  success: boolean
  /** 错误信息（失败时） */
  error_message?: string
  /** 执行时间（毫秒） */
  duration_ms: number
  /** 影响的行数（如果是 DML） */
  rows_affected?: number
}

export interface SqlFileExecutionResult {
  /** 文件路径 */
  file_path: string
  /** 总语句数 */
  total_statements: number
  /** 成功执行的语句数 */
  success_count: number
  /** 执行失败的语句数 */
  error_count: number
  /** 执行详情 */
  statements: StatementExecutionResult[]
  /** 总执行时间（毫秒） */
  total_duration_ms: number
}

// ============================================
// 表结构设计器相关类型 (DDL Designer)
// ============================================

/** SQLite 数据类型 */
export type SQLiteDataType =
  | 'INTEGER'
  | 'REAL'
  | 'TEXT'
  | 'BLOB'
  | 'NUMERIC'
  | 'BOOLEAN'
  | 'DATETIME'
  | 'DATE'
  | 'TIME'
  | 'VARCHAR'
  | 'CHAR'
  | 'DECIMAL'
  | 'FLOAT'
  | 'DOUBLE'
  | 'INT'
  | 'BIGINT'
  | 'SMALLINT'
  | 'TINYINT'

/** 外键约束动作 */
export type ForeignKeyAction = 'NO ACTION' | 'RESTRICT' | 'SET NULL' | 'SET DEFAULT' | 'CASCADE'

/** 设计器中的字段定义 */
export interface DesignerColumn {
  id: string
  name: string
  data_type: SQLiteDataType
  nullable: boolean
  default_value?: string
  is_primary_key: boolean
  is_unique: boolean
  is_auto_increment: boolean
  comment?: string
  // 外键相关
  is_foreign_key: boolean
  foreign_key?: {
    ref_table: string
    ref_column: string
    on_update: ForeignKeyAction
    on_delete: ForeignKeyAction
  }
}

/** 设计器中的索引定义 */
export interface DesignerIndex {
  id: string
  name: string
  unique: boolean
  columns: string[]
  // 部分索引条件
  where_clause?: string
}

/** 设计器中的表定义 */
export interface DesignerTable {
  name: string
  columns: DesignerColumn[]
  indexes: DesignerIndex[]
  // 表级约束
  primary_key?: string[] // 复合主键列名列表
  // 表注释
  comment?: string
  // 严格模式 (SQLite 3.37.0+)
  strict_mode?: boolean
}

/** 创建表的请求 */
export interface CreateTableRequest {
  connection_id: string
  table: DesignerTable
}

/** 修改表的请求 */
export interface AlterTableRequest {
  connection_id: string
  table_name: string
  // 变更操作
  changes: TableChange[]
}

/** 表结构变更类型 */
export type TableChange =
  | { type: 'add_column'; column: DesignerColumn }
  | { type: 'drop_column'; column_name: string }
  | { type: 'rename_column'; old_name: string; new_name: string }
  | { type: 'alter_column'; column_name: string; new_column: DesignerColumn }
  | { type: 'add_index'; index: DesignerIndex }
  | { type: 'drop_index'; index_name: string }
  | { type: 'rename_table'; new_name: string }

/** 删除表的请求 */
export interface DropTableRequest {
  connection_id: string
  table_name: string
  // 是否级联删除相关对象
  cascade?: boolean
}

/** 预览DDL生成的请求 */
export interface PreviewDDLRequest {
  connection_id: string
  table?: DesignerTable
  changes?: TableChange[]
  existing_table_name?: string
  operation: 'create' | 'alter' | 'drop'
}

/** DDL预览结果 */
export interface PreviewDDLResult {
  sql: string
  warnings: string[]
  // 预估影响
  estimated_impact?: {
    will_recreate_table: boolean
    data_loss_risk: boolean
    affected_rows?: number
  }
}

/** DDL执行结果 */
export interface DDLExecutionResult {
  success: boolean
  sql: string
  message?: string
  // 执行时间
  execution_time_ms: number
}

// ============================================
// SQL 模板/片段库相关类型
// ============================================

/** SQL 片段类型 */
export type SnippetType = 'builtin' | 'custom'

/** SQL 片段分类 */
export type SnippetCategory =
  | 'query'      // 查询
  | 'dml'        // 数据操作
  | 'ddl'        // 表结构
  | 'function'   // 函数
  | 'other'      // 其他

/** SQL 片段 */
export interface Snippet {
  id: string
  name: string
  description?: string
  sql: string
  type: SnippetType
  category: SnippetCategory
  tags: string[]
  variables?: SnippetVariable[]
  created_at: string
  updated_at: string
}

/** SQL 片段变量 */
export interface SnippetVariable {
  name: string
  description?: string
  default_value?: string
  required: boolean
}

/** 创建片段请求 */
export interface CreateSnippetRequest {
  name: string
  description?: string
  sql: string
  category: SnippetCategory
  tags?: string[]
  variables?: SnippetVariable[]
}

/** 更新片段请求 */
export interface UpdateSnippetRequest {
  id: string
  name?: string
  description?: string
  sql?: string
  category?: SnippetCategory
  tags?: string[]
  variables?: SnippetVariable[]
}

/** 片段过滤器 */
export interface SnippetFilter {
  type?: SnippetType
  category?: SnippetCategory
  tag?: string
  keyword?: string
}
