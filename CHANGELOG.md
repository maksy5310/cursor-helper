# Changelog
 
本文档记录了 Cursor 助手插件的所有重要变更。
 
版本格式遵循[语义化版本](https://semver.org/lang/zh-CN/)规范。
 
## [Unreleased]

### 待发布的变更

---

## [1.0.27] - 2026-02-13

### Fixed
- 🔧 修复超长消息（>100K 字符）导致页面布局重叠错乱的严重问题
  - **根因**：超长 AI 回复（7-15MB HTML）中包含大量引用自身源码的内容，直接嵌入 `<div style="display:none">` 时，浏览器解析 HTML 的隐式闭合规则导致多余的 `</div>` 关闭了外层 `.messages-list`、`.content-inner` 等容器，使后续消息卡片脱离正常 DOM 结构
  - **修复方案（D: A+C 组合）**：
    1. 超长消息完整内容改用 **base64 + `<script type="text/template">`** 存储，浏览器不解析其为 DOM，彻底避免 HTML 泄漏
    2. 点击"加载完整内容"时通过 JavaScript 解码 base64 并动态注入 `innerHTML`
    3. `balanceHtml` 函数 `blockTags` 新增 `code` 标签，修复不平衡的 `<code>` 标签吞没后续内容的问题
    4. 新增 `containHtml` 二次净化函数，用栈扫描移除所有多余闭标签，补齐未闭合标签
    5. 所有消息内容（包括预览、完整内容、正常内容）均经过 `containHtml` 保护

### Technical
- 新增 `containHtml()` 函数 - 基于栈的 HTML 标签闭合净化
- 修改 `loadFullContent()` - 支持从 base64 模板解码并动态注入
- 修改 `balanceHtml()` - blockTags 新增 `code` 标签
- 修改消息渲染逻辑 - 所有 `balanceHtml()` 调用后增加 `containHtml()` 兜底

---

## [1.0.26] - 2026-02-13

### Added
- 📋 会话概括摘要功能（A+B 组合方案）
  - 新增 `SessionSummarizer` 模块，基于规则自动提取会话摘要（对话轮次、涉及文件、工具使用统计、主题提取）
  - 导出会话时，"描述/备注"输入框自动预填充生成的摘要，用户可自由编辑
  - 首页卡片显示摘要第一行（截取前 80 字符）
  - 详情页元信息下方显示"📋 会话概括"蓝色背景区块
- 🧪 新增 `sessionSummarizer.test.ts` 单元测试（15 个测试用例）

### Changed
- 折叠区域（`details/summary`）标题文字和箭头颜色从深黑色/灰色调整为 `#0366d6`（蓝色）
- 代码块（`<pre>`）样式从深暗色主题改为浅色主题：
  - 背景：`#1e1e2e`（深暗色）→ `#f5f5f5`（浅灰色）
  - 文字：`#cdd6f4`（浅灰白）→ `#333333`（黑色）
  - 新增浅灰边框 `#e0e0e0`
- 单元测试总数从 78 个增加到 93 个

### Fixed
- 修复懒加载消息预览内容过长时缺少折叠/展开按钮的问题
  - 预览高度 > 400px 的懒加载消息现在也会被折叠并显示"展开全部"按钮
- 修复消息内容中模板代码泄漏导致 toggle bar DOM 被抢占的问题
  - 新增孤立 DOM 检测机制和动态 toggle bar 创建
  - 新增 `toggleMsgByBody()` 和 `doToggle()` 辅助函数
  - 防止 `initCollapse()` 多次调用时重复创建动态按钮

### Technical
- 新增 `src/utils/sessionSummarizer.ts` - 会话摘要生成模块
- 修改 `src/commands/shareSession.ts` - 集成自动摘要生成
- 修改 `src/web-server/views/homePage.ts` - 首页卡片展示摘要
- 修改 `src/web-server/views/sharePage.ts` - 详情页展示摘要、智能折叠懒加载消息、动态 toggle bar 创建
- 修改 `src/web-server/views/layout.ts` - 代码块浅色主题、新增 `.share-card-desc`、`.session-summary` CSS 样式

---

## [1.0.25] - 2026-02-13

### Added
- 🌐 Web 服务器首页分页显示（每页 12 条，6 行 x 2 列），支持键盘导航
- ⬆️ 详情页"返回顶部"浮动按钮，长页面一键滚动到顶部
- 🛡️ 消息内容安全渲染：自动转义 `<script>` 标签和 `${...}` 模板字符串，防止页面结构被破坏
- 🗑️ 首页右键删除会话功能（含确认对话框）
- 📥 首页导入外部 Markdown 会话文件功能
- 📑 侧边栏可拖动分隔条调整"会话列表"和"消息大纲"高度
- 👤 自动获取系统用户名作为默认昵称（取代硬编码的"本地用户"）

### Changed
- 会话指标表格宽度调整为内容区域的 60%
- 折叠/展开按钮改为默认可见，添加多重初始化保障（DOMContentLoaded + setTimeout + window.onload）
- 侧边栏面板标题从"个人信息"更名为"基本信息"
- 用户信息显示格式改为"用户 {username}"

### Fixed
- 修复详情页折叠/展开按钮在大页面上不显示或无功能的问题
- 修复消息内容中引用的源代码（含 HTML/script 标签）破坏页面 JavaScript 的问题
- 修复"返回顶部"按钮在滚动容器内定位不正确的问题
- 修复 CSS 中 `width: max-content` 覆盖 `width: 100%` 导致表格宽度异常的问题
- 修复页脚"Cursor Session Helper ©2026"显示在右侧而非底部的问题

### Technical
- 新增 `sanitizeForMarkdown()` 和 `sanitizeNonCodeContent()` 预处理函数
- `balanceHtml()` 增加 script 标签转义机制
- 新增 `localShareService.ts`、`shareSession.ts`、`localUserInfoTreeItem.ts` 等模块
- 新增 Web 服务器（Express）：`app.ts`、`server.ts`、`serverManager.ts`
- 新增 `homePage.ts`、`layout.ts`、`sharePage.ts` 视图模块
- 78 个单元测试全部通过，核心模块覆盖率 88%+
- 新增版本自动升级脚本 `scripts/version-bump.js`

---

## [0.1.15] - 2026-01-27

### Changed
- 大幅降低安装包尺寸（真正生效版本）
  - 增强 `.vscodeignore`：排除所有 `.map` 文件、`out/test/` 目录、测试数据生成器
  - 修复打包问题：确保 Git 历史中的冗余文件不被打包
  - 优化后预计包体减小 80% 以上
- 版本号更新：v0.1.14 → v0.1.15

---

## [0.1.14] - 2026-01-27

### Changed
- 大幅降低安装包尺寸（配置准备）
  - 优化 `.vscodeignore`，移除已废弃的 sql.js 相关引用（项目已使用 @vscode/sqlite3）
  - 收紧打包范围，仅保留运行时必需文件（out、resources、配置与文档）
- 版本号更新：v0.1.13 → v0.1.14

---

## [0.1.13] - 2026-01-27

### Changed
- 版本号更新：v0.1.2 → v0.1.13

---

## [0.1.2] - 2026-01-27

### Changed
- 版本号更新：v0.1.0 → v0.1.2
- 优化版本发布流程

---

## [0.1.1] - 2026-01-27

### Added
- 📊 会话指标提取和显示功能
  - 从 ComposerData 中提取 13 个关键指标
  - 在会话 Markdown 顶部自动生成指标表格
  - 支持基础信息、代码量化、效能度量、上下文用量、协作模型五大分类
- 📋 新增指标字段支持
  - 基础信息：功能名称、Git 分支
  - 代码量化：新增行数、删除行数、变更文件总数
  - 效能度量：开发总耗时、任务完成率
  - 上下文用量：上下文负载、上下文限制、上下文使用占比
  - 协作模型：核心模型、是否MAX模式、运行模式
- 🔧 智能指标过滤
  - 自动适应不同版本的 Cursor 数据格式
  - 只显示数据中存在的指标，不存在的指标不显示
- 📝 统一表格格式
  - 所有指标整合到单个 Markdown 表格中
  - 增加"分类"列，便于组织和阅读

### Changed
- 优化会话 Markdown 渲染流程
  - 在会话标题后自动插入指标表格
  - 保持指标表格与对话记录的清晰分隔
- 增强 AgentRecord 数据模型
  - 在 AgentContext 中添加 composerData 字段
  - 保留完整的 ComposerData 用于指标提取

### Technical
- 新增 `src/models/sessionMetrics.ts` - 指标提取核心模块
- 实现 `SessionMetricsExtractor` 类，提供完整的指标提取和生成功能
- 支持嵌套 JSON 路径和计算型指标（如开发耗时、任务完成率、上下文使用占比）
- 完善的错误处理和数据验证机制

### Fixed
- 修复会话指标表格缺少标题"## 会话指标"的问题
- 添加表格标题，确保 Markdown 格式完整和美观

---

## [0.1.0] - 2026-01-27

### Fixed
- 修复会话指标表格缺少标题的问题
  - 添加了"## 会话指标"标题
  - 确保 Markdown 格式完整和美观
  - 测试验证所有 13 个指标正确显示

---

## [0.1.0] - 2026-01-27
 
### Added
- 📊 新增会话指标提取和显示功能
  - 从 ComposerData 中提取 13 个关键指标
  - 在会话 Markdown 顶部自动生成指标表格
  - 支持基础信息、代码量化、效能度量、上下文用量、协作模型五大分类
- 📋 新增指标字段支持
  - 基础信息：功能名称、Git 分支
  - 代码量化：新增行数、删除行数、变更文件总数
  - 效能度量：开发总耗时、任务完成率
  - 上下文用量：上下文负载、上下文限制、上下文使用占比
  - 协作模型：核心模型、是否MAX模式、运行模式
- 🔧 智能指标过滤
  - 自动适应不同版本的 Cursor 数据格式
  - 只显示数据中存在的指标，不存在的指标不显示
  - 避免大量无意义的 "N/A" 显示
- 📝 统一表格格式
  - 所有指标整合到单个 Markdown 表格中
  - 增加"分类"列，便于组织和阅读
  - 支持动态指标数量，根据数据内容自动调整

### Changed
- 优化会话 Markdown 渲染流程
  - 在会话标题后自动插入指标表格
  - 保持指标表格与对话记录的清晰分隔
- 增强 AgentRecord 数据模型
  - 在 AgentContext 中添加 composerData 字段
  - 保留完整的 ComposerData 用于指标提取

### Technical
- 新增 `src/models/sessionMetrics.ts` - 指标提取核心模块
- 实现 `SessionMetricsExtractor` 类，提供完整的指标提取和生成功能
- 支持嵌套 JSON 路径和计算型指标（如开发耗时、任务完成率、上下文使用占比）
- 完善的错误处理和数据验证机制
- 添加完整的单元测试和集成测试覆盖

---

## [Unreleased]
 
### 待发布的变更
 
---
 
## [0.0.9] - 2026-01-26

### Changed
- 将 SQLite 数据库访问从 `sql.js` 迁移到 `@vscode/sqlite3`
  - 使用 Cursor/VS Code 自带的 `@vscode/sqlite3` 库，无需在 package.json 中声明依赖
  - 通过 `module.createRequire` 从 Cursor 的 node_modules 中加载预编译的二进制文件
  - 支持超过 2GB 的数据库文件（解决了 sql.js 的 2GB 限制问题）

### Fixed
- 修复超过 2GB 的 SQLite 数据库文件无法加载的问题
  - 之前使用 `sql.js` 时，超过 2GB 的数据库文件会报错：`RangeError: File size is greater than 2 GiB`
  - 现在使用原生 SQLite 绑定，无文件大小限制
- 修复 Remote SSH 环境下无法访问本地数据库的问题
  - 添加 `extensionKind: ["ui"]` 配置，强制插件在本地 UI 进程运行
  - 解决了 Windows 通过 SSH 连接远程 Linux 开发时插件无法读取本地 AI 对话记录的问题

#### Documentation
- 新增 `docs/REMOTE_SSH_SUPPORT.md` - Remote SSH 环境支持文档
  - 详细说明了问题原因和解决方案
  - 提供了验证方法和诊断工具使用指南
  - 包含 VSCode Remote Extension 架构说明

---

## [0.0.8] - 2026-01-23

### Fixed
- 修复超过 2GB 数据库文件的临时解决方案（添加文件大小检查和错误提示）

---

## [0.0.7] - 2026-01-21

### Added
- 新增 Mac 和远程开发环境支持
  - 增强路径解析：支持 Unix 风格路径（`/Users/...`）
  - 增强远程路径支持：支持 `vscode-remote://` 协议
  - 实现智能路径后缀匹配算法（用于远程开发场景）
- 新增 `diagnoseWorkspace` 命令，用于诊断工作空间路径匹配问题
- 新增 `diagnoseLogin` 命令，用于诊断登录按钮无法打开浏览器的问题
- 新增 `scanWorkspaces` 命令，扫描所有工作空间并生成诊断报告（集成独立诊断脚本功能）
- 新增 `getAllWorkspaceInfo()` 方法，获取所有工作空间的详细信息
- 添加详细的调试日志输出，便于排查路径匹配问题
- 新增独立诊断工具（`diagnostics/`）
  - `scan-workspaces.js`：核心诊断脚本，可独立运行
  - `scan.bat`：Windows 一键启动脚本
  - `scan.sh`：Mac/Linux 一键启动脚本
  - 自动生成 JSON 格式的详细诊断报告
  - 支持彩色控制台输出
  - 识别远程工作空间并提供匹配建议

#### Changed
- 优化 `decodeFileUrl()` 方法，增强对 Mac 和远程路径的处理
- 优化工作空间路径匹配逻辑，支持多种匹配策略
- 增强日志输出，提供更清晰的路径匹配过程信息

#### Fixed
- 修复 Mac 下工作空间路径匹配失败的问题
- 修复远程开发环境下路径格式不兼容的问题

#### Documentation
- 新增 `docs/MAC_REMOTE_PATH_FIX.md` - Mac 和远程开发路径匹配技术文档
- 新增 `docs/MAC_REMOTE_TROUBLESHOOTING.md` - Mac 和远程开发故障排查指南
- 新增 `docs/LOGIN_TROUBLESHOOTING.md` - 登录问题排查指南
- 更新 `README.md`，添加 Mac 和远程开发用户的使用说明

---

## [0.0.6] - 2026-01-21

### Added
- 新增 `delete_file` 工具渲染支持
- 新增 `list_dir_v2` 工具渲染支持，显示目录树结构和统计信息
- 新增 `ripgrep_raw_search` 工具渲染支持
- 新增 `create_plan` 工具渲染支持，显示计划概览、待办事项和文件链接
- 新增 `semantic_search_full` 工具渲染支持

### Changed
- 移除插件运行时的调试日志输出，提升用户体验
- 清理上传记录相关的详细日志信息
- 清理数据库访问时的详细日志信息
- 清理个人中心打开时的 Token 调试信息

### Fixed
- 修复 `delete_file` 工具无法正确提取文件路径的问题（缺少对 `params.relativeWorkspacePath` 的检查）
- 修复 `read_lints` 工具在无错误时仍显示 ❌ 的问题，现在正确显示 ✅
- 优化错误判断逻辑，基于实际错误数量而非 result 对象是否为空

---

## [0.0.5] - 2026-01-20

### Added
- 添加扩展图标 `resources/icon.png`，在插件市场更易识别

### Changed
- 修改活动栏图标为 `$(references)` 样式，更符合插件功能定位
- 优化命令列表，移除内部测试和开发用的命令，简化用户界面
- 清理无用的菜单项引用

### Removed
- 移除 `discoverData`、`analyzeDatabase`、`openSessionMarkdown` 等开发调试命令
- 移除 `testToolExtraction`、`testUriHandler`、`showLogs`、`showStatus` 等内部测试命令
- 移除 `uploadRecord` 命令（功能已集成到上下文菜单）
- 移除 `refreshUserInfo` 命令的菜单项引用

---

## [0.0.4] - 2026-01-20

### Fixed
- 修复 `.vscodeignore` 配置，确保 `sql.js` 及其 wasm 文件被正确打包
- 解决扩展安装后无法加载数据库模块的问题

---

## [0.0.3] - 2026-01-20

### Added
- 添加外部 JSON 配置文件 `config.json` 和 `config.prod.json`
- GitHub Actions 自动使用生产环境配置进行构建
- 开发和生产环境配置分离，便于开发测试
- 添加 `.vscodeignore` 文件优化打包大小

### Changed
- 重构配置管理方案，使用外部 JSON 配置文件替代双 TypeScript 文件
- 生产环境默认服务器更新为 `https://spec.ak01.cn`
- 开发环境保持使用 `https://spec.pixvert.app`
- 配置文件从 ~6KB 减少到 ~120B，更加简洁优雅
- 升级 GitHub Actions Node.js 版本到 20
- 优化打包流程，扩展包大小从 35+ MB 减少到约 600 KB（减少 98%）

### Fixed
- 修复 `EventEmitter.fire()` 缺失参数的编译错误
- 修复 ovsx 在 Node.js 18 的兼容性问题

### Removed
- 删除 `config.prod.ts`，改用 `config.prod.json`
- 打包时排除 `node_modules/`、`tests/`、`specs/`、`docs/` 等开发文件

---

## [0.0.2] - 2026-01-20

### Added
- 自动发布到 Open VSX 的 GitHub Actions 工作流
- 完善的发布文档和配置指南
- package.json 中添加了 repository、license、keywords 等元数据

### Fixed
- 修复了部分已知问题

---

## [0.0.1] - 2026-01-15

### Added
- 初始版本发布
- 数据采集功能
- Session 列表面板
- Markdown 渲染器
- 上传记录功能
- 用户认证和登录
- 个人信息显示

---

## 版本说明

- **主版本号（Major）**：不兼容的 API 修改
- **次版本号（Minor）**：向下兼容的功能性新增
- **修订号（Patch）**：向下兼容的问题修正
