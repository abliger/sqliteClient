import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from './toast'

describe('Toast Store', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        setActivePinia(createPinia())
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should initialize with empty toasts', () => {
        const store = useToastStore()
        expect(store.toasts).toEqual([])
    })

    it('should add a success toast', () => {
        const store = useToastStore()

        store.success('Operation successful')

        expect(store.toasts).toHaveLength(1)
        expect(store.toasts[0].title).toBe('Operation successful')
        expect(store.toasts[0].type).toBe('success')
    })

    it('should add an error toast', () => {
        const store = useToastStore()

        store.error('Something went wrong')

        expect(store.toasts).toHaveLength(1)
        expect(store.toasts[0].title).toBe('Something went wrong')
        expect(store.toasts[0].type).toBe('error')
    })

    it('should add an info toast', () => {
        const store = useToastStore()

        store.info('Information message')

        expect(store.toasts).toHaveLength(1)
        expect(store.toasts[0].title).toBe('Information message')
        expect(store.toasts[0].type).toBe('info')
    })

    it('should add a warning toast', () => {
        const store = useToastStore()

        store.warning('Warning message')

        expect(store.toasts).toHaveLength(1)
        expect(store.toasts[0].title).toBe('Warning message')
        expect(store.toasts[0].type).toBe('warning')
    })

    it('should add a toast with message', () => {
        const store = useToastStore()

        store.success('Title', 'Message text')

        expect(store.toasts[0].title).toBe('Title')
        expect(store.toasts[0].message).toBe('Message text')
    })

    it('should remove a toast by id', () => {
        const store = useToastStore()
        store.success('Test message')
        const toastId = store.toasts[0].id

        store.removeToast(toastId)

        expect(store.toasts).toHaveLength(0)
    })

    it('should auto-remove toast after duration', () => {
        const store = useToastStore()

        store.success('Auto remove', undefined, 1000)
        expect(store.toasts).toHaveLength(1)

        vi.advanceTimersByTime(1001)

        expect(store.toasts).toHaveLength(0)
    })

    it('should limit maximum toasts', () => {
        const store = useToastStore()

        // Add more than MAX_TOASTS (5)
        for (let i = 0; i < 7; i++) {
            store.success(`Message ${i}`)
        }

        expect(store.toasts.length).toBeLessThanOrEqual(5)
    })
})
