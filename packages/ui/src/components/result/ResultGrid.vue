<script setup lang="ts">
import { ref, computed } from 'vue'
import type { QueryRow, CellValue } from '@types'
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  TrashIcon,
  PencilIcon
} from '@heroicons/vue/24/outline'

interface Props {
    columns: string[]
    rows: QueryRow[]
    hasMore?: boolean
    tableName?: string | null
    /** 是否允许编辑/删除操作 */
    allowEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    hasMore: false,
    tableName: null,
    allowEdit: true
})

const emit = defineEmits<{
    'edit-row': [row: QueryRow, rowIndex: number]
    'delete-row': [row: QueryRow, rowIndex: number]
}>()

const pageSize = ref(100)
const currentPage = ref(1)
const deletingRow = ref<number | null>(null)

const totalPages = computed(() => Math.ceil(props.rows.length / pageSize.value))

const paginatedRows = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    return props.rows.slice(start, end)
})

// 计算原始行索引
const getOriginalRowIndex = (paginatedIndex: number) => {
    return (currentPage.value - 1) * pageSize.value + paginatedIndex
}

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
    const baseClass =
        'px-3 py-2 text-sm border-b border-r border-surface-200 dark:border-surface-700 truncate max-w-[300px]'
    switch (value.type) {
        case 'Null':
            return `${baseClass} text-surface-400 dark:text-surface-500 italic`
        case 'Integer':
        case 'Real':
            return `${baseClass} text-right font-mono text-surface-700 dark:text-surface-300`
        case 'Boolean':
            return `${baseClass} text-center`
        default:
            return `${baseClass} text-surface-700 dark:text-surface-300`
    }
}

const handleRowDoubleClick = (row: QueryRow, rowIndex: number) => {
    if (props.allowEdit) {
        emit('edit-row', row, getOriginalRowIndex(rowIndex))
    }
}

const handleEdit = (row: QueryRow, rowIndex: number, event: Event) => {
    event.stopPropagation()
    emit('edit-row', row, getOriginalRowIndex(rowIndex))
}

const handleDelete = async (row: QueryRow, rowIndex: number, event: Event) => {
    event.stopPropagation()
    const originalIndex = getOriginalRowIndex(rowIndex)
    
    // 确认删除
    if (!confirm('确定要删除这条记录吗？此操作不可撤销。')) {
        return
    }
    
    deletingRow.value = rowIndex
    try {
        emit('delete-row', row, originalIndex)
    } finally {
        deletingRow.value = null
    }
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
                <thead class="sticky top-0 bg-surface-100 dark:bg-surface-800 z-10">
                    <tr>
                        <th
                            class="px-2 py-2 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 border-b border-r border-surface-200 dark:border-surface-700 w-10"
                        >
                            #
                        </th>
                        <th
                            v-for="col in columns"
                            :key="col"
                            class="px-3 py-2 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 border-b border-r border-surface-200 dark:border-surface-700 whitespace-nowrap"
                            :title="col"
                        >
                            {{ col }}
                        </th>
                        <!-- 操作列 -->
                        <th
                            v-if="allowEdit"
                            class="px-3 py-2 text-center text-xs font-semibold text-surface-600 dark:text-surface-400 border-b border-surface-200 dark:border-surface-700 whitespace-nowrap w-24 sticky right-0 bg-surface-100 dark:bg-surface-800 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]"
                        >
                            操作
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(row, rowIndex) in paginatedRows"
                        :key="rowIndex"
                        class="hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer group"
                        :class="{ 'opacity-50': deletingRow === rowIndex }"
                        @dblclick="handleRowDoubleClick(row, rowIndex)"
                    >
                        <td
                            class="px-2 py-2 text-xs text-surface-400 dark:text-surface-500 border-b border-r border-surface-200 dark:border-surface-700 text-center"
                        >
                            {{ (currentPage - 1) * pageSize + rowIndex + 1 }}
                        </td>
                        <td
                            v-for="col in columns"
                            :key="col"
                            :class="getCellClass(row.values[col] || { type: 'Null' })"
                        >
                            {{ formatCellValue(row.values[col] || { type: 'Null' }) }}
                        </td>
                        <!-- 操作按钮列 -->
                        <td
                            v-if="allowEdit"
                            class="px-2 py-2 text-center border-b border-surface-200 dark:border-surface-700 sticky right-0 bg-white dark:bg-surface-900 group-hover:bg-surface-50 dark:group-hover:bg-surface-800/50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] transition-colors"
                        >
                            <div class="flex items-center justify-center space-x-1">
                                <!-- 编辑按钮 -->
                                <button
                                    type="button"
                                    class="p-1.5 rounded-md transition-colors duration-150"
                                    :class="[
                                        'text-surface-500 dark:text-surface-400',
                                        'hover:text-primary-600 dark:hover:text-primary-400',
                                        'hover:bg-primary-50 dark:hover:bg-primary-900/30',
                                        'focus:outline-none focus:ring-2 focus:ring-primary-500/50'
                                    ]"
                                    title="编辑"
                                    @click="handleEdit(row, rowIndex, $event)"
                                >
                                    <PencilIcon class="w-4 h-4" />
                                </button>
                                <!-- 删除按钮 -->
                                <button
                                    type="button"
                                    class="p-1.5 rounded-md transition-colors duration-150"
                                    :class="[
                                        'text-surface-500 dark:text-surface-400',
                                        'hover:text-red-600 dark:hover:text-red-400',
                                        'hover:bg-red-50 dark:hover:bg-red-900/30',
                                        'focus:outline-none focus:ring-2 focus:ring-red-500/50'
                                    ]"
                                    :disabled="deletingRow === rowIndex"
                                    title="删除"
                                    @click="handleDelete(row, rowIndex, $event)"
                                >
                                    <TrashIcon 
                                        class="w-4 h-4" 
                                        :class="{ 'animate-pulse': deletingRow === rowIndex }" 
                                    />
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- 分页 -->
        <div
            class="flex items-center justify-between px-3 py-2 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"
        >
            <div class="text-xs text-surface-500 dark:text-surface-400">
                Showing {{ (currentPage - 1) * pageSize + 1 }} -
                {{ Math.min(currentPage * pageSize, rows.length) }} of {{ rows.length }} rows
                <span v-if="hasMore">(more available)</span>
            </div>
            <div class="flex items-center space-x-2">
                <select
                    v-model="pageSize"
                    class="text-xs border border-surface-300 dark:border-surface-600 rounded px-2 py-1 dark:bg-surface-800 dark:text-surface-200"
                    @change="handlePageSizeChange"
                >
                    <option :value="50">50 rows</option>
                    <option :value="100">100 rows</option>
                    <option :value="500">500 rows</option>
                    <option :value="1000">1000 rows</option>
                </select>
                <button
                    class="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-50"
                    :disabled="currentPage === 1"
                    @click="goToPrevPage"
                >
                    <ChevronLeftIcon class="w-4 h-4" />
                </button>
                <span class="text-xs text-surface-600 dark:text-surface-400">
                    Page {{ currentPage }} of {{ totalPages }}
                </span>
                <button
                    class="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-50"
                    :disabled="currentPage >= totalPages"
                    @click="goToNextPage"
                >
                    <ChevronRightIcon class="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
</template>
