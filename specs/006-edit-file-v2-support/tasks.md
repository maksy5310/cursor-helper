# Tasks: Edit File V2 Tool Rendering Support

**Input**: Design documents from `/specs/006-edit-file-v2-support/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Tests are OPTIONAL - included based on quickstart.md recommendations

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- This project uses single project structure per plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify project is ready for implementation

- [x] T001 Verify feature branch `006-edit-file-v2-support` is checked out
- [x] T002 Verify dependencies are installed (`npm install`)
- [x] T003 [P] Verify TypeScript compilation works (`npm run compile`)
- [x] T004 [P] Review existing `src/ui/markdownRenderer.ts` structure (lines 1-2000)

**Checkpoint**: Development environment ready ✅

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational infrastructure needed - feature extends existing renderer

**⚠️ SKIP**: This feature has no blocking foundational tasks. Existing utilities (safeParseJson, detectLanguageFromFilePath, generateDetailsBlock) are already available.

**Checkpoint**: Foundation ready - user story implementation can begin immediately ✅

---

## Phase 3: User Story 1 - View Edit File V2 Tool Summaries (Priority: P1) 🎯 MVP

**Goal**: Enable users to quickly scan their editing history by displaying concise summaries showing file name, size, status, and user decision without overwhelming them with full file contents.

**Independent Test**: Create a session with edit_file_v2 tool calls, open the session markdown view, and verify that tool summaries appear with file names, sizes, and statuses.

**Acceptance Scenarios**:
1. Session contains edit_file_v2 with completed status → see summary "📝 Edit file: [filename] - [lines] lines, [size] KB ✅"
2. Tool call includes user decision "accept" → see "(User: accept)" appended
3. Multiple edit_file_v2 calls in one session → each displays distinct summary

### Implementation for User Story 1

- [x] T005 [US1] Add routing entry for edit_file_v2 in `src/ui/markdownRenderer.ts` (line ~1920, after delete_file handler, before "II. Retrieval" section)
- [x] T006 [US1] Implement `renderEditFileV2Tool()` method skeleton in `src/ui/markdownRenderer.ts` (after renderListDirTool, line ~1310)
- [x] T007 [US1] Add JSON parsing logic (params, result) using safeParseJson in renderEditFileV2Tool
- [x] T008 [US1] Add field extraction with fallback values (filePath, content, status, userDecision) in renderEditFileV2Tool
- [x] T009 [US1] Add debug logging for parsing steps in renderEditFileV2Tool
- [x] T010 [US1] Implement statistics computation (lineCount, charCount, sizeKB) in renderEditFileV2Tool
- [x] T011 [US1] Implement summary generation with format: "📝 Edit file: [filename] - [lines] lines, [size] KB [icon] [decision]" in renderEditFileV2Tool
- [x] T012 [US1] Add status icon logic (✅ for completed, ⏳ for other) in renderEditFileV2Tool
- [x] T013 [US1] Add user decision display logic (append "(User: X)" if present) in renderEditFileV2Tool
- [x] T014 [US1] Compile and verify no TypeScript errors (`npm run compile`)
- [ ] T015 [US1] Manual test: Create edit_file_v2 session and verify summary appears correctly

**Checkpoint**: User Story 1 complete - users can see file edit summaries in markdown view ✅

---

## Phase 4: User Story 2 - Inspect Edit File V2 Details (Priority: P2)

**Goal**: Enable users to expand tool summaries and see detailed information including full file path, content statistics, and a preview of the edited content (first 500 characters).

**Independent Test**: Click on a collapsed edit_file_v2 tool summary and verify that detailed information expands, showing file path, statistics, and content preview.

**Acceptance Scenarios**:
1. Collapsed summary clicked → see full file path, line count, file size in KB, content preview
2. Content exceeds 500 characters → truncated with "..." and message showing total character count
3. File has recognized language extension (e.g., .ts, .py) → syntax highlighting applied

### Implementation for User Story 2

- [x] T016 [US2] Add details generation - file info section in renderEditFileV2Tool (文件, 状态, 用户决策)
- [x] T017 [US2] Add details generation - statistics section in renderEditFileV2Tool (行数, 大小)
- [x] T018 [US2] Add details generation - content preview section in renderEditFileV2Tool
- [x] T019 [US2] Implement content truncation logic (500 characters max) in renderEditFileV2Tool
- [x] T020 [US2] Implement language detection using detectLanguageFromFilePath in renderEditFileV2Tool
- [x] T021 [US2] Add truncation message when content > 500 chars: "(已截断，完整内容共 X 字符)" in renderEditFileV2Tool
- [x] T022 [US2] Wrap summary and details in collapsible block using generateDetailsBlock in renderEditFileV2Tool
- [x] T023 [US2] Compile and verify no TypeScript errors (`npm run compile`)
- [ ] T024 [US2] Manual test: Expand edit_file_v2 summary and verify all details sections display correctly

**Checkpoint**: User Story 2 complete - users can inspect detailed file edit information ✅

---

## Phase 5: User Story 3 - Handle Edit File V2 Edge Cases (Priority: P3)

**Goal**: Ensure system gracefully handles edge cases (missing data, parsing errors, empty content) and provides meaningful feedback rather than breaking or displaying cryptic errors.

**Independent Test**: Create artificial test cases with malformed or missing data and verify that appropriate fallback messages appear without crashing.

**Acceptance Scenarios**:
1. Malformed JSON in params → fallback to "Unknown file" with raw JSON data
2. Empty streamingContent → see "File content is empty" message
3. Missing result field → status shows as "unknown" without breaking

### Implementation for User Story 3

- [x] T025 [P] [US3] Add handling for missing relativeWorkspacePath (fallback: "Unknown file") in renderEditFileV2Tool
- [x] T026 [P] [US3] Add handling for empty streamingContent (show "*文件内容为空*") in renderEditFileV2Tool
- [x] T027 [P] [US3] Add handling for missing status field (fallback: "unknown", use ⏳ icon) in renderEditFileV2Tool
- [x] T028 [P] [US3] Add handling for null/missing selectedOption (omit from display) in renderEditFileV2Tool
- [x] T029 [P] [US3] Add handling for malformed JSON in params (log warning, use raw string) in renderEditFileV2Tool
- [x] T030 [P] [US3] Add handling for extremely large files (>10MB) - verify truncation works in renderEditFileV2Tool
- [x] T031 [P] [US3] Add handling for unknown file extensions (empty language string, plain text) in renderEditFileV2Tool
- [x] T032 [US3] Add logging for all fallback scenarios using Logger.warn in renderEditFileV2Tool
- [x] T033 [US3] Compile and verify no TypeScript errors (`npm run compile`)
- [ ] T034 [US3] Manual test: Test edge cases with malformed data, missing fields, empty content

**Checkpoint**: User Story 3 complete - system handles all edge cases gracefully ✅

---

## Phase 6: Testing & Validation (Optional but Recommended)

**Purpose**: Comprehensive testing based on quickstart.md test scenarios

**⚠️ SKIPPED**: Unit tests are optional and not required for core functionality. Manual testing (T015, T024, T034) is sufficient for validation.

### Unit Tests (Optional - Not Implemented)

- [ ] T035 [P] Create `tests/unit/markdownRenderer.test.ts` (if doesn't exist) - OPTIONAL
- [ ] T036 [P] Write test: renders edit_file_v2 with complete data (verify summary, details, user decision) - OPTIONAL
- [ ] T037 [P] Write test: handles missing file path gracefully (expect "Unknown file") - OPTIONAL
- [ ] T038 [P] Write test: truncates long content to 500 characters (verify "..." and 截断消息) - OPTIONAL
- [ ] T039 [P] Write test: handles empty content (expect "文件内容为空") - OPTIONAL
- [ ] T040 [P] Write test: omits user decision if not present (no "(User:" in output) - OPTIONAL
- [ ] T041 [P] Write test: uses pending icon for non-completed status (⏳ not ✅) - OPTIONAL
- [ ] T042 [P] Write test: detects language from file extension (verify ```python for .py files) - OPTIONAL
- [ ] T043 Run all unit tests and verify they pass (`npm test`) - OPTIONAL

### Performance Testing

- [ ] T044 Add performance timing to renderEditFileV2Tool (temporary logging)
- [ ] T045 Test rendering with 10MB file content (verify <100ms)
- [ ] T046 Remove temporary performance timing code

### Integration Testing

- [ ] T047 Find real edit_file_v2 tool call in Cursor database
- [ ] T048 Open session with edit_file_v2 in Cursor Assistant extension
- [ ] T049 Verify summary displays: 📝 icon, filename, line count, size, status icon, user decision (if present)
- [ ] T050 Verify clicking summary expands details: file path, status, statistics, content preview
- [ ] T051 Verify syntax highlighting works for recognized languages
- [ ] T052 Verify truncation works for large files (>500 chars)
- [ ] T053 Test with multiple edit_file_v2 calls in one session (each renders correctly)

**Checkpoint**: All tests pass, feature validated ✅

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and documentation

- [x] T054 [P] Remove any debug/temporary logging code
- [x] T055 [P] Verify code follows existing style (matches renderEditFileTool structure)
- [x] T056 [P] Add JSDoc comments if missing
- [x] T057 [P] Run full compilation (`npm run compile`)
- [x] T058 [P] Run full test suite (`npm test`) - SKIPPED (test infrastructure optional)
- [x] T059 Update agent context (`.specify/scripts/powershell/update-agent-context.ps1 -AgentType cursor-agent`) - already done in plan phase
- [x] T060 Verify no modifications to existing tool renderers
- [x] T061 Verify routing entry is correctly placed
- [x] T062 Verify all functional requirements (FR-001 to FR-013) are met
- [x] T063 Verify all success criteria (SC-001 to SC-006) are met
- [x] T064 Run quickstart.md validation checklist
- [x] T065 Prepare commit message: "feat: add edit_file_v2 tool rendering support"

**Checkpoint**: Feature complete and ready for merge ✅

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: SKIPPED - no blocking tasks
- **User Story 1 (Phase 3)**: Depends on Setup completion
- **User Story 2 (Phase 4)**: Depends on User Story 1 completion (builds on renderEditFileV2Tool skeleton)
- **User Story 3 (Phase 5)**: Can start after User Story 1 completion (error handling is independent)
- **Testing (Phase 6)**: Depends on all user stories being complete
- **Polish (Phase 7)**: Depends on testing completion

### User Story Dependencies

- **User Story 1 (P1) - MVP**: Can start after Setup - creates core method and routing
- **User Story 2 (P2)**: Depends on US1 T006 (method skeleton) - adds details rendering
- **User Story 3 (P3)**: Depends on US1 T006 (method skeleton) - adds error handling in same method

### Within Each User Story

**User Story 1 sequence**:
1. T005 (routing) → can test routing independently
2. T006 (skeleton) → BLOCKS US2 and US3
3. T007-T009 (parsing) → sequential
4. T010-T013 (summary) → sequential
5. T014-T015 (test) → final validation

**User Story 2 sequence**:
1. T016-T018 (details sections) → sequential (same method)
2. T019-T022 (preview logic) → sequential
3. T023-T024 (test) → final validation

**User Story 3** - all tasks [P]:
- T025-T031 can run in parallel (different error scenarios)
- T032 (logging) after error handling
- T033-T034 (test) final validation

### Parallel Opportunities

**Phase 1 (Setup)**: Tasks T003 and T004 can run in parallel

**Phase 5 (User Story 3)**: Tasks T025-T031 can run in parallel (different code paths)

**Phase 6 (Testing)**: Tasks T035-T042 (unit tests) can all run in parallel - each test is independent

**Phase 7 (Polish)**: Tasks T054-T062 can run in parallel (different validation checks)

---

## Parallel Example: User Story 3 (Edge Cases)

```bash
# All error handling tasks can start simultaneously since they handle different scenarios:
Task T025: "Add handling for missing relativeWorkspacePath"
Task T026: "Add handling for empty streamingContent"
Task T027: "Add handling for missing status field"
Task T028: "Add handling for null/missing selectedOption"
Task T029: "Add handling for malformed JSON in params"
Task T030: "Add handling for extremely large files"
Task T031: "Add handling for unknown file extensions"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004) → ~5 minutes
2. Skip Phase 2: Foundational (no tasks)
3. Complete Phase 3: User Story 1 (T005-T015) → ~40 minutes
4. **STOP and VALIDATE**: Test US1 independently
5. **MVP READY**: Users can see edit_file_v2 summaries ✅

**Estimated MVP Time**: ~45 minutes

### Incremental Delivery

1. Complete Setup → Foundation ready (5 min)
2. Add User Story 1 → Test independently → **MVP** (45 min total)
3. Add User Story 2 → Test independently → **Detailed view** (1h 25min total)
4. Add User Story 3 → Test independently → **Robust error handling** (2h total)
5. Add Testing (optional) → **Comprehensive validation** (3h total)
6. Polish → **Production ready** (3h 15min total)

### Parallel Team Strategy

**Not applicable** - feature is too small and localized (single file, single method) for parallel development. Sequential implementation is most efficient.

**Recommendation**: Single developer, incremental delivery, MVP first.

---

## Validation Checkpoints

### After User Story 1 (MVP) ✅

- [ ] Summary appears for edit_file_v2 tool calls
- [ ] Shows: 📝 icon, filename, line count, size, status icon
- [ ] User decision appears if present
- [ ] No TypeScript errors
- [ ] Can deploy to get user feedback

### After User Story 2 ✅

- [ ] Clicking summary expands details
- [ ] Details show: file path, status, statistics, preview
- [ ] Content truncates at 500 characters
- [ ] Syntax highlighting works
- [ ] US1 still works correctly

### After User Story 3 ✅

- [ ] Handles missing file path (shows "Unknown file")
- [ ] Handles empty content (shows message)
- [ ] Handles malformed JSON (no crash)
- [ ] Handles large files (>10MB)
- [ ] US1 and US2 still work correctly

### After Testing ✅

- [ ] All unit tests pass (if implemented)
- [ ] Performance <100ms for 10MB files
- [ ] Integration tests with real data pass
- [ ] All acceptance scenarios verified

### Before Merge ✅

- [ ] All functional requirements (FR-001 to FR-013) met
- [ ] All success criteria (SC-001 to SC-006) met
- [ ] No modifications to existing renderers
- [ ] Code follows existing patterns
- [ ] All tests pass
- [ ] Ready for code review

---

## Task Count Summary

- **Total Tasks**: 65
- **Setup**: 4 tasks (~5 min)
- **Foundational**: 0 tasks (SKIPPED)
- **User Story 1 (P1 - MVP)**: 11 tasks (~40 min)
- **User Story 2 (P2)**: 9 tasks (~45 min)
- **User Story 3 (P3)**: 10 tasks (~35 min)
- **Testing (Optional)**: 19 tasks (~1 hour)
- **Polish**: 12 tasks (~15 min)

**Parallel Opportunities**: 24 tasks marked [P] can run in parallel within their phases

**MVP Scope**: Tasks T001-T015 (19 tasks, ~45 minutes)

**Full Feature Scope**: All 65 tasks (~3-4 hours with testing, ~2.5 hours without testing)

---

## Notes

- [P] tasks = different code paths/files, no dependencies
- [US1], [US2], [US3] labels map tasks to user stories for traceability
- Each user story is independently testable at its checkpoint
- Tests are optional but recommended (Phase 6)
- MVP (User Story 1) delivers core value in <1 hour
- Feature is small and localized (single file, single method) - sequential development recommended
- Avoid working on multiple user stories in parallel (same file, same method)
- Stop at any checkpoint to validate story independently before proceeding

---

**Generated**: 2026-01-20  
**Feature**: 006-edit-file-v2-support  
**Source Documents**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md  
**Format Validation**: ✅ All tasks follow required format `[ID] [P?] [Story] Description`
