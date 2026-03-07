import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { connectionService } from '@services/connection'
import type { ConnectionConfig, ConnectionInfo, DatabaseMetadata } from '@types'

export const useConnectionStore = defineStore('connection', () => {
    // State
    const connections = ref<ConnectionInfo[]>([])
    const activeConnectionId = ref<string | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    // Getters
    const activeConnection = computed(() => {
        return connections.value.find(c => c.config.id === activeConnectionId.value)
    })

    const connectionCount = computed(() => connections.value.length)

    // Actions
    async function loadConnections() {
        isLoading.value = true
        error.value = null
        try {
            connections.value = await connectionService.listConnections()
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to load connections'
        } finally {
            isLoading.value = false
        }
    }

    /**
     * 应用启动时恢复保存的连接
     */
    async function restoreSavedConnections(): Promise<ConnectionInfo[]> {
        isLoading.value = true
        error.value = null
        try {
            connections.value = await connectionService.restoreSavedConnections()
            // 如果有连接，设置第一个为活动连接
            if (connections.value.length > 0 && !activeConnectionId.value) {
                activeConnectionId.value = connections.value[0].config.id
            }
            return connections.value
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to restore connections'
            console.error('Failed to restore connections:', err)
            return []
        } finally {
            isLoading.value = false
        }
    }

    /**
     * 加载保存的连接配置（不自动连接）
     */
    async function loadSavedConnectionConfigs(): Promise<ConnectionConfig[]> {
        try {
            return await connectionService.loadSavedConnectionConfigs()
        } catch (err) {
            console.error('Failed to load saved connection configs:', err)
            return []
        }
    }

    async function createConnection(name: string, dbPath: string) {
        isLoading.value = true
        error.value = null
        try {
            const connection = await connectionService.createConnection(name, dbPath)
            connections.value.push(connection)
            activeConnectionId.value = connection.config.id
            return connection
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to create connection'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function createNewDatabase(name: string, dbPath: string) {
        isLoading.value = true
        error.value = null
        try {
            const connection = await connectionService.createNewDatabase(name, dbPath)
            connections.value.push(connection)
            activeConnectionId.value = connection.config.id
            return connection
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to create database'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function closeConnection(connectionId: string) {
        try {
            await connectionService.closeConnection(connectionId)
            connections.value = connections.value.filter(c => c.config.id !== connectionId)

            if (activeConnectionId.value === connectionId) {
                activeConnectionId.value = connections.value[0]?.config.id ?? null
            }
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to close connection'
            throw err
        }
    }

    function setActiveConnection(connectionId: string | null) {
        activeConnectionId.value = connectionId
    }

    async function refreshMetadata(connectionId: string): Promise<DatabaseMetadata> {
        const metadata = await connectionService.refreshMetadata(connectionId)
        const index = connections.value.findIndex(c => c.config.id === connectionId)
        if (index !== -1) {
            connections.value[index].metadata = metadata
        }
        return metadata
    }

    return {
        // State
        connections,
        activeConnectionId,
        isLoading,
        error,
        // Getters
        activeConnection,
        connectionCount,
        // Actions
        loadConnections,
        restoreSavedConnections,
        loadSavedConnectionConfigs,
        createConnection,
        createNewDatabase,
        closeConnection,
        setActiveConnection,
        refreshMetadata,
    }
})
