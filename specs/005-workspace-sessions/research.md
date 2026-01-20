# Research: Cursor工作空间会话支持

**Date**: 2026-01-15  
**Feature**: Cursor工作空间会话支持 - 多根工作空间检测和会话聚合

## Research Questions & Findings

### 1. VS Code多根工作空间的数据存储机制

**Question**: VS Code/Cursor如何为多根工作空间存储数据？每个子项目是否有独立的工作空间数据库，还是共享一个数据库？

**Findings**:
- VS Code使用`workspaceStorage`目录存储工作空间特定数据
- 每个工作空间（无论是单根还是多根）都有一个唯一的工作空间ID
- 工作空间ID通过工作空间文件路径的哈希值生成
- 多根工作空间（`.code-workspace`文件）被视为一个整体工作空间，共享一个工作空间数据库
- 每个子项目文件夹的路径信息存储在`workspace.json`文件中

**Decision**: 
- 多根工作空间共享一个工作空间数据库（基于工作空间文件路径）
- 需要从`vscode.workspace.workspaceFolders`获取所有子项目信息
- 使用`CursorDataLocator.getWorkspaceDatabasePath()`匹配工作空间数据库
- 对于多根工作空间，需要检查工作空间文件路径（`.code-workspace`文件路径）而非子项目路径

**Rationale**: 
- VS Code的设计是多根工作空间作为一个整体，共享配置和存储
- 会话数据存储在共享的工作空间数据库中，而非每个子项目独立存储
- 这简化了数据聚合逻辑，但需要正确识别工作空间类型

**Alternatives Considered**:
- 每个子项目独立数据库：不符合VS Code的实际实现
- 仅使用全局数据库：会丢失工作空间特定的会话数据

---

### 2. 工作空间类型检测方法

**Question**: 如何可靠地检测当前打开的是单根工作空间还是多根工作空间？

**Findings**:
- VS Code API提供`vscode.workspace.workspaceFolders`数组
- 单根工作空间：`workspaceFolders.length === 1`，且`workspaceFolders[0].uri`指向文件夹路径
- 多根工作空间：`workspaceFolders.length > 1`，或存在`.code-workspace`文件
- `vscode.workspace.workspaceFile`属性：多根工作空间时返回`.code-workspace`文件URI，单根时返回`undefined`

**Decision**: 
- 使用`vscode.workspace.workspaceFile`作为主要检测方法：
  - 如果`workspaceFile !== undefined` → 多根工作空间
  - 如果`workspaceFile === undefined && workspaceFolders.length === 1` → 单根工作空间
- 使用`vscode.workspace.workspaceFolders.length`作为辅助验证
- 在`WorkspaceHelper`中添加`isMultiRootWorkspace()`和`getWorkspaceFolders()`方法

**Rationale**: 
- `workspaceFile`属性是最可靠的检测方法，直接反映工作空间类型
- 结合`workspaceFolders`数组可以获取所有子项目信息
- 这种方法与VS Code的内部实现一致

**Alternatives Considered**:
- 仅检查`workspaceFolders.length`：可能误判（某些情况下单根也可能有多个文件夹）
- 检查文件系统是否存在`.code-workspace`文件：需要额外文件系统操作，不够可靠

---

### 3. 多根工作空间会话数据聚合策略

**Question**: 如何从多根工作空间的工作空间数据库中聚合会话列表，确保与Cursor AI面板一致？

**Findings**:
- Cursor的会话数据存储在`state.vscdb`数据库的`ItemTable`表中
- 会话数据通过`composerId`标识，存储在`allComposers`键下
- 当前实现（`DatabaseAccess.getSessionList()`）仅从单个工作空间数据库读取
- Cursor AI面板可能从全局数据库和工作空间数据库聚合会话

**Decision**: 
- 对于单根工作空间：保持现有逻辑，从单个工作空间数据库读取
- 对于多根工作空间：
  1. 获取工作空间数据库路径（基于`.code-workspace`文件路径）
  2. 从该工作空间数据库读取所有会话
  3. 按`lastUpdatedAt`排序（倒序）
  4. 返回聚合后的会话列表
- 不需要从每个子项目单独读取，因为多根工作空间共享一个数据库

**Rationale**: 
- 多根工作空间的会话数据已经存储在共享的工作空间数据库中
- Cursor AI面板也是从同一个数据库读取，因此聚合逻辑应该一致
- 简化实现，避免复杂的跨数据库查询

**Alternatives Considered**:
- 从每个子项目的工作空间数据库读取：不符合VS Code的实际存储机制
- 同时读取全局数据库和工作空间数据库：可能引入重复会话，且全局数据库可能不包含工作空间特定会话

---

### 4. 工作空间数据库路径匹配策略

**Question**: 如何准确匹配多根工作空间的工作空间数据库？特别是当工作空间文件路径或子项目路径发生变化时？

**Findings**:
- `CursorDataLocator.getWorkspaceDatabasePath()`已实现基于路径的匹配逻辑
- 匹配机制：读取`workspaceStorage/{workspaceId}/workspace.json`，解析其中的`folder`字段
- 对于多根工作空间，`workspace.json`中的`folder`字段可能包含：
  - 工作空间文件路径（`.code-workspace`文件）
  - 或第一个子项目的路径
- 需要规范化路径比较（处理Windows路径大小写、路径分隔符等）

**Decision**: 
- 对于多根工作空间，使用`vscode.workspace.workspaceFile?.fsPath`作为匹配路径
- 如果`workspaceFile`不可用，使用第一个`workspaceFolder`的路径作为后备
- 使用`CursorDataLocator.getWorkspaceDatabasePath(undefined, workspacePath)`进行匹配
- 路径规范化使用`path.normalize()`和大小写不敏感比较（Windows）

**Rationale**: 
- 工作空间文件路径是最准确的标识符
- 利用现有的路径匹配逻辑，减少重复代码
- 处理路径变化的情况，通过重新匹配找到正确的数据库

**Alternatives Considered**:
- 使用工作空间ID直接访问：需要知道工作空间ID的生成规则，可能不够可靠
- 遍历所有工作空间数据库：性能较差，特别是当有大量工作空间时

---

### 5. 性能优化策略

**Question**: 如何确保在多根工作空间中快速加载会话列表（<3秒，支持最多10个子项目）？

**Findings**:
- 当前实现从SQLite数据库读取，使用`sql.js`库
- 数据库查询性能取决于：
  - 数据库文件大小
  - 查询复杂度
  - 内存中的数据库加载时间
- 会话列表查询相对简单（读取单个键值对）
- 主要性能瓶颈可能在数据库文件加载和解析

**Decision**: 
- 缓存工作空间类型检测结果，避免重复检测
- 缓存工作空间数据库路径，仅在工作空间切换时重新匹配
- 使用异步加载，避免阻塞UI
- 限制会话列表大小（如果需要）：按时间排序后取前N条
- 使用增量更新：仅在数据库文件变更时重新加载

**Rationale**: 
- 工作空间类型和数据库路径相对稳定，缓存可以显著提升性能
- 异步加载确保UI响应性
- 大多数用户不需要查看所有历史会话，限制数量可以提升性能

**Alternatives Considered**:
- 预加载所有工作空间数据库：内存占用过大，且大多数工作空间可能不会被使用
- 使用索引数据库：需要额外的维护成本，当前SQLite查询已足够快

---

### 6. 错误处理和降级策略

**Question**: 当工作空间数据库不存在、无法访问或路径匹配失败时，如何处理？

**Findings**:
- 当前实现（`DatabaseAccess.getSessionList()`）在数据库不可用时返回空数组
- 需要区分不同的错误情况：
  - 工作空间数据库不存在（新工作空间）
  - 数据库文件被锁定或无法访问
  - 路径匹配失败（工作空间路径变化）

**Decision**: 
- 工作空间数据库不存在：返回空会话列表（正常情况，新工作空间）
- 数据库文件无法访问：记录警告日志，返回空列表，不抛出错误
- 路径匹配失败：尝试使用第一个工作空间文件夹路径重新匹配，如果仍失败则返回空列表
- 所有错误情况都不应导致插件崩溃或UI阻塞
- 在UI中显示适当的提示（如果需要）

**Rationale**: 
- 优雅降级确保插件始终可用，即使在某些边缘情况下
- 空列表是合理的默认行为，用户可以理解
- 详细的日志有助于调试问题

**Alternatives Considered**:
- 抛出错误并显示错误消息：可能干扰用户体验，特别是对于新工作空间
- 尝试从全局数据库读取：可能显示不相关的会话，造成混淆

---

## Summary

**Key Decisions**:
1. **工作空间类型检测**：使用`vscode.workspace.workspaceFile`属性作为主要检测方法
2. **数据聚合**：多根工作空间共享一个数据库，无需跨数据库聚合
3. **路径匹配**：使用工作空间文件路径匹配数据库，利用现有的`CursorDataLocator`逻辑
4. **性能优化**：缓存检测结果和数据库路径，异步加载
5. **错误处理**：优雅降级，返回空列表而非抛出错误

**Implementation Approach**:
- 扩展`WorkspaceHelper`添加多根工作空间检测方法
- 扩展`DatabaseAccess`支持多根工作空间数据库访问
- 更新`UnifiedSessionDataProvider`使用新的工作空间检测逻辑
- 添加适当的缓存和错误处理

**Open Questions Resolved**:
- ✅ 多根工作空间数据存储机制：共享一个工作空间数据库
- ✅ 工作空间类型检测方法：使用`workspaceFile`属性
- ✅ 会话数据聚合策略：从共享数据库读取，无需跨数据库聚合
- ✅ 路径匹配策略：使用工作空间文件路径匹配
- ✅ 性能优化：缓存 + 异步加载
- ✅ 错误处理：优雅降级，返回空列表
