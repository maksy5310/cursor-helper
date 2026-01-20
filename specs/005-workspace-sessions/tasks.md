# Tasks: Cursor工作空间会话支持

**Input**: Design documents from `/specs/005-workspace-sessions/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are included for critical functionality to ensure quality.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **VS Code Extension**: `src/`, `tests/` at repository root
- All paths are relative to repository root: `f:\spec-kit\cursor-helper\`

---

## Phase 1: Setup (Type Definitions)

**Purpose**: Define TypeScript types and interfaces for workspace detection

- [ ] T001 [P] Define WorkspaceType interface in src/utils/workspaceHelper.ts
- [ ] T002 [P] Define WorkspaceInfo interface in src/utils/workspaceHelper.ts
- [ ] T003 [P] Define WorkspaceFolder interface in src/utils/workspaceHelper.ts
- [ ] T004 [P] Define SessionRecord type extension in src/dataAccess/databaseAccess.ts

---

## Phase 2: Foundational (Core Infrastructure)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Implement workspace type detection cache mechanism in src/utils/workspaceHelper.ts
- [ ] T006 Implement workspace database path cache mechanism in src/utils/workspaceHelper.ts
- [ ] T007 Add clearCache() method to WorkspaceHelper in src/utils/workspaceHelper.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 3 - 工作空间类型自动检测 (Priority: P2) 🎯 Foundation

**Goal**: 系统能够自动检测当前打开的是单根工作空间还是多根工作空间，无需用户手动配置。

**Independent Test**: 在不同类型的工作空间之间切换，验证系统能够正确识别工作空间类型。可以独立测试工作空间检测逻辑。

### Implementation for User Story 3

- [ ] T008 [US3] Implement isMultiRootWorkspace() method in src/utils/workspaceHelper.ts
- [ ] T009 [US3] Implement detectWorkspaceType() method in src/utils/workspaceHelper.ts
- [ ] T010 [US3] Implement getWorkspaceInfo() async method in src/utils/workspaceHelper.ts
- [ ] T011 [US3] Add workspace database path matching logic using CursorDataLocator in src/utils/workspaceHelper.ts
- [ ] T012 [P] [US3] Add unit tests for isMultiRootWorkspace() in tests/unit/workspaceHelper.test.ts
- [ ] T013 [P] [US3] Add unit tests for detectWorkspaceType() in tests/unit/workspaceHelper.test.ts
- [ ] T014 [P] [US3] Add unit tests for getWorkspaceInfo() in tests/unit/workspaceHelper.test.ts

**Checkpoint**: At this point, User Story 3 should be fully functional and testable independently. Workspace type detection works for both single-root and multi-root workspaces.

---

## Phase 4: User Story 1 - 自动识别工作空间类型并显示会话列表 (Priority: P1) 🎯 MVP

**Goal**: 用户在Cursor中打开一个工作空间（单个工程目录或多根工作空间），插件能够自动识别当前工作空间类型，并在会话列表面板中显示相应的会话历史。对于多根工作空间，会话列表应该整合所有子项目的会话，与Cursor AI面板中的显示保持一致。

**Independent Test**: 打开一个多根工作空间，验证会话列表面板显示所有子项目的会话，且与Cursor AI面板中的会话列表一致。可以独立验证工作空间类型识别和会话聚合功能。

### Implementation for User Story 1

- [ ] T015 [US1] Extend DatabaseAccess.initialize() to accept optional WorkspaceInfo parameter in src/dataAccess/databaseAccess.ts
- [ ] T016 [US1] Update DatabaseAccess.initialize() to use workspace file path for multi-root workspace matching in src/dataAccess/databaseAccess.ts
- [ ] T017 [US1] Extend DatabaseAccess.getSessionList() to accept optional WorkspaceInfo parameter in src/dataAccess/databaseAccess.ts
- [ ] T018 [US1] Update DatabaseAccess.getSessionList() to auto-detect workspace if WorkspaceInfo not provided in src/dataAccess/databaseAccess.ts
- [ ] T019 [US1] Update UnifiedSessionDataProvider.refresh() to accept optional WorkspaceInfo parameter in src/ui/unifiedSessionDataProvider.ts
- [ ] T020 [US1] Update UnifiedSessionDataProvider.refresh() to use WorkspaceHelper.getWorkspaceInfo() for auto-detection in src/ui/unifiedSessionDataProvider.ts
- [ ] T021 [US1] Update UnifiedSessionDataProvider.loadSessions() to use workspace-aware database access in src/ui/unifiedSessionDataProvider.ts
- [ ] T022 [US1] Add workspace folder change event listener in src/extension.ts
- [ ] T023 [US1] Implement workspace change handler to clear cache and refresh session list in src/extension.ts
- [ ] T024 [P] [US1] Add unit tests for DatabaseAccess.getSessionList() with WorkspaceInfo in tests/unit/databaseAccess.test.ts
- [ ] T025 [P] [US1] Add integration tests for multi-root workspace session loading in tests/integration/workspace-sessions.test.ts

**Checkpoint**: At this point, User Story 1 should be fully functional. Session list panel automatically detects workspace type and displays sessions correctly for both single-root and multi-root workspaces.

---

## Phase 5: User Story 2 - 会话列表与Cursor AI面板保持一致 (Priority: P1)

**Goal**: 在多根工作空间中，插件显示的会话列表必须与Cursor AI面板中显示的会话历史完全一致，包括会话数量、顺序和内容。

**Independent Test**: 在多根工作空间中，同时打开Cursor AI面板和插件会话列表，对比两者显示的会话，验证数量、顺序和基本信息的一致性。可以独立测试数据聚合逻辑。

### Implementation for User Story 2

- [ ] T026 [US2] Verify session list sorting matches Cursor AI panel (by lastUpdatedAt desc) in src/dataAccess/databaseAccess.ts
- [ ] T027 [US2] Ensure session count matches Cursor AI panel in src/dataAccess/databaseAccess.ts
- [ ] T028 [US2] Ensure session IDs match Cursor AI panel in src/dataAccess/databaseAccess.ts
- [ ] T029 [US2] Add validation to ensure session list consistency in src/ui/unifiedSessionDataProvider.ts
- [ ] T030 [US2] Add logging for session list comparison debugging in src/ui/unifiedSessionDataProvider.ts
- [ ] T031 [P] [US2] Add manual test checklist for comparing with Cursor AI panel in specs/005-workspace-sessions/TEST_CHECKLIST.md
- [ ] T032 [P] [US2] Add integration test for session list consistency in tests/integration/workspace-sessions.test.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Session list matches Cursor AI panel exactly in multi-root workspaces.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T033 [P] Add error handling for database path matching failures in src/utils/workspaceHelper.ts
- [ ] T034 [P] Add error handling for database access failures in src/dataAccess/databaseAccess.ts
- [ ] T035 [P] Add performance logging for workspace detection timing in src/utils/workspaceHelper.ts
- [ ] T036 [P] Add performance logging for session list loading timing in src/dataAccess/databaseAccess.ts
- [ ] T037 [P] Optimize cache invalidation on workspace folder changes in src/utils/workspaceHelper.ts
- [ ] T038 [P] Add graceful degradation when workspace database is unavailable in src/dataAccess/databaseAccess.ts
- [ ] T039 [P] Update quickstart.md with usage examples in specs/005-workspace-sessions/quickstart.md
- [ ] T040 [P] Add edge case handling documentation in specs/005-workspace-sessions/EDGE_CASES.md
- [ ] T041 Run quickstart.md validation and update if needed
- [ ] T042 Code cleanup and refactoring review
- [ ] T043 Performance validation against success criteria (SC-001, SC-003, SC-004)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 3 (Phase 3)**: Depends on Foundational completion - Foundation for other stories
- **User Story 1 (Phase 4)**: Depends on User Story 3 completion (needs workspace detection)
- **User Story 2 (Phase 5)**: Depends on User Story 1 completion (needs session list functionality)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
  - **Why first**: Provides workspace detection foundation needed by US1 and US2
- **User Story 1 (P1)**: Depends on User Story 3 completion
  - **Why**: Needs workspace type detection to work correctly
- **User Story 2 (P1)**: Depends on User Story 1 completion
  - **Why**: Needs session list functionality to verify consistency

### Within Each User Story

- Type definitions before implementation
- Core methods before integration
- Implementation before tests
- Unit tests before integration tests
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: All type definition tasks (T001-T004) can run in parallel
- **Phase 2**: Cache mechanism tasks can be sequential (they're related)
- **Phase 3**: Test tasks (T012-T014) can run in parallel after implementation
- **Phase 4**: Test tasks (T024-T025) can run in parallel after implementation
- **Phase 5**: Test tasks (T031-T032) can run in parallel
- **Phase 6**: Most polish tasks (T033-T040) can run in parallel

---

## Parallel Example: Phase 1 (Setup)

```bash
# Launch all type definition tasks together:
Task: "Define WorkspaceType interface in src/utils/workspaceHelper.ts"
Task: "Define WorkspaceInfo interface in src/utils/workspaceHelper.ts"
Task: "Define WorkspaceFolder interface in src/utils/workspaceHelper.ts"
Task: "Define SessionRecord type extension in src/dataAccess/databaseAccess.ts"
```

## Parallel Example: Phase 3 (User Story 3)

```bash
# After implementation tasks complete, launch all tests together:
Task: "Add unit tests for isMultiRootWorkspace() in tests/unit/workspaceHelper.test.ts"
Task: "Add unit tests for detectWorkspaceType() in tests/unit/workspaceHelper.test.ts"
Task: "Add unit tests for getWorkspaceInfo() in tests/unit/workspaceHelper.test.ts"
```

## Parallel Example: Phase 6 (Polish)

```bash
# Launch most polish tasks together:
Task: "Add error handling for database path matching failures in src/utils/workspaceHelper.ts"
Task: "Add error handling for database access failures in src/dataAccess/databaseAccess.ts"
Task: "Add performance logging for workspace detection timing in src/utils/workspaceHelper.ts"
Task: "Add performance logging for session list loading timing in src/dataAccess/databaseAccess.ts"
Task: "Optimize cache invalidation on workspace folder changes in src/utils/workspaceHelper.ts"
Task: "Add graceful degradation when workspace database is unavailable in src/dataAccess/databaseAccess.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 3 + 1)

1. Complete Phase 1: Setup (Type Definitions)
2. Complete Phase 2: Foundational (Cache Infrastructure)
3. Complete Phase 3: User Story 3 (Workspace Detection)
4. Complete Phase 4: User Story 1 (Session List Display)
5. **STOP and VALIDATE**: Test User Stories 3 and 1 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 3 → Test independently → Foundation complete
3. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
4. Add User Story 2 → Test independently → Deploy/Demo (Full Feature)
5. Add Polish → Final validation → Production ready

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 3 (Foundation)
   - Developer B: Prepare for User Story 1 (Review contracts, data model)
3. Once User Story 3 is done:
   - Developer A: User Story 1 (Core functionality)
   - Developer B: User Story 2 (Consistency validation)
4. Stories complete and integrate independently

---

## Notes

- **[P] tasks** = different files, no dependencies
- **[Story] label** maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **User Story 3 is implemented first** even though it's P2, because it provides foundation for P1 stories
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Performance targets: <1s detection (SC-001), <2s update (SC-003), <3s load (SC-004)
- Consistency target: 100% match with Cursor AI panel (SC-002)

---

## Task Summary

- **Total Tasks**: 43
- **Phase 1 (Setup)**: 4 tasks
- **Phase 2 (Foundational)**: 3 tasks
- **Phase 3 (User Story 3)**: 7 tasks
- **Phase 4 (User Story 1)**: 11 tasks
- **Phase 5 (User Story 2)**: 7 tasks
- **Phase 6 (Polish)**: 11 tasks

- **Parallel Opportunities**: 
  - Phase 1: 4 tasks can run in parallel
  - Phase 3: 3 test tasks can run in parallel
  - Phase 4: 2 test tasks can run in parallel
  - Phase 5: 2 test tasks can run in parallel
  - Phase 6: 9 tasks can run in parallel

- **Independent Test Criteria**:
  - **US3**: Switch between workspace types, verify correct detection
  - **US1**: Open multi-root workspace, verify session list displays correctly
  - **US2**: Compare plugin session list with Cursor AI panel, verify 100% match

- **Suggested MVP Scope**: 
  - Phase 1 + Phase 2 + Phase 3 + Phase 4 (User Stories 3 and 1)
  - This provides core functionality: workspace detection and session list display
