<script setup lang="ts">
import { ref, computed } from 'vue'
import type { QueryRow, CellValue } from '@types'
import { 
  ChevronLeftIcon, 
  ChevronRightIcon
} from '@heroicons/vue/24/outline'

interface Props {
  columns: string[]
  rows: QueryRow[]
  hasMore?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hasMore: false
})

const pageSize = ref(100)
const currentPage = ref(1)
const editingCell = ref<{ row: number; col: string } | null>(null)
const editValue = ref('')

const totalPages = computed(() => Math.ceil(props.rows.length / pageSize.value))

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return props.rows.slice(start, end)
})

const formatCellValue = (value: CellValue): string => {
  switch (value.type) {
    case 'Null':
      return 'NULL'
    case 'Integer':
    case 'Real':
    case 'Boolean':
      return String(value.value)
    case 'Text':
      return value.value
    case 'Blob':
      return value.value
    default:
      return ''
  }
}

const getCellClass = (value: CellValue): string => {
  const baseClass = 'px-3 py-2 text-sm border-b border-r border-surface-200 truncate max-w-[300px]'
  switch (value.type) {
    case 'Null':
      return `${baseClass} text-surface-400 italic`
    case 'Integer':
    case 'Real':
      return `${baseClass} text-right font-mono text-surface-700`
    case 'Boolean':
      return `${baseClass} text-center`
    default:
      return `${baseClass} text-surface-700`
  }
}

const handleCellDoubleClick = (rowIndex: number, col: string, value: CellValue) => {
  editingCell.value = { row: rowIndex, col }
  editValue.value = formatCellValue(value)
}

const handleSaveEdit = () => {
  // TODO: 实现保存逻辑
  editingCell.value = null
}

const handleCancelEdit = () => {
  editingCell.value = null
  editValue.value = ''
}

const handlePageSizeChange = () => {
  currentPage.value = 1
}

const goToPrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const goToNextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 表格 -->
    <div class="flex-1 overflow-auto scrollbar-thin">
      <table class="w-full border-collapse">
        <thead class="sticky top-0 bg-surface-100 z-10">
          <tr>
            <th class="px-2 py-2 text-left text-xs font-semibold text-surface-600 border-b border-r border-surface-200 w-10">
              #
            </th>
            <th 
              v-for="col in columns"
              :key="col"
              class="px-3 py-2 text-left text-xs font-semibold text-surface-600 border-b border-r border-surface-200 whitespace-nowrap"
              :title="col"
            >
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in paginatedRows"
            :key="rowIndex"
            class="hover:bg-surface-50"
          >
            <td class="px-2 py-2 text-xs text-surface-400 border-b border-r border-surface-200 text-center">
              {{ (currentPage - 1) * pageSize + rowIndex + 1 }}
            </td>
            <td 
              v-for="col in columns"
              :key="col"
              :class="getCellClass(row.values[col] || { type: 'Null' })"
              @dblclick="handleCellDoubleClick(rowIndex, col, row.values[col] || { type: 'Null' })"
            >
              <template v-if="editingCell?.row === rowIndex && editingCell?.col === col">
                <input
                  v-model="editValue"
                  type="text"
                  class="w-full px-1 py-0.5 text-sm border border-primary-500 rounded"
                  @blur="handleSaveEdit"
                  @keyup.enter="handleSaveEdit"
                  @keyup.esc="handleCancelEdit"
                  v-focus
                />
              </template>
              <template v-else>
                {{ formatCellValue(row.values[col] || { type: 'Null' }) }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div class="flex items-center justify-between px-3 py-2 border-t border-surface-200 bg-surface-50">
      <div class="text-xs text-surface-500">
        Showing {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, rows.length) }} of {{ rows.length }} rows
        <span v-if="hasMore">(more available)</span>
      </div>
      <div class="flex items-center space-x-2">
        <select 
          v-model="pageSize"
          class="text-xs border border-surface-300 rounded px-2 py-1"
          @change="handlePageSizeChange"
        >
          <option :value="50">50 rows</option>
          <option :value="100">100 rows</option>
          <option :value="500">500 rows</option>
          <option :value="1000">1000 rows</option>
        </select>
        <button
          class="p-1 rounded hover:bg-surface-200 disabled:opacity-50"
          :disabled="currentPage === 1"
          @click="goToPrevPage"
        >
          <ChevronLeftIcon class="w-4 h-4" />
        </button>
        <span class="text-xs text-surface-600">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          class="p-1 rounded hover:bg-surface-200 disabled:opacity-50"
          :disabled="currentPage >= totalPages"
          @click="goToNextPage"
        >
          <ChevronRightIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
