<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHistoryStore } from '@stores/history'
import { useConnectionStore } from '@stores/connection'
import { useQueryStore } from '@stores/query'
import { useToastStore } from '@stores/toast'
import { formatDistanceToNow } from '@/utils/date'
import {
  PlayIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TableCellsIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

const { t } = useI18n()
const historyStore = useHistoryStore()
const connectionStore = useConnectionStore()
const queryStore = useQueryStore()
const toastStore = useToastStore()

const searchQuery = ref('')
const isRefreshing = ref(false)

// 监听搜索输入，防抖搜索
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (newQuery) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    if (newQuery.trim()) {
      historyStore.searchHistory(newQuery)
    } else {
      historyStore.loadHistory()
    }
  }, 300)
})

// 加载历史记录
onMounted(() => {
  historyStore.loadHistory()
})

// 格式化日期
const formatTime = (dateStr: string) => {
  try {
    return formatDistanceToNow(new Date(dateStr))
  } catch {
    return dateStr
  }
}

// 格式化执行时间
const formatDuration = (ms: number) => {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

// 重新执行 SQL
const handleReExecute = async (sql: string) => {
  if (!connectionStore.activeConnectionId) {
    toastStore.error(t('history.noConnection'))
    return
  }

  try {
    // 设置编辑器内容并执行
    await queryStore.executeQuery(connectionStore.activeConnectionId, sql, 1000)
    toastStore.success(t('history.reExecuteSuccess'))
  } catch (err) {
    console.error('Re-execute failed:', err)
    toastStore.error(t('history.reExecuteError'), err instanceof Error ? err.message : String(err))
  }
}

// 删除历史记录项
const handleDelete = async (id: string) => {
  try {
    await historyStore.deleteHistoryItem(id)
    toastStore.success(t('history.deleteSuccess'))
  } catch (err) {
    toastStore.error(t('history.deleteError'), err instanceof Error ? err.message : String(err))
  }
}

// 清空历史记录
const handleClearAll = async () => {
  if (!confirm(t('history.confirmClear'))) return

  try {
    await historyStore.clearHistory()
    toastStore.success(t('history.clearSuccess'))
  } catch (err) {
    toastStore.error(t('history.clearError'), err instanceof Error ? err.message : String(err))
  }
}

// 刷新历史记录
const handleRefresh = async () => {
  isRefreshing.value = true
  try {
    await historyStore.loadHistory()
  } finally {
    isRefreshing.value = false
  }
}

// 清空搜索
const clearSearch = () => {
  searchQuery.value = ''
  historyStore.loadHistory()
}

// 分页控制
const handlePrevPage = () => {
  historyStore.setPage(historyStore.currentPage - 1)
}

const handleNextPage = () => {
  historyStore.setPage(historyStore.currentPage + 1)
}

// 获取行数显示文本
const getRowCountText = (item: typeof historyStore.filteredItems[0]) => {
  if (!item.is_success) return '-'
  if (item.row_count === undefined || item.row_count === null) return '-'
  return item.row_count.toLocaleString()
}
</script>

<template>
  <div class="h-full flex flex-col bg-white dark:bg-surface-900">
    <!-- 工具栏 -->
    <div
      class="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"
    >
      <!-- 搜索框 -->
      <div class="relative flex-1 max-w-md">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('history.searchPlaceholder')"
          class="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          v-if="searchQuery"
          class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700"
          @click="clearSearch"
        >
          <XMarkIcon class="w-3.5 h-3.5 text-surface-400" />
        </button>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center space-x-2 ml-4">
        <button
          class="btn-ghost text-xs"
          :class="{ 'opacity-50 cursor-not-allowed': isRefreshing }"
          :disabled="isRefreshing"
          @click="handleRefresh"
        >
          <ArrowPathIcon
            class="w-3.5 h-3.5 mr-1"
            :class="{ 'animate-spin': isRefreshing }"
          />
          {{ t('common.refresh') }}
        </button>
        <button
          v-if="historyStore.items.length > 0"
          class="btn-ghost text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
          @click="handleClearAll"
        >
          <TrashIcon class="w-3.5 h-3.5 mr-1" />
          {{ t('history.clearAll') }}
        </button>
      </div>
    </div>

    <!-- 历史记录列表 -->
    <div class="flex-1 overflow-auto">
      <!-- 加载中 -->
      <div v-if="historyStore.isLoading" class="flex items-center justify-center h-full">
        <div class="flex items-center space-x-2 text-surface-400">
          <div class="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span class="text-sm">{{ t('common.loading') }}</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-else-if="historyStore.filteredItems.length === 0"
        class="flex flex-col items-center justify-center h-full text-surface-400 dark:text-surface-500"
      >
        <ClockIcon class="w-12 h-12 mb-3 opacity-50" />
        <p class="text-sm">{{ searchQuery ? t('history.noSearchResults') : t('history.empty') }}</p>
        <p v-if="!searchQuery" class="text-xs mt-1">
          {{ t('history.emptyHint') }}
        </p>
      </div>

      <!-- 历史记录表格 -->
      <table v-else class="w-full text-sm">
        <thead class="sticky top-0 bg-surface-50 dark:bg-surface-800 z-10">
          <tr class="border-b border-surface-200 dark:border-surface-700">
            <th class="px-4 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400 w-24">
              {{ t('history.status') }}
            </th>
            <th class="px-4 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400">
              {{ t('history.sql') }}
            </th>
            <th class="px-4 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400 w-28">
              {{ t('history.duration') }}
            </th>
            <th class="px-4 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400 w-24">
              {{ t('history.rowCount') }}
            </th>
            <th class="px-4 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400 w-36">
              {{ t('history.executedAt') }}
            </th>
            <th class="px-4 py-2 text-center text-xs font-medium text-surface-500 dark:text-surface-400 w-24">
              {{ t('history.actions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in historyStore.paginatedItems"
            :key="item.id"
            class="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
          >
            <!-- 状态 -->
            <td class="px-4 py-2.5">
              <div class="flex items-center space-x-1.5">
                <CheckCircleIcon
                  v-if="item.is_success"
                  class="w-4 h-4 text-green-500"
                />
                <XCircleIcon
                  v-else
                  class="w-4 h-4 text-red-500"
                  :title="item.error_message"
                />
                <span
                  class="text-xs"
                  :class="item.is_success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                >
                  {{ item.is_success ? t('history.success') : t('history.failed') }}
                </span>
              </div>
            </td>

            <!-- SQL 预览 -->
            <td class="px-4 py-2.5">
              <code
                class="block font-mono text-xs text-surface-700 dark:text-surface-300 truncate max-w-md"
                :title="item.sql"
              >
                {{ item.sql }}
              </code>
            </td>

            <!-- 执行时间 -->
            <td class="px-4 py-2.5">
              <div class="flex items-center space-x-1 text-xs text-surface-600 dark:text-surface-400">
                <ClockIcon class="w-3.5 h-3.5" />
                <span>{{ formatDuration(item.duration_ms) }}</span>
              </div>
            </td>

            <!-- 行数 -->
            <td class="px-4 py-2.5">
              <div class="flex items-center space-x-1 text-xs text-surface-600 dark:text-surface-400">
                <TableCellsIcon class="w-3.5 h-3.5" />
                <span>{{ getRowCountText(item) }}</span>
              </div>
            </td>

            <!-- 执行时间 -->
            <td class="px-4 py-2.5 text-xs text-surface-500 dark:text-surface-400">
              {{ formatTime(item.executed_at) }}
            </td>

            <!-- 操作按钮 -->
            <td class="px-4 py-2.5">
              <div class="flex items-center justify-center space-x-1">
                <button
                  class="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-primary-600 dark:text-primary-400"
                  :disabled="!connectionStore.activeConnectionId"
                  :title="t('history.reExecute')"
                  @click="handleReExecute(item.sql)"
                >
                  <PlayIcon class="w-4 h-4" />
                </button>
                <button
                  class="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-red-500 dark:text-red-400"
                  :title="t('common.delete')"
                  @click="handleDelete(item.id)"
                >
                  <TrashIcon class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div
      v-if="historyStore.totalPages > 1"
      class="flex items-center justify-between px-4 py-2 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"
    >
      <div class="text-xs text-surface-500 dark:text-surface-400">
        {{ t('history.total') }}: {{ historyStore.filteredItems.length }}
      </div>
      <div class="flex items-center space-x-2">
        <button
          class="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-50"
          :disabled="historyStore.currentPage <= 1"
          @click="handlePrevPage"
        >
          <ChevronLeftIcon class="w-4 h-4" />
        </button>
        <span class="text-xs text-surface-600 dark:text-surface-400">
          {{ historyStore.currentPage }} / {{ historyStore.totalPages }}
        </span>
        <button
          class="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-50"
          :disabled="historyStore.currentPage >= historyStore.totalPages"
          @click="handleNextPage"
        >
          <ChevronRightIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
