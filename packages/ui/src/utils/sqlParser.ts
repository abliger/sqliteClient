/**
 * SQL 解析工具
 * 用于从 SQL 语句中提取表名等信息
 */

/**
 * 从 SQL 语句中提取表名
 * 支持 SELECT, UPDATE, DELETE, INSERT 语句
 * 支持多表 JOIN
 */
export function extractTableNames(sql: string): string[] {
    if (!sql || typeof sql !== 'string') return []

    const tables: string[] = []

    // 移除注释
    const cleanSql = sql.replace(/(--.*$)|(\/\*[\s\S]*?\*\/)/gm, '')

    // 提取 FROM 后的表名
    const fromRegex = /\bFROM\s+(['"`]?[a-zA-Z_][a-zA-Z0-9_]*['"`]?)/gi
    let match
    while ((match = fromRegex.exec(cleanSql)) !== null) {
        const tableName = match[1].replace(/['"`]/g, '')
        if (isValidIdentifier(tableName)) {
            tables.push(tableName)
        }
    }

    // 提取 JOIN 后的表名
    const joinRegex = /\bJOIN\s+(['"`]?[a-zA-Z_][a-zA-Z0-9_]*['"`]?)/gi
    while ((match = joinRegex.exec(cleanSql)) !== null) {
        const tableName = match[1].replace(/['"`]/g, '')
        if (isValidIdentifier(tableName) && !tables.includes(tableName)) {
            tables.push(tableName)
        }
    }

    // 提取 UPDATE 后的表名
    const updateRegex = /\bUPDATE\s+(['"`]?[a-zA-Z_][a-zA-Z0-9_]*['"`]?)/gi
    while ((match = updateRegex.exec(cleanSql)) !== null) {
        const tableName = match[1].replace(/['"`]/g, '')
        if (isValidIdentifier(tableName) && !tables.includes(tableName)) {
            tables.push(tableName)
        }
    }

    // 提取 INTO 后的表名 (INSERT INTO)
    const intoRegex = /\bINTO\s+(['"`]?[a-zA-Z_][a-zA-Z0-9_]*['"`]?)/gi
    while ((match = intoRegex.exec(cleanSql)) !== null) {
        const tableName = match[1].replace(/['"`]/g, '')
        if (isValidIdentifier(tableName) && !tables.includes(tableName)) {
            tables.push(tableName)
        }
    }

    return tables
}

/**
 * 从 SQL 语句中提取主表名（用于数据编辑）
 * 优先返回单表查询的表名，多表 JOIN 时返回第一个 FROM 表
 */
export function extractPrimaryTableName(sql: string): string | null {
    const tables = extractTableNames(sql)

    if (tables.length === 0) return null
    if (tables.length === 1) return tables[0]

    // 多表情况，检查是否有 JOIN
    const cleanSql = sql.replace(/(--.*$)|(\/\*[\s\S]*?\*\/)/gm, '')

    // 如果有 JOIN，返回 FROM 后的第一个表（通常是主表）
    const fromMatch = cleanSql.match(/\bFROM\s+(['"`]?[a-zA-Z_][a-zA-Z0-9_]*['"`]?)/i)
    if (fromMatch) {
        return fromMatch[1].replace(/['"`]/g, '')
    }

    return tables[0]
}

/**
 * 验证标识符是否合法
 */
function isValidIdentifier(name: string): boolean {
    if (!name || name.length === 0) return false
    // 必须以字母或下划线开头，后续可以是字母、数字、下划线
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

/**
 * 判断 SQL 是否为 SELECT 语句
 */
export function isSelectQuery(sql: string): boolean {
    if (!sql) return false
    const cleanSql = sql.replace(/(--.*$)|(\/\*[\s\S]*?\*\/)/gm, '').trim()
    return /^SELECT\b/i.test(cleanSql)
}

/**
 * 判断 SQL 是否允许编辑结果
 * 只允许简单的单表 SELECT 查询编辑
 */
export function isEditableQuery(sql: string): boolean {
    if (!sql) return false

    const cleanSql = sql.replace(/(--.*$)|(\/\*[\s\S]*?\*\/)/gm, '').trim()
    const upperClean = cleanSql.toUpperCase()

    // 必须是 SELECT
    if (!upperClean.startsWith('SELECT')) return false

    // 不支持 GROUP BY, HAVING, DISTINCT, UNION 等
    const forbiddenKeywords = ['GROUP BY', 'HAVING', 'DISTINCT', 'UNION', 'AGGREGATE', 'COUNT(', 'SUM(', 'AVG(', 'MAX(', 'MIN(']
    for (const kw of forbiddenKeywords) {
        if (upperClean.includes(kw)) return false
    }

    // 检查是否单表查询（没有 JOIN）
    const tables = extractTableNames(sql)
    if (tables.length !== 1) return false

    return true
}

/**
 * 生成 WHERE 子句用于编辑/删除
 * 根据主键或所有列生成条件
 */
export function generateWhereClause(
    columns: Record<string, unknown>,
    primaryKeyColumn?: string
): { clause: string; params: unknown[] } {
    const params: unknown[] = []

    if (primaryKeyColumn && columns[primaryKeyColumn] !== undefined) {
        // 使用主键
        params.push(columns[primaryKeyColumn])
        return {
            clause: `"${primaryKeyColumn}" = ?`,
            params
        }
    }

    // 使用所有非空列
    const conditions: string[] = []
    for (const [col, value] of Object.entries(columns)) {
        if (value !== null && value !== undefined) {
            conditions.push(`"${col}" = ?`)
            params.push(value)
        }
    }

    return {
        clause: conditions.join(' AND '),
        params
    }
}
