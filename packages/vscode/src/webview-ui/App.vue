<template>
    <div class="sqlite-client-vscode">
        <MainLayout />
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import MainLayout from '@components/layout/MainLayout.vue'
import { useConnectionStore } from '@stores/connection'

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
.sqlite-client-vscode > div {
    height: 100%;
    width: 100%;
}
</style>
