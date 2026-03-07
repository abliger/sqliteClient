<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { open } from '@tauri-apps/plugin-dialog'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { queryService } from '@services/query'
import { useToastStore } from '@stores/toast'
import type { SqlFileExecutionResult, SqlFileExecutionProgress } from '@types'

const { t } = useI18n()
const toastStore = useToastStore()

interface Props {
  modelValue: boolean
  connectionId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  completed: [result: SqlFileExecutionResult]
}>()

const filePath = ref('')
const isExecuting = ref(false)
const progress = ref<SqlFileExecutionProgress | null>(null)
const result = ref<SqlFileExecutionResult | null>(null)
const error = ref('')

let unlistenProgress: UnlistenFn | null = null

const progressPercentage = computed(() => {
  if (!progress.value || progress.value.total_statements === 0) return 0
  return Math.round((progress.value.current_statement / progress.value.total_statements) * 100)
})

const canStart = computed(() => {
  return filePath.value && !isExecuting.value
})

const isCompleted = computed(() => {
  return result.value !== null
})

onMounted(async () => {
  // 监听执行进度事件
  unlistenProgress = await listen<SqlFileExecutionProgress>(
    'sql-file-execution-progress',
    (event) => {
      progress.value = event.payload
    }
  )
})

onUnmounted(() => {
  if (unlistenProgress) {
    unlistenProgress()
  }
})

async function selectFile() {
  try {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: 'SQL Files',
          extensions: ['sql']
        },
        {
          name: 'All Files',
          extensions: ['*']
        }
      ]
    })

    if (selected) {
      filePath.value = selected as string
      error.value = ''
    }
  } catch (err) {
    console.error('Failed to select file:', err)
    toastStore.error(t('sqlImport.selectFileError'))
  }
}

async function startImport() {
  if (!filePath.value || !props.connectionId) return

  isExecuting.value = true
  progress.value = null
  result.value = null
  error.value = ''

  try {
    const executionResult = await queryService.executeSqlFile(
      props.connectionId,
      filePath.value
    )
    result.value = executionResult
    toastStore.success(t('sqlImport.success'))
    emit('completed', executionResult)
  } catch (err: any) {
    console.error('SQL import failed:', err)
    error.value = err?.message || String(err) || t('sqlImport.error')
    toastStore.error(t('sqlImport.error'))
  } finally {
    isExecuting.value = false
  }
}

function close() {
  if (isExecuting.value) return
  emit('update:modelValue', false)
  // 重置状态
  setTimeout(() => {
    filePath.value = ''
    progress.value = null
    result.value = null
    error.value = ''
  }, 300)
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="close"
      >
        <div class="bg-white dark:bg-surface-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700">
            <h2 class="text-lg font-semibold text-surface-900 dark:text-white">
              {{ t('sqlImport.title') }}
            </h2>
            <button
              v-if="!isExecuting"
              class="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
              @click="close"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
            <!-- File Selection -->
            <div v-if="!isCompleted" class="space-y-2">
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
                {{ t('sqlImport.selectFile') }}
              </label>
              <div class="flex gap-2">
                <input
                  v-model="filePath"
                  type="text"
                  readonly
                  :placeholder="t('sqlImport.filePlaceholder')"
                  class="flex-1 px-3 py-2 text-sm border border-surface-300 dark:border-surface-600 rounded-md bg-surface-50 dark:bg-surface-700 text-surface-900 dark:text-white"
                />
                <button
                  :disabled="isExecuting"
                  class="btn-secondary whitespace-nowrap"
                  @click="selectFile"
                >
                  {{ t('sqlImport.browse') }}
                </button>
              </div>
            </div>

            <!-- Error Message -->
            <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
            </div>

            <!-- Progress -->
            <div v-if="isExecuting && progress" class="space-y-3">
              <div class="flex items-center justify-between text-sm">
                <span class="text-surface-600 dark:text-surface-400">
                  {{ t('sqlImport.executing') }}
                </span>
                <span class="font-medium text-surface-900 dark:text-white">
                  {{ progress.current_statement }} / {{ progress.total_statements }}
                </span>
              </div>

              <!-- Progress Bar -->
              <div class="h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary-500 transition-all duration-300 ease-out"
                  :style="{ width: `${progressPercentage}%` }"
                />
              </div>

              <!-- Current SQL -->
              <div class="p-3 bg-surface-100 dark:bg-surface-700/50 rounded-md">
                <p class="text-xs text-surface-500 dark:text-surface-400 mb-1">{{ t('sqlImport.currentStatement') }}</p>
                <code class="text-xs text-surface-700 dark:text-surface-300 font-mono break-all">
                  {{ progress.current_sql }}
                </code>
              </div>

              <!-- Stats -->
              <div class="flex gap-4 text-sm">
                <span class="text-green-600 dark:text-green-400">
                  {{ t('sqlImport.success') }}: {{ progress.success_count }}
                </span>
                <span v-if="progress.error_count > 0" class="text-red-600 dark:text-red-400">
                  {{ t('sqlImport.failed') }}: {{ progress.error_count }}
                </span>
              </div>
            </div>

            <!-- Result Summary -->
            <div v-if="result" class="space-y-4">
              <div class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <h3 class="font-medium text-green-800 dark:text-green-300 mb-2">
                  {{ t('sqlImport.completed') }}
                </h3>
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="text-surface-500 dark:text-surface-400">{{ t('sqlImport.totalStatements') }}:</span>
                    <span class="ml-2 font-medium text-surface-900 dark:text-white">{{ result.total_statements }}</span>
                  </div>
                  <div>
                    <span class="text-surface-500 dark:text-surface-400">{{ t('sqlImport.totalTime') }}:</span>
                    <span class="ml-2 font-medium text-surface-900 dark:text-white">{{ formatDuration(result.total_duration_ms) }}</span>
                  </div>
                  <div>
                    <span class="text-surface-500 dark:text-surface-400">{{ t('sqlImport.success') }}:</span>
                    <span class="ml-2 font-medium text-green-600 dark:text-green-400">{{ result.success_count }}</span>
                  </div>
                  <div>
                    <span class="text-surface-500 dark:text-surface-400">{{ t('sqlImport.failed') }}:</span>
                    <span class="ml-2 font-medium" :class="result.error_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-surface-900 dark:text-white'">
                      {{ result.error_count }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Statement Details -->
              <div v-if="result.statements.length > 0" class="border border-surface-200 dark:border-surface-700 rounded-md overflow-hidden">
                <div class="px-4 py-2 bg-surface-100 dark:bg-surface-700/50 border-b border-surface-200 dark:border-surface-700">
                  <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300">
                    {{ t('sqlImport.statementDetails') }}
                  </h4>
                </div>
                <div class="max-h-48 overflow-y-auto">
                  <table class="w-full text-sm">
                    <thead class="bg-surface-50 dark:bg-surface-800 sticky top-0">
                      <tr>
                        <th class="px-3 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400">#</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400">{{ t('sqlImport.status') }}</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400">{{ t('sqlImport.time') }}</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400">{{ t('sqlImport.sql') }}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-100 dark:divide-surface-700">
                      <tr
                        v-for="stmt in result.statements"
                        :key="stmt.index"
                        :class="stmt.success ? '' : 'bg-red-50/50 dark:bg-red-900/10'"
                      >
                        <td class="px-3 py-2 text-surface-600 dark:text-surface-400">{{ stmt.index }}</td>
                        <td class="px-3 py-2">
                          <span
                            :class="stmt.success
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'"
                          >
                            {{ stmt.success ? '✓' : '✗' }}
                          </span>
                        </td>
                        <td class="px-3 py-2 text-surface-600 dark:text-surface-400">{{ formatDuration(stmt.duration_ms) }}</td>
                        <td class="px-3 py-2 text-surface-700 dark:text-surface-300 font-mono truncate max-w-xs" :title="stmt.sql">
                          {{ stmt.sql }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-2 px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
            <button
              v-if="!isCompleted"
              :disabled="isExecuting"
              class="btn-ghost"
              @click="close"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              v-if="!isCompleted"
              :disabled="!canStart"
              class="btn-primary"
              @click="startImport"
            >
              <span v-if="isExecuting" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {{ t('sqlImport.importing') }}
              </span>
              <span v-else>{{ t('sqlImport.startImport') }}</span>
            </button>
            <button
              v-else
              class="btn-primary"
              @click="close"
            >
              {{ t('common.close') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
