/**
 * 分享详情页模板 (REQ 4.3 + 4.5)
 * 左侧紧凑大纲 + 右侧固定头部 + 右侧可滚动消息
 */
import { ShareRecord, ShareMetadata } from '../../services/localShareService';
import { Marked } from 'marked';

interface ParsedMessage {
    role: 'user' | 'assistant' | 'meta';
    content: string;
    summary: string;
}

function makeSummary(text: string): string {
    const plain = text.replace(/<[^>]+>/g, '').replace(/[#*`\[\]()]/g, '').trim();
    return plain.substring(0, 45) + (plain.length > 45 ? '...' : '');
}

function parseMessages(content: string): ParsedMessage[] {
    const messages: ParsedMessage[] = [];

    // 实际 Markdown 文件使用 <div class="user-message">...</div> 标记用户消息
    const userMsgRegex = /<div class="user-message">\s*([\s\S]*?)\s*<\/div>/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let isFirstChunk = true;

    while ((match = userMsgRegex.exec(content)) !== null) {
        // match 之前的文本为 AI 内容
        const aiContent = content.substring(lastIndex, match.index).trim();
        if (aiContent) {
            const summary = makeSummary(aiContent);
            if (summary) {
                // 第一段（第一个 user-message 之前）是会话元数据，标记为 meta（不显示图标和标签）
                const role = isFirstChunk ? 'meta' : 'assistant';
                messages.push({ role, content: aiContent, summary });
            }
        }
        isFirstChunk = false;

        // <div class="user-message"> 内部为用户消息
        const userContent = match[1].trim();
        if (userContent) {
            messages.push({ role: 'user', content: userContent, summary: makeSummary(userContent) });
        }

        lastIndex = match.index + match[0].length;
    }

    // 剩余内容为 AI
    const remaining = content.substring(lastIndex).trim();
    if (remaining) {
        const summary = makeSummary(remaining);
        if (summary) {
            const role = isFirstChunk ? 'meta' : 'assistant';
            messages.push({ role, content: remaining, summary });
        }
    }

    // 如果上面没解析到任何 user-message div，兜底用 ## User/## Assistant 格式
    if (messages.length <= 1) {
        const fallbackMsgs: ParsedMessage[] = [];
        const parts = content.split(/(?=^## (?:User|Assistant))/gm);
        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) { continue; }
            let role: 'user' | 'assistant' = 'assistant';
            let msgContent = trimmed;
            if (trimmed.startsWith('## User')) {
                role = 'user';
                msgContent = trimmed.replace(/^## User\s*/, '');
            } else if (trimmed.startsWith('## Assistant')) {
                role = 'assistant';
                msgContent = trimmed.replace(/^## Assistant\s*/, '');
            }
            if (msgContent.trim()) {
                fallbackMsgs.push({ role, content: msgContent, summary: makeSummary(msgContent) });
            }
        }
        if (fallbackMsgs.length > 1) { return fallbackMsgs; }
    }

    return messages;
}

export function renderSharePage(record: ShareRecord, allShares: ShareMetadata[]): string {
    const meta = record.metadata;
    const shareDate = new Date(meta.shareTime).toLocaleString('zh-CN');
    const createDate = new Date(meta.createTime).toLocaleString('zh-CN');

    const messages = parseMessages(record.content);
    const marked = new Marked();

    // 消息卡片 — 全部垂直堆叠在 .messages-list 中
    // T075: 改为懒加载方案，不再截断内容
    // 超长消息使用分段渲染：先渲染预览，点击后加载完整内容
    const LAZY_LOAD_THRESHOLD = 100000; // 超过此长度启用懒加载
    const PREVIEW_LENGTH = 10000; // 预览长度

    const messageCards = messages.map((msg, idx) => {
        const isMeta = msg.role === 'meta';
        const roleClass = isMeta ? 'meta' : (msg.role === 'user' ? 'user' : 'assistant');
        
        let htmlContent: string;
        // 方案A: 预处理消息内容，将危险的模板字符串 ${...} 转义，避免被 Markdown 解析器误解析
        const safeContent = sanitizeForMarkdown(msg.content);
        const isLongContent = safeContent.length > LAZY_LOAD_THRESHOLD;
        
        try {
            if (isLongContent) {
                // T075: 懒加载方案 - 先显示预览，保留完整内容在隐藏区域
                const previewContent = safeContent.substring(0, PREVIEW_LENGTH);
                const previewParsed = marked.parse(previewContent) as string;
                const previewHtml = balanceHtml(previewParsed);
                
                // 完整内容 - 必须执行 balanceHtml 确保 HTML 标签平衡，否则会破坏页面布局
                const fullParsed = marked.parse(safeContent) as string;
                const fullHtml = balanceHtml(fullParsed);
                
                htmlContent = `
                    <div class="preview-content" id="preview-${idx}">${previewHtml}</div>
                    <div class="lazy-load-notice" style="padding:12px;background:#e3f2fd;border:1px solid #2196f3;border-radius:6px;margin-top:12px;color:#1565c0;font-size:13px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                            <span>📄 内容较长（${msg.content.length.toLocaleString()} 字符），已显示前 ${PREVIEW_LENGTH.toLocaleString()} 字符预览</span>
                            <button class="load-full-btn" onclick="loadFullContent(${idx})" style="padding:6px 12px;background:#2196f3;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">
                                📖 加载完整内容
                            </button>
                        </div>
                    </div>
                    <div class="full-content" id="full-${idx}" style="display:none;">${fullHtml}</div>
                `;
            } else {
                // 正常内容直接渲染 - 必须执行 balanceHtml 确保 HTML 标签平衡
                const parsed = marked.parse(safeContent) as string;
                htmlContent = balanceHtml(parsed);
            }
        } catch (e) {
            htmlContent = `<p>${escapeHtml(msg.content.substring(0, 1000))}${msg.content.length > 1000 ? '...' : ''}</p>`;
        }

        // meta 类型（会话元数据）不显示图标和角色标签
        const headerHtml = isMeta ? '' : (() => {
            const roleLabel = msg.role === 'user' ? '用户' : 'AI';
            const iconClass = msg.role === 'user' ? 'user' : 'ai';
            const iconEmoji = msg.role === 'user' ? '👤' : '🤖';
            return `<div class="message-header">
                <span class="role-icon ${iconClass}">${iconEmoji}</span>
                <span>${roleLabel}</span>
            </div>`;
        })();

        return `<div class="message-card ${roleClass}" id="msg-${idx}">
            ${headerHtml}
            <div class="message-body collapsed" id="msgBody-${idx}">
                <div class="message-content">${htmlContent}</div>
            </div>
            <div class="msg-toggle-bar" id="msgToggle-${idx}">
                <button class="msg-toggle-btn" onclick="toggleMsg(${idx})"><span class="arrow">▼</span> 展开全部</button>
            </div>
        </div>`;
    }).join('');

    // 左侧会话列表项 (REQ 4.3)
    const sessionListItems = allShares.map((share, idx) => {
        const isActive = share.uuid === meta.uuid;
        return `<a class="session-item ${isActive ? 'active' : ''}" href="/share/${share.uuid}" title="${escapeHtml(share.title)}">
            <span class="session-num">${idx + 1}.</span>${escapeHtml(share.title)}
        </a>`;
    }).join('');

    // 左侧消息大纲项 (REQ 4.3)
    // 用户消息用数字序号，AI 和 meta 保持原标签
    let userMsgCounter = 0;
    const outlineItems = messages.map((msg, idx) => {
        const isMeta = msg.role === 'meta';
        const isUser = msg.role === 'user';
        const roleClass = isMeta ? 'meta' : (isUser ? 'user' : 'ai');
        
        let roleLabel: string;
        if (isMeta) {
            roleLabel = '[信息]';
        } else if (isUser) {
            userMsgCounter++;
            roleLabel = `[${userMsgCounter}]`;
        } else {
            roleLabel = '[AI]';
        }
        
        return `<a class="outline-item" href="#msg-${idx}" onclick="scrollToMsg(${idx});return false;" title="${escapeHtml(msg.summary)}">
            <span class="msg-role ${roleClass}">${roleLabel}</span>${escapeHtml(msg.summary)}
        </a>`;
    }).join('');

    // fallback
    let fallbackContent = '';
    if (messages.length === 0) {
        try {
            fallbackContent = balanceHtml(marked.parse(record.content) as string);
        } catch {
            fallbackContent = `<pre>${escapeHtml(record.content)}</pre>`;
        }
    }

    return `
    <div class="main-container">
        <!-- 左侧面板 (REQ 4.3) -->
        <div class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <span>大纲</span>
                <button class="sidebar-toggle" onclick="toggleSidebar()" title="折叠/展开">◄</button>
            </div>

            <div class="search-box">
                <input type="text" placeholder="🔍 搜索..." id="sidebarSearch" oninput="filterItems(this.value)">
            </div>

            <div class="section-title" onclick="toggleSection('sessionSection', this)">
                <span class="arrow">▼</span> 会话列表 <span class="session-count">(${allShares.length})</span>
            </div>
            <div class="session-list" id="sessionSection">
                ${sessionListItems}
            </div>

            <!-- 会话列表和大纲之间的可拖动分隔条 -->
            <div class="section-resizer" id="sectionResizer" title="拖动调整高度"></div>

            <div class="section-title" onclick="toggleSection('outlineSection', this)">
                <span class="arrow">▼</span> 消息大纲 <span class="msg-count">(${userMsgCounter})</span>
            </div>
            <div class="outline-list" id="outlineSection">
                ${outlineItems}
            </div>
        </div>

        <!-- 可拖动分隔条 -->
        <div class="sidebar-resizer" id="sidebarResizer"></div>

        <!-- 返回顶部按钮（放在滚动容器外面，用 fixed 定位） -->
        <button class="back-to-top" id="backToTop" title="返回顶部" onclick="scrollToTop()">↑</button>

        <!-- 右侧内容区 (REQ 4.5) — 整体可滚动，仅顶部 navbar 固定 -->
        <div class="content-area-detail" id="contentScroll">
            <div class="content-inner">
                <div class="share-title">${escapeHtml(meta.title)}</div>
                <div class="share-project">工程: ${escapeHtml(meta.projectName)}</div>
                <div class="action-bar">
                    <button class="btn" onclick="window.print()">🖨 打印</button>
                    <a class="btn" href="/download/${meta.uuid}">⬇ 下载</a>
                </div>
                <div class="meta-info">
                    <strong>分享人:</strong> ${escapeHtml(meta.sharer)} &nbsp;|&nbsp;
                    <strong>分享时间:</strong> ${shareDate} &nbsp;|&nbsp;
                    <strong>格式:</strong> ${escapeHtml(meta.contentFormat)} &nbsp;|&nbsp;
                    <strong>创建:</strong> ${createDate}
                </div>
                <h3 style="margin:18px 0 14px;color:#1a2332;font-size:16px;">内容:</h3>
                <div class="messages-list">
                    ${messageCards || '<div class="message-content">' + fallbackContent + '</div>'}
                </div>
            </div>
        </div>
    </div>

    <script>
        var SIDEBAR_DEFAULT_WIDTH = 220; // 默认侧边栏宽度
        var sidebarLastWidth = SIDEBAR_DEFAULT_WIDTH; // 记录用户拖动的宽度

        function toggleSidebar() {
            var sb = document.getElementById('sidebar');
            var btn = sb.querySelector('.sidebar-toggle');
            var isCollapsed = sb.classList.contains('collapsed');
            
            if (isCollapsed) {
                // 展开时恢复用户之前拖动的宽度
                sb.classList.remove('collapsed');
                sb.style.width = sidebarLastWidth + 'px';
                sb.style.minWidth = sidebarLastWidth + 'px';
                btn.textContent = '◄';
            } else {
                // 折叠前先记录当前宽度
                sidebarLastWidth = sb.offsetWidth || SIDEBAR_DEFAULT_WIDTH;
                // 折叠时清除内联样式，让 CSS 类控制宽度
                sb.classList.add('collapsed');
                sb.style.width = '';
                sb.style.minWidth = '';
                btn.textContent = '►';
            }
        }

        function toggleSection(id, el) {
            var sec = document.getElementById(id);
            var hidden = sec.style.display === 'none';
            sec.style.display = hidden ? '' : 'none';
            el.classList.toggle('collapsed', !hidden);
        }

        function scrollToMsg(idx) {
            var el = document.getElementById('msg-' + idx);
            if (!el) return;
            var container = document.getElementById('contentScroll');
            if (container) {
                // 使用 getBoundingClientRect 计算相对滚动容器的位置，避免 offsetTop 受嵌套影响
                var elRect = el.getBoundingClientRect();
                var contRect = container.getBoundingClientRect();
                var scrollTop = container.scrollTop + (elRect.top - contRect.top) - 24;
                container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
            } else {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            el.style.transition = 'box-shadow 0.3s';
            el.style.boxShadow = '0 0 0 3px rgba(74,144,217,0.4)';
            setTimeout(function() { el.style.boxShadow = ''; }, 1500);
        }

        function filterItems(kw) {
            var lower = kw.toLowerCase();
            document.querySelectorAll('#sessionSection .session-item').forEach(function(el) {
                el.style.display = el.textContent.toLowerCase().indexOf(lower) >= 0 ? '' : 'none';
            });
            document.querySelectorAll('#outlineSection .outline-item').forEach(function(el) {
                el.style.display = el.textContent.toLowerCase().indexOf(lower) >= 0 ? '' : 'none';
            });
        }

        // 长消息折叠/展开
        // 方案C：按钮默认显示，initCollapse 负责隐藏短消息的按钮
        // 多次执行保障：DOMContentLoaded + 延迟500ms + window.onload
        var MSG_COLLAPSE_HEIGHT = 400; // 超过此高度(px)则折叠
        var collapseInitDone = false;

        function initCollapse() {
            var bodies = document.querySelectorAll('.message-body');
            if (!bodies.length) return;

            bodies.forEach(function(body) {
                var idx = body.id.replace('msgBody-', '');
                var toggleBar = document.getElementById('msgToggle-' + idx);
                if (!toggleBar) return;

                // scrollHeight > 0 说明浏览器已完成该元素的布局
                if (body.scrollHeight > 0 && body.scrollHeight <= MSG_COLLAPSE_HEIGHT) {
                    // 短消息：不需要折叠，移除 collapsed 类并隐藏按钮
                    body.classList.remove('collapsed');
                    toggleBar.style.display = 'none';
                } else {
                    // 长消息或尚未布局完成：保持折叠状态，显示按钮
                    body.classList.add('collapsed');
                    toggleBar.style.display = '';
                }
            });

            collapseInitDone = true;
        }

        function toggleMsg(idx) {
            var body = document.getElementById('msgBody-' + idx);
            var btn = document.querySelector('#msgToggle-' + idx + ' .msg-toggle-btn');
            if (!body || !btn) return;
            if (body.classList.contains('collapsed')) {
                body.classList.remove('collapsed');
                body.classList.add('expanded');
                btn.innerHTML = '<span class="arrow" style="transform:rotate(180deg)">▼</span> 折叠';
                btn.classList.add('expanded');
            } else {
                body.classList.remove('expanded');
                body.classList.add('collapsed');
                btn.innerHTML = '<span class="arrow">▼</span> 展开全部';
                btn.classList.remove('expanded');
            }
        }

        // 多重保障：确保大页面也能正确初始化
        // 1) DOMContentLoaded — 首次尝试
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCollapse);
        } else {
            initCollapse();
        }
        // 2) 延迟 500ms 重新检查 — 应对大页面布局延迟
        setTimeout(function() { if (!collapseInitDone || document.querySelector('.message-body')) initCollapse(); }, 500);
        // 3) window.onload — 所有资源加载完毕后最终检查
        window.addEventListener('load', function() { initCollapse(); });

        // ========== T075: 懒加载完整内容 ==========
        function loadFullContent(idx) {
            var previewEl = document.getElementById('preview-' + idx);
            var fullEl = document.getElementById('full-' + idx);
            var noticeEl = previewEl ? previewEl.nextElementSibling : null;
            
            if (fullEl && previewEl) {
                // 显示完整内容，隐藏预览
                previewEl.style.display = 'none';
                if (noticeEl && noticeEl.classList.contains('lazy-load-notice')) {
                    noticeEl.style.display = 'none';
                }
                fullEl.style.display = 'block';
                
                // 添加一个"返回预览"按钮
                if (!document.getElementById('backToPreview-' + idx)) {
                    var backBtn = document.createElement('div');
                    backBtn.id = 'backToPreview-' + idx;
                    backBtn.className = 'back-to-preview';
                    backBtn.style.cssText = 'padding:12px;background:#f5f5f5;border:1px solid #ddd;border-radius:6px;margin-top:12px;text-align:center;';
                    backBtn.innerHTML = '<button onclick="showPreview(' + idx + ')" style="padding:6px 12px;background:#757575;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">📋 返回预览模式</button>';
                    fullEl.parentNode.insertBefore(backBtn, fullEl.nextSibling);
                }
            }
        }
        
        function showPreview(idx) {
            var previewEl = document.getElementById('preview-' + idx);
            var fullEl = document.getElementById('full-' + idx);
            var noticeEl = previewEl ? previewEl.nextElementSibling : null;
            var backBtn = document.getElementById('backToPreview-' + idx);
            
            if (fullEl && previewEl) {
                fullEl.style.display = 'none';
                previewEl.style.display = 'block';
                if (noticeEl && noticeEl.classList.contains('lazy-load-notice')) {
                    noticeEl.style.display = 'block';
                }
                if (backBtn) {
                    backBtn.remove();
                }
            }
        }

        // ========== 侧边栏拖动调整宽度 ==========
        (function() {
            var sidebar = document.getElementById('sidebar');
            var resizer = document.getElementById('sidebarResizer');
            if (!sidebar || !resizer) return;

            var startX, startWidth;
            var minWidth = 160;
            var maxWidth = 500;

            resizer.addEventListener('mousedown', function(e) {
                if (sidebar.classList.contains('collapsed')) return; // 折叠时不允许拖动
                startX = e.clientX;
                startWidth = sidebar.offsetWidth;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            function onMouseMove(e) {
                var dx = e.clientX - startX;
                var newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + dx));
                sidebar.style.width = newWidth + 'px';
                sidebar.style.minWidth = newWidth + 'px';
            }

            function onMouseUp() {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
        })();

        // ========== 返回顶部按钮 ==========
        function scrollToTop() {
            var container = document.getElementById('contentScroll');
            if (container) {
                container.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
        (function() {
            var container = document.getElementById('contentScroll');
            var btn = document.getElementById('backToTop');
            if (!container || !btn) return;
            var SHOW_THRESHOLD = 300; // 滚动超过 300px 显示按钮
            container.addEventListener('scroll', function() {
                if (container.scrollTop > SHOW_THRESHOLD) {
                    btn.classList.add('visible');
                } else {
                    btn.classList.remove('visible');
                }
            });
        })();

        // ========== 会话列表/大纲 高度拖动调整 ==========
        (function() {
            var sessionList = document.getElementById('sessionSection');
            var sectionResizer = document.getElementById('sectionResizer');
            var sidebar = document.getElementById('sidebar');
            if (!sessionList || !sectionResizer || !sidebar) return;

            var STORAGE_KEY = 'csh_session_list_height';
            var startY, startHeight;
            var minHeight = 80;
            var maxHeight = 400;

            // 从 localStorage 恢复保存的高度
            var savedHeight = localStorage.getItem(STORAGE_KEY);
            if (savedHeight) {
                var h = parseInt(savedHeight, 10);
                if (h >= minHeight && h <= maxHeight) {
                    sessionList.style.height = h + 'px';
                }
            }

            sectionResizer.addEventListener('mousedown', function(e) {
                if (sidebar.classList.contains('collapsed')) return;
                startY = e.clientY;
                startHeight = sessionList.offsetHeight;
                document.body.style.cursor = 'row-resize';
                document.body.style.userSelect = 'none';
                document.addEventListener('mousemove', onMouseMoveSection);
                document.addEventListener('mouseup', onMouseUpSection);
            });

            function onMouseMoveSection(e) {
                var dy = e.clientY - startY;
                var newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + dy));
                sessionList.style.height = newHeight + 'px';
            }

            function onMouseUpSection() {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                // 保存用户偏好高度到 localStorage
                localStorage.setItem(STORAGE_KEY, sessionList.offsetHeight);
                document.removeEventListener('mousemove', onMouseMoveSection);
                document.removeEventListener('mouseup', onMouseUpSection);
            }
        })();
    </script>`;
}

/**
 * HTML 平衡函数 — 确保 marked.parse() 输出的 HTML 中所有块级标签都正确闭合
 * 防止未闭合的 <div>/<details>/<section> 等标签破坏外层 DOM 结构
 * 
 * 此函数执行两个操作：
 * 1. 移除多余的闭合标签（没有对应开标签的闭标签）
 * 2. 补齐未闭合的开标签
 */
function balanceHtml(html: string): string {
    // 包含 summary 标签，因为分享内容中常有 <details><summary>...</summary>...</details> 结构
    const blockTags = ['div', 'details', 'summary', 'section', 'article', 'aside', 'main', 'nav', 'figure', 'figcaption', 'pre', 'table', 'tbody', 'thead', 'tr'];
    
    // 第一遍：识别并移除多余的闭标签
    // 记录需要移除的闭标签位置
    const stack: Array<{tag: string, index: number}> = [];
    const orphanCloseTagPositions: Array<{start: number, length: number}> = [];
    
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g;
    let m: RegExpExecArray | null;

    while ((m = tagRegex.exec(html)) !== null) {
        const fullTag = m[0];
        const tagName = m[1].toLowerCase();
        const tagStart = m.index;

        if (!blockTags.includes(tagName)) { continue; }
        if (fullTag.endsWith('/>')) { continue; } // 自闭合

        if (fullTag.startsWith('</')) {
            // 闭标签 — 找到匹配的开标签弹出
            let matched = false;
            for (let i = stack.length - 1; i >= 0; i--) {
                if (stack[i].tag === tagName) {
                    stack.splice(i, 1);
                    matched = true;
                    break;
                }
            }
            // 如果没有匹配的开标签，标记为孤立闭标签需要移除
            if (!matched) {
                orphanCloseTagPositions.push({ start: tagStart, length: fullTag.length });
            }
        } else {
            // 开标签
            stack.push({ tag: tagName, index: tagStart });
        }
    }

    // 从后往前移除孤立的闭标签（从后往前避免索引偏移）
    let balanced = html;
    for (let i = orphanCloseTagPositions.length - 1; i >= 0; i--) {
        const pos = orphanCloseTagPositions[i];
        balanced = balanced.substring(0, pos.start) + balanced.substring(pos.start + pos.length);
    }

    // 第二遍：补齐未闭合的开标签
    // 需要重新解析，因为移除操作可能改变了索引
    const stack2: string[] = [];
    const tagRegex2 = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g;
    
    while ((m = tagRegex2.exec(balanced)) !== null) {
        const fullTag = m[0];
        const tagName = m[1].toLowerCase();

        if (!blockTags.includes(tagName)) { continue; }
        if (fullTag.endsWith('/>')) { continue; }

        if (fullTag.startsWith('</')) {
            const idx = stack2.lastIndexOf(tagName);
            if (idx >= 0) { stack2.splice(idx, 1); }
        } else {
            stack2.push(tagName);
        }
    }

    // 补齐未闭合的标签（从栈顶往下闭合）
    while (stack2.length > 0) {
        const tag = stack2.pop()!;
        balanced += `</${tag}>`;
    }
    
    // 安全处理：将消息内容中的 <script> / </script> 标签无害化
    // 避免浏览器将消息中引用的代码片段当作真实的脚本执行或破坏页面结构
    // 使用零宽字符分隔法：<scr + ipt → 不会被解析器识别为标签
    balanced = balanced.replace(/<script(\s|>)/gi, '&lt;script$1');
    balanced = balanced.replace(/<\/script>/gi, '&lt;/script&gt;');

    return balanced;
}

/**
 * 预处理消息内容，将不在代码块内的危险字符转义
 * 防止 Markdown 解析器将消息中引用的源代码误解析为真实结构
 * 
 * 处理项：
 * 1. ${...} 模板字符串语法 → &#36;{...} 避免与 Markdown 链接语法冲突
 */
function sanitizeForMarkdown(content: string): string {
    // 分割内容为代码块和非代码块部分
    // 匹配 ```...``` 代码块（可能跨行）
    const parts: string[] = [];
    let lastIndex = 0;
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        // 非代码块部分 — 需要转义
        if (match.index > lastIndex) {
            parts.push(sanitizeNonCodeContent(content.substring(lastIndex, match.index)));
        }
        // 代码块部分 — 保持原样
        parts.push(match[0]);
        lastIndex = match.index + match[0].length;
    }

    // 剩余的非代码块部分
    if (lastIndex < content.length) {
        parts.push(sanitizeNonCodeContent(content.substring(lastIndex)));
    }

    return parts.join('');
}

function sanitizeNonCodeContent(text: string): string {
    let result = text;
    // 1. 将 ${...} 转义为 HTML 实体，避免被 Markdown 解析器误解析
    // &#36; = $ 的 HTML 实体
    result = result.replace(/\$\{/g, '&#36;{');
    
    // 2. 转义不在 inline code (单反引号) 中的裸 HTML 标签
    // 这些标签如果不在代码块/inline code 中，会被 marked 直接输出为真实 DOM
    // 特别是当对话内容引用了源代码文本时，会破坏页面布局
    // 策略：将 <tag 转义为 &lt;tag（仅针对已知会造成布局破坏的标签）
    // 需要排除已在 inline code 中的部分
    const dangerousTags = ['div', 'span', 'button', 'form', 'input', 'select', 'textarea', 'iframe', 'embed', 'object', 'style', 'link', 'meta', 'head', 'body', 'html'];
    const dangerPattern = new RegExp(`<(\\/?)\\s*(${dangerousTags.join('|')})(\\s|>|\\/)`, 'gi');
    
    // 按 inline code 分割处理（保护反引号内的内容）
    const inlineCodeParts = result.split(/(`[^`]+`)/g);
    result = inlineCodeParts.map((part, i) => {
        if (i % 2 === 1) {
            // 这是 inline code 部分（被反引号包裹），保持原样
            return part;
        }
        // 非 inline code 部分，转义危险的 HTML 标签
        return part.replace(dangerPattern, '&lt;$1$2$3');
    }).join('');
    
    return result;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
