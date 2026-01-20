# Tasks: 上传表单自动填充

**Feature**: 001-auto-fill-upload-form  
**Date**: 2026-01-15  
**Input**: Design documents from `/specs/001-auto-fill-upload-form/`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependencies

- [x] T001 Add jose ^5.0.0 dependency to package.json for JWT parsing
- [x] T002 Add node-fetch ^3.0.0 dependency to package.json for avatar downloads
- [x] T003 [P] Create default avatar SVG in resources/default-avatar.svg
- [x] T004 [P] Update package.json to include onUri activation event for URI callbacks
- [x] T005 Install npm dependencies with npm install

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 [P] Create UserProfile interface in src/models/userProfile.ts
- [x] T007 [P] Create JWTToken type and JWTPayload interface in src/models/auth.ts
- [x] T008 [P] Implement jwtParser utility in src/utils/jwtParser.ts for parsing JWT payload
- [x] T009 Implement TokenManager for JWT storage/retrieval in src/utils/tokenManager.ts using SecretStorage API
- [x] T010 [P] Create AvatarCacheEntry interface in src/models/userProfile.ts
- [x] T011 [P] Implement AvatarLoader utility in src/utils/avatarLoader.ts with three-level fallback (backend → Gravatar → default SVG)
- [x] T012 [P] Implement WorkspaceHelper utility in src/utils/workspaceHelper.ts for getting current project name
- [x] T013 Implement AuthService in src/services/authService.ts for JWT authentication flow
- [x] T014 Implement UserProfileService in src/services/userProfileService.ts for managing user profile cache
- [x] T015 Implement AuthUriHandler in src/utils/uriHandler.ts for handling cursor:// callbacks with JWT token
- [x] T016 Register AuthUriHandler in src/extension.ts activation function
- [x] T017 Update API client in src/utils/apiClient.ts to inject JWT token in Authorization header and handle 401 responses

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 4 - 侧边栏个人信息显示 (Priority: P1) 🎯 MVP Component

**Goal**: Display user information (avatar, nickname, email) in the sidebar panel above session list, with login/logout buttons

**Independent Test**: Open sidebar panel and verify user info area displays correctly for both logged-in and logged-out states

**Dependencies**: Must complete after Phase 2 (Foundational), can run in parallel with US1/US2/US3

### Implementation for User Story 4

- [x] T018 [P] [US4] Create UserInfoTreeItem class in src/ui/userInfoTreeItem.ts for displaying user info in TreeView
- [x] T019 [P] [US4] Create UserInfoTreeDataProvider in src/ui/userInfoTreeItem.ts to provide data for TreeView
- [x] T020 [US4] Register UserInfoTreeView in package.json under contributes.views for cursor-assistant viewContainer
- [x] T021 [US4] Implement login command in src/commands/login.ts to open browser for authentication
- [x] T022 [P] [US4] Implement logout command in src/commands/logout.ts to clear tokens and refresh UI
- [x] T023 [P] [US4] Implement openUserCenter command in src/commands/openUserCenter.ts to open personal center page in browser
- [x] T024 [P] [US4] Implement refreshUserInfo command in src/commands/refreshUserInfo.ts to manually refresh user info display
- [x] T025 [US4] Register login, logout, openUserCenter, refreshUserInfo commands in package.json under contributes.commands
- [x] T026 [US4] Add configuration for cursor-helper.userCenter.url in package.json under contributes.configuration
- [x] T027 [US4] Integrate UserInfoTreeView in src/extension.ts activation function
- [x] T028 [US4] Add event listeners in src/extension.ts to update UserInfoTreeView on profile changes
- [x] T029 [US4] Add logout button to TreeView item inline menu in package.json under contributes.menus

**Checkpoint**: User Story 4 should be fully functional - users can see their profile, login/logout, and access user center

---

## Phase 4: User Story 1 - 邮箱自动填充 (Priority: P1) 🎯 MVP Component

**Goal**: Auto-fill the email field in the upload form with the currently logged-in user's email address

**Independent Test**: Login, open upload form, verify email field is auto-filled with current user's email

**Dependencies**: Must complete after Phase 2 (Foundational), can run in parallel with US2/US3/US4

### Implementation for User Story 1

- [x] T030 [US1] Update UploadFormPanel WebView in src/ui/uploadFormPanel.ts to request auto-fill data on load
- [x] T031 [US1] Implement getAutoFillEmail method in UserProfileService to retrieve email from cached profile
- [x] T032 [US1] Add message handler in src/ui/uploadFormPanel.ts to respond to auto-fill requests with user email
- [x] T033 [US1] Update WebView HTML/JavaScript to auto-fill email field when receiving auto-fill data
- [x] T034 [US1] Add validation in WebView to ensure auto-filled email is in valid format
- [x] T035 [US1] Handle case when user is not logged in - keep email field empty with placeholder text
- [x] T036 [US1] Handle case when JWT is expired - trigger re-login flow when receiving 401 response

**Checkpoint**: User Story 1 should be fully functional - email auto-fills correctly, users can still modify it

---

## Phase 5: User Story 2 - 项目名称自动填充 (Priority: P1) 🎯 MVP Component

**Goal**: Auto-fill the project name field in the upload form with the current workspace name

**Independent Test**: Open upload form in a workspace, verify project name field is auto-filled with workspace name

**Dependencies**: Must complete after Phase 2 (Foundational), can run in parallel with US1/US3/US4

### Implementation for User Story 2

- [x] T037 [US2] Implement getCurrentWorkspaceName method in src/utils/workspaceHelper.ts to get active workspace name
- [x] T038 [US2] Add getAutoFillProjectName method in UploadFormPanel to retrieve project name from WorkspaceHelper
- [x] T039 [US2] Update message handler in src/ui/uploadFormPanel.ts to include project name in auto-fill response
- [x] T040 [US2] Update WebView HTML/JavaScript to auto-fill project name field when receiving auto-fill data
- [x] T041 [US2] Handle case when no workspace is open - keep project name field empty with placeholder text
- [x] T042 [US2] Allow users to manually modify auto-filled project name

**Checkpoint**: User Story 2 should be fully functional - project name auto-fills correctly, users can still modify it

---

## Phase 6: User Story 3 - 表单重置后保持自动填充 (Priority: P2)

**Goal**: Re-apply auto-fill for email and project name when the upload form is reset

**Independent Test**: Open form, modify fields, click reset, verify email and project name are re-auto-filled

**Dependencies**: Must complete after US1 and US2 are implemented

### Implementation for User Story 3

- [x] T043 [US3] Add reset button event listener in WebView JavaScript
- [x] T044 [US3] Implement resetForm function in WebView to clear all fields
- [x] T045 [US3] Trigger auto-fill request after form reset is complete
- [x] T046 [US3] Verify email and project name fields are re-populated with original auto-fill values
- [x] T047 [US3] Ensure other form fields (content, composer_id) remain empty after reset

**Checkpoint**: User Story 3 should be fully functional - form reset properly re-applies auto-fill

---

## Phase 7: Integration & Error Handling

**Purpose**: Ensure all user stories work together seamlessly and handle edge cases

- [x] T048 [P] Add comprehensive error handling for JWT parsing failures in jwtParser.ts
- [x] T049 [P] Add timeout handling (5s for backend avatar, 3s for Gravatar) in avatarLoader.ts
- [x] T050 [P] Add error logging for authentication failures in authService.ts
- [ ] T051 Test complete login flow: browser login → URI callback → JWT storage → profile display (⚠️ MANUAL TEST REQUIRED)
- [ ] T052 Test complete upload flow: open form → verify auto-fill → modify fields → submit (⚠️ MANUAL TEST REQUIRED)
- [ ] T053 Test logout flow: click logout → verify token cleared → verify UI updates to logged-out state (⚠️ MANUAL TEST REQUIRED)
- [ ] T054 Test JWT expiry flow: simulate expired JWT → trigger upload → verify 401 handling → verify re-login prompt (⚠️ MANUAL TEST REQUIRED)
- [ ] T055 Test form reset flow: fill form → reset → verify auto-fill re-applied (⚠️ MANUAL TEST REQUIRED)
- [ ] T056 [P] Test avatar loading fallback: invalid backend URL → Gravatar fallback → default SVG (⚠️ MANUAL TEST REQUIRED)
- [ ] T057 [P] Test offline scenario: no network → verify cached profile is used → verify default avatar (⚠️ MANUAL TEST REQUIRED)
- [ ] T058 Test edge case: no workspace open → verify project name field is empty with placeholder (⚠️ MANUAL TEST REQUIRED)
- [ ] T059 Test edge case: user profile has no nickname → verify email local part is used as display name (⚠️ MANUAL TEST REQUIRED)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T060 [P] Add inline documentation (JSDoc) for all public methods in services and utilities
- [x] T061 [P] Optimize avatar caching to reduce redundant network requests
- [x] T062 [P] Add performance logging to measure auto-fill response time (target <100ms)
- [x] T063 [P] Add user-facing error messages for common failure scenarios (network error, auth error)
- [ ] T064 [P] Update README.md with setup instructions for cursor-helper extension (⚠️ DOCUMENTATION TASK)
- [ ] T065 Validate implementation against quickstart.md scenarios (⚠️ MANUAL VALIDATION REQUIRED)
- [x] T066 Code cleanup: remove any OAuth 2.0 or refresh token related code if it exists
- [x] T067 [P] Security audit: ensure JWT is only stored in SecretStorage, never in logs or plain text
- [x] T068 [P] Accessibility: ensure TreeView items have proper labels and descriptions
- [x] T069 Run final build and verify no TypeScript compilation errors
- [ ] T070 Test all acceptance scenarios from spec.md for each user story (⚠️ MANUAL TEST REQUIRED)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 4 (Phase 3)**: Depends on Foundational (Phase 2) - No dependencies on other stories
- **User Story 1 (Phase 4)**: Depends on Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (Phase 5)**: Depends on Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (Phase 6)**: Depends on US1 (Phase 4) and US2 (Phase 5) completion
- **Integration (Phase 7)**: Depends on all user stories (Phase 3-6) being complete
- **Polish (Phase 8)**: Depends on Integration (Phase 7) completion

### User Story Dependencies

- **User Story 4 (P1)**: Can start after Foundational (Phase 2) - Independently testable
- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Independently testable
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independently testable
- **User Story 3 (P2)**: Depends on US1 and US2 - Tests the reset functionality for auto-filled fields

### Within Each User Story

- Commands can be implemented in parallel (marked with [P])
- UI components must be registered in package.json after creation
- Integration with extension.ts happens after individual components are complete

### Parallel Opportunities

**Phase 1 (Setup)**: T001, T002, T003, T004 can all run in parallel

**Phase 2 (Foundational)**: T006, T007, T008, T010, T011, T012 can run in parallel (different files)

**After Foundational Complete**: All of US4 (Phase 3), US1 (Phase 4), US2 (Phase 5) can start in parallel if team capacity allows

**Within US4**: T018, T019, T022, T023, T024 can run in parallel (different files)

**Phase 7 (Integration)**: T048, T049, T050, T056, T057 can run in parallel (different files)

**Phase 8 (Polish)**: T060, T061, T062, T063, T064, T067, T068 can run in parallel (different tasks)

---

## Parallel Example: Foundational Phase

```bash
# Launch all model/interface creation together:
Task T006: "Create UserProfile interface in src/models/userProfile.ts"
Task T007: "Create JWTToken type and JWTPayload interface in src/models/auth.ts"
Task T010: "Create AvatarCacheEntry interface in src/models/userProfile.ts"

# Wait for models, then launch utilities in parallel:
Task T008: "Implement jwtParser utility in src/utils/jwtParser.ts"
Task T011: "Implement AvatarLoader utility in src/utils/avatarLoader.ts"
Task T012: "Implement WorkspaceHelper utility in src/utils/workspaceHelper.ts"
```

## Parallel Example: User Story 4

```bash
# Launch all command implementations together:
Task T022: "Implement logout command in src/commands/logout.ts"
Task T023: "Implement openUserCenter command in src/commands/openUserCenter.ts"
Task T024: "Implement refreshUserInfo command in src/commands/refreshUserInfo.ts"

# Launch UI components in parallel:
Task T018: "Create UserInfoTreeItem class in src/ui/userInfoTreeItem.ts"
Task T019: "Create UserInfoTreeDataProvider in src/ui/userInfoTreeItem.ts"
```

---

## Implementation Strategy

### MVP First (All P1 User Stories)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 4 (侧边栏个人信息显示)
4. Complete Phase 4: User Story 1 (邮箱自动填充)
5. Complete Phase 5: User Story 2 (项目名称自动填充)
6. **STOP and VALIDATE**: Test all P1 stories independently
7. Demo/Deploy MVP with core functionality

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 4 → Test independently → Users can manage login/logout
3. Add User Story 1 → Test independently → Email auto-fills in upload form
4. Add User Story 2 → Test independently → Project name auto-fills in upload form
5. Add User Story 3 → Test independently → Form reset works correctly
6. Integration testing → Verify all stories work together
7. Polish → Final cleanup and documentation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 4 (侧边栏个人信息显示)
   - Developer B: User Story 1 (邮箱自动填充)
   - Developer C: User Story 2 (项目名称自动填充)
3. Developer D: User Story 3 after US1 and US2 complete
4. All developers: Integration testing and polish

---

## Summary

- **Total Tasks**: 70
- **Setup Tasks**: 5 (Phase 1)
- **Foundational Tasks**: 12 (Phase 2) - BLOCKING
- **User Story 4 Tasks**: 12 (Phase 3) - P1 Priority
- **User Story 1 Tasks**: 7 (Phase 4) - P1 Priority
- **User Story 2 Tasks**: 6 (Phase 5) - P1 Priority
- **User Story 3 Tasks**: 5 (Phase 6) - P2 Priority
- **Integration Tasks**: 12 (Phase 7)
- **Polish Tasks**: 11 (Phase 8)

**Parallel Opportunities**: 24 tasks marked with [P] can run in parallel with other tasks in their phase

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 (42 tasks total)

**Independent Test Criteria**:
- US4: Can login, view profile, logout independently
- US1: Can see email auto-fill without project name feature
- US2: Can see project name auto-fill without email feature
- US3: Can test reset without affecting US1/US2 functionality

---

## Notes

- All tasks follow the checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
- [P] tasks indicate parallelizable work (different files, no dependencies)
- [Story] labels map tasks to specific user stories for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **IMPORTANT**: This implementation uses simple JWT authentication, NOT OAuth 2.0
- **IMPORTANT**: No refresh token support - JWT expiry requires re-login
- Verify all acceptance scenarios from spec.md after each story completion
