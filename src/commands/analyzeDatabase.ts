import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { SQLiteAccess } from '../dataAccess/sqliteAccess';
import { Logger } from '../utils/logger';

/**
 * 分析 Cursor 数据库命令
 * 分析 state.vscdb 数据库的结构和数据
 */
export async function analyzeDatabaseCommand(): Promise<void> {
    Logger.info('Starting database analysis...');

    try {
        // 获取数据库路径
        const platform = process.platform;
        const homeDir = os.homedir();
        let dbPath: string;

        switch (platform) {
            case 'win32':
                dbPath = path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Cursor', 'User', 'globalStorage', 'state.vscdb');
                break;
            case 'darwin':
                dbPath = path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
                break;
            case 'linux':
                dbPath = path.join(homeDir, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }

        Logger.info(`Database path: ${dbPath}`);

        // 显示进度
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing Cursor Database',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Connecting to database...' });

            const sqlite = new SQLiteAccess(dbPath);
            await sqlite.connect();

            progress.report({ increment: 50, message: 'Analyzing structure...' });
            const analysis = sqlite.analyzeDatabase();

            progress.report({ increment: 100, message: 'Complete' });

            // 创建输出文档
            const output = vscode.window.createOutputChannel('Cursor Database Analysis');
            output.show();
            output.appendLine('=== Cursor Database Analysis ===');
            output.appendLine(`Database: ${dbPath}`);
            output.appendLine('');

            for (const table of analysis.tables) {
                output.appendLine(`## Table: ${table.name}`);
                output.appendLine(`Row Count: ${table.rowCount}`);
                output.appendLine('');
                output.appendLine('### Schema:');
                output.appendLine('| Column | Type | Not Null | Default | Primary Key |');
                output.appendLine('|--------|------|----------|---------|-------------|');
                for (const col of table.schema) {
                    output.appendLine(`| ${col.name} | ${col.type} | ${col.notnull} | ${col.dflt_value || 'NULL'} | ${col.pk} |`);
                }
                output.appendLine('');
                
                if (table.sampleData.length > 0) {
                    output.appendLine('### Sample Data (first 5 rows):');
                    output.appendLine('```json');
                    output.appendLine(JSON.stringify(table.sampleData, null, 2));
                    output.appendLine('```');
                }
                output.appendLine('');
                output.appendLine('---');
                output.appendLine('');
            }

            sqlite.close();

            // 显示结果
            const message = `Database analysis complete. Found ${analysis.tables.length} tables. Check output panel for details.`;
            vscode.window.showInformationMessage(message);
        });

    } catch (error) {
        Logger.error('Failed to analyze database', error as Error);
        vscode.window.showErrorMessage(`Failed to analyze database: ${(error as Error).message}`);
    }
}

