import * as vscode from 'vscode';
import { UnifiedSessionDataProvider } from './unifiedSessionDataProvider';
import { DatabaseAccess } from '../dataAccess/databaseAccess';
import { Logger } from '../utils/logger';

/**
 * 会话列表 panel 接口
 */
export interface ISessionListPanel {
    initialize(): Promise<void>;
    refresh(): Promise<void>;
    dispose(): void;
}

/**
 * 会话列表 panel 实现
 * 无需认证，直接显示会话列表
 */
export class SessionListPanel implements ISessionListPanel {
    private treeView: vscode.TreeView<any> | null = null;
    private dataProvider: UnifiedSessionDataProvider;
    private databaseAccess: DatabaseAccess;

    constructor(databaseAccess: DatabaseAccess) {
        this.databaseAccess = databaseAccess;
        this.dataProvider = new UnifiedSessionDataProvider(databaseAccess);
    }

    async initialize(): Promise<void> {
        try {
            Logger.info('Initializing session list panel...');

            this.treeView = vscode.window.createTreeView('cursor-session-helper.sessionList', {
                treeDataProvider: this.dataProvider,
                showCollapseAll: false
            });
            this.treeView.title = 'Sessions';

            // 点击会话项时打开 Markdown 视图
            this.treeView.onDidChangeSelection(async (e) => {
                if (e.selection && e.selection.length > 0) {
                    const selectedItem = e.selection[0];
                    if (selectedItem && 'composerId' in selectedItem) {
                        await vscode.commands.executeCommand(
                            'cursor-session-helper.openSessionMarkdown',
                            (selectedItem as any).composerId
                        );
                    }
                }
            });

            await this.dataProvider.refresh();
            Logger.info('Session list panel initialized successfully');
        } catch (error) {
            Logger.error('Failed to initialize session list panel', error as Error);
            throw error;
        }
    }

    async refresh(): Promise<void> {
        try {
            await this.dataProvider.refresh();
            Logger.info('Session list panel refreshed');
        } catch (error) {
            Logger.error('Failed to refresh session list panel', error as Error);
        }
    }

    dispose(): void {
        if (this.treeView) {
            this.treeView.dispose();
            this.treeView = null;
        }
        Logger.info('Session list panel disposed');
    }
}
