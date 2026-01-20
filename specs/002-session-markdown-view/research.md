# Research: 会话 Markdown 视图

**Date**: 2025-12-11  
**Feature**: 会话 Markdown 视图 - 点击会话条目打开 Markdown 编辑器

## Research Questions & Findings

### 1. VS Code 编辑器 API 使用模式

**Question**: 如何创建临时文档并显示在编辑器中？如何设置编辑器标题和只读属性？

**Findings**:
- VS Code Extension API 提供 `vscode.workspace.openTextDocument()` 创建文档
- 使用 `vscode.window.showTextDocument()` 显示文档
- 可以通过 `vscode.workspace.openTextDocument({ content: string, language: string })` 创建临时文档
- 编辑器可以通过 `vscode.TextDocument.isUntitled` 判断是否为临时文档
- 可以通过 `vscode.window.activeTextEditor` 获取当前活动编辑器
- 编辑器标题自动从文档 URI 或内容生成

**Decision**: 
- 使用 `vscode.workspace.openTextDocument({ content: markdownContent, language: 'markdown' })` 创建临时 Markdown 文档
- 使用 `vscode.window.showTextDocument(document, { preview: false })` 显示文档，`preview: false` 确保打开新标签页而不是预览
- 文档 URI 可以使用 `vscode.Uri.parse('untitled:' + sessionName)` 创建，这样标题会显示会话名称
- 由于是临时文档，用户关闭后不会保存，符合需求

**Rationale**: 
- VS Code API 提供了标准的临时文档创建方式
- 使用 `untitled:` URI scheme 可以创建未保存的文档
- `preview: false` 确保每次点击都打开新标签页，而不是替换预览

**Alternatives Considered**:
- 创建实际文件：不符合需求，用户不需要持久化
- 使用 WebView：过于复杂，Markdown 编辑器已经足够

---

### 2. Markdown 渲染最佳实践

**Question**: 如何将对话消息转换为 Markdown 格式？如何处理代码块和特殊字符？

**Findings**:
- Markdown 基本格式：
  - 用户消息：使用 `## User` 或 `**User:**` 标记
  - Agent 消息：使用 `## Assistant` 或 `**Assistant:**` 标记
  - 代码块：使用三个反引号包裹，可以指定语言
  - 时间戳：可以使用 `*[时间戳]*` 格式
- 特殊字符转义：
  - Markdown 特殊字符需要转义：`\`, `` ` ``, `*`, `_`, `[`, `]`, `(`, `)`, `#`, `+`, `-`, `.`, `!`
  - 代码块内的内容不需要转义
- 性能考虑：
  - 字符串拼接比数组 join 慢
  - 大量消息时，使用数组收集后 join 更高效

**Decision**:
- 使用数组收集 Markdown 片段，最后用 `\n\n` join
- 用户消息格式：`## User\n\n{messageText}\n\n`
- Agent 消息格式：`## Assistant\n\n{messageText}\n\n` 或 `## Assistant\n\n[Tool Use: {toolName}]\n\n`
- 代码块格式：`` ```{language}\n{code}\n``` ``
- 时间戳格式：`*[{timestamp}]*`
- 特殊字符转义：仅对非代码块内容进行转义

**Rationale**: 
- 数组 join 方式性能更好，代码更清晰
- 标准的 Markdown 格式易于阅读和编辑
- 工具使用提示使用简单格式，不影响可读性

**Alternatives Considered**:
- 使用 Markdown 库（如 `marked`）：增加依赖，对于简单渲染不必要
- 使用模板引擎：过于复杂，简单的字符串拼接足够

---

### 3. 数据加载和性能优化

**Question**: 如何高效加载大量气泡数据？如何处理超大会话（1000+ 消息）？

**Findings**:
- 现有的 `DatabaseAccess.getAgentRecords()` 方法已经实现了批量加载
- `SQLiteAccess.getMultipleBubbleData()` 可以批量查询多个气泡
- 性能瓶颈可能在：
  - 数据库查询（已优化，使用批量查询）
  - JSON 解析（不可避免）
  - Markdown 渲染（字符串操作，需要优化）
- 对于超大会话：
  - 可以限制显示的消息数量（但不符合需求 SC-002）
  - 可以分页加载（但不符合需求，需要显示所有消息）
  - 可以优化渲染性能（使用数组 join，避免重复字符串操作）

**Decision**:
- 使用现有的 `DatabaseAccess.getAgentRecords(sessionId)` 方法加载单个会话数据
- 该方法已经实现了批量加载气泡数据，性能已优化
- Markdown 渲染使用数组收集片段，最后 join，避免重复字符串拼接
- 对于超大会话，接受性能开销（3 秒内完成 100 条消息，符合 SC-003）
- 如果性能成为问题，可以考虑：
  - 显示加载进度
  - 异步渲染（先显示部分内容，再加载剩余）

**Rationale**: 
- 复用现有代码，减少重复实现
- 批量查询已经优化了数据库访问
- 数组 join 是标准的字符串拼接优化方式
- 需求明确要求显示所有消息（SC-002），不能限制数量

**Alternatives Considered**:
- 限制消息数量：不符合需求 SC-002
- 分页加载：不符合需求，需要显示完整会话
- 使用 Web Worker：过于复杂，当前性能目标可以满足

---

### 4. 错误处理和用户体验

**Question**: 如何处理数据不存在的情况？如何显示加载进度？

**Findings**:
- VS Code 提供 `vscode.window.withProgress()` API 显示进度
- 错误处理可以使用 `vscode.window.showErrorMessage()` 显示错误
- 数据不存在时，应该显示友好的错误信息，不打开编辑器
- 加载过程中可以显示进度条和状态消息

**Decision**:
- 使用 `vscode.window.withProgress()` 显示加载进度
- 进度分为三个阶段：
  1. "Loading session data..." (0-40%)
  2. "Loading bubble details..." (40-80%)
  3. "Rendering Markdown..." (80-100%)
- 错误处理：
  - 会话不存在：显示 "Session not found" 错误
  - 数据加载失败：显示 "Failed to load session data" 错误
  - 渲染失败：显示 "Failed to render Markdown" 错误
- 所有错误都使用 `vscode.window.showErrorMessage()` 显示，不打开编辑器

**Rationale**: 
- 进度显示让用户知道系统正在工作
- 明确的错误信息帮助用户理解问题
- 不打开空编辑器避免混淆

**Alternatives Considered**:
- 静默失败：用户体验差，用户不知道发生了什么
- 打开空编辑器：容易混淆，用户不知道内容为什么是空的

---

### 5. 会话列表点击事件处理

**Question**: 如何在会话列表 panel 中添加点击事件？如何获取被点击的会话 ID？

**Findings**:
- VS Code TreeView 提供 `onDidChangeSelection` 事件监听选择变化
- `TreeView.selection` 属性包含当前选中的项
- 可以通过 `TreeItem.command` 属性为每个项添加命令
- 命令可以传递参数（通过 `command` 的 `arguments` 属性）

**Decision**:
- 使用 `TreeView.onDidChangeSelection` 监听选择事件
- 当用户选择会话项时，触发打开 Markdown 视图的命令
- 命令参数传递 `composerId`（会话 ID）
- 或者使用 `TreeItem.command` 为每个项直接绑定命令

**Rationale**: 
- `onDidChangeSelection` 是标准的 TreeView 交互方式
- 命令方式更灵活，可以传递参数
- 符合 VS Code 扩展开发最佳实践

**Alternatives Considered**:
- 使用 `TreeItem.command`：需要在创建 TreeItem 时设置，不够灵活
- 使用双击事件：VS Code TreeView 不直接支持双击，需要模拟

---

### 6. 编辑器窗口管理

**Question**: 如果编辑器窗口已打开相同会话，是创建新窗口还是聚焦现有窗口？

**Findings**:
- VS Code 的 `showTextDocument()` 默认行为：
  - 如果文档已打开，会聚焦到现有标签页
  - 如果文档未打开，会打开新标签页
- 临时文档（`untitled:`）每次创建都是新的，不会复用
- 可以通过检查已打开的文档来判断

**Decision**:
- 每次点击都创建新的临时文档（使用 `untitled:` URI）
- 不检查是否已打开相同会话（简化实现）
- 如果用户需要，可以手动关闭之前的标签页
- 未来可以考虑添加检查逻辑，但当前版本不实现

**Rationale**: 
- 简化实现，减少复杂度
- 用户可能想要同时查看多个会话的 Markdown
- 临时文档不会持久化，关闭后自动清理

**Alternatives Considered**:
- 检查并聚焦现有窗口：增加复杂度，当前不需要
- 限制只能打开一个：用户体验差，用户可能想对比多个会话

---

## Open Questions / Future Research

1. **Markdown 渲染性能优化**
   - 如果遇到超大会话（1000+ 消息），是否需要实现增量渲染？
   - 当前方案（数组 join）的性能是否足够？

2. **编辑器功能增强**
   - 是否需要支持导出 Markdown 到文件？（当前不在范围内）
   - 是否需要支持搜索和导航？（当前不在范围内）

3. **用户体验优化**
   - 是否需要记住用户上次查看的会话？
   - 是否需要支持快捷键打开 Markdown 视图？

## Summary

所有研究问题已解决，关键技术决策：

1. **编辑器创建**: 使用 `vscode.workspace.openTextDocument()` 和 `vscode.window.showTextDocument()` 创建临时 Markdown 文档
2. **Markdown 渲染**: 使用数组收集片段后 join，标准 Markdown 格式
3. **数据加载**: 复用现有的 `DatabaseAccess.getAgentRecords()` 方法
4. **错误处理**: 使用 `vscode.window.withProgress()` 和 `vscode.window.showErrorMessage()`
5. **点击事件**: 使用 `TreeView.onDidChangeSelection` 监听选择事件
6. **窗口管理**: 每次创建新临时文档，不检查重复

所有 "NEEDS CLARIFICATION" 项目已解决，可以进入 Phase 1 设计阶段。

