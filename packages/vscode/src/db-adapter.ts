/**
 * 数据库适配器 - 支持 better-sqlite3 和 sql.js
 *
 * 优先使用 better-sqlite3（性能更好），
 * 如果原生模块加载失败，自动降级到 sql.js（纯 JS，兼容性好）
 */

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

let sqlJsInit: typeof import('sql.js').default | null = null

async function initSqlJs(context: vscode.ExtensionContext): Promise<typeof import('sql.js')> {
    if (!sqlJsInit) {
        const SQL = await import('sql.js')
        sqlJsInit = SQL.default
    }
    return { default: sqlJsInit! }
}

// 通用数据库接口
export interface Database {
    exec(sql: string): { columns: string[]; values: any[][] }[]
    prepare(sql: string): Statement
    close(): void
}

export interface Statement {
    run(...params: any[]): { changes: number; lastInsertRowid: number }
    get(...params: any[]): any
    all(...params: any[]): any[]
    finalize(): void
}

// 数据库连接信息
interface Connection {
    type: 'better-sqlite3' | 'sql.js'
    db: any
    path: string
}

const connections = new Map<string, Connection>()

/**
 * 创建数据库连接
 */
export async function createConnection(
    context: vscode.ExtensionContext,
    id: string,
    dbPath: string,
): Promise<void> {
    // 先尝试 better-sqlite3
    try {
        const Database = loadBetterSQLite3(context)
        const db = new Database(dbPath)
        connections.set(id, { type: 'better-sqlite3', db, path: dbPath })
        return
    } catch (err: any) {
        // ABI 版本不匹配错误
        if (
            err.message?.includes('NODE_MODULE_VERSION') ||
            err.message?.includes('was compiled against')
        ) {
            console.warn('better-sqlite3 ABI mismatch, falling back to sql.js:', err.message)
        } else {
            console.warn('Failed to load better-sqlite3, trying sql.js:', err.message)
        }
    }

    // 降级到 sql.js
    const SQL = await initSqlJs(context)
    const fileBuffer = fs.readFileSync(dbPath)
    const db = new SQL.default.Database(fileBuffer)
    connections.set(id, { type: 'sql.js', db, path: dbPath })
}

/**
 * 执行查询
 */
export async function executeQuery(
    id: string,
    sql: string,
    params?: any[],
): Promise<{ columns: string[]; values: any[][] }[]> {
    const conn = connections.get(id)
    if (!conn) throw new Error('Connection not found')

    if (conn.type === 'better-sqlite3') {
        // better-sqlite3 模式
        const db = conn.db
        const results: { columns: string[]; values: any[][] }[] = []

        // 分割多条语句
        const statements = sql.split(';').filter(s => s.trim())

        for (const stmt of statements) {
            const trimmed = stmt.trim()
            if (!trimmed) continue

            // 判断是否是 SELECT 查询
            const isSelect = /^\s*SELECT/i.test(trimmed)

            if (isSelect) {
                const rows = db.prepare(trimmed).all(...(params || []))
                if (rows && rows.length > 0) {
                    results.push({
                        columns: Object.keys(rows[0]),
                        values: rows.map((r: any) => Object.values(r)),
                    })
                } else {
                    results.push({ columns: [], values: [] })
                }
            } else {
                const result = db.prepare(trimmed).run(...(params || []))
                results.push({
                    columns: ['changes', 'lastInsertRowid'],
                    values: [[result.changes, result.lastInsertRowid]],
                })
            }
        }

        return results
    } else {
        // sql.js 模式
        const db = conn.db
        const results: { columns: string[]; values: any[][] }[] = []

        const statements = sql.split(';').filter(s => s.trim())

        for (const stmt of statements) {
            const trimmed = stmt.trim()
            if (!trimmed) continue

            try {
                const result = db.exec(trimmed)
                if (result && result.length > 0) {
                    results.push({
                        columns: result[0].columns,
                        values: result[0].values,
                    })
                } else {
                    results.push({ columns: [], values: [] })
                }
            } catch (e: any) {
                // sql.js 可能不支持某些语句，忽略
                results.push({ columns: ['error'], values: [[e.message]] })
            }
        }

        // sql.js 是内存数据库，需要手动保存
        if (dbPathIsWritable(conn.path)) {
            const data = db.export()
            fs.writeFileSync(conn.path, Buffer.from(data))
        }

        return results
    }
}

/**
 * 关闭连接
 */
export function closeConnection(id: string): void {
    const conn = connections.get(id)
    if (conn) {
        if (conn.type === 'better-sqlite3') {
            conn.db.close()
        } else {
            // sql.js 需要保存数据
            if (dbPathIsWritable(conn.path)) {
                const data = conn.db.export()
                fs.writeFileSync(conn.path, Buffer.from(data))
            }
            conn.db.close()
        }
        connections.delete(id)
    }
}

/**
 * 加载 better-sqlite3（从 database.ts 提取）
 */
function loadBetterSQLite3(context: vscode.ExtensionContext): any {
    const searchPaths = [
        path.join(context.extensionPath, 'dist', 'node_modules', 'better-sqlite3'),
        path.join(context.extensionPath, '..', '..', 'node_modules', 'better-sqlite3'),
        'better-sqlite3',
    ]

    for (const modulePath of searchPaths) {
        try {
            if (fs.existsSync(modulePath) || modulePath === 'better-sqlite3') {
                const mod = require(modulePath)
                return mod.default || mod
            }
        } catch (err) {
            // 继续尝试下一个路径
        }
    }
    throw new Error('Could not load better-sqlite3')
}

function dbPathIsWritable(dbPath: string): boolean {
    return dbPath !== ':memory:' && !dbPath.startsWith('file::memory:')
}
