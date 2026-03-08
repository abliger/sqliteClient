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

| 类型 | 用途 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 添加 AI SQL 生成功能` |
| `fix` | Bug 修复 | `fix: 修复 ER 图缩放后表格不显示问题` |
| `refactor` | 代码重构 | `refactor: 优化查询执行逻辑` |
| `test` | 测试相关 | `test: 添加 ERDiagram 组件单元测试` |
| `docs` | 文档更新 | `docs: 更新 API 使用说明` |
| `style` | 代码格式 | `style: 修复 ESLint 警告` |
| `chore` | 构建/工具 | `chore: 更新依赖版本` |

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
5. **不要提交**：node_modules、构建产物、日志文件

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
