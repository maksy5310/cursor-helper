# Quick Start Guide: Cursor助手插件

**Date**: 2025-12-10  
**Feature**: Cursor助手插件

## Overview

本指南帮助开发者快速开始开发 Cursor助手插件。

## Prerequisites

- Node.js 18+ 
- npm 或 yarn
- Cursor 编辑器（或 VS Code）
- TypeScript 5.x

## Project Setup

### 1. 初始化项目

```bash
# 创建项目目录
mkdir cursor-assistant
cd cursor-assistant

# 初始化 npm 项目
npm init -y

# 安装依赖
npm install --save-dev typescript @types/node @types/vscode
npm install --save-dev @vscode/test-electron mocha @types/mocha
npm install --save vscode
```

### 2. 配置 TypeScript

创建 `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true
  },
  "exclude": ["node_modules", ".vscode-test"]
}
```

### 3. 创建项目结构

```
cursor-assistant/
├── src/
│   ├── extension.ts
│   ├── dataCollector.ts
│   ├── storageManager.ts
│   ├── dataAccess/
│   │   ├── databaseAccess.ts
│   │   └── sqliteAccess.ts
│   └── models/
│       ├── usageStats.ts
│       └── agentRecord.ts
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
└── tsconfig.json
```

### 4. 配置 package.json

在 `package.json` 中添加 VS Code Extension 配置:

```json
{
  "name": "cursor-assistant",
  "displayName": "Cursor助手",
  "description": "Cursor 使用数据采集插件",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "cursor-assistant.toggle",
        "title": "Toggle Data Collection"
      }
    ],
    "configuration": {
      "title": "Cursor Assistant",
      "properties": {
        "cursor-assistant.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable data collection"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "test": "npm run compile && node ./out/test/runTest.js"
  }
}
```

## Core Implementation

### 1. Extension Entry Point

创建 `src/extension.ts`:

```typescript
import * as vscode from 'vscode';
import { DataCollector } from './dataCollector';
import { StorageManager } from './storageManager';

let dataCollector: DataCollector;
let storageManager: StorageManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Cursor Assistant extension is now active!');

    // 初始化存储管理器
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
    }

    storageManager = new StorageManager();
    storageManager.initialize(workspacePath);

    // 初始化数据采集器
    dataCollector = new DataCollector(storageManager);
    dataCollector.start();

    // 注册命令
    const toggleCommand = vscode.commands.registerCommand(
        'cursor-assistant.toggle',
        () => {
            const enabled = dataCollector.isEnabled();
            dataCollector.setEnabled(!enabled);
            vscode.window.showInformationMessage(
                `Data collection ${!enabled ? 'enabled' : 'disabled'}`
            );
        }
    );

    context.subscriptions.push(toggleCommand);
}

export function deactivate() {
    if (dataCollector) {
        dataCollector.stop();
    }
}
```

### 2. Data Collector

创建 `src/dataCollector.ts`:

```typescript
import * as vscode from 'vscode';
import { StorageManager } from './storageManager';
import { UsageStatistics, EventType, CompletionMode } from './models/usageStats';

export class DataCollector {
    private enabled: boolean = true;
    private buffer: UsageStatistics[] = [];
    private storageManager: StorageManager;
    private writeInterval: NodeJS.Timeout | null = null;
    private readonly BATCH_SIZE = 100;
    private readonly WRITE_INTERVAL = 10000; // 10 seconds

    constructor(storageManager: StorageManager) {
        this.storageManager = storageManager;
    }

    async start(): Promise<void> {
        if (!this.enabled) {
            return;
        }

        // 监听文档变更事件
        vscode.workspace.onDidChangeTextDocument((event) => {
            this.handleDocumentChange(event);
        });

        // 监听文档保存事件
        vscode.workspace.onDidSaveTextDocument((document) => {
            this.handleDocumentSave(document);
        });

        // 启动批量写入定时器
        this.startBatchWriter();
    }

    stop(): void {
        if (this.writeInterval) {
            clearInterval(this.writeInterval);
            this.writeInterval = null;
        }
        // 写入剩余数据
        this.flushBuffer();
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (enabled) {
            this.start();
        } else {
            this.stop();
        }
    }

    private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        // 实现文档变更处理逻辑
        // 检测代码建议和采纳
    }

    private handleDocumentSave(document: vscode.TextDocument): void {
        // 实现文档保存处理逻辑
    }

    private startBatchWriter(): void {
        this.writeInterval = setInterval(() => {
            this.flushBuffer();
        }, this.WRITE_INTERVAL);
    }

    private async flushBuffer(): Promise<void> {
        if (this.buffer.length === 0) {
            return;
        }

        const dataToWrite = [...this.buffer];
        this.buffer = [];

        try {
            await this.storageManager.saveUsageStatistics(dataToWrite);
        } catch (error) {
            console.error('Failed to write data:', error);
            // 将数据重新加入缓冲区，稍后重试
            this.buffer.unshift(...dataToWrite);
        }
    }

    private addToBuffer(data: UsageStatistics): void {
        this.buffer.push(data);

        // 如果缓冲区达到批量大小，立即写入
        if (this.buffer.length >= this.BATCH_SIZE) {
            this.flushBuffer();
        }
    }
}
```

### 3. Storage Manager

创建 `src/storageManager.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { UsageStatistics } from './models/usageStats';
import { AgentRecord } from './models/agentRecord';

export class StorageManager {
    private storageRoot: string = '';

    async initialize(workspacePath: string): Promise<void> {
        this.storageRoot = path.join(workspacePath, 'cursor-helper');
        await this.ensureDirectory(this.storageRoot);
    }

    async saveUsageStatistics(data: UsageStatistics[]): Promise<void> {
        if (data.length === 0) {
            return;
        }

        const dateDir = this.getDateDirectory();
        await this.ensureDirectory(dateDir);

        const filename = this.generateStatsFilename();
        const filepath = path.join(dateDir, filename);

        await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    }

    async saveAgentRecord(record: AgentRecord): Promise<void> {
        const dateDir = this.getDateDirectory();
        await this.ensureDirectory(dateDir);

        const filename = this.generateAgentFilename();
        const filepath = path.join(dateDir, filename);

        await fs.writeFile(filepath, JSON.stringify(record, null, 2), 'utf-8');
    }

    getStoragePath(): string {
        return this.storageRoot;
    }

    private getDateDirectory(): string {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0]; // yyyy-mm-dd
        return path.join(this.storageRoot, dateStr);
    }

    private generateStatsFilename(): string {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
        return `stats-${dateStr}-${timeStr}.json`;
    }

    private generateAgentFilename(): string {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
        return `agent-${dateStr}-${timeStr}.json`;
    }

    private async ensureDirectory(dirPath: string): Promise<void> {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }
}
```

## Testing

### 单元测试示例

创建 `tests/unit/dataCollector.test.ts`:

```typescript
import * as assert from 'assert';
import { DataCollector } from '../../src/dataCollector';
import { StorageManager } from '../../src/storageManager';

suite('DataCollector Tests', () => {
    let collector: DataCollector;
    let storage: StorageManager;

    setup(() => {
        storage = new StorageManager();
        collector = new DataCollector(storage);
    });

    test('should start and stop correctly', async () => {
        await collector.start();
        assert.strictEqual(collector.isEnabled(), true);
        collector.stop();
    });

    test('should toggle enabled state', () => {
        collector.setEnabled(false);
        assert.strictEqual(collector.isEnabled(), false);
        collector.setEnabled(true);
        assert.strictEqual(collector.isEnabled(), true);
    });
});
```

## Debugging

### 配置 launch.json

创建 `.vscode/launch.json`:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run Extension",
            "type": "extensionHost",
            "request": "launch",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}"
            ],
            "outFiles": [
                "${workspaceFolder}/out/**/*.js"
            ],
            "preLaunchTask": "npm: compile"
        }
    ]
}
```

## Next Steps

1. 实现数据访问层（数据库/API/文件）
2. 实现事件监听逻辑
3. 实现数据模型验证
4. 添加错误处理和日志
5. 编写集成测试
6. 性能优化

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)

