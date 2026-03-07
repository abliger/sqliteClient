<script setup lang="ts">
import { onMounted } from 'vue'
import { useConnectionStore } from '@stores/connection'
import MainLayout from '@components/layout/MainLayout.vue'

const connectionStore = useConnectionStore()

onMounted(() => {
  // 初始化时加载已保存的连接
  connectionStore.loadConnections()
})
</script>

<template>
  <MainLayout />
</template>
