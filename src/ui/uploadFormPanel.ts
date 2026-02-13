/**
 * 上传表单面板
 * 提供上传表单 UI，允许用户选择记录文件、填写表单信息并上传到分享平台
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UploadFormData, UploadRecord, ContentFormat, LocalRecordFile, validateUploadFormData, AutoFillData } from '../models/uploadRecord';
import { UploadService, AuthenticationError, ValidationError, PayloadTooLargeError, ServerError, NetworkError } from '../services/uploadService';
import { UploadConfig } from '../models/uploadRecord';
import { UploadHistoryEntry, UploadStatus } from '../models/uploadHistory';
import { Config } from '../utils/config';
import { Logger } from '../utils/logger';
import { MarkdownRenderer } from './markdownRenderer';
import { AgentRecord } from '../models/agentRecord';
import { DatabaseAccess } from '../dataAccess/databaseAccess';
import { UserProfileService } from '../services/userProfileService';
import { TokenManager } from '../utils/tokenManager';

/**
 * InitForm消息接口
 * 用于在表单初始化时传递数据到Webview
 */
interface InitFormMessage {
    type: 'initForm';
    data: {
        title?: string;
        uploader_email?: string;
        project_name?: string;
        content?: string;
        content_format?: ContentFormat;
        upload_time?: string;
    };
}

/**
 * AutoFillData消息接口
 * 用于响应Webview的自动填充请求
 */
interface AutoFillDataMessage {
    type: 'autoFillData';
    data: AutoFillData;
}

/**
 * RequestAutoFill消息接口
 * Webview请求重新获取自动填充数据
 */
interface RequestAutoFillMessage {
    type: 'requestAutoFill';
}

/**
 * 上传表单面板接口
 */
export interface IUploadFormPanel {
    /**
     * 创建并显示上传表单面板
     * @param context VS Code Extension Context
     */
    createPanel(context: vscode.ExtensionContext): void;

    /**
     * 显示上传表单
     * @param composerId 会话ID（composerId），用于从数据库加载会话内容
     * @param initialData 初始表单数据（可选）
     */
    showForm(composerId: string, initialData?: Partial<UploadFormData>): void;

    /**
     * 关闭面板
     */
    dispose(): void;

    /**
     * 处理表单提交
     * @param formData 表单数据
     */
    handleSubmit(formData: UploadFormData): Promise<void>;

    /**
     * 从数据库加载会话内容
     * @param composerId 会话ID
     * @param format 内容格式（可选，默认'markdown'）
     */
    loadSessionContent(composerId: string, format?: ContentFormat): Promise<string>;
}

/**
 * 上传表单面板实现
 */
export class UploadFormPanel implements IUploadFormPanel {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private uploadService: UploadService;
    private markdownRenderer: MarkdownRenderer;
    private databaseAccess: DatabaseAccess | null;
    private userProfileService: UserProfileService | null = null;
    private tokenManager: TokenManager;
    private currentComposerId: string | undefined;

    constructor(context: vscode.ExtensionContext, _storageManager: null, databaseAccess: DatabaseAccess | null) {
        this.context = context;
        this.databaseAccess = databaseAccess;
        this.uploadService = new UploadService();
        this.markdownRenderer = new MarkdownRenderer();
        this.tokenManager = new TokenManager(context);
    }

    /**
     * 设置UserProfileService
     */
    setUserProfileService(service: UserProfileService): void {
        this.userProfileService = service;
    }

    /**
     * 创建并显示上传表单面板
     */
    createPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            'uploadForm',
            '上传记录',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // 处理来自 Webview 的消息
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'selectFile':
                    await this.handleFileSelect();
                    break;
                case 'submit':
                    await this.handleSubmit(message.data);
                    break;
                case 'cancel':
                    this.panel?.dispose();
                    break;
                case 'reloadContent':
                    await this.handleReloadContent(message.data.filePath, message.data.format);
                    break;
                case 'openEditor':
                    await this.handleOpenEditor(message.data);
                    break;
                case 'previewMarkdown':
                    await this.handlePreviewMarkdown(message.data.content);
                    break;
                case 'configure':
                    await vscode.commands.executeCommand('cursor-session-helper.configureUpload');
                    break;
                case 'requestAutoFill':
                    await this.handleRequestAutoFill();
                    break;
                case 'getContent':
                    // 响应内容获取请求
                    const content = message.data?.content || '';
                    this.panel?.webview.postMessage({
                        type: 'contentResponse',
                        data: { content: content }
                    });
                    break;
            }
        });
    }

    /**
     * 显示上传表单
     */
    async showForm(composerId: string, initialData?: Partial<UploadFormData>): Promise<void> {
        if (!this.panel) {
            this.createPanel();
        }
        
        // 保存当前的composerId，供后续使用
        this.currentComposerId = composerId;
        
        try {
            let content = initialData?.content || '';
            let sessionTitle = initialData?.title || '';
            
            // 如果提供了 composerId，从数据库加载会话内容和标题
            if (composerId && composerId.trim().length > 0) {
                try {
                    // 加载会话内容
                    content = await this.loadSessionContent(composerId, initialData?.content_format || ContentFormat.MARKDOWN);
                    
                    // 获取会话标题
                    if (!sessionTitle && this.databaseAccess) {
                        const sessionList = await this.databaseAccess.getSessionList();
                        const session = sessionList.find(s => s.composerId === composerId);
                        if (session) {
                            sessionTitle = session.name;
                            Logger.info(`Session title loaded: ${sessionTitle}`);
                        }
                    }
                } catch (error) {
                    Logger.error(`Failed to load session content for ${composerId}`, error as Error);
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`加载会话内容失败: ${errorMessage}`);
                    
                    // 即使加载失败，也显示表单（内容为空）
                    content = '';
                }
            }
            
            // 获取自动填充数据
            const autoFillData = await this.getAutoFillData(composerId);
            
            // 准备初始数据（合并自动填充数据）
            const formData: Partial<UploadFormData> = {
                ...initialData,
                composer_id: composerId || undefined,
                title: initialData?.title || autoFillData.title || sessionTitle || undefined,
                uploader_email: initialData?.uploader_email || autoFillData.email || undefined,
                project_name: initialData?.project_name || autoFillData.projectName || undefined,
                content: content,
                content_format: initialData?.content_format || ContentFormat.MARKDOWN,
                upload_time: initialData?.upload_time || new Date().toISOString()
            };
            
            // 发送到 Webview (使用initForm消息类型)
            this.panel?.webview.postMessage({
                type: 'initForm',
                data: formData
            });
        } catch (error) {
            Logger.error('Failed to show upload form', error as Error);
            vscode.window.showErrorMessage(`显示上传表单失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 从数据库加载会话内容
     */
    async loadSessionContent(composerId: string, format: ContentFormat = ContentFormat.MARKDOWN): Promise<string> {
        if (!this.databaseAccess) {
            throw new Error('Database access is not available');
        }

        try {
            // 从数据库获取会话记录
            const records = await this.databaseAccess.getAgentRecords(composerId);
            
            if (!records || records.length === 0) {
                throw new Error(`未找到会话记录: ${composerId}`);
            }

            // 转换为目标格式
            return await this.convertToFormat(records, format);
        } catch (error) {
            Logger.error(`Failed to load session content for ${composerId}`, error as Error);
            throw error;
        }
    }

    /**
     * 处理打开编辑器请求（备选方案）
     */
    private async handleOpenEditor(data?: { content?: string; format?: string }): Promise<void> {
        try {
            const content = data?.content || '';
            const format = data?.format || 'markdown';
            
            // 根据格式确定语言
            let language = 'markdown';
            if (format === 'json') {
                language = 'json';
            } else if (format === 'html') {
                language = 'html';
            } else if (format === 'text') {
                language = 'plaintext';
            }

            // 创建临时文档
            const doc = await vscode.workspace.openTextDocument({
                content: content,
                language: language
            });

            // 打开编辑器
            await vscode.window.showTextDocument(doc);

            // 如果是 Markdown，自动打开预览
            if (format === 'markdown') {
                await vscode.commands.executeCommand('markdown.showPreview', doc.uri);
            }

            // 监听文档保存，同步回表单
            const saveListener = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
                if (savedDoc === doc) {
                    const updatedContent = doc.getText();
                    this.panel?.webview.postMessage({
                        type: 'contentUpdated',
                        data: { content: updatedContent }
                    });
                    saveListener.dispose();
                }
            });
            
            Logger.info('Editor opened successfully');
        } catch (error) {
            Logger.error('Failed to open editor', error as Error);
            vscode.window.showErrorMessage(`打开编辑器失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 处理 Markdown 预览请求
     */
    private async handlePreviewMarkdown(content: string): Promise<void> {
        try {
            // 创建临时 Markdown 文档
            const doc = await vscode.workspace.openTextDocument({
                content: content,
                language: 'markdown'
            });

            // 打开 Markdown 预览
            await vscode.commands.executeCommand('markdown.showPreview', doc.uri);
            
            Logger.info('Markdown preview opened');
        } catch (error) {
            Logger.error('Failed to open markdown preview', error as Error);
            vscode.window.showErrorMessage(`打开预览失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 将 AgentRecord 数组转换为指定格式的内容
     */
    private async convertToFormat(records: AgentRecord[], format: ContentFormat): Promise<string> {
        switch (format) {
            case ContentFormat.JSON:
                return JSON.stringify(records, null, 2);
            
            case ContentFormat.MARKDOWN:
                // 合并所有记录的消息并渲染
                const combinedMarkdown: string[] = [];
                for (const record of records) {
                    const markdown = await this.markdownRenderer.renderSession(record);
                    combinedMarkdown.push(markdown);
                }
                return combinedMarkdown.join('\n\n---\n\n');
            
            case ContentFormat.TEXT:
                return this.convertToText(records);
            
            case ContentFormat.HTML:
                return this.convertToHtml(records);
            
            default:
                const defaultMarkdown: string[] = [];
                for (const record of records) {
                    const markdown = await this.markdownRenderer.renderSession(record);
                    defaultMarkdown.push(markdown);
                }
                return defaultMarkdown.join('\n\n---\n\n');
        }
    }

    /**
     * 转换为纯文本格式
     */
    private convertToText(records: AgentRecord[]): string {
        const lines: string[] = [];
        
        for (const record of records) {
            lines.push(`=== ${record.conversationType} ===`);
            lines.push(`时间: ${new Date(record.timestamp).toLocaleString()}`);
            lines.push(`会话ID: ${record.sessionId}`);
            
            for (const message of record.messages) {
                lines.push(`${message.role}: ${message.content}`);
            }
            
            if (record.codeSnippets && record.codeSnippets.length > 0) {
                lines.push(`代码片段: ${record.codeSnippets.length} 个`);
            }
            
            lines.push('');
        }
        
        return lines.join('\n');
    }

    /**
     * 转换为 HTML 格式
     */
    private convertToHtml(records: AgentRecord[]): string {
        const html: string[] = ['<div class="agent-records">'];
        
        for (const record of records) {
            html.push('<div class="record">');
            html.push(`<h3>${record.conversationType}</h3>`);
            html.push(`<p><strong>时间:</strong> ${new Date(record.timestamp).toLocaleString()}</p>`);
            html.push(`<p><strong>会话ID:</strong> ${this.escapeHtml(record.sessionId)}</p>`);
            
            for (const message of record.messages) {
                html.push(`<p><strong>${message.role}:</strong> ${this.escapeHtml(message.content)}</p>`);
            }
            
            if (record.codeSnippets && record.codeSnippets.length > 0) {
                html.push(`<p><strong>代码片段:</strong> ${record.codeSnippets.length} 个</p>`);
            }
            
            html.push('</div>');
        }
        
        html.push('</div>');
        return html.join('\n');
    }

    /**
     * HTML 转义
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * 关闭面板
     */
    dispose(): void {
        this.panel?.dispose();
    }

    /**
     * 处理重新加载内容（格式转换）
     */
    private async handleReloadContent(filePath: string, format: string): Promise<void> {
        try {
            const contentFormat = format as ContentFormat;
            const content = await this.loadFileContent(filePath, contentFormat);
            
            this.panel?.webview.postMessage({
                type: 'contentReloaded',
                data: { content }
            });
        } catch (error) {
            Logger.error('Failed to reload content', error as Error);
            vscode.window.showErrorMessage(`重新加载内容失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 处理文件选择
     */
    async handleFileSelect(filePath?: string): Promise<void> {
        if (filePath) {
            // 如果提供了文件路径，直接加载
            try {
                const content = await this.loadFileContent(filePath, ContentFormat.MARKDOWN);
                this.panel?.webview.postMessage({
                    type: 'fileLoaded',
                    data: { 
                        content, 
                        filePath,
                        fileName: path.basename(filePath)
                    }
                });
            } catch (error) {
                Logger.error('Failed to load file', error as Error);
                vscode.window.showErrorMessage(`加载文件失败: ${error instanceof Error ? error.message : String(error)}`);
            }
            return;
        }
        try {
            // 扫描本地存储目录
            const files = await this.scanLocalRecordFiles();
            
            if (files.length === 0) {
                vscode.window.showWarningMessage('未找到可用的记录文件。请确保已使用 Cursor 助手插件采集了数据。');
                return;
            }

            // 使用 QuickPick 显示文件列表
            const items = files.map(f => ({
                label: f.file_name,
                description: f.date,
                detail: f.file_path,
                file: f
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: '选择要上传的记录文件',
                canPickMany: false
            });

            if (selected) {
                // 加载文件内容
                const content = await this.loadFileContent(selected.file.file_path, ContentFormat.MARKDOWN);
                
                // 发送到 Webview
                this.panel?.webview.postMessage({
                    type: 'fileLoaded',
                    data: { 
                        content, 
                        filePath: selected.file.file_path,
                        fileName: selected.file.file_name
                    }
                });
            }
        } catch (error) {
            Logger.error('File selection failed', error as Error);
            vscode.window.showErrorMessage(`文件选择失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 处理表单提交
     */
    async handleSubmit(formData: UploadFormData): Promise<void> {
        try {
            // 验证表单数据
            const errors = validateUploadFormData(formData);
            if (Object.keys(errors).length > 0) {
                this.panel?.webview.postMessage({
                    type: 'validationError',
                    data: errors
                });
                return;
            }

            // 获取配置
            let config: UploadConfig;
            try {
                config = await this.getUploadConfig();
            } catch (error) {
                // Token 未配置，提示用户
                const action = await vscode.window.showErrorMessage(
                    '请先配置 JWT Token',
                    '立即配置'
                );
                if (action === '立即配置') {
                    await vscode.commands.executeCommand('cursor-session-helper.configureUpload');
                }
                return;
            }

            // 转换为上传记录
            const record: UploadRecord = {
                title: formData.title,
                project_name: formData.project_name,
                uploader_email: formData.uploader_email,
                upload_time: formData.upload_time,
                content_format: formData.content_format,
                content: formData.content
            };

            // 上传记录
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '上传记录',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: '正在上传...' });
                
                try {
                    const response = await this.uploadService.uploadRecord(record, config);
                    
                    progress.report({ increment: 100, message: '上传成功' });
                    
                    // 保存上传历史
                    await this.saveUploadHistory({
                        record_id: response.data.id,
                        upload_time: new Date().toISOString(),
                        status: UploadStatus.SUCCESS,
                        project_name: record.project_name
                    });
                    
                    vscode.window.showInformationMessage(`记录上传成功！ID: ${response.data.id}`);
                    this.panel?.dispose();
                } catch (error) {
                    progress.report({ increment: 100, message: '上传失败' });
                    throw error;
                }
            });
        } catch (error) {
            Logger.error('Upload failed', error as Error);
            
            let errorMessage = '上传失败';
            let errorCode = 'UNKNOWN_ERROR';
            
            if (error instanceof AuthenticationError) {
                errorMessage = '认证失败，请更新 JWT Token（使用命令：配置上传）';
                errorCode = 'AUTHENTICATION_ERROR';
            } else if (error instanceof ValidationError) {
                errorMessage = `验证失败: ${error.message}`;
                errorCode = 'VALIDATION_ERROR';
                if (error.details?.field) {
                    errorMessage += ` (字段: ${error.details.field})`;
                }
            } else if (error instanceof PayloadTooLargeError) {
                errorMessage = '内容大小超过10MB限制';
                errorCode = 'PAYLOAD_TOO_LARGE';
            } else if (error instanceof ServerError) {
                errorMessage = `${error.message}，请稍后重试`;
                errorCode = 'SERVER_ERROR';
            } else if (error instanceof NetworkError) {
                errorMessage = `${error.message}，请检查网络连接后重试`;
                errorCode = 'NETWORK_ERROR';
            } else {
                errorMessage = `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`;
            }

            Logger.error(`Upload failed with code ${errorCode}: ${errorMessage}`);
            vscode.window.showErrorMessage(errorMessage);
            
            // 保存失败的上传历史
            await this.saveUploadHistory({
                upload_time: new Date().toISOString(),
                status: UploadStatus.FAILED,
                error_message: errorMessage,
                project_name: formData.project_name
            });
            
            // 发送错误到 Webview
            this.panel?.webview.postMessage({
                type: 'uploadError',
                data: { message: errorMessage }
            });
        }
    }

    /**
     * 保存上传历史
     */
    private async saveUploadHistory(entry: UploadHistoryEntry): Promise<void> {
        try {
            const history = this.context.globalState.get<UploadHistoryEntry[]>('upload.history', []);
            history.unshift(entry); // 添加到开头
            
            // 限制历史记录数量（最多保留100条）
            if (history.length > 100) {
                history.splice(100);
            }
            
            await this.context.globalState.update('upload.history', history);
        } catch (error) {
            Logger.warn('Failed to save upload history', error as Error);
        }
    }

    private fileListCache: { files: LocalRecordFile[]; timestamp: number } | null = null;
    private readonly CACHE_DURATION = 30000; // 30秒缓存

    /**
     * 扫描本地记录文件（带缓存）
     */
    private async scanLocalRecordFiles(): Promise<LocalRecordFile[]> {
        // 检查缓存
        const now = Date.now();
        if (this.fileListCache && (now - this.fileListCache.timestamp) < this.CACHE_DURATION) {
            Logger.debug('Using cached file list');
            return this.fileListCache.files;
        }

        const files: LocalRecordFile[] = [];
        
        // 本地文件加载功能已废弃，现在只从数据库加载
        Logger.info('Local file loading is deprecated, only database loading is supported');
        return files;
    }

    /**
     * 加载文件内容并转换为指定格式
     */
    private async loadFileContent(filePath: string, format: ContentFormat): Promise<string> {
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const agentRecord: AgentRecord = JSON.parse(fileContent);

            switch (format) {
                case ContentFormat.JSON:
                    return JSON.stringify(agentRecord, null, 2);
                
                case ContentFormat.MARKDOWN:
                    return await this.markdownRenderer.renderSession(agentRecord);
                
                case ContentFormat.TEXT:
                    // 提取纯文本
                    return this.extractTextFromRecord(agentRecord);
                
                case ContentFormat.HTML:
                    // 转换为 HTML（基本实现）
                    return this.convertToHTML(agentRecord);
                
                default:
                    return JSON.stringify(agentRecord, null, 2);
            }
        } catch (error) {
            Logger.error('Failed to load file content', error as Error);
            throw new Error(`加载文件失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 从记录中提取纯文本
     */
    private extractTextFromRecord(record: AgentRecord): string {
        const lines: string[] = [];
        
        for (const message of record.messages) {
            if (message.content) {
                lines.push(message.content);
            }
        }
        
        return lines.join('\n\n');
    }

    /**
     * 转换为 HTML 格式
     */
    private convertToHTML(record: AgentRecord): string {
        const lines: string[] = ['<html><body>'];
        
        for (const message of record.messages) {
            const isUser = message.role === 'user';
            const tag = isUser ? 'h3' : 'h4';
            const content = message.content.replace(/\n/g, '<br>');
            lines.push(`<${tag}>${isUser ? 'User' : 'Assistant'}</${tag}>`);
            lines.push(`<p>${content}</p>`);
        }
        
        lines.push('</body></html>');
        return lines.join('\n');
    }

    /**
     * 获取上传配置
     * 优先从TokenManager获取token（登录后的token），如果没有则从Config获取（手动配置的token）
     */
    private async getUploadConfig(): Promise<UploadConfig> {
        // 优先从TokenManager获取token（登录后的token）
        let jwtToken = await this.tokenManager.getValidToken();
        
        // 如果TokenManager没有token，回退到Config（手动配置的token，向后兼容）
        if (!jwtToken) {
            jwtToken = Config.getJWTToken(this.context) || null;
            if (jwtToken) {
                Logger.debug('Using JWT token from Config (manual configuration)');
            }
        } else {
            Logger.debug('Using JWT token from TokenManager (login token)');
        }

        const apiUrl = Config.getAPIUrl(this.context);

        if (!jwtToken) {
            throw new Error('JWT Token 未配置，请先登录或手动配置Token');
        }

        return {
            jwt_token: jwtToken,
            api_url: apiUrl
        };
    }

    /**
     * 获取自动填充数据
     * @param composerId 可选的会话ID，用于获取会话标题
     * @returns 包含邮箱、项目名称和会话标题的对象
     */
    private async getAutoFillData(composerId?: string): Promise<AutoFillData> {
        let email: string | null = null;
        let projectName: string | null = null;
        let title: string | null = null;
        
        // 安全地获取用户邮箱 (优先使用UserProfileService)
        try {
            if (this.userProfileService) {
                const profile = await this.userProfileService.getProfile();
                if (profile) {
                    email = profile.email;
                    Logger.info('Email auto-filled from UserProfileService');
                }
            }
            
            // 回退:从token提取邮箱
            if (!email) {
                const token = Config.getJWTToken(this.context);
                if (token) {
                    email = this.extractEmailFromToken(token);
                    Logger.info('Email auto-filled from JWT token');
                }
            }
        } catch (error) {
            Logger.warn('Failed to get user email for auto-fill', error as Error);
            // 静默失败,不影响表单显示
        }
        
        // 安全地获取项目名称
        try {
            const WorkspaceHelper = require('../utils/workspaceHelper').WorkspaceHelper;
            projectName = WorkspaceHelper.getCurrentWorkspaceName();
        } catch (error) {
            Logger.warn('Failed to get workspace name for auto-fill', error as Error);
            // 静默失败,不影响表单显示
        }
        
        // 安全地获取会话标题
        if (composerId && this.databaseAccess) {
            try {
                const sessionList = await this.databaseAccess.getSessionList();
                const session = sessionList.find(s => s.composerId === composerId);
                if (session) {
                    title = session.name;
                }
            } catch (error) {
                Logger.warn('Failed to get session title for auto-fill', error as Error);
                // 静默失败,不影响表单显示
            }
        }
        
        return { email, projectName, title };
    }

    /**
     * 从JWT token中提取邮箱
     * @param token JWT token字符串
     * @returns 邮箱地址,如果提取失败则返回null
     */
    private extractEmailFromToken(token: string): string | null {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return null;
            }
            
            // 解码payload部分
            const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
            const data = JSON.parse(payload);
            
            // 尝试多种可能的邮箱字段
            return data.email || data.user?.email || null;
        } catch (error) {
            Logger.error('Failed to extract email from token', error as Error);
            return null;
        }
    }

    /**
     * 处理自动填充请求
     * 响应Webview的requestAutoFill消息
     */
    private async handleRequestAutoFill(): Promise<void> {
        try {
            const autoFillData = await this.getAutoFillData(this.currentComposerId);
            
            this.panel?.webview.postMessage({
                type: 'autoFillData',
                data: autoFillData
            });
        } catch (error) {
            Logger.error('Failed to handle auto-fill request', error as Error);
            // 静默失败,不显示错误给用户
        }
    }

    /**
     * 获取 Webview HTML 内容
     */
    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>上传记录</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .field {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }
        input, select, textarea {
            width: 100%;
            padding: 8px;
            box-sizing: border-box;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }
        input:focus, select:focus, textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        textarea {
            min-height: 200px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
        }
        .error {
            color: var(--vscode-errorForeground);
            font-size: 12px;
            margin-top: 5px;
            display: block;
        }
        .actions {
            margin-top: 20px;
            display: flex;
            gap: 10px;
        }
        button {
            padding: 10px 20px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .content-editor {
            position: relative;
        }
        .editor-actions {
            margin-top: 10px;
            display: flex;
            gap: 10px;
        }
        .preview-area {
            margin-top: 10px;
            padding: 15px;
            background-color: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            min-height: 200px;
            max-height: 500px;
            overflow-y: auto;
        }
        .preview-area h1, .preview-area h2, .preview-area h3 {
            margin-top: 1em;
            margin-bottom: 0.5em;
        }
        .preview-area code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 2px;
        }
        .preview-area pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 2px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <form id="uploadForm">
        <div class="field">
            <label>会话标题 *</label>
            <input type="text" id="title" required placeholder="请输入会话标题">
            <span class="error" id="title_error"></span>
        </div>
        <div class="field">
            <label>项目名称 *</label>
            <input type="text" id="project_name" required placeholder="请输入项目名称">
            <span class="error" id="project_name_error"></span>
        </div>
        <div class="field">
            <label>上传人邮箱 *</label>
            <input type="email" id="uploader_email" required placeholder="user@example.com">
            <span class="error" id="uploader_email_error"></span>
        </div>
        <div class="field">
            <label>上传时间 *</label>
            <input type="datetime-local" id="upload_time" required>
            <span class="error" id="upload_time_error"></span>
        </div>
        <div class="field">
            <label>内容格式</label>
            <select id="content_format">
                <option value="markdown">Markdown</option>
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
            </select>
        </div>
        <div class="field">
            <label>内容 *</label>
            <div class="content-editor">
                <textarea id="content" rows="20" placeholder="会话内容将自动加载..."></textarea>
                <div class="editor-actions">
                    <button type="button" id="preview" class="secondary">预览</button>
                    <button type="button" id="openEditor" class="secondary">打开编辑器</button>
                </div>
                <div class="preview-area" id="previewArea" style="display: none;"></div>
            </div>
            <span class="error" id="content_error"></span>
        </div>
        <div class="actions">
            <button type="submit" id="upload">上传</button>
            <button type="button" id="cancel" class="secondary">取消</button>
            <button type="button" id="configure" class="secondary">配置</button>
        </div>
    </form>
    <script>
        const vscode = acquireVsCodeApi();
        
        // 设置默认时间为当前时间
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('upload_time').value = now.toISOString().slice(0, 16);
        
        // 预览按钮 - 使用 VS Code 的 Markdown 预览功能
        document.getElementById('preview').addEventListener('click', () => {
            const content = document.getElementById('content').value;
            const format = document.getElementById('content_format').value;
            
            if (format === 'markdown') {
                // 对于 Markdown，使用 VS Code 的预览命令
                vscode.postMessage({ 
                    type: 'previewMarkdown', 
                    data: { content: content } 
                });
            } else {
                // 对于其他格式，在 Webview 内预览
                const previewArea = document.getElementById('previewArea');
                const textarea = document.getElementById('content');
                
                if (previewArea.style.display === 'none') {
                    // 显示预览
                    if (format === 'html') {
                        previewArea.innerHTML = content;
                    } else {
                        previewArea.textContent = content;
                    }
                    previewArea.style.display = 'block';
                    textarea.style.display = 'none';
                    document.getElementById('preview').textContent = '编辑';
                } else {
                    // 显示编辑器
                    previewArea.style.display = 'none';
                    textarea.style.display = 'block';
                    document.getElementById('preview').textContent = '预览';
                }
            }
        });
        
        // 打开编辑器按钮（备选方案）- 直接传递内容
        document.getElementById('openEditor').addEventListener('click', () => {
            const content = document.getElementById('content').value;
            const format = document.getElementById('content_format').value;
            vscode.postMessage({ 
                type: 'openEditor', 
                data: { content: content, format: format } 
            });
        });
        
        // 配置按钮
        document.getElementById('configure').addEventListener('click', () => {
            vscode.postMessage({ type: 'configure' });
        });
        
        // 表单提交
        document.getElementById('uploadForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const uploadTime = document.getElementById('upload_time').value;
            const formData = {
                title: document.getElementById('title').value,
                project_name: document.getElementById('project_name').value,
                uploader_email: document.getElementById('uploader_email').value,
                upload_time: new Date(uploadTime).toISOString(),
                content_format: document.getElementById('content_format').value,
                content: document.getElementById('content').value
            };
            vscode.postMessage({ type: 'submit', data: formData });
        });
        
        // 取消
        document.getElementById('cancel').addEventListener('click', () => {
            vscode.postMessage({ type: 'cancel' });
        });
        
        // 内容格式改变时重新加载内容
        document.getElementById('content_format').addEventListener('change', (e) => {
            const format = e.target.value;
            const filePath = document.getElementById('content').dataset.filePath;
            if (filePath) {
                // 通知扩展重新加载内容
                vscode.postMessage({ type: 'reloadContent', data: { filePath, format } });
            }
        });
        
        // 处理内容重新加载
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'contentReloaded') {
                document.getElementById('content').value = message.data.content;
            }
        });
        
        // 处理来自扩展的消息
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'fileLoaded':
                    document.getElementById('content').value = message.data.content;
                    document.getElementById('content').dataset.filePath = message.data.filePath;
                    document.getElementById('file_info').textContent = \`已选择文件: \${message.data.fileName}\`;
                    document.getElementById('file_info').style.display = 'block';
                    clearErrors();
                    break;
                case 'contentReloaded':
                    document.getElementById('content').value = message.data.content;
                    break;
                case 'validationError':
                    displayErrors(message.data);
                    break;
                case 'uploadError':
                    vscode.postMessage({ type: 'showError', data: message.data });
                    break;
                case 'initForm':
                case 'initialData':  // 保持向后兼容
                    if (message.data) {
                        // 自动填充会话标题
                        if (message.data.title) {
                            document.getElementById('title').value = message.data.title;
                        }
                        // 自动填充项目名称
                        if (message.data.project_name) {
                            document.getElementById('project_name').value = message.data.project_name;
                        }
                        // 自动填充邮箱
                        if (message.data.uploader_email) {
                            document.getElementById('uploader_email').value = message.data.uploader_email;
                        }
                        if (message.data.upload_time) {
                            const time = new Date(message.data.upload_time);
                            time.setMinutes(time.getMinutes() - time.getTimezoneOffset());
                            document.getElementById('upload_time').value = time.toISOString().slice(0, 16);
                        }
                        if (message.data.content_format) {
                            document.getElementById('content_format').value = message.data.content_format;
                        }
                        if (message.data.content) {
                            document.getElementById('content').value = message.data.content;
                        }
                    }
                    break;
                case 'contentUpdated':
                    // 从外部编辑器同步内容回表单
                    if (message.data && message.data.content !== undefined) {
                        document.getElementById('content').value = message.data.content;
                    }
                    break;
                case 'autoFillData':
                    // 处理自动填充数据响应
                    if (message.data) {
                        if (message.data.title) {
                            document.getElementById('title').value = message.data.title;
                        }
                        if (message.data.email) {
                            document.getElementById('uploader_email').value = message.data.email;
                        }
                        if (message.data.projectName) {
                            document.getElementById('project_name').value = message.data.projectName;
                        }
                    }
                    break;
            }
        });
        
        // 监听表单重置事件
        document.getElementById('uploadForm').addEventListener('reset', function(event) {
            // 延迟执行,确保表单字段已被重置
            setTimeout(function() {
                // 请求重新填充自动填充数据
                vscode.postMessage({ type: 'requestAutoFill' });
            }, 0);
        });
        
        // 简单的 Markdown 渲染函数（仅用于非 Markdown 格式的预览）
        function renderMarkdown(text) {
            if (!text) return '';
            // 转义 HTML 特殊字符
            const escapeHtml = (str) => {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            };
            
            // 简单的 Markdown 渲染（仅用于 HTML 格式的预览）
            // 注意：在模板字符串中，正则表达式需要正确转义
            let html = text;
            html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
            html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
            html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
            html = html.replace(/\\*\\*(.*?)\\*\\*/gim, '<strong>$1</strong>');
            html = html.replace(/\\*(.*?)\\*/gim, '<em>$1</em>');
            html = html.replace(/\`([^\`]+)\`/gim, '<code>$1</code>');
            html = html.replace(/\`\`\`([\\s\\S]*?)\`\`\`/gim, '<pre><code>$1</code></pre>');
            html = html.replace(/\\n/gim, '<br>');
            return html;
        }
        
        function displayErrors(errors) {
            clearErrors();
            Object.keys(errors).forEach(field => {
                const errorElement = document.getElementById(field + '_error');
                if (errorElement) {
                    errorElement.textContent = errors[field];
                }
            });
        }
        
        function clearErrors() {
            ['title', 'project_name', 'uploader_email', 'upload_time', 'content'].forEach(field => {
                const errorElement = document.getElementById(field + '_error');
                if (errorElement) {
                    errorElement.textContent = '';
                }
            });
        }
    </script>
</body>
</html>`;
    }
}

