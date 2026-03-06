import { defineComponent, ref, computed } from 'vue'
import { useQueryStore } from '@stores/query'
import { useConnectionStore } from '@stores/connection'
import { exportService } from '@services/export'
import { save } from '@tauri-apps/plugin-dialog'
import ResultGrid from './ResultGrid'
import ResultStatus from './ResultStatus'
import { 
  ArrowDownTrayIcon, 
  DocumentTextIcon,
  TableCellsIcon,
  ExclamationCircleIcon,
  CheckCircleIcon
} from '@heroicons/vue/24/outline'

export default defineComponent({
  name: 'ResultPanel',
  setup() {
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

    const renderEmptyState = () => (
      <div class="flex flex-col items-center justify-center h-full text-surface-400">
        <TableCellsIcon class="w-12 h-12 mb-3 opacity-50" />
        <p class="text-sm">Execute a query to see results</p>
        <p class="text-xs mt-1">Press Ctrl+Enter to run</p>
      </div>
    )

    const renderResults = () => {
      if (!currentResult.value) {
        return renderEmptyState()
      }

      if (currentResult.value.type === 'rows') {
        return (
          <ResultGrid 
            columns={currentResult.value.columns}
            rows={currentResult.value.rows}
            hasMore={currentResult.value.has_more}
          />
        )
      }

      if (currentResult.value.type === 'execution') {
        return (
          <div class="flex flex-col items-center justify-center h-full">
            <CheckCircleIcon class="w-12 h-12 text-green-500 mb-3" />
            <p class="text-lg font-medium text-surface-800">
              Query executed successfully
            </p>
            <div class="mt-4 space-y-2 text-sm text-surface-600">
              <p>Rows affected: <span class="font-medium">{currentResult.value.rows_affected}</span></p>
              {currentResult.value.last_insert_id && (
                <p>Last insert ID: <span class="font-medium">{currentResult.value.last_insert_id}</span></p>
              )}
            </div>
          </div>
        )
      }

      return null
    }

    return () => (
      <div class="h-full flex flex-col bg-white">
        {/* 标签页和工具栏 */}
        <div class="flex items-center justify-between px-3 py-2 border-b border-surface-200 bg-surface-50">
          <div class="flex items-center space-x-4">
            <button
              class={[
                'text-sm font-medium pb-2 border-b-2 transition-colors',
                activeTab.value === 'results'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-surface-500 border-transparent hover:text-surface-700'
              ]}
              onClick={() => activeTab.value = 'results'}
            >
              Results
            </button>
            <button
              class={[
                'text-sm font-medium pb-2 border-b-2 transition-colors',
                activeTab.value === 'messages'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-surface-500 border-transparent hover:text-surface-700'
              ]}
              onClick={() => activeTab.value = 'messages'}
            >
              Messages
            </button>
          </div>

          {/* 导出按钮 */}
          {currentResult.value?.type === 'rows' && (
            <div class="flex items-center space-x-2">
              <button
                class="btn-ghost text-xs"
                onClick={handleExportCSV}
                disabled={isExporting.value}
              >
                <ArrowDownTrayIcon class="w-3.5 h-3.5 mr-1" />
                CSV
              </button>
              <button
                class="btn-ghost text-xs"
                onClick={handleExportJSON}
                disabled={isExporting.value}
              >
                <ArrowDownTrayIcon class="w-3.5 h-3.5 mr-1" />
                JSON
              </button>
            </div>
          )}
        </div>

        {/* 内容区 */}
        <div class="flex-1 overflow-hidden">
          {activeTab.value === 'results' && renderResults()}
          {activeTab.value === 'messages' && (
            <ResultStatus 
              isExecuting={isExecuting.value}
              executionTime={executionTime.value}
              result={currentResult.value}
            />
          )}
        </div>
      </div>
    )
  }
})
