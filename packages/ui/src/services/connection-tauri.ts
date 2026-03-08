import { safeInvoke, isTauri } from '@utils/tauri'
import type { ConnectionConfig, ConnectionInfo } from '@types'

export class TauriNotAvailableError extends Error {
    constructor(operation: string) {
        super(`${operation} is only available in the desktop app`)
        this.name = 'TauriNotAvailableError'
    }
}

export const connectionService = {
    async createConnection(name: string, dbPath: string): Promise<ConnectionInfo> {
        if (!isTauri()) throw new TauriNotAvailableError('createConnection')
        return safeInvoke('create_connection', { name, dbPath }) as Promise<ConnectionInfo>
    },

    async createNewDatabase(name: string, dbPath: string): Promise<ConnectionInfo> {
        if (!isTauri()) throw new TauriNotAvailableError('createNewDatabase')
        return safeInvoke('create_new_database', { name, dbPath }) as Promise<ConnectionInfo>
    },

    async closeConnection(connectionId: string): Promise<void> {
        if (!isTauri()) throw new TauriNotAvailableError('closeConnection')
        return safeInvoke('close_connection', { connectionId }) as Promise<void>
    },

    async listConnections(): Promise<ConnectionInfo[]> {
        if (!isTauri()) return []
        return safeInvoke('list_connections') as Promise<ConnectionInfo[]>
    },

    async getConnectionInfo(connectionId: string): Promise<ConnectionInfo> {
        if (!isTauri()) throw new TauriNotAvailableError('getConnectionInfo')
        return safeInvoke('get_connection_info', { connectionId }) as Promise<ConnectionInfo>
    },

    async testConnection(dbPath: string): Promise<void> {
        if (!isTauri()) throw new TauriNotAvailableError('testConnection')
        return safeInvoke('test_connection', { dbPath }) as Promise<void>
    },

    async refreshMetadata(connectionId: string): Promise<ConnectionInfo['metadata']> {
        if (!isTauri()) throw new TauriNotAvailableError('refreshMetadata')
        return safeInvoke('refresh_connection_metadata', { connectionId }) as Promise<ConnectionInfo['metadata']>
    },

    /**
     * 恢复所有保存的连接（应用启动时调用）
     */
    async restoreSavedConnections(): Promise<ConnectionInfo[]> {
        if (!isTauri()) return []
        return safeInvoke('restore_saved_connections') as Promise<ConnectionInfo[]>
    },

    /**
     * 加载保存的连接配置（不自动连接）
     */
    async loadSavedConnectionConfigs(): Promise<ConnectionConfig[]> {
        if (!isTauri()) return []
        return safeInvoke('load_saved_connection_configs') as Promise<ConnectionConfig[]>
    },
}
