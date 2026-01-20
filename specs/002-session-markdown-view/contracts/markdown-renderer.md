# Contract: Markdown Renderer

**Date**: 2025-12-11  
**Feature**: 会话 Markdown 视图

## Overview

Markdown 渲染器负责将会话数据（AgentRecord）转换为 Markdown 格式的字符串，用于在编辑器中显示。

## Interface

### IMarkdownRenderer

```typescript
/**
 * Markdown 渲染器接口
 */
interface IMarkdownRenderer {
    /**
     * 渲染会话为 Markdown
     * @param agentRecord Agent 对话记录（包含完整的会话数据）
     * @param options 渲染选项（可选）
     * @returns 渲染后的 Markdown 字符串
     */
    renderSession(agentRecord: AgentRecord, options?: MarkdownRendererOptions): Promise<string>;

    /**
     * 渲染单个气泡为 Markdown
     * @param bubble 气泡数据
     * @param options 渲染选项（可选）
     * @returns 渲染后的 Markdown 字符串片段
     */
    renderBubble(bubble: any, options?: MarkdownRendererOptions): string;

    /**
     * 转义 Markdown 特殊字符
     * @param text 原始文本
     * @returns 转义后的文本
     */
    escapeMarkdown(text: string): string;
}
```

### MarkdownRendererOptions

```typescript
/**
 * Markdown 渲染选项
 */
interface MarkdownRendererOptions {
    includeTimestamps?: boolean;       // 是否包含时间戳（默认: true）
    includeCodeBlocks?: boolean;       // 是否包含代码块（默认: true）
    toolUsePlaceholder?: string;       // 工具使用占位符格式（默认: "[Tool Use: {name}]"）
    userMessageHeader?: string;        // 用户消息标题（默认: "## User"）
    assistantMessageHeader?: string;    // Assistant 消息标题（默认: "## Assistant"）
}
```

## Implementation Requirements

### FR-006: Markdown 渲染

- **FR-006**: 系统 MUST 将用户消息和 Agent 消息渲染为 Markdown 格式，清晰区分消息类型
- **FR-006.1**: 用户消息 MUST 使用 `## User` 标题（或自定义标题）
- **FR-006.2**: Agent 消息 MUST 使用 `## Assistant` 标题（或自定义标题）
- **FR-006.3**: 消息之间 MUST 使用空行分隔（至少一个空行）

### FR-007: Agent 消息文本渲染

- **FR-007**: 系统 MUST 在 Agent 消息的 `text` 属性存在时，将其内容包含在 Markdown 中
- **FR-007.1**: 如果 `text` 包含代码块，MUST 使用 Markdown 代码块格式（三个反引号）
- **FR-007.2**: 如果 `text` 包含特殊字符，MUST 进行转义（代码块内容除外）

### FR-008: 工具使用提示

- **FR-008**: 系统 MUST 在 Agent 消息存在 `capabilities`、`toolCallResults` 或 `toolFormerData` 时，渲染详细的工具使用信息
- **FR-008.1**: 工具使用渲染 MUST 独立于 `text` 内容，即使 `text` 存在也要渲染工具信息
- **FR-008.2**: 工具名称从 `toolFormerData.name`、`capabilities` 或 `toolCallResults` 中提取
- **FR-008.3**: 如果存在多个工具，MUST 为每个工具生成独立的渲染块
- **FR-008.4**: 工具渲染格式根据工具类型使用相应的专用渲染方法（详见工具渲染策略表）

### FR-005: 消息排序

- **FR-005**: 系统 MUST 将所有加载的消息按时间顺序排列
- **FR-005.1**: 消息按 `createdAt` 或 `timestamp` 字段升序排列
- **FR-005.2**: 如果时间戳不存在，MUST 保持原始顺序

## Markdown 格式规范

### 用户消息格式

```markdown
<div class="user-message">

{messageText}

</div>

*[{timestamp}]*  <!-- 如果 includeTimestamps 为 true -->
```

**说明**：
- 使用 HTML `<div>` 标签包裹用户消息，避免与 Markdown 引用语法（`>`）冲突
- 前端可以通过 CSS 类 `.user-message` 进行样式化
- `<div>` 标签前后需要空行，确保内部的 Markdown 内容能正确渲染

### Agent 消息格式（有文本）

```markdown
## Assistant

{messageText}

*[{timestamp}]*  <!-- 如果 includeTimestamps 为 true -->
```

### Agent 消息格式（无文本，有工具使用）

```markdown
## Assistant

[Tool Use: {name} - {status}]

*[{timestamp}]*  <!-- 如果 includeTimestamps 为 true -->
```

**说明**：
- `{name}` 从 `toolFormerData.name` 或 `toolCallResults[].name` 提取
- `{status}` 从 `toolFormerData.status` 提取（如果存在）
- 如果 `status` 不存在，格式为 `[Tool Use: {name}]`

### Agent 消息格式（只有思考，无输出）

```markdown
## Assistant

*💭 思考 5.2 秒*
```

**说明**：
- 适用于只包含 `thinking` 字段的气泡（云端思考）
- 从 `thinkingDurationMs` 提取思考时间（毫秒）
- 转换为秒并保留1位小数
- 使用斜体和思考emoji (💭) 标识

### 代码块格式

```markdown
```{language}
{code}
```
```

## Error Handling

- **数据格式错误**: 如果气泡数据格式不正确，MUST 跳过该气泡并记录警告日志
- **渲染失败**: 如果渲染过程中发生错误，MUST 返回部分渲染的内容（已成功渲染的部分），并记录错误日志
- **空会话**: 如果会话没有消息，MUST 返回空字符串或提示信息

## Performance Requirements

- **SC-003**: 对于包含 100 条消息的会话，Markdown 生成时间不超过 3 秒
- 渲染过程 MUST 使用数组收集片段，最后 join，避免重复字符串拼接
- 特殊字符转义 MUST 高效，避免不必要的操作

## Dependencies

- `AgentRecord` (from 001-cursor-assistant data model)
- `BubbleData` (from database)

## Example Usage

```typescript
const renderer = new MarkdownRenderer();
const agentRecord = await databaseAccess.getAgentRecords(sessionId);
const markdown = await renderer.renderSession(agentRecord[0], {
    includeTimestamps: true,
    includeCodeBlocks: true
});
```

## 附加说明

### 工具名称匹配策略 (T068)

**匹配规则**：
- 使用**精确匹配**（不区分大小写）
- 不使用部分匹配或模糊匹配
- 每个工具的所有可能名称变体都必须明确列出

**优势**：
- 避免误匹配（如`glob_file_search`被误认为`codebase_search`）
- 提高代码可维护性和可预测性
- 降低工具匹配顺序的重要性

**实现**：
```typescript
private matchesToolName(toolName: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
        const lowerPattern = pattern.toLowerCase();
        if (toolName === lowerPattern) {
            return true;
        }
    }
    return false;
}
```

### 📊 Agent 工具与 Markdown 渲染策略分析

| Tool Name | 类型判断依据 (原始 JSON 中的 `name`) | 核心功能 | 渲染策略（如何提取有效数据形成摘要或 Markdown）|
| :--- | :--- | :--- | :--- |
| **I. 代码修改与编辑工具 (`write` / `edit`)** | | | |
| **`edit_file`**, **`MultiEdit`**, **`write`**, **`search_replace`** | `"edit_file"`, `"MultiEdit"`, `"search_replace"`, `"write"` | 在单个或多个文件中进行编辑和修改。| 1. 提取 `toolFormerData.params` 中的 `relativeWorkspacePath`。2. 提取 `toolFormerData.additionalData.instructions`。3. 提取 `toolFormerData.result.diff.chunks` 数组。4. **渲染为 `<details>` 块：** 包含文件路径、操作指令，并遍历 `chunks`，将 `diffString` 渲染为 **Git `diff` 代码块**。|
| **`apply_patch`** | `"apply_patch"` | 应用一个标准的 Git-style 补丁字符串。| 1. 提取 `toolFormerData.rawArgs.patch` 字符串。2. **渲染为 `<details>` 块：** 包含目标文件路径，并将 `patch` 字符串渲染为 **`diff` 代码块**。 |
| **`copilot_applyPatch`**, **`copilot_insertEdit`** | `"copilot_applyPatch"`, `"copilot_insertEdit"` | 应用 Copilot 提供的代码插入或补丁。| 1. 提取 `toolFormerData.result.textEditContent` 或 `content`。2. **渲染为 `<details>` 块：** 包含操作摘要 (`invocationMessage`)。3. 如果存在 `textEditContent`，将其渲染为带有语言标识符的**代码块**。|
| **`delete_file`** | `"delete_file"` | 请求删除指定文件。| 提取 `toolFormerData.rawArgs.explanation`。**渲染为 `<details>` 块：** 显示删除文件的路径和解释。|
| **II. 代码和知识检索工具 (`search` / `read`)** | | | |
| **`codebase_search`** | `"codebase_search"` | 在代码库中进行语义搜索。| 1. 提取 `rawArgs.query` 和 `rawArgs.target_directories`。2. 提取 `result.codeResults[]`，每项包含 `codeBlock.relativeWorkspacePath` 和 `range`。3. **渲染为 `<details>` 块：** Summary显示查询和结果数。Details中使用表格展示文件路径和行号范围，按相关性排序。|
| **`grep`**, **`ripgrep`** | `"grep"`, `"ripgrep"` | 在代码库中进行文本搜索。| 1. 提取 `params.pattern` 和 `params.path`。2. 提取 `result.success.workspaceResults`，每个workspace包含文件列表和匹配项。3. **渲染为 `<details>` 块：** Summary显示模式和匹配数。Details中使用表格展示文件、匹配内容和行号。区分匹配行（高亮）和上下文行。|
| **`glob_file_search`** | `"glob_file_search"` | 使用 glob 模式搜索文件。| 1. 提取 `rawArgs.glob_pattern` 和 `target_directory`。2. 提取 `result.directories[]`，每个目录包含 `files[]` 列表。3. **渲染为 `<details>` 块：** Summary显示模式和结果统计。Details中按目录分组展示文件列表。|
| **`web_search`** | `"web_search"` | 在网络上搜索相关信息。| 1. 提取 `rawArgs.search_term`。2. 提取 `result.references[]`，每条包含 `title`, `url`（可选）, `chunk`/`snippet`。3. **渲染为 `<details>` 块：** Summary 显示搜索词和结果数。Details 中按编号列表展示每条结果，包含标题（链接）和内容摘要。对于长内容，保留完整格式而非截断。|
| **`fetch_pull_request`** | `"fetch_pull_request"` | 获取 PR 或 Commit 的详细信息。| 提取 `result` 中的 `title`, `body`, `diff` 等字段。**渲染为结构化文本：** 各字段以 **粗体标题** 展示，`diff` 部分渲染为 **`diff` 代码块**。|
| **`read_file`**, **`copilot_readFile`** | `"read_file"`, `"read_file_v2"`, `"copilot_readFile"` | 读取指定文件的内容。| 1. 提取 `toolFormerData.rawArgs.file_path` 或 `params.relativeWorkspacePath`。2. **渲染为 `<details>` 块：** 包含文件路径和操作摘要。将 `result.content` 渲染为代码块。|
| **`list_dir`** | `"list_dir"` | 列出指定目录下的文件和文件夹。| 1. 提取 `rawArgs.relative_workspace_path`。2. 提取 `result` 中的 `files` 列表。3. **渲染为 `<details>` 块：** 包含搜索目录。将 `files` 渲染为 Markdown **表格**，显示文件/文件夹名称和类型。|
| **III. Agent 任务和流程控制工具 (`task` / `generic`)** | | | |
| **`todo_write`**, **`manage_todo_list`** | `"todo_write"`, `"manage_todo_list"` | 管理、创建或修改待办事项列表。| 1. 提取 `result` 中的 `finalTodos` 或 `params` 中的 `todoList`。2. **渲染为 `<details>` 块：** 将 Todos 渲染为标准 Markdown 任务列表（带 `- ` 前缀）。**状态映射：** `pending` → `- [ ]`，`completed`/`done` → `- [x]`，`in_progress`/`in-progress` → `- [ ] 🔄`，`cancelled` → `- [x] ~~内容~~`。|
| **`run_terminal_cmd`**, **`run_terminal_command`** | `"run_terminal_cmd"`, `"run_terminal_command"`, `"run_terminal_command_v2"` | 执行终端命令。| 1. 提取 `rawArgs` 中的 `command` 和 `result` 中的 `output`。2. **渲染为 `<details>` 块：** 包含命令的 **`bash` 代码块**和命令输出的 **`output` 代码块**。|
| **`read_lints`** | `"read_lints"` | 读取指定路径的 linter 错误。| 1. 提取 `rawArgs.paths` 或 `params.paths`。2. 解析 `result` 中的 linter 错误信息。3. **渲染为 `<details>` 块：** Summary 显示检查路径和状态。Details 显示错误详情（如果有）或成功消息。|
| **`mcp_` (Multi-Call)** | 任何以 `"mcp_"` 开头的 `name` | 协调多个底层工具调用。| **渲染为 `<details>` 块：** 使用 **嵌套列表** 详细列出调用的每个子工具、参数和返回的简化结果。|
| **默认 / 未知工具** | **任何未匹配的 `name`** | 未明确适配的工具（Fallback）。| **渲染为通用的 JSON 代码块：** 直接将 `params`、`rawArgs`、`result` 和 `error` 的原始 JSON 内容输出到 Markdown 代码块中。|

---

## 详细渲染策略

### T027: Todo List 工具渲染详细规范

**工具识别**：
- 工具名称匹配：`todo_write`, `manage_todo_list`（不区分大小写，精确匹配）
- 数据来源：`toolFormerData.result.finalTodos` 或 `toolFormerData.params.todoList` 或 `toolFormerData.result.todos`

**状态类型与复选框映射**：

| 状态值 | 复选框样式 | 附加格式 | 说明 |
|:---|:---|:---|:---|
| `pending` | `- [ ]` | 无 | 待处理的任务 |
| `in_progress`, `in-progress` | `- [ ]` | 添加 🔄 emoji | 正在进行的任务（需要视觉高亮） |
| `completed`, `done` | `- [x]` | 无 | 已完成的任务 |
| `cancelled`, `canceled` | `- [x]` | 内容添加删除线 `~~content~~` | 已取消的任务 |

**渲染示例**：

输入数据：
```json
{
  "finalTodos": [
    {"id": "1", "content": "填写技术上下文和总结", "status": "in_progress"},
    {"id": "2", "content": "检查 Constitution", "status": "pending"},
    {"id": "3", "content": "生成 research.md", "status": "completed"},
    {"id": "4", "content": "废弃的任务", "status": "cancelled"}
  ]
}
```

输出 Markdown：
```markdown
<details>
<summary>✅ Todo Write Todo List</summary>

- [ ] 🔄 填写技术上下文和总结
- [ ] 检查 Constitution
- [x] 生成 research.md
- [x] ~~废弃的任务~~

</details>
```

**实现要点**：
1. **必须使用 `- ` 前缀**：确保任务列表符合 Markdown 标准格式，在 VS Code 中可以渲染为可交互的复选框
2. **空行分隔**：`<summary>` 后和列表项之间保持适当空行，确保 Markdown 渲染正确
3. **状态优先级**：按 `todo.status || todo.state || 'pending'` 提取状态字段
4. **内容提取**：按 `todo.content || todo.text || todo.task || 'Untitled'` 提取任务内容
5. **emoji 放置**：`in_progress` 状态的 emoji 应放在内容之前，不要放在复选框内
6. **删除线格式**：cancelled 状态使用标准 Markdown 删除线语法 `~~text~~`

---

### T001-T004: 文件编辑工具渲染详细规范

**适用工具**：`edit_file`, `MultiEdit`, `write`, `search_replace`

**工具识别**：
- 工具名称匹配：`edit_file`, `MultiEdit`, `write`, `search_replace`（不区分大小写）
- 数据来源：
  - 文件路径：`toolFormerData.rawArgs.file_path` 或 `params.relativeWorkspacePath`
  - Diff 数据：`toolFormerData.result.diff.chunks[]`

**Chunk 信息提取**：

每个 chunk 包含以下字段：
- `diffString`: Git diff 格式的变更内容
- `oldStart`: 原文件起始行号
- `newStart`: 新文件起始行号
- `oldLines`: 原文件行数
- `newLines`: 新文件行数
- `linesRemoved`: 删除的行数
- `linesAdded`: 添加的行数

**渲染策略**：

1. **Summary 标题格式**：
   - 单个 chunk：`📝 Edit file: {fileName} - Lines added: {linesAdded}, removed: {linesRemoved}`
   - 多个 chunk：`📝 Edit file: {fileName} - {totalChunks} chunks`

2. **Details 内容结构**：
   ```markdown
   **文件**: `{file_path}`
   
   #### Chunk 1 - Lines added: {linesAdded}, removed: {linesRemoved}
   
   ```diff
   {diffString}
   ```
   
   #### Chunk 2 - Lines added: {linesAdded}, removed: {linesRemoved}
   
   ```diff
   {diffString}
   ```
   ```

3. **Diff 代码块格式**：
   - 使用 ` ```diff ` 语法高亮
   - 保留原始 diffString 内容（包括 `+`、`-`、空格前缀）
   - 不需要添加 `@@` 头部（diffString 中已包含上下文）

**渲染示例**：

输入数据：
```json
{
  "name": "search_replace",
  "rawArgs": {
    "file_path": "specs/001-p1sc-controller/spec.md",
    "old_string": "系统必须维护设备状态信息（每个设备的开/关状态）",
    "new_string": "系统必须维护设备状态信息（风扇设备包含开/关状态和速度百分比 0-100%，照明灯包含开/关状态）"
  },
  "result": {
    "diff": {
      "chunks": [{
        "diffString": "  - **FR-009**: 系统必须接受来自 Home Assistant 的控制命令...\n  - **FR-010**: 系统必须在值发生变化时自动将传感器读数发布...\n- - **FR-011**: 系统必须维护设备状态信息（每个设备的开/关状态）\n+ - **FR-011**: 系统必须维护设备状态信息（风扇设备包含开/关状态和速度百分比 0-100%，照明灯包含开/关状态）\n  - **FR-012**: 系统必须优雅地处理传感器读取失败...",
        "oldStart": 87,
        "newStart": 87,
        "oldLines": 5,
        "newLines": 5,
        "linesRemoved": 1,
        "linesAdded": 1
      }]
    }
  }
}
```

输出 Markdown：
```markdown
<details>
<summary>📝 Edit file: spec.md - Lines added: 1, removed: 1</summary>

**文件**: `specs/001-p1sc-controller/spec.md`

#### Chunk 1 - Lines added: 1, removed: 1

```diff
  - **FR-009**: 系统必须接受来自 Home Assistant 的控制命令...
  - **FR-010**: 系统必须在值发生变化时自动将传感器读数发布...
- - **FR-011**: 系统必须维护设备状态信息（每个设备的开/关状态）
+ - **FR-011**: 系统必须维护设备状态信息（风扇设备包含开/关状态和速度百分比 0-100%，照明灯包含开/关状态）
  - **FR-012**: 系统必须优雅地处理传感器读取失败...
```

</details>
```

**实现要点**：
1. **文件名提取**：从完整路径中提取文件名（不含路径）用于 summary
2. **统计信息**：优先使用 `linesAdded`/`linesRemoved`，如果不存在则计算 diffString 中的 `+`/`-` 行数
3. **Chunk 标题**：每个 chunk 使用 `####` 四级标题，清晰分隔多个变更块
4. **空行控制**：summary 后、文件路径后、chunk 标题后都需要空行，确保 Markdown 正确渲染
5. **Diff 完整性**：保留 diffString 的原始格式，包括前导空格（上下文行）
6. **工具名称显示**：summary 中使用友好的显示名称（如 "Edit file"），不直接暴露工具内部名称

---

### T023: Web Search 工具渲染详细规范

**工具识别**：
- 工具名称匹配：`web_search`, `web`（不区分大小写）
- 数据来源：
  - 搜索词：`toolFormerData.rawArgs.search_term` 或 `params.searchTerm`
  - 结果列表：`toolFormerData.result.references[]`

**Reference 数据结构**：

每条搜索结果包含以下字段（部分可选）：
- `title`: 结果标题
- `url`: 结果 URL（可选）
- `chunk` 或 `snippet` 或 `text` 或 `content`: 内容摘要

**渲染策略**：

1. **Summary 标题格式**：
   - `🔍 Searched web: {searchTerm} • {count} result(s)`
   - 使用 bullet 符号 `•` 分隔搜索词和结果数

2. **Details 内容结构**：
   - 使用编号列表（不是表格），每条结果占多行
   - 保留内容的格式（换行、列表、加粗等）
   - 如果有 URL，标题渲染为链接

3. **单条结果格式**：
   ```markdown
   ### {index}. {title}
   
   {url ? `**URL**: ${url}` : ''}
   
   {chunk_content}
   ```

**渲染示例**：

输入数据：
```json
{
  "name": "web_search",
  "rawArgs": {
    "search_term": "ESPHome ESPBox-S3-3 board platform configuration"
  },
  "result": {
    "references": [{
      "title": "Web Search Results",
      "chunk": "好的，您已准备开始实现基于 ESPBox-S3-3+ 的 P1SC 控制器，并计划使用 ESPHome 进行开发。以下是实现步骤的概述：\n\n1. **安装 ESPHome：**\n   - 在 Home Assistant 中，导航至"设置" > "加载项" > "加载项商店"，搜索并安装 ESPHome。\n   - 安装完成后，启动 ESPHome，并确保启用"在启动时启动"和"显示在侧边栏"选项。\n\n2. **配置 ESPBox-S3-3+：**\n   - 在 ESPHome 中，点击"添加设备"，输入设备名称（例如 `p1sc_controller`），选择设备类型为 `ESP32-S3-BOX`。"
    }]
  }
}
```

输出 Markdown：
```markdown
<details>
<summary>🔍 Searched web: ESPHome ESPBox-S3-3 board platform configuration • 1 result(s)</summary>

### 1. Web Search Results

好的，您已准备开始实现基于 ESPBox-S3-3+ 的 P1SC 控制器，并计划使用 ESPHome 进行开发。以下是实现步骤的概述：

1. **安装 ESPHome：**
   - 在 Home Assistant 中，导航至"设置" > "加载项" > "加载项商店"，搜索并安装 ESPHome。
   - 安装完成后，启动 ESPHome，并确保启用"在启动时启动"和"显示在侧边栏"选项。

2. **配置 ESPBox-S3-3+：**
   - 在 ESPHome 中，点击"添加设备"，输入设备名称（例如 `p1sc_controller`），选择设备类型为 `ESP32-S3-BOX`。

</details>
```

**实现要点**：
1. **不截断内容**：保留 chunk 的完整内容，不要截断到 150 字符（与表格格式不同）
2. **保留格式**：chunk 内容可能包含 Markdown 格式（列表、加粗等），需要原样保留
3. **换行处理**：chunk 中的 `\n` 需要正确转换为实际换行
4. **URL 可选**：某些搜索结果可能没有 URL，只有内容摘要
5. **标题层级**：使用 `###` 三级标题作为每条结果的标题
6. **字段优先级**：按 `ref.chunk || ref.snippet || ref.text || ref.content` 提取内容
7. **空行分隔**：结果之间用空行分隔，提高可读性

---

### T021: Codebase Search 工具渲染详细规范

**工具识别**：
- 工具名称匹配：`codebase_search`, `codebase`, `search`（不区分大小写）
- 数据来源：
  - 搜索查询：`toolFormerData.params.query` 或 `rawArgs.query`
  - 搜索范围：`toolFormerData.params.repositoryInfo.relativeWorkspacePath` 或 `rawArgs.target_directories`
  - 结果列表：`toolFormerData.result.codeResults[]` 或 `params.codeResults[]`

**数据结构**：

#### Params 结构（包含搜索参数和可能的结果）

```typescript
{
  query: string,                    // 搜索查询
  codeResults: Array<{              // 搜索结果（可能在params中）
    codeBlock: {
      relativeWorkspacePath: string,
      range: {
        startPosition: {line: number, column: number},
        endPosition: {line: number, column: number}
      },
      signatures: {}
    },
    score: number                   // 相关性评分（0-1）
  }>,
  repositoryInfo: {                 // 仓库信息
    relativeWorkspacePath: string,  // 搜索范围
    repoName: string,
    repoOwner: string,
    orthogonalTransformSeed: number,
    preferredEmbeddingModel: string
  }
}
```

#### Result 结构（包含详细的代码内容）

```typescript
{
  codeResults: Array<{
    codeBlock: {
      relativeWorkspacePath: string,
      range: {
        startPosition: {line: number, column: number},
        endPosition: {line: number, column: number}
      },
      contents: string,             // 完整代码内容
      originalContents: string,     // 原始代码内容
      detailedLines: Array<{        // 逐行详细信息
        lineNumber: number,
        text: string
      }>
    },
    score: number
  }>
}
```

**渲染策略**：

1. **Summary 标题格式**：
   - `🔍 Searched codebase: "{query}" • {count} result(s)`
   - 如果有搜索范围（且不是`.`），添加：`in {directory}`

2. **Details 内容结构**：
   - 如果有评分信息：使用三列表格 **File** | **Lines** | **Score**
   - 如果无评分信息：使用两列表格 **File** | **Lines**
   - 按相关性评分排序（分数高的在前）
   - 文件路径使用代码格式 `` `path` ``
   - 行号格式：
     - 单行：`L{line}`
     - 行范围：`L{start}-{end}`
   - 评分格式：保留4位小数（如`0.2646`）

3. **表格格式**（有评分）：
   ```markdown
   | File | Lines | Score |
   |:-----|------:|------:|
   | `config.py` | L1-49 | 0.2646 |
   | `main.py` | L1-34 | 0.2163 |
   ```

4. **表格格式**（无评分）：
   ```markdown
   | File | Lines |
   |:-----|------:|
   | `specs/001-p1sc-controller/spec.md` | L30 |
   | `specs/001-p1sc-controller/spec.md` | L28-61 |
   ```

**渲染示例**：

#### 示例 1: 有评分信息（真实格式）

输入数据：
```json
{
  "name": "codebase_search",
  "params": {
    "query": "API__CONFIG definition or usage",
    "codeResults": [
      {
        "codeBlock": {
          "relativeWorkspacePath": "config.py",
          "range": {
            "startPosition": {"line": 1, "column": 1},
            "endPosition": {"line": 49, "column": 2}
          },
          "signatures": {}
        },
        "score": 0.2646484375
      },
      {
        "codeBlock": {
          "relativeWorkspacePath": "main.py",
          "range": {
            "startPosition": {"line": 1, "column": 1},
            "endPosition": {"line": 34, "column": 25}
          },
          "signatures": {}
        },
        "score": 0.21630859375
      }
    ],
    "repositoryInfo": {
      "relativeWorkspacePath": ".",
      "repoName": "9a44ab1e-b2cb-4bcc-a975-9a6caf7f01cd",
      "repoOwner": "google-oauth2|user_01J7N4GCA551ZT96MS18J572PT"
    }
  },
  "result": {
    "codeResults": [
      {
        "codeBlock": {
          "relativeWorkspacePath": "config.py",
          "range": {
            "startPosition": {"line": 1, "column": 1},
            "endPosition": {"line": 49, "column": 2}
          },
          "contents": "QWEN3_14B_CONF = {...}\n\nAPI_CONFIG = {...}",
          "originalContents": "..."
        },
        "score": 0.2646484375
      }
    ]
  }
}
```

输出 Markdown：
```markdown
<details>
<summary>🔍 Searched codebase: "API__CONFIG definition or usage" • 2 result(s)</summary>

| File | Lines | Score |
|:-----|------:|------:|
| `config.py` | L1-49 | 0.2646 |
| `main.py` | L1-34 | 0.2163 |

</details>
```

#### 示例 2: 无评分信息

输入数据：
```json
{
  "name": "codebase_search",
  "rawArgs": {
    "query": "What are the functional requirements?",
    "target_directories": ["specs/001-p1sc-controller"]
  },
  "result": {
    "codeResults": [
      {
        "codeBlock": {
          "relativeWorkspacePath": "specs/001-p1sc-controller/spec.md",
          "range": {
            "startPosition": {"line": 1},
            "endPosition": {"line": 30}
          }
        }
      }
    ]
  }
}
```

输出 Markdown：
```markdown
<details>
<summary>🔍 Searched codebase: "What are the functional requirements?" • 1 result(s) in specs/001-p1sc-controller</summary>

| File | Lines |
|:-----|------:|
| `specs/001-p1sc-controller/spec.md` | L1-30 |

</details>
```

**实现要点**：
1. **数据源优先级**：
   - 优先使用 `result.codeResults`（包含详细内容）
   - 回退到 `params.codeResults`（基本信息）
2. **行号格式化**：根据 `startPosition.line === endPosition.line` 判断单行还是范围
3. **路径规范化**：使用 `/` 而非 `\`，确保跨平台一致性
4. **表格列数动态调整**：
   - 检查是否有评分信息（`codeResults.some(r => r.score !== undefined)`）
   - 有评分：三列表格（File | Lines | Score）
   - 无评分：两列表格（File | Lines）
5. **表格对齐**：文件路径左对齐，行号和评分右对齐
6. **评分格式化**：保留4位小数（`score.toFixed(4)`）
7. **分数排序**：按 `score` 降序排列（如果存在）
8. **搜索范围显示**：
   - 优先从 `params.repositoryInfo.relativeWorkspacePath` 提取
   - 回退到 `rawArgs.target_directories` 或 `params.includePattern`
   - 如果是 `.`（当前目录），不显示范围
9. **空结果处理**：如果 `codeResults` 为空，显示 "*无搜索结果*"
10. **字段容错**：支持多种可能的字段名（`file`/`path`/`filePath`，`lineRange`/`startLine`-`endLine`等）

---

### T022: Grep 工具渲染详细规范

**工具识别**：
- 工具名称匹配：`grep`, `ripgrep`（不区分大小写）
- 数据来源：
  - 搜索模式：`toolFormerData.params.pattern` 或 `rawArgs.pattern`
  - 搜索路径：`toolFormerData.params.path` 或 `rawArgs.path`
  - 输出模式：`toolFormerData.params.outputMode` (content/files_with_matches/count)
  - 结果数据：`toolFormerData.result.success.workspaceResults`

**WorkspaceResults 数据结构（按 outputMode 分类）**：

#### 1. content 模式（默认）

```json
{
  "success": {
    "workspaceResults": {
      "workspace_path": {
        "content": {
          "matches": [{
            "file": "src/ui/markdownRenderer.ts",
            "matches": [{
              "lineNumber": 733,
              "content": "* 渲染代码库搜索工具（codebase_search）",
              "isContextLine": false
            }]
          }],
          "totalLines": 87,
          "totalMatchedLines": 6
        }
      }
    }
  }
}
```

#### 2. files_with_matches 模式

```json
{
  "success": {
    "workspaceResults": {
      "f:/spec-kit/spec-share-server": {
        "files": {
          "files": [".\\start.ps1", ".\\start_custom_port.bat", ".\\start.bat"],
          "totalFiles": 5
        }
      }
    }
  }
}
```

#### 3. count 模式

```json
{
  "success": {
    "workspaceResults": {
      "f:/spec-kit/cursor-helper": {
        "count": {
          "counts": [{
            "file": "specs/001-cursor-assistant/tasks.md",
            "count": 63
          }],
          "totalFiles": 1,
          "totalMatches": 63
        }
      }
    }
  }
}
```

**渲染策略**：

1. **Summary 标题格式**（根据 outputMode 不同）：
   - **content 模式**: `🔍 Grep for "{pattern}" • {totalMatchedLines} match(es) in {totalLines} lines`
   - **files_with_matches 模式**: `🔍 Grep for "{pattern}" • {fileCount} file(s) matched`
   - **count 模式**: `🔍 Grep for "{pattern}" • {totalMatches} match(es) in {fileCount} file(s)`

2. **Details 内容结构**：

   **content 模式**：
   - 使用三列表格：**File** | **Content** | **Line**
   - 文件路径使用代码格式
   - 内容列截断到80字符
   - 行号格式：`L{number}`

   **files_with_matches 模式**：
   - 使用项目列表显示文件路径
   - 格式：`- \`{file_path}\``

   **count 模式**：
   - 使用两列表格：**File** | **Matches**
   - 显示每个文件的匹配数量

**渲染示例**：

#### 示例 1: content 模式

输入数据：
```json
{
  "name": "grep",
  "params": {
    "pattern": "_find_entity_by_name",
    "path": "intelligent_query_system.py",
    "outputMode": "content"
  },
  "result": {
    "success": {
      "workspaceResults": {
        "f:/cursor-ws/owl-test": {
          "content": {
            "matches": [{
              "file": "intelligent_query_system.py",
              "matches": [
                {"lineNumber": 259, "content": "        entity_uri = self._find_entity_by_name(entity_name)"},
                {"lineNumber": 304, "content": "    def _find_entity_by_name(self, name: str) -> Optional[URIRef]:"}
              ]
            }],
            "totalLines": 5,
            "totalMatchedLines": 5
          }
        }
      }
    }
  }
}
```

输出 Markdown：
```markdown
<details>
<summary>🔍 Grep for "_find_entity_by_name" • 5 match(es) in 5 lines</summary>

| File | Content | Line |
|:-----|:--------|-----:|
| `intelligent_query_system.py` | `entity_uri = self._find_entity_by_name(entity_name)` | L259 |
| `intelligent_query_system.py` | `def _find_entity_by_name(self, name: str) -> Optional[URIRef]:` | L304 |

</details>
```

#### 示例 2: files_with_matches 模式

输入数据：
```json
{
  "name": "grep",
  "params": {
    "pattern": "python|Python|PYTHON",
    "path": "spec-share-server",
    "outputMode": "files_with_matches",
    "caseInsensitive": true,
    "headLimit": 5
  },
  "result": {
    "success": {
      "workspaceResults": {
        "f:/spec-kit/spec-share-server": {
          "files": {
            "files": [".\\start.ps1", ".\\start_custom_port.bat", ".\\start.bat", ".\\README.md", ".\\migrate.bat"],
            "totalFiles": 5
          }
        }
      }
    }
  }
}
```

输出 Markdown：
```markdown
<details>
<summary>🔍 Grep for "python|Python|PYTHON" • 5 file(s) matched</summary>

**Matched files** (5):

- `./start.ps1`
- `./start_custom_port.bat`
- `./start.bat`
- `./README.md`
- `./migrate.bat`

</details>
```

#### 示例 3: count 模式

输入数据：
```json
{
  "name": "grep",
  "params": {
    "pattern": "^- \\[",
    "path": "specs/001-cursor-assistant/tasks.md",
    "outputMode": "count"
  },
  "result": {
    "success": {
      "workspaceResults": {
        "f:/spec-kit/cursor-helper": {
          "count": {
            "counts": [{
              "file": "specs/001-cursor-assistant/tasks.md",
              "count": 63
            }],
            "totalFiles": 1,
            "totalMatches": 63
          }
        }
      }
    }
  }
}
```

输出 Markdown：
```markdown
<details>
<summary>🔍 Grep for "^- \[" • 63 match(es) in 1 file(s)</summary>

| File | Matches |
|:-----|--------:|
| `specs/001-cursor-assistant/tasks.md` | 63 |

</details>
```

**实现要点**：
1. **数据结构识别**：根据 `outputMode` 参数选择正确的数据提取路径
2. **嵌套数据提取**：需要遍历 `workspaceResults` 对象的各个workspace
3. **路径规范化**：使用 `/` 而非 `\`，确保跨平台一致性
4. **内容截断**：content 模式下，匹配内容超过80字符时截断，添加 `...`
5. **特殊字符转义**：表格中的 `|` 和 `` ` `` 需要转义
6. **行号格式**：统一使用 `L{number}` 格式
7. **Output Mode 处理**：
   - `content`: 显示完整表格（文件 + 内容 + 行号）
   - `files_with_matches`: 只显示文件列表
   - `count`: 显示每个文件的匹配数量表格
8. **空结果处理**：根据不同模式显示相应的空结果提示

---

### T043: Glob File Search 工具渲染详细规范

**工具识别**：
- 工具名称匹配：`glob_file_search`, `glob`, `file_search`（不区分大小写）
- 数据来源：
  - Glob 模式：`toolFormerData.rawArgs.glob_pattern` 或 `params.globPattern`
  - 目标目录：`toolFormerData.rawArgs.target_directory` 或 `params.targetDirectory`
  - 结果数据：`toolFormerData.result.directories[]`

**Directories 数据结构**：

```json
{
  "directories": [{
    "absPath": "f:\\spec-kit\\p1sc-controller\\docs",
    "files": [
      {"relPath": "IMPLEMENTATION_STATUS.md"},
      {"relPath": "configuration.md"}
    ],
    "totalFiles": 5
  }]
}
```

**渲染策略**：

1. **Summary 标题格式**：
   - `📁 Glob File Search: "{pattern}" • {totalFiles} file(s) in {dirCount} director(y|ies)`
   - 如果指定了目标目录，添加：`in "{directory}"`

2. **Details 内容结构**：
   - 按目录分组展示文件
   - 每个目录使用三级标题：`### Directory: {absPath} ({fileCount} files)`
   - 文件列表使用单列表格或项目列表

3. **文件列表格式**（选项1 - 表格）：
   ```markdown
   | File |
   |:-----|
   | `IMPLEMENTATION_STATUS.md` |
   | `configuration.md` |
   ```

4. **文件列表格式**（选项2 - 列表）：
   ```markdown
   - `IMPLEMENTATION_STATUS.md`
   - `configuration.md`
   ```

**渲染示例**：

输入数据：
```json
{
  "name": "glob_file_search",
  "rawArgs": {
    "glob_pattern": "*.md",
    "target_directory": "docs"
  },
  "result": {
    "directories": [{
      "absPath": "f:\\spec-kit\\p1sc-controller\\docs",
      "files": [
        {"relPath": "IMPLEMENTATION_STATUS.md"},
        {"relPath": "configuration.md"},
        {"relPath": "hardware_setup.md"},
        {"relPath": "DISPLAY_SETUP.md"},
        {"relPath": "README.md"}
      ],
      "totalFiles": 5
    }]
  }
}
```

输出 Markdown（列表格式）：
```markdown
<details>
<summary>📁 Glob File Search: "*.md" • 5 file(s) in 1 directory in "docs"</summary>

### Directory: `f:\spec-kit\p1sc-controller\docs` (5 files)

- `IMPLEMENTATION_STATUS.md`
- `configuration.md`
- `hardware_setup.md`
- `DISPLAY_SETUP.md`
- `README.md`

</details>
```

**实现要点**：
1. **统计计算**：遍历所有目录，累加 `totalFiles` 或 `files.length`
2. **路径规范化**：`absPath` 使用原始格式（保留 `\` 或 `/`），但在代码格式中显示
3. **目录数量**：使用正确的单复数形式（directory/directories）
4. **文件排序**：按文件名字母顺序排列（可选）
5. **空目录处理**：如果某个目录的 `files` 为空，显示 "*无文件*"
6. **格式选择**：使用列表格式（更简洁）
7. **多目录展示**：如果有多个目录，每个目录使用独立的三级标题分隔
8. **相对路径显示**：使用 `relPath` 而非完整路径，保持简洁

---

### T030: Read Lints 工具渲染详细规范

**工具识别**：
- 工具名称匹配：`read_lints`, `linter`, `lint`（不区分大小写）
- 数据来源：
  - 检查路径：`toolFormerData.rawArgs.paths` 或 `params.paths`
  - Linter 结果：`toolFormerData.result`（可能是空对象 `{}` 或包含错误信息的对象）

**Result 数据结构**：

情况 1 - 无错误：
```json
{
  "result": "{}"
}
```

情况 2 - 有错误（真实格式）：
```json
{
  "result": {
    "linterErrorsByFile": [{
      "relativeWorkspacePath": "main.py",
      "errors": [{
        "message": "Import \"os\" is not accessed",
        "range": {
          "startPosition": {"line": 6, "column": 8},
          "endPosition": {"line": 6, "column": 10}
        },
        "severity": "DIAGNOSTIC_SEVERITY_HINT"
      }]
    }]
  }
}
```

**Severity 类型**：
- `DIAGNOSTIC_SEVERITY_ERROR` → 显示为 `error`
- `DIAGNOSTIC_SEVERITY_WARNING` → 显示为 `warning`
- `DIAGNOSTIC_SEVERITY_INFORMATION` → 显示为 `information`
- `DIAGNOSTIC_SEVERITY_HINT` → 显示为 `hint`

**渲染策略**：

1. **Summary 标题格式**：
   - `🔍 Read Lints for {count} path(s)`
   - 或：`✅ Read Lints: No errors` / `❌ Read Lints: {errorCount} error(s) found`

2. **Details 内容结构**：
   - 显示检查的路径列表
   - 如果无错误，显示成功消息
   - 如果有错误，按文件列出错误详情

**渲染示例 1（无错误）**：

输入数据：
```json
{
  "name": "read_lints",
  "rawArgs": {
    "paths": ["esphome", "docs"]
  },
  "result": "{}"
}
```

输出 Markdown：
```markdown
<details>
<summary>✅ Read Lints: No errors found for 2 path(s)</summary>

**Lint paths**:
- `esphome`
- `docs`

**Result**: ✓ No lint errors found

</details>
```

**渲染示例 2（有错误 - 真实格式）**：

输入数据：
```json
{
  "name": "read_lints",
  "rawArgs": {
    "paths": ["main.py"]
  },
  "result": {
    "linterErrorsByFile": [{
      "relativeWorkspacePath": "main.py",
      "errors": [
        {
          "message": "Import \"os\" is not accessed",
          "range": {
            "startPosition": {"line": 6, "column": 8},
            "endPosition": {"line": 6, "column": 10}
          },
          "severity": "DIAGNOSTIC_SEVERITY_HINT"
        },
        {
          "message": "Import \"sys\" is not accessed",
          "range": {
            "startPosition": {"line": 7, "column": 8},
            "endPosition": {"line": 7, "column": 11}
          },
          "severity": "DIAGNOSTIC_SEVERITY_HINT"
        }
      ]
    }]
  }
}
```

输出 Markdown：
```markdown
<details>
<summary>❌ Read Lints: 2 error(s) found</summary>

**Checked paths**:
- `main.py`

### `main.py` (2 errors)

| Line | Col | Severity | Message |
|-----:|----:|:---------|:--------|
| 6 | 8 | hint | Import "os" is not accessed |
| 7 | 8 | hint | Import "sys" is not accessed |

</details>
```

**实现要点**：
1. **空结果判断**：`result` 为 `"{}"` 或空对象表示无错误
2. **数据格式支持**：
   - 优先处理 `linterErrorsByFile` 格式（真实格式）
   - 兼容旧的 `files` 格式
3. **路径列表**：显示所有被检查的路径
4. **错误分组**：按文件分组显示错误，标题显示错误数量
5. **表格格式**：使用表格展示错误详情（行号、列号、严重性、消息）
6. **Severity 简化**：移除 `DIAGNOSTIC_SEVERITY_` 前缀，转为小写
7. **位置提取**：从 `range.startPosition` 提取行号和列号
8. **特殊字符转义**：消息中的 `|` 和 `` ` `` 需要转义
9. **状态图标**：成功用 ✅，有错误用 ❌
10. **单复数处理**：正确处理 path(s) 和 error(s)
11. **简洁展示**：无错误时只显示简单的成功消息

---

## 技术说明

### T054: 修复工具渲染逻辑 - 独立于文本内容

**问题描述**：
在之前的实现中，`renderBubble` 方法使用了嵌套的 `if-else` 结构来处理消息渲染：
```typescript
if (bubble.text && bubble.text.trim()) {
    // 渲染文本
} else if (!isUser) {
    // 只有在没有文本时才渲染工具数据
}
```

这导致当 `bubble` 同时包含 `text` 和 `toolFormerData` 时，工具数据会被忽略，只渲染文本内容。

**修复方案**：
将工具数据渲染逻辑从 `else if` 分支中独立出来，改为并行的 `if` 语句：
```typescript
// 渲染消息文本
if (bubble.text && bubble.text.trim()) {
    // 渲染文本
}

// 渲染工具使用数据（独立于文本内容）
if (!isUser && hasToolData) {
    // 渲染工具数据
}

// 处理空消息
if (fragments.length === 0) {
    // 显示占位符
}
```

**影响范围**：
- 所有工具的渲染现在都能正常工作，即使 bubble 同时包含 text 和 toolFormerData
- 特别是 `todo_write` 等工具，现在可以在有文本说明的情况下正常显示工具输出

**测试验证**：
使用包含 `todo_write` 工具数据的 bubble 进行测试，确认工具数据能够正确渲染为 Markdown 任务列表。

---

### T055: 修复 `<summary>` 标签中的字符转义问题

**问题描述**：
在 `generateDetailsBlock` 方法中，对 `<summary>` 标签的内容使用了 `escapeMarkdown()` 方法：
```typescript
fragments.push(`<summary>${this.escapeMarkdown(summary)}</summary>`);
```

这导致：
- Emoji 字符（如 ✅、❌、🔄）被错误转义
- 其他 Markdown 特殊字符（如 `*`、`_`、`[`、`]`）也被转义
- 最终在渲染时显示为转义后的文本，而不是原始字符

**根本原因**：
`<summary>` 是 HTML 标签，不是 Markdown 文本。在 HTML 标签中：
1. 不需要转义 Markdown 特殊字符（`*`、`_`、`[` 等）
2. 只需要转义 HTML 特殊字符（`<`、`>`、`&`）
3. Emoji 和其他 Unicode 字符在 HTML 中是完全安全的

**修复方案**：
将 `escapeMarkdown()` 替换为只转义 HTML 特殊字符的逻辑：
```typescript
const escapedSummary = summary
    .replace(/&/g, '&amp;')   // & 必须最先转义
    .replace(/</g, '&lt;')    // < 转义为 &lt;
    .replace(/>/g, '&gt;');   // > 转义为 &gt;
fragments.push(`<summary>${escapedSummary}</summary>`);
```

**影响范围**：
- 所有使用 `generateDetailsBlock` 的工具渲染方法
- 特别是包含 emoji 的 summary 标题（如 `read_lints`、`todo_write` 等）
- 现在 emoji 和 Markdown 格式字符能够正确显示

**示例**：
- 修复前：`<summary>\✅ Read Lints\: No errors found</summary>`
- 修复后：`<summary>✅ Read Lints: No errors found</summary>`

---

### T056: 移除空消息占位符

**问题描述**：
在之前的实现中，当 bubble 既没有 `text` 也没有 `toolFormerData` 时，会显示 `*[Empty message]*` 占位符：
```typescript
if (fragments.length === 0) {
    if (isUser) {
        fragments.push('> *[Empty message]*');
    } else {
        fragments.push('*[Empty message]*');
    }
}
```

这导致 Markdown 文档中出现很多不必要的 `*[Empty message]*` 标记，影响阅读体验。

**修复方案**：
完全移除空消息占位符逻辑，如果 bubble 没有任何内容，直接返回空字符串：
```typescript
// T056: 移除空消息占位符 - 如果没有内容，直接返回空字符串
// 空消息不需要显示任何内容，让 Markdown 更简洁
return fragments.join('\n');
```

**影响范围**：
- 空的 bubble（既没有文本也没有工具数据）不再显示任何内容
- Markdown 文档更加简洁，只显示有实际内容的消息
- 不影响有内容的消息的渲染

**设计理念**：
空消息通常是系统内部的中间状态或占位符，对用户没有实际意义。移除这些占位符可以让生成的 Markdown 文档更加清晰、易读。

---

### T058: 修复工具名称匹配优先级问题

**问题描述**：
在工具名称匹配逻辑中，`todo_write` 工具被错误地匹配为 `edit_file` 工具。原因是：
1. `edit_file` 的匹配模式包含 `['edit_file', 'multiedit', 'write', 'search_replace', 'edit']`
2. `todo_write` 工具名称包含 `write` 子串
3. `matchesToolName` 方法使用部分匹配：`toolName.includes(lowerPattern)`
4. 因此 `"todo_write".includes("write")` 返回 `true`，导致 `todo_write` 被匹配为 `edit_file`

这导致待办列表被渲染成：
```markdown
<details>
<summary>📝 Edit file: Unknown file</summary>
...
</details>
```

**修复方案**：
调整工具匹配的优先级顺序，将更具体的模式（如 `todo_write`）放在更通用的模式（如 `write`）之前：

```typescript
// T058: 将 todo_write 的匹配移到最前面，避免被 edit_file 的 'write' 模式误匹配
// III. Agent 任务和流程控制工具（优先匹配，避免与其他工具冲突）
if (this.matchesToolName(toolName, ['todo_write', 'manage_todo_list', 'todo'])) {
    return this.renderTodoTool(toolData);
}

// I. 代码修改与编辑工具
if (this.matchesToolName(toolName, ['edit_file', 'multiedit', 'write', 'search_replace', 'edit'])) {
    return this.renderEditFileTool(toolData);
}
```

同时，修改 `matchesToolName` 方法，移除双向匹配逻辑，只保留单向匹配：
```typescript
// 部分匹配：只检查工具名称是否包含模式
// 注意：不再使用双向匹配，避免误匹配（如 todo_write 匹配到 write）
if (toolName.includes(lowerPattern)) {
    return true;
}
```

**影响范围**：
- `todo_write` 工具现在能够正确匹配到 `renderTodoTool` 方法
- 待办列表正确渲染为任务列表格式
- 不影响其他工具的匹配（因为只是调整了顺序）

**设计原则**：
在工具匹配逻辑中，应该遵循"最具体优先"原则：
1. 完整名称匹配优先于部分匹配
2. 更具体的模式（如 `todo_write`）优先于更通用的模式（如 `write`）
3. 避免使用过于宽泛的匹配模式，防止误匹配

---

### T059: 改进用户消息渲染格式

**问题描述**：
之前的实现使用 Markdown 引用语法（`>` 前缀）来标识用户消息：
```typescript
if (isUser) {
    const lines = bubble.text.split('\n');
    const quotedLines = lines.map((line: string) => `> ${line}`);
    fragments.push(quotedLines.join('\n'));
}
```

这导致两个问题：
1. **语法冲突**：如果用户消息内容本身包含以 `>` 开头的行（如 Markdown 引用），会与用户消息标识混淆
2. **渲染错误**：前端 Markdown 渲染器会将用户消息渲染为嵌套的引用块，导致样式错乱

**修复方案**：
使用 HTML `<div>` 标签包裹用户消息，通过 CSS 类进行标识：

```typescript
// T059: 使用 HTML div 标签包裹用户消息，避免与 Markdown 引用语法冲突
if (isUser) {
    fragments.push(`<div class="user-message">\n\n${bubble.text}\n\n</div>`);
} else {
    fragments.push(bubble.text);
}
```

**渲染输出示例**：

```markdown
<div class="user-message">

这是用户的消息内容。

用户可以使用 Markdown 语法：
> 这是一个引用
- 列表项 1
- 列表项 2

</div>
```

**前端 CSS 样式建议**：

```css
.user-message {
    background-color: #f0f4f8;
    border-left: 4px solid #4a90e2;
    padding: 12px 16px;
    margin: 8px 0;
    border-radius: 4px;
}

.user-message p:first-child {
    margin-top: 0;
}

.user-message p:last-child {
    margin-bottom: 0;
}
```

**影响范围**：
- 用户消息不再使用 `>` 前缀，避免与 Markdown 引用语法冲突
- 前端需要添加 `.user-message` CSS 类的样式定义
- 用户消息内部的 Markdown 语法（如引用、列表、代码块）能够正常渲染
- 更容易通过 JavaScript 选择器定位用户消息（`document.querySelectorAll('.user-message')`）

**设计优势**：
1. **语义清晰**：使用专门的 HTML 标签和类名，明确标识用户消息
2. **样式灵活**：前端可以通过 CSS 自由定制用户消息的外观
3. **兼容性好**：所有 Markdown 渲染器都支持内嵌 HTML
4. **易于扩展**：可以添加更多属性（如 `data-timestamp`、`data-user-id` 等）

**注意事项**：
- `<div>` 标签前后必须有空行，确保内部的 Markdown 内容能被正确解析
- 如果用户消息包含 HTML 特殊字符（`<`、`>`、`&`），需要在前端进行转义处理

---

## 数据分析与验证

### 真实数据验证

基于 P1SC Controller 项目的完整会话数据（384 条消息）进行了全面验证：

**数据统计**：
- 总记录数: 384
- 用户消息: 15 (type=1)
- Agent 消息: 369 (type=2)
- 工具调用: 208
- 思考块: 80
- 代码块: 81
- 富文本消息: 15

**工具使用分布** (Top 5):
1. `read_file`: 62 次 (29.8%)
2. `search_replace`: 41 次 (19.7%)
3. `write`: 31 次 (14.9%)
4. `run_terminal_cmd`: 23 次 (11.1%)
5. `todo_write`: 17 次 (8.2%)

**实现覆盖率**: ✅ 100%
- 所有出现的 11 种工具都有专用渲染器
- 数据格式解析正确（包括 CSV 双引号转义和 Windows 行结束符）
- 工具数据提取逻辑完整

详细分析请参考：`specs/002-session-markdown-view/DATA_ANALYSIS.md`

### 已知问题与改进建议

#### 高优先级

1. **richText 解析** (影响 15 条用户消息)
   - 当前状态: 未实现
   - 需求: 解析 Lexical 编辑器的 JSON 格式，提取纯文本和 @mentions
   - 建议: 创建 `RichTextParser` 工具类

2. **错误消息样式** (提升错误可读性)
   - 当前状态: 未实现
   - 需求: 检测 `toolFormerData.status === "error"` 并使用特殊样式
   - 建议: 在工具渲染器中添加错误检测

3. **空消息处理** (避免空白区域)
   - 当前状态: 已实现 (T057)
   - 状态: ✅ 完成

#### 中优先级

4. **时间戳格式化**
   - 当前状态: 基本实现
   - 改进: 添加相对时间选项 ("2 hours ago")

5. **内容长度限制**
   - 当前状态: 未实现
   - 需求: 超长工具结果的截断和折叠
   - 建议: 添加 `maxContentLength` 选项

6. **thinking 显示控制**
   - 当前状态: 未实现
   - 需求: 通过选项控制是否显示思考过程 (影响 80 条消息)
   - 建议: 添加 `includeThinking` 选项

### CSV 数据格式说明

**格式**: `bubbleId:sessionId:messageId,"{JSON}"`

**关键特征**:
- JSON 部分用双引号包裹
- 内部双引号用 `""` 转义（CSV 标准）
- 行结束符为 `\r\n` (Windows 格式)
- 需要先 `trim()` 再移除外层引号

**解析示例**:
```typescript
const line = 'bubbleId:xxx:yyy,"{""_v"":3,""type"":1}"\r\n';
const [bubbleId, jsonPart] = line.split(',');
const trimmed = jsonPart.trim(); // 移除 \r\n
const unquoted = trimmed.slice(1, -1); // 移除外层引号
const json = unquoted.replace(/""/g, '"'); // 替换双引号
const data = JSON.parse(json);
```

### 测试资源

- **测试数据**: `tests/p1sc-conversation.csv` (384 条真实消息)
- **验证脚本**: `tests/validate-conversation-data.ts`
- **验证报告**: `tests/validation-report.md`
- **数据分析**: `specs/002-session-markdown-view/DATA_ANALYSIS.md`

---

## T061: read_lints 工具渲染调试

### 问题描述

用户报告在前端页面看不到 `read_lints` 工具的渲染内容。

### 问题分析

可能的原因：
1. **数据提取问题**: `extractToolData` 未正确提取工具数据
2. **工具匹配问题**: 虽然 T060 已修复匹配顺序，但可能还有其他问题
3. **内容生成问题**: `renderReadLintsToolnew` 方法生成的内容为空
4. **Details 块问题**: `generateDetailsBlock` 方法未正确生成 HTML
5. **前端渲染问题**: 前端过滤或隐藏了内容

### 解决方案

**添加调试日志**

在 `renderReadLintsToolnew` 方法中添加详细的调试日志：

```typescript
private renderReadLintsToolnew(toolData: any): string {
    const fragments: string[] = [];
    
    // T061: 添加调试日志
    Logger.debug(`renderReadLintsToolnew called with toolData:`, JSON.stringify(toolData, null, 2));
    
    // 安全解析 JSON 字符串
    const rawArgs = this.safeParseJson(toolData.rawArgs);
    const params = this.safeParseJson(toolData.params);
    const result = this.safeParseJson(toolData.result);
    
    Logger.debug(`Parsed data - rawArgs:`, rawArgs, `params:`, params, `result:`, result);
    
    // ... 生成内容 ...
    
    const content = fragments.join('\n');
    Logger.debug(`renderReadLintsToolnew generated content (${content.length} chars):`, content.substring(0, 200));
    const detailsBlock = this.generateDetailsBlock(summaryTitle, content, toolData);
    Logger.debug(`renderReadLintsToolnew final output (${detailsBlock.length} chars)`);
    return detailsBlock;
}
```

**调试步骤**

1. 重新加载 VS Code 窗口
2. 打开输出面板（View > Output > "Cursor Helper"）
3. 触发 `read_lints` 工具调用
4. 检查日志输出：
   - 工具是否被正确识别
   - 数据是否正确解析
   - 内容是否正确生成
   - 最终输出是否为空

5. 在浏览器开发者工具中检查：
   - HTML 元素是否存在
   - CSS 是否隐藏了内容
   - 控制台是否有错误

**预期输出**

对于示例数据：
```json
{
    "name": "read_lints",
    "params": "{\"paths\":[\"esphome\",\"docs\"]}",
    "result": "{}"
}
```

应该生成：
```markdown
<details>
<summary>✅ Read Lints: No errors found for 2 path(s)</summary>

**Lint paths**:
- `esphome`
- `docs`

**Result**: ✓ No lint errors found

</details>
```

### 相关文件

- **实现**: `src/ui/markdownRenderer.ts` (lines 1464-1549)
- **调试指南**: `specs/002-session-markdown-view/DEBUG_read_lints.md`
- **T060 修复**: `specs/002-session-markdown-view/T060_read_lints_matching_fix.md`

### 验证方法

1. **后端验证**: 检查 VS Code 输出面板的日志
2. **前端验证**: 检查浏览器 Elements 面板
3. **集成测试**: 在实际会话中触发 `read_lints` 工具

### 注意事项

- 确保 VS Code 扩展已重新加载
- 确保使用的是最新编译的代码
- 检查是否有缓存问题
- 如果问题仍然存在，参考 `DEBUG_read_lints.md` 中的临时解决方案