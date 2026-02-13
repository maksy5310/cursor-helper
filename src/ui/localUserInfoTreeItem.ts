import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { WebServerManager } from '../web-server/serverManager';
import { WorkspaceHelper } from '../utils/workspaceHelper';

/**
 * 本地用户信息 TreeItem
 * 显示自定义昵称、头像和服务器状态
 */
class UserInfoItem extends vscode.TreeItem {
    constructor(
        label: string,
        description: string,
        collapsible: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        iconPath?: vscode.Uri | vscode.ThemeIcon,
        command?: vscode.Command,
        contextValue?: string
    ) {
        super(label, collapsible);
        this.description = description;
        if (iconPath) {
            this.iconPath = iconPath;
        }
        if (command) {
            this.command = command;
        }
        if (contextValue) {
            this.contextValue = contextValue;
        }
    }
}

/**
 * 本地用户信息 TreeDataProvider
 */
export class LocalUserInfoTreeDataProvider implements vscode.TreeDataProvider<UserInfoItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<UserInfoItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private serverManager: WebServerManager;

    constructor(serverManager: WebServerManager) {
        this.serverManager = serverManager;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: UserInfoItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: UserInfoItem): Thenable<UserInfoItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        const config = vscode.workspace.getConfiguration('cursorSessionHelper');
        const configNickname = config.get<string>('nickname', '');
        const nickname = configNickname && configNickname.trim().length > 0 
            ? configNickname 
            : WorkspaceHelper.getSystemUsername();
        const avatarSetting = config.get<string>('avatar', 'default');
        const shareDir = config.get<string>('shareDirectory', '');

        const items: UserInfoItem[] = [];

        // 用户昵称项
        const avatarUri = this.getAvatarUri(avatarSetting);
        items.push(new UserInfoItem(
            '用户:',
            nickname,
            vscode.TreeItemCollapsibleState.None,
            avatarUri || new vscode.ThemeIcon('account')
        ));

        // 服务器状态项（点击切换启动/停止）
        const isRunning = this.serverManager.isRunning();
        const port = this.serverManager.getPort();
        const statusText = isRunning ? `运行中 :${port}` : '已停止';
        
        items.push(new UserInfoItem(
            `服务器: ${statusText}`,
            '',
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon(isRunning ? 'circle-filled' : 'circle-outline'),
            {
                command: isRunning ? 'cursor-session-helper.stopServer' : 'cursor-session-helper.startServer',
                title: isRunning ? '停止服务器' : '启动服务器'
            }
        ));

        // 重启服务器按钮
        items.push(new UserInfoItem(
            '重启服务器',
            '',
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('debug-restart'),
            {
                command: 'cursor-session-helper.restartServer',
                title: '重启服务器'
            }
        ));

        // 打开 WebUI 按钮
        items.push(new UserInfoItem(
            '打开 WebUI:',
            isRunning ? `http://localhost:${port}/` : '未运行',
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('globe'),
            {
                command: 'cursor-session-helper.openWebUI',
                title: '打开 WebUI 页面'
            }
        ));

        // 存储目录项 — 始终显示实际路径，点击可打开文件夹
        const defaultDir = path.join(require('os').homedir(), '.cursor-session-helper', 'shares');
        const actualDir = shareDir || defaultDir;
        items.push(new UserInfoItem(
            '存储:',
            actualDir,
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('folder'),
            {
                command: 'cursor-session-helper.openShareFolder',
                title: '打开存储文件夹'
            }
        ));
        // tooltip 显示完整路径（鼠标悬停可见）
        const lastItem = items[items.length - 1];
        lastItem.tooltip = `点击打开文件夹: ${actualDir}`;

        return Promise.resolve(items);
    }

    /**
     * 获取头像 URI
     */
    private getAvatarUri(avatarSetting: string): vscode.Uri | undefined {
        // 预设头像
        const presets: Record<string, string> = {
            'default': 'default-avatar.svg',
            'robot': 'default-avatar.svg',
            'cat': 'default-avatar.svg',
            'dog': 'default-avatar.svg',
            'star': 'default-avatar.svg'
        };

        if (presets[avatarSetting]) {
            // 使用预设头像（从 resources 目录加载）
            try {
                const extensionPath = vscode.extensions.getExtension('TS-SW2.cursor-session-helper')?.extensionPath;
                if (extensionPath) {
                    const avatarPath = path.join(extensionPath, 'resources', presets[avatarSetting]);
                    if (fs.existsSync(avatarPath)) {
                        return vscode.Uri.file(avatarPath);
                    }
                }
            } catch (error) {
                Logger.warn('Failed to load preset avatar', error as Error);
            }
            return undefined;
        }

        // 自定义图片路径
        if (fs.existsSync(avatarSetting)) {
            return vscode.Uri.file(avatarSetting);
        }

        return undefined;
    }
}
