# Implementation Plan: 记录上传到分享平台

**Branch**: `003-upload-records` | **Date**: 2025-12-15 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-upload-records/spec.md`

## Summary

在 cursor-helper 插件中添加记录上传功能，允许用户将 Cursor 会话记录上传到分享平台。功能包括：在侧边面板会话列表中点击会话项触发上传表单、填写上传表单（项目名称、邮箱、时间、格式、内容）、在表单内编辑和预览会话内容、配置 JWT Token 认证、调用分享平台 API 上传记录、处理上传响应和错误。

**技术方案**：
- 在 `SessionListPanel` 的点击事件中集成上传功能入口
- 使用 VS Code Extension API 创建上传表单 UI（Webview）
- 通过现有的 `DatabaseAccess` 从数据库读取会话数据（composerId）
- 在 Webview 表单内提供内容编辑器（或弹出编辑器）用于编辑和预览
- 使用 Node.js 的 `fetch` API 调用分享平台 RESTful API
- 实现 JWT Token 配置和验证
- 处理网络错误、超时和 API 错误响应

## Technical Context

**Language/Version**: TypeScript 5.x (VS Code Extension API)  
**Primary Dependencies**: 
- `vscode` (VS Code Extension API)
- Node.js 内置 `fetch` API（Node.js 18+）或 `axios`（如果需要）
- 现有的 `StorageManager` 类（从 001-cursor-assistant 功能）

**Storage**: 
- 读取 Cursor 数据库（通过 `DatabaseAccess` 获取会话数据）
- 插件配置存储（VS Code 的 `globalState` 用于 JWT Token 和 API URL）

**Testing**: 
- VS Code Extension Test Runner
- Mock HTTP 请求（用于测试 API 调用）

**Target Platform**: 
- Cursor 编辑器（基于 VS Code）
- 跨平台支持（Windows、macOS、Linux）

**Project Type**: VS Code Extension（单项目结构，扩展现有功能）

**Performance Goals**: 
- 上传操作响应时间 ≤ 5 秒（SC-002）
- 表单验证错误提示 ≤ 1 秒（SC-003）
- 上传功能对插件性能影响 < 3%（SC-004）
- 完整上传流程 ≤ 2 分钟（SC-007）

**Constraints**: 
- 必须通过 `SessionListPanel` 的点击事件触发上传功能
- 必须使用现有的 `DatabaseAccess` 从数据库读取会话数据
- 必须在表单内提供内容编辑器（或弹出编辑器）用于编辑和预览
- 必须支持 JWT Token 配置和验证
- 必须处理所有 API 错误情况（400, 401, 413, 500）
- 必须在上传前验证内容大小（最大 10MB）
- 必须验证表单字段（项目名称、邮箱、时间格式等）

**Scale/Scope**: 
- 单条记录上传（不支持批量上传）
- 支持从侧边面板会话列表点击任意会话项触发上传
- 支持在表单内编辑和预览会话内容
- 支持配置分享平台基础 URL（默认从 API 文档获取）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Pass**: 项目符合 VS Code Extension 开发规范，使用标准 TypeScript 和 VS Code Extension API。功能扩展现有插件，不引入新的技术栈或架构模式。

## Project Structure

### Documentation (this feature)

```text
specs/003-upload-records/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── upload-service.md
│   └── upload-form.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── commands/
│   └── uploadRecord.ts          # 上传记录命令（从会话列表触发）
├── services/
│   └── uploadService.ts         # 上传服务（API 调用）
├── ui/
│   ├── uploadFormPanel.ts      # 上传表单 UI（Webview，包含编辑器）
│   └── sessionListPanel.ts     # 会话列表面板（需要修改，添加上传触发）
├── models/
│   └── uploadRecord.ts         # 上传记录数据模型
├── utils/
│   └── apiClient.ts            # API 客户端（HTTP 请求封装）
└── extension.ts                # 扩展入口点（需要注册命令）
```

**Structure Decision**: 采用单项目结构（VS Code Extension），在现有代码基础上扩展：
- `commands/`: 新增上传记录命令（从会话列表点击触发）
- `services/`: 新增上传服务，封装 API 调用逻辑
- `ui/`: 新增上传表单 UI（使用 Webview，包含内容编辑器）
- `ui/sessionListPanel.ts`: 修改现有会话列表面板，添加上传功能触发点
- `models/`: 定义上传记录的数据结构
- `utils/`: 新增 API 客户端工具类
- 复用现有的 `DatabaseAccess` 从数据库读取会话数据

## Phase 0: Research Findings

**Status**: ✅ Complete

Research findings are documented in `research.md`. Key decisions:
- **触发方式**: 在 `SessionListPanel` 的点击事件中集成上传功能，用户点击会话项时触发上传表单
- **UI 方案**: 使用 Webview 创建上传表单，提供完整的表单验证和内容编辑功能
- **数据源**: 使用 `DatabaseAccess` 从数据库读取会话数据（通过 composerId），不再使用本地文件
- **内容编辑器**: 在 Webview 表单内提供内容编辑器（textarea + 预览），如果无法实现则提供弹出编辑器按钮
- **HTTP 客户端**: 使用 Node.js 内置 `fetch` API，无需额外依赖
- **Token 存储**: 使用 `globalState` 存储 JWT Token，全局配置
- **错误处理**: 实现统一的错误处理机制，根据错误类型提供自动重试或手动重试
- **表单验证**: 实现客户端验证，快速反馈，同时处理服务端验证错误
- **内容格式转换**: 支持 json、markdown、text、html 格式，从数据库读取的会话数据转换为目标格式
- **进度显示**: 使用 `vscode.window.withProgress()` 显示上传进度

All "NEEDS CLARIFICATION" items from Technical Context have been resolved.

## Phase 1: Design & Contracts

**Status**: ✅ Complete

### Data Model

Data model is documented in `data-model.md`. Key entities:
- `UploadRecord`: 上传记录数据模型
- `UploadFormData`: 上传表单数据模型
- `UploadResponse`: 上传响应数据模型
- `UploadConfig`: 上传配置（JWT Token、API URL）
- `LocalRecordFile`: 本地记录文件信息

### Contracts

API contracts are documented in `contracts/`:
- `upload-service.md`: 上传服务接口定义
- `upload-form.md`: 上传表单 UI 接口定义

### Quick Start

Quick start guide is available in `quickstart.md`.

### Key Design Decisions

1. **触发方式**: 在 `SessionListPanel` 的点击事件中集成上传功能入口，用户点击会话项时显示上传表单
2. **UI 方案**: 使用 Webview 创建上传表单，提供更好的用户体验和表单验证
3. **数据源**: 使用 `DatabaseAccess` 从数据库读取会话数据，通过 composerId 获取完整的会话内容
4. **内容编辑器**: 在 Webview 表单内提供 textarea 编辑器用于编辑内容，并提供预览功能（Markdown 渲染）
5. **HTTP 客户端**: 使用 Node.js 内置 `fetch` API（Node.js 18+），无需额外依赖
6. **Token 存储**: 使用 VS Code 的 `globalState` 存储 JWT Token（全局配置）
7. **错误处理**: 实现统一的错误处理机制，显示用户友好的错误消息

## Implementation Phases

### Phase 1: Foundation
- 项目结构扩展
- API 客户端工具类（`apiClient.ts`）
- 上传配置管理（JWT Token、API URL）

### Phase 2: Data Models
- 上传记录数据模型（`uploadRecord.ts`）
- 表单数据验证逻辑

### Phase 3: Upload Service
- 上传服务实现（`uploadService.ts`）
- API 调用和错误处理
- 重试机制

### Phase 4: Upload Form UI
- 上传表单 Webview（`uploadFormPanel.ts`）
- 表单字段验证
- 内容编辑器（textarea + 预览功能）
- 从数据库加载会话内容

### Phase 5: Command Integration
- 上传记录命令（`uploadRecord.ts`）
- 修改 `SessionListPanel` 添加上传功能触发点
- 命令注册和集成
- 配置命令（JWT Token、API URL）

### Phase 6: Polish & Testing
- 错误处理完善
- 用户体验优化
- 单元测试和集成测试

## Required Code Changes

### 1. 新增文件

**文件**: `src/services/uploadService.ts`
- 实现上传服务，封装 API 调用逻辑
- 处理 JWT Token 认证
- 处理错误响应和重试

**文件**: `src/ui/uploadFormPanel.ts`
- 实现上传表单 Webview
- 表单字段验证
- 内容编辑器（textarea + 预览功能）
- 从数据库加载会话内容（通过 composerId）

**文件**: `src/commands/uploadRecord.ts`
- 实现上传记录命令
- 打开上传表单 UI
- 处理上传结果

**文件**: `src/models/uploadRecord.ts`
- 定义上传记录数据模型
- 表单数据验证

**文件**: `src/utils/apiClient.ts`
- 实现 API 客户端工具类
- HTTP 请求封装
- 错误处理

### 2. 修改现有文件

**文件**: `src/ui/sessionListPanel.ts`
- 修改点击事件处理，添加上传功能触发点
- 支持右键菜单或点击事件触发上传表单

**文件**: `src/extension.ts`
- 注册上传记录命令
- 注册配置命令（JWT Token、API URL）

**文件**: `package.json`
- 添加上传记录命令到 `contributes.commands`
- 添加上传表单 Webview 配置

**文件**: `src/utils/config.ts`
- 添加 JWT Token 配置方法（使用 globalState）
- 添加 API URL 配置方法（使用 globalState）

**文件**: `src/dataAccess/databaseAccess.ts`（已存在，需要了解接口）
- 使用 `getComposerData(composerId)` 获取会话数据
- 使用 `getAgentRecords(sessionId?)` 获取 Agent 记录

### 3. 配置文件

**文件**: `package.json`
- 添加命令：`cursor-assistant.uploadRecord`
- 添加命令：`cursor-assistant.configureUpload`
- 添加 Webview 配置

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违反项。

## Next Steps

1. **立即执行**: 完成 Phase 0 研究，生成 `research.md`
2. **立即执行**: 完成 Phase 1 设计，生成 `data-model.md`、`contracts/`、`quickstart.md`
3. **后续**: 运行 `/speckit.tasks` 生成详细任务列表
4. **后续**: 运行 `/speckit.checklist` 创建一致性检查清单

