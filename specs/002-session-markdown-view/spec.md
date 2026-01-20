# Feature Specification: 会话 Markdown 视图

**Feature Branch**: `002-session-markdown-view`  
**Created**: 2025-12-11  
**Status**: Draft  
**Input**: User description: "点击左侧面板中的会话条目，打开一个新的编辑器，并以markdown的方式生成整个会话的对话内容。"

## Clarifications

### Session 2025-12-11

- Q: 如何加载会话的完整对话内容？ → A: 根据 `fullConversationHeadersOnly` 中的 `bubbleId` 列表，从全局存储（`CursorDiskKV` 表）加载每个气泡的详细内容，key 格式为 `bubbleId:<composerId>:<bubbleId>`
- Q: Markdown 渲染的具体要求？ → A: 必须包含简化的渲染逻辑，将用户消息和 Agent 消息（包括其 `text` 属性）连接起来，生成完整的 Markdown 文档
- Q: Agent Tools 的处理方式？ → A: 在渲染 Agent 消息时，如果消息的 `text` 内容为空，但存在 `capabilities` 或 `toolCallResults`/`toolFormerData`，在 Markdown 中添加简化的工具使用提示（例如：`[Tool Use: Codebase Search]`）作为占位符
- Q: 工具使用提示应该显示哪些信息？ → A: 工具使用提示应该显示工具名称（`toolFormerData.name` 或 `toolCallResults[].name`）和状态（`toolFormerData.status`），格式为 `[Tool Use: {name} - {status}]`。其它参数（如 `params`, `result`, `modelCallId` 等）暂时不显示，仅观察。
- Q: 数据库表和键的具体格式？ → A: 工作空间数据库（`ItemTable` 表，key 为 `composer.composerData`）用于获取 composer 列表；全局数据库（`CursorDiskKV` 表，key 格式为 `composerData:<sessionId>` 和 `bubbleId:<sessionId>:<bubbleId>`）用于获取详细数据
- Q: 气泡类型的判断规则和处理方式？ → A: 在数据读取阶段（`DatabaseAccess.getAgentRecords()`）显式检查 `bubble.type` 字段，`type === 1` 为用户消息，`type === 2` 为 assistant 消息，并保留原始类型值用于后续处理。确保在读取气泡数据时正确判断类型，避免类型错误。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查看会话 Markdown 视图 (Priority: P1)

用户在左侧面板的会话列表中点击某个会话条目，系统自动打开一个新的编辑器窗口，显示该会话的完整对话内容，以 Markdown 格式呈现，包括所有用户消息和 Agent 回复。

**Why this priority**: 这是功能的核心价值，允许用户以可读的格式查看和导出完整的对话历史。这是独立可用的功能，即使没有其他功能也能提供价值。

**Independent Test**: 可以通过点击会话列表中的任意会话条目，验证是否成功打开编辑器并显示 Markdown 格式的对话内容。即使没有其他功能，这个功能本身也能独立工作并提供价值。

**Acceptance Scenarios**:

1. **Given** 用户已打开 Cursor 并看到左侧面板的会话列表, **When** 用户点击某个会话条目, **Then** 系统打开一个新的编辑器窗口，显示该会话的 Markdown 格式对话内容
2. **Given** 用户点击了会话条目, **When** 系统加载会话数据, **Then** 系统从全局数据库加载所有气泡的详细内容，包括用户消息和 Agent 回复
3. **Given** 会话包含多条消息, **When** 系统渲染 Markdown, **Then** 所有消息按时间顺序排列，用户消息和 Agent 消息清晰区分
4. **Given** Agent 消息包含工具调用但无文本内容, **When** 系统渲染 Markdown, **Then** 在相应位置显示工具使用提示（如 `[Tool Use: Codebase Search]`）
5. **Given** 用户点击了不存在的会话条目, **When** 系统尝试加载数据, **Then** 系统显示错误提示，不打开编辑器

---

### Edge Cases

- 会话数据不存在或已删除时如何处理？
- 气泡数据不完整或损坏时如何处理？
- 会话包含大量消息（如 1000+ 条）时，渲染性能如何保证？
- 用户快速连续点击多个会话条目时，系统如何处理？
- 编辑器窗口已打开相同会话时，是创建新窗口还是聚焦现有窗口？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 在用户点击会话列表中的会话条目时，打开一个新的编辑器窗口
- **FR-002**: 系统 MUST 从工作空间数据库获取 composer 列表，确定被点击的会话 ID
- **FR-003**: 系统 MUST 从全局数据库加载会话的完整数据（`composerData:<sessionId>`）
- **FR-004**: 系统 MUST 根据 `fullConversationHeadersOnly` 中的 `bubbleId` 列表，从全局数据库加载每个气泡的详细内容（`bubbleId:<sessionId>:<bubbleId>`）
- **FR-005**: 系统 MUST 将所有加载的消息按时间顺序排列
- **FR-006**: 系统 MUST 将用户消息和 Agent 消息渲染为 Markdown 格式，清晰区分消息类型
- **FR-007**: 系统 MUST 在 Agent 消息的 `text` 属性存在时，将其内容包含在 Markdown 中
- **FR-008**: 系统 MUST 在 Agent 消息的 `text` 为空但存在 `capabilities` 或 `toolCallResults`/`toolFormerData` 时，在 Markdown 中添加简化的工具使用提示
- **FR-008.1**: 工具使用提示格式为 `[Tool Use: {name} - {status}]`，其中 `name` 从 `toolFormerData.name` 或 `toolCallResults[].name` 提取，`status` 从 `toolFormerData.status` 提取
- **FR-008.2**: 如果存在多个工具调用，MUST 为每个工具生成一个提示
- **FR-008.3**: 其它工具参数（如 `params`, `result`, `modelCallId` 等）暂时不显示，仅保留在数据中供后续观察
- **FR-009**: 系统 MUST 在编辑器窗口标题中显示会话名称或 ID
- **FR-010**: 系统 MUST 在数据加载失败时显示错误提示，不打开编辑器
- **FR-011**: 系统 MUST 处理会话数据不存在的情况，显示适当的错误信息

### Key Entities *(include if feature involves data)*

- **SessionMarkdownView**: 表示一个会话的 Markdown 视图，包含会话元数据和渲染后的 Markdown 内容
- **BubbleData**: 表示一个气泡（消息）的详细数据，包含消息内容、类型、时间戳等信息
- **ComposerData**: 表示一个 composer（会话）的完整数据，包含会话元数据和气泡列表引用

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户点击会话条目后，编辑器窗口在 2 秒内打开并显示内容
- **SC-002**: Markdown 渲染包含会话中所有可用消息，无遗漏
- **SC-003**: 对于包含 100 条消息的会话，Markdown 生成时间不超过 3 秒
- **SC-004**: 用户能够成功查看和阅读 Markdown 格式的对话内容，消息顺序正确
- **SC-005**: 工具使用提示正确显示在相应位置，不影响整体可读性

## Assumptions

- 会话列表 panel 已存在并正常工作（依赖功能 001-cursor-assistant）
- 数据库访问层已实现并可用（依赖功能 001-cursor-assistant）
- 用户有权限访问工作空间数据库和全局数据库
- 会话数据格式稳定，不会频繁变化
- Markdown 渲染不需要支持复杂的富文本格式（如代码高亮、图片等），仅支持基本的文本和代码块

## Dependencies

- **001-cursor-assistant**: 会话列表 panel 和数据访问层
- **VS Code Extension API**: 用于创建和显示编辑器窗口
- **SQLite 数据库访问**: 用于读取会话和气泡数据

## Technical Constraints

- 编辑器必须通过 VS Code 扩展 API 创建和显示
- 必须使用现有的数据库访问层读取数据
- Markdown 内容以只读方式显示，不支持编辑
- 不支持实时更新：编辑器打开后不会自动刷新，需要用户手动重新打开

## Out of Scope

- 不支持编辑 Markdown 内容并保存回数据库
- 不支持导出 Markdown 到文件
- 不支持 Markdown 内容的实时更新
- 不支持复杂的 Markdown 渲染（如代码高亮、图片、表格等）
- 不支持批量导出多个会话

