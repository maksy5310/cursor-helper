# 登录问题排查指南

## 🎯 问题现象

用户反馈：点击用户信息面板的"登录"按钮，浏览器没有打开登录页面。

## 🔧 快速诊断

### 步骤1: 运行诊断命令

1. 打开命令面板：`Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows)
2. 输入：`Cursor Assistant: 诊断登录问题`
3. 按回车运行

### 步骤2: 查看诊断结果

诊断命令会检查：
- ✅ 配置信息（Base URL、登录 URL、Extension ID）
- ✅ URL 格式验证
- ✅ 系统浏览器命令

**示例输出：**

```
================================================================================
登录诊断开始
================================================================================

1. 配置信息:
   Base URL: https://spec.ak01.cn
   登录页面 URL: https://spec.ak01.cn/plugin-login
   Extension ID: Howell.cursor-assistant
   URI Scheme: vscode
   回调 URI: vscode://Howell.cursor-assistant/auth/callback

2. URL 格式验证:
   ✓ 最终登录 URL: https://spec.ak01.cn/plugin-login?callback=vscode%3A%2F%2FHowell.cursor-assistant%2Fauth%2Fcallback
   ✓ URL 格式有效

3. 系统浏览器测试:
   当前平台: win32
   Windows 命令: start "" "https://www.baidu.com"

4. 测试选项:
   [选择要测试的方式]
```

### 步骤3: 测试浏览器打开

诊断命令会提供三个测试选项：

1. **测试打开百度**
   - 测试系统是否能打开浏览器
   - 如果百度能打开，说明系统浏览器命令正常

2. **测试打开登录页面**
   - 测试是否能打开实际的登录页面
   - 检查登录 URL 是否可访问

3. **查看日志**
   - 查看详细的执行日志
   - 了解具体的错误信息

## 🐛 常见问题和解决方案

### 问题1: 测试打开百度失败

**原因**: 系统浏览器命令无法执行

**可能情况**:

#### Windows
```
错误: '��' is not recognized as an internal or external command
```

**解决方法**:
1. 检查环境变量 PATH 是否正常
2. 尝试在命令行直接运行: `start https://www.baidu.com`
3. 如果仍然失败，可能是系统配置问题

#### Mac
```
错误: command not found: open
```

**解决方法**:
1. `open` 是 macOS 内置命令，如果提示找不到说明系统有问题
2. 检查系统完整性
3. 尝试重新安装 Xcode Command Line Tools:
   ```bash
   xcode-select --install
   ```

#### Linux
```
错误: command not found: xdg-open
```

**解决方法**:
```bash
# Ubuntu/Debian
sudo apt-get install xdg-utils

# Fedora/RHEL
sudo yum install xdg-utils

# Arch Linux
sudo pacman -S xdg-utils
```

### 问题2: 百度能打开，但登录页面打不开

**原因**: 登录页面 URL 配置错误或网络问题

**检查步骤**:

1. **检查 Base URL 配置**
   ```
   运行命令: Cursor Assistant: 配置 Base URL
   确认 Base URL 是否正确
   ```

2. **手动测试登录页面**
   ```
   复制诊断输出中的"最终登录 URL"
   在浏览器中手动打开
   检查页面是否能正常加载
   ```

3. **检查网络连接**
   ```bash
   # Windows
   ping spec.ak01.cn
   
   # Mac/Linux
   curl -I https://spec.ak01.cn/plugin-login
   ```

**解决方法**:
- 如果 URL 错误，运行"配置 Base URL"命令重新配置
- 如果网络问题，检查防火墙或代理设置
- 如果服务器问题，联系管理员

### 问题3: 浏览器打开了，但没有进入登录页面

**原因**: 浏览器打开了空白页或错误页

**检查步骤**:

1. **查看浏览器地址栏**
   - 地址是否正确
   - 是否被重定向到其他页面

2. **查看浏览器控制台**
   - 按 F12 打开开发者工具
   - 查看 Console 是否有错误
   - 查看 Network 标签页的请求状态

3. **检查登录页面功能**
   - 页面是否正常显示登录表单
   - 能否正常登录

**解决方法**:
- 如果页面404，检查服务器配置
- 如果页面空白，检查前端部署
- 如果登录功能异常，查看浏览器控制台错误

### 问题4: 能打开登录页面，但登录后没有回调

**原因**: 回调 URI 配置问题或 URI Handler 未正确注册

**检查步骤**:

1. **确认回调 URI**
   ```
   诊断输出中的"回调 URI"
   应该是: vscode://Howell.cursor-assistant/auth/callback
   ```

2. **测试 URI Handler**
   ```
   运行命令面板: Cursor Assistant: Show Status
   查看 URI Handler 是否已注册
   ```

3. **手动测试回调**
   ```
   在浏览器中直接访问:
   vscode://Howell.cursor-assistant/auth/callback?token=test-token
   
   应该提示打开 Cursor 并显示错误（token 无效）
   ```

**解决方法**:
- 重启 Cursor（确保 URI Handler 正确注册）
- 检查 Extension ID 是否正确
- 查看输出日志中的详细错误信息

## 🔍 详细日志

查看详细的执行日志：

1. 打开输出面板：`View` > `Output`
2. 选择 `Cursor Assistant`
3. 查找与登录相关的日志：

```
Opening login page: https://spec.ak01.cn/plugin-login?callback=...
Auth callback URI: vscode://...
Login page opened in system browser
```

如果有错误会显示：
```
Failed to open browser with command: start "" "..."
Error: [错误信息]
Falling back to vscode.env.openExternal
```

## 📋 完整诊断流程

如果用户报告登录按钮不工作，按以下步骤排查：

### 1. 运行诊断命令
```
Cmd+Shift+P > Cursor Assistant: 诊断登录问题
```

### 2. 测试系统浏览器
选择"测试打开百度"
- ✅ 成功：说明浏览器命令正常，继续下一步
- ✗ 失败：系统配置问题，参考"问题1"

### 3. 测试登录页面
选择"测试打开登录页面"
- ✅ 成功：说明可以打开登录页面
- ✗ 失败：URL 或网络问题，参考"问题2"

### 4. 测试完整登录流程
1. 手动点击"登录"按钮
2. 浏览器应该打开登录页面
3. 完成登录
4. 查看是否成功回调到 Cursor

### 5. 收集信息
如果问题仍未解决，收集以下信息：
- 诊断命令的完整输出
- 输出面板（Cursor Assistant）的完整日志
- 操作系统版本
- Cursor 版本
- 浏览器类型和版本

## 🛠️ 可能的代码问题

### 问题: child_process.exec 在某些环境下失败

**代码位置**: `src/services/authService.ts` 第 109-125 行

**当前实现**:
```typescript
child_process.exec(command, async (error) => {
    if (error) {
        Logger.error(`Failed to open browser with command: ${command}`, error);
        // 回退到 vscode.env.openExternal
        await vscode.env.openExternal(vscode.Uri.parse(url));
    }
});
```

**可能的改进**:
1. 增加更详细的错误日志
2. 提供配置选项让用户选择打开方式
3. 增加超时机制
4. 提供手动复制 URL 的备选方案

### 问题: URL 编码问题

**检查点**:
- 回调 URI 中的特殊字符是否正确编码
- URL 参数是否正确解析

**解决方案**:
在诊断命令中已经验证 URL 格式，如果有问题会显示在日志中

## 📝 用户反馈模板

如果用户报告问题，请让他们提供以下信息：

```markdown
## 问题描述
点击登录按钮，浏览器没有打开

## 环境信息
- 操作系统: [Windows/Mac/Linux]
- 系统版本: [如 Windows 11, macOS 13.5]
- Cursor 版本: [Help > About]
- 默认浏览器: [Chrome/Edge/Safari/Firefox]

## 诊断结果
1. 运行 `Cursor Assistant: 诊断登录问题`
2. 选择"测试打开百度"
   - 结果: [成功/失败]
3. 选择"测试打开登录页面"
   - 结果: [成功/失败]

## 输出日志
<details>
<summary>点击展开日志</summary>

[粘贴 Output > Cursor Assistant 的完整日志]

</details>

## 补充信息
[任何其他相关信息]
```

## 🚀 临时解决方案

如果诊断后仍无法自动打开浏览器，可以使用以下临时方案：

### 方案1: 手动打开登录页面

1. 运行诊断命令，复制"最终登录 URL"
2. 手动在浏览器中打开这个 URL
3. 完成登录
4. Cursor 应该会自动接收到回调

### 方案2: 使用 VSCode 内置浏览器

```typescript
// 在扩展设置中添加选项
"cursor-assistant.useInternalBrowser": true
```

然后修改代码使用 `vscode.env.openExternal` 而不是系统命令。

### 方案3: 配置自定义浏览器命令

```json
// settings.json
{
  "cursor-assistant.browserCommand": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
}
```

## 📚 相关文档

- [用户认证流程](./AUTH_FLOW.md) - 认证流程技术文档
- [配置说明](./CONFIG.md) - 配置项说明
- [GitHub Issues](https://github.com/howelljiang/cursor-helper/issues) - 提交问题

---

**还有问题？** 运行诊断命令，复制完整输出，在 GitHub 提交 Issue。
