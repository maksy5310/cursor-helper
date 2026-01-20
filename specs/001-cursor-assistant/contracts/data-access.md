# Data Access Layer Interface Contract

**Date**: 2025-12-10  
**Last Updated**: 2025-12-11  
**Component**: Data Access Layer

## Overview

Data Access Layer 通过数据库访问方式获取 Cursor 的使用数据（根据 FR-001，仅使用数据库访问，不实现 API 和文件访问方式）。

## Interface Definition

### IDataAccess

```typescript
interface IDataAccess {
  /**
   * 初始化数据访问层
   */
  initialize(): Promise<void>;

  /**
   * 获取使用统计数据
   * @param startTime 起始时间（可选）
   * @param endTime 结束时间（可选）
   */
  getUsageStatistics(startTime?: Date, endTime?: Date): Promise<UsageStatistics[]>;

  /**
   * 获取 Agent 对话记录（包括普通聊天和 Agent 模式）
   * @param sessionId 会话 ID（可选）
   */
  getAgentRecords(sessionId?: string): Promise<AgentRecord[]>;

  /**
   * 检查数据访问是否可用
   */
  isAvailable(): boolean;

  /**
   * 获取当前使用的访问方式
   */
  getAccessMethod(): AccessMethod;
}

enum AccessMethod {
  DATABASE = "database",
  UNKNOWN = "unknown"
}
```

## Access Strategy

### Database Access

使用数据库访问方式获取 Cursor 的使用数据。

```typescript
interface IDatabaseAccess {
  connect(): Promise<void>;
  query(sql: string, params?: any[]): Promise<any[]>;
  close(): Promise<void>;
}
```

**数据库访问方式**：
- 工作空间数据库：`workspaceStorage/<workspace-id>/state.vscdb` (ItemTable 表)
- 全局数据库：`globalStorage/state.vscdb` (CursorDiskKV 表)

**注意**：根据 FR-001，仅使用数据库访问方式，不实现 API 和文件访问方式。

## Error Handling

当数据库访问失败时：
1. 记录错误日志
2. 返回空数据或错误状态
3. 不影响 Cursor 的正常使用（根据 FR-009）

## Implementation Requirements

1. **数据库访问**: 必须实现数据库访问方式（工作空间数据库和全局数据库）
2. **错误处理**: 数据库访问错误不应影响 Cursor 的正常使用（根据 FR-009）
3. **性能**: 访问延迟应尽可能低，满足性能目标（SC-002: < 5% 影响）
4. **只读模式**: 数据库访问必须使用只读模式，避免锁定问题

## Usage Example

```typescript
const dataAccess = new DataAccess();
await dataAccess.initialize();

// 使用数据库访问方式获取数据
const stats = await dataAccess.getUsageStatistics();

// 检查当前使用的访问方式（应为 DATABASE）
const method = dataAccess.getAccessMethod();
console.log('Using access method:', method); // "database"
```

## Related Requirements

- **FR-001**: 插件 MUST 通过数据库访问方式获取 Cursor 的使用数据（仅使用数据库访问，不实现 API 和文件访问方式）
- **FR-001.1**: 插件 MUST 能够访问工作空间数据库的 ItemTable 表
- **FR-001.2**: 插件 MUST 能够访问全局数据库的 CursorDiskKV 表
- **FR-009**: 插件 MUST 在数据采集失败时记录错误但不影响 Cursor 的正常使用

