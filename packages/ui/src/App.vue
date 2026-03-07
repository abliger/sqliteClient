<script setup lang="ts">
import { onMounted } from 'vue'
import { useConnectionStore } from '@stores/connection'
import { useSettingsStore } from '@stores/settings'
import MainLayout from '@components/layout/MainLayout.vue'
import Toast from '@components/ui/Toast.vue'

const connectionStore = useConnectionStore()
const settingsStore = useSettingsStore()

onMounted(() => {
  // 初始化时加载已保存的连接和设置
  connectionStore.loadConnections()
  settingsStore.loadSettings()
})
</script>

<template>
  <MainLayout />
  <Toast />
</template>
