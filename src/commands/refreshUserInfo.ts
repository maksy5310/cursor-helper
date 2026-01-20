import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { UserProfileService } from '../services/userProfileService';

/**
 * 刷新用户信息命令
 */
export async function refreshUserInfoCommand(userProfileService: UserProfileService): Promise<void> {
    try {
        Logger.info('Refreshing user info...');
        
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: '正在刷新用户信息...',
                cancellable: false
            },
            async () => {
                await userProfileService.refreshProfile();
            }
        );

        vscode.window.showInformationMessage('用户信息已刷新');
        Logger.info('User info refreshed successfully');
    } catch (error) {
        Logger.error('Failed to refresh user info', error as Error);
        vscode.window.showErrorMessage(`刷新用户信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}
