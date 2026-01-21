# Remote SSH 环境支持

## 问题描述

在 Windows 下使用 SSH 远程协议连接到远程 Linux 进行开发时，会出现以下架构问题：

```
┌─────────────────────────────────────┐
│   本地 Windows 机器                  │
│                                     │
│   - VSCode UI 进程                  │
│   - AI 对话记录数据库               │
│     (%APPDATA%\Cursor\User\...)    │
└─────────────────────────────────────┘
            │
            │ SSH 连接
            ▼
┌─────────────────────────────────────┐
│   远程 Linux 服务器                  │
│                                     │
│   - VSCode Server                  │
│   - 扩展插件运行环境 (默认)          │
│   - 工作空间代码                    │
└─────────────────────────────────────┘
```

**核心问题**：
- AI 对话记录（SQLite 数据库）存储在本地 Windows
- 插件代码默认在远程 Linux 服务器上运行
- 远程插件无法访问本地 Windows 文件系统
- 导致无法读取 AI 对话记录

## VSCode Remote Extension 架构

VSCode 扩展可以在两个位置运行：

### 1. Workspace Extension（默认）
- 运行在远程服务器上
- 可以访问远程文件系统
- 适合需要访问工作空间代码的扩展（如语言服务器、调试器）

### 2. UI Extension
- 运行在本地 VSCode UI 进程中
- 可以访问本地文件系统
- 适合需要访问本地数据的扩展（如主题、UI 增强）

## 解决方案

### 方案 1：配置为 UI Extension（已实施）✅

通过在 `package.json` 中添加 `extensionKind` 配置，强制插件始终在本地运行：

```json
{
  "extensionKind": [
    "ui"
  ]
}
```

**优点**：
- ✅ 简单直接，无需修改代码
- ✅ 可以访问本地数据库文件
- ✅ 与本地开发体验一致

**缺点**：
- ⚠️ 无法访问远程工作空间的某些信息（但对本插件影响不大）

### 方案 2：数据同步机制（未实施）

定期将本地数据库同步到远程服务器。

**优点**：
- ✅ 可以同时访问本地和远程资源

**缺点**：
- ❌ 实现复杂
- ❌ 需要处理同步冲突
- ❌ 可能有延迟

### 方案 3：客户端-服务器架构（未实施）

将插件拆分为本地和远程两部分，通过 RPC 通信。

**优点**：
- ✅ 灵活性高
- ✅ 可以同时访问本地和远程资源

**缺点**：
- ❌ 实现非常复杂
- ❌ 需要维护两套代码
- ❌ 需要处理通信协议

## 实施步骤

### 1. 修改 package.json（已完成）

添加 `extensionKind` 配置：

```json
{
  "extensionKind": ["ui"]
}
```

### 2. 重新打包和发布

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 打包
vsce package

# 发布
vsce publish
```

### 3. 用户更新扩展

用户需要更新到包含此修复的版本（v0.0.8+）。

## 验证方法

### 测试场景

1. **本地开发**（应该正常工作）
   ```
   Windows/Mac/Linux 本地打开项目
   → 插件在本地运行
   → 可以访问本地数据库
   → ✅ 功能正常
   ```

2. **Remote SSH**（修复后应该正常工作）
   ```
   Windows 本地 SSH 连接到 Linux
   → 插件强制在本地运行
   → 可以访问本地数据库
   → ✅ 功能正常
   ```

3. **Remote WSL**（应该正常工作）
   ```
   Windows 本地连接到 WSL
   → 插件在本地运行
   → 可以访问本地数据库
   → ✅ 功能正常
   ```

### 验证步骤

1. 更新插件到最新版本
2. 通过 SSH 连接到远程服务器
3. 打开一个项目
4. 查看插件的 Session 列表
5. 尝试上传一条记录

**预期结果**：可以看到本地的 AI 对话记录，并且可以正常上传。

## 诊断工具

如果遇到问题，可以使用以下命令诊断：

### 1. 检查插件运行位置

在 VSCode 的扩展面板中：
1. 找到 "Cursor Assistant" 扩展
2. 查看是否显示 "UI" 标签（表示在本地运行）

### 2. 运行诊断命令

```
Cmd+Shift+P (Mac) 或 Ctrl+Shift+P (Windows/Linux)
→ Cursor Assistant: 诊断工作空间路径
```

查看输出中的：
- 平台信息（应该显示本地操作系统）
- 用户数据目录（应该指向本地路径）
- 数据库文件列表

### 3. 查看开发者工具日志

```
Help → Toggle Developer Tools → Console
```

搜索关键词：`CursorDataLocator`、`WorkspaceHelper`

## 技术细节

### extensionKind 配置说明

```json
{
  "extensionKind": ["ui"]
}
```

**取值**：
- `"ui"`: 只在本地 UI 进程运行
- `"workspace"`: 只在远程工作空间进程运行
- `["ui", "workspace"]`: 优先在 UI 运行，如果不支持则在 workspace 运行
- `["workspace", "ui"]`: 优先在 workspace 运行，如果不支持则在 UI 运行

### 为什么选择 "ui"

本插件的核心功能：
1. ✅ 读取本地 Cursor 数据库（需要访问本地文件系统）
2. ✅ 显示会话列表（UI 功能）
3. ✅ 上传记录到服务器（网络请求，本地和远程都可以）
4. ✅ 用户认证（网络请求，本地和远程都可以）

**结论**：所有核心功能都需要访问本地资源，因此应该在本地运行。

### 兼容性考虑

| 开发模式 | 修复前 | 修复后 |
|---------|--------|--------|
| 本地开发 | ✅ 正常 | ✅ 正常 |
| Remote SSH | ❌ 失败 | ✅ 正常 |
| Remote WSL | ❌ 失败 | ✅ 正常 |
| Remote Container | ❌ 失败 | ✅ 正常 |
| Remote Tunnels | ❌ 失败 | ✅ 正常 |

## 已知限制

### 1. 远程工作空间路径

虽然插件在本地运行，但它仍然可以通过 VSCode API 获取远程工作空间信息：

```typescript
// 这些 API 在 UI Extension 中依然可用
vscode.workspace.workspaceFolders  // ✅ 可用
vscode.workspace.workspaceFile     // ✅ 可用
vscode.window.activeTextEditor     // ✅ 可用
```

### 2. 远程文件系统访问

如果未来需要访问远程文件，可以使用 VSCode 的文件系统 API：

```typescript
// 使用 URI 访问远程文件
const uri = vscode.Uri.parse('vscode-remote://ssh-remote+hostname/path/to/file');
const content = await vscode.workspace.fs.readFile(uri);
```

## 参考资料

### VSCode 官方文档

- [Extension Capabilities](https://code.visualstudio.com/api/extension-capabilities/common-capabilities)
- [Supporting Remote Development](https://code.visualstudio.com/api/advanced-topics/remote-extensions)
- [Extension Kinds](https://code.visualstudio.com/api/advanced-topics/extension-host#preferred-extension-location)

### 相关 Issue

- 本次修复解决的问题：Remote SSH 环境下无法访问本地数据库

如有其他问题，请提交 Issue：https://github.com/howelljiang/cursor-helper/issues

## 更新日志

### 2026-01-21
- ✅ 添加 `extensionKind: ["ui"]` 配置
- ✅ 创建 Remote SSH 支持文档
- ✅ 解决远程开发环境下无法访问本地数据库的问题
