# Authentication Integration Contract: 插件与前端登录页面集成

**Feature**: 004-popup-login-auth  
**Date**: 2026-01-04

## Overview

本文档定义了Cursor插件与前端Web应用（spec-share-frontend）之间的认证集成契约。插件通过外部浏览器打开前端登录页面，用户在前端完成登录后，前端通过URI scheme回调将token传递给插件。

## URI Scheme Registration

### Scheme Definition

插件注册自定义URI scheme: `cursor-helper://`

### Registration (package.json)

```json
{
  "contributes": {
    "commands": [
      {
        "command": "cursor-helper.auth.callback",
        "title": "Handle Auth Callback"
      }
    ]
  }
}
```

### Handler Registration (extension.ts)

```typescript
vscode.window.registerUriHandler({
  handleUri(uri: vscode.Uri): void {
    if (uri.path === '/auth/callback') {
      // 处理登录回调
      const token = uri.query.split('token=')[1];
      authService.handleLoginCallback(token);
    }
  }
});
```

## Frontend Integration Contract

### Login Page URL Format

前端登录页面必须支持以下URL参数：

```
{LOGIN_URL}?callback={CALLBACK_URI}
```

**Parameters**:
- `callback` (required): URI scheme回调地址，格式: `cursor-helper://auth/callback`

**Example**:
```
http://localhost:5173/login?callback=cursor-helper://auth/callback
https://your-domain.com/login?callback=cursor-helper://auth/callback
```

### Login Success Callback

前端登录成功后，必须重定向到callback URI，并传递token：

```
{callback_uri}?token={JWT_TOKEN}
```

**Parameters**:
- `token` (required): JWT token字符串

**Example**:
```
cursor-helper://auth/callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Error Handling

如果登录失败，前端不应重定向到callback URI，而是显示错误信息。

## Plugin Implementation Contract

### AuthService Interface

```typescript
interface IAuthService {
  /**
   * 打开前端登录页面
   * @param loginUrl 前端登录页面URL
   */
  openLoginPage(loginUrl?: string): Promise<void>;

  /**
   * 处理登录回调
   * @param token JWT token
   */
  handleLoginCallback(token: string): Promise<void>;

  /**
   * 获取当前token
   */
  getToken(): Promise<string | null>;

  /**
   * 检查是否已登录
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * 登出
   */
  logout(): Promise<void>;
}
```

### TokenManager Interface

```typescript
interface ITokenManager {
  /**
   * 保存token到SecretStorage
   */
  saveToken(token: string): Promise<void>;

  /**
   * 从SecretStorage获取token
   */
  getToken(): Promise<string | null>;

  /**
   * 删除token
   */
  deleteToken(): Promise<void>;
}
```

## API Client Integration

### Authentication Header

所有需要认证的API请求必须包含Authorization header：

```
Authorization: Bearer {JWT_TOKEN}
```

### 401 Error Handling

API客户端必须检测401错误，并触发重新登录：

```typescript
if (response.status === 401) {
  // 清除token
  await tokenManager.deleteToken();
  // 刷新UI显示登录按钮
  await refreshPanel();
}
```

## Configuration

### Plugin Configuration

插件配置项（package.json）:

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "cursor-helper.auth.loginUrl": {
          "type": "string",
          "default": "http://localhost:5173/login?callback=cursor-helper://auth/callback",
          "description": "前端登录页面URL"
        }
      }
    }
  }
}
```

### Default Values

- **Development**: `http://localhost:5173/login?callback=cursor-helper://auth/callback`
- **Production**: `https://your-domain.com/login?callback=cursor-helper://auth/callback`

## Security Considerations

1. **Token传输**: Token通过URI scheme传递，应确保URI不被恶意应用拦截
2. **Token存储**: Token必须存储在VS Code SecretStorage，不得存储在普通文件
3. **Token验证**: Token有效性通过API请求验证，不进行本地解析
4. **HTTPS**: 生产环境必须使用HTTPS保护登录页面

## Error Scenarios

### Scenario 1: 用户取消登录

**Behavior**: 前端不重定向到callback URI，插件保持未登录状态

### Scenario 2: 网络错误

**Behavior**: 前端显示错误信息，插件保持未登录状态

### Scenario 3: Token格式错误

**Behavior**: 插件验证token格式，如果无效则显示错误，不保存token

### Scenario 4: 回调URI被拦截

**Behavior**: 插件验证URI scheme和path，如果不符合预期则忽略

## Testing

### Unit Tests

- URI scheme解析
- Token格式验证
- SecretStorage读写

### Integration Tests

- 完整登录流程（打开页面 → 登录 → 回调 → 保存token）
- 登出流程
- Token过期检测

### Manual Tests

- 在不同浏览器中打开登录页面
- 测试回调URI处理
- 测试token存储和读取

