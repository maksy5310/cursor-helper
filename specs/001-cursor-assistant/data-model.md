# Data Model: Cursor助手插件

**Date**: 2025-12-10  
**Feature**: Cursor助手插件

## Overview

本文档定义了 Cursor助手插件中使用的数据模型，包括使用统计数据和 Agent 对话记录（包含所有 Cursor AI 对话，包括普通聊天和 Agent 模式）。

## Entities

### 1. UsageStatistics (使用统计数据)

**Purpose**: 存储代码建议、采纳、提交等使用指标的聚合数据

**Fields**:

```typescript
interface UsageStatistics {
  timestamp: string;              // ISO 8601 格式时间戳
  eventType: EventType;            // 事件类型
  mode: CompletionMode;            // 代码辅助模式
  suggestionCount?: number;        // 建议次数（可选）
  acceptCount?: number;            // 采纳次数（可选）
  codeLines?: number;              // 代码行数（可选）
  workspacePath?: string;          // 工作空间路径（可选）
  filePath?: string;               // 文件路径（可选）
}

enum EventType {
  TAB_COMPLETION = "tab_completion",           // Tab键自动补全
  INLINE_EDIT = "inline_edit",                  // cmd+K 行内自动补全
  AGENT_SUGGESTION = "agent_suggestion",        // Agent 建议
  CODE_COMMIT = "code_commit"                   // 代码提交
}

enum CompletionMode {
  TAB = "tab",                    // Tab键自动补全模式
  CMD_K = "cmd_k",                // cmd+K 行内自动补全模式
  AGENT = "agent"                 // Agent 对话模式
}
```

**Validation Rules**:
- `timestamp` 必须为有效的 ISO 8601 格式
- `eventType` 必须为 `EventType` 枚举值之一
- `mode` 必须为 `CompletionMode` 枚举值之一
- 根据 `eventType`，某些字段为必需：
  - `TAB_COMPLETION` 和 `INLINE_EDIT`: `suggestionCount`, `acceptCount`, `codeLines` 为必需
  - `AGENT_SUGGESTION`: `suggestionCount`, `acceptCount` 为必需
  - `CODE_COMMIT`: `codeLines` 为必需

**Storage**: 
- 文件格式: `stats-yyyy-mm-dd-HHMMSS.json`
- 文件内容: JSON 数组，包含多个 `UsageStatistics` 对象

**Example**:

```json
[
  {
    "timestamp": "2025-12-10T14:30:22.123Z",
    "eventType": "tab_completion",
    "mode": "tab",
    "suggestionCount": 5,
    "acceptCount": 3,
    "codeLines": 15,
    "workspacePath": "/path/to/workspace",
    "filePath": "/path/to/workspace/src/main.ts"
  },
  {
    "timestamp": "2025-12-10T14:35:10.456Z",
    "eventType": "code_commit",
    "mode": "tab",
    "codeLines": 42,
    "workspacePath": "/path/to/workspace"
  }
]
```

---

### 2. AgentRecord (Agent 对话记录)

**Purpose**: 存储所有 Cursor AI 对话的完整记录（包括普通聊天和 Agent 模式），包括所有消息、上下文和代码片段

**Fields**:

```typescript
interface AgentRecord {
  timestamp: string;              // ISO 8601 格式时间戳
  sessionId: string;              // 会话 ID
  conversationType: ConversationType;  // 对话类型（普通聊天或 Agent 模式）
  messages: AgentMessage[];        // 消息列表
  codeSnippets?: CodeSnippet[];   // 代码片段列表（可选）
  filePaths?: string[];            // 涉及的文件路径列表（可选）
  context: AgentContext;           // 对话上下文
  statistics?: AgentStatistics;    // 统计信息（可选，主要用于 Agent 模式）
}

enum ConversationType {
  CHAT = "chat",                  // 普通聊天
  AGENT = "agent"                 // Agent 模式
}

interface AgentMessage {
  role: "user" | "assistant" | "agent" | "system";  // 消息角色（assistant 用于普通聊天，agent 用于 Agent 模式）
  content: string;                     // 消息内容
  timestamp: string;                   // 消息时间戳
  metadata?: Record<string, any>;     // 元数据（可选）
}

interface CodeSnippet {
  code: string;                    // 代码内容
  language?: string;               // 编程语言
  filePath?: string;               // 文件路径
  startLine?: number;              // 起始行号
  endLine?: number;                 // 结束行号
}

interface AgentContext {
  workspacePath: string;          // 工作空间路径
  activeFiles?: string[];          // 活动文件列表
  projectStructure?: string[];     // 项目结构（可选）
  environment?: Record<string, string>;  // 环境变量（可选）
}

interface AgentStatistics {
  suggestionCount: number;         // 建议次数
  acceptCount: number;             // 采纳次数
  totalMessages: number;            // 总消息数
  totalCodeLines: number;          // 总代码行数
}
```

**Validation Rules**:
- `timestamp` 必须为有效的 ISO 8601 格式
- `sessionId` 必须为非空字符串
- `conversationType` 必须为 `ConversationType` 枚举值之一
- `messages` 必须为非空数组
- 每个 `AgentMessage` 的 `role` 必须为 "user"、"assistant"、"agent" 或 "system"
  - 普通聊天（CHAT）使用 "user" 和 "assistant"
  - Agent 模式（AGENT）使用 "user" 和 "agent"
- `context.workspacePath` 必须为非空字符串
- 如果存在 `statistics`，则 `suggestionCount` 和 `acceptCount` 必须为非负整数（主要用于 Agent 模式）

**Storage**: 
- 文件格式: `agent-yyyy-mm-dd-HHMMSS.json`
- 文件内容: JSON 对象，包含单个 `AgentRecord` 对象

**Example**:

```json
{
  "timestamp": "2025-12-10T16:45:20.123Z",
  "sessionId": "agent-2025-12-10-164520",
  "conversationType": "agent",
  "messages": [
    {
      "role": "user",
      "content": "帮我实现一个用户认证系统",
      "timestamp": "2025-12-10T16:45:20.123Z"
    },
    {
      "role": "agent",
      "content": "我将为您创建一个用户认证系统，包括登录、注册和密码重置功能。",
      "timestamp": "2025-12-10T16:45:22.456Z"
    }
  ],
  "codeSnippets": [
    {
      "code": "function authenticate(username, password) {\n  // ...\n}",
      "language": "typescript",
      "filePath": "/path/to/workspace/src/auth.ts",
      "startLine": 10,
      "endLine": 25
    }
  ],
  "filePaths": [
    "/path/to/workspace/src/auth.ts",
    "/path/to/workspace/src/user.ts"
  ],
  "context": {
    "workspacePath": "/path/to/workspace",
    "activeFiles": ["/path/to/workspace/src/auth.ts"],
    "projectStructure": ["src/", "tests/", "package.json"]
  },
  "statistics": {
    "suggestionCount": 5,
    "acceptCount": 3,
    "totalMessages": 12,
    "totalCodeLines": 150
  }
}
```

---

### 3. SessionListItem (会话列表项)

**Purpose**: 用于在侧边栏 TreeView panel 中显示会话列表项

**Fields**:

```typescript
interface SessionListItem {
  composerId: string;           // 会话 ID（composer ID）
  name: string;                 // 会话名称
  lastUpdatedAt: number;        // 最后更新时间戳（毫秒）
  unifiedMode: 'chat' | 'agent'; // 会话类型
}
```

**Validation Rules**:
- `composerId` 必须为非空字符串
- `name` 必须为非空字符串（如果为空，使用默认名称）
- `lastUpdatedAt` 必须为有效的数字时间戳
- `unifiedMode` 必须为 'chat' 或 'agent'

**Storage**: 
- 不持久化存储，仅用于 UI 显示
- 数据从工作空间数据库实时读取

**Example**:

```json
{
  "composerId": "7f1e9437-0532-49b9-8555-2810b2b6e1d8",
  "name": "获取 Cursor 用户 AI 行为",
  "lastUpdatedAt": 1765443037263,
  "unifiedMode": "chat"
}
```

---

## Relationships

### Entity Relationships

1. **UsageStatistics ↔ AgentRecord**
   - 一个 `AgentRecord` 可能对应多个 `UsageStatistics` 事件
   - 通过 `sessionId` 或 `timestamp` 关联
   - Agent 模式的对话记录通常包含统计信息（suggestionCount, acceptCount）

2. **SessionListItem ↔ AgentRecord**
   - `SessionListItem` 对应一个 `AgentRecord`（通过 `composerId` 关联）
   - `SessionListItem` 是 `AgentRecord` 的简化视图，仅用于 UI 显示
   - `SessionListItem.name` 对应 `AgentRecord.sessionId` 或从 composer 数据中获取

### Data Flow

```
用户操作 → 事件监听 → 数据采集 → 内存缓冲区 → 批量写入 → 本地文件
```

---

## State Transitions

### Data Collection State

```
IDLE → COLLECTING → BUFFERING → WRITING → IDLE
  ↓         ↓           ↓          ↓
ERROR   ERROR      ERROR      ERROR
```

- **IDLE**: 插件已初始化，等待事件
- **COLLECTING**: 正在采集数据事件
- **BUFFERING**: 数据已采集，在内存缓冲区中
- **WRITING**: 正在写入文件
- **ERROR**: 发生错误，记录错误但不中断操作

---

## Data Volume Assumptions

- **UsageStatistics**: 每个事件约 200-500 字节，每日可能产生数百到数千个事件
- **AgentRecord**: 每个会话约 1-100 KB（普通聊天约 1-10 KB，Agent 模式约 10-100 KB），每日可能产生数个到数十个会话

**Storage Estimates**:
- 每日数据量：约 1-10 MB（取决于使用频率）
- 每月数据量：约 30-300 MB
- 建议：定期清理或归档旧数据（超出范围，但可考虑）

---

## Validation & Error Handling

### Input Validation

- 所有时间戳必须通过 ISO 8601 格式验证
- 所有必需字段必须在写入前验证
- 枚举值必须通过白名单验证

### Error Handling

- 数据验证失败：记录错误，跳过该条记录，继续处理
- 文件写入失败：记录错误，保留数据在缓冲区，稍后重试
- 磁盘空间不足：记录错误，通知用户（如果可能），暂停写入

---

## Future Considerations

1. **数据压缩**: 如果数据量增长，可以考虑压缩存储
2. **数据索引**: 如果需要快速查询，可以考虑添加索引文件
3. **数据迁移**: 如果数据结构变更，需要版本管理和迁移策略
4. **数据清理**: 可以添加自动清理旧数据的功能（超出当前范围）

