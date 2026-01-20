# Changelog

本文档记录了 Cursor 助手插件的所有重要变更。

版本格式遵循[语义化版本](https://semver.org/lang/zh-CN/)规范。

## [Unreleased]

### 待发布的变更
- 暂无

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
