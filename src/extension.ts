import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { DataAccess } from './dataAccess/dataAccess';
import { TestDataGenerator } from './testDataGenerator';
import { discoverCursorDataCommand } from './commands/discoverCursorData';
import { analyzeDatabaseCommand } from './commands/analyzeDatabase';
import { openSessionMarkdownCommand } from './commands/openSessionMarkdown';
import { diagnoseWorkspaceCommand } from './commands/diagnoseWorkspace';
import { diagnoseLoginCommand } from './commands/diagnoseLogin';
import { scanWorkspacesCommand } from './commands/scanWorkspaces';
import { SessionListPanel } from './ui/sessionListPanel';
import { DatabaseAccess } from './dataAccess/databaseAccess';
import { runToolExtractionTests, testHtmlComments } from './test/toolExtractionTest';
import { uploadRecordCommand } from './commands/uploadRecord';
import { configureUploadCommand } from './commands/configureUpload';
import { viewUploadHistoryCommand } from './commands/viewUploadHistory';
import { AuthService } from './services/authService';
import { loginCommand } from './commands/login';
import { AuthUriHandler } from './utils/uriHandler';
import { UserProfileService } from './services/userProfileService';
import { AvatarLoader } from './utils/avatarLoader';
import { UserInfoTreeDataProvider } from './ui/userInfoTreeItem';
import { logoutCommand } from './commands/logout';
import { openUserCenterCommand } from './commands/openUserCenter';
import { refreshUserInfoCommand } from './commands/refreshUserInfo';
import { WorkspaceHelper, WorkspaceInfo } from './utils/workspaceHelper';
import { TokenManager } from './utils/tokenManager';

let sessionListPanel: SessionListPanel | null = null;
let databaseAccess: DatabaseAccess | null = null;
let authService: AuthService | null = null;
let userProfileService: UserProfileService | null = null;
let avatarLoader: AvatarLoader | null = null;
let userInfoTreeDataProvider: UserInfoTreeDataProvider | null = null;

/**
 * 扩展激活函数
 */
export async function activate(context: vscode.ExtensionContext) {
    // 初始化日志
    Logger.initialize('Cursor Assistant');
    Logger.setLogLevel('info'); // 使用 info 级别，减少不必要的 debug 日志
    Logger.show(); // 自动显示日志输出面板
    Logger.info('Cursor Assistant extension is activating...');

    // 获取工作空间信息（支持单根和多根工作空间）
    let workspaceInfo: WorkspaceInfo | null = null;
    try {
        workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
        if (workspaceInfo) {
            Logger.debug(`Workspace type detected: ${workspaceInfo.type}, folders: ${workspaceInfo.folders.length}`);
        }
    } catch (error) {
        Logger.warn('Failed to detect workspace info, falling back to first folder', error as Error);
    }

    // 向后兼容：如果没有工作空间信息，使用第一个文件夹路径
    const workspacePath = workspaceInfo 
        ? (workspaceInfo.type === 'multi-root' && workspaceInfo.workspaceFile 
            ? workspaceInfo.workspaceFile 
            : workspaceInfo.folders[0]?.path)
        : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    
    if (!workspacePath) {
        Logger.warn('No workspace folder found, data access may be limited');
    }

    // 初始化认证服务
    authService = new AuthService(context);

    // 初始化UserProfileService
    userProfileService = new UserProfileService(context);
    userProfileService.setTokenManager(authService.getTokenManager());
    authService.setUserProfileService(userProfileService);

    // 初始化AvatarLoader
    avatarLoader = new AvatarLoader(context);

    // 初始化UserInfoTreeDataProvider
    userInfoTreeDataProvider = new UserInfoTreeDataProvider();
    const userInfoTreeView = vscode.window.createTreeView('cursor-assistant.userInfo', {
        treeDataProvider: userInfoTreeDataProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(userInfoTreeView);
    Logger.info('UserInfo TreeView registered');

    // 监听用户资料更新事件
    if (userProfileService && avatarLoader && userInfoTreeDataProvider) {
        const profileSvc = userProfileService;
        const avatarLdr = avatarLoader;
        const treeProv = userInfoTreeDataProvider;
        
        userProfileService.onProfileUpdated(async (profile) => {
            Logger.info('UserProfile updated, refreshing TreeView...');
            let avatarUri: vscode.Uri | undefined;
            if (profile && profile.email) {
                avatarUri = await avatarLdr.loadAvatar(profile.email, profile.avatarUrl || undefined);
            }
            treeProv.refresh(profile, avatarUri);
        });

        // 初始加载用户信息 (T054)
        (async () => {
            // 初始化时调用getValidToken确保令牌有效
            const token = await authService.getTokenManager().getValidToken();
            if (token) {
                Logger.info('Valid token found, fetching user profile from API...');
                // 强制从 API 刷新用户信息，避免使用旧缓存
                await profileSvc.refreshProfile();
            }
            
            const profile = await profileSvc.getProfile();
            Logger.info('User info refreshed successfully');
            let avatarUri: vscode.Uri | undefined;
            if (profile && profile.email) {
                Logger.info(`Loading avatar for ${profile.email}, avatarUrl: ${profile.avatarUrl ? (profile.avatarUrl.startsWith('data:') ? 'Base64' : profile.avatarUrl.substring(0, 50) + '...') : 'none'}`);
                avatarUri = await avatarLdr.loadAvatar(profile.email, profile.avatarUrl || undefined);
            }
            treeProv.refresh(profile, avatarUri);
        })();
    }

    // 注册JWT URI Handler (处理 cursor://extension-id/auth/callback?token=xxx)
    const extensionId = context.extension.id;
    const uriScheme = vscode.env.uriScheme;
    const authUriHandler = new AuthUriHandler(authService);
    context.subscriptions.push(vscode.window.registerUriHandler(authUriHandler));
    Logger.info(`JWT URI handler registered for ${uriScheme}://${extensionId}/auth/callback`);
    Logger.info('Extension is ready to receive authentication callbacks');

    // 初始化数据访问层
    const dataAccess = new DataAccess();
    try {
        // 传递工作空间信息以便匹配正确的工作空间数据库
        // 如果workspaceInfo存在，优先使用；否则使用workspacePath（向后兼容）
        await dataAccess.initialize(workspaceInfo || workspacePath);
        
        // 获取内部的 DatabaseAccess 实例用于会话列表 panel
        databaseAccess = dataAccess.getDatabaseAccess();
    } catch (error) {
        Logger.warn('Data access initialization completed with warnings', error as Error);
    }

    // 初始化会话列表 panel
    if (databaseAccess && authService) {
        try {
            // 创建会话列表 panel（不启动任何监视或轮询机制）
            sessionListPanel = new SessionListPanel(databaseAccess, authService);
            await sessionListPanel.initialize();

            // 设置面板刷新回调
            authService.setPanelRefreshCallback(async () => {
                if (sessionListPanel) {
                    await sessionListPanel.refresh();
                }
            });

            context.subscriptions.push(sessionListPanel);
            Logger.info('Session list panel initialized successfully');

            // 监听工作空间文件夹变化事件
            const workspaceChangeDisposable = vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
                Logger.info('Workspace folders changed, clearing cache and refreshing session list');
                
                // 清除工作空间缓存
                WorkspaceHelper.clearCache();
                
                // 重新检测工作空间并刷新会话列表
                const workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
                if (sessionListPanel) {
                    await sessionListPanel.refresh();
                }
                
                Logger.info(`Workspace changed: ${event.added.length} added, ${event.removed.length} removed`);
            });
            context.subscriptions.push(workspaceChangeDisposable);
            Logger.info('Workspace change listener registered');
        } catch (error) {
            Logger.error('Failed to initialize session list panel', error as Error);
            // 不阻止扩展激活，会话列表 panel 是可选的
        }
    }

    // 注册测试数据生成命令（已废弃，保留用于向后兼容）
    const generateTestDataCommand = vscode.commands.registerCommand(
        'cursor-assistant.generateTestData',
        async () => {
            vscode.window.showWarningMessage('Test data generation is no longer supported. Data is read directly from Cursor database.');
        }
    );
    context.subscriptions.push(generateTestDataCommand);

    // 注册立即写入命令（已废弃，保留用于向后兼容）
    const flushBufferCommand = vscode.commands.registerCommand(
        'cursor-assistant.flushBuffer',
        async () => {
            vscode.window.showWarningMessage('Buffer flushing is no longer needed. Data is read directly from Cursor database.');
        }
    );
    context.subscriptions.push(flushBufferCommand);


    // 注册发现 Cursor 数据文件命令
    const discoverDataCommand = vscode.commands.registerCommand(
        'cursor-assistant.discoverData',
        async () => {
            await discoverCursorDataCommand();
        }
    );
    context.subscriptions.push(discoverDataCommand);

    // 注册分析数据库命令
    const analyzeDbCommand = vscode.commands.registerCommand(
        'cursor-assistant.analyzeDatabase',
        async () => {
            await analyzeDatabaseCommand();
        }
    );
    context.subscriptions.push(analyzeDbCommand);

    // 注册诊断工作空间命令
    const diagnoseWorkspaceCmd = vscode.commands.registerCommand(
        'cursor-assistant.diagnoseWorkspace',
        async () => {
            await diagnoseWorkspaceCommand();
        }
    );
    context.subscriptions.push(diagnoseWorkspaceCmd);

    // 注册诊断登录命令
    const diagnoseLoginCmd = vscode.commands.registerCommand(
        'cursor-assistant.diagnoseLogin',
        async () => {
            await diagnoseLoginCommand(context);
        }
    );
    context.subscriptions.push(diagnoseLoginCmd);

    // 注册扫描工作空间命令
    const scanWorkspacesCmd = vscode.commands.registerCommand(
        'cursor-assistant.scanWorkspaces',
        async () => {
            await scanWorkspacesCommand(context);
        }
    );
    context.subscriptions.push(scanWorkspacesCmd);

    // 注册显示日志命令
    const showLogsCommand = vscode.commands.registerCommand(
        'cursor-assistant.showLogs',
        () => {
            Logger.show();
            vscode.window.showInformationMessage('Logs are now visible in the Output panel. Select "Cursor Assistant" from the dropdown.');
        }
    );
    context.subscriptions.push(showLogsCommand);

    // 注册打开会话 Markdown 视图命令
    const openSessionMarkdownCmd = vscode.commands.registerCommand(
        'cursor-assistant.openSessionMarkdown',
        async (composerId: string) => {
            if (databaseAccess) {
                await openSessionMarkdownCommand(databaseAccess, composerId);
            } else {
                vscode.window.showErrorMessage('Database access is not available. Please ensure Cursor is properly configured.');
            }
        }
    );
    context.subscriptions.push(openSessionMarkdownCmd);

    // 注册工具数据提取测试命令（T054）
    const testToolExtractionCmd = vscode.commands.registerCommand(
        'cursor-assistant.testToolExtraction',
        async () => {
            try {
                Logger.setLogLevel('debug'); // 临时启用 debug 级别以查看详细日志
                Logger.info('开始运行工具数据提取测试...');
                
                // 运行测试
                await runToolExtractionTests();
                
                // 测试 HTML 注释功能
                testHtmlComments();
                
                Logger.setLogLevel('info'); // 恢复 info 级别
                vscode.window.showInformationMessage('工具数据提取测试完成！请查看输出面板查看详细结果。');
            } catch (error) {
                Logger.error('测试执行失败', error as Error);
                vscode.window.showErrorMessage(`测试执行失败: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    );
    context.subscriptions.push(testToolExtractionCmd);

    // 注册上传记录命令
    const uploadRecordCmd = vscode.commands.registerCommand(
        'cursor-assistant.uploadRecord',
        async (composerId?: string) => {
            await uploadRecordCommand(context, null, databaseAccess, composerId, userProfileService);
        }
    );
    context.subscriptions.push(uploadRecordCmd);

    // 注册配置上传命令
    const configureUploadCmd = vscode.commands.registerCommand(
        'cursor-assistant.configureUpload',
        async () => {
            await configureUploadCommand(context);
        }
    );
    context.subscriptions.push(configureUploadCmd);

    // 注册查看上传历史命令
    const viewUploadHistoryCmd = vscode.commands.registerCommand(
        'cursor-assistant.viewUploadHistory',
        async () => {
            await viewUploadHistoryCommand(context);
        }
    );
    context.subscriptions.push(viewUploadHistoryCmd);

    // 注册登录命令
    const loginCmd = vscode.commands.registerCommand(
        'cursor-assistant.login',
        async () => {
            if (authService) {
                await loginCommand(authService);
            }
        }
    );
    context.subscriptions.push(loginCmd);

    // 注册登出命令
    const logoutCmd = vscode.commands.registerCommand(
        'cursor-assistant.logout',
        async () => {
            if (authService) {
                await logoutCommand(authService);
            }
        }
    );
    context.subscriptions.push(logoutCmd);

    // 注册打开个人中心命令
    const openUserCenterCmd = vscode.commands.registerCommand(
        'cursor-assistant.openUserCenter',
        async () => {
            await openUserCenterCommand(context);
        }
    );
    context.subscriptions.push(openUserCenterCmd);

    // 注册刷新用户信息命令
    const refreshUserInfoCmd = vscode.commands.registerCommand(
        'cursor-assistant.refreshUserInfo',
        async () => {
            if (userProfileService) {
                await refreshUserInfoCommand(userProfileService);
            }
        }
    );
    context.subscriptions.push(refreshUserInfoCmd);

    // 注册测试 URI handler 命令（用于调试）
    const testUriHandlerCmd = vscode.commands.registerCommand(
        'cursor-assistant.testUriHandler',
        async () => {
            // 模拟一个 URI 回调来测试 handler
            Logger.info('=== Testing URI Handler ===');
            Logger.info(`Extension ID: ${context.extension.id}`);
            Logger.info(`URI Scheme: ${vscode.env.uriScheme}`);
            
            const testUri = vscode.Uri.parse(`${vscode.env.uriScheme}://${context.extension.id}/auth/callback?token=test-token-12345`);
            Logger.info('Testing URI handler with test URI...');
            Logger.info('Note: This will attempt to process the callback, but the token will be rejected as invalid');
            // 直接调用authUriHandler处理
            await authUriHandler.handleUri(testUri);
            vscode.window.showInformationMessage('URI Handler test completed. Check Output panel.');
        }
    );
    context.subscriptions.push(testUriHandlerCmd);
    
    // 添加显示插件状态命令
    const showStatusCmd = vscode.commands.registerCommand(
        'cursor-assistant.showStatus',
        async () => {
            Logger.info('=== Extension Status ===');
            Logger.info(`Extension ID: ${context.extension.id}`);
            Logger.info(`URI Scheme: ${vscode.env.uriScheme}`);
            Logger.info(`Expected callback URI: ${vscode.env.uriScheme}://${context.extension.id}/auth/callback`);
            
            const tokenMgr = new TokenManager(context);
            const token = await tokenMgr.getToken();
            Logger.info(`Token exists: ${!!token}`);
            
            const profile = await context.workspaceState.get('userProfile');
            Logger.info(`Profile exists: ${!!profile}`);
            
            vscode.window.showInformationMessage(
                `Extension Status:\n` +
                `Extension ID: ${context.extension.id}\n` +
                `URI Scheme: ${vscode.env.uriScheme}\n` +
                `Token: ${token ? 'Yes' : 'No'}\n` +
                `Profile: ${profile ? 'Yes' : 'No'}\n\n` +
                `Expected URI: ${vscode.env.uriScheme}://${context.extension.id}/auth/callback\n\n` +
                `Check Output panel for details.`
            );
        }
    );
    context.subscriptions.push(showStatusCmd);

    Logger.info('Cursor Assistant extension activated successfully');
}

/**
 * 扩展停用函数
 */
export async function deactivate() {
    Logger.info('Cursor Assistant extension is deactivating...');

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
