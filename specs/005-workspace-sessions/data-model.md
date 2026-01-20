# Data Model: Cursor工作空间会话支持

**Feature**: 005-workspace-sessions  
**Date**: 2026-01-15

## Overview

此功能扩展了工作空间检测和会话数据访问能力，支持单根和多根工作空间。数据模型主要涉及工作空间元数据、会话记录和聚合后的会话列表。

## Entities

### 1. WorkspaceInfo

**Purpose**: 表示当前工作空间的基本信息和类型

**Attributes**:
- `type: 'single-root' | 'multi-root'` - 工作空间类型
- `workspaceFile: string | null` - 工作空间文件路径（.code-workspace文件），多根工作空间时存在
- `folders: WorkspaceFolder[]` - 工作空间文件夹列表
- `workspaceId: string | null` - 工作空间ID（用于匹配数据库）
- `databasePath: string | null` - 工作空间数据库路径

**Relationships**:
- 包含多个`WorkspaceFolder`（多根工作空间时）
- 关联一个`WorkspaceDatabase`（如果存在）

**Validation Rules**:
- `type === 'multi-root'`时，`workspaceFile`必须不为null
- `type === 'single-root'`时，`folders.length === 1`
- `type === 'multi-root'`时，`folders.length > 1`

**State Transitions**:
- 初始化：检测工作空间类型 → 创建`WorkspaceInfo`
- 工作空间切换：检测新工作空间 → 更新`WorkspaceInfo`
- 数据库匹配：查找数据库路径 → 更新`databasePath`

---

### 2. WorkspaceFolder

**Purpose**: 表示工作空间中的一个文件夹（子项目）

**Attributes**:
- `name: string` - 文件夹名称
- `uri: vscode.Uri` - 文件夹URI
- `path: string` - 文件夹文件系统路径

**Relationships**:
- 属于一个`WorkspaceInfo`

**Validation Rules**:
- `name`不能为空
- `path`必须是有效的文件系统路径

---

### 3. SessionRecord

**Purpose**: 表示从Cursor数据库读取的单个会话记录

**Attributes**:
- `composerId: string` - 会话唯一标识符
- `name: string` - 会话名称
- `lastUpdatedAt: number` - 最后更新时间戳（毫秒）
- `createdAt: number` - 创建时间戳（毫秒）
- `unifiedMode: 'chat' | 'agent'` - 会话类型
- `workspacePath?: string` - 关联的工作空间路径（可选）

**Relationships**:
- 属于一个`WorkspaceInfo`（通过`workspacePath`关联）

**Validation Rules**:
- `composerId`必须唯一且非空
- `lastUpdatedAt`必须大于0
- `unifiedMode`必须是'chat'或'agent'

**State Transitions**:
- 从数据库读取：查询数据库 → 创建`SessionRecord`
- 排序：按`lastUpdatedAt`降序排列

---

### 4. AggregatedSessionList

**Purpose**: 聚合后的会话列表（用于UI显示）

**Attributes**:
- `sessions: SessionRecord[]` - 会话记录数组，按时间倒序排列
- `workspaceInfo: WorkspaceInfo` - 关联的工作空间信息
- `totalCount: number` - 会话总数
- `lastUpdated: number` - 列表最后更新时间戳

**Relationships**:
- 包含多个`SessionRecord`
- 关联一个`WorkspaceInfo`

**Validation Rules**:
- `sessions`数组必须按`lastUpdatedAt`降序排序
- `totalCount === sessions.length`

**State Transitions**:
- 初始化：从数据库读取 → 创建`AggregatedSessionList`
- 刷新：重新读取数据库 → 更新`sessions`和`lastUpdated`
- 工作空间切换：检测新工作空间 → 重新创建`AggregatedSessionList`

---

## Data Flow

### 工作空间检测流程

```
1. Extension启动/工作空间切换
   ↓
2. WorkspaceHelper.detectWorkspaceType()
   ↓
3. 检查 vscode.workspace.workspaceFile
   ↓
4. 创建 WorkspaceInfo
   ↓
5. 获取 workspaceFolders
   ↓
6. 匹配工作空间数据库路径
   ↓
7. 返回 WorkspaceInfo
```

### 会话列表加载流程

```
1. UnifiedSessionDataProvider.refresh()
   ↓
2. WorkspaceHelper.getWorkspaceInfo()
   ↓
3. DatabaseAccess.getSessionList(workspaceInfo)
   ↓
4. 从工作空间数据库读取会话
   ↓
5. 转换为 SessionRecord[]
   ↓
6. 按 lastUpdatedAt 排序
   ↓
7. 创建 AggregatedSessionList
   ↓
8. 更新UI显示
```

## Database Schema (Cursor Internal)

### ItemTable (Cursor内部表)

**Purpose**: Cursor使用此表存储工作空间状态，包括会话数据

**Key Fields** (相关):
- `key: string` - 存储键，如`"allComposers"`
- `value: string` - JSON格式的存储值

**Session Data Structure** (在`allComposers`键中):
```json
{
  "allComposers": [
    {
      "composerId": "uuid",
      "name": "Session Name",
      "createdAt": "2026-01-15T10:00:00Z",
      "lastUpdatedAt": "2026-01-15T11:00:00Z",
      "unifiedMode": "chat" | "agent",
      "subtitle": "Optional subtitle"
    }
  ]
}
```

## Caching Strategy

### WorkspaceInfo Cache

**Purpose**: 避免重复检测工作空间类型和数据库路径

**Cache Key**: `workspace-${workspaceFile || firstFolderPath}`

**Invalidation**:
- 工作空间切换时（`vscode.workspace.onDidChangeWorkspaceFolders`）
- 手动刷新时

**TTL**: 无（基于事件失效）

### SessionList Cache

**Purpose**: 避免频繁查询数据库

**Cache Key**: `sessions-${workspaceInfo.databasePath}`

**Invalidation**:
- 工作空间切换时
- 手动刷新时
- 数据库文件变更时（如果实现文件监听）

**TTL**: 无（基于事件失效）

## Error Handling

### WorkspaceInfo Errors

- **工作空间未打开**: 返回`null`，UI显示空状态
- **数据库路径匹配失败**: 记录警告，`databasePath = null`，会话列表为空
- **工作空间类型检测失败**: 默认假设为单根工作空间

### SessionList Errors

- **数据库不存在**: 返回空数组（新工作空间，正常情况）
- **数据库无法访问**: 记录错误，返回空数组，不抛出异常
- **查询失败**: 记录错误，返回空数组，不抛出异常
- **数据解析失败**: 记录错误，跳过无效记录，返回有效记录

## Performance Considerations

- **工作空间检测**: 缓存结果，避免重复检测（<1秒，SC-001）
- **数据库查询**: 异步执行，不阻塞UI
- **会话排序**: 内存排序，对于数千条记录性能可接受
- **列表更新**: 增量更新（如果可能），减少不必要的UI刷新
