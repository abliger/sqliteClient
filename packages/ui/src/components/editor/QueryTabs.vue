<script setup lang="ts">
import { ref, useTemplateRef, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQueryStore } from '@stores/query'
import { PlusIcon, XMarkIcon } from '@heroicons/vue/24/outline'

const { t } = useI18n()
const queryStore = useQueryStore()

// 右键菜单状态
const contextMenu = ref({
    show: false,
    x: 0,
    y: 0,
    tabId: '',
    tabIndex: -1
})

const contextMenuRef = useTemplateRef<HTMLElement>('contextMenuRef')

const handleAddTab = () => {
    queryStore.addTab()
}

const handleCloseTab = (tabId: string, event: Event) => {
    event.stopPropagation()
    queryStore.removeTab(tabId)
}

// 显示右键菜单
const handleContextMenu = (event: MouseEvent, tabId: string) => {
    event.preventDefault()
    event.stopPropagation()

    const tabs = queryStore.tabs
    const tabIndex = tabs.findIndex((t) => t.id === tabId)

    contextMenu.value = {
        show: true,
        x: event.clientX,
        y: event.clientY,
        tabId,
        tabIndex
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

// 关闭当前 tab
const closeCurrentTab = () => {
    if (contextMenu.value.tabId) {
        queryStore.removeTab(contextMenu.value.tabId)
    }
    contextMenu.value.show = false
}

// 关闭右侧所有 tabs
const closeTabsToRight = () => {
    const tabs = queryStore.tabs
    const currentIndex = contextMenu.value.tabIndex

    // 从右向左删除，避免索引变化问题
    for (let i = tabs.length - 1; i > currentIndex; i--) {
        queryStore.removeTab(tabs[i].id)
    }
    contextMenu.value.show = false
}

// 关闭其他 tabs
const closeOtherTabs = () => {
    const tabs = queryStore.tabs
    const currentId = contextMenu.value.tabId

    // 关闭除当前 tab 外的所有 tab
    for (const tab of tabs) {
        if (tab.id !== currentId) {
            queryStore.removeTab(tab.id)
        }
    }
    contextMenu.value.show = false
}
</script>

<template>
    <div
        class="flex items-center bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700"
    >
        <div class="flex-1 flex items-center overflow-x-auto scrollbar-thin">
            <div
                v-for="tab in queryStore.tabs"
                :key="tab.id"
                class="group flex items-center space-x-2 px-3 py-2 cursor-pointer transition-colors min-w-[100px] max-w-[150px] border-r border-surface-200 dark:border-surface-700 select-none"
                :class="
                    queryStore.activeTabId === tab.id
                        ? 'bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100'
                        : 'hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400'
                "
                @click="queryStore.setActiveTab(tab.id)"
                @contextmenu="(e) => handleContextMenu(e, tab.id)"
            >
                <span class="flex-1 text-sm truncate">
                    {{ tab.name }}
                </span>
                <div
                    v-if="tab.isExecuting"
                    class="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"
                />
                <button
                    class="p-0.5 rounded hover:bg-surface-300 dark:hover:bg-surface-600"
                    :class="['opacity-0 group-hover:opacity-100', queryStore.tabs.length === 1 && 'hidden']"
                    @click="(e) => handleCloseTab(tab.id, e)"
                >
                    <XMarkIcon class="w-3.5 h-3.5" />
                </button>
            </div>

            <!-- 没有连接时的提示 -->
            <div
                v-if="queryStore.tabs.length === 0"
                class="px-4 py-2 text-sm text-surface-400 dark:text-surface-500"
            >
                {{ t('editor.noConnection') || '请先打开数据库连接' }}
            </div>
        </div>

        <button
            class="p-2 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400 disabled:opacity-50 disabled:cursor-not-allowed"
            :title="t('editor.newQueryTab')"
            :disabled="!queryStore.currentConnectionId"
            @click="handleAddTab"
        >
            <PlusIcon class="w-4 h-4" />
        </button>
    </div>

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
                    @click="closeCurrentTab"
                >
                    {{ t('editor.closeTab') || '关闭标签' }}
                </button>
                <button
                    v-if="contextMenu.tabIndex < queryStore.tabs.length - 1"
                    class="w-full px-4 py-2 text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    @click="closeTabsToRight"
                >
                    {{ t('editor.closeTabsToRight') || '关闭右侧标签' }}
                </button>
                <button
                    v-if="queryStore.tabs.length > 1"
                    class="w-full px-4 py-2 text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                    @click="closeOtherTabs"
                >
                    {{ t('editor.closeOtherTabs') || '关闭其他标签' }}
                </button>
            </div>
        </Transition>
    </Teleport>
</template>
