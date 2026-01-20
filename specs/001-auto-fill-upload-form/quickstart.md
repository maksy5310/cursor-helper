# Quick Start: 上传表单自动填充

**Feature**: 001-auto-fill-upload-form  
**Target**: 开发者快速上手指南

---

## 📋 前置条件

1. **开发环境**:
   - Node.js >= 18.0.0
   - VS Code >= 1.74.0 (或Cursor编辑器)
   - TypeScript 5.0+

2. **依赖服务**:
   - spec-share-server运行在 http://localhost:8000
   - spec-share-frontend运行在 http://localhost:5173

3. **已有代码**:
   - cursor-helper扩展基础代码
   - 现有的tokenManager, authService, uploadFormPanel

---

## 🚀 快速开始 (5分钟)

### Step 1: 安装依赖

```bash
cd f:\spec-kit\cursor-helper
npm install jose@^5.0.0  # JWT解析库
```

### Step 2: 配置扩展

编辑 `.vscode/settings.json` (或Cursor配置):
```json
{
  "cursor-helper.auth.loginUrl": "http://localhost:5173/plugin-login",
  "cursor-helper.userCenter.url": "http://localhost:5173/user/profile"
}
```

### Step 3: 编译并运行

```bash
npm run compile
# 按F5启动扩展调试
```

### Step 4: 测试登录流程

1. 在调试扩展窗口中,打开命令面板(Ctrl+Shift+P)
2. 运行命令: `Cursor Assistant: 登录`
3. 浏览器打开,输入测试账号:
   - Email: test@example.com
   - Password: password123
4. 登录成功后,浏览器重定向到 `cursor://...`,扩展接收JWT
5. 侧边栏面板应显示用户信息

### Step 5: 测试自动填充

1. 打开命令: `Cursor Assistant: 上传记录`
2. 检查表单中的邮箱字段是否自动填充为 `test@example.com`
3. 检查项目名称字段是否自动填充为当前工作区名称

---

## 📁 项目结构速览

```
src/
├── models/
│   ├── userProfile.ts        # [新增] 用户资料模型
│   └── auth.ts                # [修改] 添加JWT类型定义
├── services/
│   ├── authService.ts         # [简化] 移除OAuth,保留JWT
│   └── userProfileService.ts  # [新增] 用户资料服务
├── utils/
│   ├── tokenManager.ts        # [简化] 移除refresh token逻辑
│   ├── jwtParser.ts           # [新增] JWT解析工具
│   ├── avatarLoader.ts        # [新增] 头像加载器
│   └── uriHandler.ts          # [修改] 处理JWT回调
├── ui/
│   ├── uploadFormPanel.ts     # [修改] 集成自动填充
│   └── userInfoTreeItem.ts    # [新增] 个人信息TreeView
└── extension.ts               # [修改] 注册新命令和TreeView

resources/
└── default-avatar.svg         # [新增] 默认头像
```

---

## 🔧 核心实现指南

### 1. JWT认证 (简化版,非OAuth)

**不要实现的内容**:
- ❌ OAuth 2.0授权码流程
- ❌ State验证和PKCE
- ❌ Refresh token自动刷新
- ❌ /auth/refresh端点调用

**需要实现的内容**:
```typescript
// utils/jwtParser.ts
import { decodeJwt } from 'jose';

export function parseJWTPayload(token: string): JWTPayload | null {
  try {
    const payload = decodeJwt(token);
    return {
      email: payload.email as string,
      role: payload.role as string,
      exp: payload.exp as number,
      iat: payload.iat as number,
    };
  } catch {
    return null;
  }
}

export function isJWTExpired(token: string): boolean {
  const payload = parseJWTPayload(token);
  if (!payload) return true;
  return payload.exp * 1000 < Date.now();
}
```

### 2. URI回调处理

```typescript
// utils/uriHandler.ts
export class AuthUriHandler implements vscode.UriHandler {
  async handleUri(uri: vscode.Uri): Promise<void> {
    if (uri.path === '/auth/callback') {
      const token = new URLSearchParams(uri.query).get('token');
      if (token) {
        // 保存JWT到SecretStorage
        await context.secrets.store('cursor-helper.jwt', token);
        
        // 解析用户信息
        const payload = parseJWTPayload(token);
        const userProfile: UserProfile = {
          email: payload.email,
          nickname: payload.email.split('@')[0],
          userId: null,
          avatarUrl: null,
          lastSyncedAt: Date.now(),
        };
        
        // 缓存到WorkspaceState
        await context.workspaceState.update('userProfile', userProfile);
        
        vscode.window.showInformationMessage('登录成功!');
      }
    }
  }
}
```

### 3. 自动填充逻辑

```typescript
// ui/uploadFormPanel.ts
private async getAutoFillData(): Promise<{email: string | null, projectName: string | null}> {
  // 1. 获取用户邮箱
  const userProfile = this.context.workspaceState.get<UserProfile>('userProfile');
  const email = userProfile?.email || null;
  
  // 2. 获取项目名称
  const WorkspaceHelper = require('../utils/workspaceHelper').WorkspaceHelper;
  const projectName = WorkspaceHelper.getCurrentWorkspaceName() || null;
  
  return { email, projectName };
}

// WebView中的消息处理
this.panel.webview.onDidReceiveMessage(async (message) => {
  if (message.type === 'requestAutoFill') {
    const data = await this.getAutoFillData();
    this.panel.webview.postMessage({
      type: 'autoFillData',
      data: data,
    });
  }
});
```

### 4. 个人信息TreeView

```typescript
// ui/userInfoTreeItem.ts
export class UserInfoTreeItem extends vscode.TreeItem {
  constructor(profile: UserProfile | null, avatarUri?: vscode.Uri) {
    super(
      profile?.nickname || '未登录',
      vscode.TreeItemCollapsibleState.None
    );
    
    if (profile) {
      this.description = profile.email;
      this.iconPath = avatarUri || new vscode.ThemeIcon('account');
      this.command = {
        command: 'cursor-assistant.openUserCenter',
        title: '打开个人中心',
      };
    } else {
      this.description = '点击登录';
      this.iconPath = new vscode.ThemeIcon('sign-in');
      this.command = {
        command: 'cursor-assistant.login',
        title: '登录',
      };
    }
  }
}
```

### 5. 头像加载(三级降级)

```typescript
// utils/avatarLoader.ts
export class AvatarLoader {
  async loadAvatar(email: string, avatarUrl?: string): Promise<vscode.Uri> {
    // Level 1: 用户头像URL
    if (avatarUrl) {
      const loaded = await this.tryLoadUrl(avatarUrl, 5000);
      if (loaded) return loaded;
    }
    
    // Level 2: Gravatar
    const gravatarUrl = this.getGravatarUrl(email);
    const gravatar = await this.tryLoadUrl(gravatarUrl, 3000);
    if (gravatar) return gravatar;
    
    // Level 3: 默认SVG
    return vscode.Uri.file(this.defaultAvatarPath);
  }
  
  private getGravatarUrl(email: string): string {
    const hash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
    return `https://www.gravatar.com/avatar/${hash}?s=64&d=identicon`;
  }
}
```

---

## 🧪 测试场景

### 场景1: 首次登录
1. 扩展激活,未登录状态
2. 侧边栏显示"未登录"和登录按钮
3. 点击登录→浏览器打开
4. 输入凭证→登录成功
5. 浏览器重定向→扩展接收JWT
6. 侧边栏更新显示用户信息

### 场景2: JWT过期处理
1. 手动修改JWT的exp字段为过去时间
2. 尝试上传记录
3. API返回401
4. 扩展检测到401→打开登录页面
5. 重新登录→获取新JWT

### 场景3: 自动填充
1. 已登录状态
2. 打开上传表单
3. 邮箱字段自动填充当前用户邮箱
4. 项目名称字段自动填充当前工作区名称
5. 用户可以修改这些字段

### 场景4: 头像加载降级
1. 用户未设置头像URL
2. 尝试加载Gravatar(基于email)
3. Gravatar加载失败(网络问题)
4. 降级到本地默认SVG头像

---

## 🐛 调试技巧

### 查看JWT内容
```typescript
import { decodeJwt } from 'jose';
const payload = decodeJwt(jwtToken);
console.log('JWT Payload:', payload);
```

### 查看SecretStorage内容
```typescript
const jwt = await context.secrets.get('cursor-helper.jwt');
console.log('Stored JWT:', jwt?.substring(0, 20) + '...');
```

### 查看WorkspaceState缓存
```typescript
const profile = context.workspaceState.get<UserProfile>('userProfile');
console.log('Cached Profile:', profile);
```

### 测试URI回调
```typescript
// 在扩展中模拟URI回调
const testUri = vscode.Uri.parse(
  `cursor://howell.cursor-assistant/auth/callback?token=${testJWT}`
);
await uriHandler.handleUri(testUri);
```

---

## ❓ 常见问题

### Q1: 为什么不使用OAuth 2.0?
**A**: spec-share-server只实现了简单的JWT认证,不是完整的OAuth服务器。使用简单的JWT认证可以满足需求,避免过度设计。

### Q2: JWT过期后如何处理?
**A**: 后端不支持refresh token,JWT过期后引导用户重新登录。这是权衡了复杂度和用户体验的结果。

### Q3: 用户信息从哪里获取?
**A**: 
1. 首选:登录响应的user对象(包含完整信息)
2. 回退:JWT payload(仅email和role)
3. 缓存:WorkspaceState中的UserProfile

### Q4: 如何测试不同的登录状态?
**A**: 
- 未登录: 删除SecretStorage中的JWT
- JWT过期: 修改JWT的exp字段
- 无头像: 设置avatarUrl为null

---

## 📚 进一步阅读

- [data-model.md](./data-model.md) - 完整数据模型定义
- [research.md](./research.md) - 技术决策详解
- [contracts/README.md](./contracts/README.md) - API契约说明
- [tasks.md](./tasks.md) - 详细实施任务列表(由/speckit.tasks生成)

---

## 🔗 相关资源

- [VSCode Extension API](https://code.visualstudio.com/api)
- [jose库文档](https://github.com/panva/jose)
- [Gravatar API](https://gravatar.com/site/implement/)
- [JWT.io](https://jwt.io) - JWT调试工具

---

**Last Updated**: 2026-01-15  
**Status**: Phase 1 Complete ✅
