# Research: 弹出登录页面鉴权

**Feature**: 004-popup-login-auth  
**Date**: 2026-01-04

## Research Questions

### Q1: 插件如何与前端登录页面集成？

**Decision**: 使用外部浏览器打开前端登录页面，通过URL回调参数传递token。

**Rationale**: 
- 前端登录页面是完整的Web应用，包含完整的React路由和状态管理
- 外部浏览器可以更好地展示前端应用的完整功能
- 通过URL回调参数（如`cursor-helper://auth/callback?token=xxx`）可以安全地传递token
- 插件可以注册自定义URI scheme来处理回调

**Alternatives considered**:
- **WebviewPanel**: 可以嵌入前端页面，但需要处理CORS、路由、状态管理等复杂问题，且Webview的JavaScript环境受限
- **消息传递**: 需要前端和插件都实现复杂的消息协议，增加集成复杂度

**Implementation**:
- 插件注册自定义URI scheme: `cursor-helper://`
- 前端登录成功后，重定向到 `cursor-helper://auth/callback?token=<JWT_TOKEN>`
- 插件监听URI scheme回调，提取token并保存

---

### Q2: Token存储方式

**Decision**: 使用VS Code SecretStorage API存储JWT Token。

**Rationale**:
- SecretStorage API是VS Code提供的安全存储机制，使用操作系统级别的密钥管理
- Token是敏感信息，不应存储在普通配置或文件中
- SecretStorage支持跨会话持久化，符合登录状态保持需求

**Alternatives considered**:
- **Memento API**: 用于存储非敏感配置，不适合存储token
- **文件存储**: 不安全，容易被读取
- **环境变量**: 不适合持久化存储

**Implementation**:
- 使用 `vscode.SecretStorage` API
- Key: `cursor-helper.auth.token`
- 存储完整的JWT token字符串

---

### Q3: Token验证和过期检测

**Decision**: 在API请求时检测401错误，触发重新登录流程。

**Rationale**:
- JWT token包含过期时间，但解析JWT需要额外依赖
- 后端API会在token过期时返回401 Unauthorized
- 在API客户端统一处理401错误，自动触发重新登录，简化实现

**Alternatives considered**:
- **解析JWT**: 需要添加JWT解析库，增加依赖，且需要处理token格式变化
- **定期检查**: 需要定时任务，增加复杂度

**Implementation**:
- 在 `apiClient.ts` 中拦截401响应
- 检测到401时，清除token，显示登录按钮
- 用户点击登录按钮后重新打开登录页面

---

### Q4: 前端登录页面的URL和配置

**Decision**: 前端登录页面URL通过插件配置项设置，默认使用开发/生产环境URL。

**Rationale**:
- 支持不同环境（开发、测试、生产）
- 允许用户自定义前端服务地址
- 配置存储在VS Code设置中

**Alternatives considered**:
- **硬编码URL**: 不灵活，无法适配不同环境
- **环境变量**: VS Code插件环境变量支持有限

**Implementation**:
- 插件配置项: `cursor-helper.auth.loginUrl`
- 默认值: 开发环境 `http://localhost:5173/login?callback=cursor-helper://auth/callback`
- 生产环境: `https://your-domain.com/login?callback=cursor-helper://auth/callback`

---

### Q5: 登出功能的实现方式

**Decision**: 提供退出按钮在插件面板中，点击后清除token并刷新面板。

**Rationale**:
- 简单直接，符合用户预期
- 不需要调用后端API（token已清除，后续请求自然失败）
- 面板状态自动更新为显示登录按钮

**Alternatives considered**:
- **下拉菜单**: 可以包含更多选项（如用户信息），但当前需求只需要登出功能
- **命令面板**: 不够直观，用户需要记住命令名称

**Implementation**:
- 在 `sessionListPanel.ts` 中添加退出按钮
- 点击后调用 `authService.logout()`
- 清除token，刷新面板显示登录按钮

---

### Q6: 移除手动输入Token功能的迁移策略

**Decision**: 直接移除所有手动输入token的代码和UI，不保留兼容模式。

**Rationale**:
- 规范明确要求移除旧功能
- 保留兼容代码会增加维护负担
- 新登录方式更安全，无需向后兼容

**Alternatives considered**:
- **保留但隐藏**: 增加代码复杂度，不符合规范要求
- **渐进式迁移**: 当前功能范围明确，无需渐进式迁移

**Implementation**:
- 删除所有与手动输入token相关的代码
- 移除 `TokenInput` 组件（如果存在）
- 更新所有使用token的地方，改为从SecretStorage获取

---

## Technology Choices Summary

| 技术选择 | 方案 | 理由 |
|---------|------|------|
| 前端集成 | 外部浏览器 + URI scheme回调 | 简单、安全、支持完整Web应用 |
| Token存储 | VS Code SecretStorage | 安全、持久化、官方推荐 |
| Token验证 | API 401错误检测 | 简单、无需额外依赖 |
| 配置管理 | VS Code配置项 | 灵活、支持多环境 |
| 登出方式 | 面板退出按钮 | 直观、简单 |
| 迁移策略 | 直接移除旧功能 | 符合规范、减少复杂度 |

## Dependencies

### 新增依赖
- 无（使用VS Code Extension API和现有依赖）

### 外部依赖
- 前端Web应用（spec-share-frontend）需要支持URI scheme回调
- 后端API（spec-share-server）登录接口已存在

## Open Questions

无 - 所有技术选择已明确。

