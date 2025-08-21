@echo off
chcp 65001 >nul
echo ========================================
echo    單字學習 App - 自動化部署腳本
echo ========================================
echo.

echo 🚀 開始自動化部署流程...
echo.

REM 檢查 Git 是否安裝
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 錯誤：未檢測到 Git，請先安裝 Git
    echo 下載地址：https://git-scm.com/downloads
    echo.
    pause
    exit /b 1
)

echo ✅ Git 已安裝
echo.

REM 設置變數
set REPO_NAME=vocabulary
set GITHUB_USER=z12399
set GITHUB_URL=https://github.com/%GITHUB_USER%/%REPO_NAME%.git

echo 📍 目標倉庫：%GITHUB_URL%
echo 🌐 部署後網址：https://%GITHUB_USER%.github.io/%REPO_NAME%/
echo.

REM 檢查是否已存在倉庫目錄
if exist "%REPO_NAME%" (
    echo ⚠️  檢測到已存在的 %REPO_NAME% 目錄
    set /p choice="是否刪除並重新創建？(Y/N): "
    if /i "%choice%"=="Y" (
        echo 刪除舊目錄...
        rmdir /s /q "%REPO_NAME%"
    ) else (
        echo 使用現有目錄...
        cd %REPO_NAME%
        goto :existing_repo
    )
)

echo.
echo 🔄 創建新的 Git 倉庫...
git init %REPO_NAME%
cd %REPO_NAME%

echo.
echo 📁 複製部署文件...
xcopy "..\*" "." /E /I /Y >nul

echo.
echo 🔧 初始化 Git 倉庫...
git init
git add .
git commit -m "Initial commit: 單字學習應用 - 高中英文詞彙表"

echo.
echo 🌐 添加遠程倉庫...
git remote add origin %GITHUB_URL%

echo.
echo 📤 推送到 GitHub...
echo 注意：這需要你在 GitHub 上創建倉庫並配置 SSH 金鑰
echo.
set /p continue="是否繼續？(Y/N): "
if /i "%continue%"=="Y" (
    git branch -M main
    git push -u origin main
    if %errorlevel% equ 0 (
        echo.
        echo ✅ 推送成功！
        echo.
        echo 🎉 部署完成！請按照以下步驟啟用 GitHub Pages：
        echo.
        echo 1. 前往 https://github.com/%GITHUB_USER%/%REPO_NAME%
        echo 2. 點擊 Settings 標籤
        echo 3. 左側選擇 Pages
        echo 4. Source 選擇 "Deploy from a branch"
        echo 5. Branch 選擇 "main"
        echo 6. 點擊 Save
        echo.
        echo 等待 5-10 分鐘後，你的應用就可以通過以下網址訪問：
        echo https://%GITHUB_USER%.github.io/%REPO_NAME%/
        echo.
    ) else (
        echo.
        echo ❌ 推送失敗！可能的原因：
        echo - 倉庫尚未在 GitHub 上創建
        echo - 沒有配置 SSH 金鑰
        echo - 網絡連接問題
        echo.
        echo 請手動創建倉庫後重試
    )
) else (
    echo.
    echo ⏸️  已暫停推送操作
    echo 你可以稍後手動執行：git push -u origin main
)

goto :end

:existing_repo
echo.
echo 🔄 更新現有倉庫...
git add .
git commit -m "Update: 單字學習應用更新"
echo.
echo 📤 推送到 GitHub...
git push origin main
if %errorlevel% equ 0 (
    echo ✅ 更新成功！
) else (
    echo ❌ 更新失敗！
)

:end
echo.
echo 📋 部署狀態總結：
echo - 本地倉庫：%CD%
echo - 遠程倉庫：%GITHUB_URL%
echo - 目標網址：https://%GITHUB_USER%.github.io/%REPO_NAME%/
echo.
echo 如需幫助，請查看 GITHUB_PAGES_DEPLOY.md 文件
echo.
pause
