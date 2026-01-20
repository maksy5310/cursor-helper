# Tasks: Cursor助手插件

**Branch**: `001-cursor-assistant` | **Date**: 2025-12-10 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Summary

本任务分解基于规范中的 3 个用户故事（P1: 使用数据自动采集, P2: 数据本地存储, P2: 会话列表显示），按照优先级和依赖关系组织任务。

**Total Tasks**: 58  
**Tasks by Story**: US1 (P1): 24 tasks, US2 (P2): 11 tasks, US3 (P2): 10 tasks, Setup: 5 tasks, Foundational: 3 tasks, Polish: 5 tasks

## Implementation Strategy

### MVP Scope
**MVP 包含**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (User Story 1 - 数据采集)

MVP 实现核心的数据采集功能，可以在内存中收集数据，即使没有存储功能也能验证数据采集是否正常工作。

### Incremental Delivery
1. **Phase 1-2**: 项目基础和基础设施
2. **Phase 3**: 实现数据采集（MVP 核心功能）
3. **Phase 4**: 添加本地存储功能
4. **Phase 5**: 完善和优化

## Dependencies

```
Setup (Phase 1)
  └─> Foundational (Phase 2)
       └─> User Story 1 (Phase 3) - 数据采集
            └─> User Story 2 (Phase 4) - 本地存储
                 └─> User Story 3 (Phase 5) - 会话列表显示
                      └─> Polish (Phase 6)
```

**Story Completion Order**: US1 → US2 → US3

## Parallel Execution Opportunities

### Phase 3 (User Story 1)
- T009-T012: 数据模型可以并行实现（不同文件，独立接口）
- T014-T016: 数据访问层的三种实现可以并行开发（不同文件，独立接口）
- T020-T024: 事件监听器可以并行实现（不同事件类型，独立功能）

### Phase 4 (User Story 2)
- T035-T036: 存储管理器的保存方法可以并行实现（不同数据类型，独立方法）

### Phase 5 (User Story 3)
- T049-T050: 会话列表数据提供者和 panel 可以并行实现（不同文件，独立接口）
- T051-T052: 数据库监听机制的不同组件可以并行实现（文件监听、定时检查、防抖）

---

## Phase 1: Setup (Project Initialization)

**Goal**: 初始化 VS Code Extension 项目，配置开发环境

**Independent Test**: 项目可以成功编译，VS Code 可以加载扩展

### Tasks

- [X] T001 Create project root directory structure (src/, tests/, .vscode/)
- [X] T002 Initialize npm project with package.json in project root
- [X] T003 Create tsconfig.json with TypeScript 5.x configuration in project root
- [X] T004 Create .vscode/launch.json for extension debugging
- [X] T005 Create .vscode/tasks.json for build tasks

---

## Phase 2: Foundational (Blocking Prerequisites)

**Goal**: 创建所有用户故事都需要的基础组件

**Independent Test**: 基础组件可以独立导入和使用

### Tasks

- [X] T006 Create src/utils/logger.ts with logging utility functions
- [X] T007 Create src/utils/config.ts with configuration management (读取 VS Code 配置)
- [X] T008 Create src/extension.ts with basic extension activation/deactivation hooks

---

## Phase 3: User Story 1 - 使用数据自动采集 (Priority: P1)

**Goal**: 实现数据采集功能，能够实时采集 Tab键自动补全、cmd+K 行内自动补全、Agent 对话模式的使用统计和对话记录

**Independent Test**: 安装插件后，使用 Cursor 进行开发工作，插件能够采集到使用数据（可以在内存中验证，不需要存储）

**Acceptance Criteria**:
- 插件能够采集 Tab键自动补全的建议次数、采纳次数和建议代码行数
- 插件能够采集 cmd+K 行内自动补全的建议次数、采纳次数和建议代码行数
- 插件能够采集 Agent 对话模式的建议次数和采纳次数
- 插件能够采集 Agent 对话模式的完整对话记录
- 插件能够采集代码提交的代码行数
- 数据采集对 Cursor 性能影响 < 5%

### Tasks

#### Data Models

- [X] T009 [US1] Create src/models/usageStats.ts with UsageStatistics interface, EventType enum, CompletionMode enum
- [X] T010 [US1] Create src/models/agentRecord.ts with AgentRecord interface, ConversationType enum, AgentMessage interface, CodeSnippet interface, AgentContext interface, AgentStatistics interface
- [X] T011 [US1] Implement validation functions in src/models/usageStats.ts (validate timestamp, eventType, mode)
- [X] T012 [US1] Implement validation functions in src/models/agentRecord.ts (validate timestamp, sessionId, conversationType, messages)

#### Data Access Layer

- [X] T013 [US1] Create src/dataAccess/dataAccess.ts with IDataAccess interface and AccessMethod enum
- [X] T014 [US1] Create src/dataAccess/databaseAccess.ts with IDatabaseAccess interface and DatabaseAccess class (实现数据库连接和查询)
- [X] T015 [US1] ~~Create src/dataAccess/apiAccess.ts with IAPIAccess interface and APIAccess class (实现 API 调用)~~ **[DEPRECATED]** 根据 FR-001，仅使用数据库访问方式，API 访问已移除
- [X] T016 [US1] ~~Create src/dataAccess/fileAccess.ts with IFileAccess interface and FileAccess class (实现文件读取)~~ **[DEPRECATED]** 根据 FR-001，仅使用数据库访问方式，文件访问已移除
- [X] T017 [US1] Implement DataAccess class in src/dataAccess/dataAccess.ts ~~with automatic fallback mechanism (Database → API → File)~~ **仅使用数据库访问方式**（根据 FR-001，不实现 API 和文件访问的回退机制）
- [X] T018 [US1] Implement getUsageStatistics method in src/dataAccess/dataAccess.ts
- [X] T019 [US1] Implement getAgentRecords method in src/dataAccess/dataAccess.ts

#### Event Listeners

- [X] T020 [US1] Create src/eventListeners.ts with document change event listener (监听文档变更，检测代码建议和采纳)
- [X] T021 [US1] Implement Tab键自动补全检测 logic in src/eventListeners.ts (通过命令监听或文档变更模式识别)
- [X] T022 [US1] Implement cmd+K 行内自动补全检测 logic in src/eventListeners.ts (通过命令监听或文档变更模式识别)
- [X] T023 [US1] Implement Agent 对话模式检测 logic in src/eventListeners.ts (通过命令监听或数据库访问)
- [X] T024 [US1] Implement code commit detection logic in src/eventListeners.ts (通过 Git Extension API 或文件系统监控)

#### Data Collector

- [X] T025 [US1] Create src/dataCollector.ts with IDataCollector interface
- [X] T026 [US1] Implement DataCollector class in src/dataCollector.ts with start() and stop() methods
- [X] T027 [US1] Implement event collection logic in src/dataCollector.ts (集成事件监听器，收集使用统计数据)
- [X] T028 [US1] Implement Agent conversation collection logic in src/dataCollector.ts (收集 Agent 对话记录)
- [X] T029 [US1] Implement in-memory buffer in src/dataCollector.ts (批量写入缓冲区，每 10 秒或累积 100 条记录)
- [X] T030 [US1] Implement error handling in src/dataCollector.ts (错误不应影响 Cursor 使用)
- [X] T031 [US1] Implement enable/disable toggle in src/dataCollector.ts (支持配置开关)
- [X] T032 [US1] Integrate DataCollector into src/extension.ts (在 activate 中启动数据采集)

---

## Phase 4: User Story 2 - 数据本地存储 (Priority: P2)

**Goal**: 实现本地文件存储功能，将采集的数据保存到本地文件系统

**Independent Test**: 使用 Cursor 进行开发工作，检查 `./cursor-helper/yyyy-mm-dd/` 目录下是否存在数据文件且包含正确的数据

**Acceptance Criteria**:
- 插件能够在工作空间目录下创建 `./cursor-helper` 目录
- 插件能够按日期格式创建子目录
- 插件能够将使用统计数据保存为 JSON 文件（stats-yyyy-mm-dd-HHMMSS.json）
- 插件能够将 Agent 对话记录保存为 JSON 文件（agent-yyyy-mm-dd-HHMMSS.json）
- 存储失败时记录错误但不影响 Cursor 使用
- 存储操作成功率 ≥ 99%

### Tasks

#### Storage Manager

- [X] T033 [US2] Create src/storageManager.ts with IStorageManager interface
- [X] T034 [US2] Implement StorageManager class in src/storageManager.ts with initialize() method (创建目录结构)
- [X] T035 [US2] Implement saveUsageStatistics method in src/storageManager.ts (批量保存统计数据到 JSON 文件)
- [X] T036 [US2] Implement saveAgentRecord method in src/storageManager.ts (保存 Agent 对话记录到 JSON 文件)
- [X] T037 [US2] Implement file naming logic in src/storageManager.ts (stats-yyyy-mm-dd-HHMMSS.json, agent-yyyy-mm-dd-HHMMSS.json)
- [X] T038 [US2] Implement date directory creation logic in src/storageManager.ts (按 yyyy-mm-dd 格式创建子目录)
- [X] T039 [US2] Implement error handling in src/storageManager.ts (目录创建失败、文件写入失败、磁盘空间不足)
- [X] T040 [US2] Implement checkStorageSpace method in src/storageManager.ts

#### Integration

- [X] T041 [US2] Integrate StorageManager into DataCollector in src/dataCollector.ts (批量写入时调用存储管理器)
- [X] T042 [US2] Update src/extension.ts to initialize StorageManager with workspace path
- [X] T043 [US2] Implement batch write trigger logic in src/dataCollector.ts (每 10 秒或累积 100 条记录触发写入)

---

## Phase 5: User Story 3 - 会话列表显示 (Priority: P2)

**Goal**: 在 Cursor 侧边栏提供 TreeView panel，显示当前工作空间的所有会话列表

**Independent Test**: 打开 Cursor 侧边栏，查看会话列表 panel 是否正确显示当前工作空间的所有会话，并验证列表是否按最后更新时间排序，以及是否能够自动更新。

**Acceptance Criteria**:
- 插件能够在侧边栏创建会话列表 panel
- 会话列表显示当前工作空间的所有会话名称
- 会话列表按最后更新时间降序排列（最新的在前）
- 会话列表能够自动更新（通过监听数据库日志文件变化）
- 会话列表更新延迟 < 2 秒
- 会话列表 panel 对 Cursor 性能影响 < 2%

### Tasks

#### Session List Panel UI

- [X] T049 [US3] Create src/ui/sessionListPanel.ts with ISessionListPanel interface and SessionListPanel class
- [X] T050 [US3] Create src/ui/sessionListDataProvider.ts with ISessionListDataProvider interface and SessionListDataProvider class (实现 TreeDataProvider)
- [X] T051 [US3] Implement getChildren method in SessionListDataProvider (从数据库读取会话列表)
- [X] T052 [US3] Implement getTreeItem method in SessionListDataProvider (显示会话名称)
- [X] T053 [US3] Implement session list sorting logic in SessionListDataProvider (按 lastUpdatedAt 降序排序)
- [X] T054 [US3] Register TreeView in src/extension.ts (使用 vscode.window.createTreeView 创建 panel)

#### Database Change Detection

- [X] T055 [US3] Create src/utils/databaseWatcher.ts with IDatabaseWatcher interface
- [X] T056 [US3] Implement fs.watch listener in DatabaseWatcher (监听 state.vscdb-wal 文件变化)
- [X] T057 [US3] Implement periodic check mechanism in DatabaseWatcher (定时检查，如每 30 秒)
- [X] T058 [US3] Implement debounce mechanism in DatabaseWatcher (防抖延迟，如 500ms)
- [X] T059 [US3] Implement fallback mechanism in DatabaseWatcher (如果 fs.watch 失败，回退到仅定时检查)

#### Integration

- [X] T060 [US3] Integrate DatabaseWatcher into SessionListDataProvider (监听变化时刷新列表)
- [X] T061 [US3] Integrate SessionListPanel into src/extension.ts (在 activate 中初始化 panel)
- [X] T062 [US3] Implement error handling in SessionListPanel (数据库不可访问时显示空列表)
- [X] T063 [US3] Implement workspace filtering in SessionListDataProvider (仅显示当前工作空间的会话)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: 完善功能，处理边界情况，优化性能

**Independent Test**: 所有边界情况都能正确处理，性能指标满足要求

### Tasks

- [ ] T064 Implement configuration UI in src/extension.ts (添加命令和设置项，允许用户启用/禁用数据采集)
- [ ] T065 Implement error recovery mechanism (数据采集失败时自动重试，存储失败时保留数据在缓冲区)
- [ ] T066 Add performance monitoring (测量数据采集对性能的影响，确保 < 5%，会话列表 panel < 2%)
- [ ] T067 Implement multi-instance handling (避免多个 Cursor 实例重复采集数据)
- [ ] T068 Add comprehensive error logging (使用 logger 记录所有错误，便于调试)

---

## Task Validation Checklist

- ✅ All tasks have checkboxes
- ✅ All tasks have sequential IDs (T001-T068)
- ✅ All user story tasks have [US1], [US2], or [US3] labels
- ✅ All tasks include file paths
- ✅ Parallelizable tasks marked with [P] (implicit in organization)
- ✅ Tasks organized by user story priority
- ✅ Dependencies clearly defined
- ✅ Independent test criteria provided for each phase

---

## Notes

- 测试任务未包含（规范未明确要求 TDD）
- 所有任务都包含具体的文件路径，可以直接实现
- 任务按照依赖关系排序，可以按顺序执行
- Phase 3、Phase 4 和 Phase 5 中的某些任务可以并行执行（不同文件）
- User Story 3 依赖于 User Story 1 的数据访问层（DatabaseAccess）
- 会话列表 panel 需要访问工作空间数据库，因此依赖于数据访问层的实现

