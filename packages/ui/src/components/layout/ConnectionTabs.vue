<script setup lang="ts">
import { ref, onMounted, onUnmounted, useTemplateRef, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    XMarkIcon,
    FolderOpenIcon,
    DocumentPlusIcon,
    Cog6ToothIcon,
    Square2StackIcon,
    Bars3Icon,
    Bars3BottomLeftIcon
} from '@heroicons/vue/24/outline'
import { useConnectionStore } from '@stores/connection'
import { useQueryStore } from '@stores/query'
import { useSettingsStore } from '@stores/settings'
import { useToastStore } from '@stores/toast'
import { isTauri, isDialogSupported } from '@utils/tauri'
import Tooltip from '@components/ui/Tooltip.vue'
import CreateDatabaseDialog from '@components/dialogs/CreateDatabaseDialog.vue'

// 动态导入 Tauri dialog（桌面应用）或 VSCode mock（VSCode 扩展）
let openDialog: typeof import('@tauri-apps/plugin-dialog').open | null = null
let dialogLoaded = false

// 延迟加载 dialog，确保环境已初始化
function loadDialogIfNeeded() {
    if (dialogLoaded) return
    dialogLoaded = true
    
    if (isTauri() || isDialogSupported()) {
        import('@tauri-apps/plugin-dialog').then(m => {
            openDialog = m.open
        })
    }
}

const { t } = useI18n()
const connectionStore = useConnectionStore()
const queryStore = useQueryStore()
const settingsStore = useSettingsStore()
const toastStore = useToastStore()

// Props for sidebar toggle
const props = defineProps<{
    isSidebarVisible?: boolean
}>()

const emit = defineEmits<{
    'toggle-sidebar': []
}>()
const isCreating = ref(false)
const isCreateDialogOpen = ref(false)
const selectedFolderPath = ref('')

// 右键菜单状态
const contextMenu = ref({
    show: false,
    x: 0,
    y: 0,
    connectionId: '',
    connectionIndex: -1
})

const contextMenuRef = useTemplateRef<HTMLElement>('contextMenuRef')

const handleOpenDatabase = async () => {
    loadDialogIfNeeded()
    if (!isDialogSupported() || !openDialog) {
        toastStore.error('Not available', 'File dialog is only available in the desktop app or VSCode')
        return
    }
    
    try {
        const selected = await openDialog({
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
        console.error('Failed to open database:', err)
        toastStore.error(
            t('connection.openError'),
            err instanceof Error ? err.message : String(err)
        )
    }
}

const handleCreateDatabase = async () => {
    loadDialogIfNeeded()
    if (!isDialogSupported() || !openDialog) {
        toastStore.error('Not available', 'Folder dialog is only available in the desktop app or VSCode')
        return
    }
    
    try {
        // Open folder picker to select save location
        const selected = await openDialog({
            directory: true,
            multiple: false
        })

        if (selected && typeof selected === 'string') {
            selectedFolderPath.value = selected
            isCreateDialogOpen.value = true
        }
    } catch (err) {
        console.error('Failed to select folder:', err)
        toastStore.error(
            t('connection.selectFolderError'),
            err instanceof Error ? err.message : String(err)
        )
    }
}

const handleCreateConfirm = async (name: string, path: string) => {
    try {
        isCreating.value = true
        await connectionStore.createNewDatabase(name, path)
        toastStore.success(t('connection.createSuccess'), `${name}.db`)
    } catch (err) {
        console.error('Failed to create database:', err)
        toastStore.error(
            t('connection.createError'),
            err instanceof Error ? err.message : String(err)
        )
    } finally {
        isCreating.value = false
    }
}

const handleCloseConnection = async (connectionId: string, event: Event) => {
    event.stopPropagation()
    try {
        const conn = connectionStore.connections.find((c) => c.config.id === connectionId)
        await connectionStore.closeConnection(connectionId)
        // 删除对应的 query tabs
        queryStore.removeConnectionTabs(connectionId)
        if (conn) {
            toastStore.info(t('connection.closeSuccess'), conn.config.name)
        }
    } catch (err) {
        console.error('Failed to close connection:', err)
        toastStore.error(
            t('connection.closeError'),
            err instanceof Error ? err.message : String(err)
        )
    }
}

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 监听来自应用菜单的事件
const handleAppOpenDatabase = () => {
    handleOpenDatabase()
}

const handleAppCreateDatabase = () => {
    handleCreateDatabase()
}

onMounted(() => {
    window.addEventListener('app:open-database', handleAppOpenDatabase)
    window.addEventListener('app:create-database', handleAppCreateDatabase)
})

onUnmounted(() => {
    window.removeEventListener('app:open-database', handleAppOpenDatabase)
    window.removeEventListener('app:create-database', handleAppCreateDatabase)
})

// 显示右键菜单
const handleContextMenu = (event: MouseEvent, connectionId: string) => {
    event.preventDefault()
    event.stopPropagation()

    const connections = connectionStore.connections
    const connectionIndex = connections.findIndex((c) => c.config.id === connectionId)

    contextMenu.value = {
        show: true,
        x: event.clientX,
        y: event.clientY,
        connectionId,
        connectionIndex
    }

    // 点击外部关闭菜单
    nextTick(() => {
        const closeMenu = (e: MouseEvent) => {
            const menuEl = contextMenuRef.value
            if (menuEl && !menuEl.contains(e.target as Node)) {
                contextMenu.value.show = false
                document.removeEventListener('click', closeMenu)
                document.removeEventListener('contextmenu', closeMenu)
            }
        }
        setTimeout(() => {
            document.addEventListener('click', closeMenu)
            document.addEventListener('contextmenu', closeMenu)
        }, 0)
    })
}

// 关闭当前连接
const closeCurrentConnection = async () => {
    if (contextMenu.value.connectionId) {
        try {
            const conn = connectionStore.connections.find(
                (c) => c.config.id === contextMenu.value.connectionId
            )
            await connectionStore.closeConnection(contextMenu.value.connectionId)
            // 删除对应的 query tabs
            queryStore.removeConnectionTabs(contextMenu.value.connectionId)
            if (conn) {
                toastStore.info(t('connection.closeSuccess'), conn.config.name)
            }
        } catch (err) {
            console.error('Failed to close connection:', err)
            toastStore.error(
                t('connection.closeError'),
                err instanceof Error ? err.message : String(err)
            )
        }
    }
    contextMenu.value.show = false
}

// 关闭右侧所有连接
const closeConnectionsToRight = async () => {
    const connections = connectionStore.connections
    const currentIndex = contextMenu.value.connectionIndex

    // 从右向左删除，避免索引变化问题
    for (let i = connections.length - 1; i > currentIndex; i--) {
        try {
            const conn = connections[i]
            await connectionStore.closeConnection(conn.config.id)
            queryStore.removeConnectionTabs(conn.config.id)
        } catch (err) {
            console.error('Failed to close connection:', err)
        }
    }
    contextMenu.value.show = false
}

// 关闭其他连接
const closeOtherConnections = async () => {
    const connections = connectionStore.connections
    const currentId = contextMenu.value.connectionId

    // 关闭除当前连接外的所有连接
    for (const conn of connections) {
        if (conn.config.id !== currentId) {
            try {
                await connectionStore.closeConnection(conn.config.id)
                queryStore.removeConnectionTabs(conn.config.id)
            } catch (err) {
                console.error('Failed to close connection:', err)
            }
        }
    }
    contextMenu.value.show = false
}
</script>

<template>
    <div
        class="h-12 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex items-center px-2 space-x-1"
    >
        <!-- 新建/打开按钮 -->
        <div class="flex items-center space-x-1 mr-2">
            <Tooltip :content="t('connection.openDatabaseTip')" position="bottom">
                <button
                    class="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400"
                    @click="handleOpenDatabase"
                >
                    <FolderOpenIcon class="w-5 h-5" />
                </button>
            </Tooltip>
            <Tooltip :content="t('connection.newDatabaseTip')" position="bottom">
                <button
                    class="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400"
                    @click="handleCreateDatabase"
                >
                    <DocumentPlusIcon class="w-5 h-5" />
                </button>
            </Tooltip>
        </div>

        <div class="w-px h-6 bg-surface-300 dark:bg-surface-600 mx-2" />

        <!-- 连接标签 -->
        <div class="flex items-center space-x-1 flex-1 overflow-x-auto scrollbar-thin">
            <div
                v-for="conn in connectionStore.connections"
                :key="conn.config.id"
                class="group flex items-center space-x-2 px-3 py-1.5 rounded-t-lg cursor-pointer transition-colors min-w-[120px] max-w-[200px] select-none"
                :class="
                    connectionStore.activeConnectionId === conn.config.id
                        ? 'bg-white dark:bg-surface-900 border-t border-x border-surface-200 dark:border-surface-600 text-surface-900 dark:text-surface-100'
                        : 'hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400'
                "
                @click="connectionStore.setActiveConnection(conn.config.id)"
                @contextmenu="(e) => handleContextMenu(e, conn.config.id)"
            >
                <div
                    class="w-2 h-2 rounded-full"
                    :class="conn.status === 'connected' ? 'bg-green-500' : 'bg-red-500'"
                />
                <span class="truncate text-sm font-medium flex-1">
                    {{ conn.config.name }}
                </span>
                <span class="text-xs text-surface-400 dark:text-surface-500">
                    {{ formatFileSize(conn.metadata.size_bytes) }}
                </span>
                <button
                    class="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-300 dark:hover:bg-surface-600"
                    @click="(e) => handleCloseConnection(conn.config.id, e)"
                >
                    <XMarkIcon class="w-3.5 h-3.5" />
                </button>
            </div>

            <div
                v-if="connectionStore.connections.length === 0"
                class="text-sm text-surface-400 dark:text-surface-500 px-2"
            >
                {{ t('connection.noConnections') }}
            </div>
        </div>

        <!-- Sidebar Toggle & Settings -->
        <div class="ml-auto flex items-center space-x-2">
            <!-- Sidebar Toggle Button Group -->
            <Tooltip :content="isSidebarVisible ? t('editor.hideSidebar') : t('editor.showSidebar')" position="bottom">
                <button
                    class="flex items-center p-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-400 transition-colors"
                    @click="emit('toggle-sidebar')"
                >
                    <component
                        :is="isSidebarVisible ? Bars3BottomLeftIcon : Bars3Icon"
                        class="w-5 h-5"
                    />
                </button>
            </Tooltip>

            <div class="w-px h-5 bg-surface-300 dark:bg-surface-600" />

            <!-- Settings Button -->
            <Tooltip :content="t('settings.title')" position="bottom">
                <button
                    class="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400"
                    @click="settingsStore.openSettingsPanel"
                >
                    <Cog6ToothIcon class="w-5 h-5" />
                </button>
            </Tooltip>
        </div>
    </div>

    <!-- Create Database Dialog -->
    <CreateDatabaseDialog
        :is-open="isCreateDialogOpen"
        :default-path="selectedFolderPath"
        @close="isCreateDialogOpen = false"
        @confirm="handleCreateConfirm"
    />

    <!-- 右键菜单 -->
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
        >
            <div
                v-if="contextMenu.show"
                ref="contextMenuRef"
                class="fixed z-50 min-w-[160px] py-1 bg-white dark:bg-surface-800 rounded-lg shadow-xl border border-surface-200 dark:border-surface-700"
                :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
            >
                <button
                    class="w-full px-4 py-2 text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    @click="closeCurrentConnection"
                >
                    {{ t('connection.closeConnection') || '关闭连接' }}
                </button>
                <button
                    v-if="contextMenu.connectionIndex < connectionStore.connections.length - 1"
                    class="w-full px-4 py-2 text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    @click="closeConnectionsToRight"
                >
                    {{ t('connection.closeConnectionsToRight') || '关闭右侧连接' }}
                </button>
                <button
                    v-if="connectionStore.connections.length > 1"
                    class="w-full px-4 py-2 text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    @click="closeOtherConnections"
                >
                    {{ t('connection.closeOtherConnections') || '关闭其他连接' }}
                </button>
            </div>
        </Transition>
    </Teleport>
</template>
