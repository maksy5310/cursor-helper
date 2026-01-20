# Quickstart: Implementing Edit File V2 Tool Rendering

**Feature**: 006-edit-file-v2-support  
**Date**: 2026-01-20  
**Estimated Time**: 2-3 hours

## Overview

This quickstart guide walks you through implementing support for rendering `edit_file_v2` tool calls in the markdown viewer. Follow these steps in order for a smooth implementation.

---

## Prerequisites

Before starting, ensure you have:

- ✅ Feature branch `006-edit-file-v2-support` checked out
- ✅ Dependencies installed (`npm install`)
- ✅ TypeScript compilation working (`npm run compile`)
- ✅ Read [research.md](./research.md) and [data-model.md](./data-model.md)
- ✅ Reviewed [contracts/markdown-renderer-extension.md](./contracts/markdown-renderer-extension.md)

---

## Step-by-Step Implementation

### Step 1: Add Routing Entry (5 minutes)

**File**: `src/ui/markdownRenderer.ts`

**Location**: In `renderToolDetails()` method, ~line 1905, after the `delete_file` handler

**Code to Add**:

```typescript
// Add this after the delete_file handler, before "II. Retrieval" section comment
if (this.matchesToolName(toolName, ['edit_file_v2'])) {
    Logger.debug(`renderToolDetails: Matched edit_file_v2 tool, using renderEditFileV2Tool`);
    return this.renderEditFileV2Tool(toolData);
}
```

**Verification**:
- ✅ Routing is in "I. Code modification" section
- ✅ Uses `matchesToolName()` for consistency
- ✅ Logs routing decision
- ✅ Returns immediately (no fallthrough)

---

### Step 2: Implement Main Rendering Method (30 minutes)

**File**: `src/ui/markdownRenderer.ts`

**Location**: Add after `renderListDirTool()` method (around line 1310), before helper methods section

**Code Template**:

```typescript
/**
 * Render edit_file_v2 tool (complete file replacement with streaming content)
 * @param toolData Edit file v2 tool data
 * @returns Markdown string with collapsible details
 */
private renderEditFileV2Tool(toolData: any): string {
    const fragments: string[] = [];
    
    // 1. Parse inputs
    Logger.debug(`renderEditFileV2Tool: Processing tool data`, { 
        hasParams: !!toolData.params,
        hasResult: !!toolData.result,
        status: toolData.status
    });
    
    const params = this.safeParseJson(toolData.params);
    const result = this.safeParseJson(toolData.result);
    
    // 2. Extract fields with fallbacks
    const filePath = params?.relativeWorkspacePath || 'Unknown file';
    const content = params?.streamingContent || '';
    const status = toolData.status || 'unknown';
    const userDecision = toolData.additionalData?.reviewData?.selectedOption;
    
    // Log parsed data
    Logger.debug(`renderEditFileV2Tool: Parsed data`, {
        filePath: filePath,
        contentLength: content.length,
        status: status,
        hasUserDecision: !!userDecision
    });
    
    // 3. Compute statistics
    const lineCount = content.split('\n').length;
    const charCount = content.length;
    const sizeKB = (charCount / 1024).toFixed(2);
    
    // 4. Generate summary
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    const statusIcon = status === 'completed' ? '✅' : '⏳';
    const decisionText = userDecision ? ` (User: ${userDecision})` : '';
    const summaryTitle = `📝 Edit file: ${fileName} - ${lineCount} lines, ${sizeKB} KB ${statusIcon}${decisionText}`;
    
    // 5. Generate details - File info
    fragments.push(`**文件**: \`${filePath}\``);
    fragments.push(`**状态**: ${status}`);
    if (userDecision) {
        fragments.push(`**用户决策**: ${userDecision}`);
    }
    fragments.push('');
    
    // 6. Generate details - Statistics
    fragments.push(`**内容统计**:`);
    fragments.push(`- 行数: ${lineCount}`);
    fragments.push(`- 大小: ${sizeKB} KB`);
    fragments.push('');
    
    // 7. Generate details - Content preview
    if (content) {
        const maxPreviewChars = 500;
        const preview = content.substring(0, maxPreviewChars);
        const language = this.detectLanguageFromFilePath(filePath);
        
        fragments.push('**内容预览**:');
        fragments.push('');
        fragments.push(`\`\`\`${language}`);
        fragments.push(preview);
        
        // Add truncation message if needed
        if (content.length > maxPreviewChars) {
            fragments.push('...');
            fragments.push(`(已截断，完整内容共 ${charCount} 字符)`);
        }
        
        fragments.push('```');
    } else {
        fragments.push('*文件内容为空*');
    }
    
    // 8. Wrap in collapsible block
    const contentMarkdown = fragments.join('\n');
    return this.generateDetailsBlock(summaryTitle, contentMarkdown, toolData);
}
```

**Verification**:
- ✅ Method is `private`
- ✅ JSDoc comment added
- ✅ Uses `safeParseJson()` for params/result
- ✅ All fallback values implemented
- ✅ Logs at key points
- ✅ Summary format matches contract
- ✅ Details structure matches contract
- ✅ Uses existing utilities (detectLanguageFromFilePath, generateDetailsBlock)

---

### Step 3: Compile and Test Syntax (5 minutes)

**Command**:

```bash
npm run compile
```

**Expected Output**:

```
> cursor-assistant@0.0.2 compile
> tsc -p ./

✓ Compilation successful
```

**If Errors**:
- Check TypeScript syntax
- Verify import statements (if needed)
- Ensure method is inside `MarkdownRenderer` class

---

### Step 4: Create Unit Test (45 minutes)

**File**: `tests/unit/markdownRenderer.test.ts` (create if doesn't exist)

**Test Structure**:

```typescript
import { MarkdownRenderer } from '../../src/ui/markdownRenderer';

describe('MarkdownRenderer - edit_file_v2 tool', () => {
    let renderer: MarkdownRenderer;
    
    beforeEach(() => {
        renderer = new MarkdownRenderer();
    });
    
    test('renders edit_file_v2 with complete data', () => {
        const toolData = {
            name: 'edit_file_v2',
            params: JSON.stringify({
                relativeWorkspacePath: 'src/test.ts',
                streamingContent: 'export function test() {\n  return true;\n}'
            }),
            result: JSON.stringify({
                afterContentId: 'abc123'
            }),
            status: 'completed',
            additionalData: {
                reviewData: {
                    selectedOption: 'accept'
                }
            }
        };
        
        // Access private method via type assertion for testing
        const result = (renderer as any).renderEditFileV2Tool(toolData);
        
        expect(result).toContain('📝 Edit file: test.ts');
        expect(result).toContain('3 lines');
        expect(result).toContain('KB ✅');
        expect(result).toContain('(User: accept)');
        expect(result).toContain('**文件**: `src/test.ts`');
        expect(result).toContain('export function test()');
    });
    
    test('handles missing file path gracefully', () => {
        const toolData = {
            name: 'edit_file_v2',
            params: JSON.stringify({
                streamingContent: 'content'
            }),
            status: 'completed'
        };
        
        const result = (renderer as any).renderEditFileV2Tool(toolData);
        
        expect(result).toContain('Unknown file');
        expect(result).not.toThrow();
    });
    
    test('truncates long content to 500 characters', () => {
        const longContent = 'a'.repeat(1000);
        const toolData = {
            name: 'edit_file_v2',
            params: JSON.stringify({
                relativeWorkspacePath: 'test.txt',
                streamingContent: longContent
            }),
            status: 'completed'
        };
        
        const result = (renderer as any).renderEditFileV2Tool(toolData);
        
        expect(result).toContain('...');
        expect(result).toContain('已截断');
        expect(result).toContain('1000 字符');
    });
    
    test('handles empty content', () => {
        const toolData = {
            name: 'edit_file_v2',
            params: JSON.stringify({
                relativeWorkspacePath: 'test.txt',
                streamingContent: ''
            }),
            status: 'completed'
        };
        
        const result = (renderer as any).renderEditFileV2Tool(toolData);
        
        expect(result).toContain('文件内容为空');
    });
    
    test('omits user decision if not present', () => {
        const toolData = {
            name: 'edit_file_v2',
            params: JSON.stringify({
                relativeWorkspacePath: 'test.ts',
                streamingContent: 'content'
            }),
            status: 'completed'
        };
        
        const result = (renderer as any).renderEditFileV2Tool(toolData);
        
        expect(result).not.toContain('(User:');
    });
    
    test('uses pending icon for non-completed status', () => {
        const toolData = {
            name: 'edit_file_v2',
            params: JSON.stringify({
                relativeWorkspacePath: 'test.ts',
                streamingContent: 'content'
            }),
            status: 'pending'
        };
        
        const result = (renderer as any).renderEditFileV2Tool(toolData);
        
        expect(result).toContain('⏳');
        expect(result).not.toContain('✅');
    });
    
    test('detects language from file extension', () => {
        const toolData = {
            name: 'edit_file_v2',
            params: JSON.stringify({
                relativeWorkspacePath: 'test.py',
                streamingContent: 'def hello():\n    pass'
            }),
            status: 'completed'
        };
        
        const result = (renderer as any).renderEditFileV2Tool(toolData);
        
        expect(result).toContain('```python');
    });
});
```

**Run Tests**:

```bash
npm test
```

**Expected**: All 7 tests pass ✅

---

### Step 5: Manual Integration Test (30 minutes)

**Goal**: Test with real Cursor session data

**Steps**:

1. **Find a real edit_file_v2 tool call**:
   - Open Cursor
   - Make a file edit using Composer
   - Let the edit be accepted
   - Note the session ID

2. **Open session in extension**:
   - Open Cursor Assistant sidebar
   - Find the session in Sessions list
   - Click to open markdown view

3. **Verify rendering**:
   - ✅ Tool call appears with 📝 icon
   - ✅ Summary shows filename, line count, size
   - ✅ Status icon (✅ or ⏳) appears
   - ✅ User decision shows if applicable
   - ✅ Clicking expands details
   - ✅ Details show file path, statistics, preview
   - ✅ Preview is truncated if file is large
   - ✅ Syntax highlighting works

4. **Test edge cases** (if possible):
   - Large file (>10MB)
   - File with no extension
   - Rejected edit (user decision: reject)

---

### Step 6: Performance Verification (15 minutes)

**Goal**: Ensure rendering is fast (<100ms)

**Method 1: Console Timing**

Add temporary timing code:

```typescript
private renderEditFileV2Tool(toolData: any): string {
    const startTime = performance.now();
    
    // ... existing implementation ...
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    Logger.debug(`renderEditFileV2Tool: Rendered in ${duration.toFixed(2)}ms`);
    
    return result;
}
```

**Method 2: Test with Large File**

Create test with 10MB file:

```typescript
test('performance: renders 10MB file quickly', () => {
    const largeContent = 'a'.repeat(10 * 1024 * 1024); // 10MB
    const toolData = {
        name: 'edit_file_v2',
        params: JSON.stringify({
            relativeWorkspacePath: 'large.txt',
            streamingContent: largeContent
        }),
        status: 'completed'
    };
    
    const startTime = performance.now();
    const result = (renderer as any).renderEditFileV2Tool(toolData);
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(100); // Must be < 100ms
    expect(result).toContain('10240.00 KB');
});
```

**Expected**: Rendering time < 100ms even for 10MB files

---

### Step 7: Update Agent Context (5 minutes)

**Command**:

```bash
.\.specify\scripts\powershell\update-agent-context.ps1 -AgentType cursor-agent
```

**Expected Output**:

```
Updated agent context file with new technology: edit_file_v2 tool rendering
```

**Verification**:
- Check `.specify/memory/cursor-agent-context.md` (or similar)
- Confirm edit_file_v2 is documented

---

## Verification Checklist

Before considering implementation complete, verify:

- ✅ Routing entry added to `renderToolDetails()`
- ✅ `renderEditFileV2Tool()` method implemented
- ✅ Code compiles without errors
- ✅ All 7 unit tests pass
- ✅ Manual integration test with real data passes
- ✅ Performance < 100ms for large files
- ✅ Agent context updated
- ✅ No modifications to existing tool renderers
- ✅ Logs appear in debug output
- ✅ Code follows existing style (matches `renderEditFileTool` structure)

---

## Troubleshooting

### Problem: Compilation Errors

**Symptoms**: TypeScript errors when running `npm run compile`

**Solutions**:
- Check method is inside `MarkdownRenderer` class
- Verify all variables are properly typed
- Ensure no typos in utility method names (`safeParseJson`, etc.)
- Check that `Logger` is imported (should already be in file)

---

### Problem: Tests Fail with "Cannot read property"

**Symptoms**: Tests crash with null/undefined errors

**Solutions**:
- Verify test data structure matches expected format
- Check that `safeParseJson` is handling malformed JSON
- Add more defensive checks (`?.` optional chaining)
- Review fallback values

---

### Problem: Tool Doesn't Render in UI

**Symptoms**: edit_file_v2 tools don't appear in markdown view

**Solutions**:
1. Check routing: Is `matchesToolName` being called?
2. Add log in routing: Verify tool name matches exactly
3. Check database: Does tool have `name: "edit_file_v2"`?
4. Test fallback: Does it appear as "Unknown Tool"?

**Debug Code**:

```typescript
// Add in renderToolDetails(), before routing
Logger.debug(`renderToolDetails: Tool name check`, {
    rawName: toolData.name,
    normalized: toolName,
    isEditFileV2: this.matchesToolName(toolName, ['edit_file_v2'])
});
```

---

### Problem: Syntax Highlighting Not Working

**Symptoms**: Code preview shows as plain text

**Solutions**:
- Check `detectLanguageFromFilePath` is being called
- Verify file extension is recognized (see method lines 1441-1471)
- Test with common extensions (.ts, .js, .py) first
- Check markdown viewer supports the language

---

### Problem: Content Not Truncating

**Symptoms**: Very long files show completely (slow UI)

**Solutions**:
- Verify `content.substring(0, 500)` is used
- Check that `maxPreviewChars` constant is 500
- Ensure truncation message appears when `content.length > 500`
- Test with `console.log(content.length)` to verify

---

## Next Steps

After completing implementation:

1. ✅ Commit changes to feature branch
   ```bash
   git add src/ui/markdownRenderer.ts tests/unit/markdownRenderer.test.ts
   git commit -m "feat: add edit_file_v2 tool rendering support"
   ```

2. ✅ Run full test suite
   ```bash
   npm test
   ```

3. ✅ Create tasks breakdown (if needed)
   ```bash
   /cursor-helper/speckit.tasks
   ```

4. ✅ Manual QA with multiple sessions

5. ✅ Update CHANGELOG (if project has one)

6. ✅ Prepare for merge to main

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Step 1: Routing | 5 min | 5 min |
| Step 2: Main Method | 30 min | 35 min |
| Step 3: Compile | 5 min | 40 min |
| Step 4: Unit Tests | 45 min | 1h 25min |
| Step 5: Manual Test | 30 min | 1h 55min |
| Step 6: Performance | 15 min | 2h 10min |
| Step 7: Agent Context | 5 min | 2h 15min |
| **Total** | **~2-3 hours** | |

---

## Resources

- Feature Spec: [spec.md](./spec.md)
- Research: [research.md](./research.md)
- Data Model: [data-model.md](./data-model.md)
- Contract: [contracts/markdown-renderer-extension.md](./contracts/markdown-renderer-extension.md)
- Existing Code: `src/ui/markdownRenderer.ts`

---

**Status**: ✅ Ready for Implementation  
**Last Updated**: 2026-01-20  
**Questions?** Review research.md or check existing tool renderers for patterns
