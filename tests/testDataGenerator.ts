import { UsageStatistics, EventType, CompletionMode } from './models/usageStats';
import { AgentRecord, ConversationType } from './models/agentRecord';
import { Logger } from './utils/logger';

/**
 * 测试数据生成器
 * 用于生成测试数据，验证插件功能
 */
export class TestDataGenerator {
    /**
     * 生成测试统计数据
     */
    static generateTestUsageStatistics(count: number = 5): UsageStatistics[] {
        const stats: UsageStatistics[] = [];
        const now = new Date();

        for (let i = 0; i < count; i++) {
            const timestamp = new Date(now.getTime() - i * 1000).toISOString();
            
            // 随机生成不同类型的事件
            const eventTypes = [
                EventType.TAB_COMPLETION,
                EventType.INLINE_EDIT,
                EventType.AGENT_SUGGESTION,
                EventType.CODE_COMMIT
            ];
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

            let stat: UsageStatistics;
            
            switch (eventType) {
                case EventType.TAB_COMPLETION:
                    stat = {
                        timestamp,
                        eventType: EventType.TAB_COMPLETION,
                        mode: CompletionMode.TAB,
                        suggestionCount: Math.floor(Math.random() * 10) + 1,
                        acceptCount: Math.floor(Math.random() * 8) + 1,
                        codeLines: Math.floor(Math.random() * 20) + 1,
                        workspacePath: '/test/workspace',
                        filePath: '/test/workspace/src/test.ts'
                    };
                    break;
                case EventType.INLINE_EDIT:
                    stat = {
                        timestamp,
                        eventType: EventType.INLINE_EDIT,
                        mode: CompletionMode.CMD_K,
                        suggestionCount: Math.floor(Math.random() * 5) + 1,
                        acceptCount: Math.floor(Math.random() * 4) + 1,
                        codeLines: Math.floor(Math.random() * 30) + 5,
                        workspacePath: '/test/workspace',
                        filePath: '/test/workspace/src/test.ts'
                    };
                    break;
                case EventType.AGENT_SUGGESTION:
                    stat = {
                        timestamp,
                        eventType: EventType.AGENT_SUGGESTION,
                        mode: CompletionMode.AGENT,
                        suggestionCount: Math.floor(Math.random() * 3) + 1,
                        acceptCount: Math.floor(Math.random() * 2) + 1,
                        workspacePath: '/test/workspace'
                    };
                    break;
                case EventType.CODE_COMMIT:
                    stat = {
                        timestamp,
                        eventType: EventType.CODE_COMMIT,
                        mode: CompletionMode.TAB,
                        codeLines: Math.floor(Math.random() * 100) + 10,
                        workspacePath: '/test/workspace'
                    };
                    break;
            }
            
            stats.push(stat);
        }

        return stats;
    }

    /**
     * 生成测试 Agent 记录
     */
    static generateTestAgentRecord(): AgentRecord {
        const now = new Date();
        const sessionId = `test-session-${now.getTime()}`;

        return {
            timestamp: now.toISOString(),
            sessionId,
            conversationType: ConversationType.CHAT,
            messages: [
                {
                    role: 'user',
                    content: '请帮我实现一个用户认证功能',
                    timestamp: new Date(now.getTime() - 2000).toISOString()
                },
                {
                    role: 'assistant',
                    content: '我将为您创建一个用户认证系统，包括登录、注册和密码重置功能。',
                    timestamp: new Date(now.getTime() - 1000).toISOString()
                },
                {
                    role: 'user',
                    content: '好的，请开始实现',
                    timestamp: now.toISOString()
                }
            ],
            codeSnippets: [
                {
                    code: 'function authenticate(username: string, password: string): boolean {\n  // 认证逻辑\n  return true;\n}',
                    language: 'typescript',
                    filePath: '/test/workspace/src/auth.ts',
                    startLine: 1,
                    endLine: 5
                }
            ],
            filePaths: ['/test/workspace/src/auth.ts'],
            context: {
                workspacePath: '/test/workspace',
                activeFiles: ['/test/workspace/src/auth.ts']
            }
        };
    }

    /**
     * 生成并保存测试数据（已废弃）
     */
    static async generateAndSaveTestData(_storageManager: any, _statsCount: number = 5): Promise<void> {
        Logger.warn('Test data generation is deprecated. Data is read directly from Cursor database.');
        throw new Error('Test data generation is no longer supported');
    }
}

