# Mac 和远程开发环境使用指南

## 问题说明

在 Mac 和远程开发环境（SSH）下，Cursor Helper 可能遇到工作空间路径匹配问题，导致无法读取使用统计和聊天记录。

## 快速诊断

1. 打开命令面板（Mac: `Cmd+Shift+P`，Windows: `Ctrl+Shift+P`）
2. 输入 `Cursor Assistant: 诊断工作空间路径`
3. 运行命令
4. 查看输出面板中的诊断结果

## 诊断输出说明

### ✓ 正常情况

```
5. 诊断总结:
   ✓ 工作空间路径匹配成功
   ✓ 已找到对应的数据库文件
```

这表示一切正常，Cursor Helper 可以正确读取数据。

### ✗ 路径不匹配

```
5. 诊断总结:
   ✗ 工作空间已检测，但未找到匹配的数据库
   可能原因:
     1. 这是首次打开此工作空间，数据库尚未生成
     2. 路径格式不匹配（Mac/远程开发）
     3. 工作空间存储目录中没有对应的数据库文件
```

## 解决方案

### 情况1: 首次打开工作空间

**特征:**
- 工作空间存储目录中没有对应的数据库
- 这是第一次在 Cursor 中打开这个项目

**解决方法:**
1. 在 Cursor 中执行一些操作（如使用 AI 助手）
2. 等待几分钟，让 Cursor 创建数据库
3. 重新运行诊断命令

### 情况2: Mac 路径格式问题

**特征:**
- 已有数据库文件
- 当前工作空间路径: `/Users/username/project`
- 存储的路径不匹配

**解决方法:**

代码已经处理了 Mac 路径格式，这种情况应该自动匹配。如果仍然不匹配：

1. 检查输出面板中的详细路径信息
2. 对比"当前工作空间路径"和"已存储工作空间的解析后路径"
3. 如果路径完全不同，可能是使用了符号链接或不同的工作空间

### 情况3: 远程开发路径不匹配

**特征:**
- 使用 SSH 远程开发
- 原始路径: `vscode-remote://ssh-remote+hostname/path/to/project`
- 本地路径: `/Users/username/project`（或其他本地路径）

**解决方法:**

代码已实现远程路径后缀匹配。查看诊断输出中是否有类似这样的匹配信息：

```
✓ remote path suffix match (depth=2): myapp/src
```

如果没有匹配成功：

1. **检查项目名称是否一致**
   - 远程: `/home/user/projects/myapp`
   - 本地: `/Users/user/projects/myapp`
   - ✓ 项目名称相同，应该能匹配

2. **项目名称不一致**
   - 远程: `/home/user/server-project`
   - 本地: `/Users/user/local-project`
   - ✗ 项目名称不同，无法自动匹配

   解决方法：在本地使用相同的项目目录名称

### 情况4: 多根工作空间

**特征:**
- 打开了 `.code-workspace` 文件
- 工作空间类型: `multi-root`

**解决方法:**

代码已支持多根工作空间，会使用 `.code-workspace` 文件路径进行匹配。

如果不匹配，尝试：
1. 关闭工作空间
2. 重新打开 `.code-workspace` 文件
3. 重新运行诊断命令

## 查看详细日志

如果诊断命令没有解决问题，可以查看详细日志：

1. 打开开发者工具
   - Mac: `Help` > `Toggle Developer Tools`
   - Windows: `帮助` > `切换开发人员工具`

2. 切换到 `Console` 标签

3. 过滤日志: 输入 `CursorDataLocator`

4. 查看匹配过程的详细信息：
   ```
   Workspace 1a2b3c4d5e6f:
     Original path in JSON: vscode-remote://ssh-remote+myserver/home/user/project
     Decoded path: /home/user/project
     Normalized path: /home/user/project
     Current workspace path: /Users/user/project
     Remote path parts: [home, user, project]
     Current path parts: [Users, user, project]
     ✓ remote path suffix match (depth=2): user/project
   ```

## 手动检查数据库

如果需要手动检查，数据库位置：

- **Mac**: `~/Library/Application Support/Cursor/User/workspaceStorage/`
- **Windows**: `%APPDATA%\Cursor\User\workspaceStorage\`
- **Linux**: `~/.config/Cursor/User/workspaceStorage/`

每个工作空间一个目录，目录名是随机生成的ID。每个目录包含：
- `workspace.json`: 工作空间配置（包含路径信息）
- `state.vscdb`: SQLite 数据库文件

## 常见问题

### Q: 为什么 Windows 下正常，Mac/远程开发不正常？

A: 主要是路径格式差异：
- Windows: `F:\project` 或 `f:\project`（盘符+反斜杠）
- Mac: `/Users/username/project`（Unix风格）
- 远程: `vscode-remote://ssh-remote+host/path`（特殊协议）

代码已经处理了这些差异，如果仍有问题，请运行诊断命令查看详情。

### Q: 诊断显示找到了数据库，但读取数据还是失败？

A: 可能的原因：
1. 数据库文件权限问题
2. 数据库文件损坏
3. SQLite 版本不兼容

尝试：
1. 检查文件权限
2. 重启 Cursor
3. 查看错误日志

### Q: 可以手动指定数据库路径吗？

A: 当前版本不支持手动指定，但你可以：
1. 确保工作空间路径正确
2. 使用相同的项目目录名称（本地和远程）
3. 提交 issue 请求添加手动配置功能

## 技术支持

如果以上方法都无法解决问题，请：

1. 运行诊断命令
2. 复制输出面板中的完整诊断信息
3. 在 GitHub 上提交 issue: https://github.com/howelljiang/cursor-helper/issues
4. 包含以下信息：
   - 操作系统版本
   - 是否使用远程开发
   - 诊断命令的完整输出
   - 任何错误信息

## 相关文档

- [MAC_REMOTE_PATH_FIX.md](./MAC_REMOTE_PATH_FIX.md) - 技术实现细节
- [README.md](../README.md) - 项目主文档
