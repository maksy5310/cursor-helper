import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { createApp } from '../../src/web-server/app';
import { LocalShareService, ShareRecord } from '../../src/services/localShareService';

describe('Web Server', () => {
    let service: LocalShareService;
    let tempDir: string;
    let server: http.Server;
    let baseUrl: string;

    beforeEach(async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-web-test-'));
        service = new LocalShareService(tempDir);

        // 创建测试数据
        await service.saveShare({
            metadata: {
                uuid: 'web-test-1',
                title: 'Web测试分享',
                projectName: '测试项目',
                sharer: '测试用户',
                shareTime: '2026-02-06T10:00:00.000Z',
                createTime: '2026-02-06T09:00:00.000Z',
                contentFormat: 'markdown'
            },
            content: '# 测试\n\n这是Web测试内容。'
        });

        const app = createApp(service);
        
        await new Promise<void>((resolve) => {
            server = app.listen(0, '127.0.0.1', () => {
                const addr = server.address() as any;
                baseUrl = `http://127.0.0.1:${addr.port}`;
                resolve();
            });
        });
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    function httpGet(urlPath: string): Promise<{ status: number; body: string }> {
        return new Promise((resolve, reject) => {
            http.get(`${baseUrl}${urlPath}`, (res) => {
                let body = '';
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => resolve({ status: res.statusCode || 0, body }));
            }).on('error', reject);
        });
    }

    describe('GET /', () => {
        it('首页应返回200', async () => {
            const res = await httpGet('/');
            expect(res.status).toBe(200);
            expect(res.body).toContain('Cursor Session Helper');
        });

        it('首页应显示分享列表', async () => {
            const res = await httpGet('/');
            expect(res.body).toContain('Web测试分享');
            expect(res.body).toContain('测试项目');
        });

        it('应支持关键字搜索', async () => {
            const res = await httpGet('/?q=Web');
            expect(res.status).toBe(200);
            expect(res.body).toContain('Web测试分享');
        });

        it('首页应包含导入按钮', async () => {
            const res = await httpGet('/');
            expect(res.status).toBe(200);
            expect(res.body).toContain('导入会话');
        });

        it('首页应包含右键删除功能代码', async () => {
            const res = await httpGet('/');
            expect(res.status).toBe(200);
            expect(res.body).toContain('contextMenu');
            expect(res.body).toContain('deleteDialog');
        });

        it('首页应包含分页功能代码', async () => {
            const res = await httpGet('/');
            expect(res.status).toBe(200);
            expect(res.body).toContain('PAGE_SIZE');
            expect(res.body).toContain('pagination');
            expect(res.body).toContain('goToPage');
            expect(res.body).toContain('applyPagination');
        });

        it('首页应包含页脚版本信息', async () => {
            const res = await httpGet('/');
            expect(res.status).toBe(200);
            expect(res.body).toContain('Cursor Session Helper');
            expect(res.body).toContain('&copy;');
        });
    });

    describe('GET /share/:uuid', () => {
        it('应返回分享详情页', async () => {
            const res = await httpGet('/share/web-test-1');
            expect(res.status).toBe(200);
            expect(res.body).toContain('Web测试分享');
            expect(res.body).toContain('测试项目');
        });

        it('不存在的UUID应返回404', async () => {
            const res = await httpGet('/share/non-existent');
            expect(res.status).toBe(404);
            expect(res.body).toContain('未找到');
        });

        it('详情页应包含页脚版本信息', async () => {
            const res = await httpGet('/share/web-test-1');
            expect(res.status).toBe(200);
            expect(res.body).toContain('Cursor Session Helper');
            expect(res.body).toContain('&copy;');
        });

        it('详情页折叠按钮应默认可见（无display:none）', async () => {
            const res = await httpGet('/share/web-test-1');
            expect(res.status).toBe(200);
            // 折叠按钮不应有 display:none（方案C：默认显示）
            expect(res.body).toContain('msg-toggle-bar');
            expect(res.body).not.toContain('id="msgToggle-0" style="display:none;"');
        });

        it('详情页应包含多重折叠初始化保障', async () => {
            const res = await httpGet('/share/web-test-1');
            expect(res.status).toBe(200);
            // 应包含 DOMContentLoaded + setTimeout + window.onload 三重保障
            expect(res.body).toContain('DOMContentLoaded');
            expect(res.body).toContain('setTimeout');
            expect(res.body).toContain('window.addEventListener');
            expect(res.body).toContain('initCollapse');
        });

        it('详情页应安全处理消息内容中的script标签', async () => {
            // 创建包含 <script> 标签的测试数据（模拟对话中引用代码片段的场景）
            await service.saveShare({
                metadata: {
                    uuid: 'script-safety-test',
                    title: '脚本安全测试',
                    projectName: '测试项目',
                    sharer: '测试用户',
                    shareTime: '2026-02-13T10:00:00.000Z',
                    createTime: '2026-02-13T09:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '<div class="user-message">用户提问</div>\n\n包含代码示例：\n```html\n<script>alert("xss")</script>\n```\n\n以及直接引用：`<script>...</script>` 结尾标签'
            });
            const res = await httpGet('/share/script-safety-test');
            expect(res.status).toBe(200);
            // 消息内容中的 <script> 标签应被转义，不应作为真实脚本标签出现
            // HTML 中只应有一个真实的 <script> 块（页面功能脚本）
            const realScriptTags = (res.body.match(/<script>/g) || []).length;
            expect(realScriptTags).toBe(1); // 只有页面末尾的功能脚本
            // 确认 initCollapse 函数仍然存在于页面的合法 script 中
            expect(res.body).toContain('initCollapse');
        });

        it('详情页应包含返回顶部按钮', async () => {
            const res = await httpGet('/share/web-test-1');
            expect(res.status).toBe(200);
            expect(res.body).toContain('back-to-top');
            expect(res.body).toContain('backToTop');
            expect(res.body).toContain('scrollToTop');
            // 检查滚动监听逻辑
            expect(res.body).toContain('SHOW_THRESHOLD');
        });

        it('详情页应包含打印和下载按钮', async () => {
            const res = await httpGet('/share/web-test-1');
            expect(res.status).toBe(200);
            expect(res.body).toContain('打印');
            expect(res.body).toContain('下载');
        });
    });

    describe('GET /api/shares', () => {
        it('API应返回分享列表JSON', async () => {
            const res = await httpGet('/api/shares');
            expect(res.status).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.shares).toHaveLength(1);
            expect(data.total).toBe(1);
            expect(data.shares[0].title).toBe('Web测试分享');
        });

        it('API应支持搜索', async () => {
            const res = await httpGet('/api/shares?q=不存在');
            expect(res.status).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.shares).toHaveLength(0);
        });
    });

    describe('GET /api/shares/:uuid', () => {
        it('API应返回单个分享记录', async () => {
            const res = await httpGet('/api/shares/web-test-1');
            expect(res.status).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.metadata.title).toBe('Web测试分享');
            expect(data.content).toContain('# 测试');
        });

        it('不存在的UUID应返回404', async () => {
            const res = await httpGet('/api/shares/non-existent');
            expect(res.status).toBe(404);
        });
    });

    describe('GET /download/:uuid', () => {
        it('应提供 Markdown 文件下载', async () => {
            const res = await httpGet('/download/web-test-1');
            expect(res.status).toBe(200);
            expect(res.body).toContain('# 测试');
        });

        it('不存在的UUID应返回404', async () => {
            const res = await httpGet('/download/non-existent');
            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/import', () => {
        function httpPost(urlPath: string, body: any): Promise<{ status: number; body: string }> {
            return new Promise((resolve, reject) => {
                const data = JSON.stringify(body);
                const options = {
                    hostname: '127.0.0.1',
                    port: parseInt(baseUrl.split(':')[2]),
                    path: urlPath,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(data)
                    }
                };
                const req = http.request(options, (res) => {
                    let responseBody = '';
                    res.on('data', chunk => { responseBody += chunk; });
                    res.on('end', () => resolve({ status: res.statusCode || 0, body: responseBody }));
                });
                req.on('error', reject);
                req.write(data);
                req.end();
            });
        }

        it('应成功导入有效的 Markdown 文件', async () => {
            const validContent = `---
uuid: "import-test-1"
title: "导入测试"
projectName: "测试项目"
sharer: "导入用户"
shareTime: "2026-02-08T12:00:00.000Z"
createTime: "2026-02-08T11:00:00.000Z"
contentFormat: "markdown"
---
# 导入内容
这是导入测试。`;

            const res = await httpPost('/api/import', {
                files: [{ name: 'test.md', content: validContent }]
            });
            
            expect(res.status).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.success).toBe(true);
            expect(data.imported).toBe(1);
            expect(data.errors).toHaveLength(0);

            // 验证文件已导入
            const imported = service.getShareByUuid('import-test-1');
            expect(imported).not.toBeNull();
            expect(imported?.metadata.title).toBe('导入测试');
        });

        it('应拒绝无法提取元数据的文件', async () => {
            // 没有 YAML 头部，也没有可识别的 UUID 或功能名称表格
            const invalidContent = `# 随机标题
这是无效的文件，无法提取元数据。`;

            const res = await httpPost('/api/import', {
                files: [{ name: 'invalid.md', content: invalidContent }]
            });
            
            expect(res.status).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.imported).toBe(0);
            expect(data.errors).toHaveLength(1);
            expect(data.errors[0]).toContain('无法从文件中提取会话标识或标题');
        });

        it('应拒绝缺少必要字段的文件', async () => {
            const missingFieldsContent = `---
uuid: "test"
title: "只有标题"
---
# 内容`;

            const res = await httpPost('/api/import', {
                files: [{ name: 'missing.md', content: missingFieldsContent }]
            });
            
            expect(res.status).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.imported).toBe(0);
            expect(data.errors).toHaveLength(1);
            expect(data.errors[0]).toContain('缺少必要字段');
        });

        it('应处理多文件导入（部分成功）', async () => {
            const validContent = `---
uuid: "multi-test-1"
title: "有效文件"
sharer: "用户"
shareTime: "2026-02-08T12:00:00.000Z"
---
# 内容`;
            const invalidContent = `# 无效文件`;

            const res = await httpPost('/api/import', {
                files: [
                    { name: 'valid.md', content: validContent },
                    { name: 'invalid.md', content: invalidContent }
                ]
            });
            
            expect(res.status).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.success).toBe(true); // 至少有一个成功
            expect(data.imported).toBe(1);
            expect(data.errors).toHaveLength(1);
        });

        it('应返回错误当没有提供文件', async () => {
            const res = await httpPost('/api/import', { files: [] });
            
            expect(res.status).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.success).toBe(false);
            expect(data.message).toContain('没有接收到文件');
        });
    });

    describe('POST /api/import - 系统用户名默认值', () => {
        function httpPost(urlPath: string, body: any): Promise<{ status: number; body: string }> {
            return new Promise((resolve, reject) => {
                const data = JSON.stringify(body);
                const options = {
                    hostname: '127.0.0.1',
                    port: parseInt(baseUrl.split(':')[2]),
                    path: urlPath,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(data)
                    }
                };
                const req = http.request(options, (res) => {
                    let responseBody = '';
                    res.on('data', chunk => { responseBody += chunk; });
                    res.on('end', () => resolve({ status: res.statusCode || 0, body: responseBody }));
                });
                req.on('error', reject);
                req.write(data);
                req.end();
            });
        }

        it('导入无sharer的YAML文件应报缺少必要字段', async () => {
            // YAML 头中缺少 sharer，校验应提示缺少字段
            const contentWithoutSharer = `---
uuid: "sysuser-test-1"
title: "系统用户名测试"
projectName: "测试项目"
shareTime: "2026-02-13T12:00:00.000Z"
---
# 测试内容`;

            const res = await httpPost('/api/import', {
                files: [{ name: 'sysuser.md', content: contentWithoutSharer }]
            });

            expect(res.status).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.imported).toBe(0);
            expect(data.errors).toHaveLength(1);
            expect(data.errors[0]).toContain('sharer');
        });

        it('导入使用无YAML头的文件应回退到系统用户名', async () => {
            // 使用表格形式的会话指标（无YAML头），app.ts 的 validateShareMarkdown 会使用 getSystemUsername()
            const contentNoYaml = `# test-uuid-sysname

## 会话指标

| 分类 | 指标 | 数值 |
|------|------|------|
| 基础信息 | 功能名称 | 系统用户名回退测试 |

## 用户
测试内容`;

            const res = await httpPost('/api/import', {
                files: [{ name: 'noyaml.md', content: contentNoYaml }]
            });

            expect(res.status).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.imported).toBe(1);

            // 验证 sharer 回退到系统用户名
            const shares = service.getAllShares();
            const imported = shares.find(s => s.title === '系统用户名回退测试');
            expect(imported).toBeDefined();
            expect(imported?.sharer).toBe(os.userInfo().username);
        });
    });

    describe('DELETE /api/shares/:uuid', () => {
        function httpDelete(urlPath: string): Promise<{ status: number; body: string }> {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: '127.0.0.1',
                    port: parseInt(baseUrl.split(':')[2]),
                    path: urlPath,
                    method: 'DELETE'
                };
                const req = http.request(options, (res) => {
                    let responseBody = '';
                    res.on('data', chunk => { responseBody += chunk; });
                    res.on('end', () => resolve({ status: res.statusCode || 0, body: responseBody }));
                });
                req.on('error', reject);
                req.end();
            });
        }

        it('应成功删除存在的分享记录', async () => {
            // 首先确认记录存在
            const checkRes = await httpGet('/api/shares/web-test-1');
            expect(checkRes.status).toBe(200);

            // 执行删除
            const res = await httpDelete('/api/shares/web-test-1');
            expect(res.status).toBe(200);
            const data = JSON.parse(res.body);
            expect(data.success).toBe(true);
            expect(data.message).toBe('删除成功');

            // 确认记录已删除
            const afterRes = await httpGet('/api/shares/web-test-1');
            expect(afterRes.status).toBe(404);
        });

        it('删除不存在的记录应返回404', async () => {
            const res = await httpDelete('/api/shares/non-existent-uuid');
            expect(res.status).toBe(404);
            const data = JSON.parse(res.body);
            expect(data.success).toBe(false);
        });
    });
});
