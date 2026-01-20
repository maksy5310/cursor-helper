import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * Auth URI Handler (Simple JWT版本)
 * 处理来自浏览器的登录回调,接收JWT token
 */
export class AuthUriHandler implements vscode.UriHandler {
    private authService: any; // 将在构造函数中注入

    constructor(authService: any) {
        this.authService = authService;
    }

    /**
     * 处理URI回调
     */
    async handleUri(uri: vscode.Uri): Promise<void> {
        Logger.info(`=== handleUri called ===`);
        Logger.info(`URI path: ${uri.path}`);
        Logger.info(`URI query: ${uri.query}`);

        // 检查路径是否为认证回调
        if (uri.path === '/auth/callback') {
            await this.handleAuthCallback(uri);
        } else {
            Logger.warn(`Unknown URI path: ${uri.path}`);
            vscode.window.showWarningMessage(`未知的URI路径: ${uri.path}`);
        }
    }

    /**
     * 处理JWT认证回调
     */
    private async handleAuthCallback(uri: vscode.Uri): Promise<void> {
        try {
            Logger.info('Processing auth callback...');
            
            // 解析查询参数
            const query = new URLSearchParams(uri.query);
            const token = query.get('token');

            // 验证参数
            if (!token) {
                Logger.error('Token parameter missing in callback');
                vscode.window.showErrorMessage('登录回调参数缺失:未找到token');
                return;
            }

            Logger.info(`Token received, length: ${token.length}`);

            // 调用AuthService处理回调
            await this.authService.handleLoginCallback(token);
            
            Logger.info('Auth callback processed successfully');
        } catch (error: any) {
            Logger.error('Auth callback error', error);
            vscode.window.showErrorMessage(`登录失败: ${error.message}`);
        }
    }
}
