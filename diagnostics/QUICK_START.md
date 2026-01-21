# 🚀 快速开始

遇到 Mac 或远程开发环境下看不到会话列表？使用这个诊断工具快速收集信息！

## 一键运行

### Windows 用户

双击运行 `scan.bat` 文件

或者在命令行中：
```batch
cd diagnostics
scan.bat
```

### Mac 用户

```bash
cd diagnostics
chmod +x scan.sh
./scan.sh
```

或者直接运行：
```bash
cd diagnostics
node scan-workspaces.js
```

### Linux 用户

```bash
cd diagnostics
chmod +x scan.sh
./scan.sh
```

## 查看结果

运行后会：
1. ✅ 在终端显示扫描结果（彩色输出）
2. ✅ 生成 `workspace-diagnostic-report.json` 诊断报告

## 提交问题

如果需要开发者帮助：

1. 复制终端输出
2. 附上 `workspace-diagnostic-report.json` 文件
3. 在 [GitHub Issues](https://github.com/howelljiang/cursor-helper/issues) 提交

## 常见问题

**Q: 提示"未找到 Node.js"？**

A: 需要先安装 Node.js
- 下载地址: https://nodejs.org/
- Mac 用户: `brew install node`

**Q: 报告文件在哪里？**

A: 在你运行脚本的目录下，名为 `workspace-diagnostic-report.json`

**Q: 报告包含敏感信息吗？**

A: 报告包含文件路径和工作空间配置，分享前请检查是否有敏感路径

## 详细文档

查看 [README.md](./README.md) 了解更多信息。
