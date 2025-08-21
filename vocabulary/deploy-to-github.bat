@echo off
echo ========================================
echo    單字學習 App - GitHub Pages 部署
echo ========================================
echo.

echo 請按照以下步驟操作：
echo.
echo 1. 在 GitHub 上創建名為 "vocabulary" 的倉庫
echo 2. 將此目錄下的所有文件上傳到該倉庫
echo 3. 在倉庫設置中啟用 GitHub Pages
echo 4. 選擇 main 分支作為源
echo.
echo 部署完成後，你的應用將可以通過以下網址訪問：
echo https://z12399.github.io/vocabulary/
echo.

echo 需要我幫你打開 GitHub 創建倉庫頁面嗎？
set /p open_github="輸入 Y 打開 GitHub (Y/N): "

if /i "%open_github%"=="Y" (
    start https://github.com/new
    echo.
    echo GitHub 頁面已打開！
    echo 請創建名為 "vocabulary" 的倉庫
) else (
    echo.
    echo 好的，請手動前往 https://github.com/new 創建倉庫
)

echo.
echo 創建倉庫後，請將此目錄下的所有文件上傳到 GitHub
echo.
echo 文件包括：
echo - index.html
echo - vite.svg
echo - assets/ 資料夾
echo - README.md
echo - GITHUB_PAGES_DEPLOY.md
echo.
echo 上傳完成後，在倉庫設置中啟用 GitHub Pages 即可！
echo.
pause
