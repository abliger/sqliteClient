import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { queryService } from '@services/query'
import type { QueryResult, QueryTab, SavedQueryTab, SavedQueryTabs } from '@types'

const STORAGE_KEY = 'sqlite-client-query-tabs'

// 从 localStorage 加载保存的 query tabs
function loadSavedQueryTabs(): SavedQueryTabs {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (err) {
    console.error('Failed to load saved query tabs:', err)
  }
  return {}
}

// 保存 query tabs 到 localStorage
function saveQueryTabsToStorage(data: SavedQueryTabs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Failed to save query tabs:', err)
  }
}

export const useQueryStore = defineStore('query', () => {
  // 当前激活的连接 ID
  const currentConnectionId = ref<string>('')
  
  // 所有连接的 query tabs（按 connectionId 分组）
  const connectionTabs = ref<Record<string, QueryTab[]>>({})
  const connectionActiveTabIds = ref<Record<string, string>>({})
  
  // 编辑器状态
  const editorStates = ref<Map<string, { content: string; cursorPosition?: { line: number; column: number } }>>(new Map())

  // 获取当前连接的 tabs
  const tabs = computed<QueryTab[]>({
    get: () => {
      if (!currentConnectionId.value) return []
      return connectionTabs.value[currentConnectionId.value] || []
    },
    set: (value: QueryTab[]) => {
      if (!currentConnectionId.value) return
      connectionTabs.value[currentConnectionId.value] = value
    }
  })

  // 获取当前连接的 activeTabId
  const activeTabId = computed<string>({
    get: () => {
      if (!currentConnectionId.value) return ''
      return connectionActiveTabIds.value[currentConnectionId.value] || ''
    },
    set: (value: string) => {
      if (!currentConnectionId.value) return
      connectionActiveTabIds.value[currentConnectionId.value] = value
    }
  })

  // Getters
  const activeTab = computed(() => {
    return tabs.value.find(t => t.id === activeTabId.value)
  })

  const activeTabIndex = computed(() => {
    return tabs.value.findIndex(t => t.id === activeTabId.value)
  })

  const hasUnsavedChanges = computed(() => {
    return Object.values(connectionTabs.value).some(tabs => 
      tabs.some(t => t.sql.trim().length > 0)
    )
  })

  // 设置当前连接
  function setCurrentConnection(connectionId: string) {
    const oldConnectionId = currentConnectionId.value
    
    // 如果切换了连接，先保存旧连接的 tabs
    if (oldConnectionId && oldConnectionId !== connectionId) {
      persistConnectionTabs(oldConnectionId)
    }
    
    currentConnectionId.value = connectionId
    
    // 如果该连接还没有 tabs，从存储恢复或创建默认
    if (connectionId && !connectionTabs.value[connectionId]) {
      restoreConnectionTabs(connectionId)
    }
    
    // 确保至少有一个 tab
    if (connectionId && tabs.value.length === 0) {
      const first = createNewTabInternal(0)
      tabs.value = [first]
      activeTabId.value = first.id
      persistConnectionTabs(connectionId)
    }
  }

  // 内部函数：创建新 tab（需要传入索引，因为 currentConnectionId 可能还未更新）
  function createNewTabInternal(index: number, sql: string = ''): QueryTab {
    const id = uuidv4()
    return {
      id,
      name: `Query ${index + 1}`,
      sql,
      isExecuting: false
    }
  }

  // 创建新 tab
  function createNewTab(sql: string = ''): QueryTab {
    return createNewTabInternal(tabs.value.length, sql)
  }

  // 添加 tab
  function addTab(sql: string = '') {
    if (!currentConnectionId.value) return
    
    const tab = createNewTab(sql)
    tabs.value = [...tabs.value, tab]
    activeTabId.value = tab.id
    persistCurrentConnectionTabs()
    return tab
  }

  // 移除 tab
  function removeTab(tabId: string) {
    if (!currentConnectionId.value) return
    
    const index = tabs.value.findIndex(t => t.id === tabId)
    if (index === -1) return

    const newTabs = [...tabs.value]
    newTabs.splice(index, 1)
    tabs.value = newTabs

    // 如果删除的是当前激活的标签，切换到相邻标签
    if (activeTabId.value === tabId) {
      const newIndex = Math.min(index, newTabs.length - 1)
      activeTabId.value = newTabs[newIndex]?.id ?? ''
    }

    // 确保至少有一个标签
    if (newTabs.length === 0) {
      const first = createNewTab()
      tabs.value = [first]
      activeTabId.value = first.id
    }
    
    persistCurrentConnectionTabs()
  }

  // 设置激活 tab
  function setActiveTab(tabId: string) {
    activeTabId.value = tabId
    persistCurrentConnectionTabs()
  }

  // 更新 tab SQL
  function updateTabSql(tabId: string, sql: string) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      tab.sql = sql
      // Debounced save
      debouncedPersist()
    }
  }

  // 更新 tab 名称
  function updateTabName(tabId: string, name: string) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      tab.name = name
      persistCurrentConnectionTabs()
    }
  }

  // 执行查询
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

  // 清除结果
  function clearResult(tabId?: string) {
    const targetTabId = tabId ?? activeTabId.value
    const tab = tabs.value.find(t => t.id === targetTabId)
    if (tab) {
      tab.result = undefined
      tab.executionTime = undefined
    }
  }

  // 保存编辑器状态
  function saveEditorState(tabId: string, content: string, cursorPosition?: { line: number; column: number }) {
    editorStates.value.set(tabId, { content, cursorPosition })
  }

  // 获取编辑器状态
  function getEditorState(tabId: string) {
    return editorStates.value.get(tabId)
  }

  // 持久化当前连接的 tabs
  function persistCurrentConnectionTabs() {
    if (!currentConnectionId.value) return
    persistConnectionTabs(currentConnectionId.value)
  }

  // 持久化指定连接的 tabs
  function persistConnectionTabs(connectionId: string) {
    const tabsToSave = connectionTabs.value[connectionId]
    if (!tabsToSave) return

    const savedTabs: SavedQueryTab[] = tabsToSave.map(t => ({
      id: t.id,
      name: t.name,
      sql: t.sql
    }))

    const savedData = loadSavedQueryTabs()
    savedData[connectionId] = {
      tabs: savedTabs,
      activeTabId: connectionActiveTabIds.value[connectionId] || (savedTabs[0]?.id ?? '')
    }
    saveQueryTabsToStorage(savedData)
  }

  // 从存储恢复指定连接的 tabs
  function restoreConnectionTabs(connectionId: string) {
    const savedData = loadSavedQueryTabs()
    const saved = savedData[connectionId]
    
    if (saved && saved.tabs.length > 0) {
      // 恢复 tabs（不包含运行时数据如 result, isExecuting）
      connectionTabs.value[connectionId] = saved.tabs.map(t => ({
        ...t,
        isExecuting: false,
        result: undefined,
        executionTime: undefined
      }))
      connectionActiveTabIds.value[connectionId] = saved.activeTabId || saved.tabs[0]?.id || ''
    }
    // 如果没有保存的数据，不创建默认 tab，由 setCurrentConnection 来处理
  }

  // 删除指定连接的 tabs（当连接被关闭时调用）
  function removeConnectionTabs(connectionId: string) {
    delete connectionTabs.value[connectionId]
    delete connectionActiveTabIds.value[connectionId]
    
    // 从 localStorage 中也删除
    const savedData = loadSavedQueryTabs()
    delete savedData[connectionId]
    saveQueryTabsToStorage(savedData)
  }

  // Debounce 保存
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  function debouncedPersist() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      persistCurrentConnectionTabs()
    }, 500)
  }

  // 清理关闭连接的 tabs（当应用启动恢复连接时，清理不再存在的连接的 tabs）
  function cleanupOrphanedTabs(activeConnectionIds: string[]) {
    const activeIds = new Set(activeConnectionIds)
    const savedData = loadSavedQueryTabs()
    let hasChanges = false
    
    // 清理内存中的 orphan tabs
    Object.keys(connectionTabs.value).forEach(connId => {
      if (!activeIds.has(connId)) {
        delete connectionTabs.value[connId]
        delete connectionActiveTabIds.value[connId]
      }
    })
    
    // 清理 localStorage 中的 orphan tabs
    Object.keys(savedData).forEach(connId => {
      if (!activeIds.has(connId)) {
        delete savedData[connId]
        hasChanges = true
      }
    })
    
    if (hasChanges) {
      saveQueryTabsToStorage(savedData)
    }
  }

  return {
    // State
    currentConnectionId,
    connectionTabs,
    connectionActiveTabIds,
    editorStates,
    // Computed
    tabs,
    activeTabId,
    activeTab,
    activeTabIndex,
    hasUnsavedChanges,
    // Actions
    setCurrentConnection,
    addTab,
    removeTab,
    setActiveTab,
    updateTabSql,
    updateTabName,
    executeQuery,
    clearResult,
    saveEditorState,
    getEditorState,
    removeConnectionTabs,
    cleanupOrphanedTabs,
    persistConnectionTabs,
    restoreConnectionTabs
  }
})
