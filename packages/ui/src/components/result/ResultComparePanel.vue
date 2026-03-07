<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQueryStore } from '@stores/query'
import ResultCompareGrid from './ResultCompareGrid.vue'
import { 
  CameraIcon, 
  TrashIcon, 
  PencilIcon, 
  ArrowsRightLeftIcon,
  XMarkIcon,
  CheckIcon,
  PhotoIcon
} from '@heroicons/vue/24/outline'

const { t } = useI18n()
const queryStore = useQueryStore()

// 自定义 focus 指令
const vFocus = {
  mounted: (el: HTMLElement) => el.focus()
}

// 快照列表
const snapshots = computed(() => queryStore.activeTabSnapshots)

// 对比设置
const compareSettings = computed(() => queryStore.activeTabCompareSettings)

// 是否启用对比模式
const isCompareMode = computed({
  get: () => compareSettings.value.enabled,
  set: (value) => queryStore.toggleCompareMode(value)
})

// 选中的快照ID
const selectedSnapshotIds = computed(() => compareSettings.value.selectedSnapshotIds)

// 是否可以进行对比（至少选中2个快照）
const canCompare = computed(() => selectedSnapshotIds.value.length >= 2)

// 获取选中的快照
const selectedSnapshots = computed(() => {
  return selectedSnapshotIds.value
    .map(id => snapshots.value.find(s => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
})

// 创建快照
const isCreatingSnapshot = ref(false)
const handleCreateSnapshot = async () => {
  if (isCreatingSnapshot.value) return
  isCreatingSnapshot.value = true
  try {
    const snapshot = queryStore.createSnapshot()
    if (snapshot) {
      // 自动选中新创建的快照用于对比
      if (selectedSnapshotIds.value.length < 2) {
        queryStore.toggleSnapshotSelection(snapshot.id)
      }
    }
  } finally {
    isCreatingSnapshot.value = false
  }
}

// 删除快照
const handleDeleteSnapshot = (snapshotId: string, event: Event) => {
  event.stopPropagation()
  if (confirm(t('results.compare.deleteConfirm') || '确定要删除这个快照吗？')) {
    queryStore.deleteSnapshot(snapshotId)
  }
}

// 重命名快照
const editingSnapshotId = ref<string | null>(null)
const editingName = ref('')

const startRename = (snapshot: { id: string; name: string }, event: Event) => {
  event.stopPropagation()
  editingSnapshotId.value = snapshot.id
  editingName.value = snapshot.name
}

const confirmRename = () => {
  if (editingSnapshotId.value && editingName.value.trim()) {
    queryStore.renameSnapshot(editingSnapshotId.value, editingName.value.trim())
  }
  editingSnapshotId.value = null
  editingName.value = ''
}

const cancelRename = () => {
  editingSnapshotId.value = null
  editingName.value = ''
}

// 切换快照选择
const handleToggleSelection = (snapshotId: string) => {
  queryStore.toggleSnapshotSelection(snapshotId)
}

// 格式化时间
const formatTime = (isoString: string) => {
  const date = new Date(isoString)
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}

// 格式化日期
const formatDate = (isoString: string) => {
  const date = new Date(isoString)
  return date.toLocaleDateString('zh-CN', { 
    month: 'short', 
    day: 'numeric'
  })
}

// 格式化执行时间
const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// 当前结果可以创建快照
const canCreateSnapshot = computed(() => {
  const result = queryStore.activeTab?.result
  return result && result.type === 'rows' && result.rows.length > 0
})

// 清空所有选择
const clearSelection = () => {
  queryStore.updateCompareSettings({ 
    selectedSnapshotIds: [],
    enabled: false 
  })
}
</script>

<template>
  <div class="h-full flex flex-col bg-white dark:bg-surface-900">
    <!-- 工具栏 -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
      <div class="flex items-center space-x-4">
        <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300">
          {{ t('results.compare.title') || '结果对比' }}
        </h3>
        
        <!-- 创建快照按钮 -->
        <button
          class="btn-ghost text-xs"
          :disabled="!canCreateSnapshot || isCreatingSnapshot"
          @click="handleCreateSnapshot"
        >
          <PhotoIcon class="w-3.5 h-3.5 mr-1" />
          {{ t('results.compare.snapshot') || '创建快照' }}
        </button>
      </div>

      <!-- 对比模式开关 -->
      <div class="flex items-center space-x-2">
        <span class="text-xs text-surface-500 dark:text-surface-400">
          {{ t('results.compare.mode') || '对比模式' }}
        </span>
        <button
          class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
          :class="isCompareMode ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'"
          :disabled="!canCompare"
          @click="isCompareMode = !isCompareMode"
        >
          <span
            class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
            :class="isCompareMode ? 'translate-x-5' : 'translate-x-1'"
          />
        </button>
        
        <!-- 清空选择 -->
        <button
          v-if="selectedSnapshotIds.length > 0"
          class="p-1.5 rounded-md text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700"
          title="清空选择"
          @click="clearSelection"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- 快照列表 -->
    <div 
      v-if="snapshots.length > 0"
      class="flex items-center gap-2 px-4 py-2 border-b border-surface-200 dark:border-surface-700 overflow-x-auto"
    >
      <div
        v-for="snapshot in snapshots"
        :key="snapshot.id"
        class="group flex-shrink-0 relative"
      >
        <div
          class="flex items-center space-x-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all"
          :class="[
            selectedSnapshotIds.includes(snapshot.id)
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 bg-surface-50 dark:bg-surface-800'
          ]"
          @click="handleToggleSelection(snapshot.id)"
        >
          <!-- 选中标记 -->
          <div
            class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
            :class="[
              selectedSnapshotIds.includes(snapshot.id)
                ? 'bg-primary-500 border-primary-500'
                : 'border-surface-300 dark:border-surface-600'
            ]"
          >
            <CheckIcon 
              v-if="selectedSnapshotIds.includes(snapshot.id)"
              class="w-3 h-3 text-white"
            />
          </div>

          <!-- 快照信息 -->
          <div class="flex flex-col">
            <div v-if="editingSnapshotId === snapshot.id" class="flex items-center space-x-1">
              <input
                v-model="editingName"
                v-focus
                type="text"
                class="text-xs px-1 py-0.5 border border-primary-500 rounded w-24 dark:bg-surface-800 dark:text-surface-200"
                @click.stop
                @keyup.enter="confirmRename"
                @keyup.esc="cancelRename"
              />
              <button
                class="p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                @click.stop="confirmRename"
              >
                <CheckIcon class="w-3 h-3" />
              </button>
              <button
                class="p-0.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                @click.stop="cancelRename"
              >
                <XMarkIcon class="w-3 h-3" />
              </button>
            </div>
            <template v-else>
              <span class="text-xs font-medium text-surface-700 dark:text-surface-300 truncate max-w-[120px]">
                {{ snapshot.name }}
              </span>
              <span class="text-[10px] text-surface-400">
                {{ formatDate(snapshot.createdAt) }} {{ formatTime(snapshot.createdAt) }} · {{ formatDuration(snapshot.executionTimeMs) }}
              </span>
            </template>
          </div>

          <!-- 操作按钮 -->
          <div 
            v-if="editingSnapshotId !== snapshot.id"
            class="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <button
              class="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 hover:text-surface-600"
              @click.stop="startRename(snapshot, $event)"
            >
              <PencilIcon class="w-3 h-3" />
            </button>
            <button
              class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-surface-400 hover:text-red-600"
              @click.stop="handleDeleteSnapshot(snapshot.id, $event)"
            >
              <TrashIcon class="w-3 h-3" />
            </button>
          </div>
        </div>

        <!-- 顺序标记 -->
        <div
          v-if="selectedSnapshotIds.includes(snapshot.id)"
          class="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium"
        >
          {{ selectedSnapshotIds.indexOf(snapshot.id) + 1 }}
        </div>
      </div>
    </div>

    <!-- 提示信息 -->
    <div 
      v-else
      class="flex items-center justify-center py-4 text-sm text-surface-400 dark:text-surface-500 border-b border-surface-200 dark:border-surface-700"
    >
      <CameraIcon class="w-4 h-4 mr-2" />
      {{ t('results.compare.noSnapshots') || '暂无快照，执行查询后创建快照以进行对比' }}
    </div>

    <!-- 对比内容区 -->
    <div class="flex-1 overflow-hidden">
      <template v-if="isCompareMode && canCompare">
        <ResultCompareGrid
          :base-snapshot="selectedSnapshots[0]"
          :compare-snapshot="selectedSnapshots[1]"
          :highlight-diff="compareSettings.highlightDiff"
        />
      </template>
      
      <template v-else-if="selectedSnapshotIds.length === 1">
        <!-- 只选中一个快照时显示预览 -->
        <div class="h-full flex flex-col">
          <div class="px-4 py-2 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
            <span class="text-xs text-surface-500">
              {{ t('results.compare.preview') || '快照预览' }}: {{ selectedSnapshots[0]?.name }}
            </span>
          </div>
          <div class="flex-1 overflow-auto p-4">
            <table class="w-full border-collapse">
              <thead class="sticky top-0 bg-surface-100 dark:bg-surface-800">
                <tr>
                  <th 
                    v-for="col in selectedSnapshots[0]?.result.columns" 
                    :key="col"
                    class="px-3 py-2 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 border-b border-r border-surface-200 dark:border-surface-700"
                  >
                    {{ col }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="(row, rowIndex) in selectedSnapshots[0]?.result.rows.slice(0, 100)" 
                  :key="rowIndex"
                  class="border-b border-surface-200 dark:border-surface-700"
                >
                  <td 
                    v-for="col in selectedSnapshots[0]?.result.columns" 
                    :key="col"
                    class="px-3 py-2 text-sm text-surface-700 dark:text-surface-300 border-r border-surface-200 dark:border-surface-700"
                  >
                    {{ row.values[col]?.type === 'Null' ? 'NULL' : row.values[col]?.value }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
      
      <template v-else>
        <!-- 空状态 -->
        <div class="h-full flex flex-col items-center justify-center text-surface-400 dark:text-surface-500">
          <ArrowsRightLeftIcon class="w-12 h-12 mb-3 opacity-50" />
          <p class="text-sm">
            {{ t('results.compare.selectTwo') || '请选择两个快照进行对比' }}
          </p>
          <p class="text-xs mt-1 max-w-[300px] text-center">
            {{ t('results.compare.selectHint') || '点击快照卡片选择，最多选择两个快照' }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.btn-ghost {
  @apply inline-flex items-center px-2 py-1 rounded-md text-surface-600 dark:text-surface-400 
         hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed
         transition-colors;
}
</style>
