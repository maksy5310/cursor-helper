/**
 * Express 应用
 * 提供本地 Web 分享服务
 */
import * as path from 'path';
import * as os from 'os';
import express from 'express';
import { LocalShareService, ShareMetadata } from '../services/localShareService';
import { renderHomePage } from './views/homePage';
import { renderSharePage } from './views/sharePage';
import { renderLayout } from './views/layout';

/**
 * 获取系统用户名（用于导入时的默认分享人）
 */
function getSystemUsername(): string {
    try {
        const userInfo = os.userInfo();
        if (userInfo.username && userInfo.username.trim().length > 0) {
            return userInfo.username;
        }
    } catch {
        // os.userInfo() 可能在某些环境下失败
    }
    return process.env.USERNAME || process.env.USER || process.env.LOGNAME || '本地用户';
}

// 从扩展根目录 package.json 读取版本，便于页脚显示以确认是否为新版
let APP_VERSION = '1.0.0';
try {
    const pkg = require(path.join(__dirname, '..', '..', 'package.json')) as { version?: string };
    if (pkg?.version) APP_VERSION = pkg.version;
} catch {
    // 忽略
}

export function createApp(shareService: LocalShareService): express.Application {
    const app = express();

    // 禁止缓存 HTML 页面，确保安装/更新扩展并重载后浏览器拿到最新页面
    app.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
    });

    // 增加请求体大小限制，支持导入大文件（默认 100KB 太小）
    app.use(express.json({ limit: '50mb' }));

    // 首页 - 会话列表总览
    app.get('/', (req, res) => {
        const keyword = (req.query.q as string) || '';
        let shares: ShareMetadata[];
        
        if (keyword) {
            shares = shareService.searchShares(keyword);
        } else {
            shares = shareService.getAllShares();
        }

        const content = renderHomePage(shares, keyword);
        const html = renderLayout('首页', content, APP_VERSION);
        res.send(html);
    });

    // API: 搜索分享记录
    app.get('/api/shares', (req, res) => {
        const keyword = (req.query.q as string) || '';
        let shares: ShareMetadata[];
        
        if (keyword) {
            shares = shareService.searchShares(keyword);
        } else {
            shares = shareService.getAllShares();
        }

        res.json({ shares, total: shares.length });
    });

    // API: 获取单个分享记录
    app.get('/api/shares/:uuid', (req, res) => {
        const record = shareService.getShareByUuid(req.params.uuid);
        if (!record) {
            res.status(404).json({ error: 'Share not found' });
            return;
        }
        res.json(record);
    });

    // API: 删除分享记录
    app.delete('/api/shares/:uuid', (req, res) => {
        const uuid = req.params.uuid;
        const result = shareService.deleteShare(uuid);
        if (result.success) {
            res.json({ success: true, message: '删除成功' });
        } else {
            res.status(404).json({ success: false, message: result.message || '删除失败' });
        }
    });

    // 分享详情页
    app.get('/share/:uuid', (req, res) => {
        const record = shareService.getShareByUuid(req.params.uuid);
        if (!record) {
            const html = renderLayout('未找到', '<div class="not-found"><h2>分享记录未找到</h2><p>该分享可能已被删除或链接无效。</p><a href="/">返回首页</a></div>', APP_VERSION);
            res.status(404).send(html);
            return;
        }

        // 获取所有分享的元数据列表（用于左侧导航）
        const allShares = shareService.getAllShares();
        const content = renderSharePage(record, allShares);
        const html = renderLayout(record.metadata.title, content, APP_VERSION);
        res.send(html);
    });

    // 下载 Markdown 文件（包含 YAML 头部，便于导入）
    app.get('/download/:uuid', (req, res) => {
        const record = shareService.getShareByUuid(req.params.uuid);
        if (!record) {
            res.status(404).send('Not found');
            return;
        }

        // 构建完整的文件内容（包含 YAML front matter）
        const meta = record.metadata;
        const frontMatterLines = [
            '---',
            `uuid: "${meta.uuid}"`,
            `title: "${meta.title.replace(/"/g, '\\"')}"`,
            `projectName: "${meta.projectName.replace(/"/g, '\\"')}"`,
            `sharer: "${meta.sharer.replace(/"/g, '\\"')}"`,
            `shareTime: "${meta.shareTime}"`,
            `createTime: "${meta.createTime}"`,
            `contentFormat: "${meta.contentFormat}"`,
        ];
        if (meta.description) {
            frontMatterLines.push(`description: "${meta.description.replace(/"/g, '\\"')}"`);
        }
        frontMatterLines.push('---');
        const frontMatter = frontMatterLines.join('\n') + '\n\n';

        const fullContent = frontMatter + record.content;
        const filename = `${meta.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_')}.md`;
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.send(fullContent);
    });

    // API: 导入会话文件
    app.post('/api/import', (req, res) => {
        const body = req.body as { files?: Array<{ name: string; content?: string; error?: string }> };
        
        if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
            res.json({ success: false, message: '没有接收到文件', imported: 0, errors: [] });
            return;
        }

        const errors: string[] = [];
        let imported = 0;

        for (const file of body.files) {
            if (file.error) {
                errors.push(`${file.name}: ${file.error}`);
                continue;
            }

            if (!file.content) {
                errors.push(`${file.name}: 文件内容为空`);
                continue;
            }

            // 验证文件格式
            const validation = validateShareMarkdown(file.content);
            if (!validation.valid) {
                errors.push(`${file.name}: ${validation.error}`);
                continue;
            }

            try {
                // 使用原始 UUID 或生成新的
                const uuid = validation.metadata!.uuid || generateUuid();
                
                // 检查文件是否有 YAML 头部，如果没有则添加
                let contentToSave = file.content;
                if (!file.content.trim().startsWith('---')) {
                    // 构建 YAML front matter
                    const meta = validation.metadata!;
                    const frontMatter = [
                        '---',
                        `uuid: "${uuid}"`,
                        `title: "${meta.title.replace(/"/g, '\\"')}"`,
                        `projectName: "${meta.projectName.replace(/"/g, '\\"')}"`,
                        `sharer: "${meta.sharer.replace(/"/g, '\\"')}"`,
                        `shareTime: "${meta.shareTime}"`,
                        `createTime: "${meta.createTime}"`,
                        `contentFormat: "${meta.contentFormat}"`,
                        '---',
                        '',
                    ].join('\n');
                    contentToSave = frontMatter + file.content;
                }
                
                // 保存文件
                shareService.importShare(uuid, contentToSave, validation.metadata!);
                imported++;
            } catch (err) {
                errors.push(`${file.name}: 保存失败 - ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        res.json({
            success: imported > 0 || errors.length === 0,
            imported,
            errors,
            message: imported > 0 ? `成功导入 ${imported} 个文件` : '导入失败'
        });
    });

    return app;
}

/**
 * 验证 Markdown 文件是否是有效的分享格式
 * 必须包含 YAML 头部，且包含必要字段：uuid, title, shareTime
 */
interface ValidationResult {
    valid: boolean;
    error?: string;
    metadata?: {
        uuid?: string;
        title: string;
        projectName: string;
        sharer: string;
        shareTime: string;
        createTime: string;
        contentFormat: string;
    };
}

function validateShareMarkdown(content: string): ValidationResult {
    // 尝试解析 YAML 头部
    const yamlMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    
    if (yamlMatch) {
        // 有 YAML 头部，从中提取元数据
        const yamlContent = yamlMatch[1];
        const metadata: Record<string, string> = {};
        for (const line of yamlContent.split(/\r?\n/)) {
            const match = line.match(/^(\w+):\s*"?([^"]*)"?$/);
            if (match) {
                metadata[match[1]] = match[2];
            }
        }

        // 验证必要字段
        const requiredFields = ['title', 'sharer', 'shareTime'];
        const missingFields = requiredFields.filter(f => !metadata[f]);
        
        if (missingFields.length > 0) {
            return { valid: false, error: `无效的文件格式：缺少必要字段 ${missingFields.join(', ')}` };
        }

        return {
            valid: true,
            metadata: {
                uuid: metadata.uuid || undefined,
                title: metadata.title,
                projectName: metadata.projectName || 'Unknown',
                sharer: metadata.sharer,
                shareTime: metadata.shareTime,
                createTime: metadata.createTime || metadata.shareTime,
                contentFormat: metadata.contentFormat || 'markdown'
            }
        };
    }

    // 没有 YAML 头部，尝试从内容中提取元数据
    // 格式：# uuid-格式 + 会话指标表格中的功能名称
    const uuidMatch = content.match(/^#\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    
    // 尝试从表格中提取 功能名称
    const titleMatch = content.match(/功能名称\s*\|\s*([^\n\|]+)/);
    
    if (!uuidMatch && !titleMatch) {
        return { valid: false, error: '无效的文件格式：无法从文件中提取会话标识或标题' };
    }

    const extractedUuid = uuidMatch ? uuidMatch[1] : undefined;
    const extractedTitle = titleMatch ? titleMatch[1].trim() : '导入的会话';

    return {
        valid: true,
        metadata: {
            uuid: extractedUuid,
            title: extractedTitle,
            projectName: 'Unknown',
            sharer: getSystemUsername(),
            shareTime: new Date().toISOString(),
            createTime: new Date().toISOString(),
            contentFormat: 'markdown'
        }
    };
}

function generateUuid(): string {
    // 简单的 UUID v4 生成
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
