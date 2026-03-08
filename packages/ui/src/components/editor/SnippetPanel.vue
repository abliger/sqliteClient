<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTemplateStore } from '@stores/template'
import { useConnectionStore } from '@stores/connection'
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  CodeBracketIcon,
  PencilIcon,
  TrashIcon,
  VariableIcon,
  CheckIcon,
  GlobeAltIcon,
  CircleStackIcon,
} from '@heroicons/vue/24/outline'
import type { Snippet, SnippetCategory } from '@types'
import { extractVariables, fillTemplate, generateDefaultVariables } from '@services/template'

useI18n() // 初始化 i18n
const templateStore = useTemplateStore()
const connectionStore = useConnectionStore()

// Emits
const emit = defineEmits<{
  insert: [sql: string]
  close: []
}>()

// 状态
const searchKeyword = ref('')
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showVariableDialog = ref(false)
const editingSnippet = ref<Snippet | null>(null)
const selectedSnippet = ref<Snippet | null>(null)
const variableValues = ref<Record<string, string>>({})
const activeTab = ref<'current' | 'global'>('current')

// 表单数据
const formData = ref({
  name: '',
  description: '',
  sql: '',
  category: 'query' as SnippetCategory,
  tags: '',
  isGlobal: false,
})







// 当前连接的片段
const currentConnectionSnippets = computed(() => {
  const connId = connectionStore.activeConnectionId
  if (!connId) return []
  
  let snippets = templateStore.customSnippets.filter(s => 
    s.connection_id === connId
  )
  
  // 搜索过滤
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase().trim()
    snippets = snippets.filter(s =>
      s.name.toLowerCase().includes(keyword) ||
      s.description?.toLowerCase().includes(keyword) ||
      s.sql.toLowerCase().includes(keyword)
    )
  }
  
  return snippets
})

// 全局片段
const globalSnippets = computed(() => {
  let snippets = [
    ...templateStore.builtinSnippets,
    ...templateStore.customSnippets.filter(s => 
      !s.connection_id || s.connection_id === null
    )
  ]
  
  // 搜索过滤
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase().trim()
    snippets = snippets.filter(s =>
      s.name.toLowerCase().includes(keyword) ||
      s.description?.toLowerCase().includes(keyword) ||
      s.sql.toLowerCase().includes(keyword)
    )
  }
  
  return snippets
})

// 打开新建对话框
const openCreateDialog = (initialSql: string = '') => {
  formData.value = {
    name: '',
    description: '',
    sql: initialSql,
    category: 'query',
    tags: '',
    isGlobal: false,
  }
  showCreateDialog.value = true
}

// 打开编辑对话框
const openEditDialog = (snippet: Snippet) => {
  if (snippet.type === 'builtin') return
  editingSnippet.value = snippet
  formData.value = {
    name: snippet.name,
    description: snippet.description || '',
    sql: snippet.sql,
    category: snippet.category,
    tags: snippet.tags.join(', '),
    isGlobal: !snippet.connection_id,
  }
  showEditDialog.value = true
}

// 保存新片段
const handleCreate = () => {
  const tags = formData.value.tags
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(t => t.length > 0)

  const variables = extractVariables(formData.value.sql)

  templateStore.createSnippet({
    name: formData.value.name,
    description: formData.value.description,
    sql: formData.value.sql,
    category: formData.value.category,
    tags,
    variables,
    // 如果不是全局，则关联当前连接
    connection_id: formData.value.isGlobal ? null : connectionStore.activeConnectionId,
  })

  showCreateDialog.value = false
}

// 更新片段
const handleUpdate = () => {
  if (!editingSnippet.value) return

  const tags = formData.value.tags
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(t => t.length > 0)

  const variables = extractVariables(formData.value.sql)

  templateStore.updateSnippet({
    id: editingSnippet.value.id,
    name: formData.value.name,
    description: formData.value.description,
    sql: formData.value.sql,
    category: formData.value.category,
    tags,
    variables,
  })

  showEditDialog.value = false
  editingSnippet.value = null
}

// 删除片段
const handleDelete = (snippet: Snippet) => {
  if (snippet.type === 'builtin') return
  if (confirm(`确定要删除片段 "${snippet.name}" 吗？`)) {
    templateStore.deleteSnippet(snippet.id)
  }
}

// 使用片段
const useSnippet = (snippet: Snippet) => {
  console.log('[SnippetPanel] useSnippet called:', snippet.name, 'sql:', snippet.sql?.slice(0, 50))
  if (!snippet.sql) {
    console.warn('[SnippetPanel] Snippet has no SQL, aborting')
    return
  }

  try {
    const vars = snippet.variables || extractVariables(snippet.sql)

    if (vars.length === 0) {
      // 没有变量，直接插入
      console.log('[SnippetPanel] No variables, emitting insert event')
      emit('insert', snippet.sql)
      return
    }

    // 有需要填充的变量
    selectedSnippet.value = snippet
    const defaults = generateDefaultVariables(vars)

    variableValues.value = {}
    vars.forEach(v => {
      variableValues.value[v.name] = defaults[v.name] || ''
    })

    showVariableDialog.value = true
  } catch (err) {
    console.error('Failed to use snippet:', err)
    emit('insert', snippet.sql)
  }
}

// 确认插入（带变量）
const confirmInsert = () => {
  if (!selectedSnippet.value) return

  const filled = fillTemplate(selectedSnippet.value.sql, variableValues.value)
  emit('insert', filled)
  showVariableDialog.value = false
  selectedSnippet.value = null
}

// 高亮 SQL 预览
const parseSqlPreview = (sql: string): Array<{ type: 'text' | 'variable'; content: string }> => {
  const result: Array<{ type: 'text' | 'variable'; content: string }> = []
  const regex = /\{\{\s*(\w+)\s*\}\}/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(sql)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', content: sql.slice(lastIndex, match.index) })
    }
    result.push({ type: 'variable', content: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < sql.length) {
    result.push({ type: 'text', content: sql.slice(lastIndex) })
  }

  return result
}

// 监听连接变化，切换到当前连接的片段
watch(() => connectionStore.activeConnectionId, () => {
  templateStore.setCurrentConnectionId(connectionStore.activeConnectionId)
}, { immediate: true })

// 暴露方法给父组件
defineExpose({
  openCreateDialog,
})
</script>

<template>
  <div class="h-full flex flex-col bg-surface-50 dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700">
    <!-- 头部 -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700">
      <h3 class="text-sm font-semibold text-surface-900 dark:text-surface-100">
        代码片段
      </h3>
      <button
        class="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500"
        @click="emit('close')"
      >
        <XMarkIcon class="w-5 h-5" />
      </button>
    </div>

    <!-- Tab 切换 -->
    <div class="flex border-b border-surface-200 dark:border-surface-700">
      <button
        class="flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors"
        :class="activeTab === 'current' 
          ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
          : 'border-transparent text-surface-500 hover:text-surface-700'"
        @click="activeTab = 'current'"
      >
        <CircleStackIcon class="w-4 h-4 inline mr-1" />
        当前数据库
        <span class="ml-1 text-xs text-surface-400">({{ currentConnectionSnippets.length }})</span>
      </button>
      <button
        class="flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors"
        :class="activeTab === 'global' 
          ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
          : 'border-transparent text-surface-500 hover:text-surface-700'"
        @click="activeTab = 'global'"
      >
        <GlobeAltIcon class="w-4 h-4 inline mr-1" />
        全局片段
        <span class="ml-1 text-xs text-surface-400">({{ globalSnippets.length }})</span>
      </button>
    </div>

    <!-- 搜索栏 -->
    <div class="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
      <div class="relative">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          v-model="searchKeyword"
          type="text"
          class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="搜索代码片段..."
        >
      </div>
    </div>

    <!-- 新建按钮 -->
    <div class="px-4 py-2 border-b border-surface-200 dark:border-surface-700">
      <button
        class="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        @click="openCreateDialog()"
      >
        <PlusIcon class="w-4 h-4 mr-1.5" />
        新建片段
      </button>
    </div>

    <!-- 片段列表 -->
    <div class="flex-1 overflow-y-auto px-4 py-2 space-y-2">
      <!-- 当前数据库片段 -->
      <template v-if="activeTab === 'current'">
        <div v-if="!connectionStore.activeConnectionId" class="text-center py-8">
          <CircleStackIcon class="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
          <p class="text-sm text-surface-500">
            请先连接数据库
          </p>
        </div>
        <div v-else-if="currentConnectionSnippets.length === 0" class="text-center py-8">
          <CodeBracketIcon class="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
          <p class="text-sm text-surface-500">
            暂无当前数据库的片段
          </p>
          <p class="text-xs text-surface-400 mt-1">
            右键编辑器选中的 SQL 可添加到此处
          </p>
        </div>
        <div
          v-for="snippet in currentConnectionSnippets"
          :key="snippet.id"
          class="group p-3 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all cursor-pointer"
          @click="useSnippet(snippet)"
        >
          <div class="flex items-start justify-between mb-1">
            <span class="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
              {{ snippet.name }}
            </span>
            <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
              <button
                class="p-1 text-surface-400 hover:text-primary-500 rounded"
                title="编辑"
                @click.stop="openEditDialog(snippet)"
              >
                <PencilIcon class="w-3.5 h-3.5" />
              </button>
              <button
                class="p-1 text-surface-400 hover:text-danger-500 rounded"
                title="删除"
                @click.stop="handleDelete(snippet)"
              >
                <TrashIcon class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p v-if="snippet.description" class="text-xs text-surface-500 dark:text-surface-400 mb-2 line-clamp-1">
            {{ snippet.description }}
          </p>
          <pre class="text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-900/50 p-2 rounded overflow-hidden line-clamp-2 font-mono"><code><template v-for="(part, idx) in parseSqlPreview(snippet.sql)" :key="idx"><span v-if="part.type === 'variable'" class="text-primary-500 font-medium">{{ '{' + '{' + part.content + '}' + '}' }}</span><template v-else>{{ part.content }}</template></template></code></pre>
          <div v-if="snippet.variables?.length" class="flex items-center mt-2 text-xs text-primary-500">
            <VariableIcon class="w-3 h-3 mr-1" />
            {{ snippet.variables.length }} 个变量
          </div>
        </div>
      </template>

      <!-- 全局片段 -->
      <template v-else>
        <div
          v-for="snippet in globalSnippets"
          :key="snippet.id"
          class="group p-3 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all cursor-pointer"
          :class="snippet.type === 'builtin' ? 'bg-surface-50/50' : ''"
          @click="useSnippet(snippet)"
        >
          <div class="flex items-start justify-between mb-1">
            <div class="flex items-center min-w-0">
              <span class="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                {{ snippet.name }}
              </span>
              <span
                v-if="snippet.type === 'builtin'"
                class="ml-2 text-xs px-1.5 py-0.5 bg-surface-100 dark:bg-surface-700 text-surface-500 rounded"
              >
                内置
              </span>
            </div>
            <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
              <button
                v-if="snippet.type === 'custom'"
                class="p-1 text-surface-400 hover:text-primary-500 rounded"
                title="编辑"
                @click.stop="openEditDialog(snippet)"
              >
                <PencilIcon class="w-3.5 h-3.5" />
              </button>
              <button
                v-if="snippet.type === 'custom'"
                class="p-1 text-surface-400 hover:text-danger-500 rounded"
                title="删除"
                @click.stop="handleDelete(snippet)"
              >
                <TrashIcon class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p v-if="snippet.description" class="text-xs text-surface-500 dark:text-surface-400 mb-2 line-clamp-1">
            {{ snippet.description }}
          </p>
          <pre class="text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-900/50 p-2 rounded overflow-hidden line-clamp-2 font-mono"><code><template v-for="(part, idx) in parseSqlPreview(snippet.sql)" :key="idx"><span v-if="part.type === 'variable'" class="text-primary-500 font-medium">{{ '{' + '{' + part.content + '}' + '}' }}</span><template v-else>{{ part.content }}</template></template></code></pre>
        </div>
      </template>
    </div>

    <!-- 新建/编辑对话框 -->
    <div
      v-if="showCreateDialog || showEditDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="showCreateDialog = false; showEditDialog = false"
    >
      <div class="w-full max-w-2xl mx-4 bg-white dark:bg-surface-800 rounded-xl shadow-xl overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700">
          <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">
            {{ showCreateDialog ? '新建代码片段' : '编辑代码片段' }}
          </h3>
          <button
            class="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700"
            @click="showCreateDialog = false; showEditDialog = false"
          >
            <XMarkIcon class="w-5 h-5 text-surface-500" />
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              名称 <span class="text-danger-500">*</span>
            </label>
            <input
              v-model="formData.name"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="输入片段名称"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              描述
            </label>
            <input
              v-model="formData.description"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="输入描述（可选）"
            >
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                分类 <span class="text-danger-500">*</span>
              </label>
              <select
                v-model="formData.category"
                class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option v-for="cat in templateStore.categories" :key="cat.value" :value="cat.value">
                  {{ cat.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                标签
              </label>
              <input
                v-model="formData.tags"
                type="text"
                class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="用逗号分隔"
              >
            </div>
          </div>
          <div>
            <label class="flex items-center space-x-2 cursor-pointer">
              <input
                v-model="formData.isGlobal"
                type="checkbox"
                class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              >
              <span class="text-sm text-surface-700 dark:text-surface-300">保存为全局片段（所有数据库可见）</span>
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              SQL <span class="text-danger-500">*</span>
            </label>
            <p class="text-xs text-surface-500 dark:text-surface-400 mb-2">
              使用 {'{{'}variable{'}}'} 格式定义变量
            </p>
            <textarea
              v-model="formData.sql"
              rows="6"
              class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="输入 SQL 代码..."
            />
          </div>
        </div>
        <div class="flex justify-end items-center gap-3 px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50">
          <button
            class="px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
            @click="showCreateDialog = false; showEditDialog = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!formData.name || !formData.sql"
            @click="showCreateDialog ? handleCreate() : handleUpdate()"
          >
            {{ showCreateDialog ? '创建' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 变量填充对话框 -->
    <div
      v-if="showVariableDialog && selectedSnippet"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="showVariableDialog = false"
    >
      <div class="w-full max-w-lg mx-4 bg-white dark:bg-surface-800 rounded-xl shadow-xl overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700">
          <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">
            填充变量
          </h3>
          <button
            class="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700"
            @click="showVariableDialog = false"
          >
            <XMarkIcon class="w-5 h-5 text-surface-500" />
          </button>
        </div>
        <div class="px-6 py-4 space-y-4">
          <p class="text-sm text-surface-600 dark:text-surface-400">
            片段 "{{ selectedSnippet.name }}" 包含以下变量：
          </p>
          <div
            v-for="variable in (selectedSnippet.variables || extractVariables(selectedSnippet.sql))"
            :key="variable.name"
            class="space-y-1"
          >
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
              {{ variable.name }}
              <span v-if="variable.required" class="text-danger-500">*</span>
            </label>
            <input
              v-model="variableValues[variable.name]"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              :placeholder="variable.description || variable.default_value || ''"
            >
            <p v-if="variable.description" class="text-xs text-surface-500">
              {{ variable.description }}
            </p>
          </div>
          <div class="pt-2">
            <p class="text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">
              预览：
            </p>
            <pre class="text-xs bg-surface-100 dark:bg-surface-900 p-3 rounded overflow-x-auto font-mono text-surface-700 dark:text-surface-300"><code>{{ fillTemplate(selectedSnippet.sql, variableValues) }}</code></pre>
          </div>
        </div>
        <div class="flex justify-end items-center gap-3 px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50">
          <button
            class="px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
            @click="showVariableDialog = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            @click="confirmInsert"
          >
            <CheckIcon class="w-4 h-4 inline mr-1" />
            插入
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
