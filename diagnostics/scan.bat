@echo off
chcp 65001 >nul 2>&1
REM Cursor 工作空间诊断工具 - Windows 启动脚本
REM 用法: 双击运行此文件

echo.
echo ========================================
echo   Cursor 工作空间诊断工具
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js
    echo.
    echo 请先安装 Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 显示 Node.js 版本
echo 检测到 Node.js:
node --version
echo.

REM 运行诊断脚本
echo 开始扫描工作空间...
echo.
node "%~dp0scan-workspaces.js"

echo.
echo ========================================
echo.

REM 检查诊断报告是否生成
if exist "workspace-diagnostic-report.json" (
    echo 诊断报告已生成: workspace-diagnostic-report.json
    echo.
    echo 后续操作:
    echo   1. 上方控制台显示了基本信息
    echo   2. JSON 文件包含详细信息
    echo   3. 如需帮助可将报告发送给开发者
    echo.
) else (
    echo [警告] 诊断报告未生成
    echo.
)

pause
