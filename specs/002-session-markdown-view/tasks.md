# Tasks: 会话 Markdown 视图

**Input**: Design documents from `/specs/002-session-markdown-view/`  
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are organized by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths shown below assume single project structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

**Status**: ✅ Complete (基础结构已存在)

- [X] T001 Create project structure per implementation plan
- [X] T002 Initialize TypeScript project with VS Code Extension dependencies
- [X] T003 [P] Configure linting and formatting tools
- [X] T004 Create data model interfaces in `src/models/sessionMarkdown.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**Status**: ✅ Complete (基础渲染器已实现)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create base MarkdownRenderer class in `src/ui/markdownRenderer.ts`
- [X] T006 [P] Implement `escapeMarkdown()` method in `src/ui/markdownRenderer.ts`
- [X] T007 [P] Implement basic `renderBubble()` method in `src/ui/markdownRenderer.ts`
- [X] T008 [P] Implement basic `renderSession()` method in `src/ui/markdownRenderer.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 查看会话 Markdown 视图 (Priority: P1) 🎯 MVP

**Goal**: 用户在左侧面板的会话列表中点击某个会话条目，系统自动打开一个新的编辑器窗口，显示该会话的完整对话内容，以 Markdown 格式呈现，包括所有用户消息和 Agent 回复，以及详细的工具使用信息。工具名称应正确提取，原始 JSON 数据应作为 HTML 注释附加以便调试。

**Independent Test**: 可以通过点击会话列表中的任意会话条目，验证是否成功打开编辑器并显示 Markdown 格式的对话内容，包括各种工具类型的详细渲染，工具名称应正确显示而非 "Unknown Tool"。

**Acceptance Criteria**:
1. 用户点击会话条目后，编辑器窗口在 2 秒内打开并显示内容（SC-001）
2. Markdown 渲染包含会话中所有可用消息，无遗漏（SC-002）
3. 对于包含 100 条消息的会话，Markdown 生成时间不超过 3 秒（SC-003）
4. 用户能够成功查看和阅读 Markdown 格式的对话内容，消息顺序正确（SC-004）
5. 工具使用提示正确显示在相应位置，包括详细的工具信息（SC-005）
6. 各种工具类型（代码编辑、代码检索、任务控制等）都有专门的渲染格式
7. **工具名称应正确提取，不应显示 "Unknown Tool"**
8. **原始 JSON 数据应作为 HTML 注释附加在每个工具渲染块中，方便调试**

### Implementation for User Story 1

#### 基础功能（已完成）

- [X] T009 [US1] 实现基础工具使用提示逻辑在 `src/ui/markdownRenderer.ts`，当 Agent 消息无文本但存在 `capabilities` 或 `toolCallResults` 时显示占位符
- [X] T010 [US1] 创建打开会话 Markdown 视图命令 `openSessionMarkdownCommand()` 在 `src/commands/openSessionMarkdown.ts`
- [X] T011 [US1] 实现数据加载逻辑在 `src/commands/openSessionMarkdown.ts`，使用 `DatabaseAccess.getAgentRecords()` 加载会话数据
- [X] T012 [US1] 实现编辑器创建和显示逻辑在 `src/commands/openSessionMarkdown.ts`，使用 `vscode.workspace.openTextDocument()` 和 `vscode.window.showTextDocument()`
- [X] T013 [US1] 实现进度显示和错误处理在 `src/commands/openSessionMarkdown.ts`，使用 `vscode.window.withProgress()` 和 `vscode.window.showErrorMessage()`
- [X] T014 [US1] 修改 `SessionListPanel` 类在 `src/ui/sessionListPanel.ts`，添加 `TreeView.onDidChangeSelection` 事件监听器
- [X] T015 [US1] 在点击事件处理中调用 `cursor-assistant.openSessionMarkdown` 命令在 `src/ui/sessionListPanel.ts`，传递 `composerId` 参数
- [X] T016 [US1] 在 `extension.ts` 中注册 `cursor-assistant.openSessionMarkdown` 命令在 `src/extension.ts`

#### 工具类型渲染增强（已完成）

- [X] T017-T030 [US1] 实现所有工具类型的渲染方法（代码编辑、代码检索、任务控制工具）
- [X] T031 [US1] 实现 `renderToolDetails()` 方法在 `src/ui/markdownRenderer.ts`
- [X] T032 [US1] 修改 `renderBubble()` 方法集成工具详细渲染逻辑
- [X] T033-T035 [US1] 实现辅助方法（工具数据提取、表格生成、details 块生成）

#### 工具数据提取修复和调试增强（当前阶段）

**问题**: 很多工具显示为 "Unknown Tool"，说明工具名称提取逻辑有问题。需要：
1. 检查所有可能的字段路径
2. 添加原始 JSON 数据作为 HTML 注释
3. 改进工具名称匹配逻辑

- [X] T046 [US1] 修复 `extractToolData()` 方法在 `src/ui/markdownRenderer.ts`，检查所有可能的工具名称字段路径：
  - `toolFormerData.name`
  - `toolFormerData.toolName`
  - `toolCallResults[].name`
  - `toolCallResults[].toolName`
  - `capabilities[].name`
  - `capabilities[].type`
  - `capabilities[].toolName`
  - 以及其他可能的字段路径
- [X] T047 [US1] 修复 `extractToolInfo()` 方法在 `src/ui/markdownRenderer.ts`，使用与 `extractToolData()` 相同的字段路径检查逻辑，确保工具名称正确提取
- [X] T048 [US1] 实现 `serializeJsonForComment()` 辅助方法在 `src/ui/markdownRenderer.ts`，将 JSON 对象序列化为字符串，转义 HTML 注释中的特殊字符（`--` 和 `>`），确保可以安全地嵌入 HTML 注释
- [X] T049 [US1] 修改 `generateDetailsBlock()` 方法在 `src/ui/markdownRenderer.ts`，添加可选的原始 JSON 数据参数，将原始数据作为 HTML 注释附加在 `<details>` 块中
- [X] T050 [US1] 修改所有工具渲染方法（T017-T030）在 `src/ui/markdownRenderer.ts`，在调用 `generateDetailsBlock()` 时传递原始工具数据作为 HTML 注释
- [X] T051 [US1] 修改 `renderBubble()` 方法在 `src/ui/markdownRenderer.ts`，在渲染工具详情时也附加原始气泡数据的 HTML 注释，包含完整的 `toolFormerData`、`toolCallResults`、`capabilities` 等
- [X] T052 [US1] 改进 `renderToolDetails()` 方法在 `src/ui/markdownRenderer.ts`，添加更灵活的工具名称匹配逻辑：
  - 支持大小写不敏感匹配
  - 支持部分匹配（如 "edit" 匹配 "edit_file"）
  - 添加调试日志，记录工具名称提取过程和匹配结果
- [X] T053 [US1] 添加工具数据提取的调试日志在 `src/ui/markdownRenderer.ts`，使用 `Logger.debug()` 记录：
  - 提取到的工具名称
  - 使用的字段路径
  - 工具数据结构的摘要信息
- [X] T054 [US1] 测试修复后的工具数据提取逻辑，验证各种工具类型都能正确提取名称，不再显示 "Unknown Tool"

**Checkpoint**: 工具名称应正确提取，原始 JSON 数据应作为 HTML 注释附加，方便调试和问题定位

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T038 实现空会话处理在 `src/ui/markdownRenderer.ts`，当会话没有消息时返回提示信息
- [X] T039 实现数据格式错误处理在 `src/ui/markdownRenderer.ts`，跳过格式错误的气泡并记录警告
- [ ] T040 优化大量消息的渲染性能在 `src/ui/markdownRenderer.ts`，确保 100 条消息在 3 秒内完成（SC-003），特别关注工具详细渲染的性能
- [X] T041 实现会话数据不存在的错误处理在 `src/commands/openSessionMarkdown.ts`，显示友好的错误信息（FR-011）
- [X] T042 实现数据加载失败的错误处理在 `src/commands/openSessionMarkdown.ts`，显示错误提示不打开编辑器（FR-010）
- [ ] T043 [P] 添加工具渲染的单元测试（如果测试被请求）在 `tests/unit/markdownRenderer.test.ts`
- [ ] T044 [P] 代码清理和重构在 `src/ui/markdownRenderer.ts`，确保代码结构清晰，工具渲染方法组织良好
- [ ] T045 运行 quickstart.md 验证，确保所有功能按预期工作

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ✅ Complete - 基础结构已存在
- **Foundational (Phase 2)**: ✅ Complete - 基础渲染器已实现
- **User Story 1 (Phase 3)**: 
  - 基础功能已完成（T009-T016）
  - 工具类型渲染已完成（T017-T035）
  - **当前阶段**: 工具数据提取修复和调试增强（T046-T054）
- **Polish (Phase 4)**: 依赖于 User Story 1 完成

### User Story Dependencies

- **User Story 1 (P1)**: 
  - 基础功能已完成
  - 工具类型渲染已完成
  - **当前任务**: 修复工具数据提取问题（T046-T054）
  - T046-T047: 修复工具数据提取逻辑（必须先完成）
  - T048-T051: 添加原始 JSON 数据注释（可以并行）
  - T052-T053: 改进工具名称匹配和调试日志（可以并行）
  - T054: 测试验证（必须在所有修复完成后）

### Within User Story 1 - 修复阶段

- **数据提取修复（T046-T047）**: 必须先完成，其他任务依赖于此
- **HTML 注释功能（T048-T051）**: 可以并行开发
- **匹配逻辑改进（T052-T053）**: 可以并行开发
- **测试验证（T054）**: 必须在所有修复完成后

### Parallel Opportunities

- **Phase 3 (User Story 1 - 修复阶段)**: 
  - T048-T051 可以并行开发（HTML 注释相关）
  - T052-T053 可以并行开发（匹配逻辑和调试日志）

---

## Parallel Example: User Story 1 - 工具数据提取修复

```bash
# 可以并行开发的任务：

# Terminal 1: HTML 注释功能
Task: T048 [P] [US1] 实现 JSON 序列化辅助方法
Task: T049 [P] [US1] 修改 generateDetailsBlock 添加 HTML 注释支持
Task: T050 [P] [US1] 修改所有工具渲染方法传递原始数据
Task: T051 [P] [US1] 修改 renderBubble 附加原始气泡数据

# Terminal 2: 匹配逻辑改进
Task: T052 [P] [US1] 改进 renderToolDetails 匹配逻辑
Task: T053 [P] [US1] 添加调试日志

# Terminal 3: 数据提取修复（必须先完成）
Task: T046 [US1] 修复 extractToolData 方法
Task: T047 [US1] 修复 extractToolInfo 方法
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. ✅ Complete Phase 1: Setup
2. ✅ Complete Phase 2: Foundational
3. ✅ Complete Phase 3: User Story 1 - 基础功能和工具类型渲染
4. **CURRENT**: Phase 3: User Story 1 - 工具数据提取修复和调试增强
5. **STOP and VALIDATE**: 测试工具名称提取和 HTML 注释功能

### Incremental Delivery

1. ✅ Complete Setup + Foundational → Foundation ready
2. ✅ Add User Story 1 - 基础功能 → Test independently → Deploy/Demo (Basic MVP!)
3. ✅ Add User Story 1 - 工具类型渲染 → Test independently → Deploy/Demo (Enhanced MVP!)
4. **CURRENT**: Fix User Story 1 - 工具数据提取问题 → Test independently → Deploy/Demo (Fixed MVP!)
5. Add Polish → Test independently → Deploy/Demo
6. Each increment adds value without breaking previous functionality

### Parallel Team Strategy

With multiple developers:

1. ✅ Team completed Setup + Foundational together
2. ✅ Team completed User Story 1 - 基础功能和工具类型渲染
3. **CURRENT**: Once data extraction fixes are defined:
   - Developer A: 修复工具数据提取逻辑（T046-T047）
   - Developer B: HTML 注释功能（T048-T051）
   - Developer C: 匹配逻辑改进和调试日志（T052-T053）
4. Integration and validation (T054)

---

## Summary

- **Total Tasks**: 54
- **Completed Tasks**: 45 (基础功能 + 工具类型渲染 + 工具数据提取修复 + 测试验证)
- **Remaining Tasks**: 9 (Polish)
- **User Stories**: 1 (P1)
- **Tasks by Phase**: 
  - Setup: 4 (✅ Complete)
  - Foundational: 4 (✅ Complete)
  - User Story 1: 38 (✅ Complete - 所有修复任务和测试验证已完成)
  - Polish: 8 (5 ✅ Complete, 3 Remaining)
- **MVP Scope**: User Story 1 - 基础功能（✅ Complete），工具类型渲染（✅ Complete），工具数据提取修复（✅ Complete）
- **Parallel Opportunities**: 已完成所有并行任务

---

## Notes

- 所有任务都基于现有的 001-cursor-assistant 功能
- 复用 `DatabaseAccess` 类，不需要重新实现数据访问
- Markdown 渲染使用数组 join 方式优化性能
- 编辑器使用临时文档（`untitled:` URI），不持久化
- **重点**: 修复工具数据提取问题，确保工具名称正确提取
- **调试支持**: 添加原始 JSON 数据作为 HTML 注释，方便问题定位和改进
- HTML 注释格式：`<!-- TOOL_DATA: {escaped_json} -->`，确保特殊字符正确转义
- 工具名称提取应检查所有可能的字段路径，避免显示 "Unknown Tool"
