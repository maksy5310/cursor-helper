import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { TokenManager } from '../utils/tokenManager';
import { JWTParser } from '../utils/jwtParser';
import { Logger } from '../utils/logger';
import { UserProfile } from '../models/userProfile';
import { Config } from '../utils/config';

/**
 * 认证服务 (Simple JWT版本)
 * 负责用户认证流程:登录、登出、token管理
 * 注意:使用简单的JWT认证,不支持OAuth 2.0或refresh token
 */
export class AuthService {
    private tokenManager: TokenManager;
    private panelRefreshCallback: (() => Promise<void>) | null = null;
    private userProfileService: any | null = null; // 使用any避免循环依赖

    constructor(private context: vscode.ExtensionContext) {
        this.tokenManager = new TokenManager(context);
    }

    /**
     * 设置UserProfileService(避免循环依赖)
     */
    setUserProfileService(service: any): void {
        this.userProfileService = service;
    }

    /**
     * 获取回调URI(用于浏览器登录后回调)
     */
    private getCallbackUri(): string {
        return `${vscode.env.uriScheme}://${this.context.extension.id}/auth/callback`;
    }

    /**
     * 将callback参数注入到登录URL中
     */
    private withCallback(loginUrl: string): string {
        try {
            const url = new URL(loginUrl);
            url.searchParams.set('callback', this.getCallbackUri());
            return url.toString();
        } catch {
            const sep = loginUrl.includes('?') ? '&' : '?';
            return `${loginUrl}${sep}callback=${encodeURIComponent(this.getCallbackUri())}`;
        }
    }

    /**
     * 设置面板刷新回调
     * @param callback 刷新面板的回调函数
     */
    setPanelRefreshCallback(callback: () => Promise<void>): void {
        this.panelRefreshCallback = callback;
    }

    /**
     * 打开前端登录页面
     * @param loginUrl 登录页面URL(可选,默认从配置读取)
     */
    async openLoginPage(loginUrl?: string): Promise<void> {
        try {
            const baseUrl = loginUrl || this.getLoginUrl();
            const url = this.withCallback(baseUrl);
            Logger.info(`Opening login page: ${url}`);
            Logger.info(`Auth callback URI: ${this.getCallbackUri()}`);
            
            // 使用系统命令打开默认浏览器,避免VSCode内部浏览器拦截
            await this.openInSystemBrowser(url);
            
            Logger.info('Login page opened in system browser');
        } catch (error) {
            Logger.error('Failed to open login page', error as Error);
            vscode.window.showErrorMessage('无法打开登录页面,请检查网络连接和配置');
            throw error;
        }
    }

    /**
     * 在系统默认浏览器中打开URL
     * 使用系统命令而不是vscode.env.openExternal,避免被VSCode内部浏览器拦截
     */
    private async openInSystemBrowser(url: string): Promise<void> {
        const platform = process.platform;
        let command: string;

        switch (platform) {
            case 'win32':
                // Windows: 使用 start 命令
                command = `start "" "${url}"`;
                break;
            case 'darwin':
                // macOS: 使用 open 命令
                command = `open "${url}"`;
                break;
            case 'linux':
                // Linux: 使用 xdg-open 命令
                command = `xdg-open "${url}"`;
                break;
            default:
                // 其他平台回退到 vscode.env.openExternal
                Logger.warn(`Unknown platform: ${platform}, falling back to vscode.env.openExternal`);
                await vscode.env.openExternal(vscode.Uri.parse(url));
                return;
        }

        return new Promise((resolve, reject) => {
            child_process.exec(command, async (error) => {
                if (error) {
                    Logger.error(`Failed to open browser with command: ${command}`, error);
                    // 回退到 vscode.env.openExternal
                    Logger.info('Falling back to vscode.env.openExternal');
                    try {
                        await vscode.env.openExternal(vscode.Uri.parse(url));
                        resolve();
                    } catch (fallbackError) {
                        reject(fallbackError);
                    }
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 处理登录回调(JWT token)
     * @param token JWT token字符串
     */
    async handleLoginCallback(token: string): Promise<void> {
        try {
            Logger.info('=== handleLoginCallback START ===');
            Logger.info(`Token length: ${token.length}`);
            
            // 验证token格式
            if (!this.tokenManager.isValidTokenFormat(token)) {
                Logger.warn('Invalid token format received');
                vscode.window.showErrorMessage('无效的token格式');
                return;
            }
            Logger.info('Token format is valid');

            // 解析token获取用户信息
            const payload = JWTParser.parsePayload(token);
            if (!payload) {
                Logger.warn('Failed to parse JWT payload');
                vscode.window.showErrorMessage('无法解析token');
                return;
            }
            Logger.info(`User email from JWT: ${payload.email}`);
            
            // 检查token过期时间
            const expiryTimestamp = JWTParser.getExpiryTimestamp(token);
            const expiryDate = new Date(expiryTimestamp);
            const now = new Date();
            const remainingMs = JWTParser.getRemainingTime(token);
            const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
            const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
            
            Logger.info(`Token expiry: ${expiryDate.toLocaleString()}`);
            Logger.info(`Current time: ${now.toLocaleString()}`);
            Logger.info(`Token valid for: ${remainingHours}h ${remainingMinutes}m`);
            
            if (JWTParser.isExpired(token)) {
                Logger.warn('Received token is already expired!');
                vscode.window.showErrorMessage('收到的token已过期，请联系管理员检查服务器时间设置');
                return;
            }

            // 保存token
            await this.tokenManager.saveToken(token);
            Logger.info('Token saved successfully');

            // 从JWT payload创建基本用户资料（只包含基本信息）
            const userProfile: UserProfile = {
                email: payload.email,
                nickname: payload.username || payload.email.split('@')[0], // 优先使用username
                lastSyncedAt: Date.now()
            };
            
            Logger.info(`Basic user profile from token: ${userProfile.nickname} (${userProfile.email})`);

            // 保存基本用户资料到缓存
            if (this.userProfileService && this.userProfileService.saveProfile) {
                await this.userProfileService.saveProfile(userProfile);
                Logger.info('Basic user profile cached');
                
                // 异步获取完整的用户信息（包括头像等）
                Logger.info('Fetching complete profile from Profile API...');
                this.userProfileService.fetchProfile().then(() => {
                    Logger.info('Complete profile fetched and cached');
                    // 再次刷新面板以显示完整信息
                    this.refreshPanel();
                }).catch((error: any) => {
                    Logger.warn('Failed to fetch complete profile:', error);
                });
            } else {
                // 直接保存到WorkspaceState
                await this.context.workspaceState.update('userProfile', userProfile);
                Logger.info('User profile saved to WorkspaceState');
            }

            // 刷新面板
            Logger.info('Calling refreshPanel...');
            await this.refreshPanel();
            Logger.info('refreshPanel completed');

            vscode.window.showInformationMessage(`登录成功（token有效期：${remainingHours}小时${remainingMinutes}分钟）`);
            Logger.info('=== handleLoginCallback END ===');
        } catch (error) {
            Logger.error('Failed to handle login callback', error as Error);
            vscode.window.showErrorMessage('登录失败,请重试');
            throw error;
        }
    }

    /**
     * 获取当前token
     * @returns JWT token字符串,如果未登录则返回null
     */
    async getToken(): Promise<string | null> {
        return await this.tokenManager.getToken();
    }

    /**
     * 获取有效的token
     * @returns 有效的JWT token,如果未登录或已过期则返回null
     */
    async getValidToken(): Promise<string | null> {
        return await this.tokenManager.getValidToken();
    }

    /**
     * 检查是否已登录
     * @returns 如果已登录返回true,否则返回false
     */
    async isAuthenticated(): Promise<boolean> {
        const token = await this.getToken();
        if (!token) {
            return false;
        }
        // 检查是否过期
        return !await this.tokenManager.isTokenExpired();
    }

    /**
     * 登出
     */
    async logout(): Promise<void> {
        try {
            await this.tokenManager.clearToken();
            Logger.info('User logged out');

            // 清除用户资料
            if (this.userProfileService && this.userProfileService.clearProfile) {
                await this.userProfileService.clearProfile();
                Logger.info('User profile cleared');
            } else {
                await this.context.workspaceState.update('userProfile', undefined);
                Logger.info('User profile cleared from WorkspaceState');
            }

            // 刷新面板
            await this.refreshPanel();

            vscode.window.showInformationMessage('已登出');
        } catch (error) {
            Logger.error('Failed to logout', error as Error);
            vscode.window.showErrorMessage('登出失败');
            throw error;
        }
    }

    /**
     * 刷新面板
     */
    private async refreshPanel(): Promise<void> {
        if (this.panelRefreshCallback) {
            try {
                await this.panelRefreshCallback();
            } catch (error) {
                Logger.error('Failed to refresh panel', error as Error);
            }
        }
    }

    /**
     * 获取登录页面URL
     * @returns 登录页面URL (基于 baseUrl 生成)
     */
    private getLoginUrl(): string {
        return Config.getLoginUrl(this.context);
    }

    /**
     * 获取TokenManager实例
     */
    getTokenManager(): TokenManager {
        return this.tokenManager;
    }
}
