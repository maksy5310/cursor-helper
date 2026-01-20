import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import { CursorDataLocator } from './cursorDataLocator';

/**
 * 数据库监听器接口
 */
export interface IDatabaseWatcher {
    /**
     * 启动监听
     */
    start(): Promise<void>;

    /**
     * 停止监听
     */
    stop(): void;

    /**
     * 注册变化回调
     */
    onDidChange(callback: () => void): void;
}

/**
 * 数据库监听器实现
 * 监听数据库日志文件（state.vscdb-wal）的变化
 * 使用 fs.watch + 定时检查 + 防抖机制
 */
export class DatabaseWatcher implements IDatabaseWatcher {
    private watcher: fs.FSWatcher | null = null;
    private periodicCheckTimer: NodeJS.Timeout | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;
    private changeCallbacks: Array<() => void> = [];
    private walFilePath: string | null = null;
    private isWatching: boolean = false;

    // 配置参数
    private readonly PERIODIC_CHECK_INTERVAL = 30000; // 30 秒
    private readonly DEBOUNCE_DELAY = 500; // 500 毫秒

    /**
     * 启动监听
     */
    async start(): Promise<void> {
        if (this.isWatching) {
            return;
        }

        try {
            // 获取工作空间数据库路径
            const workspaceDbPath = await CursorDataLocator.getWorkspaceDatabasePath();
            if (!workspaceDbPath) {
                Logger.warn('Workspace database not found, database watcher will use periodic check only');
                this.startPeriodicCheck();
                this.isWatching = true;
                return;
            }

            // 构建 WAL 文件路径
            this.walFilePath = workspaceDbPath.replace(/\.vscdb$/, '.vscdb-wal');

            // 尝试启动文件监听
            try {
                await this.startFileWatch();
                Logger.info('Database file watcher started successfully');
            } catch (error) {
                Logger.warn('Failed to start file watcher, falling back to periodic check only', error as Error);
                // 回退到仅使用定时检查
            }

            // 启动定时检查（作为补充或回退机制）
            this.startPeriodicCheck();

            this.isWatching = true;
            Logger.info('Database watcher started');
        } catch (error) {
            Logger.error('Failed to start database watcher', error as Error);
            // 即使失败也启动定时检查作为回退
            this.startPeriodicCheck();
            this.isWatching = true;
        }
    }

    /**
     * 启动文件监听
     */
    private async startFileWatch(): Promise<void> {
        if (!this.walFilePath) {
            throw new Error('WAL file path not set');
        }

        // 检查文件是否存在
        try {
            await fs.promises.access(this.walFilePath);
        } catch {
            // 文件不存在，但可以监听目录，文件创建时也会触发
            const dirPath = path.dirname(this.walFilePath);
            this.watcher = fs.watch(dirPath, (eventType, filename) => {
                if (filename === path.basename(this.walFilePath!)) {
                    this.handleFileChange();
                }
            });
            Logger.info(`Watching directory for WAL file: ${dirPath}`);
            return;
        }

        // 文件存在，直接监听文件
        this.watcher = fs.watch(this.walFilePath, (eventType) => {
            if (eventType === 'change') {
                this.handleFileChange();
            }
        });
        Logger.info(`Watching WAL file: ${this.walFilePath}`);
    }

    /**
     * 启动定时检查
     */
    private startPeriodicCheck(): void {
        if (this.periodicCheckTimer) {
            clearInterval(this.periodicCheckTimer);
        }

        this.periodicCheckTimer = setInterval(() => {
            // 定时检查时静默触发，不记录日志（除非真正检测到变化）
            this.handleFileChange();
        }, this.PERIODIC_CHECK_INTERVAL);

        Logger.info(`Periodic check started (interval: ${this.PERIODIC_CHECK_INTERVAL}ms)`);
    }

    /**
     * 处理文件变化（带防抖）
     */
    private handleFileChange(): void {
        // 清除之前的防抖定时器
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // 设置新的防抖定时器
        this.debounceTimer = setTimeout(() => {
            this.notifyChange();
        }, this.DEBOUNCE_DELAY);
    }

    /**
     * 通知变化
     */
    private notifyChange(): void {
        // 只在有回调函数时记录日志，避免定时检查时的噪音
        if (this.changeCallbacks.length > 0) {
            Logger.debug('Database change detected, notifying callbacks');
        }
        for (const callback of this.changeCallbacks) {
            try {
                callback();
            } catch (error) {
                Logger.error('Error in database change callback', error as Error);
            }
        }
    }

    /**
     * 注册变化回调
     */
    onDidChange(callback: () => void): void {
        this.changeCallbacks.push(callback);
    }

    /**
     * 停止监听
     */
    stop(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }

        if (this.periodicCheckTimer) {
            clearInterval(this.periodicCheckTimer);
            this.periodicCheckTimer = null;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        this.changeCallbacks = [];
        this.isWatching = false;
        Logger.info('Database watcher stopped');
    }
}

