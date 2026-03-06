import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { connectionService } from '@services/connection'
import type { ConnectionInfo, DatabaseMetadata } from '@types/index'

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
    createConnection,
    createNewDatabase,
    closeConnection,
    setActiveConnection,
    refreshMetadata
  }
})
