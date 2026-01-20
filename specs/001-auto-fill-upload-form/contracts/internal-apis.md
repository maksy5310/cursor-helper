# Internal API Contracts

**Feature**: 001-auto-fill-upload-form  
**Date**: 2026-01-14  
**Version**: 1.0.0

## 概述

本文档定义功能实现所需的内部API接口,包括新增的方法和对现有类的扩展。

---

## TokenManager 扩展

### getUserEmail()

**用途**: 从JWT token中提取用户邮箱地址

**签名**:

```typescript
class TokenManager {
    /**
     * 获取当前用户的邮箱地址
     * @returns 用户邮箱,如果无法获取则返回null
     */
    async getUserEmail(): Promise<string | null>;
}
```

**实现逻辑**:

```typescript
async getUserEmail(): Promise<string | null> {
    try {
        const token = await this.getToken();
        if (!token) {
            return null;
        }
        
        return this.extractEmailFromToken(token);
    } catch (error) {
        Logger.error('Failed to get user email', error as Error);
        return null;
    }
}

/**
 * 从JWT token中提取邮箱
 * @param token JWT token字符串
 * @returns 邮箱地址,如果提取失败则返回null
 */
private extractEmailFromToken(token: string): string | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }
        
        // 解码payload
        const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
        const data = JSON.parse(payload);
        
        // 尝试多种可能的邮箱字段
        return data.email || data.user?.email || null;
    } catch (error) {
        Logger.error('Failed to extract email from token', error as Error);
        return null;
    }
}
```

**返回值**:
- `string`: 用户邮箱地址
- `null`: 未登录、token无效或无邮箱字段

**错误处理**:
- 所有异常都被捕获并返回null
- 错误信息记录到日志

**测试用例**:

```typescript
describe('TokenManager.getUserEmail', () => {
    it('should return email from valid token', async () => {
        // 模拟有效token
        const email = await tokenManager.getUserEmail();
        expect(email).toBe('user@example.com');
    });
    
    it('should return null when not logged in', async () => {
        // 模拟未登录
        const email = await tokenManager.getUserEmail();
        expect(email).toBeNull();
    });
    
    it('should return null when token is invalid', async () => {
        // 模拟无效token
        const email = await tokenManager.getUserEmail();
        expect(email).toBeNull();
    });
    
    it('should handle token without email field', async () => {
        // 模拟token中没有email字段
        const email = await tokenManager.getUserEmail();
        expect(email).toBeNull();
    });
});
```

---

## WorkspaceHelper (新增工具类)

### 类定义

**文件位置**: `src/utils/workspaceHelper.ts`

**用途**: 提供工作区相关的辅助方法

**完整实现**:

```typescript
import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * 工作区辅助工具类
 * 提供获取工作区信息的便捷方法
 */
export class WorkspaceHelper {
    /**
     * 获取当前工作区名称
     * @returns 工作区名称,如果没有工作区则返回null
     */
    static getCurrentWorkspaceName(): string | null {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            if (!workspaceFolders || workspaceFolders.length === 0) {
                Logger.debug('No workspace folder found');
                return null;
            }
            
            // 使用第一个工作区文件夹的名称
            const workspaceName = workspaceFolders[0].name;
            Logger.debug(`Current workspace name: ${workspaceName}`);
            
            return workspaceName;
        } catch (error) {
            Logger.error('Failed to get workspace name', error as Error);
            return null;
        }
    }
    
    /**
     * 获取当前工作区完整路径
     * @returns 工作区路径,如果没有工作区则返回null
     */
    static getCurrentWorkspacePath(): string | null {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return null;
            }
            
            return workspaceFolders[0].uri.fsPath;
        } catch (error) {
            Logger.error('Failed to get workspace path', error as Error);
            return null;
        }
    }
    
    /**
     * 获取所有工作区文件夹名称
     * @returns 工作区名称数组,如果没有工作区则返回空数组
     */
    static getAllWorkspaceNames(): string[] {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return [];
            }
            
            return workspaceFolders.map(folder => folder.name);
        } catch (error) {
            Logger.error('Failed to get workspace names', error as Error);
            return [];
        }
    }
}
```

**测试用例**:

```typescript
describe('WorkspaceHelper', () => {
    describe('getCurrentWorkspaceName', () => {
        it('should return workspace name when workspace is open', () => {
            // 模拟打开工作区
            const name = WorkspaceHelper.getCurrentWorkspaceName();
            expect(name).toBe('cursor-helper');
        });
        
        it('should return null when no workspace is open', () => {
            // 模拟没有工作区
            const name = WorkspaceHelper.getCurrentWorkspaceName();
            expect(name).toBeNull();
        });
        
        it('should return first workspace name in multi-root workspace', () => {
            // 模拟多根工作区
            const name = WorkspaceHelper.getCurrentWorkspaceName();
            expect(name).toBe('first-workspace');
        });
    });
    
    describe('getCurrentWorkspacePath', () => {
        it('should return workspace path when workspace is open', () => {
            const path = WorkspaceHelper.getCurrentWorkspacePath();
            expect(path).toContain('cursor-helper');
        });
        
        it('should return null when no workspace is open', () => {
            const path = WorkspaceHelper.getCurrentWorkspacePath();
            expect(path).toBeNull();
        });
    });
    
    describe('getAllWorkspaceNames', () => {
        it('should return all workspace names', () => {
            const names = WorkspaceHelper.getAllWorkspaceNames();
            expect(names).toEqual(['workspace1', 'workspace2']);
        });
        
        it('should return empty array when no workspace is open', () => {
            const names = WorkspaceHelper.getAllWorkspaceNames();
            expect(names).toEqual([]);
        });
    });
});
```

---

## UploadFormPanel 扩展

### getAutoFillData()

**用途**: 获取自动填充数据(邮箱和项目名称)

**签名**:

```typescript
class UploadFormPanel {
    /**
     * 获取自动填充数据
     * @returns 包含邮箱和项目名称的对象
     */
    private async getAutoFillData(): Promise<AutoFillData>;
}
```

**实现逻辑**:

```typescript
private async getAutoFillData(): Promise<AutoFillData> {
    let email: string | null = null;
    let projectName: string | null = null;
    
    // 安全地获取用户邮箱
    try {
        const token = await this.authService.getToken();
        if (token) {
            email = this.extractEmailFromToken(token);
        }
    } catch (error) {
        Logger.warn('Failed to get user email for auto-fill', error as Error);
        // 静默失败,不影响表单显示
    }
    
    // 安全地获取项目名称
    try {
        projectName = WorkspaceHelper.getCurrentWorkspaceName();
    } catch (error) {
        Logger.warn('Failed to get workspace name for auto-fill', error as Error);
        // 静默失败,不影响表单显示
    }
    
    Logger.info(`Auto-fill data: email=${email ? 'present' : 'null'}, projectName=${projectName ? 'present' : 'null'}`);
    
    return { email, projectName };
}
```

**返回值**:

```typescript
interface AutoFillData {
    email: string | null;
    projectName: string | null;
}
```

**错误处理**:
- 所有异常都被捕获,不抛出
- 失败时返回null值
- 记录警告日志

---

### extractEmailFromToken()

**用途**: 从JWT token中提取邮箱(私有方法)

**签名**:

```typescript
class UploadFormPanel {
    /**
     * 从JWT token中提取邮箱
     * @param token JWT token字符串
     * @returns 邮箱地址,如果提取失败则返回null
     */
    private extractEmailFromToken(token: string): string | null;
}
```

**实现**: 与TokenManager中的实现相同(或调用TokenManager的方法)

**建议**: 将此方法移到TokenManager中,避免重复代码

---

### showForm() 修改

**原有签名**:

```typescript
async showForm(composerId: string, initialData?: Partial<UploadFormData>): Promise<void>
```

**修改内容**: 在发送 `initForm` 消息时包含自动填充数据

**修改后的实现**:

```typescript
async showForm(composerId: string, initialData?: Partial<UploadFormData>): Promise<void> {
    if (!this.panel) {
        this.createPanel();
    }
    
    try {
        let content = initialData?.content || '';
        
        // 加载会话内容
        if (composerId && composerId.trim().length > 0) {
            try {
                content = await this.loadSessionContent(
                    composerId, 
                    initialData?.content_format || ContentFormat.MARKDOWN
                );
            } catch (error) {
                Logger.error(`Failed to load session content for ${composerId}`, error as Error);
                vscode.window.showErrorMessage(`加载会话内容失败: ${(error as Error).message}`);
                content = '';
            }
        }
        
        // 获取自动填充数据
        const autoFillData = await this.getAutoFillData();
        
        // 准备表单数据
        const formData = {
            uploader_email: initialData?.uploader_email || autoFillData.email || undefined,
            project_name: initialData?.project_name || autoFillData.projectName || undefined,
            content: content,
            content_format: initialData?.content_format || ContentFormat.MARKDOWN,
            upload_time: initialData?.upload_time || new Date().toISOString()
        };
        
        // 发送初始化消息到Webview
        this.panel?.webview.postMessage({
            type: 'initForm',
            data: formData
        });
        
        this.panel.reveal();
    } catch (error) {
        Logger.error('Failed to show upload form', error as Error);
        vscode.window.showErrorMessage('无法显示上传表单');
    }
}
```

**关键变更**:
1. 调用 `getAutoFillData()` 获取自动填充数据
2. 将自动填充数据合并到formData中
3. initialData优先级高于自动填充(允许覆盖)

---

### handleRequestAutoFill()

**用途**: 处理Webview的自动填充请求(新增方法)

**签名**:

```typescript
class UploadFormPanel {
    /**
     * 处理自动填充请求
     * 响应Webview的requestAutoFill消息
     */
    private async handleRequestAutoFill(): Promise<void>;
}
```

**实现**:

```typescript
private async handleRequestAutoFill(): Promise<void> {
    try {
        const autoFillData = await this.getAutoFillData();
        
        this.panel?.webview.postMessage({
            type: 'autoFillData',
            data: autoFillData
        });
    } catch (error) {
        Logger.error('Failed to handle auto-fill request', error as Error);
        // 静默失败,不显示错误给用户
    }
}
```

**调用位置**: 在 `createPanel()` 的消息处理器中添加:

```typescript
this.panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.type) {
        // ... 现有的case ...
        
        case 'requestAutoFill':
            await this.handleRequestAutoFill();
            break;
    }
});
```

---

## 类型定义

### AutoFillData

**文件位置**: `src/models/uploadRecord.ts`

**定义**:

```typescript
/**
 * 自动填充数据接口
 */
export interface AutoFillData {
    /**
     * 用户邮箱地址
     * - 从JWT token中提取
     * - 如果token不存在或解析失败,则为null
     */
    email: string | null;
    
    /**
     * 项目名称
     * - 从当前工作区获取
     * - 如果没有打开工作区,则为null
     */
    projectName: string | null;
}
```

---

## API依赖关系图

```
UploadFormPanel
    │
    ├─> getAutoFillData()
    │       │
    │       ├─> AuthService.getToken()
    │       │       │
    │       │       └─> TokenManager.getToken()
    │       │
    │       ├─> extractEmailFromToken()
    │       │       │
    │       │       └─> JWT解析逻辑
    │       │
    │       └─> WorkspaceHelper.getCurrentWorkspaceName()
    │               │
    │               └─> vscode.workspace.workspaceFolders
    │
    ├─> showForm()
    │       │
    │       ├─> getAutoFillData()
    │       └─> panel.webview.postMessage()
    │
    └─> handleRequestAutoFill()
            │
            ├─> getAutoFillData()
            └─> panel.webview.postMessage()
```

---

## 性能考虑

| API | 复杂度 | 预计耗时 | 缓存策略 |
|-----|--------|---------|---------|
| getUserEmail() | O(1) | < 1ms | 不缓存(按需获取) |
| getCurrentWorkspaceName() | O(1) | < 1ms | 不缓存(实时获取) |
| getAutoFillData() | O(1) | < 5ms | 不缓存(组合调用) |
| extractEmailFromToken() | O(1) | < 1ms | 不缓存(计算简单) |

**结论**: 所有API都是轻量级操作,无需缓存,按需调用即可。

---

## 安全考虑

### Token处理

- ✅ JWT token仅在Extension Host端处理
- ✅ 不将完整token传递给Webview
- ✅ 仅提取必要的邮箱信息
- ✅ 所有异常都被捕获,不泄露敏感信息

### 数据验证

- ✅ 邮箱格式在前端验证(HTML5 type="email")
- ✅ 项目名称长度在前端和后端都验证
- ✅ 所有用户输入都经过现有的验证逻辑

---

## 实施检查清单

### TokenManager
- [ ] 添加 `getUserEmail()` 方法
- [ ] 添加 `extractEmailFromToken()` 私有方法
- [ ] 添加单元测试

### WorkspaceHelper
- [ ] 创建新文件 `src/utils/workspaceHelper.ts`
- [ ] 实现 `getCurrentWorkspaceName()` 方法
- [ ] 实现 `getCurrentWorkspacePath()` 方法
- [ ] 实现 `getAllWorkspaceNames()` 方法
- [ ] 添加单元测试

### UploadFormPanel
- [ ] 添加 `getAutoFillData()` 私有方法
- [ ] 修改 `showForm()` 方法
- [ ] 添加 `handleRequestAutoFill()` 私有方法
- [ ] 在消息处理器中添加 `requestAutoFill` case
- [ ] 添加集成测试

### 类型定义
- [ ] 在 `uploadRecord.ts` 中添加 `AutoFillData` 接口
- [ ] 导出新接口供其他模块使用

---

## 变更日志

### Version 1.0.0 (2026-01-14)

- 初始版本
- 定义TokenManager扩展API
- 定义WorkspaceHelper工具类
- 定义UploadFormPanel扩展API
- 定义AutoFillData类型
