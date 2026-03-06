import { defineComponent, PropType, ref, computed } from 'vue'
import type { QueryRow, CellValue } from '@types/index'
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'

interface ResultGridProps {
  columns: string[]
  rows: QueryRow[]
  hasMore: boolean
}

export default defineComponent({
  name: 'ResultGrid',
  props: {
    columns: {
      type: Array as PropType<string[]>,
      required: true
    },
    rows: {
      type: Array as PropType<QueryRow[]>,
      required: true
    },
    hasMore: {
      type: Boolean,
      default: false
    }
  },
  setup(props: ResultGridProps) {
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
      const baseClass = 'px-3 py-2 text-sm border-b border-r border-surface-200 truncate'
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

    return () => (
      <div class="h-full flex flex-col">
        {/* 表格 */}
        <div class="flex-1 overflow-auto scrollbar-thin">
          <table class="w-full border-collapse">
            <thead class="sticky top-0 bg-surface-100 z-10">
              <tr>
                <th class="px-2 py-2 text-left text-xs font-semibold text-surface-600 border-b border-r border-surface-200 w-10">
                  #
                </th>
                {props.columns.map(col => (
                  <th 
                    key={col}
                    class="px-3 py-2 text-left text-xs font-semibold text-surface-600 border-b border-r border-surface-200 whitespace-nowrap"
                    title={col}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.value.map((row, rowIndex) => (
                <tr key={rowIndex} class="hover:bg-surface-50">
                  <td class="px-2 py-2 text-xs text-surface-400 border-b border-r border-surface-200 text-center">
                    {(currentPage.value - 1) * pageSize.value + rowIndex + 1}
                  </td>
                  {props.columns.map(col => {
                    const value = row.values[col] || { type: 'Null' }
                    const isEditing = editingCell.value?.row === rowIndex && editingCell.value?.col === col
                    
                    return (
                      <td 
                        key={col}
                        class={getCellValueClass(value)}
                        onDblclick={() => handleCellDoubleClick(rowIndex, col, value)}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            class="w-full px-1 py-0.5 text-sm border border-primary-500 rounded"
                            v-model={editValue.value}
                            onBlur={handleSaveEdit}
                            onKeyup={(e: KeyboardEvent) => {
                              if (e.key === 'Enter') handleSaveEdit()
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                            v-focus
                          />
                        ) : (
                          formatCellValue(value)
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div class="flex items-center justify-between px-3 py-2 border-t border-surface-200 bg-surface-50">
          <div class="text-xs text-surface-500">
            Showing {(currentPage.value - 1) * pageSize.value + 1} - {Math.min(currentPage.value * pageSize.value, props.rows.length)} of {props.rows.length} rows
            {props.hasMore && ' (more available)'}
          </div>
          <div class="flex items-center space-x-2">
            <select 
              class="text-xs border border-surface-300 rounded px-2 py-1"
              v-model={pageSize.value}
              onChange={() => currentPage.value = 1}
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={500}>500 rows</option>
              <option value={1000}>1000 rows</option>
            </select>
            <button
              class="p-1 rounded hover:bg-surface-200 disabled:opacity-50"
              disabled={currentPage.value === 1}
              onClick={() => currentPage.value--}
            >
              <ChevronLeftIcon class="w-4 h-4" />
            </button>
            <span class="text-xs text-surface-600">
              Page {currentPage.value} of {totalPages.value}
            </span>
            <button
              class="p-1 rounded hover:bg-surface-200 disabled:opacity-50"
              disabled={currentPage.value >= totalPages.value}
              onClick={() => currentPage.value++}
            >
              <ChevronRightIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }
})

// 辅助函数
function getCellValueClass(value: CellValue): string {
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
