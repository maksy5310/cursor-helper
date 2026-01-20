/**
 * 使用统计数据模型
 */

/**
 * 事件类型枚举
 */
export enum EventType {
    TAB_COMPLETION = "tab_completion",           // Tab键自动补全
    INLINE_EDIT = "inline_edit",                  // cmd+K 行内自动补全
    AGENT_SUGGESTION = "agent_suggestion",        // Agent 建议
    CODE_COMMIT = "code_commit"                   // 代码提交
}

/**
 * 代码辅助模式枚举
 */
export enum CompletionMode {
    TAB = "tab",                    // Tab键自动补全模式
    CMD_K = "cmd_k",                // cmd+K 行内自动补全模式
    AGENT = "agent"                 // Agent 对话模式
}

/**
 * 使用统计数据接口
 */
export interface UsageStatistics {
    timestamp: string;              // ISO 8601 格式时间戳
    eventType: EventType;            // 事件类型
    mode: CompletionMode;            // 代码辅助模式
    suggestionCount?: number;        // 建议次数（可选）
    acceptCount?: number;            // 采纳次数（可选）
    codeLines?: number;              // 代码行数（可选）
    workspacePath?: string;          // 工作空间路径（可选）
    filePath?: string;               // 文件路径（可选）
}

/**
 * 验证时间戳格式
 */
export function validateTimestamp(timestamp: string): boolean {
    try {
        const date = new Date(timestamp);
        return !isNaN(date.getTime()) && date.toISOString() === timestamp;
    } catch {
        return false;
    }
}

/**
 * 验证事件类型
 */
export function validateEventType(eventType: string): eventType is EventType {
    return Object.values(EventType).includes(eventType as EventType);
}

/**
 * 验证代码辅助模式
 */
export function validateCompletionMode(mode: string): mode is CompletionMode {
    return Object.values(CompletionMode).includes(mode as CompletionMode);
}

/**
 * 验证使用统计数据
 */
export function validateUsageStatistics(data: any): data is UsageStatistics {
    if (!data || typeof data !== 'object') {
        return false;
    }

    // 验证必需字段
    if (!validateTimestamp(data.timestamp)) {
        return false;
    }

    if (!validateEventType(data.eventType)) {
        return false;
    }

    if (!validateCompletionMode(data.mode)) {
        return false;
    }

    // 根据事件类型验证可选字段
    switch (data.eventType) {
        case EventType.TAB_COMPLETION:
        case EventType.INLINE_EDIT:
            if (typeof data.suggestionCount !== 'number' ||
                typeof data.acceptCount !== 'number' ||
                typeof data.codeLines !== 'number') {
                return false;
            }
            break;
        case EventType.AGENT_SUGGESTION:
            if (typeof data.suggestionCount !== 'number' ||
                typeof data.acceptCount !== 'number') {
                return false;
            }
            break;
        case EventType.CODE_COMMIT:
            if (typeof data.codeLines !== 'number') {
                return false;
            }
            break;
    }

    return true;
}

