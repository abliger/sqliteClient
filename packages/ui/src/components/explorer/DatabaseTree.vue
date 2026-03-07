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
import type { TableInfo, ColumnInfo } from '@types'

const { t } = useI18n()
const connectionStore = useConnectionStore()
const schemaStore = useSchemaStore()
const queryStore = useQueryStore()
const activeTab = ref<'tables' | 'indexes' | 'triggers' | 'er'>('tables')

const handleTableClick = (table: TableInfo) => {
  schemaStore.setSelectedTable(table.name)
}

const handleTableDoubleClick = (table: TableInfo) => {
  // 生成 SELECT 查询
  const sql = `SELECT * FROM "${table.name}" LIMIT 100;`
  queryStore.addTab(sql)
}

const handleGenerateSelect = (tableName: string) => {
  const sql = `SELECT * FROM "${tableName}" LIMIT 100;`
  queryStore.addTab(sql)
}

const handleGenerateInsert = (table: TableInfo) => {
  const columns = table.columns.map(c => `"${c.name}"`).join(', ')
  const placeholders = table.columns.map(() => '?').join(', ')
  const sql = `INSERT INTO "${table.name}" (${columns})\nVALUES (${placeholders});`
  queryStore.addTab(sql)
}

const getColumnIcon = (column: ColumnInfo) => {
  if (column.is_primary_key) return KeyIcon
  if (column.is_foreign_key) return LinkIcon
  return null
}

const tabs = computed(() => [
  { id: 'tables' as const, label: t('databaseTree.tables'), icon: TableCellsIcon },
  { id: 'er' as const, label: t('databaseTree.erDiagram'), icon: TableCellsIcon }
])
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 元数据信息 -->
    <div v-if="connectionStore.activeConnection" class="px-3 py-2 border-b border-surface-200 bg-surface-50">
      <div class="flex items-center space-x-2 mb-1">
        <CircleStackIcon class="w-4 h-4 text-surface-500" />
        <span class="text-sm font-medium truncate">{{ connectionStore.activeConnection.config.name }}</span>
      </div>
      <div class="text-xs text-surface-500 space-y-0.5">
        <div>SQLite v{{ connectionStore.activeConnection.metadata.version }}</div>
        <div>{{ connectionStore.activeConnection.metadata.table_count }} tables • {{ (connectionStore.activeConnection.metadata.size_bytes / 1024).toFixed(1) }} KB</div>
      </div>
    </div>

    <!-- 标签页 -->
    <div class="flex border-b border-surface-200">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="flex-1 flex items-center justify-center space-x-1 py-2 text-xs font-medium transition-colors"
        :class="activeTab === tab.id
          ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
          : 'text-surface-600 hover:bg-surface-100'"
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
        <div v-if="schemaStore.isLoading" class="flex items-center justify-center h-32 text-surface-400">
          {{ t('common.loading') }}
        </div>

        <!-- No Connection -->
        <div v-else-if="!connectionStore.activeConnection" class="flex items-center justify-center h-32 text-surface-400 text-sm px-4 text-center">
          {{ t('databaseTree.noConnection') }}
        </div>

        <!-- No Tables -->
        <div v-else-if="schemaStore.tables.length === 0" class="flex items-center justify-center h-32 text-surface-400 text-sm">
          {{ t('databaseTree.noTables') }}
        </div>

        <!-- Tables List -->
        <div v-else class="overflow-y-auto scrollbar-thin">
          <div
            v-for="table in schemaStore.sortedTables"
            :key="table.name"
          >
            <!-- Table Header -->
            <div
              class="group flex items-center space-x-1 px-2 py-1 cursor-pointer hover:bg-surface-100"
              :class="schemaStore.selectedTable === table.name && 'bg-primary-50'"
              @click="handleTableClick(table)"
              @dblclick="handleTableDoubleClick(table)"
            >
              <button
                class="p-0.5 rounded hover:bg-surface-200"
                @click.stop="schemaStore.toggleTableExpanded(table.name)"
              >
                <ChevronDownIcon v-if="schemaStore.isTableExpanded(table.name)" class="w-4 h-4 text-surface-500" />
                <ChevronRightIcon v-else class="w-4 h-4 text-surface-500" />
              </button>
              <TableCellsIcon class="w-4 h-4 text-surface-500" />
              <span class="flex-1 text-sm truncate">{{ table.name }}</span>
              <span class="text-xs text-surface-400">{{ table.row_count?.toLocaleString() }}</span>
            </div>

            <!-- Table Columns -->
            <div v-if="schemaStore.isTableExpanded(table.name)" class="border-l-2 border-surface-200 ml-4 my-1">
              <!-- Column -->
              <div
                v-for="column in table.columns"
                :key="column.name"
                class="flex items-center space-x-1 py-0.5 pl-6 text-sm"
              >
                <KeyIcon v-if="column.is_primary_key" class="w-3.5 h-3.5 text-amber-500" :title="t('databaseTree.primaryKey')" />
                <LinkIcon v-else-if="column.is_foreign_key" class="w-3.5 h-3.5 text-blue-500" :title="t('databaseTree.foreignKey')" />
                <div v-else class="w-3.5" />
                <span
                  class="flex-1"
                  :class="column.is_primary_key ? 'font-medium text-surface-900' : 'text-surface-700'"
                >
                  {{ column.name }}
                </span>
                <span class="text-xs text-surface-400">{{ column.data_type }}</span>
                <span v-if="!column.nullable" class="text-xs text-red-500">*</span>
              </div>
              
              <!-- Quick Actions -->
              <div class="flex items-center space-x-2 pl-6 py-2">
                <button
                  class="text-xs text-primary-600 hover:text-primary-700"
                  @click="handleGenerateSelect(table.name)"
                >
                  {{ t('databaseTree.selectQuery') }}
                </button>
                <button
                  class="text-xs text-primary-600 hover:text-primary-700"
                  @click="handleGenerateInsert(table)"
                >
                  {{ t('databaseTree.insertQuery') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ER Tab -->
      <div v-else-if="activeTab === 'er'" class="flex items-center justify-center h-full text-surface-400 text-sm">
        {{ t('databaseTree.erDiagram') }} (Coming Soon)
      </div>
    </div>
  </div>
</template>
