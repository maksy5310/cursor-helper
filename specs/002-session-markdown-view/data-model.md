# Data Model: 会话 Markdown 视图

**Date**: 2025-12-11  
**Feature**: 会话 Markdown 视图

## Overview

本文档定义了会话 Markdown 视图功能中使用的数据模型，包括会话 Markdown 视图、气泡 Markdown 表示和渲染选项。

## Entities

### 1. SessionMarkdownView (会话 Markdown 视图)

**Purpose**: 表示一个会话的完整 Markdown 视图，包含会话元数据和渲染后的 Markdown 内容

**Fields**:

```typescript
interface SessionMarkdownView {
  composerId: string;              // 会话 ID
  name: string;                     // 会话名称
  markdown: string;                 // 渲染后的 Markdown 内容
  messageCount: number;             // 消息总数
  createdAt: number;                // 创建时间戳（毫秒）
  lastUpdatedAt: number;            // 最后更新时间戳（毫秒）
  unifiedMode: 'chat' | 'agent';    // 会话类型
}
```

**Validation Rules**:
- `composerId` 必须为非空字符串
- `name` 必须为非空字符串
- `markdown` 必须为有效的 Markdown 字符串
- `messageCount` 必须为非负整数
- `createdAt` 和 `lastUpdatedAt` 必须为有效的时间戳（毫秒）

**Storage**: 
- 临时数据，不持久化
- 通过 VS Code 临时文档显示

**Example**:

```typescript
{
  composerId: "abc123-def456-ghi789",
  name: "Session about TypeScript",
  markdown: "## User\n\nHow do I use TypeScript?\n\n## Assistant\n\nTypeScript is...",
  messageCount: 10,
  createdAt: 1702224000000,
  lastUpdatedAt: 1702227600000,
  unifiedMode: "chat"
}
```

---

### 2. BubbleMarkdown (气泡 Markdown 表示)

**Purpose**: 表示单个气泡（消息）的 Markdown 表示

**Fields**:

```typescript
interface BubbleMarkdown {
  bubbleId: string;                 // 气泡 ID
  type: 'user' | 'assistant';       // 消息类型
  text: string;                     // 消息文本（Markdown 格式）
  timestamp: number;               // 时间戳（毫秒）
  hasToolUse: boolean;             // 是否包含工具使用
  toolName?: string;               // 工具名称（如果有）
}
```

**Validation Rules**:
- `bubbleId` 必须为非空字符串
- `type` 必须为 `'user'` 或 `'assistant'`
- `text` 必须为有效的 Markdown 字符串（可能为空）
- `timestamp` 必须为有效的时间戳（毫秒）
- 如果 `hasToolUse` 为 `true`，`toolName` 应该存在

**Storage**: 
- 临时数据，用于构建 `SessionMarkdownView`
- 不单独存储

**Example**:

```typescript
{
  bubbleId: "bubble-123",
  type: "user",
  text: "How do I use TypeScript?",
  timestamp: 1702224000000,
  hasToolUse: false
}

{
  bubbleId: "bubble-124",
  type: "assistant",
  text: "",
  timestamp: 1702224001000,
  hasToolUse: true,
  toolName: "Codebase Search"
}
```

---

### 3. MarkdownRendererOptions (Markdown 渲染选项)

**Purpose**: 配置 Markdown 渲染器的行为

**Fields**:

```typescript
interface MarkdownRendererOptions {
  includeTimestamps: boolean;       // 是否包含时间戳
  includeCodeBlocks: boolean;       // 是否包含代码块
  toolUsePlaceholder: string;       // 工具使用占位符格式（默认: "[Tool Use: {name}]"）
  userMessageHeader: string;        // 用户消息标题（默认: "## User"）
  assistantMessageHeader: string;   // Assistant 消息标题（默认: "## Assistant"）
}
```

**Validation Rules**:
- 所有字段都有默认值
- `toolUsePlaceholder` 必须包含 `{name}` 占位符

**Default Values**:

```typescript
{
  includeTimestamps: true,
  includeCodeBlocks: true,
  toolUsePlaceholder: "[Tool Use: {name}]",
  userMessageHeader: "## User",
  assistantMessageHeader: "## Assistant"
}
```

**Storage**: 
- 配置数据，不持久化
- 可以在渲染时传入自定义选项

---

## Relationships

### SessionMarkdownView ↔ BubbleMarkdown

- 一个 `SessionMarkdownView` 包含多个 `BubbleMarkdown`
- `BubbleMarkdown` 按时间戳排序后组合成 `SessionMarkdownView.markdown`

### SessionMarkdownView ↔ AgentRecord (from 001-cursor-assistant)

- `SessionMarkdownView` 从 `AgentRecord` 数据生成
- `AgentRecord` 包含原始的会话数据（composer 和 bubble 数据）
- `SessionMarkdownView` 是 `AgentRecord` 的 Markdown 表示

---

## Data Flow

```
AgentRecord (from DatabaseAccess)
  ↓
BubbleMarkdown[] (extract and convert)
  ↓
SessionMarkdownView (combine and render)
  ↓
VS Code Temporary Document (display)
```

---

## Data Volume Assumptions

- 单个会话：平均 10-50 条消息
- 超大会话：最多 1000+ 条消息
- Markdown 内容：平均每条消息 500 字符，100 条消息约 50KB
- 渲染时间：100 条消息在 3 秒内完成（SC-003）

---

## Notes

- 所有数据模型都是临时数据，不持久化到文件系统
- Markdown 内容通过 VS Code 临时文档显示，用户关闭后自动清理
- 数据模型设计考虑了性能和可扩展性
- 支持自定义渲染选项，但当前使用默认值

