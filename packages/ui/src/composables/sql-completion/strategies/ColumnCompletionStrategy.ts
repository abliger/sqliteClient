import type {
  SQLCompletionStrategy,
  CompletionContext,
  CompletionResult,
  SchemaDataSource,
  CompletionItem
} from '../types'
import { CompletionItemKind } from '../types'

/**
 * 列名补全策略
 */
export class ColumnCompletionStrategy implements SQLCompletionStrategy {
  readonly name = 'columns'
  readonly priority = 85
  
  canProvide(context: CompletionContext): boolean {
    // 在 SELECT、WHERE、AND、OR、SET、ON、ORDER BY 后提供列名补全
    const patterns = [
      /\b(SELECT|WHERE|AND|OR|SET|ON|ORDER\s+BY|GROUP\s+BY|HAVING)\b[^,]*$/i,
      /[=<>!+\-*/(]\s*$/ // 在运算符后
    ]
    return patterns.some(p => p.test(context.textBeforeCursor))
  }
  
  provideCompletionItems(
    context: CompletionContext,
    schemaSource: SchemaDataSource
  ): CompletionResult {
    // 检查是否是 表名. 后的列名补全
    const dotMatch = context.textBeforeCursorOnLine.match(/(\w+)\.\s*$/)
    
    if (dotMatch) {
      return this.provideTableColumns(dotMatch[1], schemaSource)
    }
    
    return this.provideAllColumns(schemaSource)
  }
  
  /**
   * 提供特定表的列
   */
  private provideTableColumns(
    tableName: string,
    schemaSource: SchemaDataSource
  ): CompletionResult {
    const columns = schemaSource.getTableColumns(tableName)
    
    const items: CompletionItem[] = columns.map(col => ({
      label: col.name,
      kind: CompletionItemKind.Column,
      insertText: col.name,
      detail: this.generateColumnDetail(col),
      documentation: this.generateColumnDocumentation(col, tableName),
      sortText: `0_${col.name}` // 列名排序最前
    }))
    
    return { items }
  }
  
  /**
   * 提供所有列（去重）
   */
  private provideAllColumns(schemaSource: SchemaDataSource): CompletionResult {
    const tables = schemaSource.getTables()
    const columnMap = new Map<string, { col: { name: string; data_type: string }; tables: string[] }>()
    
    tables.forEach(table => {
      table.columns.forEach(col => {
        if (columnMap.has(col.name)) {
          columnMap.get(col.name)!.tables.push(table.name)
        } else {
          columnMap.set(col.name, { col, tables: [table.name] })
        }
      })
    })
    
    const items: CompletionItem[] = Array.from(columnMap.entries()).map(([name, { col, tables }]) => ({
      label: name,
      kind: CompletionItemKind.Column,
      insertText: name,
      detail: `${col.data_type}`,
      documentation: `Column: ${name}\nType: ${col.data_type}\nAppears in: ${tables.join(', ')}`,
      sortText: `1_${name}`
    }))
    
    return { items }
  }
  
  private generateColumnDetail(col: { 
    data_type: string; 
    is_primary_key?: boolean; 
    is_foreign_key?: boolean 
  }): string {
    const parts = [col.data_type]
    if (col.is_primary_key) parts.push('PK')
    if (col.is_foreign_key) parts.push('FK')
    return parts.join(' ')
  }
  
  private generateColumnDocumentation(
    col: { 
      name: string; 
      data_type: string; 
      nullable?: boolean; 
      default_value?: string 
    },
    tableName?: string
  ): string {
    const lines = [
      `Column: ${col.name}`,
      `Type: ${col.data_type}`,
      `Nullable: ${col.nullable !== false ? 'YES' : 'NO'}`
    ]
    if (tableName) lines.push(`Table: ${tableName}`)
    if (col.default_value) lines.push(`Default: ${col.default_value}`)
    return lines.join('\n')
  }
}
