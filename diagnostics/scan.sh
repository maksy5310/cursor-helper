#!/bin/bash

# Cursor 工作空间诊断工具 - Mac/Linux 启动脚本
# 用法: ./scan.sh

echo ""
echo "========================================"
echo "  Cursor 工作空间诊断工具"
echo "========================================"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js"
    echo ""
    echo "请先安装 Node.js: https://nodejs.org/"
    echo ""
    echo "Mac 用户可以使用 Homebrew 安装:"
    echo "  brew install node"
    echo ""
    exit 1
fi

# 显示 Node.js 版本
echo "检测到 Node.js:"
node --version
echo ""

# 运行诊断脚本
echo "开始扫描工作空间..."
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
node "$SCRIPT_DIR/scan-workspaces.js"

echo ""
echo "========================================"
echo ""

# 检查诊断报告是否生成
if [ -f "workspace-diagnostic-report.json" ]; then
    echo "诊断报告已生成: workspace-diagnostic-report.json"
    echo ""
    echo "你可以:"
    echo "1. 查看终端输出了解基本信息"
    echo "2. 打开 workspace-diagnostic-report.json 查看详细信息"
    echo "3. 将诊断报告发送给开发者"
    echo ""
    
    # Mac 用户可以直接打开报告
    if [[ "$OSTYPE" == "darwin"* ]]; then
        read -p "是否在 Finder 中显示诊断报告? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            open -R workspace-diagnostic-report.json
        fi
    fi
else
    echo "[警告] 诊断报告未生成"
    echo ""
fi
