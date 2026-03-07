<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PlusIcon, XMarkIcon, FolderOpenIcon, DocumentPlusIcon, Cog6ToothIcon } from '@heroicons/vue/24/outline'
import { useConnectionStore } from '@stores/connection'
import { useSettingsStore } from '@stores/settings'
import { useToastStore } from '@stores/toast'
import { open } from '@tauri-apps/plugin-dialog'
import Tooltip from '@components/ui/Tooltip.vue'
import CreateDatabaseDialog from '@components/dialogs/CreateDatabaseDialog.vue'

const { t } = useI18n()
const connectionStore = useConnectionStore()
const settingsStore = useSettingsStore()
const toastStore = useToastStore()
const isCreating = ref(false)
const isCreateDialogOpen = ref(false)
const selectedFolderPath = ref('')

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
      toastStore.success(
        t('connection.openSuccess'),
        fileName
      )
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
  try {
    // Open folder picker to select save location
    const selected = await open({
      directory: true,
      multiple: false,
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
    toastStore.success(
      t('connection.createSuccess'),
      `${name}.db`
    )
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
    const conn = connectionStore.connections.find(c => c.config.id === connectionId)
    await connectionStore.closeConnection(connectionId)
    if (conn) {
      toastStore.info(
        t('connection.closeSuccess'),
        conn.config.name
      )
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
</script>

<template>
  <div class="h-12 bg-surface-100 border-b border-surface-200 flex items-center px-2 space-x-1">
    <!-- 新建/打开按钮 -->
    <div class="flex items-center space-x-1 mr-2">
      <Tooltip :content="t('connection.openDatabaseTip')" position="bottom">
        <button
          class="p-1.5 rounded hover:bg-surface-200 text-surface-600"
          @click="handleOpenDatabase"
        >
          <FolderOpenIcon class="w-5 h-5" />
        </button>
      </Tooltip>
      <Tooltip :content="t('connection.newDatabaseTip')" position="bottom">
        <button
          class="p-1.5 rounded hover:bg-surface-200 text-surface-600"
          @click="handleCreateDatabase"
        >
          <DocumentPlusIcon class="w-5 h-5" />
        </button>
      </Tooltip>
    </div>

    <div class="w-px h-6 bg-surface-300 mx-2" />

    <!-- 连接标签 -->
    <div class="flex items-center space-x-1 flex-1 overflow-x-auto scrollbar-thin">
      <div
        v-for="conn in connectionStore.connections"
        :key="conn.config.id"
        class="group flex items-center space-x-2 px-3 py-1.5 rounded-t-lg cursor-pointer transition-colors min-w-[120px] max-w-[200px]"
        :class="connectionStore.activeConnectionId === conn.config.id
          ? 'bg-white border-t border-x border-surface-200 text-surface-900'
          : 'hover:bg-surface-200 text-surface-600'"
        @click="connectionStore.setActiveConnection(conn.config.id)"
      >
        <div
          class="w-2 h-2 rounded-full"
          :class="conn.status === 'connected' ? 'bg-green-500' : 'bg-red-500'"
        />
        <span class="truncate text-sm font-medium flex-1">
          {{ conn.config.name }}
        </span>
        <span class="text-xs text-surface-400">
          {{ formatFileSize(conn.metadata.size_bytes) }}
        </span>
        <button
          class="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-300"
          @click="(e) => handleCloseConnection(conn.config.id, e)"
        >
          <XMarkIcon class="w-3.5 h-3.5" />
        </button>
      </div>

      <div v-if="connectionStore.connections.length === 0" class="text-sm text-surface-400 px-2">
        {{ t('connection.noConnections') }}
      </div>
    </div>

    <!-- Settings Button -->
    <div class="ml-auto">
      <Tooltip :content="t('settings.title')" position="bottom">
        <button
          class="p-1.5 rounded hover:bg-surface-200 text-surface-600"
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
</template>
