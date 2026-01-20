import * as vscode from 'vscode';

/**
 * 日志工具类
 * 提供统一的日志记录功能
 */
export class Logger {
    private static outputChannel: vscode.OutputChannel | null = null;
    private static logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

    /**
     * 初始化日志输出通道
     */
    static initialize(channelName: string = 'Cursor Assistant'): void {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel(channelName);
        }
    }

    /**
     * 设置日志级别
     */
    static setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
        this.logLevel = level;
    }

    /**
     * 记录调试信息
     */
    static debug(message: string, ...args: any[]): void {
        if (this.shouldLog('debug')) {
            this.log('DEBUG', message, ...args);
        }
    }

    /**
     * 记录信息
     */
    static info(message: string, ...args: any[]): void {
        if (this.shouldLog('info')) {
            this.log('INFO', message, ...args);
        }
    }

    /**
     * 记录警告
     */
    static warn(message: string, ...args: any[]): void {
        if (this.shouldLog('warn')) {
            this.log('WARN', message, ...args);
        }
    }

    /**
     * 记录错误
     */
    static error(message: string, error?: Error, ...args: any[]): void {
        if (this.shouldLog('error')) {
            this.log('ERROR', message, ...args);
            if (error) {
                this.log('ERROR', `Error stack: ${error.stack}`);
            }
        }
    }

    /**
     * 显示输出通道
     */
    static show(): void {
        if (this.outputChannel) {
            this.outputChannel.show();
        }
    }

    /**
     * 隐藏输出通道
     */
    static hide(): void {
        if (this.outputChannel) {
            this.outputChannel.hide();
        }
    }

    /**
     * 清理资源
     */
    static dispose(): void {
        if (this.outputChannel) {
            this.outputChannel.dispose();
            this.outputChannel = null;
        }
    }

    /**
     * 内部日志记录方法
     */
    private static log(level: string, message: string, ...args: any[]): void {
        if (!this.outputChannel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] [${level}] ${message}`;
        
        if (args.length > 0) {
            this.outputChannel.appendLine(`${formattedMessage} ${JSON.stringify(args, null, 2)}`);
        } else {
            this.outputChannel.appendLine(formattedMessage);
        }
    }

    /**
     * 检查是否应该记录该级别的日志
     */
    private static shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }
}

