<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from '@stores/connection'
import { useSchemaStore } from '@stores/schema'
import { useQueryStore } from '@stores/query'
import { useImportStore } from '@stores/import'
import {
    ChevronRightIcon,
    ChevronDownIcon,
    TableCellsIcon,
    KeyIcon,
    LinkIcon,
    CircleStackIcon,
    PlusIcon,
    PencilIcon,
    DocumentArrowUpIcon,
    DocumentTextIcon,
} from '@heroicons/vue/24/outline'
import type { TableInfo } from '@types'
import TableDesignerDialog from '@components/designer/TableDesignerDialog.vue'
import DocExportDialog from '@components/dialogs/DocExportDialog.vue'

const { t } = useI18n()
const connectionStore = useConnectionStore()
const schemaStore = useSchemaStore()
const queryStore = useQueryStore()
const importStore = useImportStore()

// 表结构设计器状态
const showDesigner = ref(false)
const editingTable = ref<TableInfo | undefined>(undefined)
const designerConnectionId = computed(() => connectionStore.activeConnectionId || '')

// 文档导出对话框
const showDocExport = ref(false)

const handleExportDoc = () => {
    showDocExport.value = true
}

// 打开新建表设计器
const openCreateTable = () => {
    editingTable.value = undefined
    showDesigner.value = true
}

// 打开编辑表设计器
const openEditTable = (table: TableInfo) => {
    editingTable.value = table
    showDesigner.value = true
}

// 设计器操作成功回调
const onDesignerSuccess = () => {
    // 刷新表列表
    if (connectionStore.activeConnectionId) {
        schemaStore.loadTables(connectionStore.activeConnectionId)
    }
}

const handleTableClick = (table: TableInfo) => {
    schemaStore.selectedTable = table.name
}

// 双击表生成并执行查询
const handleTableDoubleClick = async (table: TableInfo) => {
    const columns = table.columns.map((c) => `"${c.name}"`).join(', ')
    const sql = `SELECT ${columns}\nFROM "${table.name}"\nLIMIT 100;`

    // 添加新 tab
    const tab = queryStore.addTab(sql)

    // 如果有活动连接，自动执行查询
    const connectionId = connectionStore.activeConnectionId
    if (connectionId && tab) {
        try {
            await queryStore.executeQuery(connectionId, sql, 1000)
        } catch (err) {
            console.error('Failed to execute query:', err)
        }
    }
}

const handleGenerateSelect = (tableName: string) => {
    const sql = `SELECT * FROM "${tableName}" LIMIT 100;`
    queryStore.addTab(sql)
}

const handleGenerateInsert = (table: TableInfo) => {
    const columns = table.columns.map((c) => `"${c.name}"`).join(', ')
    const placeholders = table.columns.map(() => '?').join(', ')
    const sql = `INSERT INTO "${table.name}" (${columns})\nVALUES (${placeholders});`
    queryStore.addTab(sql)
}

const handleOpenImport = () => {
    importStore.openWizard()
}
</script>

<template>
    <div class="h-full flex flex-col">
        <!-- 元数据信息 -->
        <div
            v-if="connectionStore.activeConnection"
            class="px-3 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"
        >
            <div class="flex items-center space-x-2 mb-1">
                <CircleStackIcon class="w-4 h-4 text-surface-500 dark:text-surface-400" />
                <span class="text-sm font-medium truncate dark:text-surface-200">
                    {{ connectionStore.activeConnection.config.name }}
                </span>
            </div>
            <div class="text-xs text-surface-500 dark:text-surface-500 space-y-0.5">
                <div>SQLite v{{ connectionStore.activeConnection.metadata.version }}</div>
                <div>
                    {{ connectionStore.activeConnection.metadata.table_count }} tables •
                    {{ (connectionStore.activeConnection.metadata.size_bytes / 1024).toFixed(1) }} KB
                </div>
            </div>
            <!-- 导入和导出按钮 -->
            <div class="mt-2 space-y-2">
                <button
                    class="w-full flex items-center justify-center space-x-1 px-2 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                    @click="handleOpenImport"
                >
                    <DocumentArrowUpIcon class="w-3.5 h-3.5" />
                    <span>{{ t('databaseTree.importData') }}</span>
                </button>
                <button
                    class="w-full flex items-center justify-center space-x-1 px-2 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-700 rounded hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                    @click="handleExportDoc"
                >
                    <DocumentTextIcon class="w-3.5 h-3.5" />
                    <span>{{ t('databaseTree.exportDoc') }}</span>
                </button>
            </div>
        </div>

        <!-- 表列表 -->
        <div class="flex-1 overflow-hidden">
            <!-- Loading -->
            <div
                v-if="schemaStore.isLoading"
                class="flex items-center justify-center h-32 text-surface-400 dark:text-surface-500"
            >
                {{ t('common.loading') }}
            </div>

            <!-- No Connection -->
            <div
                v-else-if="!connectionStore.activeConnection"
                class="flex items-center justify-center h-32 text-surface-400 dark:text-surface-500 text-sm px-4 text-center"
            >
                {{ t('databaseTree.noConnection') }}
            </div>

            <!-- No Tables -->
            <div
                v-else-if="schemaStore.tables.length === 0"
                class="flex items-center justify-center h-32 text-surface-400 dark:text-surface-500 text-sm"
            >
                {{ t('databaseTree.noTables') }}
            </div>

            <!-- Tables List -->
            <div v-else class="overflow-y-auto scrollbar-thin h-full">
                <div v-for="table in schemaStore.sortedTables" :key="table.name">
                    <!-- Table Header -->
                    <div
                        class="group flex items-center space-x-1 px-2 py-1 cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800"
                        :class="
                            schemaStore.selectedTable === table.name &&
                            'bg-primary-50 dark:bg-primary-900/20'
                        "
                        @click="handleTableClick(table)"
                        @dblclick="handleTableDoubleClick(table)"
                    >
                        <button
                            class="p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700"
                            @click.stop="schemaStore.toggleTableExpanded(table.name)"
                        >
                            <ChevronDownIcon
                                v-if="schemaStore.isTableExpanded(table.name)"
                                class="w-4 h-4 text-surface-500 dark:text-surface-400"
                            />
                            <ChevronRightIcon
                                v-else
                                class="w-4 h-4 text-surface-500 dark:text-surface-400"
                            />
                        </button>
                        <TableCellsIcon
                            class="w-4 h-4 text-surface-500 dark:text-surface-400"
                        />
                        <span class="flex-1 text-sm truncate dark:text-surface-200">
                            {{ table.name }}
                        </span>
                        <span class="text-xs text-surface-400 dark:text-surface-500">
                            {{ table.row_count?.toLocaleString() }}
                        </span>
                    </div>

                    <!-- Table Columns -->
                    <div
                        v-if="schemaStore.isTableExpanded(table.name)"
                        class="border-l-2 border-surface-200 dark:border-surface-700 ml-4 my-1"
                    >
                        <!-- Column -->
                        <div
                            v-for="column in table.columns"
                            :key="column.name"
                            class="flex items-center space-x-1 py-0.5 pl-6 text-sm"
                        >
                            <KeyIcon
                                v-if="column.is_primary_key"
                                class="w-3.5 h-3.5 text-amber-500"
                                :title="t('databaseTree.primaryKey')"
                            />
                            <LinkIcon
                                v-else-if="column.is_foreign_key"
                                class="w-3.5 h-3.5 text-blue-500"
                                :title="t('databaseTree.foreignKey')"
                            />
                            <div v-else class="w-3.5" />
                            <span
                                class="flex-1"
                                :class="
                                    column.is_primary_key
                                        ? 'font-medium text-surface-900 dark:text-surface-100'
                                        : 'text-surface-700 dark:text-surface-300'
                                "
                            >
                                {{ column.name }}
                            </span>
                            <span class="text-xs text-surface-400 dark:text-surface-500">
                                {{ column.data_type }}
                            </span>
                            <span v-if="!column.nullable" class="text-xs text-red-500">*</span>
                        </div>

                        <!-- Quick Actions -->
                        <div class="flex items-center space-x-2 pl-6 py-2">
                            <button
                                class="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                                @click="handleGenerateSelect(table.name)"
                            >
                                {{ t('databaseTree.selectQuery') }}
                            </button>
                            <button
                                class="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                                @click="handleGenerateInsert(table)"
                            >
                                {{ t('databaseTree.insertQuery') }}
                            </button>
                        </div>

                        <!-- 表结构操作 -->
                        <div class="flex items-center space-x-2 pl-6 py-1 border-t border-surface-100 dark:border-surface-800 mt-1">
                            <button
                                class="flex items-center gap-1 text-xs text-surface-600 dark:text-surface-400 hover:text-blue-600 dark:hover:text-blue-400"
                                @click="openEditTable(table)"
                            >
                                <PencilIcon class="w-3 h-3" />
                                {{ t('databaseTree.editTable') }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 新建表按钮 -->
        <div
            v-if="connectionStore.activeConnection"
            class="sticky bottom-0 bg-surface-50 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 p-2"
        >
            <button
                class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500"
                @click="openCreateTable"
            >
                <PlusIcon class="w-4 h-4" />
                {{ t('databaseTree.createTable') }}
            </button>
        </div>

        <!-- 表结构设计器 -->
        <TableDesignerDialog
            v-model="showDesigner"
            :connection-id="designerConnectionId"
            :existing-table="editingTable"
            @success="onDesignerSuccess"
        />

        <!-- 文档导出对话框 -->
        <DocExportDialog
            v-model="showDocExport"
            :database-name="connectionStore.activeConnection?.config.name || ''"
            :tables="schemaStore.tables"
        />
    </div>
</template>
