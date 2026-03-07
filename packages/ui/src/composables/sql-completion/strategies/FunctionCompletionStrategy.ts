import type {
  SQLCompletionStrategy,
  CompletionContext,
  CompletionResult,
  SchemaDataSource,
  CompletionItem
} from '../types'
import { CompletionItemKind } from '../types'

// SQLite 内置函数列表
const DEFAULT_FUNCTIONS = [
  { name: 'abs', snippet: 'abs($1)', desc: '返回绝对值' },
  { name: 'changes', snippet: 'changes()', desc: '返回最近 INSERT/UPDATE/DELETE 影响的行数' },
  { name: 'coalesce', snippet: 'coalesce($1, $2)', desc: '返回第一个非 NULL 值' },
  { name: 'count', snippet: 'count($1)', desc: '计数' },
  { name: 'date', snippet: 'date($1)', desc: '提取日期部分' },
  { name: 'datetime', snippet: 'datetime($1)', desc: '提取日期时间' },
  { name: 'hex', snippet: 'hex($1)', desc: '转为十六进制' },
  { name: 'ifnull', snippet: 'ifnull($1, $2)', desc: '如果第一个参数为 NULL 则返回第二个' },
  { name: 'instr', snippet: 'instr($1, $2)', desc: '查找子串位置' },
  { name: 'json_extract', snippet: 'json_extract($1, $2)', desc: '从 JSON 提取值' },
  { name: 'json_array', snippet: 'json_array($1)', desc: '创建 JSON 数组' },
  { name: 'json_object', snippet: 'json_object($1)', desc: '创建 JSON 对象' },
  { name: 'last_insert_rowid', snippet: 'last_insert_rowid()', desc: '返回最后插入的行 ID' },
  { name: 'length', snippet: 'length($1)', desc: '返回字符串长度' },
  { name: 'lower', snippet: 'lower($1)', desc: '转为小写' },
  { name: 'ltrim', snippet: 'ltrim($1)', desc: '去除左侧空白' },
  { name: 'max', snippet: 'max($1)', desc: '最大值' },
  { name: 'min', snippet: 'min($1)', desc: '最小值' },
  { name: 'nullif', snippet: 'nullif($1, $2)', desc: '如果相等则返回 NULL' },
  { name: 'printf', snippet: 'printf($1)', desc: '格式化字符串' },
  { name: 'quote', snippet: 'quote($1)', desc: '转义字符串' },
  { name: 'random', snippet: 'random()', desc: '随机整数' },
  { name: 'replace', snippet: 'replace($1, $2, $3)', desc: '替换子串' },
  { name: 'round', snippet: 'round($1)', desc: '四舍五入' },
  { name: 'rtrim', snippet: 'rtrim($1)', desc: '去除右侧空白' },
  { name: 'strftime', snippet: 'strftime($1, $2)', desc: '格式化日期' },
  { name: 'substr', snippet: 'substr($1, $2, $3)', desc: '提取子串' },
  { name: 'sum', snippet: 'sum($1)', desc: '求和' },
  { name: 'avg', snippet: 'avg($1)', desc: '平均值' },
  { name: 'time', snippet: 'time($1)', desc: '提取时间部分' },
  { name: 'total_changes', snippet: 'total_changes()', desc: '返回当前会话修改的行数' },
  { name: 'trim', snippet: 'trim($1)', desc: '去除两侧空白' },
  { name: 'typeof', snippet: 'typeof($1)', desc: '返回数据类型' },
  { name: 'upper', snippet: 'upper($1)', desc: '转为大写' },
  { name: 'unicode', snippet: 'unicode($1)', desc: '返回 Unicode 码点' },
]

/**
 * 函数补全策略
 */
export class FunctionCompletionStrategy implements SQLCompletionStrategy {
  readonly name = 'functions'
  readonly priority = 80
  
  private functions: { name: string; snippet: string; desc: string }[]
  
  constructor(customFunctions?: { name: string; snippet: string; desc?: string }[]) {
    this.functions = customFunctions?.length
      ? [...DEFAULT_FUNCTIONS, ...customFunctions.map(f => ({ ...f, desc: f.desc || '' }))]
      : DEFAULT_FUNCTIONS
  }
  
  canProvide(context: CompletionContext): boolean {
    // 在 SELECT、WHERE、ORDER BY 等子句中提供函数补全
    const patterns = [
      /\b(SELECT|WHERE|AND|OR|HAVING|ORDER\s+BY|GROUP\s+BY)\b[^)]*$/i,
      /[=<>!+\-*/,(]\s*$/ // 在运算符或逗号后
    ]
    return patterns.some(p => p.test(context.textBeforeCursor))
  }
  
  provideCompletionItems(
    _context: CompletionContext,
    _schemaSource: SchemaDataSource
  ): CompletionResult {
    const items: CompletionItem[] = this.functions.map(func => ({
      label: func.name,
      kind: CompletionItemKind.Function,
      insertText: func.snippet,
      detail: 'SQLite Function',
      documentation: func.desc,
      sortText: `1_${func.name}` // 函数排序靠前
    }))
    
    return { items }
  }
}
