#!/usr/bin/env node

/**
 * Cursor 工作空间诊断扫描脚本
 * 
 * 用途：在有问题的电脑上运行，快速收集工作空间路径信息
 * 运行方式：node scan-workspaces.js
 * 
 * 会生成诊断报告文件：workspace-diagnostic-report.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ANSI 颜色代码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

/**
 * 获取 Cursor 用户数据目录
 */
function getCursorUserDataDir() {
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
 * 检查文件是否存在
 */
function fileExists(filePath) {
    try {
        fs.accessSync(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * 获取文件大小（字节）
 */
function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch {
        return 0;
    }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 读取并解析 workspace.json
 */
function readWorkspaceJson(workspaceJsonPath) {
    try {
        const content = fs.readFileSync(workspaceJsonPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        return null;
    }
}

/**
 * 解析文件 URL
 */
function decodeFileUrl(fileUrl) {
    try {
        // 检查是否是远程路径
        if (fileUrl.startsWith('vscode-remote://')) {
            const match = fileUrl.match(/^vscode-remote:\/\/[^/]+(.+)$/);
            if (match && match[1]) {
                return decodeURIComponent(match[1]);
            }
            return fileUrl;
        }

        // 处理 file:// 本地路径
        let decoded = fileUrl.replace(/^file:\/\/+/, '');
        decoded = decodeURIComponent(decoded);
        
        // 平台特定的路径处理
        if (process.platform === 'win32') {
            if (decoded.match(/^\/?[a-zA-Z]:\//)) {
                decoded = decoded.replace(/^\/+/, '').replace(/\//g, '\\');
            } else if (decoded.match(/^\/[a-zA-Z]:/)) {
                decoded = decoded.substring(1).replace(/\//g, '\\');
            }
        } else {
            if (!decoded.startsWith('/')) {
                decoded = '/' + decoded;
            }
        }
        
        return path.normalize(decoded);
    } catch (error) {
        return fileUrl;
    }
}

/**
 * 扫描工作空间
 */
function scanWorkspaces() {
    const userDataDir = getCursorUserDataDir();
    const workspaceStorageDir = path.join(userDataDir, 'workspaceStorage');

    console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}Cursor 工作空间诊断扫描工具${colors.reset}`);
    console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}\n`);

    // 1. 平台信息
    console.log(`${colors.bright}1. 系统信息:${colors.reset}`);
    console.log(`   操作系统: ${colors.green}${process.platform}${colors.reset} (${os.type()} ${os.release()})`);
    console.log(`   架构: ${os.arch()}`);
    console.log(`   用户主目录: ${os.homedir()}`);
    console.log(`   Cursor 用户数据目录: ${colors.cyan}${userDataDir}${colors.reset}`);
    console.log(`   工作空间存储目录: ${colors.cyan}${workspaceStorageDir}${colors.reset}\n`);

    // 检查目录是否存在
    if (!fileExists(workspaceStorageDir)) {
        console.log(`${colors.red}✗ 工作空间存储目录不存在！${colors.reset}`);
        console.log(`${colors.yellow}  可能原因：Cursor 尚未运行过，或者安装有问题${colors.reset}\n`);
        return null;
    }

    // 2. 扫描工作空间
    console.log(`${colors.bright}2. 扫描工作空间:${colors.reset}`);
    
    const entries = fs.readdirSync(workspaceStorageDir, { withFileTypes: true });
    const workspaces = [];
    let workspaceCount = 0;
    let validCount = 0;

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        workspaceCount++;
        const workspaceId = entry.name;
        const workspaceDir = path.join(workspaceStorageDir, workspaceId);
        const workspaceJsonPath = path.join(workspaceDir, 'workspace.json');
        const dbPath = path.join(workspaceDir, 'state.vscdb');
        const walPath = path.join(workspaceDir, 'state.vscdb-wal');
        const shmPath = path.join(workspaceDir, 'state.vscdb-shm');

        // 读取 workspace.json
        const workspaceInfo = readWorkspaceJson(workspaceJsonPath);
        
        if (!workspaceInfo) {
            console.log(`\n${colors.gray}   工作空间 ${workspaceId}: ${colors.yellow}无效（无法读取 workspace.json）${colors.reset}`);
            continue;
        }

        validCount++;

        const workspacePathInJson = workspaceInfo.workspace || workspaceInfo.folder;
        const decodedPath = workspacePathInJson ? decodeFileUrl(workspacePathInJson) : '(未知)';
        const isRemote = workspacePathInJson && workspacePathInJson.startsWith('vscode-remote://');
        const dbExists = fileExists(dbPath);
        const dbSize = getFileSize(dbPath);

        // 输出工作空间信息
        console.log(`\n${colors.bright}   工作空间 ${colors.cyan}${workspaceId}${colors.reset}:`);
        console.log(`   ├─ 类型: ${workspaceInfo.folder ? '单根工作空间' : '多根工作空间'} ${isRemote ? colors.yellow + '(远程)' + colors.reset : ''}`);
        console.log(`   ├─ 原始路径: ${colors.gray}${workspacePathInJson || '(无)'}${colors.reset}`);
        console.log(`   ├─ 解析后路径: ${colors.cyan}${decodedPath}${colors.reset}`);
        console.log(`   ├─ 数据库文件: ${dbExists ? colors.green + '✓ 存在' : colors.red + '✗ 不存在'}${colors.reset}`);
        if (dbExists) {
            console.log(`   │  └─ 大小: ${formatSize(dbSize)}`);
            console.log(`   │  └─ WAL 文件: ${fileExists(walPath) ? '✓' : '✗'}`);
            console.log(`   │  └─ SHM 文件: ${fileExists(shmPath) ? '✓' : '✗'}`);
        }

        // 保存到结果数组
        workspaces.push({
            id: workspaceId,
            type: workspaceInfo.folder ? 'folder' : 'workspace',
            isRemote: isRemote,
            originalPath: workspacePathInJson || null,
            decodedPath: decodedPath,
            database: {
                exists: dbExists,
                path: dbPath,
                size: dbSize,
                hasWal: fileExists(walPath),
                hasShm: fileExists(shmPath)
            },
            workspaceJson: workspaceInfo
        });
    }

    console.log(`\n${colors.bright}3. 统计信息:${colors.reset}`);
    console.log(`   总工作空间目录数: ${workspaceCount}`);
    console.log(`   有效工作空间数: ${colors.green}${validCount}${colors.reset}`);
    console.log(`   有数据库的工作空间: ${colors.green}${workspaces.filter(ws => ws.database.exists).length}${colors.reset}`);
    console.log(`   远程工作空间: ${colors.yellow}${workspaces.filter(ws => ws.isRemote).length}${colors.reset}`);

    // 4. 全局数据库
    console.log(`\n${colors.bright}4. 全局数据库:${colors.reset}`);
    const globalDbPath = path.join(userDataDir, 'globalStorage', 'state.vscdb');
    const globalDbExists = fileExists(globalDbPath);
    console.log(`   路径: ${globalDbPath}`);
    console.log(`   状态: ${globalDbExists ? colors.green + '✓ 存在' : colors.red + '✗ 不存在'}${colors.reset}`);
    if (globalDbExists) {
        console.log(`   大小: ${formatSize(getFileSize(globalDbPath))}`);
    }

    return {
        platform: process.platform,
        osType: os.type(),
        osRelease: os.release(),
        arch: os.arch(),
        homeDir: os.homedir(),
        cursorUserDataDir: userDataDir,
        workspaceStorageDir: workspaceStorageDir,
        totalWorkspaces: workspaceCount,
        validWorkspaces: validCount,
        globalDatabase: {
            path: globalDbPath,
            exists: globalDbExists,
            size: globalDbExists ? getFileSize(globalDbPath) : 0
        },
        workspaces: workspaces,
        scanTime: new Date().toISOString()
    };
}

/**
 * 主函数
 */
function main() {
    try {
        const result = scanWorkspaces();
        
        if (!result) {
            process.exit(1);
        }

        // 生成诊断报告
        const reportPath = path.join(process.cwd(), 'workspace-diagnostic-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf-8');

        console.log(`\n${colors.bright}${'='.repeat(80)}${colors.reset}`);
        console.log(`${colors.green}✓ 诊断完成${colors.reset}`);
        console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}\n`);
        console.log(`${colors.cyan}诊断报告已保存到: ${reportPath}${colors.reset}`);
        console.log(`${colors.gray}你可以将这个 JSON 文件发送给开发者进行分析${colors.reset}\n`);

        // 5. 建议
        console.log(`${colors.bright}5. 诊断建议:${colors.reset}`);
        
        if (result.validWorkspaces === 0) {
            console.log(`   ${colors.yellow}⚠ 未找到任何有效的工作空间${colors.reset}`);
            console.log(`   ${colors.gray}建议：在 Cursor 中打开一个项目，使用 Composer 进行对话${colors.reset}`);
        } else if (result.workspaces.filter(ws => ws.database.exists).length === 0) {
            console.log(`   ${colors.yellow}⚠ 所有工作空间都没有数据库文件${colors.reset}`);
            console.log(`   ${colors.gray}建议：在 Cursor 中使用 Composer 进行对话，生成数据库${colors.reset}`);
        } else {
            console.log(`   ${colors.green}✓ 找到了有效的工作空间和数据库${colors.reset}`);
            
            const remoteWorkspaces = result.workspaces.filter(ws => ws.isRemote);
            if (remoteWorkspaces.length > 0) {
                console.log(`\n   ${colors.yellow}远程工作空间说明：${colors.reset}`);
                remoteWorkspaces.forEach(ws => {
                    console.log(`   - ID: ${ws.id}`);
                    console.log(`     原始: ${ws.originalPath}`);
                    console.log(`     解析: ${ws.decodedPath}`);
                });
                console.log(`   ${colors.gray}提示：远程工作空间需要使用路径后缀匹配${colors.reset}`);
            }
        }

        console.log();

    } catch (error) {
        console.error(`${colors.red}✗ 扫描失败: ${error.message}${colors.reset}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// 运行主函数
main();
