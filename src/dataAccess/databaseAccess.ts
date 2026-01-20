import { UsageStatistics, EventType, CompletionMode } from '../models/usageStats';
import { AgentRecord, ConversationType } from '../models/agentRecord';
import { Logger } from '../utils/logger';
import { SQLiteAccess } from './sqliteAccess';
import { CursorDataLocator } from '../utils/cursorDataLocator';
import { WorkspaceInfo } from '../utils/workspaceHelper';
import * as path from 'path';

/**
 * 会话记录类型
 * 从Cursor数据库读取的会话信息
 */
export interface SessionRecord {
    composerId: string;
    name: string;
    lastUpdatedAt: number;
    createdAt: number;
    unifiedMode: 'chat' | 'agent';
    workspacePath?: string;
}

/**
 * 数据库访问接口
 */
export interface IDatabaseAccess {
    connect(): Promise<void>;
    query(sql: string, params?: any[]): Promise<any[]>;
    close(): Promise<void>;
    isAvailable(): boolean;
}

/**
 * 数据库访问实现
 * 访问 Cursor 的内部数据库（SQLite）
 * 协调工作空间数据库和全局数据库的访问
 */
export class DatabaseAccess implements IDatabaseAccess {
    private connected: boolean = false;
    private workspaceDb: SQLiteAccess | null = null;
    private globalDb: SQLiteAccess | null = null;
    private workspaceDbPath: string | null = null;
    private globalDbPath: string | null = null;

    /**
     * 初始化数据库连接
     * @param workspaceInfoOrPath 工作空间信息或路径（可选），用于匹配正确的工作空间数据库
     */
    async initialize(workspaceInfoOrPath?: WorkspaceInfo | string): Promise<void> {
        try {
            // 获取全局数据库路径
            this.globalDbPath = CursorDataLocator.getGlobalDatabasePath();
            
            // 确定工作空间路径
            let workspacePath: string | undefined;
            if (workspaceInfoOrPath) {
                if (typeof workspaceInfoOrPath === 'string') {
                    // 向后兼容：字符串路径
                    workspacePath = workspaceInfoOrPath;
                } else {
                    // 新方式：WorkspaceInfo对象
                    if (workspaceInfoOrPath.databasePath) {
                        // 如果WorkspaceInfo已经包含数据库路径，直接使用
                        this.workspaceDbPath = workspaceInfoOrPath.databasePath;
                    } else {
                        // 否则根据工作空间类型选择路径
                        if (workspaceInfoOrPath.type === 'multi-root' && workspaceInfoOrPath.workspaceFile) {
                            workspacePath = workspaceInfoOrPath.workspaceFile;
                        } else if (workspaceInfoOrPath.folders.length > 0) {
                            workspacePath = workspaceInfoOrPath.folders[0].path;
                        }
                    }
                }
            }
            
            // 如果还没有工作空间数据库路径，尝试匹配
            if (!this.workspaceDbPath && workspacePath) {
                this.workspaceDbPath = await CursorDataLocator.getWorkspaceDatabasePath(undefined, workspacePath);
            }
            
            if (!this.workspaceDbPath) {
                Logger.warn('Workspace database not found, will only use global database');
                if (workspacePath) {
                    Logger.debug(`Workspace path was: ${workspacePath}`);
                }
            } else {
                Logger.info(`Workspace database found: ${this.workspaceDbPath}`);
            }

            // 初始化全局数据库
            this.globalDb = new SQLiteAccess(this.globalDbPath);
            await this.globalDb.connect();

            // 初始化工作空间数据库（如果存在）
            if (this.workspaceDbPath) {
                this.workspaceDb = new SQLiteAccess(this.workspaceDbPath);
                await this.workspaceDb.connect();
            }

            this.connected = true;
            Logger.info('Database access initialized successfully');
        } catch (error) {
            Logger.error('Failed to initialize database access', error as Error);
            this.connected = false;
            throw error;
        }
    }

    /**
     * 连接数据库
     */
    async connect(): Promise<void> {
        if (this.connected) {
            return;
        }

        await this.initialize();
    }

    /**
     * 执行查询（使用全局数据库）
     */
    async query(sql: string, params?: any[]): Promise<any[]> {
        if (!this.connected || !this.globalDb) {
            throw new Error('Database not connected');
        }

        return this.globalDb.query(sql, params);
    }

    /**
     * 关闭数据库连接
     */
    async close(): Promise<void> {
        if (this.workspaceDb) {
            this.workspaceDb.close();
            this.workspaceDb = null;
        }

        if (this.globalDb) {
            this.globalDb.close();
            this.globalDb = null;
        }

        this.connected = false;
        Logger.info('Database connections closed');
    }

    /**
     * 检查数据库是否可用
     */
    isAvailable(): boolean {
        return this.connected && this.globalDb !== null;
    }

    /**
     * 获取使用统计数据
     * 从 composer 和 bubble 数据中提取统计信息
     */
    async getUsageStatistics(startTime?: Date, endTime?: Date): Promise<UsageStatistics[]> {
        if (!this.connected) {
            throw new Error('Database not connected');
        }

        try {
            // 1. 从工作空间数据库获取 composer 列表
            let composerList: any = null;
            if (this.workspaceDb) {
                composerList = await this.workspaceDb.getComposerList();
            }

            if (!composerList || !composerList.allComposers) {
                Logger.warn('No composer list found');
                return [];
            }

            // 2. 从全局数据库获取每个 composer 的统计数据
            const statistics: UsageStatistics[] = [];
            const composerIds = composerList.allComposers.map((c: any) => c.composerId);

            if (!this.globalDb) {
                Logger.error('Global database not available');
                return [];
            }

            // 批量获取 composer 数据
            const composerDataMap = await this.globalDb.getMultipleComposerData(composerIds);

            // 3. 提取统计信息
            for (const composer of composerList.allComposers) {
                const composerData = composerDataMap.get(composer.composerId);
                if (!composerData) {
                    continue;
                }

                // 过滤时间范围
                const createdAt = new Date(composer.createdAt);
                if (startTime && createdAt < startTime) {
                    continue;
                }
                if (endTime && createdAt > endTime) {
                    continue;
                }

                // 确定事件类型和模式
                const unifiedMode = composer.unifiedMode || 'chat';
                const eventType = unifiedMode === 'agent' ? EventType.AGENT_SUGGESTION : EventType.TAB_COMPLETION;
                const mode = unifiedMode === 'agent' ? CompletionMode.AGENT : CompletionMode.TAB;

                // 提取统计信息
                const stats: UsageStatistics = {
                    timestamp: createdAt.toISOString(),
                    eventType: eventType,
                    mode: mode,
                    suggestionCount: 0, // TODO: 从 bubble 数据中提取实际建议次数
                    acceptCount: 0, // TODO: 从 bubble 数据中提取实际采纳次数
                    codeLines: (composer.totalLinesAdded || 0) + (composer.totalLinesRemoved || 0),
                    workspacePath: composerData.context?.workspacePath || undefined
                };

                statistics.push(stats);
            }

            return statistics;
        } catch (error) {
            Logger.error('Failed to get usage statistics', error as Error);
            return [];
        }
    }

    /**
     * 获取会话列表（用于会话列表 panel）
     * 从工作空间数据库读取 composer 列表
     * @param workspaceInfo 可选的工作空间信息，如果未提供则使用当前初始化的工作空间数据库
     */
    async getSessionList(workspaceInfo?: WorkspaceInfo): Promise<SessionRecord[]> {
        if (!this.connected) {
            Logger.warn('Database not connected when calling getSessionList');
            throw new Error('Database not connected');
        }

        try {
            // 如果提供了workspaceInfo且包含数据库路径，可能需要重新初始化
            let workspaceDb = this.workspaceDb;
            if (workspaceInfo && workspaceInfo.databasePath && workspaceInfo.databasePath !== this.workspaceDbPath) {
                // 工作空间已切换，需要重新连接数据库
                Logger.debug(`Workspace changed, reconnecting to: ${workspaceInfo.databasePath}`);
                const newWorkspaceDb = new SQLiteAccess(workspaceInfo.databasePath);
                await newWorkspaceDb.connect();
                workspaceDb = newWorkspaceDb;
            }

            if (!workspaceDb) {
                Logger.warn('Workspace database not available for session list');
                return [];
            }

            // 减少日志输出，只在必要时记录
            // Logger.debug('Reading composer list from workspace database...');
            
            // 从工作空间数据库读取 composer 列表
            const composerList = await workspaceDb.getComposerList();
            
            if (!composerList) {
                Logger.warn('composerList is null or undefined');
                return [];
            }
            
            if (!composerList.allComposers) {
                Logger.warn('composerList.allComposers is missing or empty');
                return [];
            }

            // 只在首次加载或数量变化时记录
            // Logger.info(`Found ${composerList.allComposers.length} composers in database`);

            // 转换为会话列表项
            const sessions: SessionRecord[] = composerList.allComposers
                .map((composer: any) => {
                    const lastUpdatedAt = composer.lastUpdatedAt || composer.createdAt || 0;
                    const createdAt = composer.createdAt || lastUpdatedAt || 0;
                    return {
                        composerId: composer.composerId || 'unknown',
                        name: composer.name || composer.subtitle || `Session ${(composer.composerId || 'unknown').substring(0, 8)}`,
                        lastUpdatedAt: typeof lastUpdatedAt === 'number' ? lastUpdatedAt : (typeof lastUpdatedAt === 'string' ? new Date(lastUpdatedAt).getTime() : 0),
                        createdAt: typeof createdAt === 'number' ? createdAt : (typeof createdAt === 'string' ? new Date(createdAt).getTime() : 0),
                        unifiedMode: (composer.unifiedMode || 'chat') as 'chat' | 'agent',
                        workspacePath: this.workspaceDbPath || undefined
                    };
                })
                .filter((item: any) => {
                    // 静默过滤无效数据，不记录日志
                    return item.lastUpdatedAt > 0 && item.composerId !== 'unknown';
                }) // 过滤无效数据
                .sort((a: any, b: any) => b.lastUpdatedAt - a.lastUpdatedAt); // 按最后更新时间降序排序

            // 只在首次加载或数量变化时记录
            // Logger.info(`Converted ${sessions.length} valid sessions from ${composerList.allComposers.length} composers`);
            
            // 只在没有会话且是首次加载时记录警告
            // if (sessions.length === 0) {
            //     Logger.debug('No valid sessions found. This may be normal if no conversations exist yet.');
            // }
            
            return sessions;
        } catch (error) {
            Logger.error('Failed to get session list', error as Error);
            if (error instanceof Error && error.stack) {
                Logger.error(`Stack trace: ${error.stack}`);
            }
            return [];
        }
    }

    /**
     * 获取 Agent 对话记录
     * 从 composer 和 bubble 数据构建完整的对话记录
     */
    async getAgentRecords(sessionId?: string): Promise<AgentRecord[]> {
        if (!this.connected) {
            throw new Error('Database not connected');
        }

        try {
            // 1. 从工作空间数据库获取 composer 列表
            let composerList: any = null;
            if (this.workspaceDb) {
                composerList = await this.workspaceDb.getComposerList();
            }

            if (!composerList || !composerList.allComposers) {
                Logger.warn('No composer list found');
                return [];
            }

            // 2. 过滤特定的 session（如果提供）
            let composers = composerList.allComposers;
            if (sessionId) {
                composers = composers.filter((c: any) => c.composerId === sessionId);
            }

            if (!this.globalDb) {
                Logger.error('Global database not available');
                return [];
            }

            // 3. 获取每个 composer 的完整数据
            const records: AgentRecord[] = [];

            for (const composer of composers) {
                const composerData = await this.globalDb.getComposerData(composer.composerId);
                if (!composerData) {
                    continue;
                }

                // 4. 获取所有相关的 bubble 数据
                const bubbleHeaders = composerData.fullConversationHeadersOnly || [];
                const bubbleIds = bubbleHeaders.map((h: any) => h.bubbleId).filter((id: string) => id);

                const bubbleDataMap = await this.globalDb.getMultipleBubbleData(
                    composer.composerId,
                    bubbleIds
                );

                // 5. 构建 AgentRecord
                const bubbles = Array.from(bubbleDataMap.values())
                    .sort((a: any, b: any) => {
                        const timeA = new Date(a.createdAt || 0).getTime();
                        const timeB = new Date(b.createdAt || 0).getTime();
                        return timeA - timeB;
                    });

                // 提取代码片段和文件路径
                const codeSnippets: any[] = [];
                const filePaths = new Set<string>();

                for (const bubble of bubbles) {
                    // 提取代码块
                    if (bubble.codeBlocks && Array.isArray(bubble.codeBlocks)) {
                        for (const cb of bubble.codeBlocks) {
                            codeSnippets.push({
                                code: cb.content || '',
                                language: cb.languageId || '',
                                filePath: cb.filePath,
                                startLine: cb.startLine,
                                endLine: cb.endLine
                            });
                        }
                    }

                    // 提取文件路径
                    if (bubble.fileLinks && Array.isArray(bubble.fileLinks)) {
                        for (const link of bubble.fileLinks) {
                            try {
                                const linkObj = typeof link === 'string' ? JSON.parse(link) : link;
                                if (linkObj.relativeWorkspacePath) {
                                    filePaths.add(linkObj.relativeWorkspacePath);
                                }
                            } catch {
                                // 忽略解析错误
                            }
                        }
                    }

                    if (bubble.allAttachedFileCodeChunksUris && Array.isArray(bubble.allAttachedFileCodeChunksUris)) {
                        for (const uri of bubble.allAttachedFileCodeChunksUris) {
                            if (typeof uri === 'string') {
                                // 解析 file:// URI
                                try {
                                    const decoded = decodeURIComponent(uri.replace('file:///', ''));
                                    filePaths.add(decoded);
                                } catch {
                                    filePaths.add(uri);
                                }
                            }
                        }
                    }
                }

                // 确定对话类型
                const unifiedMode = composer.unifiedMode || 'chat';
                const conversationType = unifiedMode === 'agent' ? ConversationType.AGENT : ConversationType.CHAT;

                // 构建消息列表
                // 显式判断气泡类型：type === 1 为用户消息，type === 2 为 assistant 消息
                const messages = bubbles.map((bubble: any) => {
                    // 显式检查气泡类型
                    if (!bubble || typeof bubble !== 'object') {
                        Logger.warn('Invalid bubble data: bubble is not an object');
                        return null;
                    }

                    // 判断消息类型：type === 1 为用户消息，type === 2 为 assistant 消息
                    const bubbleType = bubble.type;
                    let role: 'user' | 'assistant' | 'agent' | 'system';
                    
                    if (bubbleType === 1) {
                        role = 'user';
                    } else if (bubbleType === 2) {
                        // type === 2 为 assistant 消息，根据 unifiedMode 确定是 agent 还是 assistant
                        role = unifiedMode === 'agent' ? 'agent' : 'assistant';
                    } else {
                        // 未知类型，记录警告并使用默认值
                        Logger.warn(`Unknown bubble type: ${bubbleType}, defaulting to assistant`);
                        role = unifiedMode === 'agent' ? 'agent' : 'assistant';
                    }

                    return {
                        role: role,
                        content: bubble.text || '',
                        timestamp: new Date(bubble.createdAt || composer.createdAt).toISOString(),
                        metadata: {
                            bubbleId: bubble.bubbleId,
                            tokenCount: bubble.tokenCount || { inputTokens: 0, outputTokens: 0 },
                            type: bubbleType, // 保留原始类型值
                            capabilities: bubble.capabilities,
                            toolCallResults: bubble.toolCallResults,
                            toolFormerData: bubble.toolFormerData
                        }
                    };
                }).filter((msg): msg is NonNullable<typeof msg> => msg !== null); // 过滤掉 null 值

                const record: AgentRecord = {
                    timestamp: new Date(composer.createdAt).toISOString(),
                    sessionId: composer.composerId,
                    conversationType: conversationType,
                    messages: messages,
                    codeSnippets: codeSnippets.length > 0 ? codeSnippets : undefined,
                    filePaths: Array.from(filePaths).length > 0 ? Array.from(filePaths) : undefined,
                    context: {
                        workspacePath: composerData.context?.workspacePath || '',
                        activeFiles: composerData.allAttachedFileCodeChunksUris || undefined
                    },
                    statistics: {
                        suggestionCount: bubbles.filter((b: any) => b.type === 2).length,
                        acceptCount: 0, // TODO: 需要从代码块应用状态中提取
                        totalMessages: messages.length,
                        totalCodeLines: codeSnippets.reduce((sum, cs) => {
                            return sum + (cs.code ? cs.code.split('\n').length : 0);
                        }, 0)
                    }
                };

                records.push(record);
            }

            return records;
        } catch (error) {
            Logger.error('Failed to get agent records', error as Error);
            return [];
        }
    }
}

