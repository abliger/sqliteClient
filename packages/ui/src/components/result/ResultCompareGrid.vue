<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { QueryResultSnapshot, CellValue } from '@types'
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/vue/24/outline'

interface Props {
  /** 基准快照 */
  baseSnapshot: QueryResultSnapshot
  /** 对比快照 */
  compareSnapshot: QueryResultSnapshot
  /** 是否高亮差异 */
  highlightDiff?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  highlightDiff: true
})

const pageSize = ref(100)
const currentPage = ref(1)
// Sync scroll between grids (reserved for future use)
// const isSyncScroll = ref(true)

// 获取所有列（合并两个结果集的列）
const allColumns = computed(() => {
  const baseCols = props.baseSnapshot.result.columns
  const compareCols = props.compareSnapshot.result.columns
  // 使用基准的列顺序，但确保包含所有列
  const colSet = new Set([...baseCols, ...compareCols])
  return [...colSet]
})

// 以第一列为键，构建行映射用于对比
const baseRowMap = computed(() => {
  const map = new Map<string, number>()
  const firstCol = props.baseSnapshot.result.columns[0]
  if (!firstCol) return map

  props.baseSnapshot.result.rows.forEach((row, index) => {
    const key = formatCellValue(row.values[firstCol] || { type: 'Null' })
    map.set(key, index)
  })
  return map
})

const compareRowMap = computed(() => {
  const map = new Map<string, number>()
  const firstCol = props.compareSnapshot.result.columns[0]
  if (!firstCol) return map

  props.compareSnapshot.result.rows.forEach((row, index) => {
    const key = formatCellValue(row.values[firstCol] || { type: 'Null' })
    map.set(key, index)
  })
  return map
})

// 计算行差异
interface DiffRow {
  key: string
  baseRow?: { index: number; values: Record<string, CellValue> }
  compareRow?: { index: number; values: Record<string, CellValue> }
  status: 'same' | 'changed' | 'added' | 'removed'
  cellDiffs: Record<string, 'same' | 'changed' | 'empty'>
}

const diffRows = computed<DiffRow[]>(() => {
  const rows: DiffRow[] = []
  const firstCol = props.baseSnapshot.result.columns[0]
  if (!firstCol) return rows

  // 处理所有唯一的键
  const allKeys = new Set([
    ...props.baseSnapshot.result.rows.map(r => formatCellValue(r.values[firstCol] || { type: 'Null' })),
    ...props.compareSnapshot.result.rows.map(r => formatCellValue(r.values[firstCol] || { type: 'Null' }))
  ])

  for (const key of allKeys) {
    const baseIndex = baseRowMap.value.get(key)
    const compareIndex = compareRowMap.value.get(key)

    const baseRow = baseIndex !== undefined 
      ? { index: baseIndex, values: props.baseSnapshot.result.rows[baseIndex].values }
      : undefined
    const compareRow = compareIndex !== undefined
      ? { index: compareIndex, values: props.compareSnapshot.result.rows[compareIndex].values }
      : undefined

    let status: 'same' | 'changed' | 'added' | 'removed' = 'same'
    const cellDiffs: Record<string, 'same' | 'changed' | 'empty'> = {}

    if (baseRow && !compareRow) {
      status = 'removed'
    } else if (!baseRow && compareRow) {
      status = 'added'
    } else if (baseRow && compareRow) {
      // 比较每个单元格
      for (const col of allColumns.value) {
        const baseVal = formatCellValue(baseRow.values[col] || { type: 'Null' })
        const compareVal = formatCellValue(compareRow.values[col] || { type: 'Null' })
        if (baseVal !== compareVal) {
          status = 'changed'
          cellDiffs[col] = 'changed'
        } else {
          cellDiffs[col] = 'same'
        }
      }
    }

    rows.push({ key, baseRow, compareRow, status, cellDiffs })
  }

  // 排序：先显示变更的，然后是新增的，删除的，最后是相同的
  const statusOrder = { changed: 0, added: 1, removed: 2, same: 3 }
  rows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  return rows
})

// 分页
const totalPages = computed(() => Math.ceil(diffRows.value.length / pageSize.value))

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return diffRows.value.slice(start, end)
})

// 统计
const stats = computed(() => {
  let changed = 0, added = 0, removed = 0, same = 0
  diffRows.value.forEach(row => {
    if (row.status === 'changed') changed++
    else if (row.status === 'added') added++
    else if (row.status === 'removed') removed++
    else same++
  })
  return { total: diffRows.value.length, changed, added, removed, same }
})

function formatCellValue(value: CellValue): string {
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

function getRowClass(status: string): string {
  switch (status) {
    case 'changed':
      return 'bg-yellow-50 dark:bg-yellow-900/20'
    case 'added':
      return 'bg-green-50 dark:bg-green-900/20'
    case 'removed':
      return 'bg-red-50 dark:bg-red-900/20'
    default:
      return ''
  }
}

function getCellClass(diffType: 'same' | 'changed' | 'empty', status: string): string {
  const baseClass = 'px-3 py-2 text-sm border-b border-r border-surface-200 dark:border-surface-700 truncate max-w-[200px]'
  
  if (!props.highlightDiff) {
    return `${baseClass} text-surface-700 dark:text-surface-300`
  }

  if (diffType === 'changed') {
    return `${baseClass} bg-yellow-100 dark:bg-yellow-800/40 text-yellow-900 dark:text-yellow-100 font-medium`
  }
  
  if (status === 'added') {
    return `${baseClass} text-green-700 dark:text-green-300`
  }
  if (status === 'removed') {
    return `${baseClass} text-red-700 dark:text-red-300`
  }
  
  return `${baseClass} text-surface-700 dark:text-surface-300`
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'changed':
      return '~'
    case 'added':
      return '+'
    case 'removed':
      return '-'
    default:
      return '='
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'changed':
      return '修改'
    case 'added':
      return '新增'
    case 'removed':
      return '删除'
    default:
      return '相同'
  }
}

function goToPrevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function goToNextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

watch(() => props.baseSnapshot.id + props.compareSnapshot.id, () => {
  currentPage.value = 1
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 对比头部信息 -->
    <div class="flex items-center justify-between px-4 py-2 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
      <div class="flex items-center space-x-6">
        <div class="flex items-center space-x-2">
          <span class="text-xs text-surface-500 dark:text-surface-400">基准:</span>
          <span class="text-sm font-medium text-surface-700 dark:text-surface-300 truncate max-w-[150px]">
            {{ baseSnapshot.name }}
          </span>
        </div>
        <div class="text-surface-400">→</div>
        <div class="flex items-center space-x-2">
          <span class="text-xs text-surface-500 dark:text-surface-400">对比:</span>
          <span class="text-sm font-medium text-surface-700 dark:text-surface-300 truncate max-w-[150px]">
            {{ compareSnapshot.name }}
          </span>
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="flex items-center space-x-4 text-xs">
        <span class="text-surface-500 dark:text-surface-400">
          总计: {{ stats.total }}
        </span>
        <span v-if="stats.changed > 0" class="text-yellow-600 dark:text-yellow-400">
          修改: {{ stats.changed }}
        </span>
        <span v-if="stats.added > 0" class="text-green-600 dark:text-green-400">
          新增: {{ stats.added }}
        </span>
        <span v-if="stats.removed > 0" class="text-red-600 dark:text-red-400">
          删除: {{ stats.removed }}
        </span>
      </div>
    </div>

    <!-- 差异表格 -->
    <div class="flex-1 overflow-auto scrollbar-thin">
      <table class="w-full border-collapse">
        <thead class="sticky top-0 bg-surface-100 dark:bg-surface-800 z-10">
          <tr>
            <th class="px-2 py-2 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 border-b border-r border-surface-200 dark:border-surface-700 w-10">
              #
            </th>
            <th class="px-2 py-2 text-center text-xs font-semibold text-surface-600 dark:text-surface-400 border-b border-r border-surface-200 dark:border-surface-700 w-12">
              状态
            </th>
            <th 
              v-for="col in allColumns" 
              :key="col"
              class="px-3 py-2 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 border-b border-r border-surface-200 dark:border-surface-700 whitespace-nowrap"
            >
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="(row, rowIndex) in paginatedRows" 
            :key="rowIndex"
            :class="getRowClass(row.status)"
            class="border-b border-surface-200 dark:border-surface-700"
          >
            <td class="px-2 py-2 text-xs text-surface-400 dark:text-surface-500 text-center border-r border-surface-200 dark:border-surface-700">
              {{ (currentPage - 1) * pageSize + rowIndex + 1 }}
            </td>
            <td class="px-2 py-2 text-center border-r border-surface-200 dark:border-surface-700">
              <span 
                class="text-xs font-bold"
                :class="{
                  'text-yellow-600 dark:text-yellow-400': row.status === 'changed',
                  'text-green-600 dark:text-green-400': row.status === 'added',
                  'text-red-600 dark:text-red-400': row.status === 'removed',
                  'text-surface-400': row.status === 'same'
                }"
                :title="getStatusText(row.status)"
              >
                {{ getStatusIcon(row.status) }}
              </span>
            </td>
            <td 
              v-for="col in allColumns" 
              :key="col"
              :class="getCellClass(row.cellDiffs[col] || 'empty', row.status)"
            >
              <template v-if="row.baseRow && row.compareRow && row.status === 'changed'">
                <!-- 显示对比值 -->
                <div class="flex flex-col space-y-1">
                  <span class="line-through text-surface-400 text-xs">
                    {{ formatCellValue(row.baseRow.values[col] || { type: 'Null' }) }}
                  </span>
                  <span class="text-green-600 dark:text-green-400">
                    {{ formatCellValue(row.compareRow.values[col] || { type: 'Null' }) }}
                  </span>
                </div>
              </template>
              <template v-else-if="row.baseRow">
                {{ formatCellValue(row.baseRow.values[col] || { type: 'Null' }) }}
              </template>
              <template v-else-if="row.compareRow">
                {{ formatCellValue(row.compareRow.values[col] || { type: 'Null' }) }}
              </template>
              <template v-else>
                <span class="text-surface-400">-</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div class="flex items-center justify-between px-3 py-2 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
      <div class="text-xs text-surface-500 dark:text-surface-400">
        Showing {{ (currentPage - 1) * pageSize + 1 }} -
        {{ Math.min(currentPage * pageSize, diffRows.length) }} of {{ diffRows.length }} rows
      </div>
      <div class="flex items-center space-x-2">
        <select
          v-model="pageSize"
          class="text-xs border border-surface-300 dark:border-surface-600 rounded px-2 py-1 dark:bg-surface-800 dark:text-surface-200"
          @change="currentPage = 1"
        >
          <option :value="50">50 rows</option>
          <option :value="100">100 rows</option>
          <option :value="500">500 rows</option>
        </select>
        <button
          class="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-50"
          :disabled="currentPage === 1"
          @click="goToPrevPage"
        >
          <ArrowsPointingInIcon class="w-4 h-4 rotate-180" />
        </button>
        <span class="text-xs text-surface-600 dark:text-surface-400">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          class="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-50"
          :disabled="currentPage >= totalPages"
          @click="goToNextPage"
        >
          <ArrowsPointingOutIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
