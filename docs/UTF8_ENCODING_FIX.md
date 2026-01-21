# UTF-8 编码问题修复说明

## 问题背景

### 问题1: 404 错误 - `/api/v1/users/profile/`

**日志信息：**
```
INFO: 172.17.0.1:41274 - "GET /api/v1/users/profile/ HTTP/1.1" 404 Not Found
```

**分析：**
- 服务端正确的端点是 `/api/v1/users/me/profile`（在 `src/api/routes/users.py` 中定义）
- 插件代码中使用的 URL 是正确的（`userProfileService.ts` 使用了 `/users/me/profile`）
- 这个 404 可能是旧版本的请求或日志记录问题

**插件处理：**
- 插件代码已经正确，无需修改
- 如果用户遇到 404，建议检查服务端版本

---

### 问题2: UTF-8 编码错误（孤立代理字符）⚠️

**日志信息：**
```
WARNING - Validation error: [{'field': 'body.content', 'message': "Value error, 'utf-8' codec can't encode character '\\ud83d' in position 107684: surrogates not allowed", 'type': 'value_error'}]
INFO: 172.17.0.1:41284 - "POST /api/v1/records HTTP/1.1" 400 Bad Request
```

**原因分析：**

在 JavaScript/TypeScript 中，某些 emoji 和特殊字符会被表示为**代理对**（surrogate pairs）：
- **高位代理**（High Surrogate）: U+D800 到 U+DBFF
- **低位代理**（Low Surrogate）: U+DC00 到 U+DFFF

正常情况下，一个 emoji 应该是一个完整的代理对，例如：
```javascript
'😀' = '\uD83D\uDE00'  // 完整的代理对
```

但如果字符串处理不当（例如字符串截断、不当的编码转换等），可能产生**孤立的代理字符**：
```javascript
'\uD83D'  // 只有高位代理，没有低位代理 ❌
'\uDE00'  // 只有低位代理，没有高位代理 ❌
```

这些孤立的代理字符无法被 Python 的 UTF-8 编码器处理，会导致以下错误：
```python
UnicodeEncodeError: 'utf-8' codec can't encode character '\ud83d' in position X: surrogates not allowed
```

**服务端问题位置：**
- `src/utils/validators.py` 第 78 行：`content.encode('utf-8')`
- `src/api/schemas/record.py` 第 40-45 行：调用 `validate_content_size(v)`

---

## 解决方案

### 1. 新增文本清理工具

创建了 `src/utils/textSanitizer.ts`，提供以下功能：

#### 主要函数：

```typescript
/**
 * 清理字符串中的孤立代理字符
 * @param text 需要清理的文本
 * @param replacement 替换字符，默认为 '�' (U+FFFD)
 */
sanitizeSurrogates(text: string, replacement?: string): string

/**
 * 检测字符串是否包含孤立的代理字符
 */
hasSurrogates(text: string): boolean

/**
 * 验证字符串是否可以安全地进行 UTF-8 编码
 */
isValidUTF8(text: string): boolean

/**
 * 全面清理文本，确保可以安全地发送到服务器
 * - 清理孤立的代理字符
 * - 移除 NULL 字节
 */
sanitizeForUpload(text: string, options?: {...}): string

/**
 * 获取清理报告
 */
getSanitizationReport(original: string, cleaned: string): {...}
```

#### 使用示例：

```typescript
import { sanitizeForUpload, hasSurrogates } from '../utils/textSanitizer';

// 检测是否包含孤立代理
if (hasSurrogates(content)) {
    console.log('发现孤立代理字符');
}

// 清理文本
const cleaned = sanitizeForUpload(content);
```

---

### 2. 更新上传服务

修改了 `src/services/uploadService.ts`：

#### 在 `uploadRecord()` 方法中：

```typescript
async uploadRecord(record: UploadRecord, config: UploadConfig): Promise<UploadResponse> {
    // 第一步：清理内容中的非法字符
    let cleanedContent = record.content;
    if (hasSurrogates(record.content)) {
        Logger.warn('Content contains orphaned surrogate characters, sanitizing...');
        cleanedContent = sanitizeForUpload(record.content);
        
        const report = getSanitizationReport(record.content, cleanedContent);
        Logger.info(`Sanitization report: removed ${report.surrogateCount} orphaned surrogates`);
    }
    
    // 使用清理后的内容
    record = { ...record, content: cleanedContent };
    
    // ... 继续上传逻辑
}
```

#### 在 `uploadRecordInChunks()` 方法中：

同样添加了内容清理逻辑。

#### 改进错误消息：

在 `parseErrorResponse()` 方法中，针对 UTF-8 编码错误提供更友好的错误消息：

```typescript
if (status === 400) {
    if (message.includes('utf-8') || message.includes('encode') || message.includes('surrogate')) {
        message = '内容包含无法编码的特殊字符。插件已尝试自动清理，但仍然失败。' +
                  '建议：请检查内容中是否包含损坏的 emoji 或特殊字符。\n' +
                  `原始错误: ${message}`;
    }
}
```

---

## 测试

### 运行测试

创建了 `src/test/textSanitizerTest.ts`，可以运行以下测试：

```bash
# 在 VS Code 中打开测试文件，按 F5 运行
# 或者使用命令
npx ts-node src/test/textSanitizerTest.ts
```

### 测试用例

1. **正常文本** - 不包含代理字符
2. **正常 emoji** - 完整的代理对（😀 🎉）
3. **孤立的高位代理** - `\uD83D`
4. **孤立的低位代理** - `\uDE00`
5. **混合文本** - 包含正常 emoji 和孤立代理
6. **完整清理** - 包含孤立代理和 NULL 字节
7. **自定义替换** - 使用自定义替换字符
8. **真实场景** - 大量文本中的孤立代理

---

## 工作流程

### 上传流程（已自动处理）

```
用户发起上传
    ↓
uploadService.uploadRecord()
    ↓
检测是否包含孤立代理？
    ├─ 是 → 自动清理 → 记录日志
    └─ 否 → 跳过
    ↓
继续上传逻辑（压缩、分块等）
    ↓
发送到服务器
```

### 用户无需手动操作

插件会在上传前**自动检测和清理**孤立的代理字符，用户无需担心此问题。

---

## 常见场景

### 场景1: 复制粘贴包含 emoji 的内容

**问题：**
用户从某些应用复制包含 emoji 的文本，可能因为编码转换导致代理字符损坏。

**插件处理：**
自动检测并清理，替换为 `�` 字符，上传成功。

### 场景2: Cursor 数据库中的损坏数据

**问题：**
Cursor 的 SQLite 数据库中可能存储了损坏的字符串数据。

**插件处理：**
读取数据后，在上传前自动清理，确保服务器可以接受。

### 场景3: 大文件分块上传

**问题：**
如果在字符串中间截断，可能会破坏代理对。

**插件处理：**
在分块上传前，先清理整个内容，确保每个块都是有效的 UTF-8 字符串。

---

## 日志监控

### 正常上传（无孤立代理）

```
[INFO] Uploading record: project_name=my-project, size=1024KB
[INFO] Content size: 1024.0KB, no compression needed
[INFO] Upload successful: record_id=abc123
```

### 包含孤立代理（自动清理）

```
[WARN] Content contains orphaned surrogate characters, sanitizing...
[INFO] Sanitization report: removed 2 orphaned surrogates, length 107684 -> 107682
[INFO] Uploading record: project_name=my-project, size=1024KB
[INFO] Upload successful: record_id=abc123
```

### 清理后仍然失败（极端情况）

```
[WARN] Content contains orphaned surrogate characters, sanitizing...
[INFO] Sanitization report: removed 2 orphaned surrogates
[ERROR] Upload failed: 内容包含无法编码的特殊字符。插件已尝试自动清理，但仍然失败。
        建议：请检查内容中是否包含损坏的 emoji 或特殊字符。
```

---

## 技术细节

### 正则表达式说明

```typescript
const orphanedSurrogatePattern = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
```

**解释：**
- `[\uD800-\uDBFF](?![\uDC00-\uDFFF])` - 匹配孤立的高位代理（后面没有跟低位代理）
- `(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]` - 匹配孤立的低位代理（前面没有高位代理）

### 替换字符

默认使用 `\uFFFD` (�) 作为替换字符，这是 Unicode 标准中的**替换字符**（Replacement Character），用于表示无法识别或损坏的字符。

---

## 服务端建议（可选）

虽然插件已经自动处理了孤立代理问题，但服务端也可以添加更健壮的处理：

### 1. 在验证器中使用 `errors='replace'`

```python
# src/utils/validators.py
def validate_content_size(content: str, max_size_bytes: int = 10485760) -> bool:
    try:
        # 使用 errors='replace' 来处理无法编码的字符
        encoded = content.encode('utf-8', errors='replace')
        return len(encoded) <= max_size_bytes
    except Exception:
        return False
```

### 2. 在 Schema 中添加预处理

```python
# src/api/schemas/record.py
@validator('content')
def sanitize_content(cls, v):
    """Sanitize content to ensure valid UTF-8."""
    # 使用 encode/decode 循环来清理孤立代理
    return v.encode('utf-8', errors='replace').decode('utf-8')
```

---

## 总结

### 插件端改动

1. ✅ **新增** `src/utils/textSanitizer.ts` - 文本清理工具
2. ✅ **修改** `src/services/uploadService.ts` - 自动清理上传内容
3. ✅ **新增** `src/test/textSanitizerTest.ts` - 测试文件
4. ✅ **新增** `docs/UTF8_ENCODING_FIX.md` - 说明文档

### 用户体验

- **自动处理**：无需用户手动操作
- **日志记录**：清晰的日志说明发生了什么
- **友好错误**：如果仍然失败，提供有用的错误消息

### 服务端建议

- 可选：添加更健壮的错误处理
- 当前插件端的处理已经足够解决问题

---

## 问题反馈

如果遇到以下情况，请报告：

1. 上传仍然返回 400 错误（包含 `utf-8` 或 `surrogate` 关键字）
2. 清理后的内容丢失了重要信息
3. 性能问题（清理大文件耗时过长）

请附上：
- 错误日志
- 文件大小
- 是否包含大量 emoji
