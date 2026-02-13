/**
 * 版本自增脚本
 * 每次 build 时自动自增 patch 版本号
 * 例如: 1.0.0 -> 1.0.1 -> 1.0.2
 */
const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

const currentVersion = packageJson.version;
const parts = currentVersion.split('.');
const major = parseInt(parts[0], 10);
const minor = parseInt(parts[1], 10);
const patch = parseInt(parts[2], 10);

const newVersion = `${major}.${minor}.${patch + 1}`;
packageJson.version = newVersion;

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');

console.log(`Version bumped: ${currentVersion} -> ${newVersion}`);
