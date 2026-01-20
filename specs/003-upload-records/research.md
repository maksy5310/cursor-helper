# Research: 记录上传到分享平台

**Date**: 2025-12-15  
**Feature**: 记录上传到分享平台 - 在插件中上传 Agent 使用记录

## Research Questions & Findings

### 1. 上传表单 UI 方案选择

**Question**: 如何实现上传表单 UI？使用 Webview、InputBox 还是 QuickPick？

**Findings**:
- **Webview**: VS Code 提供 `vscode.window.createWebviewPanel()` API，可以创建自定义 HTML/CSS/JS 界面
  - 优点：完全自定义，支持复杂表单、实时验证、文件选择
  - 缺点：需要实现 HTML/CSS/JS，复杂度较高
- **InputBox**: VS Code 提供 `vscode.window.showInputBox()` API，简单的单行输入
  - 优点：简单易用，VS Code 原生支持
  - 缺点：只能单行输入，不适合复杂表单
- **Multi-step InputBox**: 使用多个 `showInputBox()` 逐步收集信息
  - 优点：简单，无需额外实现
  - 缺点：用户体验较差，需要多次输入，无法返回修改
- **QuickPick**: VS Code 提供 `vscode.window.showQuickPick()` API，用于选择列表项
  - 优点：适合选择操作
  - 缺点：不适合表单输入

**Decision**: 
- 使用 **Webview** 创建上传表单 UI
- 原因：需要多个字段（项目名称、邮箱、时间、格式、内容），需要实时验证，需要文件选择功能
- Webview 可以提供更好的用户体验和完整的表单验证

**Rationale**: 
- 上传表单包含多个字段，需要良好的用户体验
- 需要实时验证（邮箱格式、时间格式、内容大小等）
- 需要文件选择功能来选择本地存储的记录文件
- Webview 是 VS Code Extension 中实现复杂 UI 的标准方式

**Alternatives Considered**:
- Multi-step InputBox：用户体验差，需要多次输入，无法返回修改
- 简单 InputBox：无法满足多字段表单需求

---

### 2. HTTP 客户端选择

**Question**: 使用 Node.js 内置 `fetch` API 还是第三方库（如 `axios`）？

**Findings**:
- **Node.js fetch**: Node.js 18+ 内置 `fetch` API（基于 undici）
  - 优点：无需额外依赖，原生支持，符合 Web 标准
  - 缺点：功能相对简单，错误处理需要手动实现
- **axios**: 流行的 HTTP 客户端库
  - 优点：功能丰富，自动 JSON 解析，更好的错误处理
  - 缺点：需要额外依赖，增加包大小

**Decision**:
- 使用 **Node.js 内置 `fetch` API**
- 原因：Node.js 18+ 已内置，无需额外依赖，符合 VS Code Extension 的轻量级要求
- 对于错误处理和 JSON 解析，可以封装工具函数

**Rationale**: 
- VS Code Extension 通常使用 Node.js 18+，内置 fetch 可用
- 减少依赖，降低包大小
- fetch API 功能足够满足需求（POST 请求、JSON 数据、错误处理）

**Alternatives Considered**:
- axios：增加依赖，对于简单的 API 调用不必要
- node-fetch：Node.js 18+ 已内置 fetch，无需额外库

---

### 3. JWT Token 存储方案

**Question**: 如何存储 JWT Token？使用 workspaceState、globalState 还是配置文件？

**Findings**:
- **workspaceState**: VS Code 的 `ExtensionContext.workspaceState`，工作空间级别存储
  - 优点：每个工作空间独立配置
  - 缺点：切换工作空间需要重新配置
- **globalState**: VS Code 的 `ExtensionContext.globalState`，全局存储
  - 优点：全局配置，所有工作空间共享
  - 缺点：所有工作空间使用相同 Token
- **配置文件**: 在用户目录创建配置文件
  - 优点：用户可以手动编辑
  - 缺点：需要文件系统操作，可能权限问题

**Decision**:
- 使用 **globalState** 存储 JWT Token
- 原因：JWT Token 通常是用户级别的配置，所有工作空间共享更合理
- 同时提供配置命令，允许用户更新 Token

**Rationale**: 
- JWT Token 是用户级别的认证信息，不是项目级别的
- 用户通常希望在所有工作空间中使用相同的 Token
- globalState 是 VS Code Extension 存储全局配置的标准方式

**Alternatives Considered**:
- workspaceState：每个工作空间需要单独配置，用户体验差
- 配置文件：增加复杂度，可能权限问题

---

### 4. 错误处理和重试机制

**Question**: 如何处理网络错误、超时和 API 错误？是否需要实现重试机制？

**Findings**:
- **网络错误**: 连接失败、DNS 解析失败等
  - 处理：显示网络错误提示，允许用户重试
- **超时**: 请求超时（默认 fetch 无超时，需要手动实现）
  - 处理：设置合理的超时时间（如 30 秒），超时后显示错误并允许重试
- **API 错误**: 400, 401, 413, 500 等 HTTP 状态码
  - 处理：根据状态码显示不同的错误消息，401 提示更新 Token，413 提示内容过大
- **重试机制**: 自动重试 vs 手动重试
  - 自动重试：对于临时错误（网络错误、500 错误）可以自动重试
  - 手动重试：对于用户错误（400, 401, 413）需要用户修复后手动重试

**Decision**:
- 实现统一的错误处理机制，根据错误类型显示不同的错误消息
- 对于网络错误和 500 错误，提供自动重试选项（最多 3 次）
- 对于用户错误（400, 401, 413），不自动重试，提示用户修复后手动重试
- 设置请求超时时间（30 秒）

**Rationale**: 
- 统一的错误处理提供一致的用户体验
- 自动重试对于临时错误可以提高成功率
- 用户错误需要用户修复，不应自动重试

**Alternatives Considered**:
- 全部手动重试：用户体验差，临时错误也需要用户手动重试
- 全部自动重试：用户错误也会自动重试，浪费资源

---

### 5. 表单验证策略

**Question**: 如何实现表单验证？客户端验证 vs 服务端验证？

**Findings**:
- **客户端验证**: 在上传前验证表单字段
  - 优点：快速反馈，减少无效请求
  - 缺点：需要实现验证逻辑
- **服务端验证**: 依赖 API 返回的错误信息
  - 优点：无需实现验证逻辑
  - 缺点：需要发送请求才能知道错误，用户体验差

**Decision**:
- 实现 **客户端验证**，在上传前验证所有字段
- 验证规则：
  - 项目名称：必填，1-255 字符
  - 邮箱：必填，有效邮箱格式（正则表达式）
  - 时间：必填，ISO 8601 格式，不能是未来时间
  - 内容格式：可选，默认 'markdown'，枚举值验证
  - 内容：必填，最大 10MB（字节大小验证）
- 同时处理服务端返回的验证错误（400 错误），显示具体错误信息

**Rationale**: 
- 客户端验证提供快速反馈，改善用户体验
- 减少无效请求，节省网络资源
- 服务端验证作为补充，处理客户端无法验证的情况

**Alternatives Considered**:
- 仅服务端验证：用户体验差，需要发送请求才能知道错误
- 仅客户端验证：可能遗漏某些验证规则

---

### 6. 触发方式和数据源

**Question**: 如何触发上传功能？如何获取要上传的会话数据？

**Findings**:
- **命令触发**: 通过 VS Code 命令面板执行命令
  - 优点：标准方式，用户熟悉
  - 缺点：需要用户手动执行命令，然后选择会话
- **会话列表点击触发**: 在 `SessionListPanel` 的点击事件中集成上传功能
  - 优点：用户点击会话项即可触发，流程更自然
  - 缺点：需要修改现有的会话列表面板
- **数据源 - 本地文件**: 从本地文件系统读取 JSON 文件
  - 优点：简单直接
  - 缺点：本地存储文件已弃用
- **数据源 - 数据库**: 通过 `DatabaseAccess` 从 Cursor 数据库读取会话数据
  - 优点：数据实时，与现有功能一致
  - 缺点：需要了解数据库结构

**Decision**:
- 使用 **会话列表点击触发**，在 `SessionListPanel` 的点击事件中集成上传功能
- 使用 **数据库**作为数据源，通过 `DatabaseAccess.getAgentRecords(composerId)` 获取会话数据
- 用户点击会话项时，传递 `composerId` 给上传表单，表单自动加载会话内容

**Rationale**: 
- 点击触发更符合用户直觉，无需额外命令
- 数据库是当前会话数据的唯一来源，本地文件已弃用
- 与现有的会话列表功能保持一致

**Alternatives Considered**:
- 命令触发：需要用户额外操作，体验不如点击触发
- 本地文件：已弃用，不再使用

---

### 7. 内容编辑器实现

**Question**: 如何在表单内提供内容编辑器，允许用户编辑和预览会话内容？

**Findings**:
- **Webview 内嵌编辑器**: 在 Webview HTML 中使用 `<textarea>` 或代码编辑器库（如 Monaco Editor）
  - 优点：集成在表单内，用户体验流畅
  - 缺点：Monaco Editor 体积较大，可能影响性能
- **简单 textarea**: 使用 HTML `<textarea>` 元素
  - 优点：轻量级，无需额外依赖
  - 缺点：功能简单，无语法高亮
- **弹出编辑器**: 使用 VS Code 的 `vscode.window.showTextDocument()` 打开临时文档
  - 优点：使用 VS Code 原生编辑器，功能完整
  - 缺点：需要切换窗口，用户体验可能不如内嵌编辑器
- **预览功能**: 在 Webview 中渲染 Markdown 预览
  - 优点：实时预览，用户体验好
  - 缺点：需要实现 Markdown 渲染逻辑

**Decision**:
- **优先方案**: 在 Webview 表单内使用 `<textarea>` 提供内容编辑器
  - 支持基本的文本编辑功能
  - 提供预览按钮，点击后在同一 Webview 中显示 Markdown 预览（使用 `marked` 库或复用现有的 Markdown 渲染逻辑）
- **备选方案**: 如果内嵌编辑器无法满足需求，提供"打开编辑器"按钮
  - 点击后使用 `vscode.window.showTextDocument()` 打开临时文档
  - 用户编辑完成后，将内容同步回表单

**Rationale**: 
- textarea 足够满足基本的编辑需求，轻量级且无需额外依赖
- 预览功能可以复用现有的 Markdown 渲染逻辑
- 备选方案确保在无法实现内嵌编辑器时仍能提供编辑功能

**Alternatives Considered**:
- Monaco Editor：体积较大，对于简单的文本编辑不必要
- 仅弹出编辑器：用户体验不如内嵌编辑器流畅

---

### 8. 内容格式转换

**Question**: 本地存储的记录是 JSON 格式，如何转换为用户选择的内容格式（markdown, text, json, html）？

**Findings**:
- **JSON 格式**: 本地存储的记录是 JSON 格式，包含完整的对话数据
- **Markdown 格式**: 需要将对话消息转换为 Markdown 格式（可以参考 002-session-markdown-view 的实现）
- **Text 格式**: 提取纯文本内容，去除格式
- **HTML 格式**: 转换为 HTML 格式（需要实现 HTML 渲染逻辑）

**Decision**:
- 实现内容格式转换功能
- 支持以下格式：
  - **json**: 直接使用 JSON 字符串（无需转换）
  - **markdown**: 使用现有的 Markdown 渲染逻辑（复用 002-session-markdown-view 的 `MarkdownRenderer`）
  - **text**: 提取纯文本，去除格式标记
  - **html**: 转换为 HTML 格式（基本实现，使用简单的 HTML 标签）
- 默认格式为 'markdown'，用户可以在表单中选择

**Rationale**: 
- 复用现有的 Markdown 渲染逻辑，减少重复实现
- 支持多种格式满足不同用户需求
- JSON 格式无需转换，直接使用

**Alternatives Considered**:
- 仅支持 JSON 格式：限制用户选择，不符合需求
- 仅支持 Markdown 格式：不符合 API 要求（支持多种格式）

---

### 9. 上传进度显示

**Question**: 如何显示上传进度？是否需要显示详细的上传进度？

**Findings**:
- VS Code 提供 `vscode.window.withProgress()` API 显示进度
- 可以显示不确定进度（旋转图标）或确定进度（进度条）
- 对于文件上传，可以显示上传进度百分比

**Decision**:
- 使用 `vscode.window.withProgress()` 显示上传进度
- 显示不确定进度（旋转图标），因为 fetch API 不直接支持上传进度
- 显示状态消息："正在上传记录..."
- 上传完成后显示成功或失败消息

**Rationale**: 
- 进度显示让用户知道系统正在工作
- 不确定进度足够满足需求（上传通常很快）
- 如果需要详细进度，可以后续实现

**Alternatives Considered**:
- 不显示进度：用户体验差，用户不知道系统是否在工作
- 详细进度条：需要额外实现，当前不需要

---

## Open Questions / Future Research

1. **批量上传功能**
   - 未来是否需要支持批量上传多条记录？
   - 如何实现批量上传的 UI 和进度显示？

2. **上传历史记录**
   - 是否需要记录上传历史（哪些记录已上传）？
   - 如何避免重复上传？

3. **内容大小优化**
   - 如果内容超过 10MB，是否需要提供压缩或分块上传选项？

4. **脱敏处理**
   - 未来是否需要在上传前进行数据脱敏？
   - 如何实现脱敏逻辑？

## Summary

所有研究问题已解决，关键技术决策：

1. **触发方式**: 在 `SessionListPanel` 的点击事件中集成上传功能，用户点击会话项时触发上传表单
2. **数据源**: 使用 `DatabaseAccess` 从数据库读取会话数据，通过 composerId 获取完整的会话内容
3. **UI 方案**: 使用 Webview 创建上传表单，提供完整的表单验证和内容编辑功能
4. **内容编辑器**: 在 Webview 表单内使用 `<textarea>` 提供内容编辑器，支持预览功能（备选：弹出编辑器）
5. **HTTP 客户端**: 使用 Node.js 内置 `fetch` API，无需额外依赖
6. **Token 存储**: 使用 `globalState` 存储 JWT Token，全局配置
7. **错误处理**: 实现统一的错误处理机制，根据错误类型提供自动重试或手动重试
8. **表单验证**: 实现客户端验证，快速反馈，同时处理服务端验证错误
9. **内容格式转换**: 支持 json、markdown、text、html 格式，从数据库读取的会话数据转换为目标格式
10. **进度显示**: 使用 `vscode.window.withProgress()` 显示上传进度

所有 "NEEDS CLARIFICATION" 项目已解决，可以进入 Phase 1 设计阶段。

