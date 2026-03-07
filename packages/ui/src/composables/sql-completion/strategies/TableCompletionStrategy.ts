import type {
    SQLCompletionStrategy,
    CompletionContext,
    CompletionResult,
    SchemaDataSource,
    CompletionItem,
} from '../types'
import { CompletionItemKind } from '../types'

/**
 * 表名补全策略
 */
export class TableCompletionStrategy implements SQLCompletionStrategy {
    readonly name = 'tables'
    readonly priority = 90

    canProvide(context: CompletionContext): boolean {
        // 在 FROM、JOIN、INTO、UPDATE 后提供表名补全
        const patterns = [
            /\b(FROM|JOIN|INTO|UPDATE)\s+[\w,\s]*$/i,
            /\bFROM\s+\w+\s*,\s*$/i, // 多表查询
        ]
        return patterns.some(p => p.test(context.textBeforeCursor))
    }

    provideCompletionItems(
        _context: CompletionContext,
        schemaSource: SchemaDataSource,
    ): CompletionResult {
        const tables = schemaSource.getTables()

        const items: CompletionItem[] = tables.map(table => ({
            label: table.name,
            kind: CompletionItemKind.Table,
            insertText: table.name,
            detail: `Table (${table.columns.length} columns)`,
            documentation: this.generateTableDocumentation(table),
            sortText: `0_${table.name}`, // 表名排序最前
        }))

        return { items }
    }

    private generateTableDocumentation(table: {
        name: string
        columns: { name: string; data_type: string; is_primary_key?: boolean }[]
    }): string {
        const lines = [`Table: ${table.name}`, '', 'Columns:']
        table.columns.forEach(col => {
            const pk = col.is_primary_key ? ' PK' : ''
            lines.push(`  - ${col.name}: ${col.data_type}${pk}`)
        })
        return lines.join('\n')
    }
}
