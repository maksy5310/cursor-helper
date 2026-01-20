# Quick Start Guide: 会话 Markdown 视图

**Date**: 2025-12-11  
**Feature**: 会话 Markdown 视图

## Overview

本指南帮助开发者快速实现会话 Markdown 视图功能。该功能允许用户点击会话列表中的会话条目，在编辑器中打开该会话的 Markdown 格式对话内容。

## Prerequisites

- 已完成 001-cursor-assistant 功能的实现
- 会话列表 panel 已存在并正常工作
- 数据库访问层（`DatabaseAccess`）已实现并可用

## Implementation Steps

### Step 1: 创建 Markdown 渲染器

创建 `src/ui/markdownRenderer.ts`:

```typescript
import { AgentRecord } from '../models/agentRecord';
import { Logger } from '../utils/logger';

export interface MarkdownRendererOptions {
    includeTimestamps?: boolean;
    includeCodeBlocks?: boolean;
    toolUsePlaceholder?: string;
    userMessageHeader?: string;
    assistantMessageHeader?: string;
}

export class MarkdownRenderer {
    private defaultOptions: Required<MarkdownRendererOptions> = {
        includeTimestamps: true,
        includeCodeBlocks: true,
        toolUsePlaceholder: "[Tool Use: {name}]",
        userMessageHeader: "## User",
        assistantMessageHeader: "## Assistant"
    };

    async renderSession(agentRecord: AgentRecord, options?: MarkdownRendererOptions): Promise<string> {
        const opts = { ...this.defaultOptions, ...options };
        const fragments: string[] = [];

        // 添加会话标题
        fragments.push(`# ${agentRecord.sessionName || 'Session'}\n`);

        // 渲染消息
        for (const message of agentRecord.messages) {
            fragments.push(this.renderMessage(message, opts));
        }

        return fragments.join('\n\n');
    }

    private renderMessage(message: any, options: Required<MarkdownRendererOptions>): string {
        const fragments: string[] = [];
        const isUser = message.role === 'user';
        const header = isUser ? options.userMessageHeader : options.assistantMessageHeader;

        fragments.push(header);

        // 渲染消息内容
        if (message.text) {
            fragments.push(message.text);
        } else if (!isUser && (message.capabilities || message.toolCallResults)) {
            // 工具使用提示
            const toolName = this.extractToolName(message);
            if (toolName) {
                fragments.push(options.toolUsePlaceholder.replace('{name}', toolName));
            }
        }

        // 添加时间戳
        if (options.includeTimestamps && message.timestamp) {
            const date = new Date(message.timestamp);
            fragments.push(`*[${date.toLocaleString()}]*`);
        }

        return fragments.join('\n\n');
    }

    private extractToolName(message: any): string | null {
        if (message.capabilities && message.capabilities.length > 0) {
            return message.capabilities[0].name || 'Unknown Tool';
        }
        if (message.toolCallResults && message.toolCallResults.length > 0) {
            return message.toolCallResults[0].toolName || 'Unknown Tool';
        }
        return null;
    }

    escapeMarkdown(text: string): string {
        // 转义 Markdown 特殊字符
        return text
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)')
            .replace(/#/g, '\\#')
            .replace(/\+/g, '\\+')
            .replace(/-/g, '\\-')
            .replace(/\./g, '\\.')
            .replace(/!/g, '\\!');
    }
}
```

### Step 2: 创建打开会话 Markdown 视图命令

创建 `src/commands/openSessionMarkdown.ts`:

```typescript
import * as vscode from 'vscode';
import { DatabaseAccess } from '../dataAccess/databaseAccess';
import { MarkdownRenderer } from '../ui/markdownRenderer';
import { Logger } from '../utils/logger';

export async function openSessionMarkdownCommand(
    databaseAccess: DatabaseAccess,
    composerId: string
): Promise<void> {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading Session Markdown',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Loading session data...' });

            // 1. 加载会话数据
            const records = await databaseAccess.getAgentRecords(composerId);
            if (!records || records.length === 0) {
                vscode.window.showErrorMessage(`Session not found: ${composerId}`);
                return;
            }

            const record = records[0];
            progress.report({ increment: 40, message: 'Loading bubble details...' });

            // 2. 渲染 Markdown
            const renderer = new MarkdownRenderer();
            const markdown = await renderer.renderSession(record);

            progress.report({ increment: 80, message: 'Rendering Markdown...' });

            // 3. 创建临时文档
            const uri = vscode.Uri.parse(`untitled:${record.sessionName || composerId}.md`);
            const document = await vscode.workspace.openTextDocument({
                language: 'markdown',
                content: markdown
            });

            // 4. 显示文档
            await vscode.window.showTextDocument(document, {
                preview: false
            });

            progress.report({ increment: 100, message: 'Complete' });
        });
    } catch (error) {
        Logger.error('Failed to open session markdown', error as Error);
        vscode.window.showErrorMessage(`Failed to open session markdown: ${(error as Error).message}`);
    }
}
```

### Step 3: 修改会话列表 Panel 添加点击事件

修改 `src/ui/sessionListPanel.ts`:

```typescript
// 在 initialize() 方法中添加：
this.treeView?.onDidChangeSelection(async (e) => {
    if (e.selection && e.selection.length > 0) {
        const selectedItem = e.selection[0];
        // 触发打开 Markdown 视图命令
        await vscode.commands.executeCommand(
            'cursor-assistant.openSessionMarkdown',
            selectedItem.composerId
        );
    }
});
```

### Step 4: 注册命令

在 `src/extension.ts` 中注册命令:

```typescript
import { openSessionMarkdownCommand } from './commands/openSessionMarkdown';

// 在 activate() 函数中：
const openMarkdownCommand = vscode.commands.registerCommand(
    'cursor-assistant.openSessionMarkdown',
    async (composerId: string) => {
        await openSessionMarkdownCommand(databaseAccess, composerId);
    }
);
context.subscriptions.push(openMarkdownCommand);
```

在 `package.json` 中添加命令定义:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "cursor-assistant.openSessionMarkdown",
        "title": "Open Session Markdown",
        "category": "Cursor Assistant"
      }
    ]
  }
}
```

## Testing

### 单元测试

测试 Markdown 渲染器:

```typescript
import { MarkdownRenderer } from '../ui/markdownRenderer';
import { AgentRecord } from '../models/agentRecord';

describe('MarkdownRenderer', () => {
    it('should render user message', async () => {
        const renderer = new MarkdownRenderer();
        const record: AgentRecord = {
            sessionId: 'test',
            sessionName: 'Test Session',
            messages: [{
                role: 'user',
                text: 'Hello',
                timestamp: Date.now()
            }]
        };
        const markdown = await renderer.renderSession(record);
        expect(markdown).toContain('## User');
        expect(markdown).toContain('Hello');
    });
});
```

### 集成测试

1. 启动扩展调试
2. 在会话列表中点击一个会话
3. 验证编辑器是否打开并显示 Markdown 内容
4. 验证消息顺序是否正确
5. 验证工具使用提示是否正确显示

## Debugging

### 常见问题

1. **编辑器未打开**
   - 检查命令是否注册
   - 检查 `composerId` 是否正确传递
   - 查看调试控制台的错误日志

2. **Markdown 内容为空**
   - 检查 `getAgentRecords()` 是否返回数据
   - 检查渲染器是否正确处理消息
   - 查看日志输出

3. **性能问题**
   - 检查是否有大量消息（1000+）
   - 优化渲染逻辑，使用数组 join
   - 考虑添加进度显示

## Next Steps

- 实现完整的错误处理
- 添加单元测试和集成测试
- 优化性能（如果需要）
- 考虑添加导出功能（未来）

## References

- [VS Code Extension API - Text Documents](https://code.visualstudio.com/api/references/vscode-api#TextDocument)
- [VS Code Extension API - TreeView](https://code.visualstudio.com/api/extension-guides/tree-view)
- [Markdown 规范](https://daringfireball.net/projects/markdown/)

