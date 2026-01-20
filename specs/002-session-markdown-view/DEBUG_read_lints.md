# read_lints 工具渲染调试指南

## 问题描述

用户报告看不到 `read_lints` 工具的渲染内容。

## 工具数据示例

```json
{
    "toolFormerData": {
        "additionalData": {},
        "modelCallId": "ea388ca4-8574-49f2-80d2-f8934778a797",
        "name": "read_lints",
        "params": "{\"paths\":[\"esphome\",\"docs\"]}",
        "rawArgs": "{\"paths\": [\"esphome\",\"docs\"]}",
        "result": "{}",
        "status": "completed",
        "tool": 30,
        "toolCallId": "tool_74fb5c0b-e054-4919-b2ff-48f10590455",
        "toolIndex": 8
    }
}
```

## 预期输出

根据数据，应该生成以下 Markdown：

```markdown
<details>
<summary>✅ Read Lints: No errors found for 2 path(s)</summary>

**Lint paths**:
- `esphome`
- `docs`

**Result**: ✓ No lint errors found

</details>
```

## 调试步骤

### 1. 检查工具是否被正确识别

在 VS Code 输出面板中查看日志（View > Output > 选择 "Cursor Helper"）：

```
renderToolDetails: Processing tool "read_lints"
renderToolDetails: Matched read lints tool, using renderReadLintsToolnew
```

如果看到 "Matched read file tool"，说明工具被误匹配了（应该已经在 T060 中修复）。

### 2. 检查数据解析

查看日志中的解析结果：

```
renderReadLintsToolnew called with toolData: {...}
Parsed data - rawArgs: {paths: ["esphome", "docs"]} params: {paths: ["esphome", "docs"]} result: {}
```

确认：
- `rawArgs` 和 `params` 正确解析
- `result` 为空对象 `{}`

### 3. 检查生成的内容

查看日志：

```
renderReadLintsToolnew generated content (XXX chars): **Lint paths**:
- `esphome`
- `docs`
...
renderReadLintsToolnew final output (YYY chars)
```

如果内容长度为 0，说明生成逻辑有问题。

### 4. 检查前端渲染

在浏览器开发者工具中：

1. 打开 Elements 面板
2. 搜索 "Read Lints" 或 "esphome"
3. 检查是否存在对应的 HTML 元素

如果找不到，可能是：
- 前端没有收到数据
- 前端过滤了内容
- CSS 隐藏了内容

## 可能的问题

### 问题 1: 工具数据未被提取

**症状**: 日志中没有 "renderReadLintsToolnew called" 消息

**原因**: `extractToolData` 方法没有正确提取工具数据

**检查**:
```typescript
// 在 renderBubble 方法中
const toolData = this.extractToolData(bubble);
if (toolData) {
    const toolDetails = this.renderToolDetails(toolData);
    fragments.push(toolDetails);
}
```

### 问题 2: 工具匹配失败

**症状**: 日志显示 "No match found, using renderUnknownTool"

**原因**: 工具名称不匹配

**解决**: 检查 T060 修复是否已应用

### 问题 3: 内容为空

**症状**: 生成的内容长度为 0

**原因**: 
- `paths` 数组为空
- `fragments` 数组为空

**检查**:
```typescript
const paths = rawArgs?.paths || params?.paths || [];
console.log('paths:', paths, 'length:', paths.length);
```

### 问题 4: Details 块未渲染

**症状**: 有内容但最终输出为空

**原因**: `generateDetailsBlock` 方法有问题

**检查**:
```typescript
private generateDetailsBlock(summary: string, content: string, toolData: any): string {
    if (!content || content.trim() === '') {
        return '';  // ← 如果内容为空，返回空字符串
    }
    // ...
}
```

### 问题 5: 前端过滤

**症状**: 后端生成了内容，但前端不显示

**原因**: 
- `messageParser.ts` 没有正确解析
- `RecordDetail.tsx` 过滤了内容
- CSS 隐藏了 details 元素

**检查**: 在浏览器控制台运行
```javascript
document.querySelectorAll('details').forEach(d => {
    console.log('Details:', d.querySelector('summary').textContent);
});
```

## 临时解决方案

如果问题仍然存在，可以尝试：

### 1. 强制显示内容

修改 `renderReadLintsToolnew` 方法，在开头添加：

```typescript
private renderReadLintsToolnew(toolData: any): string {
    // 强制返回可见内容用于测试
    return this.generateDetailsBlock(
        '🔍 Read Lints Tool (Debug)',
        'Tool data received. Check logs for details.',
        toolData
    );
}
```

### 2. 使用 Unknown Tool 渲染

临时注释掉 `read_lints` 的匹配，让它使用 `renderUnknownTool`：

```typescript
// if (this.matchesToolName(toolName, ['read_lints', 'linter', 'lint'])) {
//     return this.renderReadLintsToolnew(toolData);
// }
```

这样可以看到原始的工具数据。

### 3. 检查 VS Code 扩展状态

确保：
- VS Code 扩展已重新加载
- 使用的是最新编译的代码
- 没有缓存问题

重新加载方法：
1. 按 `F1`
2. 输入 "Reload Window"
3. 回车

## 测试用例

创建一个简单的测试来验证渲染：

```typescript
// tests/read-lints-render.test.ts
import { MarkdownRenderer } from '../src/ui/markdownRenderer';

describe('read_lints rendering', () => {
    it('should render no errors case', () => {
        const renderer = new MarkdownRenderer();
        const toolData = {
            name: 'read_lints',
            rawArgs: '{"paths": ["esphome", "docs"]}',
            params: '{"paths": ["esphome", "docs"]}',
            result: '{}'
        };
        
        const output = renderer.renderToolDetails(toolData);
        
        expect(output).toContain('Read Lints');
        expect(output).toContain('esphome');
        expect(output).toContain('docs');
        expect(output).toContain('No lint errors found');
    });
});
```

## 下一步

1. **重新加载 VS Code 窗口**
2. **打开输出面板**查看日志
3. **触发一次 read_lints 工具调用**
4. **检查日志输出**
5. **在前端检查 HTML 元素**

如果问题仍然存在，请提供：
- VS Code 输出面板的日志
- 浏览器控制台的错误信息
- 浏览器 Elements 面板的 HTML 结构

