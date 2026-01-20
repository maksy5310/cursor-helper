# 发布插件到 Cursor 应用市场指南

## 📋 概述

Cursor 使用 **Open VSX Registry** 作为扩展市场。要将插件发布到 Cursor 应用市场，需要先发布到 Open VSX。

---

## 🚀 发布步骤

### 第一步：准备工作

#### 1.1 检查 package.json 配置

确保以下字段已正确配置：

```json
{
  "name": "cursor-assistant",           // 扩展唯一标识（小写，无空格）
  "publisher": "howell",                 // 发布者名称
  "displayName": "Cursor助手",           // 显示名称
  "description": "Cursor 使用数据采集插件", // 描述
  "version": "0.0.1",                    // 版本号
  "engines": {
    "vscode": "^1.74.0"                  // VS Code API 版本
  },
  "categories": ["Other"],               // 分类
  "license": "MIT",                      // 许可证（建议添加）
  "repository": {                        // 仓库信息（建议添加）
    "type": "git",
    "url": "https://github.com/your-username/cursor-helper.git"
  }
}
```

#### 1.2 添加必要的元数据

建议在 `package.json` 中添加：

- **`license`**: 许可证类型（如 MIT、ISC 等）
- **`repository`**: GitHub 仓库地址
- **`homepage`**: 项目主页
- **`bugs`**: 问题反馈地址
- **`keywords`**: 关键词数组
- **`icon`**: 扩展图标（128x128 PNG）

#### 1.3 创建 README.md

确保 README.md 包含：
- 功能说明
- 安装方法
- 使用指南
- 配置选项
- 截图（可选）

#### 1.4 创建 LICENSE 文件

在项目根目录创建 LICENSE 文件（如 MIT、ISC 等）

---

### 第二步：安装 ovsx 工具

Open VSX 使用 `ovsx` 命令行工具进行发布：

```bash
# 安装 ovsx CLI 工具
npm install -g ovsx
```

---

### 第三步：创建 Open VSX 账号

1. 访问 [Open VSX Registry](https://open-vsx.org/)
2. 点击右上角 **Sign In**
3. 使用 GitHub 账号登录（推荐）或创建账号
4. 登录后，访问 [用户设置页面](https://open-vsx.org/user-settings/namespaces)
5. 创建或选择命名空间（Namespace）
   - 命名空间通常与你的 GitHub 用户名相同
   - 例如：如果 GitHub 用户名是 `howell`，命名空间应该是 `howell`

---

### 第四步：获取 Personal Access Token

1. 在 Open VSX 用户设置页面，找到 **Access Tokens** 部分
2. 点击 **Create Token**
3. 输入 Token 名称（如 "cursor-assistant-publish"）
4. 复制生成的 Token（**只显示一次，请妥善保存**）

---

### 第五步：编译和打包

```bash
# 1. 确保项目已编译
npm run compile

# 2. 打包插件（可选，用于本地测试）
vsce package
```

---

### 第六步：发布到 Open VSX

#### 方法一：使用 ovsx publish 命令

```bash
# 设置环境变量（推荐）
export OVSX_PAT=your-personal-access-token

# 发布插件
ovsx publish

# Windows PowerShell
$env:OVSX_PAT="your-personal-access-token"
ovsx publish

# Windows CMD
set OVSX_PAT=your-personal-access-token
ovsx publish
```

#### 方法二：交互式输入 Token

```bash
# 直接运行，会提示输入 Token
ovsx publish
```

#### 发布成功标志

发布成功后，你会看到类似输出：

```
Publishing extension...
Successfully published howell.cursor-assistant v0.0.1
```

---

### 第七步：验证发布

1. 访问你的扩展页面：
   ```
   https://open-vsx.org/extension/howell/cursor-assistant
   ```

2. 检查扩展信息是否正确显示

3. 等待同步到 Cursor（通常需要几分钟到几小时）

---

### 第八步：在 Cursor 中安装测试

1. 打开 Cursor
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 搜索 "Cursor助手" 或 "cursor-assistant"
4. 点击 **Install** 安装
5. 测试插件功能

---

## 🔄 更新版本

### 更新步骤

1. **更新版本号**（在 `package.json` 中）：
   ```json
   "version": "0.0.2"  // 从 0.0.1 升级到 0.0.2
   ```

2. **更新 CHANGELOG.md**（可选但推荐）：
   ```markdown
   ## [0.0.2] - 2026-01-15
   - 修复了某些 bug
   - 添加了新功能
   ```

3. **编译项目**：
   ```bash
   npm run compile
   ```

4. **重新发布**：
   ```bash
   ovsx publish
   ```

---

## ⚠️ 常见问题

### 1. 发布失败：命名空间不匹配

**错误**：`Namespace mismatch`

**解决**：
- 确保 `package.json` 中的 `publisher` 与 Open VSX 中的命名空间一致
- 如果命名空间是 `howell`，`publisher` 也应该是 `howell`

### 2. 发布失败：版本已存在

**错误**：`Version already exists`

**解决**：
- 更新 `package.json` 中的版本号
- 使用语义化版本（Semantic Versioning）：`主版本号.次版本号.修订号`
- 例如：`0.0.1` → `0.0.2` → `0.1.0` → `1.0.0`

### 3. 扩展在 Cursor 中找不到

**原因**：
- Open VSX 同步到 Cursor 需要时间（通常几分钟到几小时）
- 扩展可能不符合 Cursor 的兼容性要求

**解决**：
- 等待一段时间后重试
- 检查扩展的 `engines.vscode` 版本是否兼容
- 确认扩展没有使用 Cursor 不支持的 API

### 4. Token 权限不足

**错误**：`Unauthorized` 或 `Forbidden`

**解决**：
- 检查 Token 是否正确
- 确认 Token 有发布权限
- 重新生成 Token 并重试

---

## 📝 发布前检查清单

在发布前，请确认：

- [ ] `package.json` 中的 `name`、`publisher`、`version` 正确
- [ ] `package.json` 中的 `engines.vscode` 版本兼容
- [ ] 项目已成功编译（`npm run compile`）
- [ ] README.md 内容完整
- [ ] LICENSE 文件已创建
- [ ] 所有生产环境 URL 已配置正确
- [ ] 扩展在本地测试通过
- [ ] Open VSX 账号已创建
- [ ] Personal Access Token 已获取
- [ ] 命名空间与 publisher 一致

---

## 🔗 相关链接

- [Open VSX Registry](https://open-vsx.org/)
- [Open VSX 文档](https://github.com/eclipse/openvsx/wiki)
- [ovsx CLI 工具](https://www.npmjs.com/package/ovsx)
- [VS Code 扩展发布指南](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [语义化版本规范](https://semver.org/lang/zh-CN/)

---

## 💡 提示

1. **首次发布**：建议先在本地测试 `.vsix` 文件，确保一切正常
2. **版本管理**：使用语义化版本，遵循 `主版本.次版本.修订号` 格式
3. **更新频率**：不要过于频繁更新，给用户时间适应
4. **文档维护**：保持 README.md 和 CHANGELOG.md 更新
5. **用户反馈**：关注用户反馈，及时修复问题

---

## 📦 本地打包（用于分发）

如果不想发布到市场，也可以打包后直接分发：

```bash
# 安装 vsce
npm install -g @vscode/vsce

# 打包
vsce package

# 生成文件：cursor-assistant-0.0.1.vsix
```

用户可以通过以下方式安装：
1. 在 Cursor 中按 `Ctrl+Shift+P`
2. 输入 `Extensions: Install from VSIX...`
3. 选择 `.vsix` 文件
