<script setup lang="ts">
import { computed } from 'vue'
import type { DesignerColumn } from '@types'

const props = defineProps<{
  modelValue: DesignerColumn[]
  dataTypes: string[]
  foreignKeyActions: string[]
  availableTables: string[]
  errors: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DesignerColumn[]]
  add: []
  remove: [index: number]
  move: [index: number, direction: 'up' | 'down']
}>()

const columns = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

function updateColumn(index: number, field: keyof DesignerColumn, value: unknown) {
  const newColumns = [...columns.value]
  newColumns[index] = { ...newColumns[index], [field]: value }
  columns.value = newColumns
}

function toggleForeignKey(index: number) {
  const col = columns.value[index]
  if (col.is_foreign_key && !col.foreign_key) {
    updateColumn(index, 'foreign_key', {
      ref_table: '',
      ref_column: '',
      on_update: 'NO ACTION',
      on_delete: 'NO ACTION',
    })
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 工具栏 -->
    <div class="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          @click="emit('add')"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          添加字段
        </button>
      </div>
      <p v-if="errors.columns" class="text-sm text-red-500">{{ errors.columns }}</p>
      <p v-if="errors.duplicateColumns" class="text-sm text-red-500">{{ errors.duplicateColumns }}</p>
    </div>

    <!-- 列列表 -->
    <div class="flex-1 overflow-auto">
      <table class="w-full">
        <thead class="sticky top-0 bg-gray-50 dark:bg-gray-800">
          <tr>
            <th class="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">排序</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">字段名 *</th>
            <th class="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">类型 *</th>
            <th class="w-20 px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">非空</th>
            <th class="w-20 px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">主键</th>
            <th class="w-20 px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">自增</th>
            <th class="w-20 px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">唯一</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">默认值</th>
            <th class="w-24 px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">外键</th>
            <th class="w-16 px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr
            v-for="(col, index) in columns"
            :key="col.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <!-- 排序按钮 -->
            <td class="px-2 py-2">
              <div class="flex flex-col gap-1">
                <button
                  class="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-gray-700"
                  :disabled="index === 0"
                  @click="emit('move', index, 'up')"
                >
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  class="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-gray-700"
                  :disabled="index === columns.length - 1"
                  @click="emit('move', index, 'down')"
                >
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </td>

            <!-- 字段名 -->
            <td class="px-3 py-2">
              <input
                :value="col.name"
                type="text"
                placeholder="字段名"
                class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                :class="{ 'border-red-500': errors[`column_${index}_name`] }"
                @input="updateColumn(index, 'name', ($event.target as HTMLInputElement).value)"
              />
            </td>

            <!-- 类型 -->
            <td class="px-3 py-2">
              <select
                :value="col.data_type"
                class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                @change="updateColumn(index, 'data_type', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="type in dataTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </td>

            <!-- 非空 -->
            <td class="px-3 py-2 text-center">
              <input
                :checked="!col.nullable"
                type="checkbox"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                @change="updateColumn(index, 'nullable', !($event.target as HTMLInputElement).checked)"
              />
            </td>

            <!-- 主键 -->
            <td class="px-3 py-2 text-center">
              <input
                :checked="col.is_primary_key"
                type="checkbox"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                @change="updateColumn(index, 'is_primary_key', ($event.target as HTMLInputElement).checked)"
              />
            </td>

            <!-- 自增 -->
            <td class="px-3 py-2 text-center">
              <input
                :checked="col.is_auto_increment"
                type="checkbox"
                :disabled="!col.is_primary_key || col.data_type !== 'INTEGER'"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                @change="updateColumn(index, 'is_auto_increment', ($event.target as HTMLInputElement).checked)"
              />
            </td>

            <!-- 唯一 -->
            <td class="px-3 py-2 text-center">
              <input
                :checked="col.is_unique"
                type="checkbox"
                :disabled="col.is_primary_key"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                @change="updateColumn(index, 'is_unique', ($event.target as HTMLInputElement).checked)"
              />
            </td>

            <!-- 默认值 -->
            <td class="px-3 py-2">
              <input
                :value="col.default_value || ''"
                type="text"
                placeholder="NULL"
                class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                @input="updateColumn(index, 'default_value', ($event.target as HTMLInputElement).value || undefined)"
              />
            </td>

            <!-- 外键 -->
            <td class="px-3 py-2 text-center">
              <input
                :checked="col.is_foreign_key"
                type="checkbox"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                @change="updateColumn(index, 'is_foreign_key', ($event.target as HTMLInputElement).checked); toggleForeignKey(index)"
              />
            </td>

            <!-- 操作 -->
            <td class="px-3 py-2 text-center">
              <button
                class="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                @click="emit('remove', index)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </td>
          </tr>

          <!-- 外键配置行 -->
          <tr
            v-for="(col, index) in columns"
            v-show="col.is_foreign_key"
            :key="`${col.id}_fk`"
            class="bg-blue-50/50 dark:bg-blue-900/10"
          >
            <td colspan="10" class="px-3 py-2">
              <div class="flex items-center gap-4">
                <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {{ col.name }} 的外键配置:
                </span>
                <select
                  :value="col.foreign_key?.ref_table || ''"
                  class="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  @change="updateColumn(index, 'foreign_key', { ...col.foreign_key, ref_table: ($event.target as HTMLSelectElement).value })"
                >
                  <option value="">选择引用表</option>
                  <option v-for="table in availableTables" :key="table" :value="table">{{ table }}</option>
                </select>
                <input
                  :value="col.foreign_key?.ref_column || ''"
                  type="text"
                  placeholder="引用字段"
                  class="w-32 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  @input="updateColumn(index, 'foreign_key', { ...col.foreign_key, ref_column: ($event.target as HTMLInputElement).value })"
                />
                <span class="text-xs text-gray-500">ON UPDATE</span>
                <select
                  :value="col.foreign_key?.on_update || 'NO ACTION'"
                  class="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  @change="updateColumn(index, 'foreign_key', { ...col.foreign_key, on_update: ($event.target as HTMLSelectElement).value })"
                >
                  <option v-for="action in foreignKeyActions" :key="action" :value="action">{{ action }}</option>
                </select>
                <span class="text-xs text-gray-500">ON DELETE</span>
                <select
                  :value="col.foreign_key?.on_delete || 'NO ACTION'"
                  class="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  @change="updateColumn(index, 'foreign_key', { ...col.foreign_key, on_delete: ($event.target as HTMLSelectElement).value })"
                >
                  <option v-for="action in foreignKeyActions" :key="action" :value="action">{{ action }}</option>
                </select>
              </div>
            </td>
          </tr>

          <!-- 空状态 -->
          <tr v-if="columns.length === 0">
            <td colspan="10" class="py-12 text-center text-gray-500 dark:text-gray-400">
              <svg class="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p>暂无字段</p>
              <button
                class="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                @click="emit('add')"
              >
                添加第一个字段
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
