/**
 * VS Code Platform Provider
 * VS Code WebView 环境实现
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

// VS Code API 消息处理
let messageId = 0
const pendingMessages = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
}>()

function postMessage<T>(command: string, params?: Record<string, unknown>): Promise<T> {
    if (!window.vscode) {
        throw new Error('VS Code API not available')
    }
    
    const id = `${Date.now()}-${++messageId}`
    
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingMessages.delete(id)
            reject(new Error(`Request timeout: ${command}`))
        }, 30000)
        
        pendingMessages.set(id, { resolve, reject, timeout })
        
        window.vscode!.postMessage({ id, command, params })
    })
}

// 监听消息响应
if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        const message = event.data
        if (!message?.id) return
        
        const handler = pendingMessages.get(message.id)
        if (!handler) return
        
        clearTimeout(handler.timeout)
        pendingMessages.delete(message.id)
        
        if (message.error) {
            handler.reject(new Error(message.error))
        } else {
            handler.resolve(message.result)
        }
    })
}

const capabilities: PlatformCapabilities = {
    database: 'native',  // 通过 Extension Host 访问
    fileSystem: 'sandboxed',  // 有限制的文件访问
    dialog: 'native',  // VS Code 原生对话框
    storage: 'persistent',  // VS Code Memento
    clipboard: 'full',
    notification: 'native',
}

const connection: ConnectionProvider = {
    async createConnection(name: string, dbPath: string): Promise<ConnectionInfo> {
        return postMessage('create_connection', { name, dbPath })
    },
    
    async closeConnection(connectionId: string): Promise<void> {
        return postMessage('close_connection', { connectionId })
    },
    
    async listConnections(): Promise<ConnectionInfo[]> {
        return postMessage('list_connections')
    },
    
    async testConnection(dbPath: string): Promise<void> {
        return postMessage('test_connection', { dbPath })
    },
}

const query: QueryProvider = {
    async executeQuery(options: { connectionId: string; sql: string; limit?: number }): Promise<QueryResult> {
        return postMessage('execute_query', options)
    },
    
    async executeSqlFile(connectionId: string, filePath: string): Promise<SqlFileExecutionResult> {
        return postMessage('execute_sql_file', { connectionId, filePath })
    },
    
    async cancelQuery(queryId: string): Promise<void> {
        return postMessage('cancel_query', { queryId })
    },
}

const fileSystem: FileSystemProvider = {
    async readFile(path: string): Promise<string> {
        // VS Code 通过 Extension Host 读取文件
        return postMessage('read_file', { path })
    },
    
    async writeFile(path: string, content: string): Promise<void> {
        return postMessage('write_file', { path, content })
    },
    
    async showOpenDialog(options): Promise<string | null> {
        return postMessage('show_open_dialog', options)
    },
    
    async showSaveDialog(options): Promise<string | null> {
        return postMessage('show_save_dialog', options)
    },
}

const storage: StorageProvider = {
    async getItem<T>(key: string): Promise<T | null> {
        return postMessage('storage_get', { key })
    },
    
    async setItem<T>(key: string, value: T): Promise<void> {
        return postMessage('storage_set', { key, value })
    },
    
    async removeItem(key: string): Promise<void> {
        return postMessage('storage_remove', { key })
    },
}

const dialog: DialogProvider = {
    async showMessage(message: string, type?: 'info' | 'warning' | 'error'): Promise<void> {
        return postMessage('show_message', { message, type })
    },
    
    async showConfirm(message: string): Promise<boolean> {
        return postMessage('show_confirm', { message })
    },
    
    async showInput(prompt: string, defaultValue?: string): Promise<string | null> {
        return postMessage('show_input', { prompt, defaultValue })
    },
}

export const vscodeProvider: PlatformProvider = {
    name: 'vscode',
    capabilities,
    connection,
    query,
    fs: fileSystem,
    storage,
    dialog,
}

export default vscodeProvider
