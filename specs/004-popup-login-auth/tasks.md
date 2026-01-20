# Implementation Tasks: 弹出登录页面鉴权

**Feature Branch**: `004-popup-login-auth`  
**Created**: 2026-01-04  
**Status**: Ready for Implementation

## Summary

本任务列表基于功能规范、实现计划、数据模型和API契约生成。任务按用户故事优先级组织，确保每个用户故事可以独立实现和测试。

**Total Tasks**: 45  
**User Stories**: 5 (US1, US2, US3, US4, US5)  
**MVP Scope**: Phase 1-4 (Setup + Foundational + US1 + US2)

## Implementation Strategy

**MVP First**: 优先实现P1用户故事（US1未登录时显示登录按钮 + US2登录后显示会话列表），提供核心认证功能价值。  
**Incremental Delivery**: 每个用户故事阶段完成后可独立测试和交付。  
**Parallel Opportunities**: 标记为[P]的任务可以并行执行。

## Dependencies

### User Story Completion Order

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3 (US1: 未登录时显示登录按钮) ← MVP核心功能
    ↓
Phase 4 (US2: 登录后显示会话列表) ← MVP核心功能
    ↓
Phase 5 (US4: 移除手动输入Token功能) ← 功能迁移
    ↓
Phase 6 (US3: 用户登出功能) ← 依赖US1和US2
    ↓
Phase 7 (US5: 登录状态保持和自动检测) ← 依赖US1和US2
    ↓
Phase 8 (Polish & Cross-Cutting)
```

### Story Dependencies

- **US1** (未登录时显示登录按钮): 独立，不依赖其他用户故事，但需要Foundational基础设施
- **US2** (登录后显示会话列表): 依赖US1（需要登录按钮和认证流程）
- **US4** (移除手动输入Token功能): 独立，但应在US1和US2之后实现，确保新功能可用
- **US3** (用户登出功能): 依赖US1和US2（需要登录和会话列表功能）
- **US5** (登录状态保持和自动检测): 依赖US1和US2（需要登录和会话列表功能）

## Parallel Execution Examples

### Phase 2 (Foundational) - Parallel Opportunities
- T003 [P] 和 T004 [P] 可以并行（创建不同的类型定义）
- T005 [P] 和 T006 [P] 可以并行（创建不同的工具类）

### Phase 3 (US1) - Parallel Opportunities
- T011 [P] 和 T012 [P] 可以并行（创建不同的服务方法）
- T013 [P] 和 T014 [P] 可以并行（注册不同的命令和处理器）

## Tasks

### Phase 1: Setup

**Goal**: 初始化项目结构和类型定义

**Independent Test**: 项目结构创建完成，类型定义编译通过

- [x] T001 Create auth models directory structure in src/models/
- [x] T002 Create auth types file in src/models/auth.ts with AuthState, LoginResponse, and TokenInfo interfaces

### Phase 2: Foundational

**Goal**: 实现基础工具类和服务，为所有用户故事提供基础设施

**Independent Test**: 工具类可以独立测试，服务接口定义完成

- [x] T003 [P] Create TokenManager class file in src/utils/tokenManager.ts
- [x] T004 [P] Implement saveToken method in src/utils/tokenManager.ts using SecretStorage API
- [x] T005 [P] Implement getToken method in src/utils/tokenManager.ts
- [x] T006 [P] Implement deleteToken method in src/utils/tokenManager.ts
- [x] T007 [P] Implement isValidToken method in src/utils/tokenManager.ts for JWT format validation
- [x] T008 Create AuthService class file in src/services/authService.ts
- [x] T009 Implement TokenManager integration in src/services/authService.ts constructor
- [x] T010 Add configuration support for loginUrl in src/services/authService.ts

### Phase 3: User Story 1 - 未登录时显示登录按钮 (P1)

**Goal**: 实现登录按钮显示和登录页面打开功能，未登录用户可以看到登录入口

**Independent Test**: 清除认证信息，打开插件面板，验证面板显示登录按钮，点击按钮后弹出登录页面

**Acceptance Criteria**:
- 未登录用户打开插件面板时显示登录按钮，不显示会话列表
- 用户点击登录按钮后打开前端登录页面（外部浏览器）
- 登录页面URL包含callback参数

- [x] T011 [US1] Implement openLoginPage method in src/services/authService.ts to open external browser with login URL
- [x] T012 [US1] Implement handleLoginCallback method in src/services/authService.ts to process token from URI callback
- [x] T013 [US1] Register URI scheme handler in src/extension.ts for cursor-helper://auth/callback
- [x] T014 [US1] Register login command in src/extension.ts and package.json
- [x] T015 [US1] Create login command handler in src/commands/login.ts
- [x] T016 [US1] Update SessionListPanel to check authentication status in src/ui/sessionListPanel.ts
- [x] T017 [US1] Implement showLoginButton method in src/ui/sessionListPanel.ts to display login button when not authenticated
- [x] T018 [US1] Update extension.ts to pass AuthService to SessionListPanel in src/extension.ts

### Phase 4: User Story 2 - 登录后显示会话列表 (P1)

**Goal**: 实现登录成功后自动显示会话列表，用户可以看到和管理会话

**Independent Test**: 用户完成登录后，验证插件面板自动从显示登录按钮切换为显示会话列表

**Acceptance Criteria**:
- 登录成功后，插件面板自动从显示登录按钮切换为显示会话列表
- 已登录用户打开插件面板时显示会话列表，不显示登录按钮
- 登录状态在刷新后保持

- [x] T019 [US2] Implement token saving in handleLoginCallback method in src/services/authService.ts
- [x] T020 [US2] Implement refreshPanel method in src/services/authService.ts to update UI after login
- [x] T021 [US2] Update SessionListPanel to show session list when authenticated in src/ui/sessionListPanel.ts
- [x] T022 [US2] Implement showSessionList method in src/ui/sessionListPanel.ts to display session list
- [x] T023 [US2] Update SessionListPanel initialization to check auth status on startup in src/ui/sessionListPanel.ts
- [x] T024 [US2] Add token validation in handleLoginCallback in src/services/authService.ts

### Phase 5: User Story 4 - 移除手动输入Token功能 (P1)

**Goal**: 移除所有手动输入JWT token的界面和功能，统一使用弹出登录页面

**Independent Test**: 清除认证信息，尝试访问需要认证的功能，验证系统不再显示token输入界面，而是显示登录按钮

**Acceptance Criteria**:
- 系统不再显示手动输入token的界面
- 系统不再使用本地存储的旧token进行自动认证
- 所有认证必须通过弹出登录页面完成

- [ ] T025 [US4] Remove TokenInput component and related code if exists
- [ ] T026 [US4] Remove manual token input commands from package.json
- [ ] T027 [US4] Remove token input UI from upload configuration in src/commands/configureUpload.ts
- [ ] T028 [US4] Update all token access points to use TokenManager in src/utils/apiClient.ts
- [ ] T029 [US4] Remove old token storage from Memento or configuration files
- [ ] T030 [US4] Add migration logic to clear old tokens on startup in src/extension.ts

### Phase 6: User Story 3 - 用户登出功能 (P2)

**Goal**: 实现登出功能，用户可以通过退出按钮或下拉菜单安全地结束会话

**Independent Test**: 已登录用户点击退出按钮或下拉菜单中的登出选项，验证系统清除认证信息，插件面板恢复显示登录按钮

**Acceptance Criteria**:
- 用户可以通过退出按钮或下拉菜单登出
- 登出后清除认证token
- 登出后插件面板从显示会话列表切换为显示登录按钮

- [ ] T031 [US3] Implement logout method in src/services/authService.ts
- [ ] T032 [US3] Create logout command handler in src/commands/logout.ts
- [ ] T033 [US3] Register logout command in src/extension.ts and package.json
- [ ] T034 [US3] Add logout button or menu item to SessionListPanel in src/ui/sessionListPanel.ts
- [ ] T035 [US3] Update SessionListPanel to refresh UI after logout in src/ui/sessionListPanel.ts

### Phase 7: User Story 5 - 登录状态保持和自动检测 (P2)

**Goal**: 实现登录状态保持和token过期自动检测，提升用户体验

**Independent Test**: 用户完成登录后，刷新页面或访问其他需要认证的页面，验证系统自动使用保存的认证信息，无需重新登录

**Acceptance Criteria**:
- 登录状态在刷新后保持
- Token过期时自动检测并显示登录按钮
- API请求401错误时自动清除token并刷新UI

- [ ] T036 [US5] Implement isAuthenticated method in src/services/authService.ts
- [ ] T037 [US5] Update SessionListPanel to check auth status on refresh in src/ui/sessionListPanel.ts
- [ ] T038 [US5] Implement 401 error handling in src/utils/apiClient.ts
- [ ] T039 [US5] Add token cleanup on 401 error in src/utils/apiClient.ts
- [ ] T040 [US5] Implement UI refresh trigger on token expiration in src/utils/apiClient.ts
- [ ] T041 [US5] Update ApiClient to use TokenManager for authentication headers in src/utils/apiClient.ts

### Phase 8: Polish & Cross-Cutting Concerns

**Goal**: 完善功能，处理边界情况和性能优化

**Independent Test**: 所有边界情况测试通过，性能指标满足要求

- [ ] T042 Add error handling for invalid token format in src/services/authService.ts
- [ ] T043 Add error handling for network errors in openLoginPage in src/services/authService.ts
- [ ] T044 Add loading state handling during authentication check in src/ui/sessionListPanel.ts
- [ ] T045 Update package.json configuration section to add auth.loginUrl setting
- [ ] T046 Add logging for authentication events in src/services/authService.ts
- [ ] T047 Optimize panel refresh performance to avoid unnecessary updates

## Task Summary by User Story

### User Story 1 (P1): 未登录时显示登录按钮
- **Tasks**: T011-T018 (8 tasks)
- **Key Deliverables**: 登录按钮UI、登录命令、URI scheme处理器
- **Test Criteria**: 未登录用户打开插件面板时显示登录按钮，点击后打开登录页面

### User Story 2 (P1): 登录后显示会话列表
- **Tasks**: T019-T024 (6 tasks)
- **Key Deliverables**: Token保存、面板刷新、会话列表显示
- **Test Criteria**: 登录成功后插件面板自动显示会话列表

### User Story 3 (P2): 用户登出功能
- **Tasks**: T031-T035 (5 tasks)
- **Key Deliverables**: 登出命令、退出按钮/菜单
- **Test Criteria**: 用户可以通过退出按钮登出，登出后显示登录按钮

### User Story 4 (P1): 移除手动输入Token功能
- **Tasks**: T025-T030 (6 tasks)
- **Key Deliverables**: 移除旧代码、迁移逻辑
- **Test Criteria**: 系统不再显示token输入界面，不再使用旧token

### User Story 5 (P2): 登录状态保持和自动检测
- **Tasks**: T036-T041 (6 tasks)
- **Key Deliverables**: 状态保持、401错误处理、自动刷新
- **Test Criteria**: 登录状态在刷新后保持，token过期时自动检测

## MVP Scope Recommendation

**Minimum Viable Product**: Phase 1-4 (Setup + Foundational + US1 + US2)

**Rationale**: 
- US1和US2提供核心认证功能，是用户体验的基础
- US1实现登录入口，US2实现登录后的核心功能访问
- US3、US4、US5可以在MVP基础上增量实现
- MVP完成后，用户可以完成登录并查看会话列表

**Post-MVP**: 
- Phase 5 (US4): 移除手动输入Token功能
- Phase 6 (US3): 用户登出功能
- Phase 7 (US5): 登录状态保持和自动检测
- Phase 8: 完善和优化

