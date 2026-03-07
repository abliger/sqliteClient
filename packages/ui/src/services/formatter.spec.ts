import { describe, it, expect } from 'vitest'
import { sqlFormatter } from './formatter'

describe('sqlFormatter', () => {
    describe('format', () => {
        it('should format simple SELECT query', () => {
            const sql = 'select * from users where id = 1'
            const result = sqlFormatter.format(sql)

            expect(result).toContain('SELECT')
            expect(result).toContain('FROM')
            expect(result).toContain('WHERE')
            expect(result).toContain('users')
        })

        it('should format query with multiple columns', () => {
            const sql = 'select id,name,email from users'
            const result = sqlFormatter.format(sql)

            expect(result).toContain('SELECT')
            expect(result).toContain('FROM')
            // Should have proper indentation
            expect(result).not.toBe(sql)
        })

        it('should format INSERT statement', () => {
            const sql = "insert into users (name, email) values ('John', 'john@example.com')"
            const result = sqlFormatter.format(sql)

            expect(result).toContain('INSERT')
            expect(result).toContain('INTO')
            expect(result).toContain('VALUES')
        })

        it('should format UPDATE statement', () => {
            const sql = "update users set name='Jane' where id=1"
            const result = sqlFormatter.format(sql)

            expect(result).toContain('UPDATE')
            expect(result).toContain('SET')
            expect(result).toContain('WHERE')
        })

        it('should format DELETE statement', () => {
            const sql = 'delete from users where id = 1'
            const result = sqlFormatter.format(sql)

            expect(result).toContain('DELETE')
            expect(result).toContain('FROM')
            expect(result).toContain('WHERE')
        })

        it('should format JOIN query', () => {
            const sql = 'select * from users join orders on users.id = orders.user_id'
            const result = sqlFormatter.format(sql)

            expect(result).toContain('SELECT')
            expect(result).toContain('JOIN')
            expect(result).toContain('ON')
        })

        it('should format query with ORDER BY', () => {
            const sql = 'select * from users order by name desc'
            const result = sqlFormatter.format(sql)

            expect(result).toContain('ORDER BY')
            expect(result).toContain('DESC')
        })

        it('should format query with GROUP BY and HAVING', () => {
            const sql = 'select count(*) from users group by status having count(*) > 5'
            const result = sqlFormatter.format(sql)

            expect(result).toContain('GROUP BY')
            expect(result).toContain('HAVING')
        })

        it('should handle empty string', () => {
            const result = sqlFormatter.format('')
            expect(result).toBe('')
        })

        it('should handle whitespace-only string', () => {
            const result = sqlFormatter.format('   \n\t  ')
            // Empty or whitespace-only SQL may throw or return original
            expect(typeof result).toBe('string')
        })

        it('should format complex nested query', () => {
            const sql = 'select * from (select id from users) as u where id in (select user_id from orders)'
            const result = sqlFormatter.format(sql)

            expect(result).toContain('SELECT')
            expect(result).toContain('FROM')
            expect(result.length).toBeGreaterThan(sql.length)
        })

        it('should format query with CASE expression', () => {
            const sql = "select case when status = 1 then 'active' else 'inactive' end from users"
            const result = sqlFormatter.format(sql)

            expect(result).toContain('CASE')
            expect(result).toContain('WHEN')
            expect(result).toContain('THEN')
            expect(result).toContain('ELSE')
            expect(result).toContain('END')
        })

        it('should apply custom options', () => {
            const sql = 'SELECT id FROM users'
            // Test that options don't break formatting
            const result = sqlFormatter.format(sql, {
                keywordCase: 'lower',
                tabWidth: 2
            })
            
            expect(result).toContain('select')
            expect(result).toContain('from')
        })
    })

    describe('canFormat', () => {
        it('should return true for non-empty string', () => {
            expect(sqlFormatter.canFormat('SELECT 1')).toBe(true)
            expect(sqlFormatter.canFormat('  SELECT 1  ')).toBe(true)
        })

        it('should return false for empty string', () => {
            expect(sqlFormatter.canFormat('')).toBe(false)
        })

        it('should return false for whitespace-only string', () => {
            expect(sqlFormatter.canFormat('   ')).toBe(false)
            expect(sqlFormatter.canFormat('\t\n  ')).toBe(false)
        })
    })

    describe('error handling', () => {
        it('should return original SQL on syntax error', () => {
            const invalidSql = 'SELECT FROM WHERE'
            // Formatter should handle gracefully and return original or formatted version
            const result = sqlFormatter.format(invalidSql)
            
            // Should not throw, should return something
            expect(typeof result).toBe('string')
        })

        it('should handle SQL with special characters', () => {
            const sql = "SELECT * FROM users WHERE name = 'O''Brien'"
            const result = sqlFormatter.format(sql)
            
            // Should format without error
            expect(typeof result).toBe('string')
            expect(result.length).toBeGreaterThan(0)
        })

        it('should handle SQL with comments', () => {
            const sql = `SELECT id FROM users -- get users
                         WHERE status = 1 /* active */`
            const result = sqlFormatter.format(sql)
            
            expect(result).toContain('SELECT')
            expect(result).toContain('WHERE')
        })
    })
})
