/**
 * HTML 页面布局模板
 * 严格按照 REQ.md 4.1~4.6 UI 设计
 */

export function renderLayout(title: string, content: string, version: string = '1.0.0'): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} - Cursor Session Helper</title>
    <style>
        /* ========== 基础重置 ========== */
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; overflow: hidden; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            color: #333;
            background: #f5f7fa;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        /* ========== 顶部导航栏 (REQ 4.2) ========== */
        .navbar {
            background: #1a2332;
            color: #fff;
            padding: 0 24px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 100;
        }
        .navbar-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 15px;
            font-weight: 600;
        }
        .navbar-brand svg { width: 22px; height: 22px; }
        .navbar-links a {
            color: #b0bec5;
            text-decoration: none;
            font-size: 13px;
            padding: 5px 12px;
            border-radius: 4px;
            transition: all 0.2s;
        }
        .navbar-links a:hover { color: #fff; background: rgba(255,255,255,0.1); }

        /* ========== 主体区域 (REQ 4.1) ========== */
        .main-container {
            display: flex;
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }

        /* ========== 左侧面板 (REQ 4.3) ========== */
        .sidebar {
            position: relative;
            z-index: 2;
            width: 220px;
            min-width: 220px;
            background: #fff;
            border-right: 1px solid #e0e4e8;
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
            transition: width 0.25s, min-width 0.25s;
            overflow: hidden;
        }
        .sidebar.collapsed { width: 36px; min-width: 36px; }

        /* 可拖动分隔条 */
        .sidebar-resizer {
            width: 5px;
            background: transparent;
            cursor: col-resize;
            flex-shrink: 0;
            transition: background 0.2s;
        }
        .sidebar-resizer:hover {
            background: #4a90d9;
        }
        .sidebar-resizer:active {
            background: #3b7ac4;
        }

        .sidebar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 10px;
            border-bottom: 1px solid #e0e4e8;
            font-weight: 600;
            font-size: 13px;
            color: #333;
            flex-shrink: 0;
        }
        .sidebar-toggle {
            cursor: pointer;
            background: none;
            border: none;
            font-size: 14px;
            color: #666;
            padding: 2px 6px;
            border-radius: 3px;
        }
        .sidebar-toggle:hover { background: #e8ecf0; }

        .sidebar .search-box {
            padding: 6px 8px;
            border-bottom: 1px solid #eee;
            flex-shrink: 0;
        }
        .sidebar .search-box input {
            width: 100%;
            padding: 5px 8px;
            border: 1px solid #d0d4d8;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
        }
        .sidebar .search-box input:focus { border-color: #4a90d9; }

        .section-title {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 10px 3px;
            font-size: 11px;
            font-weight: 600;
            color: #1a1a1a;
            text-transform: uppercase;
            cursor: pointer;
            user-select: none;
            flex-shrink: 0;
        }
        .section-title:hover { color: #333; }
        .section-title .arrow { font-size: 9px; transition: transform 0.2s; }
        .section-title.collapsed .arrow { transform: rotate(-90deg); }
        .section-title .msg-count { color: #e53935; font-weight: bold; }
        .section-title .session-count { color: #e53935; font-weight: bold; }

        /* 会话列表 — 可调整高度，超出滚动 */
        .session-list {
            height: 180px;
            min-height: 80px;
            overflow-y: auto;
            padding: 2px 0;
            flex-shrink: 0;
        }

        /* 会话列表和大纲之间的可拖动分隔条 */
        .section-resizer {
            height: 6px;
            background: #e0e4e8;
            cursor: row-resize;
            flex-shrink: 0;
            transition: background 0.2s;
            position: relative;
        }
        .section-resizer:hover {
            background: #4a90d9;
        }
        .section-resizer:active {
            background: #3b7ac4;
        }
        .section-resizer::after {
            content: '';
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 30px;
            height: 2px;
            background: #999;
            border-radius: 1px;
        }
        .section-resizer:hover::after {
            background: #fff;
        }
        .session-item {
            display: block;
            padding: 4px 10px;
            text-decoration: none;
            color: #333;
            font-size: 12px;
            border-left: 2px solid transparent;
            transition: all 0.15s;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.4;
        }
        .session-item:hover { background: #f0f4f8; }
        .session-item.active {
            background: #e8f0fe;
            border-left-color: #4a90d9;
            color: #1a73e8;
            font-weight: 500;
        }
        .session-item .session-num { color: #999; font-size: 11px; margin-right: 4px; }

        /* 消息大纲 — 占据剩余空间，自动滚动 */
        .outline-list {
            flex: 1;
            overflow-y: auto;
            padding: 2px 0;
            min-height: 0;
        }
        .outline-item {
            display: block;
            padding: 3px 10px 3px 14px;
            text-decoration: none;
            color: #555;
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.5;
            transition: background 0.15s;
        }
        .outline-item:hover { background: #f0f4f8; color: #333; }
        .outline-item .msg-role { font-weight: 600; margin-right: 3px; font-size: 10px; }
        .outline-item .msg-role.user { color: #e67e22; }
        .outline-item .msg-role.ai { color: #3498db; }
        .outline-item .msg-role.meta { color: #888; }

        /* 折叠状态 (REQ 4.4) */
        .sidebar.collapsed .search-box,
        .sidebar.collapsed .section-title,
        .sidebar.collapsed .session-list,
        .sidebar.collapsed .outline-list,
        .sidebar.collapsed .sidebar-header span { display: none; }
        .sidebar.collapsed .sidebar-header { justify-content: center; padding: 8px 4px; }

        /* ========== 右侧内容区 ========== */
        /* 详情页: 整体可滚动 (仅 navbar 固定，其余全部滚动)；限制横向溢出避免渗入侧边栏 */
        .content-area-detail {
            position: relative;
            z-index: 1;
            flex: 1;
            min-width: 0;
            overflow-x: hidden;
            overflow-y: auto;
            padding: 20px 24px 24px;
            background: #f5f7fa;
            contain: layout style;
        }
        .content-inner {
            width: 100%;
            /* 移除 max-width 限制，内容填满右侧区域 */
            min-width: 0;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
        }
        .content-inner > * {
            flex: 0 0 auto;
            width: 100%;
            min-width: 0;
        }

        /* 首页用: 整体可滚动的 content-area (无固定头部) */
        .content-area-home {
            flex: 1;
            width: 100%;
            min-width: 0;
            overflow-y: auto;
            padding: 24px;
            background: #f5f7fa;
        }

        /* 内容卡片（通用） */
        .content-card {
            background: #fff;
            border-radius: 8px;
            padding: 20px 24px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.06);
            width: 100%;
            max-width: 960px;
            margin: 0 auto;
            min-width: 0;
            box-sizing: border-box;
        }

        /* 会话标题 (REQ 4.5) */
        .share-title {
            display: block;
            width: 100%;
            font-size: 20px;
            font-weight: 700;
            color: #1a2332;
            margin-bottom: 4px;
            word-break: break-word;
        }
        .share-project { display: block; width: 100%; font-size: 13px; color: #666; margin-bottom: 12px; }

        /* 操作按钮 */
        .action-bar {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-bottom: 12px;
            width: 100%;
        }
        .btn {
            padding: 5px 14px;
            border: 1px solid #d0d4d8;
            border-radius: 5px;
            background: #fff;
            color: #555;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .btn:hover { border-color: #4a90d9; color: #4a90d9; }
        .btn-cancel {
            background: #f5f5f5;
            border-color: #ccc;
            color: #666;
        }
        .btn-cancel:hover { background: #e8e8e8; border-color: #999; color: #333; }
        .btn-danger {
            background: #e53935;
            border-color: #e53935;
            color: #fff;
        }
        .btn-danger:hover { background: #c62828; border-color: #c62828; color: #fff; }

        /* ========== 右键上下文菜单 ========== */
        .context-menu {
            position: absolute;
            z-index: 1000;
            background: #fff;
            border: 1px solid #d0d4d8;
            border-radius: 6px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            min-width: 140px;
            padding: 4px 0;
        }
        .context-menu-item {
            padding: 8px 16px;
            font-size: 13px;
            color: #333;
            cursor: pointer;
            transition: background 0.15s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .context-menu-item:hover {
            background: #f0f4f8;
        }
        .context-menu-item.delete-item {
            color: #c62828;
        }
        .context-menu-item.delete-item:hover {
            background: #ffebee;
        }

        /* ========== 删除确认对话框 ========== */
        .delete-dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .delete-dialog {
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.25);
            padding: 24px;
            min-width: 320px;
            max-width: 450px;
        }
        .delete-dialog-title {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            margin-bottom: 16px;
        }
        .delete-dialog-content {
            font-size: 14px;
            color: #555;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .delete-dialog-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        /* 元信息 */
        .meta-info {
            display: block;
            width: 100%;
            box-sizing: border-box;
            background: #f8f9fb;
            border: 1px solid #e8ecf0;
            border-radius: 6px;
            padding: 10px 14px;
            font-size: 13px;
            color: #555;
            line-height: 1.7;
        }
        .meta-info strong { color: #333; }

        /* ========== 消息卡片 (REQ 4.5) — 严格单列垂直，防止重叠 ========== */
        .messages-list {
            display: flex !important;
            flex-direction: column !important;
            flex-wrap: nowrap !important;
            align-items: stretch;
            gap: 14px;
            width: 100% !important;
            min-width: 0;
            isolation: isolate;
        }
        .message-card {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0;
            flex-shrink: 0;
            border-radius: 8px;
            padding: 16px 20px;
            word-break: break-word;
            overflow-wrap: break-word;
            overflow: hidden;
            box-sizing: border-box;
            scroll-margin-top: 24px;
            contain: layout;
        }
        /* 用户消息 — 浅橙暖色背景 + 左侧橙色边框 (参考 Input 截图) */
        .message-card.user {
            border-left: 4px solid #e67e22;
            background: #fdf6ef;
            border-top: 1px solid #f5dcc3;
            border-right: 1px solid #f5dcc3;
            border-bottom: 1px solid #f5dcc3;
        }
        /* AI消息 — 浅蓝冷色背景 + 左侧蓝色边框 (参考 Input 截图) */
        .message-card.assistant {
            border-left: 4px solid #4a90d9;
            background: #f7faff;
            border-top: 1px solid #d6e4f5;
            border-right: 1px solid #d6e4f5;
            border-bottom: 1px solid #d6e4f5;
        }
        /* 会话元数据 — 无图标无标签，白色背景 */
        .message-card.meta {
            background: #fff;
            border: 1px solid #e0e4e8;
        }
        .message-header {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 13px;
        }
        .role-icon {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            color: #fff;
            flex-shrink: 0;
        }
        .role-icon.user { background: #e67e22; }
        .role-icon.ai { background: #3498db; }

        /* ========== 消息折叠/展开 ========== */
        .message-body {
            position: relative;
            border-left: 2px solid transparent;
            padding-left: 8px;
            transition: border-color 0.2s;
            max-width: 100%;
            min-width: 0;
            overflow-x: hidden;
        }
        .message-card.user .message-body {
            border-left-color: rgba(230, 126, 34, 0.2);
        }
        .message-card.assistant .message-body {
            border-left-color: rgba(74, 144, 217, 0.2);
        }
        .message-card.meta .message-body {
            border-left-color: rgba(200, 200, 200, 0.3);
        }
        .message-body.collapsed {
            max-height: 400px;
            overflow: hidden;
        }
        /* 折叠时底部渐变遮罩 */
        .message-body.collapsed::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px;
            pointer-events: none;
        }
        .message-card.user .message-body.collapsed::after {
            background: linear-gradient(transparent, #fdf6ef);
        }
        .message-card.assistant .message-body.collapsed::after {
            background: linear-gradient(transparent, #f7faff);
        }
        .message-card.meta .message-body.collapsed::after {
            background: linear-gradient(transparent, #fff);
        }
        .message-body.expanded {
            max-height: none;
            overflow-x: hidden;
            overflow-y: visible;
        }
        .msg-toggle-bar {
            text-align: center;
            margin-top: 4px;
            padding-top: 2px;
        }
        .msg-toggle-btn {
            background: #f8f9fb;
            border: 1px solid #e0e4e8;
            border-radius: 12px;
            padding: 3px 14px;
            font-size: 11px;
            color: #4a90d9;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .msg-toggle-btn:hover {
            background: #e8f0fe;
            border-color: #4a90d9;
        }
        .msg-toggle-btn .arrow {
            display: inline-block;
            font-size: 10px;
            transition: transform 0.2s;
        }
        .msg-toggle-btn.expanded .arrow {
            transform: rotate(180deg);
        }

        /* 消息内容 — 严格约束宽度，防止宽内容撑破布局 */
        .message-content {
            font-size: 14px;
            line-height: 1.7;
            color: #333;
            word-break: break-word;
            overflow-wrap: break-word;
            overflow-x: auto;
            max-width: 100%;
            min-width: 0;
            max-width: 100%;
            min-width: 0;
            overflow-x: auto;
        }
        .message-content pre {
            background: #1e1e2e;
            color: #cdd6f4;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 13px;
            line-height: 1.5;
            margin: 8px 0;
        }
        .message-content code {
            background: #e8ecf0;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 13px;
        }
        .message-content pre code { background: none; padding: 0; }
        .message-content ul, .message-content ol { padding-left: 22px; margin: 6px 0; }
        .message-content li { margin: 3px 0; }
        .message-content a { color: #4a90d9; word-break: break-all; }
        .message-content h1, .message-content h2, .message-content h3,
        .message-content h4, .message-content h5, .message-content h6 {
            margin: 12px 0 6px; color: #1a2332;
        }
        .message-content blockquote {
            border-left: 3px solid #d0d4d8;
            padding: 6px 12px;
            margin: 8px 0;
            color: #666;
            background: #f8f9fb;
        }
        .message-content img { max-width: 100%; height: auto; }
        .message-content table {
            border-collapse: collapse;
            margin: 8px 0;
            width: 60%;
            table-layout: auto;
        }
        .message-content > *:not(table) { max-width: 100%; min-width: 0; box-sizing: border-box; }
        .message-content th, .message-content td {
            border: 1px solid #d0d4d8;
            padding: 6px 10px;
            text-align: left;
            font-size: 13px;
        }
        .message-content th { background: #f0f4f8; font-weight: 600; }

        /* details/summary 折叠块样式 */
        .message-content details {
            display: block;
            border: 1px solid #e0e4e8;
            border-radius: 6px;
            margin: 8px 0;
            background: #fafbfc;
            overflow: hidden;
        }
        .message-content summary {
            display: block;
            padding: 8px 12px;
            font-weight: 600;
            font-size: 13px;
            color: #1a2332;
            cursor: pointer;
            background: #f0f4f8;
            border-bottom: 1px solid #e0e4e8;
            user-select: none;
            list-style: none;
        }
        .message-content summary::-webkit-details-marker { display: none; }
        .message-content summary::before {
            content: '▶ ';
            font-size: 10px;
            color: #888;
            margin-right: 4px;
        }
        .message-content details[open] > summary::before { content: '▼ '; }
        .message-content details > *:not(summary) {
            padding: 10px 12px;
        }
        .message-content details pre {
            margin: 0;
            border-radius: 0 0 6px 6px;
        }

        /* ========== 首页 (REQ 4.6) — 固定2列网格 ========== */
        .home-header { margin-bottom: 28px; }
        .home-header h1 { font-size: 22px; font-weight: 700; color: #1a2332; margin-bottom: 6px; }
        .home-header .count { font-size: 13px; color: #888; margin-bottom: 12px; }

        .home-search {
            margin-top: 4px;
            margin-bottom: 20px;
        }
        .home-search input {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid #d0d4d8;
            border-radius: 6px;
            font-size: 14px;
            outline: none;
        }
        .home-search input:focus { border-color: #4a90d9; }

        .share-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
        .share-card {
            display: block;
            background: #fff;
            border: 1px solid #e0e4e8;
            border-radius: 8px;
            padding: 14px 16px;
            text-decoration: none;
            color: #333;
            transition: all 0.2s;
            overflow: hidden;
        }
        .share-card:hover {
            border-color: #4a90d9;
            box-shadow: 0 2px 8px rgba(74,144,217,0.12);
            transform: translateY(-1px);
        }
        .share-card-title {
            font-size: 15px;
            font-weight: 600;
            color: #1a2332;
            margin-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .share-card-meta { font-size: 12px; color: #888; }
        .share-card-meta span { margin-right: 10px; }
        .share-card-date { font-size: 11px; color: #aaa; margin-top: 4px; }

        /* ========== 分页控制 ========== */
        .pagination {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            margin-top: 20px;
            padding: 12px 0;
            user-select: none;
        }
        .pagination-info {
            font-size: 13px;
            color: #888;
            margin-right: 12px;
        }
        .pagination-btn {
            min-width: 34px;
            height: 34px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #d0d4d8;
            border-radius: 6px;
            background: #fff;
            color: #555;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            padding: 0 10px;
        }
        .pagination-btn:hover:not(.disabled):not(.active) {
            border-color: #4a90d9;
            color: #4a90d9;
            background: #f0f6ff;
        }
        .pagination-btn.active {
            background: #4a90d9;
            border-color: #4a90d9;
            color: #fff;
            font-weight: 600;
        }
        .pagination-btn.disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .pagination-ellipsis {
            font-size: 13px;
            color: #999;
            padding: 0 4px;
        }

        /* ========== 返回顶部按钮 ========== */
        .back-to-top {
            position: fixed;
            bottom: 36px;
            right: 36px;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: #4a90d9;
            color: #fff;
            border: none;
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.18);
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s, visibility 0.3s, background 0.2s;
            z-index: 1000;
        }
        .back-to-top.visible {
            opacity: 1;
            visibility: visible;
        }
        .back-to-top:hover {
            background: #3a7abd;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }

        /* 404 */
        .not-found {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 60px 20px;
            min-width: 0;
        }
        .not-found h2 { font-size: 24px; color: #555; margin-bottom: 12px; }
        .not-found p { color: #888; margin-bottom: 20px; }
        .not-found a { color: #4a90d9; text-decoration: none; }

        /* ========== 底部 (REQ 4.1) ========== */
        .footer {
            text-align: center;
            padding: 10px;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #e0e4e8;
            background: #fff;
            flex-shrink: 0;
        }

        /* ========== 打印 ========== */
        @media print {
            .navbar, .sidebar, .footer, .action-bar { display: none !important; }
            body { height: auto; overflow: auto; }
            .main-container { overflow: visible; }
            .content-area-detail, .content-area-home { overflow: visible; padding: 0; }
            .message-card { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <!-- 顶部导航栏 -->
    <nav class="navbar">
        <div class="navbar-brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
            </svg>
            <span>Cursor Session Helper</span>
        </div>
        <div class="navbar-links">
            <a href="/">🏠 首页</a>
        </div>
    </nav>

    <!-- 主体 -->
    ${content}

    <!-- 底部 -->
    <div class="footer">
        Cursor Session Helper &copy;${new Date().getFullYear()} v${version}
    </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
