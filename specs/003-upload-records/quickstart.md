# Quick Start Guide: 记录上传到分享平台

**Date**: 2025-12-15  
**Feature**: 记录上传到分享平台

## Overview

本指南帮助开发者快速实现记录上传功能。该功能允许用户将本地保存的 Agent 使用记录上传到分享平台，包括选择记录文件、填写表单信息、配置 JWT Token 和上传记录。

## Prerequisites

- 已完成 001-cursor-assistant 功能的实现
- 本地存储的 Agent 记录文件已存在（`./cursor-helper` 目录）
- 分享平台 API 服务已部署并可用
- 已获得有效的 JWT Token 用于认证

## Implementation Steps

### Step 1: 创建上传服务

创建 `src/services/uploadService.ts`:

```typescript
import { UploadRecord, UploadConfig, UploadResponse, UploadError } from '../models/uploadRecord';
import { Logger } from '../utils/logger';

export class UploadService {
    private readonly TIMEOUT = 30000; // 30秒
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAYS = [1000, 2000, 4000]; // 指数退避

    async uploadRecord(record: UploadRecord, config: UploadConfig): Promise<UploadResponse> {
        const url = `${config.api_url}/records`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.jwt_token}`
        };

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                const response = await this.fetchWithTimeout(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(record)
                });

                if (!response.ok) {
                    const error = await this.parseErrorResponse(response);
                    throw error;
                }

                const data = await response.json();
                return data as UploadResponse;
            } catch (error) {
                lastError = error as Error;
                
                // 对于用户错误，不重试
                if (this.isUserError(error)) {
                    throw error;
                }

                // 对于可重试的错误，等待后重试
                if (attempt < this.MAX_RETRIES) {
                    const delay = this.RETRY_DELAYS[attempt];
                    Logger.info(`Upload failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${this.MAX_RETRIES})`);
                    await this.sleep(delay);
                }
            }
        }

        throw lastError || new Error('Upload failed after retries');
    }

    private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async parseErrorResponse(response: Response): Promise<UploadError> {
        const data = await response.json();
        const error = data.error || {};

        switch (response.status) {
            case 400:
                return new ValidationError(error.message, error.details);
            case 401:
                return new AuthenticationError(error.message);
            case 413:
                return new PayloadTooLargeError(error.message);
            case 500:
                return new ServerError(error.message);
            default:
                return new UploadError('UNKNOWN_ERROR', error.message || 'Unknown error');
        }
    }

    private isUserError(error: any): boolean {
        return error instanceof ValidationError ||
               error instanceof AuthenticationError ||
               error instanceof PayloadTooLargeError;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async validateToken(token: string): Promise<boolean> {
        // 简单的 JWT Token 验证（检查格式和过期时间）
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return false;
            }

            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            const exp = payload.exp;
            if (exp && exp * 1000 < Date.now()) {
                return false; // Token 已过期
            }

            return true;
        } catch {
            return false;
        }
    }

    async testConnection(config: UploadConfig): Promise<boolean> {
        try {
            const response = await this.fetchWithTimeout(`${config.api_url}/health`, {
                method: 'GET'
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
```

### Step 2: 创建上传表单面板

创建 `src/ui/uploadFormPanel.ts`:

```typescript
import * as vscode from 'vscode';
import { UploadFormData, UploadRecord, UploadConfig } from '../models/uploadRecord';
import { UploadService } from '../services/uploadService';
import { StorageManager } from '../storageManager';
import { Logger } from '../utils/logger';

export class UploadFormPanel {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private uploadService: UploadService;
    private storageManager: StorageManager;

    constructor(context: vscode.ExtensionContext, storageManager: StorageManager) {
        this.context = context;
        this.storageManager = storageManager;
        this.uploadService = new UploadService();
    }

    createPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            'uploadForm',
            '上传记录',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // 处理来自 Webview 的消息
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'selectFile':
                    await this.handleFileSelect();
                    break;
                case 'submit':
                    await this.handleSubmit(message.data);
                    break;
                case 'cancel':
                    this.panel?.dispose();
                    break;
            }
        });
    }

    private async handleFileSelect(): Promise<void> {
        // 扫描本地存储目录
        const files = await this.scanLocalRecordFiles();
        
        // 使用 QuickPick 显示文件列表
        const selected = await vscode.window.showQuickPick(
            files.map(f => ({
                label: f.file_name,
                description: f.date,
                detail: f.file_path
            })),
            {
                placeHolder: '选择要上传的记录文件',
                canPickMany: false
            }
        );

        if (selected) {
            // 加载文件内容
            const content = await this.loadFileContent(selected.detail!);
            
            // 发送到 Webview
            this.panel?.webview.postMessage({
                type: 'fileLoaded',
                data: { content, filePath: selected.detail }
            });
        }
    }

    private async handleSubmit(formData: UploadFormData): Promise<void> {
        // 验证表单数据
        const errors = this.validateFormData(formData);
        if (errors) {
            this.panel?.webview.postMessage({
                type: 'validationError',
                data: errors
            });
            return;
        }

        // 获取配置
        const config = await this.getUploadConfig();
        if (!config.jwt_token) {
            vscode.window.showErrorMessage('请先配置 JWT Token');
            return;
        }

        // 转换为上传记录
        const record: UploadRecord = {
            project_name: formData.project_name,
            uploader_email: formData.uploader_email,
            upload_time: formData.upload_time,
            content_format: formData.content_format,
            content: formData.content
        };

        // 上传记录
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '上传记录',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: '正在上传...' });
                
                const response = await this.uploadService.uploadRecord(record, config);
                
                progress.report({ increment: 100, message: '上传成功' });
                
                vscode.window.showInformationMessage(`记录上传成功！ID: ${response.data.id}`);
                this.panel?.dispose();
            });
        } catch (error) {
            Logger.error('Upload failed', error as Error);
            
            if (error instanceof AuthenticationError) {
                vscode.window.showErrorMessage('认证失败，请更新 JWT Token');
            } else if (error instanceof ValidationError) {
                vscode.window.showErrorMessage(`验证失败: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`上传失败: ${error.message}`);
            }
        }
    }

    private validateFormData(formData: UploadFormData): ValidationErrors | null {
        const errors: ValidationErrors = {};

        // 验证项目名称
        if (!formData.project_name || formData.project_name.length < 1 || formData.project_name.length > 255) {
            errors.project_name = '项目名称必须为1-255字符';
        }

        // 验证邮箱
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.uploader_email || !emailRegex.test(formData.uploader_email)) {
            errors.uploader_email = '请输入有效的邮箱地址';
        }

        // 验证时间
        const time = new Date(formData.upload_time);
        if (isNaN(time.getTime())) {
            errors.upload_time = '请输入有效的时间格式（ISO 8601）';
        } else if (time > new Date()) {
            errors.upload_time = '时间不能是未来时间';
        }

        // 验证内容
        if (!formData.content) {
            errors.content = '内容不能为空';
        } else if (new Blob([formData.content]).size > 10 * 1024 * 1024) {
            errors.content = '内容大小不能超过10MB';
        }

        return Object.keys(errors).length > 0 ? errors : null;
    }

    private async getUploadConfig(): Promise<UploadConfig> {
        const jwtToken = this.context.globalState.get<string>('upload.jwt_token');
        const apiUrl = this.context.globalState.get<string>('upload.api_url') || 'http://localhost:8000/api/v1';

        return {
            jwt_token: jwtToken || '',
            api_url: apiUrl
        };
    }

    private async scanLocalRecordFiles(): Promise<LocalRecordFile[]> {
        // 实现文件扫描逻辑
        // 扫描 ./cursor-helper 目录下的所有 agent-*.json 文件
        // 返回文件列表
        return [];
    }

    private async loadFileContent(filePath: string): Promise<string> {
        // 实现文件加载逻辑
        // 读取文件内容，根据选择的格式转换
        return '';
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>上传记录</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        .field { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        input, select, textarea { width: 100%; padding: 5px; }
        .error { color: red; font-size: 12px; }
        .actions { margin-top: 20px; }
        button { padding: 10px 20px; margin-right: 10px; }
    </style>
</head>
<body>
    <form id="uploadForm">
        <div class="field">
            <label>项目名称 *</label>
            <input type="text" id="project_name" required>
            <span class="error" id="project_name_error"></span>
        </div>
        <div class="field">
            <label>上传人邮箱 *</label>
            <input type="email" id="uploader_email" required>
            <span class="error" id="uploader_email_error"></span>
        </div>
        <div class="field">
            <label>上传时间 *</label>
            <input type="datetime-local" id="upload_time" required>
            <span class="error" id="upload_time_error"></span>
        </div>
        <div class="field">
            <label>内容格式</label>
            <select id="content_format">
                <option value="markdown">Markdown</option>
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
            </select>
        </div>
        <div class="field">
            <label>内容 *</label>
            <textarea id="content" rows="10" readonly></textarea>
            <span class="error" id="content_error"></span>
        </div>
        <div class="actions">
            <button type="button" id="selectFile">选择文件</button>
            <button type="submit" id="upload">上传</button>
            <button type="button" id="cancel">取消</button>
        </div>
    </form>
    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('selectFile').addEventListener('click', () => {
            vscode.postMessage({ type: 'selectFile' });
        });
        
        document.getElementById('uploadForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = {
                project_name: document.getElementById('project_name').value,
                uploader_email: document.getElementById('uploader_email').value,
                upload_time: new Date(document.getElementById('upload_time').value).toISOString(),
                content_format: document.getElementById('content_format').value,
                content: document.getElementById('content').value
            };
            vscode.postMessage({ type: 'submit', data: formData });
        });
        
        document.getElementById('cancel').addEventListener('click', () => {
            vscode.postMessage({ type: 'cancel' });
        });
        
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'fileLoaded') {
                document.getElementById('content').value = message.data.content;
            } else if (message.type === 'validationError') {
                // 显示验证错误
                Object.keys(message.data).forEach(field => {
                    const errorElement = document.getElementById(field + '_error');
                    if (errorElement) {
                        errorElement.textContent = message.data[field];
                    }
                });
            }
        });
    </script>
</body>
</html>`;
    }

    dispose(): void {
        this.panel?.dispose();
    }
}
```

### Step 3: 创建上传记录命令

创建 `src/commands/uploadRecord.ts`:

```typescript
import * as vscode from 'vscode';
import { UploadFormPanel } from '../ui/uploadFormPanel';
import { StorageManager } from '../storageManager';

export async function uploadRecordCommand(
    context: vscode.ExtensionContext,
    storageManager: StorageManager
): Promise<void> {
    const panel = new UploadFormPanel(context, storageManager);
    panel.createPanel();
}
```

### Step 4: 创建配置命令

创建 `src/commands/configureUpload.ts`:

```typescript
import * as vscode from 'vscode';

export async function configureUploadCommand(context: vscode.ExtensionContext): Promise<void> {
    // 配置 JWT Token
    const jwtToken = await vscode.window.showInputBox({
        prompt: '请输入 JWT Token',
        password: true,
        placeHolder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    });

    if (jwtToken) {
        await context.globalState.update('upload.jwt_token', jwtToken);
        vscode.window.showInformationMessage('JWT Token 已保存');
    }

    // 配置 API URL
    const currentUrl = context.globalState.get<string>('upload.api_url') || 'http://localhost:8000/api/v1';
    const apiUrl = await vscode.window.showInputBox({
        prompt: '请输入 API URL',
        value: currentUrl,
        placeHolder: 'http://localhost:8000/api/v1'
    });

    if (apiUrl) {
        await context.globalState.update('upload.api_url', apiUrl);
        vscode.window.showInformationMessage('API URL 已保存');
    }
}
```

### Step 5: 注册命令

在 `src/extension.ts` 中注册命令:

```typescript
import { uploadRecordCommand } from './commands/uploadRecord';
import { configureUploadCommand } from './commands/configureUpload';

// 在 activate() 函数中：
const uploadCommand = vscode.commands.registerCommand(
    'cursor-assistant.uploadRecord',
    async () => {
        if (storageManager) {
            await uploadRecordCommand(context, storageManager);
        } else {
            vscode.window.showWarningMessage('存储管理器未初始化');
        }
    }
);
context.subscriptions.push(uploadCommand);

const configureCommand = vscode.commands.registerCommand(
    'cursor-assistant.configureUpload',
    async () => {
        await configureUploadCommand(context);
    }
);
context.subscriptions.push(configureCommand);
```

在 `package.json` 中添加命令定义:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "cursor-assistant.uploadRecord",
        "title": "上传记录",
        "category": "Cursor Assistant"
      },
      {
        "command": "cursor-assistant.configureUpload",
        "title": "配置上传",
        "category": "Cursor Assistant"
      }
    ]
  }
}
```

## Testing

### 单元测试

测试上传服务:

```typescript
import { UploadService } from '../services/uploadService';
import { UploadRecord, UploadConfig } from '../models/uploadRecord';

describe('UploadService', () => {
    it('should upload record successfully', async () => {
        const service = new UploadService();
        const record: UploadRecord = {
            project_name: 'test',
            uploader_email: 'test@example.com',
            upload_time: new Date().toISOString(),
            content_format: 'markdown',
            content: '# Test'
        };
        const config: UploadConfig = {
            jwt_token: 'test-token',
            api_url: 'http://localhost:8000/api/v1'
        };
        
        // Mock fetch
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { id: '123' }, message: 'Success' })
        });
        
        const response = await service.uploadRecord(record, config);
        expect(response.data.id).toBe('123');
    });
});
```

### 集成测试

1. 启动扩展调试
2. 执行"上传记录"命令
3. 选择本地记录文件
4. 填写表单信息
5. 点击上传
6. 验证上传是否成功

## Debugging

### 常见问题

1. **JWT Token 无效**
   - 检查 Token 格式是否正确
   - 检查 Token 是否过期
   - 使用"配置上传"命令更新 Token

2. **API 连接失败**
   - 检查 API URL 是否正确
   - 检查网络连接
   - 检查 API 服务是否运行

3. **文件选择失败**
   - 检查本地存储目录是否存在
   - 检查文件格式是否正确
   - 查看日志输出

4. **验证错误**
   - 检查表单字段是否填写完整
   - 检查字段格式是否正确
   - 检查内容大小是否超过限制

## Next Steps

- 实现完整的文件扫描和加载逻辑
- 实现内容格式转换（json, markdown, text, html）
- 添加上传历史记录功能
- 优化错误处理和用户体验
- 添加单元测试和集成测试

## References

- [VS Code Extension API - Webview](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Extension API - Commands](https://code.visualstudio.com/api/extension-guides/command)
- [Node.js fetch API](https://nodejs.org/api/globals.html#fetch)
- [JWT 规范](https://tools.ietf.org/html/rfc7519)

