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
```

## 项目结构

```
sqlite-client/
├── apps/desktop/          # Tauri 桌面应用
│   └── src-tauri/         # Rust 后端 (入口: src/main.rs)
│       └── icons/         # 应用图标
├── packages/
│   ├── ui/                # Vue3 前端 (入口: src/main.ts)
│   │   ├── src/components/
│   │   ├── src/stores/    # Pinia stores
│   │   ├── src/services/  # Tauri API 包装
│   │   └── src/types/     # TypeScript 类型
│   └── vscode/            # VSCode 扩展
│       ├── src/
│       │   ├── extension.ts     # 扩展入口
│       │   ├── database.ts      # SQLite 后端 (better-sqlite3)
│       │   ├── webview-panel.ts # Webview 面板管理
│       │   └── utils/           # 工具函数
│       └── src/webview-ui/      # Webview 前端
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
