<script setup lang="ts">
import { watch, onMounted } from 'vue'
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
        <ConnectionTabs />

        <!-- 主内容区 -->
        <div class="flex-1 flex overflow-hidden">
            <!-- 左侧边栏 - 数据库浏览器 -->
            <Sidebar>
                <DatabaseTree />
            </Sidebar>

            <!-- 中间和右侧 - 编辑器和结果 -->
            <div class="flex-1 flex flex-col min-w-0">
                <!-- SQL 编辑器 -->
                <div class="flex-1 min-h-0">
                    <SQLEditor />
                </div>

                <!-- 结果面板 -->
                <div class="h-1/2 min-h-[200px] border-t border-surface-200 dark:border-surface-700">
                    <ResultPanel />
                </div>
            </div>
        </div>
    </div>
</template>
