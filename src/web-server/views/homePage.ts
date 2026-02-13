/**
 * 首页模板 — 会话列表总览 (REQ 4.6)
 * 固定2列网格布局
 */
import { ShareMetadata } from '../../services/localShareService';

export function renderHomePage(shares: ShareMetadata[], keyword: string): string {
    const shareCards = shares.map(share => {
        const shareDate = new Date(share.shareTime).toLocaleString('zh-CN');
        return `<a class="share-card" href="/share/${share.uuid}" data-uuid="${share.uuid}" data-title="${escapeHtml(share.title)}" oncontextmenu="showContextMenu(event, '${share.uuid}', '${escapeHtml(share.title).replace(/'/g, "\\'")}')">
                <div class="share-card-title">📄 ${escapeHtml(share.title)}</div>
                <div class="share-card-meta">
                    <span>工程: ${escapeHtml(share.projectName)}</span>
                    <span>分享人: ${escapeHtml(share.sharer)}</span>
                </div>
                <div class="share-card-date">${shareDate}</div>
            </a>`;
    }).join('');

    return `
    <div class="main-container">
        <div class="content-area-home">
            <div class="content-card">
                <div class="home-header">
                    <h1>Cursor Session Helper</h1>
                    <div class="count">共 ${shares.length} 条分享记录</div>
                </div>

                <div class="home-actions" style="display:flex;gap:12px;margin-bottom:16px;align-items:center;">
                    <div class="home-search" style="flex:1;margin-bottom:0;">
                        <input type="text" id="homeSearch" placeholder="🔍 搜索会话..." value="${escapeHtml(keyword)}" oninput="filterCards(this.value)">
                    </div>
                    <button class="btn import-btn" onclick="document.getElementById('importFiles').click()">
                        📥 导入会话
                    </button>
                    <input type="file" id="importFiles" accept=".md" multiple style="display:none;" onchange="handleImport(this.files)">
                </div>

                <div id="importStatus" style="display:none;margin-bottom:16px;padding:12px;border-radius:6px;"></div>

                ${shares.length > 0
                    ? '<div class="share-grid">' + shareCards + '</div><div id="pagination" class="pagination"></div>'
                    : '<div style="text-align:center;padding:40px;color:#999;">暂无分享记录</div>'}
            </div>
        </div>
    </div>

    <!-- 右键上下文菜单 -->
    <div id="contextMenu" class="context-menu" style="display:none;">
        <div class="context-menu-item delete-item" onclick="confirmDelete()">
            🗑️ 删除会话
        </div>
    </div>

    <!-- 删除确认对话框 -->
    <div id="deleteDialog" class="delete-dialog-overlay" style="display:none;">
        <div class="delete-dialog">
            <div class="delete-dialog-title">⚠️ 确认删除</div>
            <div class="delete-dialog-content">
                确定要删除会话 "<span id="deleteDialogTitle"></span>" 吗？<br>
                <small style="color:#c62828;">此操作不可撤销！</small>
            </div>
            <div class="delete-dialog-actions">
                <button class="btn btn-cancel" onclick="closeDeleteDialog()">取消</button>
                <button class="btn btn-danger" onclick="executeDelete()">确认删除</button>
            </div>
        </div>
    </div>

    <script>
        // ========== 分页逻辑 ==========
        var PAGE_SIZE = 12;
        var currentPage = 1;

        function getVisibleCards() {
            var cards = document.querySelectorAll('.share-grid .share-card');
            var visible = [];
            cards.forEach(function(card) {
                if (!card.getAttribute('data-filtered-out')) {
                    visible.push(card);
                }
            });
            return visible;
        }

        function applyPagination() {
            var visible = getVisibleCards();
            var totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            var start = (currentPage - 1) * PAGE_SIZE;
            var end = start + PAGE_SIZE;

            // 先隐藏所有卡片
            var allCards = document.querySelectorAll('.share-grid .share-card');
            allCards.forEach(function(card) { card.style.display = 'none'; });

            // 显示当前页的可见卡片
            for (var i = 0; i < visible.length; i++) {
                if (i >= start && i < end) {
                    visible[i].style.display = '';
                }
            }

            renderPagination(visible.length, totalPages);

            // 更新计数
            var countEl = document.querySelector('.home-header .count');
            var searchKeyword = (document.getElementById('homeSearch') || {}).value || '';
            if (countEl) {
                if (searchKeyword.trim()) {
                    countEl.textContent = '找到 ' + visible.length + ' 条匹配记录';
                } else {
                    countEl.textContent = '共 ' + visible.length + ' 条分享记录';
                }
            }
        }

        function renderPagination(totalItems, totalPages) {
            var container = document.getElementById('pagination');
            if (!container) return;

            if (totalItems <= PAGE_SIZE) {
                container.innerHTML = '';
                return;
            }

            var html = '<span class="pagination-info">第 ' + currentPage + '/' + totalPages + ' 页</span>';

            // 上一页
            html += '<button class="pagination-btn' + (currentPage <= 1 ? ' disabled' : '') + '" onclick="goToPage(' + (currentPage - 1) + ')"' + (currentPage <= 1 ? ' disabled' : '') + '>◀ 上一页</button>';

            // 页码按钮（最多显示7个）
            var pages = getPaginationRange(currentPage, totalPages);
            for (var i = 0; i < pages.length; i++) {
                var p = pages[i];
                if (p === '...') {
                    html += '<span class="pagination-ellipsis">...</span>';
                } else {
                    html += '<button class="pagination-btn' + (p === currentPage ? ' active' : '') + '" onclick="goToPage(' + p + ')">' + p + '</button>';
                }
            }

            // 下一页
            html += '<button class="pagination-btn' + (currentPage >= totalPages ? ' disabled' : '') + '" onclick="goToPage(' + (currentPage + 1) + ')"' + (currentPage >= totalPages ? ' disabled' : '') + '>下一页 ▶</button>';

            container.innerHTML = html;
        }

        function getPaginationRange(current, total) {
            if (total <= 7) {
                var arr = [];
                for (var i = 1; i <= total; i++) arr.push(i);
                return arr;
            }
            if (current <= 3) return [1, 2, 3, 4, '...', total];
            if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];
            return [1, '...', current - 1, current, current + 1, '...', total];
        }

        function goToPage(page) {
            var visible = getVisibleCards();
            var totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
            if (page < 1 || page > totalPages) return;
            currentPage = page;
            applyPagination();
            // 滚动到顶部
            var homeArea = document.querySelector('.content-area-home');
            if (homeArea) homeArea.scrollTop = 0;
        }

        // 初始化分页
        document.addEventListener('DOMContentLoaded', function() {
            applyPagination();
        });

        async function handleImport(inputFiles) {
            if (!inputFiles || inputFiles.length === 0) return;
            
            var statusDiv = document.getElementById('importStatus');
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#e3f2fd';
            statusDiv.style.color = '#1565c0';
            statusDiv.textContent = '正在读取 ' + inputFiles.length + ' 个文件...';
            
            // 读取所有文件内容
            var filesData = [];
            for (var i = 0; i < inputFiles.length; i++) {
                try {
                    var content = await readFileAsText(inputFiles[i]);
                    filesData.push({
                        name: inputFiles[i].name,
                        content: content
                    });
                } catch (e) {
                    filesData.push({
                        name: inputFiles[i].name,
                        error: '无法读取文件'
                    });
                }
            }
            
            statusDiv.textContent = '正在导入 ' + filesData.length + ' 个文件...';
            
            try {
                var response = await fetch('/api/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ files: filesData })
                });
                
                var result = await response.json();
                
                if (result.success) {
                    statusDiv.style.background = '#e8f5e9';
                    statusDiv.style.color = '#2e7d32';
                    
                    if (result.imported > 0) {
                        // 导入成功后自动刷新页面
                        statusDiv.innerHTML = '✅ 成功导入 ' + result.imported + ' 个文件，正在刷新页面...' + 
                            (result.errors && result.errors.length > 0 
                                ? '<br>⚠️ ' + result.errors.length + ' 个文件导入失败：<br>' + result.errors.map(function(e) { return '• ' + e; }).join('<br>')
                                : '');
                        setTimeout(function() { window.location.reload(); }, 1000);
                    } else {
                        statusDiv.innerHTML = '⚠️ 没有成功导入任何文件' + 
                            (result.errors && result.errors.length > 0 
                                ? '<br>• ' + result.errors.join('<br>• ')
                                : '');
                    }
                } else {
                    statusDiv.style.background = '#ffebee';
                    statusDiv.style.color = '#c62828';
                    statusDiv.innerHTML = '❌ 导入失败：' + result.message + 
                        (result.errors && result.errors.length > 0 
                            ? '<br>• ' + result.errors.join('<br>• ')
                            : '');
                }
            } catch (err) {
                statusDiv.style.background = '#ffebee';
                statusDiv.style.color = '#c62828';
                statusDiv.textContent = '❌ 导入失败：' + (err.message || '网络错误');
            }
            
            // 清空文件选择
            document.getElementById('importFiles').value = '';
        }
        
        function readFileAsText(file) {
            return new Promise(function(resolve, reject) {
                var reader = new FileReader();
                reader.onload = function(e) { resolve(e.target.result); };
                reader.onerror = function() { reject(new Error('读取失败')); };
                reader.readAsText(file, 'UTF-8');
            });
        }

        // 实时过滤会话卡片 - 只匹配会话名称（data-title 属性），联动分页
        function filterCards(keyword) {
            var lower = keyword.toLowerCase().trim();
            var cards = document.querySelectorAll('.share-grid .share-card');
            
            cards.forEach(function(card) {
                var title = (card.getAttribute('data-title') || '').toLowerCase();
                var match = !lower || title.indexOf(lower) >= 0;
                if (match) {
                    card.removeAttribute('data-filtered-out');
                } else {
                    card.setAttribute('data-filtered-out', 'true');
                }
            });
            
            // 回到第1页并重新分页
            currentPage = 1;
            applyPagination();
        }

        // ========== 右键菜单相关功能 ==========
        var currentDeleteUuid = null;
        var currentDeleteTitle = '';

        function showContextMenu(event, uuid, title) {
            event.preventDefault();
            event.stopPropagation();
            
            currentDeleteUuid = uuid;
            currentDeleteTitle = title;
            
            var menu = document.getElementById('contextMenu');
            menu.style.display = 'block';
            menu.style.left = event.pageX + 'px';
            menu.style.top = event.pageY + 'px';
            
            // 确保菜单不超出视口
            var rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menu.style.left = (event.pageX - rect.width) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                menu.style.top = (event.pageY - rect.height) + 'px';
            }
        }

        function hideContextMenu() {
            var menu = document.getElementById('contextMenu');
            if (menu) menu.style.display = 'none';
        }

        function confirmDelete() {
            hideContextMenu();
            var dialog = document.getElementById('deleteDialog');
            var titleSpan = document.getElementById('deleteDialogTitle');
            titleSpan.textContent = currentDeleteTitle;
            dialog.style.display = 'flex';
        }

        function closeDeleteDialog() {
            var dialog = document.getElementById('deleteDialog');
            dialog.style.display = 'none';
            currentDeleteUuid = null;
            currentDeleteTitle = '';
        }

        async function executeDelete() {
            if (!currentDeleteUuid) return;
            
            var uuid = currentDeleteUuid;
            closeDeleteDialog();
            
            try {
                var response = await fetch('/api/shares/' + uuid, {
                    method: 'DELETE'
                });
                
                var result = await response.json();
                
                if (result.success) {
                    // 删除成功，从页面移除卡片
                    var card = document.querySelector('.share-card[data-uuid="' + uuid + '"]');
                    if (card) {
                        card.style.transition = 'opacity 0.3s, transform 0.3s';
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.9)';
                        setTimeout(function() {
                            card.remove();
                            // 重新计算分页
                            var cards = document.querySelectorAll('.share-grid .share-card');
                            if (cards.length === 0) {
                                var grid = document.querySelector('.share-grid');
                                if (grid) {
                                    grid.outerHTML = '<div style="text-align:center;padding:40px;color:#999;">暂无分享记录</div>';
                                }
                                var pagination = document.getElementById('pagination');
                                if (pagination) pagination.innerHTML = '';
                            } else {
                                applyPagination();
                            }
                        }, 300);
                    }
                } else {
                    alert('删除失败：' + (result.message || '未知错误'));
                }
            } catch (err) {
                alert('删除失败：' + (err.message || '网络错误'));
            }
        }

        // 点击其他区域关闭右键菜单
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.context-menu')) {
                hideContextMenu();
            }
        });

        // 按 Esc 键关闭右键菜单和对话框，←→ 键翻页
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideContextMenu();
                closeDeleteDialog();
            }
            // 键盘翻页（仅当焦点不在输入框时）
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                if (e.key === 'ArrowLeft') {
                    goToPage(currentPage - 1);
                } else if (e.key === 'ArrowRight') {
                    goToPage(currentPage + 1);
                }
            }
        });
    </script>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
