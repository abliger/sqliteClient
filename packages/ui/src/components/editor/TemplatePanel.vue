<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTemplateStore } from '@stores/template'
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  CodeBracketIcon,
  TableCellsIcon,
  WrenchIcon,
  PuzzlePieceIcon,
  VariableIcon,
  CheckIcon,
} from '@heroicons/vue/24/outline'
import type { Snippet, SnippetCategory, SnippetType } from '@types'
import { extractVariables, fillTemplate, generateDefaultVariables } from '@services/template'

const { t } = useI18n()
const templateStore = useTemplateStore()

//  emits
const emit = defineEmits<{
  insert: [sql: string]
  close: []
}>()

// 对话框状态
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showVariableDialog = ref(false)
const editingSnippet = ref<Snippet | null>(null)
const selectedSnippet = ref<Snippet | null>(null)
const variableValues = ref<Record<string, string>>({})

// 表单数据
const formData = ref({
  name: '',
  description: '',
  sql: '',
  category: 'query' as SnippetCategory,
  tags: '',
})

// 分类图标映射
const categoryIcons: Record<SnippetCategory, typeof CodeBracketIcon> = {
  query: CodeBracketIcon,
  dml: TableCellsIcon,
  ddl: TableCellsIcon,
  function: WrenchIcon,
  other: PuzzlePieceIcon,
}

// 分类名称映射
const categoryNames: Record<SnippetCategory, string> = {
  query: t('template.category.query'),
  dml: t('template.category.dml'),
  ddl: t('template.category.ddl'),
  function: t('template.category.function'),
  other: t('template.category.other'),
}

// 类型名称映射
const typeNames: Record<SnippetType, string> = {
  builtin: t('template.type.builtin'),
  custom: t('template.type.custom'),
}

// 打开新建对话框
const openCreateDialog = () => {
  formData.value = {
    name: '',
    description: '',
    sql: '',
    category: 'query',
    tags: '',
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
  if (confirm(t('template.confirmDelete', { name: snippet.name }))) {
    templateStore.deleteSnippet(snippet.id)
  }
}

// 复制片段
const handleDuplicate = (snippet: Snippet) => {
  const tags = snippet.tags.join(', ')
  formData.value = {
    name: `${snippet.name} (${t('template.copy')})`,
    description: snippet.description || '',
    sql: snippet.sql,
    category: snippet.category,
    tags,
  }
  showCreateDialog.value = true
}

// 使用片段（处理变量）
const useSnippet = (snippet: Snippet) => {
  if (!snippet.sql) return

  try {
    // 检查是否有变量
    const vars = snippet.variables || extractVariables(snippet.sql)

    if (vars.length === 0) {
      // 没有变量，直接插入
      emit('insert', snippet.sql)
      return
    }

    // 有需要填充的变量
    selectedSnippet.value = snippet
    const defaults = generateDefaultVariables(vars)

    // 设置变量默认值
    variableValues.value = {}
    vars.forEach(v => {
      variableValues.value[v.name] = defaults[v.name] || ''
    })

    showVariableDialog.value = true
  } catch (err) {
    console.error('Failed to use snippet:', err)
    // 出错时直接插入原始 SQL
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

// 按分类分组的片段列表
const groupedSnippets = computed(() => {
  return templateStore.snippetsByCategory
})

// 监听搜索关键字
const searchInput = ref(templateStore.searchKeyword)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchInput, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    templateStore.setSearchKeyword(val)
  }, 200)
})

// 预览 SQL（处理变量高亮）
// 安全地解析 SQL 中的变量，返回可用于 v-for 渲染的片段数组
const parseSqlPreview = (sql: string): Array<{ type: 'text' | 'variable'; content: string }> => {
  const result: Array<{ type: 'text' | 'variable'; content: string }> = []
  const regex = /\{\{\s*(\w+)\s*\}\}/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(sql)) !== null) {
    // 添加变量前的文本
    if (match.index > lastIndex) {
      result.push({ type: 'text', content: sql.slice(lastIndex, match.index) })
    }
    // 添加变量（不带 {{ }}）
    result.push({ type: 'variable', content: match[1] })
    lastIndex = match.index + match[0].length
  }

  // 添加剩余文本
  if (lastIndex < sql.length) {
    result.push({ type: 'text', content: sql.slice(lastIndex) })
  }

  return result
}
</script>

<template>
  <div class="h-full flex flex-col bg-surface-50 dark:bg-surface-900">
    <!-- 头部 -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700">
      <h3 class="text-sm font-semibold text-surface-900 dark:text-surface-100">
        {{ t('template.title') }}
      </h3>
      <button
        class="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500"
        @click="emit('close')"
      >
        <XMarkIcon class="w-5 h-5" />
      </button>
    </div>

    <!-- 搜索栏 -->
    <div class="px-4 py-3 border-b border-surface-200 dark:border-surface-700 space-y-3">
      <div class="relative">
        <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          v-model="searchInput"
          type="text"
          class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          :placeholder="t('template.searchPlaceholder')"
        >
      </div>

      <!-- 过滤标签 -->
      <div class="flex flex-wrap gap-2">
        <select
          v-model="templateStore.selectedType"
          class="text-xs px-2 py-1.5 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 focus:ring-1 focus:ring-primary-500"
          @change="templateStore.setSelectedType($event.target.value as SnippetType | null)"
        >
          <option value="">{{ t('template.allTypes') }}</option>
          <option value="builtin">{{ typeNames.builtin }}</option>
          <option value="custom">{{ typeNames.custom }}</option>
        </select>

        <select
          v-model="templateStore.selectedCategory"
          class="text-xs px-2 py-1.5 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 focus:ring-1 focus:ring-primary-500"
          @change="templateStore.setSelectedCategory($event.target.value as SnippetCategory | null)"
        >
          <option value="">{{ t('template.allCategories') }}</option>
          <option v-for="cat in templateStore.categories" :key="cat.value" :value="cat.value">
            {{ cat.label }}
          </option>
        </select>

        <button
          v-if="templateStore.searchKeyword || templateStore.selectedCategory || templateStore.selectedType"
          class="text-xs px-2 py-1.5 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
          @click="templateStore.clearFilters()"
        >
          {{ t('template.clearFilters') }}
        </button>
      </div>

      <!-- 标签云 -->
      <div v-if="templateStore.allTags.length > 0 && !templateStore.searchKeyword" class="flex flex-wrap gap-1">
        <button
          v-for="tag in templateStore.allTags.slice(0, 10)"
          :key="tag"
          class="text-xs px-2 py-1 rounded-full transition-colors"
          :class="templateStore.selectedTag === tag
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
            : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'"
          @click="templateStore.setSelectedTag(templateStore.selectedTag === tag ? null : tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <!-- 新建按钮 -->
    <div class="px-4 py-2">
      <button
        class="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        @click="openCreateDialog"
      >
        <PlusIcon class="w-4 h-4 mr-1.5" />
        {{ t('template.createSnippet') }}
      </button>
    </div>

    <!-- 片段列表 -->
    <div class="flex-1 overflow-y-auto px-4 py-2 space-y-4">
      <template v-for="(snippets, category) in groupedSnippets" :key="category">
        <div v-if="snippets.length > 0">
          <h4 class="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2">
            {{ categoryNames[category as SnippetCategory] }}
            <span class="ml-1 text-surface-400">({{ snippets.length }})</span>
          </h4>
          <div class="space-y-2">
            <div
              v-for="snippet in snippets"
              :key="snippet.id"
              class="group relative p-3 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all cursor-pointer"
              @click="useSnippet(snippet)"
            >
              <div class="flex items-start justify-between mb-1">
                <div class="flex items-center min-w-0">
                  <component
                    :is="categoryIcons[snippet.category]"
                    class="w-4 h-4 mr-2 text-surface-400 flex-shrink-0"
                  />
                  <span class="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                    {{ snippet.name }}
                  </span>
                  <span
                    v-if="snippet.type === 'builtin'"
                    class="ml-2 text-xs px-1.5 py-0.5 bg-surface-100 dark:bg-surface-700 text-surface-500 rounded"
                  >
                    {{ t('template.builtin') }}
                  </span>
                </div>
                <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    v-if="snippet.type === 'custom'"
                    class="p-1 text-surface-400 hover:text-primary-500 rounded"
                    :title="t('template.edit')"
                    @click.stop="openEditDialog(snippet)"
                  >
                    <PencilIcon class="w-3.5 h-3.5" />
                  </button>
                  <button
                    class="p-1 text-surface-400 hover:text-primary-500 rounded"
                    :title="t('template.duplicate')"
                    @click.stop="handleDuplicate(snippet)"
                  >
                    <DocumentDuplicateIcon class="w-3.5 h-3.5" />
                  </button>
                  <button
                    v-if="snippet.type === 'custom'"
                    class="p-1 text-surface-400 hover:text-danger-500 rounded"
                    :title="t('template.delete')"
                    @click.stop="handleDelete(snippet)"
                  >
                    <TrashIcon class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p
                v-if="snippet.description"
                class="text-xs text-surface-500 dark:text-surface-400 mb-2 line-clamp-2"
              >
                {{ snippet.description }}
              </p>
              <pre
                class="text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-900/50 p-2 rounded overflow-hidden line-clamp-3 font-mono"
              ><code><template v-for="(part, idx) in parseSqlPreview(snippet.sql)" :key="idx"><span v-if="part.type === 'variable'" class="text-primary-500 font-medium">{{ '{' + '{' + part.content + '}' + '}' }}</span><template v-else>{{ part.content }}</template></template></code></pre>
              <div v-if="snippet.tags.length > 0" class="flex flex-wrap gap-1 mt-2">
                <span
                  v-for="tag in snippet.tags.slice(0, 3)"
                  :key="tag"
                  class="text-xs px-1.5 py-0.5 bg-surface-100 dark:bg-surface-700 text-surface-500 rounded"
                >
                  {{ tag }}
                </span>
                <span v-if="snippet.tags.length > 3" class="text-xs text-surface-400">
                  +{{ snippet.tags.length - 3 }}
                </span>
              </div>
              <div v-if="snippet.variables && snippet.variables.length > 0" class="flex items-center mt-2 text-xs text-primary-500">
                <VariableIcon class="w-3 h-3 mr-1" />
                {{ snippet.variables.length }} {{ t('template.variables') }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <div v-if="templateStore.filteredSnippets.length === 0" class="text-center py-8">
        <CodeBracketIcon class="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
        <p class="text-sm text-surface-500 dark:text-surface-400">
          {{ t('template.noSnippets') }}
        </p>
      </div>
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
            {{ showCreateDialog ? t('template.createSnippet') : t('template.editSnippet') }}
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
              {{ t('template.name') }} <span class="text-danger-500">*</span>
            </label>
            <input
              v-model="formData.name"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              :placeholder="t('template.namePlaceholder')"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              {{ t('template.description') }}
            </label>
            <input
              v-model="formData.description"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              :placeholder="t('template.descriptionPlaceholder')"
            >
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                {{ t('template.category') }} <span class="text-danger-500">*</span>
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
                {{ t('template.tags') }}
              </label>
              <input
                v-model="formData.tags"
                type="text"
                class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :placeholder="t('template.tagsPlaceholder')"
              >
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              {{ t('template.sql') }} <span class="text-danger-500">*</span>
            </label>
            <p class="text-xs text-surface-500 dark:text-surface-400 mb-2">
              {{ t('template.variablesHint') }}
            </p>
            <textarea
              v-model="formData.sql"
              rows="8"
              class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              :placeholder="t('template.sqlPlaceholder')"
            />
          </div>
        </div>
        <div class="flex justify-end items-center gap-3 px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50">
          <button
            class="px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
            @click="showCreateDialog = false; showEditDialog = false"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!formData.name || !formData.sql"
            @click="showCreateDialog ? handleCreate() : handleUpdate()"
          >
            {{ showCreateDialog ? t('common.create') : t('common.save') }}
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
            {{ t('template.fillVariables') }}
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
            {{ t('template.variablesDescription', { name: selectedSnippet.name }) }}
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
              {{ t('template.preview') }}:
            </p>
            <pre class="text-xs bg-surface-100 dark:bg-surface-900 p-3 rounded overflow-x-auto font-mono text-surface-700 dark:text-surface-300"><code>{{ fillTemplate(selectedSnippet.sql, variableValues) }}</code></pre>
          </div>
        </div>
        <div class="flex justify-end items-center gap-3 px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50">
          <button
            class="px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
            @click="showVariableDialog = false"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            @click="confirmInsert"
          >
            <CheckIcon class="w-4 h-4 inline mr-1" />
            {{ t('template.insert') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
