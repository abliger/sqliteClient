import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { schemaService } from '@services/schema'
import type { ERDiagram, TableInfo } from '@types/index'

export const useSchemaStore = defineStore('schema', () => {
  // State
  const tables = ref<TableInfo[]>([])
  const erDiagram = ref<ERDiagram | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const expandedTables = ref<Set<string>>(new Set())
  const selectedTable = ref<string | null>(null)

  // Getters
  const tableCount = computed(() => tables.value.length)

  const sortedTables = computed(() => {
    return [...tables.value].sort((a, b) => a.name.localeCompare(b.name))
  })

  const getTableByName = computed(() => {
    return (name: string) => tables.value.find(t => t.name === name)
  })

  // Actions
  async function loadTables(connectionId: string) {
    isLoading.value = true
    error.value = null
    try {
      tables.value = await schemaService.listTables(connectionId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load tables'
      tables.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function loadERDiagram(connectionId: string) {
    isLoading.value = true
    error.value = null
    try {
      erDiagram.value = await schemaService.getERDiagramData(connectionId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load ER diagram'
      erDiagram.value = null
    } finally {
      isLoading.value = false
    }
  }

  function toggleTableExpanded(tableName: string) {
    if (expandedTables.value.has(tableName)) {
      expandedTables.value.delete(tableName)
    } else {
      expandedTables.value.add(tableName)
    }
  }

  function setSelectedTable(tableName: string | null) {
    selectedTable.value = tableName
  }

  function isTableExpanded(tableName: string): boolean {
    return expandedTables.value.has(tableName)
  }

  function clearSchema() {
    tables.value = []
    erDiagram.value = null
    expandedTables.value.clear()
    selectedTable.value = null
  }

  return {
    // State
    tables,
    erDiagram,
    isLoading,
    error,
    expandedTables,
    selectedTable,
    // Getters
    tableCount,
    sortedTables,
    getTableByName,
    // Actions
    loadTables,
    loadERDiagram,
    toggleTableExpanded,
    setSelectedTable,
    isTableExpanded,
    clearSchema
  }
})
