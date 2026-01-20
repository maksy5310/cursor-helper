# 用户消息渲染格式示例

## 问题背景

之前使用 Markdown 引用语法（`>` 前缀）来标识用户消息，导致：
1. 与用户消息中的引用语法冲突
2. 前端渲染错误（嵌套引用）

## 新的渲染格式（T059）

使用 HTML `<div class="user-message">` 标签包裹用户消息。

### 示例 1：简单文本

**输入**：
```json
{
  "role": "user",
  "text": "请帮我实现一个待办列表功能"
}
```

**输出 Markdown**：
```markdown
<div class="user-message">

请帮我实现一个待办列表功能

</div>
```

**渲染效果**（带 CSS）：

<div class="user-message">

请帮我实现一个待办列表功能

</div>

---

### 示例 2：包含 Markdown 语法

**输入**：
```json
{
  "role": "user",
  "text": "我需要实现以下功能：\n\n1. 添加任务\n2. 删除任务\n3. 标记完成\n\n> 注意：需要支持优先级排序"
}
```

**输出 Markdown**：
```markdown
<div class="user-message">

我需要实现以下功能：

1. 添加任务
2. 删除任务
3. 标记完成

> 注意：需要支持优先级排序

</div>
```

**渲染效果**（带 CSS）：

<div class="user-message">

我需要实现以下功能：

1. 添加任务
2. 删除任务
3. 标记完成

> 注意：需要支持优先级排序

</div>

---

### 示例 3：包含代码块

**输入**：
```json
{
  "role": "user",
  "text": "这段代码有什么问题？\n\n```python\ndef hello():\n    print('Hello World')\n```"
}
```

**输出 Markdown**：
```markdown
<div class="user-message">

这段代码有什么问题？

```python
def hello():
    print('Hello World')
```

</div>
```

**渲染效果**（带 CSS）：

<div class="user-message">

这段代码有什么问题？

```python
def hello():
    print('Hello World')
```

</div>

---

## 前端 CSS 样式建议

```css
/* 用户消息容器 */
.user-message {
    background-color: #f0f4f8;
    border-left: 4px solid #4a90e2;
    padding: 12px 16px;
    margin: 8px 0;
    border-radius: 4px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

/* 移除第一个段落的上边距 */
.user-message > *:first-child {
    margin-top: 0;
}

/* 移除最后一个段落的下边距 */
.user-message > *:last-child {
    margin-bottom: 0;
}

/* 用户消息中的代码块样式 */
.user-message pre {
    background-color: #e8eef5;
    border: 1px solid #d0dae6;
}

/* 用户消息中的引用块样式 */
.user-message blockquote {
    border-left-color: #7ba3d1;
    background-color: #e8eef5;
}

/* 深色主题适配 */
@media (prefers-color-scheme: dark) {
    .user-message {
        background-color: #1e2936;
        border-left-color: #5a9fd4;
    }
    
    .user-message pre {
        background-color: #2a3441;
        border-color: #3a4451;
    }
    
    .user-message blockquote {
        border-left-color: #5a9fd4;
        background-color: #2a3441;
    }
}
```

---

## 与旧格式的对比

### 旧格式（使用 `>` 前缀）

```markdown
> 请帮我实现一个待办列表功能
```

**问题**：
- 如果用户消息包含引用，会产生嵌套引用
- 难以通过 CSS 精确控制样式
- 无法添加额外的元数据属性

### 新格式（使用 `<div>` 标签）

```markdown
<div class="user-message">

请帮我实现一个待办列表功能

</div>
```

**优势**：
- ✅ 避免语法冲突
- ✅ 样式控制灵活
- ✅ 可扩展性强（可添加 `data-*` 属性）
- ✅ 易于 JavaScript 操作

---

## 技术说明

### 为什么 `<div>` 前后需要空行？

Markdown 渲染器在处理内嵌 HTML 时，需要空行来区分 HTML 块和 Markdown 内容。

**错误示例**（无空行）：
```markdown
<div class="user-message">
这是一段文本
- 列表项 1
- 列表项 2
</div>
```

渲染结果：列表不会被识别为 Markdown 列表。

**正确示例**（有空行）：
```markdown
<div class="user-message">

这是一段文本
- 列表项 1
- 列表项 2

</div>
```

渲染结果：列表正确渲染为 Markdown 列表。

### 如何处理 HTML 特殊字符？

如果用户消息包含 HTML 特殊字符（`<`、`>`、`&`），有两种处理方式：

**方式 1：在后端转义**（不推荐）
```typescript
const escapedText = bubble.text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
fragments.push(`<div class="user-message">\n\n${escapedText}\n\n</div>`);
```

**方式 2：在前端处理**（推荐）
- 让 Markdown 渲染器自动处理 HTML 转义
- 大多数 Markdown 渲染器（如 `marked`、`markdown-it`）会自动转义 HTML 内容

---

## 扩展可能性

### 添加时间戳属性

```typescript
const timestamp = new Date(bubble.timestamp).toISOString();
fragments.push(`<div class="user-message" data-timestamp="${timestamp}">\n\n${bubble.text}\n\n</div>`);
```

### 添加用户 ID 属性

```typescript
const userId = bubble.userId || 'unknown';
fragments.push(`<div class="user-message" data-user-id="${userId}">\n\n${bubble.text}\n\n</div>`);
```

### 添加消息 ID 属性

```typescript
const messageId = bubble.bubbleId || bubble.messageId;
fragments.push(`<div class="user-message" id="msg-${messageId}">\n\n${bubble.text}\n\n</div>`);
```

这些属性可以用于：
- 前端交互（点击消息跳转、复制等）
- 消息定位和滚动
- 数据分析和追踪

