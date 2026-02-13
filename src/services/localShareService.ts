import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 分享记录元数据
 */
export interface ShareMetadata {
    uuid: string;
    title: string;
    projectName: string;
    sharer: string;
    shareTime: string;
    createTime: string;
    contentFormat: string;
    description?: string;
}

/**
 * 分享记录（完整）
 */
export interface ShareRecord {
    metadata: ShareMetadata;
    content: string;
}

/**
 * 获取默认分享目录
 */
function getDefaultShareDir(): string {
    return path.join(os.homedir(), '.cursor-session-helper', 'shares');
}

/**
 * 尝试从 vscode 配置中读取分享目录（仅在 vscode 环境下可用）
 */
function tryGetVscodeShareDir(): string {
    try {
        // 动态 require，独立运行时不会崩溃
        const vscode = require('vscode');
        const config = vscode.workspace.getConfiguration('cursorSessionHelper');
        const customDir: string = config.get('shareDirectory', '') || '';
        if (customDir && customDir.trim().length > 0) {
            return customDir;
        }
    } catch {
        // 不在 vscode 环境中，忽略
    }
    return '';
}

/**
 * 简易日志（不依赖 vscode Logger）
 */
function log(level: string, msg: string, _error?: Error): void {
    try {
        const { Logger } = require('../utils/logger');
        if (level === 'info') { Logger.info(msg); }
        else if (level === 'warn') { Logger.warn(msg, _error); }
        else if (level === 'error') { Logger.error(msg, _error); }
    } catch {
        // fallback: console
        if (level === 'error') { console.error(msg, _error?.message || ''); }
        else if (level === 'warn') { console.warn(msg); }
    }
}

/**
 * 本地分享服务
 * 负责将会话保存为 Markdown 文件到本地可配置目录
 * 
 * 支持两种运行环境：
 *   1. VS Code 扩展内（自动从 vscode 配置读取目录）
 *   2. 独立 Node.js 进程（通过构造函数或环境变量指定目录）
 */
export class LocalShareService {
    private overrideDir: string | undefined;

    /**
     * @param shareDir 可选的分享目录覆盖。独立运行时可通过此参数指定。
     */
    constructor(shareDir?: string) {
        this.overrideDir = shareDir;
    }

    /**
     * 获取分享存储目录
     */
    getShareDirectory(): string {
        // 1. 构造函数传入的目录（最高优先级）
        if (this.overrideDir && this.overrideDir.trim().length > 0) {
            return this.overrideDir;
        }

        // 2. 环境变量
        const envDir = process.env.CURSOR_SESSION_HELPER_SHARE_DIR;
        if (envDir && envDir.trim().length > 0) {
            return envDir;
        }

        // 3. vscode 配置（仅在扩展内可用）
        const vscodeDir = tryGetVscodeShareDir();
        if (vscodeDir) {
            return vscodeDir;
        }

        // 4. 默认目录
        return getDefaultShareDir();
    }

    /**
     * 保存分享记录
     */
    async saveShare(record: ShareRecord): Promise<string> {
        const shareDir = this.getShareDirectory();
        
        // 按日期分目录: 2026-02/uuid.md
        const now = new Date(record.metadata.shareTime);
        const dateDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const targetDir = path.join(shareDir, dateDir);

        // 确保目录存在
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 构建文件内容：YAML front matter + Markdown content
        const frontMatter = [
            '---',
            `uuid: "${record.metadata.uuid}"`,
            `title: "${record.metadata.title.replace(/"/g, '\\"')}"`,
            `projectName: "${record.metadata.projectName.replace(/"/g, '\\"')}"`,
            `sharer: "${record.metadata.sharer.replace(/"/g, '\\"')}"`,
            `shareTime: "${record.metadata.shareTime}"`,
            `createTime: "${record.metadata.createTime}"`,
            `contentFormat: "${record.metadata.contentFormat}"`,
            record.metadata.description ? `description: "${record.metadata.description.replace(/"/g, '\\"')}"` : '',
            '---',
            '',
        ].filter(Boolean).join('\n');

        const fileContent = frontMatter + record.content;
        const filePath = path.join(targetDir, `${record.metadata.uuid}.md`);

        fs.writeFileSync(filePath, fileContent, 'utf-8');
        log('info', `Share saved: ${filePath}`);

        return filePath;
    }

    /**
     * 导入分享文件
     * @param uuid 使用的 UUID
     * @param content 完整的文件内容（包含 YAML 头部）
     * @param metadata 解析出的元数据
     */
    importShare(uuid: string, content: string, metadata: { shareTime: string }): string {
        const shareDir = this.getShareDirectory();
        
        // 按原始分享时间的日期分目录
        const shareDate = new Date(metadata.shareTime);
        const dateDir = `${shareDate.getFullYear()}-${String(shareDate.getMonth() + 1).padStart(2, '0')}`;
        const targetDir = path.join(shareDir, dateDir);

        // 确保目录存在
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.join(targetDir, `${uuid}.md`);
        
        // 如果文件已存在，检查是否覆盖
        if (fs.existsSync(filePath)) {
            log('warn', `Import: File already exists, overwriting: ${filePath}`);
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        log('info', `Share imported: ${filePath}`);

        return filePath;
    }

    /**
     * 获取所有分享记录（元数据列表）
     */
    getAllShares(): ShareMetadata[] {
        const shareDir = this.getShareDirectory();
        const shares: ShareMetadata[] = [];

        if (!fs.existsSync(shareDir)) {
            return shares;
        }

        // 遍历日期目录
        const dateDirs = fs.readdirSync(shareDir).filter(d => {
            return fs.statSync(path.join(shareDir, d)).isDirectory();
        });

        for (const dateDir of dateDirs) {
            const dirPath = path.join(shareDir, dateDir);
            const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

            for (const file of files) {
                try {
                    const filePath = path.join(dirPath, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const metadata = this.parseMetadata(content);
                    if (metadata) {
                        shares.push(metadata);
                    }
                } catch (error) {
                    log('warn', `Failed to read share file: ${file}`, error as Error);
                }
            }
        }

        // 按分享时间倒序排列
        shares.sort((a, b) => new Date(b.shareTime).getTime() - new Date(a.shareTime).getTime());

        return shares;
    }

    /**
     * 根据 UUID 获取完整分享记录
     */
    getShareByUuid(uuid: string): ShareRecord | null {
        const shareDir = this.getShareDirectory();

        if (!fs.existsSync(shareDir)) {
            return null;
        }

        // 遍历查找
        const dateDirs = fs.readdirSync(shareDir).filter(d => {
            return fs.statSync(path.join(shareDir, d)).isDirectory();
        });

        for (const dateDir of dateDirs) {
            const filePath = path.join(shareDir, dateDir, `${uuid}.md`);
            if (fs.existsSync(filePath)) {
                try {
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    const metadata = this.parseMetadata(fileContent);
                    if (metadata) {
                        const content = this.extractContent(fileContent);
                        return { metadata, content };
                    }
                } catch (error) {
                    log('error', `Failed to read share: ${uuid}`, error as Error);
                }
            }
        }

        return null;
    }

    /**
     * 搜索分享记录
     */
    searchShares(keyword: string): ShareMetadata[] {
        const allShares = this.getAllShares();
        const lowerKeyword = keyword.toLowerCase();

        return allShares.filter(share => {
            return share.title.toLowerCase().includes(lowerKeyword) ||
                   share.projectName.toLowerCase().includes(lowerKeyword) ||
                   share.sharer.toLowerCase().includes(lowerKeyword) ||
                   (share.description && share.description.toLowerCase().includes(lowerKeyword));
        });
    }

    /**
     * 删除分享记录
     * @param uuid 分享记录的 UUID
     * @returns 删除结果
     */
    deleteShare(uuid: string): { success: boolean; message?: string } {
        const shareDir = this.getShareDirectory();

        if (!fs.existsSync(shareDir)) {
            return { success: false, message: '分享目录不存在' };
        }

        // 遍历查找并删除
        const dateDirs = fs.readdirSync(shareDir).filter(d => {
            return fs.statSync(path.join(shareDir, d)).isDirectory();
        });

        for (const dateDir of dateDirs) {
            const filePath = path.join(shareDir, dateDir, `${uuid}.md`);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    log('info', `Deleted share: ${uuid}`);
                    return { success: true };
                } catch (error) {
                    log('error', `Failed to delete share: ${uuid}`, error as Error);
                    return { success: false, message: '删除文件失败' };
                }
            }
        }

        return { success: false, message: '会话不存在' };
    }

    /**
     * 解析 YAML front matter 获取元数据
     */
    private parseMetadata(fileContent: string): ShareMetadata | null {
        const frontMatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);
        if (!frontMatterMatch) {
            return null;
        }

        const frontMatter = frontMatterMatch[1];
        const getValue = (key: string): string => {
            const match = frontMatter.match(new RegExp(`^${key}:\\s*"(.*)"`, 'm'));
            return match ? match[1].replace(/\\"/g, '"') : '';
        };

        const uuid = getValue('uuid');
        if (!uuid) {
            return null;
        }

        return {
            uuid,
            title: getValue('title'),
            projectName: getValue('projectName'),
            sharer: getValue('sharer'),
            shareTime: getValue('shareTime'),
            createTime: getValue('createTime'),
            contentFormat: getValue('contentFormat'),
            description: getValue('description') || undefined
        };
    }

    /**
     * 提取 front matter 之后的内容
     */
    private extractContent(fileContent: string): string {
        const match = fileContent.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
        return match ? match[1] : fileContent;
    }
}
