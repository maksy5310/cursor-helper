# 🚀 版本 0.0.5 发布检查清单

发布日期: 2026-01-20

## ✅ 发布前检查

### 📦 文件完整性
- [x] `package.json` 版本号已更新为 0.0.5
- [x] `resources/icon.png` 图标文件存在
- [x] `CHANGELOG.md` 已添加 0.0.5 版本更新说明
- [x] `README.md` 内容已更新并校对

### 🔧 配置检查
- [x] package.json 中移除了无用的命令引用
- [x] 菜单配置中移除了不存在的 `refreshUserInfo` 命令
- [x] 图标配置正确：`"icon": "resources/icon.png"`
- [x] Activity Bar 图标设置为 `$(references)`

### 📝 文档检查
- [x] README 描述准确反映当前功能
- [x] 图标说明已从"数据库图标"改为"书签图标"
- [x] 常见问题部分更加详细和实用
- [x] CHANGELOG 记录了所有重要变更

### 🎯 版本亮点

#### 新增功能
- ✨ 添加扩展图标，提升品牌识别度
- ✨ 更换 Activity Bar 图标为书签样式

#### 优化改进
- 🧹 清理了 7 个内部测试/开发命令
- 🧹 简化了命令面板，只保留用户常用功能
- 📚 大幅改进 README 文档质量
- 🐛 修复 package.json 中的菜单配置错误

#### 用户体验提升
- 更简洁的命令列表
- 更清晰的使用文档
- 更易识别的图标

## 🔄 发布流程

### 1. 本地测试
```bash
# 编译项目
npm run compile

# 检查编译输出
ls out/

# 本地打包测试
npx vsce package
```

### 2. Git 提交
```bash
# 查看变更
git status

# 提交变更
git add .
git commit -m "chore: release v0.0.5 - add icon and cleanup commands"

# 推送到远程
git push origin master
```

### 3. 创建 Git 标签
```bash
# 创建标签
git tag -a v0.0.5 -m "Release version 0.0.5 - Add extension icon and cleanup commands"

# 推送标签
git push origin v0.0.5
```

### 4. GitHub Actions 自动发布
推送标签后，GitHub Actions 会自动：
- 编译项目
- 使用生产配置打包
- 发布到 VS Code Marketplace
- 发布到 Open VSX Registry

### 5. 发布后验证
- [ ] 检查 GitHub Actions 工作流是否成功
- [ ] 验证 VS Code Marketplace 页面
- [ ] 验证 Open VSX Registry 页面
- [ ] 测试从市场安装插件
- [ ] 验证图标在市场和 IDE 中正确显示

## 📊 预期结果

### Marketplace 展示
- 插件名称：提示词分享助手
- 版本：0.0.5
- 图标：自定义 PNG 图标（对话气泡+分享箭头）
- Activity Bar：书签样式图标

### 用户可见命令（共 5 个）
1. 配置 Base URL
2. 查看上传历史
3. 登录
4. 退出登录
5. 打开个人中心

## 🎉 版本说明模板

发布到 GitHub Release 时使用：

```markdown
## 🎉 Version 0.0.5 发布

### ✨ 新增
- 添加扩展图标，在插件市场更易识别
- 更换活动栏图标为书签样式，更符合功能定位

### 🧹 优化
- 简化命令列表，移除 7 个内部测试/开发命令
- 清理无用的菜单项引用
- 大幅改进 README 文档

### 移除的命令（内部使用）
- discoverData, analyzeDatabase, openSessionMarkdown
- testToolExtraction, testUriHandler
- showLogs, showStatus
- uploadRecord（功能已集成到上下文菜单）

### 📖 文档
- 详细的快速开始指南
- 扩充的常见问题解答
- 更清晰的使用说明

完整更新日志：[CHANGELOG.md](./CHANGELOG.md)
```

## 📌 注意事项

1. **确保测试通过**：本地编译无错误
2. **检查配置文件**：`config.prod.json` 使用正确的生产环境 URL
3. **验证图标**：icon.png 必须存在且格式正确
4. **等待 CI**：推送标签后等待 GitHub Actions 完成
5. **市场审核**：首次发布可能需要等待审核

## 🔗 相关链接

- GitHub 仓库: https://github.com/howelljiang/cursor-helper
- 发布文档: [PUBLISH.md](./PUBLISH.md)
- 更新日志: [CHANGELOG.md](./CHANGELOG.md)

---

**准备就绪！** 🚀
