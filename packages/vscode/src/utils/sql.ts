/**
 * SQL 工具函数 - 防止 SQL 注入
 */

// 有效的 SQL 标识符正则（字母、数字、下划线，不能以数字开头）
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/

// SQLite 关键字列表（需要转义的）
const SQLITE_KEYWORDS = new Set([
    'ABORT', 'ACTION', 'ADD', 'AFTER', 'ALL', 'ALTER', 'ALWAYS', 'ANALYZE', 'AND', 'AS',
    'ASC', 'ATTACH', 'AUTOINCREMENT', 'BEFORE', 'BEGIN', 'BETWEEN', 'BY', 'CASCADE',
    'CASE', 'CAST', 'CHECK', 'COLLATE', 'COLUMN', 'COMMIT', 'CONFLICT', 'CONSTRAINT',
    'CREATE', 'CROSS', 'CURRENT', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
    'DATABASE', 'DEFAULT', 'DEFERRABLE', 'DEFERRED', 'DELETE', 'DESC', 'DETACH',
    'DISTINCT', 'DO', 'DROP', 'EACH', 'ELSE', 'END', 'ESCAPE', 'EXCEPT', 'EXCLUDE',
    'EXCLUSIVE', 'EXISTS', 'EXPLAIN', 'FAIL', 'FILTER', 'FIRST', 'FOLLOWING', 'FOR',
    'FOREIGN', 'FROM', 'FULL', 'GENERATED', 'GLOB', 'GROUP', 'GROUPS', 'HAVING', 'IF',
    'IGNORE', 'IMMEDIATE', 'IN', 'INDEX', 'INDEXED', 'INITIALLY', 'INNER', 'INSERT',
    'INSTEAD', 'INTERSECT', 'INTO', 'IS', 'ISNULL', 'JOIN', 'KEY', 'LAST', 'LEFT',
    'LIKE', 'LIMIT', 'MATCH', 'NATURAL', 'NO', 'NOT', 'NOTHING', 'NOTNULL', 'NULL',
    'OF', 'OFFSET', 'ON', 'OR', 'ORDER', 'OTHERS', 'OUTER', 'OVER', 'PARTITION',
    'PLAN', 'PRAGMA', 'PRECEDING', 'PRIMARY', 'QUERY', 'RAISE', 'RANGE', 'RECURSIVE',
    'REFERENCES', 'REGEXP', 'REINDEX', 'RELEASE', 'RENAME', 'REPLACE', 'RESTRICT',
    'RETURNING', 'RIGHT', 'ROLLBACK', 'ROW', 'ROWS', 'SAVEPOINT', 'SELECT', 'SET',
    'TABLE', 'TEMP', 'TEMPORARY', 'THEN', 'TIES', 'TO', 'TRANSACTION', 'TRIGGER',
    'UNBOUNDED', 'UNION', 'UNIQUE', 'UPDATE', 'USING', 'VACUUM', 'VALUES', 'VIEW',
    'VIRTUAL', 'WHEN', 'WHERE', 'WINDOW', 'WITH', 'WITHOUT'
])

/**
 * 验证 SQL 标识符（表名、列名等）
 * @throws Error 如果标识符无效
 */
export function validateIdentifier(name: string): string {
    if (!name || typeof name !== 'string') {
        throw new Error(`Invalid identifier: ${name}`)
    }
    
    // 检查是否是关键字
    if (SQLITE_KEYWORDS.has(name.toUpperCase())) {
        // 关键字允许使用，但需要双引号包裹
        return `"${name}"`
    }
    
    // 验证标识符格式
    if (!VALID_IDENTIFIER.test(name)) {
        throw new Error(`Invalid SQL identifier: ${name}`)
    }
    
    return `"${name}"`
}

/**
 * 安全的格式化表名
 */
export function quoteTableName(name: string): string {
    // 替换双引号为两个双引号（SQLite 的转义规则）
    const escaped = name.replace(/"/g, '""')
    return `"${escaped}"`
}

/**
 * 安全的格式化列名
 */
export function quoteColumnName(name: string): string {
    const escaped = name.replace(/"/g, '""')
    return `"${escaped}"`
}

/**
 * 转义字符串值（用于 LIKE 子句）
 */
export function escapeLikePattern(pattern: string): string {
    return pattern
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
}

/**
 * 判断是否为 SELECT 查询
 * 处理 CTE (WITH)、EXPLAIN 等情况
 */
export function isSelectQuery(sql: string): boolean {
    const normalized = sql.trim().toUpperCase()
    // 匹配: SELECT, WITH, EXPLAIN SELECT, EXPLAIN QUERY PLAN SELECT 等
    return /^(\s*(EXPLAIN\s+(QUERY\s+PLAN\s+)?)?\s*(SELECT|WITH)\b)/.test(normalized)
}

/**
 * 判断是否为只读查询
 */
export function isReadOnlyQuery(sql: string): boolean {
    const normalized = sql.trim().toUpperCase()
    // 只允许 SELECT 和某些 PRAGMA
    return /^(SELECT|PRAGMA\s+(?!\s*WRITE)|WITH)\b/.test(normalized)
}

/**
 * 验证 ORDER BY 方向
 */
export function validateOrderDirection(dir: string): 'ASC' | 'DESC' {
    const upper = dir.toUpperCase()
    if (upper !== 'ASC' && upper !== 'DESC') {
        throw new Error(`Invalid order direction: ${dir}`)
    }
    return upper as 'ASC' | 'DESC'
}

/**
 * 验证 LIMIT 和 OFFSET 值
 */
export function validateLimit(limit: number): number {
    if (!Number.isInteger(limit) || limit < 0 || limit > 100000) {
        throw new Error(`Invalid limit: ${limit}`)
    }
    return limit
}

export function validateOffset(offset: number): number {
    if (!Number.isInteger(offset) || offset < 0) {
        throw new Error(`Invalid offset: ${offset}`)
    }
    return offset
}
