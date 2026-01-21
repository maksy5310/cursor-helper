# Mac 和远程开发环境下的工作空间路径定位问题

## 问题描述

在 Mac 和远程开发（SSH）环境下，Cursor Helper 可能无法正确定位工作空间数据库，导致无法读取使用统计和聊天记录。

## 原因分析

### 1. Mac 路径格式

Mac 使用 Unix 风格的路径：
- `/Users/username/project`
- 路径以 `/` 开头，大小写敏感

### 2. 远程开发路径格式

远程开发时，Cursor 在 `workspace.json` 中存储的路径格式为：
```
vscode-remote://ssh-remote+hostname/path/to/project
```

而 VSCode API (`vscode.workspace.workspaceFolders[0].uri.fsPath`) 返回的可能是：
- 本地映射路径（如 `/Users/username/project`）
- 或远程路径（如 `/path/to/project`）

这导致路径匹配失败。

## 解决方案

### 1. 增强的路径匹配逻辑

当前代码已实现以下匹配策略：

#### 策略1: 完全路径匹配
- Windows: 不区分大小写匹配
- Mac/Linux: 区分大小写匹配

#### 策略2: 远程路径后缀匹配
对于 `vscode-remote://` 开头的路径，尝试匹配路径的最后几个部分：
- 优先匹配最后 3 个路径部分
- 如果不匹配，尝试最后 2 个部分
- 最后尝试匹配最后 1 个部分

例如：
- 远程路径: `vscode-remote://ssh-remote+myserver/home/user/projects/myapp`
- 本地路径: `/Users/user/projects/myapp`
- 匹配后缀: `projects/myapp` (2个部分)

### 2. 增强的日志输出

代码现在输出详细的调试信息：
```
Searching for workspace database matching path: /Users/user/project
Platform: darwin

Workspace 1a2b3c4d5e6f:
  Original path in JSON: file:///Users/user/project
  Decoded path: /Users/user/project
  Normalized path: /Users/user/project
  Current workspace path: /Users/user/project
  ✓ Found matching workspace database
```

或对于远程开发：
```
Workspace 7g8h9i0j1k2l:
  Original path in JSON: vscode-remote://ssh-remote+myserver/home/user/project
  Decoded path: /home/user/project
  Normalized path: /home/user/project
  Current workspace path: /Users/user/project
  Remote path parts: [home, user, project]
  Current path parts: [Users, user, project]
  ✓ remote path suffix match (depth=2): user/project
```

## 诊断工具

### 运行诊断脚本

```bash
npm run test:workspace-path
```

或直接运行：
```bash
ts-node src/test/workspacePathTest.ts
```

这将输出：
1. 平台信息和用户数据目录
2. 所有工作空间的详细信息（ID、类型、原始路径、解析后路径）
3. 路径匹配测试结果
4. 所有数据库文件列表

### 查看详细日志

在 VSCode/Cursor 中：
1. 打开开发者工具: `Help` > `Toggle Developer Tools`
2. 切换到 `Console` 标签
3. 查找 `CursorDataLocator` 相关的日志信息

## 可能的问题和解决方法

### 问题1: Mac 上找不到数据库

**可能原因:**
- 路径大小写不匹配
- 路径格式问题

**解决方法:**
1. 运行诊断脚本，查看实际的路径格式
2. 检查 `~/Library/Application Support/Cursor/User/workspaceStorage/` 目录
3. 查看每个工作空间目录下的 `workspace.json` 文件内容

### 问题2: 远程开发找不到数据库

**可能原因:**
- 本地路径和远程路径不匹配
- 路径后缀匹配失败

**解决方法:**
1. 确认远程路径格式: 查看 `workspace.json` 中的 `folder` 或 `workspace` 字段
2. 确认 VSCode API 返回的路径: 查看日志中的 "Current workspace path"
3. 如果路径完全不同（如项目名称不同），需要手动配置

### 问题3: 多根工作空间

**特征:**
- `workspace.json` 中使用 `workspace` 字段而非 `folder` 字段
- 路径指向 `.code-workspace` 文件

**处理:**
代码已支持多根工作空间，会使用 `workspaceFile` 路径进行匹配。

## 注意事项

1. **首次打开工作空间**: 如果是首次打开，可能还没有生成数据库文件，这是正常的
2. **远程开发限制**: 远程开发时，路径匹配依赖于后缀匹配，如果项目名称在本地和远程不同，可能无法匹配
3. **符号链接**: 如果使用了符号链接，路径可能无法正确匹配

## 技术细节

### 路径解码逻辑

```typescript
private static decodeFileUrl(fileUrl: string): string {
    // 1. 检查是否是远程路径 (vscode-remote://...)
    if (fileUrl.startsWith('vscode-remote://')) {
        // 提取远程路径: vscode-remote://ssh-remote+hostname/path/to/project
        // 返回: /path/to/project
    }
    
    // 2. 处理 file:// 本地路径
    // file:///Users/username/project -> /Users/username/project
    // file:///f%3A/project -> f:\project (Windows)
    
    // 3. 平台特定处理
    // Windows: 转换为反斜杠路径
    // Mac/Linux: 确保以 / 开头
}
```

### 路径匹配逻辑

```typescript
// 策略1: 完全匹配
if (process.platform === 'win32') {
    pathMatches = normalizedPath.toLowerCase() === workspacePath.toLowerCase();
} else {
    pathMatches = normalizedPath === workspacePath;
}

// 策略2: 远程路径后缀匹配
if (!pathMatches && isRemotePath) {
    for (let depth = 3; depth > 0; depth--) {
        const storedSuffix = normalizedPath.split('/').slice(-depth).join('/');
        const currentSuffix = workspacePath.split('/').slice(-depth).join('/');
        if (storedSuffix === currentSuffix) {
            pathMatches = true;
            break;
        }
    }
}
```

## 更新日志

### 2026-01-21
- ✅ 增强 Mac 路径支持（Unix 风格路径）
- ✅ 增强远程开发路径支持（`vscode-remote://` 协议）
- ✅ 实现路径后缀匹配算法
- ✅ 添加详细的调试日志
- ✅ 创建诊断工具脚本
- ✅ 添加 `getAllWorkspaceInfo()` 方法
