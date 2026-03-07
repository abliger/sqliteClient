<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type {
  DesignerTable,
  DesignerColumn,
  DesignerIndex,
  TableChange,
  PreviewDDLResult,
  DDLExecutionResult,
  TableInfo,
} from '@types'
import { schemaService } from '@services/schema'
import { useToastStore } from '@stores/toast'
import ColumnEditor from './ColumnEditor.vue'
import IndexEditor from './IndexEditor.vue'
import DDLPreview from './DDLPreview.vue'

const props = defineProps<{
  modelValue: boolean
  connectionId: string
  existingTable?: TableInfo // 如果提供，则为编辑模式
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const toastStore = useToastStore()

// ============================================
// 状态
// ============================================

const activeTab = ref<'columns' | 'indexes' | 'ddl'>('columns')
const isLoading = ref(false)
const isExecuting = ref(false)
const previewResult = ref<PreviewDDLResult | null>(null)

// 数据类型列表
const dataTypes = ref<string[]>([])
const foreignKeyActions = ref<string[]>([])

// 表单数据
const tableForm = ref<DesignerTable>({
  name: '',
  columns: [],
  indexes: [],
  primary_key: undefined,
  comment: undefined,
  strict_mode: false,
})

// 编辑模式
const isEditMode = computed(() => !!props.existingTable)

// 获取所有表名（用于外键引用）
const availableTables = ref<string[]>([])

// ============================================
// 初始化
// ============================================

onMounted(async () => {
  // 加载数据类型和外键动作
  const [types, actions] = await Promise.all([
    schemaService.getDataTypes(),
    schemaService.getForeignKeyActions(),
  ])
  dataTypes.value = types
  foreignKeyActions.value = actions

  // 加载可用表名
  const tables = await schemaService.listTables(props.connectionId)
  availableTables.value = tables.map(t => t.name)

  // 如果是编辑模式，加载现有表结构
  if (props.existingTable) {
    loadExistingTable(props.existingTable)
  } else {
    // 新建模式，添加默认ID列
    addDefaultColumn()
  }
})

watch(() => props.existingTable, (table) => {
  if (table) {
    loadExistingTable(table)
  }
}, { immediate: true })

function loadExistingTable(table: TableInfo) {
  tableForm.value = {
    name: table.name,
    columns: table.columns.map(col => ({
      id: generateId(),
      name: col.name,
      data_type: normalizeDataType(col.data_type),
      nullable: col.nullable,
      default_value: col.default_value,
      is_primary_key: col.is_primary_key,
      is_unique: false, // 需要从索引推断
      is_auto_increment: false, // 需要从SQL解析
      comment: undefined,
      is_foreign_key: col.is_foreign_key,
      foreign_key: col.foreign_key ? {
        ref_table: col.foreign_key.to_table,
        ref_column: col.foreign_key.to_column,
        on_update: col.foreign_key.on_update as any,
        on_delete: col.foreign_key.on_delete as any,
      } : undefined,
    })),
    indexes: [], // 需要单独加载
    primary_key: table.columns.filter(c => c.is_primary_key).map(c => c.name),
    strict_mode: false,
  }
}

function normalizeDataType(type: string): any {
  const upper = type.toUpperCase()
  const validTypes = ['INTEGER', 'REAL', 'TEXT', 'BLOB', 'NUMERIC', 'BOOLEAN', 
    'DATETIME', 'DATE', 'TIME', 'VARCHAR', 'CHAR', 'DECIMAL', 'FLOAT', 
    'DOUBLE', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT']
  return validTypes.includes(upper) ? upper : 'TEXT'
}

function addDefaultColumn() {
  tableForm.value.columns.push({
    id: generateId(),
    name: 'id',
    data_type: 'INTEGER',
    nullable: false,
    default_value: undefined,
    is_primary_key: true,
    is_unique: false,
    is_auto_increment: true,
    comment: undefined,
    is_foreign_key: false,
    foreign_key: undefined,
  })
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

// ============================================
// 列操作
// ============================================

function addColumn() {
  tableForm.value.columns.push({
    id: generateId(),
    name: '',
    data_type: 'TEXT',
    nullable: true,
    default_value: undefined,
    is_primary_key: false,
    is_unique: false,
    is_auto_increment: false,
    comment: undefined,
    is_foreign_key: false,
    foreign_key: undefined,
  })
}

function removeColumn(index: number) {
  tableForm.value.columns.splice(index, 1)
}

function moveColumn(index: number, direction: 'up' | 'down') {
  const cols = tableForm.value.columns
  if (direction === 'up' && index > 0) {
    ;[cols[index], cols[index - 1]] = [cols[index - 1], cols[index]]
  } else if (direction === 'down' && index < cols.length - 1) {
    ;[cols[index], cols[index + 1]] = [cols[index + 1], cols[index]]
  }
}

// ============================================
// 索引操作
// ============================================

function addIndex() {
  const indexName = `idx_${tableForm.value.name}_${tableForm.value.indexes.length + 1}`
  tableForm.value.indexes.push({
    id: generateId(),
    name: indexName,
    unique: false,
    columns: [],
    where_clause: undefined,
  })
}

function removeIndex(index: number) {
  tableForm.value.indexes.splice(index, 1)
}

// ============================================
// DDL预览和执行
// ============================================

async function previewDDL() {
  if (!validateForm()) return

  isLoading.value = true
  try {
    if (isEditMode.value && props.existingTable) {
      // 编辑模式：生成变更
      const changes = generateChanges()
      previewResult.value = await schemaService.previewAlterTable(
        props.connectionId,
        props.existingTable.name,
        changes
      )
    } else {
      // 新建模式
      previewResult.value = await schemaService.previewCreateTable(tableForm.value)
    }
    activeTab.value = 'ddl'
  } catch (err) {
    toastStore.error('预览DDL失败', String(err))
  } finally {
    isLoading.value = false
  }
}

function generateChanges(): TableChange[] {
  const changes: TableChange[] = []
  // 这里需要比较新旧表结构生成变更
  // 简化实现：如果是编辑模式，返回重命名表的变更（如果有）
  if (props.existingTable && props.existingTable.name !== tableForm.value.name) {
    changes.push({
      type: 'rename_table',
      new_name: tableForm.value.name,
    })
  }
  return changes
}

async function executeDDL() {
  if (!previewResult.value) return

  isExecuting.value = true
  try {
    let result: DDLExecutionResult

    if (isEditMode.value && props.existingTable) {
      const changes = generateChanges()
      result = await schemaService.alterTable(
        props.connectionId,
        props.existingTable.name,
        changes
      )
    } else {
      result = await schemaService.createTable(props.connectionId, tableForm.value)
    }

    if (result.success) {
      toastStore.success('操作成功', result.message || '')
      emit('success')
      closeDialog()
    } else {
      toastStore.error('操作失败', result.message || '')
    }
  } catch (err) {
    toastStore.error('执行DDL失败', String(err))
  } finally {
    isExecuting.value = false
  }
}

// ============================================
// 表单验证
// ============================================

const errors = ref<Record<string, string>>({})

function validateForm(): boolean {
  errors.value = {}

  if (!tableForm.value.name.trim()) {
    errors.value.tableName = '表名不能为空'
  }

  if (tableForm.value.columns.length === 0) {
    errors.value.columns = '至少需要一列'
  }

  for (let i = 0; i < tableForm.value.columns.length; i++) {
    const col = tableForm.value.columns[i]
    if (!col.name.trim()) {
      errors.value[`column_${i}_name`] = '列名不能为空'
    }
  }

  // 检查重复列名
  const names = new Set<string>()
  for (const col of tableForm.value.columns) {
    if (names.has(col.name)) {
      errors.value.duplicateColumns = `重复的列名: ${col.name}`
      break
    }
    names.add(col.name)
  }

  return Object.keys(errors.value).length === 0
}

// ============================================
// 对话框控制
// ============================================

function closeDialog() {
  emit('update:modelValue', false)
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    closeDialog()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click="onBackdropClick"
      >
        <div class="flex h-[85vh] w-[90vw] max-w-5xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-900">
          <!-- 头部 -->
          <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ isEditMode ? '编辑表' : '新建表' }}
            </h2>
            <button
              class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              @click="closeDialog"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 表名输入 -->
          <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              表名 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="tableForm.name"
              type="text"
              placeholder="输入表名"
              class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              :class="{ 'border-red-500': errors.tableName }"
            />
            <p v-if="errors.tableName" class="mt-1 text-sm text-red-500">{{ errors.tableName }}</p>
          </div>

          <!-- 标签页 -->
          <div class="flex border-b border-gray-200 dark:border-gray-700">
            <button
              class="px-6 py-3 text-sm font-medium transition-colors"
              :class="activeTab === 'columns' 
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'"
              @click="activeTab = 'columns'"
            >
              字段 ({{ tableForm.columns.length }})
            </button>
            <button
              class="px-6 py-3 text-sm font-medium transition-colors"
              :class="activeTab === 'indexes' 
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'"
              @click="activeTab = 'indexes'"
            >
              索引 ({{ tableForm.indexes.length }})
            </button>
            <button
              class="px-6 py-3 text-sm font-medium transition-colors"
              :class="activeTab === 'ddl' 
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'"
              @click="activeTab = 'ddl'"
            >
              DDL预览
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-hidden">
            <!-- 字段管理 -->
            <ColumnEditor
              v-if="activeTab === 'columns'"
              v-model="tableForm.columns"
              :data-types="dataTypes"
              :foreign-key-actions="foreignKeyActions"
              :available-tables="availableTables"
              :errors="errors"
              @add="addColumn"
              @remove="removeColumn"
              @move="moveColumn"
            />

            <!-- 索引管理 -->
            <IndexEditor
              v-else-if="activeTab === 'indexes'"
              v-model="tableForm.indexes"
              :columns="tableForm.columns"
              @add="addIndex"
              @remove="removeIndex"
            />

            <!-- DDL预览 -->
            <DDLPreview
              v-else-if="activeTab === 'ddl'"
              :preview="previewResult"
              :is-loading="isLoading"
              @refresh="previewDDL"
            />
          </div>

          <!-- 底部按钮 -->
          <div class="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  v-model="tableForm.strict_mode"
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                严格模式
              </label>
            </div>
            <div class="flex gap-3">
              <button
                class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                @click="closeDialog"
              >
                取消
              </button>
              <button
                class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                :disabled="isLoading"
                @click="previewDDL"
              >
                <span v-if="isLoading" class="flex items-center gap-2">
                  <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  生成中...
                </span>
                <span v-else>预览DDL</span>
              </button>
              <button
                class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                :disabled="!previewResult || isExecuting"
                @click="executeDDL"
              >
                <span v-if="isExecuting" class="flex items-center gap-2">
                  <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  执行中...
                </span>
                <span v-else>{{ isEditMode ? '保存修改' : '创建表' }}</span>
              </button>
            </div>
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
