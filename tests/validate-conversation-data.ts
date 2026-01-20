/**
 * 会话数据验证和分析工具
 * 用于验证 CSV 格式的会话数据，并生成数据特征报告
 */

import * as fs from 'fs';
import * as path from 'path';

interface BubbleData {
    bubbleId: string;
    type: number;
    text?: string;
    richText?: string;
    toolFormerData?: any;
    thinking?: any;
    codeBlocks?: any[];
    createdAt?: string;
    isAgentic?: boolean;
    context?: any;
}

interface ValidationResult {
    totalRecords: number;
    userMessages: number;
    agentMessages: number;
    toolCalls: number;
    thinkingBlocks: number;
    codeBlocks: number;
    richTextMessages: number;
    toolTypes: Map<string, number>;
    errors: string[];
    warnings: string[];
}

// 用于跟踪是否已显示错误
let errorShown = false;

/**
 * 解析 CSV 行为 BubbleData
 */
function parseCsvLine(line: string): BubbleData | null {
    let bubbleIdPart = '';
    let jsonPart = '';
    
    try {
        // 格式: bubbleId:xxx:yyy,"{JSON}"
        // 注意：JSON 部分被双引号包裹，内部的双引号用 "" 表示（CSV 标准）
        const firstCommaIndex = line.indexOf(',');
        if (firstCommaIndex === -1) {
            return null;
        }

        bubbleIdPart = line.substring(0, firstCommaIndex);
        jsonPart = line.substring(firstCommaIndex + 1);

        // 先 trim 掉空白字符（包括 \r\n）
        jsonPart = jsonPart.trim();

        // 移除开头和结尾的双引号（如果有）
        if (jsonPart.startsWith('"') && jsonPart.endsWith('"')) {
            jsonPart = jsonPart.substring(1, jsonPart.length - 1);
        }

        // CSV 标准：双引号转义为两个双引号，需要替换回单个双引号
        jsonPart = jsonPart.replace(/""/g, '"');

        // 解析 JSON
        const data = JSON.parse(jsonPart);

        return {
            bubbleId: bubbleIdPart,
            ...data
        };
    } catch (error) {
        // 输出第一个错误的详细信息用于调试
        if (!errorShown) {
            console.error(`\n❌ 解析错误示例:`);
            console.error(`错误: ${error}`);
            console.error(`BubbleId: ${bubbleIdPart}`);
            console.error(`JSON 前100字符: ${jsonPart.substring(0, 100)}...\n`);
            errorShown = true;
        }
        return null;
    }
}

/**
 * 提取工具名称
 */
function extractToolName(toolData: any): string | null {
    if (!toolData || typeof toolData !== 'object') {
        return null;
    }

    const possibleFields = ['name', 'toolName', 'tool_name', 'functionName'];
    for (const field of possibleFields) {
        if (toolData[field] && typeof toolData[field] === 'string') {
            return toolData[field];
        }
    }

    return null;
}

/**
 * 验证会话数据
 */
function validateConversationData(filePath: string): ValidationResult {
    const result: ValidationResult = {
        totalRecords: 0,
        userMessages: 0,
        agentMessages: 0,
        toolCalls: 0,
        thinkingBlocks: 0,
        codeBlocks: 0,
        richTextMessages: 0,
        toolTypes: new Map(),
        errors: [],
        warnings: []
    };

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        console.log(`📊 Processing ${lines.length} lines...`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const bubble = parseCsvLine(line);

            if (!bubble) {
                result.errors.push(`Line ${i + 1}: Failed to parse`);
                continue;
            }

            result.totalRecords++;

            // 统计消息类型
            if (bubble.type === 1) {
                result.userMessages++;
            } else if (bubble.type === 2) {
                result.agentMessages++;
            }

            // 统计 richText
            if (bubble.richText) {
                result.richTextMessages++;
            }

            // 统计 thinking
            if (bubble.thinking) {
                result.thinkingBlocks++;
            }

            // 统计 codeBlocks
            if (bubble.codeBlocks && Array.isArray(bubble.codeBlocks)) {
                result.codeBlocks += bubble.codeBlocks.length;
            }

            // 统计工具调用
            if (bubble.toolFormerData) {
                result.toolCalls++;
                const toolName = extractToolName(bubble.toolFormerData);
                if (toolName) {
                    const count = result.toolTypes.get(toolName) || 0;
                    result.toolTypes.set(toolName, count + 1);
                } else {
                    result.warnings.push(`Line ${i + 1}: Tool call without name`);
                }
            }

            // 验证必要字段
            if (!bubble.createdAt) {
                result.warnings.push(`Line ${i + 1}: Missing createdAt`);
            }

            if (bubble.type === 1 && !bubble.text && !bubble.richText) {
                result.warnings.push(`Line ${i + 1}: User message without text or richText`);
            }
        }

        console.log(`✅ Validation complete`);
    } catch (error) {
        result.errors.push(`Fatal error: ${error}`);
    }

    return result;
}

/**
 * 生成报告
 */
function generateReport(result: ValidationResult): string {
    const lines: string[] = [];

    lines.push('# 会话数据验证报告\n');
    lines.push(`**生成时间**: ${new Date().toISOString()}\n`);

    lines.push('## 📊 基本统计\n');
    lines.push(`- **总记录数**: ${result.totalRecords}`);
    lines.push(`- **用户消息**: ${result.userMessages}`);
    lines.push(`- **Agent 消息**: ${result.agentMessages}`);
    lines.push(`- **工具调用**: ${result.toolCalls}`);
    lines.push(`- **思考块**: ${result.thinkingBlocks}`);
    lines.push(`- **代码块**: ${result.codeBlocks}`);
    lines.push(`- **富文本消息**: ${result.richTextMessages}\n`);

    lines.push('## 🛠️ 工具使用统计\n');
    const sortedTools = Array.from(result.toolTypes.entries())
        .sort((a, b) => b[1] - a[1]);
    
    lines.push('| 工具名称 | 使用次数 |');
    lines.push('|:---------|--------:|');
    for (const [tool, count] of sortedTools) {
        lines.push(`| \`${tool}\` | ${count} |`);
    }
    lines.push('');

    if (result.errors.length > 0) {
        lines.push('## ❌ 错误\n');
        for (const error of result.errors) {
            lines.push(`- ${error}`);
        }
        lines.push('');
    }

    if (result.warnings.length > 0) {
        lines.push('## ⚠️ 警告\n');
        for (const warning of result.warnings.slice(0, 10)) {
            lines.push(`- ${warning}`);
        }
        if (result.warnings.length > 10) {
            lines.push(`- ... 还有 ${result.warnings.length - 10} 个警告\n`);
        }
        lines.push('');
    }

    lines.push('## ✅ 验证结果\n');
    if (result.errors.length === 0) {
        lines.push('数据格式正确，可以用于渲染测试。\n');
    } else {
        lines.push('数据存在错误，需要修复后才能使用。\n');
    }

    return lines.join('\n');
}

/**
 * 主函数
 */
function main() {
    const csvPath = path.join(__dirname, 'p1sc-conversation.csv');
    const reportPath = path.join(__dirname, 'validation-report.md');

    console.log('🔍 开始验证会话数据...\n');
    console.log(`📁 输入文件: ${csvPath}`);
    console.log(`📄 报告文件: ${reportPath}\n`);

    const result = validateConversationData(csvPath);
    const report = generateReport(result);

    fs.writeFileSync(reportPath, report, 'utf-8');

    console.log('\n' + report);
    console.log(`\n📝 报告已保存到: ${reportPath}`);
}

// 运行
if (require.main === module) {
    main();
}

export { validateConversationData, generateReport, ValidationResult };

