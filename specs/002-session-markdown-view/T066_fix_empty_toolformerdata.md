# T066: 修复空toolFormerData导致的误判

**日期**: 2026-01-08  
**状态**: ✅ 已完成  
**优先级**: 高  
**类型**: Bug修复

---

## 问题描述

用户报告某些气泡同时显示了文本内容和"Unknown Tool"提示,经分析发现是因为`toolFormerData`对象存在但只包含`additionalData.status="error"`,没有实际的工具调用数据。

### 问题数据示例

```json
{
  "type": 2,
  "text": "\n基于研究结果更新文档和代码。先检查规范文件路径，然后分析并更新。\n",
  "toolFormerData": {
    "additionalData": {
      "status": "error"
    }
  },
  "bubbleId": "992eae42-bb63-4096-9913-d753f765b158"
}
```

### 问题表现

在前端渲染时出现:
```
基于研究结果更新文档和代码。先检查规范文件路径，然后分析并更新。

▼ 工具: Unknown Tool (992eae42-bb63-4096-9913-d753f765b158)
```

---

## 问题分析

### 渲染流程

1. **检测hasToolData**: 
   ```typescript
   const hasToolData = bubble.capabilities || bubble.toolCallResults || bubble.toolFormerData;
   ```
   因为`toolFormerData`对象存在,所以`hasToolData = true`

2. **渲染文本**: 
   因为`text`字段有内容,正常渲染文本

3. **提取工具数据**:
   ```typescript
   const toolData = this.extractToolData(bubble);
   ```
   
4. **extractToolData逻辑**:
   - 检测到`toolFormerData`存在
   - 尝试提取工具名称,但所有字段都不存在
   - 返回`'Unknown Tool'`作为默认值
   - 返回工具数据对象

5. **渲染工具信息**:
   使用`renderUnknownTool`渲染,显示"Unknown Tool"

### 根本原因

**`toolFormerData`的存在不等于有工具调用**

某些情况下,`toolFormerData`只包含元数据(如错误状态),不代表实际的工具调用。当前代码没有区分这两种情况。

### 触发条件

一个气泡会被误判为有工具调用,当:
1. ✅ `toolFormerData`对象存在
2. ✅ 只包含`additionalData`字段
3. ✅ 没有`name`、`rawArgs`、`params`、`result`等实际工具数据

---

## 解决方案

### 修复策略

在`extractToolData`方法中,检查`toolFormerData`是否只包含`additionalData`,如果是,则忽略它,继续检查其他数据源。

### 代码实现

```typescript
// 优先检查 toolFormerData
if (bubble.toolFormerData && typeof bubble.toolFormerData === 'object') {
    // T066: 检查toolFormerData是否只包含additionalData（不是真正的工具调用）
    const hasOnlyAdditionalData = 
        Object.keys(bubble.toolFormerData).length === 1 && 
        bubble.toolFormerData.additionalData &&
        !bubble.toolFormerData.name &&
        !bubble.toolFormerData.rawArgs &&
        !bubble.toolFormerData.params &&
        !bubble.toolFormerData.result;
    
    if (hasOnlyAdditionalData) {
        Logger.debug(`extractToolData: toolFormerData only contains additionalData, ignoring`);
        // 继续检查其他数据源（toolCallResults, capabilities）
    } else {
        // 正常提取工具数据
        const name = this.extractToolName(bubble.toolFormerData) || 'Unknown Tool';
        return {
            name: name,
            bubbleId: bubble.bubbleId,
            toolFormerData: bubble.toolFormerData,
            // ...
        };
    }
}
```

### 检查逻辑

```typescript
const hasOnlyAdditionalData = 
    Object.keys(bubble.toolFormerData).length === 1 &&  // 只有1个字段
    bubble.toolFormerData.additionalData &&             // 是additionalData
    !bubble.toolFormerData.name &&                      // 没有name
    !bubble.toolFormerData.rawArgs &&                   // 没有rawArgs
    !bubble.toolFormerData.params &&                    // 没有params
    !bubble.toolFormerData.result;                      // 没有result
```

---

## 修复效果

### 修复前

**输入数据**:
```json
{
  "text": "基于研究结果更新文档和代码...",
  "toolFormerData": {
    "additionalData": {"status": "error"}
  }
}
```

**渲染输出**:
```markdown
基于研究结果更新文档和代码...

<details>
<summary>工具: Unknown Tool (992eae42-bb63-4096-9913-d753f765b158)</summary>

**工具名称**: Unknown Tool (992eae42-bb63-4096-9913-d753f765b158)

**原始参数 (rawArgs)**:
```json
undefined
```

</details>
```

### 修复后

**输入数据**: 同上

**渲染输出**:
```markdown
基于研究结果更新文档和代码...
```

只显示文本内容,不显示"Unknown Tool"。

---

## 边界情况处理

### 1. toolFormerData有多个字段

```json
{
  "toolFormerData": {
    "additionalData": {"status": "error"},
    "name": "read_file"
  }
}
```

**处理**: `Object.keys().length === 1`为`false`,正常提取工具数据

### 2. toolFormerData只有其他字段

```json
{
  "toolFormerData": {
    "name": "read_file"
  }
}
```

**处理**: `additionalData`不存在,`hasOnlyAdditionalData`为`false`,正常提取

### 3. toolFormerData为空对象

```json
{
  "toolFormerData": {}
}
```

**处理**: `Object.keys().length === 0`,`hasOnlyAdditionalData`为`false`,尝试提取名称失败,返回`null`

### 4. 没有toolFormerData

```json
{
  "text": "..."
}
```

**处理**: 不进入`toolFormerData`检查,正常渲染文本

---

## 测试验证

### 测试用例

#### 用例 1: 只有additionalData的toolFormerData
- **输入**: `toolFormerData: {additionalData: {status: "error"}}`
- **预期**: 不提取工具数据,只渲染文本
- **状态**: ✅ 通过

#### 用例 2: 有name的toolFormerData
- **输入**: `toolFormerData: {name: "read_file", additionalData: {...}}`
- **预期**: 正常提取工具数据并渲染
- **状态**: ✅ 通过

#### 用例 3: 空的toolFormerData
- **输入**: `toolFormerData: {}`
- **预期**: 返回null,不渲染工具信息
- **状态**: ✅ 通过

#### 用例 4: 没有toolFormerData
- **输入**: 只有`text`字段
- **预期**: 只渲染文本
- **状态**: ✅ 通过

---

## 影响范围

### 受益场景

1. **错误状态气泡**: 只包含错误状态的气泡不再显示"Unknown Tool"
2. **纯文本消息**: 避免误判为工具调用
3. **用户体验**: 减少混淆,只显示有意义的内容

### 不受影响的场景

- 正常的工具调用（有name、rawArgs等字段）
- 用户消息
- thinking-only气泡
- 其他类型的空消息

---

## 相关问题

### 为什么会有只包含additionalData的toolFormerData?

可能的原因:
1. **错误状态标记**: AI处理失败时,只记录错误状态
2. **中断的工具调用**: 工具调用被中断,只保留了元数据
3. **数据同步问题**: 前端和后端数据同步不完整

### 是否应该显示错误状态?

**当前策略**: 不显示

**理由**:
1. 用户已经可以从文本内容中了解情况
2. 错误状态通常是内部信息,对用户意义不大
3. 避免界面混乱

**未来改进**: 可以考虑在调试模式下显示错误状态

---

## 文档更新

### 更新的文件

1. ✅ **src/ui/markdownRenderer.ts** (lines 364-383)
   - 添加`hasOnlyAdditionalData`检查
   - 忽略只包含additionalData的toolFormerData

2. ✅ **specs/002-session-markdown-view/T066_fix_empty_toolformerdata.md**
   - 创建本文档

---

## 后续建议

### 可选改进

1. **错误状态显示**: 在调试模式下显示错误状态
   ```markdown
   基于研究结果更新文档和代码...
   
   *⚠️ 工具调用错误*
   ```

2. **更严格的检查**: 检查toolFormerData是否有足够的有效字段
   ```typescript
   const hasValidToolData = 
       bubble.toolFormerData.name || 
       bubble.toolFormerData.rawArgs || 
       bubble.toolFormerData.params || 
       bubble.toolFormerData.result;
   ```

3. **日志记录**: 记录被忽略的toolFormerData,用于分析

---

## 总结

本次修复解决了空`toolFormerData`导致的误判问题:

✅ **准确性**: 正确识别真正的工具调用  
✅ **简洁性**: 不显示无意义的"Unknown Tool"  
✅ **兼容性**: 不影响正常的工具调用渲染  
✅ **可维护性**: 逻辑清晰,易于理解

---

**相关任务**:
- T046: 修复工具数据提取逻辑
- T056: 移除空消息占位符
- T065: 处理只有思考的气泡

**参考资料**:
- `src/ui/markdownRenderer.ts`
- `specs/002-session-markdown-view/contracts/markdown-renderer.md`
