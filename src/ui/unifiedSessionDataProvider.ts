import * as vscode from 'vscode';
import { DatabaseAccess } from '../dataAccess/databaseAccess';
import { Logger } from '../utils/logger';
import { WorkspaceHelper, WorkspaceInfo } from '../utils/workspaceHelper';

/**
 * 会话列表项
 */
export interface SessionListItem {
    composerId: string;
    name: string;
    lastUpdatedAt: number;
    unifiedMode: 'chat' | 'agent';
}

/**
 * 统一的会话数据提供者
 * 无需认证，直接显示会话列表
 */
export class UnifiedSessionDataProvider implements vscode.TreeDataProvider<SessionListItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SessionListItem | undefined | null> = 
        new vscode.EventEmitter<SessionListItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<SessionListItem | undefined | null> = 
        this._onDidChangeTreeData.event;

    private sessions: SessionListItem[] = [];
    private databaseAccess: DatabaseAccess;

    constructor(databaseAccess: DatabaseAccess) {
        this.databaseAccess = databaseAccess;
    }

    getTreeItem(element: SessionListItem): vscode.TreeItem {
        // 添加序号前缀
        const idx = this.sessions.indexOf(element);
        const num = idx >= 0 ? idx + 1 : 0;
        const displayName = element.name || `Session ${element.composerId.substring(0, 8)}`;
        const treeItem = new vscode.TreeItem(
            `${num}. ${displayName}`,
            vscode.TreeItemCollapsibleState.None
        );

        const lastUpdated = new Date(element.lastUpdatedAt);
        treeItem.tooltip = `Session: ${displayName}\nType: ${element.unifiedMode}\nLast Updated: ${lastUpdated.toLocaleString()}`;
        treeItem.description = lastUpdated.toLocaleDateString();
        treeItem.contextValue = 'session';

        // 根据会话类型设置不同图标
        treeItem.iconPath = element.unifiedMode === 'agent'
            ? new vscode.ThemeIcon('robot')
            : new vscode.ThemeIcon('comment-discussion');

        return treeItem;
    }

    async getChildren(element?: SessionListItem): Promise<SessionListItem[]> {
        if (element) {
            return [];
        }
        // 直接返回会话列表，无需认证检查
        return this.sessions;
    }

    async refresh(workspaceInfo?: WorkspaceInfo): Promise<void> {
        try {
            Logger.info('Loading sessions from database...');
            await this.loadSessions(workspaceInfo);
            this._onDidChangeTreeData.fire(undefined);
            Logger.info('Session data provider refreshed');
        } catch (error) {
            Logger.error('Failed to refresh session data', error as Error);
            this.sessions = [];
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    private async loadSessions(workspaceInfo?: WorkspaceInfo): Promise<void> {
        try {
            let finalWorkspaceInfo: WorkspaceInfo | undefined = workspaceInfo;
            if (!finalWorkspaceInfo) {
                finalWorkspaceInfo = await WorkspaceHelper.getWorkspaceInfo() ?? undefined;
            }

            const dbSessions = await this.databaseAccess.getSessionList(finalWorkspaceInfo);
            
            this.sessions = dbSessions.map((session) => ({
                composerId: session.composerId,
                name: session.name || `Session ${session.composerId.substring(0, 8)}`,
                lastUpdatedAt: session.lastUpdatedAt,
                unifiedMode: session.unifiedMode
            }));

            Logger.info(`Loaded ${this.sessions.length} sessions`);
        } catch (error) {
            Logger.error('Failed to load sessions from database', error as Error);
            this.sessions = [];
            throw error;
        }
    }
}
