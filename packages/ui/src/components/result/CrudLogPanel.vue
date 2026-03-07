<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCrudLogStore } from '@stores/crudLog'
import { useConnectionStore } from '@stores/connection'
import { useQueryStore } from '@stores/query'
import { 
  ClockIcon, 
  TableCellsIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline'
import type { CrudOperationLog, CrudOperationType } from '@types'

const { t } = useI18n()
const crudLogStore = useCrudLogStore()
const connectionStore = useConnectionStore()
const queryStore = useQueryStore()

// 筛选条件
const filterTabId = ref<string>('')
const filterTableName = ref<string>('')
const filterOperationType = ref<CrudOperationType | ''>('')
const showFilters = ref(false)

// 详情弹窗
const selectedLog = ref<CrudOperationLog | null>(null)
const isDetailOpen = ref(false)

// 统计信息
const stats = computed(() => crudLogStore.stats)

// 日志列表
const logs = computed(() => {
  let result = crudLogStore.logs
  
  // 按 Tab 筛选
  if (filterTabId.value) {
    result = result.filter(log => log.tab_id === filterTabId.value)
  }
  
  // 按表名筛选
  if (filterTableName.value) {
    result = result.filter(log => log.table_name === filterTableName.value)
  }
  
  // 按操作类型筛选
  if (filterOperationType.value) {
    result = result.filter(log => log.operation_type === filterOperationType.value)
  }
  
  return result
})

// 可用的表名列表
const tableNames = computed(() => crudLogStore.tableNames)

// 当前连接的 Tab 列表
const availableTabs = computed(() => {
  const connectionId = connectionStore.activeConnectionId
  if (!connectionId) return []
  return queryStore.getTabsByConnection(connectionId)
})

// 操作类型选项
const operationTypes: { value: CrudOperationType; label: string; color: string }[] = [
  { value: 'INSERT', label: t('crudLog.insert'), color: 'text-green-600 dark:text-green-400' },
  { value: 'UPDATE', label: t('crudLog.update'), color: 'text-blue-600 dark:text-blue-400' },
  { value: 'DELETE', label: t('crudLog.delete'), color: 'text-red-600 dark:text-red-400' }
]

// 获取操作类型图标
const getOperationIcon = (type: CrudOperationType) => {
  switch (type) {
    case 'INSERT': return PlusIcon
    case 'UPDATE': return PencilIcon
    case 'DELETE': return TrashIcon
    default: return ClockIcon
  }
}

// 获取操作类型样式
const getOperationStyle = (type: CrudOperationType) => {
  switch (type) {
    case 'INSERT': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
    case 'UPDATE': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
    case 'DELETE': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
    default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
  }
}

// 格式化时间
const formatTime = (isoString: string) => {
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 格式化日期（用于分组）
const formatDate = (isoString: string) => {
  const date = new Date(isoString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (date.toDateString() === today.toDateString()) {
    return t('crudLog.today')
  } else if (date.toDateString() === yesterday.toDateString()) {
    return t('crudLog.yesterday')
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  }
}

// 按日期分组的日志
const groupedLogs = computed(() => {
  const groups = new Map<string, CrudOperationLog[]>()
  
  logs.value.forEach(log => {
    const dateKey = formatDate(log.executed_at)
    const existing = groups.get(dateKey) || []
    existing.push(log)
    groups.set(dateKey, existing)
  })
  
  return groups
})

// 加载日志
const loadLogs = async () => {
  await crudLogStore.loadLogs(connectionStore.activeConnectionId || undefined, 200)
  await crudLogStore.loadTableNames()
  if (connectionStore.activeConnectionId) {
    await crudLogStore.loadStats(connectionStore.activeConnectionId)
  }
}

// 查看详情
const viewDetail = (log: CrudOperationLog) => {
  selectedLog.value = log
  isDetailOpen.value = true
}

// 关闭详情
const closeDetail = () => {
  selectedLog.value = null
  isDetailOpen.value = false
}

// 清空筛选
const clearFilters = () => {
  filterTabId.value = ''
  filterTableName.value = ''
  filterOperationType.value = ''
}

// 格式化 JSON 数据
const formatJson = (jsonStr?: string) => {
  if (!jsonStr) return ''
  try {
    const obj = JSON.parse(jsonStr)
    return JSON.stringify(obj, null, 2)
  } catch {
    return jsonStr
  }
}

// 监听连接变化，重新加载日志
watch(() => connectionStore.activeConnectionId, () => {
  loadLogs()
})

onMounted(() => {
  loadLogs()
})
</script>

<template>
  <div class="h-full flex flex-col bg-white dark:bg-surface-900">
    <!-- 头部工具栏 -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
      <div class="flex items-center space-x-3">
        <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300">
          {{ t('crudLog.title') }}
        </h3>
        
        <!-- 统计信息 -->
        <div v-if="stats" class="flex items-center space-x-2 text-xs">
          <span class="px-2 py-0.5 rounded-full bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-400">
            {{ t('crudLog.total') }}: {{ stats.total }}
          </span>
          <span class="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
            {{ t('crudLog.success') }}: {{ stats.success }}
          </span>
          <span v-if="stats.failed > 0" class="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            {{ t('crudLog.failed') }}: {{ stats.failed }}
          </span>
        </div>
      </div>
      
      <div class="flex items-center space-x-2">
        <!-- 筛选按钮 -->
        <button 
          class="btn-ghost text-xs"
          :class="{ 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': showFilters }"
          @click="showFilters = !showFilters"
        >
          <FunnelIcon class="w-3.5 h-3.5 mr-1" />
          {{ t('crudLog.filter') }}
        </button>
        
        <!-- 刷新按钮 -->
        <button class="btn-ghost text-xs" @click="loadLogs">
          <ArrowPathIcon class="w-3.5 h-3.5 mr-1" :class="{ 'animate-spin': crudLogStore.isLoading }" />
          {{ t('crudLog.refresh') }}
        </button>
      </div>
    </div>
    
    <!-- 筛选面板 -->
    <div v-if="showFilters" class="px-3 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-800/50">
      <div class="flex items-center space-x-3">
        <!-- 按 Tab 筛选 -->
        <select 
          v-model="filterTabId" 
          class="text-xs px-2 py-1 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300"
        >
          <option value="">{{ t('crudLog.allTabs') }}</option>
          <option v-for="tab in availableTabs" :key="tab.id" :value="tab.id">
            {{ tab.name }}
          </option>
        </select>
        
        <!-- 按表名筛选 -->
        <select 
          v-model="filterTableName" 
          class="text-xs px-2 py-1 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300"
        >
          <option value="">{{ t('crudLog.allTables') }}</option>
          <option v-for="name in tableNames" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
        
        <!-- 按操作类型筛选 -->
        <select 
          v-model="filterOperationType" 
          class="text-xs px-2 py-1 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300"
        >
          <option value="">{{ t('crudLog.allOperations') }}</option>
          <option v-for="op in operationTypes" :key="op.value" :value="op.value">
            {{ op.label }}
          </option>
        </select>
        
        <!-- 清空筛选 -->
        <button 
          v-if="filterTabId || filterTableName || filterOperationType"
          class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          @click="clearFilters"
        >
          {{ t('crudLog.clearFilter') }}
        </button>
      </div>
    </div>
    
    <!-- 日志列表 -->
    <div class="flex-1 overflow-y-auto">
      <!-- 空状态 -->
      <div v-if="logs.length === 0" class="flex flex-col items-center justify-center h-full text-surface-400 dark:text-surface-500">
        <ClockIcon class="w-12 h-12 mb-3 opacity-50" />
        <p class="text-sm">{{ t('crudLog.empty') }}</p>
        <p class="text-xs mt-1">{{ t('crudLog.emptyHint') }}</p>
      </div>
      
      <!-- 分组列表 -->
      <div v-else class="divide-y divide-surface-100 dark:divide-surface-800">
        <div v-for="[date, dateLogs] in groupedLogs" :key="date" class="py-2">
          <!-- 日期标题 -->
          <div class="px-3 py-1 text-xs font-medium text-surface-500 dark:text-surface-400 bg-surface-50 dark:bg-surface-800/50 sticky top-0">
            {{ date }}
          </div>
          
          <!-- 日志项 -->
          <div 
            v-for="log in dateLogs" 
            :key="log.id"
            class="px-3 py-2 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors"
            @click="viewDetail(log)"
          >
            <div class="flex items-start space-x-3">
              <!-- 操作类型图标 -->
              <div 
                class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                :class="getOperationStyle(log.operation_type)"
              >
                <component :is="getOperationIcon(log.operation_type)" class="w-3.5 h-3.5" />
              </div>
              
              <!-- 日志内容 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2">
                  <span class="text-sm font-medium text-surface-700 dark:text-surface-300">
                    {{ log.operation_type }}
                  </span>
                  <TableCellsIcon class="w-3 h-3 text-surface-400" />
                  <span class="text-sm text-surface-600 dark:text-surface-400">
                    {{ log.table_name }}
                  </span>
                  
                  <!-- 成功/失败标识 -->
                  <CheckCircleIcon v-if="log.is_success" class="w-3.5 h-3.5 text-green-500" />
                  <XCircleIcon v-else class="w-3.5 h-3.5 text-red-500" />
                </div>
                
                <div class="mt-0.5 text-xs text-surface-500 dark:text-surface-500 truncate">
                  {{ log.sql }}
                </div>
                
                <div class="mt-1 flex items-center space-x-3 text-xs text-surface-400">
                  <span>{{ formatTime(log.executed_at) }}</span>
                  <span v-if="log.rows_affected > 0">
                    {{ t('crudLog.rowsAffected') }}: {{ log.rows_affected }}
                  </span>
                  <span v-if="log.duration_ms > 0">
                    {{ log.duration_ms }}ms
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 详情弹窗 -->
    <div 
      v-if="isDetailOpen && selectedLog" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="closeDetail"
    >
      <div class="w-full max-w-2xl max-h-[80vh] bg-white dark:bg-surface-800 rounded-lg shadow-xl flex flex-col">
        <!-- 弹窗头部 -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700">
          <div class="flex items-center space-x-2">
            <component 
              :is="getOperationIcon(selectedLog.operation_type)" 
              class="w-4 h-4"
              :class="operationTypes.find(o => o.value === selectedLog?.operation_type)?.color || 'text-surface-500'"
            />
            <h4 class="text-sm font-medium text-surface-800 dark:text-surface-200">
              {{ selectedLog.operation_type }} - {{ selectedLog.table_name }}
            </h4>
          </div>
          <button class="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300" @click="closeDetail">
            <span class="sr-only">{{ t('common.close') }}</span>
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- 弹窗内容 -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- 基本信息 -->
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-surface-500 dark:text-surface-400">{{ t('crudLog.tableName') }}:</span>
              <span class="ml-1 text-surface-700 dark:text-surface-300">{{ selectedLog.table_name }}</span>
            </div>
            <div>
              <span class="text-surface-500 dark:text-surface-400">{{ t('crudLog.executedAt') }}:</span>
              <span class="ml-1 text-surface-700 dark:text-surface-300">{{ formatTime(selectedLog.executed_at) }}</span>
            </div>
            <div>
              <span class="text-surface-500 dark:text-surface-400">{{ t('crudLog.status') }}:</span>
              <span 
                class="ml-1"
                :class="selectedLog.is_success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
              >
                {{ selectedLog.is_success ? t('crudLog.success') : t('crudLog.failed') }}
              </span>
            </div>
            <div>
              <span class="text-surface-500 dark:text-surface-400">{{ t('crudLog.duration') }}:</span>
              <span class="ml-1 text-surface-700 dark:text-surface-300">{{ selectedLog.duration_ms }}ms</span>
            </div>
            <div v-if="selectedLog.rows_affected > 0">
              <span class="text-surface-500 dark:text-surface-400">{{ t('crudLog.rowsAffected') }}:</span>
              <span class="ml-1 text-surface-700 dark:text-surface-300">{{ selectedLog.rows_affected }}</span>
            </div>
          </div>
          
          <!-- 执行的 SQL -->
          <div>
            <label class="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase">{{ t('crudLog.sql') }}</label>
            <pre class="mt-1 p-3 bg-surface-100 dark:bg-surface-900 rounded text-xs text-surface-700 dark:text-surface-300 overflow-x-auto">{{ selectedLog.sql }}</pre>
          </div>
          
          <!-- 新数据 (INSERT/UPDATE) -->
          <div v-if="selectedLog.row_data">
            <label class="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase">{{ t('crudLog.newData') }}</label>
            <pre class="mt-1 p-3 bg-surface-100 dark:bg-surface-900 rounded text-xs text-surface-700 dark:text-surface-300 overflow-x-auto">{{ formatJson(selectedLog.row_data) }}</pre>
          </div>
          
          <!-- 旧数据 (UPDATE/DELETE) -->
          <div v-if="selectedLog.old_data">
            <label class="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase">{{ t('crudLog.oldData') }}</label>
            <pre class="mt-1 p-3 bg-surface-100 dark:bg-surface-900 rounded text-xs text-surface-700 dark:text-surface-300 overflow-x-auto">{{ formatJson(selectedLog.old_data) }}</pre>
          </div>
          
          <!-- 错误信息 -->
          <div v-if="selectedLog.error_message">
            <label class="text-xs font-medium text-red-500 uppercase">{{ t('crudLog.error') }}</label>
            <pre class="mt-1 p-3 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-700 dark:text-red-300 overflow-x-auto">{{ selectedLog.error_message }}</pre>
          </div>
        </div>
        
        <!-- 弹窗底部 -->
        <div class="px-4 py-3 border-t border-surface-200 dark:border-surface-700 flex justify-end">
          <button class="btn-secondary text-xs" @click="closeDetail">
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
