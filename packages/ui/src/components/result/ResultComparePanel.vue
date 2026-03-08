<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQueryStore } from '@stores/query'
import ResultCompareGrid from './ResultCompareGrid.vue'
import { 
  TrashIcon, 
  ArrowsRightLeftIcon,
  XMarkIcon,
  CheckIcon,
  PhotoIcon,
  LightBulbIcon,
  ArrowRightIcon,
  PencilIcon
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

// 当前步骤
const currentStep = computed(() => {
  if (snapshots.value.length === 0) return 1 // 需要创建第一个快照
  if (snapshots.value.length === 1) return 2 // 需要创建第二个快照
  if (selectedSnapshotIds.value.length < 2) return 3 // 需要选择两个快照
  return 4 // 可以对比
})

// 删除快照
const isDeleting = ref<string | null>(null)
const snapshotToDelete = ref<string | null>(null)
const showDeleteConfirm = ref(false)

const handleDeleteSnapshot = (snapshotId: string, event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  
  // 防止重复触发
  if (isDeleting.value === snapshotId) {
    console.log('[Snapshot] Already deleting:', snapshotId)
    return
  }
  
  // 使用自定义确认对话框（避免 Tauri WebView 中 confirm 被阻止的问题）
  snapshotToDelete.value = snapshotId
  showDeleteConfirm.value = true
}

const confirmDelete = () => {
  if (snapshotToDelete.value) {
    console.log('[Snapshot] Confirmed delete:', snapshotToDelete.value)
    isDeleting.value = snapshotToDelete.value
    try {
      queryStore.deleteSnapshot(snapshotToDelete.value)
    } finally {
      isDeleting.value = null
      showDeleteConfirm.value = false
      snapshotToDelete.value = null
    }
  }
}

const cancelDelete = () => {
  console.log('[Snapshot] Cancelled delete')
  showDeleteConfirm.value = false
  snapshotToDelete.value = null
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

// 创建快照加载状态
const isCreatingSnapshot = ref(false)

// 当前结果可以创建快照
const canCreateSnapshot = computed(() => {
  const result = queryStore.activeTab?.result
  return result && result.type === 'rows' && result.rows.length > 0
})

// 快捷创建并选中对比
const handleQuickCompare = async () => {
  if (!canCreateSnapshot.value) return
  
  isCreatingSnapshot.value = true
  try {
    const snapshot = queryStore.createSnapshot()
    if (snapshot) {
      // 如果只有一个已选中的快照，自动选中新快照形成对比
      if (selectedSnapshotIds.value.length === 1) {
        queryStore.toggleSnapshotSelection(snapshot.id)
      } else if (selectedSnapshotIds.value.length === 0 && snapshots.value.length >= 2) {
        // 如果没有选中的，自动选中最近两个
        const recentSnapshots = [...snapshots.value].slice(-2)
        queryStore.updateCompareSettings({
          selectedSnapshotIds: recentSnapshots.map(s => s.id),
          enabled: true
        })
      } else if (selectedSnapshotIds.value.length < 2) {
        queryStore.toggleSnapshotSelection(snapshot.id)
      }
    }
  } finally {
    isCreatingSnapshot.value = false
  }
}

// 清空所有选择
const clearSelection = () => {
  queryStore.updateCompareSettings({ 
    selectedSnapshotIds: [],
    enabled: false 
  })
}

// 监听快照数量变化，自动进入对比模式
watch(() => snapshots.value.length, (newCount, oldCount) => {
  if (newCount >= 2 && oldCount < 2 && selectedSnapshotIds.value.length >= 2) {
    // 自动开启对比模式
    isCompareMode.value = true
  }
})
</script>

<template>
  <div class="h-full flex flex-col bg-white dark:bg-surface-900">
    <!-- 工具栏 -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
      <div class="flex items-center space-x-4">
        <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300">
          {{ t('results.compare.title') || '结果对比' }}
        </h3>
        
        <!-- 快捷创建快照按钮 -->
        <button
          v-if="canCreateSnapshot"
          class="btn-primary text-xs"
          :disabled="isCreatingSnapshot"
          :title="snapshots.length >= 2 ? '创建快照并加入对比' : '创建快照'"
          @click="handleQuickCompare"
        >
          <PhotoIcon class="w-3.5 h-3.5 mr-1" />
          {{ isCreatingSnapshot ? '保存中...' : (snapshots.length >= 2 ? '快照对比' : '创建快照') }}
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
              class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-surface-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="isDeleting === snapshot.id"
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

    <!-- 对比内容区 -->
    <div class="flex-1 overflow-hidden relative">
      <!-- 步骤引导面板 -->
      <div 
        v-if="currentStep < 4"
        class="absolute inset-0 flex items-center justify-center bg-surface-50/80 dark:bg-surface-900/80 backdrop-blur-sm z-10"
      >
        <div class="max-w-md w-full mx-4 bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-surface-200 dark:border-surface-700 p-6">
          <h4 class="text-lg font-semibold text-surface-800 dark:text-surface-200 mb-4 flex items-center">
            <LightBulbIcon class="w-5 h-5 mr-2 text-amber-500" />
            {{ t('results.compare.guideTitle') || '快照对比使用指南' }}
          </h4>
          
          <div class="space-y-3">
            <!-- 步骤1 -->
            <div 
              class="flex items-start space-x-3 p-3 rounded-lg transition-colors"
              :class="currentStep === 1 ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800' : 'bg-surface-50 dark:bg-surface-800/50'"
            >
              <div 
                class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                :class="currentStep > 1 ? 'bg-green-500 text-white' : (currentStep === 1 ? 'bg-primary-500 text-white' : 'bg-surface-300 dark:bg-surface-600 text-surface-600 dark:text-surface-400')"
              >
                <CheckIcon v-if="currentStep > 1" class="w-4 h-4" />
                <span v-else>1</span>
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium" :class="currentStep === 1 ? 'text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-300'">
                  {{ t('results.compare.step1Title') || '保存第一个快照' }}
                </p>
                <p class="text-xs text-surface-500 mt-0.5">
                  {{ t('results.compare.step1Desc') || '在结果页执行查询，然后点击"保存快照"按钮' }}
                </p>
              </div>
            </div>

            <!-- 步骤2 -->
            <div 
              class="flex items-start space-x-3 p-3 rounded-lg transition-colors"
              :class="currentStep === 2 ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800' : 'bg-surface-50 dark:bg-surface-800/50'"
            >
              <div 
                class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                :class="currentStep > 2 ? 'bg-green-500 text-white' : (currentStep === 2 ? 'bg-primary-500 text-white' : 'bg-surface-300 dark:bg-surface-600 text-surface-600 dark:text-surface-400')"
              >
                <CheckIcon v-if="currentStep > 2" class="w-4 h-4" />
                <span v-else>2</span>
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium" :class="currentStep === 2 ? 'text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-300'">
                  {{ t('results.compare.step2Title') || '保存第二个快照' }}
                </p>
                <p class="text-xs text-surface-500 mt-0.5">
                  {{ t('results.compare.step2Desc') || '修改查询条件或数据，执行后再保存一个快照' }}
                </p>
              </div>
            </div>

            <!-- 步骤3 -->
            <div 
              class="flex items-start space-x-3 p-3 rounded-lg transition-colors"
              :class="currentStep === 3 ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800' : 'bg-surface-50 dark:bg-surface-800/50'"
            >
              <div 
                class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                :class="currentStep >= 3 ? 'bg-primary-500 text-white' : 'bg-surface-300 dark:bg-surface-600 text-surface-600 dark:text-surface-400'"
              >
                <span>3</span>
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium" :class="currentStep === 3 ? 'text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-300'">
                  {{ t('results.compare.step3Title') || '选择并对比' }}
                </p>
                <p class="text-xs text-surface-500 mt-0.5">
                  {{ t('results.compare.step3Desc') || '点击上方快照卡片选择两个，开含对比模式' }}
                </p>
              </div>
            </div>
          </div>

          <!-- 快捷操作 -->
          <div v-if="currentStep <= 2 && canCreateSnapshot" class="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
            <button
              class="w-full btn-primary justify-center"
              :disabled="isCreatingSnapshot"
              @click="handleQuickCompare"
            >
              <PhotoIcon class="w-4 h-4 mr-2" />
              {{ isCreatingSnapshot ? '保存中...' : (currentStep === 1 ? '立即保存快照' : '保存第二个快照') }}
              <ArrowRightIcon v-if="!isCreatingSnapshot" class="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      </div>

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
          <div class="px-4 py-2 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
            <span class="text-xs text-surface-500">
              {{ t('results.compare.preview') || '快照预览' }}: {{ selectedSnapshots[0]?.name }}
            </span>
            <span class="text-xs text-surface-400">
              {{ t('results.compare.selectAnother') || '请选择另一个快照进行对比' }}
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

    <!-- 删除确认对话框 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showDeleteConfirm"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          @click.self="cancelDelete"
        >
          <div class="bg-white dark:bg-surface-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <div class="flex items-center mb-4">
              <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-3">
                <TrashIcon class="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 class="text-lg font-semibold text-surface-800 dark:text-surface-200">
                {{ t('results.compare.deleteConfirmTitle') || '删除快照' }}
              </h3>
            </div>
            <p class="text-sm text-surface-600 dark:text-surface-400 mb-6">
              {{ t('results.compare.deleteConfirm') || '确定要删除这个快照吗？此操作不可撤销。' }}
            </p>
            <div class="flex justify-end space-x-3">
              <button
                class="px-4 py-2 rounded-lg text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                @click="cancelDelete"
              >
                {{ t('common.cancel') || '取消' }}
              </button>
              <button
                class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                :disabled="!!isDeleting"
                @click="confirmDelete"
              >
                {{ isDeleting ? t('common.deleting') || '删除中...' : t('common.delete') || '删除' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.btn-ghost {
  @apply inline-flex items-center px-2 py-1 rounded-md text-surface-600 dark:text-surface-400 
         hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed
         transition-colors;
}

.btn-primary {
  @apply inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium
         bg-primary-500 text-white hover:bg-primary-600 
         disabled:opacity-50 disabled:cursor-not-allowed
         transition-colors shadow-sm;
}
</style>
