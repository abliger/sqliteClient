<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import type { PreviewDDLResult } from '@types'
import { useSettingsStore } from '@stores/settings'
import * as monaco from 'monaco-editor'
import type { editor as MonacoEditor } from 'monaco-editor'

const props = defineProps<{
  preview: PreviewDDLResult | null
  isLoading: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const settingsStore = useSettingsStore()
const showCopiedToast = ref(false)
const editorContainer = ref<HTMLDivElement>()
let editor: MonacoEditor.IStandaloneCodeEditor | null = null

// Monaco 主题映射
const monacoTheme = computed(() => {
  const theme = settingsStore.theme
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs'
  }
  return theme === 'dark' ? 'vs-dark' : 'vs'
})

// 待设置的 SQL 值（用于在编辑器初始化前缓存）
const pendingSql = ref<string>('')

// 初始化 Monaco 编辑器（只读模式）
onMounted(async () => {
  if (!editorContainer.value) return

  // 等待 DOM 渲染完成，确保容器尺寸正确
  await nextTick()
  // 额外延迟确保容器可见且尺寸稳定
  await new Promise(resolve => setTimeout(resolve, 50))

  if (!editorContainer.value) return

  editor = monaco.editor.create(editorContainer.value, {
    value: pendingSql.value || props.preview?.sql || '',
    language: 'sql',
    theme: monacoTheme.value,
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    readOnly: true,
    lineNumbers: 'on',
    folding: true,
    renderWhitespace: 'none',
    contextmenu: false,
    quickSuggestions: false,
    parameterHints: { enabled: false },
    suggestOnTriggerCharacters: false,
    hover: { enabled: false },
    wordWrap: 'on',
  })
})

// 监听主题变化
watch(monacoTheme, (newTheme) => {
  monaco.editor.setTheme(newTheme)
})

// 监听 SQL 变化
watch(() => props.preview?.sql, async (sql) => {
  if (sql !== undefined) {
    if (editor) {
      editor.setValue(sql)
      // 重新布局确保正确显示
      await nextTick()
      editor.layout()
    } else {
      // 编辑器尚未初始化，缓存 SQL
      pendingSql.value = sql
    }
  }
}, { immediate: true })

// 清理
onUnmounted(() => {
  if (editor) {
    editor.dispose()
    editor = null
  }
})

async function copySQL() {
  if (!props.preview?.sql) return
  
  try {
    await navigator.clipboard.writeText(props.preview.sql)
    showCopiedToast.value = true
    setTimeout(() => showCopiedToast.value = false, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

function downloadSQL() {
  if (!props.preview?.sql) return
  
  const blob = new Blob([props.preview.sql], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ddl.sql'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 工具栏 -->
    <div class="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          :disabled="isLoading"
          @click="emit('refresh')"
        >
          <svg 
            class="h-4 w-4"
            :class="{ 'animate-spin': isLoading }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          :disabled="!preview?.sql"
          @click="copySQL"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          复制
        </button>
        <button
          class="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          :disabled="!preview?.sql"
          @click="downloadSQL"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载
        </button>
      </div>
    </div>

    <!-- SQL 内容 -->
    <div class="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-950">
      <div v-if="!preview" class="flex h-full flex-col items-center justify-center text-gray-500 dark:text-gray-400">
        <svg class="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        <p class="text-lg">点击"预览DDL"生成SQL</p>
      </div>

      <template v-else>
        <div class="h-full overflow-auto p-6">
          <!-- 警告信息 -->
          <div v-if="preview.warnings.length > 0" class="mb-4 space-y-2">
            <div
              v-for="(warning, index) in preview.warnings"
              :key="index"
              class="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
            >
              <svg class="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {{ warning }}
            </div>
          </div>

          <!-- 影响评估 -->
          <div v-if="preview.estimated_impact" class="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <h4 class="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-200">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              操作影响评估
            </h4>
            <div class="space-y-1 text-sm text-blue-800 dark:text-blue-300">
              <p v-if="preview.estimated_impact.will_recreate_table" class="flex items-center gap-2">
                <span class="h-2 w-2 rounded-full bg-orange-500"></span>
                需要重建表
              </p>
              <p v-if="preview.estimated_impact.data_loss_risk" class="flex items-center gap-2">
                <span class="h-2 w-2 rounded-full bg-red-500"></span>
                <span class="font-medium text-red-600 dark:text-red-400">⚠️ 存在数据丢失风险</span>
              </p>
              <p v-if="preview.estimated_impact.affected_rows !== undefined" class="flex items-center gap-2">
                <span class="h-2 w-2 rounded-full bg-blue-500"></span>
                预估影响行数: {{ preview.estimated_impact.affected_rows.toLocaleString() }}
              </p>
            </div>
          </div>

          <!-- SQL 代码（Monaco Editor） -->
          <div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div class="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400">生成的 SQL</span>
              <span class="text-xs text-gray-400">{{ preview.sql.length }} 字符</span>
            </div>
            <div ref="editorContainer" class="h-64 w-full" />
          </div>
        </div>
      </template>
    </div>

    <!-- 复制成功提示 -->
    <Transition name="fade">
      <div
        v-if="showCopiedToast"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-gray-900"
      >
        已复制到剪贴板
      </div>
    </Transition>
  </div>
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
