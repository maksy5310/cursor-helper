import * as vscode from 'vscode';
import { Logger } from './logger';
import { CursorDataLocator } from './cursorDataLocator';

/**
 * 工作空间文件夹信息
 */
export interface WorkspaceFolder {
    name: string;
    uri: vscode.Uri;
    path: string;
}

/**
 * 工作空间类型信息
 */
export interface WorkspaceType {
    type: 'single-root' | 'multi-root';
    workspaceFile: string | null;  // .code-workspace文件路径，多根时存在
    folders: WorkspaceFolder[];
}

/**
 * 工作空间完整信息
 * 包含类型、文件夹列表和数据库路径
 */
export interface WorkspaceInfo {
    type: 'single-root' | 'multi-root';
    workspaceFile: string | null;
    folders: WorkspaceFolder[];
    workspaceId: string | null;
    databasePath: string | null;
}

/**
 * 工作区辅助工具类
 * 提供获取工作区信息的便捷方法
 */
export class WorkspaceHelper {
    // 缓存工作空间类型检测结果
    private static workspaceTypeCache: WorkspaceType | null = null;
    private static workspaceTypeCacheKey: string | null = null;

    // 缓存工作空间数据库路径
    private static workspaceDatabasePathCache: string | null = null;
    private static workspaceDatabasePathCacheKey: string | null = null;

    /**
     * 清除所有缓存
     */
    static clearCache(): void {
        WorkspaceHelper.workspaceTypeCache = null;
        WorkspaceHelper.workspaceTypeCacheKey = null;
        WorkspaceHelper.workspaceDatabasePathCache = null;
        WorkspaceHelper.workspaceDatabasePathCacheKey = null;
        Logger.debug('WorkspaceHelper cache cleared');
    }

    /**
     * 获取缓存键（基于工作空间文件或第一个文件夹路径）
     */
    private static getCacheKey(): string | null {
        try {
            const workspaceFile = vscode.workspace.workspaceFile;
            if (workspaceFile) {
                return `workspace-${workspaceFile.fsPath}`;
            }
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                return `workspace-${workspaceFolders[0].uri.fsPath}`;
            }
            return null;
        } catch (error) {
            Logger.error('Failed to get cache key', error as Error);
            return null;
        }
    }

    /**
     * 获取当前工作区名称
     * @returns 工作区名称，如果没有工作区则返回null
     */
    static getCurrentWorkspaceName(): string | null {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            if (!workspaceFolders || workspaceFolders.length === 0) {
                Logger.debug('No workspace folder found');
                return null;
            }
            
            // 使用第一个工作区文件夹的名称
            const workspaceName = workspaceFolders[0].name;
            Logger.debug(`Current workspace name: ${workspaceName}`);
            
            return workspaceName;
        } catch (error) {
            Logger.error('Failed to get workspace name', error as Error);
            return null;
        }
    }
    
    /**
     * 获取当前工作区完整路径
     * @returns 工作区路径，如果没有工作区则返回null
     */
    static getCurrentWorkspacePath(): string | null {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return null;
            }
            
            return workspaceFolders[0].uri.fsPath;
        } catch (error) {
            Logger.error('Failed to get workspace path', error as Error);
            return null;
        }
    }
    
    /**
     * 获取所有工作区文件夹名称
     * @returns 工作区名称数组，如果没有工作区则返回空数组
     */
    static getAllWorkspaceNames(): string[] {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return [];
            }
            
            return workspaceFolders.map(folder => folder.name);
        } catch (error) {
            Logger.error('Failed to get workspace names', error as Error);
            return [];
        }
    }

    /**
     * 快速检查当前是否为多根工作空间
     * @returns true表示多根工作空间，false表示单根工作空间或未打开工作空间
     */
    static isMultiRootWorkspace(): boolean {
        try {
            const workspaceFile = vscode.workspace.workspaceFile;
            return workspaceFile !== undefined;
        } catch (error) {
            Logger.error('Failed to check multi-root workspace', error as Error);
            return false;
        }
    }

    /**
     * 检测当前工作空间的类型
     * @returns 工作空间类型信息，如果未打开工作空间则返回null
     */
    static detectWorkspaceType(): WorkspaceType | null {
        try {
            // 检查缓存
            const cacheKey = WorkspaceHelper.getCacheKey();
            if (cacheKey && 
                WorkspaceHelper.workspaceTypeCache && 
                WorkspaceHelper.workspaceTypeCacheKey === cacheKey) {
                Logger.debug('Using cached workspace type');
                return WorkspaceHelper.workspaceTypeCache;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                Logger.debug('No workspace folder found');
                return null;
            }

            const workspaceFile = vscode.workspace.workspaceFile;
            const isMultiRoot = workspaceFile !== undefined;

            // 构建文件夹列表
            const folders: WorkspaceFolder[] = workspaceFolders.map(folder => ({
                name: folder.name,
                uri: folder.uri,
                path: folder.uri.fsPath
            }));

            const workspaceType: WorkspaceType = {
                type: isMultiRoot ? 'multi-root' : 'single-root',
                workspaceFile: workspaceFile ? workspaceFile.fsPath : null,
                folders: folders
            };

            // 更新缓存
            if (cacheKey) {
                WorkspaceHelper.workspaceTypeCache = workspaceType;
                WorkspaceHelper.workspaceTypeCacheKey = cacheKey;
            }

            Logger.debug(`Workspace type detected: ${workspaceType.type}, folders: ${folders.length}`);
            return workspaceType;
        } catch (error) {
            Logger.error('Failed to detect workspace type', error as Error);
            return null;
        }
    }

    /**
     * 获取完整的工作空间信息，包括类型和数据库路径
     * @returns 工作空间信息，如果未打开工作空间则返回null
     */
    static async getWorkspaceInfo(): Promise<WorkspaceInfo | null> {
        try {
            // 先获取工作空间类型
            const workspaceType = WorkspaceHelper.detectWorkspaceType();
            if (!workspaceType) {
                return null;
            }

            // 检查数据库路径缓存
            const cacheKey = WorkspaceHelper.getCacheKey();
            let databasePath: string | null = null;

            if (cacheKey && 
                WorkspaceHelper.workspaceDatabasePathCache && 
                WorkspaceHelper.workspaceDatabasePathCacheKey === cacheKey) {
                Logger.debug('Using cached database path');
                databasePath = WorkspaceHelper.workspaceDatabasePathCache;
            } else {
                // 匹配工作空间数据库路径
                let workspacePath: string | undefined;
                
                if (workspaceType.type === 'multi-root' && workspaceType.workspaceFile) {
                    // 多根工作空间：使用工作空间文件路径
                    workspacePath = workspaceType.workspaceFile;
                } else if (workspaceType.folders.length > 0) {
                    // 单根工作空间：使用第一个文件夹路径
                    workspacePath = workspaceType.folders[0].path;
                }

                if (workspacePath) {
                    databasePath = await CursorDataLocator.getWorkspaceDatabasePath(undefined, workspacePath);
                    
                    // 更新缓存
                    if (cacheKey) {
                        WorkspaceHelper.workspaceDatabasePathCache = databasePath;
                        WorkspaceHelper.workspaceDatabasePathCacheKey = cacheKey;
                    }
                }
            }

            const workspaceInfo: WorkspaceInfo = {
                type: workspaceType.type,
                workspaceFile: workspaceType.workspaceFile,
                folders: workspaceType.folders,
                workspaceId: null, // workspaceId 可以通过数据库路径解析，但当前不需要
                databasePath: databasePath
            };

            if (databasePath) {
                Logger.info(`Workspace database found: ${databasePath}`);
            } else {
                Logger.debug('Workspace database not found (this may be normal for new workspaces)');
            }

            return workspaceInfo;
        } catch (error) {
            Logger.error('Failed to get workspace info', error as Error);
            return null;
        }
    }
}
