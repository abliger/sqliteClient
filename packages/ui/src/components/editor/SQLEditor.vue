<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, nextTick, computed } from 'vue'
import { useConnectionStore } from '@stores/connection'
import { useQueryStore } from '@stores/query'
import { useSchemaStore } from '@stores/schema'
import { useSQLCompletion, FullFeaturedStrategyFactory } from '@composables/sql-completion'
import EditorToolbar from './EditorToolbar.vue'
import QueryTabs from './QueryTabs.vue'
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

const connectionStore = useConnectionStore()
const queryStore = useQueryStore()
const schemaStore = useSchemaStore()
const editorContainer = ref<HTMLDivElement>()
let editor: MonacoEditor.IStandaloneCodeEditor | null = null
let disposeContentListener: (() => void) | null = null

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

// 当活动连接变化时，加载 schema 数据
watch(
  () => connectionStore.activeConnectionId,
  async (connectionId) => {
    if (connectionId) {
      await schemaStore.loadTables(connectionId)
    } else {
      schemaStore.clearSchema()
    }
  },
  { immediate: true }
)

// 初始化 Monaco 编辑器
onMounted(() => {
  if (!editorContainer.value) return

  editor = monaco.editor.create(editorContainer.value, {
    value: queryStore.activeTab?.sql || '',
    language: 'sql',
    theme: 'vs-light',
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

const handleFormat = () => {
  editor?.trigger('keyboard', 'editor.action.formatDocument', null)
}
</script>

<template>
  <div class="h-full flex flex-col bg-white">
    <!-- 查询标签页 -->
    <QueryTabs />

    <!-- 工具栏 -->
    <EditorToolbar
      :is-executing="queryStore.activeTab?.isExecuting || false"
      :can-execute="!!connectionStore.activeConnectionId"
      @execute="handleExecuteQuery"
      @execute-selected="handleExecuteSelected"
      @format="handleFormat"
    />

    <!-- 编辑器区域 -->
    <div
      ref="editorContainer"
      class="flex-1 min-h-0"
    />
  </div>
</template>
