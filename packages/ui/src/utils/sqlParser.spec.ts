import { describe, it, expect } from 'vitest'
import {
    extractTableNames,
    extractPrimaryTableName,
    isSelectQuery,
    isEditableQuery,
    generateWhereClause,
} from './sqlParser'

describe('sqlParser', () => {
    describe('extractTableNames', () => {
        it('should extract table from simple SELECT', () => {
            const sql = 'SELECT * FROM users'
            expect(extractTableNames(sql)).toEqual(['users'])
        })

        it('should extract table from SELECT with quotes', () => {
            const sql = 'SELECT * FROM "users"'
            expect(extractTableNames(sql)).toEqual(['users'])
        })

        it('should extract tables from JOIN', () => {
            const sql = 'SELECT * FROM users JOIN orders ON users.id = orders.user_id'
            expect(extractTableNames(sql)).toEqual(['users', 'orders'])
        })

        it('should extract table from UPDATE', () => {
            const sql = 'UPDATE users SET name = "John" WHERE id = 1'
            expect(extractTableNames(sql)).toEqual(['users'])
        })

        it('should extract table from INSERT', () => {
            const sql = 'INSERT INTO users (name) VALUES ("John")'
            expect(extractTableNames(sql)).toEqual(['users'])
        })

        it('should handle multiple JOINs', () => {
            const sql = `
                SELECT * FROM users 
                JOIN orders ON users.id = orders.user_id 
                JOIN products ON orders.product_id = products.id
            `
            expect(extractTableNames(sql)).toEqual(['users', 'orders', 'products'])
        })

        it('should return empty array for invalid SQL', () => {
            expect(extractTableNames('')).toEqual([])
            expect(extractTableNames(null as unknown as string)).toEqual([])
            expect(extractTableNames(undefined as unknown as string)).toEqual([])
        })

        it('should remove duplicates', () => {
            const sql = 'SELECT * FROM users JOIN users ON users.id = users.id'
            expect(extractTableNames(sql)).toEqual(['users'])
        })

        it('should handle SQL with comments', () => {
            const sql = `
                -- Get all users
                SELECT * FROM users /* active only */
                WHERE status = 'active'
            `
            expect(extractTableNames(sql)).toEqual(['users'])
        })
    })

    describe('extractPrimaryTableName', () => {
        it('should return single table name', () => {
            expect(extractPrimaryTableName('SELECT * FROM users')).toBe('users')
        })

        it('should return first FROM table for JOINs', () => {
            const sql = 'SELECT * FROM users JOIN orders ON users.id = orders.user_id'
            expect(extractPrimaryTableName(sql)).toBe('users')
        })

        it('should return null for empty SQL', () => {
            expect(extractPrimaryTableName('')).toBeNull()
        })
    })

    describe('isSelectQuery', () => {
        it('should return true for SELECT', () => {
            expect(isSelectQuery('SELECT * FROM users')).toBe(true)
        })

        it('should return true for lowercase select', () => {
            expect(isSelectQuery('select * from users')).toBe(true)
        })

        it('should return false for UPDATE', () => {
            expect(isSelectQuery('UPDATE users SET name = "John"')).toBe(false)
        })

        it('should return false for empty', () => {
            expect(isSelectQuery('')).toBe(false)
        })

        it('should handle SQL with leading comments', () => {
            const sql = '-- comment\nSELECT * FROM users'
            expect(isSelectQuery(sql)).toBe(true)
        })
    })

    describe('isEditableQuery', () => {
        it('should return true for simple SELECT', () => {
            expect(isEditableQuery('SELECT * FROM users')).toBe(true)
        })

        it('should return true for SELECT with WHERE', () => {
            expect(isEditableQuery('SELECT * FROM users WHERE id = 1')).toBe(true)
        })

        it('should return false for JOIN', () => {
            expect(
                isEditableQuery('SELECT * FROM users JOIN orders ON users.id = orders.user_id'),
            ).toBe(false)
        })

        it('should return false for GROUP BY', () => {
            expect(isEditableQuery('SELECT status, COUNT(*) FROM users GROUP BY status')).toBe(
                false,
            )
        })

        it('should return false for aggregate functions', () => {
            expect(isEditableQuery('SELECT COUNT(*) FROM users')).toBe(false)
            expect(isEditableQuery('SELECT SUM(amount) FROM orders')).toBe(false)
        })

        it('should return false for DISTINCT', () => {
            expect(isEditableQuery('SELECT DISTINCT name FROM users')).toBe(false)
        })

        it('should return false for non-SELECT', () => {
            expect(isEditableQuery('UPDATE users SET name = "John"')).toBe(false)
        })
    })

    describe('generateWhereClause', () => {
        it('should use primary key when provided', () => {
            const columns = { id: 1, name: 'John' }
            const result = generateWhereClause(columns, 'id')
            expect(result.clause).toBe('"id" = ?')
            expect(result.params).toEqual([1])
        })

        it('should use all non-null columns without primary key', () => {
            const columns = { id: 1, name: 'John', age: null }
            const result = generateWhereClause(columns)
            expect(result.clause).toBe('"id" = ? AND "name" = ?')
            expect(result.params).toEqual([1, 'John'])
        })

        it('should handle undefined values', () => {
            const columns = { id: 1, name: undefined, age: 25 }
            const result = generateWhereClause(columns)
            expect(result.clause).toBe('"id" = ? AND "age" = ?')
            expect(result.params).toEqual([1, 25])
        })
    })
})
