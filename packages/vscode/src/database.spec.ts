import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from './database'
import * as vscode from 'vscode'

// Mock vscode
vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: undefined,
    },
}))

// Mock better-sqlite3
const mockPrepare = vi.fn()
const mockRun = vi.fn()
const mockAll = vi.fn()
const mockGet = vi.fn()
const mockColumns = vi.fn()
const mockPragma = vi.fn()
const mockClose = vi.fn()
const mockTransaction = vi.fn()

vi.mock('better-sqlite3', () => ({
    default: vi.fn().mockImplementation(() => ({
        prepare: mockPrepare,
        pragma: mockPragma,
        close: mockClose,
        transaction: mockTransaction,
    })),
}))

// Mock fs
vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue('[]'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
}))

// Mock os
vi.mock('os', () => ({
    homedir: vi.fn().mockReturnValue('/home/user'),
}))

describe('DatabaseManager', () => {
    let manager: DatabaseManager

    beforeEach(() => {
        vi.clearAllMocks()
        mockPrepare.mockReturnValue({
            run: mockRun,
            all: mockAll,
            get: mockGet,
            columns: mockColumns,
        })
        mockPragma.mockReturnValue(4096) // page_size
        mockAll.mockReturnValue([])
        mockGet.mockReturnValue({ 'COUNT(*)': 0 })
        mockColumns.mockReturnValue([])
        mockTransaction.mockImplementation((fn) => fn)

        manager = new DatabaseManager()
    })

    afterEach(() => {
        manager.dispose()
    })

    describe('createConnection', () => {
        it('should create connection successfully', async () => {
            mockGet
                .mockReturnValueOnce({ 'COUNT(*)': 5 }) // table_count
                .mockReturnValueOnce({ 'COUNT(*)': 3 }) // index_count
                .mockReturnValueOnce({ 'COUNT(*)': 1 }) // trigger_count
                .mockReturnValueOnce({ version: '3.39.0' }) // version

            const result = await manager.createConnection('test', '/path/to/db.sqlite')

            expect(result.config.name).toBe('test')
            expect(result.config.db_path).toBe('/path/to/db.sqlite')
            expect(result.status).toBe('connected')
        })

        it('should throw error for invalid database', async () => {
            const { default: Database } = await import('better-sqlite3')
            vi.mocked(Database).mockImplementationOnce(() => {
                throw new Error('Unable to open database')
            })

            await expect(
                manager.createConnection('test', '/invalid/path.db'),
            ).rejects.toThrow('Failed to connect to database')
        })
    })

    describe('closeConnection', () => {
        it('should close connection and remove from map', async () => {
            mockGet
                .mockReturnValueOnce({ 'COUNT(*)': 5 })
                .mockReturnValueOnce({ 'COUNT(*)': 3 })
                .mockReturnValueOnce({ 'COUNT(*)': 1 })
                .mockReturnValueOnce({ version: '3.39.0' })

            const conn = await manager.createConnection('test', '/path/to/db.sqlite')
            await manager.closeConnection(conn.config.id)

            expect(mockClose).toHaveBeenCalled()
        })
    })

    describe('executeQuery', () => {
        it('should execute SELECT query', async () => {
            // Setup connection creation mocks
            mockGet
                .mockReturnValueOnce({ 'COUNT(*)': 5 })
                .mockReturnValueOnce({ 'COUNT(*)': 3 })
                .mockReturnValueOnce({ 'COUNT(*)': 1 })
                .mockReturnValueOnce({ version: '3.39.0' })

            const conn = await manager.createConnection('test', '/path/to/db.sqlite')

            // Setup query execution mocks
            mockAll.mockReturnValueOnce([
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
            ])
            mockColumns.mockReturnValueOnce([{ name: 'id' }, { name: 'name' }])

            const result = await manager.executeQuery(conn.config.id, 'SELECT * FROM users', 100)

            expect(result.type).toBe('rows')
            if (result.type === 'rows') {
                expect(result.columns).toEqual(['id', 'name'])
                expect(result.rows).toHaveLength(2)
            }
        })

        it('should execute INSERT query', async () => {
            // Setup connection creation mocks
            mockGet
                .mockReturnValueOnce({ 'COUNT(*)': 5 })
                .mockReturnValueOnce({ 'COUNT(*)': 3 })
                .mockReturnValueOnce({ 'COUNT(*)': 1 })
                .mockReturnValueOnce({ version: '3.39.0' })

            const conn = await manager.createConnection('test', '/path/to/db.sqlite')

            // Setup query execution mocks
            mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 123 })

            const result = await manager.executeQuery(conn.config.id, 'INSERT INTO users VALUES (1)', 100)

            expect(result.type).toBe('execution')
            if (result.type === 'execution') {
                expect(result.rows_affected).toBe(1)
                expect(result.last_insert_id).toBe(123)
            }
        })

        it('should throw for non-existent connection', async () => {
            await expect(
                manager.executeQuery('invalid-id', 'SELECT 1', 100),
            ).rejects.toThrow('Connection not found')
        })
    })

    describe('listTables', () => {
        it('should list all tables', async () => {
            // Setup connection creation mocks
            mockGet
                .mockReturnValueOnce({ 'COUNT(*)': 5 })
                .mockReturnValueOnce({ 'COUNT(*)': 3 })
                .mockReturnValueOnce({ 'COUNT(*)': 1 })
                .mockReturnValueOnce({ version: '3.39.0' })

            const conn = await manager.createConnection('test', '/path/to/db.sqlite')

            // Setup listTables mocks
            mockAll.mockReturnValueOnce([
                { name: 'users', sql: 'CREATE TABLE users...' },
                { name: 'orders', sql: 'CREATE TABLE orders...' },
            ])

            const tables = await manager.listTables(conn.config.id)

            expect(tables).toHaveLength(2)
            expect(tables[0].name).toBe('users')
            expect(tables[1].name).toBe('orders')
        })
    })

    describe('getTableSchema', () => {
        it('should get table schema with columns', async () => {
            // Setup connection creation mocks
            mockGet
                .mockReturnValueOnce({ 'COUNT(*)': 5 })
                .mockReturnValueOnce({ 'COUNT(*)': 3 })
                .mockReturnValueOnce({ 'COUNT(*)': 1 })
                .mockReturnValueOnce({ version: '3.39.0' })

            const conn = await manager.createConnection('test', '/path/to/db.sqlite')

            // Setup getTableSchema mocks
            mockAll
                .mockReturnValueOnce([
                    { name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                    { name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                ])
                .mockReturnValueOnce([]) // foreign keys

            mockGet.mockReturnValueOnce({ 'COUNT(*)': 100 }) // row count

            const schema = await manager.getTableSchema(conn.config.id, 'users')

            expect(schema.name).toBe('users')
            expect(schema.columns).toHaveLength(2)
            expect(schema.columns[0].name).toBe('id')
            expect(schema.columns[0].is_primary_key).toBe(true)
        })
    })

    describe('query history', () => {
        it('should add query to history on execute', async () => {
            // Setup connection creation mocks
            mockGet
                .mockReturnValueOnce({ 'COUNT(*)': 5 })
                .mockReturnValueOnce({ 'COUNT(*)': 3 })
                .mockReturnValueOnce({ 'COUNT(*)': 1 })
                .mockReturnValueOnce({ version: '3.39.0' })

            const conn = await manager.createConnection('test', '/path/to/db.sqlite')

            // Setup query execution mocks
            mockAll.mockReturnValueOnce([])
            mockColumns.mockReturnValueOnce([])

            await manager.executeQuery(conn.config.id, 'SELECT * FROM users', 100)

            const history = await manager.getQueryHistory()
            expect(history).toHaveLength(1)
            expect(history[0].sql).toBe('SELECT * FROM users')
        })

        it('should search history', async () => {
            // Setup connection creation mocks
            mockGet
                .mockReturnValueOnce({ 'COUNT(*)': 5 })
                .mockReturnValueOnce({ 'COUNT(*)': 3 })
                .mockReturnValueOnce({ 'COUNT(*)': 1 })
                .mockReturnValueOnce({ version: '3.39.0' })

            const conn = await manager.createConnection('test', '/path/to/db.sqlite')

            // Setup query execution mocks
            mockAll.mockReturnValueOnce([])
            mockColumns.mockReturnValueOnce([])

            mockAll.mockReturnValueOnce([])
            mockColumns.mockReturnValueOnce([])

            await manager.executeQuery(conn.config.id, 'SELECT * FROM users', 100)
            await manager.executeQuery(conn.config.id, 'SELECT * FROM orders', 100)

            const results = await manager.searchHistory('users')
            expect(results).toHaveLength(1)
            expect(results[0].sql).toContain('users')
        })

        it('should clear history', async () => {
            // Setup connection creation mocks
            mockGet
                .mockReturnValueOnce({ 'COUNT(*)': 5 })
                .mockReturnValueOnce({ 'COUNT(*)': 3 })
                .mockReturnValueOnce({ 'COUNT(*)': 1 })
                .mockReturnValueOnce({ version: '3.39.0' })

            const conn = await manager.createConnection('test', '/path/to/db.sqlite')

            // Setup query execution mocks
            mockAll.mockReturnValueOnce([])
            mockColumns.mockReturnValueOnce([])

            await manager.executeQuery(conn.config.id, 'SELECT 1', 100)
            const cleared = await manager.clearHistory()

            expect(cleared).toBe(1)
            const history = await manager.getQueryHistory()
            expect(history).toHaveLength(0)
        })
    })
})
