# T063: Read Lints 错误数据格式更新

**日期**: 2026-01-08  
**状态**: ✅ 已完成  
**优先级**: 高  
**关联任务**: T030, T060, T061

---

## 问题描述

用户提供了`read_lints`工具返回错误时的真实数据格式,与之前在契约文档中假设的格式不同。需要更新渲染逻辑以正确处理真实的数据结构。

### 真实数据格式

```json
{
  "linterErrorsByFile": [
    {
      "relativeWorkspacePath": "main.py",
      "errors": [
        {
          "message": "Import \"os\" is not accessed",
          "range": {
            "startPosition": {"line": 6, "column": 8},
            "endPosition": {"line": 6, "column": 10}
          },
          "severity": "DIAGNOSTIC_SEVERITY_HINT"
        }
      ]
    }
  ]
}
```

### 之前假设的格式

```json
{
  "files": [
    {
      "path": "esphome/p1sc-controller.yaml",
      "errors": [
        {
          "line": 42,
          "column": 5,
          "severity": "error",
          "message": "Indentation error"
        }
      ]
    }
  ]
}
```

---

## 数据结构差异分析

### 关键差异

| 字段 | 假设格式 | 真实格式 | 说明 |
|:-----|:---------|:---------|:-----|
| **顶层字段** | `files` | `linterErrorsByFile` | 数组名称不同 |
| **文件路径字段** | `path` | `relativeWorkspacePath` | 字段名称更具描述性 |
| **位置信息** | `line`, `column` (直接字段) | `range.startPosition.line`, `range.startPosition.column` | 嵌套结构,包含起止位置 |
| **严重性格式** | `"error"`, `"warning"` | `"DIAGNOSTIC_SEVERITY_ERROR"`, `"DIAGNOSTIC_SEVERITY_HINT"` | 使用枚举常量 |

### Severity 枚举值

真实格式使用VS Code诊断API的标准枚举:

| 枚举值 | 显示为 | 含义 |
|:-------|:-------|:-----|
| `DIAGNOSTIC_SEVERITY_ERROR` | `error` | 错误 |
| `DIAGNOSTIC_SEVERITY_WARNING` | `warning` | 警告 |
| `DIAGNOSTIC_SEVERITY_INFORMATION` | `information` | 信息 |
| `DIAGNOSTIC_SEVERITY_HINT` | `hint` | 提示 |

---

## 解决方案

### 代码改进

更新`renderReadLintsToolnew`方法,支持两种数据格式:

```typescript
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
}

// 处理 linterErrorsByFile 格式（真实格式）
if (linterErrorsByFile.length > 0) {
    for (const fileData of linterErrorsByFile) {
        const filePath = fileData.relativeWorkspacePath || 'Unknown file';
        const errors = fileData.errors || [];
        
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
        }
    }
}
```

### 关键改进点

1. **双格式支持**: 优先处理`linterErrorsByFile`,回退到`files`格式
2. **嵌套位置提取**: 从`range.startPosition`提取行号和列号
3. **Severity简化**: 移除`DIAGNOSTIC_SEVERITY_`前缀并转小写
4. **特殊字符转义**: 消息中的`|`和`` ` ``需要转义
5. **错误计数**: 在summary中显示总错误数
6. **文件标题优化**: 显示文件名和错误数量

---

## 渲染示例

### 输入数据

```json
{
  "name": "read_lints",
  "rawArgs": {"paths": ["main.py"]},
  "result": {
    "linterErrorsByFile": [{
      "relativeWorkspacePath": "main.py",
      "errors": [
        {
          "message": "Import \"os\" is not accessed",
          "range": {
            "startPosition": {"line": 6, "column": 8},
            "endPosition": {"line": 6, "column": 10}
          },
          "severity": "DIAGNOSTIC_SEVERITY_HINT"
        },
        {
          "message": "Import \"sys\" is not accessed",
          "range": {
            "startPosition": {"line": 7, "column": 8},
            "endPosition": {"line": 7, "column": 11}
          },
          "severity": "DIAGNOSTIC_SEVERITY_HINT"
        },
        {
          "message": "Import \"Dict\" is not accessed",
          "range": {
            "startPosition": {"line": 8, "column": 20},
            "endPosition": {"line": 8, "column": 24}
          },
          "severity": "DIAGNOSTIC_SEVERITY_HINT"
        }
      ]
    }]
  }
}
```

### 输出 Markdown

```markdown
<details>
<summary>❌ Read Lints: 3 error(s) found</summary>

**Checked paths**:
- `main.py`

### `main.py` (3 errors)

| Line | Col | Severity | Message |
|-----:|----:|:---------|:--------|
| 6 | 8 | hint | Import "os" is not accessed |
| 7 | 8 | hint | Import "sys" is not accessed |
| 8 | 20 | hint | Import "Dict" is not accessed |

</details>
```

---

## 实现细节

### 位置信息提取

```typescript
// 真实格式（嵌套）
const line = error.range?.startPosition?.line || '-';
const column = error.range?.startPosition?.column || '-';

// 旧格式（直接字段）
const line = error.line || '-';
const column = error.column || '-';
```

### Severity 转换

```typescript
let severityDisplay = error.severity || 'error';
if (severityDisplay.startsWith('DIAGNOSTIC_SEVERITY_')) {
    severityDisplay = severityDisplay.replace('DIAGNOSTIC_SEVERITY_', '').toLowerCase();
}
// "DIAGNOSTIC_SEVERITY_HINT" → "hint"
// "DIAGNOSTIC_SEVERITY_ERROR" → "error"
```

### 特殊字符转义

```typescript
const message = (error.message || 'No message')
    .replace(/\|/g, '\\|')    // 表格分隔符
    .replace(/`/g, '\\`');    // 代码标记
```

---

## 测试验证

### 测试用例

#### 用例 1: 多个hint级别错误
- **输入**: 9个未使用的import提示
- **预期输出**: 显示3列表格,severity显示为"hint"
- **状态**: ✅ 通过

#### 用例 2: 混合severity
- **输入**: 包含error、warning、hint的混合错误
- **预期输出**: 正确显示各种severity级别
- **状态**: ✅ 通过

#### 用例 3: 无错误
- **输入**: 空对象`{}`
- **预期输出**: 显示成功消息
- **状态**: ✅ 通过

#### 用例 4: 旧格式兼容性
- **输入**: 使用`files`格式的数据
- **预期输出**: 正确渲染
- **状态**: ✅ 通过

---

## 向后兼容性

### 兼容策略

代码同时支持两种格式,按优先级处理:

1. **优先**: `linterErrorsByFile` 格式（真实格式）
2. **回退**: `files` 格式（旧格式/假设格式）
3. **最终回退**: 显示原始JSON

```typescript
if (linterErrorsByFile.length > 0) {
    // 处理真实格式
} else if (filesWithErrors.length > 0) {
    // 处理旧格式
} else {
    // 显示原始JSON
}
```

### 不影响的功能

- 无错误情况的渲染（`result === "{}"`)
- 路径列表显示
- Summary标题生成
- 其他工具的渲染逻辑

---

## 影响范围

### 受益功能

1. **read_lints 工具渲染**: 现在能正确处理真实的错误数据
2. **错误信息显示**: 更准确的行号、列号和严重性
3. **用户体验**: 清晰的错误分组和统计

### 相关文件更新

1. ✅ **src/ui/markdownRenderer.ts** (lines 1492-1620)
   - 更新`renderReadLintsToolnew`方法
   - 添加双格式支持
   - 添加severity转换逻辑

2. ✅ **specs/002-session-markdown-view/contracts/markdown-renderer.md** (T030部分)
   - 更新数据结构说明
   - 添加真实格式示例
   - 添加severity枚举说明
   - 更新渲染示例

3. ✅ **specs/002-session-markdown-view/T063_read_lints_error_format.md**
   - 创建本文档

---

## 后续建议

### 可选改进

1. **Severity图标**: 为不同severity添加图标
   - error: ❌
   - warning: ⚠️
   - information: ℹ️
   - hint: 💡

2. **错误过滤**: 允许用户按severity过滤显示

3. **代码片段**: 显示错误位置的代码片段（如果可用）

4. **快速修复**: 如果linter提供了quick fix,显示修复建议

---

## 总结

本次改进基于用户提供的真实数据格式,更新了`read_lints`工具的渲染逻辑:

✅ **准确性**: 正确处理真实的`linterErrorsByFile`格式  
✅ **兼容性**: 保持对旧格式的支持  
✅ **可读性**: 简化severity显示,转义特殊字符  
✅ **完整性**: 正确提取嵌套的位置信息  
✅ **文档**: 完整更新契约文档和示例

---

**相关任务**:
- T030: Read Lints 工具渲染详细规范
- T060: read_lints 工具匹配顺序修复
- T061: read_lints 工具渲染调试
- T062: Grep 工具多输出模式支持

**参考资料**:
- `specs/002-session-markdown-view/contracts/markdown-renderer.md`
- `src/ui/markdownRenderer.ts`
- VS Code Diagnostic API: https://code.visualstudio.com/api/references/vscode-api#Diagnostic
