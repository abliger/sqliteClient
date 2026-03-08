import { describe, it, expect } from 'vitest'
import {
    DatabaseError,
    ConnectionError,
    QueryError,
    ValidationError,
    NotFoundError,
    formatError,
} from './errors'

describe('Error Classes', () => {
    describe('DatabaseError', () => {
        it('should create error with message and code', () => {
            const error = new DatabaseError('Test error', 'TEST_CODE')
            expect(error.message).toBe('Test error')
            expect(error.code).toBe('TEST_CODE')
            expect(error.name).toBe('DatabaseError')
        })

        it('should preserve original error', () => {
            const original = new Error('Original')
            const error = new DatabaseError('Wrapped', 'WRAP', original)
            expect(error.originalError).toBe(original)
        })
    })

    describe('ConnectionError', () => {
        it('should have correct name and code', () => {
            const error = new ConnectionError('Connection failed')
            expect(error.name).toBe('ConnectionError')
            expect(error.code).toBe('CONNECTION_ERROR')
            expect(error.message).toBe('Connection failed')
        })
    })

    describe('QueryError', () => {
        it('should have correct name and code', () => {
            const error = new QueryError('Query failed')
            expect(error.name).toBe('QueryError')
            expect(error.code).toBe('QUERY_ERROR')
        })
    })

    describe('ValidationError', () => {
        it('should have correct name and code', () => {
            const error = new ValidationError('Invalid input')
            expect(error.name).toBe('ValidationError')
            expect(error.code).toBe('VALIDATION_ERROR')
        })
    })

    describe('NotFoundError', () => {
        it('should have correct name and code', () => {
            const error = new NotFoundError('Resource not found')
            expect(error.name).toBe('NotFoundError')
            expect(error.code).toBe('NOT_FOUND')
        })
    })

    describe('formatError', () => {
        it('should format DatabaseError', () => {
            const error = new DatabaseError('DB Error', 'DB_CODE')
            expect(formatError(error)).toBe('DB Error')
        })

        it('should format generic Error', () => {
            const error = new Error('Generic error')
            expect(formatError(error)).toBe('Generic error')
        })

        it('should format non-error values', () => {
            expect(formatError('string error')).toBe('string error')
            expect(formatError(123)).toBe('123')
            expect(formatError(null)).toBe('null')
        })
    })
})
