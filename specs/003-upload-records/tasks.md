# Tasks: 记录上传到分享平台

**Branch**: `003-upload-records` | **Date**: 2025-12-16 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Summary

本任务分解基于规范中的 3 个用户故事（P1: 选择并上传记录, P2: 配置上传凭证, P3: 查看上传状态和历史），按照优先级和依赖关系组织任务。考虑新的触发方式（侧边面板点击）和编辑器需求（表单内编辑器）。

**Total Tasks**: 45  
**Completed Tasks**: 45 (100%)  
**Tasks by Story**: US1 (P1): 28 tasks ✅, US2 (P2): 6 tasks ✅, US3 (P3): 4 tasks ✅, Setup: 2 tasks ✅, Foundational: 2 tasks ✅, Polish: 3 tasks ✅

## Implementation Strategy

### MVP Scope
**MVP 包含**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (User Story 1 - 选择并上传记录) + Phase 4 (User Story 2 - 配置上传凭证)

MVP 实现核心的上传功能，用户可以在侧边面板点击会话项触发上传表单，填写表单并上传到分享平台。配置功能是上传的前提条件，因此也包含在 MVP 中。

### Incremental Delivery
1. **Phase 1-2**: 项目基础和基础设施
2. **Phase 3**: 实现上传功能（MVP 核心功能，包括侧边面板触发和表单内编辑器）
3. **Phase 4**: 添加配置功能（上传的前提条件）
4. **Phase 5**: 添加上传状态查看功能（可选）
5. **Phase 6**: 完善和优化

## Dependencies

```
Setup (Phase 1)
  └─> Foundational (Phase 2)
       └─> User Story 1 (Phase 3) - 选择并上传记录
            └─> User Story 2 (Phase 4) - 配置上传凭证
                 └─> User Story 3 (Phase 5) - 查看上传状态和历史
                      └─> Polish (Phase 6)
```

**Story Completion Order**: US1 → US2 → US3

**Note**: US2 (配置上传凭证) 虽然优先级是 P2，但它是 US1 的前提条件，因此应该在 US1 之前或与 US1 并行实现。为了简化，我们将 US2 放在 US1 之后，但在实际实现中，配置功能应该先实现。

## Parallel Execution Opportunities

### Phase 3 (User Story 1)
- T005-T007: 数据模型可以并行实现（不同文件，独立接口）
- T010-T011: 上传服务和配置管理可以并行实现（不同文件，独立功能）
- T012-T014: 上传表单 UI 的不同组件可以并行实现（HTML、CSS、JS）
- T015-T017: 内容编辑器、预览功能和格式转换可以并行实现（不同功能，独立方法）
- T020-T021: 会话内容加载和格式转换可以并行实现（不同功能，独立方法）

### Phase 4 (User Story 2)
- T034-T035: 配置命令和配置管理可以并行实现（不同文件，独立功能）

---

## Phase 1: Setup

**Goal**: 项目初始化和基础结构设置

### Tasks

- [x] T001 Create project structure per implementation plan in `src/`
- [x] T002 Update `package.json` with upload-related commands and configuration

---

## Phase 2: Foundational

**Goal**: 实现所有用户故事依赖的基础设施

### Tasks

- [x] T003 [P] Create API client utility class in `src/utils/apiClient.ts` with fetch wrapper, error handling, and timeout support
- [x] T004 [P] Extend `Config` class in `src/utils/config.ts` with JWT Token and API URL management methods using globalState

---

## Phase 3: User Story 1 - 选择并上传记录 (P1)

**Goal**: 用户在侧边面板会话列表中点击一个会话项，插件显示上传表单，用户填写必要信息（项目名称、邮箱、时间、格式等），可以在表单内编辑和预览会话内容，然后上传到分享平台。

**Independent Test**: 可以通过在侧边面板会话列表中点击一条会话，填写表单信息，然后验证记录是否成功上传到分享平台来测试。即使没有其他功能（如查看历史记录），上传功能本身也能提供价值。

### Tasks

#### Data Models

- [x] T005 [P] [US1] Create `UploadRecord` interface in `src/models/uploadRecord.ts` with project_name, uploader_email, upload_time, content_format, content fields
- [x] T006 [P] [US1] Create `UploadFormData` interface in `src/models/uploadRecord.ts` with composer_id field and validation_errors
- [x] T007 [P] [US1] Create `UploadResponse` and `UploadErrorResponse` interfaces in `src/models/uploadRecord.ts`
- [x] T008 [US1] Create `ContentFormat` enum in `src/models/uploadRecord.ts` with markdown, text, json, html values
- [x] T009 [US1] Implement validation functions in `src/models/uploadRecord.ts` for all form fields (project_name, uploader_email, upload_time, content)

#### Services

- [x] T010 [P] [US1] Create `UploadService` class in `src/services/uploadService.ts` implementing `IUploadService` interface
- [x] T011 [P] [US1] Implement `uploadRecord` method in `src/services/uploadService.ts` with API call, JWT authentication, and error handling
- [x] T012 [US1] Implement error parsing in `src/services/uploadService.ts` for 400, 401, 413, 500 status codes
- [x] T013 [US1] Implement retry mechanism in `src/services/uploadService.ts` with exponential backoff for network and server errors
- [x] T014 [US1] Implement timeout handling in `src/services/uploadService.ts` using AbortController (30 seconds)

#### Upload Form UI

- [x] T015 [P] [US1] Create `UploadFormPanel` class in `src/ui/uploadFormPanel.ts` implementing `IUploadFormPanel` interface
- [x] T016 [P] [US1] Implement `createPanel` method in `src/ui/uploadFormPanel.ts` to create Webview panel
- [x] T017 [P] [US1] Implement `getWebviewContent` method in `src/ui/uploadFormPanel.ts` with HTML form structure including content editor (textarea)
- [x] T018 [US1] Implement content editor in `src/ui/uploadFormPanel.ts` with textarea for editing and preview button
- [x] T019 [US1] Implement preview functionality in `src/ui/uploadFormPanel.ts` with Markdown rendering (reuse existing MarkdownRenderer if available)
- [x] T020 [US1] Implement `loadSessionContent` method in `src/ui/uploadFormPanel.ts` using DatabaseAccess.getAgentRecords(composerId)
- [x] T021 [US1] Implement content format conversion in `src/ui/uploadFormPanel.ts` for json, markdown, text, html formats
- [x] T022 [US1] Implement form validation in `src/ui/uploadFormPanel.ts` with real-time validation and error display
- [x] T023 [US1] Implement `handleMessage` method in `src/ui/uploadFormPanel.ts` for Webview message passing
- [x] T024 [US1] Implement `handleSubmit` method in `src/ui/uploadFormPanel.ts` with validation and upload service call
- [x] T025 [US1] Implement progress display in `src/ui/uploadFormPanel.ts` using vscode.window.withProgress()
- [x] T026 [US1] Implement error display in `src/ui/uploadFormPanel.ts` with user-friendly error messages

#### Session List Integration

- [x] T027 [US1] Modify `SessionListPanel` class in `src/ui/sessionListPanel.ts` to add upload trigger in click event handler
- [x] T028 [US1] Implement upload command invocation in `src/ui/sessionListPanel.ts` when user clicks session item (pass composerId)

#### Command Integration

- [x] T029 [US1] Create `uploadRecordCommand` function in `src/commands/uploadRecord.ts` to open upload form with composerId
- [x] T030 [US1] Register `cursor-assistant.uploadRecord` command in `src/extension.ts`
- [x] T031 [US1] Update `package.json` to add `cursor-assistant.uploadRecord` command to contributes.commands

---

## Phase 4: User Story 2 - 配置上传凭证 (P2)

**Goal**: 用户在插件中配置 JWT Token，用于认证上传请求，确保只有授权用户才能上传记录。

**Independent Test**: 可以通过在插件设置中配置 JWT Token，然后验证上传请求是否包含正确的认证头来测试。

### Tasks

- [x] T032 [US2] Create `configureUploadCommand` function in `src/commands/configureUpload.ts` to prompt for JWT Token and API URL
- [x] T033 [US2] Implement JWT Token input in `src/commands/configureUpload.ts` with secure input (password type)
- [x] T034 [P] [US2] Implement API URL input in `src/commands/configureUpload.ts` with default value from API docs
- [x] T035 [P] [US2] Implement save configuration in `src/commands/configureUpload.ts` using Config.setJWTToken() and Config.setAPIUrl()
- [x] T036 [US2] Register `cursor-assistant.configureUpload` command in `src/extension.ts`
- [x] T037 [US2] Update `package.json` to add `cursor-assistant.configureUpload` command and configuration properties (jwtToken, apiUrl)

---

## Phase 5: User Story 3 - 查看上传状态和历史 (P3)

**Goal**: 用户可以在插件中查看已上传记录的状态，了解哪些记录已成功上传，哪些上传失败，以便进行后续操作（如重试上传）。

**Independent Test**: 可以通过上传记录后，在插件中查看上传状态列表来测试。即使没有此功能，用户仍可以通过服务平台查看上传的记录。

### Tasks

- [x] T038 [US3] Create `UploadHistoryEntry` interface in `src/models/uploadHistory.ts` with record_id, upload_time, status, error_message fields
- [x] T039 [US3] Implement upload history storage in `src/services/uploadService.ts` using globalState to save history entries
- [x] T040 [US3] Create `viewUploadHistoryCommand` function in `src/commands/viewUploadHistory.ts` to display history using QuickPick
- [x] T041 [US3] Register `cursor-assistant.viewUploadHistory` command in `src/extension.ts` and update `package.json`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: 完善错误处理、用户体验优化和测试

### Tasks

- [x] T042 Implement comprehensive error handling for all edge cases (network errors, timeouts, session loading failures)
- [x] T043 Add fallback editor option in `src/ui/uploadFormPanel.ts` (open external editor button if embedded editor fails)
- [x] T044 Add logging for upload operations in `src/services/uploadService.ts` and `src/ui/uploadFormPanel.ts`

---

## Task Completion Checklist

- [x] All Phase 1 tasks completed
- [x] All Phase 2 tasks completed
- [x] All Phase 3 tasks completed (User Story 1)
- [x] All Phase 4 tasks completed (User Story 2)
- [x] All Phase 5 tasks completed (User Story 3)
- [x] All Phase 6 tasks completed
- [ ] All acceptance scenarios from spec.md tested (需要手动测试)
- [x] All edge cases handled
- [x] Code reviewed and linted (编译通过，无错误)
- [ ] Documentation updated (需要更新使用文档)
