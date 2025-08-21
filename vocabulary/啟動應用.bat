@echo off
echo 正在啟動單字學習 App...
echo.
echo 請選擇瀏覽器：
echo 1. 使用默認瀏覽器
echo 2. 使用 Chrome
echo 3. 使用 Firefox
echo 4. 使用 Edge
echo.
set /p choice="請輸入選擇 (1-4): "

if "%choice%"=="1" (
    start index.html
) else if "%choice%"=="2" (
    start chrome index.html
) else if "%choice%"=="3" (
    start firefox index.html
) else if "%choice%"=="4" (
    start msedge index.html
) else (
    echo 無效選擇，使用默認瀏覽器啟動...
    start index.html
)

echo.
echo 應用已啟動！如果瀏覽器沒有自動打開，請手動雙擊 index.html 文件
echo.
pause
