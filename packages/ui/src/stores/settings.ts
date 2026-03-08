import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { isTauri, safeInvoke } from '@utils/tauri'
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
        // 非 Tauri 环境使用默认设置
        if (!isTauri()) {
            console.log('[Settings] Not in Tauri environment, using default settings')
            return settings.value
        }
        
        try {
            const savedSettings = await safeInvoke<AppSettings | null>('get_app_settings')
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
            
            // 非 Tauri 环境只更新内存中的设置
            if (!isTauri()) {
                console.log('[Settings] Not in Tauri environment, settings not persisted')
                return true
            }
            
            await safeInvoke('save_app_settings', { settings: settings.value })
            return true
        } catch (err) {
            console.error('Failed to save settings:', err)
            return false
        } finally {
            isLoading.value = false
        }
    }

    async function setLocale(newLocale: LocaleType) {
        await saveSettings({ locale: newLocale })
        // 同步更新菜单语言（仅 Tauri 环境）
        if (isTauri()) {
            try {
                await safeInvoke('update_menu_locale', { locale: newLocale })
            } catch {
                // 菜单语言更新失败不显示错误，仅记录
            }
        }
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
