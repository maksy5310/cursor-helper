# Changelog

本文档记录了 Cursor 助手插件的所有重要变更。

版本格式遵循[语义化版本](https://semver.org/lang/zh-CN/)规范。

## [Unreleased]

### 待发布的变更
- 暂无

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
