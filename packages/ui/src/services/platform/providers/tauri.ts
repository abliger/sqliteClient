/**
 * Tauri Platform Provider
 * 桌面应用环境实现
 */

import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import * as fs from '@tauri-apps/plugin-fs'
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

const capabilities: PlatformCapabilities = {
    database: 'native',
    fileSystem: 'full',
    dialog: 'native',
    storage: 'persistent',
    clipboard: 'full',
    notification: 'native',
}

const connection: ConnectionProvider = {
    async createConnection(name: string, dbPath: string): Promise<ConnectionInfo> {
        return invoke('create_connection', { name, dbPath })
    },

    async closeConnection(connectionId: string): Promise<void> {
        return invoke('close_connection', { connectionId })
    },

    async listConnections(): Promise<ConnectionInfo[]> {
        return invoke('list_connections')
    },

    async testConnection(dbPath: string): Promise<void> {
        return invoke('test_connection', { dbPath })
    },
}

const query: QueryProvider = {
    async executeQuery(options: {
        connectionId: string
        sql: string
        limit?: number
    }): Promise<QueryResult> {
        return invoke('execute_query', options)
    },

    async executeSqlFile(connectionId: string, filePath: string): Promise<SqlFileExecutionResult> {
        return invoke('execute_sql_file', { connectionId, filePath })
    },

    async cancelQuery(queryId: string): Promise<void> {
        return invoke('cancel_query', { queryId })
    },
}

const fileSystem: FileSystemProvider = {
    async readFile(path: string): Promise<string> {
        const content = await fs.readTextFile(path)
        return content
    },

    async writeFile(path: string, content: string): Promise<void> {
        await fs.writeTextFile(path, content)
    },

    async showOpenDialog(options): Promise<string | null> {
        const filters = options.filters
            ? Object.entries(options.filters).map(([name, extensions]) => ({ name, extensions }))
            : undefined
        const result = await open({
            multiple: false,
            filters,
        })
        return result ? String(result) : null
    },

    async showSaveDialog(options): Promise<string | null> {
        const filters = options.filters
            ? Object.entries(options.filters).map(([name, extensions]) => ({ name, extensions }))
            : undefined
        const result = await save({
            defaultPath: options.defaultPath,
            filters,
        })
        return result ? String(result) : null
    },
}

const storage: StorageProvider = {
    async getItem<T>(key: string): Promise<T | null> {
        const value = localStorage.getItem(key)
        return value ? JSON.parse(value) : null
    },

    async setItem<T>(key: string, value: T): Promise<void> {
        localStorage.setItem(key, JSON.stringify(value))
    },

    async removeItem(key: string): Promise<void> {
        localStorage.removeItem(key)
    },
}

const dialog: DialogProvider = {
    async showMessage(message: string): Promise<void> {
        // Tauri 可以调用原生消息框
        console.log('[Tauri]', message)
    },

    async showConfirm(message: string): Promise<boolean> {
        return confirm(message)
    },

    async showInput(promptText: string, defaultValue?: string): Promise<string | null> {
        return window.prompt(promptText, defaultValue)
    },
}

export const tauriProvider: PlatformProvider = {
    name: 'tauri',
    capabilities,
    connection,
    query,
    fs: fileSystem,
    storage,
    dialog,
}

// 默认导出
export default tauriProvider
