# T062: Grep 工具多输出模式支持

**日期**: 2026-01-08  
**状态**: ✅ 已完成  
**优先级**: 高

---

## 问题描述

用户报告 grep 工具在不同 `output_mode` 下的数据结构各不相同，当前实现只正确处理了 `content` 模式，对 `files_with_matches` 和 `count` 模式的处理不完整。

### 用户提供的数据样本

#### 1. files_with_matches 模式
```json
{
  "name": "grep",
  "params": "{\"pattern\":\"python|Python|PYTHON\",\"path\":\"spec-share-server\",\"outputMode\":\"files_with_matches\",\"caseInsensitive\":true,\"headLimit\":5}",
  "result": "{\"success\":{\"pattern\":\"python|Python|PYTHON\",\"path\":\"spec-share-server\",\"outputMode\":\"files_with_matches\",\"workspaceResults\":{\"f:/spec-kit/spec-share-server\":{\"files\":{\"files\":[\".\\\\start.ps1\",\".\\\\start_custom_port.bat\",\".\\\\start.bat\",\".\\\\README.md\",\".\\\\migrate.bat\"],\"totalFiles\":5}}}}}"
}
```

#### 2. count 模式
```json
{
  "name": "grep",
  "params": "{\"pattern\":\"^- \\\\[\",\"path\":\"specs/001-cursor-assistant/tasks.md\",\"outputMode\":\"count\",\"caseInsensitive\":false}",
  "result": "{\"success\":{\"pattern\":\"^- \\\\[\",\"path\":\"specs/001-cursor-assistant/tasks.md\",\"outputMode\":\"count\",\"workspaceResults\":{\"f:/spec-kit/cursor-helper\":{\"count\":{\"counts\":[{\"file\":\"specs/001-cursor-assistant/tasks.md\",\"count\":63}],\"totalFiles\":1,\"totalMatches\":63}}}}}"
}
```

#### 3. content 模式（已支持）
```json
{
  "name": "grep",
  "params": "{\"pattern\":\"_find_entity_by_name\",\"path\":\"intelligent_query_system.py\",\"outputMode\":\"content\",\"caseInsensitive\":false}",
  "result": "{\"success\":{\"pattern\":\"_find_entity_by_name\",\"path\":\"intelligent_query_system.py\",\"outputMode\":\"content\",\"workspaceResults\":{\"f:/cursor-ws/owl-test\":{\"content\":{\"matches\":[{\"file\":\"intelligent_query_system.py\",\"matches\":[{\"lineNumber\":259,\"content\":\"        entity_uri = self._find_entity_by_name(entity_name)\"},{\"lineNumber\":304,\"content\":\"    def _find_entity_by_name(self, name: str) -> Optional[URIRef]:\"}]}],\"totalLines\":5,\"totalMatchedLines\":5}}}}}"
}
```

---

## 数据结构分析

### 1. files_with_matches 模式

**数据路径**: `result.success.workspaceResults[workspace].files`

**结构**:
```typescript
{
  files: {
    files: string[],      // 匹配的文件路径列表
    totalFiles: number    // 文件总数
  }
}
```

**特点**:
- 只返回文件路径，不包含匹配内容
- 适用于快速查找包含特定模式的文件

### 2. count 模式

**数据路径**: `result.success.workspaceResults[workspace].count`

**结构**:
```typescript
{
  count: {
    counts: Array<{
      file: string,       // 文件路径
      count: number       // 该文件中的匹配数量
    }>,
    totalFiles: number,   // 匹配的文件总数
    totalMatches: number  // 所有文件的匹配总数
  }
}
```

**特点**:
- 返回每个文件的匹配数量统计
- 适用于统计分析

### 3. content 模式（默认）

**数据路径**: `result.success.workspaceResults[workspace].content`

**结构**:
```typescript
{
  content: {
    matches: Array<{
      file: string,
      matches: Array<{
        lineNumber: number,
        content: string,
        isContextLine: boolean
      }>
    }>,
    totalLines: number,         // 总行数（包括上下文行）
    totalMatchedLines: number   // 匹配行数
  }
}
```

**特点**:
- 返回完整的匹配内容和行号
- 可以包含上下文行（通过 `-C`/`-A`/`-B` 参数）

---

## 解决方案

### 代码改进

重构 `renderGrepTool` 方法，根据 `outputMode` 使用不同的数据提取和渲染逻辑：

```typescript
private renderGrepTool(toolData: any): string {
    // ... 提取公共参数 ...
    
    // 根据 outputMode 分支处理
    if (outputMode === 'files_with_matches') {
        // 处理 files_with_matches 模式
        const allFiles: string[] = [];
        for (const workspacePath in workspaceResults) {
            const workspace = workspaceResults[workspacePath];
            const filesData = workspace.files || {};
            const files = filesData.files || [];
            allFiles.push(...files);
        }
        // 渲染文件列表
        // ...
        
    } else if (outputMode === 'count') {
        // 处理 count 模式
        const allCounts: Array<{file: string, count: number}> = [];
        for (const workspacePath in workspaceResults) {
            const workspace = workspaceResults[workspacePath];
            const countData = workspace.count || {};
            const counts = countData.counts || [];
            // 收集统计数据
            // ...
        }
        // 渲染统计表格
        // ...
        
    } else {
        // 处理 content 模式（默认）
        // 原有逻辑
        // ...
    }
}
```

### 渲染策略

#### files_with_matches 模式

**Summary**: `🔍 Grep for "{pattern}" • {fileCount} file(s) matched`

**Details**:
```markdown
**Matched files** (5):

- `./start.ps1`
- `./start_custom_port.bat`
- `./start.bat`
- `./README.md`
- `./migrate.bat`
```

#### count 模式

**Summary**: `🔍 Grep for "{pattern}" • {totalMatches} match(es) in {fileCount} file(s)`

**Details**:
```markdown
| File | Matches |
|:-----|--------:|
| `specs/001-cursor-assistant/tasks.md` | 63 |
```

#### content 模式

**Summary**: `🔍 Grep for "{pattern}" • {totalMatchedLines} match(es) in {totalLines} lines`

**Details**:
```markdown
| File | Content | Line |
|:-----|:--------|-----:|
| `intelligent_query_system.py` | `entity_uri = self._find_entity_by_name(entity_name)` | L259 |
| `intelligent_query_system.py` | `def _find_entity_by_name(self, name: str) -> Optional[URIRef]:` | L304 |
```

---

## 实现细节

### 关键改进点

1. **数据结构识别**: 根据 `outputMode` 参数选择正确的数据提取路径
2. **分支处理**: 使用 `if-else if-else` 结构处理三种不同的输出模式
3. **路径规范化**: 统一使用 `/` 而非 `\`
4. **表格对齐**: 
   - files_with_matches: 使用项目列表
   - count: 使用两列表格，数字右对齐
   - content: 使用三列表格，行号右对齐

### 边界情况处理

1. **空结果**:
   - files_with_matches: `*无匹配文件*`
   - count: `*无匹配结果*`
   - content: `*无匹配结果*`

2. **缺失字段**: 使用 `|| {}` 和 `|| []` 提供默认值

3. **路径格式**: 处理 Windows 路径（`\`）和 Unix 路径（`/`）

---

## 测试验证

### 测试用例

#### 用例 1: files_with_matches 模式
- **输入**: 包含 5 个文件的 files 数组
- **预期输出**: 显示 5 个文件的项目列表
- **状态**: ✅ 通过

#### 用例 2: count 模式
- **输入**: 单个文件，63 次匹配
- **预期输出**: 显示两列表格，包含文件名和匹配数
- **状态**: ✅ 通过

#### 用例 3: content 模式
- **输入**: 5 行匹配内容
- **预期输出**: 显示三列表格，包含文件、内容和行号
- **状态**: ✅ 通过（已有实现）

---

## 影响范围

### 受益功能

1. **Grep 工具渲染**: 现在支持所有三种输出模式
2. **用户体验**: 根据不同场景选择合适的输出格式
3. **数据完整性**: 不再丢失 files_with_matches 和 count 模式的数据

### 不受影响的功能

- 其他工具的渲染逻辑
- 现有的 content 模式渲染（保持向后兼容）

---

## 文档更新

### 更新的文件

1. **实现代码**: `src/ui/markdownRenderer.ts` (lines 860-1050)
   - 重构 `renderGrepTool` 方法
   - 添加 files_with_matches 和 count 模式的处理逻辑

2. **契约文档**: `specs/002-session-markdown-view/contracts/markdown-renderer.md` (T022 部分)
   - 添加三种输出模式的数据结构说明
   - 添加三种输出模式的渲染示例
   - 更新实现要点

3. **本文档**: `specs/002-session-markdown-view/T062_grep_output_modes.md`
   - 记录问题分析和解决方案

---

## 后续建议

### 可选改进

1. **grep_search 工具**: 检查是否也需要类似的多模式支持
2. **性能优化**: 对于大量文件的 files_with_matches 模式，考虑分页显示
3. **用户配置**: 允许用户自定义每种模式的显示格式

### 监控指标

- 三种输出模式的使用频率
- 用户对不同模式渲染效果的反馈
- 性能影响（特别是大量文件时）

---

## 总结

本次改进完整支持了 grep 工具的三种输出模式（content、files_with_matches、count），解决了数据结构不匹配导致的渲染问题。改进后的实现：

✅ **完整性**: 支持所有三种输出模式  
✅ **正确性**: 根据数据结构正确提取信息  
✅ **可读性**: 每种模式使用最合适的展示格式  
✅ **兼容性**: 保持向后兼容，不影响现有功能  
✅ **文档**: 完整更新契约文档和实现说明

---

**相关任务**:
- T022: Grep 工具渲染详细规范
- T060: read_lints 工具匹配顺序修复

**参考资料**:
- `specs/002-session-markdown-view/contracts/markdown-renderer.md`
- `src/ui/markdownRenderer.ts`
