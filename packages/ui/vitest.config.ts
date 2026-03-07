import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
    plugins: [vue()],
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        setupFiles: ['./src/test/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'src/**/*.{test,spec}.ts', 'src/main.ts', 'src/**/*.d.ts'],
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@components': resolve(__dirname, 'src/components'),
            '@stores': resolve(__dirname, 'src/stores'),
            '@services': resolve(__dirname, 'src/services'),
            '@types': resolve(__dirname, 'src/types'),
            '@composables': resolve(__dirname, 'src/composables'),
            '@i18n': resolve(__dirname, 'src/i18n'),
        },
    },
})
