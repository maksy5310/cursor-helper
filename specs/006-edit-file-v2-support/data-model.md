# Data Model: Edit File V2 Tool Rendering

**Feature**: 006-edit-file-v2-support  
**Date**: 2026-01-20  
**Phase**: 1 - Design

## Overview

This document defines the data structures involved in rendering edit_file_v2 tool calls in the markdown viewer. These structures represent the input data (from database), intermediate computations, and output formatting.

---

## Entity Definitions

### 1. EditFileV2ToolData (Input)

**Description**: Raw tool call data extracted from Cursor database, representing an edit_file_v2 operation.

**Source**: Database query results, passed to `renderEditFileV2Tool()`

**Structure**:

```typescript
interface EditFileV2ToolData {
  // Tool identification
  name: "edit_file_v2";              // Tool type identifier
  tool: number;                       // Tool ID (38 for edit_file_v2)
  toolCallId: string;                 // Unique call identifier (e.g., "tool_03cf8626...")
  toolIndex: number;                  // Index in tool call sequence
  
  // Execution data (JSON-encoded strings)
  params: string;                     // JSON string containing EditFileV2Params
  result: string;                     // JSON string containing EditFileV2Result
  
  // Status information
  status: string;                     // Execution status: "completed" | "pending" | "failed" | etc.
  
  // User review data
  additionalData?: {
    reviewData?: {
      firstTimeReviewMode: boolean;
      isShowingInput: boolean;
      selectedOption: "accept" | "reject" | "modify" | null;
      status: string;
    };
  };
}
```

**Field Descriptions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Always "edit_file_v2" for this tool type |
| `params` | string | ✅ | JSON-encoded string containing file path and content |
| `result` | string | ✅ | JSON-encoded string containing operation result |
| `status` | string | ✅ | Execution status for icon selection |
| `additionalData.reviewData` | object | ❌ | User's review decision on the edit |
| `toolCallId` | string | ✅ | Unique identifier for debugging |

**Validation Rules**:
- `name` MUST equal "edit_file_v2"
- `params` and `result` MUST be valid JSON strings (use `safeParseJson`)
- If validation fails, use fallback values ("Unknown file", "unknown" status)

---

### 2. EditFileV2Params (Parsed from params field)

**Description**: Parsed parameters from the JSON-encoded `params` field.

**Source**: Result of `safeParseJson(toolData.params)`

**Structure**:

```typescript
interface EditFileV2Params {
  relativeWorkspacePath: string;     // File path relative to workspace root
  streamingContent: string;          // Full file content after edit
  noCodeblock?: boolean;             // Whether to suppress code block rendering
  cloudAgentEdit?: boolean;          // Whether edit was made by cloud agent
}
```

**Field Descriptions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `relativeWorkspacePath` | string | ✅ | Path to edited file (e.g., "src/ui/markdownRenderer.ts") |
| `streamingContent` | string | ✅ | Complete file content (may be very large) |
| `noCodeblock` | boolean | ❌ | Internal flag (not used in rendering) |
| `cloudAgentEdit` | boolean | ❌ | Internal flag (not used in rendering) |

**Example**:
```json
{
  "relativeWorkspacePath": "f:\\spec-kit\\cursor-helper\\PUBLISH.md",
  "streamingContent": "# Publishing Guide\n\n...(full file content)...",
  "noCodeblock": true,
  "cloudAgentEdit": false
}
```

---

### 3. EditFileV2Result (Parsed from result field)

**Description**: Parsed result from the JSON-encoded `result` field.

**Source**: Result of `safeParseJson(toolData.result)`

**Structure**:

```typescript
interface EditFileV2Result {
  afterContentId: string;            // Content identifier after edit
}
```

**Field Descriptions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `afterContentId` | string | ✅ | Unique identifier for the content version after edit |

**Usage**: Currently not displayed in rendering (internal tracking only)

---

### 4. ContentStatistics (Computed)

**Description**: Computed metrics about the edited file content, used for display in summary and details.

**Source**: Calculated from `EditFileV2Params.streamingContent`

**Structure**:

```typescript
interface ContentStatistics {
  lineCount: number;                 // Number of lines (split by '\n')
  charCount: number;                 // Total character count
  sizeKB: string;                    // File size in KB (formatted to 2 decimals)
}
```

**Computation Logic**:

```typescript
function computeStatistics(content: string): ContentStatistics {
  const lineCount = content.split('\n').length;
  const charCount = content.length;
  const sizeKB = (charCount / 1024).toFixed(2);
  
  return { lineCount, charCount, sizeKB };
}
```

**Example**:
- Input: `"line 1\nline 2\nline 3"` (21 characters)
- Output: `{ lineCount: 3, charCount: 21, sizeKB: "0.02" }`

---

### 5. ContentPreview (Computed)

**Description**: Truncated view of file content for display in details section, optimized for readability.

**Source**: Computed from `EditFileV2Params.streamingContent`

**Structure**:

```typescript
interface ContentPreview {
  preview: string;                   // First 500 characters of content
  isTruncated: boolean;              // Whether content was truncated
  totalChars: number;                // Total character count (for truncation message)
  language: string;                  // Detected language for syntax highlighting
}
```

**Computation Logic**:

```typescript
function computePreview(
  content: string, 
  filePath: string
): ContentPreview {
  const maxChars = 500;
  const preview = content.substring(0, maxChars);
  const isTruncated = content.length > maxChars;
  const totalChars = content.length;
  const language = detectLanguageFromFilePath(filePath);
  
  return { preview, isTruncated, totalChars, language };
}
```

**Example**:
- Input: 1000-char TypeScript file
- Output: 
  ```typescript
  {
    preview: "export class Foo {\n  ...(first 500 chars)...",
    isTruncated: true,
    totalChars: 1000,
    language: "typescript"
  }
  ```

---

### 6. ToolSummary (Output)

**Description**: Formatted summary string displayed in collapsed state, providing at-a-glance information.

**Source**: Generated in `renderEditFileV2Tool()`

**Format**:

```
📝 Edit file: [fileName] - [lineCount] lines, [sizeKB] KB [statusIcon] [userDecision]
```

**Components**:

| Component | Source | Example |
|-----------|--------|---------|
| Icon | Static | 📝 |
| File name | Last segment of `relativeWorkspacePath` | PUBLISH.md |
| Line count | `ContentStatistics.lineCount` | 300 lines |
| File size | `ContentStatistics.sizeKB` | 12.34 KB |
| Status icon | `status` field | ✅ (if "completed"), ⏳ (otherwise) |
| User decision | `additionalData.reviewData.selectedOption` | (User: accept) |

**Example Output**:
```
📝 Edit file: PUBLISH.md - 300 lines, 12.34 KB ✅ (User: accept)
```

---

### 7. ToolDetails (Output)

**Description**: Formatted markdown string displayed in expanded state, showing detailed information.

**Structure** (Markdown sections):

```markdown
**文件**: `[fullFilePath]`
**状态**: [status]
**用户决策**: [userDecision]

**内容统计**:
- 行数: [lineCount]
- 大小: [sizeKB] KB

**内容预览**:

```[language]
[preview content]
...
(已截断，完整内容共 [totalChars] 字符)
```
```

**Components**:

| Section | Source | Required |
|---------|--------|----------|
| File path | `EditFileV2Params.relativeWorkspacePath` | ✅ |
| Status | `EditFileV2ToolData.status` | ✅ |
| User decision | `additionalData.reviewData.selectedOption` | ❌ |
| Statistics | `ContentStatistics` | ✅ |
| Preview | `ContentPreview` | ✅ |

---

## Data Flow Diagram

```
┌─────────────────────┐
│ Database Query      │
│ (sql.js)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ EditFileV2ToolData  │ ◄─── Raw input (params/result as JSON strings)
│ (Input)             │
└──────────┬──────────┘
           │
           │ safeParseJson()
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ EditFileV2Params    │     │ EditFileV2Result    │
│ (Parsed)            │     │ (Parsed)            │
└──────────┬──────────┘     └─────────────────────┘
           │
           │ compute statistics/preview
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ ContentStatistics   │     │ ContentPreview      │
│ (Computed)          │     │ (Computed)          │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           │ format output             │
           ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ ToolSummary         │     │ ToolDetails         │
│ (Output)            │     │ (Output)            │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           │ combine with generateDetailsBlock()
           ▼
┌─────────────────────┐
│ HTML <details>      │
│ Markdown Block      │
│ (Final Output)      │
└─────────────────────┘
```

---

## State Transitions

### Status State Machine

```
┌─────────┐
│ pending │ ──┐
└─────────┘   │
              │ execution
              ▼
┌───────────┐      ┌─────────┐
│ completed │ ◄──── │ failed  │
└───────────┘      └─────────┘
      │
      │ user review
      ▼
┌─────────────────────────────────┐
│ reviewData.selectedOption set:  │
│ - accept                         │
│ - reject                         │
│ - modify                         │
└─────────────────────────────────┘
```

**Notes**:
- `status` reflects execution outcome
- `reviewData.selectedOption` reflects user's decision on the edit
- Both are displayed independently in the summary

---

## Validation & Error Handling

### Input Validation

| Field | Validation Rule | Fallback Value |
|-------|----------------|----------------|
| `params` | Must parse as valid JSON | Display raw string in details |
| `result` | Must parse as valid JSON | Omit result display |
| `relativeWorkspacePath` | Non-empty string | "Unknown file" |
| `streamingContent` | Any string (including empty) | Show "File content is empty" |
| `status` | Any string | "unknown" |
| `selectedOption` | One of: accept/reject/modify | Omit from display |

### Error Scenarios

| Scenario | Handling | User-Visible Impact |
|----------|----------|---------------------|
| Malformed JSON in `params` | Use fallback values | Summary shows "Unknown file", details show raw JSON |
| Missing `streamingContent` | Empty string | Details show "File content is empty" |
| Null `selectedOption` | Omit from display | Summary doesn't include "(User: ...)" |
| Extremely large content (>10MB) | Truncate to 500 chars | Preview shows first 500 chars + truncation message |
| Unknown file extension | Empty language string | Code fence has no language tag (plain text) |

---

## Performance Considerations

### Memory Management

- **Large Content**: Don't duplicate `streamingContent` in memory
  - Compute statistics in-place
  - Extract preview immediately after parsing
  - Don't store full content in intermediate objects

### Computation Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Parse JSON | O(n) | n = length of JSON string |
| Count lines | O(n) | n = length of content |
| Extract preview | O(1) | substring(0, 500) is constant time |
| Detect language | O(1) | hash map lookup by extension |

**Optimization**: All computations are linear or constant time, suitable for large files.

---

## Examples

### Example 1: Successful Edit with User Acceptance

**Input**:
```json
{
  "name": "edit_file_v2",
  "params": "{\"relativeWorkspacePath\":\"src/utils/helper.ts\",\"streamingContent\":\"export function hello() {\\n  return 'world';\\n}\"}",
  "result": "{\"afterContentId\":\"abc123\"}",
  "status": "completed",
  "additionalData": {
    "reviewData": {
      "selectedOption": "accept"
    }
  }
}
```

**Computed Entities**:
- `ContentStatistics`: `{ lineCount: 3, charCount: 48, sizeKB: "0.05" }`
- `ContentPreview`: `{ preview: "export function...", isTruncated: false, totalChars: 48, language: "typescript" }`

**Output**:
- Summary: `📝 Edit file: helper.ts - 3 lines, 0.05 KB ✅ (User: accept)`
- Details: Full path, statistics, code preview with TypeScript syntax highlighting

---

### Example 2: Large File with Truncation

**Input**:
```json
{
  "name": "edit_file_v2",
  "params": "{\"relativeWorkspacePath\":\"PUBLISH.md\",\"streamingContent\":\"...(10,000 characters)...\"}",
  "status": "completed"
}
```

**Computed Entities**:
- `ContentStatistics`: `{ lineCount: 300, charCount: 10000, sizeKB: "9.77" }`
- `ContentPreview`: `{ preview: "...(first 500 chars)...", isTruncated: true, totalChars: 10000, language: "markdown" }`

**Output**:
- Summary: `📝 Edit file: PUBLISH.md - 300 lines, 9.77 KB ✅`
- Details: Statistics + truncated preview + message "(已截断，完整内容共 10000 字符)"

---

### Example 3: Error Handling - Missing Path

**Input**:
```json
{
  "name": "edit_file_v2",
  "params": "{\"streamingContent\":\"some content\"}",
  "status": "completed"
}
```

**Computed Entities**:
- File path falls back to: `"Unknown file"`
- Other fields computed normally

**Output**:
- Summary: `📝 Edit file: Unknown file - 1 lines, 0.01 KB ✅`
- Details: Shows "Unknown file" for path, normal statistics

---

## References

- Implementation: `src/ui/markdownRenderer.ts`
- Existing entities: `src/models/sessionMarkdown.ts`
- Utility functions: `src/utils/logger.ts`

---

**Data Model Complete**: ✅ Ready for contract definition  
**Next Step**: Define API contracts in `contracts/markdown-renderer-extension.md`
