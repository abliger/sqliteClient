<script setup lang="ts">
import { onMounted } from 'vue'
import { useConnectionStore } from '@stores/connection'
import { useSettingsStore } from '@stores/settings'
import { setI18nLanguage } from '@i18n/index'
import MainLayout from '@components/layout/MainLayout.vue'
import SettingsPanel from '@components/settings/SettingsPanel.vue'
import Toast from '@components/ui/Toast.vue'

const connectionStore = useConnectionStore()
const settingsStore = useSettingsStore()

onMounted(async () => {
  // 初始化时加载已保存的连接和设置
  connectionStore.loadConnections()
  await settingsStore.loadSettings()
  
  // 应用保存的语言设置
  if (settingsStore.locale) {
    setI18nLanguage(settingsStore.locale)
  }
})
</script>

<template>
  <MainLayout />
  <SettingsPanel />
  <Toast />
</template>
