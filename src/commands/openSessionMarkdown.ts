import * as vscode from 'vscode';
import { DatabaseAccess } from '../dataAccess/databaseAccess';
import { MarkdownRenderer } from '../ui/markdownRenderer';
import { Logger } from '../utils/logger';

/**
 * 打开会话 Markdown 视图命令
 * 从数据库加载会话数据，渲染为 Markdown，并在编辑器中显示
 */
export async function openSessionMarkdownCommand(
    databaseAccess: DatabaseAccess,
    composerId: string
): Promise<void> {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading Session Markdown',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Loading session data...' });

            // 1. 加载会话数据（数据加载失败的错误处理）
            if (!databaseAccess.isAvailable()) {
                const errorMsg = 'Database access is not available. Please ensure Cursor is properly configured.';
                vscode.window.showErrorMessage(errorMsg);
                Logger.error(errorMsg);
                return;
            }

            const records = await databaseAccess.getAgentRecords(composerId);
            progress.report({ increment: 40, message: 'Loading bubble details...' });

            if (!records || records.length === 0) {
                vscode.window.showErrorMessage(`Session not found: ${composerId}. The session may have been deleted or does not exist.`);
                Logger.warn(`Session not found: ${composerId}`);
                return;
            }

            const record = records[0];
            progress.report({ increment: 60, message: 'Rendering Markdown...' });

            // 2. 渲染 Markdown
            const renderer = new MarkdownRenderer();
            const markdown = await renderer.renderSession(record);

            progress.report({ increment: 80, message: 'Opening editor...' });

            // 3. 创建临时文档
            const sessionName = record.sessionId || composerId;
            const uri = vscode.Uri.parse(`untitled:${sessionName}.md`);
            const document = await vscode.workspace.openTextDocument({
                language: 'markdown',
                content: markdown
            });

            // 4. 显示文档
            await vscode.window.showTextDocument(document, {
                preview: false
            });

            progress.report({ increment: 100, message: 'Complete' });
        });
    } catch (error) {
        Logger.error('Failed to open session markdown', error as Error);
        vscode.window.showErrorMessage(`Failed to open session markdown: ${(error as Error).message}`);
    }
}

