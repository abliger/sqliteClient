import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { queryService } from '@services/query'
import type { QueryResult, QueryTab } from '@types/index'

export const useQueryStore = defineStore('query', () => {
  // State
  const tabs = ref<QueryTab[]>([])
  const activeTabId = ref<string>('')
  const editorStates = ref<Map<string, { content: string; cursorPosition?: { line: number; column: number } }>>(new Map())
  
  // Initialize with default tab
  function initializeDefaultTab() {
    if (tabs.value.length === 0) {
      const first = createNewTab()
      tabs.value.push(first)
      activeTabId.value = first.id
    }
  }

  // Getters
  const activeTab = computed(() => {
    return tabs.value.find(t => t.id === activeTabId.value)
  })

  const activeTabIndex = computed(() => {
    return tabs.value.findIndex(t => t.id === activeTabId.value)
  })

  const hasUnsavedChanges = computed(() => {
    return tabs.value.some(t => t.sql.trim().length > 0)
  })

  // Actions
  function createNewTab(sql: string = ''): QueryTab {
    const id = uuidv4()
    const index = tabs.value.length + 1
    return {
      id,
      name: `Query ${index}`,
      sql,
      isExecuting: false
    }
  }

  function addTab(sql: string = '') {
    const tab = createNewTab(sql)
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
  }

  function removeTab(tabId: string) {
    const index = tabs.value.findIndex(t => t.id === tabId)
    if (index === -1) return

    tabs.value.splice(index, 1)

    // 如果删除的是当前激活的标签，切换到相邻标签
    if (activeTabId.value === tabId) {
      const newIndex = Math.min(index, tabs.value.length - 1)
      activeTabId.value = tabs.value[newIndex]?.id ?? ''
    }

    // 确保至少有一个标签
    if (tabs.value.length === 0) {
      addTab()
    }
  }

  function setActiveTab(tabId: string) {
    activeTabId.value = tabId
  }

  function updateTabSql(tabId: string, sql: string) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      tab.sql = sql
    }
  }

  function updateTabName(tabId: string, name: string) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      tab.name = name
    }
  }

  async function executeQuery(connectionId: string, sql: string, limit?: number): Promise<QueryResult> {
    const tab = activeTab.value
    if (!tab) throw new Error('No active tab')

    tab.isExecuting = true
    tab.result = undefined
    tab.executionTime = undefined

    const startTime = Date.now()

    try {
      const result = await queryService.executeQuery({
        connectionId,
        sql,
        limit
      })

      tab.result = result
      tab.executionTime = Date.now() - startTime

      return result
    } finally {
      tab.isExecuting = false
    }
  }

  function clearResult(tabId?: string) {
    const targetTabId = tabId ?? activeTabId.value
    const tab = tabs.value.find(t => t.id === targetTabId)
    if (tab) {
      tab.result = undefined
      tab.executionTime = undefined
    }
  }

  function saveEditorState(tabId: string, content: string, cursorPosition?: { line: number; column: number }) {
    editorStates.value.set(tabId, { content, cursorPosition })
  }

  function getEditorState(tabId: string) {
    return editorStates.value.get(tabId)
  }

  // Auto-initialize on first use
  initializeDefaultTab()

  return {
    // State
    tabs,
    activeTabId,
    editorStates,
    // Getters
    activeTab,
    activeTabIndex,
    hasUnsavedChanges,
    // Actions
    addTab,
    removeTab,
    setActiveTab,
    updateTabSql,
    updateTabName,
    executeQuery,
    clearResult,
    saveEditorState,
    getEditorState,
    initializeDefaultTab
  }
})
