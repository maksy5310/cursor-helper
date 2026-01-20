# Quick Start: 弹出登录页面鉴权

**Feature**: 004-popup-login-auth  
**Date**: 2026-01-04

## Overview

本功能为Cursor插件提供安全的用户认证机制。用户通过前端Web应用完成登录，插件获取token并用于后续API请求。

## Prerequisites

1. **前端Web应用运行**: spec-share-frontend必须运行并可访问
2. **后端API可用**: spec-share-server必须运行并提供登录接口
3. **插件开发环境**: VS Code/Cursor扩展开发环境已配置

## Setup

### 1. 配置前端登录页面URL

在插件配置中设置前端登录页面URL：

```json
{
  "cursor-helper.auth.loginUrl": "http://localhost:5173/login?callback=cursor-helper://auth/callback"
}
```

### 2. 注册URI Scheme Handler

在 `extension.ts` 中注册URI scheme处理器：

```typescript
import * as vscode from 'vscode';
import { AuthService } from './services/authService';

export function activate(context: vscode.ExtensionContext) {
  const authService = new AuthService(context);
  
  // 注册URI scheme处理器
  vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri) {
      if (uri.path === '/auth/callback') {
        const token = new URLSearchParams(uri.query).get('token');
        if (token) {
          authService.handleLoginCallback(token);
        }
      }
    }
  });
  
  // 注册登录命令
  const loginCommand = vscode.commands.registerCommand('cursor-helper.login', () => {
    authService.openLoginPage();
  });
  
  context.subscriptions.push(loginCommand);
}
```

### 3. 实现AuthService

创建 `src/services/authService.ts`:

```typescript
import * as vscode from 'vscode';
import { TokenManager } from '../utils/tokenManager';

export class AuthService {
  private tokenManager: TokenManager;
  
  constructor(private context: vscode.ExtensionContext) {
    this.tokenManager = new TokenManager(context);
  }
  
  async openLoginPage(loginUrl?: string): Promise<void> {
    const url = loginUrl || 
      vscode.workspace.getConfiguration('cursor-helper').get<string>('auth.loginUrl') ||
      'http://localhost:5173/login?callback=cursor-helper://auth/callback';
    
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }
  
  async handleLoginCallback(token: string): Promise<void> {
    // 验证token格式
    if (!this.isValidToken(token)) {
      vscode.window.showErrorMessage('Invalid token format');
      return;
    }
    
    // 保存token
    await this.tokenManager.saveToken(token);
    
    // 刷新UI
    await this.refreshPanel();
    
    vscode.window.showInformationMessage('Login successful');
  }
  
  async getToken(): Promise<string | null> {
    return await this.tokenManager.getToken();
  }
  
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }
  
  async logout(): Promise<void> {
    await this.tokenManager.deleteToken();
    await this.refreshPanel();
    vscode.window.showInformationMessage('Logged out');
  }
  
  private isValidToken(token: string): boolean {
    // JWT格式验证：三部分用点分隔
    return token.split('.').length === 3;
  }
  
  private async refreshPanel(): Promise<void> {
    // 刷新会话列表面板
    // 实现取决于具体的面板刷新逻辑
  }
}
```

### 4. 实现TokenManager

创建 `src/utils/tokenManager.ts`:

```typescript
import * as vscode from 'vscode';

export class TokenManager {
  private readonly TOKEN_KEY = 'cursor-helper.auth.token';
  
  constructor(private context: vscode.ExtensionContext) {}
  
  async saveToken(token: string): Promise<void> {
    await this.context.secrets.store(this.TOKEN_KEY, token);
  }
  
  async getToken(): Promise<string | null> {
    const token = await this.context.secrets.get(this.TOKEN_KEY);
    return token || null;
  }
  
  async deleteToken(): Promise<void> {
    await this.context.secrets.delete(this.TOKEN_KEY);
  }
}
```

### 5. 更新API客户端

更新 `src/utils/apiClient.ts` 以支持认证：

```typescript
import { TokenManager } from './tokenManager';

export class ApiClient {
  constructor(private tokenManager: TokenManager) {}
  
  async request<T>(url: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    // 获取token
    const token = await this.tokenManager.getToken();
    
    // 添加认证头
    const headers = {
      ...options.headers,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    
    // 发送请求
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body
    });
    
    // 处理401错误
    if (response.status === 401) {
      await this.tokenManager.deleteToken();
      // 触发UI刷新
      await this.handleUnauthorized();
      throw new HttpError(401, 'Unauthorized');
    }
    
    // 处理响应...
  }
  
  private async handleUnauthorized(): Promise<void> {
    // 刷新面板显示登录按钮
  }
}
```

### 6. 更新插件面板

更新 `src/ui/sessionListPanel.ts` 以支持登录/登出状态：

```typescript
import { AuthService } from '../services/authService';

export class SessionListPanel {
  private authService: AuthService;
  
  async initialize(): Promise<void> {
    const isAuthenticated = await this.authService.isAuthenticated();
    
    if (!isAuthenticated) {
      // 显示登录按钮
      this.showLoginButton();
    } else {
      // 显示会话列表
      this.showSessionList();
    }
  }
  
  private showLoginButton(): void {
    // 实现登录按钮显示逻辑
  }
  
  private showSessionList(): void {
    // 实现会话列表显示逻辑
  }
}
```

## Usage

### 用户登录流程

1. 用户打开插件面板
2. 如果未登录，显示登录按钮
3. 用户点击登录按钮
4. 系统打开外部浏览器，显示前端登录页面
5. 用户在前端输入邮箱和密码
6. 前端登录成功后，重定向到 `cursor-helper://auth/callback?token=xxx`
7. 插件处理回调，保存token
8. 插件面板刷新，显示会话列表

### 用户登出流程

1. 用户点击退出按钮
2. 插件清除token
3. 插件面板刷新，显示登录按钮

### Token过期处理

1. API请求返回401错误
2. 插件清除token
3. 插件面板刷新，显示登录按钮
4. 用户需要重新登录

## Testing

### 手动测试

1. **登录测试**:
   - 打开插件面板
   - 点击登录按钮
   - 在前端完成登录
   - 验证插件面板显示会话列表

2. **登出测试**:
   - 点击退出按钮
   - 验证插件面板显示登录按钮

3. **Token过期测试**:
   - 手动修改token使其无效
   - 触发API请求
   - 验证401错误处理
   - 验证插件面板显示登录按钮

### 单元测试

```typescript
describe('AuthService', () => {
  it('should save token on callback', async () => {
    const authService = new AuthService(mockContext);
    await authService.handleLoginCallback('valid.token.here');
    const token = await authService.getToken();
    expect(token).toBe('valid.token.here');
  });
  
  it('should reject invalid token format', async () => {
    const authService = new AuthService(mockContext);
    await expect(
      authService.handleLoginCallback('invalid-token')
    ).rejects.toThrow();
  });
});
```

## Troubleshooting

### 问题1: URI scheme回调不工作

**解决方案**:
- 检查 `package.json` 中是否正确注册了命令
- 检查 `extension.ts` 中是否正确注册了URI handler
- 验证前端回调URL格式是否正确

### 问题2: Token保存失败

**解决方案**:
- 检查VS Code SecretStorage是否可用
- 验证token格式是否正确
- 检查权限设置

### 问题3: 前端登录页面无法打开

**解决方案**:
- 检查前端应用是否运行
- 验证登录URL配置是否正确
- 检查网络连接

## Next Steps

1. 实现完整的AuthService和TokenManager
2. 更新API客户端以支持认证
3. 更新插件面板UI以显示登录/登出状态
4. 移除所有手动输入token的代码
5. 编写单元测试和集成测试

