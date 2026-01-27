/**
 * 工作空间路径匹配测试和诊断工具
 * 用于调试在Mac和远程开发环境下的路径定位问题
 */

import { CursorDataLocator } from '../src/utils/cursorDataLocator';
import { Logger } from '../src/utils/logger';

async function testWorkspacePathMatching() {
    console.log('='.repeat(80));
    console.log('Cursor 工作空间路径匹配诊断工具');
    console.log('='.repeat(80));
    console.log();

    // 1. 显示当前平台信息
    console.log('1. 平台信息:');
    console.log(`   操作系统: ${process.platform}`);
    console.log(`   用户数据目录: ${CursorDataLocator.getCursorUserDataDir()}`);
    console.log();

    // 2. 获取所有工作空间信息
    console.log('2. 所有工作空间信息:');
    const workspaces = await CursorDataLocator.getAllWorkspaceInfo();
    
    if (workspaces.length === 0) {
        console.log('   未找到任何工作空间');
    } else {
        for (const ws of workspaces) {
            console.log(`   ID: ${ws.id}`);
            console.log(`   类型: ${ws.type}`);
            console.log(`   原始路径: ${ws.originalPath}`);
            console.log(`   解析后路径: ${ws.path}`);
            console.log(`   数据库: ${ws.dbPath}`);
            console.log(`   数据库存在: ${ws.dbExists ? '是' : '否'}`);
            console.log();
        }
    }

    // 3. 测试路径匹配
    console.log('3. 路径匹配测试:');
    
    // 测试场景
    const testPaths = [
        // Windows 路径
        'F:\\spec-kit\\cursor-helper',
        'f:\\spec-kit\\cursor-helper',
        
        // Mac 路径
        '/Users/username/spec-kit/cursor-helper',
        
        // 远程路径
        '/home/user/spec-kit/cursor-helper'
    ];

    for (const testPath of testPaths) {
        console.log(`   测试路径: ${testPath}`);
        try {
            const dbPath = await CursorDataLocator.getWorkspaceDatabasePath(undefined, testPath);
            if (dbPath) {
                console.log(`   ✓ 找到匹配的数据库: ${dbPath}`);
            } else {
                console.log(`   ✗ 未找到匹配的数据库`);
            }
        } catch (error) {
            console.log(`   ✗ 错误: ${error}`);
        }
        console.log();
    }

    // 4. 显示所有数据库路径
    console.log('4. 所有数据库文件:');
    const allDbs = await CursorDataLocator.findAllWorkspaceDatabasePaths();
    if (allDbs.length === 0) {
        console.log('   未找到任何数据库文件');
    } else {
        allDbs.forEach((db, index) => {
            console.log(`   ${index + 1}. ${db}`);
        });
    }
    console.log();

    console.log('='.repeat(80));
    console.log('诊断完成');
    console.log('='.repeat(80));
}

// 运行测试
testWorkspacePathMatching().catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
});
