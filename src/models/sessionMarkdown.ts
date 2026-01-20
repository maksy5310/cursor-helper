/**
 * 会话 Markdown 视图数据模型
 */

/**
 * 会话 Markdown 视图接口
 * 表示一个会话的完整 Markdown 视图，包含会话元数据和渲染后的 Markdown 内容
 */
export interface SessionMarkdownView {
    composerId: string;              // 会话 ID
    name: string;                     // 会话名称
    markdown: string;                 // 渲染后的 Markdown 内容
    messageCount: number;             // 消息总数
    createdAt: number;                // 创建时间戳（毫秒）
    lastUpdatedAt: number;            // 最后更新时间戳（毫秒）
    unifiedMode: 'chat' | 'agent';    // 会话类型
}

/**
 * 气泡 Markdown 表示接口
 * 表示单个气泡（消息）的 Markdown 表示
 */
export interface BubbleMarkdown {
    bubbleId: string;                 // 气泡 ID
    type: 'user' | 'assistant';       // 消息类型
    text: string;                     // 消息文本（Markdown 格式）
    timestamp: number;               // 时间戳（毫秒）
    hasToolUse: boolean;             // 是否包含工具使用
    toolName?: string;               // 工具名称（如果有）
}

/**
 * Markdown 渲染选项接口
 * 配置 Markdown 渲染器的行为
 */
export interface MarkdownRendererOptions {
    includeTimestamps?: boolean;       // 是否包含时间戳（默认: true）
    includeCodeBlocks?: boolean;       // 是否包含代码块（默认: true）
    toolUsePlaceholder?: string;       // 工具使用占位符格式（默认: "[Tool Use: {name}]"）
    userMessageHeader?: string;        // 用户消息标题（默认: "## User"）
    assistantMessageHeader?: string;   // Assistant 消息标题（默认: "## Assistant"）
}

