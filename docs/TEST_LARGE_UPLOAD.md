# 大文件上传功能测试指南

## 快速测试

### 1. 重新编译扩展

```bash
cd F:\spec-kit\cursor-helper
npm run compile
```

### 2. 在VS Code中调试运行

1. 按 `F5` 启动Extension Development Host
2. 打开输出面板（`Ctrl+Shift+U`），选择 `Cursor Assistant`

### 3. 创建测试上传

**方式A：使用实际的大型会话记录**

1. 找一个包含大量对话的composerId
2. 按 `Ctrl+Shift+P`
3. 运行 `Upload Record`
4. 观察输出日志

**方式B：手动创建大型测试内容**

在浏览器开发者工具中：
```javascript
// 生成一个2MB的测试字符串
const largeContent = 'A'.repeat(2 * 1024 * 1024);
```

## 预期行为

### 场景1：中等大小内容（500KB - 1MB）

**日志输出**：
```
[INFO] Uploading record (attempt 1/4)...
[INFO] Content size: 750.0KB -> 250.0KB (33.3% compression)
[INFO] Using compressed content for upload
[INFO] Record uploaded successfully: abc-123 (took 800ms)
```

**结果**：
✅ 自动压缩
✅ 单次请求成功
✅ 服务器自动解压

---

### 场景2：大型内容（1MB - 3MB）

**日志输出**：
```
[INFO] Uploading record (attempt 1/4)...
[INFO] Content size: 2.5MB -> 0.9MB (36.0% compression)
[WARN] Compressed content still too large, using original (may fail)
[WARN] Payload too large, attempting chunked upload...
[INFO] Content too large (2.5MB), splitting into 4 chunks
[INFO] Uploading chunk 1/4 (700.0KB)
[INFO] Uploading chunk 2/4 (700.0KB)
[INFO] Uploading chunk 3/4 (700.0KB)
[INFO] Uploading chunk 4/4 (400.0KB)
[INFO] All chunks uploaded successfully: abc-123
```

**结果**：
✅ 尝试压缩
✅ 检测到413错误
✅ 自动降级到分块上传
✅ 成功完成

---

### 场景3：极大内容（> 10MB）

**日志输出**：
```
[INFO] Uploading record (attempt 1/4)...
[ERROR] Upload failed: 内容大小超过10MB限制
```

**结果**：
❌ 返回错误（符合预期，10MB是硬限制）

---

## 验证检查清单

### 客户端（VS Code Extension）

- [ ] 编译成功（无TypeScript错误）
- [ ] 扩展正常加载
- [ ] 压缩功能正常工作
  - [ ] > 500KB内容自动压缩
  - [ ] 压缩率合理（20-40%）
  - [ ] 添加正确的header（`X-Content-Encoding: gzip-base64`）
- [ ] 分块上传功能正常工作
  - [ ] 遇到413错误自动触发
  - [ ] 块大小正确（~700KB）
  - [ ] 块顺序正确
  - [ ] 所有块成功上传
- [ ] 日志输出清晰
  - [ ] 显示压缩率
  - [ ] 显示块进度
  - [ ] 显示上传时间
- [ ] 错误处理正确
  - [ ] 压缩失败降级到原始内容
  - [ ] 分块上传失败返回明确错误

### 服务器端（FastAPI）

- [ ] 服务器正常启动
- [ ] 压缩内容解压功能正常
  - [ ] 识别`X-Content-Encoding`header
  - [ ] Base64解码成功
  - [ ] Gzip解压成功
  - [ ] 内容正确存储
- [ ] 分块上传路由正常
  - [ ] `/api/v1/records/upload-chunk`可访问
  - [ ] 接收块数据
  - [ ] 缓存块正确
  - [ ] 合并块正确
  - [ ] 最后一块返回完整记录
- [ ] 日志输出清晰
  - [ ] 显示解压大小
  - [ ] 显示块接收进度
  - [ ] 显示合并状态
- [ ] 错误处理正确
  - [ ] 解压失败返回400
  - [ ] 缺失块返回400
  - [ ] 未认证返回401

---

## 测试服务器端接口

### 1. 测试压缩内容上传

```bash
# 生成测试数据
echo "测试内容" | gzip | base64 > test_compressed.txt

# 上传
curl -X POST https://spec.pixvert.app/api/v1/records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Content-Encoding: gzip-base64" \
  -d "{
    \"project_name\": \"test-project\",
    \"uploader_email\": \"test@example.com\",
    \"upload_time\": \"2026-01-14T12:00:00Z\",
    \"content_format\": \"markdown\",
    \"content\": \"$(cat test_compressed.txt)\"
  }"
```

**预期响应**：
```json
{
  "data": {
    "id": "...",
    "project_name": "test-project",
    "content": "测试内容",
    ...
  },
  "message": "记录上传成功"
}
```

### 2. 测试分块上传

```bash
# 块1（包含元数据）
curl -X POST https://spec.pixvert.app/api/v1/records/upload-chunk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "upload_id": "test-upload-123",
    "chunk_index": 0,
    "total_chunks": 2,
    "chunk_content": "第一块内容...",
    "project_name": "test-chunked",
    "uploader_email": "test@example.com",
    "upload_time": "2026-01-14T12:00:00Z",
    "content_format": "markdown"
  }'
```

**预期响应**：
```json
{
  "message": "Chunk 1/2 received (1/2 total)"
}
```

```bash
# 块2（最后一块）
curl -X POST https://spec.pixvert.app/api/v1/records/upload-chunk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "upload_id": "test-upload-123",
    "chunk_index": 1,
    "total_chunks": 2,
    "chunk_content": "第二块内容..."
  }'
```

**预期响应**：
```json
{
  "data": {
    "id": "...",
    "content": "第一块内容...第二块内容...",
    ...
  },
  "message": "分块上传完成，记录创建成功"
}
```

---

## 性能基准测试

### 测试用例

| 测试ID | 内容大小 | 预期方式 | 预期时间 |
|--------|---------|---------|---------|
| T1 | 100KB | 原始 | < 500ms |
| T2 | 600KB | 压缩 | < 800ms |
| T3 | 1.5MB | 压缩 | < 1.2s |
| T4 | 3.0MB | 分块（5块） | < 3s |
| T5 | 5.0MB | 分块（8块） | < 5s |
| T6 | 10MB | 分块（15块） | < 10s |
| T7 | 11MB | 错误 | 立即失败 |

### 执行测试

```bash
# 在VS Code Extension Development Host中
# 运行测试脚本（未来可以创建自动化测试）
```

---

## 故障排除

### 问题：压缩后仍然收到413错误

**检查**：
1. 压缩率是否正常（应该在20-40%）
2. 是否正确添加了`X-Content-Encoding`header
3. 服务器是否正确识别了压缩内容

**解决**：
- 查看日志确认压缩大小
- 应该自动降级到分块上传

### 问题：分块上传失败

**检查**：
1. `/upload-chunk`路由是否存在
2. 服务器是否已部署最新代码
3. 每个块是否小于1MB

**解决**：
```bash
# 检查服务器路由
curl https://spec.pixvert.app/api/v1/records/upload-chunk \
  -H "Authorization: Bearer YOUR_TOKEN"

# 应该返回405 Method Not Allowed（说明路由存在）
# 或者返回422 Validation Error（说明需要POST数据）
```

### 问题：服务器解压失败

**检查**：
1. Base64编码是否正确
2. Gzip压缩是否完整
3. 服务器日志错误信息

**解决**：
```python
# 在服务器上手动测试解压
import base64
import gzip

compressed = "H4sIAAAAAAAA..."  # 从请求中复制
decoded = base64.b64decode(compressed)
decompressed = gzip.decompress(decoded)
print(decompressed.decode('utf-8'))
```

---

## 下一步

### 立即行动

1. ✅ 部署服务器端更新
   ```bash
   cd /path/to/spec-share-server
   git pull
   systemctl restart spec-share-server
   ```

2. ✅ 测试端到端上传
   - 使用真实的大型会话记录
   - 观察日志输出
   - 验证记录正确存储

3. ✅ 监控生产环境
   - 查看错误率
   - 查看上传成功率
   - 查看平均上传时间

### 未来改进

1. **自动化测试**
   - 单元测试（压缩/解压）
   - 集成测试（完整上传流程）
   - 性能测试（不同大小的内容）

2. **用户体验**
   - 上传进度条（Webview）
   - 预估剩余时间
   - 取消上传功能

3. **可靠性**
   - 断点续传
   - 块级重试（当前是请求级）
   - 使用Redis缓存块数据

4. **监控**
   - 上传统计（大小分布、成功率）
   - 性能指标（平均时间、P99延迟）
   - 错误追踪（Sentry集成）

---

**测试负责人**: _______  
**测试日期**: _______  
**测试结果**: [ ] 通过 / [ ] 失败  
**备注**: _______
