# GitHub Actions 自动发布配置指南

## 📋 概述

本项目已配置 GitHub Actions 工作流，可在推送版本标签时自动发布到 Open VSX Registry（Cursor 应用市场）。

---

## 🚀 快速开始

### 前置条件

1. ✅ 已有 GitHub 仓库
2. ✅ 已创建 Open VSX 账号
3. ✅ 已获取 Open VSX Personal Access Token

---

## 🔧 配置步骤

### 第一步：获取 Open VSX Personal Access Token

如果还没有 Token，请按以下步骤获取：

1. 访问 [Open VSX Registry](https://open-vsx.org/)
2. 使用 GitHub 账号登录
3. 进入 [用户设置 - Access Tokens](https://open-vsx.org/user-settings/tokens)
4. 点击 **New Access Token**
5. 输入 Token 名称（如 "GitHub Actions"）
6. 复制生成的 Token（**只显示一次，请妥善保存**）

### 第二步：配置 GitHub Secrets

1. 打开你的 GitHub 仓库
2. 进入 **Settings** > **Secrets and variables** > **Actions**
3. 点击 **New repository secret**
4. 添加以下 Secret：

   - **Name**: `OVSX_TOKEN`
   - **Value**: 粘贴你在第一步获取的 Open VSX Personal Access Token

5. 点击 **Add secret** 保存

> **重要提示**：`GITHUB_TOKEN` 是 GitHub Actions 自动提供的，无需手动配置。

### 第三步：验证配置

1. 检查 `.github/workflows/publish.yml` 文件是否存在
2. 确认文件内容正确（已提交到仓库）
3. 确认 `OVSX_TOKEN` Secret 已正确配置

---

## 📦 发布新版本

### 完整发布流程

#### 1. 更新版本号

编辑 `package.json`，更新版本号：

```json
{
  "version": "0.0.3"
}
```

> 使用[语义化版本](https://semver.org/lang/zh-CN/)：`主版本号.次版本号.修订号`
>
> - **修订号**：修复 bug（0.0.1 → 0.0.2）
> - **次版本号**：新增功能（0.0.2 → 0.1.0）
> - **主版本号**：不兼容的 API 修改（0.1.0 → 1.0.0）

#### 2. 更新 CHANGELOG（可选但推荐）

创建或更新 `CHANGELOG.md`：

```markdown
## [0.0.3] - 2026-01-20

### Added
- 新增功能 A
- 新增功能 B

### Fixed
- 修复问题 X
- 修复问题 Y

### Changed
- 优化 Z
```

#### 3. 提交代码

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.0.3"
```

#### 4. 创建并推送版本标签

```bash
# 创建版本标签（必须以 v 开头）
git tag v0.0.3

# 推送代码和标签到 GitHub
git push origin main
git push origin v0.0.3
```

#### 5. 监控发布过程

1. 打开 GitHub 仓库的 **Actions** 页面
2. 查看 "Publish to Open VSX Registry" 工作流
3. 等待工作流完成（通常需要 2-5 分钟）

#### 6. 验证发布

发布成功后：

1. 访问你的扩展页面：
   ```
   https://open-vsx.org/extension/howell/cursor-assistant
   ```

2. 检查版本是否更新

3. 在 Cursor 中搜索并安装测试

---

## 🔍 工作流说明

### 触发条件

工作流在以下情况下自动触发：

- 推送格式为 `v*.*.*` 的标签（如 `v0.0.3`、`v1.2.0`）

### 工作流步骤

1. ✅ **检出代码**：获取仓库代码
2. ✅ **设置 Node.js**：配置 Node.js 18 环境
3. ✅ **安装依赖**：执行 `npm ci`
4. ✅ **编译代码**：执行 `npm run compile`
5. ✅ **验证版本**：确保 `package.json` 版本与 Git 标签一致
6. ✅ **安装 ovsx**：安装 Open VSX CLI 工具
7. ✅ **发布扩展**：使用 `ovsx publish` 发布到 Open VSX
8. ✅ **创建 Release**：在 GitHub 创建发布记录

### 版本验证

工作流会自动验证版本号一致性：

- **Git 标签版本**：`v0.0.3` → `0.0.3`
- **package.json 版本**：`"version": "0.0.3"`

如果两者不一致，工作流会失败并报错。

---

## ⚠️ 常见问题

### 1. 工作流失败：版本不匹配

**错误信息**：
```
Error: Version mismatch!
Git tag version (0.0.3) does not match package.json version (0.0.2)
```

**解决方法**：
- 确保 `package.json` 中的版本号与 Git 标签一致
- 如果标签错误，删除标签后重新创建：
  ```bash
  # 删除本地标签
  git tag -d v0.0.3
  
  # 删除远程标签
  git push origin :refs/tags/v0.0.3
  
  # 更新 package.json 后重新创建标签
  git tag v0.0.3
  git push origin v0.0.3
  ```

### 2. 工作流失败：Token 无效

**错误信息**：
```
Error: Unauthorized
```

**解决方法**：
- 检查 GitHub Secrets 中的 `OVSX_TOKEN` 是否正确
- 确认 Token 是否过期（在 Open VSX 用户设置中检查）
- 重新生成 Token 并更新 GitHub Secret

### 3. 工作流失败：版本已存在

**错误信息**：
```
Error: Extension version already exists
```

**解决方法**：
- Open VSX 不允许覆盖已发布的版本
- 更新 `package.json` 中的版本号
- 创建新的 Git 标签并推送

### 4. 扩展在 Cursor 中找不到

**原因**：
- Open VSX 同步到 Cursor 需要时间（通常几分钟到几小时）

**解决方法**：
- 等待一段时间后重试
- 在 Open VSX 网站上确认扩展已发布成功

### 5. 如何撤销错误的发布？

**情况 1**：标签已推送但工作流未完成
```bash
# 删除远程标签（立即停止工作流）
git push origin :refs/tags/v0.0.3

# 删除本地标签
git tag -d v0.0.3
```

**情况 2**：已发布到 Open VSX
- Open VSX 不支持删除已发布的版本
- 只能发布新的修复版本（如 `v0.0.4`）

---

## 📝 最佳实践

### 版本管理

1. **遵循语义化版本**：
   - 修复 bug：增加修订号（0.0.1 → 0.0.2）
   - 新增功能：增加次版本号（0.0.2 → 0.1.0）
   - 重大变更：增加主版本号（0.1.0 → 1.0.0）

2. **在发布前测试**：
   - 本地测试所有功能
   - 确保编译无错误：`npm run compile`
   - 手动测试：使用 `F5` 在 Extension Development Host 中测试

3. **保持 CHANGELOG 更新**：
   - 每次发布前更新 CHANGELOG.md
   - 记录所有重要变更

### 标签管理

1. **使用带注释的标签**（推荐）：
   ```bash
   git tag -a v0.0.3 -m "Release version 0.0.3"
   ```

2. **查看所有标签**：
   ```bash
   git tag -l
   ```

3. **删除错误的标签**：
   ```bash
   # 删除本地标签
   git tag -d v0.0.3
   
   # 删除远程标签
   git push origin :refs/tags/v0.0.3
   ```

### 发布前检查清单

在推送版本标签前，确认：

- [ ] `package.json` 版本号已更新
- [ ] CHANGELOG.md 已更新（如果有）
- [ ] 代码已编译成功（`npm run compile`）
- [ ] 本地测试通过
- [ ] 代码已提交到 main 分支
- [ ] GitHub Secret `OVSX_TOKEN` 已配置
- [ ] 版本标签格式正确（`v主.次.修订`）

---

## 🔗 相关链接

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Open VSX Registry](https://open-vsx.org/)
- [ovsx CLI 工具](https://www.npmjs.com/package/ovsx)
- [语义化版本规范](https://semver.org/lang/zh-CN/)

---

## 🆘 获取帮助

如果遇到问题：

1. 检查 [GitHub Actions 运行日志](../../actions)
2. 查看本文档的"常见问题"部分
3. 访问 [Open VSX Wiki](https://github.com/eclipse/openvsx/wiki)
4. 在 GitHub Issues 中提问

---

## 📊 发布命令速查表

```bash
# 完整发布流程
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.0.3"
git tag v0.0.3
git push origin main
git push origin v0.0.3

# 查看标签
git tag -l

# 删除标签
git tag -d v0.0.3                    # 删除本地
git push origin :refs/tags/v0.0.3   # 删除远程

# 带注释的标签
git tag -a v0.0.3 -m "Release version 0.0.3"
```
