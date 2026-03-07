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
```

## 项目结构

```
sqlite-client/
├── apps/desktop/          # Tauri 桌面应用
│   └── src-tauri/         # Rust 后端 (入口: src/main.rs)
│       └── icons/         # 应用图标
├── packages/
│   └── ui/                # Vue3 前端 (入口: src/main.ts)
│       ├── src/components/
│       ├── src/stores/    # Pinia stores
│       ├── src/services/  # Tauri API 包装
│       └── src/types/     # TypeScript 类型
```

## 技术栈

- **前端**：Vue3 + TypeScript + TailwindCSS + Pinia
- **后端**：Rust + Tauri v2
- **编辑器**：Monaco Editor

## 编码规范

1. 使用 Composition API + `<script setup>`
2. Store 使用 Pinia 组合式语法
3. 组件使用 kebab-case 命名
4. 类型定义在 `@types/index.ts`
5. 错误处理使用 Toast 通知
