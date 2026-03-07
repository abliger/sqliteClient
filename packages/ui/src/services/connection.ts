import { invoke } from '@tauri-apps/api/core'
import type { ConnectionConfig, ConnectionInfo } from '@types'

export const connectionService = {
  async createConnection(name: string, dbPath: string): Promise<ConnectionInfo> {
    return invoke('create_connection', { name, dbPath })
  },

  async createNewDatabase(name: string, dbPath: string): Promise<ConnectionInfo> {
    return invoke('create_new_database', { name, dbPath })
  },

  async closeConnection(connectionId: string): Promise<void> {
    return invoke('close_connection', { connectionId })
  },

  async listConnections(): Promise<ConnectionInfo[]> {
    return invoke('list_connections')
  },

  async getConnectionInfo(connectionId: string): Promise<ConnectionInfo> {
    return invoke('get_connection_info', { connectionId })
  },

  async testConnection(dbPath: string): Promise<void> {
    return invoke('test_connection', { dbPath })
  },

  async refreshMetadata(connectionId: string): Promise<ConnectionInfo['metadata']> {
    return invoke('refresh_connection_metadata', { connectionId })
  },

  /**
   * 恢复所有保存的连接（应用启动时调用）
   */
  async restoreSavedConnections(): Promise<ConnectionInfo[]> {
    return invoke('restore_saved_connections')
  },

  /**
   * 加载保存的连接配置（不自动连接）
   */
  async loadSavedConnectionConfigs(): Promise<ConnectionConfig[]> {
    return invoke('load_saved_connection_configs')
  }
}
