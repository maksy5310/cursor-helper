import * as vscode from 'vscode';
import { CursorDataLocator } from '../utils/cursorDataLocator';
import { WorkspaceHelper } from '../utils/workspaceHelper';
import { Logger } from '../utils/logger';

/**
 * 诊断工作空间路径匹配命令
 * 用于调试Mac和远程开发环境下的路径定位问题
 */
export async function diagnoseWorkspaceCommand(): Promise<void> {
    try {
        Logger.info('='.repeat(80));
        Logger.info('工作空间路径诊断开始');
        Logger.info('='.repeat(80));

        // 1. 显示平台信息
        Logger.info('\n1. 平台信息:');
        Logger.info(`   操作系统: ${process.platform}`);
        Logger.info(`   用户数据目录: ${CursorDataLocator.getCursorUserDataDir()}`);

        // 2. 显示当前工作空间信息
        Logger.info('\n2. 当前工作空间信息:');
        const workspaceInfo = await WorkspaceHelper.getWorkspaceInfo();
        
        if (!workspaceInfo) {
            Logger.warn('   未检测到工作空间');
        } else {
            Logger.info(`   工作空间类型: ${workspaceInfo.type}`);
            Logger.info(`   工作空间文件: ${workspaceInfo.workspaceFile || '(单根工作空间)'}`);
            Logger.info(`   文件夹数量: ${workspaceInfo.folders.length}`);
            
            workspaceInfo.folders.forEach((folder, index) => {
                Logger.info(`   文件夹 ${index + 1}:`);
                Logger.info(`     名称: ${folder.name}`);
                Logger.info(`     路径: ${folder.path}`);
                Logger.info(`     URI: ${folder.uri.toString()}`);
            });
            
            if (workspaceInfo.databasePath) {
                Logger.info(`   ✓ 数据库路径: ${workspaceInfo.databasePath}`);
            } else {
                Logger.warn('   ✗ 未找到匹配的数据库');
            }
        }

        // 3. 获取所有工作空间信息
        Logger.info('\n3. 所有已存储的工作空间:');
        const allWorkspaces = await CursorDataLocator.getAllWorkspaceInfo();
        
        if (allWorkspaces.length === 0) {
            Logger.warn('   未找到任何已存储的工作空间');
        } else {
            Logger.info(`   共找到 ${allWorkspaces.length} 个工作空间:`);
            
            for (const ws of allWorkspaces) {
                Logger.info(`\n   工作空间 ID: ${ws.id}`);
                Logger.info(`     类型: ${ws.type}`);
                Logger.info(`     原始路径: ${ws.originalPath}`);
                Logger.info(`     解析后路径: ${ws.path}`);
                Logger.info(`     数据库: ${ws.dbPath}`);
                Logger.info(`     数据库存在: ${ws.dbExists ? '是' : '否'}`);
                
                // 检查是否与当前工作空间匹配
                if (workspaceInfo && workspaceInfo.folders.length > 0) {
                    const currentPath = workspaceInfo.type === 'multi-root' && workspaceInfo.workspaceFile
                        ? workspaceInfo.workspaceFile
                        : workspaceInfo.folders[0].path;
                    
                    if (ws.path === currentPath) {
                        Logger.info('     >>> 这是当前工作空间 <<<');
                    }
                }
            }
        }

        // 4. 显示所有数据库文件
        Logger.info('\n4. 所有数据库文件:');
        const allDbs = await CursorDataLocator.findAllWorkspaceDatabasePaths();
        
        if (allDbs.length === 0) {
            Logger.warn('   未找到任何数据库文件');
        } else {
            Logger.info(`   共找到 ${allDbs.length} 个数据库:`);
            allDbs.forEach((db, index) => {
                Logger.info(`   ${index + 1}. ${db}`);
            });
        }

        // 5. 总结
        Logger.info('\n5. 诊断总结:');
        
        if (workspaceInfo && workspaceInfo.databasePath) {
            Logger.info('   ✓ 工作空间路径匹配成功');
            Logger.info('   ✓ 已找到对应的数据库文件');
        } else if (workspaceInfo) {
            Logger.warn('   ✗ 工作空间已检测，但未找到匹配的数据库');
            Logger.warn('   可能原因:');
            Logger.warn('     1. 这是首次打开此工作空间，数据库尚未生成');
            Logger.warn('     2. 路径格式不匹配（Mac/远程开发）');
            Logger.warn('     3. 工作空间存储目录中没有对应的数据库文件');
            
            if (allWorkspaces.length > 0) {
                Logger.warn('\n   请比较当前工作空间路径与上面列出的已存储工作空间路径');
            }
        } else {
            Logger.warn('   ✗ 未检测到工作空间');
        }

        Logger.info('\n' + '='.repeat(80));
        Logger.info('诊断完成');
        Logger.info('='.repeat(80));

        // 显示结果对话框
        const message = workspaceInfo && workspaceInfo.databasePath
            ? '✓ 工作空间路径匹配成功！数据库已找到。'
            : '✗ 未找到匹配的工作空间数据库。请查看输出面板了解详情。';
        
        const action = await vscode.window.showInformationMessage(
            message,
            '查看输出',
            '查看文档'
        );

        if (action === '查看输出') {
            Logger.show();
        } else if (action === '查看文档') {
            // 构建文档路径
            const extension = vscode.extensions.getExtension('TS-SW2.cursor-session-helper');
            if (extension) {
                const docPath = vscode.Uri.file(
                    extension.extensionPath + '/docs/MAC_REMOTE_PATH_FIX.md'
                );
                await vscode.commands.executeCommand('markdown.showPreview', docPath);
            } else {
                vscode.window.showWarningMessage('无法找到扩展路径');
            }
        }

    } catch (error) {
        Logger.error('诊断过程中出错', error as Error);
        vscode.window.showErrorMessage(`诊断失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}
