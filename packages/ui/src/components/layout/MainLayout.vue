<script setup lang="ts">
import { watch, onMounted, ref } from 'vue'
import { useConnectionStore } from '@stores/connection'
import { useSchemaStore } from '@stores/schema'
import { useQueryStore } from '@stores/query'
import Sidebar from './Sidebar.vue'
import ConnectionTabs from './ConnectionTabs.vue'
import SQLEditor from '@components/editor/SQLEditor.vue'
import ResultPanel from '@components/result/ResultPanel.vue'
import DatabaseTree from '@components/explorer/DatabaseTree.vue'

const connectionStore = useConnectionStore()
const schemaStore = useSchemaStore()
const queryStore = useQueryStore()

// 左侧边栏显示状态
const isSidebarVisible = ref(true)

function toggleSidebar() {
    isSidebarVisible.value = !isSidebarVisible.value
}

// 底部编辑器栏显示状态
const isBottomPanelVisible = ref(true)

function toggleBottomPanel() {
    isBottomPanelVisible.value = !isBottomPanelVisible.value
}

// 当活动连接变化时，加载表结构和切换 query tabs
watch(
    () => connectionStore.activeConnectionId,
    async (connectionId, oldConnectionId) => {
        // 只在连接真正变化时处理，避免初始 null -> null 的触发
        if (connectionId === oldConnectionId) return
        
        if (connectionId) {
            await schemaStore.loadTables(connectionId)
            // 设置当前连接，切换对应的 query tabs
            queryStore.setCurrentConnection(connectionId)
        } else {
            schemaStore.clearSchema()
            queryStore.setCurrentConnection('')
        }
    }
)

// 监听连接变化，清理已关闭连接的 tabs
watch(
    () => connectionStore.connections.map((c) => c.config.id),
    (connectionIds) => {
        queryStore.cleanupOrphanedTabs(connectionIds)
    },
    { immediate: true }
)

onMounted(() => {
    // 如果有活动连接，设置当前连接
    if (connectionStore.activeConnectionId) {
        queryStore.setCurrentConnection(connectionStore.activeConnectionId)
    }
})
</script>

<template>
    <div class="h-full flex flex-col bg-surface-50 dark:bg-surface-900">
        <!-- 顶部连接标签栏 -->
        <ConnectionTabs
            :is-sidebar-visible="isSidebarVisible"
            :is-bottom-panel-visible="isBottomPanelVisible"
            @toggle-sidebar="toggleSidebar"
            @toggle-bottom-panel="toggleBottomPanel"
        />

        <!-- 主内容区 -->
        <div class="flex-1 flex overflow-hidden">
            <!-- 左侧边栏 - 数据库浏览器 -->
            <transition
                enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 w-0"
                enter-to-class="opacity-100"
                leave-active-class="transition-all duration-200 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0 w-0"
            >
                <div v-show="isSidebarVisible" class="flex-shrink-0">
                    <Sidebar>
                        <DatabaseTree />
                    </Sidebar>
                </div>
            </transition>

            <!-- 中间和右侧 - 结果和编辑器 -->
            <div class="flex-1 flex flex-col min-w-0" :class="{ 'divide-y divide-surface-200 dark:divide-surface-700': isBottomPanelVisible }">
                <!-- 结果面板 - 放在上方 -->
                <div class="flex-1 min-h-[200px] overflow-hidden">
                    <ResultPanel />
                </div>

                <!-- SQL 编辑器 - 放在下方 -->
                <transition
                    enter-active-class="transition-all duration-200 ease-out"
                    enter-from-class="opacity-0 h-0"
                    enter-to-class="opacity-100 h-1/2"
                    leave-active-class="transition-all duration-200 ease-in"
                    leave-from-class="opacity-100 h-1/2"
                    leave-to-class="opacity-0 h-0"
                >
                    <div v-show="isBottomPanelVisible" class="h-1/2 min-h-[250px] overflow-hidden">
                        <SQLEditor />
                    </div>
                </transition>
            </div>
        </div>
    </div>
</template>
