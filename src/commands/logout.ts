import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { AuthService } from '../services/authService';

/**
 * 登出命令
 */
export async function logoutCommand(authService: AuthService): Promise<void> {
    try {
        Logger.info('Logout command triggered');
        
        // 确认对话框
        const confirm = await vscode.window.showWarningMessage(
            '确定要退出登录吗?',
            { modal: true },
            '退出登录',
            '取消'
        );

        if (confirm !== '退出登录') {
            Logger.info('Logout cancelled by user');
            return;
        }

        // 执行登出
        await authService.logout();
        
        Logger.info('Logout completed successfully');
    } catch (error) {
        Logger.error('Logout command failed', error as Error);
        vscode.window.showErrorMessage(`退出登录失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}
