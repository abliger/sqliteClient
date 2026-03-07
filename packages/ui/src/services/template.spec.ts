import { describe, it, expect } from 'vitest'
import type { Snippet, SnippetCategory, CreateSnippetRequest } from '@types'
import {
    extractVariables,
    fillTemplate,
    hasUnfilledVariables,
    getUnfilledVariableNames,
    filterSnippets,
    categorizeSnippets,
    getAllTags,
    formatSnippetSql,
    validateCreateRequest,
    validateUpdateRequest,
    generateDefaultVariables,
    exportSnippets,
    importSnippets,
    duplicateSnippet,
} from './template'

describe('templateService', () => {
    describe('extractVariables', () => {
        it('should extract variables from SQL template', () => {
            const sql = 'SELECT * FROM {{table_name}} WHERE id = {{id}}'
            const variables = extractVariables(sql)

            expect(variables).toHaveLength(2)
            expect(variables[0].name).toBe('table_name')
            expect(variables[1].name).toBe('id')
        })

        it('should handle spaces in variable syntax', () => {
            const sql = 'SELECT * FROM {{ table_name }} WHERE id = {{ id }}'
            const variables = extractVariables(sql)

            expect(variables).toHaveLength(2)
            expect(variables.map(v => v.name)).toContain('table_name')
            expect(variables.map(v => v.name)).toContain('id')
        })

        it('should deduplicate variables', () => {
            const sql = 'SELECT * FROM {{table}} WHERE id = {{table}}'
            const variables = extractVariables(sql)

            expect(variables).toHaveLength(1)
            expect(variables[0].name).toBe('table')
        })

        it('should return empty array when no variables', () => {
            const sql = 'SELECT * FROM users'
            const variables = extractVariables(sql)

            expect(variables).toEqual([])
        })

        it('should set default values for variables', () => {
            const sql = 'SELECT * FROM {{table_name}}'
            const variables = extractVariables(sql)

            expect(variables[0].description).toBe('')
            expect(variables[0].required).toBe(false)
        })
    })

    describe('fillTemplate', () => {
        it('should replace variables with values', () => {
            const template = 'SELECT * FROM {{table_name}} WHERE id = {{id}}'
            const result = fillTemplate(template, { table_name: 'users', id: '123' })

            expect(result).toBe('SELECT * FROM users WHERE id = 123')
        })

        it('should handle spaces in variable syntax', () => {
            const template = 'SELECT * FROM {{ table_name }}'
            const result = fillTemplate(template, { table_name: 'products' })

            expect(result).toBe('SELECT * FROM products')
        })

        it('should leave unfilled variables as is', () => {
            const template = 'SELECT * FROM {{table}} WHERE {{condition}}'
            const result = fillTemplate(template, { table: 'users' })

            expect(result).toBe('SELECT * FROM users WHERE {{condition}}')
        })

        it('should handle empty variables object', () => {
            const template = 'SELECT * FROM {{table}}'
            const result = fillTemplate(template, {})

            expect(result).toBe('SELECT * FROM {{table}}')
        })
    })

    describe('hasUnfilledVariables', () => {
        it('should return true when variables remain', () => {
            const sql = 'SELECT * FROM {{table}} WHERE id = {{id}}'
            expect(hasUnfilledVariables(sql)).toBe(true)
        })

        it('should return false when all variables filled', () => {
            const sql = 'SELECT * FROM users WHERE id = 123'
            expect(hasUnfilledVariables(sql)).toBe(false)
        })

        it('should return false for empty string', () => {
            expect(hasUnfilledVariables('')).toBe(false)
        })
    })

    describe('getUnfilledVariableNames', () => {
        it('should return list of unfilled variable names', () => {
            const sql = 'SELECT * FROM {{table}} WHERE {{column}} = {{value}}'
            const names = getUnfilledVariableNames(sql)

            expect(names).toEqual(['table', 'column', 'value'])
        })

        it('should deduplicate variable names', () => {
            const sql = '{{var}} AND {{var}}'
            const names = getUnfilledVariableNames(sql)

            expect(names).toEqual(['var'])
        })

        it('should return empty array when no variables', () => {
            const sql = 'SELECT * FROM users'
            const names = getUnfilledVariableNames(sql)

            expect(names).toEqual([])
        })
    })

    describe('filterSnippets', () => {
        const mockSnippets: Snippet[] = [
            {
                id: '1',
                name: 'Select All',
                sql: 'SELECT * FROM {{table}}',
                category: 'query' as SnippetCategory,
                type: 'builtin',
                tags: ['select', 'basic'],
                created_at: '',
                updated_at: '',
            },
            {
                id: '2',
                name: 'Insert Row',
                sql: 'INSERT INTO {{table}} VALUES',
                category: 'dml' as SnippetCategory,
                type: 'custom',
                tags: ['insert', 'basic'],
                created_at: '',
                updated_at: '',
            },
            {
                id: '3',
                name: 'Create Table',
                description: 'Create a new table',
                sql: 'CREATE TABLE {{name}}',
                category: 'ddl' as SnippetCategory,
                type: 'custom',
                tags: ['create', 'advanced'],
                created_at: '',
                updated_at: '',
            },
        ]

        it('should filter by type', () => {
            const result = filterSnippets(mockSnippets, { type: 'custom' })

            expect(result).toHaveLength(2)
            expect(result.every(s => s.type === 'custom')).toBe(true)
        })

        it('should filter by category', () => {
            const result = filterSnippets(mockSnippets, { category: 'query' })

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Select All')
        })

        it('should filter by tag', () => {
            const result = filterSnippets(mockSnippets, { tag: 'basic' })

            expect(result).toHaveLength(2)
        })

        it('should filter by keyword in name', () => {
            const result = filterSnippets(mockSnippets, { keyword: 'select' })

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Select All')
        })

        it('should filter by keyword in description', () => {
            const result = filterSnippets(mockSnippets, { keyword: 'Create a' })

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Create Table')
        })

        it('should filter by keyword in SQL', () => {
            const result = filterSnippets(mockSnippets, { keyword: 'INSERT' })

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Insert Row')
        })

        it('should filter by keyword in tags', () => {
            const result = filterSnippets(mockSnippets, { keyword: 'advanced' })

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Create Table')
        })

        it('should be case insensitive', () => {
            const result = filterSnippets(mockSnippets, { keyword: 'CREATE' })

            expect(result).toHaveLength(1)
        })

        it('should return all when no filter', () => {
            const result = filterSnippets(mockSnippets, {})

            expect(result).toHaveLength(3)
        })
    })

    describe('categorizeSnippets', () => {
        const mockSnippets: Snippet[] = [
            {
                id: '1',
                name: 'S1',
                category: 'query',
                type: 'builtin',
                tags: [],
                created_at: '',
                updated_at: '',
                sql: '',
            },
            {
                id: '2',
                name: 'S2',
                category: 'query',
                type: 'builtin',
                tags: [],
                created_at: '',
                updated_at: '',
                sql: '',
            },
            {
                id: '3',
                name: 'S3',
                category: 'dml',
                type: 'builtin',
                tags: [],
                created_at: '',
                updated_at: '',
                sql: '',
            },
            {
                id: '4',
                name: 'S4',
                category: 'ddl',
                type: 'builtin',
                tags: [],
                created_at: '',
                updated_at: '',
                sql: '',
            },
        ]

        it('should group snippets by category', () => {
            const result = categorizeSnippets(mockSnippets)

            expect(result.query).toHaveLength(2)
            expect(result.dml).toHaveLength(1)
            expect(result.ddl).toHaveLength(1)
            expect(result.function).toHaveLength(0)
            expect(result.other).toHaveLength(0)
        })

        it('should handle empty array', () => {
            const result = categorizeSnippets([])

            expect(result.query).toEqual([])
            expect(result.dml).toEqual([])
            expect(result.ddl).toEqual([])
        })
    })

    describe('getAllTags', () => {
        it('should return unique sorted tags', () => {
            const snippets: Snippet[] = [
                {
                    id: '1',
                    name: 'S1',
                    category: 'query',
                    type: 'builtin',
                    tags: ['tag1', 'tag2'],
                    created_at: '',
                    updated_at: '',
                    sql: '',
                },
                {
                    id: '2',
                    name: 'S2',
                    category: 'query',
                    type: 'builtin',
                    tags: ['tag2', 'tag3'],
                    created_at: '',
                    updated_at: '',
                    sql: '',
                },
            ]

            const result = getAllTags(snippets)

            expect(result).toEqual(['tag1', 'tag2', 'tag3'])
        })

        it('should return empty array for no snippets', () => {
            expect(getAllTags([])).toEqual([])
        })

        it('should handle snippets without tags', () => {
            const snippets: Snippet[] = [
                {
                    id: '1',
                    name: 'S1',
                    category: 'query',
                    type: 'builtin',
                    tags: [],
                    created_at: '',
                    updated_at: '',
                    sql: '',
                },
            ]

            expect(getAllTags(snippets)).toEqual([])
        })
    })

    describe('formatSnippetSql', () => {
        it('should trim trailing whitespace', () => {
            const sql = 'SELECT *   \nFROM users   '
            expect(formatSnippetSql(sql)).toBe('SELECT *\nFROM users')
        })

        it('should reduce multiple blank lines to two', () => {
            const sql = 'SELECT *\n\n\n\nFROM users'
            expect(formatSnippetSql(sql)).toBe('SELECT *\n\nFROM users')
        })

        it('should trim leading and trailing whitespace', () => {
            const sql = '  \nSELECT *\n  '
            expect(formatSnippetSql(sql)).toBe('SELECT *')
        })
    })

    describe('validateCreateRequest', () => {
        it('should validate valid request', () => {
            const request: CreateSnippetRequest = {
                name: 'Test Snippet',
                sql: 'SELECT * FROM users',
            }

            const result = validateCreateRequest(request)

            expect(result.valid).toBe(true)
            expect(result.error).toBeUndefined()
        })

        it('should reject empty name', () => {
            const request: CreateSnippetRequest = {
                name: '',
                sql: 'SELECT * FROM users',
            }

            const result = validateCreateRequest(request)

            expect(result.valid).toBe(false)
            expect(result.error).toContain('名称不能为空')
        })

        it('should reject whitespace-only name', () => {
            const request: CreateSnippetRequest = {
                name: '   ',
                sql: 'SELECT * FROM users',
            }

            const result = validateCreateRequest(request)

            expect(result.valid).toBe(false)
        })

        it('should reject name too long', () => {
            const request: CreateSnippetRequest = {
                name: 'a'.repeat(101),
                sql: 'SELECT * FROM users',
            }

            const result = validateCreateRequest(request)

            expect(result.valid).toBe(false)
            expect(result.error).toContain('100')
        })

        it('should reject empty SQL', () => {
            const request: CreateSnippetRequest = {
                name: 'Test',
                sql: '',
            }

            const result = validateCreateRequest(request)

            expect(result.valid).toBe(false)
            expect(result.error).toContain('SQL')
        })

        it('should reject SQL too long', () => {
            const request: CreateSnippetRequest = {
                name: 'Test',
                sql: 'x'.repeat(10001),
            }

            const result = validateCreateRequest(request)

            expect(result.valid).toBe(false)
            expect(result.error).toContain('10000')
        })

        it('should reject description too long', () => {
            const request: CreateSnippetRequest = {
                name: 'Test',
                sql: 'SELECT * FROM users',
                description: 'a'.repeat(501),
            }

            const result = validateCreateRequest(request)

            expect(result.valid).toBe(false)
            expect(result.error).toContain('500')
        })
    })

    describe('validateUpdateRequest', () => {
        it('should validate empty update', () => {
            const result = validateUpdateRequest({ id: '1' })

            expect(result.valid).toBe(true)
        })

        it('should reject empty name update', () => {
            const result = validateUpdateRequest({ id: '1', name: '' })

            expect(result.valid).toBe(false)
        })

        it('should validate name length', () => {
            const result = validateUpdateRequest({ id: '1', name: 'a'.repeat(101) })

            expect(result.valid).toBe(false)
        })

        it('should validate SQL length', () => {
            const result = validateUpdateRequest({ id: '1', sql: 'x'.repeat(10001) })

            expect(result.valid).toBe(false)
        })

        it('should allow partial updates', () => {
            const result = validateUpdateRequest({ id: '1', description: 'New description' })

            expect(result.valid).toBe(true)
        })
    })

    describe('generateDefaultVariables', () => {
        it('should use default values when provided', () => {
            const variables = [
                { name: 'table', description: '', default_value: 'users', required: false },
            ]

            const result = generateDefaultVariables(variables)

            expect(result).toEqual({ table: 'users' })
        })

        it('should use empty string for optional variables', () => {
            const variables = [{ name: 'limit', description: '', required: false }]

            const result = generateDefaultVariables(variables)

            expect(result).toEqual({ limit: '' })
        })

        it('should skip required variables without defaults', () => {
            const variables = [{ name: 'id', description: '', required: true }]

            const result = generateDefaultVariables(variables)

            expect(result).toEqual({})
        })

        it('should handle mixed variables', () => {
            const variables = [
                { name: 'table', description: '', default_value: 'users', required: false },
                { name: 'id', description: '', required: true },
                { name: 'limit', description: '', required: false },
            ]

            const result = generateDefaultVariables(variables)

            expect(result).toEqual({ table: 'users', limit: '' })
        })
    })

    describe('exportSnippets', () => {
        it('should export snippets as formatted JSON', () => {
            const snippets: Snippet[] = [
                {
                    id: '1',
                    name: 'Test',
                    sql: 'SELECT 1',
                    category: 'query',
                    type: 'builtin',
                    tags: [],
                    created_at: '2024-01-01',
                    updated_at: '2024-01-01',
                },
            ]

            const result = exportSnippets(snippets)

            expect(JSON.parse(result)).toEqual(snippets)
            expect(result).toContain('\n') // Formatted with indentation
        })
    })

    describe('importSnippets', () => {
        it('should import snippets from JSON', () => {
            const snippets: Snippet[] = [
                {
                    id: '1',
                    name: 'Test',
                    sql: 'SELECT 1',
                    category: 'query',
                    type: 'builtin',
                    tags: [],
                    created_at: '2024-01-01',
                    updated_at: '2024-01-01',
                },
            ]
            const json = JSON.stringify(snippets)

            const result = importSnippets(json)

            expect(result).toEqual(snippets)
        })

        it('should throw error for non-array data', () => {
            const json = JSON.stringify({ name: 'Not an array' })

            expect(() => importSnippets(json)).toThrow('数组')
        })
    })

    describe('duplicateSnippet', () => {
        it('should create a copy with new id and name', () => {
            const original: Snippet = {
                id: '1',
                name: 'Original',
                sql: 'SELECT 1',
                category: 'query',
                type: 'builtin',
                tags: ['tag1'],
                description: 'Description',
                created_at: '2024-01-01',
                updated_at: '2024-01-01',
            }

            const copy = duplicateSnippet(original, 'new-id')

            expect(copy.id).toBe('new-id')
            expect(copy.name).toBe('Original (副本)')
            expect(copy.type).toBe('custom')
            expect(copy.sql).toBe(original.sql)
            expect(copy.category).toBe(original.category)
            expect(copy.tags).toEqual(original.tags)
            expect(copy.description).toBe(original.description)
            expect(copy.created_at).not.toBe(original.created_at)
            expect(copy.updated_at).not.toBe(original.updated_at)
        })
    })
})
