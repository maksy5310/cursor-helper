/**
 * 查看上传历史命令
 */

import * as vscode from 'vscode';
import { UploadHistoryEntry, UploadStatus } from '../models/uploadHistory';
import { Logger } from '../utils/logger';

/**
 * 查看上传历史命令处理函数
 */
export async function viewUploadHistoryCommand(context: vscode.ExtensionContext): Promise<void> {
    try {
        const history = context.globalState.get<UploadHistoryEntry[]>('upload.history', []);
        
        if (history.length === 0) {
            vscode.window.showInformationMessage('暂无上传历史记录');
            return;
        }

        // 格式化历史记录显示
        const items = history.map((entry, index) => {
            const statusIcon = entry.status === UploadStatus.SUCCESS ? '✓' : 
                             entry.status === UploadStatus.FAILED ? '✗' : '○';
            const statusText = entry.status === UploadStatus.SUCCESS ? '成功' :
                              entry.status === UploadStatus.FAILED ? '失败' : '进行中';
            
            const time = new Date(entry.upload_time).toLocaleString('zh-CN');
            const label = `${statusIcon} ${entry.project_name || '未知项目'}`;
            const description = `${statusText} - ${time}`;
            const detail = entry.record_id 
                ? `ID: ${entry.record_id.substring(0, 8)}...`
                : entry.error_message || '';

            return {
                label,
                description,
                detail,
                entry,
                index
            };
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择一条记录查看详情',
            canPickMany: false
        });

        if (selected) {
            const entry = selected.entry;
            let message = `项目: ${entry.project_name || '未知'}\n`;
            message += `时间: ${new Date(entry.upload_time).toLocaleString('zh-CN')}\n`;
            message += `状态: ${entry.status === UploadStatus.SUCCESS ? '成功' : entry.status === UploadStatus.FAILED ? '失败' : '进行中'}\n`;
            
            if (entry.record_id) {
                message += `记录ID: ${entry.record_id}\n`;
            }
            
            if (entry.error_message) {
                message += `错误: ${entry.error_message}\n`;
            }
            
            if (entry.file_path) {
                message += `文件: ${entry.file_path}\n`;
            }

            vscode.window.showInformationMessage(message, { modal: true });
        }
    } catch (error) {
        Logger.error('Failed to view upload history', error as Error);
        vscode.window.showErrorMessage(`查看上传历史失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

