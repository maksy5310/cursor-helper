# Upload Form UI Interface Contract

**Date**: 2025-12-15  
**Component**: Upload Form Panel (Webview)

## Overview

Upload Form Panel 是一个 Webview 面板，提供上传表单 UI，允许用户填写表单信息、编辑和预览会话内容，并上传到分享平台。表单在用户点击侧边面板会话列表中的会话项时自动打开，并加载该会话的内容。

## Interface Definition

### IUploadFormPanel

```typescript
interface IUploadFormPanel {
  /**
   * 创建并显示上传表单面板
   * @param context VS Code Extension Context
   */
  createPanel(context: vscode.ExtensionContext): void;

  /**
   * 显示上传表单
   * @param composerId 会话ID（composerId），用于从数据库加载会话内容
   * @param initialData 初始表单数据（可选）
   */
  showForm(composerId: string, initialData?: Partial<UploadFormData>): void;

  /**
   * 关闭面板
   */
  dispose(): void;

  /**
   * 处理表单提交
   * @param formData 表单数据
   */
  handleSubmit(formData: UploadFormData): Promise<void>;

  /**
   * 从数据库加载会话内容
   * @param composerId 会话ID
   * @param format 内容格式（可选，默认'markdown'）
   */
  loadSessionContent(composerId: string, format?: ContentFormat): Promise<string>;
}
```

## UI Components

### 1. 表单字段

- **项目名称** (`project_name`)
  - 类型：文本输入框
  - 必填：是
  - 验证：1-255字符
  - 占位符："请输入项目名称"

- **上传人邮箱** (`uploader_email`)
  - 类型：文本输入框
  - 必填：是
  - 验证：有效邮箱格式
  - 占位符："user@example.com"

- **上传时间** (`upload_time`)
  - 类型：日期时间选择器或文本输入框
  - 必填：是
  - 验证：ISO 8601格式，不能是未来时间
  - 默认值：当前时间

- **内容格式** (`content_format`)
  - 类型：下拉选择框
  - 必填：否（有默认值）
  - 选项：markdown, text, json, html
  - 默认值：markdown

- **内容** (`content`)
  - 类型：多行文本区域（可编辑）
  - 必填：是
  - 验证：最大10MB
  - 说明：从数据库加载的会话内容，用户可以在表单内编辑
  - 编辑器：使用 `<textarea>` 提供基本编辑功能，支持预览按钮

### 2. 内容编辑器

- **编辑器类型**：`<textarea>` 多行文本编辑器
- **功能**：
  - 支持基本的文本编辑（输入、删除、复制、粘贴）
  - 显示行号（可选）
  - 支持滚动查看长内容
- **预览功能**：
  - 预览按钮：点击后在 Webview 中显示 Markdown 预览
  - 预览区域：在同一 Webview 中显示渲染后的内容
  - 切换视图：在编辑和预览之间切换
- **备选方案**：如果内嵌编辑器无法实现，提供"打开编辑器"按钮
  - 点击后使用 `vscode.window.showTextDocument()` 打开临时文档
  - 用户编辑完成后，将内容同步回表单

### 3. 操作按钮

- **预览**：切换内容预览视图（仅当内容格式为 markdown 时可用）
- **打开编辑器**：打开独立编辑器窗口（备选方案）
- **上传**：提交表单，上传记录
- **取消**：关闭面板
- **配置**：打开配置对话框（JWT Token、API URL）

### 4. 状态显示

- **加载状态**：显示上传进度（使用 VS Code 的 `withProgress`）
- **错误消息**：显示验证错误或上传错误
- **成功消息**：显示上传成功消息

## Form Validation

### 客户端验证

- **实时验证**：用户输入时实时验证字段
- **提交验证**：提交前验证所有字段
- **错误显示**：在字段下方显示错误消息

### 验证规则

- **项目名称**：
  - 必填检查
  - 长度检查（1-255字符）
- **邮箱**：
  - 必填检查
  - 格式检查（正则表达式）
- **时间**：
  - 必填检查
  - 格式检查（ISO 8601）
  - 未来时间检查
- **内容**：
  - 必填检查
  - 大小检查（最大10MB）

## Session Content Loading

### 会话内容加载流程

1. 用户点击侧边面板会话列表中的会话项
2. 触发上传表单显示，传入 `composerId`
3. 调用 `loadSessionContent(composerId, format)` 从数据库加载会话内容
4. 使用 `DatabaseAccess.getAgentRecords(composerId)` 获取会话数据
5. 将会话数据转换为选择的内容格式（json, markdown, text, html）
6. 填充到内容字段（可编辑）

### 内容格式转换

- **json**: 直接使用 JSON 字符串（`JSON.stringify(agentRecord)`）
- **markdown**: 使用现有的 Markdown 渲染逻辑（复用 002-session-markdown-view 的 `MarkdownRenderer`）
- **text**: 提取纯文本，去除格式标记
- **html**: 转换为 HTML 格式（基本实现，使用简单的 HTML 标签）

## Error Handling

### 验证错误

- 在字段下方显示错误消息
- 阻止表单提交
- 高亮错误字段

### 上传错误

- 显示错误对话框
- 根据错误类型显示不同的错误消息
- 提供重试选项（对于可重试的错误）

## Webview Implementation

### HTML Structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>上传记录</title>
</head>
<body>
  <form id="uploadForm">
    <div class="field">
      <label>项目名称 *</label>
      <input type="text" id="project_name" required>
      <span class="error" id="project_name_error"></span>
    </div>
    <!-- 其他字段 -->
    <div class="field">
      <label>内容 *</label>
      <div class="content-editor">
        <textarea id="content" rows="20" required></textarea>
        <div class="editor-actions">
          <button type="button" id="preview">预览</button>
          <button type="button" id="openEditor">打开编辑器</button>
        </div>
        <div class="preview-area" id="previewArea" style="display: none;"></div>
      </div>
      <span class="error" id="content_error"></span>
    </div>
    <div class="actions">
      <button type="submit" id="upload">上传</button>
      <button type="button" id="cancel">取消</button>
      <button type="button" id="configure">配置</button>
    </div>
  </form>
</body>
</html>
```

### Message Passing

- **Extension → Webview**: 使用 `webview.postMessage()`
- **Webview → Extension**: 使用 `vscode.postMessage()`

### Message Types

```typescript
interface WebviewMessage {
  type: 'fileSelected' | 'formSubmit' | 'cancel' | 'configure';
  data?: any;
}

interface ExtensionMessage {
  type: 'fileList' | 'validationError' | 'uploadSuccess' | 'uploadError';
  data?: any;
}
```

## Usage Example

```typescript
const panel = new UploadFormPanel(context);
panel.createPanel(context);
panel.showForm();

// 处理文件选择
panel.handleFileSelect(filePath).then(() => {
  // 文件已加载，表单已更新
});

// 处理表单提交
panel.handleSubmit(formData).then(() => {
  // 上传成功
}).catch((error) => {
  // 上传失败，显示错误
});
```

## Performance Requirements

- 表单验证错误提示 ≤ 1 秒（SC-003）
- 文件加载时间：取决于文件大小，通常 < 1 秒
- 表单渲染时间：< 500ms

## Accessibility Requirements

- 所有表单字段都有标签
- 错误消息清晰明确
- 支持键盘导航
- 支持屏幕阅读器

