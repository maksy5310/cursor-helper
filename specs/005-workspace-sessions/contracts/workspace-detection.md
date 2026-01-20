# Workspace Detection API Contract

**Feature**: 005-workspace-sessions  
**Date**: 2026-01-15  
**Type**: Internal API

## Overview

定义工作空间类型检测和元数据获取的API接口。这些接口扩展了现有的`WorkspaceHelper`类。

## WorkspaceHelper Extensions

### `detectWorkspaceType(): WorkspaceType | null`

检测当前工作空间的类型。

**Returns**:
```typescript
type WorkspaceType = {
    type: 'single-root' | 'multi-root';
    workspaceFile: string | null;  // .code-workspace文件路径，多根时存在
    folders: Array<{
        name: string;
        uri: vscode.Uri;
        path: string;
    }>;
}
```

**Behavior**:
- 如果未打开工作空间，返回`null`
- 使用`vscode.workspace.workspaceFile`检测多根工作空间
- 使用`vscode.workspace.workspaceFolders`获取文件夹列表

**Errors**:
- 不抛出异常，错误情况返回`null`

**Example**:
```typescript
const workspaceType = WorkspaceHelper.detectWorkspaceType();
if (workspaceType) {
    console.log(`Workspace type: ${workspaceType.type}`);
    console.log(`Folders: ${workspaceType.folders.length}`);
}
```

---

### `getWorkspaceInfo(): WorkspaceInfo | null`

获取完整的工作空间信息，包括类型和数据库路径。

**Returns**:
```typescript
type WorkspaceInfo = {
    type: 'single-root' | 'multi-root';
    workspaceFile: string | null;
    folders: Array<{
        name: string;
        uri: vscode.Uri;
        path: string;
    }>;
    workspaceId: string | null;
    databasePath: string | null;
}
```

**Behavior**:
1. 检测工作空间类型
2. 匹配工作空间数据库路径
3. 返回完整的工作空间信息

**Errors**:
- 数据库路径匹配失败时，`databasePath = null`，不抛出异常

**Example**:
```typescript
const workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
if (workspaceInfo && workspaceInfo.databasePath) {
    console.log(`Database: ${workspaceInfo.databasePath}`);
}
```

---

### `isMultiRootWorkspace(): boolean`

快速检查当前是否为多根工作空间。

**Returns**: `boolean`

**Behavior**:
- 检查`vscode.workspace.workspaceFile`是否存在
- 如果存在，返回`true`（多根工作空间）
- 如果不存在，返回`false`（单根工作空间或未打开工作空间）

**Performance**: O(1)，无异步操作

**Example**:
```typescript
if (WorkspaceHelper.isMultiRootWorkspace()) {
    console.log('Multi-root workspace detected');
}
```

---

## DatabaseAccess Extensions

### `getSessionList(workspaceInfo?: WorkspaceInfo): Promise<SessionRecord[]>`

获取会话列表，支持多根工作空间。

**Parameters**:
- `workspaceInfo?: WorkspaceInfo` - 可选的工作空间信息。如果未提供，自动检测当前工作空间

**Returns**:
```typescript
type SessionRecord = {
    composerId: string;
    name: string;
    lastUpdatedAt: number;
    createdAt: number;
    unifiedMode: 'chat' | 'agent';
    workspacePath?: string;
}
```

**Behavior**:
1. 如果未提供`workspaceInfo`，自动检测当前工作空间
2. 根据工作空间类型选择数据库：
   - 单根工作空间：使用工作空间数据库
   - 多根工作空间：使用工作空间文件对应的数据库
3. 从数据库读取会话列表
4. 按`lastUpdatedAt`降序排序
5. 返回会话记录数组

**Errors**:
- 数据库不存在：返回空数组（不抛出异常）
- 数据库无法访问：记录错误，返回空数组
- 查询失败：记录错误，返回空数组

**Example**:
```typescript
const workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
const sessions = await databaseAccess.getSessionList(workspaceInfo);
console.log(`Found ${sessions.length} sessions`);
```

---

### `initialize(workspaceInfo?: WorkspaceInfo): Promise<void>`

初始化数据库连接，支持多根工作空间。

**Parameters**:
- `workspaceInfo?: WorkspaceInfo` - 可选的工作空间信息。如果未提供，自动检测

**Behavior**:
1. 如果未提供`workspaceInfo`，自动检测当前工作空间
2. 根据工作空间类型匹配数据库路径
3. 初始化全局数据库和工作空间数据库连接

**Errors**:
- 全局数据库不存在：抛出错误（这是必需数据库）
- 工作空间数据库不存在：记录警告，继续使用全局数据库

**Example**:
```typescript
const workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
await databaseAccess.initialize(workspaceInfo);
```

---

## UnifiedSessionDataProvider Extensions

### `refresh(workspaceInfo?: WorkspaceInfo): Promise<void>`

刷新会话列表，支持多根工作空间。

**Parameters**:
- `workspaceInfo?: WorkspaceInfo` - 可选的工作空间信息。如果未提供，自动检测

**Behavior**:
1. 检测当前工作空间类型
2. 获取工作空间信息（包括数据库路径）
3. 从数据库读取会话列表
4. 更新内部缓存
5. 触发UI更新事件

**Errors**:
- 所有错误都被内部处理，不会抛出异常
- 错误情况下显示空列表

**Example**:
```typescript
await sessionDataProvider.refresh();
```

---

## Event Handlers

### `vscode.workspace.onDidChangeWorkspaceFolders`

监听工作空间文件夹变化事件。

**Usage**:
```typescript
vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
    // 工作空间切换，清除缓存
    WorkspaceHelper.clearCache();
    
    // 重新检测工作空间
    const workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
    
    // 刷新会话列表
    await sessionDataProvider.refresh(workspaceInfo);
});
```

**When Fired**:
- 打开新工作空间
- 关闭工作空间
- 添加/删除多根工作空间的文件夹

---

## Caching Contract

### WorkspaceInfo Cache

**Key Format**: `workspace-${workspaceFile || firstFolderPath}`

**Invalidation Events**:
- `vscode.workspace.onDidChangeWorkspaceFolders`
- `vscode.workspace.onDidChangeConfiguration`（如果相关）

**TTL**: 无（基于事件失效）

### SessionList Cache

**Key Format**: `sessions-${workspaceInfo.databasePath}`

**Invalidation Events**:
- 工作空间切换
- 手动刷新
- 数据库文件变更（如果实现文件监听）

**TTL**: 无（基于事件失效）

---

## Migration Notes

### Breaking Changes

无。所有新方法都是扩展，现有API保持不变。

### Backward Compatibility

- 现有的`DatabaseAccess.getSessionList()`方法保持兼容
- 如果未提供`workspaceInfo`参数，自动检测当前工作空间（向后兼容）
- 单根工作空间的行为保持不变

### Deprecation

无。
