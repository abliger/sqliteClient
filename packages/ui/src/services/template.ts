import type {
  Snippet,
  SnippetCategory,
  SnippetFilter,
  CreateSnippetRequest,
  UpdateSnippetRequest,
  SnippetVariable,
} from '@types'

/**
 * 解析 SQL 模板中的变量
 * 支持格式：{{variable_name}} 或 {{ variable_name }}
 */
export function extractVariables(sql: string): SnippetVariable[] {
  if (!sql || typeof sql !== 'string') {
    return []
  }

  const variables: SnippetVariable[] = []
  const regex = /\{\{\s*(\w+)\s*\}\}/g
  const seen = new Set<string>()

  try {
    const matches = sql.matchAll(regex)
    for (const match of matches) {
      const name = match[1]
      if (name && !seen.has(name)) {
        seen.add(name)
        variables.push({
          name,
          description: '',
          required: false,
        })
      }
    }
  } catch {
    // 如果 matchAll 不支持或出错，返回空数组
  }

  return variables
}

/**
 * 填充模板变量
 */
export function fillTemplate(template: string, variables: Record<string, string>): string {
  let result = template

  Object.entries(variables).forEach(([key, value]) => {
    // 支持 {{key}} 和 {{ key }} 格式
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    result = result.replace(regex, value)
  })

  return result
}

/**
 * 检查模板是否还有未填充的变量
 */
export function hasUnfilledVariables(sql: string): boolean {
  const regex = /\{\{\s*\w+\s*\}\}/
  return regex.test(sql)
}

/**
 * 获取未填充的变量名列表
 */
export function getUnfilledVariableNames(sql: string): string[] {
  const regex = /\{\{\s*(\w+)\s*\}\}/g
  const matches = sql.matchAll(regex)
  const names = new Set<string>()

  for (const match of matches) {
    names.add(match[1])
  }

  return Array.from(names)
}

// 类型过滤条件检查
const checkTypeFilter = (snippet: Snippet, filterType?: string): boolean => {
  return !filterType || snippet.type === filterType
}

// 分类过滤条件检查
const checkCategoryFilter = (snippet: Snippet, filterCategory?: string): boolean => {
  return !filterCategory || snippet.category === filterCategory
}

// 标签过滤条件检查
const checkTagFilter = (snippet: Snippet, filterTag?: string): boolean => {
  return !filterTag || snippet.tags.includes(filterTag)
}

// 关键字匹配检查
const checkKeywordMatch = (snippet: Snippet, keyword: string): boolean => {
  const lowerKeyword = keyword.toLowerCase()
  const matchesName = snippet.name.toLowerCase().includes(lowerKeyword)
  const matchesDesc = snippet.description?.toLowerCase().includes(lowerKeyword) ?? false
  const matchesSql = snippet.sql.toLowerCase().includes(lowerKeyword)
  const matchesTags = snippet.tags.some(t => t.toLowerCase().includes(lowerKeyword))

  return matchesName || matchesDesc || matchesSql || matchesTags
}

/**
 * 根据过滤条件筛选片段
 */
export function filterSnippets(snippets: Snippet[], filter: SnippetFilter): Snippet[] {
  return snippets.filter(snippet => {
    // 基本过滤条件
    if (!checkTypeFilter(snippet, filter.type)) return false
    if (!checkCategoryFilter(snippet, filter.category)) return false
    if (!checkTagFilter(snippet, filter.tag)) return false

    // 关键字过滤
    if (filter.keyword && !checkKeywordMatch(snippet, filter.keyword)) return false

    return true
  })
}

/**
 * 对片段进行分类
 */
export function categorizeSnippets(snippets: Snippet[]): Record<SnippetCategory, Snippet[]> {
  const categories: Record<SnippetCategory, Snippet[]> = {
    query: [],
    dml: [],
    ddl: [],
    function: [],
    other: [],
  }

  snippets.forEach(snippet => {
    categories[snippet.category].push(snippet)
  })

  return categories
}

/**
 * 获取所有唯一的标签
 */
export function getAllTags(snippets: Snippet[]): string[] {
  const tags = new Set<string>()
  snippets.forEach(s => s.tags.forEach(t => tags.add(t)))
  return Array.from(tags).sort()
}

/**
 * 格式化 SQL 片段（移除多余空行等）
 */
export function formatSnippetSql(sql: string): string {
  return sql
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 验证创建片段请求
 */
export function validateCreateRequest(request: CreateSnippetRequest): { valid: boolean; error?: string } {
  if (!request.name || request.name.trim().length === 0) {
    return { valid: false, error: '片段名称不能为空' }
  }

  if (request.name.length > 100) {
    return { valid: false, error: '片段名称不能超过100个字符' }
  }

  if (!request.sql || request.sql.trim().length === 0) {
    return { valid: false, error: 'SQL 内容不能为空' }
  }

  if (request.sql.length > 10000) {
    return { valid: false, error: 'SQL 内容不能超过10000个字符' }
  }

  if (request.description && request.description.length > 500) {
    return { valid: false, error: '描述不能超过500个字符' }
  }

  return { valid: true }
}

/**
 * 验证更新片段请求
 */
export function validateUpdateRequest(request: UpdateSnippetRequest): { valid: boolean; error?: string } {
  if (request.name !== undefined) {
    if (request.name.trim().length === 0) {
      return { valid: false, error: '片段名称不能为空' }
    }
    if (request.name.length > 100) {
      return { valid: false, error: '片段名称不能超过100个字符' }
    }
  }

  if (request.sql !== undefined) {
    if (request.sql.trim().length === 0) {
      return { valid: false, error: 'SQL 内容不能为空' }
    }
    if (request.sql.length > 10000) {
      return { valid: false, error: 'SQL 内容不能超过10000个字符' }
    }
  }

  if (request.description !== undefined && request.description.length > 500) {
    return { valid: false, error: '描述不能超过500个字符' }
  }

  return { valid: true }
}

/**
 * 生成默认变量值
 */
export function generateDefaultVariables(variables: SnippetVariable[]): Record<string, string> {
  const result: Record<string, string> = {}

  variables.forEach(v => {
    if (v.default_value !== undefined) {
      result[v.name] = v.default_value
    } else if (!v.required) {
      // 非必填变量没有默认值时设为空字符串
      result[v.name] = ''
    }
  })

  return result
}

/**
 * 导出片段为 JSON
 */
export function exportSnippets(snippets: Snippet[]): string {
  return JSON.stringify(snippets, null, 2)
}

/**
 * 从 JSON 导入片段
 */
export function importSnippets(json: string): Snippet[] {
  const data = JSON.parse(json)
  if (!Array.isArray(data)) {
    throw new Error('导入的数据格式错误，应为数组')
  }
  return data as Snippet[]
}

/**
 * 复制片段（用于创建副本）
 */
export function duplicateSnippet(snippet: Snippet, newId: string): Snippet {
  const now = new Date().toISOString()
  return {
    ...snippet,
    id: newId,
    name: `${snippet.name} (副本)`,
    type: 'custom',
    created_at: now,
    updated_at: now,
  }
}
