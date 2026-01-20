/**
 * 配置上传命令
 * 允许用户配置 Base URL 和 API URL
 */

import * as vscode from 'vscode';
import { Config } from '../utils/config';
import { UploadService } from '../services/uploadService';
import { Logger } from '../utils/logger';

/**
 * 配置上传命令处理函数
 */
export async function configureUploadCommand(context: vscode.ExtensionContext): Promise<void> {
    try {
        // 配置 Base URL
        const currentBaseUrl = Config.getBaseUrl(context);
        const baseUrl = await vscode.window.showInputBox({
            prompt: '请输入 Base URL（所有路径基于此 URL）',
            value: currentBaseUrl,
            placeHolder: Config.getDefaultBaseUrl(),
            ignoreFocusOut: true
        });

        if (baseUrl !== undefined) {
            if (baseUrl && baseUrl.trim().length > 0) {
                // 验证 URL 格式
                try {
                    new URL(baseUrl);
                    await Config.setBaseUrl(context, baseUrl.trim());
                    
                    // 显示生成的各种 URL
                    const apiUrl = Config.getAPIUrl(context);
                    const loginUrl = Config.getLoginUrl(context);
                    const userCenterUrl = Config.getUserCenterUrl(context);
                    
                    vscode.window.showInformationMessage(
                        `Base URL 已保存\n` +
                        `API URL: ${apiUrl}\n` +
                        `登录页面: ${loginUrl}\n` +
                        `个人中心: ${userCenterUrl}`
                    );
                    Logger.info(`Base URL configured: ${baseUrl}`);
                    Logger.info(`API URL: ${apiUrl}`);
                } catch (error) {
                    vscode.window.showErrorMessage('无效的 URL 格式');
                    Logger.error('Invalid URL format', error as Error);
                }
            } else {
                // 使用默认值
                await Config.setBaseUrl(context, Config.getDefaultBaseUrl());
                vscode.window.showInformationMessage('Base URL 已重置为默认值');
            }
        }
    } catch (error) {
        Logger.error('Failed to configure upload', error as Error);
        vscode.window.showErrorMessage(`配置失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

