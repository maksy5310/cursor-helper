# API Contracts

本目录包含cursor-helper插件与spec-share-server之间的API契约定义。

## 文件

- **api-spec.yaml**: OpenAPI 3.0规范,定义所有使用的HTTP端点

## 认证流程

### 简化的JWT认证(非OAuth 2.0)

```
┌─────────┐          ┌──────────────────┐          ┌────────────────┐
│ Cursor  │          │ spec-share-      │          │ spec-share-    │
│ Helper  │          │ frontend         │          │ server         │
└────┬────┘          └────────┬─────────┘          └────────┬───────┘
     │                        │                             │
     │ 1. Click "登录"        │                             │
     ├───────────────────────►│                             │
     │                        │                             │
     │ 2. Open browser        │                             │
     │   /plugin-login        │                             │
     │                        │ 3. User enters credentials  │
     │                        │─────────────────────────────►│
     │                        │                             │
     │                        │ 4. POST /api/auth/plugin    │
     │                        │   { email, password }       │
     │                        │─────────────────────────────►│
     │                        │                             │
     │                        │ 5. { access_token, ...}     │
     │                        │◄─────────────────────────────│
     │                        │                             │
     │ 6. Redirect to:        │                             │
     │   cursor://ext-id/     │                             │
     │   auth/callback?       │                             │
     │   token=xxx            │                             │
     │◄───────────────────────┤                             │
     │                        │                             │
     │ 7. Parse JWT payload   │                             │
     │ 8. Store in SecretStorage                           │
     │ 9. Extract UserProfile │                             │
     │10. Update UI           │                             │
     │                        │                             │
```

### JWT Payload结构

```json
{
  "email": "user@example.com",
  "role": "user",
  "exp": 1705406400,
  "iat": 1705320000
}
```

**解析方式**:
```typescript
import { decodeJwt } from 'jose';

const payload = decodeJwt(jwtToken);
const email = payload.email;
const expiresAt = payload.exp * 1000; // Convert to milliseconds
```

## API端点使用

### 1. 插件认证 (Performed by frontend, not plugin)

前端调用:
```http
POST /api/auth/plugin HTTP/1.1
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "user_password"
}
```

响应:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### 2. 使用JWT访问其他API (Future endpoints)

```http
GET /api/records HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 错误处理

### 401 Unauthorized
当JWT过期或无效时,后端返回401。插件应:
1. 检测到401响应
2. 清除本地存储的JWT
3. 打开浏览器引导用户重新登录

```typescript
if (response.status === 401) {
  await context.secrets.delete('cursor-helper.jwt');
  await context.workspaceState.update('userProfile', undefined);
  vscode.env.openExternal(vscode.Uri.parse('http://localhost:5173/plugin-login'));
}
```

## 数据验证

### JWT令牌验证

插件端需要:
1. ✅ 检查JWT格式(3部分,用`.`分隔)
2. ✅ 解析payload(使用jose库)
3. ✅ 验证过期时间(`exp > Date.now() / 1000`)
4. ❌ **不需要**验证签名(信任后端,减少复杂度)

### 用户信息提取

优先级:
1. **从登录响应的user对象**(如果前端传递了完整响应):
   ```typescript
   const userInfo = loginResponse.user; // 包含avatar_url, username等
   ```

2. **从JWT payload**(最小信息):
   ```typescript
   const payload = decodeJwt(jwtToken);
   const userInfo = {
     email: payload.email,
     role: payload.role,
     nickname: payload.email.split('@')[0], // 回退到邮箱本地部分
   };
   ```

## 后端依赖

### 必需的后端端点
- ✅ `POST /api/auth/plugin` (已实现)

### 可选的未来端点
- ❌ `GET /api/users/me` (未实现,但可在未来添加以获取最新用户信息)
- ❌ `POST /api/auth/refresh` (未实现,后端不支持refresh token)

## 测试

### 手动测试API
```bash
# 1. 获取JWT令牌
curl -X POST http://localhost:8000/api/auth/plugin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 2. 解析JWT payload
# 使用 https://jwt.io 或 jose库

# 3. 使用JWT访问API
curl -X GET http://localhost:8000/api/records \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 集成测试
参见 `tests/integration/auth.test.ts`

## 变更日志

### 2026-01-15
- 初始版本
- 定义JWT认证流程(非OAuth 2.0)
- 明确后端不支持refresh token
- 定义JWT payload结构

---

**相关文档**:
- [../data-model.md](../data-model.md) - 数据模型定义
- [../research.md](../research.md) - 技术决策
- [../quickstart.md](../quickstart.md) - 快速开始指南
