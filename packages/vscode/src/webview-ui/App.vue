<template>
    <div class="sqlite-client-vscode">
        <MainLayout />
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import MainLayout from '@components/layout/MainLayout.vue'
import { useConnectionStore } from '@stores/connection'
import { window } from 'vscode'

// 为 TypeScript 声明 vscode 全局对象
declare global {
    interface Window {
        vscode?: {
            postMessage: (message: any) => void
        }
    }
}

const connectionStore = useConnectionStore()

let messageHandler: ((event: MessageEvent) => void) | null = null

onMounted(() => {
    messageHandler = async (event: MessageEvent) => {
        const message = event.data
        if (message.type === 'openDatabase' && message.path) {
            const name = message.path.split('/').pop() || message.path
            try {
                await connectionStore.createConnection(name, message.path)
            } catch (error) {
                console.error('Failed to open database:', error)
            }
        }
    }

    window.addEventListener('message', messageHandler)

    // 通知后端 WebView 已就绪
    window.vscode?.postMessage({ type: 'webviewReady' })
    console.log('[App] Webview ready notified')
})

onUnmounted(() => {
    if (messageHandler) {
        window.removeEventListener('message', messageHandler)
    }
})
</script>

<style>
/* VSCode-specific styles */
.sqlite-client-vscode {
    height: 100vh;
    overflow: hidden;
}

/* Ensure the app fills the webview */
.sqlite-client-vscode,
.sqlite-client-vscode>div {
    height: 100%;
    width: 100%;
}
</style>
