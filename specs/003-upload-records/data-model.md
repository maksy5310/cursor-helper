# Data Model: 记录上传到分享平台

**Date**: 2025-12-15  
**Feature**: 记录上传到分享平台

## Overview

本文档定义了记录上传功能中使用的数据模型，包括上传记录、上传表单数据、上传响应和上传配置。

## Entities

### 1. UploadRecord (上传记录)

**Purpose**: 表示要上传到分享平台的记录数据，包含项目名称、上传人邮箱、上传时间、内容格式和内容

**Fields**:

```typescript
interface UploadRecord {
  project_name: string;          // 项目名称（1-255字符）
  uploader_email: string;        // 上传人邮箱（有效邮箱格式）
  upload_time: string;           // 上传时间（ISO 8601格式，不能是未来时间）
  content_format: ContentFormat; // 内容格式（默认'markdown'）
  content: string;               // 内容（最大10MB）
}
```

**Validation Rules**:
- `project_name`: 必填，1-255字符
- `uploader_email`: 必填，有效邮箱格式（正则表达式验证）
- `upload_time`: 必填，ISO 8601格式，不能是未来时间
- `content_format`: 可选，默认'markdown'，枚举值：'markdown', 'text', 'json', 'html'
- `content`: 必填，最大10MB（字节大小验证）

**Storage**: 
- 临时数据，用于API请求
- 不持久化，上传完成后丢弃

**Example**:

```typescript
{
  project_name: "my-project",
  uploader_email: "user@example.com",
  upload_time: "2025-12-15T10:00:00Z",
  content_format: "markdown",
  content: "# Agent使用记录\n\n..."
}
```

---

### 2. UploadFormData (上传表单数据)

**Purpose**: 表示上传表单的用户输入数据，包含所有表单字段和验证状态

**Fields**:

```typescript
interface UploadFormData {
  project_name: string;          // 项目名称
  uploader_email: string;        // 上传人邮箱
  upload_time: string;           // 上传时间（ISO 8601格式）
  content_format: ContentFormat; // 内容格式
  content: string;               // 内容（从数据库加载的会话内容，可编辑）
  composer_id?: string;           // 会话ID（composerId，用于从数据库加载会话）
  validation_errors?: ValidationErrors; // 验证错误（可选）
}

interface ValidationErrors {
  project_name?: string;          // 项目名称验证错误
  uploader_email?: string;        // 邮箱验证错误
  upload_time?: string;          // 时间验证错误
  content?: string;              // 内容验证错误
}
```

**Validation Rules**:
- 所有字段的验证规则与 `UploadRecord` 相同
- `validation_errors` 在客户端验证失败时填充
- `composer_id` 用于从数据库加载会话内容，在用户点击会话项时传入

**Storage**: 
- 临时数据，仅在表单显示期间存在
- 表单提交后转换为 `UploadRecord`

**Example**:

```typescript
{
  project_name: "my-project",
  uploader_email: "user@example.com",
  upload_time: "2025-12-15T10:00:00Z",
  content_format: "markdown",
  content: "# Agent使用记录\n\n...",
  composer_id: "composer-123456"
}
```

---

### 3. UploadResponse (上传响应)

**Purpose**: 表示分享平台API返回的上传响应数据

**Fields**:

```typescript
interface UploadResponse {
  data: {
    id: string;                   // 记录ID（UUID）
    project_name: string;         // 项目名称
    uploader_email: string;      // 上传人邮箱
    upload_time: string;         // 上传时间
    content_format: ContentFormat; // 内容格式
    content: string;             // 内容
    is_shared: boolean;          // 是否已分享
    created_at: string;          // 创建时间
    updated_at: string;          // 更新时间
  };
  message: string;               // 响应消息
}

interface UploadErrorResponse {
  error: {
    code: string;                // 错误代码
    message: string;             // 错误消息
    details?: {
      field?: string;            // 字段名（验证错误时）
      reason?: string;           // 具体原因（验证错误时）
    };
  };
}
```

**Validation Rules**:
- `data.id` 必须为有效的 UUID 格式
- `data.created_at` 和 `data.updated_at` 必须为有效的 ISO 8601 格式
- `error.code` 必须为预定义的错误代码之一

**Storage**: 
- 临时数据，用于显示上传结果
- 可以记录到日志中

**Example**:

```typescript
// 成功响应
{
  data: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    project_name: "my-project",
    uploader_email: "user@example.com",
    upload_time: "2025-12-15T10:00:00Z",
    content_format: "markdown",
    content: "# Agent使用记录\n\n...",
    is_shared: false,
    created_at: "2025-12-15T10:00:01Z",
    updated_at: "2025-12-15T10:00:01Z"
  },
  message: "记录上传成功"
}

// 错误响应
{
  error: {
    code: "VALIDATION_ERROR",
    message: "字段验证失败",
    details: {
      field: "uploader_email",
      reason: "无效的邮箱格式"
    }
  }
}
```

---

### 4. UploadConfig (上传配置)

**Purpose**: 存储上传功能的配置信息，包括JWT Token和API URL

**Fields**:

```typescript
interface UploadConfig {
  jwt_token: string;             // JWT Token（用于认证）
  api_url: string;               // 分享平台API基础URL
}

interface UploadConfigState {
  jwt_token?: string;            // JWT Token（可选，未配置时为undefined）
  api_url: string;               // API URL（默认值：从API文档获取）
}
```

**Validation Rules**:
- `jwt_token`: 可选，如果存在必须为非空字符串
- `api_url`: 必填，必须为有效的URL格式
- `api_url` 默认值：`http://localhost:8000/api/v1`（从API文档获取）

**Storage**: 
- 使用 VS Code 的 `globalState` 存储（全局配置）
- `jwt_token` 存储为加密或明文（根据安全要求）
- `api_url` 可以配置，默认从API文档获取

**Example**:

```typescript
{
  jwt_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  api_url: "http://localhost:8000/api/v1"
}
```

---

### 5. ContentFormat (内容格式枚举)

**Purpose**: 定义支持的内容格式类型

**Values**:

```typescript
enum ContentFormat {
  MARKDOWN = "markdown",    // Markdown 格式（默认）
  TEXT = "text",            // 纯文本格式
  JSON = "json",            // JSON 格式
  HTML = "html"             // HTML 格式
}
```

**Validation Rules**:
- 必须为枚举值之一
- 默认值为 `MARKDOWN`

**Storage**: 
- 枚举类型，不单独存储
- 作为 `UploadRecord` 和 `UploadFormData` 的字段

---

### 6. LocalRecordFile (本地记录文件)

**Purpose**: 表示本地存储的Agent记录文件信息，用于文件选择

**Fields**:

```typescript
interface LocalRecordFile {
  file_path: string;         // 文件路径
  file_name: string;         // 文件名
  file_size: number;         // 文件大小（字节）
  created_at: string;        // 创建时间（ISO 8601格式）
  date: string;             // 日期（yyyy-mm-dd格式，用于排序）
}
```

**Validation Rules**:
- `file_path` 必须为有效的文件路径
- `file_name` 必须匹配模式 `agent-yyyy-mm-dd-HHMMSS.json`
- `file_size` 必须为非负整数
- `created_at` 必须为有效的 ISO 8601 格式

**Storage**: 
- 临时数据，用于文件选择列表
- 通过扫描 `./cursor-helper` 目录获取

**Example**:

```typescript
{
  file_path: "./cursor-helper/2025-12-15/agent-2025-12-15-143022.json",
  file_name: "agent-2025-12-15-143022.json",
  file_size: 10240,
  created_at: "2025-12-15T14:30:22.000Z",
  date: "2025-12-15"
}
```

---

## Relationships

### UploadFormData → UploadRecord

- `UploadFormData` 是用户输入的表单数据
- 提交时转换为 `UploadRecord`（去除验证错误和文件路径）
- 转换过程中进行最终验证

### UploadRecord → UploadResponse

- `UploadRecord` 通过API请求发送到分享平台
- 分享平台返回 `UploadResponse`（成功）或 `UploadErrorResponse`（失败）

### UploadConfig → UploadRecord

- `UploadConfig` 提供认证和API URL信息
- 用于构建API请求（添加JWT Token认证头）

### LocalRecordFile → UploadFormData

- 用户选择 `LocalRecordFile` 后，加载文件内容
- 文件内容填充到 `UploadFormData.content` 字段
- 用户可以选择内容格式（json, markdown, text, html）

---

## Data Flow

```
LocalRecordFile (扫描本地存储目录)
  ↓
UploadFormData (用户填写表单，选择文件)
  ↓
UploadRecord (表单验证通过，转换为上传记录)
  ↓
API Request (使用 UploadConfig 中的 Token 和 URL)
  ↓
UploadResponse / UploadErrorResponse (API 返回结果)
  ↓
显示成功/错误消息
```

---

## Data Volume Assumptions

- 单个记录文件：平均 10-100KB，最大 10MB
- 表单数据：内存中临时数据，不持久化
- 上传请求：JSON 格式，大小与记录文件内容相关
- 上传响应：JSON 格式，通常 < 1KB（不包含完整内容时）

---

## Notes

- 所有数据模型都是临时数据，不持久化到文件系统（除了 `UploadConfig`）
- `UploadConfig` 使用 VS Code 的 `globalState` 存储，全局配置
- 数据模型设计考虑了API契约和验证需求
- 支持多种内容格式，满足不同用户需求

