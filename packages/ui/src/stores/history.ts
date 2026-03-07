import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { historyService } from '@services/history'
import type { QueryHistoryItem } from '@types'

export const useHistoryStore = defineStore('history', () => {
    // State
    const items = ref<QueryHistoryItem[]>([])
    const searchQuery = ref('')
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const pageSize = ref(50)
    const currentPage = ref(1)
    // 当前选中的连接ID过滤
    const selectedConnectionId = ref<string | null>(null)

    // Getters
    const filteredItems = computed(() => {
        let result = items.value

        // 先按连接ID过滤
        if (selectedConnectionId.value) {
            result = result.filter(item => item.connection_id === selectedConnectionId.value)
        }

        // 再按搜索关键词过滤
        if (searchQuery.value.trim()) {
            const query = searchQuery.value.toLowerCase()
            result = result.filter(
                item =>
                    item.sql.toLowerCase().includes(query) ||
                    item.connection_name?.toLowerCase().includes(query),
            )
        }

        return result
    })

    const paginatedItems = computed(() => {
        const start = (currentPage.value - 1) * pageSize.value
        const end = start + pageSize.value
        return filteredItems.value.slice(start, end)
    })

    const totalPages = computed(() => {
        return Math.ceil(filteredItems.value.length / pageSize.value)
    })

    const recentQueries = computed(() => {
        return items.value.slice(0, 10)
    })

    // Actions
    async function loadHistory(limit?: number, offset?: number) {
        isLoading.value = true
        error.value = null
        try {
            items.value = await historyService.getQueryHistory(limit, offset)
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to load history'
        } finally {
            isLoading.value = false
        }
    }

    async function searchHistory(query: string) {
        searchQuery.value = query
        if (!query.trim()) {
            await loadHistory()
            return
        }

        isLoading.value = true
        error.value = null
        try {
            items.value = await historyService.searchHistory(query, 100)
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to search history'
        } finally {
            isLoading.value = false
        }
    }

    async function deleteHistoryItem(id: string) {
        try {
            await historyService.deleteHistoryItem(id)
            items.value = items.value.filter(item => item.id !== id)
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to delete history item'
            throw err
        }
    }

    async function clearHistory(connectionId?: string) {
        try {
            await historyService.clearHistory(connectionId)
            if (connectionId) {
                items.value = items.value.filter(item => item.connection_id !== connectionId)
            } else {
                items.value = []
            }
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Failed to clear history'
            throw err
        }
    }

    function setPage(page: number) {
        currentPage.value = Math.max(1, Math.min(page, totalPages.value))
    }

    function setPageSize(size: number) {
        pageSize.value = size
        currentPage.value = 1
    }

    function setSelectedConnectionId(connectionId: string | null) {
        selectedConnectionId.value = connectionId
        currentPage.value = 1 // 重置到第一页
    }

    return {
        // State
        items,
        searchQuery,
        isLoading,
        error,
        pageSize,
        currentPage,
        // State
        selectedConnectionId,
        // Getters
        filteredItems,
        paginatedItems,
        totalPages,
        recentQueries,
        // Actions
        loadHistory,
        searchHistory,
        deleteHistoryItem,
        clearHistory,
        setPage,
        setPageSize,
        setSelectedConnectionId,
    }
})
