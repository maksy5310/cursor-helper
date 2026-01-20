# 插件用户信息获取优化说明

## 问题描述

之前的插件实现中，用户信息（包括头像）是从 JWT Token 中解析获取的，存在以下问题：

1. **Token 体积大**
   - Token 中包含 Base64 头像，可能有几十KB到几百KB
   - 每次请求都携带 Token，浪费带宽

2. **信息不同步**
   - 用户更新头像后，Token 中仍是旧数据
   - 必须重新登录才能看到最新信息

3. **Gravatar 被墙**
   - 当 Token 中没有头像时，尝试从 Gravatar 加载
   - Gravatar 在国内被墙，导致超时失败

## 解决方案

**改用 Profile API 获取完整用户信息**

- **JWT Token** - 只包含认证必需的基本信息（email, username, role）
- **Profile API** - 获取完整的用户信息（包括头像、部门、工号等）

## 架构设计

### 登录流程

```
用户登录
  ↓
收到 JWT Token（只含基本信息）
  ↓
保存 Token
  ↓
调用 GET /api/v1/users/me/profile
  ↓
获取完整用户信息（包括 Base64 头像）
  ↓
缓存到本地
  ↓
显示在 TreeView 中
```

### 头像加载策略

**改进后（两级降级）：**

1. **Profile API 返回的头像**
   - Base64 格式：直接解码并缓存到本地
   - HTTP URL：下载并缓存到本地

2. **降级：默认头像**
   - 如果上述都失败，使用本地默认头像 SVG

**移除 Gravatar**（因为被墙）

## 实现细节

### 一、修改 UserProfileService

**文件：** `src/services/userProfileService.ts`

**主要改动：**

1. **添加 ApiClient**
   ```typescript
   private apiClient: ApiClient;
   
   constructor(private context: vscode.ExtensionContext) {
       this.apiClient = new ApiClient();
   }
   ```

2. **fetchProfile() 改为调用 API**
   ```typescript
   async fetchProfile(): Promise<UserProfile | null> {
       const apiUrl = Config.getAPIUrl(this.context);
       const profileUrl = `${apiUrl}/users/me/profile`;
       
       const response = await this.apiClient.get<any>(profileUrl);
       
       const profile: UserProfile = {
           email: data.email,
           nickname: data.username,
           avatarUrl: data.avatar_url,  // Base64 或 HTTP URL
           department: data.department,
           employeeId: data.employee_id,
           role: data.role,
           lastSyncedAt: Date.now()
       };
       
       return profile;
   }
   ```

### 二、修改 AvatarLoader

**文件：** `src/utils/avatarLoader.ts`

**主要改动：**

1. **支持 Base64 头像**
   ```typescript
   // 处理 Base64 图片
   if (avatarUrl && avatarUrl.startsWith('data:image')) {
       const base64Data = avatarUrl.split(',')[1];
       const buffer = Buffer.from(base64Data, 'base64');
       const localPath = await this.saveToCache(email, buffer);
       return vscode.Uri.file(localPath);
   }
   ```

2. **支持 HTTP URL**
   ```typescript
   // 尝试从 HTTP URL 加载
   if (avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) {
       const downloaded = await this.tryLoadUrl(avatarUrl, 5000);
       if (downloaded) {
           const localPath = await this.saveToCache(email, downloaded);
           return vscode.Uri.file(localPath);
       }
   }
   ```

3. **移除 Gravatar**
   - 删除 `getGravatarUrl()` 方法
   - 不再尝试从 Gravatar 加载

### 三、修改 AuthService

**文件：** `src/services/authService.ts`

**登录回调流程：**

```typescript
async handleLoginCallback(token: string): Promise<void> {
    // 1. 保存 Token
    await this.tokenManager.saveToken(token);
    
    // 2. 从 Token 获取基本信息
    const userProfile: UserProfile = {
        email: payload.email,
        nickname: payload.username || payload.email.split('@')[0],
        lastSyncedAt: Date.now()
    };
    
    // 3. 保存基本信息
    await this.userProfileService.saveProfile(userProfile);
    
    // 4. 异步获取完整信息（包括头像）
    this.userProfileService.fetchProfile().then(() => {
        // 再次刷新面板以显示完整信息
        this.refreshPanel();
    });
}
```

### 四、更新 UserProfile 模型

**文件：** `src/models/userProfile.ts`

**字段调整：**

```typescript
export interface UserProfile {
    email: string;              // 必需
    nickname: string;           // 必需
    avatarUrl?: string;         // 可选（Base64 或 HTTP URL）
    department?: string;        // 可选
    employeeId?: string;        // 可选
    role?: string;              // 可选
    lastSyncedAt: number;       // 必需
}
```

## 数据流对比

### 修改前（从 JWT 解析）

```
登录
  ↓
收到 Token（包含头像等完整信息，很大）
  ↓
从 Token 解析用户信息
  ↓
【问题】如果 Token 中没有头像
  ↓
尝试从 Gravatar 加载
  ↓
【问题】Gravatar 被墙，超时失败
  ↓
使用默认头像
```

### 修改后（调用 Profile API）

```
登录
  ↓
收到 Token（只含基本信息，很小）
  ↓
保存 Token
  ↓
调用 Profile API
  ↓
获取完整信息（包括 Base64 头像）
  ↓
【支持】Base64 头像：解码并缓存
【支持】HTTP URL：下载并缓存
  ↓
显示在 TreeView 中 ✅
```

## 优势

### 1. Token 体积减小

**修改前：**
```
Token 包含 Base64 头像（100KB）
→ 编码后约 133KB
→ 每次 API 请求携带 133KB
```

**修改后：**
```
Token 只包含基本信息
→ 约 200 字节
→ 每次 API 请求携带 200 字节
→ 节省 99.85% 带宽！
```

### 2. 信息永远最新

- 每次启动插件时调用 Profile API
- 获取最新的用户信息和头像
- 无需重新登录

### 3. 避免 Gravatar 被墙

- 不再依赖 Gravatar
- 所有头像来自后端 Profile API
- 支持 Base64 和 HTTP URL

### 4. 支持 Base64 头像

- 直接处理 Base64 图片数据
- 解码后缓存到本地
- 无需额外的 HTTP 请求

## API 调用

### GET /api/v1/users/me/profile

**请求：**
```http
GET /api/v1/users/me/profile
Authorization: Bearer <token>
```

**响应：**
```json
{
  "id": "user-id",
  "username": "Howell",
  "email": "user@example.com",
  "avatar_url": "data:image/png;base64,iVBORw0KGgo...",
  "department": "中央研究院",
  "employee_id": "17868",
  "role": "admin",
  "created_at": "2026-01-04T04:44:00",
  "updated_at": "2026-01-19T01:23:45"
}
```

## 日志对比

### 修改前

```
[INFO] Parsing user profile from JWT...
[INFO] User profile parsed successfully: user@example.com
[INFO] Trying to load avatar from Gravatar: https://www.gravatar.com/avatar/...
[WARN] Failed to fetch avatar from Gravatar: ECONNRESET
[INFO] Using default avatar for user@example.com
```

### 修改后

```
[INFO] Token saved successfully
[INFO] Basic user profile from token: Howell (user@example.com)
[INFO] Fetching complete profile from Profile API...
[INFO] User profile fetched successfully: user@example.com
[INFO]   - Username: Howell
[INFO]   - Department: 中央研究院
[INFO]   - Employee ID: 17868
[INFO]   - Avatar: Base64
[INFO] Processing Base64 avatar for user@example.com
[INFO] Base64 avatar cached for user@example.com
```

## 缓存策略

1. **内存缓存**
   - 首次获取后缓存在内存中
   - 插件运行期间有效

2. **WorkspaceState 缓存**
   - 保存到 VS Code Workspace State
   - 重启插件后仍然有效

3. **文件系统缓存（头像）**
   - 解码后的头像保存到本地文件
   - 30天过期时间
   - 避免重复下载/解码

4. **刷新策略**
   - 插件启动时检查缓存
   - 如果有效则使用缓存
   - 如果过期或不存在，调用 API 刷新

## 测试验证

### 1. 登录测试

1. 执行 "Cursor Assistant: Login" 命令
2. 浏览器打开登录页面
3. 登录成功后自动跳转回 VS Code
4. 查看输出日志：
   ```
   [INFO] Fetching complete profile from Profile API...
   [INFO] Processing Base64 avatar...
   [INFO] Base64 avatar cached...
   ```

### 2. 头像显示测试

1. 打开 TreeView "CURSOR ASSISTANT"
2. 应该能看到用户头像（不是默认头像）
3. 头像应该与网页上的一致

### 3. 信息更新测试

1. 在网页上更新头像
2. VS Code 中执行 "Cursor Assistant: Logout"
3. 重新登录
4. 应该能看到新头像

## 兼容性

- ✅ 兼容旧的 Token（只是没有完整信息）
- ✅ 兼容新的 Token（只含基本信息）
- ✅ Profile API 提供完整信息
- ✅ 支持 Base64 和 HTTP URL 头像

## 文件清单

### 插件修改
- ✅ `src/services/userProfileService.ts` - 调用 Profile API
- ✅ `src/utils/avatarLoader.ts` - 支持 Base64，移除 Gravatar
- ✅ `src/services/authService.ts` - 登录后异步获取完整信息
- ✅ `src/models/userProfile.ts` - 更新字段定义

### 文档
- ✅ 本说明文档

## 未来优化

1. **增量更新**
   - 只在用户信息变化时刷新
   - 使用 ETag 或版本号

2. **WebSocket 推送**
   - 用户更新信息时实时推送到插件
   - 无需轮询或重新登录

3. **头像压缩**
   - 服务端提供多种尺寸
   - 插件根据显示大小选择合适的尺寸

---

**创建时间：** 2026-01-19
**修改版本：** 2.0
**影响范围：** 插件用户信息获取和头像加载
