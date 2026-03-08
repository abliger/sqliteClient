import { describe, it, expect } from 'vitest'
import {
    validateIdentifier,
    quoteTableName,
    quoteColumnName,
    escapeLikePattern,
    isSelectQuery,
    isReadOnlyQuery,
    validateOrderDirection,
    validateLimit,
    validateOffset,
} from './sql'

describe('SQL Utils', () => {
    describe('validateIdentifier', () => {
        it('should return quoted identifier for valid name', () => {
            expect(validateIdentifier('users')).toBe('"users"')
            expect(validateIdentifier('user_id')).toBe('"user_id"')
        })

        it('should handle keywords', () => {
            expect(validateIdentifier('SELECT')).toBe('"SELECT"')
            expect(validateIdentifier('order')).toBe('"order"')
        })

        it('should throw for invalid identifiers', () => {
            expect(() => validateIdentifier('')).toThrow('Invalid identifier')
            expect(() => validateIdentifier('123abc')).toThrow('Invalid SQL identifier')
            expect(() => validateIdentifier('name-with-dash')).toThrow('Invalid SQL identifier')
            expect(() => validateIdentifier('name.with.dot')).toThrow('Invalid SQL identifier')
        })

        it('should throw for non-string values', () => {
            expect(() => validateIdentifier(null as any)).toThrow('Invalid identifier')
            expect(() => validateIdentifier(undefined as any)).toThrow('Invalid identifier')
        })
    })

    describe('quoteTableName', () => {
        it('should quote table name', () => {
            expect(quoteTableName('users')).toBe('"users"')
        })

        it('should escape double quotes', () => {
            expect(quoteTableName('user"data')).toBe('"user""data"')
        })
    })

    describe('quoteColumnName', () => {
        it('should quote column name', () => {
            expect(quoteColumnName('id')).toBe('"id"')
        })

        it('should escape double quotes', () => {
            expect(quoteColumnName('user"name')).toBe('"user""name"')
        })
    })

    describe('escapeLikePattern', () => {
        it('should escape special characters', () => {
            expect(escapeLikePattern('100%')).toBe('100\\%')
            expect(escapeLikePattern('test_')).toBe('test\\_')
        })

        it('should escape backslashes', () => {
            expect(escapeLikePattern('path\\file')).toBe('path\\\\file')
        })

        it('should handle multiple special characters', () => {
            expect(escapeLikePattern('%test_value%')).toBe('\\%test\\_value\\%')
        })
    })

    describe('isSelectQuery', () => {
        it('should identify SELECT queries', () => {
            expect(isSelectQuery('SELECT * FROM users')).toBe(true)
            expect(isSelectQuery('select id from users')).toBe(true)
        })

        it('should identify WITH queries (CTEs)', () => {
            expect(isSelectQuery('WITH cte AS (SELECT * FROM users) SELECT * FROM cte')).toBe(true)
        })

        it('should identify EXPLAIN queries', () => {
            expect(isSelectQuery('EXPLAIN SELECT * FROM users')).toBe(true)
            expect(isSelectQuery('EXPLAIN QUERY PLAN SELECT * FROM users')).toBe(true)
        })

        it('should reject non-SELECT queries', () => {
            expect(isSelectQuery('INSERT INTO users VALUES (1)')).toBe(false)
            expect(isSelectQuery('UPDATE users SET name = "test"')).toBe(false)
            expect(isSelectQuery('DELETE FROM users')).toBe(false)
            expect(isSelectQuery('CREATE TABLE users (id INT)')).toBe(false)
        })
    })

    describe('isReadOnlyQuery', () => {
        it('should allow SELECT', () => {
            expect(isReadOnlyQuery('SELECT * FROM users')).toBe(true)
        })

        it('should allow PRAGMA (read-only)', () => {
            expect(isReadOnlyQuery('PRAGMA table_info(users)')).toBe(true)
            expect(isReadOnlyQuery('PRAGMA foreign_keys')).toBe(true)
        })

        it('should allow WITH', () => {
            expect(isReadOnlyQuery('WITH cte AS (SELECT 1) SELECT * FROM cte')).toBe(true)
        })

        it('should reject modifying queries', () => {
            expect(isReadOnlyQuery('INSERT INTO users VALUES (1)')).toBe(false)
            expect(isReadOnlyQuery('UPDATE users SET name = "test"')).toBe(false)
            expect(isReadOnlyQuery('DELETE FROM users')).toBe(false)
            expect(isReadOnlyQuery('DROP TABLE users')).toBe(false)
        })
    })

    describe('validateOrderDirection', () => {
        it('should accept ASC', () => {
            expect(validateOrderDirection('ASC')).toBe('ASC')
            expect(validateOrderDirection('asc')).toBe('ASC')
        })

        it('should accept DESC', () => {
            expect(validateOrderDirection('DESC')).toBe('DESC')
            expect(validateOrderDirection('desc')).toBe('DESC')
        })

        it('should throw for invalid direction', () => {
            expect(() => validateOrderDirection('INVALID')).toThrow('Invalid order direction')
            expect(() => validateOrderDirection('')).toThrow('Invalid order direction')
        })
    })

    describe('validateLimit', () => {
        it('should accept valid limits', () => {
            expect(validateLimit(0)).toBe(0)
            expect(validateLimit(100)).toBe(100)
            expect(validateLimit(100000)).toBe(100000)
        })

        it('should throw for negative limits', () => {
            expect(() => validateLimit(-1)).toThrow('Invalid limit')
        })

        it('should throw for non-integers', () => {
            expect(() => validateLimit(1.5)).toThrow('Invalid limit')
        })

        it('should throw for limits exceeding max', () => {
            expect(() => validateLimit(100001)).toThrow('Invalid limit')
        })
    })

    describe('validateOffset', () => {
        it('should accept valid offsets', () => {
            expect(validateOffset(0)).toBe(0)
            expect(validateOffset(100)).toBe(100)
        })

        it('should throw for negative offsets', () => {
            expect(() => validateOffset(-1)).toThrow('Invalid offset')
        })

        it('should throw for non-integers', () => {
            expect(() => validateOffset(1.5)).toThrow('Invalid offset')
        })
    })
})
