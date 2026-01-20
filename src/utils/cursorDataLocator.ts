import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { Logger } from './logger';

/**
 * Cursor 数据定位器
 * 用于查找 Cursor 存储 AI 使用数据和聊天记录的位置
 */
export class CursorDataLocator {
    /**
     * 获取 Cursor 用户数据目录
     */
    static getCursorUserDataDir(): string {
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

    /**
     * 获取全局数据库文件路径
     */
    static getGlobalDatabasePath(): string {
        const userDataDir = this.getCursorUserDataDir();
        return path.join(userDataDir, 'globalStorage', 'state.vscdb');
    }

    /**
     * 读取并解析 workspace.json 文件
     * @param workspaceJsonPath workspace.json 文件路径
     * @returns 解析后的 workspace.json 内容，如果文件不存在或解析失败则返回 null
     * 注意：对于多根工作空间，可能使用 "workspace" 字段；对于单根工作空间，使用 "folder" 字段
     */
    private static async readWorkspaceJson(workspaceJsonPath: string): Promise<{ folder?: string; workspace?: string } | null> {
        try {
            const content = await fs.readFile(workspaceJsonPath, 'utf-8');
            const workspaceInfo = JSON.parse(content) as { folder?: string; workspace?: string };
            
            // 优先使用 workspace 字段（多根工作空间），如果没有则使用 folder 字段（单根工作空间）
            if (workspaceInfo.workspace || workspaceInfo.folder) {
                return {
                    folder: workspaceInfo.folder,
                    workspace: workspaceInfo.workspace
                };
            }
            return null;
        } catch (error) {
            Logger.debug(`Failed to read workspace.json at ${workspaceJsonPath}: ${error}`);
            return null;
        }
    }

    /**
     * 将 file:// URL 路径转换为本地文件系统路径
     * @param fileUrl file:// URL 格式的路径（如 "file:///f%3A/cursor-ws/p1sc-smartcontroller"）
     * @returns 本地文件系统路径
     */
    private static decodeFileUrl(fileUrl: string): string {
        try {
            // 移除 file:// 或 file:/// 前缀
            let decoded = fileUrl.replace(/^file:\/\/+/, '');
            // URL 解码
            decoded = decodeURIComponent(decoded);
            // 在 Windows 上，处理路径格式
            if (process.platform === 'win32') {
                // 如果路径是 /f:/... 或 f:/... 格式，需要转换为 f:\...
                if (decoded.match(/^\/?[a-zA-Z]:\//)) {
                    decoded = decoded.replace(/^\/+/, '').replace(/\//g, '\\');
                } else if (decoded.match(/^\/[a-zA-Z]:/)) {
                    // 处理 /f: 格式
                    decoded = decoded.substring(1).replace(/\//g, '\\');
                }
            }
            return path.normalize(decoded);
        } catch (error) {
            Logger.debug(`Failed to decode file URL ${fileUrl}: ${error}`);
            return fileUrl;
        }
    }

    /**
     * 获取工作空间数据库文件路径
     * @param workspaceId 工作空间 ID，如果未提供则尝试根据当前工作空间路径匹配
     * @param workspacePath 当前工作空间路径（可选），用于匹配正确的数据库
     */
    static async getWorkspaceDatabasePath(workspaceId?: string, workspacePath?: string): Promise<string | null> {
        const userDataDir = this.getCursorUserDataDir();
        const workspaceStorageDir = path.join(userDataDir, 'workspaceStorage');

        if (workspaceId) {
            const dbPath = path.join(workspaceStorageDir, workspaceId, 'state.vscdb');
            try {
                await fs.access(dbPath);
                Logger.debug(`Found workspace database with provided ID: ${workspaceId}`);
                return dbPath;
            } catch {
                Logger.debug(`Workspace database not found for ID: ${workspaceId}`);
                return null;
            }
        }

        // 如果提供了工作空间路径，通过读取 workspace.json 文件来匹配
        if (workspacePath) {
            const normalizedWorkspacePath = path.normalize(workspacePath);
            Logger.debug(`Searching for workspace database matching path: ${normalizedWorkspacePath}`);
            
            try {
                const entries = await fs.readdir(workspaceStorageDir, { withFileTypes: true });
                Logger.debug(`Found ${entries.length} workspace storage directories to check`);
                
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const workspaceJsonPath = path.join(workspaceStorageDir, entry.name, 'workspace.json');
                        const workspaceInfo = await this.readWorkspaceJson(workspaceJsonPath);
                        
                        if (workspaceInfo) {
                            // 对于多根工作空间，使用 workspace 字段；对于单根工作空间，使用 folder 字段
                            const workspacePathInJson = workspaceInfo.workspace || workspaceInfo.folder;
                            
                            if (workspacePathInJson) {
                                const decodedPath = this.decodeFileUrl(workspacePathInJson);
                                const normalizedPath = path.normalize(decodedPath);
                                
                                Logger.debug(`Checking workspace ${entry.name}: stored=${normalizedPath}, current=${normalizedWorkspacePath}`);
                                
                                // 使用大小写不敏感的比较（Windows）
                                const pathMatches = process.platform === 'win32' 
                                    ? normalizedPath.toLowerCase() === normalizedWorkspacePath.toLowerCase()
                                    : normalizedPath === normalizedWorkspacePath;
                                
                                if (pathMatches) {
                                    const dbPath = path.join(workspaceStorageDir, entry.name, 'state.vscdb');
                                    try {
                                        await fs.access(dbPath);
                                        Logger.info(`Found matching workspace database: ${entry.name} (path: ${normalizedWorkspacePath})`);
                                        return dbPath;
                                    } catch {
                                        Logger.debug(`Workspace database file not found for matched workspace: ${entry.name}`);
                                        continue;
                                    }
                                }
                            }
                        }
                    }
                }
                
                Logger.warn(`No matching workspace database found for path: ${normalizedWorkspacePath}`);
            } catch (error) {
                Logger.debug(`Failed to search workspace databases: ${error}`);
            }
        }

        // 如果没有提供 workspacePath 或匹配失败，尝试查找所有工作空间数据库
        // 返回第一个找到的数据库（向后兼容，但记录警告）
        try {
            const entries = await fs.readdir(workspaceStorageDir, { withFileTypes: true });
            Logger.debug(`Found ${entries.length} workspace storage directories`);
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const dbPath = path.join(workspaceStorageDir, entry.name, 'state.vscdb');
                    try {
                        await fs.access(dbPath);
                        if (!workspacePath) {
                            Logger.warn(`No workspace path provided, using first found database: ${entry.name}`);
                        } else {
                            Logger.warn(`Workspace path matching failed, using first found database: ${entry.name}`);
                        }
                        return dbPath;
                    } catch {
                        continue;
                    }
                }
            }
        } catch (error) {
            Logger.debug(`Failed to find workspace database: ${error}`);
        }

        return null;
    }

    /**
     * 获取所有工作空间数据库文件路径
     */
    static async findAllWorkspaceDatabasePaths(): Promise<string[]> {
        const userDataDir = this.getCursorUserDataDir();
        const workspaceStorageDir = path.join(userDataDir, 'workspaceStorage');
        const dbPaths: string[] = [];

        try {
            const entries = await fs.readdir(workspaceStorageDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const dbPath = path.join(workspaceStorageDir, entry.name, 'state.vscdb');
                    try {
                        await fs.access(dbPath);
                        dbPaths.push(dbPath);
                    } catch {
                        continue;
                    }
                }
            }
        } catch (error) {
            Logger.debug(`Failed to find workspace databases: ${error}`);
        }

        return dbPaths;
    }

    /**
     * 获取可能的数据库文件路径（保留向后兼容）
     */
    static async findDatabaseFiles(): Promise<string[]> {
        const possiblePaths: string[] = [];

        // 添加全局数据库
        const globalDbPath = this.getGlobalDatabasePath();
        try {
            await fs.access(globalDbPath);
            possiblePaths.push(globalDbPath);
        } catch {
            // 全局数据库可能不存在
        }

        // 添加所有工作空间数据库
        const workspaceDbPaths = await this.findAllWorkspaceDatabasePaths();
        possiblePaths.push(...workspaceDbPaths);

        return possiblePaths;
    }

    /**
     * 获取可能的聊天记录文件路径
     */
    static async findChatRecordFiles(): Promise<string[]> {
        const userDataDir = this.getCursorUserDataDir();
        const possiblePaths: string[] = [];

        const searchPaths = [
            path.join(userDataDir, 'globalStorage'),
            path.join(userDataDir, 'workspaceStorage'),
            path.join(userDataDir, 'History'),
        ];

        Logger.info(`Searching for chat record files in: ${userDataDir}`);

        for (const searchPath of searchPaths) {
            try {
                // 查找 JSON 文件，可能包含聊天记录
                const files = await this.findFilesRecursive(searchPath, ['.json']);
                possiblePaths.push(...files);
            } catch (error) {
                Logger.debug(`Directory not found: ${searchPath}`);
            }
        }

        return possiblePaths;
    }

    /**
     * 递归查找文件
     */
    private static async findFilesRecursive(dirPath: string, extensions: string[]): Promise<string[]> {
        const files: string[] = [];

        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    // 递归搜索子目录（限制深度）
                    if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                        const subFiles = await this.findFilesRecursive(fullPath, extensions);
                        files.push(...subFiles);
                    }
                } else if (entry.isFile()) {
                    // 检查文件扩展名
                    const ext = path.extname(entry.name).toLowerCase();
                    if (extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // 忽略权限错误等
        }

        return files;
    }

    /**
     * 扫描并列出所有可能的数据文件
     */
    static async scanCursorDataFiles(): Promise<{
        databases: string[];
        jsonFiles: string[];
        userDataDir: string;
    }> {
        const userDataDir = this.getCursorUserDataDir();
        Logger.info(`Scanning Cursor data files in: ${userDataDir}`);

        const databases = await this.findDatabaseFiles();
        const jsonFiles = await this.findChatRecordFiles();

        Logger.info(`Found ${databases.length} database files and ${jsonFiles.length} JSON files`);

        return {
            databases,
            jsonFiles,
            userDataDir
        };
    }

    /**
     * 检查文件是否可能是 Cursor 的数据文件
     */
    static async inspectFile(filePath: string): Promise<{
        size: number;
        modified: Date;
        preview: string;
        type: 'database' | 'json' | 'unknown';
    }> {
        try {
            const stats = await fs.stat(filePath);
            const ext = path.extname(filePath).toLowerCase();
            
            let preview = '';
            let type: 'database' | 'json' | 'unknown' = 'unknown';

            if (ext === '.json') {
                type = 'json';
                const content = await fs.readFile(filePath, 'utf-8');
                preview = content.substring(0, 200);
            } else if (['.db', '.sqlite', '.sqlite3'].includes(ext)) {
                type = 'database';
                preview = 'SQLite database file';
            }

            return {
                size: stats.size,
                modified: stats.mtime,
                preview,
                type
            };
        } catch (error) {
            throw new Error(`Failed to inspect file: ${filePath}`);
        }
    }
}

