# Data Collector Interface Contract

**Date**: 2025-12-10  
**Component**: Data Collector Service

## Overview

Data Collector 是插件的核心服务，负责从 Cursor 采集使用数据。

## Interface Definition

### IDataCollector

```typescript
interface IDataCollector {
  /**
   * 启动数据采集服务
   */
  start(): Promise<void>;

  /**
   * 停止数据采集服务
   */
  stop(): Promise<void>;

  /**
   * 检查数据采集是否启用
   */
  isEnabled(): boolean;

  /**
   * 启用或禁用数据采集
   */
  setEnabled(enabled: boolean): void;

  /**
   * 获取当前采集的统计数据
   */
  getStatistics(): UsageStatistics[];

  /**
   * 清空内存缓冲区
   */
  clearBuffer(): void;
}
```

## Events

### onDataCollected

当数据被采集时触发。

```typescript
event onDataCollected: (data: UsageStatistics) => void;
```

### onError

当数据采集发生错误时触发。

```typescript
event onError: (error: Error) => void;
```

## Implementation Requirements

1. **启动/停止**: 必须支持优雅的启动和停止
2. **错误处理**: 错误不应影响 Cursor 的正常使用
3. **性能**: 数据采集对性能的影响应 < 5%
4. **线程安全**: 如果使用多线程，必须保证线程安全

## Usage Example

```typescript
const collector = new DataCollector(config);
collector.onDataCollected((data) => {
  console.log('Data collected:', data);
});
collector.onError((error) => {
  console.error('Collection error:', error);
});
await collector.start();
```

