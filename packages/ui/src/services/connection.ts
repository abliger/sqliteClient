/**
 * 统一的连接服务
 * 自动检测环境并使用 Tauri 或 VS Code API
 */
import { isTauri, isVSCode } from '@utils/tauri'
import { connectionService as tauriService } from './connection-tauri'
import { connectionVSCodeService } from './connection-vscode'
import type { ConnectionConfig, ConnectionInfo } from '@types'

class UnifiedConnectionService {
    private getService() {
        if (isTauri()) {
            return tauriService
        }
        if (isVSCode()) {
            return connectionVSCodeService
        }
        throw new Error('No connection service available - not in Tauri or VS Code environment')
    }

    async createConnection(name: string, dbPath: string): Promise<ConnectionInfo> {
        return this.getService().createConnection(name, dbPath)
    }

    async createNewDatabase(name: string, dbPath: string): Promise<ConnectionInfo> {
        return this.getService().createNewDatabase(name, dbPath)
    }

    async closeConnection(connectionId: string): Promise<void> {
        return this.getService().closeConnection(connectionId)
    }

    async listConnections(): Promise<ConnectionInfo[]> {
        // VS Code 环境返回空数组，Tauri 返回实际连接
        if (isVSCode() && !isTauri()) {
            return connectionVSCodeService.listConnections()
        }
        return this.getService().listConnections()
    }

    async getConnectionInfo(connectionId: string): Promise<ConnectionInfo> {
        return this.getService().getConnectionInfo(connectionId)
    }

    async testConnection(dbPath: string): Promise<void> {
        return this.getService().testConnection(dbPath)
    }

    async refreshMetadata(connectionId: string): Promise<ConnectionInfo['metadata']> {
        return this.getService().refreshMetadata(connectionId)
    }

    async restoreSavedConnections(): Promise<ConnectionInfo[]> {
        // VS Code 环境返回空数组，Tauri 返回实际连接
        if (isVSCode() && !isTauri()) {
            return connectionVSCodeService.restoreSavedConnections()
        }
        return this.getService().restoreSavedConnections()
    }

    async loadSavedConnectionConfigs(): Promise<ConnectionConfig[]> {
        return this.getService().loadSavedConnectionConfigs()
    }
}

export const connectionService = new UnifiedConnectionService()
