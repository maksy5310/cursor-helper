# 诊断工具使用说明

## 🎯 为什么需要诊断工具？

在 Mac 和远程开发环境下，工作空间路径格式差异可能导致数据库匹配失败。诊断工具可以：

1. **快速收集**：一键扫描所有工作空间信息
2. **详细输出**：显示原始路径、解析路径、数据库状态
3. **生成报告**：导出 JSON 格式的诊断报告
4. **辅助调试**：帮助开发者快速定位问题

## 📦 工具组成

```
diagnostics/
├── scan-workspaces.js   # 核心诊断脚本（Node.js）
├── scan.bat             # Windows 一键启动脚本
├── scan.sh              # Mac/Linux 一键启动脚本
├── README.md            # 详细使用文档
└── QUICK_START.md       # 快速开始指南
```

## 🚀 使用方法

### Windows 用户

```bash
# 方式1: 双击运行（最简单）
双击 diagnostics/scan.bat

# 方式2: 命令行运行
cd diagnostics
scan.bat

# 方式3: 直接运行 Node.js 脚本
cd diagnostics
node scan-workspaces.js
```

### Mac/Linux 用户

```bash
# 方式1: 运行 Shell 脚本
cd diagnostics
chmod +x scan.sh
./scan.sh

# 方式2: 直接运行 Node.js 脚本
cd diagnostics
node scan-workspaces.js
```

## 📊 输出内容

### 1. 控制台彩色输出

脚本会在终端显示：

- ✅ **系统信息**：OS、架构、Cursor 目录
- ✅ **工作空间列表**：ID、类型、路径、数据库状态
- ✅ **统计信息**：总数、有效数、远程工作空间数
- ✅ **全局数据库**：路径和大小
- ✅ **诊断建议**：针对性的建议

**示例输出：**

```
================================================================================
Cursor 工作空间诊断扫描工具
================================================================================

1. 系统信息:
   操作系统: darwin (Darwin 21.6.0)
   架构: arm64
   用户主目录: /Users/username
   Cursor 用户数据目录: /Users/username/Library/Application Support/Cursor/User
   工作空间存储目录: /Users/username/Library/Application Support/Cursor/User/workspaceStorage

2. 扫描工作空间:

   工作空间 abc123def456:
   ├─ 类型: 单根工作空间
   ├─ 原始路径: file:///Users/username/project
   ├─ 解析后路径: /Users/username/project
   ├─ 数据库文件: ✓ 存在
   │  └─ 大小: 256 KB
   │  └─ WAL 文件: ✓
   │  └─ SHM 文件: ✓

   工作空间 xyz789remote (远程):
   ├─ 类型: 单根工作空间 (远程)
   ├─ 原始路径: vscode-remote://ssh-remote+myserver/home/user/project
   ├─ 解析后路径: /home/user/project
   ├─ 数据库文件: ✓ 存在
   │  └─ 大小: 384 KB

3. 统计信息:
   总工作空间目录数: 5
   有效工作空间数: 5
   有数据库的工作空间: 5
   远程工作空间: 1

4. 全局数据库:
   路径: /Users/username/Library/Application Support/Cursor/User/globalStorage/state.vscdb
   状态: ✓ 存在
   大小: 1.5 MB

5. 诊断建议:
   ✓ 找到了有效的工作空间和数据库

   远程工作空间说明：
   - ID: xyz789remote
     原始: vscode-remote://ssh-remote+myserver/home/user/project
     解析: /home/user/project
   提示：远程工作空间需要使用路径后缀匹配
```

### 2. JSON 诊断报告

自动生成 `workspace-diagnostic-report.json`：

```json
{
  "platform": "darwin",
  "osType": "Darwin",
  "osRelease": "21.6.0",
  "arch": "arm64",
  "homeDir": "/Users/username",
  "cursorUserDataDir": "/Users/username/Library/Application Support/Cursor/User",
  "workspaceStorageDir": "/Users/username/Library/Application Support/Cursor/User/workspaceStorage",
  "totalWorkspaces": 5,
  "validWorkspaces": 5,
  "globalDatabase": {
    "path": "/Users/username/Library/Application Support/Cursor/User/globalStorage/state.vscdb",
    "exists": true,
    "size": 1572864
  },
  "workspaces": [
    {
      "id": "abc123def456",
      "type": "folder",
      "isRemote": false,
      "originalPath": "file:///Users/username/project",
      "decodedPath": "/Users/username/project",
      "database": {
        "exists": true,
        "path": "/Users/username/Library/Application Support/Cursor/User/workspaceStorage/abc123def456/state.vscdb",
        "size": 262144,
        "hasWal": true,
        "hasShm": true
      },
      "workspaceJson": {
        "folder": "file:///Users/username/project"
      }
    },
    {
      "id": "xyz789remote",
      "type": "folder",
      "isRemote": true,
      "originalPath": "vscode-remote://ssh-remote+myserver/home/user/project",
      "decodedPath": "/home/user/project",
      "database": {
        "exists": true,
        "path": "/Users/username/Library/Application Support/Cursor/User/workspaceStorage/xyz789remote/state.vscdb",
        "size": 393216,
        "hasWal": true,
        "hasShm": true
      },
      "workspaceJson": {
        "folder": "vscode-remote://ssh-remote+myserver/home/user/project"
      }
    }
  ],
  "scanTime": "2026-01-21T12:34:56.789Z"
}
```

## 🔍 诊断信息解读

### 工作空间类型

- **单根工作空间** (`type: "folder"`)：打开单个文件夹
- **多根工作空间** (`type: "workspace"`)：打开 `.code-workspace` 文件

### 路径信息

- **原始路径**：存储在 `workspace.json` 中的原始 URL
  - 本地：`file:///path/to/project`
  - 远程：`vscode-remote://ssh-remote+hostname/path`
  
- **解析后路径**：经过 URL 解码的实际文件系统路径
  - Windows：`F:\project`
  - Mac/Linux：`/Users/username/project`
  - 远程：`/home/user/project`

### 数据库状态

- **exists**: 数据库文件是否存在
- **size**: 数据库文件大小（字节）
- **hasWal**: 是否有 WAL (Write-Ahead Logging) 文件
- **hasShm**: 是否有 SHM (Shared Memory) 文件

> WAL 和 SHM 文件是 SQLite 的辅助文件，如果 Cursor 正在运行则会存在

## 📮 提交诊断报告

遇到问题需要开发者帮助时：

1. **运行诊断脚本**
   ```bash
   cd diagnostics
   node scan-workspaces.js
   ```

2. **收集信息**
   - 复制终端的完整输出
   - 找到生成的 `workspace-diagnostic-report.json` 文件

3. **提交 Issue**
   - 访问: https://github.com/howelljiang/cursor-helper/issues
   - 点击 "New Issue"
   - 使用以下模板：

```markdown
## 问题描述
[详细描述你遇到的问题]

## 环境信息
- 操作系统: [Mac/Windows/Linux]
- 系统版本: [如 macOS 13.5]
- 是否远程开发: [是/否]
- Cursor 版本: [查看 Cursor > About]

## 诊断输出
<details>
<summary>点击展开完整诊断输出</summary>

```
[粘贴终端输出]
```

</details>

## 诊断报告
[附件上传 workspace-diagnostic-report.json]

## 补充信息
[任何其他相关信息]
```

## ⚠️ 隐私提示

诊断报告包含：
- ✅ 系统信息（OS 类型、版本）
- ✅ Cursor 目录路径
- ✅ 工作空间完整路径
- ✅ 数据库文件路径

在分享前，请检查路径中是否包含敏感信息（如项目名称、用户名等）。

如有隐私顾虑，可以：
1. 手动编辑 JSON 文件，替换敏感路径
2. 只分享路径的后缀部分（如最后3个目录）
3. 使用匿名化路径（如 `/path/to/my-project` → `/path/to/project1`）

## 🐛 故障排查

### Q: 提示"未找到 Node.js"

**解决方法：**
```bash
# 检查 Node.js 是否安装
node --version

# 如果未安装，请访问 https://nodejs.org/ 下载

# Mac 用户可以使用 Homebrew
brew install node
```

### Q: 提示"工作空间存储目录不存在"

**原因**: Cursor 尚未运行过

**解决方法：**
1. 启动 Cursor
2. 打开任意项目
3. 等待几秒
4. 重新运行诊断脚本

### Q: 所有工作空间都没有数据库

**原因**: 没有使用过 Composer

**解决方法：**
1. 在 Cursor 中打开项目
2. 使用 Composer（AI 对话）进行对话
3. 等待 1-2 分钟
4. 重新运行诊断脚本

### Q: 脚本运行出错

**收集错误信息：**
```bash
# 显示详细错误
node scan-workspaces.js 2>&1 | tee error.log

# 查看错误日志
cat error.log
```

将错误日志附在 Issue 中提交。

## 🔧 开发者信息

### 脚本依赖

- Node.js >= 18.0.0
- 无第三方依赖（只使用 Node.js 内置模块）

### 核心功能

1. **扫描目录**：`fs.readdirSync()`
2. **读取 JSON**：`fs.readFileSync()` + `JSON.parse()`
3. **路径解析**：自定义 `decodeFileUrl()` 函数
4. **彩色输出**：ANSI 转义码
5. **报告生成**：`JSON.stringify()` + `fs.writeFileSync()`

### 修改建议

如需扩展功能，可以修改 `scan-workspaces.js`：

- 添加更多检查项
- 自定义输出格式
- 集成到 CI/CD 流程
- 添加自动诊断建议

## 📚 相关文档

- [诊断工具 README](../diagnostics/README.md) - 详细使用文档
- [快速开始](../diagnostics/QUICK_START.md) - 快速使用指南
- [Mac 和远程开发故障排查](./MAC_REMOTE_TROUBLESHOOTING.md) - 问题解决指南
- [技术实现文档](./MAC_REMOTE_PATH_FIX.md) - 路径匹配技术细节

## 💡 最佳实践

1. **定期运行**：在切换开发环境后运行一次
2. **保存报告**：每次诊断保存 JSON 报告，便于对比
3. **提交 Issue 前**：先运行诊断，附上完整报告
4. **版本记录**：报告中包含时间戳，便于追踪问题

---

**问题或建议？** 欢迎在 [GitHub Issues](https://github.com/howelljiang/cursor-helper/issues) 提交！
