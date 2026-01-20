import * as vscode from 'vscode';

/**
 * 配置管理类
 * 读取和管理 VS Code 配置
 */
export class Config {
    private static readonly CONFIG_SECTION = 'cursor-assistant';
    private static readonly DEFAULT_BASE_URL = 'https://spec.pixvert.app';

    /**
     * 获取配置值
     */
    static get<T>(key: string, defaultValue: T): T {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        return config.get<T>(key, defaultValue) ?? defaultValue;
    }

    /**
     * 更新配置值
     */
    static async update(key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        await config.update(key, value, target);
    }

    /**
     * 获取 JWT Token（从 globalState）
     */
    static getJWTToken(context: vscode.ExtensionContext): string | undefined {
        return context.globalState.get<string>('upload.jwt_token');
    }

    /**
     * 设置 JWT Token（保存到 globalState）
     */
    static async setJWTToken(context: vscode.ExtensionContext, token: string): Promise<void> {
        await context.globalState.update('upload.jwt_token', token);
    }

    /**
     * 获取 Base URL（从 globalState，默认值：https://spec.pixvert.app）
     */
    static getBaseUrl(context: vscode.ExtensionContext): string {
        return context.globalState.get<string>('base_url') || this.DEFAULT_BASE_URL;
    }

    /**
     * 设置 Base URL（保存到 globalState）
     */
    static async setBaseUrl(context: vscode.ExtensionContext, url: string): Promise<void> {
        // 移除末尾的斜杠
        const normalizedUrl = url.replace(/\/$/, '');
        await context.globalState.update('base_url', normalizedUrl);
    }

    /**
     * 获取 API URL（基于 Base URL）
     */
    static getAPIUrl(context: vscode.ExtensionContext): string {
        const baseUrl = this.getBaseUrl(context);
        return `${baseUrl}/api/v1`;
    }

    /**
     * 设置 API URL（保存到 globalState）
     * @deprecated 使用 setBaseUrl 替代
     */
    static async setAPIUrl(context: vscode.ExtensionContext, url: string): Promise<void> {
        // 从 API URL 提取 base URL
        const baseUrl = url.replace(/\/api\/v1\/?$/, '');
        await this.setBaseUrl(context, baseUrl);
    }

    /**
     * 获取登录页面 URL
     */
    static getLoginUrl(context: vscode.ExtensionContext): string {
        const baseUrl = this.getBaseUrl(context);
        return `${baseUrl}/plugin-login`;
    }

    /**
     * 获取用户中心 URL
     */
    static getUserCenterUrl(context: vscode.ExtensionContext): string {
        const baseUrl = this.getBaseUrl(context);
        return `${baseUrl}/user/profile`;
    }

    /**
     * 获取默认 Base URL
     */
    static getDefaultBaseUrl(): string {
        return this.DEFAULT_BASE_URL;
    }

    /**
     * 获取默认 API URL
     */
    static getDefaultAPIUrl(): string {
        return `${this.DEFAULT_BASE_URL}/api/v1`;
    }
}

