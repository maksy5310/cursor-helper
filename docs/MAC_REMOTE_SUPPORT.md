# Mac 和远程开发支持改进

## 问题

在 Windows 下插件工作正常，但在 Mac 和远程开发（SSH）环境下无法找到工作空间数据库，导致看不到会话列表。

## 原因

不同平台和开发模式下，工作空间路径格式不同：

| 环境 | 路径格式示例 |
|------|-------------|
| Windows | `F:\project` 或 `f:\project` |
| Mac | `/Users/username/project` |
| Linux | `/home/username/project` |
| 远程开发 | `vscode-remote://ssh-remote+hostname/path/to/project` |

原有代码主要针对 Windows 路径格式设计，在 Mac 和远程环境下路径解析和匹配会失败。

## 解决方案

### 1. 增强路径解析（`decodeFileUrl`）

**支持远程路径：**
```typescript
if (fileUrl.startsWith('vscode-remote://')) {
    // 提取: vscode-remote://ssh-remote+hostname/path/to/project
    // 返回: /path/to/project
}
```

**支持 Mac/Linux 路径：**
```typescript
// Mac/Linux: 确保路径以 / 开头
if (!decoded.startsWith('/')) {
    decoded = '/' + decoded;
}
```

### 2. 智能路径匹配

**策略1: 完全匹配**
- Windows: 不区分大小写
- Mac/Linux: 区分大小写

**策略2: 后缀匹配（远程开发）**

当路径完全不匹配时，尝试匹配路径的最后几个部分：

```
远程路径: /home/user/projects/myapp
本地路径: /Users/user/projects/myapp
后缀匹配: projects/myapp ✓
```

### 3. 新增诊断命令

运行命令：`Cursor Assistant: 诊断工作空间路径`

输出信息：
- 平台信息
- 当前工作空间路径
- 所有已存储的工作空间
- 路径匹配结果
- 诊断建议

## 使用方法

### 快速诊断

1. `Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows)
2. 输入：`Cursor Assistant: 诊断工作空间路径`
3. 查看诊断结果

### 查看详细日志

1. 打开输出面板（View > Output）
2. 选择 "Cursor Assistant"
3. 查看路径匹配过程

### 常见情况

**✅ 正常情况：**
```
✓ 工作空间路径匹配成功
✓ 已找到对应的数据库文件
```

**⚠️ 首次打开工作空间：**
```
✗ 未找到匹配的数据库
原因：首次打开，数据库尚未生成
解决：使用一次 Cursor Composer，等待数据库生成
```

**⚠️ 远程开发路径不匹配：**
```
原因：本地路径和远程路径的项目名称不同
解决：确保本地和远程使用相同的项目目录名称
```

## 技术改进

### 文件变更

1. **`src/utils/cursorDataLocator.ts`**
   - 增强 `decodeFileUrl()` - 支持远程路径和 Mac 路径
   - 优化 `getWorkspaceDatabasePath()` - 增加后缀匹配逻辑
   - 新增 `getAllWorkspaceInfo()` - 获取所有工作空间信息
   - 添加详细的调试日志

2. **`src/commands/diagnoseWorkspace.ts`** (新文件)
   - 实现诊断命令
   - 输出详细的路径匹配信息

3. **`src/extension.ts`**
   - 注册诊断命令

4. **`package.json`**
   - 添加命令定义

### 新增文档

- `docs/MAC_REMOTE_PATH_FIX.md` - 技术实现细节
- `docs/MAC_REMOTE_TROUBLESHOOTING.md` - 故障排查指南

### 测试建议

**Mac 环境：**
1. 打开本地项目
2. 运行诊断命令
3. 检查是否找到数据库

**远程开发：**
1. SSH 连接到远程服务器
2. 打开远程项目
3. 运行诊断命令
4. 检查路径匹配情况

## 兼容性

- ✅ Windows 10/11
- ✅ macOS 10.15+
- ✅ Linux (Ubuntu, Debian, etc.)
- ✅ VSCode 远程开发 (SSH, WSL, Container)

## 已知限制

1. **符号链接**：如果使用符号链接，路径可能无法正确匹配
2. **项目重命名**：本地和远程项目名称必须一致才能匹配
3. **多工作空间**：如果同时打开多个项目，只会匹配第一个

## 后续优化

- [ ] 支持手动指定数据库路径
- [ ] 支持符号链接路径解析
- [ ] 优化多工作空间场景的匹配
- [ ] 添加路径映射配置选项

## 相关 Issue

- 本次改进解决的问题：Mac 和远程开发下无法找到工作空间数据库

如有其他问题，请提交 Issue：https://github.com/howelljiang/cursor-helper/issues
