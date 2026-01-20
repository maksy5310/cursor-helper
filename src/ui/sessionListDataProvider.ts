import * as vscode from 'vscode';
import { DatabaseAccess } from '../dataAccess/databaseAccess';
import { Logger } from '../utils/logger';

/**
 * 会话列表项
 */
export interface SessionListItem {
    composerId: string;           // 会话 ID
    name: string;                 // 会话名称
    lastUpdatedAt: number;        // 最后更新时间戳（毫秒）
    unifiedMode: 'chat' | 'agent'; // 会话类型
}

/**
 * 会话列表数据提供者接口
 */
export interface ISessionListDataProvider extends vscode.TreeDataProvider<SessionListItem> {
    /**
     * 刷新数据（手动刷新时调用）
     */
    refresh(): Promise<void>;
}

/**
 * 会话列表数据提供者实现
 * 实现 TreeDataProvider 接口，从数据库读取会话列表
 */
export class SessionListDataProvider implements ISessionListDataProvider {
    private _onDidChangeTreeData: vscode.EventEmitter<SessionListItem | undefined | null> = new vscode.EventEmitter<SessionListItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<SessionListItem | undefined | null> = this._onDidChangeTreeData.event;

    private databaseAccess: DatabaseAccess;
    private sessions: SessionListItem[] = [];
    private hasLoadedOnce: boolean = false; // 标记是否已加载过一次

    constructor(databaseAccess: DatabaseAccess) {
        this.databaseAccess = databaseAccess;
    }

    /**
     * 获取子节点（会话列表）
     * 只在第一次调用时加载，后续直接返回缓存的列表
     */
    async getChildren(element?: SessionListItem): Promise<SessionListItem[]> {
        // 如果没有元素，返回根级别的会话列表
        if (!element) {
            // 只在第一次加载时从数据库读取
            if (!this.hasLoadedOnce) {
                await this.loadSessions();
                this.hasLoadedOnce = true;
            }
            return this.sessions;
        }
        // 会话列表是扁平结构，没有子节点
        return [];
    }

    /**
     * 获取树项（用于显示）
     */
    getTreeItem(element: SessionListItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(
            element.name || `Session ${element.composerId.substring(0, 8)}`,
            vscode.TreeItemCollapsibleState.None
        );

        // 添加工具提示
        const lastUpdated = new Date(element.lastUpdatedAt);
        treeItem.tooltip = `Session: ${element.name}\nType: ${element.unifiedMode}\nLast Updated: ${lastUpdated.toLocaleString()}`;

        // 可以添加图标（可选）
        // treeItem.iconPath = new vscode.ThemeIcon(element.unifiedMode === 'agent' ? 'robot' : 'comment');

        return treeItem;
    }

    /**
     * 从数据库加载会话列表
     * 只在初始化时调用一次
     */
    private async loadSessions(): Promise<void> {
        try {
            if (!this.databaseAccess.isAvailable()) {
                Logger.warn('Database access not available, showing empty session list');
                this.sessions = [];
                return;
            }

            // 使用 DatabaseAccess 的公共方法获取会话列表
            if (typeof (this.databaseAccess as any).getSessionList === 'function') {
                this.sessions = await (this.databaseAccess as any).getSessionList();
                Logger.info(`Loaded ${this.sessions.length} sessions from database`);
            } else {
                Logger.error('getSessionList method not found on databaseAccess');
                this.sessions = [];
            }
        } catch (error) {
            Logger.error('Failed to load sessions from database', error as Error);
            this.sessions = [];
        }
    }

    /**
     * 刷新数据（手动刷新时调用）
     * 重新从数据库加载会话列表
     */
    async refresh(): Promise<void> {
        await this.loadSessions();
        this._onDidChangeTreeData.fire(undefined);
    }
}

