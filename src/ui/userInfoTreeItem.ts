import * as vscode from 'vscode';
import { UserProfile } from '../models/userProfile';
import { Logger } from '../utils/logger';

/**
 * 用户信息TreeItem
 * 在TreeView中显示用户个人信息或登录按钮
 */
export class UserInfoTreeItem extends vscode.TreeItem {
    constructor(
        public readonly profile: UserProfile | null,
        public readonly avatarUri?: vscode.Uri
    ) {
        super(
            profile?.nickname || '未登录',
            vscode.TreeItemCollapsibleState.None
        );

        if (profile) {
            // 已登录状态
            this.description = profile.email;
            this.tooltip = `用户: ${profile.nickname}\n邮箱: ${profile.email}`;
            this.iconPath = avatarUri;
            this.contextValue = 'userInfo-loggedIn';
            
            // 点击打开个人中心
            this.command = {
                command: 'cursor-assistant.openUserCenter',
                title: '打开个人中心'
            };
        } else {
            // 未登录状态
            this.description = '点击登录';
            this.tooltip = '点击登录到Cursor Assistant';
            // 使用内置图标
            this.iconPath = vscode.Uri.file(''); // 将在未来版本中支持
            this.contextValue = 'userInfo-loggedOut';
            
            // 点击触发登录
            this.command = {
                command: 'cursor-assistant.login',
                title: '登录'
            };
        }

        Logger.info(`UserInfoTreeItem created: ${profile ? 'logged in' : 'logged out'}`);
    }
}

/**
 * 用户信息TreeDataProvider
 * 为TreeView提供数据
 */
export class UserInfoTreeDataProvider implements vscode.TreeDataProvider<UserInfoTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<UserInfoTreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private currentProfile: UserProfile | null = null;
    private currentAvatarUri: vscode.Uri | undefined = undefined;

    constructor() {
        Logger.info('UserInfoTreeDataProvider initialized');
    }

    /**
     * 刷新TreeView数据
     */
    refresh(profile: UserProfile | null, avatarUri?: vscode.Uri): void {
        this.currentProfile = profile;
        this.currentAvatarUri = avatarUri;
        this._onDidChangeTreeData.fire();
        Logger.info('UserInfoTreeDataProvider refreshed');
    }

    /**
     * 获取TreeItem
     */
    getTreeItem(element: UserInfoTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * 获取子节点
     */
    getChildren(element?: UserInfoTreeItem): Thenable<UserInfoTreeItem[]> {
        if (element) {
            // 当前设计中没有子节点
            return Promise.resolve([]);
        }

        // 返回根节点(用户信息节点)
        const item = new UserInfoTreeItem(this.currentProfile, this.currentAvatarUri);
        return Promise.resolve([item]);
    }
}
