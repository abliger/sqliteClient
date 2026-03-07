<template>
    <div class="sqlite-client-vscode">
        <MainLayout />
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import MainLayout from '@components/layout/MainLayout.vue'
import { useConnectionStore } from '@stores/connection'

const connectionStore = useConnectionStore()

onMounted(() => {
    // Listen for messages from extension
    window.addEventListener('message', async (event) => {
        const message = event.data
        if (message.type === 'openDatabase' && message.path) {
            const name = message.path.split('/').pop() || message.path
            await connectionStore.createConnection(name, message.path)
        }
    })
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
