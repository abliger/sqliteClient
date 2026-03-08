# SQLite Client - Agent Instructions

## 每次会话必查文件

在回答任何问题前，请先阅读以下文件了解项目上下文：

```
必须查看：
- packages/ui/src/types/index.ts      # 类型定义
- apps/desktop/src-tauri/tauri.conf.json  # Tauri 配置

根据问题类型选择性查看：
- UI 问题：packages/ui/src/components/**/*.vue
- Store 问题：packages/ui/src/stores/*.ts
- 后端问题：apps/desktop/src-tauri/src/**/*.rs
- VSCode 扩展：packages/vscode/src/**/*.ts
- 平台适配：packages/ui/src/services/platform/**/*.ts
```

## 项目结构

```
sqlite-client/
├── apps/desktop/          # Tauri 桌面应用
│   └── src-tauri/         # Rust 后端 (入口: src/main.rs)
│       ├── src/commands/  # Tauri 命令处理器
│       ├── src/core/      # 核心业务逻辑
│       └── icons/         # 应用图标
├── packages/
│   ├── ui/                # Vue3 前端 (入口: src/main.ts)
│   │   ├── src/components/
│   │   ├── src/stores/    # Pinia stores
│   │   ├── src/services/  # 平台服务层
│   │   │   └── platform/  # 多平台适配器
│   │   └── src/types/     # TypeScript 类型
│   └── vscode/            # VSCode 扩展
│       ├── src/
│       │   ├── extension.ts     # 扩展入口
│       │   ├── database.ts      # SQLite 后端 (better-sqlite3)
│       │   ├── webview-panel.ts # Webview 面板管理
│       │   ├── editor-provider.ts # 自定义编辑器（双击打开）
│       │   └── webview-ui/      # Webview 前端 mocks
│       └── package.json         # 扩展配置
```

## 技术栈

- **前端**：Vue3 + TypeScript + TailwindCSS + Pinia
- **桌面后端**：Rust + Tauri v2
- **VSCode 后端**：Node.js + better-sqlite3
- **编辑器**：Monaco Editor

## 编码规范

1. 使用 Composition API + `<script setup>`
2. Store 使用 Pinia 组合式语法
3. 组件使用 kebab-case 命名
4. 类型定义在 `@types/index.ts`
5. 错误处理使用 Toast 通知
6. SQL 标识符使用 `quoteTableName()` / `quoteColumnName()` 防止注入

---

## Tauri 集成架构

### 1. 入口文件

#### `apps/desktop/src-tauri/src/main.rs`

**作用**：Tauri 应用主入口，负责：

- 初始化应用状态（连接管理器、历史记录存储、CRUD 日志存储）
- 创建系统菜单（文件、打开数据库、创建数据库、设置、退出）
- 处理菜单事件（通过 emit 发送到前端）
- 注册所有 Tauri 命令（invoke_handler）

**关键结构**：

```rust
// 初始化流程
1. HistoryStore::new()          - 查询历史存储
2. ConnectionStore::new()       - 连接配置存储
3. ConnectionManager::new()     - 连接管理器
4. CrudLogStore::new()          - CRUD 操作日志
5. SettingsStore::new()         - 应用设置
6. create_menu()                - 创建应用菜单
```

#### `apps/desktop/src-tauri/src/lib.rs`

**作用**：库入口，导出核心模块供外部使用

### 2. 命令层 (`src/commands/`)

| 文件            | 作用                                   |
| --------------- | -------------------------------------- |
| `mod.rs`        | 命令模块导出                           |
| `connection.rs` | 连接管理：创建、关闭、列表、测试连接   |
| `query.rs`      | 查询执行：执行 SQL、流式查询、取消查询 |
| `schema.rs`     | 元数据：表列表、表结构、ER 图数据      |
| `crud.rs`       | CRUD 操作：增删改查、分页获取数据      |
| `export.rs`     | 数据导出：CSV、JSON、导出查询结果      |
| `import.rs`     | 数据导入：CSV/Excel 解析、类型检测     |
| `history.rs`    | 查询历史：获取、搜索、删除、清空       |
| `crud_log.rs`   | CRUD 日志：添加、查询、统计            |
| `ddl.rs`        | DDL 操作：建表、改表、删表预览和执行   |
| `settings.rs`   | 应用设置：获取、保存设置               |

### 3. 核心业务层 (`src/core/`)

| 文件                    | 作用                           |
| ----------------------- | ------------------------------ |
| `connection_manager.rs` | 管理数据库连接池，使用 r2d2    |
| `connection_store.rs`   | 持久化连接配置到本地文件       |
| `query_engine.rs`       | 执行 SQL 查询，处理结果包装    |
| `schema_analyzer.rs`    | 分析数据库结构，生成 ER 图数据 |
| `import_engine.rs`      | 处理数据导入逻辑               |
| `ddl_engine.rs`         | DDL 语句生成和执行             |
| `history_store.rs`      | 查询历史持久化                 |
| `crud_log_store.rs`     | CRUD 操作日志存储              |

### 4. 模型层 (`src/models/`)

定义数据结构（Connection、QueryResult、TableInfo 等）

---

## VSCode 扩展架构

### 1. 入口文件

#### `packages/vscode/src/extension.ts`

**作用**：VSCode 扩展激活入口，负责：

- 注册命令（`sqliteClient.open`, `sqliteClient.openDatabase`）
- 注册自定义编辑器提供者（双击打开 SQLite 文件）
- 管理 DatabaseManager 和 EditorProvider 单例
- 处理扩展生命周期（activate/deactivate）

**关键流程**：

```typescript
activate(context)
  ├── registerCommand('sqliteClient.open')      # 打开面板
  ├── registerCommand('sqliteClient.openDatabase')  # 打开数据库
  └── registerCustomEditorProvider('sqliteClient.editor')  # 双击打开
```

### 2. 数据库管理

#### `packages/vscode/src/database.ts`

**作用**：DatabaseManager 类，使用 better-sqlite3 操作 SQLite：

- **连接管理**：`createConnection()`, `closeConnection()`
- **查询执行**：`executeQuery()` - 支持 SELECT 和非 SELECT
- **CRUD 操作**：`insertRow()`, `updateRow()`, `deleteRow()`, `getTableData()`
- **元数据**：`listTables()`, `getTableSchema()`, `getERDiagramData()`
- **DDL 操作**：`createTable()`, `alterTable()`, `dropTable()`
- **导入导出**：`executeSqlFile()`, CSV/JSON 导出
- **查询历史**：`getQueryHistory()`, `searchHistory()`

**安全特性**：

- SQL 注入防护：`quoteTableName()`, `validateIdentifier()`
- 参数化查询：所有用户输入使用 `?` 占位符
- 事务处理：CRUD 操作使用 `db.transaction()`

### 3. WebView 面板

#### `packages/vscode/src/webview-panel.ts`

**作用**：SQLitePanel 类，管理 WebView 面板：

- 创建/显示面板：`createOrShow()`
- 绑定到自定义编辑器：`bindToWebviewPanel()`
- 注册命令处理器：`registerCommandHandlers()`
- 生成 HTML：`getHtmlForWebview()` - 添加 CSP、替换资源路径
- 消息处理：`handleMessage()` - 调用 database.ts 方法

**命令映射示例**：

```typescript
this.commandHandlers.set('execute_query', {
    validator: p => requireConnectionId(p) && requireString('sql')(p),
    handler: p => this.databaseManager.executeQuery(p.connectionId, p.sql, p.limit),
})
```

### 4. 自定义编辑器

#### `packages/vscode/src/editor-provider.ts`

**作用**：SQLiteEditorProvider 类，实现双击打开 SQLite 文件：

- `openCustomDocument()` - 打开文档
- `resolveCustomEditor()` - 解析编辑器，创建 WebView
- `getHtmlForWebview()` - 生成带 CSP 的 HTML

### 5. VSCode WebView 前端 Mocks

#### `packages/vscode/src/webview-ui/mocks/tauri.ts`

**作用**：模拟 Tauri 的 `invoke` 函数：

- 将 `invoke(command, args)` 转换为 VSCode 消息
- 消息 ID 生成和响应匹配
- 30秒超时处理

#### `packages/vscode/src/webview-ui/mocks/tauri-apps-api-core.ts`

**作用**：导出模拟的 Tauri Core API

#### `packages/vscode/src/webview-ui/vscode-api.ts`

**作用**：声明 VSCode API 类型，提供全局访问

### 6. Vite 配置

#### `packages/vscode/vite.config.ts`

**关键配置**：

```typescript
// 将 Tauri API 导入映射到 mock 文件
resolve: {
  alias: {
    '@tauri-apps/api/core': mocksDir + '/tauri-apps-api-core.ts',
    '@tauri-apps/plugin-dialog': mocksDir + '/tauri-apps-plugin-dialog.ts',
    // ...
  }
}
// 外部化 vscode 模块
build: {
  rollupOptions: {
    external: ['vscode']
  }
}
```

---

## 多平台适配层

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Stores  │ │Components│ │ Composables│ │ Services │          │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       └─────────────┴─────────┴────────────┘                │
│                         │                                    │
│              Platform Service Adapter                        │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Tauri      │  │   VS Code    │  │     Web      │
│   Provider   │  │   Provider   │  │   Provider   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Tauri API   │  │  VS Code API │  │  Mock API    │
│  (invoke)    │  │  (postMessage)│  │  (console)   │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 核心文件

#### `packages/ui/src/services/platform/index.ts`

**作用**：平台适配器入口，提供：

- `registerPlatform(name, loader)` - 注册平台 Provider
- `initializePlatform(options)` - 初始化平台
- `usePlatform()` - 获取当前平台（同步）
- `detectPlatform()` - 自动检测平台（Tauri/VSCode/Web）

**使用方式**：

```typescript
// 自动检测并初始化
const platform = await initializePlatform()

// 执行查询
const result = await platform.query.executeQuery({
    connectionId: 'xxx',
    sql: 'SELECT * FROM users',
})

// 检查能力
if (platform.capabilities.fileSystem !== 'none') {
    // 显示导出按钮
}
```

#### `packages/ui/src/services/platform/types.ts`

**作用**：定义平台接口类型：

- `PlatformName`: 'tauri' | 'vscode' | 'web' | 'mock'
- `PlatformCapabilities`: 数据库、文件系统、对话框等能力声明
- `PlatformProvider`: 统一的平台接口

#### `packages/ui/src/services/platform/providers/tauri.ts`

**作用**：Tauri 平台实现：

- 使用 `@tauri-apps/api/core` 的 `invoke()` 调用 Rust 命令
- 使用 `@tauri-apps/plugin-dialog` 打开/保存文件
- 使用 `@tauri-apps/plugin-fs` 读写文件
- localStorage 用于持久化存储

#### `packages/ui/src/services/platform/providers/vscode.ts`

**作用**：VSCode 平台实现：

- 使用 `window.vscode.postMessage()` 发送消息到 Extension Host
- 监听 `window.addEventListener('message')` 接收响应
- 30秒超时处理

#### `packages/ui/src/services/platform/composable.ts`

**作用**：Vue Composable，提供：

- `usePlatform()` - 注入平台实例
- `usePlatformAsync()` - 异步获取（自动初始化）
- `usePlatformCapabilities()` - 获取能力
- `createPlatformPlugin()` - Vue 插件

**使用方式**：

```vue
<script setup>
    import { usePlatformAsync } from '@services/platform/composable'

    const { platform, isLoading, error } = usePlatformAsync()
</script>

<template>
    <button v-if="!isLoading" @click="platform.query.executeQuery(...)">查询</button>
</template>
```

---

## 如何使用这些组件

### 场景 1：添加新的数据库操作

**Tauri 侧**：

1. 在 `src/commands/` 添加新的命令函数
2. 在 `main.rs` 的 `invoke_handler` 中注册
3. 更新 `tauri.conf.json` 如有新权限需求

**VSCode 侧**：

1. 在 `database.ts` 的 `DatabaseManager` 类添加方法
2. 在 `webview-panel.ts` 的 `registerCommandHandlers()` 中注册命令

**UI 侧**：

1. 在 `platform/types.ts` 更新接口（如需要）
2. 在 `providers/tauri.ts` 和 `providers/vscode.ts` 实现
3. 在 Store 或服务中使用 `usePlatform()` 调用

### 场景 2：平台特定功能检测

```typescript
import { usePlatform, usePlatformCapability } from '@services/platform/composable'

const platform = usePlatform()
const canExport = usePlatformCapability('fileSystem')

// 条件渲染
const showExportButton = computed(() => canExport.value !== 'none')

// 平台特定逻辑
if (platform.name === 'tauri') {
    // Tauri 特定功能
} else if (platform.name === 'vscode') {
    // VSCode 特定功能
}
```

### 场景 3：开发新功能时测试不同平台

```typescript
// 强制使用特定平台（开发测试）
import { initializePlatform } from '@services/platform'

// 测试 Tauri 实现
await initializePlatform({ provider: 'tauri' })

// 测试 VSCode 实现
await initializePlatform({ provider: 'vscode' })

// 使用 Mock（单元测试）
await initializePlatform({ provider: 'mock' })
```

---

## Git 提交规范

### 每次功能完成必须提交

**如果项目使用 Git，每完成一个功能或修复后，必须立即进行 Git 提交。**

提交流程：

```bash
# 1. 检查变更
git status
git diff

# 2. 添加相关文件（使用精确路径，避免 git add .）
git add <具体文件路径>

# 3. 提交（遵循 commit message 规范）
git commit -m "<type>: <description>"

# 4. 如有必要，推送到远程
git push
```

### Commit Message 格式

```
<type>: <简短描述>

[可选的详细描述]

[可选的关闭 issue 引用]
```

**type 类型：**

| 类型       | 用途      | 示例                                  |
| ---------- | --------- | ------------------------------------- |
| `feat`     | 新功能    | `feat: 添加 AI SQL 生成功能`          |
| `fix`      | Bug 修复  | `fix: 修复 ER 图缩放后表格不显示问题` |
| `refactor` | 代码重构  | `refactor: 优化查询执行逻辑`          |
| `test`     | 测试相关  | `test: 添加 ERDiagram 组件单元测试`   |
| `docs`     | 文档更新  | `docs: 更新 API 使用说明`             |
| `style`    | 代码格式  | `style: 修复 ESLint 警告`             |
| `chore`    | 构建/工具 | `chore: 更新依赖版本`                 |

**示例：**

```bash
# 功能开发
git commit -m "feat: 添加查询结果导出为 Excel 功能"

# Bug 修复
git commit -m "fix: 修复右键菜单语言不跟随系统设置的问题

- 在 en.ts 和 zh-CN.ts 中添加 editor.addToSnippet 翻译键
- SQLEditor.vue 中使用 useI18n 动态获取菜单 label
- 监听 locale 变化自动更新右键菜单"

# 测试
git commit -m "test: 添加 tauri.ts 工具函数单元测试

- 测试 isTauri() 环境检测
- 测试 safeInvoke() 安全调用
- 测试 createTauriOnlyFn() 包装器"
```

### 提交注意事项

1. **原子性提交**：一个提交只包含一个功能或修复
2. **避免大提交**：不要将多个不相关的变更混在一起
3. **及时提交**：完成一个可工作的单元后立即提交，不要积压
4. **测试通过后再提交**：确保提交前 `npm run test` 通过
5. **不要提交**：node_modules、构建产物、日志文件、大型数据库文件（如 pixiv.db）

---

## VSCode 扩展开发注意事项

### 安全规范

1. **SQL 注入防护**：
    - 所有表名、列名必须使用 `quoteTableName()` / `quoteColumnName()`
    - 验证标识符使用 `validateIdentifier()`
    - 用户输入必须通过参数化查询

2. **消息处理**：
    - 所有命令必须通过 `commandHandlers` 注册
    - 参数需要添加 `validator` 验证
    - 消息 ID 使用 `generateShortId()` 生成

3. **资源管理**：
    - 数据库连接必须正确关闭
    - 使用 `try-finally` 确保资源释放
    - 消息监听器在组件卸载时清理

### 文件路径映射

```typescript
// Tauri API 被映射到 VSCode API
@tauri-apps/api/core -> mocks/tauri-apps-api-core.ts
@tauri-apps/plugin-dialog -> mocks/tauri-apps-plugin-dialog.ts
@tauri-apps/plugin-fs -> mocks/tauri-apps-plugin-fs.ts
```

### 构建流程

```bash
# VSCode 扩展完整构建
cd packages/vscode
pnpm build

# 分步构建
pnpm rebuild:native      # 重建 better-sqlite3 原生模块
pnpm build:extension     # 构建扩展后端 (esbuild)
pnpm build:webview       # 构建 WebView 前端 (vite)
pnpm copy:native         # 复制原生模块到 dist

# 打包
pnpm package             # 生成 .vsix 文件
```
