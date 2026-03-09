<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { QueryRow, CellValue } from '@types'
import { usePlatformAsync } from '@services/platform'
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

// 列宽管理
const MIN_COLUMN_WIDTH = 50
const DEFAULT_COLUMN_WIDTH = 150
const columnWidths = ref<Record<string, number>>({})

// 容器引用
const tableContainerRef = ref<HTMLElement | null>(null)

// 计算固定列宽度（序号列 + 操作列）
const getFixedColumnsWidth = () => {
    let fixed = 50 // 序号列
    if (props.allowEdit) {
        fixed += 90 // 操作列
    }
    return fixed
}

// 计算数据列总宽度
const getDataColumnsWidth = () => {
    let total = 0
    props.columns.forEach(col => {
        total += columnWidths.value[col] || DEFAULT_COLUMN_WIDTH
    })
    return total
}

// 计算总宽度
const getTotalWidth = () => {
    return getFixedColumnsWidth() + getDataColumnsWidth()
}

// 自动填充列宽
const autoFillColumns = () => {
    if (!tableContainerRef.value || props.columns.length === 0) return
    
    const containerWidth = tableContainerRef.value.clientWidth
    const fixedWidth = getFixedColumnsWidth()
    const availableWidth = Math.max(0, containerWidth - fixedWidth)
    const columnCount = props.columns.length
    
    // 计算每个列的目标宽度
    const targetWidthPerColumn = Math.floor(availableWidth / columnCount)
    
    // 如果目标宽度大于最小宽度，平均分配
    if (targetWidthPerColumn >= MIN_COLUMN_WIDTH) {
        const newWidths: Record<string, number> = {}
        let totalAssigned = 0
        
        props.columns.forEach((col, index) => {
            // 最后一列占据剩余所有空间
            if (index === columnCount - 1) {
                newWidths[col] = availableWidth - totalAssigned
            } else {
                newWidths[col] = targetWidthPerColumn
                totalAssigned += targetWidthPerColumn
            }
        })
        
        columnWidths.value = newWidths
    } else {
        // 空间不足，使用最小宽度
        const newWidths: Record<string, number> = {}
        props.columns.forEach(col => {
            newWidths[col] = MIN_COLUMN_WIDTH
        })
        columnWidths.value = newWidths
    }
}

// 初始化列宽
const initColumnWidths = () => {
    const newWidths: Record<string, number> = {}
    props.columns.forEach(col => {
        // 保持已调整的宽度，否则使用默认值
        newWidths[col] = columnWidths.value[col] || DEFAULT_COLUMN_WIDTH
    })
    columnWidths.value = newWidths
    
    // 下一帧自动填充
    nextTick(() => {
        autoFillColumns()
    })
}

// 监听列变化
watch(() => props.columns, initColumnWidths, { immediate: true })

// 监听窗口大小变化
const handleResize = () => {
    autoFillColumns()
}

onMounted(() => {
    window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
})

// 列宽调整状态
const resizingColumn = ref<string | null>(null)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

// 开始调整列宽
const startResize = (col: string, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    resizingColumn.value = col
    resizeStartX.value = event.clientX
    resizeStartWidth.value = columnWidths.value[col] || DEFAULT_COLUMN_WIDTH
    
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    document.body.classList.add('resizing')
}

// 处理鼠标移动
const handleMouseMove = (event: MouseEvent) => {
    if (!resizingColumn.value) return
    
    const delta = event.clientX - resizeStartX.value
    const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeStartWidth.value + delta)
    
    columnWidths.value[resizingColumn.value] = newWidth
}

// 结束调整
const stopResize = () => {
    if (resizingColumn.value) {
        resizingColumn.value = null
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        document.body.classList.remove('resizing')
    }
}

// 绑定/解绑事件
onMounted(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResize)
})

onUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResize)
})

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

const handleRowDoubleClick = (row: QueryRow, rowIndex: number) => {
    if (props.allowEdit) {
        emit('edit-row', row, getOriginalRowIndex(rowIndex))
    }
}

const handleEdit = (row: QueryRow, rowIndex: number, event: Event) => {
    event.stopPropagation()
    emit('edit-row', row, getOriginalRowIndex(rowIndex))
}

const { platform } = usePlatformAsync()

const handleDelete = async (row: QueryRow, rowIndex: number, event: Event) => {
    event.stopPropagation()
    const originalIndex = getOriginalRowIndex(rowIndex)
    
    if (!platform.value) {
        if (!confirm('确定要删除这条记录吗？此操作不可撤销。')) {
            return
        }
    } else {
        const confirmed = await platform.value.dialog.showConfirm('确定要删除这条记录吗？此操作不可撤销。')
        if (!confirmed) {
            return
        }
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

// 获取列的样式
const getColumnStyle = (col: string) => {
    const width = columnWidths.value[col] || DEFAULT_COLUMN_WIDTH
    return {
        width: `${width}px`,
        flexShrink: 0,
        boxSizing: 'border-box' as const
    }
}
</script>

<template>
    <div class="h-full flex flex-col">
        <!-- 统一的表格滚动容器 - 包含表头和内容 -->
        <div ref="tableContainerRef" class="flex-1 overflow-auto scrollbar-thin">
            <div 
                class="inline-block min-w-full"
                :style="{ width: `${Math.max(getTotalWidth(), tableContainerRef?.clientWidth || 0)}px` }"
            >
                <!-- 表头 -->
                <div class="sticky top-0 z-10 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
                    <div class="flex">
                        <!-- 序号列头 -->
                        <div
                            class="flex-shrink-0 px-2 py-2 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 border-r border-surface-200 dark:border-surface-700 select-none flex items-center"
                            :style="{ width: '50px', flexShrink: 0, boxSizing: 'border-box' }"
                        >
                            #
                        </div>
                        <!-- 数据列头 -->
                        <div
                            v-for="col in columns"
                            :key="col"
                            class="relative flex-shrink-0 px-3 py-2 text-left text-xs font-semibold text-surface-600 dark:text-surface-400 border-r border-surface-200 dark:border-surface-700 select-none overflow-hidden group"
                            :style="getColumnStyle(col)"
                            :title="col"
                        >
                            <div class="flex items-center h-full overflow-hidden">
                                <span class="truncate flex-1">{{ col }}</span>
                            </div>
                            <!-- 列宽调整手柄 -->
                            <div
                                class="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-50 flex items-center justify-center"
                                @mousedown="startResize(col, $event)"
                            >
                                <div class="w-0.5 h-5 bg-surface-400 dark:bg-surface-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
                            </div>
                        </div>
                        <!-- 操作列头 -->
                        <div
                            v-if="allowEdit"
                            class="flex-shrink-0 px-3 py-2 text-center text-xs font-semibold text-surface-600 dark:text-surface-400 border-r border-surface-200 dark:border-surface-700 select-none flex items-center justify-center"
                            :style="{ width: '90px', flexShrink: 0, boxSizing: 'border-box' }"
                        >
                            操作
                        </div>
                    </div>
                </div>

                <!-- 表格内容 -->
                <div class="flex flex-col">
                    <div
                        v-for="(row, rowIndex) in paginatedRows"
                        :key="rowIndex"
                        class="flex hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer group"
                        :class="{ 'opacity-50': deletingRow === rowIndex }"
                        @dblclick="handleRowDoubleClick(row, rowIndex)"
                    >
                        <!-- 序号单元格 -->
                        <div
                            class="flex-shrink-0 px-2 py-2 text-xs text-surface-400 dark:text-surface-500 border-b border-r border-surface-200 dark:border-surface-700 text-center select-none flex items-center justify-center"
                            :style="{ width: '50px', flexShrink: 0, boxSizing: 'border-box' }"
                        >
                            {{ (currentPage - 1) * pageSize + rowIndex + 1 }}
                        </div>
                        <!-- 数据单元格 -->
                        <div
                            v-for="col in columns"
                            :key="col"
                            class="flex-shrink-0 px-3 py-2 text-sm border-b border-r border-surface-200 dark:border-surface-700 overflow-hidden text-ellipsis whitespace-nowrap flex items-center"
                            :class="{
                                'text-surface-400 dark:text-surface-500 italic': (row.values[col]?.type) === 'Null',
                                'text-right font-mono text-surface-700 dark:text-surface-300': (row.values[col]?.type) === 'Integer' || (row.values[col]?.type) === 'Real',
                                'text-center text-surface-700 dark:text-surface-300': (row.values[col]?.type) === 'Boolean',
                                'text-surface-700 dark:text-surface-300': (row.values[col]?.type) !== 'Null' && (row.values[col]?.type) !== 'Integer' && (row.values[col]?.type) !== 'Real' && (row.values[col]?.type) !== 'Boolean'
                            }"
                            :style="getColumnStyle(col)"
                            :title="formatCellValue(row.values[col] ?? { type: 'Null' })"
                        >
                            {{ formatCellValue(row.values[col] ?? { type: 'Null' }) }}
                        </div>
                        <!-- 操作按钮列 -->
                        <div
                            v-if="allowEdit"
                            class="flex-shrink-0 px-2 py-2 text-center border-b border-r border-surface-200 dark:border-surface-700 flex items-center justify-center"
                            :style="{ width: '90px', flexShrink: 0, boxSizing: 'border-box' }"
                        >
                            <div class="flex items-center justify-center space-x-1">
                                <button
                                    type="button"
                                    class="p-1.5 rounded-md transition-colors duration-150 text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                                    title="编辑"
                                    @click="handleEdit(row, rowIndex, $event)"
                                >
                                    <PencilIcon class="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    class="p-1.5 rounded-md transition-colors duration-150 text-surface-500 dark:text-surface-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
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
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 分页 -->
        <div
            class="flex items-center justify-between px-3 py-2 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 shrink-0"
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

<style scoped>
/* 自定义滚动条样式 */
.scrollbar-thin::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.5);
    border-radius: 4px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background-color: rgba(156, 163, 175, 0.7);
}

.dark .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: rgba(75, 85, 99, 0.5);
}

.dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background-color: rgba(75, 85, 99, 0.7);
}

.resize-handle {
    background: transparent;
    transition: background-color 0.15s;
}

.resize-handle:hover {
    background-color: rgba(59, 130, 246, 0.1);
}

.resize-handle:hover > div {
    opacity: 1 !important;
    background-color: rgb(59, 130, 246);
}

:global(body.resizing) {
    cursor: col-resize !important;
    user-select: none !important;
}

:global(body.resizing *) {
    cursor: col-resize !important;
}
</style>
