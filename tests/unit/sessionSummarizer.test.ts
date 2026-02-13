/**
 * SessionSummarizer 单元测试
 */
import { describe, it, expect } from 'vitest';
import { SessionSummarizer } from '../../src/utils/sessionSummarizer';
import { AgentRecord, ConversationType } from '../../src/models/agentRecord';

function makeRecord(messages: any[], filePaths?: string[]): AgentRecord {
    return {
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        conversationType: ConversationType.AGENT,
        messages: messages.map((m, i) => ({
            role: m.role || 'user',
            content: m.content || '',
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
            metadata: m.metadata
        })),
        filePaths,
        context: { workspacePath: '/test' }
    };
}

describe('SessionSummarizer', () => {
    describe('generateSummary', () => {
        it('空记录应返回默认摘要', () => {
            const summary = SessionSummarizer.generateSummary([]);
            expect(summary.turns.total).toBe(0);
            expect(summary.mainFiles).toEqual([]);
            expect(summary.toolUsage).toEqual({});
            expect(summary.topic).toBe('');
            expect(summary.text).toContain('0 轮对话');
        });

        it('应正确统计用户和AI消息轮次', () => {
            const record = makeRecord([
                { role: 'user', content: '你好' },
                { role: 'assistant', content: '你好！' },
                { role: 'user', content: '帮我修改代码' },
                { role: 'assistant', content: '好的' }
            ]);
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.turns.user).toBe(2);
            expect(summary.turns.assistant).toBe(2);
            expect(summary.turns.total).toBe(4);
            expect(summary.text).toContain('4 轮对话');
            expect(summary.text).toContain('用户 2 条');
            expect(summary.text).toContain('AI 2 条');
        });

        it('应提取第一条用户消息作为主题', () => {
            const record = makeRecord([
                { role: 'user', content: '请帮我优化 WebUI 页面的性能问题' },
                { role: 'assistant', content: '好的' }
            ]);
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.topic).toBe('请帮我优化 WebUI 页面的性能问题');
            expect(summary.text).toContain('主题：请帮我优化 WebUI 页面的性能问题');
        });

        it('主题超过100字符应截断', () => {
            const longMsg = 'A'.repeat(150);
            const record = makeRecord([
                { role: 'user', content: longMsg },
                { role: 'assistant', content: '好的' }
            ]);
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.topic.length).toBeLessThanOrEqual(103); // 100 + '...'
            expect(summary.topic).toContain('...');
        });

        it('多行主题应只取第一行', () => {
            const record = makeRecord([
                { role: 'user', content: '第一行内容\n第二行内容\n第三行内容' },
                { role: 'assistant', content: '好的' }
            ]);
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.topic).toBe('第一行内容');
        });

        it('应从 toolFormerData 提取工具名称', () => {
            const record = makeRecord([
                { role: 'user', content: '帮我搜索代码' },
                {
                    role: 'assistant', content: '正在搜索...',
                    metadata: {
                        toolFormerData: { name: 'grep', rawArgs: { pattern: 'test' } }
                    }
                },
                {
                    role: 'assistant', content: '找到结果了',
                    metadata: {
                        toolFormerData: { name: 'read_file', params: { targetFile: 'test.ts' } }
                    }
                }
            ]);
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.toolUsage).toHaveProperty('grep');
            expect(summary.toolUsage).toHaveProperty('read_file');
            expect(summary.toolUsage['grep']).toBe(1);
            expect(summary.toolUsage['read_file']).toBe(1);
            expect(summary.text).toContain('文本搜索');
            expect(summary.text).toContain('文件读取');
        });

        it('应从 toolCallResults 提取工具名称', () => {
            const record = makeRecord([
                {
                    role: 'assistant', content: '编辑中...',
                    metadata: {
                        toolCallResults: [{ name: 'edit_file', params: { relativeWorkspacePath: 'src/app.ts' } }]
                    }
                }
            ]);
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.toolUsage).toHaveProperty('edit_file');
            expect(summary.text).toContain('文件编辑');
        });

        it('应从 metadata 工具数据中提取文件路径', () => {
            const record = makeRecord([
                {
                    role: 'assistant', content: '',
                    metadata: {
                        toolFormerData: {
                            name: 'edit_file',
                            params: JSON.stringify({ relativeWorkspacePath: 'src/utils/helper.ts' })
                        }
                    }
                },
                {
                    role: 'assistant', content: '',
                    metadata: {
                        toolFormerData: {
                            name: 'read_file',
                            rawArgs: JSON.stringify({ targetFile: 'src/models/user.ts' })
                        }
                    }
                }
            ]);
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.mainFiles).toContain('helper.ts');
            expect(summary.mainFiles).toContain('user.ts');
            expect(summary.text).toContain('helper.ts');
        });

        it('应从 record.filePaths 提取文件路径', () => {
            const record = makeRecord(
                [{ role: 'user', content: '测试' }],
                ['src/components/App.tsx', 'src/styles/main.css']
            );
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.mainFiles).toContain('App.tsx');
            expect(summary.mainFiles).toContain('main.css');
        });

        it('应合并同类工具的统计', () => {
            const record = makeRecord([
                { role: 'assistant', content: '', metadata: { toolFormerData: { name: 'edit_file' } } },
                { role: 'assistant', content: '', metadata: { toolFormerData: { name: 'edit_file_v2' } } },
                { role: 'assistant', content: '', metadata: { toolFormerData: { name: 'grep' } } },
                { role: 'assistant', content: '', metadata: { toolFormerData: { name: 'ripgrep' } } }
            ]);
            const summary = SessionSummarizer.generateSummary([record]);
            // 文本中 "文件编辑" 应合并为 2 次
            expect(summary.text).toContain('文件编辑(2次)');
            expect(summary.text).toContain('文本搜索(2次)');
        });

        it('应处理多个 AgentRecord', () => {
            const record1 = makeRecord([
                { role: 'user', content: '第一个会话的消息' },
                { role: 'assistant', content: '回复1' }
            ]);
            const record2 = makeRecord([
                { role: 'user', content: '第二个会话的消息' },
                { role: 'assistant', content: '回复2' }
            ]);
            const summary = SessionSummarizer.generateSummary([record1, record2]);
            expect(summary.turns.total).toBe(4);
            expect(summary.topic).toBe('第一个会话的消息');
        });

        it('应限制主要文件数量最多10个', () => {
            const messages = [];
            for (let i = 0; i < 15; i++) {
                messages.push({
                    role: 'assistant' as const,
                    content: '',
                    metadata: {
                        toolFormerData: {
                            name: 'read_file',
                            params: { targetFile: `src/file${i}.ts` }
                        }
                    }
                });
            }
            const record = makeRecord(messages);
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.mainFiles.length).toBeLessThanOrEqual(10);
        });

        it('空消息的记录应正常处理', () => {
            const record: AgentRecord = {
                timestamp: new Date().toISOString(),
                sessionId: 'empty-session',
                conversationType: ConversationType.CHAT,
                messages: [],
                context: { workspacePath: '/test' }
            };
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.turns.total).toBe(0);
            expect(summary.text).toContain('0 轮对话');
        });

        it('无 metadata 的消息不应出错', () => {
            const record = makeRecord([
                { role: 'user', content: '普通消息' },
                { role: 'assistant', content: '普通回复' }
            ]);
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.turns.total).toBe(2);
            expect(Object.keys(summary.toolUsage).length).toBe(0);
        });

        it('agent 角色应归为 AI 轮次', () => {
            const record = makeRecord([
                { role: 'user', content: '请求' },
                { role: 'agent', content: '代理回复' }
            ]);
            const summary = SessionSummarizer.generateSummary([record]);
            expect(summary.turns.assistant).toBe(1);
        });
    });
});
