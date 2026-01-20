# Consistency Checklist: Cursor助手插件

**Purpose**: Validate consistency across specification, plan, tasks, data model, and contracts  
**Created**: 2025-12-11  
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [ ] CHK001 - Are all functional requirements (FR-001 through FR-012.4) from spec.md reflected in tasks.md with corresponding implementation tasks? [Completeness, Traceability]
- [ ] CHK002 - Are all success criteria (SC-001 through SC-009) from spec.md aligned with performance goals in plan.md? [Consistency, Spec §Success Criteria]
- [ ] CHK003 - Are all three user stories (US1, US2, US3) from spec.md represented in tasks.md with dedicated task phases? [Completeness, Spec §User Scenarios]
- [ ] CHK004 - Are all clarifications from spec.md §Clarifications reflected in functional requirements or design decisions? [Traceability, Spec §Clarifications]

## Specification-Plan Consistency

- [ ] CHK005 - Does plan.md §Technical Context align with spec.md §Dependencies regarding database access (only database, no API/file)? [Consistency, Spec §FR-001, Plan §Technical Context]
- [ ] CHK006 - Are performance goals in plan.md (data collection < 5%, session list < 2%) consistent with success criteria in spec.md (SC-002, SC-009)? [Consistency, Spec §SC-002/SC-009, Plan §Performance Goals]
- [ ] CHK007 - Does plan.md §Project Structure include the `ui/` directory mentioned in spec.md §FR-012 for session list panel? [Consistency, Spec §FR-012, Plan §Project Structure]
- [ ] CHK008 - Are the database paths in plan.md §Research Findings consistent with clarifications in spec.md (workspaceStorage and globalStorage)? [Consistency, Spec §Clarifications Q24, Plan §Research Findings]

## Specification-Tasks Consistency

- [ ] CHK009 - Do tasks T049-T063 in tasks.md cover all requirements in spec.md §FR-012 through FR-012.4 for session list panel? [Completeness, Spec §FR-012, Tasks §Phase 5]
- [ ] CHK010 - Are task descriptions in tasks.md consistent with acceptance criteria in spec.md §User Scenarios? [Consistency, Spec §User Scenarios, Tasks §Acceptance Criteria]
- [ ] CHK011 - Does tasks.md §Implementation Strategy align with spec.md §Out of Scope (upload functionality deferred)? [Consistency, Spec §Out of Scope, Tasks §MVP Scope]
- [ ] CHK012 - Are task dependencies in tasks.md consistent with user story priorities in spec.md (P1 → P2)? [Consistency, Spec §User Scenarios, Tasks §Dependencies]

## Data Model Consistency

- [ ] CHK013 - Does data-model.md §UsageStatistics align with spec.md §Key Entities definition for "使用统计数据"? [Consistency, Spec §Key Entities, Data Model §UsageStatistics]
- [ ] CHK014 - Does data-model.md §AgentRecord align with spec.md §Key Entities definition for "Agent 对话记录" (including both chat and agent modes)? [Consistency, Spec §Key Entities, Data Model §AgentRecord]
- [ ] CHK015 - Is SessionListItem entity in data-model.md consistent with spec.md §FR-012.1 (session name list) and §FR-012.4 (sorted by lastUpdatedAt)? [Consistency, Spec §FR-012.1/FR-012.4, Data Model §SessionListItem]
- [ ] CHK016 - Are file naming formats in data-model.md (stats-yyyy-mm-dd-HHMMSS.json, agent-yyyy-mm-dd-HHMMSS.json) consistent with spec.md §FR-007 and §FR-008? [Consistency, Spec §FR-007/FR-008, Data Model §Storage]

## Clarification-Requirement Consistency

- [ ] CHK017 - Does spec.md §FR-001 (database-only access) align with clarification "数据访问方式的实现范围" (only database, remove API/file)? [Consistency, Spec §Clarifications Q14, Spec §FR-001]
- [ ] CHK018 - Does spec.md §FR-012.2 (fs.watch + periodic check + debounce) align with clarification "会话列表的更新机制"? [Consistency, Spec §Clarifications Q27, Spec §FR-012.2]
- [ ] CHK019 - Does spec.md §FR-012.3 (current workspace only) align with clarification "会话列表的显示范围"? [Consistency, Spec §Clarifications Q28, Spec §FR-012.3]
- [ ] CHK020 - Does spec.md §FR-012.4 (sorted by lastUpdatedAt descending) align with clarification "会话列表的排序方式"? [Consistency, Spec §Clarifications Q29, Spec §FR-012.4]

## Contract-Specification Consistency

- [ ] CHK021 - Does contracts/session-list-panel.md §Interface align with spec.md §FR-012 through FR-012.4 requirements? [Consistency, Spec §FR-012, Contracts §session-list-panel]
- [ ] CHK022 - Are update mechanisms in contracts/session-list-panel.md (fs.watch + periodic + debounce) consistent with spec.md §FR-012.2? [Consistency, Spec §FR-012.2, Contracts §Update Mechanism]
- [ ] CHK023 - Are performance requirements in contracts/session-list-panel.md (SC-007, SC-008, SC-009) consistent with spec.md §Success Criteria? [Consistency, Spec §SC-007/SC-008/SC-009, Contracts §Performance Requirements]

## Plan-Implementation Consistency

- [ ] CHK024 - Does plan.md §Design Decisions align with spec.md §Clarifications regarding data access (database-only) and session list update mechanism? [Consistency, Spec §Clarifications, Plan §Design Decisions]
- [ ] CHK025 - Are technology choices in plan.md (sql.js, fs.watch, TreeView) consistent with constraints in spec.md §FR-001 and §FR-012.2? [Consistency, Spec §FR-001/FR-012.2, Plan §Technical Context]
- [ ] CHK026 - Does plan.md §Phase 1 Data Model include SessionListItem entity mentioned in spec.md §FR-012? [Completeness, Spec §FR-012, Plan §Phase 1]

## Terminology Consistency

- [ ] CHK027 - Is the term "会话列表" used consistently across spec.md, plan.md, tasks.md, and contracts? [Consistency]
- [ ] CHK028 - Are "composer" and "bubble" terms used consistently across spec.md §Clarifications, research.md, and data-model.md? [Consistency, Spec §Clarifications Q24]
- [ ] CHK029 - Are code completion mode terms (Tab键自动补全, cmd+K 行内自动补全, Agent 对话模式) used consistently across all documents? [Consistency, Spec §Clarifications Q12]

## Success Criteria Consistency

- [ ] CHK030 - Are performance targets in plan.md §Performance Goals (5%, 2%, 10s, 2s) consistent with measurable outcomes in spec.md §Success Criteria (SC-002, SC-003, SC-007, SC-008, SC-009)? [Consistency, Spec §Success Criteria, Plan §Performance Goals]
- [ ] CHK031 - Are success criteria in spec.md §SC-001 through SC-009 all measurable and testable as required? [Measurability, Spec §Success Criteria]

## Edge Case Coverage Consistency

- [ ] CHK032 - Are edge cases in spec.md §Edge Cases (database unavailable, multiple instances, file size limits) addressed in tasks.md or plan.md? [Coverage, Spec §Edge Cases]
- [ ] CHK033 - Are error handling requirements in spec.md §FR-009 and §FR-011 (errors don't affect Cursor usage) consistent with error handling in contracts? [Consistency, Spec §FR-009/FR-011]

## Out of Scope Consistency

- [ ] CHK034 - Does spec.md §Out of Scope (upload, analysis, visualization) align with plan.md §Summary and tasks.md §Implementation Strategy (local storage only)? [Consistency, Spec §Out of Scope, Plan §Summary]
- [ ] CHK035 - Is the deferred upload functionality consistently excluded across spec.md, plan.md, and tasks.md? [Consistency, Spec §Out of Scope, Spec §Clarifications Q15]

## Data Access Consistency

- [ ] CHK036 - Are database access methods in spec.md §FR-001.1 and §FR-001.2 (ItemTable, CursorDiskKV) consistent with research.md §Database Access Implementation Details? [Consistency, Spec §FR-001.1/FR-001.2, Research §Database Access]
- [ ] CHK037 - Are database paths in spec.md §Clarifications (workspaceStorage, globalStorage) consistent with research.md §Database Access Implementation Details? [Consistency, Spec §Clarifications Q24, Research §Database Access]

## Session List Panel Consistency

- [ ] CHK038 - Does spec.md §FR-012.1 (display session names only, no interaction) align with contracts/session-list-panel.md §Interface (ISessionListPanel, ISessionListDataProvider)? [Consistency, Spec §FR-012.1, Contracts §session-list-panel]
- [ ] CHK039 - Are update mechanisms (fs.watch, periodic check, debounce) consistently described in spec.md §FR-012.2, plan.md §Research Findings, and contracts/session-list-panel.md? [Consistency, Spec §FR-012.2, Plan §Research Findings, Contracts §Update Mechanism]

## File Naming Consistency

- [ ] CHK040 - Are file naming formats (stats-yyyy-mm-dd-HHMMSS.json, agent-yyyy-mm-dd-HHMMSS.json) consistently specified in spec.md §FR-007/FR-008, data-model.md §Storage, and tasks.md? [Consistency, Spec §FR-007/FR-008, Data Model §Storage]

## Directory Structure Consistency

- [ ] CHK041 - Is the directory structure (./cursor-helper/yyyy-mm-dd/) consistently specified in spec.md §FR-005/FR-006, data-model.md, and tasks.md? [Consistency, Spec §FR-005/FR-006]

## User Story-Task Mapping

- [ ] CHK042 - Are all acceptance scenarios in spec.md §User Story 1 covered by tasks T009-T032 in tasks.md? [Completeness, Spec §User Story 1, Tasks §Phase 3]
- [ ] CHK043 - Are all acceptance scenarios in spec.md §User Story 2 covered by tasks T033-T043 in tasks.md? [Completeness, Spec §User Story 2, Tasks §Phase 4]
- [ ] CHK044 - Are all acceptance scenarios in spec.md §User Story 3 covered by tasks T049-T063 in tasks.md? [Completeness, Spec §User Story 3, Tasks §Phase 5]

## Research-Implementation Consistency

- [ ] CHK045 - Are database access implementation details in research.md §Database Access Implementation Details consistent with spec.md §FR-001.1/FR-001.2? [Consistency, Research §Database Access, Spec §FR-001.1/FR-001.2]
- [ ] CHK046 - Are TreeView panel implementation details in research.md §VS Code TreeView Panel 实现 consistent with spec.md §FR-012 and plan.md §Design Decisions? [Consistency, Research §TreeView Panel, Spec §FR-012, Plan §Design Decisions]
- [ ] CHK047 - Are database change detection mechanisms in research.md §数据库变化检测机制 consistent with spec.md §FR-012.2 and contracts/session-list-panel.md? [Consistency, Research §Database Change Detection, Spec §FR-012.2, Contracts §Update Mechanism]

## Notes

- This checklist validates that requirements are consistently documented across all specification artifacts
- Items marked with [Gap] indicate potential missing requirements
- Items marked with [Conflict] indicate contradictory requirements
- Items marked with [Ambiguity] indicate unclear requirements
- All items should reference specific sections for traceability

