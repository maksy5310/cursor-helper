# v0.0.8 发布检查清单

## 版本信息

- **版本号**: v0.0.8
- **发布日期**: 2026-01-21
- **主要变更**: 修复 Remote SSH 环境支持

## 本次修复内容

### 核心问题
Windows 用户通过 SSH 连接到远程 Linux 进行开发时，插件在远程运行，无法访问本地 Windows 的 AI 对话记录数据库。

### 解决方案
添加 `extensionKind: ["ui"]` 配置，强制插件始终在本地 UI 进程运行，确保能访问本地文件系统。

### 技术变更
- ✅ `package.json`: 添加 `extensionKind: ["ui"]` 配置
- ✅ `package.json`: 版本号更新为 v0.0.8
- ✅ `README.md`: 更新版本号和 Remote SSH 说明
- ✅ `CHANGELOG.md`: 记录本次修复
- ✅ 新增文档: `docs/REMOTE_SSH_SUPPORT.md`
- ✅ 新增文档: `docs/REMOTE_SSH_TESTING_GUIDE.md`

## 发布前检查清单

### 代码检查

- [ ] **验证 package.json 配置**
  ```json
  {
    "version": "0.0.8",
    "extensionKind": ["ui"]
  }
  ```

- [ ] **验证所有文档已更新**
  - [ ] README.md 提到 Remote SSH 支持
  - [ ] CHANGELOG.md 记录了变更
  - [ ] 新增的文档格式正确

- [ ] **代码编译无错误**
  ```bash
  npm run compile
  ```

- [ ] **没有未提交的更改**
  ```bash
  git status
  ```

### 本地测试

- [ ] **本地开发环境测试**
  - [ ] 插件能正常加载
  - [ ] Sessions 面板显示正常
  - [ ] 上传功能正常

- [ ] **Remote SSH 环境测试** （关键！）
  - [ ] 插件显示 "UI" 标签
  - [ ] Sessions 面板显示本地记录
  - [ ] 诊断命令显示本地路径
  - [ ] 上传功能正常

### 文档检查

- [ ] **README.md**
  - [ ] 版本号已更新
  - [ ] Remote SSH 说明清晰
  - [ ] 链接有效

- [ ] **CHANGELOG.md**
  - [ ] 变更记录完整
  - [ ] 日期正确
  - [ ] 格式规范

- [ ] **技术文档**
  - [ ] REMOTE_SSH_SUPPORT.md 内容准确
  - [ ] REMOTE_SSH_TESTING_GUIDE.md 步骤清晰
  - [ ] 代码示例正确

## 发布步骤

### 1. 提交代码

```bash
# 查看变更
git status
git diff

# 暂存所有变更
git add .

# 提交（使用有意义的提交信息）
git commit -m "feat: 添加 Remote SSH 环境支持 (v0.0.8)

- 添加 extensionKind: ['ui'] 配置强制插件在本地运行
- 修复 Windows 通过 SSH 连接远程 Linux 时无法访问本地数据库的问题
- 新增 Remote SSH 支持文档和测试指南
- 更新 README 和 CHANGELOG"

# 推送到远程仓库
git push origin master
```

### 2. 打包扩展

```bash
# 确保已安装 vsce
npm install -g @vscode/vsce

# 打包
vsce package

# 预期输出: cursor-assistant-0.0.8.vsix
```

### 3. 本地安装测试

```bash
# 在 Cursor 中安装打包好的 .vsix 文件
# Ctrl+Shift+P → Extensions: Install from VSIX...
# 选择 cursor-assistant-0.0.8.vsix
```

测试项：
- [ ] 扩展能正常安装
- [ ] 版本号显示为 0.0.8
- [ ] 基本功能正常

### 4. 发布到市场

```bash
# 如果是首次发布，需要先登录
vsce login <publisher-name>

# 发布
vsce publish

# 或者手动上传 .vsix 文件到 VSCode Marketplace
```

### 5. 创建 GitHub Release

1. 访问 GitHub 仓库
2. 点击 "Releases" → "Create a new release"
3. 填写发布信息：

**Tag**: `v0.0.8`

**Release Title**: `v0.0.8 - Remote SSH 环境支持`

**Release Notes**:
```markdown
## 🎉 v0.0.8 - Remote SSH 环境支持

### 🐛 Bug 修复

修复了 Windows 用户通过 SSH 连接远程 Linux 进行开发时，插件无法访问本地 AI 对话记录数据库的问题。

### 🔧 技术变更

- 添加 `extensionKind: ["ui"]` 配置，强制插件在本地 UI 进程运行
- 确保 Remote SSH 环境下能访问本地 Windows 的数据库文件

### 📚 文档更新

- 新增 [Remote SSH 环境支持文档](./docs/REMOTE_SSH_SUPPORT.md)
- 新增 [Remote SSH 测试指南](./docs/REMOTE_SSH_TESTING_GUIDE.md)
- 更新 README 添加 Remote SSH 用户说明

### ✅ 支持的环境

- ✅ Windows 本地开发
- ✅ Mac 本地开发
- ✅ Linux 本地开发
- ✅ Windows → Linux Remote SSH（本次修复）
- ✅ Windows → Mac Remote SSH（本次修复）
- ✅ Remote WSL
- ✅ Remote Container

### 📦 安装方式

**自动更新**（推荐）：
Cursor 会自动检测并提示更新到最新版本。

**手动安装**：
1. 下载下方的 `cursor-assistant-0.0.8.vsix` 文件
2. 在 Cursor 中：`Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. 选择下载的文件

### 🙏 致谢

感谢用户反馈此问题，帮助我们改进插件的远程开发体验。

---

完整变更日志请参考：[CHANGELOG.md](./CHANGELOG.md)
```

4. 上传 `cursor-assistant-0.0.8.vsix` 文件作为 release asset
5. 发布 Release

### 6. 更新相关文档

- [ ] 更新项目主页（如果有）
- [ ] 更新用户指南
- [ ] 在相关 Issue 中评论修复信息

### 7. 通知用户

- [ ] 在 GitHub Discussions 发布更新公告
- [ ] 在相关 Issue 中回复用户
- [ ] 如果有用户群/社区，发布更新通知

## 发布后验证

### 验证市场发布

- [ ] VSCode/Cursor 市场能搜索到新版本
- [ ] 版本号显示为 0.0.8
- [ ] 更新说明正确显示

### 用户反馈跟踪

监控以下渠道的反馈：
- [ ] GitHub Issues
- [ ] GitHub Discussions  
- [ ] VSCode Marketplace 评论
- [ ] 用户私信/邮件

### 问题响应

如果发现问题：
1. 立即记录到 Issues
2. 评估严重程度
3. 如果是严重 bug，考虑回滚或发布 hotfix
4. 如果是小问题，收集到下个版本修复

## 回滚计划

如果 v0.0.8 出现严重问题需要回滚：

1. **从市场撤回版本**（如果支持）
2. **发布回滚版本 v0.0.9**
   - 移除 `extensionKind: ["ui"]` 配置
   - 在 CHANGELOG 中说明原因
3. **通知用户**
   - 在 GitHub 发布公告
   - 说明回滚原因和影响

## 下一步计划

- [ ] 监控用户反馈（1-2 周）
- [ ] 收集新功能需求
- [ ] 规划 v0.0.9 或 v0.1.0 功能

## 注意事项

### ⚠️ 重要提醒

1. **测试优先**：必须在 Remote SSH 环境中实际测试通过才能发布
2. **文档同步**：确保所有文档中的版本号一致
3. **Git 标签**：创建 git tag 与 GitHub Release 版本号一致
4. **备份**：保留 v0.0.7 的 .vsix 文件以防需要回滚

### 💡 发布技巧

- 选择合适的发布时间（避免周五晚上或节假日前）
- 准备好快速响应用户反馈
- 保持 GitHub Issues 和 Discussions 打开状态
- 及时回复用户问题和感谢反馈

## 检查清单确认

发布前，确认以上所有 `[ ]` 都已变成 `[x]`。

---

**发布负责人签字**: _______________

**日期**: _______________

**备注**: _______________
