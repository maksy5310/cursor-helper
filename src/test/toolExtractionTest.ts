/**
 * 工具数据提取测试
 * T054: 测试修复后的工具数据提取逻辑，验证各种工具类型都能正确提取名称，不再显示 "Unknown Tool"
 */

import { MarkdownRenderer } from '../ui/markdownRenderer';
import { Logger } from '../utils/logger';

/**
 * 测试用例：各种工具数据格式
 */
interface TestCase {
    name: string;
    bubble: any;
    expectedToolName: string;
    description: string;
}

/**
 * 创建测试用例
 */
function createTestCases(): TestCase[] {
    const now = Date.now();
    
    return [
        // 测试 1: toolFormerData.name
        {
            name: 'toolFormerData with name field',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                toolFormerData: {
                    name: 'edit_file',
                    status: 'completed',
                    params: {
                        relativeWorkspacePath: 'src/test.ts'
                    },
                    result: {
                        diff: {
                            chunks: []
                        }
                    }
                }
            },
            expectedToolName: 'edit_file',
            description: '工具名称在 toolFormerData.name 中'
        },
        
        // 测试 2: toolFormerData.toolName
        {
            name: 'toolFormerData with toolName field',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                toolFormerData: {
                    toolName: 'codebase_search',
                    status: 'completed',
                    params: {
                        query: 'test query'
                    }
                }
            },
            expectedToolName: 'codebase_search',
            description: '工具名称在 toolFormerData.toolName 中'
        },
        
        // 测试 3: toolCallResults[].name
        {
            name: 'toolCallResults with name field',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                toolCallResults: [{
                    name: 'read_file',
                    status: 'completed',
                    params: {
                        file_path: 'src/test.ts'
                    },
                    result: {
                        content: 'test content'
                    }
                }]
            },
            expectedToolName: 'read_file',
            description: '工具名称在 toolCallResults[0].name 中'
        },
        
        // 测试 4: toolCallResults[].toolName
        {
            name: 'toolCallResults with toolName field',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                toolCallResults: [{
                    toolName: 'run_terminal_cmd',
                    status: 'completed',
                    params: {
                        command: 'ls -la'
                    },
                    result: {
                        output: 'test output'
                    }
                }]
            },
            expectedToolName: 'run_terminal_cmd',
            description: '工具名称在 toolCallResults[0].toolName 中'
        },
        
        // 测试 5: capabilities[].name
        {
            name: 'capabilities with name field',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                capabilities: [{
                    name: 'grep',
                    type: 'search',
                    params: {
                        pattern: 'test'
                    }
                }]
            },
            expectedToolName: 'grep',
            description: '工具名称在 capabilities[0].name 中'
        },
        
        // 测试 6: capabilities[].type (作为后备)
        {
            name: 'capabilities with type field (fallback)',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                capabilities: [{
                    type: 'web_search',
                    params: {
                        search_term: 'test'
                    }
                }]
            },
            expectedToolName: 'web_search',
            description: '工具名称在 capabilities[0].type 中（作为后备）'
        },
        
        // 测试 7: toolFormerData.tool_name (下划线格式)
        {
            name: 'toolFormerData with tool_name field',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                toolFormerData: {
                    tool_name: 'delete_file',
                    status: 'completed',
                    params: {
                        file_path: 'src/test.ts'
                    }
                }
            },
            expectedToolName: 'delete_file',
            description: '工具名称在 toolFormerData.tool_name 中（下划线格式）'
        },
        
        // 测试 8: toolFormerData.functionName
        {
            name: 'toolFormerData with functionName field',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                toolFormerData: {
                    functionName: 'todo_write',
                    status: 'completed',
                    params: {
                        todoList: []
                    }
                }
            },
            expectedToolName: 'todo_write',
            description: '工具名称在 toolFormerData.functionName 中'
        },
        
        // 测试 9: 大小写不敏感匹配
        {
            name: 'case-insensitive tool name matching',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                toolFormerData: {
                    name: 'EDIT_FILE', // 大写
                    status: 'completed',
                    params: {
                        relativeWorkspacePath: 'src/test.ts'
                    }
                }
            },
            expectedToolName: 'EDIT_FILE',
            description: '工具名称大小写不敏感匹配（应匹配 edit_file 渲染器）'
        },
        
        // 测试 10: 部分匹配（如 "edit" 匹配 "edit_file"）
        {
            name: 'partial tool name matching',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                toolFormerData: {
                    name: 'edit', // 部分匹配
                    status: 'completed',
                    params: {
                        relativeWorkspacePath: 'src/test.ts'
                    }
                }
            },
            expectedToolName: 'edit',
            description: '工具名称部分匹配（"edit" 应匹配 edit_file 渲染器）'
        },
        
        // 测试 11: MCP 工具
        {
            name: 'MCP tool',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                toolFormerData: {
                    name: 'mcp_cursor-ide-browser_browser_navigate',
                    status: 'completed',
                    params: {
                        url: 'https://example.com'
                    }
                }
            },
            expectedToolName: 'mcp_cursor-ide-browser_browser_navigate',
            description: 'MCP 工具（以 mcp_ 开头）'
        },
        
        // 测试 12: 未知工具（应显示工具名称，而不是 "Unknown Tool"）
        {
            name: 'unknown tool with name',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                toolFormerData: {
                    name: 'custom_tool',
                    status: 'completed',
                    params: {
                        customParam: 'value'
                    }
                }
            },
            expectedToolName: 'custom_tool',
            description: '未知工具但有名称为 custom_tool（应显示工具名称，使用 renderUnknownTool）'
        },
        
        // 测试 13: 完全没有工具名称（应显示 "Unknown Tool"）
        {
            name: 'tool without name field',
            bubble: {
                role: 'assistant',
                type: 2,
                text: '',
                timestamp: now,
                toolFormerData: {
                    status: 'completed',
                    params: {
                        someParam: 'value'
                    }
                }
            },
            expectedToolName: 'Unknown Tool',
            description: '完全没有工具名称字段（应显示 "Unknown Tool"）'
        }
    ];
}

/**
 * 运行测试
 */
export async function runToolExtractionTests(): Promise<void> {
    Logger.info('开始运行工具数据提取测试...');
    
    const renderer = new MarkdownRenderer();
    const testCases = createTestCases();
    let passedCount = 0;
    let failedCount = 0;
    const failures: string[] = [];
    
    for (const testCase of testCases) {
        try {
            Logger.info(`\n测试: ${testCase.name}`);
            Logger.info(`描述: ${testCase.description}`);
            
            // 渲染气泡
            const markdown = renderer.renderBubble(testCase.bubble);
            
            // 检查是否包含预期的工具名称（不区分大小写）
            const expectedNameLower = testCase.expectedToolName.toLowerCase();
            const markdownLower = markdown.toLowerCase();
            
            // 检查是否包含工具名称（在占位符或详情中）
            const hasToolName = markdownLower.includes(expectedNameLower) || 
                               markdownLower.includes(`[tool use: ${expectedNameLower}]`) ||
                               markdownLower.includes(`工具: ${expectedNameLower}`) ||
                               markdownLower.includes(`工具名称: ${expectedNameLower}`);
            
            // 检查是否包含 "Unknown Tool"（如果预期不是 "Unknown Tool"）
            const hasUnknownTool = markdownLower.includes('unknown tool');
            const shouldHaveUnknown = testCase.expectedToolName === 'Unknown Tool';
            
            if (hasToolName && (shouldHaveUnknown === hasUnknownTool)) {
                Logger.info(`✅ 通过: 工具名称 "${testCase.expectedToolName}" 正确提取`);
                passedCount++;
                
                // 检查是否包含 HTML 注释（TOOL_DATA 或 BUBBLE_DATA）
                if (markdown.includes('<!-- TOOL_DATA:') || markdown.includes('<!-- BUBBLE_DATA:')) {
                    Logger.info(`✅ HTML 注释已附加`);
                } else {
                    Logger.warn(`⚠️ HTML 注释未找到（可能在某些情况下是正常的）`);
                }
            } else {
                Logger.error(`❌ 失败: 工具名称提取不正确`);
                Logger.error(`   预期: ${testCase.expectedToolName}`);
                Logger.error(`   实际 Markdown 片段: ${markdown.substring(0, 200)}...`);
                failedCount++;
                failures.push(`${testCase.name}: 预期 "${testCase.expectedToolName}"，但提取失败`);
            }
        } catch (error) {
            Logger.error(`❌ 测试异常: ${testCase.name}`, error as Error);
            failedCount++;
            failures.push(`${testCase.name}: 测试异常 - ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    // 输出测试结果摘要
    Logger.info('\n' + '='.repeat(60));
    Logger.info('测试结果摘要');
    Logger.info('='.repeat(60));
    Logger.info(`总测试数: ${testCases.length}`);
    Logger.info(`通过: ${passedCount}`);
    Logger.info(`失败: ${failedCount}`);
    
    if (failures.length > 0) {
        Logger.error('\n失败的测试:');
        for (const failure of failures) {
            Logger.error(`  - ${failure}`);
        }
    }
    
    if (failedCount === 0) {
        Logger.info('\n✅ 所有测试通过！工具数据提取逻辑工作正常。');
    } else {
        Logger.warn(`\n⚠️ ${failedCount} 个测试失败，需要检查工具数据提取逻辑。`);
    }
    
    Logger.info('='.repeat(60));
}

/**
 * 测试 HTML 注释功能
 */
export function testHtmlComments(): void {
    Logger.info('\n测试 HTML 注释功能...');
    
    const renderer = new MarkdownRenderer();
    const now = Date.now();
    
    const bubble = {
        role: 'assistant',
        type: 2,
        text: '',
        timestamp: now,
        toolFormerData: {
            name: 'edit_file',
            status: 'completed',
            params: {
                relativeWorkspacePath: 'src/test.ts'
            },
            result: {
                diff: {
                    chunks: []
                }
            }
        }
    };
    
    const markdown = renderer.renderBubble(bubble);
    
    // 检查是否包含 HTML 注释
    const hasBubbleDataComment = markdown.includes('<!-- BUBBLE_DATA:');
    const hasToolDataComment = markdown.includes('<!-- TOOL_DATA:');
    
    Logger.info(`BUBBLE_DATA 注释: ${hasBubbleDataComment ? '✅ 存在' : '❌ 缺失'}`);
    Logger.info(`TOOL_DATA 注释: ${hasToolDataComment ? '✅ 存在' : '❌ 缺失'}`);
    
    if (hasBubbleDataComment || hasToolDataComment) {
        Logger.info('✅ HTML 注释功能正常');
        
        // 尝试提取注释内容（用于调试）
        const bubbleDataMatch = markdown.match(/<!-- BUBBLE_DATA: (.*?) -->/s);
        const toolDataMatch = markdown.match(/<!-- TOOL_DATA: (.*?) -->/s);
        
        if (bubbleDataMatch) {
            Logger.info(`BUBBLE_DATA 注释长度: ${bubbleDataMatch[1].length} 字符`);
        }
        if (toolDataMatch) {
            Logger.info(`TOOL_DATA 注释长度: ${toolDataMatch[1].length} 字符`);
        }
    } else {
        Logger.warn('⚠️ HTML 注释未找到');
    }
}

