import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTemplateStore } from './template'
import type { Snippet, SnippetCategory, CreateSnippetRequest } from '@types'

describe('Template Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const store = useTemplateStore()

    expect(store.customSnippets).toEqual([])
    expect(store.searchKeyword).toBe('')
    expect(store.selectedCategory).toBeNull()
    expect(store.selectedType).toBeNull()
    expect(store.selectedTag).toBeNull()
    expect(store.isPanelOpen).toBe(false)
  })

  describe('getters', () => {
    describe('allSnippets', () => {
      it('should include builtin snippets by default', () => {
        const store = useTemplateStore()

        const allSnippets = store.allSnippets

        expect(allSnippets.length).toBe(store.builtinSnippets.length)
        expect(allSnippets.every(s => s.type === 'builtin')).toBe(true)
      })

      it('should include custom snippets when added', () => {
        const store = useTemplateStore()
        const customSnippet: Snippet = {
          id: 'custom-1',
          name: 'Custom Snippet',
          sql: 'SELECT 1',
          category: 'query',
          type: 'custom',
          tags: [],
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
        store.customSnippets = [customSnippet]

        expect(store.allSnippets).toContainEqual(customSnippet)
      })
    })

    describe('filteredSnippets', () => {
      it('should filter by type', () => {
        const store = useTemplateStore()
        store.selectedType = 'custom'

        const filtered = store.filteredSnippets

        expect(filtered.every(s => s.type === 'custom')).toBe(true)
      })

      it('should filter by category', () => {
        const store = useTemplateStore()
        store.selectedCategory = 'ddl' as SnippetCategory

        const filtered = store.filteredSnippets

        expect(filtered.every(s => s.category === 'ddl')).toBe(true)
      })

      it('should filter by tag', () => {
        const store = useTemplateStore()
        store.selectedTag = '分页'

        const filtered = store.filteredSnippets

        expect(filtered.every(s => s.tags.includes('分页'))).toBe(true)
      })

      it('should filter by search keyword', () => {
        const store = useTemplateStore()
        store.searchKeyword = '分页查询'

        const filtered = store.filteredSnippets

        expect(filtered.length).toBeGreaterThan(0)
        expect(filtered.every(s => 
          s.name.includes('分页查询') || 
          s.sql.includes('分页查询') ||
          s.tags.some(t => t.includes('分页查询'))
        )).toBe(true)
      })

      it('should be case insensitive', () => {
        const store = useTemplateStore()
        // Search for lowercase version of builtin snippet names (which are in Chinese)
        store.searchKeyword = 'select'

        const filtered = store.filteredSnippets

        // Should find snippets containing 'SELECT' (case insensitive search in SQL)
        expect(filtered.length).toBeGreaterThan(0)
        expect(filtered.some(s => s.sql.toLowerCase().includes('select'))).toBe(true)
      })

      it('should combine multiple filters', () => {
        const store = useTemplateStore()
        store.selectedCategory = 'query' as SnippetCategory
        store.selectedType = 'builtin'
        store.searchKeyword = '分页'

        const filtered = store.filteredSnippets

        expect(filtered.every(s => s.category === 'query' && s.type === 'builtin')).toBe(true)
      })
    })

    describe('snippetsByCategory', () => {
      it('should group snippets by category', () => {
        const store = useTemplateStore()

        const grouped = store.snippetsByCategory

        expect(grouped.query.length).toBeGreaterThan(0)
        expect(grouped.ddl.length).toBeGreaterThanOrEqual(0)
        expect(grouped.dml.length).toBeGreaterThanOrEqual(0)
        expect(grouped.function.length).toBeGreaterThanOrEqual(0)
        expect(grouped.other).toBeDefined()
      })

      it('should include only filtered snippets when filters are active', () => {
        const store = useTemplateStore()
        store.selectedType = 'custom'

        const grouped = store.snippetsByCategory

        const totalCount = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0)
        expect(totalCount).toBe(0) // No custom snippets by default
      })
    })

    describe('allTags', () => {
      it('should return unique tags', () => {
        const store = useTemplateStore()

        const tags = store.allTags

        const uniqueTags = [...new Set(tags)]
        expect(tags).toEqual(uniqueTags)
      })

      it('should be sorted alphabetically', () => {
        const store = useTemplateStore()

        const tags = store.allTags

        const sortedTags = [...tags].sort()
        expect(tags).toEqual(sortedTags)
      })

      it('should include tags from custom snippets', () => {
        const store = useTemplateStore()
        const customSnippet: Snippet = {
          id: 'custom-1',
          name: 'Custom',
          sql: 'SELECT 1',
          category: 'query',
          type: 'custom',
          tags: ['custom-tag'],
          created_at: '',
          updated_at: ''
        }
        store.customSnippets = [customSnippet]

        expect(store.allTags).toContain('custom-tag')
      })
    })

    describe('categories', () => {
      it('should have all categories defined', () => {
        const store = useTemplateStore()

        expect(store.categories).toHaveLength(5)
        expect(store.categories.map(c => c.value)).toContain('query')
        expect(store.categories.map(c => c.value)).toContain('dml')
        expect(store.categories.map(c => c.value)).toContain('ddl')
        expect(store.categories.map(c => c.value)).toContain('function')
        expect(store.categories.map(c => c.value)).toContain('other')
      })
    })
  })

  describe('createSnippet', () => {
    it('should create a new snippet', () => {
      const store = useTemplateStore()
      const request: CreateSnippetRequest = {
        name: 'Test Snippet',
        sql: 'SELECT * FROM test',
        category: 'query',
        description: 'A test snippet',
        tags: ['test', 'query']
      }

      const snippet = store.createSnippet(request)

      expect(snippet.id).toBeDefined()
      expect(snippet.name).toBe('Test Snippet')
      expect(snippet.sql).toBe('SELECT * FROM test')
      expect(snippet.category).toBe('query')
      expect(snippet.type).toBe('custom')
      expect(snippet.tags).toEqual(['test', 'query'])
      expect(snippet.created_at).toBeDefined()
      expect(snippet.updated_at).toBeDefined()
      expect(store.customSnippets.some(s => s.id === snippet.id)).toBe(true)
    })

    it('should default to empty tags', () => {
      const store = useTemplateStore()
      const request: CreateSnippetRequest = {
        name: 'Test',
        sql: 'SELECT 1',
        category: 'query'
      }

      const snippet = store.createSnippet(request)

      expect(snippet.tags).toEqual([])
    })
  })

  describe('updateSnippet', () => {
    it('should update existing snippet', async () => {
      const store = useTemplateStore()
      const snippet = store.createSnippet({
        name: 'Original',
        sql: 'SELECT 1',
        category: 'query'
      })
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10))

      const updated = store.updateSnippet({
        id: snippet.id,
        name: 'Updated',
        sql: 'SELECT 2'
      })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('Updated')
      expect(updated!.sql).toBe('SELECT 2')
      expect(new Date(updated!.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(snippet.updated_at).getTime())
    })

    it('should preserve unchanged fields', () => {
      const store = useTemplateStore()
      const snippet = store.createSnippet({
        name: 'Original',
        sql: 'SELECT 1',
        category: 'query',
        tags: ['test']
      })

      const updated = store.updateSnippet({
        id: snippet.id,
        name: 'Updated'
      })

      expect(updated!.sql).toBe('SELECT 1')
      expect(updated!.tags).toEqual(['test'])
    })

    it('should return null for non-existent snippet', () => {
      const store = useTemplateStore()

      const updated = store.updateSnippet({
        id: 'non-existent',
        name: 'Updated'
      })

      expect(updated).toBeNull()
    })

    it('should not update builtin snippets', () => {
      const store = useTemplateStore()
      const builtinId = store.builtinSnippets[0].id

      const updated = store.updateSnippet({
        id: builtinId,
        name: 'Modified'
      })

      expect(updated).toBeNull()
    })
  })

  describe('deleteSnippet', () => {
    it('should delete custom snippet', () => {
      const store = useTemplateStore()
      const snippet = store.createSnippet({
        name: 'To Delete',
        sql: 'SELECT 1',
        category: 'query'
      })

      const result = store.deleteSnippet(snippet.id)

      expect(result).toBe(true)
      expect(store.customSnippets).not.toContain(snippet)
    })

    it('should return false for non-existent snippet', () => {
      const store = useTemplateStore()

      const result = store.deleteSnippet('non-existent')

      expect(result).toBe(false)
    })

    it('should not delete builtin snippets', () => {
      const store = useTemplateStore()
      const builtinId = store.builtinSnippets[0].id
      const builtinCount = store.builtinSnippets.length

      const result = store.deleteSnippet(builtinId)

      expect(result).toBe(false)
      expect(store.builtinSnippets.length).toBe(builtinCount)
    })
  })

  describe('getSnippetById', () => {
    it('should return snippet by id', () => {
      const store = useTemplateStore()
      const builtin = store.builtinSnippets[0]

      const result = store.getSnippetById(builtin.id)

      expect(result).toEqual(builtin)
    })

    it('should return custom snippet by id', () => {
      const store = useTemplateStore()
      const custom = store.createSnippet({
        name: 'Custom',
        sql: 'SELECT 1',
        category: 'query'
      })

      const result = store.getSnippetById(custom.id)

      expect(result).toEqual(custom)
    })

    it('should return undefined for non-existent id', () => {
      const store = useTemplateStore()

      const result = store.getSnippetById('non-existent')

      expect(result).toBeUndefined()
    })
  })

  describe('filter methods', () => {
    it('setSearchKeyword should update keyword', () => {
      const store = useTemplateStore()

      store.setSearchKeyword('test query')

      expect(store.searchKeyword).toBe('test query')
    })

    it('setSelectedCategory should update category', () => {
      const store = useTemplateStore()

      store.setSelectedCategory('ddl')

      expect(store.selectedCategory).toBe('ddl')
    })

    it('setSelectedType should update type', () => {
      const store = useTemplateStore()

      store.setSelectedType('custom')

      expect(store.selectedType).toBe('custom')
    })

    it('setSelectedTag should update tag', () => {
      const store = useTemplateStore()

      store.setSelectedTag('test-tag')

      expect(store.selectedTag).toBe('test-tag')
    })

    it('clearFilters should reset all filters', () => {
      const store = useTemplateStore()
      store.searchKeyword = 'test'
      store.selectedCategory = 'query'
      store.selectedType = 'builtin'
      store.selectedTag = 'tag'

      store.clearFilters()

      expect(store.searchKeyword).toBe('')
      expect(store.selectedCategory).toBeNull()
      expect(store.selectedType).toBeNull()
      expect(store.selectedTag).toBeNull()
    })
  })

  describe('panel methods', () => {
    it('togglePanel should toggle panel state', () => {
      const store = useTemplateStore()
      expect(store.isPanelOpen).toBe(false)

      store.togglePanel()

      expect(store.isPanelOpen).toBe(true)

      store.togglePanel()

      expect(store.isPanelOpen).toBe(false)
    })

    it('openPanel should open panel', () => {
      const store = useTemplateStore()

      store.openPanel()

      expect(store.isPanelOpen).toBe(true)
    })

    it('closePanel should close panel', () => {
      const store = useTemplateStore()
      store.isPanelOpen = true

      store.closePanel()

      expect(store.isPanelOpen).toBe(false)
    })
  })

  describe('fillTemplate', () => {
    it('should replace variables in snippet SQL', () => {
      const store = useTemplateStore()
      const snippet: Snippet = {
        id: '1',
        name: 'Test',
        sql: 'SELECT * FROM {{table_name}} WHERE id = {{id}}',
        category: 'query',
        type: 'builtin',
        tags: [],
        created_at: '',
        updated_at: ''
      }

      const result = store.fillTemplate(snippet, { table_name: 'users', id: '123' })

      expect(result).toBe('SELECT * FROM users WHERE id = 123')
    })

    it('should handle spaces in variable syntax', () => {
      const store = useTemplateStore()
      const snippet: Snippet = {
        id: '1',
        name: 'Test',
        sql: 'SELECT * FROM {{ table_name }}',
        category: 'query',
        type: 'builtin',
        tags: [],
        created_at: '',
        updated_at: ''
      }

      const result = store.fillTemplate(snippet, { table_name: 'products' })

      expect(result).toBe('SELECT * FROM products')
    })

    it('should leave unfilled variables', () => {
      const store = useTemplateStore()
      const snippet: Snippet = {
        id: '1',
        name: 'Test',
        sql: 'SELECT * FROM {{table}} WHERE {{condition}}',
        category: 'query',
        type: 'builtin',
        tags: [],
        created_at: '',
        updated_at: ''
      }

      const result = store.fillTemplate(snippet, { table: 'users' })

      expect(result).toBe('SELECT * FROM users WHERE {{condition}}')
    })
  })
})
