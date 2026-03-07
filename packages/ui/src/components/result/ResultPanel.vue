<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQueryStore } from '@stores/query'
import { useConnectionStore } from '@stores/connection'
import { exportService } from '@services/export'
import { save } from '@tauri-apps/plugin-dialog'
import ResultGrid from './ResultGrid.vue'
import ResultStatus from './ResultStatus.vue'
import { 
  ArrowDownTrayIcon, 
  TableCellsIcon,
  CheckCircleIcon
} from '@heroicons/vue/24/outline'

const queryStore = useQueryStore()
const connectionStore = useConnectionStore()
const activeTab = ref<'results' | 'messages'>('results')
const isExporting = ref(false)

const currentResult = computed(() => queryStore.activeTab?.result)
const isExecuting = computed(() => queryStore.activeTab?.isExecuting || false)
const executionTime = computed(() => queryStore.activeTab?.executionTime)

const handleExportCSV = async () => {
  if (!currentResult.value || currentResult.value.type !== 'rows') return
  if (!connectionStore.activeConnectionId) return

  const filePath = await save({
    filters: [
      { name: 'CSV', extensions: ['csv'] }
    ]
  })

  if (!filePath) return

  isExporting.value = true
  try {
    await exportService.exportToCSV({
      connectionId: connectionStore.activeConnectionId,
      sql: queryStore.activeTab?.sql || '',
      outputPath: filePath
    })
  } finally {
    isExporting.value = false
  }
}

const handleExportJSON = async () => {
  if (!currentResult.value || currentResult.value.type !== 'rows') return
  if (!connectionStore.activeConnectionId) return

  const filePath = await save({
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ]
  })

  if (!filePath) return

  isExporting.value = true
  try {
    await exportService.exportToJSON({
      connectionId: connectionStore.activeConnectionId,
      sql: queryStore.activeTab?.sql || '',
      outputPath: filePath
    })
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-white">
    <!-- 标签页和工具栏 -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-surface-200 bg-surface-50">
      <div class="flex items-center space-x-4">
        <button
          class="text-sm font-medium pb-2 border-b-2 transition-colors"
          :class="activeTab === 'results'
            ? 'text-primary-600 border-primary-600'
            : 'text-surface-500 border-transparent hover:text-surface-700'"
          @click="activeTab = 'results'"
        >
          Results
        </button>
        <button
          class="text-sm font-medium pb-2 border-b-2 transition-colors"
          :class="activeTab === 'messages'
            ? 'text-primary-600 border-primary-600'
            : 'text-surface-500 border-transparent hover:text-surface-700'"
          @click="activeTab = 'messages'"
        >
          Messages
        </button>
      </div>

      <!-- 导出按钮 -->
      <div v-if="currentResult?.type === 'rows'" class="flex items-center space-x-2">
        <button
          class="btn-ghost text-xs"
          :disabled="isExporting"
          @click="handleExportCSV"
        >
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
        <div v-if="!currentResult" class="flex flex-col items-center justify-center h-full text-surface-400">
          <TableCellsIcon class="w-12 h-12 mb-3 opacity-50" />
          <p class="text-sm">Execute a query to see results</p>
          <p class="text-xs mt-1">Press Ctrl+Enter to run</p>
        </div>

        <!-- Rows Result -->
        <ResultGrid 
          v-else-if="currentResult.type === 'rows'"
          :columns="currentResult.columns"
          :rows="currentResult.rows"
          :has-more="currentResult.has_more"
        />

        <!-- Execution Result -->
        <div v-else-if="currentResult.type === 'execution'" class="flex flex-col items-center justify-center h-full">
          <CheckCircleIcon class="w-12 h-12 text-green-500 mb-3" />
          <p class="text-lg font-medium text-surface-800">
            Query executed successfully
          </p>
          <div class="mt-4 space-y-2 text-sm text-surface-600">
            <p>Rows affected: <span class="font-medium">{{ currentResult.rows_affected }}</span></p>
            <p v-if="currentResult.last_insert_id">
              Last insert ID: <span class="font-medium">{{ currentResult.last_insert_id }}</span>
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
    </div>
  </div>
</template>
