# T068: 精确工具名称匹配

**Date**: 2025-01-08  
**Status**: ✅ 已完成  
**Related**: T052, T067

## 问题描述

之前的`matchesToolName`方法使用了部分匹配(`includes`)策略,虽然提供了灵活性,但也带来了潜在的误匹配风险:

```typescript
private matchesToolName(toolName: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
        const lowerPattern = pattern.toLowerCase();
        // 精确匹配
        if (toolName === lowerPattern) {
            return true;
        }
        // 部分匹配：可能导致误匹配
        if (toolName.includes(lowerPattern)) {
            return true;
        }
    }
    return false;
}
```

**潜在问题**:
- 过于宽泛的模式(如`'search'`, `'write'`, `'read'`)可能匹配到不相关的工具
- 增加了工具匹配顺序的重要性
- 降低了代码的可维护性和可预测性

## 解决方案

### 1. 简化匹配逻辑

只使用精确匹配,移除部分匹配逻辑:

```typescript
private matchesToolName(toolName: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
        const lowerPattern = pattern.toLowerCase();
        // 只使用精确匹配，避免误匹配
        if (toolName === lowerPattern) {
            return true;
        }
    }
    return false;
}
```

### 2. 清理匹配模式

移除所有过于宽泛或不是实际工具名称的模式:

**修改前**:
```typescript
// 包含很多简写和通用词
if (this.matchesToolName(toolName, ['todo_write', 'manage_todo_list', 'todo'])) { ... }
if (this.matchesToolName(toolName, ['edit_file', 'multiedit', 'write', 'search_replace', 'edit'])) { ... }
if (this.matchesToolName(toolName, ['apply_patch', 'patch', 'apply'])) { ... }
if (this.matchesToolName(toolName, ['copilot_applypatch', 'copilot_insertedit', 'copilot'])) { ... }
if (this.matchesToolName(toolName, ['delete_file', 'delete'])) { ... }
if (this.matchesToolName(toolName, ['glob_file_search', 'glob', 'file_search'])) { ... }
if (this.matchesToolName(toolName, ['codebase_search', 'codebase'])) { ... }
if (this.matchesToolName(toolName, ['web_search', 'web'])) { ... }
if (this.matchesToolName(toolName, ['fetch_pull_request', 'pull_request', 'pr'])) { ... }
if (this.matchesToolName(toolName, ['read_lints', 'linter', 'lint'])) { ... }
if (this.matchesToolName(toolName, ['read_file', 'read_file_v2', 'copilot_readfile', 'read'])) { ... }
if (this.matchesToolName(toolName, ['list_dir', 'list', 'directory'])) { ... }
if (this.matchesToolName(toolName, ['run_terminal_cmd', 'run_terminal_command', 'run_terminal_command_v2', 'terminal', 'command'])) { ... }
```

**修改后**:
```typescript
// 只保留实际的工具名称，移除所有简写和通用词
if (this.matchesToolName(toolName, ['todo_write', 'manage_todo_list'])) { ... }
if (this.matchesToolName(toolName, ['edit_file', 'multiedit', 'write', 'search_replace'])) { ... }
if (this.matchesToolName(toolName, ['apply_patch'])) { ... }
if (this.matchesToolName(toolName, ['copilot_applypatch', 'copilot_insertedit'])) { ... }
if (this.matchesToolName(toolName, ['delete_file'])) { ... }
if (this.matchesToolName(toolName, ['glob_file_search'])) { ... }
if (this.matchesToolName(toolName, ['codebase_search'])) { ... }
if (this.matchesToolName(toolName, ['web_search'])) { ... }
if (this.matchesToolName(toolName, ['fetch_pull_request'])) { ... }
if (this.matchesToolName(toolName, ['read_lints'])) { ... }
if (this.matchesToolName(toolName, ['read_file', 'read_file_v2', 'copilot_readfile'])) { ... }
if (this.matchesToolName(toolName, ['list_dir'])) { ... }
if (this.matchesToolName(toolName, ['run_terminal_cmd', 'run_terminal_command', 'run_terminal_command_v2'])) { ... }
```

### 3. 完整的工具名称映射

根据contracts文档,以下是所有支持的工具名称:

| 渲染方法 | 实际工具名称 | 移除的简写/通用词 |
|:--------|:------------|:------------------|
| `renderTodoTool` | `todo_write`, `manage_todo_list` | ~~`todo`~~ |
| `renderEditFileTool` | `edit_file`, `multiedit`, `write`, `search_replace` | ~~`edit`~~ |
| `renderApplyPatchTool` | `apply_patch` | ~~`patch`~~, ~~`apply`~~ |
| `renderCopilotEditTool` | `copilot_applypatch`, `copilot_insertedit` | ~~`copilot`~~ |
| `renderDeleteFileTool` | `delete_file` | ~~`delete`~~ |
| `renderGlobFileSearchTool` | `glob_file_search` | ~~`glob`~~, ~~`file_search`~~ |
| `renderCodebaseSearchTool` | `codebase_search` | ~~`codebase`~~ |
| `renderWebSearchTool` | `web_search` | ~~`web`~~ |
| `renderGrepTool` | `grep`, `ripgrep` | - |
| `renderFetchPullRequestTool` | `fetch_pull_request` | ~~`pull_request`~~, ~~`pr`~~ |
| `renderReadLintsToolnew` | `read_lints` | ~~`linter`~~, ~~`lint`~~ |
| `renderReadFileTool` | `read_file`, `read_file_v2`, `copilot_readfile` | ~~`read`~~ |
| `renderListDirTool` | `list_dir` | ~~`list`~~, ~~`directory`~~ |
| `renderTerminalCommandTool` | `run_terminal_cmd`, `run_terminal_command`, `run_terminal_command_v2` | ~~`terminal`~~, ~~`command`~~ |

## 优势

1. **更高的准确性**: 消除了误匹配的可能性
2. **更好的可维护性**: 匹配逻辑更简单,更容易理解
3. **更低的复杂度**: 不再依赖工具匹配的顺序(虽然仍然保持合理的顺序)
4. **更明确的契约**: 每个工具的名称都是明确定义的

## 测试验证

使用测试数据验证匹配逻辑:

```javascript
const toolName = 'glob_file_search';
const patterns1 = ['glob_file_search'];
const patterns2 = ['codebase_search'];

// 精确匹配
console.log(matchesToolName(toolName, patterns1)); // true
console.log(matchesToolName(toolName, patterns2)); // false
```

## 影响范围

- ✅ `src/ui/markdownRenderer.ts` - `matchesToolName`方法
- ✅ `src/ui/markdownRenderer.ts` - `renderToolDetails`方法中的所有工具匹配

## 相关文档

- `specs/002-session-markdown-view/contracts/markdown-renderer.md` - 工具名称定义
- `T052` - 工具名称匹配逻辑改进
- `T067` - 修复glob_file_search误匹配

## 后续建议

1. 如果发现有新的工具名称变体,应该:
   - 在contracts文档中记录
   - 在`renderToolDetails`中添加到相应的模式数组
   
2. 考虑使用枚举或常量定义所有工具名称,进一步提高类型安全性

3. 可以考虑添加单元测试,验证所有工具名称的匹配逻辑
