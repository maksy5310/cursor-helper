# Upload Service Interface Contract

**Date**: 2025-12-15  
**Component**: Upload Service

## Overview

Upload Service 负责调用分享平台 API 上传记录，处理认证、错误处理和重试逻辑。

## Interface Definition

### IUploadService

```typescript
interface IUploadService {
  /**
   * 上传记录到分享平台
   * @param record 上传记录数据
   * @param config 上传配置（JWT Token、API URL）
   * @returns 上传响应数据
   * @throws UploadError 上传失败时抛出错误
   */
  uploadRecord(record: UploadRecord, config: UploadConfig): Promise<UploadResponse>;

  /**
   * 验证 JWT Token 是否有效
   * @param token JWT Token
   * @returns Token 是否有效
   */
  validateToken(token: string): Promise<boolean>;

  /**
   * 测试 API 连接
   * @param config 上传配置
   * @returns 连接是否成功
   */
  testConnection(config: UploadConfig): Promise<boolean>;
}
```

## Implementation Requirements

### 1. HTTP 请求

- 使用 Node.js 内置 `fetch` API
- 请求方法：`POST`
- 请求 URL：`{api_url}/records`
- 请求头：
  - `Content-Type: application/json`
  - `Authorization: Bearer {jwt_token}`
- 请求体：`UploadRecord` JSON 对象

### 2. 错误处理

- **400 Bad Request**: 字段验证失败
  - 解析错误响应，提取具体错误信息
  - 抛出 `ValidationError`，包含字段和原因
- **401 Unauthorized**: 未提供或无效的token
  - 抛出 `AuthenticationError`，提示用户更新 Token
- **413 Payload Too Large**: 内容超过10MB
  - 抛出 `PayloadTooLargeError`，提示用户内容过大
- **500 Internal Server Error**: 服务器错误
  - 抛出 `ServerError`，允许重试
- **网络错误**: 连接失败、超时等
  - 抛出 `NetworkError`，允许重试

### 3. 重试机制

- 对于网络错误和 500 错误，自动重试最多 3 次
- 重试间隔：1秒、2秒、4秒（指数退避）
- 对于用户错误（400, 401, 413），不自动重试

### 4. 超时处理

- 请求超时时间：30秒
- 超时后抛出 `TimeoutError`

### 5. Token 验证

- 检查 Token 格式（JWT 格式）
- 检查 Token 是否过期（解析 JWT payload）
- 不进行服务端验证（仅客户端检查）

## Error Types

```typescript
class UploadError extends Error {
  code: string;
  message: string;
  details?: {
    field?: string;
    reason?: string;
  };
}

class ValidationError extends UploadError {
  code: "VALIDATION_ERROR";
}

class AuthenticationError extends UploadError {
  code: "UNAUTHORIZED";
}

class PayloadTooLargeError extends UploadError {
  code: "PAYLOAD_TOO_LARGE";
}

class ServerError extends UploadError {
  code: "INTERNAL_ERROR";
}

class NetworkError extends UploadError {
  code: "NETWORK_ERROR";
}

class TimeoutError extends UploadError {
  code: "TIMEOUT_ERROR";
}
```

## Usage Example

```typescript
const uploadService = new UploadService();
const record: UploadRecord = {
  project_name: "my-project",
  uploader_email: "user@example.com",
  upload_time: "2025-12-15T10:00:00Z",
  content_format: "markdown",
  content: "# Agent使用记录\n\n..."
};
const config: UploadConfig = {
  jwt_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  api_url: "http://localhost:8000/api/v1"
};

try {
  const response = await uploadService.uploadRecord(record, config);
  console.log("上传成功:", response.data.id);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error("认证失败，请更新 Token");
  } else if (error instanceof ValidationError) {
    console.error("验证失败:", error.details);
  } else {
    console.error("上传失败:", error.message);
  }
}
```

## Performance Requirements

- 上传请求响应时间 ≤ 5 秒（正常网络条件下，SC-002）
- 超时时间：30 秒
- 重试次数：最多 3 次
- 重试间隔：1秒、2秒、4秒（指数退避）

## Security Requirements

- JWT Token 存储在 `globalState` 中（VS Code 加密存储）
- 不在日志中记录完整的 Token（仅记录前几个字符）
- 使用 HTTPS 连接（如果 API 支持）

## Testing Requirements

- 单元测试：测试各种错误情况
- 集成测试：测试与真实 API 的交互
- Mock HTTP 请求：使用 `fetch` mock 进行测试

