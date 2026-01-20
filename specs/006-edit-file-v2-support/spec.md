# Feature Specification: Edit File V2 Tool Rendering Support

**Feature Branch**: `006-edit-file-v2-support`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "新增了一种工具 edit_file_v2，工具的分析已经在前面了。按A策略进行渲染。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Edit File V2 Tool Summaries (Priority: P1)

When developers review their Cursor session history, they need to quickly understand what files were edited using the edit_file_v2 tool. The system should display a concise summary showing the file name, size, status, and user decision without overwhelming them with full file contents.

**Why this priority**: This is the core value proposition - enabling users to scan through their editing history efficiently. Without this, the feature provides no benefit.

**Independent Test**: Can be fully tested by creating a session with edit_file_v2 tool calls, opening the session markdown view, and verifying that tool summaries appear with file names, sizes, and statuses.

**Acceptance Scenarios**:

1. **Given** a session contains an edit_file_v2 tool call with completed status, **When** user views the session markdown, **Then** they see a summary line showing "📝 Edit file: [filename] - [line count] lines, [size] KB ✅"
2. **Given** the edit_file_v2 tool call includes user review decision "accept", **When** user views the tool summary, **Then** they see "(User: accept)" appended to the status
3. **Given** multiple edit_file_v2 tool calls exist in one session, **When** user scrolls through the markdown, **Then** each tool call displays its own distinct summary

---

### User Story 2 - Inspect Edit File V2 Details (Priority: P2)

When developers need to understand the specifics of a file edit operation, they should be able to expand the tool details to see the file path, content statistics (line count, character count), and a preview of the edited content.

**Why this priority**: This provides the detailed investigation capability that some users need, but it's secondary to the primary scanning/browsing use case.

**Independent Test**: Can be tested by clicking on a collapsed edit_file_v2 tool summary and verifying that detailed information expands, showing file path, statistics, and content preview.

**Acceptance Scenarios**:

1. **Given** an edit_file_v2 tool summary is collapsed, **When** user clicks to expand it, **Then** they see the full file path, line count, file size in KB, and content preview (first 500 characters)
2. **Given** the edited content exceeds 500 characters, **When** viewing the preview, **Then** the content is truncated with "..." and a message showing total character count
3. **Given** the edited file has a recognized language extension (e.g., .ts, .py), **When** viewing the content preview, **Then** syntax highlighting is applied based on detected language

---

### User Story 3 - Handle Edit File V2 Edge Cases (Priority: P3)

When edge cases occur (missing data, parsing errors, empty content), the system should gracefully handle them and provide meaningful feedback to users rather than breaking or displaying cryptic errors.

**Why this priority**: Error handling is important for robustness, but most users won't encounter these scenarios in typical usage.

**Independent Test**: Can be tested by creating artificial test cases with malformed or missing data and verifying that appropriate fallback messages appear.

**Acceptance Scenarios**:

1. **Given** an edit_file_v2 tool call has malformed JSON in params field, **When** the system attempts to parse it, **Then** it falls back to displaying "Unknown file" with raw JSON data
2. **Given** an edit_file_v2 tool call has empty streamingContent, **When** user expands the details, **Then** they see "File content is empty" message
3. **Given** an edit_file_v2 tool call is missing the result field, **When** rendering the summary, **Then** status shows as "unknown" without breaking the display

---

### Edge Cases

- What happens when the params or result fields contain nested JSON strings that need multiple levels of parsing?
- How does the system handle extremely large files (>10 MB) in streamingContent?
- What if the relativeWorkspacePath contains special characters or non-standard path separators?
- How does the system behave when toolFormerData structure exists but is missing the name field?
- What happens when additionalData.reviewData is present but selectedOption is null or an unexpected value?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST recognize edit_file_v2 as a distinct tool type and route it to a dedicated rendering method
- **FR-002**: System MUST parse JSON-encoded params and result fields using the existing safeParseJson utility
- **FR-003**: System MUST extract file path from params.relativeWorkspacePath
- **FR-004**: System MUST extract content from params.streamingContent
- **FR-005**: System MUST calculate content statistics: line count (by splitting on newlines) and file size in KB
- **FR-006**: System MUST display tool summary in format: "📝 Edit file: [filename] - [lines] lines, [size] KB [status-icon] [user-decision]"
- **FR-007**: System MUST show ✅ icon for completed status, ⏳ for other statuses
- **FR-008**: System MUST include user decision from additionalData.reviewData.selectedOption if present
- **FR-009**: System MUST truncate content preview to 500 characters, appending "..." and total character count if content is longer
- **FR-010**: System MUST detect programming language from file extension using existing detectLanguageFromFilePath utility
- **FR-011**: System MUST wrap tool summary and details in collapsible `<details>` block using existing generateDetailsBlock utility
- **FR-012**: System MUST handle missing or malformed data gracefully with fallback values: "Unknown file", "unknown" status, empty string for missing content
- **FR-013**: System MUST maintain consistency with existing tool rendering patterns (following the structure of renderEditFileTool)

### Key Entities

- **EditFileV2ToolData**: Represents an edit_file_v2 tool call with structure:
  - name: "edit_file_v2" (tool identifier)
  - params: JSON string containing relativeWorkspacePath, streamingContent, noCodeblock, cloudAgentEdit
  - result: JSON string containing afterContentId
  - status: completion status ("completed", "pending", etc.)
  - additionalData.reviewData: user review information with selectedOption ("accept", "reject", "modify")
  - tool: numeric tool ID (38 for edit_file_v2)
  - toolCallId: unique identifier for this tool call
  - toolIndex: index in tool call sequence

- **ContentStatistics**: Computed metrics for edited content:
  - lineCount: number of lines (split by \n)
  - charCount: total character count
  - sizeKB: file size in kilobytes (charCount / 1024)

- **ContentPreview**: Truncated view of edited content:
  - preview: first 500 characters of streamingContent
  - isTruncated: boolean indicating if content exceeds 500 chars
  - totalChars: full character count for displaying truncation message

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify edited files in their session history within 3 seconds of opening the markdown view
- **SC-002**: System correctly renders 100% of edit_file_v2 tool calls without crashes or missing data (validated through test suite)
- **SC-003**: Content previews load instantly (< 100ms) regardless of full file size
- **SC-004**: 95% of edit_file_v2 tool data fields are successfully extracted and displayed (tracked through logging)
- **SC-005**: Users can understand the outcome of each file edit (completed/pending, accepted/rejected) at a glance without expanding details
- **SC-006**: System handles malformed or missing data without breaking the markdown rendering for the entire session
