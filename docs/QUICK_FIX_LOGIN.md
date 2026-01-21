# 登录按钮无响应 - 快速修复

## 🎯 问题

点击"登录"按钮，浏览器没有打开。

## ⚡ 快速诊断

### 1分钟诊断

1. 打开命令面板：`Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows)
2. 输入：`Cursor Assistant: 诊断登录问题`
3. 选择"测试打开百度"
4. 查看浏览器是否打开

### 结果判断

**✅ 百度打开了：**
→ 系统浏览器正常，问题可能是登录 URL 配置或网络

**解决方法：**
1. 再次运行诊断命令
2. 选择"测试打开登录页面"
3. 如果仍失败，检查 Base URL 配置

**❌ 百度也打不开：**
→ 系统浏览器命令有问题

**解决方法：**

#### Windows
```batch
# 在命令行测试
start https://www.baidu.com

# 如果失败，可能是系统配置问题
```

#### Mac
```bash
# 在终端测试
open https://www.baidu.com

# 如果提示 command not found
xcode-select --install
```

#### Linux
```bash
# 在终端测试
xdg-open https://www.baidu.com

# 如果提示 command not found
sudo apt-get install xdg-utils  # Ubuntu/Debian
```

## 🔄 临时解决方案

如果无法自动打开浏览器：

### 方法1: 手动复制链接

1. 运行诊断命令
2. 在输出日志中找到"最终登录 URL"
3. 复制 URL 到浏览器中手动打开
4. 完成登录

**示例：**
```
最终登录 URL: https://spec.ak01.cn/plugin-login?callback=vscode%3A%2F%2F...
```

### 方法2: 查看详细日志

1. 打开输出面板：`View` > `Output`
2. 选择 `Cursor Assistant`
3. 查找错误信息
4. 根据错误信息采取对应措施

## 📋 常见错误

### 错误1: "command not recognized"

**Windows**: 
```
'start' is not recognized as an internal or external command
```

**解决**: 检查系统环境变量，或使用备用方案

### 错误2: 网络连接失败

```
Failed to open login page
Error: connect ETIMEDOUT
```

**解决**: 
- 检查网络连接
- 检查防火墙设置
- 尝试使用 VPN

### 错误3: URL 格式错误

```
Invalid URL
```

**解决**:
1. 运行 `Cursor Assistant: 配置 Base URL`
2. 输入正确的服务器地址（如 `https://spec.ak01.cn`）
3. 重新尝试登录

## 💡 提示

- 诊断命令会测试两种打开方式：系统命令和 VSCode API
- 如果系统命令失败，会自动回退到 VSCode API
- 查看输出日志可以了解具体的失败原因
- 如果持续失败，可能需要检查系统配置或浏览器设置

## 🆘 需要帮助？

1. 运行诊断命令
2. 复制完整的输出日志
3. 在 [GitHub Issues](https://github.com/howelljiang/cursor-helper/issues) 提交问题
4. 附上操作系统版本和 Cursor 版本

---

**完整文档**: [登录问题排查指南](./LOGIN_TROUBLESHOOTING.md)
