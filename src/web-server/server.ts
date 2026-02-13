/**
 * 独立 Web 服务器入口
 * 可通过 npm run start:server 命令行独立启动
 * 
 * 环境变量：
 *   PORT - 端口号（默认 8080）
 *   CURSOR_SESSION_HELPER_SHARE_DIR - 分享文件存储目录（默认 ~/.cursor-session-helper/shares）
 */
import { createApp } from './app';
import { LocalShareService } from '../services/localShareService';

const PORT = parseInt(process.env.PORT || '8080', 10);
const shareDir = process.env.CURSOR_SESSION_HELPER_SHARE_DIR || undefined;
const shareService = new LocalShareService(shareDir);
const app = createApp(shareService);

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Cursor Session Helper 分享服务已启动: http://localhost:${PORT}`);
    console.log(`存储目录: ${shareService.getShareDirectory()}`);
    console.log('按 Ctrl+C 停止服务器');
});
