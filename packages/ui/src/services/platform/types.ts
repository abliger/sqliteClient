/**
 * Platform Provider Architecture
 * 
 * 支持多平台运行的统一抽象层
 */

export type PlatformName = 'tauri' | 'vscode' | 'web' | 'mock'

export interface PlatformCapabilities {
    /** 数据库连接支持 */
    database: 'native' | 'websocket' | 'http' | 'none'
    
    /** 文件系统访问级别 */
    fileSystem: 'full' | 'sandboxed' | 'readonly' | 'none'
    
    /** 原生对话框支持 */
    dialog: 'native' | 'custom' | 'none'
    
    /** 持久化存储支持 */
    storage: 'persistent' | 'session' | 'memory'
    
    /** 系统剪贴板 */
    clipboard: 'full' | 'read-only' | 'none'
    
    /** 通知系统 */
    notification: 'native' | 'custom' | 'none'
}

export interface ConnectionProvider {
    createConnection(name: string, dbPath: string): Promise<ConnectionInfo>
    closeConnection(connectionId: string): Promise<void>
    listConnections(): Promise<ConnectionInfo[]>
    testConnection(dbPath: string): Promise<void>
}

export interface QueryProvider {
    executeQuery(options: ExecuteQueryOptions): Promise<QueryResult>
    executeSqlFile(connectionId: string, filePath: string): Promise<SqlFileExecutionResult>
    cancelQuery(queryId: string): Promise<void>
}

export interface FileSystemProvider {
    readFile(path: string): Promise<string>
    writeFile(path: string, content: string): Promise<void>
    showOpenDialog(options: OpenDialogOptions): Promise<string | null>
    showSaveDialog(options: SaveDialogOptions): Promise<string | null>
}

export interface StorageProvider {
    getItem<T>(key: string): Promise<T | null>
    setItem<T>(key: string, value: T): Promise<void>
    removeItem(key: string): Promise<void>
}

export interface DialogProvider {
    showMessage(message: string, type?: 'info' | 'warning' | 'error'): Promise<void>
    showConfirm(message: string): Promise<boolean>
    showInput(prompt: string, defaultValue?: string): Promise<string | null>
}

export interface PlatformProvider {
    readonly name: PlatformName
    readonly capabilities: PlatformCapabilities
    
    connection: ConnectionProvider
    query: QueryProvider
    fs: FileSystemProvider
    storage: StorageProvider
    dialog: DialogProvider
    
    /** 平台特定的初始化 */
    initialize?(): Promise<void>
    
    /** 清理资源 */
    dispose?(): Promise<void>
}

// 重新导出类型供使用
import type { ConnectionInfo } from '@types'
import type { QueryResult, SqlFileExecutionResult } from '@services/query'

interface ExecuteQueryOptions {
    connectionId: string
    sql: string
    limit?: number
}

interface OpenDialogOptions {
    title?: string
    filters?: Record<string, string[]>
    multiple?: boolean
}

interface SaveDialogOptions {
    title?: string
    defaultPath?: string
    filters?: Record<string, string[]>
}
