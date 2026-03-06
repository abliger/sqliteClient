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
}

export interface QueryResultExecution {
  type: 'execution'
  rows_affected: number
  last_insert_id?: number
  execution_time_ms: number
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
