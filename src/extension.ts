import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { DataAccess } from './dataAccess/dataAccess';
import { openSessionMarkdownCommand } from './commands/openSessionMarkdown';
import { diagnoseWorkspaceCommand } from './commands/diagnoseWorkspace';
import { scanWorkspacesCommand } from './commands/scanWorkspaces';
import { SessionListPanel } from './ui/sessionListPanel';
import { DatabaseAccess } from './dataAccess/databaseAccess';
import { LocalUserInfoTreeDataProvider } from './ui/localUserInfoTreeItem';
import { WorkspaceHelper, WorkspaceInfo } from './utils/workspaceHelper';
import { LocalShareService } from './services/localShareService';
import { WebServerManager } from './web-server/serverManager';
import { shareSessionCommand } from './commands/shareSession';

let sessionListPanel: SessionListPanel | null = null;
let databaseAccess: DatabaseAccess | null = null;
let webServerManager: WebServerManager | null = null;
let localShareService: LocalShareService | null = null;
let userInfoTreeDataProvider: LocalUserInfoTreeDataProvider | null = null;

/** 占位用会话列表提供程序：数据库不可用时显示提示，避免出现「没有可提供视图数据的已注册数据提供程序」 */
class PlaceholderSessionListProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem { return element; }
    getChildren(): vscode.TreeItem[] {
        const item = new vscode.TreeItem('无法加载会话列表', vscode.TreeItemCollapsibleState.None);
        item.description = '请查看输出日志';
        item.tooltip = '数据访问或数据库未初始化。请打开输出面板，选择「Cursor Session Helper」查看具体错误。';
        item.iconPath = new vscode.ThemeIcon('warning');
        return [item];
    }
}

/**
 * 扩展激活函数
 */
export async function activate(context: vscode.ExtensionContext) {
    try {
        return await doActivate(context);
    } catch (error) {
        Logger.error('Extension activation failed', error as Error);
        vscode.window.showErrorMessage(
            'Cursor Session Helper 激活失败，请打开输出面板选择「Cursor Session Helper」查看错误详情。'
        );
        throw error;
    }
}

async function doActivate(context: vscode.ExtensionContext): Promise<void> {
    // 初始化日志
    Logger.initialize('Cursor Session Helper');
    Logger.setLogLevel('info');
    Logger.show();
    Logger.info('Cursor Session Helper extension is activating...');

    // 获取工作空间信息
    let workspaceInfo: WorkspaceInfo | null = null;
    try {
        workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
        if (workspaceInfo) {
            Logger.debug(`Workspace type detected: ${workspaceInfo.type}, folders: ${workspaceInfo.folders.length}`);
        }
    } catch (error) {
        Logger.warn('Failed to detect workspace info', error as Error);
    }

    const workspacePath = workspaceInfo 
        ? (workspaceInfo.type === 'multi-root' && workspaceInfo.workspaceFile 
            ? workspaceInfo.workspaceFile 
            : workspaceInfo.folders[0]?.path)
        : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    
    if (!workspacePath) {
        Logger.warn('No workspace folder found');
    }

    // 初始化本地分享服务
    localShareService = new LocalShareService();
    Logger.info('LocalShareService initialized');

    // 初始化 Web 服务器管理器
    webServerManager = new WebServerManager(localShareService);
    Logger.info('WebServerManager initialized');

    // 初始化本地用户信息面板
    userInfoTreeDataProvider = new LocalUserInfoTreeDataProvider(webServerManager);
    const userInfoTreeView = vscode.window.createTreeView('cursor-session-helper.userInfo', {
        treeDataProvider: userInfoTreeDataProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(userInfoTreeView);
    Logger.info('LocalUserInfo TreeView registered');

    // 监听配置变化，刷新用户信息面板
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('cursorSessionHelper')) {
                userInfoTreeDataProvider?.refresh();
            }
        })
    );

    // 初始化数据访问层
    const dataAccess = new DataAccess();
    try {
        await dataAccess.initialize(workspaceInfo || workspacePath);
        databaseAccess = dataAccess.getDatabaseAccess();
    } catch (error) {
        Logger.warn('Data access initialization completed with warnings', error as Error);
    }

    // 初始化会话列表 panel（无需认证）；无数据库时仍注册占位提供程序，避免「没有可提供视图数据的已注册数据提供程序」
    if (databaseAccess) {
        try {
            sessionListPanel = new SessionListPanel(databaseAccess);
            await sessionListPanel.initialize();
            context.subscriptions.push(sessionListPanel);
            Logger.info('Session list panel initialized successfully');

            // 监听工作空间变化
            const workspaceChangeDisposable = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
                WorkspaceHelper.clearCache();
                if (sessionListPanel) {
                    await sessionListPanel.refresh();
                }
            });
            context.subscriptions.push(workspaceChangeDisposable);
        } catch (error) {
            Logger.error('Failed to initialize session list panel', error as Error);
            const fallbackSessionView = vscode.window.createTreeView('cursor-session-helper.sessionList', {
                treeDataProvider: new PlaceholderSessionListProvider(),
                showCollapseAll: false
            });
            context.subscriptions.push(fallbackSessionView);
        }
    } else {
        const fallbackSessionView = vscode.window.createTreeView('cursor-session-helper.sessionList', {
            treeDataProvider: new PlaceholderSessionListProvider(),
            showCollapseAll: false
        });
        context.subscriptions.push(fallbackSessionView);
        Logger.info('Session list view registered with placeholder (database not available)');
    }

    // 注册命令：分享会话
    const shareSessionCmd = vscode.commands.registerCommand(
        'cursor-session-helper.shareSession',
        async (item?: any) => {
            if (databaseAccess && localShareService) {
                const composerId = item?.composerId;
                await shareSessionCommand(context, databaseAccess, localShareService, webServerManager, composerId);
            } else {
                vscode.window.showErrorMessage('数据库或分享服务未初始化');
            }
        }
    );
    context.subscriptions.push(shareSessionCmd);

    // 注册命令：启动服务器
    const startServerCmd = vscode.commands.registerCommand(
        'cursor-session-helper.startServer',
        async () => {
            if (webServerManager) {
                await webServerManager.start();
                userInfoTreeDataProvider?.refresh();
                vscode.window.showInformationMessage(`本地服务器已启动: http://localhost:${webServerManager.getPort()}`);
            }
        }
    );
    context.subscriptions.push(startServerCmd);

    // 注册命令：停止服务器
    const stopServerCmd = vscode.commands.registerCommand(
        'cursor-session-helper.stopServer',
        async () => {
            if (webServerManager) {
                await webServerManager.stop();
                userInfoTreeDataProvider?.refresh();
                vscode.window.showInformationMessage('本地服务器已停止');
            }
        }
    );
    context.subscriptions.push(stopServerCmd);

    // 注册命令：重启服务器（自动杀掉占用端口的进程）
    const restartServerCmd = vscode.commands.registerCommand(
        'cursor-session-helper.restartServer',
        async () => {
            if (webServerManager) {
                try {
                    if (webServerManager.isRunning()) {
                        await webServerManager.stop();
                    }
                    await webServerManager.forceStart();
                    userInfoTreeDataProvider?.refresh();
                    vscode.window.showInformationMessage(`服务器已重启: http://localhost:${webServerManager.getPort()}`);
                } catch (err: any) {
                    vscode.window.showErrorMessage(`服务器重启失败: ${err.message || err}`);
                }
            }
        }
    );
    context.subscriptions.push(restartServerCmd);

    // 注册命令：打开 WebUI 页面
    const openWebUICmd = vscode.commands.registerCommand(
        'cursor-session-helper.openWebUI',
        async () => {
            if (webServerManager && webServerManager.isRunning()) {
                const url = `http://localhost:${webServerManager.getPort()}`;
                vscode.env.openExternal(vscode.Uri.parse(url));
            } else {
                const action = await vscode.window.showWarningMessage(
                    '服务器未运行，是否先启动服务器？',
                    '启动并打开', '取消'
                );
                if (action === '启动并打开' && webServerManager) {
                    await webServerManager.forceStart();
                    userInfoTreeDataProvider?.refresh();
                    const url = `http://localhost:${webServerManager.getPort()}`;
                    vscode.env.openExternal(vscode.Uri.parse(url));
                }
            }
        }
    );
    context.subscriptions.push(openWebUICmd);

    // 注册命令：打开存储文件夹
    const openShareFolderCmd = vscode.commands.registerCommand(
        'cursor-session-helper.openShareFolder',
        async () => {
            const config = vscode.workspace.getConfiguration('cursorSessionHelper');
            const shareDir = config.get<string>('shareDirectory', '');
            const defaultDir = require('path').join(require('os').homedir(), '.cursor-session-helper', 'shares');
            const actualDir = shareDir || defaultDir;
            
            // 确保目录存在
            const fs = require('fs');
            if (!fs.existsSync(actualDir)) {
                fs.mkdirSync(actualDir, { recursive: true });
            }
            
            // 用系统文件管理器打开文件夹
            vscode.env.openExternal(vscode.Uri.file(actualDir));
        }
    );
    context.subscriptions.push(openShareFolderCmd);

    // 注册命令：诊断工作空间
    const diagnoseWorkspaceCmd = vscode.commands.registerCommand(
        'cursor-session-helper.diagnoseWorkspace',
        async () => { await diagnoseWorkspaceCommand(); }
    );
    context.subscriptions.push(diagnoseWorkspaceCmd);

    // 注册命令：扫描工作空间
    const scanWorkspacesCmd = vscode.commands.registerCommand(
        'cursor-session-helper.scanWorkspaces',
        async () => { await scanWorkspacesCommand(context); }
    );
    context.subscriptions.push(scanWorkspacesCmd);

    // 注册命令：打开会话 Markdown
    const openSessionMarkdownCmd = vscode.commands.registerCommand(
        'cursor-session-helper.openSessionMarkdown',
        async (composerId: string) => {
            if (databaseAccess) {
                await openSessionMarkdownCommand(databaseAccess, composerId);
            }
        }
    );
    context.subscriptions.push(openSessionMarkdownCmd);

    // 注册显示日志命令
    const showLogsCommand = vscode.commands.registerCommand(
        'cursor-session-helper.showLogs',
        () => { Logger.show(); }
    );
    context.subscriptions.push(showLogsCommand);

    // 自动启动服务器（如果配置了）
    const autoStart = vscode.workspace.getConfiguration('cursorSessionHelper').get<boolean>('autoStartServer', false);
    if (autoStart && webServerManager) {
        try {
            await webServerManager.start();
            Logger.info('Web server auto-started');
            userInfoTreeDataProvider?.refresh();
        } catch (error) {
            Logger.error('Failed to auto-start web server', error as Error);
        }
    }

    Logger.info('Cursor Session Helper extension activated successfully');
}

/**
 * 扩展停用函数
 */
export async function deactivate() {
    Logger.info('Cursor Session Helper extension is deactivating...');

    // 停止 Web 服务器
    if (webServerManager) {
        await webServerManager.stop();
        webServerManager = null;
    }

    if (sessionListPanel) {
        sessionListPanel.dispose();
        sessionListPanel = null;
    }

    if (databaseAccess) {
        await databaseAccess.close();
        databaseAccess = null;
    }
    
    Logger.dispose();
}
