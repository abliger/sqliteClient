<script setup lang="ts">
import { ref } from 'vue'
import { PlusIcon, XMarkIcon, FolderOpenIcon, DocumentPlusIcon } from '@heroicons/vue/24/outline'
import { useConnectionStore } from '@stores/connection'
import { open } from '@tauri-apps/plugin-dialog'

const connectionStore = useConnectionStore()
const isCreating = ref(false)

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
      const fileName = selected.split('/').pop() || 'Untitled'
      const name = fileName.replace(/\.[^/.]+$/, '')
      await connectionStore.createConnection(name, selected)
    }
  } catch (err) {
    console.error('Failed to open database:', err)
  }
}

const handleCreateDatabase = async () => {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }
      ]
    })

    if (selected && typeof selected === 'string') {
      const fileName = selected.split('/').pop() || 'Untitled'
      const name = fileName.replace(/\.[^/.]+$/, '')
      await connectionStore.createNewDatabase(name, selected)
    }
  } catch (err) {
    console.error('Failed to create database:', err)
  }
}

const handleCloseConnection = async (connectionId: string, event: Event) => {
  event.stopPropagation()
  await connectionStore.closeConnection(connectionId)
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
      <button
        class="p-1.5 rounded hover:bg-surface-200 text-surface-600"
        title="Open Database"
        @click="handleOpenDatabase"
      >
        <FolderOpenIcon class="w-5 h-5" />
      </button>
      <button
        class="p-1.5 rounded hover:bg-surface-200 text-surface-600"
        title="New Database"
        @click="handleCreateDatabase"
      >
        <DocumentPlusIcon class="w-5 h-5" />
      </button>
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
        No connections. Click the folder icon to open a database.
      </div>
    </div>
  </div>
</template>
