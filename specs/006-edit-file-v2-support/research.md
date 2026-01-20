# Research: Edit File V2 Tool Rendering Support

**Feature**: 006-edit-file-v2-support  
**Date**: 2026-01-20  
**Phase**: 0 - Technical Research & Decision Making

## Overview

This document consolidates research findings and technical decisions for implementing edit_file_v2 tool rendering support in the Cursor Assistant markdown renderer.

---

## Research Questions & Findings

### Q1: How is edit_file_v2 tool data structured?

**Context**: Need to understand the exact data format to extract fields correctly.

**Findings**:

Based on analysis of real edit_file_v2 tool calls from Cursor sessions:

```json
{
  "name": "edit_file_v2",
  "params": "{\"relativeWorkspacePath\":\"...\",\"streamingContent\":\"...\",\"noCodeblock\":true,\"cloudAgentEdit\":false}",
  "result": "{\"afterContentId\":\"composer.content.abc123...\"}",
  "status": "completed",
  "additionalData": {
    "reviewData": {
      "firstTimeReviewMode": false,
      "isShowingInput": false,
      "selectedOption": "accept",
      "status": "None"
    }
  },
  "tool": 38,
  "toolCallId": "tool_03cf8626...",
  "toolIndex": 0
}
```

**Key Differences from edit_file**:
- `params` and `result` are **JSON strings** (not objects) - must parse
- `streamingContent` contains complete file content (not diffs)
- New `additionalData.reviewData` structure with user decisions
- No diff chunks - full file replacement paradigm

**Decision**: Use `safeParseJson()` utility (existing) to handle double-encoded JSON fields.

---

### Q2: How should we handle extremely large file content (>10 MB)?

**Context**: `streamingContent` could contain very large files, causing memory/performance issues.

**Research**:
- Analyzed existing tool renderers in `markdownRenderer.ts`
- Checked markdown viewer performance limits in VS Code
- Reviewed best practices for content truncation

**Findings**:
- VS Code markdown viewer handles long documents well, but user experience degrades
- Existing renderers don't truncate (but they display diffs, not full content)
- Memory is not a major concern (modern systems handle 10MB strings easily)
- **User experience is the key concern**: scrolling through huge previews is frustrating

**Decision**: 
- **Truncate preview to 500 characters** in details view
- Display truncation message: "...\n(已截断，完整内容共 X 字符)"
- Show statistics (line count, KB size) to give users scale awareness
- Rationale: 500 chars is enough to understand file content, consistent with code review preview standards

**Alternatives Considered**:
- No truncation: Rejected - poor UX for large files
- 1000 char limit: Rejected - still too long for quick scanning
- 200 char limit: Rejected - too short to understand context

---

### Q3: How should we detect programming language for syntax highlighting?

**Context**: Content preview should have proper syntax highlighting for readability.

**Research**:
- Reviewed existing `detectLanguageFromFilePath()` utility in `markdownRenderer.ts` (lines 1441-1471)
- Checked VS Code markdown code fence language support

**Findings**:
- Existing utility already handles 20+ languages (.js, .ts, .py, .java, .go, etc.)
- Markdown code fences support all major languages
- File extension is reliable indicator (better than content inspection)

**Decision**: 
- **Reuse existing `detectLanguageFromFilePath()` utility**
- No changes needed - already comprehensive
- Fallback to empty string if language not detected (plain text rendering)

**Alternatives Considered**:
- Content-based detection (check for keywords): Rejected - less reliable, more complex
- Default to "text": Rejected - loses syntax highlighting benefit

---

### Q4: How should we display user review decisions (accept/reject/modify)?

**Context**: `additionalData.reviewData.selectedOption` indicates user's action on the edit.

**Research**:
- Analyzed existing tool status displays in codebase
- Reviewed common UX patterns for approval workflows
- Checked emoji support in VS Code markdown

**Findings**:
- Current tools use emoji icons (✅, ❌, ⏳, 🔍, 📝)
- User decisions are important context (shows whether change was accepted)
- Should be visible in summary (not hidden in details)

**Decision**:
- Display user decision in summary line: "(User: accept)"
- Use text labels, not additional icons (keeps summary clean)
- Supported values: "accept", "reject", "modify"
- Omit if `selectedOption` is null/missing

**Icon Selection**:
- ✅ for completed status
- ⏳ for pending/other statuses
- 📝 for edit action indicator

**Alternatives Considered**:
- Separate icons for accept/reject: Rejected - clutters summary
- Hide user decision: Rejected - loses important context
- Color coding: Rejected - markdown doesn't support colors reliably

---

### Q5: How should we handle missing or malformed data?

**Context**: Real-world data may have missing fields or parsing errors.

**Research**:
- Reviewed existing error handling patterns in `markdownRenderer.ts`
- Analyzed fallback strategies in other tool renderers
- Checked `safeParseJson()` implementation (lines 498-526)

**Findings**:
- Existing renderers use fallback values ("Unknown file", "N/A", empty string)
- `safeParseJson()` already handles parse failures gracefully
- Logger utility used for debugging malformed data
- System should never crash - graceful degradation mandatory

**Decision**:
- **Use consistent fallback values**:
  - File path: "Unknown file"
  - Status: "unknown"
  - Content: Empty string → "File content is empty" message
  - User decision: Omit from display
- **Log all fallback scenarios** with `Logger.debug()` for debugging
- **Display raw JSON** in details if critical fields missing (for troubleshooting)

**Error Handling Pattern**:
```typescript
const filePath = params?.relativeWorkspacePath || 'Unknown file';
const content = params?.streamingContent || '';
const status = toolData.status || 'unknown';
```

**Alternatives Considered**:
- Throw errors: Rejected - breaks entire session rendering
- Show error messages to user: Rejected - technical details not helpful
- Skip rendering: Rejected - loses data visibility

---

### Q6: Where should this tool renderer be placed in the routing logic?

**Context**: `renderToolDetails()` routes tool names to specific renderers.

**Research**:
- Reviewed existing routing structure (lines 1888-1985)
- Analyzed tool categorization comments (I. Code modification, II. Retrieval, III. Agent tasks)

**Findings**:
- Tools organized by category
- edit_file, multiedit, apply_patch are in "I. Code modification" section
- edit_file_v2 is semantically similar to edit_file (both edit files)

**Decision**:
- **Place in "I. Code modification" section** after existing edit tools
- **Use exact name match**: `edit_file_v2` (no variations)
- **Add routing entry**:
  ```typescript
  if (this.matchesToolName(toolName, ['edit_file_v2'])) {
      Logger.debug(`renderToolDetails: Matched edit_file_v2 tool`);
      return this.renderEditFileV2Tool(toolData);
  }
  ```
- Position: After `delete_file` handler, before "II. Retrieval" section

**Alternatives Considered**:
- Merge with edit_file handler: Rejected - different data structures require separate logic
- Place in separate category: Rejected - semantically belongs with file editing tools

---

## Technical Decisions Summary

| Decision Area | Choice | Rationale |
|--------------|--------|-----------|
| **JSON Parsing** | Use `safeParseJson()` for params/result | Handles double-encoding, existing utility, error-safe |
| **Content Truncation** | 500 characters | Balance between context and UX, industry standard for previews |
| **Language Detection** | Reuse `detectLanguageFromFilePath()` | Already comprehensive, reliable, no reinvention needed |
| **Status Icons** | ✅ completed, ⏳ other | Consistent with existing tool renderers |
| **User Decision Display** | Text label in summary: "(User: X)" | Clear, non-cluttered, preserves context |
| **Error Handling** | Fallback values + logging | Graceful degradation, debuggable, never crashes |
| **Routing Placement** | "I. Code modification" section | Semantic grouping, after edit_file/apply_patch |
| **Method Naming** | `renderEditFileV2Tool()` | Follows existing naming convention (render[ToolName]Tool) |

---

## Implementation Approach

### Pattern: Follow renderEditFileTool Structure

The implementation will mirror the structure of existing tool renderers, specifically `renderEditFileTool()`:

1. **Parse inputs**: Use `safeParseJson()` for params/result
2. **Extract fields**: File path, content, status, user decision
3. **Compute statistics**: Line count, character count, size in KB
4. **Generate summary**: Title with file name, stats, icons, user decision
5. **Generate details**: File path, statistics, content preview (truncated)
6. **Wrap in collapsible block**: Use `generateDetailsBlock()`

### Code Organization

```typescript
private renderEditFileV2Tool(toolData: any): string {
    // 1. Parse and extract
    const params = this.safeParseJson(toolData.params);
    const result = this.safeParseJson(toolData.result);
    const filePath = params?.relativeWorkspacePath || 'Unknown file';
    const content = params?.streamingContent || '';
    const status = toolData.status || 'unknown';
    const userDecision = toolData.additionalData?.reviewData?.selectedOption;
    
    // 2. Compute statistics
    const lineCount = content.split('\n').length;
    const charCount = content.length;
    const sizeKB = (charCount / 1024).toFixed(2);
    
    // 3. Generate summary
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    const statusIcon = status === 'completed' ? '✅' : '⏳';
    const decisionText = userDecision ? ` (User: ${userDecision})` : '';
    const summaryTitle = `📝 Edit file: ${fileName} - ${lineCount} lines, ${sizeKB} KB ${statusIcon}${decisionText}`;
    
    // 4. Generate details
    const fragments: string[] = [];
    fragments.push(`**文件**: \`${filePath}\``);
    fragments.push(`**状态**: ${status}`);
    // ... statistics, preview ...
    
    // 5. Wrap and return
    const content = fragments.join('\n');
    return this.generateDetailsBlock(summaryTitle, content, toolData);
}
```

---

## Best Practices Applied

1. **Reuse Existing Utilities**: Leverage `safeParseJson`, `detectLanguageFromFilePath`, `generateDetailsBlock`
2. **Consistent Error Handling**: Follow established fallback patterns
3. **Logging for Debugging**: Use `Logger.debug()` at key points
4. **TypeScript Safety**: Use optional chaining (`?.`) for nested properties
5. **Markdown Best Practices**: Escape special characters, proper code fence formatting
6. **Performance**: Truncate early, avoid expensive operations in loops

---

## Open Questions

**None** - All technical decisions resolved.

---

## References

- Existing codebase: `src/ui/markdownRenderer.ts`
- Tool data analysis: Previous conversation context
- VS Code Extension API: https://code.visualstudio.com/api
- Markdown syntax: https://commonmark.org/

---

**Research Complete**: ✅ Ready for Phase 1 (Design & Contracts)  
**Next Step**: Create data-model.md, contracts/, and quickstart.md
