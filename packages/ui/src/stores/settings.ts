import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import type { LocaleType } from '@i18n/index'

interface AppSettings {
  locale: LocaleType
  theme: 'auto' | 'light' | 'dark'
}

const defaultSettings: AppSettings = {
  locale: 'en',
  theme: 'auto',
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<AppSettings>({ ...defaultSettings })
  const isLoading = ref(false)
  const isPanelOpen = ref(false)

  // Getters
  const locale = computed(() => settings.value.locale)
  const theme = computed(() => settings.value.theme)

  // Actions
  async function loadSettings() {
    try {
      const savedSettings = await invoke<AppSettings | null>('get_app_settings')
      if (savedSettings) {
        settings.value = {
          ...defaultSettings,
          ...savedSettings,
        }
      }
      return settings.value
    } catch (err) {
      console.error('Failed to load settings:', err)
      return settings.value
    }
  }

  async function saveSettings(newSettings: Partial<AppSettings>) {
    isLoading.value = true
    try {
      settings.value = {
        ...settings.value,
        ...newSettings,
      }
      await invoke('save_app_settings', { settings: settings.value })
      return true
    } catch (err) {
      console.error('Failed to save settings:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function setLocale(locale: LocaleType) {
    await saveSettings({ locale })
  }

  async function setTheme(theme: 'auto' | 'light' | 'dark') {
    await saveSettings({ theme })
  }

  function toggleSettingsPanel() {
    isPanelOpen.value = !isPanelOpen.value
  }

  function closeSettingsPanel() {
    isPanelOpen.value = false
  }

  function openSettingsPanel() {
    isPanelOpen.value = true
  }

  return {
    // State
    settings,
    isLoading,
    isPanelOpen,
    // Getters
    locale,
    theme,
    // Actions
    loadSettings,
    saveSettings,
    setLocale,
    setTheme,
    toggleSettingsPanel,
    closeSettingsPanel,
    openSettingsPanel,
  }
})
