import { AgentRecord } from '../models/agentRecord';
import { MarkdownRendererOptions } from '../models/sessionMarkdown';
import { SessionMetricsExtractor } from '../models/sessionMetrics';
import { Logger } from '../utils/logger';

/**
 * Markdown 渲染器接口
 */
export interface IMarkdownRenderer {
    /**
     * 渲染会话为 Markdown
     * @param agentRecord Agent 对话记录（包含完整的会话数据）
     * @param options 渲染选项（可选）
     * @returns 渲染后的 Markdown 字符串
     */
    renderSession(agentRecord: AgentRecord, options?: MarkdownRendererOptions): Promise<string>;

    /**
     * 渲染单个气泡为 Markdown
     * @param bubble 气泡数据
     * @param options 渲染选项（可选）
     * @returns 渲染后的 Markdown 字符串片段
     */
    renderBubble(bubble: any, options?: MarkdownRendererOptions): string;

    /**
     * 转义 Markdown 特殊字符
     * @param text 原始文本
     * @returns 转义后的文本
     */
    escapeMarkdown(text: string): string;
}

/**
 * Markdown 渲染器实现
 * 负责将会话数据（AgentRecord）转换为 Markdown 格式的字符串
 */
export class MarkdownRenderer implements IMarkdownRenderer {
    private defaultOptions: Required<MarkdownRendererOptions> = {
        includeTimestamps: false,
        includeCodeBlocks: true,
        toolUsePlaceholder: "[Tool Use: {name}]",
        userMessageHeader: "## User",
        assistantMessageHeader: "## Assistant"
    };

    /**
     * 生成会话指标表格
     * @param agentRecord Agent 对话记录
     * @returns Markdown 格式的指标表格
     */
    private generateMetricsTable(agentRecord: AgentRecord): string {
        try {
            // 从agentRecord的context中获取composerData
            const composerData = agentRecord.context?.composerData;
            
            if (!composerData) {
                Logger.warn('No composerData found in agentRecord, metrics will be limited');
                return '*No session metrics available*';
            }

            // 提取指标
            const metrics = SessionMetricsExtractor.extractMetrics(composerData);
            
            // 生成指标表格
            return SessionMetricsExtractor.generateMetricsTable(metrics);
        } catch (error) {
            Logger.error('Failed to generate metrics table', error as Error);
            return '*Failed to generate metrics*';
        }
    }

    /**
     * 转义 Markdown 特殊字符
     * @param text 原始文本
     * @returns 转义后的文本
     */
    escapeMarkdown(text: string): string {
        if (!text) {
            return '';
        }

        // 转义 Markdown 特殊字符
        return text
            .replace(/\\/g, '\\\\')      // 反斜杠
            .replace(/`/g, '\\`')         // 反引号
            .replace(/\*/g, '\\*')        // 星号
            .replace(/_/g, '\\_')         // 下划线
            .replace(/\[/g, '\\[')        // 左方括号
            .replace(/\]/g, '\\]')        // 右方括号
            .replace(/\(/g, '\\(')        // 左圆括号
            .replace(/\)/g, '\\)')        // 右圆括号
            .replace(/#/g, '\\#')         // 井号
            .replace(/\+/g, '\\+')        // 加号
            .replace(/-/g, '\\-')         // 减号（仅在行首需要转义，但为安全起见全部转义）
            .replace(/\./g, '\\.')        // 点号（仅在行首需要转义，但为安全起见全部转义）
            .replace(/!/g, '\\!');        // 感叹号
    }

    /**
     * 渲染单个气泡为 Markdown
     * @param bubble 气泡数据
     * @param options 渲染选项（可选）
     * @returns 渲染后的 Markdown 字符串片段
     */
    renderBubble(bubble: any, options?: MarkdownRendererOptions): string {
        const opts = { ...this.defaultOptions, ...options };
        const fragments: string[] = [];

        // 注释掉原始气泡数据的 HTML 注释，降低文件尺寸
        // const hasToolData = bubble.capabilities || bubble.toolCallResults || bubble.toolFormerData;
        // if (hasToolData) {
        //     const bubbleDataForComment = {
        //         toolFormerData: bubble.toolFormerData,
        //         toolCallResults: bubble.toolCallResults,
        //         capabilities: bubble.capabilities
        //     };
        //     const serializedBubble = this.serializeJsonForComment(bubbleDataForComment);
        //     fragments.push(`<!-- BUBBLE_DATA: ${serializedBubble} -->`);
        // }

        // 确定消息类型
        const hasToolData = bubble.capabilities || bubble.toolCallResults || bubble.toolFormerData;
        const isUser = bubble.role === 'user' || bubble.type === 1;

        // T065: 处理只有thinking的气泡（云端思考）
        // 如果是Assistant消息，没有文本，没有工具数据，但有thinking字段，显示思考时间
        const hasThinking = bubble.thinking && (bubble.thinking.text || bubble.thinking.signature);
        const hasText = bubble.text && bubble.text.trim();
        const isThinkingOnly = !isUser && !hasText && !hasToolData && hasThinking;
        
        if (isThinkingOnly) {
            // 计算思考时间
            const thinkingDurationMs = bubble.thinkingDurationMs || 0;
            const thinkingSeconds = (thinkingDurationMs / 1000).toFixed(1);
            
            // 显示思考时间
            fragments.push(`*💭 思考 ${thinkingSeconds} 秒*`);
            
            // 直接返回，不需要处理其他内容
            return fragments.join('\n');
        }

        // 渲染消息内容
        if (hasText) {
            // T059: 使用 HTML div 标签包裹用户消息，避免与 Markdown 引用语法冲突
            // 用户消息用 <div class="user-message"> 包裹，前端可以通过 CSS 进行样式化
            if (isUser) {
                fragments.push(`<div class="user-message">\n\n${bubble.text}\n\n</div>`);
            } else {
                fragments.push(bubble.text);
            }
        }
        
        // 渲染工具使用数据（独立于文本内容）
        if (!isUser && hasToolData) {
            // T061: 添加调试日志 - 记录原始 bubble 数据
            Logger.debug(`renderBubble: Processing bubble with tool data`, {
                hasToolFormerData: !!bubble.toolFormerData,
                hasToolCallResults: !!bubble.toolCallResults,
                hasCapabilities: !!bubble.capabilities,
                toolFormerDataName: bubble.toolFormerData?.name,
                bubbleId: bubble.bubbleId
            });
            
            // 提取工具数据
            const toolData = this.extractToolData(bubble);
            
            if (toolData) {
                Logger.debug(`renderBubble: Successfully extracted tool data for "${toolData.name}"`);
            } else {
                Logger.debug(`renderBubble: Failed to extract tool data from bubble`);
            }
            
            if (toolData) {
                // 注释掉简化的工具使用提示，让界面更简洁
                // const toolInfo = this.extractToolInfo(bubble);
                // if (toolInfo) {
                //     const placeholder = opts.toolUsePlaceholder.replace('{name}', toolInfo.name);
                //     let toolText = toolInfo.status 
                //         ? `${placeholder} - ${toolInfo.status}`
                //         : placeholder;
                //     
                //     // 添加用户决策信息（如果有）
                //     if (toolInfo.userDecision) {
                //         toolText += ` (${toolInfo.userDecision})`;
                //     }
                //     
                //     fragments.push(toolText);
                // }
                
                // 渲染详细的工具信息
                const toolDetails = this.renderToolDetails(toolData);
                if (toolDetails) {
                    fragments.push(toolDetails);
                }
                // 注释掉回退显示，让界面更简洁
                // else {
                //     // 如果详细渲染失败，回退到简单显示
                //     const toolInfo = this.extractToolInfo(bubble);
                //     if (toolInfo) {
                //         fragments.push(`*工具: ${toolInfo.name}*`);
                //     } else {
                //         fragments.push('[Tool Use: Unknown]');
                //     }
                // }
            }
            // 注释掉无法提取工具信息时的提示，让界面更简洁
            // else {
            //     // 有工具数据但无法提取信息，显示通用提示
            //     fragments.push('[Tool Use: Unknown]');
            // }
        }
        
        // T056: 移除空消息占位符 - 如果没有内容，直接返回空字符串
        // 空消息不需要显示任何内容，让 Markdown 更简洁
        return fragments.join('\n');
    }

    /**
     * 渲染会话为 Markdown
     * @param agentRecord Agent 对话记录（包含完整的会话数据）
     * @param options 渲染选项（可选）
     * @returns 渲染后的 Markdown 字符串
     */
    async renderSession(agentRecord: AgentRecord, options?: MarkdownRendererOptions): Promise<string> {
        const opts = { ...this.defaultOptions, ...options };
        const fragments: string[] = [];

        // 添加会话标题
        const sessionName = agentRecord.sessionId || 'Session';
        fragments.push(`# ${sessionName}`);
        fragments.push('');

        // 添加会话指标表格
        const metricsTable = this.generateMetricsTable(agentRecord);
        if (metricsTable) {
            fragments.push(metricsTable);
            fragments.push(''); // 指标表格和内容之间空行
        }

        // 检查是否有消息（空会话处理）
        if (!agentRecord.messages || agentRecord.messages.length === 0) {
            fragments.push('*No messages in this session.*');
            return fragments.join('\n');
        }

        // 按时间排序消息
        const sortedMessages = [...agentRecord.messages].sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB;
        });

        // 渲染每条消息（数据格式错误处理）
        for (const message of sortedMessages) {
            try {
                // 验证消息格式
                if (!message || typeof message !== 'object') {
                    Logger.warn('Invalid message format: message is not an object');
                    continue;
                }

                // 将 AgentMessage 转换为气泡格式
                // 使用 metadata 中的原始 type 值（如果存在），否则根据 role 推断
                const originalType = message.metadata?.type;
                const bubbleType = originalType !== undefined ? originalType : (message.role === 'user' ? 1 : 2);
                
                // 获取工具数据（优先使用 toolFormerData，然后是 toolCallResults）
                const toolFormerData = message.metadata?.toolFormerData;
                const toolCallResults = message.metadata?.toolCallResults;
                
                const bubble = {
                    role: message.role || 'assistant',
                    type: bubbleType, // 使用原始类型或推断的类型
                    text: message.content || '',
                    timestamp: message.timestamp ? new Date(message.timestamp).getTime() : Date.now(),
                    bubbleId: message.metadata?.bubbleId, // 添加bubbleId以便在Unknown工具中使用
                    capabilities: message.metadata?.capabilities,
                    toolCallResults: toolCallResults,
                    toolFormerData: toolFormerData
                };

                const bubbleMarkdown = this.renderBubble(bubble, opts);
                fragments.push(bubbleMarkdown);
            } catch (error) {
                Logger.warn(`Failed to render message: ${error instanceof Error ? error.message : String(error)}`);
                // 跳过格式错误的消息，继续处理其他消息（数据格式错误处理）
            }
        }

        return fragments.join('\n');
    }

    /**
     * 从消息中提取工具信息（名称、状态和附加数据）
     * T047: 修复工具信息提取逻辑，使用与 extractToolData 相同的字段路径检查
     * @param bubble 气泡数据
     * @returns 工具信息对象（包含 name、status 和 additionalData），如果不存在则返回 null
     */
    private extractToolInfo(bubble: any): { 
        name: string; 
        status?: string; 
        additionalData?: any;
        params?: string;
        userDecision?: string;
    } | null {
        // 优先检查 toolFormerData（单个对象）
        if (bubble.toolFormerData && typeof bubble.toolFormerData === 'object') {
            const name = this.extractToolName(bubble.toolFormerData) || 'Unknown Tool';
            const status = bubble.toolFormerData.status;
            const additionalData = bubble.toolFormerData.additionalData;
            const params = bubble.toolFormerData.params;
            const userDecision = bubble.toolFormerData.userDecision;
            Logger.debug(`Extracted tool info from toolFormerData: name=${name}, status=${status}`);
            return { name, status, additionalData, params, userDecision };
        }

        // 检查 toolCallResults（数组）
        if (bubble.toolCallResults && Array.isArray(bubble.toolCallResults) && bubble.toolCallResults.length > 0) {
            const firstResult = bubble.toolCallResults[0];
            const name = this.extractToolName(firstResult) || 'Unknown Tool';
            const status = firstResult.status;
            const additionalData = firstResult.additionalData;
            const params = firstResult.params;
            const userDecision = firstResult.userDecision;
            Logger.debug(`Extracted tool info from toolCallResults: name=${name}, status=${status}`);
            return { name, status, additionalData, params, userDecision };
        }

        // 检查 capabilities（数组）
        if (bubble.capabilities && Array.isArray(bubble.capabilities) && bubble.capabilities.length > 0) {
            const firstCapability = bubble.capabilities[0];
            const name = this.extractToolName(firstCapability) || 'Unknown Tool';
            Logger.debug(`Extracted tool info from capabilities: name=${name}`);
            return { name }; // capabilities 可能没有 status
        }

        Logger.debug('No tool info found in bubble');
        return null;
    }

    /**
     * 从工具数据中提取工具名称（检查所有可能的字段路径）
     * @param data 工具数据对象
     * @returns 工具名称，如果找不到则返回 null
     */
    private extractToolName(data: any): string | null {
        if (!data || typeof data !== 'object') {
            return null;
        }

        // 检查所有可能的工具名称字段路径
        const possibleNameFields = [
            'name',
            'toolName',
            'tool_name',
            'functionName',
            'function_name',
            'method',
            'action',
            'type'
        ];

        for (const field of possibleNameFields) {
            if (data[field] && typeof data[field] === 'string' && data[field].trim()) {
                return data[field].trim();
            }
        }

        return null;
    }

    /**
     * 从工具数据中提取完整的工具信息（包括 rawArgs, result 等）
     * T046: 修复工具数据提取逻辑，检查所有可能的字段路径
     * @param bubble 气泡数据
     * @returns 工具数据对象，包含所有可用的工具信息
     */
    private extractToolData(bubble: any): {
        name: string;
        bubbleId?: string;
        toolFormerData?: any;
        toolCallResults?: any[];
        rawArgs?: any;
        params?: any;
        result?: any;
        additionalData?: any;
    } | null {
        // T061: 添加调试日志 - 记录提取过程
        Logger.debug(`extractToolData: Starting extraction`, {
            hasToolFormerData: !!bubble.toolFormerData,
            toolFormerDataType: typeof bubble.toolFormerData,
            hasToolCallResults: !!bubble.toolCallResults,
            hasCapabilities: !!bubble.capabilities
        });
        
        // 优先检查 toolFormerData
        if (bubble.toolFormerData && typeof bubble.toolFormerData === 'object') {
            // T066: 检查toolFormerData是否只包含additionalData（不是真正的工具调用）
            // 如果只有additionalData.status="error"，这不是工具调用，应该忽略
            const hasOnlyAdditionalData = 
                Object.keys(bubble.toolFormerData).length === 1 && 
                bubble.toolFormerData.additionalData &&
                !bubble.toolFormerData.name &&
                !bubble.toolFormerData.rawArgs &&
                !bubble.toolFormerData.params &&
                !bubble.toolFormerData.result;
            
            if (hasOnlyAdditionalData) {
                Logger.debug(`extractToolData: toolFormerData only contains additionalData, ignoring`);
                // 继续检查其他数据源
            } else {
                const name = this.extractToolName(bubble.toolFormerData) || 'Unknown Tool';
                Logger.debug(`extractToolData: Extracted from toolFormerData`, {
                    name: name,
                    rawArgs: bubble.toolFormerData.rawArgs,
                    params: bubble.toolFormerData.params,
                    result: bubble.toolFormerData.result
                });
                
                return {
                    name: name,
                    bubbleId: bubble.bubbleId,
                    toolFormerData: bubble.toolFormerData,
                    rawArgs: bubble.toolFormerData.rawArgs,
                    params: bubble.toolFormerData.params,
                    result: bubble.toolFormerData.result,
                    additionalData: bubble.toolFormerData.additionalData
                };
            }
        }

        // 检查 toolCallResults（数组）
        if (bubble.toolCallResults && Array.isArray(bubble.toolCallResults) && bubble.toolCallResults.length > 0) {
            const firstResult = bubble.toolCallResults[0];
            const name = this.extractToolName(firstResult) || 'Unknown Tool';
            Logger.debug(`Extracted tool name from toolCallResults: ${name}`);
            
            return {
                name: name,
                bubbleId: bubble.bubbleId,
                toolCallResults: bubble.toolCallResults,
                rawArgs: firstResult.rawArgs,
                params: firstResult.params,
                result: firstResult.result,
                additionalData: firstResult.additionalData
            };
        }

        // 检查 capabilities（数组）
        if (bubble.capabilities && Array.isArray(bubble.capabilities) && bubble.capabilities.length > 0) {
            const firstCapability = bubble.capabilities[0];
            const name = this.extractToolName(firstCapability) || 'Unknown Tool';
            Logger.debug(`Extracted tool name from capabilities: ${name}`);
            
            return {
                name: name,
                bubbleId: bubble.bubbleId,
                rawArgs: firstCapability.rawArgs,
                params: firstCapability.params,
                result: firstCapability.result,
                additionalData: firstCapability.additionalData
            };
        }

        Logger.debug('No tool data found in bubble');
        return null;
    }

    /**
     * 生成 Markdown 表格
     * @param headers 表头数组
     * @param rows 数据行数组（每行是一个数组，对应表头）
     * @returns Markdown 表格字符串
     */
    private generateMarkdownTable(headers: string[], rows: string[][]): string {
        if (headers.length === 0) {
            return '';
        }

        const fragments: string[] = [];
        
        // 表头
        fragments.push('| ' + headers.join(' | ') + ' |');
        
        // 分隔线
        fragments.push('| ' + headers.map(() => '---').join(' | ') + ' |');
        
        // 数据行
        for (const row of rows) {
            // 确保行数据长度与表头一致
            const paddedRow = [...row];
            while (paddedRow.length < headers.length) {
                paddedRow.push('');
            }
            fragments.push('| ' + paddedRow.slice(0, headers.length).join(' | ') + ' |');
        }
        
        return fragments.join('\n');
    }

    /**
     * 将 JSON 对象序列化为字符串，转义 HTML 注释中的特殊字符
     * T048: 实现 JSON 序列化辅助方法，确保可以安全地嵌入 HTML 注释
     * @param data 要序列化的数据
     * @returns 转义后的 JSON 字符串
     */
    private serializeJsonForComment(data: any): string {
        try {
            // 序列化为 JSON 字符串
            const jsonStr = JSON.stringify(data, null, 2);
            
            // 转义 HTML 注释中的特殊字符
            // HTML 注释中不能包含 `--` 和 `>`（在某些情况下）
            // 将 `--` 替换为 `- -`，将 `>` 替换为 `&gt;`
            return jsonStr
                .replace(/--/g, '- -')
                .replace(/>/g, '&gt;');
        } catch (error) {
            Logger.warn(`Failed to serialize JSON for comment: ${error instanceof Error ? error.message : String(error)}`);
            return String(data);
        }
    }

    /**
     * 安全地解析 JSON 字符串或返回对象
     * 处理 rawArgs、params、result 等字段可能是 JSON 字符串的情况
     * @param value 可能是 JSON 字符串或对象的值
     * @returns 解析后的对象，如果解析失败则返回原值
     */
    private safeParseJson(value: any): any {
        if (value === null || value === undefined) {
            return value;
        }
        
        // 如果已经是对象，直接返回
        if (typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        
        // 如果是数组，直接返回
        if (Array.isArray(value)) {
            return value;
        }
        
        // 如果是字符串，尝试解析为 JSON
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (error) {
                // 解析失败，返回原字符串
                Logger.debug(`Failed to parse JSON string: ${value.substring(0, 100)}...`);
                return value;
            }
        }
        
        // 其他类型，直接返回
        return value;
    }

    /**
     * 生成 HTML <details> 块
     * T049: 修改 generateDetailsBlock 添加原始 JSON 数据作为 HTML 注释
     * T055: 修复 summary 转义问题 - 在 HTML 标签中不应转义 Markdown 字符
     * @param summary 摘要文本（显示在折叠标题中）
     * @param content 详细内容
     * @param rawData 原始 JSON 数据（可选，将作为 HTML 注释附加）
     * @returns Markdown 格式的 <details> 块
     */
    private generateDetailsBlock(summary: string, content: string, rawData?: any): string {
        if (!content || !content.trim()) {
            return '';
        }
        
        const fragments: string[] = [];
        
        // 注释掉原始工具数据的 HTML 注释，降低文件尺寸
        // if (rawData !== undefined && rawData !== null) {
        //     const serializedData = this.serializeJsonForComment(rawData);
        //     fragments.push(`<!-- TOOL_DATA: ${serializedData} -->`);
        // }
        
        fragments.push(`<details>`);
        // 注意：在 HTML <summary> 标签中不需要转义 Markdown 字符
        // 只需要转义 HTML 特殊字符（<, >, &）
        const escapedSummary = summary
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        fragments.push(`<summary>${escapedSummary}</summary>`);
        fragments.push('');
        fragments.push(content);
        fragments.push('');
        fragments.push(`</details>`);
        
        return fragments.join('\n');
    }

    // ============================================================================
    // 工具类型渲染方法
    // ============================================================================

    /**
     * 渲染代码编辑工具（edit_file, MultiEdit, write, search_replace）
     * T017: 处理 edit_file, MultiEdit, write, search_replace 工具
     * 
     * 渲染策略：
     * - Summary: 显示文件名 + 总体统计（添加/删除行数）
     * - Details: 按 chunk 组织，每个 chunk 显示统计 + diff 代码块
     */
    private renderEditFileTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取文件路径（检查多个可能的字段名）
        const filePath = params?.relativeWorkspacePath || 
                        params?.filePath ||
                        params?.file_path ||
                        params?.targetFile ||
                        params?.target_file ||
                        rawArgs?.relativeWorkspacePath || 
                        rawArgs?.filePath ||
                        rawArgs?.file_path ||
                        rawArgs?.targetFile ||
                        rawArgs?.target_file ||
                        'Unknown file';
        
        // 提取文件名（不含路径）
        const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
        
        // 提取 diff chunks
        const diffChunks = result?.diff?.chunks || [];
        
        // 计算总体统计
        let totalAdded = 0;
        let totalRemoved = 0;
        for (const chunk of diffChunks) {
            totalAdded += chunk.linesAdded || 0;
            totalRemoved += chunk.linesRemoved || 0;
        }
        
        // 生成 summary 标题
        let summaryTitle = '📝 Edit file: ' + fileName;
        if (diffChunks.length === 1) {
            summaryTitle += ` - Lines added: ${totalAdded}, removed: ${totalRemoved}`;
        } else if (diffChunks.length > 1) {
            summaryTitle += ` - ${diffChunks.length} chunks`;
        }
        
        // 渲染文件路径
        fragments.push(`**文件**: \`${filePath}\``);
        fragments.push(''); // 空行
        
        // 渲染 diff chunks
        if (diffChunks.length > 0) {
            for (let i = 0; i < diffChunks.length; i++) {
                const chunk = diffChunks[i];
                const chunkNum = i + 1;
                const added = chunk.linesAdded || 0;
                const removed = chunk.linesRemoved || 0;
                
                // Chunk 标题
                fragments.push(`#### Chunk ${chunkNum} - Lines added: ${added}, removed: ${removed}`);
                fragments.push(''); // 空行
                
                // Diff 代码块
                if (chunk.diffString) {
                    fragments.push('```diff');
                    fragments.push(chunk.diffString);
                    fragments.push('```');
                    
                    // 多个 chunk 之间添加空行
                    if (i < diffChunks.length - 1) {
                        fragments.push('');
                    }
                }
            }
        } else if (result?.diff) {
            // 如果没有 chunks，尝试直接使用 diff 字符串
            const diffStr = typeof result.diff === 'string' 
                ? result.diff 
                : JSON.stringify(result.diff, null, 2);
            fragments.push('```diff');
            fragments.push(diffStr);
            fragments.push('```');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(summaryTitle, content, toolData);
    }

    /**
     * 渲染应用补丁工具（apply_patch）
     * T018: 处理 apply_patch 工具
     */
    private renderApplyPatchTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        
        // 提取目标文件路径
        // params 通常是 JSON 字符串，解析后包含 relativeWorkspacePath
        // rawArgs 是包含补丁内容的字符串，格式为 "*** Begin Patch\n*** Update File: ...\n@@\n...\n*** End Patch"
        let filePath = params?.relativeWorkspacePath || 
                       params?.targetFile ||
                       params?.target_file ||
                       params?.filePath ||
                       params?.file_path ||
                       'Unknown file';
        
        // 如果 filePath 还是未知，尝试从 rawArgs 字符串中提取
        if (filePath === 'Unknown file' && typeof rawArgs === 'string') {
            const updateFileMatch = rawArgs.match(/\*\*\* Update File:\s*(.+?)\n/);
            if (updateFileMatch) {
                filePath = updateFileMatch[1].trim();
            }
        }
        
        // 提取 patch 内容
        let patch = '';
        if (typeof rawArgs === 'string') {
            // rawArgs 格式: "*** Begin Patch\n*** Update File: ...\n@@\n...patch content...\n*** End Patch"
            // 提取 @@ 之后到 *** End Patch 之前的内容
            const patchMatch = rawArgs.match(/@@\s*\n([\s\S]*?)\n\*\*\* End Patch/);
            if (patchMatch) {
                patch = patchMatch[1].trim();
            } else {
                // 如果没有找到标准格式，尝试提取整个内容（去掉头部标记）
                const lines = rawArgs.split('\n');
                let startIdx = -1;
                let endIdx = lines.length;
                
                // 找到第一个 @@ 行
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].trim().startsWith('@@')) {
                        startIdx = i;
                        break;
                    }
                }
                
                // 找到 *** End Patch 行
                for (let i = lines.length - 1; i >= 0; i--) {
                    if (lines[i].trim() === '*** End Patch') {
                        endIdx = i;
                        break;
                    }
                }
                
                if (startIdx >= 0 && endIdx > startIdx) {
                    patch = lines.slice(startIdx, endIdx).join('\n');
                }
            }
        } else if (rawArgs && typeof rawArgs === 'object') {
            // 如果 rawArgs 是对象，尝试从对象中提取
            patch = rawArgs.patch || '';
        }
        
        fragments.push(`**目标文件**: \`${filePath}\``);
        fragments.push('');
        
        if (patch) {
            fragments.push('```diff');
            fragments.push(patch);
            fragments.push('```');
        } else {
            fragments.push('*无补丁内容*');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(`应用补丁: ${filePath}`, content, toolData);
    }

    /**
     * 渲染 Copilot 编辑工具（copilot_applyPatch, copilot_insertEdit）
     * T019: 处理 copilot_applyPatch, copilot_insertEdit 工具
     */
    private renderCopilotEditTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取操作摘要
        const invocationMessage = result?.invocationMessage || 
                                 rawArgs?.invocationMessage || 
                                 'Copilot edit';
        
        // 提取文本编辑内容
        const textEditContent = result?.textEditContent || 
                               result?.content || 
                               rawArgs?.content || '';
        
        fragments.push(`**操作**: ${invocationMessage}`);
        
        if (textEditContent) {
            // 尝试检测语言（从文件路径或内容）
            const language = params?.language || 
                           rawArgs?.language || 
                           this.detectLanguageFromContent(textEditContent);
            
            fragments.push(`\`\`\`${language}`);
            fragments.push(textEditContent);
            fragments.push('```');
        } else {
            fragments.push('*无编辑内容*');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(`Copilot 编辑: ${invocationMessage}`, content, toolData);
    }

    /**
     * 渲染删除文件工具（delete_file）
     * T020: 处理 delete_file 工具
     */
    private renderDeleteFileTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        
        // 提取文件路径（检查多个可能的字段名）
        const filePath = params?.relativeWorkspacePath ||
                        params?.targetFile ||
                        params?.target_file ||
                        params?.filePath ||
                        params?.file_path ||
                        params?.path ||
                        rawArgs?.relativeWorkspacePath ||
                        rawArgs?.path ||
                        rawArgs?.targetFile ||
                        rawArgs?.target_file ||
                        rawArgs?.filePath ||
                        rawArgs?.file_path || 
                        'Unknown file';
        
        // 提取解释
        const explanation = rawArgs?.explanation || 
                           params?.explanation || 
                           'Delete file';
        
        fragments.push(`**文件**: \`${filePath}\` | **原因**: ${explanation}`);
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(`删除文件: ${filePath}`, content, toolData);
    }

    /**
     * 从内容中检测编程语言（简单启发式方法）
     */
    private detectLanguageFromContent(content: string): string {
        if (!content) return '';
        
        // 简单的语言检测
        if (content.includes('function') && content.includes('=>')) return 'javascript';
        if (content.includes('def ') || content.includes('import ')) return 'python';
        if (content.includes('public class') || content.includes('import java')) return 'java';
        if (content.includes('interface ') && content.includes('type ')) return 'typescript';
        if (content.includes('<?php')) return 'php';
        if (content.includes('package ') && content.includes('func ')) return 'go';
        
        return '';
    }

    /**
     * 渲染代码库搜索工具（codebase_search, semantic_search_full）
     * T021: 处理 codebase_search 工具
     * T064: 更新数据提取逻辑,支持真实数据格式
     * T076: 添加 semantic_search_full 支持
     * 
     * 渲染策略：
     * - Summary: 显示查询 + 结果数 + 搜索范围
     * - Details: 使用表格展示文件路径、行号范围和相关性评分
     * - 按相关性评分排序（高分在前）
     */
    private renderCodebaseSearchTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取查询（检查多个可能的字段名）
        const query = params?.query ||
                     params?.searchQuery ||
                     params?.search_query ||
                     rawArgs?.query ||
                     rawArgs?.searchQuery ||
                     rawArgs?.search_query ||
                     'Unknown query';
        
        // 提取搜索范围
        const targetDir = rawArgs?.target_directories?.[0] || 
                         rawArgs?.targetDirectories?.[0] ||
                         params?.includePattern ||
                         params?.target_directories?.[0] ||
                         params?.targetDirectories?.[0] ||
                         params?.repositoryInfo?.relativeWorkspacePath ||
                         '';
        
        // 提取 topK 参数（semantic_search_full 特有）
        const topK = params?.topK || rawArgs?.topK || null;
        
        // 提取搜索结果（优先使用 result，回退到 params）
        const codeResults = result?.codeResults || 
                           params?.codeResults ||
                           result?.results || 
                           [];
        
        // 判断是否为语义搜索
        const isSemanticSearch = toolData.name === 'semantic_search_full';
        
        // 生成 summary 标题
        let summaryTitle = isSemanticSearch
            ? `🔍 Semantic search: "${query}" • ${codeResults.length} result(s)`
            : `🔍 Searched codebase: "${query}" • ${codeResults.length} result(s)`;
        
        if (topK) {
            summaryTitle += ` (top ${topK})`;
        }
        
        if (targetDir && targetDir !== '.') {
            summaryTitle += ` in ${targetDir}`;
        }
        
        if (codeResults.length > 0) {
            // 检查是否有评分信息
            const hasScores = codeResults.some((r: any) => r.score !== undefined && r.score !== null);
            
            // 按评分排序（如果有评分）
            const sortedResults = [...codeResults].sort((a, b) => {
                const scoreA = a.score || 0;
                const scoreB = b.score || 0;
                return scoreB - scoreA; // 降序排列
            });
            
            // 生成表格头（根据是否有评分决定列数）
            if (hasScores) {
                fragments.push('| File | Lines | Score |');
                fragments.push('|:-----|------:|------:|');
            } else {
                fragments.push('| File | Lines |');
                fragments.push('|:-----|------:|');
            }
            
            for (const codeResult of sortedResults) {
                // 从 codeBlock 中提取信息
                const codeBlock = codeResult.codeBlock || codeResult;
                const filePath = codeBlock.relativeWorkspacePath || 
                                codeBlock.file || 
                                codeBlock.path || 
                                codeBlock.filePath || 
                                'Unknown';
                
                // 规范化路径（使用 / 而非 \）
                const normalizedPath = filePath.replace(/\\/g, '/');
                
                // 提取行号范围
                const range = codeBlock.range || {};
                const startLine = range.startPosition?.line || range.start?.line || 0;
                const endLine = range.endPosition?.line || range.end?.line || startLine;
                
                // 格式化行号
                let lineRange: string;
                if (startLine === endLine || endLine === 0) {
                    lineRange = startLine > 0 ? `L${startLine}` : 'N/A';
                } else {
                    lineRange = `L${startLine}-${endLine}`;
                }
                
                // 生成表格行
                if (hasScores) {
                    const score = codeResult.score !== undefined ? codeResult.score.toFixed(4) : 'N/A';
                    fragments.push(`| \`${normalizedPath}\` | ${lineRange} | ${score} |`);
                } else {
                    fragments.push(`| \`${normalizedPath}\` | ${lineRange} |`);
                }
            }
        } else {
            fragments.push('*无搜索结果*');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(summaryTitle, content, toolData);
    }

    /**
     * 渲染文本搜索工具（grep, ripgrep）
     * T022: 处理 grep, ripgrep 工具
     * 
     * 渲染策略：
     * - Summary: 显示模式 + 匹配数 + 总行数
     * - Details: 根据 outputMode 显示不同格式
     * - content 模式：表格展示文件、匹配内容和行号
     * - files_with_matches 模式：只显示文件列表
     * - count 模式：显示每个文件的匹配数量
     */
    private renderGrepTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取查询模式（检查多个可能的字段名）
        const pattern = params?.pattern ||
                       params?.regex ||
                       params?.searchPattern ||
                       rawArgs?.pattern ||
                       rawArgs?.regex ||
                       rawArgs?.searchPattern ||
                       'Unknown pattern';
        
        // 提取路径（检查多个可能的字段名）
        const path = params?.path ||
                    params?.directory ||
                    params?.dir ||
                    rawArgs?.path ||
                    rawArgs?.directory ||
                    rawArgs?.dir ||
                    '';
        
        // 提取输出模式
        const outputMode = params?.outputMode || 
                          params?.output_mode || 
                          rawArgs?.outputMode ||
                          'content';
        
        // 提取工作区结果（嵌套结构）
        const workspaceResults = result?.success?.workspaceResults || 
                                result?.workspaceResults || 
                                {};
        
        // 根据 outputMode 处理不同的数据结构
        if (outputMode === 'files_with_matches') {
            // files_with_matches 模式：只显示文件列表
            const allFiles: string[] = [];
            
            for (const workspacePath in workspaceResults) {
                const workspace = workspaceResults[workspacePath];
                const filesData = workspace.files || {};
                const files = filesData.files || [];
                allFiles.push(...files);
            }
            
            // 生成 summary 标题
            const summaryTitle = `🔍 Grep for "${pattern}" • ${allFiles.length} file(s) matched`;
            
            // 显示文件列表
            if (allFiles.length > 0) {
                fragments.push(`**Matched files** (${allFiles.length}):`);
                fragments.push('');
                for (const file of allFiles) {
                    // 规范化路径
                    const normalizedPath = file.replace(/\\/g, '/');
                    fragments.push(`- \`${normalizedPath}\``);
                }
            } else {
                fragments.push('*无匹配文件*');
            }
            
            const content = fragments.join('\n');
            return this.generateDetailsBlock(summaryTitle, content, toolData);
            
        } else if (outputMode === 'count') {
            // count 模式：显示每个文件的匹配数量
            const allCounts: Array<{file: string, count: number}> = [];
            let totalMatches = 0;
            
            for (const workspacePath in workspaceResults) {
                const workspace = workspaceResults[workspacePath];
                const countData = workspace.count || {};
                const counts = countData.counts || [];
                
                for (const countItem of counts) {
                    allCounts.push({
                        file: countItem.file || 'Unknown',
                        count: countItem.count || 0
                    });
                    totalMatches += countItem.count || 0;
                }
            }
            
            // 生成 summary 标题
            const summaryTitle = `🔍 Grep for "${pattern}" • ${totalMatches} match(es) in ${allCounts.length} file(s)`;
            
            // 显示匹配数量表格
            if (allCounts.length > 0) {
                fragments.push('| File | Matches |');
                fragments.push('|:-----|--------:|');
                
                for (const countItem of allCounts) {
                    const normalizedPath = countItem.file.replace(/\\/g, '/');
                    fragments.push(`| \`${normalizedPath}\` | ${countItem.count} |`);
                }
            } else {
                fragments.push('*无匹配结果*');
            }
            
            const content = fragments.join('\n');
            return this.generateDetailsBlock(summaryTitle, content, toolData);
            
        } else {
            // content 模式（默认）：显示文件、内容和行号
            let totalMatchedLines = 0;
            let totalLines = 0;
            const allMatches: Array<{file: string, lineNumber: number, content: string, isContext: boolean}> = [];
            
            // 遍历所有工作区
            for (const workspacePath in workspaceResults) {
                const workspace = workspaceResults[workspacePath];
                const contentData = workspace.content || {};
                
                // 提取统计信息
                totalMatchedLines += contentData.totalMatchedLines || 0;
                totalLines += contentData.totalLines || 0;
                
                // 提取匹配项
                const matches = contentData.matches || [];
                for (const fileMatch of matches) {
                    const file = fileMatch.file || fileMatch.path || 'Unknown';
                    const fileMatches = fileMatch.matches || [];
                    
                    for (const match of fileMatches) {
                        allMatches.push({
                            file: file,
                            lineNumber: match.lineNumber || match.line || 0,
                            content: match.content || match.text || '',
                            isContext: match.isContextLine || false
                        });
                    }
                }
            }
            
            // 生成 summary 标题
            let summaryTitle = `🔍 Grep for "${pattern}" • ${totalMatchedLines} match(es)`;
            if (totalLines > 0) {
                summaryTitle += ` in ${totalLines} lines`;
            }
            
            // 渲染内容表格
            if (allMatches.length > 0) {
                fragments.push('| File | Content | Line |');
                fragments.push('|:-----|:--------|-----:|');
                
                for (const match of allMatches) {
                    // 规范化路径
                    const normalizedPath = match.file.replace(/\\/g, '/');
                    
                    // 截断过长的内容
                    let displayContent = match.content.trim();
                    if (displayContent.length > 80) {
                        displayContent = displayContent.substring(0, 77) + '...';
                    }
                    
                    // 转义内容中的特殊字符
                    displayContent = displayContent
                        .replace(/\|/g, '\\|')
                        .replace(/`/g, '\\`');
                    
                    // 行号格式
                    const lineNum = match.lineNumber > 0 ? `L${match.lineNumber}` : 'N/A';
                    
                    fragments.push(`| \`${normalizedPath}\` | \`${displayContent}\` | ${lineNum} |`);
                }
            } else {
                fragments.push('*无匹配结果*');
            }
            
            const content = fragments.join('\n');
            return this.generateDetailsBlock(summaryTitle, content, toolData);
        }
    }

    /**
     * 渲染网络搜索工具（web_search）
     * T023: 处理 web_search 工具
     * 
     * 渲染策略：
     * - Summary: 显示搜索词 + 结果数
     * - Details: 使用编号列表展示每条结果（标题 + URL + 完整内容）
     * - 不截断内容，保留原始格式
     */
    private renderWebSearchTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取搜索词（检查多个可能的字段名）
        const searchTerm = params?.search_term ||
                          params?.searchTerm ||
                          params?.query ||
                          rawArgs?.search_term ||
                          rawArgs?.searchTerm ||
                          rawArgs?.query || 
                          'Unknown search';
        
        // 提取引用结果
        const references = result?.references || 
                          result?.results || 
                          [];
        
        // 生成 summary 标题
        const summaryTitle = `🔍 Searched web: ${searchTerm} • ${references.length} result(s)`;
        
        if (references.length > 0) {
            // 渲染为编号列表，每条结果包含完整内容
            for (let i = 0; i < references.length; i++) {
                const ref = references[i];
                const index = i + 1;
                const title = ref.title || ref.name || 'Untitled';
                const url = ref.url || ref.link || '';
                const content = ref.chunk || ref.snippet || ref.text || ref.content || '';
                
                // 结果标题
                fragments.push(`### ${index}. ${title}`);
                fragments.push(''); // 空行
                
                // URL（如果有）
                if (url && url !== 'N/A' && url !== '') {
                    fragments.push(`**URL**: ${url}`);
                    fragments.push(''); // 空行
                }
                
                // 内容（保留完整格式）
                if (content) {
                    fragments.push(content);
                }
                
                // 结果之间添加空行分隔
                if (i < references.length - 1) {
                    fragments.push('');
                    fragments.push('---');
                    fragments.push('');
                }
            }
        } else {
            fragments.push('*无搜索结果*');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(summaryTitle, content, toolData);
    }

    /**
     * 渲染网页抓取工具（web_fetch）
     * T025: 处理 web_fetch 工具
     * 
     * 渲染策略：
     * - Summary: 显示 URL
     * - Details: 显示抓取的内容（Markdown 格式）
     */
    private renderWebFetchTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取 URL
        const url = params?.url || rawArgs?.url || 'Unknown URL';
        
        // 提取抓取的内容
        const markdown = result?.markdown || '';
        const fetchedUrl = result?.url || url;
        
        // 生成 summary 标题
        const summaryTitle = `🌐 Fetched web content: ${fetchedUrl}`;
        
        // 添加 URL 信息
        fragments.push(`**URL**: ${fetchedUrl}`);
        fragments.push(''); // 空行
        
        // 添加内容
        if (markdown) {
            fragments.push('**Content**:');
            fragments.push(''); // 空行
            fragments.push(markdown);
        } else {
            fragments.push('*无内容*');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(summaryTitle, content, toolData);
    }

    /**
     * 渲染拉取请求工具（fetch_pull_request）
     * T024: 处理 fetch_pull_request 工具
     */
    private renderFetchPullRequestTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const result = this.safeParseJson(toolData.result) || {};
        
        // 提取各个字段
        const title = result.title || 'Untitled';
        const body = result.body || result.description || '';
        const diff = result.diff || '';
        const url = result.url || result.html_url || '';
        
        const titleParts = [`**标题**: ${title}`];
        if (url) {
            titleParts.push(`**URL**: ${url}`);
        }
        fragments.push(titleParts.join(' | '));
        
        if (body) {
            fragments.push('**描述**:');
            fragments.push(body);
            fragments.push('');
        }
        
        if (diff) {
            fragments.push('**差异**:');
            fragments.push('```diff');
            fragments.push(diff);
            fragments.push('```');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(`拉取请求: ${title}`, content, toolData);
    }

    /**
     * 渲染读取文件工具（read_file, read_file_v2, copilot_readFile）
     * T025: 处理 read_file, read_file_v2, copilot_readFile 工具
     */
    private renderReadFileTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取文件路径（检查多个可能的字段名）
        const filePath = params?.targetFile ||
                       params?.target_file ||
                       rawArgs?.targetFile ||
                       rawArgs?.target_file ||
                       rawArgs?.file_path || 
                       params?.relativeWorkspacePath || 
                       params?.file_path || 
                       'Unknown file';
        
         //提取文件内容（检查多个可能的字段名）
         const content = result?.contents ||
                        result?.content || 
                        result?.text || 
                        '';
        
        fragments.push(`**文件**: \`${filePath}\``);
        
        if (content) {
            // 尝试检测语言
            const language = this.detectLanguageFromFilePath(filePath) || 
                           this.detectLanguageFromContent(content);
            
            fragments.push(`\`\`\`\`${language}`);
            fragments.push(content);
            fragments.push('````');
        } else {
            fragments.push('*文件内容为空或无法读取*');
        }
        
        const markdownContent = fragments.join('\n');
        return this.generateDetailsBlock(`读取文件: ${filePath}`, markdownContent, toolData);
    }

    /**
     * 渲染列出目录工具（list_dir）
     * T026: 处理 list_dir 工具
     */
    private renderListDirTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 rawArgs 和 params（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取目录路径（检查多个可能的字段名）
        const dirPath = params?.targetDirectory || 
                       params?.target_directory ||
                       params?.path ||
                       rawArgs?.targetDirectory ||
                       rawArgs?.target_directory ||
                       rawArgs?.relative_workspace_path ||
                       rawArgs?.path ||
                       'Unknown directory';
        
        // 提取文件列表（从 result 中提取目录树结构）
        let files: any[] = [];
        
        // 尝试从 result 中提取文件列表
        if (result) {
            // 如果 result 有 files 或 items 字段
            if (result.files && Array.isArray(result.files)) {
                files = result.files;
            } else if (result.items && Array.isArray(result.items)) {
                files = result.items;
            } else if (result.directoryTreeRoot) {
                // 从目录树结构中提取文件
                files = this.extractFilesFromDirectoryTree(result.directoryTreeRoot);
            }
        }
        
        fragments.push(`**目录**: \`${dirPath}\``);
        
        if (files.length > 0) {
            // 生成表格：名称 | 类型
            const headers = ['名称', '类型'];
            const rows: string[][] = [];
            
            for (const file of files) {
                const name = file.name || file.path || 'Unknown';
                const type = file.type || 
                           (file.isDirectory ? '目录' : '文件') || 
                           '未知';
                rows.push([name, type]);
            }
            
            fragments.push(this.generateMarkdownTable(headers, rows));
        } else {
            fragments.push('*目录为空*');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(`列出目录: ${dirPath}`, content, toolData);
    }

    /**
     * 渲染列出目录工具 V2（list_dir_v2）
     * T073: 处理 list_dir_v2 工具
     */
    private renderListDirV2Tool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 rawArgs 和 params（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取目录路径（检查多个可能的字段名）
        const dirPath = params?.targetDirectory || 
                       params?.target_directory ||
                       params?.path ||
                       rawArgs?.targetDirectory ||
                       rawArgs?.target_directory ||
                       rawArgs?.path ||
                       'Unknown directory';
        
        // 提取忽略模式（如果有）
        const ignorePatterns = rawArgs?.ignore || [];
        
        // 提取文件列表（从 result 中提取目录树结构）
        let files: any[] = [];
        let dirs: any[] = [];
        
        // 尝试从 result 中提取文件列表
        if (result && result.directoryTreeRoot) {
            // 从目录树结构中提取文件和目录
            const extracted = this.extractFilesAndDirsFromDirectoryTree(result.directoryTreeRoot);
            files = extracted.files;
            dirs = extracted.dirs;
        }
        
        fragments.push(`**目录**: \`${dirPath}\``);
        
        // 显示忽略模式（如果有）
        if (ignorePatterns && ignorePatterns.length > 0) {
            fragments.push(`**忽略模式**: ${ignorePatterns.map((p: string) => `\`${p}\``).join(', ')}`);
        }
        
        // 统计信息
        const totalItems = files.length + dirs.length;
        fragments.push(`**统计**: ${dirs.length} 个子目录, ${files.length} 个文件 (共 ${totalItems} 项)`);
        
        if (totalItems > 0) {
            // 生成表格：名称 | 类型 | 路径
            const headers = ['名称', '类型', '路径'];
            const rows: string[][] = [];
            
            // 先添加目录
            for (const dir of dirs) {
                const name = dir.name || 'Unknown';
                rows.push([`📁 ${name}`, '目录', dir.path || '']);
            }
            
            // 再添加文件
            for (const file of files) {
                const name = file.name || 'Unknown';
                rows.push([`📄 ${name}`, '文件', file.path || '']);
            }
            
            fragments.push(this.generateMarkdownTable(headers, rows));
        } else {
            fragments.push('*目录为空*');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(`列出目录 V2: ${dirPath}`, content, toolData);
    }

    /**
     * 渲染 edit_file_v2 工具（完整文件替换，带流式内容）
     * 
     * edit_file_v2 与 edit_file 的区别：
     * - params 和 result 是 JSON 字符串（需要解析）
     * - streamingContent 包含完整文件内容（不是 diff）
     * - 新增 additionalData.reviewData 结构，包含用户决策
     * 
     * 渲染策略：
     * - Summary: 显示文件名 + 统计 + 状态图标 + 用户决策
     * - Details: 文件路径、状态、统计、内容预览（截断至 500 字符）
     * 
     * @param toolData Edit file v2 tool data from database
     * @returns Markdown string with collapsible details block
     */
    private renderEditFileV2Tool(toolData: any): string {
        const fragments: string[] = [];
        
        // 1. Parse inputs
        Logger.debug(`renderEditFileV2Tool: Processing tool data`, { 
            hasParams: !!toolData.params,
            hasResult: !!toolData.result,
            status: toolData.status
        });
        
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 2. Extract fields with fallbacks
        const filePath = params?.relativeWorkspacePath || 'Unknown file';
        const content = params?.streamingContent || '';
        const status = toolData.status || 'unknown';
        const userDecision = toolData.additionalData?.reviewData?.selectedOption;
        
        // Log parsed data
        Logger.debug(`renderEditFileV2Tool: Parsed data`, {
            filePath: filePath,
            contentLength: content.length,
            status: status,
            hasUserDecision: !!userDecision
        });
        
        // 3. Compute statistics
        const lineCount = content.split('\n').length;
        const charCount = content.length;
        const sizeKB = (charCount / 1024).toFixed(2);
        
        // 4. Generate summary
        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        const statusIcon = status === 'completed' ? '✅' : '⏳';
        const decisionText = userDecision ? ` (User: ${userDecision})` : '';
        const summaryTitle = `📝 Edit file: ${fileName} - ${lineCount} lines, ${sizeKB} KB ${statusIcon}${decisionText}`;
        
        // 5. Generate details - File info
        fragments.push(`**文件**: \`${filePath}\``);
        fragments.push(`**状态**: ${status}`);
        if (userDecision) {
            fragments.push(`**用户决策**: ${userDecision}`);
        }
        fragments.push('');
        
        // 6. Generate details - Statistics
        fragments.push(`**内容统计**:`);
        fragments.push(`- 行数: ${lineCount}`);
        fragments.push(`- 大小: ${sizeKB} KB`);
        fragments.push('');
        
        // 7. Generate details - Content preview
        if (content) {
            const maxPreviewChars = 500;
            const preview = content.substring(0, maxPreviewChars);
            const language = this.detectLanguageFromFilePath(filePath);
            
            fragments.push('**内容预览**:');
            fragments.push('');
            fragments.push(`\`\`\`${language}`);
            fragments.push(preview);
            
            // Add truncation message if needed
            if (content.length > maxPreviewChars) {
                fragments.push('...');
                fragments.push(`(已截断，完整内容共 ${charCount} 字符)`);
            }
            
            fragments.push('```');
        } else {
            fragments.push('*文件内容为空*');
        }
        
        // 8. Wrap in collapsible block
        const contentMarkdown = fragments.join('\n');
        return this.generateDetailsBlock(summaryTitle, contentMarkdown, toolData);
    }

    /**
     * 渲染 Glob 文件搜索工具（glob_file_search）
     * T043: 处理 glob_file_search 工具
     * 
     * 渲染策略：
     * - Summary: 显示模式 + 文件总数 + 目录数
     * - Details: 按目录分组展示文件列表
     */
    private renderGlobFileSearchTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取 glob 模式
        const globPattern = rawArgs?.glob_pattern || 
                           rawArgs?.pattern ||
                           params?.globPattern ||
                           params?.pattern ||
                           '*';
        
        // 提取目标目录
        const targetDir = rawArgs?.target_directory ||
                         rawArgs?.targetDirectory ||
                         params?.targetDirectory ||
                         params?.target_directory ||
                         '';
        
        // 提取目录列表
        const directories = result?.directories || [];
        
        // 计算统计信息
        let totalFiles = 0;
        for (const dir of directories) {
            totalFiles += dir.totalFiles || dir.files?.length || 0;
        }
        
        const dirCount = directories.length;
        const dirWord = dirCount === 1 ? 'directory' : 'directories';
        
        // 生成 summary 标题
        let summaryTitle = `📁 Glob File Search: "${globPattern}" • ${totalFiles} file(s) in ${dirCount} ${dirWord}`;
        if (targetDir) {
            summaryTitle += ` in "${targetDir}"`;
        }
        
        // 渲染每个目录的文件列表
        if (directories.length > 0 && totalFiles > 0) {
            for (const dir of directories) {
                const absPath = dir.absPath || dir.path || 'Unknown';
                const files = dir.files || [];
                const fileCount = files.length;
                
                // 目录标题
                fragments.push(`### Directory: \`${absPath}\` (${fileCount} file${fileCount !== 1 ? 's' : ''})`);
                fragments.push(''); // 空行
                
                // 文件列表（使用列表格式）
                if (files.length > 0) {
                    for (const file of files) {
                        const relPath = file.relPath || file.path || file.name || 'Unknown';
                        fragments.push(`- \`${relPath}\``);
                    }
                } else {
                    fragments.push('*无文件*');
                }
                
                // 目录之间添加空行
                fragments.push('');
            }
        } else {
            fragments.push('*无匹配文件*');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(summaryTitle, content, toolData);
    }

    /**
     * 从目录树结构中递归提取所有文件和目录
     * @param node 目录树节点
     * @returns 文件和目录列表
     */
    private extractFilesFromDirectoryTree(node: any): any[] {
        const items: any[] = [];
        
        if (!node) {
            return items;
        }
        
        // 添加子目录
        if (node.childrenDirs && Array.isArray(node.childrenDirs)) {
            for (const dir of node.childrenDirs) {
                items.push({
                    name: dir.absPath?.split(/[/\\]/).pop() || 'Unknown',
                    path: dir.absPath,
                    type: '目录',
                    isDirectory: true
                });
            }
        }
        
        // 添加文件
        if (node.childrenFiles && Array.isArray(node.childrenFiles)) {
            for (const file of node.childrenFiles) {
                items.push({
                    name: file.name || 'Unknown',
                    path: file.path || file.name,
                    type: '文件',
                    isDirectory: false
                });
            }
        }
        
        // 递归处理子目录
        if (node.childrenDirs && Array.isArray(node.childrenDirs)) {
            for (const dir of node.childrenDirs) {
                const subItems = this.extractFilesFromDirectoryTree(dir);
                items.push(...subItems);
            }
        }
        
        return items;
    }

    /**
     * 从目录树结构中提取文件和目录（分开返回）
     * T073: 用于 list_dir_v2 工具
     */
    private extractFilesAndDirsFromDirectoryTree(node: any, includeSubdirs: boolean = false): { files: any[], dirs: any[] } {
        const files: any[] = [];
        const dirs: any[] = [];
        
        if (!node) {
            return { files, dirs };
        }
        
        // 添加子目录
        if (node.childrenDirs && Array.isArray(node.childrenDirs)) {
            for (const dir of node.childrenDirs) {
                const dirName = dir.absPath?.split(/[/\\]/).pop() || 'Unknown';
                dirs.push({
                    name: dirName,
                    path: dir.absPath,
                    type: '目录',
                    isDirectory: true
                });
                
                // 如果需要包含子目录，递归处理
                if (includeSubdirs) {
                    const subItems = this.extractFilesAndDirsFromDirectoryTree(dir, true);
                    files.push(...subItems.files);
                    dirs.push(...subItems.dirs);
                }
            }
        }
        
        // 添加文件
        if (node.childrenFiles && Array.isArray(node.childrenFiles)) {
            for (const file of node.childrenFiles) {
                files.push({
                    name: file.name || 'Unknown',
                    path: file.path || file.name,
                    type: '文件',
                    isDirectory: false
                });
            }
        }
        
        return { files, dirs };
    }

    /**
     * 从文件路径检测编程语言
     */
    private detectLanguageFromFilePath(filePath: string): string {
        if (!filePath) return '';
        
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const langMap: { [key: string]: string } = {
            'js': 'javascript',
            'ts': 'typescript',
            'py': 'python',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'cs': 'csharp',
            'php': 'php',
            'go': 'go',
            'rs': 'rust',
            'rb': 'ruby',
            'swift': 'swift',
            'kt': 'kotlin',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'md': 'markdown',
            'sh': 'bash',
            'sql': 'sql'
        };
        
        return langMap[ext] || '';
    }

    /**
     * 渲染创建计划工具（create_plan）
     * T075: 处理 create_plan 工具
     * 
     * 渲染策略：
     * - Summary: 显示计划名称和状态（✅ 已创建 / ❌ 已拒绝）
     * - Details: 概览、待办事项列表、计划文件链接
     */
    private renderCreatePlanTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        const additionalData = toolData.additionalData || {};
        
        // 提取计划信息
        const planName = params?.name || 'Unnamed Plan';
        const overview = params?.overview || '';
        const todos = params?.todos || [];
        const planContent = params?.plan || '';
        
        // 提取状态信息
        const isRejected = result?.rejected !== undefined;
        const planUri = additionalData?.planUri || '';
        const hasOpenedEditor = additionalData?.hasOpenedEditor || false;
        
        // 生成 summary 标题
        const summaryTitle = isRejected
            ? `❌ Create Plan: ${planName} (已拒绝)`
            : `✅ Create Plan: ${planName}`;
        
        // 显示概览
        if (overview) {
            fragments.push('**概览**:');
            fragments.push(overview);
            fragments.push('');
        }
        
        // 显示待办事项
        if (todos.length > 0) {
            fragments.push(`**待办事项** (${todos.length} 项):`);
            fragments.push('');
            
            for (const todo of todos) {
                const content = todo.content || todo.text || 'Untitled';
                const status = todo.status || 'pending';
                const id = todo.id || '';
                
                // 根据状态选择标记和格式
                let checkbox = '- [ ]';
                let formattedContent = content;
                
                if (status === 'completed' || status === 'done') {
                    checkbox = '- [x]';
                } else if (status === 'in_progress' || status === 'in-progress') {
                    checkbox = '- [ ]';
                    formattedContent = `🔄 ${content}`;
                } else if (status === 'cancelled' || status === 'canceled') {
                    checkbox = '- [x]';
                    formattedContent = `~~${content}~~`;
                }
                
                fragments.push(`${checkbox} ${formattedContent}`);
            }
            fragments.push('');
        }
        
        // 显示计划文件链接
        if (planUri) {
            // 解码 URI 并提取文件名
            const decodedUri = decodeURIComponent(planUri);
            const fileName = decodedUri.split('/').pop() || planUri;
            fragments.push(`**计划文件**: \`${fileName}\``);
            
            if (hasOpenedEditor) {
                fragments.push('*（已在编辑器中打开）*');
            }
            fragments.push('');
        }
        
        // 显示计划内容预览（如果内容较短则显示，否则只显示统计信息）
        if (planContent) {
            const lines = planContent.split('\n').length;
            const chars = planContent.length;
            
            if (chars <= 500) {
                // 内容较短，直接显示
                fragments.push('**计划内容**:');
                fragments.push('');
                fragments.push(planContent);
            } else {
                // 内容较长，只显示统计信息
                fragments.push(`**计划内容**: ${lines} 行, ${chars} 字符`);
            }
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(summaryTitle, content, toolData);
    }

    /**
     * 渲染待办事项工具（todo_write, manage_todo_list）
     * T027: 处理 todo_write, manage_todo_list 工具
     * 
     * 状态映射：
     * - pending: - [ ] 
     * - in_progress: - [ ] 🔄
     * - completed: - [x]
     * - cancelled: - [x] ~~content~~
     */
    private renderTodoTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取待办列表
        const todos = result?.finalTodos || 
                     params?.todoList || 
                     result?.todos || 
                     [];
        
        if (todos.length === 0) {
            fragments.push('*无待办事项*');
        } else {
            // 渲染为标准 Markdown 任务列表（带 - 前缀）
            for (const todo of todos) {
                const id = todo.id || '';
                const content = todo.content || todo.text || todo.task || 'Untitled';
                const status = todo.status || todo.state || 'pending';
                
                // 根据状态选择标记和格式
                let checkbox = '- [ ]';
                let formattedContent = content;
                
                if (status === 'completed' || status === 'done') {
                    checkbox = '- [x]';
                } else if (status === 'in_progress' || status === 'in-progress') {
                    checkbox = '- [ ]';
                    formattedContent = `🔄 ${content}`;
                } else if (status === 'cancelled' || status === 'canceled') {
                    checkbox = '- [x]';
                    formattedContent = `~~${content}~~`;
                } else {
                    // pending 或其他状态
                    checkbox = '- [ ]';
                }
                
                fragments.push(`${checkbox} ${formattedContent}`);
            }
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(`待办事项 (${todos.length} 项)`, content, toolData);
    }

    /**
     * 渲染终端命令工具（run_terminal_cmd, run_terminal_command, run_terminal_command_v2）
     * T028: 处理 run_terminal_cmd, run_terminal_command, run_terminal_command_v2 工具
     */
    private renderTerminalCommandTool(toolData: any): string {
        const fragments: string[] = [];
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取命令（检查多个可能的字段名）
        const command = params?.command ||
                       params?.cmd ||
                       params?.commandLine ||
                       rawArgs?.command || 
                       rawArgs?.cmd ||
                       rawArgs?.commandLine ||
                       'Unknown command';
        
        // 提取输出
        const output = result?.output || 
                      result?.stdout || 
                      result?.result || 
                      '';
        
        const error = result?.error || 
                     result?.stderr || 
                     '';
        
        fragments.push('**命令**:');
        fragments.push('```bash');
        fragments.push(command);
        fragments.push('```');
        
        if (output) {
            fragments.push('**输出**:');
            fragments.push('```output');
            fragments.push(output);
            fragments.push('```');
            fragments.push('');
        }
        
        if (error) {
            fragments.push('**错误**:');
            fragments.push('```error');
            fragments.push(error);
            fragments.push('```');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(`终端命令: ${command}`, content, toolData);
    }

    /**
     * 渲染读取 Lints 工具（read_lints）
     * T030: 处理 read_lints 工具
     * T063: 更新错误数据结构处理（linterErrorsByFile格式）
     * T074: 优化错误判断逻辑，基于实际错误数量而非 result 对象是否为空
     * 
     * 渲染策略：
     * - Summary: 显示检查路径数和错误状态（✅ 无错误，❌ 有错误）
     * - Details: 显示路径列表和错误详情（如果有）
     */
    private renderReadLintsToolnew(toolData: any): string {
        const fragments: string[] = [];
        
        // T060: 添加调试日志
        Logger.debug(`renderReadLintsToolnew called with toolData:`, JSON.stringify(toolData, null, 2));
        
        // 安全解析 JSON 字符串
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        Logger.debug(`Parsed data - rawArgs:`, rawArgs, `params:`, params, `result:`, result);
        
        // 提取检查路径
        const paths = rawArgs?.paths || params?.paths || [];
        const pathCount = paths.length;
        
        // 提取错误信息（支持两种格式）
        // 格式1: linterErrorsByFile (真实格式)
        const linterErrorsByFile = result?.linterErrorsByFile || [];
        // 格式2: files (旧格式，保持兼容)
        const filesWithErrors = result?.files || [];
        
        // 统计错误数量
        let totalErrors = 0;
        if (linterErrorsByFile.length > 0) {
            for (const fileData of linterErrorsByFile) {
                totalErrors += (fileData.errors || []).length;
            }
        } else if (filesWithErrors.length > 0) {
            for (const file of filesWithErrors) {
                totalErrors += (file.errors || []).length;
            }
        }
        
        // 判断是否有错误（基于实际错误数量）
        const hasErrors = totalErrors > 0;
        
        // 生成 summary 标题
        const summaryTitle = hasErrors
            ? `❌ Read Lints: ${totalErrors} error(s) found`
            : `✅ Read Lints: No errors found for ${pathCount} path(s)`;
        
        // 显示检查的路径
        if (paths.length > 0) {
            fragments.push('**Checked paths**:');
            for (const path of paths) {
                fragments.push(`- \`${path}\``);
            }
            fragments.push(''); // 空行
        }
        
        // 显示结果
        if (hasErrors) {
            // 处理 linterErrorsByFile 格式（真实格式）
            if (linterErrorsByFile.length > 0) {
                for (const fileData of linterErrorsByFile) {
                    const filePath = fileData.relativeWorkspacePath || 'Unknown file';
                    const errors = fileData.errors || [];
                    
                    if (errors.length > 0) {
                        fragments.push(`### \`${filePath}\` (${errors.length} error${errors.length !== 1 ? 's' : ''})`);
                        fragments.push(''); // 空行
                        
                        // 使用表格显示错误
                        fragments.push('| Line | Col | Severity | Message |');
                        fragments.push('|-----:|----:|:---------|:--------|');
                        
                        for (const error of errors) {
                            // 提取行号和列号
                            const line = error.range?.startPosition?.line || '-';
                            const column = error.range?.startPosition?.column || '-';
                            
                            // 简化 severity 显示
                            let severityDisplay = error.severity || 'error';
                            if (severityDisplay.startsWith('DIAGNOSTIC_SEVERITY_')) {
                                severityDisplay = severityDisplay.replace('DIAGNOSTIC_SEVERITY_', '').toLowerCase();
                            }
                            
                            // 转义消息中的特殊字符
                            const message = (error.message || 'No message')
                                .replace(/\|/g, '\\|')
                                .replace(/`/g, '\\`');
                            
                            fragments.push(`| ${line} | ${column} | ${severityDisplay} | ${message} |`);
                        }
                        
                        fragments.push(''); // 空行
                    }
                }
            }
            // 处理旧格式（保持兼容）
            else if (filesWithErrors.length > 0) {
                for (const file of filesWithErrors) {
                    const filePath = file.path || 'Unknown file';
                    const errors = file.errors || [];
                    
                    if (errors.length > 0) {
                        fragments.push(`### \`${filePath}\` (${errors.length} error${errors.length !== 1 ? 's' : ''})`);
                        fragments.push(''); // 空行
                        
                        // 使用表格显示错误
                        fragments.push('| Line | Col | Severity | Message |');
                        fragments.push('|-----:|----:|:---------|:--------|');
                        
                        for (const error of errors) {
                            const line = error.line || '-';
                            const column = error.column || '-';
                            const severity = error.severity || 'error';
                            const message = (error.message || 'No message')
                                .replace(/\|/g, '\\|')
                                .replace(/`/g, '\\`');
                            
                            fragments.push(`| ${line} | ${column} | ${severity} | ${message} |`);
                        }
                        
                        fragments.push(''); // 空行
                    }
                }
            }
            // 格式不明，显示原始 JSON
            else {
                fragments.push('**Errors** (raw format):');
                fragments.push('```json');
                fragments.push(JSON.stringify(result, null, 2));
                fragments.push('```');
            }
        } else {
            fragments.push('**Result**: ✅ No lint errors found');
        }
        
        const content = fragments.join('\n');
        Logger.debug(`renderReadLintsToolnew generated content (${content.length} chars):`, content.substring(0, 200));
        const detailsBlock = this.generateDetailsBlock(summaryTitle, content, toolData);
        Logger.debug(`renderReadLintsToolnew final output (${detailsBlock.length} chars)`);
        return detailsBlock;
    }

    /**
     * 渲染 MCP 工具（以 mcp_ 开头的工具）
     * T029: 处理 mcp_* 工具
     */
    private renderMcpTool(toolData: any): string {
        const fragments: string[] = [];
        
        const toolName = toolData.name || 'Unknown MCP Tool';
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        // 提取子工具调用
        const subTools = result?.calls || 
                        result?.subTools || 
                        params?.calls || 
                        [];
        
        fragments.push(`**工具**: ${toolName}`);
        fragments.push('');
        
        if (subTools.length > 0) {
            fragments.push('**子工具调用**:');
            fragments.push('');
            
            for (let i = 0; i < subTools.length; i++) {
                const subTool = subTools[i];
                const subToolName = subTool.name || subTool.toolName || `工具 ${i + 1}`;
                
                fragments.push(`- **${subToolName}**`);
                
                // 参数
                if (subTool.params || subTool.arguments) {
                    const params = subTool.params || subTool.arguments;
                    fragments.push(`  - 参数: \`${JSON.stringify(params)}\``);
                }
                
                // 结果
                if (subTool.result !== undefined) {
                    const resultStr = typeof subTool.result === 'string' 
                        ? subTool.result 
                        : JSON.stringify(subTool.result, null, 2);
                    fragments.push(`  - 结果: \`${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}\``);
                }
                
                fragments.push('');
            }
        } else {
            // 如果没有子工具信息，显示原始数据
            const rawArgs = this.safeParseJson(toolData.rawArgs);
            fragments.push('**参数**:');
            fragments.push('```json');
            fragments.push(JSON.stringify(params || rawArgs || {}, null, 2));
            fragments.push('```');
            fragments.push('');
            
            if (result) {
                fragments.push('**结果**:');
                fragments.push('```json');
                fragments.push(JSON.stringify(result, null, 2));
                fragments.push('```');
            }
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(`MCP 工具: ${toolName}`, content, toolData);
    }

    /**
     * 渲染未知工具（Fallback）
     * T030: 处理未匹配的工具
     */
    private renderUnknownTool(toolData: any): string {
        const fragments: string[] = [];
        
        let toolName = toolData.name || 'Unknown Tool';
        // 如果是Unknown Tool，在名称后面加上(bubbleId)
        if (toolName === 'Unknown Tool' && toolData.bubbleId) {
            toolName = `Unknown Tool (${toolData.bubbleId})`;
        }
        
        // 安全解析 JSON 字符串（可能是 JSON 字符串）
        const rawArgs = this.safeParseJson(toolData.rawArgs);
        const params = this.safeParseJson(toolData.params);
        const result = this.safeParseJson(toolData.result);
        
        fragments.push(`**工具名称**: ${toolName}`);
        fragments.push('');
        
        // 渲染 params
        if (params) {
            fragments.push('**参数 (params)**:');
            fragments.push('```json');
            fragments.push(JSON.stringify(params, null, 2));
            fragments.push('```');
            fragments.push('');
        }
        
        // 渲染 rawArgs
        if (rawArgs) {
            fragments.push('**原始参数 (rawArgs)**:');
            fragments.push('```json');
            fragments.push(JSON.stringify(rawArgs, null, 2));
            fragments.push('```');
            fragments.push('');
        }
        
        // 渲染 result
        if (result) {
            fragments.push('**结果 (result)**:');
            fragments.push('```json');
            fragments.push(JSON.stringify(result, null, 2));
            fragments.push('```');
            fragments.push('');
        }
        
        // 渲染 error
        if (toolData.error) {
            fragments.push('**错误 (error)**:');
            fragments.push('```json');
            fragments.push(JSON.stringify(toolData.error, null, 2));
            fragments.push('```');
        }
        
        const content = fragments.join('\n');
        return this.generateDetailsBlock(`工具: ${toolName}`, content, toolData);
    }

    /**
     * 检查工具名称是否匹配（支持精确匹配和部分匹配）
     * T052: 改进工具名称匹配逻辑
     * T058: 修复部分匹配导致的误匹配问题（如 todo_write 被匹配为 edit_file）
     * @param toolName 工具名称（已转换为小写）
     * @param patterns 匹配模式数组（可以是完整名称或部分名称）
     * @returns 是否匹配
     */
    private matchesToolName(toolName: string, patterns: string[]): boolean {
        for (const pattern of patterns) {
            const lowerPattern = pattern.toLowerCase();
            // 只使用精确匹配，避免误匹配
            if (toolName === lowerPattern) {
                return true;
            }
        }
        return false;
    }

    /**
     * 根据工具名称路由到相应的渲染方法
     * T052: 改进工具名称匹配逻辑，支持大小写不敏感和部分匹配
     * T053: 添加调试日志，记录工具名称提取过程和匹配结果
     */
    private renderToolDetails(toolData: any): string {
        if (!toolData || !toolData.name) {
            Logger.debug('renderToolDetails: No tool data or tool name');
            return '';
        }

        const toolName = toolData.name.toLowerCase();
        Logger.debug(`renderToolDetails: Processing tool "${toolData.name}" (normalized: "${toolName}")`);
        
        try {
            // III. Agent 任务和流程控制工具
            if (this.matchesToolName(toolName, ['create_plan'])) {
                Logger.debug(`renderToolDetails: Matched create plan tool, using renderCreatePlanTool`);
                return this.renderCreatePlanTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['todo_write', 'manage_todo_list'])) {
                Logger.debug(`renderToolDetails: Matched todo tool, using renderTodoTool`);
                return this.renderTodoTool(toolData);
            }
            
            // I. 代码修改与编辑工具
            if (this.matchesToolName(toolName, ['edit_file', 'multiedit', 'write', 'search_replace'])) {
                Logger.debug(`renderToolDetails: Matched edit tool, using renderEditFileTool`);
                return this.renderEditFileTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['apply_patch'])) {
                Logger.debug(`renderToolDetails: Matched patch tool, using renderApplyPatchTool`);
                return this.renderApplyPatchTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['copilot_applypatch', 'copilot_insertedit'])) {
                Logger.debug(`renderToolDetails: Matched copilot tool, using renderCopilotEditTool`);
                return this.renderCopilotEditTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['delete_file'])) {
                Logger.debug(`renderToolDetails: Matched delete tool, using renderDeleteFileTool`);
                return this.renderDeleteFileTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['edit_file_v2'])) {
                Logger.debug(`renderToolDetails: Matched edit_file_v2 tool, using renderEditFileV2Tool`);
                return this.renderEditFileV2Tool(toolData);
            }
            
            // II. 代码和知识检索工具
            if (this.matchesToolName(toolName, ['glob_file_search'])) {
                Logger.debug(`renderToolDetails: Matched glob file search tool, using renderGlobFileSearchTool`);
                return this.renderGlobFileSearchTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['codebase_search', 'semantic_search_full'])) {
                Logger.debug(`renderToolDetails: Matched codebase search tool, using renderCodebaseSearchTool`);
                return this.renderCodebaseSearchTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['web_search'])) {
                Logger.debug(`renderToolDetails: Matched web search tool, using renderWebSearchTool`);
                return this.renderWebSearchTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['web_fetch'])) {
                Logger.debug(`renderToolDetails: Matched web fetch tool, using renderWebFetchTool`);
                return this.renderWebFetchTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['grep', 'ripgrep', 'ripgrep_raw_search'])) {
                Logger.debug(`renderToolDetails: Matched grep tool, using renderGrepTool`);
                return this.renderGrepTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['fetch_pull_request'])) {
                Logger.debug(`renderToolDetails: Matched PR tool, using renderFetchPullRequestTool`);
                return this.renderFetchPullRequestTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['read_lints'])) {
                Logger.debug(`renderToolDetails: Matched read lints tool, using renderReadLintsToolnew`);
                return this.renderReadLintsToolnew(toolData);
            }
            
            if (this.matchesToolName(toolName, ['read_file', 'read_file_v2', 'copilot_readfile'])) {
                Logger.debug(`renderToolDetails: Matched read file tool, using renderReadFileTool`);
                return this.renderReadFileTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['list_dir'])) {
                Logger.debug(`renderToolDetails: Matched list dir tool, using renderListDirTool`);
                return this.renderListDirTool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['list_dir_v2'])) {
                Logger.debug(`renderToolDetails: Matched list dir v2 tool, using renderListDirV2Tool`);
                return this.renderListDirV2Tool(toolData);
            }
            
            if (this.matchesToolName(toolName, ['run_terminal_cmd', 'run_terminal_command', 'run_terminal_command_v2'])) {
                Logger.debug(`renderToolDetails: Matched terminal command tool, using renderTerminalCommandTool`);
                return this.renderTerminalCommandTool(toolData);
            }
            
            // MCP 工具（以 mcp_ 开头）
            if (toolName.startsWith('mcp_')) {
                Logger.debug(`renderToolDetails: Matched MCP tool, using renderMcpTool`);
                return this.renderMcpTool(toolData);
            }
            
            // 默认：未知工具
            Logger.debug(`renderToolDetails: No match found, using renderUnknownTool`);
            return this.renderUnknownTool(toolData);
        } catch (error) {
            Logger.warn(`Failed to render tool details for ${toolName}: ${error instanceof Error ? error.message : String(error)}`);
            return this.renderUnknownTool(toolData);
        }
    }
}

