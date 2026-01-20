# Data Model: 弹出登录页面鉴权

**Feature**: 004-popup-login-auth  
**Date**: 2026-01-04

## Entities

### AuthState

认证状态，表示用户当前的登录状态。

**Attributes**:
- `isAuthenticated: boolean` - 是否已登录
- `token: string | null` - JWT token（存储在SecretStorage，此处为内存缓存）
- `tokenExpiry: number | null` - Token过期时间戳（从JWT解析，可选）

**State Transitions**:
1. `未登录` → `登录中`: 用户点击登录按钮，打开登录页面
2. `登录中` → `已登录`: 收到token回调，保存token
3. `已登录` → `未登录`: 用户登出或token过期
4. `已登录` → `登录中`: Token过期，需要重新登录

**Validation Rules**:
- `isAuthenticated` 必须与 `token` 状态一致（有token则为true，无token则为false）
- `token` 格式必须符合JWT标准（三部分用点分隔）

---

### TokenInfo

Token信息，用于存储和验证token。

**Attributes**:
- `token: string` - JWT token字符串
- `storedAt: number` - 存储时间戳（用于调试和日志）

**Storage**:
- 存储在VS Code SecretStorage中
- Key: `cursor-helper.auth.token`
- 不存储过期时间（通过API 401错误检测）

**Validation**:
- Token格式验证：必须包含两个点（`.`），分为三部分
- Token有效性：通过API请求验证，不进行本地解析

---

### LoginCallback

登录回调数据，从前端登录页面通过URI scheme传递。

**Attributes**:
- `token: string` - JWT token
- `source: 'callback'` - 来源标识

**Format**:
```
cursor-helper://auth/callback?token=<JWT_TOKEN>
```

**Validation**:
- URI scheme必须为 `cursor-helper://`
- Path必须为 `/auth/callback`
- `token` 参数必须存在且非空
- `token` 格式必须符合JWT标准

---

## Relationships

```
AuthState (1) ──<uses>── (1) TokenInfo
     │
     │ (manages)
     │
     └──> LoginCallback (receives from)
```

## Data Flow

### 登录流程

```
1. 用户点击登录按钮
   → AuthState: isAuthenticated = false
   
2. 打开前端登录页面
   → 前端处理登录逻辑
   
3. 前端登录成功，重定向到 callback URI
   → LoginCallback: { token: "xxx", source: "callback" }
   
4. 插件处理回调，保存token
   → TokenInfo: { token: "xxx", storedAt: timestamp }
   → AuthState: isAuthenticated = true, token = "xxx"
   
5. 刷新插件面板
   → 显示会话列表
```

### 登出流程

```
1. 用户点击退出按钮
   → AuthService.logout()
   
2. 清除token
   → TokenInfo: delete from SecretStorage
   → AuthState: isAuthenticated = false, token = null
   
3. 刷新插件面板
   → 显示登录按钮
```

### Token过期检测

```
1. API请求返回401
   → ApiClient检测到401错误
   
2. 清除token
   → TokenInfo: delete from SecretStorage
   → AuthState: isAuthenticated = false, token = null
   
3. 刷新插件面板
   → 显示登录按钮
```

## Storage Schema

### SecretStorage

```typescript
{
  "cursor-helper.auth.token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Memento (Configuration)

```typescript
{
  "cursor-helper.auth.loginUrl": "http://localhost:5173/login?callback=cursor-helper://auth/callback",
  "cursor-helper.auth.lastLoginTime": 1704364800000  // 可选，用于调试
}
```

## Constraints

1. **Token安全**: Token必须存储在SecretStorage，不得存储在普通文件或配置中
2. **Token格式**: Token必须是有效的JWT格式（三部分用点分隔）
3. **状态一致性**: AuthState的isAuthenticated必须与token存在性一致
4. **URI回调**: LoginCallback的URI必须符合 `cursor-helper://auth/callback?token=xxx` 格式
5. **并发安全**: 多个API请求同时检测到401时，只触发一次重新登录流程

## Migration

### 从手动输入Token迁移

**旧数据**:
- 可能存在于Memento或配置中的旧token

**迁移策略**:
1. 启动时检查SecretStorage中是否有新token
2. 如果有新token，忽略旧token
3. 如果没有新token，清除所有旧token数据
4. 显示登录按钮，要求用户重新登录

**清理**:
- 删除所有与手动输入token相关的配置项
- 删除TokenInput组件和相关代码

