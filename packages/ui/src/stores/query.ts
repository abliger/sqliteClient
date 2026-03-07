import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { queryService } from '@services/query'
import type { QueryResult, QueryTab, QueryResultSnapshot, CompareViewSettings } from '@types'

// 保存到 localStorage 的 Tab 类型（不包含运行时数据）
interface SavedQueryTab {
    id: string
    name: string
    sql: string
}

// 保存到 localStorage 的数据结构
interface SavedQueryTabs {
    [connectionId: string]: {
        tabs: SavedQueryTab[]
        activeTabId: string
    }
}

// 保存到 localStorage 的快照数据结构
interface SavedSnapshots {
    [connectionId: string]: {
        [tabId: string]: QueryResultSnapshot[]
    }
}

const SNAPSHOTS_STORAGE_KEY = 'sqlite-client-query-snapshots'

const STORAGE_KEY = 'sqlite-client-query-tabs-v2'

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
    const editorStates = ref<
        Map<string, { content: string; cursorPosition?: { line: number; column: number } }>
    >(new Map())

    // 查询结果快照（按 connectionId -> tabId 分组）
    const querySnapshots = ref<Record<string, Record<string, QueryResultSnapshot[]>>>({})

    // 对比视图设置（按 connectionId -> tabId 分组）
    const compareSettings = ref<Record<string, Record<string, CompareViewSettings>>>({})

    // 获取当前连接的 tabs
    const tabs = computed<QueryTab[]>(() => {
        if (!currentConnectionId.value) return []
        return connectionTabs.value[currentConnectionId.value] || []
    })

    // 获取当前连接的 activeTabId
    const activeTabId = computed<string>(() => {
        if (!currentConnectionId.value) return ''
        return connectionActiveTabIds.value[currentConnectionId.value] || ''
    })

    // Getters
    const activeTab = computed(() => {
        return tabs.value.find(t => t.id === activeTabId.value)
    })

    // 获取当前 Tab 的快照列表
    const activeTabSnapshots = computed<QueryResultSnapshot[]>(() => {
        if (!currentConnectionId.value || !activeTabId.value) return []
        return querySnapshots.value[currentConnectionId.value]?.[activeTabId.value] || []
    })

    // 获取当前 Tab 的对比设置
    const activeTabCompareSettings = computed<CompareViewSettings>(() => {
        if (!currentConnectionId.value || !activeTabId.value) {
            return {
                enabled: false,
                selectedSnapshotIds: [],
                highlightDiff: true,
                mode: 'side-by-side',
            }
        }
        return (
            compareSettings.value[currentConnectionId.value]?.[activeTabId.value] || {
                enabled: false,
                selectedSnapshotIds: [],
                highlightDiff: true,
                mode: 'side-by-side',
            }
        )
    })

    const activeTabIndex = computed(() => {
        return tabs.value.findIndex(t => t.id === activeTabId.value)
    })

    const hasUnsavedChanges = computed(() => {
        return Object.values(connectionTabs.value).some(tabs =>
            tabs.some(t => t.sql.trim().length > 0),
        )
    })

    // 保存所有连接的 tabs（在页面关闭前调用）
    function persistAllConnectionTabs() {
        const savedData: SavedQueryTabs = {}
        Object.keys(connectionTabs.value).forEach(connectionId => {
            const tabsToSave = connectionTabs.value[connectionId]
            if (tabsToSave && tabsToSave.length > 0) {
                savedData[connectionId] = {
                    tabs: tabsToSave.map(t => ({
                        id: t.id,
                        name: t.name,
                        sql: t.sql,
                    })),
                    activeTabId:
                        connectionActiveTabIds.value[connectionId] || tabsToSave[0]?.id || '',
                }
            }
        })
        saveQueryTabsToStorage(savedData)
        console.log('[QueryStore] Saved all tabs:', savedData)
    }

    // 设置当前连接
    function setCurrentConnection(connectionId: string) {
        console.log('[QueryStore] Setting current connection:', connectionId)
        const oldConnectionId = currentConnectionId.value

        // 如果切换了连接，先保存旧连接的 tabs
        if (oldConnectionId && oldConnectionId !== connectionId) {
            persistConnectionTabs(oldConnectionId)
        }

        // 如果 connectionId 为空，只更新状态不清除数据
        if (!connectionId) {
            currentConnectionId.value = ''
            return
        }

        currentConnectionId.value = connectionId

        // 如果该连接还没有 tabs，从存储恢复或创建默认
        if (!connectionTabs.value[connectionId]) {
            const restored = restoreConnectionTabs(connectionId)
            if (!restored) {
                // 没有保存的数据，创建默认 tab
                const first = createNewTabInternal(0)
                connectionTabs.value[connectionId] = [first]
                connectionActiveTabIds.value[connectionId] = first.id
                persistConnectionTabs(connectionId)
                console.log('[QueryStore] Created default tab for:', connectionId)
            }
        }

        console.log(
            '[QueryStore] Current tabs for connection:',
            connectionId,
            connectionTabs.value[connectionId],
        )
    }

    // 内部函数：创建新 tab（需要传入索引，因为 currentConnectionId 可能还未更新）
    function createNewTabInternal(index: number, sql: string = ''): QueryTab {
        const id = uuidv4()
        return {
            id,
            name: `Query ${index + 1}`,
            sql,
            isExecuting: false,
        }
    }

    // 创建新 tab
    function createNewTab(sql: string = ''): QueryTab {
        return createNewTabInternal(tabs.value.length, sql)
    }

    // 添加 tab
    function addTab(sql: string = '') {
        if (!currentConnectionId.value) {
            console.warn('[QueryStore] Cannot add tab: no current connection')
            return
        }

        const tab = createNewTab(sql)
        const currentTabs = connectionTabs.value[currentConnectionId.value] || []
        connectionTabs.value[currentConnectionId.value] = [...currentTabs, tab]
        connectionActiveTabIds.value[currentConnectionId.value] = tab.id
        persistCurrentConnectionTabs()
        console.log('[QueryStore] Added tab:', tab.id, 'for connection:', currentConnectionId.value)
        return tab
    }

    // 移除 tab
    function removeTab(tabId: string) {
        if (!currentConnectionId.value) {
            console.warn('[QueryStore] Cannot remove tab: no current connection')
            return
        }

        const currentTabs = connectionTabs.value[currentConnectionId.value] || []
        const index = currentTabs.findIndex(t => t.id === tabId)
        if (index === -1) return

        const newTabs = [...currentTabs]
        newTabs.splice(index, 1)
        connectionTabs.value[currentConnectionId.value] = newTabs

        // 如果删除的是当前激活的标签，切换到相邻标签
        if (connectionActiveTabIds.value[currentConnectionId.value] === tabId) {
            const newIndex = Math.min(index, newTabs.length - 1)
            connectionActiveTabIds.value[currentConnectionId.value] = newTabs[newIndex]?.id ?? ''
        }

        // 确保至少有一个标签
        if (newTabs.length === 0) {
            const first = createNewTab()
            connectionTabs.value[currentConnectionId.value] = [first]
            connectionActiveTabIds.value[currentConnectionId.value] = first.id
        }

        persistCurrentConnectionTabs()
        console.log('[QueryStore] Removed tab:', tabId)
    }

    // 设置激活 tab
    function setActiveTab(tabId: string) {
        if (!currentConnectionId.value) {
            console.warn('[QueryStore] Cannot set active tab: no current connection')
            return
        }
        connectionActiveTabIds.value[currentConnectionId.value] = tabId
        persistCurrentConnectionTabs()
    }

    // 更新 tab SQL
    function updateTabSql(tabId: string, sql: string) {
        if (!currentConnectionId.value) {
            console.warn('[QueryStore] Cannot update tab SQL: no current connection')
            return
        }
        const currentTabs = connectionTabs.value[currentConnectionId.value] || []
        const tab = currentTabs.find(t => t.id === tabId)
        if (tab) {
            tab.sql = sql
            // Debounced save
            debouncedPersist()
        }
    }

    // 更新 tab 名称
    function updateTabName(tabId: string, name: string) {
        if (!currentConnectionId.value) {
            console.warn('[QueryStore] Cannot update tab name: no current connection')
            return
        }
        const currentTabs = connectionTabs.value[currentConnectionId.value] || []
        const tab = currentTabs.find(t => t.id === tabId)
        if (tab) {
            tab.name = name
            persistCurrentConnectionTabs()
        }
    }

    // 执行查询
    async function executeQuery(
        connectionId: string,
        sql: string,
        limit?: number,
    ): Promise<QueryResult> {
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
                limit,
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
        if (!currentConnectionId.value) {
            console.warn('[QueryStore] Cannot clear result: no current connection')
            return
        }
        const currentTabs = connectionTabs.value[currentConnectionId.value] || []
        const targetTabId = tabId ?? connectionActiveTabIds.value[currentConnectionId.value]
        const tab = currentTabs.find(t => t.id === targetTabId)
        if (tab) {
            tab.result = undefined
            tab.executionTime = undefined
        }
    }

    // 保存编辑器状态
    function saveEditorState(
        tabId: string,
        content: string,
        cursorPosition?: { line: number; column: number },
    ) {
        editorStates.value.set(tabId, { content, cursorPosition })
    }

    // 获取编辑器状态
    function getEditorState(tabId: string) {
        return editorStates.value.get(tabId)
    }

    // 获取指定连接的 tabs
    function getTabsByConnection(connectionId: string): QueryTab[] {
        return connectionTabs.value[connectionId] || []
    }

    // 持久化当前连接的 tabs
    function persistCurrentConnectionTabs() {
        if (!currentConnectionId.value) return
        persistConnectionTabs(currentConnectionId.value)
    }

    // 持久化指定连接的 tabs
    function persistConnectionTabs(connectionId: string) {
        const tabsToSave = connectionTabs.value[connectionId]
        if (!tabsToSave) {
            console.log('[QueryStore] No tabs to save for connection:', connectionId)
            return
        }

        const savedTabs: SavedQueryTab[] = tabsToSave.map(t => ({
            id: t.id,
            name: t.name,
            sql: t.sql,
        }))

        const savedData = loadSavedQueryTabs()
        savedData[connectionId] = {
            tabs: savedTabs,
            activeTabId: connectionActiveTabIds.value[connectionId] || (savedTabs[0]?.id ?? ''),
        }
        saveQueryTabsToStorage(savedData)
        console.log('[QueryStore] Saved tabs for connection:', connectionId, savedTabs)
    }

    // 从存储恢复指定连接的 tabs
    // 返回 true 表示成功恢复，false 表示没有保存的数据
    function restoreConnectionTabs(connectionId: string): boolean {
        const savedData = loadSavedQueryTabs()
        const saved = savedData[connectionId]

        console.log('[QueryStore] Restoring tabs for connection:', connectionId, saved)

        if (saved && saved.tabs.length > 0) {
            // 恢复 tabs（不包含运行时数据如 result, isExecuting）
            connectionTabs.value[connectionId] = saved.tabs.map((t: SavedQueryTab) => ({
                ...t,
                isExecuting: false,
                result: undefined,
                executionTime: undefined,
            }))
            connectionActiveTabIds.value[connectionId] =
                saved.activeTabId || saved.tabs[0]?.id || ''
            console.log(
                '[QueryStore] Restored tabs for connection:',
                connectionId,
                connectionTabs.value[connectionId],
            )
            return true
        }
        return false
    }

    // 删除指定连接的 tabs（当连接被关闭时调用）
    function removeConnectionTabs(connectionId: string) {
        delete connectionTabs.value[connectionId]
        delete connectionActiveTabIds.value[connectionId]

        // 从 localStorage 中也删除
        const savedData = loadSavedQueryTabs()
        delete savedData[connectionId]
        saveQueryTabsToStorage(savedData)
        console.log('[QueryStore] Removed tabs for connection:', connectionId)
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
        const savedSnapshots = loadSavedSnapshots()
        let hasChanges = false
        let hasSnapshotChanges = false

        // 清理内存中的 orphan tabs
        Object.keys(connectionTabs.value).forEach(connId => {
            if (!activeIds.has(connId)) {
                delete connectionTabs.value[connId]
                delete connectionActiveTabIds.value[connId]
                delete querySnapshots.value[connId]
                delete compareSettings.value[connId]
            }
        })

        // 清理 localStorage 中的 orphan tabs
        Object.keys(savedData).forEach(connId => {
            if (!activeIds.has(connId)) {
                delete savedData[connId]
                hasChanges = true
            }
        })

        // 清理 localStorage 中的 orphan snapshots
        Object.keys(savedSnapshots).forEach(connId => {
            if (!activeIds.has(connId)) {
                delete savedSnapshots[connId]
                hasSnapshotChanges = true
            }
        })

        if (hasChanges) {
            saveQueryTabsToStorage(savedData)
        }
        if (hasSnapshotChanges) {
            saveSnapshotsToStorage(savedSnapshots)
        }
    }

    // ============================================
    // 查询结果快照管理
    // ============================================

    // 从 localStorage 加载保存的快照
    function loadSavedSnapshots(): SavedSnapshots {
        try {
            const saved = localStorage.getItem(SNAPSHOTS_STORAGE_KEY)
            if (saved) {
                return JSON.parse(saved)
            }
        } catch (err) {
            console.error('Failed to load saved snapshots:', err)
        }
        return {}
    }

    // 保存快照到 localStorage
    function saveSnapshotsToStorage(data: SavedSnapshots) {
        try {
            localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(data))
        } catch (err) {
            console.error('Failed to save snapshots:', err)
        }
    }

    // 为当前 Tab 创建快照
    function createSnapshot(name?: string): QueryResultSnapshot | null {
        if (!currentConnectionId.value || !activeTabId.value) {
            console.warn('[QueryStore] Cannot create snapshot: no current connection or tab')
            return null
        }

        const tab = activeTab.value
        if (!tab?.result || tab.result.type !== 'rows') {
            console.warn('[QueryStore] Cannot create snapshot: no rows result')
            return null
        }

        const snapshot: QueryResultSnapshot = {
            id: uuidv4(),
            name: name || `Snapshot ${activeTabSnapshots.value.length + 1}`,
            sql: tab.sql,
            result: tab.result,
            createdAt: new Date().toISOString(),
            executionTimeMs: tab.executionTime || 0,
        }

        // 初始化存储结构
        if (!querySnapshots.value[currentConnectionId.value]) {
            querySnapshots.value[currentConnectionId.value] = {}
        }
        if (!querySnapshots.value[currentConnectionId.value][activeTabId.value]) {
            querySnapshots.value[currentConnectionId.value][activeTabId.value] = []
        }

        // 添加快照
        querySnapshots.value[currentConnectionId.value][activeTabId.value].push(snapshot)

        // 持久化
        persistSnapshots(currentConnectionId.value, activeTabId.value)

        console.log('[QueryStore] Created snapshot:', snapshot.id, 'for tab:', activeTabId.value)
        return snapshot
    }

    // 删除快照
    function deleteSnapshot(snapshotId: string): boolean {
        if (!currentConnectionId.value || !activeTabId.value) return false

        const snapshots = querySnapshots.value[currentConnectionId.value]?.[activeTabId.value]
        if (!snapshots) return false

        const index = snapshots.findIndex(s => s.id === snapshotId)
        if (index === -1) return false

        snapshots.splice(index, 1)
        persistSnapshots(currentConnectionId.value, activeTabId.value)

        // 从对比设置中移除
        const settings = compareSettings.value[currentConnectionId.value]?.[activeTabId.value]
        if (settings) {
            settings.selectedSnapshotIds = settings.selectedSnapshotIds.filter(
                id => id !== snapshotId,
            )
            if (settings.selectedSnapshotIds.length < 2) {
                settings.enabled = false
            }
        }

        console.log('[QueryStore] Deleted snapshot:', snapshotId)
        return true
    }

    // 重命名快照
    function renameSnapshot(snapshotId: string, newName: string): boolean {
        if (!currentConnectionId.value || !activeTabId.value) return false

        const snapshots = querySnapshots.value[currentConnectionId.value]?.[activeTabId.value]
        if (!snapshots) return false

        const snapshot = snapshots.find(s => s.id === snapshotId)
        if (!snapshot) return false

        snapshot.name = newName
        persistSnapshots(currentConnectionId.value, activeTabId.value)

        return true
    }

    // 持久化指定 Tab 的快照
    function persistSnapshots(connectionId: string, tabId: string) {
        const snapshots = querySnapshots.value[connectionId]?.[tabId] || []
        const savedData = loadSavedSnapshots()

        if (!savedData[connectionId]) {
            savedData[connectionId] = {}
        }
        savedData[connectionId][tabId] = snapshots

        saveSnapshotsToStorage(savedData)
    }

    // 更新对比设置
    function updateCompareSettings(settings: Partial<CompareViewSettings>) {
        if (!currentConnectionId.value || !activeTabId.value) return

        if (!compareSettings.value[currentConnectionId.value]) {
            compareSettings.value[currentConnectionId.value] = {}
        }
        if (!compareSettings.value[currentConnectionId.value][activeTabId.value]) {
            compareSettings.value[currentConnectionId.value][activeTabId.value] = {
                enabled: false,
                selectedSnapshotIds: [],
                highlightDiff: true,
                mode: 'side-by-side',
            }
        }

        Object.assign(compareSettings.value[currentConnectionId.value][activeTabId.value], settings)
    }

    // 切换对比模式
    function toggleCompareMode(enabled: boolean) {
        updateCompareSettings({ enabled })
    }

    // 选择/取消选择快照用于对比
    function toggleSnapshotSelection(snapshotId: string) {
        const settings = activeTabCompareSettings.value
        const selectedIds = [...settings.selectedSnapshotIds]
        const index = selectedIds.indexOf(snapshotId)

        if (index === -1) {
            // 最多选择 2 个快照进行对比
            if (selectedIds.length >= 2) {
                selectedIds.shift() // 移除第一个，保持最多2个
            }
            selectedIds.push(snapshotId)
        } else {
            selectedIds.splice(index, 1)
        }

        updateCompareSettings({
            selectedSnapshotIds: selectedIds,
            enabled: selectedIds.length >= 2,
        })
    }

    // 获取指定快照
    function getSnapshot(snapshotId: string): QueryResultSnapshot | undefined {
        if (!currentConnectionId.value || !activeTabId.value) return undefined
        return querySnapshots.value[currentConnectionId.value]?.[activeTabId.value]?.find(
            s => s.id === snapshotId,
        )
    }

    return {
        // State
        currentConnectionId,
        connectionTabs,
        connectionActiveTabIds,
        editorStates,
        querySnapshots,
        compareSettings,
        // Computed
        tabs,
        activeTabId,
        activeTab,
        activeTabIndex,
        hasUnsavedChanges,
        activeTabSnapshots,
        activeTabCompareSettings,
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
        persistAllConnectionTabs,
        restoreConnectionTabs,
        getTabsByConnection,
        // Snapshot actions
        createSnapshot,
        deleteSnapshot,
        renameSnapshot,
        getSnapshot,
        updateCompareSettings,
        toggleCompareMode,
        toggleSnapshotSelection,
    }
})
