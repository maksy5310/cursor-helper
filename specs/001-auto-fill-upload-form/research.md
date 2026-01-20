# Research: 上传表单自动填充

**Feature**: 001-auto-fill-upload-form  
**Date**: 2026-01-15  
**Status**: Phase 0 Complete

## 研究目标

解决实施计划中的技术决策点,确保使用正确的spec-share-server JWT认证方案(而非OAuth 2.0)。

---

## Decision 1: 身份认证机制

### 选择: 使用spec-share-server现有的JWT令牌认证

**Rationale**:
- spec-share-server已实现简单的JWT认证(`/api/auth/login`和`/api/auth/plugin`端点)
- 后端使用jose库生成JWT,包含email和role信息
- 无需实现复杂的OAuth 2.0授权码流程(PKCE, state验证等)
- 符合"之前实现正常"的用户反馈

**Alternatives Considered**:
- ❌ **OAuth 2.0授权码流程**: 过度设计,后端未实现OAuth服务器
- ❌ **手动输入JWT**: 用户体验差,不符合现代应用标准
- ❌ **内嵌WebView登录**: 安全风险,违反VSCode扩展最佳实践

**Implementation Details**:
- 用户点击登录→打开spec-share-frontend的`/plugin-login`页面
- 用户输入凭证→前端调用`/api/auth/plugin`获取JWT
- 前端通过`cursor://extension-id/auth/callback?token=xxx`回调插件
- 插件使用jose解析JWT payload获取用户信息

**References**:
- `spec-share-server/src/api/routes/auth.py`: POST /plugin端点
- `spec-share-server/src/services/auth_service.py`: create_access_token函数

---

## Decision 2: JWT令牌管理策略

### 选择: 单一访问令牌,过期后重新登录

**Rationale**:
- spec-share-server不支持refresh token机制(仅返回access_token)
- JWT过期时间由后端配置(settings.jwt_expiration_hours)
- 简化插件实现,避免复杂的令牌刷新逻辑

**Alternatives Considered**:
- ❌ **实现refresh token**: 后端不支持,需要后端改动
- ❌ **提前5分钟自动刷新**: 无refresh token无法实现
- ✅ **优雅降级**: JWT过期时检测401→引导重新登录

**Implementation Details**:
- 使用VSCode SecretStorage API存储JWT(`vscode.ExtensionContext.secrets`)
- JWT payload包含exp字段,可用于客户端过期检测
- API请求失败(401)时,清除JWT并打开登录页面
- 用户信息从JWT解析后缓存到WorkspaceState

**Security Considerations**:
- SecretStorage在Windows使用Credential Manager,macOS使用Keychain,Linux使用Secret Service
- 系统级加密,符合安全最佳实践

---

## Decision 3: URI回调协议

### 选择: `cursor://` (或`vscode://`)作为回调scheme

**Rationale**:
- VSCode/Cursor支持自定义URI scheme: `{uriScheme}://{extensionId}/path`
- 浏览器可通过此协议调起扩展并传递参数
- 标准的VSCode扩展OAuth模式(如GitHub, Microsoft等官方扩展使用)

**Alternatives Considered**:
- ❌ **localhost回调**: 需要启动本地服务器,复杂且有端口冲突风险
- ❌ **剪贴板传递**: 用户体验差,不安全
- ❌ **轮询API**: 低效,增加后端负担

**Implementation Details**:
```typescript
// extension.ts
const uriHandler = vscode.window.registerUriHandler({
  handleUri(uri: vscode.Uri) {
    if (uri.path === '/auth/callback') {
      const token = new URLSearchParams(uri.query).get('token');
      // 处理JWT令牌
    }
  }
});
```

**Frontend Integration**:
```javascript
// spec-share-frontend 登录成功后
const callbackUrl = `cursor://${extensionId}/auth/callback?token=${jwt}`;
window.location.href = callbackUrl;
```

---

## Decision 4: 用户信息获取方式

### 选择: 从JWT payload解析用户信息

**Rationale**:
- spec-share-server的JWT包含email和role字段
- 无需额外API调用(`/users/me`端点不存在)
- 登录响应也包含完整用户对象(可在前端传递)

**Alternatives Considered**:
- ❌ **调用/users/me**: 后端未实现此端点
- ❌ **要求后端新增API**: 增加依赖,不必要
- ✅ **JWT +登录响应双重来源**: 最大化信息获取

**Implementation Details**:
```typescript
// JWT payload structure (from jose decode)
interface JWTPayload {
  email: string;
  role: string;
  exp: number;
  iat: number;
}

// 优先使用登录响应中的user对象(包含avatar_url, username等)
// 回退到JWT payload(仅email和role)
```

**Caching Strategy**:
- 首次登录:保存完整用户对象到WorkspaceState
- 扩展激活:从WorkspaceState读取,验证JWT未过期
- JWT过期:清除缓存,引导重新登录

---

## Decision 5: 头像加载策略

### 选择: 三级降级(后端头像 → Gravatar → 默认SVG)

**Rationale**:
- 后端user对象包含可选的avatar_url字段
- Gravatar基于email的MD5哈希,作为通用头像服务
- 本地默认头像确保任何情况下都有可显示内容

**Alternatives Considered**:
- ❌ **仅使用后端头像**: 用户未设置时无头像
- ❌ **仅使用Gravatar**: 网络不可达时失败
- ✅ **三级降级**: 最佳用户体验

**Implementation Details**:
```typescript
class AvatarLoader {
  async loadAvatar(email: string, avatarUrl?: string): Promise<Uri> {
    // 1. Try user avatar URL
    if (avatarUrl) {
      const loaded = await tryLoad(avatarUrl, timeout: 5s);
      if (loaded) return loaded;
    }
    
    // 2. Try Gravatar
    const gravatarUrl = `https://www.gravatar.com/avatar/${md5(email)}?s=64&d=identicon`;
    const gravatar = await tryLoad(gravatarUrl, timeout: 3s);
    if (gravatar) return gravatar;
    
    // 3. Use local default
    return Uri.file(extensionPath + '/resources/default-avatar.svg');
  }
}
```

---

## Decision 6: TreeView vs WebView for个人信息显示

### 选择: TreeView

**Rationale**:
- TreeView是VSCode原生UI组件,性能好
- 与现有sessionListPanel集成简单
- 支持图标、描述文本、命令绑定

**Alternatives Considered**:
- ❌ **WebView**: 过度设计,加载慢,内存占用高
- ❌ **StatusBar**: 空间有限,无法显示头像

**Implementation Details**:
```typescript
class UserInfoTreeItem extends TreeItem {
  constructor(profile: UserProfile | null) {
    if (profile) {
      this.label = profile.nickname;
      this.description = profile.email;
      this.iconPath = avatarUri;
      this.command = { command: 'cursor-assistant.openUserCenter' };
    } else {
      this.label = '未登录';
      this.command = { command: 'cursor-assistant.login' };
    }
  }
}
```

---

## Technical Dependencies

### NPM Packages
- `jose`: ^5.0.0 (JWT解析和验证)
- `node-fetch`: ^3.0.0 (头像下载)

### VSCode APIs
- `vscode.window.registerUriHandler` (URI回调)
- `vscode.ExtensionContext.secrets` (SecretStorage)
- `vscode.ExtensionContext.workspaceState` (用户信息缓存)
- `vscode.window.createTreeView` (个人信息面板)
- `vscode.env.openExternal` (打开浏览器)

### Backend APIs (spec-share-server)
- `POST /api/auth/plugin` (获取JWT)
- JWT payload: `{ email, role, exp, iat }`
- Login response: `{ access_token, token_type, user: {...} }`

---

## Risks and Mitigations

### Risk 1: JWT过期导致操作中断
**Mitigation**: 在所有API调用前检查JWT exp字段,提前提示用户重新登录

### Risk 2: URI回调在某些环境失败
**Mitigation**: 提供手动粘贴JWT的备用方案(低优先级)

### Risk 3: Gravatar服务不可达
**Mitigation**: 设置3秒超时,快速降级到默认头像

### Risk 4: 用户信息缓存与实际不同步
**Mitigation**: 提供手动刷新按钮,每次登录后更新缓存

---

## Open Questions (All Resolved)

~~1. 是否需要OAuth 2.0?~~ → **No, 使用JWT**
~~2. 是否有refresh token?~~ → **No, 过期重新登录**
~~3. 如何获取用户信息?~~ → **JWT payload + WorkspaceState缓存**
~~4. 使用什么UI组件?~~ → **TreeView**

---

**Phase 0 Complete** ✅  
**Next Step**: Phase 1 - Design & Contracts
