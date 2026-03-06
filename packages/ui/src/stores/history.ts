import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { historyService } from '@services/history'
import type { QueryHistoryItem } from '@types/index'

export const useHistoryStore = defineStore('history', () => {
  // State
  const items = ref<QueryHistoryItem[]>([])
  const searchQuery = ref('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pageSize = ref(50)
  const currentPage = ref(1)

  // Getters
  const filteredItems = computed(() => {
    if (!searchQuery.value.trim()) {
      return items.value
    }
    
    const query = searchQuery.value.toLowerCase()
    return items.value.filter(item => 
      item.sql.toLowerCase().includes(query) ||
      item.connection_name?.toLowerCase().includes(query)
    )
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

  return {
    // State
    items,
    searchQuery,
    isLoading,
    error,
    pageSize,
    currentPage,
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
    setPageSize
  }
})
