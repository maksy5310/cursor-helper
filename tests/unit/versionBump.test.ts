import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('Version Bump Script', () => {
    let tempDir: string;
    let packagePath: string;
    let scriptPath: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'version-test-'));
        packagePath = path.join(tempDir, 'package.json');
        
        // 创建测试 package.json
        fs.writeFileSync(packagePath, JSON.stringify({
            name: 'test-package',
            version: '1.0.0'
        }, null, 2));

        // 创建修改版的 version-bump 脚本（使用传入的目录）
        scriptPath = path.join(tempDir, 'version-bump.js');
        fs.writeFileSync(scriptPath, `
            const fs = require('fs');
            const path = require('path');
            const packagePath = path.join('${tempDir.replace(/\\/g, '\\\\')}', 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
            const parts = packageJson.version.split('.');
            const newVersion = parts[0] + '.' + parts[1] + '.' + (parseInt(parts[2]) + 1);
            packageJson.version = newVersion;
            fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\\n', 'utf-8');
            console.log('Version bumped: ' + packageJson.version.replace(/.\\d+$/, '.0') + ' -> ' + newVersion);
        `);
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('应自增 patch 版本号', () => {
        execSync(`node "${scriptPath}"`);
        
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        expect(pkg.version).toBe('1.0.1');
    });

    it('连续执行应持续自增', () => {
        execSync(`node "${scriptPath}"`);
        execSync(`node "${scriptPath}"`);
        execSync(`node "${scriptPath}"`);
        
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        expect(pkg.version).toBe('1.0.3');
    });
});

describe('版本号一致性检查', () => {
    const rootDir = path.resolve(__dirname, '..', '..');

    it('README.md 版本徽章应与 package.json 版本一致', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
        const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf-8');
        const version = pkg.version;
        expect(readme).toContain(`version-${version}-blue`);
    });

    it('package.json 面板名称应为"基本信息"', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
        const views = pkg.contributes?.views?.['cursor-session-helper'];
        const userInfoView = views?.find((v: any) => v.id === 'cursor-session-helper.userInfo');
        expect(userInfoView).toBeDefined();
        expect(userInfoView.name).toBe('基本信息');
    });

    it('package.json nickname 默认值应为空字符串', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
        const nicknameProp = pkg.contributes?.configuration?.properties?.['cursorSessionHelper.nickname'];
        expect(nicknameProp).toBeDefined();
        expect(nicknameProp.default).toBe('');
    });
});
