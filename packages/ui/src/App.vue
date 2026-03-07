<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useConnectionStore } from '@stores/connection'
import { useSettingsStore } from '@stores/settings'
import { useQueryStore } from '@stores/query'
import { setI18nLanguage } from '@i18n/index'
import MainLayout from '@components/layout/MainLayout.vue'
import SettingsPanel from '@components/settings/SettingsPanel.vue'
import Toast from '@components/ui/Toast.vue'

const connectionStore = useConnectionStore()
const settingsStore = useSettingsStore()
const queryStore = useQueryStore()
const isInitializing = ref(true)

// 页面关闭前保存所有数据
const handleBeforeUnload = () => {
  console.log('[App] Saving all data before unload')
  queryStore.persistAllConnectionTabs()
}

onMounted(async () => {
  // 添加页面关闭事件监听器
  window.addEventListener('beforeunload', handleBeforeUnload)
  
  // 初始化时恢复保存的连接和设置
  await connectionStore.restoreSavedConnections()
  
  // 如果有活动连接，恢复对应的 query tabs
  if (connectionStore.activeConnectionId) {
    queryStore.setCurrentConnection(connectionStore.activeConnectionId)
  }
  
  await settingsStore.loadSettings()
  
  // 应用保存的语言设置
  if (settingsStore.locale) {
    setI18nLanguage(settingsStore.locale)
    // 同步更新菜单语言
    try {
      await invoke('update_menu_locale', { locale: settingsStore.locale })
    } catch (err) {
      console.error('Failed to update menu locale:', err)
    }
  }
  
  isInitializing.value = false
})

onUnmounted(() => {
  // 移除事件监听器并保存数据
  window.removeEventListener('beforeunload', handleBeforeUnload)
  handleBeforeUnload()
})
</script>

<template>
  <div class="h-screen w-screen">
    <!-- 初始化加载中 -->
    <div
      v-if="isInitializing"
      class="h-full w-full flex items-center justify-center bg-surface-50"
    >
      <div class="flex flex-col items-center space-y-4">
        <div class="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <span class="text-surface-600 text-sm">Loading...</span>
      </div>
    </div>
    
    <!-- 主界面 -->
    <template v-else>
      <MainLayout />
      <SettingsPanel />
      <Toast />
    </template>
  </div>
</template>
