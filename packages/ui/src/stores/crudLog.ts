import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as crudLogService from '@services/crudLog'
import type { CrudOperationLog, CrudOperationType } from '@types'

export interface CrudLogFilter {
    operationType?: CrudOperationType
    tableName?: string
    startTime?: Date
    endTime?: Date
}

export const useCrudLogStore = defineStore('crudLog', () => {
    // State
    const logs = ref<CrudOperationLog[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const selectedTabId = ref<string | null>(null)
    const tableNames = ref<string[]>([])
    const stats = ref<crudLogService.CrudLogStats | null>(null)

    // Getters
    const filteredLogs = computed(() => {
        let result = logs.value

        // 按 Tab 筛选
        if (selectedTabId.value) {
            result = result.filter(log => log.tab_id === selectedTabId.value)
        }

        return result
    })

    const logsByTab = computed(() => {
        const grouped = new Map<string, CrudOperationLog[]>()
        logs.value.forEach(log => {
            const existing = grouped.get(log.tab_id) || []
            existing.push(log)
            grouped.set(log.tab_id, existing)
        })
        return grouped
    })

    const operationTypeCounts = computed(() => {
        const counts = { INSERT: 0, UPDATE: 0, DELETE: 0 }
        filteredLogs.value.forEach(log => {
            counts[log.operation_type]++
        })
        return counts
    })

    // Actions
    async function loadLogs(connectionId?: string, limit: number = 100) {
        isLoading.value = true
        error.value = null
        try {
            const filter: Parameters<typeof crudLogService.queryCrudLogs>[0] = {}
            if (connectionId) {
                filter.connection_id = connectionId
            }
            logs.value = await crudLogService.queryCrudLogs(filter, limit)
            return logs.value
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to load logs'
            console.error('Failed to load CRUD logs:', err)
            return []
        } finally {
            isLoading.value = false
        }
    }

    async function loadLogsByTab(tabId: string, limit: number = 100) {
        isLoading.value = true
        error.value = null
        try {
            const filter = { tab_id: tabId }
            logs.value = await crudLogService.queryCrudLogs(filter, limit)
            selectedTabId.value = tabId
            return logs.value
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to load logs'
            console.error('Failed to load CRUD logs by tab:', err)
            return []
        } finally {
            isLoading.value = false
        }
    }

    async function addLog(log: CrudOperationLog) {
        try {
            await crudLogService.addCrudLog(log)
            // 添加到本地列表（如果匹配当前筛选条件）
            if (!selectedTabId.value || log.tab_id === selectedTabId.value) {
                logs.value.unshift(log)
            }
            return true
        } catch (err) {
            console.error('Failed to add CRUD log:', err)
            return false
        }
    }

    async function deleteLogsByTab(tabId: string) {
        try {
            const deleted = await crudLogService.deleteCrudLogsByTab(tabId)
            // 从本地列表中移除
            logs.value = logs.value.filter(log => log.tab_id !== tabId)
            if (selectedTabId.value === tabId) {
                selectedTabId.value = null
            }
            return deleted
        } catch (err) {
            console.error('Failed to delete CRUD logs by tab:', err)
            return 0
        }
    }

    async function loadTableNames() {
        try {
            tableNames.value = await crudLogService.getCrudLogTableNames()
            return tableNames.value
        } catch (err) {
            console.error('Failed to load table names:', err)
            return []
        }
    }

    async function loadStats(connectionId?: string) {
        try {
            stats.value = await crudLogService.getCrudLogStats(connectionId)
            return stats.value
        } catch (err) {
            console.error('Failed to load stats:', err)
            return null
        }
    }

    function setSelectedTab(tabId: string | null) {
        selectedTabId.value = tabId
    }

    function clearLogs() {
        logs.value = []
        selectedTabId.value = null
        stats.value = null
    }

    return {
        // State
        logs,
        isLoading,
        error,
        selectedTabId,
        tableNames,
        stats,
        // Getters
        filteredLogs,
        logsByTab,
        operationTypeCounts,
        // Actions
        loadLogs,
        loadLogsByTab,
        addLog,
        deleteLogsByTab,
        loadTableNames,
        loadStats,
        setSelectedTab,
        clearLogs,
    }
})
