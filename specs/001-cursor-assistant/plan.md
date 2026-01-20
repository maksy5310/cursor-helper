# Implementation Plan: Cursor助手插件

**Branch**: `001-cursor-assistant` | **Date**: 2025-12-10 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-cursor-assistant/spec.md`

## Summary

Cursor助手插件通过直接访问 Cursor 的 SQLite 数据库，实现 Cursor AI 使用数据的自动采集和本地存储。插件提供侧边栏会话列表 panel，支持用户查看和管理 AI 对话会话。核心功能包括：使用统计数据采集（Tab键补全、cmd+K 行内补全、Agent 对话模式）、Agent 对话记录存储、会话列表显示。**重要更新**：会话列表 panel 采用用户主动刷新机制，不实现自动监视和轮询检查，以避免性能影响。

## Technical Context

**Language/Version**: TypeScript 5.x (VS Code Extension API)  
**Primary Dependencies**: 
- `vscode` (VS Code Extension API)
- `sql.js` (纯 JavaScript SQLite 库，避免原生模块编译问题)
- `@types/vscode`, `@types/node`, `@types/sql.js`

**Storage**: 
- 本地文件系统（JSON 格式，按日期组织）
- SQLite 数据库（只读访问 Cursor 的内部数据库）

**Testing**: 
- VS Code Extension Test Runner
- Mocha / Jest（可选）

**Target Platform**: 
- Cursor 编辑器（基于 VS Code）
- 跨平台支持（Windows、macOS、Linux）

**Project Type**: VS Code Extension（单项目结构）

**Performance Goals**: 
- 数据采集对 Cursor 性能影响 < 5%
- 会话列表 panel 对 Cursor 性能影响 < 2%（不包含后台监视和轮询开销）
- 插件初始化时间 < 10 秒
- 会话列表刷新延迟 < 2 秒（用户主动刷新时）

**Constraints**: 
- 必须避免影响 Cursor 的正常使用
- 数据采集失败时不重试（避免性能影响）
- 不实现自动监视和轮询检查机制（避免性能开销）
- 仅使用数据库访问方式（不实现 API 和文件访问方式）

**Scale/Scope**: 
- 单个工作空间的会话列表显示
- 按日期组织的数据文件存储
- 批量写入策略（10 秒或 100 条记录触发）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Pass**: 项目符合 VS Code Extension 开发规范，使用标准 TypeScript 和 VS Code Extension API。

## Project Structure

### Documentation (this feature)

```text
specs/001-cursor-assistant/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── storage-manager.md
│   ├── data-access.md
│   └── session-list-panel.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── models/
│   ├── usageStatistics.ts
│   ├── agentRecord.ts
│   └── sessionMarkdown.ts
├── dataAccess/
│   ├── dataAccess.ts
│   ├── databaseAccess.ts
│   └── sqliteAccess.ts
├── storageManager.ts
├── dataCollector.ts
├── ui/
│   ├── sessionListPanel.ts
│   ├── sessionListDataProvider.ts
│   └── markdownRenderer.ts
├── utils/
│   ├── logger.ts
│   ├── config.ts
│   └── cursorDataLocator.ts
├── commands/
│   ├── discoverCursorData.ts
│   ├── analyzeDatabase.ts
│   └── openSessionMarkdown.ts
└── extension.ts

tests/
├── unit/
└── integration/
```

**Structure Decision**: 采用单项目 VS Code Extension 结构，所有代码位于 `src/` 目录下，按功能模块组织（models、dataAccess、ui、utils、commands）。

## Phase 0: Research Findings

### Database Access Strategy

**Decision**: 使用 `sql.js`（纯 JavaScript SQLite 库）直接访问 Cursor 的 SQLite 数据库文件。

**Rationale**: 
- 避免原生模块（如 `better-sqlite3`）在 Electron 环境中的编译问题
- 跨平台兼容性好
- 只读访问，不影响 Cursor 的正常使用

**Alternatives Considered**:
- `better-sqlite3`: 需要原生编译，在 Electron 环境中存在 NODE_MODULE_VERSION 不匹配问题
- VS Code API: Cursor 未提供公开的数据访问 API

### Data Storage Strategy

**Decision**: 本地文件系统存储，按日期组织目录结构，JSON 格式。

**Rationale**:
- 简单可靠，无需额外依赖
- 便于用户查看和导出
- 按日期组织便于管理

**Alternatives Considered**:
- 数据库存储: 增加复杂度，用户不易查看
- 云端存储: 超出当前范围，推迟到后续版本

### Session List Update Mechanism

**Decision**: **用户主动刷新机制**（不实现自动监视和轮询检查）。

**Rationale**:
- 避免后台监视和轮询的性能开销
- 用户不需要实时扫描变化
- 简化实现，减少资源消耗

**Alternatives Considered**:
- ~~`fs.watch` + 定时检查 + 防抖机制~~: 已废弃，会造成额外的性能影响
- ~~仅定时检查~~: 已废弃，会造成额外的性能影响
- **用户主动刷新**: 选择此方案，性能最优，用户体验可接受

**Implementation Notes**:
- 移除 `DatabaseWatcher` 的自动监视和轮询功能
- 在会话列表 panel 中提供手动刷新按钮或命令
- 初始化时加载一次会话列表
- 用户可以通过点击刷新按钮或重新打开 panel 来更新列表

## Phase 1: Design & Contracts

### Data Model

参见 `data-model.md` 文件，包含：
- `UsageStatistics`: 使用统计数据模型
- `AgentRecord`: Agent 对话记录模型（统一存储所有对话类型）
- `SessionMarkdownView`: 会话 Markdown 视图模型

### API Contracts

参见 `contracts/` 目录：
- `storage-manager.md`: 存储管理器接口
- `data-access.md`: 数据访问层接口
- `session-list-panel.md`: 会话列表 panel 接口（**已更新**：移除自动更新机制）

### Key Design Decisions

1. **统一对话记录存储**: 所有对话类型（普通聊天和 Agent 模式）统一使用 `AgentRecord` 模型存储
2. **批量写入策略**: 实时采集，批量写入（10 秒或 100 条记录触发）
3. **用户主动刷新**: 会话列表 panel 不实现自动监视和轮询，改为用户主动刷新
4. **错误处理策略**: 记录错误但不重试，避免影响 Cursor 性能

## Implementation Phases

### Phase 1: Foundation
- ✅ 项目初始化和基础结构
- ✅ Logger、Config 工具类
- ✅ Extension 入口点

### Phase 2: Data Access Layer
- ✅ SQLite 访问实现（`sql.js`）
- ✅ 数据库定位器（`CursorDataLocator`）
- ✅ 数据访问抽象层（`DatabaseAccess`）

### Phase 3: Data Collection
- ✅ 数据采集器（`DataCollector`）
- ✅ 存储管理器（`StorageManager`）
- ✅ 批量写入策略

### Phase 4: Session List Panel
- ✅ 会话列表 panel UI
- ✅ 数据提供者（`SessionListDataProvider`）
- ⚠️ **需要更新**: 移除 `DatabaseWatcher` 集成，改为手动刷新机制
- ⚠️ **需要更新**: 添加刷新按钮或命令

### Phase 5: Session Markdown View
- ✅ Markdown 渲染器
- ✅ 会话 Markdown 视图命令

### Phase 6: Polish & Optimization
- ⚠️ **需要更新**: 移除 `DatabaseWatcher` 相关代码
- ⚠️ **需要更新**: 实现手动刷新功能
- 性能监控和优化
- 错误处理完善

## Required Code Changes

### 1. 移除 DatabaseWatcher 自动监视功能

**文件**: `src/extension.ts`
- 移除 `DatabaseWatcher` 的创建和启动
- 移除 `setDatabaseWatcher` 调用

**文件**: `src/ui/sessionListDataProvider.ts`
- 移除 `databaseWatcher` 属性
- 移除 `setDatabaseWatcher` 方法
- 移除自动刷新逻辑

**文件**: `src/utils/databaseWatcher.ts`
- ⚠️ **可选**: 保留文件但标记为废弃，或完全删除

### 2. 实现手动刷新功能

**文件**: `src/ui/sessionListPanel.ts`
- 添加 `refresh()` 方法（如果尚未实现）
- 确保 `SessionListDataProvider.refresh()` 可以被调用

**文件**: `src/extension.ts`
- 注册刷新命令（如 `cursor-assistant.refreshSessionList`）
- 在 panel 的上下文菜单中添加刷新选项

**文件**: `package.json`
- 添加刷新命令到 `contributes.commands`
- 在 TreeView 的上下文菜单中添加刷新选项

### 3. 更新合同文档

**文件**: `specs/001-cursor-assistant/contracts/session-list-panel.md`
- 更新 FR-012.2，移除自动更新机制描述
- 更新更新机制章节，说明用户主动刷新方式
- 更新性能要求，明确不包含后台监视开销

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违反项。

## Next Steps

1. **立即执行**: 更新代码以移除 `DatabaseWatcher` 自动监视功能
2. **立即执行**: 实现手动刷新功能
3. **立即执行**: 更新合同文档以反映新的更新机制
4. **后续**: 运行 `/speckit.tasks` 生成更新后的任务列表
5. **后续**: 运行 `/speckit.checklist` 创建一致性检查清单
