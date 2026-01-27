/**
 * Agent 对话记录模型
 */

/**
 * 对话类型枚举
 */
export enum ConversationType {
    CHAT = "chat",                  // 普通聊天
    AGENT = "agent"                 // Agent 模式
}

/**
 * Agent 消息接口
 */
export interface AgentMessage {
    role: "user" | "assistant" | "agent" | "system";  // 消息角色（assistant 用于普通聊天，agent 用于 Agent 模式）
    content: string;                     // 消息内容
    timestamp: string;                   // 消息时间戳
    metadata?: Record<string, any>;     // 元数据（可选）
}

/**
 * 代码片段接口
 */
export interface CodeSnippet {
    code: string;                    // 代码内容
    language?: string;               // 编程语言
    filePath?: string;               // 文件路径
    startLine?: number;              // 起始行号
    endLine?: number;                 // 结束行号
}

/**
 * Agent 上下文接口
 */
export interface AgentContext {
    workspacePath: string;          // 工作空间路径
    activeFiles?: string[];          // 活动文件列表
    projectStructure?: string[];     // 项目结构（可选）
    environment?: Record<string, string>;  // 环境变量（可选）
    composerData?: any;              // 完整的 composer 数据（用于指标提取）
}

/**
 * Agent 统计信息接口
 */
export interface AgentStatistics {
    suggestionCount: number;         // 建议次数
    acceptCount: number;             // 采纳次数
    totalMessages: number;            // 总消息数
    totalCodeLines: number;          // 总代码行数
}

/**
 * Agent 对话记录接口
 */
export interface AgentRecord {
    timestamp: string;              // ISO 8601 格式时间戳
    sessionId: string;              // 会话 ID
    conversationType: ConversationType;  // 对话类型（普通聊天或 Agent 模式）
    messages: AgentMessage[];        // 消息列表
    codeSnippets?: CodeSnippet[];   // 代码片段列表（可选）
    filePaths?: string[];            // 涉及的文件路径列表（可选）
    context: AgentContext;           // 对话上下文
    statistics?: AgentStatistics;    // 统计信息（可选，主要用于 Agent 模式）
}

/**
 * 验证时间戳格式
 */
function validateTimestamp(timestamp: string): boolean {
    try {
        const date = new Date(timestamp);
        return !isNaN(date.getTime()) && date.toISOString() === timestamp;
    } catch {
        return false;
    }
}

/**
 * 验证对话类型
 */
export function validateConversationType(type: string): type is ConversationType {
    return Object.values(ConversationType).includes(type as ConversationType);
}

/**
 * 验证消息角色
 */
function validateMessageRole(role: string): role is AgentMessage['role'] {
    return ['user', 'assistant', 'agent', 'system'].includes(role);
}

/**
 * 验证 Agent 消息
 */
function validateAgentMessage(message: any): message is AgentMessage {
    if (!message || typeof message !== 'object') {
        return false;
    }

    if (!validateMessageRole(message.role)) {
        return false;
    }

    if (typeof message.content !== 'string' || message.content.length === 0) {
        return false;
    }

    if (!validateTimestamp(message.timestamp)) {
        return false;
    }

    return true;
}

/**
 * 验证 Agent 对话记录
 */
export function validateAgentRecord(record: any): record is AgentRecord {
    if (!record || typeof record !== 'object') {
        return false;
    }

    // 验证必需字段
    if (!validateTimestamp(record.timestamp)) {
        return false;
    }

    if (typeof record.sessionId !== 'string' || record.sessionId.length === 0) {
        return false;
    }

    if (!validateConversationType(record.conversationType)) {
        return false;
    }

    if (!Array.isArray(record.messages) || record.messages.length === 0) {
        return false;
    }

    // 验证所有消息
    for (const message of record.messages) {
        if (!validateAgentMessage(message)) {
            return false;
        }
    }

    // 验证上下文
    if (!record.context || typeof record.context !== 'object') {
        return false;
    }

    if (typeof record.context.workspacePath !== 'string' || record.context.workspacePath.length === 0) {
        return false;
    }

    // 验证统计信息（如果存在）
    if (record.statistics) {
        if (typeof record.statistics.suggestionCount !== 'number' ||
            typeof record.statistics.acceptCount !== 'number' ||
            typeof record.statistics.totalMessages !== 'number' ||
            typeof record.statistics.totalCodeLines !== 'number') {
            return false;
        }

        if (record.statistics.suggestionCount < 0 || record.statistics.acceptCount < 0) {
            return false;
        }
    }

    return true;
}

