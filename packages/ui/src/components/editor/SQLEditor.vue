<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from '@stores/connection'
import { useQueryStore } from '@stores/query'
import { useSchemaStore } from '@stores/schema'
import { useSettingsStore } from '@stores/settings'
import { useTemplateStore } from '@stores/template'
import { useSQLCompletion, FullFeaturedStrategyFactory } from '@composables/sql-completion'
import { sqlFormatter } from '@services/formatter'
import EditorToolbar from './EditorToolbar.vue'
import QueryTabs from './QueryTabs.vue'
import SqlImportDialog from '@components/dialogs/SqlImportDialog.vue'
import SnippetPanel from './SnippetPanel.vue'
import * as monaco from 'monaco-editor'
import type { editor as MonacoEditor } from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// 配置 Monaco Worker - 使用全局变量避免重复配置
interface WindowWithMonaco extends Window {
    MonacoEnvironment?: {
        getWorker: (_workerId: string, label: string) => Worker;
    }
}

if (!(window as WindowWithMonaco).MonacoEnvironment) {
  (window as WindowWithMonaco).MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (label === 'json') {
        return new jsonWorker()
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssWorker()
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlWorker()
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker()
      }
      return new editorWorker()
    }
  }
}

const { t, locale } = useI18n()
const connectionStore = useConnectionStore()
const queryStore = useQueryStore()
const schemaStore = useSchemaStore()
const settingsStore = useSettingsStore()
const templateStore = useTemplateStore()
const editorContainer = ref<HTMLDivElement>()
let editor: MonacoEditor.IStandaloneCodeEditor | null = null
let disposeContentListener: (() => void) | null = null

// SQL 导入对话框状态
const showImportDialog = ref(false)

// 代码片段面板状态
const showSnippetPanel = ref(false)
const snippetPanelRef = ref<InstanceType<typeof SnippetPanel> | null>(null)

// 左侧面板（数据库列表）显示状态
const props = defineProps<{
    isSidebarVisible?: boolean
}>()

const emit = defineEmits<{
    'toggle-sidebar': []
}>()

// 当前选中的 SQL（用于添加到片段）
const selectedSqlForSnippet = ref('')

function handleImportSql() {
  if (!connectionStore.activeConnectionId) return
  showImportDialog.value = true
}

function handleImportCompleted(result: import('@types').SqlFileExecutionResult) {
  void result // Result unused but kept for potential future use
  // 导入完成后可以刷新 schema
  if (connectionStore.activeConnectionId) {
    schemaStore.loadTables(connectionStore.activeConnectionId)
  }
}

// Monaco 主题映射
const monacoTheme = computed(() => {
  const theme = settingsStore.theme
  if (theme === 'auto') {
    // 检测系统偏好
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs'
  }
  return theme === 'dark' ? 'vs-dark' : 'vs'
})

// 获取表信息的 getter
const getTableByName = computed(() => {
  return (name: string) => schemaStore.getTableByName(name)
})

// 注册 SQL 智能提示
const { dispose: disposeCompletion } = useSQLCompletion({
  tables: schemaStore.tables,
  getTableByName: (name: string) => getTableByName.value(name),
  strategyFactory: new FullFeaturedStrategyFactory(),
  config: {
    enableKeywords: true,
    enableFunctions: true,
    enableTables: true,
    enableColumns: true
  }
})

// 当活动连接变化时，更新模板 store 的当前连接
watch(
  () => connectionStore.activeConnectionId,
  (connectionId) => {
    templateStore.setCurrentConnectionId(connectionId)
  },
  { immediate: true }
)

// 监听主题变化，更新编辑器主题
watch(
  monacoTheme,
  (newTheme) => {
    monaco.editor.setTheme(newTheme)
  }
)

// 初始化 Monaco 编辑器
onMounted(() => {
  if (!editorContainer.value) return

  editor = monaco.editor.create(editorContainer.value, {
    value: queryStore.activeTab?.sql || '',
    language: 'sql',
    theme: monacoTheme.value,
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    lineNumbers: 'on',
    folding: true,
    renderWhitespace: 'selection',
    suggest: {
      showKeywords: true,
      showSnippets: true,
    }
  })

  // 监听内容变化
  const contentListener = editor.onDidChangeModelContent(() => {
    const value = editor?.getValue() || ''
    if (queryStore.activeTab) {
      queryStore.updateTabSql(queryStore.activeTab.id, value)
    }
  })
  disposeContentListener = () => contentListener.dispose()

  // 添加快捷键
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    handleExecuteQuery()
  })

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
    editor?.trigger('keyboard', 'editor.action.commentLine', null)
  })

  // 注册 SQL 格式化器
  registerSQLFormatter()

  // 添加右键菜单
  const addToSnippetActionId = 'add-to-snippet'
  const registerAddToSnippetAction = () => {
    // 先移除已存在的同名 action
    const existingAction = editor?.getAction(addToSnippetActionId)
    if (existingAction) {
      // Monaco Editor 没有直接移除 action 的方法，我们通过重新添加来覆盖
    }
    editor?.addAction({
      id: addToSnippetActionId,
      label: t('editor.addToSnippet'),
      keybindings: [],
      contextMenuGroupId: '9_cutcopypaste',
      contextMenuOrder: 3,
      run: () => {
        handleAddToSnippet()
      }
    })
  }
  registerAddToSnippetAction()

  // 监听系统主题变化（当设置为 auto 时）
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleThemeChange = () => {
    if (settingsStore.theme === 'auto') {
      monaco.editor.setTheme(monacoTheme.value)
    }
  }
  mediaQuery.addEventListener('change', handleThemeChange)

  // 监听语言变化，更新右键菜单
  const unwatchLocale = watch(locale, () => {
    registerAddToSnippetAction()
  })

  // 保存清理函数
  const originalDispose = disposeContentListener
  disposeContentListener = () => {
    originalDispose?.()
    mediaQuery.removeEventListener('change', handleThemeChange)
    unwatchLocale()
  }
})

// 当活动标签变化时，更新编辑器内容
watch(
  () => queryStore.activeTabId,
  (newTabId, oldTabId) => {
    if (!editor || !newTabId) return

    // 保存旧标签的状态
    if (oldTabId) {
      const oldState = editor.saveViewState()
      if (oldState) {
        queryStore.saveEditorState(oldTabId, editor.getValue(), {
          line: oldState.cursorState[0]?.position?.lineNumber || 1,
          column: oldState.cursorState[0]?.position?.column || 1
        })
      }
    }

    // 加载新标签的内容和状态
    const tab = queryStore.tabs.find(t => t.id === newTabId)
    if (tab) {
      const currentValue = editor.getValue()
      if (currentValue !== tab.sql) {
        editor.setValue(tab.sql)
      }

      // 恢复光标位置
      const savedState = queryStore.getEditorState(newTabId)
      if (savedState?.cursorPosition) {
        nextTick(() => {
          editor?.setPosition({
            lineNumber: savedState.cursorPosition!.line,
            column: savedState.cursorPosition!.column
          })
          editor?.revealLineInCenter(savedState.cursorPosition!.line)
        })
      }
    }
  }
)

// 清理函数
onUnmounted(() => {
  if (disposeContentListener) {
    disposeContentListener()
    disposeContentListener = null
  }
  if (editor) {
    // 保存最终状态
    const currentTabId = queryStore.activeTabId
    if (currentTabId) {
      const state = editor.saveViewState()
      queryStore.saveEditorState(currentTabId, editor.getValue(), state ? {
        line: state.cursorState[0]?.position?.lineNumber || 1,
        column: state.cursorState[0]?.position?.column || 1
      } : undefined)
    }
    editor.dispose()
    editor = null
  }
  // 清理 SQL 补全
  disposeCompletion()
})

const handleExecuteQuery = async () => {
  if (!editor || !connectionStore.activeConnectionId) return

  const sql = editor.getValue()
  if (!sql.trim()) return

  try {
    await queryStore.executeQuery(connectionStore.activeConnectionId, sql, 1000)
  } catch (err) {
    console.error('Query execution failed:', err)
    // 错误处理已在 store 中，这里可以添加额外的 UI 反馈
  }
}

const handleExecuteSelected = async () => {
  if (!editor || !connectionStore.activeConnectionId) return

  const selection = editor.getSelection()
  let sql: string

  if (selection && !selection.isEmpty()) {
    sql = editor.getModel()?.getValueInRange(selection) || ''
  } else {
    sql = editor.getValue()
  }

  if (!sql.trim()) return

  try {
    await queryStore.executeQuery(connectionStore.activeConnectionId, sql, 1000)
  } catch (err) {
    console.error('Query execution failed:', err)
  }
}

/**
 * 注册 SQL 格式化器到 Monaco Editor
 */
const registerSQLFormatter = () => {
  // 注册文档格式化提供者
  monaco.languages.registerDocumentFormattingEditProvider('sql', {
    provideDocumentFormattingEdits(model) {
      const sql = model.getValue()
      if (!sqlFormatter.canFormat(sql)) {
        return []
      }

      const formatted = sqlFormatter.format(sql)
      return [
        {
          range: model.getFullModelRange(),
          text: formatted,
        },
      ]
    },
  })

  // 注册选区格式化提供者
  monaco.languages.registerDocumentRangeFormattingEditProvider('sql', {
    provideDocumentRangeFormattingEdits(model, range) {
      const sql = model.getValueInRange(range)
      if (!sqlFormatter.canFormat(sql)) {
        return []
      }

      const formatted = sqlFormatter.format(sql)
      return [
        {
          range: range,
          text: formatted,
        },
      ]
    },
  })
}

const handleFormat = () => {
  editor?.trigger('keyboard', 'editor.action.formatDocument', null)
}

// 切换代码片段面板
const handleToggleTemplates = () => {
  showSnippetPanel.value = !showSnippetPanel.value
}

// 将选中的 SQL 添加到代码片段
const handleAddToSnippet = () => {
  if (!editor) return
  
  const selection = editor.getSelection()
  let sql = ''
  
  if (selection && !selection.isEmpty()) {
    sql = editor.getModel()?.getValueInRange(selection) || ''
  } else {
    sql = editor.getValue()
  }
  
  if (!sql.trim()) return
  
  selectedSqlForSnippet.value = sql
  showSnippetPanel.value = true
  
  // 等待面板打开后调用创建对话框
  nextTick(() => {
    snippetPanelRef.value?.openCreateDialog(sql)
  })
}

// 插入 SQL 片段
const handleInsertSnippet = (sql: string) => {
  if (!editor) return

  const selection = editor.getSelection()
  if (selection && !selection.isEmpty()) {
    editor.executeEdits('snippet', [{
      range: selection,
      text: sql,
    }])
  } else {
    const position = editor.getPosition()
    if (position) {
      editor.executeEdits('snippet', [{
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        text: sql,
      }])
    }
  }

  editor.focus()
}

// 处理代码片段插入并关闭面板
const handleSnippetInsert = (sql: string) => {
  handleInsertSnippet(sql)
  showSnippetPanel.value = false
}
</script>

<template>
    <div class="h-full flex flex-col bg-white dark:bg-surface-900">
        <!-- 查询标签页 -->
        <QueryTabs />

        <!-- 工具栏 -->
        <EditorToolbar
            :is-executing="queryStore.activeTab?.isExecuting || false"
            :can-execute="!!connectionStore.activeConnectionId"
            :is-sidebar-visible="props.isSidebarVisible"
            @execute="handleExecuteQuery"
            @execute-selected="handleExecuteSelected"
            @format="handleFormat"
            @import-sql="handleImportSql"
            @toggle-templates="handleToggleTemplates"
            @toggle-sidebar="emit('toggle-sidebar')"
        />

        <!-- SQL 导入对话框 -->
        <SqlImportDialog
            v-model="showImportDialog"
            :connection-id="connectionStore.activeConnectionId || ''"
            @completed="handleImportCompleted"
        />

        <!-- 编辑器区域 -->
        <div class="flex-1 min-h-0 flex">
          <div ref="editorContainer" class="flex-1 min-h-0" />

          <!-- 代码片段面板 -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-x-4"
            enter-to-class="opacity-100 translate-x-0"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 translate-x-0"
            leave-to-class="opacity-0 translate-x-4"
          >
            <div
              v-if="showSnippetPanel"
              class="w-80 border-l border-surface-200 dark:border-surface-700 flex-shrink-0"
            >
              <SnippetPanel
                ref="snippetPanelRef"
                @insert="handleSnippetInsert"
                @close="showSnippetPanel = false"
              />
            </div>
          </Transition>
        </div>
    </div>
</template>
