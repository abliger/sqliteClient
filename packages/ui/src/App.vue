<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useConnectionStore } from '@stores/connection'
import { useSettingsStore } from '@stores/settings'
import { useQueryStore } from '@stores/query'
import { useSchemaStore } from '@stores/schema'
import { useToastStore } from '@stores/toast'
import { setI18nLanguage } from '@i18n/index'
import { open } from '@tauri-apps/plugin-dialog'
import MainLayout from '@components/layout/MainLayout.vue'
import SettingsPanel from '@components/settings/SettingsPanel.vue'
import Toast from '@components/ui/Toast.vue'
import ImportWizard from '@components/dialogs/ImportWizard.vue'

const { t } = useI18n()
const connectionStore = useConnectionStore()
const settingsStore = useSettingsStore()
const queryStore = useQueryStore()
const schemaStore = useSchemaStore()
const toastStore = useToastStore()
const isInitializing = ref(true)

// 取消监听器
let unlisteners: UnlistenFn[] = []

// 页面关闭前保存所有数据
const handleBeforeUnload = () => {
    console.log('[App] Saving all data before unload')
    queryStore.persistAllConnectionTabs()
}

// 主题切换逻辑
const updateTheme = () => {
    const theme = settingsStore.theme
    const html = document.documentElement

    if (theme === 'dark') {
        html.classList.add('dark')
    } else if (theme === 'light') {
        html.classList.remove('dark')
    } else {
        // auto mode
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        if (mediaQuery.matches) {
            html.classList.add('dark')
        } else {
            html.classList.remove('dark')
        }
    }
}

// 监听系统主题变化
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
const handleMediaChange = () => {
    if (settingsStore.theme === 'auto') {
        updateTheme()
    }
}

// 处理打开数据库菜单
const handleOpenDatabase = async () => {
    try {
        const selected = await open({
            multiple: false,
            filters: [
                { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3', 'db3'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        })

        if (selected && typeof selected === 'string') {
            const fileName = selected.split(/[/\\]/).pop() || 'Untitled'
            const name = fileName.replace(/\.[^/.]+$/, '')
            await connectionStore.createConnection(name, selected)
            toastStore.success(t('connection.openSuccess'), fileName)
        }
    } catch (err) {
        console.error('Failed to open database from menu:', err)
    }
}

// 处理创建数据库菜单
// 处理创建数据库菜单 - 触发 ConnectionTabs 组件中的对话框
const handleCreateDatabase = () => {
    window.dispatchEvent(new CustomEvent('app:create-database'))
}

// 打开指定的数据库文件（从 VS Code 或双击文件）
const openDatabaseFile = async (filePath: string) => {
    try {
        console.log('[App] Opening database file:', filePath)
        const fileName = filePath.split(/[/\\]/).pop() || 'Untitled'
        const name = fileName.replace(/\.[^/.]+$/, '')
        await connectionStore.createConnection(name, filePath)
        toastStore.success(t('connection.openSuccess'), fileName)
    } catch (err) {
        console.error('Failed to open database file:', err)
        toastStore.error('打开数据库失败', String(err))
    }
}

onMounted(async () => {
    // 添加页面关闭事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload)
    mediaQuery.addEventListener('change', handleMediaChange)

    // 初始化时恢复保存的连接和设置
    await connectionStore.restoreSavedConnections()

    // 如果有活动连接，加载表结构并恢复对应的 query tabs
    if (connectionStore.activeConnectionId) {
        await schemaStore.loadTables(connectionStore.activeConnectionId)
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

    // 应用主题
    updateTheme()

    // 监听 Tauri 菜单事件
    const unlistenOpenDb = await listen('menu-open-db', () => {
        console.log('[App] Menu: Open Database')
        handleOpenDatabase()
    })
    unlisteners.push(unlistenOpenDb)

    const unlistenCreateDb = await listen('menu-create-db', () => {
        console.log('[App] Menu: Create Database')
        handleCreateDatabase()
    })
    unlisteners.push(unlistenCreateDb)

    const unlistenSettings = await listen('menu-settings', () => {
        console.log('[App] Menu: Settings')
        settingsStore.openSettingsPanel()
    })
    unlisteners.push(unlistenSettings)

    // 监听文件打开事件（从 VS Code 或双击文件）
    const unlistenOpenFile = await listen<string>('open-database-file', (event) => {
        console.log('[App] Received open-database-file event:', event.payload)
        const filePath = event.payload
        if (filePath) {
            openDatabaseFile(filePath)
        }
    })
    unlisteners.push(unlistenOpenFile)

    isInitializing.value = false
})

onUnmounted(() => {
    // 移除事件监听器并保存数据
    window.removeEventListener('beforeunload', handleBeforeUnload)
    mediaQuery.removeEventListener('change', handleMediaChange)

    // 移除 Tauri 事件监听器
    unlisteners.forEach((unlisten) => unlisten())
    unlisteners = []

    handleBeforeUnload()
})

// 监听主题变化
watch(() => settingsStore.theme, updateTheme)
</script>

<template>
    <div class="h-screen w-screen">
        <!-- 初始化加载中 -->
        <div
            v-if="isInitializing"
            class="h-full w-full flex items-center justify-center bg-surface-50 dark:bg-surface-900"
        >
            <div class="flex flex-col items-center space-y-4">
                <div class="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span class="text-surface-600 dark:text-surface-400 text-sm">Loading...</span>
            </div>
        </div>

        <!-- 主界面 -->
        <template v-else>
            <MainLayout />
            <SettingsPanel />
            <Toast />
            <ImportWizard />
        </template>
    </div>
</template>
