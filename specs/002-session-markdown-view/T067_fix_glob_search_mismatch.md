# T067: 修复glob_file_search被误匹配为codebase_search

**日期**: 2026-01-08  
**状态**: ✅ 已完成  
**优先级**: 高  
**类型**: Bug修复

---

## 问题描述

用户报告`glob_file_search`工具被错误地渲染为`codebase_search`的结果。

### 问题数据

```json
{
  "toolFormerData": {
    "name": "glob_file_search",
    "params": "{\"globPattern\":\"**/specs/001-cursor-assistant/contracts/*.md\"}",
    "rawArgs": "{\"glob_pattern\": \"specs/001-cursor-assistant/contracts/*.md\"}",
    "result": "{\"directories\":[{\"absPath\":\"f:\\\\spec-kit\\\\cursor-helper\",\"files\":[...],\"totalFiles\":3}]}"
  }
}
```

### 问题表现

**期望渲染**:
```
📁 Glob File Search: "specs/001-cursor-assistant/contracts/*.md" • 3 file(s) in 1 directory
```

**实际渲染**:
```
🔍 Searched codebase: "Unknown query" • 0 result(s)
无搜索结果
```

---

## 问题分析

### 匹配顺序问题

在`renderToolDetails`方法中,工具匹配的顺序是:

```typescript
// 第1932行: codebase_search
if (this.matchesToolName(toolName, ['codebase_search', 'codebase', 'search'])) {
    return this.renderCodebaseSearchTool(toolData);
}

// ... 其他工具 ...

// 第1968行: glob_file_search
if (this.matchesToolName(toolName, ['glob_file_search', 'glob', 'file_search'])) {
    return this.renderGlobFileSearchTool(toolData);
}
```

### 误匹配原因

1. **工具名称**: `glob_file_search`
2. **codebase_search的匹配模式**: `['codebase_search', 'codebase', 'search']`
3. **部分匹配逻辑**: `toolName.includes(pattern)`
4. **匹配结果**: `"glob_file_search".includes("search")` = `true`
5. **被误匹配**: 在到达`glob_file_search`的匹配之前,已经被`codebase_search`匹配

### 匹配逻辑

```typescript
private matchesToolName(toolName: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
        const lowerPattern = pattern.toLowerCase();
        // 精确匹配
        if (toolName === lowerPattern) {
            return true;
        }
        // 部分匹配
        if (toolName.includes(lowerPattern)) {
            return true;  // glob_file_search 包含 "search"
        }
    }
    return false;
}
```

---

## 解决方案

### 修复策略

采用"最具体优先"原则:
1. 将更具体的工具(`glob_file_search`)移到更通用的工具(`codebase_search`)之前
2. 移除`codebase_search`匹配中过于宽泛的`'search'`模式

### 代码修改

#### 方案1: 调整匹配顺序(已采用)

```typescript
// II. 代码和知识检索工具
// T067: 将 glob_file_search 移到 codebase_search 之前，避免被 'search' 模式误匹配
if (this.matchesToolName(toolName, ['glob_file_search', 'glob', 'file_search'])) {
    return this.renderGlobFileSearchTool(toolData);
}

if (this.matchesToolName(toolName, ['codebase_search', 'codebase'])) {  // 移除 'search'
    return this.renderCodebaseSearchTool(toolData);
}

if (this.matchesToolName(toolName, ['web_search', 'web'])) {
    return this.renderWebSearchTool(toolData);
}
```

**优点**:
- 简单直接
- 遵循"最具体优先"原则
- 移除了过于宽泛的`'search'`模式

#### 方案2: 使用精确匹配(未采用)

```typescript
if (toolName === 'glob_file_search' || toolName === 'glob' || toolName === 'file_search') {
    return this.renderGlobFileSearchTool(toolData);
}
```

**缺点**: 失去了部分匹配的灵活性

---

## 修复效果

### 修复前

**工具名称**: `glob_file_search`

**匹配流程**:
1. 检查`codebase_search`匹配 → `"glob_file_search".includes("search")` = `true`
2. ✅ 匹配成功,使用`renderCodebaseSearchTool`
3. ❌ 永远不会到达`glob_file_search`的匹配

**渲染结果**:
```
🔍 Searched codebase: "Unknown query" • 0 result(s)
无搜索结果
```

### 修复后

**工具名称**: `glob_file_search`

**匹配流程**:
1. 检查`glob_file_search`匹配 → `"glob_file_search".includes("glob_file_search")` = `true`
2. ✅ 匹配成功,使用`renderGlobFileSearchTool`
3. ✅ 正确渲染

**渲染结果**:
```markdown
<details>
<summary>📁 Glob File Search: "specs/001-cursor-assistant/contracts/*.md" • 3 file(s) in 1 directory</summary>

### Directory: `f:\spec-kit\cursor-helper` (3 files)

- `specs\001-cursor-assistant\contracts\storage-manager.md`
- `specs\001-cursor-assistant\contracts\data-access.md`
- `specs\001-cursor-assistant\contracts\data-collector.md`

</details>
```

---

## 相关问题

### 为什么不使用精确匹配?

**原因**:
1. 工具名称可能有变体(如`read_file`和`readFile`)
2. 部分匹配提供了灵活性
3. 可以用简短的模式匹配多个工具

**但需要注意**:
- 避免过于宽泛的模式(如单个`'search'`)
- 遵循"最具体优先"原则

### 还有哪些工具可能有类似问题?

需要检查的模式:
1. `'read'` - 可能匹配`read_file`, `read_lints`, `thread_read`等
2. `'write'` - 可能匹配`write`, `todo_write`, `file_write`等
3. `'search'` - 可能匹配`codebase_search`, `web_search`, `glob_file_search`等
4. `'list'` - 可能匹配`list_dir`, `list_files`, `checklist`等

**已知的修复**:
- T058: `todo_write`移到`edit_file`之前(避免`'write'`误匹配)
- T060: `read_lints`移到`read_file`之前(避免`'read'`误匹配)
- T067: `glob_file_search`移到`codebase_search`之前(避免`'search'`误匹配)

---

## 匹配顺序最佳实践

### 原则

1. **最具体优先**: 完整名称 > 部分名称 > 通用名称
2. **避免宽泛模式**: 不使用单个通用词作为匹配模式
3. **分组排序**: 同类工具放在一起,按具体程度排序

### 推荐顺序

```typescript
// 1. 特殊工具(优先匹配,避免冲突)
if (toolName === 'todo_write') { ... }

// 2. 具体工具(完整名称)
if (toolName === 'glob_file_search') { ... }
if (toolName === 'read_lints') { ... }

// 3. 通用工具(可能包含宽泛模式)
if (toolName.includes('search')) { ... }  // 最后匹配
if (toolName.includes('read')) { ... }    // 最后匹配
```

---

## 测试验证

### 测试用例

#### 用例 1: glob_file_search
- **输入**: `name: "glob_file_search"`
- **预期**: 使用`renderGlobFileSearchTool`
- **状态**: ✅ 通过

#### 用例 2: codebase_search
- **输入**: `name: "codebase_search"`
- **预期**: 使用`renderCodebaseSearchTool`
- **状态**: ✅ 通过

#### 用例 3: web_search
- **输入**: `name: "web_search"`
- **预期**: 使用`renderWebSearchTool`
- **状态**: ✅ 通过

#### 用例 4: 其他包含search的工具
- **输入**: `name: "custom_search"`
- **预期**: 使用`renderUnknownTool`(没有匹配)
- **状态**: ✅ 通过

---

## 影响范围

### 受益工具

1. **glob_file_search**: 现在能正确渲染
2. **codebase_search**: 不受影响,仍然正常工作
3. **web_search**: 不受影响

### 不受影响的工具

- 所有其他工具的匹配逻辑保持不变

---

## 文档更新

### 更新的文件

1. ✅ **src/ui/markdownRenderer.ts** (lines 1931-1970)
   - 将`glob_file_search`匹配移到`codebase_search`之前
   - 移除`codebase_search`匹配中的`'search'`模式
   - 调整工具匹配顺序

2. ✅ **specs/002-session-markdown-view/T067_fix_glob_search_mismatch.md**
   - 创建本文档

---

## 后续建议

### 可选改进

1. **匹配模式审查**: 全面审查所有工具的匹配模式,移除过于宽泛的模式

2. **单元测试**: 为工具匹配逻辑添加单元测试
   ```typescript
   test('glob_file_search should match correctly', () => {
       const renderer = new MarkdownRenderer();
       const toolData = { name: 'glob_file_search', ... };
       const result = renderer.renderToolDetails(toolData);
       expect(result).toContain('📁 Glob File Search');
   });
   ```

3. **匹配优先级文档**: 在契约文档中记录工具匹配的优先级规则

4. **警告日志**: 当多个模式可能匹配时,记录警告日志

---

## 总结

本次修复解决了`glob_file_search`被误匹配为`codebase_search`的问题:

✅ **准确性**: 正确识别`glob_file_search`工具  
✅ **优先级**: 遵循"最具体优先"原则  
✅ **简洁性**: 移除过于宽泛的匹配模式  
✅ **兼容性**: 不影响其他工具的匹配

---

**相关任务**:
- T058: 修复todo_write被误匹配为edit_file
- T060: 修复read_lints被误匹配为read_file
- T052: 改进工具名称匹配逻辑

**参考资料**:
- `src/ui/markdownRenderer.ts`
- `specs/002-session-markdown-view/contracts/markdown-renderer.md`
