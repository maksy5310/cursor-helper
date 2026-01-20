# Storage Manager Interface Contract

**Date**: 2025-12-10  
**Component**: Storage Manager Service

## Overview

Storage Manager 负责将采集的数据保存到本地文件系统。

## Interface Definition

### IStorageManager

```typescript
interface IStorageManager {
  /**
   * 初始化存储管理器
   * @param workspacePath 工作空间路径
   */
  initialize(workspacePath: string): Promise<void>;

  /**
   * 保存使用统计数据
   * @param data 统计数据数组
   */
  saveUsageStatistics(data: UsageStatistics[]): Promise<void>;

  /**
   * 保存 Agent 对话记录（包括普通聊天和 Agent 模式）
   * @param record Agent 记录
   */
  saveAgentRecord(record: AgentRecord): Promise<void>;

  /**
   * 获取存储目录路径
   */
  getStoragePath(): string;

  /**
   * 检查存储空间是否充足
   */
  checkStorageSpace(): Promise<boolean>;
}
```

## Storage Structure

```
{workspacePath}/
└── cursor-helper/
    └── yyyy-mm-dd/
        ├── stats-yyyy-mm-dd-HHMMSS.json
        └── agent-yyyy-mm-dd-HHMMSS.json
```

## File Naming Convention

- **统计数据**: `stats-{date}-{time}.json`
- **Agent 记录**（包括普通聊天和 Agent 模式）: `agent-{date}-{time}.json`

其中：
- `{date}`: `yyyy-mm-dd` 格式
- `{time}`: `HHMMSS` 格式（24小时制）

## Implementation Requirements

1. **批量写入**: 支持批量写入以优化性能
2. **错误处理**: 存储失败时记录错误但不中断操作
3. **目录创建**: 自动创建必要的目录结构
4. **文件格式**: 所有文件使用 UTF-8 编码的 JSON 格式
5. **原子写入**: 使用临时文件确保写入的原子性（可选，但推荐）

## Error Handling

- **目录创建失败**: 抛出错误，记录日志
- **文件写入失败**: 记录错误，保留数据在缓冲区，稍后重试
- **磁盘空间不足**: 记录错误，通知用户（如果可能）

## Usage Example

```typescript
const storage = new StorageManager();
await storage.initialize(workspacePath);

// 批量保存统计数据
await storage.saveUsageStatistics([stat1, stat2, stat3]);

// 保存 Agent 记录（包括普通聊天和 Agent 模式）
await storage.saveAgentRecord(agentRecord);
```

