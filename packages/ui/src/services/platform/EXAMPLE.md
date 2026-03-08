# Platform Adapter 使用示例

## 1. 应用入口初始化

```typescript
// main.ts (Tauri)
import { createApp } from 'vue'
import { registerAllProviders, initializePlatform } from '@services/platform'
import { createPlatformPlugin } from '@services/platform/composable'
import App from './App.vue'

// 注册所有平台
registerAllProviders()

const app = createApp(App)

// 方式1: 使用 Plugin
app.use(createPlatformPlugin())

// 方式2: 手动初始化
const platform = await initializePlatform()
app.provide(PlatformKey, platform)

app.mount('#app')
```

## 2. 组件中使用

```vue
<script setup lang="ts">
import { usePlatform, usePlatformCapability } from '@services/platform/composable'
import { computed } from 'vue'

// 获取平台
const platform = usePlatform()

// 检查能力
const canExport = usePlatformCapability('fileSystem')
const hasDatabase = usePlatformCapability('database')

// 执行查询
async function runQuery() {
  const result = await platform.query.executeQuery({
    connectionId: 'xxx',
    sql: 'SELECT * FROM users',
  })
  console.log(result)
}

// 保存文件
async function saveFile() {
  if (platform.capabilities.fileSystem === 'none') {
    console.warn('File system not available')
    return
  }
  
  const path = await platform.fs.showSaveDialog({
    filters: { 'CSV Files': ['csv'] }
  })
  
  if (path) {
    await platform.fs.writeFile(path, 'data...')
  }
}
</script>

<template>
  <div>
    <button @click="runQuery" :disabled="hasDatabase === 'none'">
      运行查询
    </button>
    
    <button v-if="canExport !== 'none'" @click="saveFile">
      导出
    </button>
    
    <span>当前平台: {{ platform.name }}</span>
  </div>
</template>
```

## 3. Storybook / 测试中使用 Mock

```typescript
// Component.stories.ts
import { registerPlatform, initializePlatform } from '@services/platform'
import { createMockProvider } from '@services/platform/providers/mock'

// 注册 Mock Provider
registerPlatform('mock', () => Promise.resolve(createMockProvider({
  delay: 500,
  connections: [
    { /* mock connection */ }
  ]
})))

// 初始化为 Mock
await initializePlatform({ provider: 'mock' })
```

## 4. 渐进式功能降级

```vue
<script setup>
const platform = usePlatform()

// 根据能力调整功能
const exportOptions = computed(() => {
  switch (platform.capabilities.fileSystem) {
    case 'full':
      return { canExport: true, canChooseLocation: true }
    case 'sandboxed':
      return { canExport: true, canChooseLocation: false }
    case 'readonly':
    case 'none':
      return { canExport: false, canChooseLocation: false }
  }
})
</script>
```
