# Release Script for Cursor Assistant Extension
# Version: 0.0.5

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Cursor Assistant v0.0.5 发布脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取版本号
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$version = $packageJson.version

Write-Host "📦 当前版本: $version" -ForegroundColor Green
Write-Host ""

# 1. 检查文件完整性
Write-Host "1️⃣  检查文件完整性..." -ForegroundColor Yellow

$requiredFiles = @(
    "package.json",
    "README.md",
    "CHANGELOG.md",
    "resources/icon.png"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "   ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $file 缺失!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# 2. 编译项目
Write-Host "2️⃣  编译项目..." -ForegroundColor Yellow
npm run compile
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✗ 编译失败!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✓ 编译成功" -ForegroundColor Green
Write-Host ""

# 3. 本地打包测试
Write-Host "3️⃣  本地打包测试..." -ForegroundColor Yellow
npx vsce package
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✗ 打包失败!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✓ 打包成功" -ForegroundColor Green
Write-Host ""

# 4. Git 状态检查
Write-Host "4️⃣  检查 Git 状态..." -ForegroundColor Yellow
$gitStatus = git status --porcelain

if ($gitStatus) {
    Write-Host "   ⚠ 有未提交的变更:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    $commit = Read-Host "   是否提交这些变更? (y/N)"
    
    if ($commit -eq "y" -or $commit -eq "Y") {
        Write-Host "   正在提交变更..." -ForegroundColor Cyan
        git add .
        git commit -m "chore: release v$version - add icon and cleanup commands"
        Write-Host "   ✓ 变更已提交" -ForegroundColor Green
    } else {
        Write-Host "   跳过提交" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✓ 工作区干净" -ForegroundColor Green
}

Write-Host ""

# 5. 确认发布
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "准备发布版本: v$version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "发布步骤:" -ForegroundColor Yellow
Write-Host "  1. 推送代码到 master 分支" -ForegroundColor White
Write-Host "  2. 创建并推送 Git 标签 v$version" -ForegroundColor White
Write-Host "  3. GitHub Actions 自动发布到市场" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "确认发布? (y/N)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host ""
    Write-Host "❌ 发布已取消" -ForegroundColor Red
    exit 0
}

Write-Host ""

# 6. 推送代码
Write-Host "5️⃣  推送代码到远程..." -ForegroundColor Yellow
git push origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✗ 推送失败!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✓ 代码已推送" -ForegroundColor Green
Write-Host ""

# 7. 创建并推送标签
Write-Host "6️⃣  创建并推送标签..." -ForegroundColor Yellow
git tag -a "v$version" -m "Release version $version - Add extension icon and cleanup commands"
git push origin "v$version"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✗ 标签推送失败!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✓ 标签已推送: v$version" -ForegroundColor Green
Write-Host ""

# 8. 完成
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ 发布流程已启动!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "接下来:" -ForegroundColor Yellow
Write-Host "  1. 查看 GitHub Actions 工作流状态" -ForegroundColor White
Write-Host "     https://github.com/howelljiang/cursor-helper/actions" -ForegroundColor Blue
Write-Host ""
Write-Host "  2. 等待自动发布完成（约 5-10 分钟）" -ForegroundColor White
Write-Host ""
Write-Host "  3. 验证市场页面" -ForegroundColor White
Write-Host "     - VS Code Marketplace" -ForegroundColor White
Write-Host "     - Open VSX Registry" -ForegroundColor White
Write-Host ""
Write-Host "🎉 发布完成后记得测试安装!" -ForegroundColor Green
Write-Host ""
