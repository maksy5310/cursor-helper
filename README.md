# 提示词分享助手

<p align="center">
  <img src="resources/icon.png" width="128" height="128" alt="提示词分享助手">
</p>

<h3 align="center">一键提取 Cursor AI 对话记录，轻松分享你的编程灵感</h3>

<p align="center">
   <img src="https://img.shields.io/badge/version-0.1.14-blue" alt="Version">
  <img src="https://img.shields.io/badge/Cursor-Compatible-blue" alt="Cursor Compatible">
  <img src="https://img.shields.io/badge/VS%20Code-Compatible-blue" alt="VS Code Compatible">
  <img src="https://img.shields.io/badge/License-Apache%202.0-blue" alt="License">
</p>

---

## 📖 这是什么？

在 Cursor 中使用 AI Agent 模式编程时，你和 AI 的对话包含了很多价值：

- 你的问题思路
- AI 的解决方案  
- 代码优化建议
- Bug 排查过程

这些对话很有用，但 Cursor 没有方便的分享功能。

**提示词分享助手**解决这个问题：

- 🔍 自动提取 Cursor 数据库中的对话
- 📝 转换为清晰的 Markdown 格式
- 📤 一键上传，生成分享链接
- 👥 轻松分享给同事或保存备查

---

## ⚡ 安装

### 从 Cursor插件市场安装（推荐）

1. 打开 Cursor
2. 按 `Ctrl+Shift+X` (Windows/Linux) 或 `Cmd+Shift+X` (Mac)
3. 搜索 **"提示词分享助手"**
4. 点击安装

### 手动安装

1. 下载 [最新版本](https://github.com/howelljiang/cursor-helper/releases)
2. 按 `Ctrl+Shift+P` / `Cmd+Shift+P` 
3. 输入 `Extensions: Install from VSIX...`
4. 选择下载的 `.vsix` 文件

---

## 🚀 快速开始

### 1️⃣ 登录

安装插件后，在 Cursor 左侧活动栏找到 **📚 书签图标**（Cursor Assistant），点击打开插件面板。

**首次使用需要登录：**
1. 在"个人信息"面板点击 **登录** 按钮
2. 浏览器自动打开登录页面（支持 GitHub/Google 登录）
3. 登录成功后，Cursor 会自动更新你的用户信息

> 💡 提示：登录后你的头像和用户名会显示在面板顶部

### 2️⃣ 浏览对话记录

在 **Sessions** 面板中，你可以看到所有 Cursor Composer 的对话记录：
- 按时间倒序排列
- 显示会话标题和项目名称
- 点击任意会话，在编辑器中查看 Markdown 格式的对话内容

### 3️⃣ 分享对话

想要分享某个对话？有两种方式：

**方式一：右键菜单**
1. 在 Sessions 列表中，右键点击要分享的对话
2. 选择"分享"
3. 在弹出的表单中确认信息（项目名称会自动填充）
4. 点击"提交"，几秒后获得分享链接

**方式二：直接分享**
1. 点击会话打开 Markdown 内容
2. 使用命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`）
3. 输入"Cursor Assistant"查看可用命令
4. 选择上传相关命令

> 🔗 分享链接可以发送给同事，或保存到知识库供日后查阅

---

## 💡 典型场景

**学习笔记**

你和 AI 深入讨论了某个技术问题，对话很有价值：
- ✅ 点击对话，上传
- ✅ 得到链接，随时回顾

**Bug 排查**

你和 AI 一起排查了 1 小时的 Bug：
- ✅ 上传对话记录
- ✅ 分享给团队成员
- ✅ 避免其他人重复踩坑

**最佳实践**

AI 给出了很好的代码优化建议：
- ✅ 保存对话
- ✅ 整理成团队规范
- ✅ 沉淀为知识库

---

## 🔒 隐私说明

### 我们做什么

- ✅ **只读**：从 Cursor 本地数据库读取数据
- ✅ **用户控制**：只在你点"上传"时才发送数据
- ✅ **可编辑**：上传前可以编辑、删除敏感内容

### 我们不做什么

- ❌ 不会自动上传你的对话
- ❌ 不会读取你的代码文件
- ❌ 不会收集编辑器操作记录

---

## ❓ 常见问题

**Q: 为什么看不到会话列表？**

A: 请确认以下几点：
- 确保你使用过 Cursor 的 **Composer** 模式（Agent 对话）
- 插件已经成功激活（查看左侧活动栏是否有书签图标）
- 如果仍然没有，尝试重启 Cursor

> 💡 **Mac 和远程开发用户**: 如果在 Mac 或 SSH 远程开发环境下看不到会话列表，有两种诊断方式：
> 
> **方式1: 在 Cursor 中运行诊断命令**
> 1. 打开命令面板 (`Cmd+Shift+P` / `Ctrl+Shift+P`)
> 2. 输入 `Cursor Assistant: 诊断工作空间路径`
> 3. 查看诊断结果和解决建议
> 
> **方式2: 使用独立诊断脚本（推荐）**
> ```bash
> # Windows: 双击运行 diagnostics/scan.bat
> # Mac/Linux: 
> cd diagnostics
> ./scan.sh
> ```
> 这会生成详细的诊断报告 (`workspace-diagnostic-report.json`)，可以发送给开发者分析。
> 
> **🔧 Remote SSH 用户特别说明**:
> 
> 如果你在 Windows 本地通过 SSH 连接到远程 Linux/Mac 服务器进行开发，请确保使用 **v0.0.8 或更高版本**。
> 旧版本的插件会在远程服务器上运行，无法访问本地的 AI 对话记录数据库。
> 新版本已修复此问题，插件会强制在本地运行，可以正常访问本地数据库。
> 
> 详细说明请参考：
> - [Remote SSH 环境支持说明](./docs/REMOTE_SSH_SUPPORT.md)
> - [Mac 和远程开发使用指南](./docs/MAC_REMOTE_TROUBLESHOOTING.md)
> - [诊断工具使用说明](./diagnostics/README.md)

**Q: 登录失败怎么办？**

A: 如果点击"登录"按钮后浏览器没有打开，请运行诊断命令：

1. 打开命令面板 (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. 输入 `Cursor Assistant: 诊断登录问题`
3. 按照提示测试浏览器打开功能

如果浏览器能打开但登录失败：
- 检查网络连接是否正常
- 确认浏览器已完成登录流程
- 如果浏览器关闭过快，在插件中重新点击"登录"按钮
- 查看 Cursor 输出面板（Output > Cursor Assistant）的错误信息

详细说明：[登录问题排查指南](./docs/LOGIN_TROUBLESHOOTING.md)

**Q: 上传失败怎么办？**

A: 请按以下步骤排查：
1. 确认是否已登录（查看个人信息面板）
2. 检查网络连接
3. 查看输出面板（Output > Cursor Assistant）的详细错误
4. 如果是大文件，可能需要等待更长时间

**Q: 可以删除已上传的记录吗？**

A: 可以。使用以下方式管理：
1. 点击插件面板的"打开个人中心"按钮
2. 或直接访问分享平台网站
3. 在"我的记录"页面可以查看、编辑、删除已上传的内容

**Q: 支持哪些导出格式？**

A: 目前支持：
- **Markdown** - 适合技术文档，格式清晰（推荐）
- **Text** - 纯文本格式
- **JSON** - 结构化数据，便于二次处理
- **HTML** - 可直接在浏览器中查看

**Q: 我的数据安全吗？**

A: 
- ✅ 插件只读取 Cursor 本地数据库，不会修改任何文件
- ✅ 只有你点击"上传"时才会发送数据到服务器
- ✅ 上传前可以预览和编辑内容，删除敏感信息
- ✅ 所有上传的记录只有你自己可以管理

**Q: 这个插件收费吗？**

A: 插件完全免费，开源在 GitHub 上。

---

## 🔗 链接

- [GitHub 仓库](https://github.com/howelljiang/cursor-helper)
- [问题反馈](https://github.com/howelljiang/cursor-helper/issues)
- [功能建议](https://github.com/howelljiang/cursor-helper/discussions)

---

## 📄 许可证

Apache License 2.0

---

<p align="center">
  让每一次 AI 对话都值得分享 ✨
</p>
