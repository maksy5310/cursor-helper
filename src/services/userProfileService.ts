import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { UserProfile } from '../models/userProfile';
import { TokenManager } from '../utils/tokenManager';
import { ApiClient } from '../utils/apiClient';
import { Config } from '../utils/config';

/**
 * 用户资料服务
 * 负责用户信息的获取、缓存和同步
 * 改进：从 Profile API 获取完整用户信息，而不是从 JWT 解析
 */
export class UserProfileService {
    private cachedProfile: UserProfile | null = null;
    private tokenManager: TokenManager | null = null;
    private apiClient: ApiClient;
    
    // 事件发射器:用户资料更新
    private _onProfileUpdated = new vscode.EventEmitter<UserProfile | null>();
    readonly onProfileUpdated: vscode.Event<UserProfile | null> = this._onProfileUpdated.event;

    constructor(private context: vscode.ExtensionContext) {
        this.apiClient = new ApiClient();
    }

    /**
     * 设置TokenManager
     */
    setTokenManager(tokenManager: TokenManager): void {
        this.tokenManager = tokenManager;
        this.apiClient.setTokenManager(tokenManager);
    }

    /**
     * 获取用户资料(优先使用缓存)
     */
    async getProfile(): Promise<UserProfile | null> {
        try {
            // 1. 检查内存缓存
            if (this.cachedProfile) {
                return this.cachedProfile;
            }

            // 2. 从WorkspaceState恢复
            const stored = this.context.workspaceState.get<UserProfile>('userProfile');
            if (stored) {
                this.cachedProfile = stored;
                return stored;
            }

            // 3. 从 Profile API 获取
            return await this.fetchProfile();
        } catch (error) {
            Logger.error('Failed to get user profile', error as Error);
            return null;
        }
    }

    /**
     * 从 Profile API 获取用户资料
     */
    async fetchProfile(): Promise<UserProfile | null> {
        try {
            if (!this.tokenManager) {
                Logger.warn('TokenManager not set, cannot fetch profile');
                return null;
            }

            const token = await this.tokenManager.getValidToken();
            if (!token) {
                Logger.info('No valid token, user not logged in');
                return null;
            }

            Logger.info('Fetching user profile from Profile API...');
            
            // 调用 GET /api/v1/users/me/profile
            const apiUrl = Config.getAPIUrl(this.context);
            const profileUrl = `${apiUrl}/users/me/profile`;
            
            try {
                const response = await this.apiClient.get<any>(profileUrl);
                
                if (!response.ok || !response.data) {
                    Logger.error('Failed to fetch profile: invalid response');
                    return null;
                }

                const data = response.data;
                
                // 创建用户资料对象
                const profile: UserProfile = {
                    email: data.email,
                    nickname: data.username || data.email.split('@')[0],
                    avatarUrl: data.avatar_url || undefined, // 头像URL（可能是 Base64 或 HTTP URL）
                    department: data.department,
                    employeeId: data.employee_id,
                    role: data.role,
                    lastSyncedAt: Date.now()
                };

                // 保存到缓存和WorkspaceState
                this.cachedProfile = profile;
                await this.context.workspaceState.update('userProfile', profile);
                
                // 触发事件
                this._onProfileUpdated.fire(profile);

                Logger.info(`User profile fetched successfully: ${profile.email}`);
                Logger.info(`  - Username: ${profile.nickname}`);
                Logger.info(`  - Department: ${profile.department || 'N/A'}`);
                Logger.info(`  - Employee ID: ${profile.employeeId || 'N/A'}`);
                Logger.info(`  - Avatar: ${profile.avatarUrl ? (profile.avatarUrl.startsWith('data:') ? 'Base64' : 'URL') : 'none'}`);
                
                return profile;
            } catch (error: any) {
                if (error?.status === 401) {
                    Logger.warn('Profile API returned 401, token expired');
                    // Token 已过期，清除缓存
                    await this.clearProfile();
                    return null;
                }
                throw error;
            }
        } catch (error) {
            Logger.error('Failed to fetch user profile from API', error as Error);
            return null;
        }
    }

    /**
     * 保存用户资料到缓存
     * @param profile 用户资料对象
     */
    async saveProfile(profile: UserProfile): Promise<void> {
        try {
            this.cachedProfile = profile;
            await this.context.workspaceState.update('userProfile', profile);
            
            // 触发事件
            this._onProfileUpdated.fire(profile);
            
            Logger.info(`User profile saved: ${profile.email}`);
        } catch (error) {
            Logger.error('Failed to save user profile', error as Error);
            throw error;
        }
    }

    /**
     * 清除用户资料
     */
    async clearProfile(): Promise<void> {
        try {
            this.cachedProfile = null;
            await this.context.workspaceState.update('userProfile', undefined);
            
            // 触发事件
            this._onProfileUpdated.fire(null);
            
            Logger.info('User profile cleared');
        } catch (error) {
            Logger.error('Failed to clear user profile', error as Error);
            throw error;
        }
    }

    /**
     * 刷新用户资料(重新从 API 获取)
     */
    async refreshProfile(): Promise<void> {
        try {
            // 清除缓存并重新获取
            this.cachedProfile = null;
            await this.fetchProfile();
        } catch (error) {
            Logger.error('Failed to refresh user profile', error as Error);
            throw error;
        }
    }

    /**
     * 获取自动填充的邮箱地址
     * @returns 用户邮箱,如果未登录则返回null
     */
    async getAutoFillEmail(): Promise<string | null> {
        const profile = await this.getProfile();
        return profile?.email || null;
    }
}
