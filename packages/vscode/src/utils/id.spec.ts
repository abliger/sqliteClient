import { describe, it, expect } from 'vitest'
import { generateId, generateUUID, generateShortId } from './id'

describe('ID Utils', () => {
    describe('generateId', () => {
        it('should generate unique IDs', () => {
            const id1 = generateId()
            const id2 = generateId()
            expect(id1).not.toBe(id2)
        })

        it('should generate string ID', () => {
            const id = generateId()
            expect(typeof id).toBe('string')
            expect(id.length).toBeGreaterThan(0)
        })

        it('should contain timestamp, counter and random parts', () => {
            const id = generateId()
            const parts = id.split('-')
            expect(parts.length).toBe(3)
        })
    })

    describe('generateUUID', () => {
        it('should generate valid UUID format', () => {
            const uuid = generateUUID()
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            expect(uuid).toMatch(uuidRegex)
        })

        it('should generate unique UUIDs', () => {
            const uuid1 = generateUUID()
            const uuid2 = generateUUID()
            expect(uuid1).not.toBe(uuid2)
        })
    })

    describe('generateShortId', () => {
        it('should generate short unique IDs', () => {
            const id1 = generateShortId()
            const id2 = generateShortId()
            expect(id1).not.toBe(id2)
        })

        it('should contain timestamp and random parts', () => {
            const id = generateShortId()
            const parts = id.split('-')
            expect(parts.length).toBe(2)
        })
    })
})
