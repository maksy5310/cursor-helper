/**
 * 测试 read_lints 工具数据提取
 * 
 * 这个脚本模拟数据提取过程，帮助诊断问题
 */

// 模拟用户提供的数据
const bubbleData = {
    bubbleId: "test-bubble-123",
    role: "assistant",
    type: 2,
    text: "检查代码中的 linter 错误",
    toolFormerData: {
        additionalData: {},
        modelCallId: "ea388ca4-8574-49f2-80d2-f8934778a797",
        name: "read_lints",
        params: '{"paths":["esphome","docs"]}',
        rawArgs: '{"paths": ["esphome","docs"]}',
        result: "{}",
        status: "completed",
        tool: 30,
        toolCallId: "tool_74fb5c0b-e054-4919-b2ff-48f10590455",
        toolIndex: 8
    }
};

console.log('=== 测试 read_lints 数据提取 ===\n');

// 1. 检查 bubble 结构
console.log('1. 检查 bubble 结构:');
console.log('   - hasToolFormerData:', !!bubbleData.toolFormerData);
console.log('   - toolFormerData type:', typeof bubbleData.toolFormerData);
console.log('   - toolFormerData.name:', bubbleData.toolFormerData?.name);
console.log('');

// 2. 模拟 extractToolName
function extractToolName(data: any): string | null {
    if (!data) {
        return null;
    }

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

console.log('2. 提取工具名称:');
const toolName = extractToolName(bubbleData.toolFormerData);
console.log('   - Extracted name:', toolName);
console.log('');

// 3. 模拟 extractToolData
function extractToolData(bubble: any): any {
    if (bubble.toolFormerData && typeof bubble.toolFormerData === 'object') {
        const name = extractToolName(bubble.toolFormerData) || 'Unknown Tool';
        
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
    return null;
}

console.log('3. 提取工具数据:');
const toolData = extractToolData(bubbleData);
if (toolData) {
    console.log('   ✓ 成功提取工具数据');
    console.log('   - name:', toolData.name);
    console.log('   - rawArgs:', toolData.rawArgs);
    console.log('   - params:', toolData.params);
    console.log('   - result:', toolData.result);
} else {
    console.log('   ✗ 提取失败');
}
console.log('');

// 4. 模拟 safeParseJson
function safeParseJson(value: any): any {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    }
    return value;
}

console.log('4. 解析 JSON 数据:');
if (toolData) {
    const rawArgs = safeParseJson(toolData.rawArgs);
    const params = safeParseJson(toolData.params);
    const result = safeParseJson(toolData.result);
    
    console.log('   - rawArgs parsed:', JSON.stringify(rawArgs));
    console.log('   - params parsed:', JSON.stringify(params));
    console.log('   - result parsed:', JSON.stringify(result));
    console.log('   - paths:', rawArgs?.paths || params?.paths);
} else {
    console.log('   ✗ 无法解析（工具数据为空）');
}
console.log('');

// 5. 模拟 matchesToolName
function matchesToolName(toolName: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
        const lowerPattern = pattern.toLowerCase();
        // 精确匹配
        if (toolName === lowerPattern) {
            return true;
        }
        // 部分匹配：只检查工具名称是否包含模式
        if (toolName.includes(lowerPattern)) {
            return true;
        }
    }
    return false;
}

console.log('5. 测试工具匹配:');
if (toolData) {
    const lowerToolName = toolData.name.toLowerCase();
    console.log('   - Tool name (lowercase):', lowerToolName);
    console.log('   - Matches read_lints patterns:', matchesToolName(lowerToolName, ['read_lints', 'linter', 'lint']));
    console.log('   - Matches read_file patterns:', matchesToolName(lowerToolName, ['read_file', 'read_file_v2', 'copilot_readfile', 'read']));
} else {
    console.log('   ✗ 无法测试（工具数据为空）');
}
console.log('');

// 6. 模拟内容生成
console.log('6. 生成 Markdown 内容:');
if (toolData) {
    const rawArgs = safeParseJson(toolData.rawArgs);
    const params = safeParseJson(toolData.params);
    const result = safeParseJson(toolData.result);
    
    const paths = rawArgs?.paths || params?.paths || [];
    const pathCount = paths.length;
    
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
    const hasErrors = resultStr !== '{}' && resultStr !== '' && 
                     Object.keys(result || {}).length > 0;
    
    const summaryTitle = hasErrors
        ? `❌ Read Lints: Errors found`
        : `✅ Read Lints: No errors found for ${pathCount} path(s)`;
    
    const fragments: string[] = [];
    fragments.push('**Lint paths**:');
    if (paths.length > 0) {
        for (const path of paths) {
            fragments.push(`- \`${path}\``);
        }
    } else {
        fragments.push('- *(no paths specified)*');
    }
    fragments.push('');
    
    if (!hasErrors) {
        fragments.push('**Result**: ✓ No lint errors found');
    }
    
    const content = fragments.join('\n');
    
    console.log('   - Summary:', summaryTitle);
    console.log('   - Content length:', content.length);
    console.log('   - Content preview:');
    console.log('---');
    console.log(content);
    console.log('---');
} else {
    console.log('   ✗ 无法生成（工具数据为空）');
}
console.log('');

console.log('=== 测试完成 ===');
console.log('');
console.log('如果所有步骤都成功，说明数据提取逻辑是正确的。');
console.log('如果在实际运行中看不到内容，可能的原因：');
console.log('1. CSV 解析时 toolFormerData 没有被正确提取');
console.log('2. bubble 对象结构与预期不同');
console.log('3. 前端渲染时过滤了内容');
console.log('4. VS Code 扩展没有使用最新编译的代码');

