/**
 * 数据库文档导出服务
 * 支持导出数据库结构为 Markdown / HTML / JSON 格式
 */

import type { TableInfo, ColumnInfo } from '@types'
import { usePlatform } from '@services/platform'

export type DocFormat = 'markdown' | 'html' | 'json'

export interface DocExportOptions {
    format: DocFormat
    includeRowCount: boolean
    includeIndexes: boolean
    includeForeignKeys: boolean
    includeDescription: boolean
}

export interface DatabaseSchema {
    databaseName: string
    tables: TableInfo[]
    indexes?: IndexInfo[]
    exportedAt: string
}

export interface IndexInfo {
    name: string
    table_name: string
    unique: boolean
    columns: string[]
    is_primary?: boolean
}

export interface ForeignKeyInfo {
    name: string
    column: string
    referenced_table: string
    referenced_column: string
}

/**
 * 生成 Markdown 格式文档
 */
export function generateMarkdown(schema: DatabaseSchema, options: DocExportOptions): string {
    const { databaseName, tables, exportedAt } = schema

    let md = `# ${databaseName} 数据库文档\n\n`
    md += `> 生成时间: ${exportedAt}\n\n`
    md += `## 概览\n\n`
    md += `- 数据库名称: ${databaseName}\n`
    md += `- 表数量: ${tables.length}\n\n`

    // 表清单
    md += `## 表清单\n\n`
    md += `| 序号 | 表名 | 列数 | 说明 |\n`
    md += `|:---:|:---|:---:|:---|\n`
    tables.forEach((table, index) => {
        const desc = '' // 后续可支持表注释
        md += `| ${index + 1} | \`${table.name}\` | ${table.columns.length} | ${desc} |\n`
    })
    md += '\n'

    // 每个表的详细结构
    tables.forEach((table, index) => {
        md += `## ${index + 1}. ${table.name}\n\n`

        // 列信息
        md += `### 列结构\n\n`
        md += `| 列名 | 数据类型 | 可空 | 默认值 | 主键 | 说明 |\n`
        md += `|:---|:---|:---:|:---|:---:|:---|\n`

        table.columns.forEach(col => {
            const nullable = col.is_nullable ? '✓' : ''
            const defaultVal = col.default_value || ''
            const pk = col.is_primary_key ? '✓' : ''
            const desc = '' // 列注释
            md += `| \`${col.name}\` | ${col.type} | ${nullable} | ${defaultVal} | ${pk} | ${desc} |\n`
        })
        md += '\n'

        // 索引信息
        if (options.includeIndexes && table.indexes?.length) {
            md += `### 索引\n\n`
            md += `| 索引名 | 类型 | 列 | 唯一 |\n`
            md += `|:---|:---|:---|:---:|\n`

            table.indexes.forEach(idx => {
                const type = idx.is_primary ? 'PRIMARY' : idx.is_unique ? 'UNIQUE' : 'INDEX'
                const columns = idx.columns.join(', ')
                md += `| \`${idx.name}\` | ${type} | ${columns} | ${idx.is_unique ? '✓' : ''} |\n`
            })
            md += '\n'
        }

        // 外键信息
        if (options.includeForeignKeys && table.foreign_keys?.length) {
            md += `### 外键\n\n`
            md += `| 外键名 | 列 | 引用表 | 引用列 |\n`
            md += `|:---|:---|:---|:---|\n`

            table.foreign_keys.forEach(fk => {
                md += `| \`${fk.name}\` | ${fk.column} | \`${fk.referenced_table}\` | ${fk.referenced_column} |\n`
            })
            md += '\n'
        }

        md += `---\n\n`
    })

    return md
}

/**
 * 生成 HTML 格式文档
 */
export function generateHTML(schema: DatabaseSchema, options: DocExportOptions): string {
    const markdown = generateMarkdown(schema, options)

    // 简单的 Markdown 转 HTML
    let html = markdown
        // 标题
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        // 引用
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // 代码
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // 表格（简化处理）
        .replace(/\|(.+)\|/g, match => {
            const cells = match.split('|').filter(c => c.trim())
            if (cells.every(c => /^[\s:-]+$/.test(c))) return '' // 分隔行
            return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
        })
        // 段落
        .replace(/\n\n/g, '</p><p>')
        // 换行
        .replace(/\n/g, '<br>')

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${schema.databaseName} - 数据库文档</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
        h2 { color: #4b5563; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
        h3 { color: #6b7280; }
        blockquote {
            border-left: 4px solid #2563eb;
            margin: 0;
            padding: 10px 20px;
            background: #f3f4f6;
            color: #6b7280;
        }
        code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9em;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #e5e7eb;
            padding: 12px;
            text-align: left;
        }
        th {
            background: #f9fafb;
            font-weight: 600;
        }
        tr:nth-child(even) {
            background: #f9fafb;
        }
        hr {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 30px 0;
        }
    </style>
</head>
<body>
    ${html}
</body>
</html>`
}

/**
 * 生成 JSON 格式文档
 */
export function generateJSON(schema: DatabaseSchema): string {
    return JSON.stringify(schema, null, 2)
}

/**
 * 导出文档
 */
export async function exportDatabaseDoc(
    connectionId: string,
    databaseName: string,
    tables: TableInfo[],
    options: DocExportOptions,
): Promise<void> {
    const platform = usePlatform()

    const schema: DatabaseSchema = {
        databaseName,
        tables,
        exportedAt: new Date().toLocaleString('zh-CN'),
    }

    // 生成内容
    let content: string
    let extension: string
    let mimeType: string

    switch (options.format) {
        case 'html':
            content = generateHTML(schema, options)
            extension = 'html'
            mimeType = 'text/html'
            break
        case 'json':
            content = generateJSON(schema)
            extension = 'json'
            mimeType = 'application/json'
            break
        case 'markdown':
        default:
            content = generateMarkdown(schema, options)
            extension = 'md'
            mimeType = 'text/markdown'
    }

    // 使用平台服务保存文件
    const filePath = await platform.fs.showSaveDialog({
        defaultPath: `${databaseName}_文档.${extension}`,
        filters: [{ name: options.format.toUpperCase(), extensions: [extension] }],
    })

    if (!filePath) return

    // 写入文件
    await platform.fs.writeFile(filePath, content)
}

/**
 * 复制文档内容到剪贴板
 */
export async function copyDocToClipboard(
    databaseName: string,
    tables: TableInfo[],
    options: DocExportOptions,
): Promise<void> {
    const schema: DatabaseSchema = {
        databaseName,
        tables,
        exportedAt: new Date().toLocaleString('zh-CN'),
    }

    const content = generateMarkdown(schema, options)

    // 使用平台剪贴板 API
    const platform = usePlatform()
    if (platform.capabilities.clipboard === 'full') {
        await navigator.clipboard.writeText(content)
    } else {
        throw new Error('Clipboard not available')
    }
}
