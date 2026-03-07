<script setup lang="ts">
import { computed } from 'vue'
import type { DesignerIndex, DesignerColumn } from '@types'

const props = defineProps<{
  modelValue: DesignerIndex[]
  columns: DesignerColumn[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DesignerIndex[]]
  add: []
  remove: [index: number]
}>()

const indexes = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

function updateIndex(index: number, field: keyof DesignerIndex, value: any) {
  const newIndexes = [...indexes.value]
  newIndexes[index] = { ...newIndexes[index], [field]: value }
  indexes.value = newIndexes
}

function toggleColumn(indexIdx: number, colName: string) {
  const idx = indexes.value[indexIdx]
  const newColumns = idx.columns.includes(colName)
    ? idx.columns.filter(c => c !== colName)
    : [...idx.columns, colName]
  updateIndex(indexIdx, 'columns', newColumns)
}

function moveColumnInIndex(indexIdx: number, colIdx: number, direction: 'up' | 'down') {
  const idx = indexes.value[indexIdx]
  const cols = [...idx.columns]
  if (direction === 'up' && colIdx > 0) {
    ;[cols[colIdx], cols[colIdx - 1]] = [cols[colIdx - 1], cols[colIdx]]
  } else if (direction === 'down' && colIdx < cols.length - 1) {
    ;[cols[colIdx], cols[colIdx + 1]] = [cols[colIdx + 1], cols[colIdx]]
  }
  updateIndex(indexIdx, 'columns', cols)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 工具栏 -->
    <div class="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-700">
      <button
        class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        @click="emit('add')"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        添加索引
      </button>
    </div>

    <!-- 索引列表 -->
    <div class="flex-1 divide-y divide-gray-200 overflow-auto dark:divide-gray-700">
      <div
        v-for="(idx, index) in indexes"
        :key="idx.id"
        class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        <div class="flex items-start gap-4">
          <!-- 索引配置 -->
          <div class="flex-1 space-y-3">
            <div class="flex items-center gap-4">
              <!-- 索引名 -->
              <div class="flex-1">
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">索引名称</label>
                <input
                  v-model="idx.name"
                  type="text"
                  placeholder="idx_xxx"
                  class="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <!-- 唯一索引 -->
              <label class="flex items-center gap-2 pt-5">
                <input
                  v-model="idx.unique"
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">唯一索引</span>
              </label>

              <!-- 删除按钮 -->
              <button
                class="mt-5 rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                @click="emit('remove', index)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <!-- 列选择 -->
            <div>
              <label class="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400">索引列 (点击选择，拖拽排序)</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="col in columns"
                  :key="col.id"
                  class="rounded-full border px-3 py-1 text-sm transition-colors"
                  :class="idx.columns.includes(col.name) 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300' 
                    : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-400'"
                  @click="toggleColumn(index, col.name)"
                >
                  {{ col.name }}
                </button>
              </div>
            </div>

            <!-- 已选列顺序 -->
            <div v-if="idx.columns.length > 0" class="space-y-2">
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">已选列顺序</label>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="(colName, colIdx) in idx.columns"
                  :key="colName"
                  class="flex items-center gap-1 rounded-lg bg-blue-100 px-2 py-1 dark:bg-blue-900/30"
                >
                  <span class="text-sm text-blue-800 dark:text-blue-200">{{ colIdx + 1 }}. {{ colName }}</span>
                  <div class="flex gap-0.5">
                    <button
                      class="rounded p-0.5 text-blue-600 hover:bg-blue-200 disabled:opacity-30 dark:text-blue-400 dark:hover:bg-blue-800"
                      :disabled="colIdx === 0"
                      @click="moveColumnInIndex(index, colIdx, 'up')"
                    >
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      class="rounded p-0.5 text-blue-600 hover:bg-blue-200 disabled:opacity-30 dark:text-blue-400 dark:hover:bg-blue-800"
                      :disabled="colIdx === idx.columns.length - 1"
                      @click="moveColumnInIndex(index, colIdx, 'down')"
                    >
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- WHERE 子句 -->
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">WHERE 条件 (部分索引)</label>
              <input
                v-model="idx.where_clause"
                type="text"
                placeholder="例如: status = 'active'"
                class="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="indexes.length === 0" class="flex h-64 flex-col items-center justify-center text-gray-500 dark:text-gray-400">
        <svg class="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>暂无索引</p>
        <button
          class="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          @click="emit('add')"
        >
          添加第一个索引
        </button>
      </div>
    </div>
  </div>
</template>
