import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { UsageStatistics } from '../models/usageStats';
import { AgentRecord } from '../models/agentRecord';

/**
 * SQLite 数据库访问实现
 * 直接访问 Cursor 的 state.vscdb 数据库文件
 * 使用 sql.js（纯 JavaScript SQLite 实现，无需原生模块）
 */
export class SQLiteAccess {
    private db: SqlJsDatabase | null = null;
    private dbPath: string;
    private SQL: any = null;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    /**
     * 初始化 SQL.js 并连接数据库
     */
    async connect(): Promise<void> {
        if (this.db) {
            return;
        }

        try {
            // 初始化 SQL.js
            if (!this.SQL) {
                this.SQL = await initSqlJs({
                    // 可选：如果需要加载 wasm 文件，可以指定路径
                    // locateFile: (file: string) => `https://sql.js.org/dist/${file}`
                });
            }

            // 读取数据库文件到内存
            const fileBuffer = fs.readFileSync(this.dbPath);
            this.db = new this.SQL.Database(fileBuffer);

            Logger.info(`Connected to SQLite database: ${this.dbPath}`);
            
            // 测试连接
            const tables = this.getTableNames();
            Logger.info(`Database contains ${tables.length} tables: ${tables.join(', ')}`);
        } catch (error) {
            Logger.error('Failed to connect to SQLite database', error as Error);
            throw error;
        }
    }

    /**
     * 获取所有表名
     */
    getTableNames(): string[] {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const result = this.db.exec(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);

        if (result.length === 0) {
            return [];
        }

        return result[0].values.map((row: any[]) => row[0] as string);
    }

    /**
     * 获取表结构
     */
    getTableSchema(tableName: string): Array<{ name: string; type: string; notnull: number; dflt_value: any; pk: number }> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const result = this.db.exec(`PRAGMA table_info(${tableName})`);
        
        if (result.length === 0) {
            return [];
        }

        const columns = result[0].columns;
        const values = result[0].values;

        return values.map((row: any[]) => {
            const obj: any = {};
            columns.forEach((col: string, idx: number) => {
                obj[col] = row[idx];
            });
            return {
                name: obj.name,
                type: obj.type,
                notnull: obj.notnull,
                dflt_value: obj.dflt_value,
                pk: obj.pk
            };
        });
    }

    /**
     * 获取表的行数
     */
    getTableRowCount(tableName: string): number {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const result = this.db.exec(`SELECT COUNT(*) as count FROM ${tableName}`);
        
        if (result.length === 0) {
            return 0;
        }

        const values = result[0].values;
        return values.length > 0 ? (values[0][0] as number) : 0;
    }

    /**
     * 查询表数据（带限制）
     */
    queryTable(tableName: string, limit: number = 10): any[] {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const result = this.db.exec(`SELECT * FROM ${tableName} LIMIT ${limit}`);
        
        if (result.length === 0) {
            return [];
        }

        const columns = result[0].columns;
        const values = result[0].values;

        return values.map((row: any[]) => {
            const obj: any = {};
            columns.forEach((col: string, idx: number) => {
                obj[col] = row[idx];
            });
            return obj;
        });
    }

    /**
     * 执行自定义 SQL 查询
     */
    query(sql: string, params?: any[]): any[] {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        // sql.js 不支持参数化查询，需要手动替换参数
        let finalSql = sql;
        if (params && params.length > 0) {
            params.forEach((param, index) => {
                const value = typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : param;
                finalSql = finalSql.replace('?', value.toString());
            });
        }

        const result = this.db.exec(finalSql);
        
        if (result.length === 0) {
            return [];
        }

        const columns = result[0].columns;
        const values = result[0].values;

        return values.map((row: any[]) => {
            const obj: any = {};
            columns.forEach((col: string, idx: number) => {
                obj[col] = row[idx];
            });
            return obj;
        });
    }

    /**
     * 分析数据库结构
     */
    analyzeDatabase(): {
        tables: Array<{
            name: string;
            schema: Array<{ name: string; type: string; notnull: number; dflt_value: any; pk: number }>;
            rowCount: number;
            sampleData: any[];
        }>;
    } {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const tables = this.getTableNames();
        const analysis = {
            tables: tables.map(tableName => ({
                name: tableName,
                schema: this.getTableSchema(tableName),
                rowCount: this.getTableRowCount(tableName),
                sampleData: this.queryTable(tableName, 5)
            }))
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
            const result = this.query(
                "SELECT value FROM ItemTable WHERE key = 'composer.composerData' LIMIT 1"
            );

            Logger.debug(`Query returned ${result.length} rows`);
            
            if (result.length === 0) {
                Logger.warn('composer.composerData not found in ItemTable');
                // 尝试列出所有可用的 key 以便调试
                try {
                    const allKeys = this.query("SELECT key FROM ItemTable LIMIT 20");
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
            const result = this.query(
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
            const result = this.query(
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
            this.db.close();
            this.db = null;
            Logger.info('SQLite database connection closed');
        }
    }
}
