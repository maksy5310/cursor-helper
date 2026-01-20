# Cursor 数据发现指南

## 问题说明

当前实现通过监听编辑器事件来推断 AI 使用情况，这是**不正确**的。我们需要**直接访问 Cursor 的内部数据源**来获取：

1. **AI 使用统计数据**：
   - Tab键自动补全的建议次数、采纳次数
   - cmd+K 行内自动补全的建议次数、采纳次数
   - Agent 模式的建议次数、采纳次数
   - 代码行数统计

2. **聊天记录**：
   - Cursor AI 的所有对话（普通聊天和 Agent 模式）
   - 包括消息、代码片段、上下文等

## 需要找到的数据源

### 1. 数据库文件（SQLite）
Cursor 可能将统计数据存储在 SQLite 数据库中，位置可能在：
- `%APPDATA%/Cursor/User/globalStorage/` (Windows)
- `~/Library/Application Support/Cursor/User/globalStorage/` (macOS)
- `~/.config/Cursor/User/globalStorage/` (Linux)

### 2. API 端点
Cursor 可能提供内部 API 来访问数据，需要通过 VS Code Extension API 或 IPC 通信访问。

### 3. 数据文件（JSON/其他格式）
聊天记录可能存储在 JSON 文件中，位置可能在：
- `globalStorage/` 目录
- `workspaceStorage/` 目录
- `History/` 目录

## 使用数据发现工具

插件提供了一个命令来帮助发现 Cursor 的数据文件：

1. 在 Cursor 中按 `Ctrl+Shift+P` (Windows) 或 `Cmd+Shift+P` (Mac)
2. 输入 `Cursor Assistant: Discover Cursor Data Files`
3. 查看输出面板，会列出所有找到的数据库文件和 JSON 文件

## 下一步行动

1. **运行数据发现命令**，找到 Cursor 实际存储数据的位置
2. **检查找到的文件**，确定哪些包含我们需要的数据
3. **实现真正的数据访问层**：
   - 如果找到数据库：实现 SQLite 查询
   - 如果找到 API：实现 API 调用
   - 如果找到文件：实现文件读取和解析

## 当前实现的局限性

- ❌ 事件监听器无法区分用户输入和 AI 补全
- ❌ 无法准确识别 Tab 补全 vs cmd+K 补全
- ❌ 无法获取 Agent 对话记录
- ❌ 无法获取准确的统计数据（建议次数、采纳次数等）

## 正确的实现方向

✅ 直接访问 Cursor 的内部数据源
✅ 从数据库/API/文件中读取真实的使用数据
✅ 获取完整的聊天记录
✅ 统计准确的 AI 使用情况

