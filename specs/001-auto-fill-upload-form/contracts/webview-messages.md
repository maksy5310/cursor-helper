# Webview Message Contracts

**Feature**: 001-auto-fill-upload-form  
**Date**: 2026-01-14  
**Version**: 1.0.0

## 概述

本文档定义Extension Host与Webview之间的消息通信协议。所有消息通过VS Code的postMessage API传递。

---

## 消息格式规范

### 通用消息结构

所有消息都遵循以下基本结构:

```typescript
interface Message<T = any> {
    type: string;      // 消息类型标识符
    data?: T;          // 消息数据(可选)
}
```

---

## Extension Host → Webview 消息

### 1. initForm

**用途**: 初始化表单,传递自动填充数据和会话内容

**时机**: 调用 `showForm()` 方法时

**消息结构**:

```typescript
interface InitFormMessage {
    type: 'initForm';
    data: {
        /**
         * 自动填充的邮箱地址
         * - 从JWT token提取
         * - 如果未登录或提取失败,则为undefined
         */
        uploader_email?: string;
        
        /**
         * 自动填充的项目名称
         * - 从当前工作区获取
         * - 如果没有工作区,则为undefined
         */
        project_name?: string;
        
        /**
         * 会话内容
         * - 从数据库加载
         */
        content?: string;
        
        /**
         * 内容格式
         * - 默认为 'markdown'
         */
        content_format?: 'markdown' | 'text' | 'json' | 'html';
        
        /**
         * 上传时间
         * - ISO 8601格式
         * - 默认为当前时间
         */
        upload_time?: string;
    };
}
```

**示例**:

```json
{
    "type": "initForm",
    "data": {
        "uploader_email": "user@example.com",
        "project_name": "cursor-helper",
        "content": "# Session Content\n\n...",
        "content_format": "markdown",
        "upload_time": "2026-01-14T11:30:00.000Z"
    }
}
```

**错误处理**:
- 如果 `uploader_email` 为undefined,邮箱字段保持为空
- 如果 `project_name` 为undefined,项目名称字段保持为空
- Webview应优雅处理缺失字段

---

### 2. autoFillData

**用途**: 响应Webview的自动填充请求(如表单重置)

**时机**: 收到 `requestAutoFill` 消息后

**消息结构**:

```typescript
interface AutoFillDataMessage {
    type: 'autoFillData';
    data: {
        /**
         * 用户邮箱地址
         * - null表示无法获取(未登录或提取失败)
         */
        email: string | null;
        
        /**
         * 项目名称
         * - null表示没有打开工作区
         */
        projectName: string | null;
    };
}
```

**示例**:

```json
{
    "type": "autoFillData",
    "data": {
        "email": "user@example.com",
        "projectName": "cursor-helper"
    }
}
```

**错误处理**:
- `email` 或 `projectName` 为null时,对应字段保持为空或清空

---

### 3. contentResponse

**用途**: 响应内容获取请求(现有消息,无需修改)

**时机**: 收到 `getContent` 消息后

**消息结构**:

```typescript
interface ContentResponseMessage {
    type: 'contentResponse';
    data: {
        content: string;
    };
}
```

---

## Webview → Extension Host 消息

### 1. requestAutoFill

**用途**: 请求重新获取自动填充数据

**时机**: 
- 用户点击表单重置按钮
- 用户手动触发刷新(如果实现)

**消息结构**:

```typescript
interface RequestAutoFillMessage {
    type: 'requestAutoFill';
}
```

**示例**:

```json
{
    "type": "requestAutoFill"
}
```

**响应**: Extension Host发送 `autoFillData` 消息

---

### 2. submit

**用途**: 提交表单数据(现有消息,无需修改)

**时机**: 用户点击上传按钮

**消息结构**:

```typescript
interface SubmitMessage {
    type: 'submit';
    data: {
        project_name: string;
        uploader_email: string;
        upload_time: string;
        content: string;
        content_format: 'markdown' | 'text' | 'json' | 'html';
    };
}
```

---

### 3. cancel

**用途**: 取消并关闭表单(现有消息,无需修改)

**时机**: 用户点击取消按钮

**消息结构**:

```typescript
interface CancelMessage {
    type: 'cancel';
}
```

---

### 4. 其他现有消息

以下消息保持不变:
- `selectFile`: 选择文件
- `reloadContent`: 重新加载内容
- `openEditor`: 打开编辑器
- `previewMarkdown`: 预览Markdown
- `configure`: 打开配置
- `getContent`: 获取内容

---

## 消息序列图

### 场景1: 表单初始化(带自动填充)

```
User                Extension Host              Webview
 |                         |                       |
 |--打开上传表单---------->|                       |
 |                         |                       |
 |                         |--获取Token----------->|
 |                         |<--Token---------------|
 |                         |                       |
 |                         |--解析邮箱------------>|
 |                         |                       |
 |                         |--获取工作区名称----->|
 |                         |                       |
 |                         |--加载会话内容------->|
 |                         |                       |
 |                         |--initForm------------>|
 |                         |  {                    |
 |                         |    uploader_email,    |
 |                         |    project_name,      |
 |                         |    content            |
 |                         |  }                    |
 |                         |                       |
 |                         |                       |--填充表单字段
 |                         |                       |
 |<------------------------表单已就绪--------------|
```

### 场景2: 表单重置

```
User                Extension Host              Webview
 |                         |                       |
 |--点击重置按钮---------->|                       |
 |                         |                       |
 |                         |<--requestAutoFill-----|
 |                         |                       |
 |                         |--获取自动填充数据--->|
 |                         |                       |
 |                         |--autoFillData-------->|
 |                         |  {                    |
 |                         |    email,             |
 |                         |    projectName        |
 |                         |  }                    |
 |                         |                       |
 |                         |                       |--重新填充字段
 |                         |                       |
 |<------------------------表单已重置--------------|
```

### 场景3: 自动填充失败(降级处理)

```
User                Extension Host              Webview
 |                         |                       |
 |--打开上传表单---------->|                       |
 |                         |                       |
 |                         |--获取Token----------->|
 |                         |<--null(未登录)--------|
 |                         |                       |
 |                         |--获取工作区名称----->|
 |                         |<--null(无工作区)-----|
 |                         |                       |
 |                         |--initForm------------>|
 |                         |  {                    |
 |                         |    // 无邮箱和项目名  |
 |                         |    content            |
 |                         |  }                    |
 |                         |                       |
 |                         |                       |--显示空字段
 |                         |                       |--显示placeholder
 |                         |                       |
 |<------------------------表单已就绪(需手动输入)--|
```

---

## 错误处理

### Extension Host端

| 错误场景 | 处理方式 | 发送的消息 |
|---------|---------|-----------|
| Token获取失败 | 记录日志,继续执行 | initForm(uploader_email: undefined) |
| Token解析失败 | 记录日志,继续执行 | initForm(uploader_email: undefined) |
| 工作区获取失败 | 记录日志,继续执行 | initForm(project_name: undefined) |
| 会话内容加载失败 | 显示错误提示,继续显示表单 | initForm(content: '') |

### Webview端

| 错误场景 | 处理方式 |
|---------|---------|
| 收到undefined字段 | 字段保持为空,显示placeholder |
| 收到null值 | 清空字段,显示placeholder |
| 消息格式错误 | 记录控制台错误,忽略消息 |
| 未知消息类型 | 记录控制台警告,忽略消息 |

---

## 版本兼容性

### 向后兼容

- 新增的 `requestAutoFill` 消息不影响现有功能
- `initForm` 消息的新字段是可选的,旧版Webview可以忽略
- 所有现有消息保持不变

### 向前兼容

- 未来可以在 `autoFillData` 中添加更多字段
- 建议使用可选字段,避免破坏性变更

---

## 测试用例

### 单元测试

```typescript
describe('Webview Message Contracts', () => {
    describe('initForm message', () => {
        it('should include auto-fill data when available', () => {
            const message: InitFormMessage = {
                type: 'initForm',
                data: {
                    uploader_email: 'test@example.com',
                    project_name: 'test-project',
                    content: 'test content'
                }
            };
            expect(message.data.uploader_email).toBe('test@example.com');
            expect(message.data.project_name).toBe('test-project');
        });
        
        it('should handle missing auto-fill data', () => {
            const message: InitFormMessage = {
                type: 'initForm',
                data: {
                    content: 'test content'
                }
            };
            expect(message.data.uploader_email).toBeUndefined();
            expect(message.data.project_name).toBeUndefined();
        });
    });
    
    describe('requestAutoFill message', () => {
        it('should have correct type', () => {
            const message: RequestAutoFillMessage = {
                type: 'requestAutoFill'
            };
            expect(message.type).toBe('requestAutoFill');
        });
    });
    
    describe('autoFillData message', () => {
        it('should handle null values', () => {
            const message: AutoFillDataMessage = {
                type: 'autoFillData',
                data: {
                    email: null,
                    projectName: null
                }
            };
            expect(message.data.email).toBeNull();
            expect(message.data.projectName).toBeNull();
        });
    });
});
```

### 集成测试

```typescript
describe('Auto-fill Integration', () => {
    it('should send initForm with auto-fill data on form open', async () => {
        // 模拟有token和工作区的场景
        const panel = new UploadFormPanel(context, null, databaseAccess);
        
        // 监听postMessage
        const messages: any[] = [];
        panel.panel.webview.postMessage = (msg: any) => {
            messages.push(msg);
        };
        
        await panel.showForm('test-composer-id');
        
        // 验证发送了initForm消息
        expect(messages).toContainEqual(
            expect.objectContaining({
                type: 'initForm',
                data: expect.objectContaining({
                    uploader_email: expect.any(String),
                    project_name: expect.any(String)
                })
            })
        );
    });
    
    it('should respond to requestAutoFill message', async () => {
        // 测试表单重置场景
        // ...
    });
});
```

---

## 安全考虑

### 数据验证

- **Extension Host端**: 
  - 验证从token提取的邮箱格式
  - 验证工作区名称长度
  - 不传递敏感信息(如完整token)

- **Webview端**:
  - 验证接收到的数据类型
  - 使用HTML5表单验证
  - 防止XSS攻击(不直接执行接收的脚本)

### 数据隐私

- JWT token仅在Extension Host端处理,不传递给Webview
- 邮箱地址仅用于表单填充,不存储或传输到外部
- 工作区名称是公开信息,无隐私风险

---

## 实施检查清单

- [ ] 在 `uploadFormPanel.ts` 中实现 `getAutoFillData()` 方法
- [ ] 修改 `showForm()` 方法,发送 `initForm` 消息时包含自动填充数据
- [ ] 在Webview的消息处理器中添加 `requestAutoFill` 处理
- [ ] 在Webview的消息处理器中添加 `autoFillData` 处理
- [ ] 在表单重置事件中发送 `requestAutoFill` 消息
- [ ] 添加单元测试覆盖所有消息类型
- [ ] 添加集成测试验证完整流程
- [ ] 更新类型定义文件

---

## 变更日志

### Version 1.0.0 (2026-01-14)

- 初始版本
- 定义 `initForm`, `autoFillData`, `requestAutoFill` 消息
- 建立消息通信协议
