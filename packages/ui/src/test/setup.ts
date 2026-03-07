import { config } from '@vue/test-utils'
import { expect, vi } from 'vitest'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: vi.fn(),
}))

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
