# Implementation Plan: Cursor工作空间会话支持

**Branch**: `005-workspace-sessions` | **Date**: 2026-01-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-workspace-sessions/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

扩展Cursor助手插件以支持多根工作空间（multi-root workspace）。当前实现仅处理单个工作空间数据库，需要增强以：
1. 自动检测工作空间类型（单根 vs 多根）
2. 识别多根工作空间中的所有子项目
3. 从工作空间数据库中聚合会话记录（多根工作空间共享一个数据库）
4. 确保会话列表与Cursor AI面板保持一致

**技术方法**：通过研究确认，多根工作空间共享一个工作空间数据库（而非每个子项目独立存储）。因此实现策略为：
- 扩展`WorkspaceHelper`类：添加`detectWorkspaceType()`和`getWorkspaceInfo()`方法，使用`vscode.workspace.workspaceFile`检测多根工作空间
- 扩展`DatabaseAccess`类：支持基于工作空间信息匹配数据库路径，从共享数据库读取会话
- 更新`UnifiedSessionDataProvider`：使用新的工作空间检测逻辑，自动适配单根和多根工作空间
- 添加缓存机制：缓存工作空间类型和数据库路径，提升性能（<1秒检测，<3秒加载）

## Technical Context

**Language/Version**: TypeScript 5.0+, Node.js >=18.0.0  
**Primary Dependencies**: 
- VS Code Extension API (`@types/vscode ^1.74.0`)
- sql.js (`^1.13.0`) - SQLite数据库访问
- node-fetch (`^3.0.0`) - HTTP请求
- jose (`^5.0.0`) - JWT处理

**Storage**: 
- Cursor内部SQLite数据库（`state.vscdb`）
- 全局数据库：`{CursorUserDataDir}/globalStorage/state.vscdb`
- 工作空间数据库：`{CursorUserDataDir}/workspaceStorage/{workspaceId}/state.vscdb`
- 每个多根工作空间的子项目可能有独立的工作空间数据库

**Testing**: 
- VS Code Extension Test Framework (`@vscode/test-electron ^2.3.0`)
- 单元测试：TypeScript + Node.js测试运行器
- 集成测试：需要实际Cursor工作空间环境

**Target Platform**: VS Code/Cursor扩展（跨平台：Windows, macOS, Linux）

**Project Type**: VS Code扩展（single project）

**Performance Goals**: 
- 工作空间类型检测：<1秒（SC-001）
- 工作空间切换后会话列表更新：<2秒（SC-003）
- 支持最多10个子项目的多根工作空间，加载时间<3秒（SC-004）

**Constraints**: 
- 必须与Cursor内部数据库结构兼容
- 不能修改Cursor的数据库文件
- 需要处理数据库文件不存在或无法访问的情况
- 必须保持与Cursor AI面板的会话列表一致性（100%匹配率，SC-002）

**Scale/Scope**: 
- 支持最多10个子项目的多根工作空间
- 处理数千个会话记录的性能要求
- 单个VS Code扩展功能模块

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ **PASS**

**Rationale**: 
- 项目遵循现有VS Code扩展架构模式
- 扩展现有模块而非创建新项目
- 使用现有测试框架和工具链
- 无架构违规或复杂性增加

**Gates**:
- ✅ 使用现有项目结构（无需新项目）
- ✅ 扩展现有模块（DatabaseAccess, WorkspaceHelper）
- ✅ 遵循现有代码模式和约定
- ✅ 使用现有测试框架

## Project Structure

### Documentation (this feature)

```text
specs/005-workspace-sessions/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── dataAccess/
│   ├── databaseAccess.ts        # 扩展：支持多工作空间数据库聚合
│   └── sqliteAccess.ts          # 现有：SQLite访问层
├── utils/
│   ├── workspaceHelper.ts      # 扩展：添加多根工作空间检测方法
│   └── cursorDataLocator.ts    # 现有：Cursor数据定位
├── ui/
│   ├── unifiedSessionDataProvider.ts  # 扩展：支持多根工作空间会话聚合
│   └── sessionListPanel.ts     # 现有：会话列表面板
└── models/
    └── (现有模型，无需修改)

tests/
├── unit/
│   └── workspaceHelper.test.ts  # 新增：多根工作空间检测测试
└── integration/
    └── (可能需要多根工作空间集成测试)
```

**Structure Decision**: 使用现有单项目结构。此功能通过扩展现有模块实现，无需创建新项目或改变项目结构。主要修改集中在：
- `src/dataAccess/databaseAccess.ts` - 添加多工作空间数据库聚合
- `src/utils/workspaceHelper.ts` - 添加多根工作空间检测
- `src/ui/unifiedSessionDataProvider.ts` - 更新会话列表聚合逻辑

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违规。此功能通过扩展现有模块实现，未增加架构复杂性。

---

## Phase Status

### Phase 0: Outline & Research ✅ **COMPLETE**

**Output**: `research.md`

**Key Findings**:
- 多根工作空间共享一个工作空间数据库（非每个子项目独立）
- 使用`vscode.workspace.workspaceFile`检测多根工作空间
- 会话数据聚合从共享数据库读取，无需跨数据库查询
- 性能优化：缓存工作空间类型和数据库路径

**All NEEDS CLARIFICATION resolved**: ✅

---

### Phase 1: Design & Contracts ✅ **COMPLETE**

**Outputs**:
- `data-model.md` - 数据模型定义
- `contracts/workspace-detection.md` - API合约
- `quickstart.md` - 快速开始指南
- Agent context updated

**Key Artifacts**:
- **WorkspaceInfo** entity: 工作空间类型和元数据
- **SessionRecord** entity: 会话记录结构
- **AggregatedSessionList** entity: 聚合后的会话列表
- API扩展：`WorkspaceHelper.detectWorkspaceType()`, `DatabaseAccess.getSessionList(workspaceInfo)`

**Constitution Check (Post-Design)**: ✅ **PASS** - 无违规

---

### Phase 2: Task Breakdown

**Status**: ⏳ **PENDING** - 等待 `/speckit.tasks` 命令执行

**Next Steps**:
- 使用 `/speckit.tasks` 命令创建任务列表
- 任务将基于此计划文档和规格说明生成
