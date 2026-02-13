/**
 * 会话摘要生成器
 * 基于规则从 AgentRecord 中自动提取关键信息生成会话概括摘要
 */
import { AgentRecord, AgentMessage } from '../models/agentRecord';

/**
 * 摘要生成结果
 */
export interface SessionSummary {
    /** 生成的摘要文本 */
    text: string;
    /** 会话轮次统计 */
    turns: { user: number; assistant: number; total: number };
    /** 涉及的主要文件 */
    mainFiles: string[];
    /** 使用的工具统计 */
    toolUsage: { [toolName: string]: number };
    /** 用户第一条消息（主题提取） */
    topic: string;
}

/**
 * 会话摘要生成器
 */
export class SessionSummarizer {
    /**
     * 从 AgentRecord 生成摘要
     */
    static generateSummary(records: AgentRecord[]): SessionSummary {
        let userCount = 0;
        let assistantCount = 0;
        const allMessages: AgentMessage[] = [];
        const fileSet = new Set<string>();
        const toolCount: { [name: string]: number } = {};
        let firstUserMessage = '';

        for (const record of records) {
            if (!record.messages) { continue; }

            for (const msg of record.messages) {
                allMessages.push(msg);

                // 统计轮次
                if (msg.role === 'user') {
                    userCount++;
                    if (!firstUserMessage && msg.content && msg.content.trim()) {
                        firstUserMessage = msg.content.trim();
                    }
                } else if (msg.role === 'assistant' || msg.role === 'agent') {
                    assistantCount++;
                }

                // 提取工具使用信息
                if (msg.metadata) {
                    const toolName = this.extractToolName(msg.metadata);
                    if (toolName) {
                        toolCount[toolName] = (toolCount[toolName] || 0) + 1;
                    }
                }

                // 从内容和 metadata 中提取文件路径
                this.extractFilePathsFromMessage(msg, fileSet);
            }

            // 从 record 的 filePaths 中提取
            if (record.filePaths) {
                for (const fp of record.filePaths) {
                    const shortName = this.getShortFileName(fp);
                    if (shortName) { fileSet.add(shortName); }
                }
            }
        }

        // 提取主题（第一条用户消息的前 100 个字符）
        let topic = firstUserMessage;
        if (topic.length > 100) {
            topic = topic.substring(0, 100) + '...';
        }
        // 清理多行内容，只保留第一行
        const firstLine = topic.split('\n')[0].trim();
        if (firstLine) {
            topic = firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
        }

        const mainFiles = Array.from(fileSet).slice(0, 10); // 最多显示10个文件

        // 生成摘要文本
        const text = this.buildSummaryText(
            userCount,
            assistantCount,
            mainFiles,
            toolCount,
            topic
        );

        return {
            text,
            turns: { user: userCount, assistant: assistantCount, total: userCount + assistantCount },
            mainFiles,
            toolUsage: toolCount,
            topic
        };
    }

    /**
     * 从 metadata 中提取工具名称
     */
    private static extractToolName(metadata: Record<string, any>): string | null {
        // 检查 toolFormerData
        if (metadata.toolFormerData && typeof metadata.toolFormerData === 'object') {
            const tfd = metadata.toolFormerData;
            return tfd.name || tfd.toolName || tfd.tool_name || tfd.functionName || null;
        }
        // 检查 toolCallResults
        if (metadata.toolCallResults && Array.isArray(metadata.toolCallResults) && metadata.toolCallResults.length > 0) {
            const first = metadata.toolCallResults[0];
            return first.name || first.toolName || first.tool_name || first.functionName || null;
        }
        // 检查 capabilities
        if (metadata.capabilities && Array.isArray(metadata.capabilities) && metadata.capabilities.length > 0) {
            const first = metadata.capabilities[0];
            return first.name || first.toolName || null;
        }
        return null;
    }

    /**
     * 从消息中提取文件路径
     */
    private static extractFilePathsFromMessage(msg: AgentMessage, fileSet: Set<string>): void {
        // 从 metadata 的工具数据中提取文件路径
        if (msg.metadata) {
            const paths = this.extractPathsFromToolData(msg.metadata);
            for (const p of paths) {
                const shortName = this.getShortFileName(p);
                if (shortName) { fileSet.add(shortName); }
            }
        }
    }

    /**
     * 从工具数据中提取文件路径
     */
    private static extractPathsFromToolData(metadata: Record<string, any>): string[] {
        const paths: string[] = [];

        const extractFrom = (data: any) => {
            if (!data || typeof data !== 'object') { return; }
            // 检查常见的路径字段
            const pathFields = ['relativeWorkspacePath', 'filePath', 'file_path', 'targetFile', 'target_file', 'path'];
            for (const field of pathFields) {
                if (data[field] && typeof data[field] === 'string') {
                    paths.push(data[field]);
                }
            }
            // 检查 rawArgs 和 params
            if (data.rawArgs) {
                const rawArgs = typeof data.rawArgs === 'string' ? this.safeParse(data.rawArgs) : data.rawArgs;
                if (rawArgs && typeof rawArgs === 'object') {
                    for (const field of pathFields) {
                        if (rawArgs[field] && typeof rawArgs[field] === 'string') {
                            paths.push(rawArgs[field]);
                        }
                    }
                }
            }
            if (data.params) {
                const params = typeof data.params === 'string' ? this.safeParse(data.params) : data.params;
                if (params && typeof params === 'object') {
                    for (const field of pathFields) {
                        if (params[field] && typeof params[field] === 'string') {
                            paths.push(params[field]);
                        }
                    }
                }
            }
        };

        if (metadata.toolFormerData) { extractFrom(metadata.toolFormerData); }
        if (metadata.toolCallResults && Array.isArray(metadata.toolCallResults)) {
            for (const tcr of metadata.toolCallResults) { extractFrom(tcr); }
        }

        return paths;
    }

    /**
     * 安全 JSON 解析
     */
    private static safeParse(str: string): any {
        try { return JSON.parse(str); } catch { return null; }
    }

    /**
     * 获取文件短名（只保留文件名，不含完整路径）
     */
    private static getShortFileName(fullPath: string): string | null {
        if (!fullPath || typeof fullPath !== 'string') { return null; }
        const name = fullPath.split(/[/\\]/).pop() || '';
        // 过滤掉不像文件名的字符串
        if (!name || name.length > 100 || name === 'Unknown' || name === 'Unknown file') { return null; }
        return name;
    }

    /**
     * 将工具名称转换为中文描述
     */
    private static getToolDisplayName(toolName: string): string {
        const toolNameMap: { [key: string]: string } = {
            'edit_file': '文件编辑',
            'edit_file_v2': '文件编辑',
            'read_file': '文件读取',
            'read_file_v2': '文件读取',
            'list_dir': '目录浏览',
            'list_dir_v2': '目录浏览',
            'grep': '文本搜索',
            'ripgrep': '文本搜索',
            'ripgrep_raw_search': '文本搜索',
            'codebase_search': '代码搜索',
            'semantic_search_full': '语义搜索',
            'web_search': '网络搜索',
            'web_fetch': '网页抓取',
            'run_terminal_cmd': '终端命令',
            'run_terminal_command': '终端命令',
            'run_terminal_command_v2': '终端命令',
            'todo_write': '任务管理',
            'create_plan': '创建计划',
            'delete_file': '文件删除',
            'apply_patch': '应用补丁',
            'read_lints': 'Lint检查',
            'glob_file_search': '文件搜索',
            'fetch_pull_request': 'PR获取'
        };
        return toolNameMap[toolName.toLowerCase()] || toolName;
    }

    /**
     * 构建摘要文本
     */
    private static buildSummaryText(
        userCount: number,
        assistantCount: number,
        mainFiles: string[],
        toolCount: { [name: string]: number },
        topic: string
    ): string {
        const parts: string[] = [];

        // 1. 对话轮次
        const totalTurns = userCount + assistantCount;
        parts.push(`本会话包含 ${totalTurns} 轮对话（用户 ${userCount} 条，AI ${assistantCount} 条）。`);

        // 2. 主要涉及的文件
        if (mainFiles.length > 0) {
            const filesDisplay = mainFiles.slice(0, 5).map(f => f).join('、');
            const extra = mainFiles.length > 5 ? ` 等 ${mainFiles.length} 个文件` : '';
            parts.push(`主要涉及 ${filesDisplay}${extra} 的操作。`);
        }

        // 3. 工具使用统计
        const toolEntries = Object.entries(toolCount);
        if (toolEntries.length > 0) {
            // 合并同类工具
            const displayMap: { [displayName: string]: number } = {};
            for (const [name, count] of toolEntries) {
                const displayName = this.getToolDisplayName(name);
                displayMap[displayName] = (displayMap[displayName] || 0) + count;
            }
            const toolParts = Object.entries(displayMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => `${name}(${count}次)`);
            parts.push(`主要操作：${toolParts.join('、')}。`);
        }

        // 4. 主题
        if (topic) {
            parts.push(`主题：${topic}`);
        }

        return parts.join('\n');
    }
}
