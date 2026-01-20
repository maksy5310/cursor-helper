import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Logger } from './logger';
import { AvatarCacheEntry } from '../models/userProfile';

/**
 * 头像加载器
 * 改进的策略：
 * 1. 优先使用后端提供的头像（支持Base64和HTTP URL）
 * 2. 失败则使用默认头像
 * 注意：不再使用 Gravatar（被墙）
 */
export class AvatarLoader {
    private readonly CACHE_DIR_NAME = 'avatars';
    private readonly CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30天
    private readonly DEFAULT_AVATAR_PATH: string;
    private cacheDir: string;

    constructor(private context: vscode.ExtensionContext) {
        // 缓存目录位于globalStorageUri下
        this.cacheDir = path.join(context.globalStorageUri.fsPath, this.CACHE_DIR_NAME);
        
        // 默认头像位于resources目录
        this.DEFAULT_AVATAR_PATH = path.join(
            context.extensionPath,
            'resources',
            'default-avatar.svg'
        );

        // 确保缓存目录存在
        this.ensureCacheDir();
    }

    /**
     * 加载用户头像
     * 改进的三级降级策略:
     * 1. 使用后端提供的头像URL（可能是Base64或HTTP URL）
     * 2. 如果加载失败，使用默认头像
     * 注意：不再使用 Gravatar，因为可能被墙
     * 
     * @param email 用户邮箱
     * @param avatarUrl 后端提供的头像URL(可选，可能是Base64或HTTP URL)
     * @returns 头像的本地Uri
     */
    async loadAvatar(email: string, avatarUrl?: string): Promise<vscode.Uri> {
        try {
            // 1. 检查缓存
            const cached = await this.getCachedAvatar(email);
            if (cached && !this.isCacheExpired(cached)) {
                Logger.info(`Using cached avatar for ${email}`);
                return vscode.Uri.file(cached.localPath);
            }

            // 2. 处理 Base64 图片
            if (avatarUrl && avatarUrl.startsWith('data:image')) {
                Logger.info(`Processing Base64 avatar for ${email}`);
                try {
                    const base64Data = avatarUrl.split(',')[1];
                    if (base64Data) {
                        const buffer = Buffer.from(base64Data, 'base64');
                        const localPath = await this.saveToCache(email, buffer);
                        Logger.info(`Base64 avatar cached for ${email}`);
                        return vscode.Uri.file(localPath);
                    }
                } catch (error) {
                    Logger.warn(`Failed to process Base64 avatar:`, error as Error);
                }
            }

            // 3. 尝试从 HTTP URL 加载
            if (avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) {
                Logger.info(`Trying to load avatar from URL: ${avatarUrl}`);
                const downloaded = await this.tryLoadUrl(avatarUrl, 5000);
                if (downloaded) {
                    const localPath = await this.saveToCache(email, downloaded);
                    Logger.info(`Avatar downloaded and cached for ${email}`);
                    return vscode.Uri.file(localPath);
                }
            }

            // 4. 降级到默认头像（不再尝试 Gravatar，因为可能被墙）
            Logger.info(`Using default avatar for ${email}`);
            return vscode.Uri.file(this.DEFAULT_AVATAR_PATH);
        } catch (error) {
            Logger.error(`Failed to load avatar for ${email}`, error as Error);
            return vscode.Uri.file(this.DEFAULT_AVATAR_PATH);
        }
    }

    /**
     * 尝试从URL加载图片
     * @param url 图片URL
     * @param timeoutMs 超时时间(毫秒)
     * @returns 图片数据Buffer,失败则返回null
     */
    private async tryLoadUrl(url: string, timeoutMs: number): Promise<Buffer | null> {
        try {
            // 动态导入node-fetch
            const fetch = (await import('node-fetch')).default;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(url, {
                signal: controller.signal as any
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                Logger.warn(`Failed to fetch avatar: ${response.status} ${response.statusText}`);
                return null;
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            if ((error as any).name === 'AbortError') {
                Logger.warn(`Avatar fetch timed out: ${url}`);
            } else {
                Logger.warn(`Failed to fetch avatar from ${url}:`, error as Error);
            }
            return null;
        }
    }

    /**
     * 保存头像到缓存
     * @param email 用户邮箱
     * @param data 头像数据
     * @returns 本地文件路径
     */
    private async saveToCache(email: string, data: Buffer): Promise<string> {
        const filename = this.getCacheFilename(email);
        const localPath = path.join(this.cacheDir, filename);

        // 写入文件
        await fs.promises.writeFile(localPath, data);
        Logger.info(`Avatar cached for ${email} at ${localPath}`);

        // 保存缓存元数据到WorkspaceState
        const cacheEntry: AvatarCacheEntry = {
            email,
            localPath,
            lastFetched: Date.now()
        };
        
        const cacheMap = this.context.workspaceState.get<Record<string, AvatarCacheEntry>>('avatarCache', {});
        cacheMap[email] = cacheEntry;
        await this.context.workspaceState.update('avatarCache', cacheMap);

        return localPath;
    }

    /**
     * 获取缓存的头像
     * @param email 用户邮箱
     * @returns 缓存条目,如果不存在则返回null
     */
    private async getCachedAvatar(email: string): Promise<AvatarCacheEntry | null> {
        const cacheMap = this.context.workspaceState.get<Record<string, AvatarCacheEntry>>('avatarCache', {});
        const entry = cacheMap[email];
        
        if (!entry) {
            return null;
        }

        // 检查文件是否存在
        try {
            await fs.promises.access(entry.localPath);
            return entry;
        } catch {
            // 文件不存在,清除缓存条目
            delete cacheMap[email];
            await this.context.workspaceState.update('avatarCache', cacheMap);
            return null;
        }
    }

    /**
     * 检查缓存是否过期
     * @param entry 缓存条目
     * @returns 如果已过期返回true,否则返回false
     */
    private isCacheExpired(entry: AvatarCacheEntry): boolean {
        return Date.now() - entry.lastFetched > this.CACHE_EXPIRY_MS;
    }

    /**
     * 获取缓存文件名
     * @param email 用户邮箱
     * @returns 文件名
     */
    private getCacheFilename(email: string): string {
        const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
        return `${hash}.png`;
    }

    /**
     * 确保缓存目录存在
     */
    private ensureCacheDir(): void {
        try {
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, { recursive: true });
                Logger.info(`Avatar cache directory created: ${this.cacheDir}`);
            }
        } catch (error) {
            Logger.error('Failed to create avatar cache directory', error as Error);
        }
    }

    /**
     * 清理过期的缓存
     */
    async cleanupExpiredCache(): Promise<void> {
        try {
            const cacheMap = this.context.workspaceState.get<Record<string, AvatarCacheEntry>>('avatarCache', {});
            const emailsToRemove: string[] = [];

            for (const [email, entry] of Object.entries(cacheMap)) {
                if (this.isCacheExpired(entry)) {
                    // 删除文件
                    try {
                        await fs.promises.unlink(entry.localPath);
                        Logger.info(`Expired avatar cache removed: ${entry.localPath}`);
                    } catch {
                        // 文件可能已被删除
                    }
                    emailsToRemove.push(email);
                }
            }

            // 更新缓存映射
            if (emailsToRemove.length > 0) {
                for (const email of emailsToRemove) {
                    delete cacheMap[email];
                }
                await this.context.workspaceState.update('avatarCache', cacheMap);
                Logger.info(`Cleaned up ${emailsToRemove.length} expired avatar caches`);
            }
        } catch (error) {
            Logger.error('Failed to cleanup expired avatar cache', error as Error);
        }
    }
}
