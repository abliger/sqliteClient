import { invoke } from '@tauri-apps/api/core'
import type { ConnectionInfo } from '@types/index'

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
  }
}
