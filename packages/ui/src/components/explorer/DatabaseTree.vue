<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from '@stores/connection'
import { useSchemaStore } from '@stores/schema'
import { useQueryStore } from '@stores/query'
import {
    ChevronRightIcon,
    ChevronDownIcon,
    TableCellsIcon,
    KeyIcon,
    LinkIcon,
    CircleStackIcon
} from '@heroicons/vue/24/outline'
import type { TableInfo } from '@types'

const { t } = useI18n()
const connectionStore = useConnectionStore()
const schemaStore = useSchemaStore()
const queryStore = useQueryStore()

const activeTab = ref<'tables' | 'er'>('tables')

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

// const _unusedGetColumnIcon = (column: ColumnInfo) => {
//   if (column.is_primary_key) return KeyIcon
//   if (column.is_foreign_key) return LinkIcon
//   return null
// }

const tabs = computed(() => [
    { id: 'tables' as const, label: t('databaseTree.tables'), icon: TableCellsIcon },
    { id: 'er' as const, label: t('databaseTree.erDiagram'), icon: TableCellsIcon }
])
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
        </div>

        <!-- 标签页 -->
        <div class="flex border-b border-surface-200 dark:border-surface-700">
            <button
                v-for="tab in tabs"
                :key="tab.id"
                class="flex-1 flex items-center justify-center space-x-1 py-2 text-xs font-medium transition-colors"
                :class="
                    activeTab === tab.id
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                "
                @click="activeTab = tab.id"
            >
                <component :is="tab.icon" class="w-4 h-4" />
                <span>{{ tab.label }}</span>
            </button>
        </div>

        <!-- 内容区 -->
        <div class="flex-1 overflow-hidden">
            <!-- Tables Tab -->
            <template v-if="activeTab === 'tables'">
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
                <div v-else class="overflow-y-auto scrollbar-thin">
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
                        </div>
                    </div>
                </div>
            </template>

            <!-- ER Diagram Tab -->
            <template v-else>
                <div class="flex items-center justify-center h-32 text-surface-400 text-sm">
                    ER Diagram (Coming Soon)
                </div>
            </template>
        </div>
    </div>
</template>
