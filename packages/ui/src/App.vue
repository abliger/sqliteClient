<script setup lang="ts">
import { onMounted } from 'vue'
import { useConnectionStore } from '@stores/connection'
import { useSettingsStore } from '@stores/settings'
import { setI18nLanguage } from '@i18n/index'
import MainLayout from '@components/layout/MainLayout.vue'
import SettingsPanel from '@components/settings/SettingsPanel.vue'

const connectionStore = useConnectionStore()
const settingsStore = useSettingsStore()

onMounted(async () => {
  // 初始化时加载设置
  await settingsStore.loadSettings()
  
  // 应用保存的语言设置
  if (settingsStore.locale) {
    setI18nLanguage(settingsStore.locale)
  }
  
  // 初始化时加载已保存的连接
  connectionStore.loadConnections()
})
</script>

<template>
  <MainLayout />
  <SettingsPanel />
</template>
