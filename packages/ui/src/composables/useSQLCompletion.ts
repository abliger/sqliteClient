import { watch, type Ref, type ComputedRef } from 'vue'
import * as monaco from 'monaco-editor'
import type { TableInfo, ColumnInfo } from '@types'

// SQL 关键字列表
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
  'TABLE', 'INDEX', 'VIEW', 'TRIGGER', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
  'ON', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'EXISTS', 'BETWEEN',
  'LIKE', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
  'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE',
  'END', 'IF', 'ALTER', 'ADD', 'COLUMN', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
  'UNIQUE', 'DEFAULT', 'AUTOINCREMENT', 'NOT NULL', 'CASCADE', 'RESTRICT',
  'INT', 'INTEGER', 'REAL', 'TEXT', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATE', 'DATETIME'
]

// SQLite 内置函数
const SQL_FUNCTIONS = [
  'abs', 'changes', 'char', 'coalesce', 'date', 'datetime', 'format', 'glob',
  'hex', 'ifnull', 'iif', 'instr', 'json', 'json_array', 'json_array_length',
  'json_extract', 'json_insert', 'json_object', 'json_patch', 'json_remove',
  'json_replace', 'json_set', 'json_type', 'json_valid', 'julianday', 'last_insert_rowid',
  'length', 'like', 'likelihood', 'likely', 'lower', 'ltrim', 'max', 'min',
  'nullif', 'printf', 'quote', 'random', 'randomblob', 'replace', 'round',
  'rtrim', 'sign', 'soundex', 'sqlite_compileoption_get', 'sqlite_compileoption_used',
  'sqlite_offset', 'sqlite_source_id', 'sqlite_version', 'strftime', 'substr',
  'substring', 'time', 'total_changes', 'trim', 'typeof', 'unicode', 'unixepoch',
  'unlikely', 'upper', 'zeroblob'
]

export interface SQLCompletionOptions {
  tables: Ref<TableInfo[]> | ComputedRef<TableInfo[]>
  getTableByName: (name: string) => TableInfo | undefined
}

export function useSQLCompletion(options: SQLCompletionOptions) {
  const { tables, getTableByName } = options
  let completionDisposable: monaco.IDisposable | null = null

  // 获取所有表名
  const getTableNames = () => tables.value.map(t => t.name)

  // 获取所有列名（去重）
  const getAllColumnNames = () => {
    const columns = new Set<string>()
    tables.value.forEach(table => {
      table.columns.forEach(col => columns.add(col.name))
    })
    return Array.from(columns)
  }

  // 获取表的列
  const getTableColumns = (tableName: string): ColumnInfo[] => {
    const table = getTableByName(tableName)
    return table?.columns || []
  }

  // 分析当前上下文
  const analyzeContext = (model: monaco.editor.ITextModel, position: monaco.Position) => {
    const textBeforeCursor = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    })

    const currentLine = model.getLineContent(position.lineNumber)
    const textBeforeCursorOnLine = currentLine.substring(0, position.column - 1)

    // 检查是否在表名后输入了点号
    const dotMatch = textBeforeCursorOnLine.match(/(\w+)\.\s*$/)
    if (dotMatch) {
      return { type: 'table_columns', tableName: dotMatch[1] } as const
    }

    // 检查是否在 FROM/JOIN 后
    const fromMatch = textBeforeCursor.match(/\b(FROM|JOIN)\b[^,]*$/i)
    if (fromMatch) {
      return { type: 'tables' } as const
    }

    // 检查是否在 SELECT/WHERE/AND/OR 后
    const columnContextMatch = textBeforeCursor.match(/\b(SELECT|WHERE|AND|OR|SET|ON|ORDER\s+BY|GROUP\s+BY|HAVING)\b[^,]*$/i)
    if (columnContextMatch) {
      return { type: 'columns_and_keywords' } as const
    }

    // 检查是否在 INSERT INTO 后
    const insertMatch = textBeforeCursor.match(/\bINSERT\s+INTO\b\s*$/i)
    if (insertMatch) {
      return { type: 'tables' } as const
    }

    // 检查是否在 UPDATE 后
    const updateMatch = textBeforeCursor.match(/\bUPDATE\b\s*$/i)
    if (updateMatch) {
      return { type: 'tables' } as const
    }

    return { type: 'keywords' } as const
  }

  // 注册补全提供者
  const registerCompletionProvider = () => {
    if (completionDisposable) {
      completionDisposable.dispose()
    }

    completionDisposable = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.', ' ', '\n', ','],
      provideCompletionItems: (model, position) => {
        const context = analyzeContext(model, position)
        const suggestions: monaco.languages.CompletionItem[] = []
        const wordInfo = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endColumn: wordInfo.endColumn
        }

        switch (context.type) {
          case 'table_columns': {
            // 表名. 后提示列名
            const columns = getTableColumns(context.tableName)
            columns.forEach(col => {
              suggestions.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                detail: `${col.data_type}${col.is_primary_key ? ' (PK)' : ''}${col.is_foreign_key ? ' (FK)' : ''}`,
                documentation: `Column: ${col.name}\nType: ${col.data_type}\nNullable: ${col.nullable}`,
                range
              })
            })
            break
          }

          case 'tables': {
            // 提示表名
            getTableNames().forEach(tableName => {
              const table = getTableByName(tableName)
              suggestions.push({
                label: tableName,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: tableName,
                detail: `Table (${table?.columns.length || 0} columns)`,
                range
              })
            })
            // 同时提示关键字
            SQL_KEYWORDS.forEach(keyword => {
              suggestions.push({
                label: keyword,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: keyword,
                range
              })
            })
            break
          }

          case 'columns_and_keywords': {
            // 提示列名和关键字
            getAllColumnNames().forEach(colName => {
              suggestions.push({
                label: colName,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: colName,
                detail: 'Column',
                range
              })
            })
            // 关键字
            SQL_KEYWORDS.forEach(keyword => {
              suggestions.push({
                label: keyword,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: keyword,
                range
              })
            })
            // 函数
            SQL_FUNCTIONS.forEach(func => {
              suggestions.push({
                label: func,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: `${func}()`,
                detail: 'SQLite Function',
                range
              })
            })
            break
          }

          case 'keywords':
          default: {
            // 默认提示关键字
            SQL_KEYWORDS.forEach(keyword => {
              suggestions.push({
                label: keyword,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: keyword,
                range
              })
            })
            // 表名
            getTableNames().forEach(tableName => {
              suggestions.push({
                label: tableName,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: tableName,
                detail: 'Table',
                range
              })
            })
            break
          }
        }

        return { suggestions }
      }
    })
  }

  // 监听表变化，更新补全
  watch(tables, () => {
    registerCompletionProvider()
  }, { immediate: true })

  const dispose = () => {
    if (completionDisposable) {
      completionDisposable.dispose()
      completionDisposable = null
    }
  }

  return {
    registerCompletionProvider,
    dispose
  }
}
