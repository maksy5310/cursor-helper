import { UsageStatistics } from '../models/usageStats';
import { AgentRecord } from '../models/agentRecord';
import { DatabaseAccess } from './databaseAccess';
import { Logger } from '../utils/logger';
import { WorkspaceInfo } from '../utils/workspaceHelper';

/**
 * 数据访问方式枚举
 */
export enum AccessMethod {
    DATABASE = "database",
    UNKNOWN = "unknown"
}

/**
 * 数据访问接口
 */
export interface IDataAccess {
    /**
     * 初始化数据访问层
     */
    initialize(): Promise<void>;

    /**
     * 获取使用统计数据
     * @param startTime 起始时间（可选）
     * @param endTime 结束时间（可选）
     */
    getUsageStatistics(startTime?: Date, endTime?: Date): Promise<UsageStatistics[]>;

    /**
     * 获取 Agent 对话记录（包括普通聊天和 Agent 模式）
     * @param sessionId 会话 ID（可选）
     */
    getAgentRecords(sessionId?: string): Promise<AgentRecord[]>;

    /**
     * 检查数据访问是否可用
     */
    isAvailable(): boolean;

    /**
     * 获取当前使用的访问方式
     */
    getAccessMethod(): AccessMethod;
}

/**
 * 数据访问类
 * 仅使用数据库访问方式
 */
export class DataAccess implements IDataAccess {
    private currentMethod: AccessMethod = AccessMethod.UNKNOWN;
    private databaseAccess: DatabaseAccess;
    private initialized: boolean = false;

    constructor() {
        this.databaseAccess = new DatabaseAccess();
    }

    /**
     * 初始化数据访问层
     * 仅使用数据库访问方式
     * @param workspaceInfoOrPath 工作空间信息或路径（可选），用于匹配正确的工作空间数据库
     */
    async initialize(workspaceInfoOrPath?: WorkspaceInfo | string): Promise<void> {
        if (this.initialized) {
            return;
        }

        Logger.info('Initializing data access layer (database only)...');

        // 尝试数据库访问
        try {
            await this.databaseAccess.initialize(workspaceInfoOrPath);
            if (this.databaseAccess.isAvailable()) {
                this.currentMethod = AccessMethod.DATABASE;
                Logger.info('Using database access method');
                this.initialized = true;
                return;
            }
        } catch (error) {
            Logger.error('Database access failed', error as Error);
        }

        Logger.warn('Database access not available');
        this.initialized = true;
    }

    /**
     * 获取使用统计数据
     */
    async getUsageStatistics(startTime?: Date, endTime?: Date): Promise<UsageStatistics[]> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.currentMethod !== AccessMethod.DATABASE) {
            Logger.warn('Database access not available, returning empty array');
            return [];
        }

        try {
            return await this.databaseAccess.getUsageStatistics(startTime, endTime);
        } catch (error) {
            Logger.error('Failed to get usage statistics', error as Error);
            return [];
        }
    }

    /**
     * 获取 Agent 对话记录
     */
    async getAgentRecords(sessionId?: string): Promise<AgentRecord[]> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.currentMethod !== AccessMethod.DATABASE) {
            Logger.warn('Database access not available, returning empty array');
            return [];
        }

        try {
            return await this.databaseAccess.getAgentRecords(sessionId);
        } catch (error) {
            Logger.error('Failed to get agent records', error as Error);
            return [];
        }
    }

    /**
     * 检查数据访问是否可用
     */
    isAvailable(): boolean {
        return this.currentMethod !== AccessMethod.UNKNOWN;
    }

    /**
     * 获取当前使用的访问方式
     */
    getAccessMethod(): AccessMethod {
        return this.currentMethod;
    }

    /**
     * 获取内部的 DatabaseAccess 实例（用于会话列表 panel）
     */
    getDatabaseAccess(): DatabaseAccess {
        return this.databaseAccess;
    }
}

