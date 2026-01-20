import * as vscode from 'vscode';
import { AuthService } from '../services/authService';
import { Logger } from '../utils/logger';

/**
 * 登录命令处理器
 */
export async function loginCommand(authService: AuthService): Promise<void> {
    try {
        Logger.info('Login command triggered');
        await authService.openLoginPage();
    } catch (error) {
        Logger.error('Login command failed', error as Error);
        vscode.window.showErrorMessage('打开登录页面失败');
    }
}

