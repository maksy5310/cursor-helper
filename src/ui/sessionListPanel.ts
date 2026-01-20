import * as vscode from 'vscode';
import { UnifiedSessionDataProvider } from './unifiedSessionDataProvider';
import { DatabaseAccess } from '../dataAccess/databaseAccess';
import { Logger } from '../utils/logger';
import { AuthService } from '../services/authService';

/**
 * 会话列表 panel 接口
 */
export interface ISessionListPanel {
    /**
     * 初始化 panel
     */
    initialize(): Promise<void>;

    /**
     * 刷新会话列表
     */
    refresh(): Promise<void>;

    /**
     * 销毁 panel
     */
    dispose(): void;
}

/**
 * 会话列表 panel 实现
 * 在 Cursor 侧边栏显示会话列表(已登录)或空白(未登录)
 */
export class SessionListPanel implements ISessionListPanel {
    private treeView: vscode.TreeView<any> | null = null;
    private dataProvider: UnifiedSessionDataProvider;
    private databaseAccess: DatabaseAccess;
    private authService: AuthService;

    constructor(databaseAccess: DatabaseAccess, authService: AuthService) {
        this.databaseAccess = databaseAccess;
        this.authService = authService;
        // 创建统一的数据提供者
        this.dataProvider = new UnifiedSessionDataProvider(databaseAccess, authService);
    }

    /**
     * 初始化 panel
     */
    async initialize(): Promise<void> {
        try {
            Logger.info('Initializing session list panel...');

            // 创建 TreeView (只创建一次)
            this.treeView = vscode.window.createTreeView('cursor-assistant.sessionList', {
                treeDataProvider: this.dataProvider,
                showCollapseAll: false
            });
            this.treeView.title = 'Cursor Sessions';

            // 添加点击事件监听器
            this.treeView.onDidChangeSelection(async (e) => {
                if (e.selection && e.selection.length > 0) {
                    const selectedItem = e.selection[0];
                    if (selectedItem && 'composerId' in selectedItem) {
                        await vscode.commands.executeCommand(
                            'cursor-assistant.uploadRecord',
                            (selectedItem as any).composerId
                        );
                    }
                }
            });

            // 初始加载数据
            await this.dataProvider.refresh();

            Logger.info('Session list panel initialized successfully');
        } catch (error) {
            Logger.error('Failed to initialize session list panel', error as Error);
            throw error;
        }
    }

    /**
     * 刷新会话列表（手动刷新时调用）
     */
    async refresh(): Promise<void> {
        try {
            Logger.info('=== SessionListPanel.refresh START ===');
            
            // 刷新数据提供者(它会根据认证状态自动决定显示什么)
            await this.dataProvider.refresh();

            Logger.info('Session list panel refreshed');
            Logger.info('=== SessionListPanel.refresh END ===');
        } catch (error) {
            Logger.error('Failed to refresh session list panel', error as Error);
        }
    }

    /**
     * 销毁 panel
     */
    dispose(): void {
        if (this.treeView) {
            this.treeView.dispose();
            this.treeView = null;
        }
        Logger.info('Session list panel disposed');
    }
}
