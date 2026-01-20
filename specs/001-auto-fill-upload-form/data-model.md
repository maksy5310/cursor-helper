# Data Model: 上传表单自动填充

**Feature**: 001-auto-fill-upload-form  
**Date**: 2026-01-15  
**Status**: Phase 1 Design

---

## Entity Diagram

```
┌─────────────────┐
│   UserProfile   │
├─────────────────┤           ┌──────────────┐
│ - email         │◄──────────│  JWT Token   │
│ - nickname      │           ├──────────────┤
│ - avatarUrl     │           │ - payload    │
│ - userId        │           │ - exp        │
│ - lastSyncedAt  │           │ - iat        │
└─────────────────┘           └──────────────┘
         │
         │ used by
         ▼
┌─────────────────┐
│ UploadFormData  │
├─────────────────┤
│ - uploader_email│ (auto-filled from UserProfile.email)
│ - project_name  │ (auto-filled from WorkspaceHelper)
│ - content       │
│ - composer_id   │
└─────────────────┘

┌─────────────────┐
│ AvatarCache     │
├─────────────────┤
│ - email         │
│ - localPath     │
│ - lastFetched   │
└─────────────────┘
```

---

## Entities

### 1. UserProfile

**Purpose**: 表示当前登录用户的个人资料信息

**Storage**: VSCode WorkspaceState (`userProfile` key)

**Lifecycle**: 
- Created: 登录成功后,从JWT payload或登录响应解析
- Updated: 用户手动刷新或重新登录
- Deleted: 用户登出或JWT过期

**Fields**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `email` | string | Yes | 用户邮箱地址 | Email format, unique identifier |
| `nickname` | string | No | 用户昵称/显示名 | If empty, use email local part |
| `avatarUrl` | string | No | 用户头像URL | Valid HTTP(S) URL or null |
| `userId` | string | No | 后端用户ID | From login response |
| `lastSyncedAt` | number | Yes | 最后同步时间戳(ms) | Date.now() |

**Example**:
```typescript
{
  email: "user@example.com",
  nickname: "张三",
  avatarUrl: "https://example.com/avatar/user123.jpg",
  userId: "user-uuid-123",
  lastSyncedAt: 1705320000000
}
```

---

### 2. JWTToken

**Purpose**: spec-share-server颁发的JSON Web Token

**Storage**: VSCode SecretStorage (`cursor-helper.jwt` key)

**Lifecycle**:
- Created: 用户通过浏览器登录成功后,URI回调传入
- Read: 每次API请求时作为Authorization header
- Deleted: 用户登出或检测到过期

**Structure** (Decoded Payload):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | 用户邮箱 (from backend) |
| `role` | string | Yes | 用户角色 (e.g., "user", "admin") |
| `exp` | number | Yes | 过期时间 (Unix timestamp, seconds) |
| `iat` | number | Yes | 签发时间 (Unix timestamp, seconds) |
| `iss` | string | No | 签发者 (optional) |

**Example Payload**:
```json
{
  "email": "user@example.com",
  "role": "user",
  "exp": 1705406400,
  "iat": 1705320000
}
```

**Validation Rules**:
- JWT签名必须有效(使用后端的secret key)
- `exp`字段必须大于当前时间
- `email`字段必须存在且为有效邮箱格式

---

### 3. UploadFormData

**Purpose**: 上传记录表单的数据结构

**Storage**: 临时(WebView state),提交后发送到API

**Auto-Fill Sources**:
- `uploader_email`: 从`UserProfile.email`自动填充
- `project_name`: 从`WorkspaceHelper.getCurrentWorkspaceName()`自动填充

**Fields**:

| Field | Type | Required | Auto-Fill | Description |
|-------|------|----------|-----------|-------------|
| `uploader_email` | string | Yes | ✅ | 上传者邮箱 |
| `project_name` | string | Yes | ✅ | 项目名称 |
| `content` | string | Yes | ❌ | Markdown内容 |
| `content_format` | enum | Yes | ❌ | "markdown" or "json" |
| `composer_id` | string | No | ❌ | Cursor session ID |
| `upload_time` | string | Yes | ⏱ | ISO 8601 timestamp |

**Auto-Fill Logic**:
```typescript
async function getAutoFillData(): Promise<{email: string | null, projectName: string | null}> {
  const email = await getUserProfileFromCache()?.email || null;
  const projectName = WorkspaceHelper.getCurrentWorkspaceName() || null;
  return { email, projectName };
}
```

---

### 4. AvatarCacheEntry

**Purpose**: 缓存已下载的用户头像,避免重复网络请求

**Storage**: 文件系统 (`context.globalStorageUri.fsPath + '/avatars'`)

**Lifecycle**:
- Created: 首次成功下载头像后
- Read: 个人信息区域渲染时
- Deleted: 用户登出或缓存过期(30天)

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `email` | string | 用户邮箱(作为文件名哈希的key) |
| `localPath` | string | 本地文件路径 |
| `lastFetched` | number | 最后获取时间戳(ms) |

**File Naming**:
```typescript
const filename = crypto.createHash('md5').update(avatarUrl).digest('hex') + '.png';
const localPath = path.join(avatarCacheDir, filename);
```

---

## State Transitions

### UserProfile Lifecycle

```
┌─────────┐
│  NULL   │ (未登录)
└────┬────┘
     │ login success
     ▼
┌─────────┐
│ ACTIVE  │ (已登录,JWT有效)
└────┬────┘
     │ JWT expired / logout
     ▼
┌─────────┐
│ EXPIRED │ (JWT过期,需重新登录)
└────┬────┘
     │ re-login
     ▼
┌─────────┐
│ ACTIVE  │
└─────────┘
```

### JWT Token States

```
┌───────────┐
│ NOT_FOUND │ (初始状态)
└─────┬─────┘
      │ URI callback
      ▼
┌───────────┐
│  VALID    │ (未过期,可用于API请求)
└─────┬─────┘
      │ time passes
      ▼
┌───────────┐
│  EXPIRED  │ (exp < Date.now())
└─────┬─────┘
      │ user logout / re-login
      ▼
┌───────────┐
│  DELETED  │
└───────────┘
```

---

## Data Flow

### Login Flow

```
User clicks "登录" 
  → Opens browser (spec-share-frontend/plugin-login)
  → User enters credentials
  → Frontend calls POST /api/auth/plugin
  → Backend returns { access_token, token_type }
  → Frontend redirects to cursor://extension-id/auth/callback?token=xxx
  → Extension receives URI callback
  → Parse JWT payload
  → Save JWT to SecretStorage
  → Extract UserProfile from payload
  → Save UserProfile to WorkspaceState
  → Refresh UI (TreeView, upload form)
```

### Auto-Fill Flow

```
User opens upload form
  → WebView postMessage('requestAutoFill')
  → Extension reads UserProfile from WorkspaceState
  → Extract email from UserProfile
  → Get project name from WorkspaceHelper
  → WebView receives { email, projectName }
  → Auto-fill form fields
```

### Avatar Loading Flow

```
Render UserInfoTreeItem
  → Check AvatarCache for user's avatar
  → If cached and fresh (<30 days):
      → Use cached localPath
  → Else:
      → Try load from UserProfile.avatarUrl (timeout 5s)
      → On failure: Try Gravatar (MD5(email), timeout 3s)
      → On failure: Use default SVG
      → Save to AvatarCache
  → Display avatar in TreeView
```

---

## Validation Rules

### UserProfile
- `email`: MUST match regex `^[^@]+@[^@]+\.[^@]+$`
- `nickname`: If empty, auto-generate from email local part
- `avatarUrl`: If provided, MUST be valid HTTP(S) URL
- `lastSyncedAt`: MUST be <= current timestamp

### JWT Token
- MUST be valid JWT format (3 parts separated by dots)
- Payload MUST contain `email`, `role`, `exp`
- `exp` MUST be in the future (not expired)
- Signature MUST be verifiable (though client-side verification is optional)

### UploadFormData
- `uploader_email`: MUST be valid email format
- `project_name`: MUST be non-empty string
- `content`: MUST be non-empty string
- `content_format`: MUST be one of ["markdown", "json"]

---

## Relationships

1. **UserProfile ← JWT Token** (1:1)
   - UserProfile is extracted from JWT payload
   - JWT过期时,UserProfile也应被标记为过期

2. **UserProfile → UploadFormData** (1:N)
   - One user can create multiple upload records
   - UserProfile.email auto-fills UploadFormData.uploader_email

3. **UserProfile → AvatarCacheEntry** (1:1)
   - One avatar cache per user (keyed by email)

---

## Migration Notes

**从旧实现迁移** (如果之前使用了OAuth token):
1. 检查SecretStorage中的旧key (`cursor-helper.auth.accessToken`)
2. 如果存在,删除旧token并引导用户重新登录
3. 新实现仅使用单一key: `cursor-helper.jwt`

**WorkspaceState Keys**:
- `userProfile`: UserProfile对象
- (其他现有keys保持不变)

---

**Phase 1 Data Model Complete** ✅  
**Next Step**: Generate API Contracts
