import { unref, type MaybeRef } from 'vue'
import type { TableInfo, ColumnInfo } from '@types'
import type { SchemaDataSource } from './types'

/**
 * 基于 Pinia Store 的 Schema 数据源
 */
export class StoreSchemaDataSource implements SchemaDataSource {
  constructor(
    private tablesRef: MaybeRef<TableInfo[]>,
    private getTableByNameFn: (name: string) => TableInfo | undefined
  ) {}

  private getTablesValue(): TableInfo[] {
    return unref(this.tablesRef)
  }
  
  getTables(): TableInfo[] {
    return this.getTablesValue()
  }
  
  getTableByName(name: string): TableInfo | undefined {
    return this.getTableByNameFn(name)
  }
  
  getAllColumns(): string[] {
    const columns = new Set<string>()
    this.getTablesValue().forEach(table => {
      table.columns.forEach(col => columns.add(col.name))
    })
    return Array.from(columns)
  }
  
  getTableColumns(tableName: string): ColumnInfo[] {
    const table = this.getTableByNameFn(tableName)
    return table?.columns || []
  }
}

/**
 * 静态 Schema 数据源（用于测试或无后端环境）
 */
export class StaticSchemaDataSource implements SchemaDataSource {
  private tables: TableInfo[]
  
  constructor(tables: TableInfo[] = []) {
    this.tables = tables
  }
  
  getTables(): TableInfo[] {
    return this.tables
  }
  
  getTableByName(name: string): TableInfo | undefined {
    return this.tables.find(t => t.name === name)
  }
  
  getAllColumns(): string[] {
    const columns = new Set<string>()
    this.tables.forEach(table => {
      table.columns.forEach(col => columns.add(col.name))
    })
    return Array.from(columns)
  }
  
  getTableColumns(tableName: string): ColumnInfo[] {
    const table = this.getTableByName(tableName)
    return table?.columns || []
  }
  
  /**
   * 添加表
   */
  addTable(table: TableInfo): void {
    const index = this.tables.findIndex(t => t.name === table.name)
    if (index >= 0) {
      this.tables[index] = table
    } else {
      this.tables.push(table)
    }
  }
  
  /**
   * 移除表
   */
  removeTable(tableName: string): void {
    const index = this.tables.findIndex(t => t.name === tableName)
    if (index >= 0) {
      this.tables.splice(index, 1)
    }
  }
  
  /**
   * 清空数据
   */
  clear(): void {
    this.tables = []
  }
}
