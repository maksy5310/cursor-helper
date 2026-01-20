/**
 * 上传记录命令
 */

import * as vscode from 'vscode';
import { UploadFormPanel } from '../ui/uploadFormPanel';
import { DatabaseAccess } from '../dataAccess/databaseAccess';
import { Logger } from '../utils/logger';
import { UserProfileService } from '../services/userProfileService';

/**
 * 上传记录命令处理函数
 * @param context VS Code Extension Context
 * @param _storageManager 存储管理器（已废弃，保留用于向后兼容）
 * @param databaseAccess 数据库访问对象（用于从数据库加载会话内容）
 * @param composerId 会话ID（可选，如果提供则自动加载会话内容）
 * @param userProfileService 用户资料服务（可选，用于自动填充邮箱）
 */
export async function uploadRecordCommand(
    context: vscode.ExtensionContext,
    _storageManager: null,
    databaseAccess: DatabaseAccess | null,
    composerId?: string,
    userProfileService?: UserProfileService | null
): Promise<void> {
    if (!databaseAccess) {
        vscode.window.showWarningMessage('数据库访问未初始化。请确保 Cursor 已正确配置。');
        Logger.warn('Database access not initialized');
        return;
    }

    try {
        const panel = new UploadFormPanel(context, null, databaseAccess);
        
        // 注入UserProfileService
        if (userProfileService) {
            panel.setUserProfileService(userProfileService);
        }
        
        panel.createPanel();
        
        if (composerId) {
            // 如果提供了 composerId，自动加载会话内容并显示表单
            await panel.showForm(composerId);
        } else {
            // 否则显示空表单（向后兼容）
            panel.showForm('', {});
        }
    } catch (error) {
        Logger.error('Failed to create upload form panel', error as Error);
        vscode.window.showErrorMessage(`创建上传表单失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

