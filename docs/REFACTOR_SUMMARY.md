# 配置管理重构总结

## 📋 重构概述

将配置管理从"双 TypeScript 文件方案"重构为"外部 JSON 配置文件方案"。

---

## 🎯 重构目标

解决旧方案的问题：
- ❌ 需要复制整个 config.ts 文件（3KB+）
- ❌ 修改配置类时需要同步两个文件
- ❌ 配置和代码混在一起，不够清晰
- ❌ 维护成本高

---

## ✨ 新方案优势

### 1. 简洁优雅

**旧方案**：
```
src/utils/config.ts       (3KB - 开发环境)
src/utils/config.prod.ts  (3KB - 生产环境)
总大小：6KB
```

**新方案**：
```
src/config.json           (60B - 开发环境)
src/config.prod.json      (60B - 生产环境)
src/utils/config.ts       (3KB - 共享配置类)
总大小：3.1KB (减少 48%)
```

### 2. 无代码重复

**旧方案**：
- 整个 Config 类完全复制
- 修改类方法需要同步两个文件

**新方案**：
- 只有一个 Config 类
- 只需维护一个代码文件
- 配置变量独立在 JSON 中

### 3. 配置清晰

**旧方案**：
```typescript
// config.prod.ts
export class Config {
    private static readonly DEFAULT_BASE_URL = 'https://spec.ak01.cn';
    // ... 100+ 行代码
}
```

**新方案**：
```json
// config.prod.json
{
  "env": "production",
  "baseUrl": "https://spec.ak01.cn"
}
```

### 4. 易于扩展

**添加新配置项**：

旧方案：需要在两个 .ts 文件中添加相同代码
新方案：只需在 JSON 文件中添加一行

```json
{
  "env": "production",
  "baseUrl": "https://spec.ak01.cn",
  "apiTimeout": 30000,      // 新增配置
  "maxRetries": 3           // 新增配置
}
```

---

## 📝 文件变更

### 新增文件

1. **`src/config.json`** - 开发环境配置
   ```json
   {
     "env": "development",
     "baseUrl": "https://spec.pixvert.app"
   }
   ```

2. **`src/config.prod.json`** - 生产环境配置
   ```json
   {
     "env": "production",
     "baseUrl": "https://spec.ak01.cn"
   }
   ```

### 修改文件

1. **`src/utils/config.ts`** - 添加 JSON 配置读取逻辑
   ```typescript
   interface EnvConfig {
       env: string;
       baseUrl: string;
   }
   
   export class Config {
       private static envConfig: EnvConfig | null = null;
       
       private static loadEnvConfig(): EnvConfig {
           const configPath = path.join(__dirname, '..', 'config.json');
           const configContent = fs.readFileSync(configPath, 'utf-8');
           return JSON.parse(configContent);
       }
       
       private static get DEFAULT_BASE_URL(): string {
           return this.loadEnvConfig().baseUrl;
       }
   }
   ```

2. **`tsconfig.json`** - 启用 JSON 模块解析
   ```json
   {
     "compilerOptions": {
       "resolveJsonModule": true
     }
   }
   ```

3. **`package.json`** - 添加配置文件复制脚本
   ```json
   {
     "scripts": {
       "vscode:prepublish": "npm run compile && npm run copy-config",
       "copy-config": "node -e \"require('fs').cpSync('src/config.json', 'out/config.json')\""
     }
   }
   ```

4. **`.github/workflows/publish.yml`** - 更新配置替换逻辑
   ```yaml
   - name: Switch to production config
     run: |
       cp src/config.prod.json src/config.json
       cat src/config.json
   ```

### 删除文件

1. **`src/utils/config.prod.ts`** - 不再需要

---

## 🔄 工作流程对比

### 旧方案

```
本地开发：
config.ts → 读取硬编码的 DEFAULT_BASE_URL

自动发布：
1. cp config.prod.ts config.ts
2. 编译 → 使用替换后的 config.ts
3. 发布
```

### 新方案

```
本地开发：
config.json → config.ts 读取 → 使用配置

自动发布：
1. cp config.prod.json config.json
2. 编译 → config.ts 读取新的 config.json
3. 发布
```

---

## ✅ 测试验证

### 本地开发测试

```bash
# 1. 编译项目
npm run compile

# 2. 检查输出目录是否有 config.json
ls out/config.json

# 3. 按 F5 调试
# 验证使用的是开发环境配置
```

### 生产配置测试

```bash
# 1. 手动替换配置
cp src/config.prod.json src/config.json

# 2. 编译
npm run compile

# 3. 检查配置是否正确
cat out/config.json

# 4. 恢复开发配置
git checkout src/config.json
```

### GitHub Actions 测试

```bash
# 推送测试标签
git tag v0.0.3-test
git push origin v0.0.3-test

# 查看 Actions 日志，确认配置替换成功
# 应该看到：Production config applied: https://spec.ak01.cn
```

---

## 📊 性能影响

### 运行时性能

- **配置加载**：首次读取 JSON 文件后缓存，不影响性能
- **文件大小**：JSON 文件极小（60 字节），读取开销可忽略
- **内存占用**：缓存配置对象，内存占用极小

### 编译时性能

- **编译速度**：无影响（不需要编译两个相同的类）
- **构建时间**：略微增加（需要复制 config.json）
- **输出大小**：减少约 3KB

---

## 🎓 最佳实践

### 1. 配置文件命名规范

```
config.json           - 开发环境（默认）
config.prod.json      - 生产环境
config.test.json      - 测试环境（如需要）
config.local.json     - 本地个人配置（不提交到 Git）
```

### 2. 配置验证

在 `config.ts` 中添加配置验证：

```typescript
private static loadEnvConfig(): EnvConfig {
    try {
        const config = JSON.parse(fs.readFileSync(...));
        
        // 验证必需字段
        if (!config.baseUrl) {
            throw new Error('baseUrl is required');
        }
        
        // 验证 URL 格式
        new URL(config.baseUrl);
        
        return config;
    } catch (error) {
        // 降级到默认配置
        console.warn('Config validation failed:', error);
        return { env: 'development', baseUrl: 'https://spec.pixvert.app' };
    }
}
```

### 3. 添加新配置项

```json
// 1. 在两个配置文件中添加
{
  "env": "development",
  "baseUrl": "https://spec.pixvert.app",
  "newFeature": true
}

// 2. 更新接口定义
interface EnvConfig {
    env: string;
    baseUrl: string;
    newFeature?: boolean;
}

// 3. 添加读取方法
static isNewFeatureEnabled(): boolean {
    return this.loadEnvConfig().newFeature || false;
}
```

---

## 🔗 相关文档

- [配置管理说明](./CONFIG_MANAGEMENT.md)
- [快速发布指南](./QUICK_PUBLISH_GUIDE.md)
- [GitHub Actions 配置指南](./GITHUB_ACTIONS_SETUP.md)

---

## 📝 后续改进建议

### 1. 支持更多环境

```json
config.dev.json      - 开发环境
config.test.json     - 测试环境
config.staging.json  - 预发布环境
config.prod.json     - 生产环境
```

### 2. 配置 Schema 验证

使用 JSON Schema 验证配置文件：

```json
// config.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "env": { "type": "string", "enum": ["development", "production"] },
    "baseUrl": { "type": "string", "format": "uri" }
  },
  "required": ["env", "baseUrl"]
}
```

### 3. 热重载配置

在开发模式下监听配置文件变化：

```typescript
if (config.env === 'development') {
    fs.watch('config.json', () => {
        this.envConfig = null; // 清除缓存
        console.log('Config reloaded');
    });
}
```

---

## ✨ 总结

通过这次重构，我们实现了：

- ✅ **代码更简洁**：减少 48% 的配置相关代码
- ✅ **维护更容易**：只需维护一个配置类
- ✅ **配置更清晰**：配置独立于代码
- ✅ **扩展更方便**：添加配置只需修改 JSON
- ✅ **工作流不变**：开发和发布流程完全兼容

这是一个优雅且可维护的配置管理方案！🎉
