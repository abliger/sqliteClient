/**
 * VS Code 扩展环境的连接服务
 * 使用 VS Code WebView API 与扩展后端通信
 */
import { isVSCode } from '@utils/tauri'
import type { ConnectionConfig, ConnectionInfo } from '@types'

export class VSCodeNotAvailableError extends Error {
    constructor(operation: string) {
        super(`${operation} is only available in VS Code extension`)
        this.name = 'VSCodeNotAvailableError'
    }
}

// 消息响应处理
let messageId = 0
const pendingMessages = new Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>()

// 监听来自扩展主机的响应
if (typeof window !== 'undefined' && window.vscode) {
    window.addEventListener('message', (event) => {
        const message = event.data
        if (message?.id && pendingMessages.has(message.id)) {
            const { resolve, reject } = pendingMessages.get(message.id)!
            pendingMessages.delete(message.id)
            
            if (message.error) {
                reject(new Error(message.error))
            } else {
                resolve(message.result)
            }
        }
    })
}

/**
 * 向 VS Code 扩展发送消息并等待响应
 */
function postMessage<T>(command: string, params?: Record<string, unknown>): Promise<T> {
    if (!isVSCode()) {
        throw new VSCodeNotAvailableError(command)
    }
    
    const id = `${Date.now()}-${++messageId}`
    
    return new Promise((resolve, reject) => {
        pendingMessages.set(id, { resolve: resolve as (value: unknown) => void, reject })
        
        // 发送消息到 VS Code 扩展主机
        window.vscode!.postMessage({
            id,
            command,
            params
        })
        
        // 30秒超时
        setTimeout(() => {
            if (pendingMessages.has(id)) {
                pendingMessages.delete(id)
                reject(new Error(`Request timeout: ${command}`))
            }
        }, 30000)
    })
}

export const connectionVSCodeService = {
    async createConnection(name: string, dbPath: string): Promise<ConnectionInfo> {
        return postMessage<ConnectionInfo>('create_connection', { name, dbPath })
    },

    async createNewDatabase(name: string, dbPath: string): Promise<ConnectionInfo> {
        return postMessage<ConnectionInfo>('create_new_database', { name, dbPath })
    },

    async closeConnection(connectionId: string): Promise<void> {
        return postMessage<void>('close_connection', { connectionId })
    },

    async listConnections(): Promise<ConnectionInfo[]> {
        return postMessage<ConnectionInfo[]>('list_connections')
    },

    async getConnectionInfo(connectionId: string): Promise<ConnectionInfo> {
        return postMessage<ConnectionInfo>('get_connection_info', { connectionId })
    },

    async testConnection(dbPath: string): Promise<void> {
        return postMessage<void>('test_connection', { dbPath })
    },

    async refreshMetadata(connectionId: string): Promise<ConnectionInfo['metadata']> {
        return postMessage<ConnectionInfo['metadata']>('refresh_metadata', { connectionId })
    },

    async restoreSavedConnections(): Promise<ConnectionInfo[]> {
        return postMessage<ConnectionInfo[]>('restore_saved_connections')
    },

    async loadSavedConnectionConfigs(): Promise<ConnectionConfig[]> {
        return postMessage<ConnectionConfig[]>('load_saved_connection_configs')
    },
}
