import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
    plugins: [
        vue(),
        {
            name: 'worker-mock',
            enforce: 'pre',
            resolveId(id) {
                if (id.endsWith('?worker')) {
                    return { id: 'virtual:worker-mock', external: false }
                }
            },
            load(id) {
                if (id === 'virtual:worker-mock') {
                    return 'export default function() { return class MockWorker { postMessage() {} terminate() {} addEventListener() {} removeEventListener() {} } }'
                }
            },
        },
    ],
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
            '@utils': resolve(__dirname, 'src/utils'),
            'monaco-editor': resolve(__dirname, 'src/test/monaco-mock.ts'),
            'monaco-editor/esm/vs/editor/editor.worker?worker': resolve(__dirname, 'src/test/worker-mock.ts'),
            'monaco-editor/esm/vs/language/json/json.worker?worker': resolve(__dirname, 'src/test/worker-mock.ts'),
            'monaco-editor/esm/vs/language/css/css.worker?worker': resolve(__dirname, 'src/test/worker-mock.ts'),
            'monaco-editor/esm/vs/language/html/html.worker?worker': resolve(__dirname, 'src/test/worker-mock.ts'),
            'monaco-editor/esm/vs/language/typescript/ts.worker?worker': resolve(__dirname, 'src/test/worker-mock.ts'),
        },
    },
})
