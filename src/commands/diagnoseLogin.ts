import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { Config } from '../utils/config';
import { Logger } from '../utils/logger';

/**
 * 诊断登录问题命令
 * 用于排查登录按钮无法打开浏览器的问题
 */
export async function diagnoseLoginCommand(context: vscode.ExtensionContext): Promise<void> {
    try {
        Logger.info('='.repeat(80));
        Logger.info('登录诊断开始');
        Logger.info('='.repeat(80));

        // 1. 检查基本配置
        Logger.info('\n1. 配置信息:');
        const baseUrl = Config.getBaseUrl(context);
        const loginUrl = Config.getLoginUrl(context);
        const extensionId = context.extension.id;
        const uriScheme = vscode.env.uriScheme;
        const callbackUri = `${uriScheme}://${extensionId}/auth/callback`;

        Logger.info(`   Base URL: ${baseUrl}`);
        Logger.info(`   登录页面 URL: ${loginUrl}`);
        Logger.info(`   Extension ID: ${extensionId}`);
        Logger.info(`   URI Scheme: ${uriScheme}`);
        Logger.info(`   回调 URI: ${callbackUri}`);

        // 2. 测试 URL 格式
        Logger.info('\n2. URL 格式验证:');
        try {
            const loginUrlWithCallback = new URL(loginUrl);
            loginUrlWithCallback.searchParams.set('callback', callbackUri);
            const finalUrl = loginUrlWithCallback.toString();
            Logger.info(`   ✓ 最终登录 URL: ${finalUrl}`);
            Logger.info(`   ✓ URL 格式有效`);
        } catch (error) {
            Logger.error(`   ✗ URL 格式无效: ${error}`);
        }

        // 3. 测试系统浏览器命令
        Logger.info('\n3. 系统浏览器测试:');
        const platform = process.platform;
        Logger.info(`   当前平台: ${platform}`);

        let testUrl = 'https://www.baidu.com'; // 使用简单的测试 URL
        let browserCommand: string;

        switch (platform) {
            case 'win32':
                browserCommand = `start "" "${testUrl}"`;
                Logger.info(`   Windows 命令: ${browserCommand}`);
                break;
            case 'darwin':
                browserCommand = `open "${testUrl}"`;
                Logger.info(`   macOS 命令: ${browserCommand}`);
                break;
            case 'linux':
                browserCommand = `xdg-open "${testUrl}"`;
                Logger.info(`   Linux 命令: ${browserCommand}`);
                break;
            default:
                browserCommand = '';
                Logger.warn(`   未知平台: ${platform}`);
        }

        // 4. 提供测试选项
        Logger.info('\n4. 测试选项:');
        
        const action = await vscode.window.showInformationMessage(
            '登录诊断已完成，请选择要测试的方式：',
            '测试打开百度',
            '测试打开登录页面',
            '查看日志',
            '取消'
        );

        if (action === '测试打开百度') {
            Logger.info('\n尝试打开测试页面（百度）...');
            try {
                await testBrowserOpen(testUrl, browserCommand, platform);
                vscode.window.showInformationMessage('✓ 测试成功！浏览器应该已打开百度首页。如果没有打开，请查看输出日志。');
            } catch (error) {
                Logger.error('测试失败', error as Error);
                vscode.window.showErrorMessage(`✗ 测试失败: ${error instanceof Error ? error.message : String(error)}`);
            }
        } else if (action === '测试打开登录页面') {
            Logger.info('\n尝试打开登录页面...');
            try {
                const finalUrl = new URL(loginUrl);
                finalUrl.searchParams.set('callback', callbackUri);
                await testBrowserOpen(finalUrl.toString(), '', platform);
                vscode.window.showInformationMessage('✓ 测试成功！浏览器应该已打开登录页面。如果没有打开，请查看输出日志。');
            } catch (error) {
                Logger.error('测试失败', error as Error);
                vscode.window.showErrorMessage(`✗ 测试失败: ${error instanceof Error ? error.message : String(error)}`);
            }
        } else if (action === '查看日志') {
            Logger.show();
        }

        Logger.info('\n' + '='.repeat(80));
        Logger.info('登录诊断完成');
        Logger.info('='.repeat(80));

    } catch (error) {
        Logger.error('登录诊断过程中出错', error as Error);
        vscode.window.showErrorMessage(`诊断失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 测试浏览器打开功能
 */
async function testBrowserOpen(url: string, command: string, platform: string): Promise<void> {
    Logger.info(`尝试打开 URL: ${url}`);

    // 方法1: 使用系统命令
    if (command) {
        Logger.info(`使用系统命令: ${command}`);
        try {
            await new Promise<void>((resolve, reject) => {
                child_process.exec(command.replace('https://www.baidu.com', url), (error, stdout, stderr) => {
                    if (error) {
                        Logger.error(`命令执行失败: ${error.message}`);
                        if (stdout) Logger.info(`stdout: ${stdout}`);
                        if (stderr) Logger.warn(`stderr: ${stderr}`);
                        reject(error);
                    } else {
                        Logger.info('✓ 命令执行成功');
                        if (stdout) Logger.info(`stdout: ${stdout}`);
                        resolve();
                    }
                });
            });
            return;
        } catch (error) {
            Logger.warn('系统命令失败，尝试备用方案...');
        }
    }

    // 方法2: 使用 VSCode API
    Logger.info('使用 vscode.env.openExternal...');
    try {
        const uri = vscode.Uri.parse(url);
        const opened = await vscode.env.openExternal(uri);
        if (opened) {
            Logger.info('✓ vscode.env.openExternal 成功');
        } else {
            Logger.warn('✗ vscode.env.openExternal 返回 false');
        }
    } catch (error) {
        Logger.error('vscode.env.openExternal 失败', error as Error);
        throw error;
    }
}
