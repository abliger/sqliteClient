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

const STORAGE_KEY = 'sqlite-client-snippets'

// 内置 SQL 模板
const BUILTIN_SNIPPETS: Snippet[] = [
    // ==================== 查询类 ====================
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
    },
    {
        id: 'builtin-recursive-cte',
        name: '递归 CTE（树形结构）',
        description: '使用递归 CTE 查询树形结构数据',
        sql: `WITH RECURSIVE tree AS (
  -- 锚点：根节点
  SELECT id, parent_id, name, 0 as level, name as path
  FROM {{table_name}}
  WHERE parent_id IS NULL
  
  UNION ALL
  
  -- 递归：子节点
  SELECT t.id, t.parent_id, t.name, tree.level + 1,
         tree.path || ' > ' || t.name
  FROM {{table_name}} t
  INNER JOIN tree ON t.parent_id = tree.id
)
SELECT * FROM tree
ORDER BY path;`,
        type: 'builtin',
        category: 'query',
        tags: ['递归', 'CTE', '树形结构', '层级'],
        variables: [{ name: 'table_name', description: '表名', required: true }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-recursive-cte-path',
        name: '递归 CTE（路径查询）',
        description: '查询从根到指定节点的完整路径',
        sql: `WITH RECURSIVE path AS (
  -- 锚点：目标节点
  SELECT id, parent_id, name, name as full_path
  FROM {{table_name}}
  WHERE id = {{target_id}}
  
  UNION ALL
  
  -- 递归：向上查找父节点
  SELECT t.id, t.parent_id, t.name, t.name || ' > ' || path.full_path
  FROM {{table_name}} t
  INNER JOIN path ON t.id = path.parent_id
)
SELECT * FROM path
ORDER BY full_path;`,
        type: 'builtin',
        category: 'query',
        tags: ['递归', 'CTE', '路径', '层级'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'target_id', description: '目标节点ID', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },

    // ==================== 日期处理类 ====================
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
    },
    {
        id: 'builtin-date-format',
        name: '日期格式化',
        description: '日期格式化和转换',
        sql: `-- 格式化日期
SELECT strftime('%Y-%m-%d %H:%M:%S', 'now') as formatted;

-- 提取年月日
SELECT 
  strftime('%Y', 'now') as year,
  strftime('%m', 'now') as month,
  strftime('%d', 'now') as day;

-- 提取时分秒
SELECT 
  strftime('%H', 'now') as hour,
  strftime('%M', 'now') as minute,
  strftime('%S', 'now') as second;

-- 星期几（0=周日，6=周六）
SELECT strftime('%w', 'now') as weekday;

-- 一年中的第几天
SELECT strftime('%j', 'now') as day_of_year;`,
        type: 'builtin',
        category: 'function',
        tags: ['日期', '格式化', 'strftime'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-date-calc',
        name: '日期计算',
        description: '日期加减计算',
        sql: `-- 加减天数
SELECT date('now', '+7 days') as next_week;
SELECT date('now', '-1 month') as last_month;
SELECT date('now', '+1 year') as next_year;

-- 加减时间
SELECT datetime('now', '+8 hours') as later;
SELECT datetime('now', '-30 minutes') as earlier;

-- 月初和月末
SELECT date('now', 'start of month') as month_start;
SELECT date('now', 'start of month', '+1 month', '-1 day') as month_end;

-- 年初和年末
SELECT date('now', 'start of year') as year_start;
SELECT date('now', 'start of year', '+1 year', '-1 day') as year_end;`,
        type: 'builtin',
        category: 'function',
        tags: ['日期', '计算', '加减'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-date-range',
        name: '日期范围查询',
        description: '查询特定日期范围内的数据',
        sql: `-- 今天
SELECT * FROM {{table_name}}
WHERE date({{date_column}}) = date('now');

-- 昨天
SELECT * FROM {{table_name}}
WHERE date({{date_column}}) = date('now', '-1 day');

-- 最近7天
SELECT * FROM {{table_name}}
WHERE {{date_column}} >= datetime('now', '-7 days');

-- 本月
SELECT * FROM {{table_name}}
WHERE {{date_column}} >= date('now', 'start of month');

-- 今年
SELECT * FROM {{table_name}}
WHERE {{date_column}} >= date('now', 'start of year');`,
        type: 'builtin',
        category: 'query',
        tags: ['日期', '范围', '查询'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'date_column', description: '日期列名', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },

    // ==================== 数据统计类 ====================
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
    },
    {
        id: 'builtin-stats-group',
        name: '分组统计',
        description: '按条件分组统计',
        sql: `SELECT 
  {{group_column}},
  COUNT(*) as count,
  MIN({{value_column}}) as min_val,
  MAX({{value_column}}) as max_val,
  AVG({{value_column}}) as avg_val,
  SUM({{value_column}}) as sum_val
FROM {{table_name}}
GROUP BY {{group_column}}
ORDER BY count DESC;`,
        type: 'builtin',
        category: 'query',
        tags: ['统计', '分组', '聚合'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'group_column', description: '分组列', required: true },
            { name: 'value_column', description: '统计列', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-stats-percentile',
        name: '分位数统计',
        description: '计算中位数和百分位数',
        sql: `-- 中位数
SELECT AVG({{column_name}}) as median
FROM (
  SELECT {{column_name}},
    ROW_NUMBER() OVER (ORDER BY {{column_name}}) as row_num,
    COUNT(*) OVER () as total_rows
  FROM {{table_name}}
  WHERE {{column_name}} IS NOT NULL
)
WHERE row_num IN (
  (total_rows + 1) / 2,
  (total_rows + 2) / 2
);

-- 百分位数 (SQLite 3.25+)
SELECT 
  percentile_cont(0.25) WITHIN GROUP (ORDER BY {{column_name}}) as p25,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY {{column_name}}) as p50,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY {{column_name}}) as p75,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY {{column_name}}) as p90,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY {{column_name}}) as p95
FROM {{table_name}}
WHERE {{column_name}} IS NOT NULL;`,
        type: 'builtin',
        category: 'query',
        tags: ['统计', '分位数', '中位数'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'column_name', description: '数值列', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },

    // ==================== 表结构类 ====================
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
    },
    {
        id: 'builtin-ddl-alter-table',
        name: '修改表结构',
        description: '添加、删除、修改列',
        sql: `-- 添加列
ALTER TABLE {{table_name}} ADD COLUMN {{column_name}} {{data_type}};

-- 重命名列 (SQLite 3.25+)
ALTER TABLE {{table_name}} RENAME COLUMN old_name TO new_name;

-- 删除列 (SQLite 3.35+)
ALTER TABLE {{table_name}} DROP COLUMN {{column_name}};

-- 重命名表
ALTER TABLE {{table_name}} RENAME TO {{new_table_name}};`,
        type: 'builtin',
        category: 'ddl',
        tags: ['DDL', '修改表', '列'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'column_name', description: '列名', required: false },
            { name: 'data_type', description: '数据类型', default_value: 'TEXT', required: false },
            { name: 'new_table_name', description: '新表名', required: false },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-ddl-index',
        name: '索引管理',
        description: '创建和管理索引',
        sql: `-- 创建索引
CREATE INDEX IF NOT EXISTS idx_{{table_name}}_{{column_name}} 
ON {{table_name}}({{column_name}});

-- 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_{{table_name}}_unique 
ON {{table_name}}({{column_name}});

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_{{table_name}}_composite 
ON {{table_name}}(col1, col2, col3);

-- 部分索引
CREATE INDEX IF NOT EXISTS idx_{{table_name}}_partial 
ON {{table_name}}({{column_name}}) 
WHERE status = 1;

-- 删除索引
DROP INDEX IF EXISTS idx_{{table_name}}_{{column_name}};

-- 查看索引
SELECT * FROM sqlite_master WHERE type = 'index' AND tbl_name = '{{table_name}}';`,
        type: 'builtin',
        category: 'ddl',
        tags: ['DDL', '索引', '性能'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'column_name', description: '列名', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },

    // ==================== 数据操作类 ====================
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
    },
    {
        id: 'builtin-dml-insert-select',
        name: '批量插入（从查询）',
        description: '从查询结果批量插入数据',
        sql: `INSERT INTO {{target_table}} (col1, col2, col3)
SELECT col1, col2, col3
FROM {{source_table}}
WHERE {{condition}};`,
        type: 'builtin',
        category: 'dml',
        tags: ['DML', '批量插入', '查询插入'],
        variables: [
            { name: 'target_table', description: '目标表', required: true },
            { name: 'source_table', description: '源表', required: true },
            { name: 'condition', description: '筛选条件', default_value: '1=1', required: false },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-dml-update-join',
        name: 'UPDATE JOIN',
        description: '根据关联表更新数据',
        sql: `UPDATE {{table_name}}
SET col1 = (SELECT value FROM other_table WHERE other_table.id = {{table_name}}.ref_id)
WHERE EXISTS (
  SELECT 1 FROM other_table 
  WHERE other_table.id = {{table_name}}.ref_id
);`,
        type: 'builtin',
        category: 'dml',
        tags: ['DML', '更新', '关联'],
        variables: [{ name: 'table_name', description: '表名', required: true }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-dml-delete-duplicate',
        name: '删除重复数据',
        description: '保留一条，删除重复数据',
        sql: `DELETE FROM {{table_name}}
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM {{table_name}}
  GROUP BY {{duplicate_columns}}
);`,
        type: 'builtin',
        category: 'dml',
        tags: ['DML', '删除', '重复数据'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'duplicate_columns', description: '判重列（逗号分隔）', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },

    // ==================== 高级查询类 ====================
    {
        id: 'builtin-query-pivot',
        name: '行转列（Pivot）',
        description: '将行数据转换为列',
        sql: `SELECT 
  {{group_column}},
  SUM(CASE WHEN {{pivot_column}} = 'A' THEN {{value_column}} ELSE 0 END) as A_value,
  SUM(CASE WHEN {{pivot_column}} = 'B' THEN {{value_column}} ELSE 0 END) as B_value,
  SUM(CASE WHEN {{pivot_column}} = 'C' THEN {{value_column}} ELSE 0 END) as C_value
FROM {{table_name}}
GROUP BY {{group_column}};`,
        type: 'builtin',
        category: 'query',
        tags: ['查询', '透视', '行转列'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'group_column', description: '分组列', required: true },
            { name: 'pivot_column', description: '透视列', required: true },
            { name: 'value_column', description: '值列', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-query-running-total',
        name: '累计求和',
        description: '使用窗口函数计算累计求和',
        sql: `SELECT 
  {{date_column}},
  {{amount_column}},
  SUM({{amount_column}}) OVER (
    ORDER BY {{date_column}}
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) as running_total,
  AVG({{amount_column}}) OVER (
    ORDER BY {{date_column}}
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) as moving_avg_7d
FROM {{table_name}}
ORDER BY {{date_column}};`,
        type: 'builtin',
        category: 'query',
        tags: ['查询', '窗口函数', '累计', '移动平均'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'date_column', description: '日期列', required: true },
            { name: 'amount_column', description: '数值列', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-query-top-n-per-group',
        name: '每组取前N条',
        description: '使用窗口函数获取每组的前N条记录',
        sql: `WITH ranked AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY {{group_column}} 
      ORDER BY {{order_column}} DESC
    ) as rank
  FROM {{table_name}}
)
SELECT * FROM ranked
WHERE rank <= {{n}}
ORDER BY {{group_column}}, rank;`,
        type: 'builtin',
        category: 'query',
        tags: ['查询', '窗口函数', '排名', '分组'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'group_column', description: '分组列', required: true },
            { name: 'order_column', description: '排序列', required: true },
            { name: 'n', description: '取前N条', default_value: '3', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-query-gap-analysis',
        name: '缺失值分析',
        description: '查找序列中的缺失值',
        sql: `-- 查找缺失的 ID
WITH RECURSIVE numbers AS (
  SELECT MIN({{id_column}}) as n
  FROM {{table_name}}
  UNION ALL
  SELECT n + 1
  FROM numbers
  WHERE n < (SELECT MAX({{id_column}}) FROM {{table_name}})
)
SELECT n as missing_id
FROM numbers
WHERE n NOT IN (SELECT {{id_column}} FROM {{table_name}});`,
        type: 'builtin',
        category: 'query',
        tags: ['查询', '缺失值', '序列'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'id_column', description: 'ID列', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-query-search-all-columns',
        name: '全字段搜索',
        description: '在多个字段中搜索关键词',
        sql: `SELECT *
FROM {{table_name}}
WHERE (
  {{search_column1}} LIKE '%{{keyword}}%'
  OR {{search_column2}} LIKE '%{{keyword}}%'
  OR {{search_column3}} LIKE '%{{keyword}}%'
);`,
        type: 'builtin',
        category: 'query',
        tags: ['查询', '搜索', '模糊匹配'],
        variables: [
            { name: 'table_name', description: '表名', required: true },
            { name: 'search_column1', description: '搜索列1', required: true },
            { name: 'search_column2', description: '搜索列2', required: true },
            { name: 'search_column3', description: '搜索列3', required: true },
            { name: 'keyword', description: '搜索关键词', required: true },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },

    // ==================== 元数据查询类 ====================
    {
        id: 'builtin-meta-tables',
        name: '查询所有表',
        description: '获取数据库中所有表的信息',
        sql: `-- 所有表
SELECT 
  name as table_name,
  sql as create_statement
FROM sqlite_master
WHERE type = 'table'
  AND name NOT LIKE 'sqlite_%'
ORDER BY name;

-- 表统计
SELECT 
  name as table_name,
  (SELECT COUNT(*) FROM pragma_table_info(name)) as column_count
FROM sqlite_master
WHERE type = 'table'
  AND name NOT LIKE 'sqlite_%'
ORDER BY name;`,
        type: 'builtin',
        category: 'query',
        tags: ['元数据', '表', '系统表'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-meta-columns',
        name: '查询表结构',
        description: '获取表的详细结构信息',
        sql: `-- 列信息
PRAGMA table_info({{table_name}});

-- 外键
PRAGMA foreign_key_list({{table_name}});

-- 索引
PRAGMA index_list({{table_name}});

-- 统计信息
SELECT 
  COUNT(*) as row_count
FROM {{table_name}};`,
        type: 'builtin',
        category: 'query',
        tags: ['元数据', '列', '结构'],
        variables: [{ name: 'table_name', description: '表名', required: true }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'builtin-meta-db-info',
        name: '数据库信息',
        description: '获取数据库文件信息',
        sql: `-- 数据库文件大小
SELECT page_count * page_size as size_bytes
FROM pragma_page_count(), pragma_page_size();

-- SQLite 版本
SELECT sqlite_version() as version;

-- 连接状态
PRAGMA integrity_check;

-- 编译选项
PRAGMA compile_options;`,
        type: 'builtin',
        category: 'query',
        tags: ['元数据', '数据库', '信息'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

    // 过滤后的片段
    const filteredSnippets = computed<Snippet[]>(() => {
        let result = allSnippets.value

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

    // 按分类分组的片段
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
        allSnippets.value.forEach(s => s.tags.forEach(t => tags.add(t)))
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
        searchKeyword,
        selectedCategory,
        selectedType,
        selectedTag,
        isPanelOpen,

        // Getters
        allSnippets,
        filteredSnippets,
        snippetsByCategory,
        allTags,
        categories,
        builtinSnippets: BUILTIN_SNIPPETS,

        // Actions
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
