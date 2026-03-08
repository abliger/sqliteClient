import { config } from '@vue/test-utils'
import { expect, vi } from 'vitest'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: vi.fn(),
}))

// Mock window.matchMedia for monaco theme detection
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

// Mock vue-i18n useI18n
vi.mock('vue-i18n', async (importOriginal) => {
    const actual = await importOriginal<typeof import('vue-i18n')>()
    return {
        ...actual,
        useI18n: () => ({
            t: (key: string) => key,
            locale: { value: 'en' },
        }),
    }
})

// Global test configuration
config.global.stubs = {
    // Stub router-link and other common components
    'router-link': true,
    'router-view': true,
}

// Extend matchers
expect.extend({
    toBeWithinRange(received: number, floor: number, ceiling: number) {
        const pass = received >= floor && received <= ceiling
        if (pass) {
            return {
                message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true,
            }
        } else {
            return {
                message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false,
            }
        }
    },
})
