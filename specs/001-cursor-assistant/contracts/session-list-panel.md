# Contract: Session List Panel

**Date**: 2025-12-11  
**Feature**: Cursor助手插件 - 会话列表显示

## Overview

会话列表 panel 在 Cursor 侧边栏显示当前工作空间的所有会话列表，帮助用户查看和管理 AI 对话会话。

## Interface

### SessionListPanel

```typescript
/**
 * 会话列表 panel 接口
 */
interface ISessionListPanel {
    /**
     * 初始化 panel
     */
    initialize(): Promise<void>;

    /**
     * 刷新会话列表
     */
    refresh(): Promise<void>;

    /**
     * 销毁 panel
     */
    dispose(): void;
}
```

### SessionListDataProvider

```typescript
/**
 * 会话列表数据提供者（TreeDataProvider）
 */
interface ISessionListDataProvider extends vscode.TreeDataProvider<SessionListItem> {
    /**
     * 获取会话列表
     */
    getChildren(element?: SessionListItem): Promise<SessionListItem[]>;

    /**
     * 获取树项（用于显示）
     */
    getTreeItem(element: SessionListItem): vscode.TreeItem;

    /**
     * 刷新数据
     */
    refresh(): void;
}
```

### SessionListItem

```typescript
/**
 * 会话列表项
 */
interface SessionListItem {
    composerId: string;           // 会话 ID
    name: string;                 // 会话名称
    lastUpdatedAt: number;        // 最后更新时间戳（毫秒）
    unifiedMode: 'chat' | 'agent'; // 会话类型
}
```

## Implementation Requirements

### FR-012: Panel 创建

- **FR-012**: 插件 MUST 在 Cursor 侧边栏提供一个 TreeView panel，用于显示当前的会话列表
- **FR-012.1**: 会话列表 panel MUST 显示会话名称列表，无需交互功能（仅用于查看）
- **FR-012.2**: 会话列表 panel MUST 在用户主动刷新时更新会话列表（不实现自动监视和轮询检查机制，避免性能影响）
- **FR-012.3**: 会话列表 panel MUST 仅显示当前工作空间的所有会话，不显示其他工作空间的会话
- **FR-012.4**: 会话列表 panel MUST 按会话的最后更新时间降序排列（最新的会话显示在最前面）

## Data Source

会话列表数据从以下来源获取：

1. **工作空间数据库**: `workspaceStorage/<workspace-id>/state.vscdb`
   - 表: `ItemTable`
   - Key: `composer.composerData`
   - 获取所有 composer 列表

2. **数据过滤**:
   - 仅显示当前工作空间的会话
   - 按 `lastUpdatedAt` 降序排序

## Update Mechanism

### 更新触发方式

**用户主动刷新机制**（不实现自动监视和轮询检查）：

1. **初始化加载**: Panel 初始化时自动加载一次会话列表
2. **手动刷新**: 用户可以通过以下方式主动刷新：
   - 点击刷新按钮（如果提供）
   - 执行刷新命令（如 `cursor-assistant.refreshSessionList`）
   - 重新打开 panel（关闭后重新打开）
   - 通过上下文菜单刷新

### 更新流程

```
用户触发刷新 → 读取数据库 → 更新 TreeView → 刷新显示
```

**注意**: 不实现自动监视和轮询检查机制，以避免性能影响。

## Error Handling

- **数据库不可访问**: 显示错误信息（如 "无法找到工作空间数据库"），记录错误日志
- **数据读取失败**: 保持当前列表显示，记录错误日志
- **刷新失败**: 显示错误提示，记录错误日志

## Performance Requirements

- **SC-007**: 会话列表 panel 能够在 Cursor 启动后 5 秒内完成初始化并显示会话列表
- **SC-008**: 会话列表 panel 在用户主动刷新时，更新延迟不超过 2 秒（从刷新操作到列表更新完成）
- **SC-009**: 会话列表 panel 对 Cursor 性能的影响小于 2%（通过响应时间测量，不包含后台监视和轮询的开销）

## Testing

### Unit Tests

- 测试数据提供者的数据获取逻辑
- 测试排序和过滤逻辑
- 测试手动刷新机制

### Integration Tests

- 测试 panel 的创建和显示
- 测试手动刷新功能
- 测试刷新命令和按钮

## Dependencies

- `vscode` (VS Code Extension API)
- `fs` (Node.js 文件系统模块)
- `path` (Node.js 路径模块)
- `databaseAccess` (数据访问层)

