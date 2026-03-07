import { format } from 'sql-formatter'

export interface SQLFormatOptions {
    keywordCase?: 'preserve' | 'upper' | 'lower'
    identifierCase?: 'preserve' | 'upper' | 'lower'
    dataTypeCase?: 'preserve' | 'upper' | 'lower'
    functionCase?: 'preserve' | 'upper' | 'lower'
    indentStyle?: 'standard' | 'tabularLeft' | 'tabularRight'
    tabWidth?: number
    useTabs?: boolean
    expressionWidth?: number
    linesBetweenQueries?: number
    denseOperators?: boolean
    newlineBeforeSemicolon?: boolean
}

/**
 * SQL 格式化服务
 */
export const sqlFormatter = {
    /**
     * 格式化 SQL 代码
     * @param sql 原始 SQL 代码
     * @param options 格式化选项
     * @returns 格式化后的 SQL 代码
     */
    format(sql: string, options: SQLFormatOptions = {}): string {
        try {
            return format(sql, {
                language: 'sqlite',
                keywordCase: 'upper',
                identifierCase: 'preserve',
                dataTypeCase: 'upper',
                functionCase: 'upper',
                indentStyle: 'standard',
                tabWidth: 4,
                useTabs: false,
                expressionWidth: 80,
                linesBetweenQueries: 2,
                denseOperators: false,
                newlineBeforeSemicolon: false,
                ...options,
            })
        } catch (err) {
            console.error('SQL format failed:', err)
            // 格式化失败时返回原始代码
            return sql
        }
    },

    /**
     * 检查 SQL 是否可以格式化
     * @param sql SQL 代码
     * @returns 是否可以格式化
     */
    canFormat(sql: string): boolean {
        return sql.trim().length > 0
    },
}
