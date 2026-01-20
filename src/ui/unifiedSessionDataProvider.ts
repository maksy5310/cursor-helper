import * as vscode from 'vscode';
import { DatabaseAccess } from '../dataAccess/databaseAccess';
import { AuthService } from '../services/authService';
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
 * 根据认证状态自动切换显示内容:
 * - 已登录: 显示会话列表
 * - 未登录: 显示空白
 */
export class UnifiedSessionDataProvider implements vscode.TreeDataProvider<SessionListItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SessionListItem | undefined | null> = 
        new vscode.EventEmitter<SessionListItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<SessionListItem | undefined | null> = 
        this._onDidChangeTreeData.event;

    private sessions: SessionListItem[] = [];
    private databaseAccess: DatabaseAccess;
    private authService: AuthService;

    constructor(databaseAccess: DatabaseAccess, authService: AuthService) {
        this.databaseAccess = databaseAccess;
        this.authService = authService;
    }

    getTreeItem(element: SessionListItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(
            element.name || `Session ${element.composerId.substring(0, 8)}`,
            vscode.TreeItemCollapsibleState.None
        );

        // 添加工具提示
        const lastUpdated = new Date(element.lastUpdatedAt);
        treeItem.tooltip = `Session: ${element.name}\nType: ${element.unifiedMode}\nLast Updated: ${lastUpdated.toLocaleString()}`;

        return treeItem;
    }

    async getChildren(element?: SessionListItem): Promise<SessionListItem[]> {
        // 如果有子元素,返回空(扁平结构)
        if (element) {
            return [];
        }

        // 检查认证状态
        const isAuthenticated = await this.authService.isAuthenticated();
        
        if (!isAuthenticated) {
            Logger.info('User not authenticated, returning empty list');
            return [];
        }

        // 已认证,返回会话列表
        return this.sessions;
    }

    /**
     * 刷新数据
     * @param workspaceInfo 可选的工作空间信息，如果未提供则自动检测
     */
    async refresh(workspaceInfo?: WorkspaceInfo): Promise<void> {
        try {
            const isAuthenticated = await this.authService.isAuthenticated();
            
            if (isAuthenticated) {
                Logger.info('Loading sessions from database...');
                await this.loadSessions(workspaceInfo);
            } else {
                Logger.info('User not authenticated, clearing sessions');
                this.sessions = [];
            }
            
            // 触发视图更新
            this._onDidChangeTreeData.fire(undefined);
            Logger.info('Session data provider refreshed');
        } catch (error) {
            Logger.error('Failed to refresh session data', error as Error);
            this.sessions = [];
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    /**
     * 从数据库加载会话列表
     * @param workspaceInfo 可选的工作空间信息，如果未提供则自动检测
     */
    private async loadSessions(workspaceInfo?: WorkspaceInfo): Promise<void> {
        try {
            // 如果未提供workspaceInfo，自动检测当前工作空间
            let finalWorkspaceInfo: WorkspaceInfo | undefined = workspaceInfo;
            if (!finalWorkspaceInfo) {
                finalWorkspaceInfo = await WorkspaceHelper.getWorkspaceInfo() ?? undefined;
            }

            // 使用工作空间感知的数据库访问
            const dbSessions = await this.databaseAccess.getSessionList(finalWorkspaceInfo);
            
            this.sessions = dbSessions.map((session) => {
                return {
                    composerId: session.composerId,
                    name: session.name || `Session ${session.composerId.substring(0, 8)}`,
                    lastUpdatedAt: session.lastUpdatedAt,
                    unifiedMode: session.unifiedMode
                };
            });

            Logger.info(`Loaded ${this.sessions.length} sessions from ${finalWorkspaceInfo?.type || 'unknown'} workspace`);
        } catch (error) {
            Logger.error('Failed to load sessions from database', error as Error);
            this.sessions = [];
            throw error;
        }
    }
}
