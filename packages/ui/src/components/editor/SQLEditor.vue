<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useConnectionStore } from '@stores/connection'
import { useQueryStore } from '@stores/query'
import EditorToolbar from './EditorToolbar.vue'
import QueryTabs from './QueryTabs.vue'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// 配置 Monaco Worker
self.MonacoEnvironment = {
  getWorker(_: any, label: string) {
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

const connectionStore = useConnectionStore()
const queryStore = useQueryStore()
const editorContainer = ref<HTMLDivElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

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
  editor.onDidChangeModelContent(() => {
    const value = editor?.getValue() || ''
    if (queryStore.activeTab) {
      queryStore.updateTabSql(queryStore.activeTab.id, value)
    }
  })

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
  (newTabId) => {
    if (!editor || !newTabId) return
    const tab = queryStore.tabs.find(t => t.id === newTabId)
    if (tab) {
      const currentValue = editor.getValue()
      if (currentValue !== tab.sql) {
        editor.setValue(tab.sql)
      }
    }
  }
)

const handleExecuteQuery = async () => {
  if (!editor || !connectionStore.activeConnectionId) return

  const sql = editor.getValue()
  if (!sql.trim()) return

  try {
    await queryStore.executeQuery(connectionStore.activeConnectionId, sql, 1000)
  } catch (err) {
    console.error('Query execution failed:', err)
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
    <EditorToolbar :is-executing="queryStore.activeTab?.isExecuting || false"
      :can-execute="!!connectionStore.activeConnectionId" @execute="handleExecuteQuery"
      @execute-selected="handleExecuteSelected" @format="handleFormat" />

    <!-- 编辑器区域 -->
    <div ref="editorContainer" class="flex-1 min-h-0" />
  </div>
</template>
