@echo off
chcp 65001 >nul
title 單字學習 App - 一鍵部署腳本
color 0A

echo.
echo ███████╗██╗   ██╗███╗   ██╗ ██████╗ ██████╗ ██╗   ██╗
echo ██╔════╝██║   ██║████╗  ██║██╔════╝██╔═══██╗██║   ██║
echo ███████╗██║   ██║██╔██╗ ██║██║     ██║   ██║██║   ██║
echo ╚════██║██║   ██║██║╚██╗██║██║     ██║   ██║╚██╗ ██╔╝
echo ███████║╚██████╔╝██║ ╚████║╚██████╗╚██████╔╝ ╚████╔╝ 
echo ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝   ╚═══╝ 
echo.
echo ========================================
echo    單字學習 App - 一鍵部署腳本
echo ========================================
echo.

echo 🚀 開始自動化部署流程...
echo.

REM 檢查 Git 是否安裝
echo 📋 檢查系統環境...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 錯誤：未檢測到 Git
    echo.
    echo 🔧 解決方案：
    echo 1. 下載並安裝 Git：https://git-scm.com/downloads
    echo 2. 安裝完成後重新運行此腳本
    echo.
    echo 💡 或者，我可以幫你手動部署到 GitHub
    echo.
    set /p manual="是否要手動部署說明？(Y/N): "
    if /i "%manual%"=="Y" (
        echo.
        echo 📖 手動部署步驟：
        echo 1. 前往 https://github.com/new
        echo 2. 創建名為 "vocabulary" 的倉庫
        echo 3. 將此目錄下的所有文件上傳到 GitHub
        echo 4. 在設置中啟用 GitHub Pages
        echo.
        echo 🌐 部署完成後訪問：https://z12399.github.io/vocabulary/
        echo.
    )
    pause
    exit /b 1
)

echo ✅ Git 已安裝
echo.

REM 設置變數
set REPO_NAME=z12399.github.io
set GITHUB_USER=z12399
set GITHUB_URL=https://github.com/%GITHUB_USER%/%REPO_NAME%.git
set LOCAL_REPO_PATH=C:\Users\DefaultUser\Documents\GitHub\z12399.github.io
set TARGET_URL=https://%GITHUB_USER%.github.io/vocabulary/

echo 📍 部署目標：
echo   倉庫名稱：%REPO_NAME%
echo   GitHub用戶：%GITHUB_USER%
echo   本地路徑：%LOCAL_REPO_PATH%
echo   目標網址：%TARGET_URL%
echo.

REM 檢查本地倉庫是否存在
echo 🔄 檢查本地倉庫...
if exist "%LOCAL_REPO_PATH%" (
    echo ✅ 檢測到現有倉庫：%LOCAL_REPO_PATH%
    cd /d "%LOCAL_REPO_PATH%"
    goto :deploy_to_existing
) else (
    echo ⚠️  本地倉庫不存在，需要先克隆倉庫
    echo.
    echo 📁 創建目錄並克隆倉庫...
    mkdir "C:\Users\DefaultUser\Documents\GitHub" >nul 2>&1
    cd /d "C:\Users\DefaultUser\Documents\GitHub"
    
    echo 🌐 克隆倉庫...
    git clone %GITHUB_URL%
    if %errorlevel% neq 0 (
        echo ❌ 克隆失敗！
        echo.
        echo 🔍 可能的原因：
        echo - 網絡連接問題
        echo - Git 配置問題
        echo - 倉庫訪問權限問題
        echo.
        pause
        exit /b 1
    )
    
    cd z12399.github.io
    goto :deploy_to_existing
)

:deploy_to_existing
echo.
echo ✅ 現在位於：%CD%
echo.

REM 拉取最新更改
echo 🔄 拉取最新更改...
git pull origin main >nul 2>&1

REM 檢查是否已存在 vocabulary 目錄
if exist "vocabulary" (
    echo ⚠️  檢測到已存在的 vocabulary 目錄
    set /p choice="是否覆蓋現有的 vocabulary 目錄？(Y/N): "
    if /i "%choice%"=="Y" (
        echo 清理舊的 vocabulary 目錄...
        rmdir /s /q "vocabulary"
    ) else (
        echo 取消部署操作
        pause
        exit /b 0
    )
)

echo.
echo 📁 創建 vocabulary 目錄...
mkdir vocabulary

echo.
echo 📋 複製單字學習應用文件...
cd vocabulary

REM 從 dist 目錄複製所有文件到 vocabulary 目錄
for /f %%f in ('dir /b "%~dp0*.html"') do copy "%~dp0%%f" . >nul
for /f %%f in ('dir /b "%~dp0*.md"') do copy "%~dp0%%f" . >nul
for /f %%f in ('dir /b "%~dp0*.svg"') do copy "%~dp0%%f" . >nul
for /f %%f in ('dir /b "%~dp0*.bat"') do copy "%~dp0%%f" . >nul
for /f %%f in ('dir /b "%~dp0*.sh"') do copy "%~dp0%%f" . >nul
xcopy "%~dp0assets" "assets\" /E /I /Y >nul 2>&1

echo ✅ 文件複製完成
echo.

cd ..

echo 🔧 添加到 Git...
git add vocabulary/ >nul 2>&1
git commit -m "🚀 Add: 單字學習應用 - 高中英文詞彙表" >nul 2>&1

echo.
echo 📤 推送到 GitHub...
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo 🎉 部署成功！
    echo.
    echo ✅ 你的單字學習應用已成功部署到：
    echo 🌐 %TARGET_URL%
    echo.
    echo 📋 GitHub Pages 應該已經自動啟用
    echo 如果沒有，請前往：https://github.com/%GITHUB_USER%/%REPO_NAME%/settings/pages
    echo.
    echo ⏰ 等待 2-5 分鐘，然後就可以訪問你的應用了！
    echo.
    
    set /p open_site="是否要打開目標網址？(Y/N): "
    if /i "%open_site%"=="Y" (
        echo 🔗 打開目標網址...
        start %TARGET_URL%
    )
    
) else (
    echo.
    echo ❌ 推送失敗！
    echo.
    echo 🔍 可能的原因：
    echo - 網絡連接問題
    echo - Git 配置問題
    echo - 權限問題
    echo.
    echo 💡 解決方案：
    echo 1. 檢查網絡連接
    echo 2. 檢查 Git 配置
    echo 3. 重新運行腳本
    echo.
)

goto :end

:end
echo.
echo ========================================
echo 📋 部署狀態總結：
echo ========================================
echo 本地倉庫：%LOCAL_REPO_PATH%
echo 遠程倉庫：%GITHUB_URL%
echo 目標網址：%TARGET_URL%
echo.
echo 📚 應用功能包括：
echo - 📖 6個等級的詞彙學習
echo - 🧠 SRS智能複習系統
echo - 📱 多種測驗模式
echo - 📊 學習進度追蹤
echo - 💾 本地數據存儲
echo - 📝 學習網誌
echo.
echo 🎯 下一步：
echo 1. 等待 2-5 分鐘讓 GitHub Pages 部署完成
echo 2. 訪問 %TARGET_URL% 測試功能
echo 3. 開始你的單字學習之旅
echo.
echo 🌟 恭喜！你的單字學習應用已成功部署！
echo.
pause
