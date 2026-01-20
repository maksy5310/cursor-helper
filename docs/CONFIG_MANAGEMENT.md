# 配置管理说明

## 📋 概述

本项目使用外部 JSON 配置文件方案，简洁优雅地分离开发环境和生产环境配置。

---

## 🔧 配置文件说明

### 开发环境配置

**文件**: `src/config.json`

```json
{
  "env": "development",
  "baseUrl": "https://spec.pixvert.app"
}
```

**用途**:
- ✅ 本地开发调试
- ✅ 功能测试
- ✅ F5 调试运行

**特点**:
- 简洁的 JSON 格式，只包含环境变量
- 使用测试服务器，不影响生产数据
- 可以随意修改和测试
- 提交到 Git 仓库

### 生产环境配置

**文件**: `src/config.prod.json`

```json
{
  "env": "production",
  "baseUrl": "https://spec.ak01.cn"
}
```

**用途**:
- ✅ GitHub Actions 自动构建
- ✅ Open VSX 发布版本
- ✅ 用户实际使用

**特点**:
- 仅包含生产环境的配置变量
- 仅在 CI/CD 构建时使用
- 不影响本地开发
- 提交到 Git 仓库

### 配置类

**文件**: `src/utils/config.ts`

配置类会自动读取 `config.json` 文件，并使用其中的 `baseUrl` 作为默认值。

```typescript
// config.ts 会自动读取 config.json
private static loadEnvConfig(): EnvConfig {
    const configPath = path.join(__dirname, '..', 'config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
}
```

---

## 🚀 工作流程

### 本地开发

1. **正常开发**：`config.ts` 自动读取 `config.json`（测试服务器）
2. **按 F5 调试**：自动使用开发环境配置
3. **无需切换**：开发和测试完全独立

```bash
# 本地运行时的配置流程
src/config.json
    ↓
{"baseUrl": "https://spec.pixvert.app"}
    ↓
src/utils/config.ts 读取
    ↓
本地调试使用测试服务器
```

### 自动发布

1. **推送版本标签**：`git push origin v0.0.3`
2. **GitHub Actions 触发**：自动构建流程
3. **替换配置文件**：
   ```bash
   # GitHub Actions 自动执行
   cp src/config.prod.json src/config.json
   ```
4. **编译发布**：`config.ts` 读取到生产配置
5. **发布到 Open VSX**：用户安装的版本使用生产服务器

```bash
# 自动发布时的配置替换流程
src/config.json (开发环境)
    ↓
[GitHub Actions 替换]
    ↓
src/config.json (生产环境内容)
    ↓
config.ts 读取配置
    ↓
npm run compile
    ↓
发布到 Open VSX
```

---

## 📝 GitHub Actions 配置

在 `.github/workflows/publish.yml` 中，编译前自动替换配置文件：

```yaml
# 4. 使用生产环境配置
- name: Switch to production config
  run: |
    echo "Switching to production configuration..."
    cp src/config.prod.json src/config.json
    cat src/config.json
    echo "Production config applied!"

# 5. 编译 TypeScript
- name: Compile TypeScript
  run: npm run compile
```

---

## 🔄 修改配置

### 修改开发环境配置

编辑 `src/config.json`：

```json
{
  "env": "development",
  "baseUrl": "http://localhost:8000"  // 改为你的开发服务器
}
```

### 修改生产环境配置

编辑 `src/config.prod.json`：

```json
{
  "env": "production",
  "baseUrl": "https://your-production-server.com"  // 改为你的生产服务器
}
```

### 添加新的配置项

如果需要添加新的配置项，按以下步骤操作：

1. **更新配置文件**：
```json
// src/config.json 和 src/config.prod.json
{
  "env": "development",
  "baseUrl": "https://spec.pixvert.app",
  "apiTimeout": 30000,  // 新增配置项
  "enableDebug": true   // 新增配置项
}
```

2. **更新类型定义**（在 `config.ts` 中）：
```typescript
interface EnvConfig {
    env: string;
    baseUrl: string;
    apiTimeout?: number;   // 新增
    enableDebug?: boolean; // 新增
}
```

3. **使用新配置**：
```typescript
static getApiTimeout(): number {
    return this.loadEnvConfig().apiTimeout || 30000;
}
```

---

## ✅ 最佳实践

### 1. 配置文件结构清晰

**优点**：
- ✅ 配置文件只包含变量，简洁明了
- ✅ 不需要复制整个配置类
- ✅ 修改配置类时不需要同步两个文件

### 2. 配置项命名规范

```json
{
  "env": "development",        // 环境标识
  "baseUrl": "https://...",    // 使用驼峰命名
  "apiTimeout": 30000,         // 数字配置
  "enableDebug": true          // 布尔配置
}
```

### 3. 测试两种配置

**测试开发环境**：
```bash
npm run compile
# 按 F5 调试
```

**测试生产环境配置**：
```bash
# 手动替换配置文件
cp src/config.prod.json src/config.json
npm run compile
# 测试功能
# 测试完成后恢复
git checkout src/config.json
```

### 4. 配置文件验证

在 `config.ts` 中添加配置验证逻辑：

```typescript
private static loadEnvConfig(): EnvConfig {
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        // 验证必需字段
        if (!config.baseUrl) {
            throw new Error('baseUrl is required in config.json');
        }
        
        return config;
    } catch (error) {
        // 降级到默认配置
        console.warn('Failed to load config.json:', error);
        return { env: 'development', baseUrl: 'https://spec.pixvert.app' };
    }
}
```

---

## 🔍 验证配置

### 查看当前使用的配置

1. **本地开发**：
   ```bash
   cat src/utils/config.ts | grep DEFAULT_BASE_URL
   # 应输出: https://spec.pixvert.app
   ```

2. **GitHub Actions 日志**：
   查看 Actions 运行日志，应看到：
   ```
   Switching to production configuration...
   Production config applied: https://spec.ak01.cn
   ```

### 检查发布版本

用户安装插件后，默认使用的服务器应该是生产环境地址。

---

## ⚠️ 注意事项

### 1. 只修改配置文件，不修改配置类

❌ **错误做法**：
```typescript
// 在 config.ts 中硬编码生产地址
private static readonly DEFAULT_BASE_URL = 'https://spec.ak01.cn';
```

✅ **正确做法**：
```json
// 只修改 config.prod.json
{
  "env": "production",
  "baseUrl": "https://spec.ak01.cn"
}
```

### 2. 确保配置文件会被编译

在 `tsconfig.json` 中需要设置 `resolveJsonModule: true`，这样 TypeScript 才能导入 JSON 文件。

### 3. 配置文件要被复制到输出目录

确保 `config.json` 会被复制到 `out/` 目录。可以在 `package.json` 的构建脚本中添加：

```json
"scripts": {
  "vscode:prepublish": "npm run compile && npm run copy-config",
  "compile": "tsc -p ./",
  "copy-config": "node -e \"require('fs').copyFileSync('src/config.json', 'out/config.json')\""
}
```

或者使用更简单的方式，TypeScript 编译器会自动复制。

### 4. 本地打包测试

如果需要本地打包测试生产配置：

```bash
# 1. 手动替换配置文件
cp src/config.prod.json src/config.json

# 2. 编译并打包
npm run compile
npm install -g @vscode/vsce
vsce package

# 3. 测试完成后恢复
git checkout src/config.json
```

---

## 📊 配置对比

| 项目 | 开发环境 | 生产环境 |
|-----|---------|---------|
| **配置文件** | `src/config.json` | `src/config.prod.json` |
| **BaseURL** | `https://spec.pixvert.app` | `https://spec.ak01.cn` |
| **配置类** | `src/utils/config.ts` | `src/utils/config.ts`（同一个） |
| **用途** | 本地开发、测试 | 自动发布、用户使用 |
| **何时使用** | F5 调试、本地编译 | GitHub Actions 构建 |
| **文件大小** | ~60 字节（仅配置） | ~60 字节（仅配置） |
| **是否提交** | ✅ 是 | ✅ 是 |
| **是否手动切换** | ❌ 否 | ❌ 否（自动） |

### 方案优势

对比之前的双文件方案：

| 特性 | 旧方案（双 .ts 文件） | 新方案（JSON 配置） |
|-----|-------------------|------------------|
| **配置文件大小** | ~3KB × 2 = 6KB | ~60B × 2 = 120B |
| **代码重复** | ❌ 完全复制整个类 | ✅ 无代码重复 |
| **维护成本** | ❌ 修改类需同步两个文件 | ✅ 只需维护一个类 |
| **配置清晰度** | ⚠️ 配置混在代码中 | ✅ 配置独立清晰 |
| **扩展性** | ⚠️ 添加配置需修改两处 | ✅ 只需修改 JSON |
| **可读性** | ⚠️ 需要读 TS 代码 | ✅ 直接看 JSON |

---

## 🔗 相关文档

- [GitHub Actions 配置指南](./GITHUB_ACTIONS_SETUP.md)
- [快速发布指南](./QUICK_PUBLISH_GUIDE.md)
- [手动发布指南](../PUBLISH.md)

---

## 💡 常见问题

### Q: 如何验证发布版本使用了正确的配置？

A: 查看 GitHub Actions 运行日志，应该能看到 "Production config applied" 的输出。

### Q: 本地调试时能否使用生产环境配置？

A: 可以通过插件的"配置 Base URL"命令临时切换，不影响代码。

### Q: 如果需要添加新的配置项怎么办？

A: 只需在两个 JSON 文件中添加新字段即可，不需要修改配置类：

```json
// src/config.json 和 src/config.prod.json
{
  "env": "development",
  "baseUrl": "https://spec.pixvert.app",
  "newFeature": true  // 新增配置项
}
```

然后在 `config.ts` 中添加读取方法。

### Q: 为什么不使用环境变量？

A: VS Code 扩展在运行时无法访问构建时的环境变量，文件替换方案更简单可靠。

### Q: JSON 配置文件会被编译到输出吗？

A: 是的，TypeScript 编译器会自动将 JSON 文件复制到输出目录 `out/`。

### Q: 如何验证配置文件格式正确？

A: 可以使用 JSON Schema 验证，或在 `config.ts` 中添加运行时验证逻辑。
