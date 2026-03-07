/**
 * SQL 解析工具
 * 用于从 SQL 语句中提取表名等信息
 */

// SQL 清理函数
const removeComments = (sql: string): string => {
  return sql.replace(/(--.*$)|(\/\*[\s\S]*?\*\/)/gm, '')
}

// 表名提取器类型
type TableExtractor = (sql: string) => string[]

// 创建通用表名提取器
const createTableExtractor = (keyword: string): TableExtractor => {
  return (sql: string) => {
    const tables: string[] = []
    const regex = new RegExp(`\\b${keyword}\\s+(['"\`]?[a-zA-Z_][a-zA-Z0-9_]*['"\`]?)`, 'gi')
    let match

    while ((match = regex.exec(sql)) !== null) {
      // eslint-disable-next-line no-useless-escape
      const tableName = match[1].replace(/['"\`]/g, '')
      if (isValidIdentifier(tableName)) {
        tables.push(tableName)
      }
    }

    return tables
  }
}

// 表名提取器映射
const tableExtractors: TableExtractor[] = [
  createTableExtractor('FROM'),
  createTableExtractor('JOIN'),
  createTableExtractor('UPDATE'),
  createTableExtractor('INTO'),
]

/**
 * 验证标识符是否合法
 */
function isValidIdentifier(name: string): boolean {
  if (!name || name.length === 0) return false
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

/**
 * 从 SQL 语句中提取表名
 * 支持 SELECT, UPDATE, DELETE, INSERT 语句
 * 支持多表 JOIN
 */
export function extractTableNames(sql: string): string[] {
  if (!sql || typeof sql !== 'string') return []

  const cleanSql = removeComments(sql)
  const tables = new Set<string>()

  // 使用所有提取器收集表名
  tableExtractors.forEach(extractor => {
    extractor(cleanSql).forEach(table => tables.add(table))
  })

  return Array.from(tables)
}

/**
 * 从 SQL 语句中提取主表名（用于数据编辑）
 * 优先返回单表查询的表名，多表 JOIN 时返回第一个 FROM 表
 */
export function extractPrimaryTableName(sql: string): string | null {
  const tables = extractTableNames(sql)

  if (tables.length === 0) return null
  if (tables.length === 1) return tables[0]

  // 多表情况，返回 FROM 后的第一个表
  const cleanSql = removeComments(sql)
  // eslint-disable-next-line no-useless-escape
  const fromMatch = cleanSql.match(/\bFROM\s+(['"\`]?[a-zA-Z_][a-zA-Z0-9_]*['"\`]?)/i)

  if (fromMatch) {
    // eslint-disable-next-line no-useless-escape
    return fromMatch[1].replace(/['"\`]/g, '')
  }

  return tables[0]
}

/**
 * 判断 SQL 是否为 SELECT 语句
 */
export function isSelectQuery(sql: string): boolean {
  if (!sql) return false
  const cleanSql = removeComments(sql).trim()
  return /^SELECT\b/i.test(cleanSql)
}

// 不可编辑查询的关键字列表
const FORBIDDEN_KEYWORDS = [
  'GROUP BY',
  'HAVING',
  'DISTINCT',
  'UNION',
  'AGGREGATE',
  'COUNT(',
  'SUM(',
  'AVG(',
  'MAX(',
  'MIN(',
]

/**
 * 检查 SQL 是否包含禁止编辑的关键字
 */
const hasForbiddenKeywords = (upperSql: string): boolean => {
  return FORBIDDEN_KEYWORDS.some(kw => upperSql.includes(kw))
}

/**
 * 判断 SQL 是否允许编辑结果
 * 只允许简单的单表 SELECT 查询编辑
 */
export function isEditableQuery(sql: string): boolean {
  if (!sql) return false

  const cleanSql = removeComments(sql).trim()
  const upperClean = cleanSql.toUpperCase()

  // 必须是 SELECT
  if (!upperClean.startsWith('SELECT')) return false

  // 不支持 GROUP BY, HAVING, DISTINCT, UNION 等
  if (hasForbiddenKeywords(upperClean)) return false

  // 检查是否单表查询
  const tables = extractTableNames(sql)
  return tables.length === 1
}

/**
 * 生成 WHERE 子句用于编辑/删除
 * 根据主键或所有列生成条件
 */
export function generateWhereClause(
  columns: Record<string, unknown>,
  primaryKeyColumn?: string,
): { clause: string; params: unknown[] } {
  const params: unknown[] = []

  // 优先使用主键
  if (primaryKeyColumn && columns[primaryKeyColumn] !== undefined) {
    params.push(columns[primaryKeyColumn])
    return {
      clause: `"${primaryKeyColumn}" = ?`,
      params,
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
    params,
  }
}
