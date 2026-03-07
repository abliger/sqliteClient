<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useQueryStore } from '@stores/query'
import { PlusIcon, XMarkIcon } from '@heroicons/vue/24/outline'

const { t } = useI18n()
const queryStore = useQueryStore()

const handleAddTab = () => {
  queryStore.addTab()
}

const handleCloseTab = (tabId: string, event: Event) => {
  event.stopPropagation()
  queryStore.removeTab(tabId)
}
</script>

<template>
  <div class="flex items-center bg-surface-100 border-b border-surface-200">
    <div class="flex-1 flex items-center overflow-x-auto scrollbar-thin">
      <div
        v-for="tab in queryStore.tabs"
        :key="tab.id"
        class="group flex items-center space-x-2 px-3 py-2 cursor-pointer transition-colors min-w-[100px] max-w-[150px] border-r border-surface-200"
        :class="queryStore.activeTabId === tab.id
          ? 'bg-white text-surface-900'
          : 'hover:bg-surface-200 text-surface-600'"
        @click="queryStore.setActiveTab(tab.id)"
      >
        <span class="flex-1 text-sm truncate">
          {{ tab.name }}
        </span>
        <div
          v-if="tab.isExecuting"
          class="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"
        />
        <button
          class="p-0.5 rounded hover:bg-surface-300"
          :class="[
            'opacity-0 group-hover:opacity-100',
            queryStore.tabs.length === 1 && 'hidden'
          ]"
          @click="(e) => handleCloseTab(tab.id, e)"
        >
          <XMarkIcon class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <button
      class="p-2 hover:bg-surface-200 text-surface-600"
      :title="t('editor.newQueryTab')"
      @click="handleAddTab"
    >
      <PlusIcon class="w-4 h-4" />
    </button>
  </div>
</template>
