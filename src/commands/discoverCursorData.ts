import * as vscode from 'vscode';
import { CursorDataLocator } from '../utils/cursorDataLocator';
import { Logger } from '../utils/logger';

/**
 * 发现 Cursor 数据文件命令
 * 帮助用户找到 Cursor 存储 AI 使用数据和聊天记录的位置
 */
export async function discoverCursorDataCommand(): Promise<void> {
    Logger.info('Starting Cursor data discovery...');

    try {
        const userDataDir = CursorDataLocator.getCursorUserDataDir();
        Logger.info(`Cursor user data directory: ${userDataDir}`);

        // 显示进度
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Discovering Cursor Data Files',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Scanning for database files...' });
            const scanResult = await CursorDataLocator.scanCursorDataFiles();

            progress.report({ increment: 50, message: 'Analyzing files...' });

            // 创建输出文档
            const output = vscode.window.createOutputChannel('Cursor Data Discovery');
            output.show();
            output.appendLine('=== Cursor Data File Discovery ===');
            output.appendLine(`User Data Directory: ${scanResult.userDataDir}`);
            output.appendLine('');
            output.appendLine(`Found ${scanResult.databases.length} database files:`);
            scanResult.databases.forEach((db, index) => {
                output.appendLine(`  ${index + 1}. ${db}`);
            });
            output.appendLine('');
            output.appendLine(`Found ${scanResult.jsonFiles.length} JSON files (potential chat records):`);
            scanResult.jsonFiles.slice(0, 20).forEach((file, index) => {
                output.appendLine(`  ${index + 1}. ${file}`);
            });
            if (scanResult.jsonFiles.length > 20) {
                output.appendLine(`  ... and ${scanResult.jsonFiles.length - 20} more files`);
            }

            // 显示结果
            const message = `Found ${scanResult.databases.length} database files and ${scanResult.jsonFiles.length} JSON files. Check output panel for details.`;
            vscode.window.showInformationMessage(message);

            progress.report({ increment: 100, message: 'Complete' });
        });

    } catch (error) {
        Logger.error('Failed to discover Cursor data files', error as Error);
        vscode.window.showErrorMessage(`Failed to discover Cursor data: ${(error as Error).message}`);
    }
}

