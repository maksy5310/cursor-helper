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
 * 图标风格定义
 * outline: 线条轮廓风格 — 简洁统一的线条图标
 * filled:  填充风格 — 色彩丰富的填充图标
 * semantic: 语义风格 — 按功能语义选择图标
 */
interface IconSet {
    user: string;
    serverRunning: string;
    serverStopped: string;
    restart: string;
    webui: string;
    storage: string;
}

const ICON_STYLES: Record<string, IconSet> = {
    outline: {
        user: 'person',
        serverRunning: 'zap',
        serverStopped: 'circle-slash',
        restart: 'sync',
        webui: 'globe',
        storage: 'database'
    },
    filled: {
        user: 'account',
        serverRunning: 'pass-filled',
        serverStopped: 'error',
        restart: 'refresh',
        webui: 'link-external',
        storage: 'save-all'
    },
    semantic: {
        user: 'account',
        serverRunning: 'vm-running',
        serverStopped: 'vm-outline',
        restart: 'debug-restart',
        webui: 'globe',
        storage: 'archive'
    }
};

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
        const iconStyle = config.get<string>('iconStyle', 'outline');
        const icons = ICON_STYLES[iconStyle] || ICON_STYLES['outline'];

        const items: UserInfoItem[] = [];

        // 用户昵称项
        const avatarUri = this.getAvatarUri(avatarSetting);
        items.push(new UserInfoItem(
            '用户:',
            nickname,
            vscode.TreeItemCollapsibleState.None,
            avatarUri || new vscode.ThemeIcon(icons.user)
        ));

        // 服务器状态项（点击切换启动/停止）
        const isRunning = this.serverManager.isRunning();
        const port = this.serverManager.getPort();
        const statusText = isRunning ? `运行中 :${port}` : '已停止';
        
        items.push(new UserInfoItem(
            `服务器: ${statusText}`,
            '',
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon(isRunning ? icons.serverRunning : icons.serverStopped),
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
            new vscode.ThemeIcon(icons.restart),
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
            new vscode.ThemeIcon(icons.webui),
            {
                command: 'cursor-session-helper.openWebUI',
                title: '打开 WebUI 页面'
            }
        ));

        // 存储目录项 — 用 ~ 替代用户目录前缀，完整路径在 tooltip 显示，点击可打开文件夹
        const defaultDir = path.join(require('os').homedir(), '.cursor-session-helper', 'shares');
        const actualDir = shareDir || defaultDir;
        // 用 ~ 替代用户主目录前缀，使路径更简短
        const homeDir = require('os').homedir();
        const normalizedActual = actualDir.replace(/\\/g, '/');
        const normalizedHome = homeDir.replace(/\\/g, '/');
        const shortDir = normalizedActual.startsWith(normalizedHome)
            ? '~' + normalizedActual.substring(normalizedHome.length)
            : actualDir;
        items.push(new UserInfoItem(
            '存储:',
            shortDir,
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon(icons.storage),
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
