# Implementation Plan: Edit File V2 Tool Rendering Support

**Branch**: `006-edit-file-v2-support` | **Date**: 2026-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-edit-file-v2-support/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add rendering support for the `edit_file_v2` tool type in the markdown renderer. The system will display concise summaries showing file name, size, status, and user review decisions, with expandable details including content previews (truncated to 500 characters) and statistics. The implementation extends the existing tool rendering infrastructure in `src/ui/markdownRenderer.ts` following established patterns from `renderEditFileTool` and other tool renderers.

## Technical Context

**Language/Version**: TypeScript 5.0, targeting ES2020  
**Primary Dependencies**: VS Code Extension API ^1.74.0, Node.js >=18.0.0  
**Storage**: N/A (reads from existing Cursor database accessed via sql.js)  
**Testing**: @vscode/test-electron, manual testing with real Cursor session data  
**Target Platform**: VS Code extension environment (Windows, macOS, Linux)  
**Project Type**: Single project (VS Code extension)  
**Performance Goals**: <100ms rendering time per tool call, instant preview generation  
**Constraints**: Must handle large file content (>10MB) gracefully, maintain markdown rendering performance for sessions with multiple tool calls  
**Scale/Scope**: Extension of existing markdown renderer (~2000 LOC), adding 1 new rendering method + helpers (~150 LOC)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: No formal constitution file exists for this project. Applying standard VS Code extension development best practices:

- ✅ **Single Responsibility**: Feature only adds edit_file_v2 rendering, doesn't modify existing tool renderers
- ✅ **Existing Pattern Reuse**: Uses established utilities (safeParseJson, detectLanguageFromFilePath, generateDetailsBlock)
- ✅ **No Breaking Changes**: Purely additive change, doesn't alter existing tool rendering behavior
- ✅ **Error Handling**: Graceful degradation for malformed data (fallback values)
- ✅ **Testability**: Can be tested independently with mocked tool data

**Constitution Status**: PASS - No violations, follows established codebase patterns

## Project Structure

### Documentation (this feature)

```text
specs/006-edit-file-v2-support/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── markdown-renderer-extension.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── models/
│   └── sessionMarkdown.ts         # Existing: BubbleMarkdown, MarkdownRendererOptions
├── ui/
│   └── markdownRenderer.ts        # MODIFIED: Add renderEditFileV2Tool method
└── utils/
    └── logger.ts                   # Existing: Logger utility for debugging

tests/
├── unit/
│   └── markdownRenderer.test.ts   # NEW: Unit tests for renderEditFileV2Tool
└── integration/
    └── sessionMarkdown.test.ts     # MODIFIED: Add edit_file_v2 integration tests
```

**Structure Decision**: Single project structure maintained. Changes are localized to `src/ui/markdownRenderer.ts` with the addition of one new private method `renderEditFileV2Tool()`. No new files required except tests. This follows the existing pattern where each tool type has its own dedicated rendering method (e.g., `renderEditFileTool`, `renderGrepTool`, `renderWebSearchTool`).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - table not needed.

---

## Phase 0: Research & Technical Decisions

**Status**: ✅ Completed

See [research.md](./research.md) for detailed findings.

### Key Decisions

1. **Tool Detection Pattern**: Use exact name matching `edit_file_v2` in `renderToolDetails()` routing logic
2. **Content Truncation**: 500 characters (consistent with existing preview patterns in codebase)
3. **Icon Selection**: 📝 for edit actions, ✅ for completed, ⏳ for pending (matches existing tool icons)
4. **Error Handling**: Reuse existing `safeParseJson` utility, fallback to "Unknown file" for missing paths
5. **Language Detection**: Reuse `detectLanguageFromFilePath` for syntax highlighting in previews

---

## Phase 1: Design & Contracts

**Status**: ✅ Completed

### Data Model

See [data-model.md](./data-model.md) for complete entity definitions.

**Key Entities**:
- `EditFileV2ToolData`: Input structure from database
- `ContentStatistics`: Computed metrics (lines, chars, KB)
- `ContentPreview`: Truncated display data

### API Contracts

See [contracts/markdown-renderer-extension.md](./contracts/markdown-renderer-extension.md) for method signatures.

**New Method**:
```typescript
private renderEditFileV2Tool(toolData: any): string
```

**Integration Point**: Called from `renderToolDetails()` when `toolName === 'edit_file_v2'`

### Quickstart Guide

See [quickstart.md](./quickstart.md) for implementation walkthrough.

---

## Phase 2: Implementation Breakdown

**Note**: This phase creates tasks.md via `/speckit.tasks` command - NOT created by `/speckit.plan`.

See [tasks.md](./tasks.md) (created by `/speckit.tasks`) for detailed task breakdown.

---

## Dependencies & Integration Points

### Internal Dependencies

- **src/ui/markdownRenderer.ts**: 
  - `safeParseJson()`: Parse JSON-encoded params/result
  - `detectLanguageFromFilePath()`: Identify syntax highlighting
  - `generateDetailsBlock()`: Wrap in collapsible HTML
  - `matchesToolName()`: Route to correct renderer
  
- **src/utils/logger.ts**: 
  - `Logger.debug()`: Log parsing/rendering steps
  - `Logger.warn()`: Log fallback scenarios

### External Dependencies

None - feature uses existing dependencies only.

### Testing Dependencies

- Existing test infrastructure (`@vscode/test-electron`)
- Real Cursor session data with edit_file_v2 tool calls (for integration tests)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large file content (>10MB) causes memory issues | High | Truncate preview to 500 chars, don't store full content in memory |
| Nested JSON parsing failures | Medium | Use try-catch in safeParseJson, fallback to raw string display |
| Unknown user decision values | Low | Default to no icon if selectedOption not in known set |
| Path separator inconsistencies | Low | Normalize paths using existing path utilities |

---

## Rollout Plan

1. **Development**: Implement in feature branch `006-edit-file-v2-support`
2. **Testing**: Manual testing with real Cursor sessions containing edit_file_v2 calls
3. **Integration**: Merge to main branch after tests pass
4. **Monitoring**: Check logs for parsing failures in first week

**Rollback Strategy**: If issues found, tool will fall back to `renderUnknownTool()` display (existing safety net).

---

## Success Validation

Implementation complete when:

- ✅ All functional requirements (FR-001 to FR-013) implemented
- ✅ All acceptance scenarios pass
- ✅ Unit tests cover happy path + edge cases (5+ test cases)
- ✅ Integration test with real edit_file_v2 data passes
- ✅ Manual testing confirms: summaries display correctly, details expand properly, errors handled gracefully
- ✅ Performance: <100ms rendering per tool call (measured in tests)

**Verification Command**: 
```bash
npm run compile && npm test
```

---

**Plan Version**: 1.0  
**Last Updated**: 2026-01-20  
**Next Phase**: Execute `/speckit.tasks` to generate implementation tasks
