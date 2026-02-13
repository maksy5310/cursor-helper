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
    const PREVIEW_LENGTH = 10000; // 预览目标长度

    const messageCards = messages.map((msg, idx) => {
        const isMeta = msg.role === 'meta';
        const roleClass = isMeta ? 'meta' : (msg.role === 'user' ? 'user' : 'assistant');
        
        let htmlContent: string;
        // 方案A: 预处理消息内容，将危险的模板字符串 ${...} 转义，避免被 Markdown 解析器误解析
        const safeContent = sanitizeForMarkdown(msg.content);
        const isLongContent = safeContent.length > LAZY_LOAD_THRESHOLD;
        
        try {
            if (isLongContent) {
                // T075: 懒加载方案 - 先显示预览，点击后动态加载完整内容
                // A方案：智能截断 - 在代码块/段落边界处截断，避免切断代码块中间
                const cutPoint = findSmartCutPoint(safeContent, PREVIEW_LENGTH);
                const previewContent = safeContent.substring(0, cutPoint);
                const previewParsed = marked.parse(previewContent) as string;
                const previewHtml = containHtml(balanceHtml(previewParsed));
                
                // 完整内容 - 执行 balanceHtml + containHtml 确保 HTML 标签平衡
                // 关键改进：将完整 HTML 编码为 base64 存储在 <script type="text/template"> 中，
                // 避免浏览器解析超长 HTML 时因隐式闭合规则破坏外层 DOM 结构
                const fullParsed = marked.parse(safeContent) as string;
                const fullHtml = containHtml(balanceHtml(fullParsed));
                const fullHtmlBase64 = Buffer.from(fullHtml, 'utf-8').toString('base64');
                
                htmlContent = `
                    <div class="preview-content" id="preview-${idx}">${previewHtml}</div>
                    <div class="lazy-load-notice" style="padding:12px;background:#e3f2fd;border:1px solid #2196f3;border-radius:6px;margin-top:12px;color:#1565c0;font-size:13px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                            <span>📄 内容较长（${msg.content.length.toLocaleString()} 字符），已显示前 ${cutPoint.toLocaleString()} 字符预览</span>
                            <button class="load-full-btn" onclick="loadFullContent(${idx})" style="padding:6px 12px;background:#2196f3;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">
                                📖 加载完整内容
                            </button>
                        </div>
                    </div>
                    <div class="full-content" id="full-${idx}" style="display:none;"></div>
                    <script type="text/template" id="fullData-${idx}">${fullHtmlBase64}</script>
                `;
            } else {
                // 正常内容直接渲染 - 必须执行 balanceHtml + containHtml 确保 HTML 标签平衡
                const parsed = marked.parse(safeContent) as string;
                htmlContent = containHtml(balanceHtml(parsed));
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
            fallbackContent = containHtml(balanceHtml(marked.parse(record.content) as string));
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
                ${meta.description ? `<div class="session-summary">
                    <strong>📋 会话概括:</strong>
                    <div class="summary-text">${escapeHtml(meta.description).replace(/\n/g, '<br>')}</div>
                </div>` : ''}
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
                var card = body.closest('.message-card');
                var toggleBar = document.getElementById('msgToggle-' + idx);

                // 检查 toggleBar 是否在正确的 message-card 内
                // 如果 toggleBar 存在但不在 card 内（孤立DOM，来自消息内容中的模板代码泄漏），
                // 则需要在 card 内动态创建一个新的 toggleBar
                if (toggleBar && card && !card.contains(toggleBar)) {
                    toggleBar = null; // 标记为不存在，后面会重新创建
                }
                // 如果原始 bar 不可用，先检查是否已存在动态创建的 bar
                if (!toggleBar && card) {
                    var existingDynBar = card.querySelector('.msg-toggle-bar[data-msg-idx="' + idx + '"]');
                    if (existingDynBar) toggleBar = existingDynBar;
                }
                if (!toggleBar && card && body.scrollHeight > MSG_COLLAPSE_HEIGHT) {
                    // 动态创建 toggle bar（替代被泄漏的孤立元素）
                    var newBar = document.createElement('div');
                    newBar.className = 'msg-toggle-bar';
                    newBar.setAttribute('data-msg-idx', idx);
                    newBar.innerHTML = '<button class="msg-toggle-btn" onclick="toggleMsgByBody(this)"><span class="arrow">▼</span> 展开全部</button>';
                    // 插入到 body 的父节点中（body 之后）
                    var bodyParent = body.parentNode;
                    if (bodyParent && body.nextSibling) {
                        bodyParent.insertBefore(newBar, body.nextSibling);
                    } else if (bodyParent) {
                        bodyParent.appendChild(newBar);
                    }
                    toggleBar = newBar;
                }
                if (!toggleBar) return;

                // 对于包含懒加载通知的消息，智能处理：
                // - 预览内容高度 > MSG_COLLAPSE_HEIGHT → 折叠预览 + 展开全部按钮
                // - 预览内容高度 <= MSG_COLLAPSE_HEIGHT → 不折叠（直接显示预览和加载按钮）
                var hasLazyNotice = body.querySelector('.lazy-load-notice');
                if (hasLazyNotice) {
                    if (body.scrollHeight > 0 && body.scrollHeight <= MSG_COLLAPSE_HEIGHT) {
                        // 预览内容短：不折叠，隐藏展开按钮
                        body.classList.remove('collapsed');
                        toggleBar.style.display = 'none';
                    } else {
                        // 预览内容长：折叠并显示展开按钮
                        body.classList.add('collapsed');
                        toggleBar.style.display = '';
                    }
                    return;
                }

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

            // 清理：隐藏所有不在 .message-card 内部的孤立 msg-toggle-bar
            // 这些可能是消息内容中引用的模板代码被浏览器渲染为真实 DOM
            var allBars = document.querySelectorAll('.msg-toggle-bar');
            allBars.forEach(function(bar) {
                if (!bar.closest('.message-card')) {
                    bar.style.display = 'none';
                }
            });
        }

        function toggleMsg(idx) {
            var body = document.getElementById('msgBody-' + idx);
            var btn = document.querySelector('#msgToggle-' + idx + ' .msg-toggle-btn');
            if (!body || !btn) {
                // 可能是动态创建的 toggle bar（使用 data-msg-idx）
                var dynBar = document.querySelector('.msg-toggle-bar[data-msg-idx="' + idx + '"]');
                if (dynBar) {
                    btn = dynBar.querySelector('.msg-toggle-btn');
                    body = document.getElementById('msgBody-' + idx);
                }
            }
            if (!body || !btn) return;
            doToggle(body, btn);
        }

        // 通过按钮元素找到关联的 message-body 来切换折叠
        // 用于动态创建的 toggle bar（孤立DOM替代方案）
        function toggleMsgByBody(btnEl) {
            var bar = btnEl.closest('.msg-toggle-bar');
            if (!bar) return;
            var idx = bar.getAttribute('data-msg-idx');
            if (idx) {
                var body = document.getElementById('msgBody-' + idx);
                if (body) {
                    doToggle(body, btnEl);
                    return;
                }
            }
            // 回退：在同一 card 中找 message-body
            var card = bar.closest('.message-card');
            if (!card) return;
            var body = card.querySelector('.message-body');
            if (!body) return;
            doToggle(body, btnEl);
        }

        function doToggle(body, btn) {
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
                // 如果 full-content 为空，从 base64 模板中解码并注入
                if (!fullEl.innerHTML || fullEl.innerHTML.trim() === '') {
                    var templateEl = document.getElementById('fullData-' + idx);
                    if (templateEl) {
                        try {
                            var decoded = atob(templateEl.textContent.trim());
                            // 将 UTF-8 字节序列正确解码为字符串
                            var bytes = new Uint8Array(decoded.length);
                            for (var i = 0; i < decoded.length; i++) {
                                bytes[i] = decoded.charCodeAt(i);
                            }
                            var text = new TextDecoder('utf-8').decode(bytes);
                            fullEl.innerHTML = text;
                        } catch (e) {
                            fullEl.innerHTML = '<p style="color:red;">加载完整内容失败: ' + e.message + '</p>';
                        }
                    }
                }
                
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
    // 包含 summary 和 code 标签：
    // - summary: 分享内容中常有 <details><summary>...</summary>...</details> 结构
    // - code: 超长消息引用源码时可能产生不平衡的 <code> 标签，导致后续内容被吞入 <code> 元素
    const blockTags = ['div', 'details', 'summary', 'section', 'article', 'aside', 'main', 'nav', 'figure', 'figcaption', 'pre', 'code', 'table', 'tbody', 'thead', 'tr'];
    
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
    balanced = balanced.replace(/<script(\s|>)/gi, '&lt;script$1');
    balanced = balanced.replace(/<\/script>/gi, '&lt;/script&gt;');

    // 安全处理：将内容中出现的页面模板专用 HTML 元素完全转义
    // 避免消息引用 sharePage.ts 源代码中的 HTML 片段被浏览器渲染为真实 DOM
    // 这些模式在代码块内也可能因为 Markdown 解析器的特殊处理而"泄漏"
    const templateClassPatterns = ['msg-toggle-bar', 'msg-toggle-btn', 'message-card', 'message-content', 'load-full-btn', 'lazy-load-notice', 'preview-content', 'full-content'];
    for (const cls of templateClassPatterns) {
        // 匹配包含这些 class 或 id 的标签元素，无论开标签还是闭标签
        const openRegex = new RegExp(`<([a-zA-Z]+)(\\s[^>]*(?:class|id)\\s*=\\s*"[^"]*${cls}[^"]*"[^>]*)>`, 'gi');
        balanced = balanced.replace(openRegex, (m) => {
            return m.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        });
    }
    // 额外处理：将带有 onclick="toggleMsg(...)" 或 onclick="loadFullContent(...)" 的按钮转义
    balanced = balanced.replace(/<button[^>]*onclick\s*=\s*"(?:toggleMsg|loadFullContent)\([^)]*\)"[^>]*>[\s\S]*?<\/button>/gi, (m) => {
        return m.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    });

    return balanced;
}

/**
 * 二次净化：确保一段 HTML 是"自包含"的，不会因为多余的闭标签破坏外层 DOM 结构。
 * 
 * 原理：使用栈模拟浏览器的标签匹配过程，逐个扫描所有标签。
 * 遇到闭标签时如果栈中没有对应的开标签，说明这是"溢出"的闭标签，
 * 将其替换为无害的 HTML 注释。
 * 最后补齐栈中未闭合的开标签。
 * 
 * 此函数用于超长消息的 full-content HTML，是 balanceHtml 之后的安全兜底。
 */
function containHtml(html: string): string {
    const protectedTags = ['div', 'details', 'summary', 'section', 'article', 'aside', 'main', 'nav', 'figure', 'figcaption', 'pre', 'code', 'table', 'tbody', 'thead', 'tr'];
    
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g;
    let m: RegExpExecArray | null;
    
    // 第一遍：用栈找出所有多余的闭标签位置
    const stack: string[] = [];
    const orphanClosePositions: Array<{start: number, length: number}> = [];
    
    while ((m = tagRegex.exec(html)) !== null) {
        const fullTag = m[0];
        const tagName = m[1].toLowerCase();
        
        if (!protectedTags.includes(tagName)) { continue; }
        if (fullTag.endsWith('/>')) { continue; }
        
        if (fullTag.startsWith('</')) {
            // 闭标签 — 找栈中匹配的开标签
            const idx = stack.lastIndexOf(tagName);
            if (idx >= 0) {
                stack.splice(idx, 1); // 匹配成功，弹出
            } else {
                // 没有匹配的开标签 — 这是多余的闭标签，记录位置
                orphanClosePositions.push({ start: m.index, length: fullTag.length });
            }
        } else {
            stack.push(tagName);
        }
    }
    
    // 从后往前移除多余的闭标签（替换为 HTML 注释，避免索引偏移问题）
    let result = html;
    for (let i = orphanClosePositions.length - 1; i >= 0; i--) {
        const pos = orphanClosePositions[i];
        result = result.substring(0, pos.start) + `<!-- removed-orphan-close -->` + result.substring(pos.start + pos.length);
    }
    
    // 补齐未闭合的开标签
    while (stack.length > 0) {
        const tag = stack.pop()!;
        result += `</${tag}>`;
    }
    
    return result;
}

/**
 * 预处理消息内容，将不在代码块内的危险字符转义
 * 防止 Markdown 解析器将消息中引用的源代码误解析为真实结构
 * 
 * 处理项：
 * 1. ${...} 模板字符串语法 → &#36;{...} 避免与 Markdown 链接语法冲突
 */
/**
 * 智能截断：在目标长度附近找到合适的截断位置
 * 优先在代码块闭合边界（```）或段落分隔（空行）处截断，
 * 避免切断代码块中间导致 Markdown 解析异常
 */
function findSmartCutPoint(content: string, targetLength: number): number {
    if (content.length <= targetLength) {
        return content.length;
    }

    // 搜索范围：targetLength 的 80% ~ 120%
    const searchStart = Math.floor(targetLength * 0.8);
    const searchEnd = Math.min(Math.floor(targetLength * 1.2), content.length);
    const searchZone = content.substring(searchStart, searchEnd);

    // 优先级 1：找到最近的代码块闭合边界（```后的换行）
    const codeBlockEndPattern = /```\s*\n/g;
    let bestPos = -1;
    let match: RegExpExecArray | null;
    while ((match = codeBlockEndPattern.exec(searchZone)) !== null) {
        bestPos = searchStart + match.index + match[0].length;
    }
    // 取最后一个匹配（离 targetLength 最近的向后方向）
    if (bestPos > 0) {
        // 确认截断位置之前代码块是闭合的（``` 出现偶数次）
        const prefix = content.substring(0, bestPos);
        const backtickCount = (prefix.match(/```/g) || []).length;
        if (backtickCount % 2 === 0) {
            return bestPos;
        }
    }

    // 优先级 2：找到段落分隔（连续两个换行）
    const paragraphBreak = /\n\s*\n/g;
    let lastParagraphPos = -1;
    while ((match = paragraphBreak.exec(searchZone)) !== null) {
        lastParagraphPos = searchStart + match.index + match[0].length;
    }
    if (lastParagraphPos > 0) {
        // 也检查代码块是否闭合
        const prefix = content.substring(0, lastParagraphPos);
        const backtickCount = (prefix.match(/```/g) || []).length;
        if (backtickCount % 2 === 0) {
            return lastParagraphPos;
        }
    }

    // 优先级 3：如果截断位置在未闭合的代码块中，向前找到该代码块的开头
    const prefix = content.substring(0, targetLength);
    const backtickCount = (prefix.match(/```/g) || []).length;
    if (backtickCount % 2 !== 0) {
        // 在未闭合的代码块内，向前找到最近的 ``` 开头位置
        const lastOpening = prefix.lastIndexOf('```');
        if (lastOpening > 0) {
            // 在代码块开头之前截断
            return lastOpening;
        }
    }

    // 兜底：在 targetLength 处的最近换行位置截断
    const nearNewline = content.lastIndexOf('\n', targetLength);
    if (nearNewline > searchStart) {
        return nearNewline + 1;
    }

    return targetLength;
}

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
    
    // 2. B方案改进：将不在 inline code 中的裸 HTML 标签转义为安全格式
    // 使用 HTML 实体转义（&lt; &gt;）确保标签不会被浏览器渲染为真实 DOM
    // 同时用特殊 HTML 包裹使转义后的标签看起来像代码（等宽字体+灰色背景）
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
