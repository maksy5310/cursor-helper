import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../utils/logger';

/**
 * 扫描所有工作空间命令
 * 集成独立诊断脚本的功能到插件中
 */
export async function scanWorkspacesCommand(context: vscode.ExtensionContext): Promise<void> {
    try {
        Logger.info('='.repeat(80));
        Logger.info('Cursor 工作空间诊断扫描');
        Logger.info('='.repeat(80));

        // 获取用户数据目录
        const userDataDir = getCursorUserDataDir();
        const workspaceStorageDir = path.join(userDataDir, 'workspaceStorage');

        // 1. 系统信息
        Logger.info('\n1. 系统信息:');
        Logger.info(`   操作系统: ${process.platform} (${os.type()} ${os.release()})`);
        Logger.info(`   架构: ${os.arch()}`);
        Logger.info(`   用户主目录: ${os.homedir()}`);
        Logger.info(`   Cursor 用户数据目录: ${userDataDir}`);
        Logger.info(`   工作空间存储目录: ${workspaceStorageDir}`);

        // 检查目录是否存在
        try {
            await fs.access(workspaceStorageDir);
        } catch {
            Logger.error('工作空间存储目录不存在！');
            Logger.warn('可能原因：Cursor 尚未运行过，或者安装有问题');
            vscode.window.showErrorMessage('工作空间存储目录不存在，请先在 Cursor 中打开项目');
            return;
        }

        // 2. 扫描工作空间
        Logger.info('\n2. 扫描工作空间:');
        const entries = await fs.readdir(workspaceStorageDir, { withFileTypes: true });
        const workspaces = [];
        let workspaceCount = 0;
        let validCount = 0;

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            workspaceCount++;
            const workspaceId = entry.name;
            const workspaceDir = path.join(workspaceStorageDir, workspaceId);
            const workspaceJsonPath = path.join(workspaceDir, 'workspace.json');
            const dbPath = path.join(workspaceDir, 'state.vscdb');

            const workspaceInfo = await readWorkspaceJson(workspaceJsonPath);
            if (!workspaceInfo) {
                Logger.debug(`工作空间 ${workspaceId}: 无效（无法读取 workspace.json）`);
                continue;
            }

            validCount++;
            const workspacePathInJson = workspaceInfo.workspace || workspaceInfo.folder;
            const decodedPath = workspacePathInJson ? decodeFileUrl(workspacePathInJson) : '(未知)';
            const isRemote = workspacePathInJson && workspacePathInJson.startsWith('vscode-remote://');
            const dbExists = await fileExists(dbPath);
            const dbSize = dbExists ? (await fs.stat(dbPath)).size : 0;

            Logger.info(`\n   工作空间 ${workspaceId}:`);
            Logger.info(`   ├─ 类型: ${workspaceInfo.folder ? '单根工作空间' : '多根工作空间'}${isRemote ? ' (远程)' : ''}`);
            Logger.info(`   ├─ 原始路径: ${workspacePathInJson || '(无)'}`);
            Logger.info(`   ├─ 解析后路径: ${decodedPath}`);
            Logger.info(`   └─ 数据库: ${dbExists ? '✓ 存在 (' + formatSize(dbSize) + ')' : '✗ 不存在'}`);

            workspaces.push({
                id: workspaceId,
                type: workspaceInfo.folder ? 'folder' : 'workspace',
                isRemote,
                originalPath: workspacePathInJson || null,
                decodedPath,
                database: { exists: dbExists, path: dbPath, size: dbSize }
            });
        }

        // 3. 统计信息
        Logger.info(`\n3. 统计信息:`);
        Logger.info(`   总工作空间目录数: ${workspaceCount}`);
        Logger.info(`   有效工作空间数: ${validCount}`);
        Logger.info(`   有数据库的工作空间: ${workspaces.filter(ws => ws.database.exists).length}`);
        Logger.info(`   远程工作空间: ${workspaces.filter(ws => ws.isRemote).length}`);

        // 4. 全局数据库
        Logger.info(`\n4. 全局数据库:`);
        const globalDbPath = path.join(userDataDir, 'globalStorage', 'state.vscdb');
        const globalDbExists = await fileExists(globalDbPath);
        Logger.info(`   路径: ${globalDbPath}`);
        Logger.info(`   状态: ${globalDbExists ? '✓ 存在' : '✗ 不存在'}`);
        if (globalDbExists) {
            const globalDbSize = (await fs.stat(globalDbPath)).size;
            Logger.info(`   大小: ${formatSize(globalDbSize)}`);
        }

        // 5. 生成报告
        const report = {
            platform: process.platform,
            osType: os.type(),
            osRelease: os.release(),
            arch: os.arch(),
            homeDir: os.homedir(),
            cursorUserDataDir: userDataDir,
            workspaceStorageDir,
            totalWorkspaces: workspaceCount,
            validWorkspaces: validCount,
            globalDatabase: {
                path: globalDbPath,
                exists: globalDbExists,
                size: globalDbExists ? (await fs.stat(globalDbPath)).size : 0
            },
            workspaces,
            scanTime: new Date().toISOString()
        };

        // 保存报告
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        let reportPath: string;
        
        if (workspaceRoot) {
            reportPath = path.join(workspaceRoot, 'workspace-diagnostic-report.json');
        } else {
            reportPath = path.join(os.tmpdir(), 'cursor-workspace-diagnostic-report.json');
        }

        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

        Logger.info('\n' + '='.repeat(80));
        Logger.info('诊断完成');
        Logger.info('='.repeat(80));
        Logger.info(`\n诊断报告已保存到: ${reportPath}`);

        // 显示结果
        const hasIssues = validCount === 0 || workspaces.filter(ws => ws.database.exists).length === 0;
        const message = hasIssues
            ? '⚠ 发现问题，请查看输出日志了解详情'
            : `✓ 扫描完成！找到 ${validCount} 个工作空间`;

        const action = await vscode.window.showInformationMessage(
            message,
            '查看日志',
            '打开报告'
        );

        if (action === '查看日志') {
            Logger.show();
        } else if (action === '打开报告') {
            const doc = await vscode.workspace.openTextDocument(reportPath);
            await vscode.window.showTextDocument(doc);
        }

    } catch (error) {
        Logger.error('扫描过程中出错', error as Error);
        vscode.window.showErrorMessage(`扫描失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// 辅助函数
function getCursorUserDataDir(): string {
    const platform = process.platform;
    const homeDir = os.homedir();

    switch (platform) {
        case 'win32':
            return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Cursor', 'User');
        case 'darwin':
            return path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User');
        case 'linux':
            return path.join(homeDir, '.config', 'Cursor', 'User');
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function readWorkspaceJson(workspaceJsonPath: string): Promise<any> {
    try {
        const content = await fs.readFile(workspaceJsonPath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

function decodeFileUrl(fileUrl: string): string {
    try {
        if (fileUrl.startsWith('vscode-remote://')) {
            const match = fileUrl.match(/^vscode-remote:\/\/[^/]+(.+)$/);
            return match && match[1] ? decodeURIComponent(match[1]) : fileUrl;
        }

        let decoded = fileUrl.replace(/^file:\/\/+/, '');
        decoded = decodeURIComponent(decoded);
        
        if (process.platform === 'win32') {
            if (decoded.match(/^\/?[a-zA-Z]:\//)) {
                decoded = decoded.replace(/^\/+/, '').replace(/\//g, '\\');
            } else if (decoded.match(/^\/[a-zA-Z]:/)) {
                decoded = decoded.substring(1).replace(/\//g, '\\');
            }
        } else {
            if (!decoded.startsWith('/')) {
                decoded = '/' + decoded;
            }
        }
        
        return path.normalize(decoded);
    } catch {
        return fileUrl;
    }
}
