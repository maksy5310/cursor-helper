# 🚀 快速发布指南

## ✅ 你需要完成的工作清单

### 一、配置 GitHub Secrets（只需一次）

1. **获取 Open VSX Token**
   - 访问 https://open-vsx.org/
   - 使用 GitHub 登录
   - 进入 https://open-vsx.org/user-settings/tokens
   - 创建新的 Access Token，命名为 "GitHub Actions"
   - **复制并保存这个 Token**

2. **配置 GitHub Secret**
   - 打开 https://github.com/howelljiang/cursor-helper/settings/secrets/actions
   - 点击 "New repository secret"
   - Name: `OVSX_TOKEN`
   - Value: 粘贴刚才复制的 Token
   - 点击 "Add secret"

### 二、发布新版本（每次发布时）

#### 步骤 1：更新版本号

编辑 `package.json`：

```json
{
  "version": "0.0.3"  // 从 0.0.2 改为 0.0.3
}
```

#### 步骤 2：更新 CHANGELOG

编辑 `CHANGELOG.md`，在 `[Unreleased]` 下方添加：

```markdown
## [0.0.3] - 2026-01-20

### Added
- 新增的功能

### Fixed
- 修复的问题

### Changed
- 改进的内容
```

#### 步骤 3：提交并推送

```bash
# 提交更改
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.0.3"

# 创建版本标签
git tag v0.0.3

# 推送代码和标签
git push origin main
git push origin v0.0.3
```

#### 步骤 4：等待自动发布

1. 打开 https://github.com/howelljiang/cursor-helper/actions
2. 查看 "Publish to Open VSX Registry" 工作流
3. 等待完成（约 2-5 分钟）
4. 成功后会自动创建 GitHub Release

#### 步骤 5：验证发布

- 访问 https://open-vsx.org/extension/howell/cursor-assistant
- 在 Cursor 中搜索 "Cursor助手" 进行测试

---

## 🎯 就这么简单！

配置完 GitHub Secret 后，以后每次发布只需要：

1. 改 `package.json` 版本号
2. 更新 `CHANGELOG.md`
3. 提交代码 + 打标签 + 推送

GitHub Actions 会自动帮你：
- ✅ 切换到生产环境配置
- ✅ 编译代码
- ✅ 验证版本
- ✅ 发布到 Open VSX
- ✅ 创建 GitHub Release

### 📌 环境配置说明

- **本地开发**：自动使用 `config.json`（测试服务器 spec.pixvert.app）
- **自动发布**：GitHub Actions 自动替换为 `config.prod.json`（生产服务器 spec.ak01.cn）
- **配置方式**：简洁的 JSON 配置文件，只有 2 行配置
- **无需手动切换**：配置自动管理，开发和发布完全独立

```json
// 开发环境配置（60 字节）
{"env": "development", "baseUrl": "https://spec.pixvert.app"}

// 生产环境配置（60 字节）
{"env": "production", "baseUrl": "https://spec.ak01.cn"}
```

详见：[配置管理说明](./CONFIG_MANAGEMENT.md)

---

## ⚠️ 常见错误

### 版本不匹配

如果 git tag 和 package.json 版本不一致，会失败。解决：

```bash
# 删除错误的标签
git tag -d v0.0.3
git push origin :refs/tags/v0.0.3

# 修正 package.json 后重新打标签
git tag v0.0.3
git push origin v0.0.3
```

### Token 无效

如果提示 "Unauthorized"，检查：
- GitHub Secret 是否正确配置
- Token 是否过期

---

## 📚 详细文档

如需更多信息，请查看：
- [完整配置指南](./GITHUB_ACTIONS_SETUP.md)
- [手动发布指南](../PUBLISH.md)
