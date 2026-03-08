# SQLite Client UI - Agent Documentation

本文档详细说明 `packages/ui` 中每个文件的作用和使用方法，帮助 AI 助手快速理解和维护代码。

## 项目概览

SQLite Client UI 是一个基于 Vue 3 + TypeScript + TailwindCSS 的前端项目，支持两种运行环境：
- **Tauri 桌面应用** - 本地 SQLite 访问
- **VS Code 扩展 WebView** - 通过 Extension Host 访问 SQLite

---

## 目录结构

```
packages/ui/src/
├── main.ts                 # 应用入口
├── App.vue                 # 根组件
├── components/             # Vue 组件
├── composables/            # 可复用逻辑
├── directives/             # 自定义指令
├── i18n/                   # 国际化
├── services/               # 服务层（API 调用）
├── stores/                 # Pinia 状态管理
├── styles/                 # 全局样式
├── types/                  # TypeScript 类型
└── utils/                  # 工具函数
```

---

## 核心文件说明

### 入口文件

#### `main.ts`
**作用**: 应用初始化入口
**使用**: 注册全局组件、初始化 Pinia、设置 i18n
```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { i18n } from '@i18n/index'

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.mount('#app')
```

#### `App.vue`
**作用**: 根组件，处理全局状态和初始化
**功能**: 
- 监听系统主题变化
- 恢复保存的连接
- 监听 Tauri 菜单事件
- 处理数据库文件打开

---

## 组件层 (components/)

### 布局组件 (layout/)

#### `MainLayout.vue`
**作用**: 主应用布局（侧边栏 + 编辑器 + 结果面板）
**功能**:
- 监听连接变化，自动加载表结构
- 管理标签页状态
- 响应式布局适配

#### `ConnectionTabs.vue`
**作用**: 顶部数据库连接标签栏
**功能**:
- 显示已打开的数据库连接
- 切换活动连接
- 新建/关闭连接

#### `Sidebar.vue`
**作用**: 左侧可折叠边栏容器

### 编辑器组件 (editor/)

#### `SQLEditor.vue`
**作用**: 核心 SQL 编辑器组件（Monaco Editor 封装）
**功能**:
- SQL 语法高亮和补全
- 代码格式化
- SQL 片段插入
- 右键菜单（添加到片段）
- **重要**: 使用 `Teleport` 渲染代码片段面板

**使用示例**:
```vue
<SQLEditor />
```

#### `EditorToolbar.vue`
**作用**: 编辑器工具栏（执行、格式化、导入等按钮）

#### `QueryTabs.vue`
**作用**: 查询标签页管理

#### `SnippetPanel.vue`
**作用**: 代码片段面板（固定定位遮罩层）
**特性**:
- 从右侧滑入动画（Transition）
- 支持"当前数据库"和"全局"片段
- 变量填充对话框
- 通过 `Teleport to="body"` 渲染

**使用**:
```vue
<Teleport to="body">
  <SnippetPanel
    v-if="showSnippetPanel"
    @insert="handleInsert"
    @close="showSnippetPanel = false"
  />
</Teleport>
```

#### `TemplatePanel.vue`
**作用**: SQL 模板面板（内置查询模板）

### 资源管理器组件 (explorer/)

#### `DatabaseTree.vue`
**作用**: 左侧数据库树形结构
**功能**:
- 显示表、索引、触发器
- 表结构设计器入口
- 双击表生成查询

#### `ERDiagram.vue`
**作用**: ER 图组件
**功能**: 显示表关系图

### 结果组件 (result/)

#### `ResultPanel.vue`
**作用**: 查询结果展示容器
**功能**:
- 多标签页（结果、消息、日志、历史、对比、ER图）
- 数据导出（CSV/JSON）
- 快照保存

#### `ResultGrid.vue`
**作用**: 数据表格展示
**功能**:
- 分页
- 行内编辑
- 列排序

#### `ResultComparePanel.vue`
**作用**: 查询结果对比面板
**功能**: 保存和对比多个查询结果快照

#### `QueryHistoryPanel.vue`
**作用**: 查询历史面板

#### `CrudLogPanel.vue`
**作用**: CRUD 操作日志面板

### 设计器组件 (designer/)

#### `TableDesignerDialog.vue`
**作用**: 表设计器对话框
**功能**: 可视化创建/修改表结构

#### `ColumnEditor.vue`
**作用**: 列编辑器（在设计器中使用）

#### `IndexEditor.vue`
**作用**: 索引编辑器

#### `DDLPreview.vue`
**作用**: DDL 预览组件

### 对话框组件 (dialogs/)

#### `CreateDatabaseDialog.vue`
**作用**: 新建数据库对话框

#### `EditRowDialog.vue`
**作用**: 编辑行数据对话框

#### `ImportWizard.vue`
**作用**: 数据导入向导（CSV/Excel）

#### `SqlImportDialog.vue`
**作用**: SQL 文件导入对话框

### 设置组件 (settings/)

#### `SettingsPanel.vue`
**作用**: 设置面板（固定定位遮罩层）
**功能**: 主题、语言设置

### UI 基础组件 (ui/)

#### `Toast.vue`
**作用**: 全局消息提示组件

#### `Tooltip.vue`
**作用**: 工具提示组件

---

## 服务层 (services/)

服务层封装了所有与后端的通信逻辑，支持多平台适配。

### 核心服务

#### `connection.ts`
**作用**: 统一连接服务入口
**功能**: 自动检测平台（Tauri/VS Code）并调用对应实现

#### `connection-tauri.ts`
**作用**: Tauri 环境的连接服务实现
**使用**: 直接调用 Tauri `invoke()`

#### `connection-vscode.ts`
**作用**: VS Code 环境的连接服务实现
**使用**: 通过 `postMessage` 与 Extension Host 通信

#### `query.ts`
**作用**: 查询执行服务
**功能**: 执行 SQL 查询、流式查询、取消查询

#### `schema.ts`
**作用**: 数据库结构服务
**功能**: 获取表列表、表结构、ER图数据

#### `crud.ts`
**作用**: CRUD 操作服务
**功能**: 插入、更新、删除行数据

#### `export.ts`
**作用**: 数据导出服务
**功能**: 导出 CSV/JSON

#### `history.ts`
**作用**: 查询历史服务

#### `template.ts`
**作用**: SQL 代码片段和模板服务
**功能**: 管理用户代码片段（支持 per-database 和全局）

#### `import.ts`
**作用**: 数据导入服务

#### `formatter.ts`
**作用**: SQL 格式化服务

#### `crudLog.ts`
**作用**: CRUD 操作日志服务

### 平台适配层 (platform/)

**重要**: 新的平台适配架构，替代硬编码的平台检测

#### `index.ts`
**作用**: 平台服务核心入口
**功能**: Provider 注册、初始化、能力检测

#### `types.ts`
**作用**: 平台适配类型定义
**类型**: `PlatformProvider`, `PlatformCapabilities`, 各种 Provider 接口

#### `providers/tauri.ts`
**作用**: Tauri 平台 Provider 实现

#### `providers/vscode.ts`
**作用**: VS Code 平台 Provider 实现

#### `providers/mock.ts`
**作用**: Mock Provider（用于测试）

#### `composable.ts`
**作用**: Vue 组合式函数
**导出**: `usePlatform()`, `usePlatformAsync()`, `usePlatformCapabilities()`

**使用示例**:
```typescript
const platform = usePlatform()
const canExport = platform.capabilities.fileSystem !== 'none'
const result = await platform.query.executeQuery({...})
```

#### `vscode-bridge.ts`
**作用**: VS Code 消息桥接工具

---

## 状态管理 (stores/)

使用 Pinia 进行状态管理，每个 Store 对应一个功能模块。

### 核心 Stores

#### `connection.ts`
**作用**: 连接状态管理
**State**: `connections`, `activeConnectionId`, `isLoading`
**Actions**: `createConnection()`, `closeConnection()`, `restoreSavedConnections()`

**使用**:
```typescript
const connectionStore = useConnectionStore()
await connectionStore.createConnection('test', '/path/to/db')
```

#### `query.ts`
**作用**: 查询状态管理
**State**: `tabs`, `activeTabId`, `snapshots`
**Actions**: `executeQuery()`, `createSnapshot()`, `addTab()`

#### `schema.ts`
**作用**: 数据库结构状态管理
**State**: `tables`, `erDiagram`, `isLoading`
**Actions**: `loadTables()`, `loadERDiagram()`

#### `settings.ts`
**作用**: 应用设置状态管理
**State**: `theme`, `locale`, `isPanelOpen`

#### `toast.ts`
**作用**: 全局消息提示状态

#### `template.ts` (Snippet Store)
**作用**: 代码片段状态管理
**State**: `customSnippets`, `builtinSnippets`
**Getters**: `connectionSnippets`, `globalSnippets`

#### `history.ts`
**作用**: 查询历史状态管理

#### `crudLog.ts`
**作用**: CRUD 操作日志状态

#### `import.ts`
**作用**: 导入功能状态

---

## 组合式函数 (composables/)

### SQL 自动补全 (sql-completion/)

#### `useSQLCompletion.ts`
**作用**: SQL 编辑器自动补全 Hook
**功能**: 集成 Monaco Editor 的补全项提供者

#### `StoreSchemaDataSource.ts`
**作用**: 从 Pinia Store 获取 schema 数据作为补全数据源

#### `DefaultStrategyFactory.ts`
**作用**: 创建默认的补全策略

#### `adapters/MonacoAdapter.ts`
**作用**: Monaco Editor 适配器

#### `strategies/`
- `KeywordCompletionStrategy.ts` - 关键字补全
- `TableCompletionStrategy.ts` - 表名补全
- `ColumnCompletionStrategy.ts` - 列名补全
- `FunctionCompletionStrategy.ts` - 函数补全

### 其他 Composables

#### `useTheme.ts`
**作用**: 主题管理

---

## 工具函数 (utils/)

#### `tauri.ts`
**作用**: Tauri 工具函数
**导出**: `isTauri()`, `isVSCode()`, `safeInvoke()`

#### `sqlParser.ts`
**作用**: SQL 解析工具
**功能**: 提取表名、判断可编辑查询等

#### `date.ts`
**作用**: 日期格式化工具

---

## 国际化 (i18n/)

#### `index.ts`
**作用**: i18n 配置和初始化

#### `locales/zh-CN.ts`
**作用**: 中文翻译

#### `locales/en.ts`
**作用**: 英文翻译

---

## 类型定义 (types/)

#### `index.ts`
**作用**: 全局 TypeScript 类型定义
**类型**: `ConnectionInfo`, `QueryResult`, `TableInfo`, `Snippet` 等

---

## 指令 (directives/)

#### `focus.ts`
**作用**: `v-focus` 自动聚焦指令

---

## 样式 (styles/)

#### `index.css`
**作用**: 全局样式入口，导入 TailwindCSS

---

## 测试文件

所有 `.spec.ts` 文件都是测试文件，使用 Vitest。
测试配置在 `vite.config.ts` 中。

---

## 常见使用场景

### 1. 添加新功能模块

```typescript
// 1. 添加类型 (types/index.ts)
export interface NewFeature {
  id: string
  name: string
}

// 2. 添加服务 (services/newFeature.ts)
export const newFeatureService = {
  async doSomething() {
    if (isVSCode()) {
      return postVSCodeMessage('do_something')
    }
    return safeInvoke('do_something')
  }
}

// 3. 添加 Store (stores/newFeature.ts)
export const useNewFeatureStore = defineStore('newFeature', () => {
  // state, getters, actions
})

// 4. 添加组件 (components/xxx/NewComponent.vue)
```

### 2. 在组件中使用 Store

```vue
<script setup>
import { useConnectionStore } from '@stores/connection'
import { useQueryStore } from '@stores/query'

const connectionStore = useConnectionStore()
const queryStore = useQueryStore()

const activeConnection = computed(() => connectionStore.activeConnection)
const activeTab = computed(() => queryStore.activeTab)
</script>
```

### 3. 调用后端服务

```typescript
import { connectionService } from '@services/connection'
import { queryService } from '@services/query'

// 创建连接
const conn = await connectionService.createConnection('name', '/path/to/db')

// 执行查询
const result = await queryService.executeQuery({
  connectionId: conn.config.id,
  sql: 'SELECT * FROM users',
  limit: 100
})
```

### 4. 条件渲染（基于平台能力）

```vue
<script setup>
import { usePlatform } from '@services/platform/composable'

const platform = usePlatform()
const canExport = computed(() => 
  platform.capabilities.fileSystem !== 'none'
)
</script>

<template>
  <button v-if="canExport">导出</button>
</template>
```

---

## 重要注意事项

### 1. 平台检测
- **旧方式**: `isTauri()`, `isVSCode()` 直接检测
- **新方式**: 使用 `usePlatform()` 获取当前平台能力

### 2. 代码片段面板
- 必须使用 `Teleport to="body"` 渲染
- 使用 `fixed inset-y-0 right-0` 定位
- 包含 `appear` 属性确保动画正常

### 3. Monaco Editor
- 需要手动调用 `editor.layout()` 调整大小
- 当侧边面板展开/收起时需要触发

### 4. 消息桥接（VS Code）
- 所有 VS Code 通信通过 `postMessage` 实现
- 需要维护消息 ID 和 Promise 映射

---

## 开发命令

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 测试
pnpm test

# 类型检查
pnpm typecheck
```

---

## 文件命名规范

- **组件**: PascalCase (如 `SQLEditor.vue`)
- **服务**: camelCase (如 `query.ts`)
- **Store**: camelCase + use prefix (如 `useQueryStore`)
- **测试**: 同文件名 + `.spec.ts` (如 `query.spec.ts`)
- **类型**: PascalCase (如 `QueryResult`)

---

*文档版本: 2025-03-08*
