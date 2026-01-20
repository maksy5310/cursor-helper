# URL 统一管理重构说明

## 概述

将插件中分散的硬编码 URL 重构为基于统一 `baseUrl` 的管理方式。所有的服务端路径都基于 `baseUrl` 生成,方便切换环境(生产/测试/本地)。

## 设计原则

**所有 URL 都基于 baseUrl 派生**,不允许单独配置其他 URL。这样确保:
- 配置简单:只需设置一个 baseUrl
- 一致性:所有 URL 自动指向同一环境
- 易维护:切换环境只需修改一处

## 重构内容

### 1. Config 类增强 (`src/utils/config.ts`)

新增以下方法:

- **`getBaseUrl(context)`**: 获取基础 URL (默认: `https://spec.pixvert.app`)
- **`setBaseUrl(context, url)`**: 设置基础 URL
- **`getAPIUrl(context)`**: 获取 API URL (`${baseUrl}/api/v1`)
- **`getLoginUrl(context)`**: 获取登录页面 URL (`${baseUrl}/plugin-login`)
- **`getUserCenterUrl(context)`**: 获取用户中心 URL (`${baseUrl}/user/profile`)
- **`getDefaultBaseUrl()`**: 获取默认基础 URL
- **`getDefaultAPIUrl()`**: 获取默认 API URL

修改的方法:

- **`setAPIUrl(context, url)`**: 已废弃,现在会自动从 API URL 提取 base URL (兼容旧版本)

### 2. 重构的文件

#### `src/services/authService.ts`
- 导入 `Config` 类
- **移除**: `cursor-helper.auth.loginUrl` 配置项检查
- `getLoginUrl()` 方法直接使用 `Config.getLoginUrl(this.context)`

#### `src/commands/openUserCenter.ts`
- **移除**: `cursor-helper.userCenter.url` 配置项检查
- 直接使用 `Config.getUserCenterUrl(context)` 获取 URL

#### `src/commands/configureUpload.ts`
- 修改为配置 Base URL 而非 API URL
- 使用 `Config.setBaseUrl()` 和相关方法
- 配置成功后显示所有生成的 URL

#### `src/extension.ts`
- 调用 `openUserCenterCommand(context)` 时传入 context 参数

## 使用方式

### 用户配置

用户通过命令 `cursor-assistant.configureUpload` 配置 Base URL:

```
Base URL: https://spec.pixvert.app  (生产环境-默认)
或: http://localhost:8000  (本地开发)
```

配置后会自动生成所有 URL:
- API URL: `${baseUrl}/api/v1`
- 登录页面: `${baseUrl}/plugin-login`
- 个人中心: `${baseUrl}/user/profile`

### 代码中使用

```typescript
import { Config } from '../utils/config';

// 获取各种 URL (所有都基于 baseUrl 派生)
const baseUrl = Config.getBaseUrl(context);
const apiUrl = Config.getAPIUrl(context);
const loginUrl = Config.getLoginUrl(context);
const userCenterUrl = Config.getUserCenterUrl(context);

// 设置 Base URL (推荐)
await Config.setBaseUrl(context, 'https://your-domain.com');

// 或使用旧方法 (会自动提取 base URL)
await Config.setAPIUrl(context, 'https://your-domain.com/api/v1');
```

## 移除的配置项

以下 VSCode 配置项已被移除,不再支持:
- ❌ `cursor-helper.auth.loginUrl` - 登录 URL 现在从 baseUrl 派生
- ❌ `cursor-helper.userCenter.url` - 用户中心 URL 现在从 baseUrl 派生

## 存储方式

- **baseUrl**: 存储在 `context.globalState` 的 `base_url` 键
- **旧的 api_url**: 仍保留在 `upload.api_url` 键(兼容性),但优先使用 baseUrl

## 兼容性

- 保留了 `setAPIUrl()` 方法以保持向后兼容(标记为 @deprecated)
- 调用 `setAPIUrl()` 会自动提取并保存 base URL
- 旧的 `upload.api_url` globalState 配置仍可工作,但会被 baseUrl 覆盖

## 优势

1. **统一管理**: 所有 URL 从一个 baseUrl 生成,避免不一致
2. **易于切换**: 只需修改 Base URL 即可切换环境(生产/测试/本地)
3. **配置简单**: 用户只需配置一个 URL,不会混淆
4. **可维护性**: 新增路径只需在 Config 类添加方法
5. **类型安全**: 使用方法而非字符串拼接,减少错误
6. **防止错配**: 不可能出现登录 URL 指向生产环境但 API URL 指向测试环境的情况

## 未修改的 URL

以下 URL 未修改,因为它们是:
- 外部服务: `https://www.gravatar.com` (Gravatar 头像服务)
- 注释或示例: `https://sql.js.org` (仅在注释中)
- 测试代码: `https://example.com` (测试用例)

## 迁移指南

如果你之前单独配置了 `auth.loginUrl` 或 `userCenter.url`:

1. 这些配置项现在会被忽略
2. 所有 URL 都从 baseUrl 派生
3. 运行 `cursor-assistant.configureUpload` 命令设置 Base URL
4. 系统会自动生成所有相关 URL
