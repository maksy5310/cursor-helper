# Quickstart: Cursor工作空间会话支持

**Feature**: 005-workspace-sessions  
**Date**: 2026-01-15

## Overview

本功能扩展了Cursor助手插件，支持自动检测工作空间类型（单根/多根）并正确显示会话列表。对于多根工作空间，会话列表会整合所有子项目的会话，与Cursor AI面板保持一致。

## Key Concepts

### 工作空间类型

- **单根工作空间**：直接打开一个文件夹
- **多根工作空间**：打开`.code-workspace`文件，包含多个子项目文件夹

### 数据存储

- 每个工作空间（单根或多根）都有一个工作空间数据库
- 多根工作空间共享一个数据库，而非每个子项目独立存储
- 会话数据存储在`state.vscdb`数据库的`ItemTable`表中

## Usage

### 基本使用

插件会自动检测工作空间类型，无需手动配置：

1. **打开工作空间**
   - 单根：直接打开文件夹
   - 多根：打开`.code-workspace`文件

2. **查看会话列表**
   - 插件自动检测工作空间类型
   - 从正确的工作空间数据库读取会话
   - 在"Sessions"面板中显示会话列表

3. **工作空间切换**
   - 切换到新工作空间时，插件自动更新会话列表
   - 无需手动刷新

### API使用

#### 检测工作空间类型

```typescript
import { WorkspaceHelper } from './utils/workspaceHelper';

// 快速检测
const isMultiRoot = WorkspaceHelper.isMultiRootWorkspace();

// 获取详细信息
const workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
if (workspaceInfo) {
    console.log(`Type: ${workspaceInfo.type}`);
    console.log(`Folders: ${workspaceInfo.folders.length}`);
    console.log(`Database: ${workspaceInfo.databasePath}`);
}
```

#### 获取会话列表

```typescript
import { DatabaseAccess } from './dataAccess/databaseAccess';
import { WorkspaceHelper } from './utils/workspaceHelper';

// 自动检测工作空间
const workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
const sessions = await databaseAccess.getSessionList(workspaceInfo);

// 或者让系统自动检测
const sessions = await databaseAccess.getSessionList();
```

#### 刷新会话列表

```typescript
import { UnifiedSessionDataProvider } from './ui/unifiedSessionDataProvider';

// 手动刷新
await sessionDataProvider.refresh();

// 或提供工作空间信息
const workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
await sessionDataProvider.refresh(workspaceInfo);
```

## Implementation Details

### 工作空间检测流程

```
1. 检查 vscode.workspace.workspaceFile
   ├─ 存在 → 多根工作空间
   └─ 不存在 → 单根工作空间

2. 获取 vscode.workspace.workspaceFolders
   └─ 包含所有子项目文件夹

3. 匹配工作空间数据库
   └─ 使用工作空间文件路径或第一个文件夹路径
```

### 会话数据聚合

```
1. 确定工作空间类型
   ├─ 单根 → 使用工作空间数据库
   └─ 多根 → 使用工作空间文件对应的数据库

2. 从数据库读取会话
   └─ 查询 ItemTable 表中的 "allComposers" 键

3. 排序和过滤
   └─ 按 lastUpdatedAt 降序排列

4. 返回会话列表
```

## Error Handling

### 常见情况

1. **新工作空间（无会话）**
   - 行为：显示空列表
   - 原因：正常情况，工作空间还没有会话记录

2. **数据库无法访问**
   - 行为：显示空列表，记录警告日志
   - 原因：数据库文件被锁定或权限问题

3. **工作空间路径变化**
   - 行为：自动重新匹配数据库路径
   - 原因：工作空间文件移动或重命名

### 调试

查看日志输出：
1. 打开"Output"面板
2. 选择"Cursor Assistant"通道
3. 查看工作空间检测和数据库匹配日志

## Performance

- **工作空间检测**：<1秒（缓存后更快）
- **会话列表加载**：<3秒（支持最多10个子项目）
- **工作空间切换**：<2秒完成更新

## Testing

### 手动测试

1. **单根工作空间测试**
   ```
   1. 打开单个文件夹
   2. 验证会话列表显示该文件夹的会话
   3. 验证与Cursor AI面板一致
   ```

2. **多根工作空间测试**
   ```
   1. 打开.code-workspace文件（包含多个文件夹）
   2. 验证会话列表显示所有子项目的会话
   3. 验证与Cursor AI面板一致
   4. 验证会话按时间倒序排列
   ```

3. **工作空间切换测试**
   ```
   1. 从单根切换到多根工作空间
   2. 验证会话列表自动更新
   3. 验证显示正确的会话
   ```

### 单元测试

```typescript
// 测试工作空间类型检测
describe('WorkspaceHelper', () => {
    it('should detect single-root workspace', () => {
        // ...
    });
    
    it('should detect multi-root workspace', () => {
        // ...
    });
});
```

## Migration Guide

### 从旧版本升级

无需任何操作，插件自动支持多根工作空间。

### 代码迁移

如果现有代码直接使用`DatabaseAccess.getSessionList()`：

**Before**:
```typescript
const sessions = await databaseAccess.getSessionList();
```

**After** (可选，向后兼容):
```typescript
// 方式1：自动检测（推荐）
const sessions = await databaseAccess.getSessionList();

// 方式2：显式提供工作空间信息（性能更好）
const workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
const sessions = await databaseAccess.getSessionList(workspaceInfo);
```

## Troubleshooting

### 问题：会话列表为空

**可能原因**:
1. 新工作空间，还没有会话记录
2. 数据库路径匹配失败
3. 数据库文件无法访问

**解决方案**:
1. 检查日志输出，查看数据库路径匹配情况
2. 验证工作空间数据库是否存在
3. 检查文件权限

### 问题：会话列表与Cursor AI面板不一致

**可能原因**:
1. 使用了错误的工作空间数据库
2. 工作空间路径匹配失败

**解决方案**:
1. 检查工作空间类型检测是否正确
2. 验证数据库路径匹配逻辑
3. 查看日志中的路径匹配信息

### 问题：性能问题

**可能原因**:
1. 缓存未生效
2. 数据库文件过大
3. 会话数量过多

**解决方案**:
1. 检查缓存是否正常工作
2. 考虑限制会话列表大小
3. 优化数据库查询
