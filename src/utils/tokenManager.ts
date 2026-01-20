import * as vscode from 'vscode';
import { Logger } from './logger';
import { JWTParser } from './jwtParser';
import { JWTPayload } from '../models/auth';

/**
 * Token管理器 (Simple JWT版本)
 * 负责JWT token的安全存储和检索
 * 注意:不支持refresh token,过期后需重新登录
 */
export class TokenManager {
    private readonly JWT_TOKEN_KEY = 'cursor-helper.jwt';
    private readonly LEGACY_TOKEN_KEY = 'cursor-helper.auth.token'; // 向后兼容

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * 保存JWT令牌
     * @param token JWT令牌字符串
     */
    async saveToken(token: string): Promise<void> {
        try {
            // 验证token格式
            if (!JWTParser.isValidFormat(token)) {
                throw new Error('Invalid JWT format');
            }

            // 保存到SecretStorage
            await this.context.secrets.store(this.JWT_TOKEN_KEY, token);
            Logger.info('JWT token saved successfully');
        } catch (error) {
            Logger.error('Failed to save JWT token', error as Error);
            throw error;
        }
    }

    /**
     * 获取JWT令牌
     * @returns JWT令牌字符串,如果未登录则返回null
     */
    async getToken(): Promise<string | null> {
        try {
            // 尝试获取新的JWT token
            const token = await this.context.secrets.get(this.JWT_TOKEN_KEY);
            if (token) {
                return token;
            }

            // 回退到旧的token key(向后兼容)
            const legacyToken = await this.context.secrets.get(this.LEGACY_TOKEN_KEY);
            if (legacyToken) {
                Logger.info('Found legacy token, migrating to new key');
                await this.saveToken(legacyToken);
                await this.context.secrets.delete(this.LEGACY_TOKEN_KEY);
                return legacyToken;
            }

            return null;
        } catch (error) {
            Logger.error('Failed to get JWT token', error as Error);
            return null;
        }
    }

    /**
     * 获取有效的JWT令牌
     * 如果令牌已过期,返回null并触发重新登录提示
     * @returns 有效的JWT令牌,如果未登录或已过期则返回null
     */
    async getValidToken(): Promise<string | null> {
        try {
            const token = await this.getToken();
            if (!token) {
                return null;
            }

            // 检查是否过期
            if (JWTParser.isExpired(token)) {
                Logger.warn('JWT token has expired');
                // 清除过期token
                await this.clearToken();
                
                // 提示用户重新登录
                vscode.window.showWarningMessage('登录已过期,请重新登录', '登录').then(selection => {
                    if (selection === '登录') {
                        vscode.commands.executeCommand('cursor-assistant.login');
                    }
                });
                
                return null;
            }

            // 如果即将过期,给出警告(但仍然返回token)
            if (JWTParser.isAboutToExpire(token)) {
                const remainingMinutes = Math.floor(JWTParser.getRemainingTime(token) / (60 * 1000));
                Logger.warn(`JWT token expires in ${remainingMinutes} minutes`);
                vscode.window.showWarningMessage(
                    `您的登录将在${remainingMinutes}分钟后过期,请及时保存工作`, 
                    '知道了'
                );
            }

            return token;
        } catch (error) {
            Logger.error('Failed to get valid JWT token', error as Error);
            return null;
        }
    }

    /**
     * 清除JWT令牌
     */
    async clearToken(): Promise<void> {
        try {
            await this.context.secrets.delete(this.JWT_TOKEN_KEY);
            await this.context.secrets.delete(this.LEGACY_TOKEN_KEY);
            Logger.info('JWT token cleared');
        } catch (error) {
            Logger.error('Failed to clear JWT token', error as Error);
            throw error;
        }
    }

    /**
     * 解析JWT payload
     * @param token JWT令牌字符串(可选,默认使用当前存储的token)
     * @returns 解析后的payload对象,如果解析失败则返回null
     */
    async parseJWT(token?: string): Promise<JWTPayload | null> {
        const tokenToUse = token || await this.getToken();
        if (!tokenToUse) {
            return null;
        }
        return JWTParser.parsePayload(tokenToUse);
    }

    /**
     * 获取用户邮箱(从JWT)
     * @returns 用户邮箱,如果未登录或解析失败则返回null
     */
    async getUserEmail(): Promise<string | null> {
        const token = await this.getToken();
        if (!token) {
            return null;
        }
        return JWTParser.getUserEmail(token);
    }

    /**
     * 获取用户角色(从JWT)
     * @returns 用户角色,如果未登录或解析失败则返回null
     */
    async getUserRole(): Promise<string | null> {
        const token = await this.getToken();
        if (!token) {
            return null;
        }
        return JWTParser.getUserRole(token);
    }

    /**
     * 获取token过期时间戳(毫秒)
     * @returns 过期时间戳,如果未登录或解析失败则返回0
     */
    async getTokenExpiry(): Promise<number> {
        const token = await this.getToken();
        if (!token) {
            return 0;
        }
        return JWTParser.getExpiryTimestamp(token);
    }

    /**
     * 检查token是否过期
     * @returns 如果过期返回true,否则返回false
     */
    async isTokenExpired(): Promise<boolean> {
        const token = await this.getToken();
        if (!token) {
            return true;
        }
        return JWTParser.isExpired(token);
    }

    /**
     * 验证token格式
     * @param token JWT令牌字符串
     * @returns 如果格式有效返回true,否则返回false
     */
    isValidTokenFormat(token: string): boolean {
        return JWTParser.isValidFormat(token);
    }

    // ========== 向后兼容方法 ==========

    /**
     * 删除token(旧版API,向后兼容)
     */
    async deleteToken(): Promise<void> {
        await this.clearToken();
    }
}

