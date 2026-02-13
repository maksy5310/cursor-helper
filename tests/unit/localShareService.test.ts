import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { LocalShareService, ShareRecord, ShareMetadata } from '../../src/services/localShareService';

describe('LocalShareService', () => {
    let service: LocalShareService;
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-test-'));
        // 通过构造函数注入临时目录，无需 mock
        service = new LocalShareService(tempDir);
    });

    afterEach(() => {
        // Cleanup temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe('getShareDirectory', () => {
        it('没有自定义配置时应返回默认目录', () => {
            const freshService = new LocalShareService();
            const dir = freshService.getShareDirectory();
            expect(dir).toContain('.cursor-session-helper');
            expect(dir).toContain('shares');
        });

        it('通过环境变量设置目录', () => {
            const originalEnv = process.env.CURSOR_SESSION_HELPER_SHARE_DIR;
            process.env.CURSOR_SESSION_HELPER_SHARE_DIR = '/custom/share/dir';
            try {
                const freshService = new LocalShareService();
                const dir = freshService.getShareDirectory();
                expect(dir).toBe('/custom/share/dir');
            } finally {
                if (originalEnv === undefined) {
                    delete process.env.CURSOR_SESSION_HELPER_SHARE_DIR;
                } else {
                    process.env.CURSOR_SESSION_HELPER_SHARE_DIR = originalEnv;
                }
            }
        });

        it('构造函数传入的目录优先于环境变量', () => {
            const originalEnv = process.env.CURSOR_SESSION_HELPER_SHARE_DIR;
            process.env.CURSOR_SESSION_HELPER_SHARE_DIR = '/env/dir';
            try {
                const customService = new LocalShareService('/constructor/dir');
                const dir = customService.getShareDirectory();
                expect(dir).toBe('/constructor/dir');
            } finally {
                if (originalEnv === undefined) {
                    delete process.env.CURSOR_SESSION_HELPER_SHARE_DIR;
                } else {
                    process.env.CURSOR_SESSION_HELPER_SHARE_DIR = originalEnv;
                }
            }
        });
    });

    describe('saveShare', () => {
        it('应成功保存分享记录', async () => {
            const record: ShareRecord = {
                metadata: {
                    uuid: 'test-uuid-123',
                    title: '测试分享',
                    projectName: '测试项目',
                    sharer: '测试用户',
                    shareTime: '2026-02-06T10:00:00.000Z',
                    createTime: '2026-02-06T09:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '# 测试内容\n\n这是测试内容。'
            };

            const filePath = await service.saveShare(record);

            expect(filePath).toContain('test-uuid-123.md');
            expect(fs.existsSync(filePath)).toBe(true);

            const fileContent = fs.readFileSync(filePath, 'utf-8');
            expect(fileContent).toContain('uuid: "test-uuid-123"');
            expect(fileContent).toContain('title: "测试分享"');
            expect(fileContent).toContain('# 测试内容');
        });

        it('应按日期分目录存储', async () => {
            const record: ShareRecord = {
                metadata: {
                    uuid: 'uuid-001',
                    title: '分享1',
                    projectName: '项目1',
                    sharer: '用户1',
                    shareTime: '2026-03-15T10:00:00.000Z',
                    createTime: '2026-03-15T09:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '内容1'
            };

            const filePath = await service.saveShare(record);
            expect(filePath).toContain('2026-03');
        });

        it('应正确处理标题中的特殊字符', async () => {
            const record: ShareRecord = {
                metadata: {
                    uuid: 'uuid-special',
                    title: '含有"引号"的标题',
                    projectName: '项目',
                    sharer: '用户',
                    shareTime: '2026-02-06T10:00:00.000Z',
                    createTime: '2026-02-06T09:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '内容'
            };

            const filePath = await service.saveShare(record);
            const content = fs.readFileSync(filePath, 'utf-8');
            expect(content).toContain('含有\\"引号\\"的标题');
        });

        it('应正确保存带有 description 的记录', async () => {
            const record: ShareRecord = {
                metadata: {
                    uuid: 'uuid-with-desc',
                    title: '带描述的分享',
                    projectName: '项目',
                    sharer: '用户',
                    shareTime: '2026-02-06T10:00:00.000Z',
                    createTime: '2026-02-06T09:00:00.000Z',
                    contentFormat: 'markdown',
                    description: '这是一段描述文字'
                },
                content: '内容'
            };

            const filePath = await service.saveShare(record);
            const content = fs.readFileSync(filePath, 'utf-8');
            expect(content).toContain('description: "这是一段描述文字"');
        });

        it('description 中的引号应被转义', async () => {
            const record: ShareRecord = {
                metadata: {
                    uuid: 'uuid-desc-quote',
                    title: '测试',
                    projectName: '项目',
                    sharer: '用户',
                    shareTime: '2026-02-06T10:00:00.000Z',
                    createTime: '2026-02-06T09:00:00.000Z',
                    contentFormat: 'markdown',
                    description: '描述中有"引号"'
                },
                content: '内容'
            };

            const filePath = await service.saveShare(record);
            const content = fs.readFileSync(filePath, 'utf-8');
            expect(content).toContain('描述中有\\"引号\\"');
        });
    });

    describe('getAllShares', () => {
        it('空目录应返回空数组', () => {
            const shares = service.getAllShares();
            expect(shares).toEqual([]);
        });

        it('应返回所有已保存的分享记录', async () => {
            // 保存两条记录
            await service.saveShare({
                metadata: {
                    uuid: 'uuid-1',
                    title: '分享1',
                    projectName: '项目1',
                    sharer: '用户1',
                    shareTime: '2026-02-06T10:00:00.000Z',
                    createTime: '2026-02-06T09:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '内容1'
            });

            await service.saveShare({
                metadata: {
                    uuid: 'uuid-2',
                    title: '分享2',
                    projectName: '项目2',
                    sharer: '用户2',
                    shareTime: '2026-02-06T11:00:00.000Z',
                    createTime: '2026-02-06T10:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '内容2'
            });

            const shares = service.getAllShares();
            expect(shares).toHaveLength(2);
            // 应按时间倒序排列
            expect(shares[0].uuid).toBe('uuid-2');
            expect(shares[1].uuid).toBe('uuid-1');
        });
    });

    describe('getShareByUuid', () => {
        it('应根据 UUID 获取完整记录', async () => {
            await service.saveShare({
                metadata: {
                    uuid: 'find-me',
                    title: '可以找到的分享',
                    projectName: '项目',
                    sharer: '用户',
                    shareTime: '2026-02-06T10:00:00.000Z',
                    createTime: '2026-02-06T09:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '# 找到了\n\n这是内容'
            });

            const result = service.getShareByUuid('find-me');
            expect(result).not.toBeNull();
            expect(result!.metadata.title).toBe('可以找到的分享');
            expect(result!.content).toContain('# 找到了');
        });

        it('找不到时应返回 null', () => {
            const result = service.getShareByUuid('non-existent');
            expect(result).toBeNull();
        });
    });

    describe('searchShares', () => {
        beforeEach(async () => {
            await service.saveShare({
                metadata: {
                    uuid: 'search-1',
                    title: 'React组件开发',
                    projectName: '前端项目',
                    sharer: '张三',
                    shareTime: '2026-02-06T10:00:00.000Z',
                    createTime: '2026-02-06T09:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '内容1'
            });

            await service.saveShare({
                metadata: {
                    uuid: 'search-2',
                    title: 'Python数据分析',
                    projectName: '后端项目',
                    sharer: '李四',
                    shareTime: '2026-02-06T11:00:00.000Z',
                    createTime: '2026-02-06T10:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '内容2'
            });
        });

        it('应按标题关键字搜索', () => {
            const results = service.searchShares('React');
            expect(results).toHaveLength(1);
            expect(results[0].title).toBe('React组件开发');
        });

        it('应按项目名称搜索', () => {
            const results = service.searchShares('后端');
            expect(results).toHaveLength(1);
            expect(results[0].projectName).toBe('后端项目');
        });

        it('应按分享人搜索', () => {
            const results = service.searchShares('张三');
            expect(results).toHaveLength(1);
        });

        it('搜索应不区分大小写', () => {
            const results = service.searchShares('react');
            expect(results).toHaveLength(1);
        });

        it('无匹配时应返回空数组', () => {
            const results = service.searchShares('不存在的关键词');
            expect(results).toHaveLength(0);
        });
    });

    describe('importShare', () => {
        it('应成功导入分享文件', () => {
            const content = `---
uuid: "import-uuid"
title: "导入的分享"
projectName: "项目"
sharer: "用户"
shareTime: "2026-03-15T10:00:00.000Z"
createTime: "2026-03-15T09:00:00.000Z"
contentFormat: "markdown"
---

# 导入内容`;

            const filePath = service.importShare('import-uuid', content, { shareTime: '2026-03-15T10:00:00.000Z' });
            
            expect(fs.existsSync(filePath)).toBe(true);
            expect(filePath).toContain('2026-03');
            expect(filePath).toContain('import-uuid.md');
        });

        it('导入已存在的文件应覆盖', () => {
            const content1 = `---
uuid: "overwrite-uuid"
title: "原始内容"
sharer: "用户"
shareTime: "2026-03-15T10:00:00.000Z"
createTime: "2026-03-15T09:00:00.000Z"
contentFormat: "markdown"
---
# 原始`;

            const content2 = `---
uuid: "overwrite-uuid"
title: "更新内容"
sharer: "用户"
shareTime: "2026-03-15T10:00:00.000Z"
createTime: "2026-03-15T09:00:00.000Z"
contentFormat: "markdown"
---
# 更新`;

            service.importShare('overwrite-uuid', content1, { shareTime: '2026-03-15T10:00:00.000Z' });
            const filePath = service.importShare('overwrite-uuid', content2, { shareTime: '2026-03-15T10:00:00.000Z' });
            
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            expect(fileContent).toContain('更新内容');
            expect(fileContent).not.toContain('原始内容');
        });
    });

    describe('deleteShare', () => {
        it('应成功删除存在的分享记录', async () => {
            // 先保存一条记录
            await service.saveShare({
                metadata: {
                    uuid: 'delete-me',
                    title: '要删除的分享',
                    projectName: '项目',
                    sharer: '用户',
                    shareTime: '2026-02-06T10:00:00.000Z',
                    createTime: '2026-02-06T09:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '内容'
            });

            // 确认记录存在
            expect(service.getShareByUuid('delete-me')).not.toBeNull();

            // 执行删除
            const result = service.deleteShare('delete-me');
            expect(result.success).toBe(true);

            // 确认记录已删除
            expect(service.getShareByUuid('delete-me')).toBeNull();
        });

        it('删除不存在的记录应返回失败', () => {
            const result = service.deleteShare('non-existent-uuid');
            expect(result.success).toBe(false);
            expect(result.message).toBe('会话不存在');
        });

        it('删除后 getAllShares 应不包含该记录', async () => {
            // 保存两条记录
            await service.saveShare({
                metadata: {
                    uuid: 'keep-me',
                    title: '保留的分享',
                    projectName: '项目1',
                    sharer: '用户1',
                    shareTime: '2026-02-06T10:00:00.000Z',
                    createTime: '2026-02-06T09:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '内容1'
            });

            await service.saveShare({
                metadata: {
                    uuid: 'delete-me-2',
                    title: '要删除的分享2',
                    projectName: '项目2',
                    sharer: '用户2',
                    shareTime: '2026-02-06T11:00:00.000Z',
                    createTime: '2026-02-06T10:00:00.000Z',
                    contentFormat: 'markdown'
                },
                content: '内容2'
            });

            expect(service.getAllShares()).toHaveLength(2);

            // 删除一条
            service.deleteShare('delete-me-2');

            const remaining = service.getAllShares();
            expect(remaining).toHaveLength(1);
            expect(remaining[0].uuid).toBe('keep-me');
        });
    });
});
