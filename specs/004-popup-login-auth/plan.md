# Implementation Plan: 弹出登录页面鉴权

**Branch**: `004-popup-login-auth` | **Date**: 2026-01-04 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/004-popup-login-auth/spec.md`

## Summary

弹出登录页面鉴权功能为Cursor插件提供安全的用户认证机制。核心架构设计为：登录流程在前端工程（spec-share-frontend）中实现，插件通过外部浏览器打开前端登录页面，用户在前端完成登录后，前端通过URI scheme回调将认证token传递给插件，插件保存token并用于后续API请求。这种设计避免了用户名和密码在插件客户端泄露的风险。

技术实现基于现有的VS Code/Cursor插件开发技术栈（TypeScript + VS Code Extension API），通过外部浏览器与前端Web应用集成，使用URI scheme（cursor-helper://）处理登录回调。插件需要实现登录状态管理、token存储（使用SecretStorage）、API请求认证等功能，同时移除原有的手动输入token功能。

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js >=18.0.0  
**Primary Dependencies**: 
- VS Code Extension API (vscode ^1.74.0)
- 前端Web应用（spec-share-frontend，React + TypeScript）

**Storage**: 
- VS Code SecretStorage API (安全存储JWT Token)
- VS Code Memento API (存储登录状态和配置)

**Testing**: 
- VS Code Extension Test Framework (@vscode/test-electron)
- TypeScript编译检查

**Target Platform**: 
- Cursor IDE (基于VS Code)
- Windows/macOS/Linux

**Project Type**: VS Code Extension (Cursor Plugin)

**Performance Goals**: 
- 登录页面打开时间 < 2秒
- Token验证响应时间 < 500ms
- 插件面板状态切换响应时间 < 200ms

**Constraints**: 
- 必须使用前端Web应用进行登录（不在插件中处理用户名密码）
- 必须使用VS Code SecretStorage安全存储token
- 必须支持token过期检测和自动重新登录
- 必须移除所有手动输入token的功能
- 必须兼容现有的API客户端和上传功能

**Scale/Scope**: 
- 1个主要功能模块（认证管理）
- 2个主要UI组件（登录按钮、登出按钮/菜单）
- 1个外部浏览器集成（登录页面）+ URI scheme回调处理
- 支持token过期检测和自动重新登录

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Pass**: 项目符合VS Code插件开发规范，使用标准Extension API，无特殊架构要求。功能模块化设计，使用SecretStorage确保安全性，易于维护和扩展。

## Project Structure

### Documentation (this feature)

```text
specs/004-popup-login-auth/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── auth-integration.md  # 插件与前端登录页面集成契约
│   └── api-contracts.md     # 认证相关API契约
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
cursor-helper/
├── src/
│   ├── services/            # 服务层
│   │   ├── authService.ts    # 认证服务（新增）
│   │   │   ├── openLoginPage()      # 打开登录页面
│   │   │   ├── handleLoginCallback() # 处理登录回调
│   │   │   ├── getToken()           # 获取当前token
│   │   │   ├── isAuthenticated()    # 检查登录状态
│   │   │   ├── logout()             # 登出
│   │   │   └── refreshTokenIfNeeded() # 刷新token（如需要）
│   │   └── uploadService.ts # 上传服务（已存在，需更新以使用新认证）
│   ├── ui/                  # UI组件
│   │   ├── sessionListPanel.ts  # 会话列表面板（已存在，需更新）
│   │   ├── loginButton.ts       # 登录按钮组件（新增）
│   │   └── authStatusBar.ts     # 认证状态栏（新增，可选）
│   ├── utils/               # 工具类
│   │   ├── tokenManager.ts  # Token管理器（新增）
│   │   │   ├── saveToken()      # 保存token到SecretStorage
│   │   │   ├── getToken()       # 从SecretStorage获取token
│   │   │   ├── deleteToken()    # 删除token
│   │   │   └── isTokenValid()   # 验证token有效性
│   │   └── apiClient.ts     # API客户端（已存在，需更新以支持认证）
│   ├── commands/            # 命令
│   │   ├── login.ts         # 登录命令（新增）
│   │   └── logout.ts        # 登出命令（新增）
│   ├── models/              # 数据模型
│   │   └── auth.ts          # 认证相关类型（新增）
│   │       ├── AuthState
│   │       ├── LoginResponse
│   │       └── TokenInfo
│   └── extension.ts         # 扩展入口（需更新以注册新命令和UI）
├── package.json            # 需更新以添加新命令
└── tsconfig.json
```

**Structure Decision**: 采用标准VS Code插件项目结构，在现有代码基础上扩展。认证服务集中在`services/authService.ts`，Token管理集中在`utils/tokenManager.ts`，UI组件集中在`ui/`目录。使用VS Code SecretStorage API确保token安全存储，使用外部浏览器打开前端登录页面，通过URI scheme（cursor-helper://）回调接收token。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无需填写 - 项目符合标准VS Code插件架构，无特殊复杂性要求。
