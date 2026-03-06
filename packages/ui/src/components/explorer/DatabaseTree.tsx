import { defineComponent, ref, computed } from 'vue'
import { useConnectionStore } from '@stores/connection'
import { useSchemaStore } from '@stores/schema'
import { useQueryStore } from '@stores/query'
import { 
  ChevronRightIcon, 
  ChevronDownIcon,
  TableCellsIcon,
  KeyIcon,
  LinkIcon,
  BoltIcon,
  CircleStackIcon,
  DocumentTextIcon
} from '@heroicons/vue/24/outline'
import type { TableInfo, ColumnInfo } from '@types/index'

export default defineComponent({
  name: 'DatabaseTree',
  setup() {
    const connectionStore = useConnectionStore()
    const schemaStore = useSchemaStore()
    const queryStore = useQueryStore()
    const activeTab = ref<'tables' | 'indexes' | 'triggers' | 'er'>('tables')

    const handleTableClick = (table: TableInfo) => {
      schemaStore.setSelectedTable(table.name)
    }

    const handleTableDoubleClick = (table: TableInfo) => {
      // 生成 SELECT 查询
      const sql = `SELECT * FROM "${table.name}" LIMIT 100;`
      queryStore.addTab(sql)
    }

    const handleGenerateSelect = (tableName: string) => {
      const sql = `SELECT * FROM "${tableName}" LIMIT 100;`
      queryStore.addTab(sql)
    }

    const handleGenerateInsert = (table: TableInfo) => {
      const columns = table.columns.map(c => `"${c.name}"`).join(', ')
      const placeholders = table.columns.map(() => '?').join(', ')
      const sql = `INSERT INTO "${table.name}" (${columns})\nVALUES (${placeholders});`
      queryStore.addTab(sql)
    }

    const renderColumn = (column: ColumnInfo) => {
      return (
        <div class="flex items-center space-x-1 py-0.5 pl-6 text-sm">
          {column.is_primary_key && (
            <KeyIcon class="w-3.5 h-3.5 text-amber-500" title="Primary Key" />
          )}
          {column.is_foreign_key && (
            <LinkIcon class="w-3.5 h-3.5 text-blue-500" title="Foreign Key" />
          )}
          {!column.is_primary_key && !column.is_foreign_key && (
            <div class="w-3.5" />
          )}
          <span class={[
            'flex-1',
            column.is_primary_key ? 'font-medium text-surface-900' : 'text-surface-700'
          ]}>
            {column.name}
          </span>
          <span class="text-xs text-surface-400">{column.data_type}</span>
          {!column.nullable && (
            <span class="text-xs text-red-500">*</span>
          )}
        </div>
      )
    }

    const renderTable = (table: TableInfo) => {
      const isExpanded = schemaStore.isTableExpanded(table.name)
      const isSelected = schemaStore.selectedTable === table.name

      return (
        <div key={table.name}>
          <div
            class={[
              'group flex items-center space-x-1 px-2 py-1 cursor-pointer hover:bg-surface-100',
              isSelected && 'bg-primary-50'
            ]}
            onClick={() => handleTableClick(table)}
            onDblclick={() => handleTableDoubleClick(table)}
          >
            <button
              class="p-0.5 rounded hover:bg-surface-200"
              onClick={(e) => {
                e.stopPropagation()
                schemaStore.toggleTableExpanded(table.name)
              }}
            >
              {isExpanded ? (
                <ChevronDownIcon class="w-4 h-4 text-surface-500" />
              ) : (
                <ChevronRightIcon class="w-4 h-4 text-surface-500" />
              )}
            </button>
            <TableCellsIcon class="w-4 h-4 text-surface-500" />
            <span class="flex-1 text-sm truncate">{table.name}</span>
            <span class="text-xs text-surface-400">{table.row_count?.toLocaleString()}</span>
          </div>

          {isExpanded && (
            <div class="border-l-2 border-surface-200 ml-4 my-1">
              {table.columns.map(column => renderColumn(column))}
              
              {/* 快捷操作 */}
              <div class="flex items-center space-x-2 pl-6 py-2">
                <button
                  class="text-xs text-primary-600 hover:text-primary-700"
                  onClick={() => handleGenerateSelect(table.name)}
                >
                  SELECT
                </button>
                <button
                  class="text-xs text-primary-600 hover:text-primary-700"
                  onClick={() => handleGenerateInsert(table)}
                >
                  INSERT
                </button>
              </div>
            </div>
          )}
        </div>
      )
    }

    const renderTablesTab = () => {
      if (schemaStore.isLoading) {
        return (
          <div class="flex items-center justify-center h-32 text-surface-400">
            Loading...
          </div>
        )
      }

      if (!connectionStore.activeConnection) {
        return (
          <div class="flex items-center justify-center h-32 text-surface-400 text-sm px-4 text-center">
            Open a database to view tables
          </div>
        )
      }

      if (schemaStore.tables.length === 0) {
        return (
          <div class="flex items-center justify-center h-32 text-surface-400 text-sm">
            No tables found
          </div>
        )
      }

      return (
        <div class="overflow-y-auto scrollbar-thin">
          {schemaStore.sortedTables.map(table => renderTable(table))}
        </div>
      )
    }

    const renderMetadata = () => {
      const conn = connectionStore.activeConnection
      if (!conn) return null

      return (
        <div class="px-3 py-2 border-b border-surface-200 bg-surface-50">
          <div class="flex items-center space-x-2 mb-1">
            <CircleStackIcon class="w-4 h-4 text-surface-500" />
            <span class="text-sm font-medium truncate">{conn.config.name}</span>
          </div>
          <div class="text-xs text-surface-500 space-y-0.5">
            <div>SQLite v{conn.metadata.version}</div>
            <div>{conn.metadata.table_count} tables • {(conn.metadata.size_bytes / 1024).toFixed(1)} KB</div>
          </div>
        </div>
      )
    }

    return () => (
      <div class="h-full flex flex-col">
        {/* 元数据信息 */}
        {renderMetadata()}

        {/* 标签页 */}
        <div class="flex border-b border-surface-200">
          {[
            { id: 'tables', label: 'Tables', icon: TableCellsIcon },
            { id: 'er', label: 'ER', icon: DocumentTextIcon }
          ].map(tab => (
            <button
              key={tab.id}
              class={[
                'flex-1 flex items-center justify-center space-x-1 py-2 text-xs font-medium transition-colors',
                activeTab.value === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-surface-600 hover:bg-surface-100'
              ]}
              onClick={() => activeTab.value = tab.id as any}
            >
              <tab.icon class="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div class="flex-1 overflow-hidden">
          {activeTab.value === 'tables' && renderTablesTab()}
          {activeTab.value === 'er' && (
            <div class="flex items-center justify-center h-full text-surface-400 text-sm">
              ER Diagram (Coming Soon)
            </div>
          )}
        </div>
      </div>
    )
  }
})
