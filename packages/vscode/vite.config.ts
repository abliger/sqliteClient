import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path from 'path'

const uiSrc = path.resolve(__dirname, '../ui/src')
const mocksDir = path.resolve(__dirname, 'src/webview-ui/mocks')

export default defineConfig({
    plugins: [vue(), vueJsx()],
    root: path.resolve(__dirname, 'src/webview-ui'),
    base: '',
    build: {
        outDir: path.resolve(__dirname, 'dist/webview'),
        emptyOutDir: true,
        rollupOptions: {
            external: ['vscode'],
            input: path.resolve(__dirname, 'src/webview-ui/index.html'),
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: (assetInfo) => {
                    const info = assetInfo.name || ''
                    if (info.endsWith('.css')) return 'assets/[name][extname]'
                    return 'assets/[name][extname]'
                },
            },
        },
        sourcemap: true,
        commonjsOptions: {
            include: [/node_modules/],
        },
    },
    resolve: {
        alias: {
            // Tauri API mocks (使用绝对路径)
            '@tauri-apps/api/core': mocksDir + '/tauri-apps-api-core.ts',
            '@tauri-apps/api/primitives': mocksDir + '/tauri.ts',
            '@tauri-apps/plugin-dialog': mocksDir + '/tauri-apps-plugin-dialog.ts',
            '@tauri-apps/plugin-fs': mocksDir + '/tauri-apps-plugin-fs.ts',
            
            // UI package aliases
            '@': uiSrc,
            '@components': path.join(uiSrc, 'components'),
            '@stores': path.join(uiSrc, 'stores'),
            '@services': path.join(uiSrc, 'services'),
            '@types': path.join(uiSrc, 'types'),
            '@composables': path.join(uiSrc, 'composables'),
            '@i18n': path.join(uiSrc, 'i18n'),
            '@directives': path.join(uiSrc, 'directives'),
            '@utils': path.join(uiSrc, 'utils'),
        },
        dedupe: ['vue', 'pinia'],
    },
    optimizeDeps: {
        include: ['vue', 'pinia', 'vue-i18n'],
    },
    css: {
        devSourcemap: true,
    },
})
