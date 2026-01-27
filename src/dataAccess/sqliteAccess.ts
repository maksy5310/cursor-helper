import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as module_ from 'module';
import { Logger } from '../utils/logger';
import { UsageStatistics } from '../models/usageStats';
import { AgentRecord } from '../models/agentRecord';

// 使用 Cursor/VS Code 自带的 @vscode/sqlite3
// 通过 createRequire 从 VS Code 的 node_modules 中加载
const appRoot = vscode.env.appRoot;
const vscodeNodeModules = path.join(appRoot, 'node_modules');
const createRequire = module_.createRequire || (module_ as any).createRequireFromPath;
const vscodeRequire = createRequire(vscodeNodeModules);
const sqlite3 = vscodeRequire('@vscode/sqlite3');

// 类型定义
interface Sqlite3Database {
    all(sql: string, params: any[], callback: (err: Error | null, rows?: any[]) => void): void;
    get(sql: string, params: any[], callback: (err: Error | null, row?: any) => void): void;
    run(sql: string, params: any[], callback: (err: Error | null) => void): void;
    close(callback?: (err: Error | null) => void): void;
}

interface Sqlite3Module {
    Database: {
        new (filename: string, mode: number, callback?: (err: Error | null) => void): Sqlite3Database;
    };
    OPEN_READONLY: number;
    OPEN_READWRITE: number;
    OPEN_CREATE: number;
}

const sqlite3Typed = sqlite3 as Sqlite3Module;

/**
 * SQLite 数据库访问实现
 * 直接访问 Cursor 的 state.vscdb 数据库文件
 * 使用 Cursor/VS Code 自带的 @vscode/sqlite3（原生 SQLite 绑定，支持大文件）
 */
export class SQLiteAccess {
    private db: Sqlite3Database | null = null;
    private dbPath: string;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    /**
     * 连接数据库
     */
    async connect(): Promise<void> {
        if (this.db) {
            return;
        }

        try {
            // 检查文件是否存在
            if (!fs.existsSync(this.dbPath)) {
                throw new Error(`Database file not found: ${this.dbPath}`);
            }

            // 获取文件大小（用于日志）
            const stats = fs.statSync(this.dbPath);
            const fileSizeInBytes = stats.size;
            const fileSizeInGB = fileSizeInBytes / (1024 * 1024 * 1024);

            // 打开数据库连接（只读模式）
            this.db = await new Promise<Sqlite3Database>((resolve, reject) => {
                const db = new sqlite3Typed.Database(this.dbPath, sqlite3Typed.OPEN_READONLY, (err: Error | null) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(db);
                    }
                });
            });

            Logger.info(`Connected to SQLite database: ${this.dbPath} (${fileSizeInGB.toFixed(2)} GB)`);
            
            // 测试连接
            const tables = await this.getTableNames();
            Logger.info(`Database contains ${tables.length} tables: ${tables.join(', ')}`);
        } catch (error) {
            Logger.error('Failed to connect to SQLite database', error as Error);
            throw error;
        }
    }

    /**
     * 执行查询并返回所有结果
     */
    private async queryAll(sql: string, params: any[] = []): Promise<any[]> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        return new Promise((resolve, reject) => {
            this.db!.all(sql, params, (err: Error | null, rows?: any[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * 执行查询并返回单行结果
     */
    private async queryGet(sql: string, params: any[] = []): Promise<any | undefined> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        return new Promise((resolve, reject) => {
            this.db!.get(sql, params, (err: Error | null, row?: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * 获取所有表名
     */
    async getTableNames(): Promise<string[]> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const rows = await this.queryAll(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);

        return rows.map((row: any) => row.name as string);
    }

    /**
     * 获取表结构
     */
    async getTableSchema(tableName: string): Promise<Array<{ name: string; type: string; notnull: number; dflt_value: any; pk: number }>> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        // 使用参数化查询防止 SQL 注入
        const rows = await this.queryAll(`PRAGMA table_info(${this.escapeTableName(tableName)})`);
        
        return rows.map((row: any) => ({
            name: row.name,
            type: row.type,
            notnull: row.notnull,
            dflt_value: row.dflt_value,
            pk: row.pk
        }));
    }

    /**
     * 转义表名（简单实现，仅用于 PRAGMA）
     */
    private escapeTableName(tableName: string): string {
        // 简单的表名验证和转义
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        return tableName;
    }

    /**
     * 获取表的行数
     */
    async getTableRowCount(tableName: string): Promise<number> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const row = await this.queryGet(`SELECT COUNT(*) as count FROM ${this.escapeTableName(tableName)}`);
        return row ? (row.count as number) : 0;
    }

    /**
     * 查询表数据（带限制）
     */
    async queryTable(tableName: string, limit: number = 10): Promise<any[]> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const rows = await this.queryAll(`SELECT * FROM ${this.escapeTableName(tableName)} LIMIT ?`, [limit]);
        return rows;
    }

    /**
     * 执行自定义 SQL 查询
     */
    async query(sql: string, params?: any[]): Promise<any[]> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        // @vscode/sqlite3 支持参数化查询
        const rows = await this.queryAll(sql, params || []);
        return rows;
    }

    /**
     * 分析数据库结构
     */
    async analyzeDatabase(): Promise<{
        tables: Array<{
            name: string;
            schema: Array<{ name: string; type: string; notnull: number; dflt_value: any; pk: number }>;
            rowCount: number;
            sampleData: any[];
        }>;
    }> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const tables = await this.getTableNames();
        const analysis = {
            tables: await Promise.all(tables.map(async (tableName) => ({
                name: tableName,
                schema: await this.getTableSchema(tableName),
                rowCount: await this.getTableRowCount(tableName),
                sampleData: await this.queryTable(tableName, 5)
            })))
        };

        return analysis;
    }

    /**
     * 从 ItemTable 表读取 composer.composerData
     * 仅适用于工作空间数据库
     */
    async getComposerList(): Promise<any> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        try {
            Logger.debug('Querying ItemTable for composer.composerData...');
            const result = await this.query(
                "SELECT value FROM ItemTable WHERE key = ? LIMIT 1",
                ['composer.composerData']
            );

            Logger.debug(`Query returned ${result.length} rows`);
            
            if (result.length === 0) {
                Logger.warn('composer.composerData not found in ItemTable');
                // 尝试列出所有可用的 key 以便调试
                try {
                    const allKeys = await this.query("SELECT key FROM ItemTable LIMIT 20");
                    Logger.debug(`Available keys in ItemTable (first 20): ${JSON.stringify(allKeys.map((r: any) => r.key))}`);
                } catch (e) {
                    Logger.debug('Could not list ItemTable keys for debugging');
                }
                return null;
            }

            const valueStr = result[0].value;
            Logger.debug(`Retrieved value type: ${typeof valueStr}, length: ${typeof valueStr === 'string' ? valueStr.length : 'N/A'}`);
            
            let parsedData: any;
            if (typeof valueStr === 'string') {
                try {
                    parsedData = JSON.parse(valueStr);
                    Logger.debug(`Parsed JSON successfully. Keys: ${Object.keys(parsedData).join(', ')}`);
                    if (parsedData.allComposers) {
                        // 记录前几个 composer 的详细信息
                        if (parsedData.allComposers.length > 0) {
                            const firstComposer = parsedData.allComposers[0];
                            Logger.debug(`First composer sample: ${JSON.stringify({
                                composerId: firstComposer.composerId,
                                name: firstComposer.name,
                                subtitle: firstComposer.subtitle,
                                unifiedMode: firstComposer.unifiedMode,
                                createdAt: firstComposer.createdAt,
                                lastUpdatedAt: firstComposer.lastUpdatedAt
                            }, null, 2)}`);
                        }
                    } else {
                        Logger.warn('Parsed data does not contain allComposers property');
                        Logger.debug(`Parsed data structure: ${JSON.stringify(Object.keys(parsedData))}`);
                    }
                } catch (parseError) {
                    Logger.error('Failed to parse JSON value', parseError as Error);
                    Logger.debug(`Value preview (first 500 chars): ${valueStr.substring(0, 500)}`);
                    throw parseError;
                }
            } else {
                parsedData = valueStr;
                Logger.debug('Value is not a string, using as-is');
            }

            return parsedData;
        } catch (error) {
            Logger.error('Failed to get composer list from ItemTable', error as Error);
            throw error;
        }
    }

    /**
     * 从 CursorDiskKV 表读取 composer 详情
     * 适用于全局数据库
     */
    async getComposerData(composerId: string): Promise<any> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        try {
            const key = `composerData:${composerId}`;
            const result = await this.query(
                "SELECT value FROM CursorDiskKV WHERE key = ? LIMIT 1",
                [key]
            );

            if (result.length === 0) {
                Logger.warn(`Composer data not found for ID: ${composerId}`);
                return null;
            }

            const valueStr = result[0].value;
            if (typeof valueStr === 'string') {
                return JSON.parse(valueStr);
            }

            return valueStr;
        } catch (error) {
            Logger.error(`Failed to get composer data for ID: ${composerId}`, error as Error);
            throw error;
        }
    }

    /**
     * 从 CursorDiskKV 表读取 bubble（消息）详情
     * 适用于全局数据库
     */
    async getBubbleData(composerId: string, bubbleId: string): Promise<any> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        try {
            const key = `bubbleId:${composerId}:${bubbleId}`;
            const result = await this.query(
                "SELECT value FROM CursorDiskKV WHERE key = ? LIMIT 1",
                [key]
            );

            if (result.length === 0) {
                Logger.warn(`Bubble data not found for ID: ${bubbleId}`);
                return null;
            }

            const valueStr = result[0].value;
            if (typeof valueStr === 'string') {
                return JSON.parse(valueStr);
            }

            return valueStr;
        } catch (error) {
            Logger.error(`Failed to get bubble data for ID: ${bubbleId}`, error as Error);
            throw error;
        }
    }

    /**
     * 批量获取多个 composer 的数据
     */
    async getMultipleComposerData(composerIds: string[]): Promise<Map<string, any>> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const result = new Map<string, any>();

        for (const composerId of composerIds) {
            try {
                const data = await this.getComposerData(composerId);
                if (data) {
                    result.set(composerId, data);
                }
            } catch (error) {
                Logger.warn(`Failed to get composer data for ${composerId}`, error as Error);
            }
        }

        return result;
    }

    /**
     * 批量获取多个 bubble 的数据
     */
    async getMultipleBubbleData(composerId: string, bubbleIds: string[]): Promise<Map<string, any>> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const result = new Map<string, any>();

        for (const bubbleId of bubbleIds) {
            try {
                const data = await this.getBubbleData(composerId, bubbleId);
                if (data) {
                    result.set(bubbleId, data);
                }
            } catch (error) {
                Logger.warn(`Failed to get bubble data for ${bubbleId}`, error as Error);
            }
        }

        return result;
    }

    /**
     * 获取使用统计数据
     * 从 composer 和 bubble 数据中提取统计信息
     */
    async getUsageStatistics(startTime?: Date, endTime?: Date): Promise<UsageStatistics[]> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        // 注意：此方法需要在全局数据库中调用
        // 需要先获取 composer 列表，然后获取每个 composer 的统计数据
        Logger.warn('getUsageStatistics - requires composer list from workspace database first');
        
        // TODO: 实现完整的统计逻辑
        // 1. 需要从工作空间数据库获取 composer 列表
        // 2. 从全局数据库获取每个 composer 的详情
        // 3. 提取统计信息（建议次数、采纳次数、代码行数等）
        
        return [];
    }

    /**
     * 获取 Agent 对话记录
     * 从 composer 和 bubble 数据构建完整的对话记录
     */
    async getAgentRecords(sessionId?: string): Promise<AgentRecord[]> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        // 注意：此方法需要在全局数据库中调用
        // 需要先获取 composer 列表，然后获取每个 composer 的完整对话记录
        Logger.warn('getAgentRecords - requires composer list from workspace database first');
        
        // TODO: 实现完整的记录构建逻辑
        // 1. 需要从工作空间数据库获取 composer 列表
        // 2. 从全局数据库获取每个 composer 的详情
        // 3. 获取所有相关的 bubble 数据
        // 4. 构建 AgentRecord 对象
        
        return [];
    }

    /**
     * 关闭数据库连接
     */
    close(): void {
        if (this.db) {
            this.db.close((err: Error | null) => {
                if (err) {
                    Logger.error('Error closing database', err);
                } else {
                    Logger.info('SQLite database connection closed');
                }
            });
            this.db = null;
        }
    }
}
