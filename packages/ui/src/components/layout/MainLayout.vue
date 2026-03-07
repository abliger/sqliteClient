<script setup lang="ts">
import { watch } from 'vue'
import { useConnectionStore } from '@stores/connection'
import { useSchemaStore } from '@stores/schema'
import Sidebar from './Sidebar.vue'
import ConnectionTabs from './ConnectionTabs.vue'
import SQLEditor from '@components/editor/SQLEditor.vue'
import ResultPanel from '@components/result/ResultPanel.vue'
import DatabaseTree from '@components/explorer/DatabaseTree.vue'

const connectionStore = useConnectionStore()
const schemaStore = useSchemaStore()

// 当活动连接变化时，加载表结构
watch(
  () => connectionStore.activeConnectionId,
  async (connectionId) => {
    if (connectionId) {
      await schemaStore.loadTables(connectionId)
    } else {
      schemaStore.clearSchema()
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="h-full flex flex-col bg-surface-50">
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
        <div class="h-1/2 min-h-[200px] border-t border-surface-200">
          <ResultPanel />
        </div>
      </div>
    </div>
  </div>
</template>
