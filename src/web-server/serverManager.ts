/**
 * Web 服务器管理器
 * 管理 Express 服务器的启动/停止
 */
import * as vscode from 'vscode';
import * as http from 'http';
import { exec } from 'child_process';
import { Logger } from '../utils/logger';
import { LocalShareService } from '../services/localShareService';
import { createApp } from './app';

export class WebServerManager {
    private server: http.Server | null = null;
    private running: boolean = false;
    private shareService: LocalShareService;

    constructor(shareService: LocalShareService) {
        this.shareService = shareService;
    }

    getPort(): number {
        const config = vscode.workspace.getConfiguration('cursorSessionHelper');
        return config.get<number>('serverPort', 8080);
    }

    isRunning(): boolean {
        return this.running;
    }

    /**
     * 杀掉占用指定端口的进程（跨平台）
     */
    private async killProcessOnPort(port: number): Promise<void> {
        return new Promise((resolve) => {
            const isWindows = process.platform === 'win32';
            if (isWindows) {
                // Windows: 通过 netstat 找到 PID，再 taskkill
                exec(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`, (err, stdout) => {
                    if (err || !stdout.trim()) {
                        resolve();
                        return;
                    }
                    // 提取 PID（行尾的数字）
                    const lines = stdout.trim().split('\n');
                    const pids = new Set<string>();
                    for (const line of lines) {
                        const parts = line.trim().split(/\s+/);
                        const pid = parts[parts.length - 1];
                        if (pid && /^\d+$/.test(pid) && pid !== '0') {
                            pids.add(pid);
                        }
                    }
                    if (pids.size === 0) {
                        resolve();
                        return;
                    }
                    let killed = 0;
                    for (const pid of pids) {
                        exec(`taskkill /PID ${pid} /F`, (killErr) => {
                            if (!killErr) {
                                Logger.info(`Killed process PID ${pid} on port ${port}`);
                            }
                            killed++;
                            if (killed === pids.size) {
                                // 等待端口释放
                                setTimeout(() => resolve(), 500);
                            }
                        });
                    }
                });
            } else {
                // macOS / Linux: lsof + kill
                exec(`lsof -ti:${port}`, (err, stdout) => {
                    if (err || !stdout.trim()) {
                        resolve();
                        return;
                    }
                    const pids = stdout.trim().split('\n').filter(p => p.trim());
                    if (pids.length === 0) {
                        resolve();
                        return;
                    }
                    exec(`kill -9 ${pids.join(' ')}`, (killErr) => {
                        if (!killErr) {
                            Logger.info(`Killed process(es) ${pids.join(', ')} on port ${port}`);
                        }
                        setTimeout(() => resolve(), 500);
                    });
                });
            }
        });
    }

    async start(): Promise<void> {
        if (this.running) {
            Logger.info('Server is already running');
            return;
        }

        const port = this.getPort();
        const app = createApp(this.shareService);

        return new Promise((resolve, reject) => {
            this.server = app.listen(port, '127.0.0.1', () => {
                this.running = true;
                Logger.info(`Web server started on http://localhost:${port}`);
                resolve();
            });

            this.server.on('error', (error: any) => {
                if (error.code === 'EADDRINUSE') {
                    Logger.error(`Port ${port} is already in use`);
                    vscode.window.showErrorMessage(`端口 ${port} 已被占用，请在设置中更改端口`);
                } else {
                    Logger.error('Server error', error);
                }
                reject(error);
            });
        });
    }

    /**
     * 强制启动：先杀掉占用端口的进程，再启动服务器
     */
    async forceStart(): Promise<void> {
        const port = this.getPort();
        Logger.info(`Force starting: killing any process on port ${port}...`);
        await this.killProcessOnPort(port);
        await this.start();
    }

    async stop(): Promise<void> {
        if (!this.running || !this.server) {
            Logger.info('Server is not running');
            return;
        }

        return new Promise((resolve) => {
            this.server!.close(() => {
                this.running = false;
                this.server = null;
                Logger.info('Web server stopped');
                resolve();
            });
        });
    }
}
