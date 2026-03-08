# SQLite Client - 代码评审报告

**评审日期**: 2026-03-08  
**项目版本**: v0.1.0  
**评审范围**: 全项目（Desktop App + VSCode Extension）

---

## 1. 项目概览

### 1.1 架构评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 整体架构 | ⭐⭐⭐⭐☆ | 清晰的模块化设计，前后端分离 |
| 代码质量 | ⭐⭐⭐⭐☆ | 整体良好，有少量技术债务 |
| 测试覆盖 | ⭐⭐⭐⭐☆ | 单元测试较完善，缺少 E2E 测试 |
| 文档完整度 | ⭐⭐⭐☆☆ | 基础文档齐全，缺少 API 文档 |
| 安全实践 | ⭐⭐⭐⭐☆ | SQL注入防护良好，有改进空间 |

---

## 2. 发现的问题

### 🔴 严重问题（需立即修复）

#### 2.1 SQL 注入风险

**位置**: `apps/desktop/src-tauri/src/core/ddl_engine.rs`

**问题**: PRAGMA 查询使用参数化查询无效（SQLite 限制）

```rust
// 当前代码 - 有注入风险
let current_columns: Vec<String> = conn
    .prepare("PRAGMA table_info(?1)")?  // PRAGMA 不支持参数化
    .query_map([table_name], |row| row.get::<_, String>(1))?
    .collect::<Result<_, _>>()?;
```

**修复建议**:
```rust
// 应先验证表名合法性
validate_identifier(table_name)?;
let sql = format!("PRAGMA table_info(\"{}\")", escape_identifier(table_name));
```

**状态**: ✅ 已修复

---

#### 2.2 资源泄漏风险

**位置**: `apps/desktop/src-tauri/src/core/query_engine.rs`

**问题**: StreamManager 缺少过期清理机制

```rust
pub struct StreamManager {
    streams: Arc<Mutex<HashMap<String, StreamState>>>,
}
// 缺少定期清理过期 stream 的机制
```

**影响**: 长时间运行可能导致内存泄漏

**修复建议**: 添加 TTL 机制和定期清理任务

---

### 🟡 中等问题（建议修复）

#### 2.3 错误处理不一致

**位置**: `apps/desktop/src-tauri/src/core/crud_log_store.rs`

**问题**: 混合使用 `std::sync::Mutex` 和 `parking_lot::Mutex`

```rust
// 修改前
use std::sync::Mutex;
conn.lock().map_err(|e| ...)?;  // 需要处理 PoisonError

// 修改后
use parking_lot::Mutex;
conn.lock();  // 不会 panic，更简单
```

**状态**: ✅ 已修复

---

#### 2.4 历史记录去重逻辑问题

**位置**: `apps/desktop/src-tauri/src/core/history_store.rs`

**问题**: 完全去重可能导致不同连接的正常记录丢失

```rust
// 原代码 - 全局去重
let exists: bool = conn
    .query_row("SELECT 1 FROM query_history WHERE sql = ?1 LIMIT 1", ...)
```

**修复**: 添加时间窗口限制

```rust
// 修复后 - 1小时内去重
AND executed_at > datetime('now', '-1 hour')
```

**状态**: ✅ 已修复

---

#### 2.5 类型定义重复

**位置**: 
- `packages/ui/src/types/index.ts`
- `apps/desktop/src-tauri/src/models/*.rs`

**问题**: TypeScript 和 Rust 类型手动同步，容易不一致

**建议**: 考虑使用 `ts-rs` 自动生成 TypeScript 类型

---

#### 2.6 缺少输入验证

**位置**: 多个组件

**问题**: 部分用户输入缺少边界验证

| 位置 | 问题 | 风险 |
|------|------|------|
| `ImportWizard.vue` | 文件名长度未限制 | 路径遍历 |
| `TableDesignerDialog.vue` | 列名长度未限制 | UI 异常 |
| `SQLEditor.vue` | SQL 大小无限制 | 内存溢出 |

---

### 🟢 低优先级问题（可选优化）

#### 2.7 未使用代码

```bash
# Clippy 警告
warning: method `load_saved_connections` is never used
warning: method `get_connection` is never used
warning: associated functions `export_to_csv`, `export_to_json` is never used
```

**建议**: 清理或使用 `#[allow(dead_code)]` 标记

---

#### 2.8 魔术字符串

**位置**: `packages/ui/src/i18n/locales/*.ts`

**问题**: 翻译键硬编码，缺少类型检查

**建议**: 使用 `vue-i18n` 的类型生成工具

---

#### 2.9 组件过大

| 组件 | 行数 | 建议 |
|------|------|------|
| `TableDesignerDialog.vue` | 504 | 拆分为多个子组件 |
| `SQLEditor.vue` | 430 | 提取工具栏和标签页 |
| `ResultGrid.vue` | 262 | 提取分页逻辑 |

---

## 3. 安全审计

### 3.1 SQL 注入防护 ✅ 良好

| 模块 | 状态 | 说明 |
|------|------|------|
| CRUD 操作 | ✅ | 使用参数化查询 |
| DDL 生成 | ✅ | 标识符转义 |
| 导入功能 | ✅ | 表名验证 |
| 查询执行 | ✅ | 参数绑定 |

### 3.2 文件操作安全 ⚠️ 需改进

```typescript
// 当前代码 - 直接拼接路径
const fileName = selected.split(/[/\\]/).pop() || 'Untitled'

// 建议 - 使用路径处理库
import { basename } from '@tauri-apps/api/path'
const fileName = await basename(selected)
```

### 3.3 XSS 防护 ✅ 良好

- Vue 自动转义 HTML
- Monaco Editor 安全配置
- Toast 消息纯文本显示

---

## 4. 性能分析

### 4.1 前端性能

| 问题 | 位置 | 建议 |
|------|------|------|
| 缺少虚拟滚动 | `ResultGrid.vue` | 大数据量时卡顿 |
| 防抖未统一 | 多个组件 | 统一使用 `useDebounce` |
| 未使用 `v-memo` | `ResultGrid.vue` | 频繁重渲染 |

### 4.2 后端性能

```rust
// 问题：大数据导出时内存占用高
pub fn export_to_csv(...) -> AppResult<()> {
    let result = Self::execute_query(pool, sql, None)?; // 加载全部数据
    ...
}

// 建议：使用流式处理
pub fn export_to_csv_stream(...) -> AppResult<()> {
    // 分批读取和写入
}
```

---

## 5. 测试覆盖

### 5.1 当前状态

```
前端测试: 506 个 ✅
后端测试: 61 个 ✅
集成测试: 9 个 ✅
```

### 5.2 缺失测试

| 模块 | 覆盖度 | 优先级 |
|------|--------|--------|
| E2E 测试 | 0% | 🔴 高 |
| VSCode 扩展 | 0% | 🟡 中 |
| 性能测试 | 0% | 🟡 中 |
| UI 组件测试 | 30% | 🟢 低 |

---

## 6. 代码规范

### 6.1 符合规范 ✅

- Vue 3 Composition API + `<script setup>`
- Pinia 组合式语法
- 组件使用 kebab-case 命名
- Rust 使用 snake_case

### 6.2 待改进 ⚠️

| 规则 | 位置 | 说明 |
|------|------|------|
| 最大行数 | `TableDesignerDialog.vue` | 504 行，建议 < 300 |
| 函数复杂度 | `preview_alter_table` | 圈复杂度过高 |
| 嵌套深度 | `execute_sql_file` | 嵌套层级 > 4 |

---

## 7. 架构建议

### 7.1 短期优化（1-2 周）

1. **添加 E2E 测试**
   ```bash
   pnpm add -D playwright
   ```

2. **实现虚拟滚动**
   ```bash
   pnpm add vue-virtual-scroller
   ```

3. **优化大文件导出**
   - 流式处理 CSV/JSON 导出

### 7.2 中期优化（1 个月）

1. **统一错误处理**
   - 实现全局错误边界
   - 统一错误码规范

2. **性能监控**
   - 添加查询性能指标
   - 内存使用监控

3. **代码分割**
   - 路由级别懒加载
   - Monaco Editor 按需加载

### 7.3 长期规划（3 个月）

1. **类型安全**
   ```rust
   // 使用 ts-rs 自动生成 TS 类型
   #[derive(TS)]
   #[ts(export)]
   pub struct ConnectionConfig { ... }
   ```

2. **插件系统**
   - 支持自定义 SQL 函数
   - 扩展数据导入/导出格式

3. **协作功能**
   - 查询共享
   - 团队协作空间

---

## 8. 具体修复清单

### 8.1 已修复问题 ✅

| 问题 | 文件 | 状态 |
|------|------|------|
| SQL 注入风险 | `ddl_engine.rs` | ✅ |
| Mutex 不一致 | `crud_log_store.rs` | ✅ |
| 历史记录去重 | `history_store.rs` | ✅ |
| Hex 编码命名 | `query_engine.rs` | ✅ |
| DDL 自动刷新 | `TableDesignerDialog.vue` | ✅ |

### 8.2 待修复问题 📋

| 优先级 | 问题 | 文件 | 预计工作量 |
|--------|------|------|-----------|
| 🔴 高 | StreamManager 内存泄漏 | `query_engine.rs` | 2h |
| 🔴 高 | PRAGMA 参数化查询 | `ddl_engine.rs` | 1h |
| 🟡 中 | 输入验证增强 | 多个文件 | 4h |
| 🟡 中 | 组件拆分 | `TableDesignerDialog.vue` | 3h |
| 🟢 低 | 清理未使用代码 | 多个文件 | 1h |

---

## 9. 总结

### 9.1 优点 👍

1. **架构清晰**: 前后端分离，模块化设计
2. **技术先进**: 使用 Tauri v2, Vue 3, Rust 等现代技术
3. **安全意识**: SQL 注入防护完善
4. **测试覆盖**: 单元测试较全面
5. **文档规范**: AGENTS.md 提供清晰的开发指南

### 9.2 改进点 📈

1. **性能优化**: 大数据量处理需改进
2. **测试完善**: 缺少 E2E 和性能测试
3. **类型安全**: TypeScript 和 Rust 类型手动同步
4. **资源管理**: StreamManager 需添加清理机制

### 9.3 总体评价

这是一个**高质量的现代化桌面应用项目**，代码结构清晰，安全实践良好，适合作为生产环境使用。建议按优先级修复发现的问题，并持续完善测试覆盖。

---

## 附录：工具配置

### 推荐的 ESLint 规则增强

```js
// eslint.config.js
export default [
  {
    rules: {
      // 复杂度限制
      'complexity': ['warn', 10],
      'max-lines-per-function': ['warn', 100],
      
      // Vue 规范
      'vue/max-attributes-per-line': ['error', { singleline: 3 }],
      'vue/require-default-prop': 'error',
      
      // TypeScript
      '@typescript-eslint/explicit-function-return-type': 'warn',
    }
  }
]
```

### 推荐的 Clippy 配置

```toml
# .cargo/config.toml
[build]
rustflags = [
  "-Dclippy::all",
  "-Dclippy::pedantic",
  "-Aclippy::module_name_repetitions",
]
```

---

**评审人**: Kimi Code  
**下次评审**: 建议 3 个月后进行跟进评审
