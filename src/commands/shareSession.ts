/**
 * 分享会话命令
 * 弹出确认表单，保存 Markdown 文件到本地，生成分享链接
 */
import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseAccess } from '../dataAccess/databaseAccess';
import { LocalShareService, ShareRecord } from '../services/localShareService';
import { WebServerManager } from '../web-server/serverManager';
import { MarkdownRenderer } from '../ui/markdownRenderer';
import { Logger } from '../utils/logger';
import { WorkspaceHelper } from '../utils/workspaceHelper';
import { SessionSummarizer } from '../utils/sessionSummarizer';

export async function shareSessionCommand(
    context: vscode.ExtensionContext,
    databaseAccess: DatabaseAccess,
    shareService: LocalShareService,
    serverManager: WebServerManager | null,
    composerId?: string
): Promise<void> {
    try {
        // 如果没有指定 composerId，让用户选择
        if (!composerId) {
            const sessionList = await databaseAccess.getSessionList();
            if (sessionList.length === 0) {
                vscode.window.showWarningMessage('没有可用的会话记录');
                return;
            }

            const items = sessionList.map(s => ({
                label: s.name || `Session ${s.composerId.substring(0, 8)}`,
                description: new Date(s.lastUpdatedAt).toLocaleString(),
                composerId: s.composerId
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: '选择要分享的会话'
            });

            if (!selected) {
                return;
            }
            composerId = selected.composerId;
        }

        // 获取会话信息
        const sessionList = await databaseAccess.getSessionList();
        const session = sessionList.find(s => s.composerId === composerId);
        const sessionTitle = session?.name || `Session ${composerId!.substring(0, 8)}`;

        // 获取项目名称
        let projectName = '';
        try {
            projectName = WorkspaceHelper.getCurrentWorkspaceName() || '';
        } catch {
            projectName = '';
        }

        // 弹出确认表单
        const title = await vscode.window.showInputBox({
            prompt: '会话标题',
            value: sessionTitle,
            placeHolder: '请输入会话标题'
        });
        if (title === undefined) { return; }

        const project = await vscode.window.showInputBox({
            prompt: '项目名称',
            value: projectName,
            placeHolder: '请输入项目名称'
        });
        if (project === undefined) { return; }

        // 加载会话内容（提前加载以生成摘要）
        const renderer = new MarkdownRenderer();
        const records = await databaseAccess.getAgentRecords(composerId!);
        if (!records || records.length === 0) {
            vscode.window.showErrorMessage('未找到会话记录');
            return;
        }

        // 自动生成会话摘要作为描述默认值
        let autoSummary = '';
        try {
            const summary = SessionSummarizer.generateSummary(records);
            autoSummary = summary.text;
        } catch (err) {
            Logger.warn(`Failed to generate session summary: ${err instanceof Error ? err.message : String(err)}`);
        }

        const description = await vscode.window.showInputBox({
            prompt: '会话概括/描述（可编辑，已自动生成）',
            value: autoSummary,
            placeHolder: '可选填写会话概括描述'
        });

        const markdownParts: string[] = [];
        for (const record of records) {
            const md = await renderer.renderSession(record);
            markdownParts.push(md);
        }
        const markdownContent = markdownParts.join('\n\n---\n\n');

        // 获取用户昵称（优先使用配置，否则使用系统用户名）
        const config = vscode.workspace.getConfiguration('cursorSessionHelper');
        const configNickname = config.get<string>('nickname', '');
        const sharer = configNickname && configNickname.trim().length > 0 
            ? configNickname 
            : WorkspaceHelper.getSystemUsername();

        // 生成 UUID
        const uuid = uuidv4();

        // 构建分享记录
        const shareRecord: ShareRecord = {
            metadata: {
                uuid,
                title: title || sessionTitle,
                projectName: project || '',
                sharer,
                shareTime: new Date().toISOString(),
                createTime: session ? new Date(session.lastUpdatedAt).toISOString() : new Date().toISOString(),
                contentFormat: 'markdown',
                description: description || undefined
            },
            content: markdownContent
        };

        // 保存
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在分享...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 50, message: '保存文件...' });
            await shareService.saveShare(shareRecord);
            progress.report({ increment: 100, message: '完成' });
        });

        // 生成链接（复用上面的 config 变量）
        const port = serverManager?.getPort() || 8080;
        const customBaseUrl = config.get<string>('shareBaseUrl') || '';
        const baseUrl = customBaseUrl.trim() || `http://localhost:${port}`;
        // 移除末尾斜杠
        const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
        const shareUrl = `${normalizedBaseUrl}/share/${uuid}`;

        // 显示成功消息
        const action = await vscode.window.showInformationMessage(
            `分享成功！链接: ${shareUrl}`,
            '复制链接',
            '在浏览器中打开'
        );

        if (action === '复制链接') {
            await vscode.env.clipboard.writeText(shareUrl);
            vscode.window.showInformationMessage('链接已复制到剪贴板');
        } else if (action === '在浏览器中打开') {
            await vscode.env.openExternal(vscode.Uri.parse(shareUrl));
        }

        Logger.info(`Session shared: ${uuid} -> ${shareUrl}`);
    } catch (error) {
        Logger.error('Failed to share session', error as Error);
        vscode.window.showErrorMessage(`分享失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}
