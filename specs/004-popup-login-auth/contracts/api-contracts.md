# API Contracts: 认证相关API

**Feature**: 004-popup-login-auth  
**Date**: 2026-01-04

## Base URL

后端API基础URL（从配置或环境变量获取）:

```
{API_BASE_URL}/api/v1
```

## Authentication

所有需要认证的API请求使用Bearer Token认证：

```
Authorization: Bearer <JWT_TOKEN>
```

## Endpoints

### 1. 用户登录

**POST** `/auth/login`

**Description**: 用户使用邮箱和密码登录，返回认证令牌。此接口由前端Web应用调用，插件不直接调用。

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response 200 OK**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john_doe",
    "email": "user@example.com",
    "role": "user"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: 邮箱或密码错误
- `400 Bad Request`: 请求格式错误

**Note**: 插件不直接调用此接口，而是通过前端登录页面完成登录。

---

### 2. 插件认证（可选）

**POST** `/auth/plugin`

**Description**: 插件使用邮箱和密码进行认证，返回认证令牌。此接口可用于插件直接认证（如果前端不可用）。

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response 200 OK**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Error Responses**:
- `401 Unauthorized`: 邮箱或密码错误
- `400 Bad Request`: 请求格式错误

**Note**: 根据规范要求，插件不应直接处理用户名和密码，此接口仅作为备选方案。

---

### 3. Token验证（隐式）

**Description**: 所有需要认证的API端点都会验证token。如果token无效或过期，返回401错误。

**Response 401 Unauthorized**:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**Plugin Behavior**: 
- 插件检测到401错误时，清除本地token
- 刷新UI显示登录按钮
- 要求用户重新登录

---

## Plugin API Usage

### 所有需要认证的API请求

插件在调用任何需要认证的API时，必须：

1. 从SecretStorage获取token
2. 在请求头中添加 `Authorization: Bearer {token}`
3. 处理401错误，触发重新登录

**Example**:

```typescript
const token = await tokenManager.getToken();
if (!token) {
  // 显示登录按钮
  return;
}

const response = await apiClient.post('/api/v1/records', data, {
  'Authorization': `Bearer ${token}`
});

if (response.status === 401) {
  // Token过期，清除并重新登录
  await tokenManager.deleteToken();
  await refreshPanel();
}
```

## Error Handling

### 401 Unauthorized

**Cause**: Token无效、过期或缺失

**Plugin Action**:
1. 清除本地token
2. 刷新UI显示登录按钮
3. 不自动重新登录（用户需要手动点击登录按钮）

### 网络错误

**Cause**: 网络连接失败、超时等

**Plugin Action**:
1. 显示错误提示
2. 保持当前登录状态（不清除token）
3. 允许用户重试

### Token格式错误

**Cause**: 从回调URI获取的token格式不正确

**Plugin Action**:
1. 不保存token
2. 显示错误提示
3. 保持未登录状态

## Security Notes

1. **Token传输**: Token通过HTTPS传输（生产环境）
2. **Token存储**: Token存储在VS Code SecretStorage，使用操作系统密钥管理
3. **Token验证**: Token有效性通过API响应验证，不进行本地解析
4. **密码安全**: 插件不处理用户密码，所有密码输入在前端Web应用中完成

