/**
 * Mock Platform Provider
 * 用于测试和 Storybook
 */

import type { 
    PlatformProvider, 
    PlatformCapabilities,
    ConnectionProvider,
    QueryProvider,
    FileSystemProvider,
    StorageProvider,
    DialogProvider,
} from '../types'
import type { ConnectionInfo, QueryResult, SqlFileExecutionResult } from '@types'

export interface MockOptions {
    /** 模拟延迟（毫秒） */
    delay?: number
    
    /** 预设连接 */
    connections?: ConnectionInfo[]
    
    /** 预设查询结果 */
    queryResults?: Map<string, QueryResult>
}

export function createMockProvider(options: MockOptions = {}): PlatformProvider {
    const delay = options.delay ?? 100
    const storage = new Map<string, any>()
    
    const sleep = () => new Promise(r => setTimeout(r, delay))
    
    const capabilities: PlatformCapabilities = {
        database: 'none',
        fileSystem: 'none',
        dialog: 'custom',
        storage: 'memory',
        clipboard: 'read-only',
        notification: 'custom',
    }
    
    const connection: ConnectionProvider = {
        async createConnection(name: string, dbPath: string): Promise<ConnectionInfo> {
            await sleep()
            return {
                config: {
                    id: `mock-${Date.now()}`,
                    name,
                    db_path: dbPath,
                    created_at: new Date().toISOString(),
                    last_connected: new Date().toISOString(),
                },
                status: 'connected',
                metadata: {
                    version: '3.0.0',
                    page_size: 4096,
                    page_count: 100,
                    table_count: 5,
                    index_count: 3,
                    trigger_count: 0,
                    size_bytes: 409600,
                },
            }
        },
        
        async closeConnection(): Promise<void> {
            await sleep()
        },
        
        async listConnections(): Promise<ConnectionInfo[]> {
            await sleep()
            return options.connections ?? []
        },
        
        async testConnection(): Promise<void> {
            await sleep()
        },
    }
    
    const query: QueryProvider = {
        async executeQuery(opts: { sql: string }): Promise<QueryResult> {
            await sleep()
            
            if (options.queryResults?.has(opts.sql)) {
                return options.queryResults.get(opts.sql)!
            }
            
            // 默认返回模拟数据
            return {
                type: 'rows',
                columns: ['id', 'name', 'value'],
                rows: [
                    { values: { id: { type: 'Integer', value: 1 }, name: { type: 'Text', value: 'Test' }, value: { type: 'Real', value: 3.14 } } },
                ],
                has_more: false,
                execution_info: {
                    execution_time_ms: delay,
                    rows_returned: 1,
                    indexes_used: [],
                    query_plan: [],
                    warnings: [],
                    suggestions: [],
                },
            }
        },
        
        async executeSqlFile(): Promise<SqlFileExecutionResult> {
            await sleep()
            return {
                file_path: 'mock.sql',
                total_statements: 1,
                success_count: 1,
                error_count: 0,
                statements: [],
                total_duration_ms: delay,
            }
        },
        
        async cancelQuery(): Promise<void> {},
    }
    
    const fs: FileSystemProvider = {
        async readFile(path: string): Promise<string> {
            await sleep()
            return `-- Mock file content for ${path}`
        },
        
        async writeFile(): Promise<void> {
            await sleep()
        },
        
        async showOpenDialog(): Promise<string | null> {
            await sleep()
            return '/mock/path/file.db'
        },
        
        async showSaveDialog(): Promise<string | null> {
            await sleep()
            return '/mock/path/export.csv'
        },
    }
    
    const storageProvider: StorageProvider = {
        async getItem<T>(key: string): Promise<T | null> {
            return storage.get(key) ?? null
        },
        
        async setItem<T>(key: string, value: T): Promise<void> {
            storage.set(key, value)
        },
        
        async removeItem(key: string): Promise<void> {
            storage.delete(key)
        },
    }
    
    const dialog: DialogProvider = {
        async showMessage(message: string): Promise<void> {
            console.log('[Mock Dialog]', message)
        },
        
        async showConfirm(message: string): Promise<boolean> {
            return confirm(message)
        },
        
        async showInput(prompt: string, defaultValue?: string): Promise<string | null> {
            return prompt(prompt, defaultValue)
        },
    }
    
    return {
        name: 'mock',
        capabilities,
        connection,
        query,
        fs,
        storage: storageProvider,
        dialog,
    }
}

// 默认导出
export default createMockProvider
