# Contract: Markdown Renderer Extension for Edit File V2

**Feature**: 006-edit-file-v2-support  
**Date**: 2026-01-20  
**Component**: `src/ui/markdownRenderer.ts`  
**Type**: Internal API Extension

## Overview

This contract defines the interface extension to the `MarkdownRenderer` class for rendering edit_file_v2 tool calls. It specifies the new private method signature, integration points with existing code, and behavioral contracts.

---

## New Method Signature

### `renderEditFileV2Tool(toolData: any): string`

**Visibility**: `private`

**Purpose**: Render an edit_file_v2 tool call into HTML-formatted markdown with collapsible details.

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `toolData` | `any` | Raw tool data object from database, expected to match `EditFileV2ToolData` structure (see data-model.md) |

**Returns**: `string` - HTML markdown block containing `<details>` element with summary and expanded content

**Behavior Contract**:

1. **MUST** parse `toolData.params` and `toolData.result` as JSON strings using `safeParseJson()`
2. **MUST** extract file path from parsed params or use "Unknown file" as fallback
3. **MUST** extract content from parsed params or use empty string as fallback
4. **MUST** compute statistics: line count, character count, size in KB
5. **MUST** truncate content preview to 500 characters maximum
6. **MUST** detect programming language using `detectLanguageFromFilePath()`
7. **MUST** generate summary in format: `📝 Edit file: [filename] - [lines] lines, [size] KB [icon] [decision]`
8. **MUST** use ✅ icon for completed status, ⏳ for other statuses
9. **MUST** include user decision from `additionalData.reviewData.selectedOption` if present
10. **MUST** wrap output in collapsible block using `generateDetailsBlock()`
11. **MUST** handle missing/malformed data gracefully without throwing errors
12. **MUST** log debug information using `Logger.debug()` for parsing steps

**Example Call**:

```typescript
const toolData = {
  name: "edit_file_v2",
  params: '{"relativeWorkspacePath":"src/test.ts","streamingContent":"content"}',
  result: '{"afterContentId":"abc123"}',
  status: "completed",
  additionalData: { reviewData: { selectedOption: "accept" } }
};

const markdown = this.renderEditFileV2Tool(toolData);
// Returns: <details><summary>📝 Edit file: test.ts - 1 lines, 0.01 KB ✅ (User: accept)</summary>...</details>
```

---

## Integration Points

### 1. Routing from `renderToolDetails()`

**Location**: `src/ui/markdownRenderer.ts`, method `renderToolDetails()`, line ~1905

**Integration Code**:

```typescript
// In renderToolDetails(), add after delete_file handler:

if (this.matchesToolName(toolName, ['edit_file_v2'])) {
    Logger.debug(`renderToolDetails: Matched edit_file_v2 tool, using renderEditFileV2Tool`);
    return this.renderEditFileV2Tool(toolData);
}
```

**Contract**:
- **MUST** be placed in "I. Code modification" section
- **MUST** use exact match for tool name "edit_file_v2"
- **MUST** log routing decision for debugging
- **MUST** return immediately after rendering (no fallthrough)

---

### 2. Dependency on Existing Utilities

**safeParseJson()**

- **Location**: `src/ui/markdownRenderer.ts`, lines 498-526
- **Usage**: Parse `toolData.params` and `toolData.result`
- **Contract**: Returns parsed object or original value if parsing fails
- **Example**:
  ```typescript
  const params = this.safeParseJson(toolData.params);
  ```

**detectLanguageFromFilePath()**

- **Location**: `src/ui/markdownRenderer.ts`, lines 1441-1471
- **Usage**: Determine syntax highlighting language for code preview
- **Contract**: Returns language string (e.g., "typescript") or empty string if unknown
- **Example**:
  ```typescript
  const language = this.detectLanguageFromFilePath(filePath);
  ```

**generateDetailsBlock()**

- **Location**: `src/ui/markdownRenderer.ts`, lines 537-564
- **Usage**: Wrap summary and content in collapsible `<details>` element
- **Contract**: Returns HTML string with `<details><summary>...</summary>content</details>`
- **Example**:
  ```typescript
  return this.generateDetailsBlock(summaryTitle, content, toolData);
  ```

**matchesToolName()**

- **Location**: `src/ui/markdownRenderer.ts`, lines 1872-1881
- **Usage**: Check if tool name matches expected patterns
- **Contract**: Returns boolean, uses exact match (case-insensitive)
- **Example**:
  ```typescript
  if (this.matchesToolName(toolName, ['edit_file_v2'])) { ... }
  ```

---

## Output Format Contract

### Summary Format

**Template**:
```
📝 Edit file: [fileName] - [lineCount] lines, [sizeKB] KB [statusIcon] [userDecision]
```

**Components**:

| Component | Format | Example | Required |
|-----------|--------|---------|----------|
| Icon | Static emoji | 📝 | ✅ |
| Label | Static text | "Edit file:" | ✅ |
| File name | Last path segment | "test.ts" | ✅ |
| Line count | Number + " lines" | "10 lines" | ✅ |
| File size | Number + " KB" (2 decimals) | "1.23 KB" | ✅ |
| Status icon | ✅ or ⏳ | ✅ | ✅ |
| User decision | " (User: [option])" | " (User: accept)" | ❌ |

**Example Outputs**:
- With user decision: `📝 Edit file: PUBLISH.md - 300 lines, 12.34 KB ✅ (User: accept)`
- Without user decision: `📝 Edit file: helper.ts - 5 lines, 0.15 KB ⏳`

---

### Details Format

**Structure** (Markdown):

```markdown
**文件**: `[fullFilePath]`
**状态**: [status]
**用户决策**: [userDecision]    ← Only if present

**内容统计**:
- 行数: [lineCount]
- 大小: [sizeKB] KB

**内容预览**:

```[language]
[preview content up to 500 chars]
...
(已截断，完整内容共 [totalChars] 字符)    ← Only if truncated
```
```

**Field Requirements**:

| Section | Required | Condition |
|---------|----------|-----------|
| 文件 (File) | ✅ | Always |
| 状态 (Status) | ✅ | Always |
| 用户决策 (User Decision) | ❌ | Only if `selectedOption` present |
| 内容统计 (Statistics) | ✅ | Always |
| 内容预览 (Preview) | ✅ | Always (even if empty) |
| 截断消息 (Truncation) | ❌ | Only if content > 500 chars |

---

## Error Handling Contract

### Required Fallback Values

| Scenario | Fallback Value | User Impact |
|----------|----------------|-------------|
| Missing `relativeWorkspacePath` | `"Unknown file"` | Summary shows "Unknown file" |
| Malformed JSON in `params` | Use raw string, log warning | Details show raw JSON |
| Missing `streamingContent` | Empty string `""` | Details show "File content is empty" |
| Missing `status` | `"unknown"` | Summary shows ⏳ icon |
| Missing `selectedOption` | Omit from display | No "(User: ...)" in summary |
| Content > 500 chars | Truncate to 500 | Show truncation message |

### Error Logging

**Required Log Points**:

1. **Before parsing**:
   ```typescript
   Logger.debug(`renderEditFileV2Tool: Processing tool data`, { 
     hasParams: !!toolData.params,
     hasResult: !!toolData.result,
     status: toolData.status
   });
   ```

2. **After parsing**:
   ```typescript
   Logger.debug(`renderEditFileV2Tool: Parsed data`, {
     filePath: params?.relativeWorkspacePath,
     contentLength: content?.length,
     status: toolData.status
   });
   ```

3. **Fallback scenarios**:
   ```typescript
   Logger.warn(`renderEditFileV2Tool: Using fallback value`, {
     field: 'relativeWorkspacePath',
     fallback: 'Unknown file'
   });
   ```

---

## Performance Contract

### Time Complexity

| Operation | Complexity | Max Time | Notes |
|-----------|-----------|----------|-------|
| Parse JSON | O(n) | 10ms | n = length of JSON string |
| Compute statistics | O(n) | 10ms | n = length of content |
| Generate summary | O(1) | 1ms | String concatenation |
| Generate details | O(1) | 5ms | Includes truncation |
| **Total** | **O(n)** | **<100ms** | **Even for 10MB files** |

### Space Complexity

| Data Structure | Size | Notes |
|----------------|------|-------|
| `toolData` (input) | ~10KB typical | May be larger for big files |
| `params` (parsed) | ~same as input | Doesn't duplicate content |
| `preview` (substring) | 500 bytes | Fixed size |
| Output string | ~2KB typical | Summary + details markdown |

**Contract**: Method MUST NOT store full content in memory longer than necessary. Extract preview immediately after parsing.

---

## Testing Contract

### Required Test Cases

1. **Happy Path**:
   - Input: Valid edit_file_v2 data with all fields
   - Expected: Correct summary and details with user decision

2. **Large File**:
   - Input: Content > 10MB
   - Expected: Preview truncated to 500 chars, correct statistics

3. **Missing File Path**:
   - Input: `params` without `relativeWorkspacePath`
   - Expected: Summary shows "Unknown file", no crash

4. **Malformed JSON**:
   - Input: `params` is invalid JSON string
   - Expected: Fallback to raw string display, log warning

5. **Empty Content**:
   - Input: `streamingContent` is empty string
   - Expected: Details show "File content is empty"

6. **No User Decision**:
   - Input: `additionalData.reviewData` is null
   - Expected: Summary doesn't include "(User: ...)"

7. **Unknown Language**:
   - Input: File with unrecognized extension (e.g., `.xyz`)
   - Expected: Code fence with no language tag (plain text)

---

## Backward Compatibility

### Existing Code NOT Modified

| Component | Status | Notes |
|-----------|--------|-------|
| `renderEditFileTool()` | Unchanged | Handles edit_file (different from edit_file_v2) |
| `renderBubble()` | Unchanged | Routing logic unchanged |
| `extractToolData()` | Unchanged | Already handles new tool types |
| `safeParseJson()` | Unchanged | Reused as-is |
| Other tool renderers | Unchanged | Isolated change |

### Integration Risk

**Risk Level**: **Low**

**Rationale**:
- Purely additive change (new method + routing entry)
- No modifications to existing methods
- Follows established patterns
- Falls back to `renderUnknownTool()` if routing fails

---

## Example Implementation Skeleton

```typescript
/**
 * Render edit_file_v2 tool call
 * @param toolData Edit file v2 tool data from database
 * @returns Markdown string with collapsible details block
 */
private renderEditFileV2Tool(toolData: any): string {
    const fragments: string[] = [];
    
    // 1. Parse inputs
    Logger.debug(`renderEditFileV2Tool: Processing tool data`, { 
        hasParams: !!toolData.params,
        hasResult: !!toolData.result 
    });
    
    const params = this.safeParseJson(toolData.params);
    const result = this.safeParseJson(toolData.result);
    
    // 2. Extract fields with fallbacks
    const filePath = params?.relativeWorkspacePath || 'Unknown file';
    const content = params?.streamingContent || '';
    const status = toolData.status || 'unknown';
    const userDecision = toolData.additionalData?.reviewData?.selectedOption;
    
    // 3. Compute statistics
    const lineCount = content.split('\n').length;
    const charCount = content.length;
    const sizeKB = (charCount / 1024).toFixed(2);
    
    // 4. Generate summary
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    const statusIcon = status === 'completed' ? '✅' : '⏳';
    const decisionText = userDecision ? ` (User: ${userDecision})` : '';
    const summaryTitle = `📝 Edit file: ${fileName} - ${lineCount} lines, ${sizeKB} KB ${statusIcon}${decisionText}`;
    
    // 5. Generate details
    fragments.push(`**文件**: \`${filePath}\``);
    fragments.push(`**状态**: ${status}`);
    if (userDecision) {
        fragments.push(`**用户决策**: ${userDecision}`);
    }
    fragments.push('');
    
    fragments.push(`**内容统计**:`);
    fragments.push(`- 行数: ${lineCount}`);
    fragments.push(`- 大小: ${sizeKB} KB`);
    fragments.push('');
    
    if (content) {
        const preview = content.substring(0, 500);
        const language = this.detectLanguageFromFilePath(filePath);
        
        fragments.push('**内容预览**:');
        fragments.push('');
        fragments.push(`\`\`\`${language}`);
        fragments.push(preview);
        if (content.length > 500) {
            fragments.push('...');
            fragments.push(`(已截断，完整内容共 ${charCount} 字符)`);
        }
        fragments.push('```');
    } else {
        fragments.push('*文件内容为空*');
    }
    
    // 6. Wrap and return
    const contentMarkdown = fragments.join('\n');
    return this.generateDetailsBlock(summaryTitle, contentMarkdown, toolData);
}
```

---

## Acceptance Criteria

Implementation is complete when:

- ✅ Method signature matches contract exactly
- ✅ All 11 behavior contract points implemented
- ✅ Integration with `renderToolDetails()` added
- ✅ All 4 utility dependencies used correctly
- ✅ Output format matches template exactly
- ✅ All fallback values implemented
- ✅ All required log points added
- ✅ Performance targets met (<100ms)
- ✅ All 7 test cases pass
- ✅ No modifications to existing methods

---

## References

- Data Model: [data-model.md](../data-model.md)
- Research Decisions: [research.md](../research.md)
- Existing Implementation: `src/ui/markdownRenderer.ts`

---

**Contract Version**: 1.0  
**Status**: ✅ Ready for Implementation  
**Next Step**: Create quickstart.md with step-by-step implementation guide
