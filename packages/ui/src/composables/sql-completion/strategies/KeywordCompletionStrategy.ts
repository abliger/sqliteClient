import type { SQLCompletionStrategy, CompletionResult, CompletionItem } from '../types'
import { CompletionItemKind } from '../types'

// 默认 SQL 关键字列表
const DEFAULT_KEYWORDS = [
    'SELECT',
    'FROM',
    'WHERE',
    'INSERT',
    'UPDATE',
    'DELETE',
    'CREATE',
    'DROP',
    'TABLE',
    'INDEX',
    'VIEW',
    'TRIGGER',
    'JOIN',
    'LEFT',
    'RIGHT',
    'INNER',
    'OUTER',
    'ON',
    'AS',
    'AND',
    'OR',
    'NOT',
    'NULL',
    'IS',
    'IN',
    'EXISTS',
    'BETWEEN',
    'LIKE',
    'ORDER',
    'BY',
    'GROUP',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'UNION',
    'ALL',
    'DISTINCT',
    'CASE',
    'WHEN',
    'THEN',
    'ELSE',
    'END',
    'IF',
    'ALTER',
    'ADD',
    'COLUMN',
    'PRIMARY',
    'KEY',
    'FOREIGN',
    'REFERENCES',
    'UNIQUE',
    'DEFAULT',
    'AUTOINCREMENT',
    'CASCADE',
    'RESTRICT',
    'INT',
    'INTEGER',
    'REAL',
    'TEXT',
    'BLOB',
    'NUMERIC',
    'BOOLEAN',
    'DATE',
    'DATETIME',
    'VALUES',
    'INTO',
    'SET',
]

/**
 * 关键字补全策略
 */
export class KeywordCompletionStrategy implements SQLCompletionStrategy {
    readonly name = 'keywords'
    readonly priority = 100

    private keywords: string[]

    constructor(customKeywords?: string[]) {
        this.keywords = customKeywords?.length
            ? [...DEFAULT_KEYWORDS, ...customKeywords]
            : DEFAULT_KEYWORDS
    }

    canProvide(): boolean {
        // 关键字在任何上下文都可以提供
        return true
    }

    provideCompletionItems(): CompletionResult {
        const items: CompletionItem[] = this.keywords.map(keyword => ({
            label: keyword,
            kind: CompletionItemKind.Keyword,
            insertText: keyword,
            detail: 'SQL Keyword',
            sortText: `2_${keyword}`, // 关键字排序靠后
        }))

        return { items }
    }
}
