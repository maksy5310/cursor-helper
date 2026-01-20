# JWT Token 增强说明 - 添加用户名和头像

## 修改概述

在 JWT token 中添加 `username` 和 `avatar_url` 字段，使插件和前端能够正确显示用户名和头像，而无需额外的 API 调用。

## 修改内容

### 1. 后端修改 (spec-share-server)

**文件**: `src/api/routes/auth.py`

修改了 3 个认证端点，在生成 JWT token 时添加用户信息：

#### 修改前：
```python
access_token = create_access_token(
    data={"email": user.email, "role": user.role}
)
```

#### 修改后：
```python
access_token = create_access_token(
    data={
        "email": user.email, 
        "role": user.role,
        "username": user.username,
        "avatar_url": user.avatar_url
    }
)
```

**影响的端点**：
1. `/api/v1/auth/register` - 用户注册
2. `/api/v1/auth/login` - 用户登录
3. `/api/v1/auth/plugin` - 插件认证

### 2. 插件端修改 (cursor-helper)

#### 2.1 更新 JWT Payload 接口定义

**文件**: `src/models/auth.ts`

添加了可选字段：
```typescript
export interface JWTPayload {
    email: string;
    role: string;
    username?: string;      // 新增
    avatar_url?: string;    // 新增
    exp: number;
    iat: number;
    iss?: string;
}
```

#### 2.2 更新登录回调逻辑

**文件**: `src/services/authService.ts`

修改 `handleLoginCallback` 方法，从 JWT payload 中提取用户名和头像：

```typescript
const userProfile: UserProfile = {
    email: payload.email,
    nickname: payload.username || payload.email.split('@')[0], // 优先使用username
    avatarUrl: payload.avatar_url, // 从token中获取头像URL
    lastSyncedAt: Date.now()
};
```

**优先级**：
- 用户名：优先使用 `payload.username`，如果没有则从 `email` 中提取
- 头像：直接使用 `payload.avatar_url`

### 3. 前端修改 (spec-share-frontend)

**文件**: `src/utils/tokenManager.ts`

前端的 `parseToken` 函数已经支持解析 `username` 和 `avatar_url`：

```typescript
const username = payload.username || payload.name || payload.email?.split('@')[0] || '';
const user = {
    id: userId,
    username: username,
    email: payload.email || '',
    avatar_url: payload.avatar_url,
    // ... 其他字段
};
```

## Token Payload 结构

### 修改前：
```json
{
  "email": "user@example.com",
  "role": "user",
  "exp": 1768745297,
  "iat": 1768658897
}
```

### 修改后：
```json
{
  "email": "user@example.com",
  "role": "user",
  "username": "张三",
  "avatar_url": "https://example.com/avatars/user.jpg",
  "exp": 1768745297,
  "iat": 1768658897
}
```

## 显示效果

### 插件端
- **TreeView 用户信息**：显示 `username`（如果没有则显示 email 前缀）
- **用户头像**：通过 `AvatarLoader` 加载 `avatar_url` 指定的图片
- **Tooltip**：显示完整的用户信息

### 前端页面
- **Header 用户菜单**：显示 `username`
- **个人信息页面**：显示 `username` 和头像
- **记录列表**：显示创建者的 `username` 和头像

## 兼容性

### 向后兼容
- `username` 和 `avatar_url` 是可选字段
- 如果 token 中没有 `username`，会自动从 `email` 中提取
- 如果没有 `avatar_url`，会使用默认头像

### 旧 Token 处理
- 旧版本的 token 不包含 `username` 和 `avatar_url`
- 系统会自动降级使用 email 作为显示名称
- 会使用默认头像图标

## 测试步骤

1. **重启后端服务器**
   ```bash
   # 在 spec-share-server 目录
   python -m src.main
   ```

2. **重新编译插件**
   - 在 VS Code 中按 F5 重新加载插件

3. **重新登录**
   - 在插件中点击"登录"
   - 完成登录流程
   - 检查 TreeView 是否显示正确的用户名

4. **检查头像**
   - 如果用户有 `avatar_url`，应该能看到头像图片
   - 如果没有，应该显示默认图标

5. **验证前端**
   - 点击"个人信息"
   - 检查前端页面是否正确显示用户名和头像

## 注意事项

1. **Token 大小**
   - 添加字段后，token 会变大
   - 如果 `avatar_url` 很长，可能影响性能
   - 建议使用相对路径或短 URL

2. **头像加载**
   - 插件会缓存头像图片到本地
   - 缓存有效期默认 30 天
   - 可以通过清除缓存强制重新下载

3. **安全性**
   - JWT 中的数据是 Base64 编码，不是加密
   - 不要在 token 中存储敏感信息
   - `username` 和 `avatar_url` 是公开可见的

## 相关文件

### 后端
- `src/api/routes/auth.py` - 认证路由，生成 token

### 插件
- `src/models/auth.ts` - JWT Payload 类型定义
- `src/services/authService.ts` - 登录回调处理
- `src/ui/userInfoTreeItem.ts` - TreeView 显示逻辑
- `src/utils/avatarLoader.ts` - 头像加载工具

### 前端
- `src/utils/tokenManager.ts` - Token 解析逻辑
- `src/contexts/AuthContext.tsx` - 认证上下文
- `src/components/layout/Header.tsx` - 用户菜单显示
- `src/pages/UserProfilePage.tsx` - 个人信息页面

## 调试日志

登录时会输出以下日志：

```
User email from JWT: user@example.com
User profile: username=张三, avatar=exists
```

如果没有 username 或 avatar_url：

```
User email from JWT: user@example.com
User profile: username=user, avatar=none
```
