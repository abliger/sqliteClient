import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type {
    Snippet,
    SnippetCategory,
    SnippetType,
    CreateSnippetRequest,
    UpdateSnippetRequest,
} from '@types'

const STORAGE_KEY = 'sqlite-client-snippets-v2'

// 内置 SQL 模板（全局可用，connection_id = null）
const BUILTIN_SNIPPETS: Snippet[] = [
    {
        id: 'builtin-pagination',
        name: '分页查询',
        description: '使用 LIMIT 和 OFFSET 实现分页查询',
        sql: `SELECT *
FROM {{table_name}}
ORDER BY {{order_column}}
LIMIT {{page_size}} OFFSET {{offset}};`,
        type: 'builtin',
        category: 'query',
        tags: ['分页', '查询', 'limit', 'offset'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'order_column', description: '排序列', default_value: 'id', required: true },
            { name: 'page_size', description: '每页条数', default_value: '20', required: true },
            { name: 'offset', description: '偏移量', default_value: '0', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        connection_id: null,
    },
    {
        id: 'builtin-pagination-total',
        name: '分页查询（带总数）',
        description: '使用窗口函数获取分页数据和总数',
        sql: `WITH paginated AS (
  SELECT *,
    COUNT(*) OVER() as total_count
  FROM {{table_name}}
  ORDER BY {{order_column}}
  LIMIT {{page_size}} OFFSET {{offset}}
)
SELECT * FROM paginated;`,
        type: 'builtin',
        category: 'query',
        tags: ['分页', '查询', '窗口函数', '总数'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'order_column', description: '排序列', default_value: 'id', required: true },
            { name: 'page_size', description: '每页条数', default_value: '20', required: true },
            { name: 'offset', description: '偏移量', default_value: '0', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        connection_id: null,
    },
    {
        id: 'builtin-date-current',
        name: '当前日期时间',
        description: '获取当前日期和时间的各种格式',
        sql: `-- 当前 Unix 时间戳（秒）
SELECT strftime('%s', 'now') as unix_timestamp;

-- 当前日期
SELECT date('now') as current_date;

-- 当前时间
SELECT time('now') as current_time;

-- 当前日期时间
SELECT datetime('now') as current_datetime;

-- ISO8601 格式
SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now') as iso_datetime;`,
        type: 'builtin',
        category: 'function',
        tags: ['日期', '时间', '当前'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        connection_id: null,
    },
    {
        id: 'builtin-stats-basic',
        name: '基础统计',
        description: '常用统计函数',
        sql: `SELECT
  COUNT(*) as total_count,
  COUNT(DISTINCT {{column_name}}) as distinct_count,
  MIN({{column_name}}) as min_value,
  MAX({{column_name}}) as max_value,
  AVG({{column_name}}) as avg_value,
  SUM({{column_name}}) as sum_value,
  SUM(CASE WHEN {{column_name}} IS NULL THEN 1 ELSE 0 END) as null_count
FROM {{table_name}};`,
        type: 'builtin',
        category: 'query',
        tags: ['统计', '聚合', '分析'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'column_name', description: '列名', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        connection_id: null,
    },
    {
        id: 'builtin-ddl-create-table',
        name: '创建表模板',
        description: '创建表的通用模板',
        sql: `CREATE TABLE IF NOT EXISTS {{table_name}} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  status INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_{{table_name}}_name ON {{table_name}}(name);
CREATE INDEX IF NOT EXISTS idx_{{table_name}}_status ON {{table_name}}(status);`,
        type: 'builtin',
        category: 'ddl',
        tags: ['DDL', '创建表', '索引'],
        variables: [{ name: 'table_name', description: '表名', required: true }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        connection_id: null,
    },
    {
        id: 'builtin-dml-upsert',
        name: 'UPSERT（插入或更新）',
        description: '插入数据，如果冲突则更新',
        sql: `INSERT INTO {{table_name}} (id, name, value, updated_at)
VALUES ({{id}}, '{{name}}', {{value}}, datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  value = excluded.value,
  updated_at = datetime('now');`,
        type: 'builtin',
        category: 'dml',
        tags: ['DML', '插入', '更新', 'UPSERT'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'id', description: '主键ID', required: true },
            { name: 'name', description: '名称', required: true },
            { name: 'value', description: '值', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        connection_id: null,
    },
]

// 从 localStorage 加载用户自定义片段
function loadCustomSnippets(): Snippet[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            return JSON.parse(saved)
        }
    } catch {
        // 静默处理加载错误，返回空数组
    }
    return []
}

// 保存用户自定义片段到 localStorage
function saveCustomSnippets(snippets: Snippet[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets))
    } catch {
        // 静默处理保存错误（如存储空间不足）
    }
}

export const useTemplateStore = defineStore('template', () => {
    // 用户自定义片段
    const customSnippets = ref<Snippet[]>(loadCustomSnippets())

    // 当前选中的数据库连接ID
    const currentConnectionId = ref<string | null>(null)

    // 搜索关键字
    const searchKeyword = ref('')

    // 选中的分类过滤
    const selectedCategory = ref<SnippetCategory | null>(null)

    // 选中的类型过滤
    const selectedType = ref<SnippetType | null>(null)

    // 选中的标签过滤
    const selectedTag = ref<string | null>(null)

    // 是否显示模板面板
    const isPanelOpen = ref(false)

    // 所有片段（内置 + 自定义）
    const allSnippets = computed<Snippet[]>(() => {
        return [...BUILTIN_SNIPPETS, ...customSnippets.value]
    })

    // 当前连接的片段（优先显示）+ 全局片段
    const connectionSnippets = computed<Snippet[]>(() => {
        const connId = currentConnectionId.value
        if (!connId) {
            // 没有选中连接时，只显示全局片段
            return allSnippets.value.filter(s => !s.connection_id || s.connection_id === null)
        }
        
        // 显示当前连接的片段 + 全局片段
        return allSnippets.value.filter(s => 
            !s.connection_id || s.connection_id === null || s.connection_id === connId
        )
    })

    // 过滤后的片段
    const filteredSnippets = computed<Snippet[]>(() => {
        let result = connectionSnippets.value

        // 按类型过滤
        if (selectedType.value) {
            result = result.filter(s => s.type === selectedType.value)
        }

        // 按分类过滤
        if (selectedCategory.value) {
            result = result.filter(s => s.category === selectedCategory.value)
        }

        // 按标签过滤
        if (selectedTag.value) {
            result = result.filter(s => s.tags.includes(selectedTag.value!))
        }

        // 按关键字搜索
        if (searchKeyword.value.trim()) {
            const keyword = searchKeyword.value.toLowerCase().trim()
            result = result.filter(
                s =>
                    s.name.toLowerCase().includes(keyword) ||
                    s.description?.toLowerCase().includes(keyword) ||
                    s.sql.toLowerCase().includes(keyword) ||
                    s.tags.some(t => t.toLowerCase().includes(keyword)),
            )
        }

        return result
    })

    // 仅当前连接的自定义片段（用于显示"我的片段"）
    const currentConnectionCustomSnippets = computed<Snippet[]>(() => {
        const connId = currentConnectionId.value
        if (!connId) return []
        return customSnippets.value.filter(s => s.connection_id === connId)
    })

    // 按分类分组的片段列表
    const snippetsByCategory = computed(() => {
        const groups: Record<SnippetCategory, Snippet[]> = {
            query: [],
            dml: [],
            ddl: [],
            function: [],
            other: [],
        }

        filteredSnippets.value.forEach(snippet => {
            groups[snippet.category].push(snippet)
        })

        return groups
    })

    // 所有可用标签（去重）
    const allTags = computed<string[]>(() => {
        const tags = new Set<string>()
        connectionSnippets.value.forEach(s => s.tags.forEach(t => tags.add(t)))
        return Array.from(tags).sort()
    })

    // 分类列表
    const categories: { value: SnippetCategory; label: string }[] = [
        { value: 'query', label: '查询' },
        { value: 'dml', label: '数据操作' },
        { value: 'ddl', label: '表结构' },
        { value: 'function', label: '函数' },
        { value: 'other', label: '其他' },
    ]

    // 设置当前连接ID
    function setCurrentConnectionId(connectionId: string | null) {
        currentConnectionId.value = connectionId
    }

    // 创建自定义片段
    function createSnippet(request: CreateSnippetRequest): Snippet {
        const now = new Date().toISOString()
        const snippet: Snippet = {
            id: uuidv4(),
            ...request,
            tags: request.tags || [],
            type: 'custom',
            created_at: now,
            updated_at: now,
            // 如果没有指定 connection_id，默认使用当前连接
            connection_id: request.connection_id ?? currentConnectionId.value,
        }

        customSnippets.value.push(snippet)
        saveCustomSnippets(customSnippets.value)
        return snippet
    }

    // 更新自定义片段
    function updateSnippet(request: UpdateSnippetRequest): Snippet | null {
        const index = customSnippets.value.findIndex(s => s.id === request.id)
        if (index === -1) return null

        const existing = customSnippets.value[index]
        const updated: Snippet = {
            ...existing,
            ...request,
            tags: request.tags || existing.tags,
            updated_at: new Date().toISOString(),
        }

        customSnippets.value[index] = updated
        saveCustomSnippets(customSnippets.value)
        return updated
    }

    // 删除自定义片段
    function deleteSnippet(id: string): boolean {
        const index = customSnippets.value.findIndex(s => s.id === id)
        if (index === -1) return false

        customSnippets.value.splice(index, 1)
        saveCustomSnippets(customSnippets.value)
        return true
    }

    // 根据 ID 获取片段
    function getSnippetById(id: string): Snippet | undefined {
        return allSnippets.value.find(s => s.id === id)
    }

    // 设置搜索关键字
    function setSearchKeyword(keyword: string) {
        searchKeyword.value = keyword
    }

    // 设置分类过滤
    function setSelectedCategory(category: SnippetCategory | null) {
        selectedCategory.value = category
    }

    // 设置类型过滤
    function setSelectedType(type: SnippetType | null) {
        selectedType.value = type
    }

    // 设置标签过滤
    function setSelectedTag(tag: string | null) {
        selectedTag.value = tag
    }

    // 清除所有过滤
    function clearFilters() {
        searchKeyword.value = ''
        selectedCategory.value = null
        selectedType.value = null
        selectedTag.value = null
    }

    // 打开/关闭面板
    function togglePanel() {
        isPanelOpen.value = !isPanelOpen.value
    }

    function openPanel() {
        isPanelOpen.value = true
    }

    function closePanel() {
        isPanelOpen.value = false
    }

    // 替换模板变量
    function fillTemplate(snippet: Snippet, variables: Record<string, string>): string {
        let sql = snippet.sql

        // 替换 {{variable}} 格式的变量
        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
            sql = sql.replace(regex, value)
        })

        return sql
    }

    return {
        // State
        customSnippets,
        currentConnectionId,
        searchKeyword,
        selectedCategory,
        selectedType,
        selectedTag,
        isPanelOpen,

        // Getters
        allSnippets,
        connectionSnippets,
        filteredSnippets,
        currentConnectionCustomSnippets,
        snippetsByCategory,
        allTags,
        categories,
        builtinSnippets: BUILTIN_SNIPPETS,

        // Actions
        setCurrentConnectionId,
        createSnippet,
        updateSnippet,
        deleteSnippet,
        getSnippetById,
        setSearchKeyword,
        setSelectedCategory,
        setSelectedType,
        setSelectedTag,
        clearFilters,
        togglePanel,
        openPanel,
        closePanel,
        fillTemplate,
    }
})
