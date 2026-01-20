# Research: Cursor助手插件

**Date**: 2025-12-10  
**Feature**: Cursor助手插件 - 数据采集和本地存储

## Research Questions & Findings

### 1. Cursor 内部数据访问方式

**Question**: 如何访问 Cursor 的使用数据？数据库位置、API 接口、数据文件位置是什么？

**Findings**:
- Cursor 基于 VS Code，使用 Electron 框架
- VS Code 扩展可以通过 Extension API 访问编辑器状态
- Cursor 可能将数据存储在：
  - 用户数据目录（类似 VS Code 的 `~/.cursor/` 或 `%APPDATA%/Cursor/`）
  - SQLite 数据库文件（如果使用）
  - JSON 配置文件或日志文件

**Decision**: 
- 采用多层次的访问策略：优先尝试数据库访问，其次 API 调用，最后文件读取
- 需要研究 Cursor 的实际数据存储位置（通过用户数据目录查找）
- 使用 VS Code Extension API 的 `workspace` 和 `window` 命名空间访问编辑器状态

**Rationale**: 
- 提供多种访问方式可以提高兼容性和可靠性
- 如果一种方式失败，可以自动回退到其他方式

**Alternatives Considered**:
- 仅使用 API 访问：可能不够稳定，某些数据可能无法通过 API 获取
- 仅使用文件读取：可能无法实时获取数据，需要轮询

---

### 2. VS Code Extension API 访问编辑器内部数据

**Question**: 如何使用 VS Code Extension API 访问编辑器内部数据？

**Findings**:
- VS Code Extension API 提供以下关键接口：
  - `vscode.workspace` - 工作空间和文件系统访问
  - `vscode.window` - 编辑器窗口和活动编辑器
  - `vscode.TextEditor` - 文本编辑器状态
  - `vscode.workspace.onDidChangeTextDocument` - 文档变更事件
  - `vscode.workspace.onDidSaveTextDocument` - 文档保存事件

**Decision**:
- 使用事件监听器捕获编辑器事件（文档变更、保存等）
- 通过 `vscode.window.activeTextEditor` 获取当前编辑器状态
- 使用 `vscode.workspace` API 访问工作空间信息

**Rationale**:
- 事件驱动的方式可以实时捕获用户操作
- Extension API 是官方推荐的方式，稳定可靠

**Alternatives Considered**:
- 直接访问文件系统：无法捕获实时事件，需要轮询
- 使用第三方库：可能不稳定，增加依赖

---

### 3. 监听 Cursor 代码建议、采纳、提交事件

**Question**: 如何监听 Cursor 的代码建议、采纳、提交等事件？

**Findings**:
- VS Code Extension API 不直接提供 AI 代码建议的事件
- 需要间接方式：
  - 监听文档变更事件（`onDidChangeTextDocument`）来推断代码采纳
  - 监听 Git 提交事件（通过 Git Extension API 或文件系统监控）
  - 可能需要监听命令执行（`vscode.commands.executeCommand`）

**Decision**:
- 使用文档变更事件推断代码采纳（对比变更前后的内容）
- 使用 Git Extension API 或文件系统监控检测代码提交
- 监听命令执行事件（如 `cursor.tabComplete`, `cursor.inlineEdit` 等，如果存在）

**Rationale**:
- 文档变更事件可以捕获大部分代码编辑操作
- Git 集成可以准确检测代码提交
- 命令监听可以识别特定的 Cursor 功能

**Alternatives Considered**:
- 轮询方式：性能开销大，不够实时
- 直接访问 Cursor 内部状态：可能不稳定，依赖内部实现

---

### 4. 访问 Cursor AI 聊天会话记录

**Question**: 如何访问 Cursor AI 的聊天会话记录？

**Findings**:
- Cursor 的聊天记录可能存储在：
  - 用户数据目录的配置文件中
  - 本地数据库（SQLite）
  - 内存中（需要通过 Extension API 访问）

**Decision**:
- 首先尝试通过 Extension API 访问（如果 Cursor 提供了相关 API）
- 其次尝试访问用户数据目录中的配置文件或数据库
- 如果以上都不可用，监听聊天相关的命令执行事件

**Rationale**:
- 多种方式可以提高成功率
- 优先使用官方 API，其次使用文件系统访问

**Alternatives Considered**:
- 仅使用文件系统访问：可能无法获取实时数据
- 仅使用 API：可能某些版本不支持

---

### 5. 识别和区分不同的代码辅助模式

**Question**: 如何识别和区分 Tab键自动补全、cmd+K 行内自动补全、Agent 对话模式？

**Findings**:
- Tab键自动补全：通常通过文档变更事件触发，可能伴随特定的命令
- cmd+K 行内自动补全：可能有特定的命令标识（如 `cursor.inlineEdit`）
- Agent 对话模式：可能有独立的命令或 API

**Decision**:
- 监听命令执行事件，识别特定的命令标识
- 分析文档变更的模式（Tab键补全通常是单行或小范围变更，cmd+K 可能是多行变更）
- 对于 Agent 模式，监听聊天相关的命令和事件

**Rationale**:
- 命令监听可以准确识别不同的模式
- 结合文档变更分析可以提高识别准确性

**Alternatives Considered**:
- 仅通过文档变更分析：可能不够准确，难以区分不同模式
- 仅通过命令监听：某些操作可能不触发命令

---

### 6. 批量写入的最佳实践和性能优化

**Question**: 批量写入的最佳实践和性能优化策略是什么？

**Findings**:
- Node.js 文件系统操作：
  - `fs.writeFile` 同步写入可能阻塞
  - `fs.promises.writeFile` 异步写入更优
  - 批量写入可以减少 I/O 操作次数
- 性能优化策略：
  - 使用缓冲区累积数据
  - 定时批量写入（如每 10 秒）
  - 累积阈值触发写入（如 100 条记录）
  - 使用文件追加模式（`fs.appendFile`）或合并后写入

**Decision**:
- 使用内存缓冲区累积数据
- 实现双重触发机制：
  - 时间触发：每 10 秒写入一次
  - 数量触发：累积 100 条记录后写入
- 使用异步文件写入（`fs.promises.writeFile`）
- 对于同一天的数据，可以追加到现有文件或创建新文件（根据文件大小）

**Rationale**:
- 双重触发机制可以平衡实时性和性能
- 异步写入不会阻塞主线程
- 文件追加可以减少文件数量，但需要考虑文件大小限制

**Alternatives Considered**:
- 实时写入：性能开销大，可能影响用户体验
- 仅时间触发：可能在高频操作时丢失数据
- 仅数量触发：可能在低频操作时延迟过长

---

## Technology Stack Decisions

### Core Technologies

1. **TypeScript 5.x**
   - **Rationale**: VS Code Extension 的标准语言，类型安全，良好的 IDE 支持
   - **Alternatives**: JavaScript - 缺少类型检查，维护性较差

2. **VS Code Extension API**
   - **Rationale**: 官方 API，稳定可靠，跨平台支持
   - **Alternatives**: 直接访问文件系统 - 无法获取实时事件

3. **Node.js fs/path 模块**
   - **Rationale**: 标准库，无需额外依赖，性能良好
   - **Alternatives**: 第三方文件系统库 - 增加依赖，可能不必要

### Testing Framework

1. **Mocha + Chai**
   - **Rationale**: VS Code Extension 测试的标准选择，与 `@vscode/test-electron` 兼容
   - **Alternatives**: Jest - 可能在某些场景下与 VS Code Extension API 不兼容

2. **@vscode/test-electron**
   - **Rationale**: 官方提供的集成测试工具，可以测试 Extension API
   - **Alternatives**: 手动模拟 - 工作量大，可能不准确

---

## Implementation Approach

### Data Collection Strategy

1. **事件驱动采集**
   - 使用 VS Code Extension API 的事件监听器
   - 实时捕获用户操作和编辑器状态变化

2. **多源数据访问**
   - 实现数据访问抽象层，支持多种访问方式
   - 自动回退机制，确保数据采集的可靠性

3. **批量写入优化**
   - 内存缓冲区累积数据
   - 双重触发机制（时间 + 数量）
   - 异步文件写入，不阻塞主线程

### Error Handling Strategy

1. **优雅降级**
   - 数据采集失败时记录错误但不影响 Cursor 使用
   - 存储失败时记录错误，允许后续重试

2. **错误日志**
   - 记录详细的错误信息
   - 帮助用户诊断问题

---

## Database Access Implementation Details

### 数据库文件位置

基于实际研究，Cursor 使用 SQLite 数据库存储数据，主要有两个数据库文件：

1. **工作空间数据库** (Workspace Storage)
   - **Windows**: `C:\Users\<Username>\AppData\Roaming\Cursor\User\workspaceStorage\<workspace-id>\state.vscdb`
   - **macOS**: `~/Library/Application Support/Cursor/User/workspaceStorage/<workspace-id>/state.vscdb`
   - **Linux**: `~/.config/Cursor/User/workspaceStorage/<workspace-id>/state.vscdb`
   - **用途**: 存储工作空间特定的数据，包括 composer 列表

2. **全局数据库** (Global Storage)
   - **Windows**: `C:\Users\<Username>\AppData\Roaming\Cursor\User\globalStorage\state.vscdb`
   - **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
   - **Linux**: `~/.config/Cursor/User/globalStorage/state.vscdb`
   - **用途**: 存储全局数据，包括 composer 详细信息和气泡（bubble）数据

### 数据库表结构

#### ItemTable 表（工作空间数据库）

- **表名**: `ItemTable`
- **用途**: 存储工作空间级别的配置和数据
- **关键记录**:
  - **Key**: `composer.composerData`
  - **Value**: JSON 格式，包含所有 composer 的列表信息
    ```json
    {
      "allComposers": [
        {
          "composerId": "uuid",
          "name": "会话名称",
          "subtitle": "会话副标题",
          "type": "head",
          "unifiedMode": "chat" | "agent",
          "createdAt": timestamp,
          "lastUpdatedAt": timestamp,
          "totalLinesAdded": number,
          "totalLinesRemoved": number,
          "filesChangedCount": number,
          "contextUsagePercent": number,
          // ... 其他字段
        }
      ],
      "lastFocusedComposerIds": ["uuid1", "uuid2"],
      "selectedComposerIds": ["uuid1", "uuid2"]
    }
    ```

#### CursorDiskKV 表（全局数据库）

- **表名**: `CursorDiskKV`
- **用途**: 键值存储，存储 composer 和 bubble 的详细信息
- **Key 格式**:
  - Composer 数据: `composerData:<composerId>`
  - Bubble 数据: `bubbleId:<composerId>:<bubbleId>`
- **Value 格式**: JSON 对象，包含完整的会话或气泡数据

### 数据访问流程

1. **获取 Composer 列表**
   - 打开工作空间数据库
   - 查询 `ItemTable` 表，查找 key 为 `composer.composerData` 的记录
   - 解析 JSON value，获取 `allComposers` 数组

2. **获取 Composer 详细信息**
   - 打开全局数据库
   - 对于每个 composerId，查询 `CursorDiskKV` 表
   - Key 格式: `composerData:<composerId>`
   - 解析 JSON value，获取完整的 composer 数据，包括：
     - `fullConversationHeadersOnly`: 气泡 ID 列表
     - `context`: 上下文信息
     - `capabilities`: 能力列表
     - `usageData`: 使用数据
     - 其他元数据

3. **获取 Bubble（消息）详情**
   - 打开全局数据库
   - 对于每个 bubbleId，查询 `CursorDiskKV` 表
   - Key 格式: `bubbleId:<composerId>:<bubbleId>`
   - 解析 JSON value，获取完整的气泡数据，包括：
     - `text`: 消息文本
     - `codeBlocks`: 代码块列表
     - `type`: 气泡类型（1=用户消息，2=AI回复）
     - `tokenCount`: Token 统计
     - `createdAt`: 创建时间
     - 其他上下文信息

### 实现注意事项

1. **数据库锁定**: Cursor 可能正在使用数据库，需要以只读模式打开
2. **工作空间 ID**: 需要动态获取当前工作空间的 ID
3. **数据解析**: Value 字段存储的是 JSON 字符串，需要解析
4. **性能优化**: 可以缓存 composer 列表，避免频繁查询
5. **错误处理**: 数据库可能不存在或无法访问，需要优雅降级

### 数据映射到插件模型

- **AgentRecord**: 对应一个 composer，包含完整的对话记录
- **UsageStatistics**: 从 composer 和 bubble 数据中提取统计信息
  - 建议次数: 统计 type=2 的 bubble 数量
  - 采纳次数: 需要分析代码块的应用情况
  - 代码行数: 从 `codeBlocks` 中提取

## Open Questions / Future Research

1. ~~**Cursor 具体的数据存储位置**~~ ✅ **已解决**
   - 已确定数据库文件位置和表结构
   - 不同操作系统的路径已明确

2. **Cursor 的命令标识符**
   - 需要查看 Cursor 的源代码或文档
   - 可能需要通过实验确定

3. ~~**Agent 对话记录的完整结构**~~ ✅ **已解决**
   - 已确定 composer 和 bubble 的数据结构
   - 数据存储在 CursorDiskKV 表中

4. **性能基准测试**
   - 需要在实际使用场景中测试性能影响
   - 可能需要调整批量写入的参数

5. **工作空间 ID 的获取方式**
   - 需要确定如何动态获取当前工作空间的 ID
   - 可能需要从 VS Code API 或文件系统路径推断

---

### 7. VS Code TreeView Panel 实现

**Question**: 如何在 VS Code Extension 中创建侧边栏 TreeView panel？

**Findings**:
- VS Code Extension API 提供 `vscode.window.createTreeView()` 创建 TreeView
- 需要实现 `TreeDataProvider` 接口提供数据
- TreeView 可以注册到活动栏（Activity Bar）或侧边栏
- TreeView 支持自动刷新和手动刷新

**Decision**:
- 使用 `vscode.window.createTreeView()` 创建会话列表 panel
- 实现 `TreeDataProvider` 接口，从数据库读取会话数据
- 注册到活动栏，显示图标
- 使用 `onDidChangeTreeData` 事件触发刷新

**Rationale**:
- TreeView 是 VS Code 标准的列表显示方式
- 符合 VS Code 的 UI 设计规范
- 支持自动刷新和性能优化

**Alternatives Considered**:
- Webview: 完全自定义，但不符合 VS Code UI 规范
- StatusBar: 空间有限，不适合显示列表

---

### 8. 数据库变化检测机制

**Question**: 如何检测 Cursor 数据库的变化以更新会话列表？

**Findings**:
- SQLite 使用 WAL（Write-Ahead Logging）模式时，会创建 `-wal` 文件
- 可以使用 `fs.watch` 监听文件变化
- `fs.watch` 在某些系统上可能不可靠，需要回退机制
- 定时检查可以作为补充机制
- **更新**: 自动监视和轮询检查会造成额外的性能影响

**Decision**:
- **用户主动刷新机制**（不实现自动监视和轮询检查）
- 会话列表 panel 在初始化时加载一次
- 用户可以通过刷新按钮或重新打开 panel 来更新列表
- 移除 `fs.watch` 监听和定时检查机制

**Rationale**:
- 避免后台监视和轮询的性能开销
- 用户不需要实时扫描变化
- 简化实现，减少资源消耗
- 符合性能要求（SC-009: 对 Cursor 性能影响 < 2%，不包含后台监视和轮询开销）

**Alternatives Considered**:
- ~~`fs.watch` + 定时检查 + 防抖机制~~: 已废弃，会造成额外的性能影响
- ~~仅定时检查~~: 已废弃，会造成额外的性能影响
- **用户主动刷新**: 选择此方案，性能最优，用户体验可接受

