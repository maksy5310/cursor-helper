import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { Config } from '../utils/config';
import { JWTParser } from '../utils/jwtParser';
import { TokenManager } from '../utils/tokenManager';

/**
 * 打开个人中心命令
 * 直接使用基于 baseUrl 生成的用户中心 URL，并携带 token 参数
 */
export async function openUserCenterCommand(context: vscode.ExtensionContext): Promise<void> {
    try {
        // 获取 JWT token - 使用 TokenManager 而不是 Config
        const tokenManager = new TokenManager(context);
        const token = await tokenManager.getToken();
        if (!token) {
            Logger.warn('No JWT token found, user may need to login');
            vscode.window.showWarningMessage('请先登录');
            return;
        }
        
        // 检查 token 是否已过期
        const expiryTimestamp = JWTParser.getExpiryTimestamp(token);
        const expiryDate = new Date(expiryTimestamp);
        const now = new Date();
        const isExpired = JWTParser.isExpired(token);
        
        if (isExpired) {
            Logger.warn('JWT token has expired');
            vscode.window.showWarningMessage('登录已过期，请重新登录');
            return;
        }
        
        // 检查 token 是否即将过期（5分钟内）
        if (JWTParser.isAboutToExpire(token)) {
            const remainingMs = JWTParser.getRemainingTime(token);
            const remainingMinutes = Math.floor(remainingMs / 60000);
            Logger.warn(`JWT token will expire in ${remainingMinutes} minutes`);
            vscode.window.showWarningMessage(`登录即将过期（剩余 ${remainingMinutes} 分钟），建议重新登录`);
        }
        
        // 使用统一的 baseUrl 生成用户中心 URL，并附加 token 参数
        // JWT token 使用 Base64URL 编码，在 URL 查询参数中是安全的，不需要额外编码
        const baseUrl = Config.getUserCenterUrl(context);
        const userCenterUrl = `${baseUrl}?token=${token}`;
        
        await vscode.env.openExternal(vscode.Uri.parse(userCenterUrl));
    } catch (error) {
        Logger.error('Failed to open user center', error as Error);
        vscode.window.showErrorMessage(`无法打开个人中心:  ${error instanceof Error ? error.message : String(error)}`);
    }
}
