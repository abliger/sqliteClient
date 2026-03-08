<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import { useQueryStore } from '@stores/query'
import { useConnectionStore } from '@stores/connection'
import { useSchemaStore } from '@stores/schema'
import { useToastStore } from '@stores/toast'
import { exportService } from '@services/export'
import { crudService } from '@services/crud'
import * as crudLogService from '@services/crudLog'
import { useCrudLogStore } from '@stores/crudLog'
import { extractPrimaryTableName, isEditableQuery } from '@utils/sqlParser'
import { isTauri, isDialogSupported } from '@utils/tauri'
import ResultGrid from './ResultGrid.vue'
import ResultStatus from './ResultStatus.vue'
import CrudLogPanel from './CrudLogPanel.vue'
import QueryHistoryPanel from './QueryHistoryPanel.vue'
import ResultComparePanel from './ResultComparePanel.vue'
import EditRowDialog from '@components/dialogs/EditRowDialog.vue'
import ERDiagram from '@components/explorer/ERDiagram.vue'
import { ArrowDownTrayIcon, TableCellsIcon, CheckCircleIcon, ArrowsRightLeftIcon, CameraIcon, ShareIcon } from '@heroicons/vue/24/outline'
import type { QueryRow, CellValue, CrudOperationType, CrudOperationLog } from '@types'

const { t } = useI18n()
const queryStore = useQueryStore()
const connectionStore = useConnectionStore()
const schemaStore = useSchemaStore()
const toastStore = useToastStore()
const crudLogStore = useCrudLogStore()

// 延迟加载 dialog
let saveDialog: typeof import('@tauri-apps/plugin-dialog').save | null = null
let dialogLoaded = false
function loadDialogIfNeeded() {
    if (dialogLoaded) return
    dialogLoaded = true
    
    if (isTauri() || isDialogSupported()) {
        import('@tauri-apps/plugin-dialog').then(m => {
            saveDialog = m.save
        })
    }
}
const activeTab = ref<'results' | 'messages' | 'logs' | 'history' | 'compare' | 'er'>('results')
const isExporting = ref(false)
const isEditDialogOpen = ref(false)
const editingRow = ref<QueryRow | null>(null)
const isSavingSnapshot = ref(false)
const lastSnapshotId = ref<string | null>(null)

// 加载 ER 图数据
const loadERDiagram = async () => {
    const connectionId = connectionStore.activeConnectionId
    if (!connectionId) return
    await schemaStore.loadERDiagram(connectionId)
}

// 监听标签页切换
watch(activeTab, (newTab) => {
    if (newTab === 'er') {
        loadERDiagram()
    }
})

const currentResult = computed(() => queryStore.activeTab?.result)
const isExecuting = computed(() => queryStore.activeTab?.isExecuting || false)
const executionTime = computed(() => queryStore.activeTab?.executionTime)

// 当前选中的快照数量（用于决定显示"保存快照"还是"更新快照"）
const selectedSnapshotCount = computed(() => {
    const settings = queryStore.compareSettings[connectionStore.activeConnectionId || '']?.[queryStore.activeTabId || '']
    return settings?.selectedSnapshotIds?.length || 0
})

// 从 SQL 中提取表名（使用改进的解析器）
const currentTableName = computed(() => {
    const sql = queryStore.activeTab?.sql || ''
    return extractPrimaryTableName(sql)
})

// 是否可以编辑结果（单表简单查询）
const isResultEditable = computed(() => {
    const sql = queryStore.activeTab?.sql || ''
    return isEditableQuery(sql) && !!currentTableName.value
})

// 获取当前表的表结构信息
const currentTableInfo = computed(() => {
    if (!currentTableName.value) return null
    return schemaStore.getTableByName(currentTableName.value) ?? null
})

// 表结构已随连接加载，无需额外加载
// getTableByName 会从已加载的 tables 中查找

// 获取当前 Tab ID
const currentTabId = computed(() => queryStore.activeTabId)

// 记录 CRUD 操作日志
const logCrudOperation = async (
  operationType: CrudOperationType,
  tableName: string,
  sql: string,
  rowData?: Record<string, CellValue>,
  oldData?: Record<string, CellValue>
): Promise<CrudOperationLog | null> => {
  if (!connectionStore.activeConnectionId || !currentTabId.value) return null
  
  const log = crudLogService.createCrudLog(
    connectionStore.activeConnectionId,
    currentTabId.value,
    tableName,
    operationType,
    sql
  )
  
  if (rowData) {
    log.row_data = JSON.stringify(rowData)
  }
  if (oldData) {
    log.old_data = JSON.stringify(oldData)
  }
  
  const startTime = Date.now()
  try {
    await crudLogStore.addLog(log)
    log.duration_ms = Date.now() - startTime
    return log
  } catch (err) {
    console.error('Failed to log CRUD operation:', err)
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleEditRow = (row: QueryRow, _rowIndex: number) => {
    // 检查结果是否可编辑
    if (!isResultEditable.value) {
        toastStore.error(t('results.noTableName'))
        return
    }
    editingRow.value = row
    isEditDialogOpen.value = true
}

// 处理直接从表格删除行（带防抖）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleDeleteRowFromGrid = useDebounceFn(async (row: QueryRow, _rowIndex: number) => {
    if (!connectionStore.activeConnectionId || !currentTableName.value) {
        toastStore.error(t('results.noTableName'))
        return
    }

    const startTime = Date.now()
    const oldData = { ...row.values }

    try {
        // 构建条件
        const conditions: Record<string, CellValue> = {}
        const columns = currentTableInfo.value?.columns || []
        const primaryKeyColumn = columns.find(c => c.is_primary_key)

        if (primaryKeyColumn) {
            const pkValue = row.values[primaryKeyColumn.name]
            if (pkValue) {
                conditions[primaryKeyColumn.name] = pkValue
            }
        } else {
            // 没有主键，使用所有值作为条件
            Object.entries(row.values).forEach(([key, value]) => {
                conditions[key] = value
            })
        }

        // 生成 SQL 用于日志记录
        const conditionStr = Object.keys(conditions)
            .map(k => `${k} = ?`)
            .join(' AND ')
        const sql = `DELETE FROM ${currentTableName.value} WHERE ${conditionStr}`

        await crudService.deleteRow({
            connectionId: connectionStore.activeConnectionId,
            tableName: currentTableName.value,
            conditions
        })

        // 记录日志
        const duration = Date.now() - startTime
        const log = await logCrudOperation('DELETE', currentTableName.value, sql, undefined, oldData)
        if (log) {
            log.rows_affected = 1
            log.duration_ms = duration
        }

        toastStore.success(t('results.deleteSuccess'))

        // 刷新查询结果
        if (queryStore.activeTab?.sql) {
            await queryStore.executeQuery(
                connectionStore.activeConnectionId,
                queryStore.activeTab.sql,
                1000
            )
        }
    } catch (err) {
        console.error('Delete failed:', err)
        // 记录失败日志
        const sql = `DELETE FROM ${currentTableName.value} WHERE ...`
        await logCrudOperation('DELETE', currentTableName.value, sql, undefined, oldData)
        toastStore.error(t('results.deleteError'), err instanceof Error ? err.message : String(err))
    }
}, 300)

const handleSaveRow = useDebounceFn(async (data: Record<string, CellValue>) => {
    if (!connectionStore.activeConnectionId || !currentTableName.value || !editingRow.value) return

    const startTime = Date.now()
    const oldData = { ...editingRow.value.values }

    try {
        // 构建条件（使用主键或所有原始值）
        const conditions: Record<string, CellValue> = {}
        const columns = currentTableInfo.value?.columns || []
        const primaryKeyColumn = columns.find(c => c.is_primary_key)

        if (primaryKeyColumn) {
            // 使用主键作为条件
            const pkValue = editingRow.value.values[primaryKeyColumn.name]
            if (pkValue) {
                conditions[primaryKeyColumn.name] = pkValue
            }
        } else {
            // 没有主键，使用所有原始值作为条件
            Object.entries(editingRow.value.values).forEach(([key, value]) => {
                conditions[key] = value
            })
        }

        // 生成 SQL 用于日志记录
        const setClause = Object.keys(data)
            .map(k => `${k} = ?`)
            .join(', ')
        const conditionStr = Object.keys(conditions)
            .map(k => `${k} = ?`)
            .join(' AND ')
        const sql = `UPDATE ${currentTableName.value} SET ${setClause} WHERE ${conditionStr}`

        await crudService.updateRow({
            connectionId: connectionStore.activeConnectionId,
            tableName: currentTableName.value,
            data,
            conditions
        })

        // 记录日志
        const duration = Date.now() - startTime
        const log = await logCrudOperation('UPDATE', currentTableName.value, sql, data, oldData)
        if (log) {
            log.rows_affected = 1
            log.duration_ms = duration
        }

        toastStore.success(t('results.updateSuccess'))
        isEditDialogOpen.value = false
        editingRow.value = null

        // 刷新查询结果
        if (queryStore.activeTab?.sql) {
            await queryStore.executeQuery(
                connectionStore.activeConnectionId,
                queryStore.activeTab.sql,
                1000
            )
        }
    } catch (err) {
        console.error('Update failed:', err)
        // 记录失败日志
        const sql = `UPDATE ${currentTableName.value} SET ... WHERE ...`
        await logCrudOperation('UPDATE', currentTableName.value, sql, data, oldData)
        toastStore.error(t('results.updateError'), err instanceof Error ? err.message : String(err))
    }
}, 300)

const handleDeleteRow = async () => {
    if (!connectionStore.activeConnectionId || !currentTableName.value || !editingRow.value) return

    try {
        // 构建条件
        const conditions: Record<string, CellValue> = {}
        const columns = currentTableInfo.value?.columns || []
        const primaryKeyColumn = columns.find(c => c.is_primary_key)

        if (primaryKeyColumn) {
            const pkValue = editingRow.value.values[primaryKeyColumn.name]
            if (pkValue) {
                conditions[primaryKeyColumn.name] = pkValue
            }
        } else {
            Object.entries(editingRow.value.values).forEach(([key, value]) => {
                conditions[key] = value
            })
        }

        await crudService.deleteRow({
            connectionId: connectionStore.activeConnectionId,
            tableName: currentTableName.value,
            conditions
        })

        toastStore.success(t('results.deleteSuccess'))
        isEditDialogOpen.value = false
        editingRow.value = null

        // 刷新查询结果
        if (queryStore.activeTab?.sql) {
            await queryStore.executeQuery(
                connectionStore.activeConnectionId,
                queryStore.activeTab.sql,
                1000
            )
        }
    } catch (err) {
        console.error('Delete failed:', err)
        toastStore.error(t('results.deleteError'), err instanceof Error ? err.message : String(err))
    }
}

const handleExportCSV = async () => {
    loadDialogIfNeeded()
    if (!isDialogSupported() || !saveDialog) {
        toastStore.error('Not available', 'Export is only available in the desktop app or VSCode')
        return
    }
    
    if (!currentResult.value || currentResult.value.type !== 'rows') return
    if (!connectionStore.activeConnectionId) return

    const filePath = await saveDialog({
        filters: [{ name: 'CSV', extensions: ['csv'] }]
    })

    if (!filePath) return

    isExporting.value = true
    try {
        await exportService.exportToCSV({
            connectionId: connectionStore.activeConnectionId,
            sql: queryStore.activeTab?.sql || '',
            outputPath: filePath
        })
        toastStore.success(t('results.exportSuccess'), filePath.split(/[/\\]/).pop() || filePath)
    } catch (err) {
        console.error('Export failed:', err)
        toastStore.error(t('results.exportError'), err instanceof Error ? err.message : String(err))
    } finally {
        isExporting.value = false
    }
}

const handleExportJSON = async () => {
    loadDialogIfNeeded()
    if (!isDialogSupported() || !saveDialog) {
        toastStore.error('Not available', 'Export is only available in the desktop app or VSCode')
        return
    }
    
    if (!currentResult.value || currentResult.value.type !== 'rows') return
    if (!connectionStore.activeConnectionId) return

    const filePath = await saveDialog({
        filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (!filePath) return

    isExporting.value = true
    try {
        await exportService.exportToJSON({
            connectionId: connectionStore.activeConnectionId,
            sql: queryStore.activeTab?.sql || '',
            outputPath: filePath
        })
        toastStore.success(t('results.exportSuccess'), filePath.split(/[/\\]/).pop() || filePath)
    } catch (err) {
        console.error('Export failed:', err)
        toastStore.error(t('results.exportError'), err instanceof Error ? err.message : String(err))
    } finally {
        isExporting.value = false
    }
}

// 快速保存快照
const handleQuickSnapshot = async () => {
    if (!currentResult.value || currentResult.value.type !== 'rows') {
        toastStore.warning('没有可保存的查询结果')
        return
    }

    isSavingSnapshot.value = true
    try {
        const snapshot = queryStore.createSnapshot(`结果 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
        if (snapshot) {
            lastSnapshotId.value = snapshot.id
            const snapshotCount = queryStore.activeTabSnapshots.length
            toastStore.success(
                `快照已保存（共 ${snapshotCount} 个）`,
                snapshotCount >= 2 ? '点击"对比"标签可查看对比' : '继续执行查询并保存新快照来对比'
            )
        } else {
            toastStore.error('保存快照失败')
        }
    } finally {
        isSavingSnapshot.value = false
    }
}

</script>

<template>
    <div class="h-full flex flex-col bg-white dark:bg-surface-900">
        <!-- 标签页和工具栏 -->
        <div
            class="flex items-center justify-between px-3 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"
        >
            <div class="flex items-center space-x-4">
                <button
                    class="text-sm font-medium pb-2 border-b-2 transition-colors"
                    :class="
                        activeTab === 'results'
                            ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
                            : 'text-surface-500 dark:text-surface-400 border-transparent hover:text-surface-700 dark:hover:text-surface-300'
                    "
                    @click="activeTab = 'results'"
                >
                    {{ t('results.title') }}
                </button>
                <button
                    class="text-sm font-medium pb-2 border-b-2 transition-colors"
                    :class="
                        activeTab === 'messages'
                            ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
                            : 'text-surface-500 dark:text-surface-400 border-transparent hover:text-surface-700 dark:hover:text-surface-300'
                    "
                    @click="activeTab = 'messages'"
                >
                    {{ t('results.messages') }}
                </button>
                <button
                    class="text-sm font-medium pb-2 border-b-2 transition-colors"
                    :class="
                        activeTab === 'logs'
                            ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
                            : 'text-surface-500 dark:text-surface-400 border-transparent hover:text-surface-700 dark:hover:text-surface-300'
                    "
                    @click="activeTab = 'logs'"
                >
                    {{ t('results.operationLogs') }}
                </button>
                <button
                    class="text-sm font-medium pb-2 border-b-2 transition-colors"
                    :class="
                        activeTab === 'history'
                            ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
                            : 'text-surface-500 dark:text-surface-400 border-transparent hover:text-surface-700 dark:hover:text-surface-300'
                    "
                    @click="activeTab = 'history'"
                >
                    {{ t('results.queryHistory') }}
                </button>
                <button
                    class="text-sm font-medium pb-2 border-b-2 transition-colors flex items-center"
                    :class="
                        activeTab === 'compare'
                            ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
                            : 'text-surface-500 dark:text-surface-400 border-transparent hover:text-surface-700 dark:hover:text-surface-300'
                    "
                    @click="activeTab = 'compare'"
                >
                    <ArrowsRightLeftIcon class="w-3.5 h-3.5 mr-1" />
                    {{ t('results.compare') }}
                    <span 
                        v-if="queryStore.activeTabSnapshots.length > 0"
                        class="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
                    >
                        {{ queryStore.activeTabSnapshots.length }}
                    </span>
                </button>
                <button
                    class="text-sm font-medium pb-2 border-b-2 transition-colors flex items-center"
                    :class="
                        activeTab === 'er'
                            ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
                            : 'text-surface-500 dark:text-surface-400 border-transparent hover:text-surface-700 dark:hover:text-surface-300'
                    "
                    @click="activeTab = 'er'"
                >
                    <ShareIcon class="w-3.5 h-3.5 mr-1" />
                    {{ t('erDiagram.title') }}
                </button>
            </div>

            <!-- 导出按钮 -->
            <div v-if="currentResult?.type === 'rows'" class="flex items-center space-x-2">
                <!-- 快照按钮 - 未选快照时显示"创建快照"，选了快照时显示"更新快照" -->
                <button 
                    class="btn-ghost text-xs text-primary-600 dark:text-primary-400" 
                    :disabled="isSavingSnapshot"
                    :title="selectedSnapshotCount > 0 ? '将当前结果更新到选中的快照' : '保存当前结果为快照'"
                    @click="handleQuickSnapshot"
                >
                    <CameraIcon class="w-3.5 h-3.5 mr-1" />
                    {{ isSavingSnapshot ? '保存中...' : (selectedSnapshotCount > 0 ? '更新快照' : '创建快照') }}
                </button>
                <div class="w-px h-4 bg-surface-300 dark:bg-surface-600 mx-1" />
                <button class="btn-ghost text-xs" :disabled="isExporting" @click="handleExportCSV">
                    <ArrowDownTrayIcon class="w-3.5 h-3.5 mr-1" />
                    CSV
                </button>
                <button
                    class="btn-ghost text-xs"
                    :disabled="isExporting"
                    @click="handleExportJSON"
                >
                    <ArrowDownTrayIcon class="w-3.5 h-3.5 mr-1" />
                    JSON
                </button>
            </div>
        </div>

        <!-- 内容区 -->
        <div class="flex-1 overflow-hidden">
            <!-- Results Tab -->
            <template v-if="activeTab === 'results'">
                <!-- Empty State -->
                <div
                    v-if="!currentResult"
                    class="flex flex-col items-center justify-center h-full text-surface-400 dark:text-surface-500"
                >
                    <TableCellsIcon class="w-12 h-12 mb-3 opacity-50" />
                    <p class="text-sm">
                        {{ t('results.executeHint') }}
                    </p>
                    <p class="text-xs mt-1">
                        {{ t('results.shortcutHint') }}
                    </p>
                </div>

                <!-- Rows Result -->
                <ResultGrid
                    v-else-if="currentResult.type === 'rows'"
                    :columns="currentResult.columns"
                    :rows="currentResult.rows"
                    :has-more="currentResult.has_more"
                    :table-name="currentTableName"
                    :allow-edit="isResultEditable"
                    @edit-row="handleEditRow"
                    @delete-row="handleDeleteRowFromGrid"
                />

                <!-- Edit Row Dialog -->
                <EditRowDialog
                    :is-open="isEditDialogOpen"
                    :columns="currentResult?.type === 'rows' ? currentResult.columns : []"
                    :row="editingRow"
                    :table-name="currentTableName"
                    :table-info="currentTableInfo"
                    @close="isEditDialogOpen = false"
                    @save="handleSaveRow"
                    @delete="handleDeleteRow"
                />

                <!-- Execution Result -->
                <div
                    v-if="currentResult && currentResult.type === 'execution'"
                    class="flex flex-col items-center justify-center h-full"
                >
                    <CheckCircleIcon class="w-12 h-12 text-green-500 mb-3" />
                    <p class="text-lg font-medium text-surface-800 dark:text-surface-200">
                        {{ t('results.executionSuccess') }}
                    </p>
                    <div class="mt-4 space-y-2 text-sm text-surface-600 dark:text-surface-400">
                        <p>
                            {{ t('results.rowsAffected') }}:
                            <span class="font-medium">{{ currentResult.rows_affected }}</span>
                        </p>
                        <p v-if="currentResult.last_insert_id">
                            {{ t('results.lastInsertId') }}:
                            <span class="font-medium">{{ currentResult.last_insert_id }}</span>
                        </p>
                    </div>
                </div>
            </template>

            <!-- Messages Tab -->
            <ResultStatus
                v-if="activeTab === 'messages'"
                :is-executing="isExecuting"
                :execution-time="executionTime"
                :result="currentResult"
            />
            
            <!-- Operation Logs Tab -->
            <CrudLogPanel v-if="activeTab === 'logs'" />
            
            <!-- Query History Tab -->
            <QueryHistoryPanel v-if="activeTab === 'history'" />
            
            <!-- Compare Tab -->
            <ResultComparePanel v-if="activeTab === 'compare'" />
            
            <!-- ER Diagram Tab -->
            <div v-if="activeTab === 'er'" class="h-full">
                <ERDiagram
                    :diagram="schemaStore.erDiagram"
                    :loading="schemaStore.isLoading"
                    :error="schemaStore.error"
                    @refresh="loadERDiagram"
                />
            </div>
        </div>
    </div>
</template>
