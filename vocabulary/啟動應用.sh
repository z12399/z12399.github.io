#!/bin/bash

echo "正在啟動單字學習 App..."
echo ""
echo "請選擇瀏覽器："
echo "1. 使用默認瀏覽器"
echo "2. 使用 Chrome"
echo "3. 使用 Firefox"
echo "4. 使用 Safari (macOS)"
echo ""
read -p "請輸入選擇 (1-4): " choice

case $choice in
    1)
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open index.html  # Linux
        elif command -v open >/dev/null 2>&1; then
            open index.html       # macOS
        else
            echo "無法自動啟動，請手動雙擊 index.html 文件"
        fi
        ;;
    2)
        if command -v google-chrome >/dev/null 2>&1; then
            google-chrome index.html
        elif command -v chrome >/dev/null 2>&1; then
            chrome index.html
        else
            echo "Chrome 未安裝，使用默認瀏覽器啟動..."
            if command -v xdg-open >/dev/null 2>&1; then
                xdg-open index.html
            elif command -v open >/dev/null 2>&1; then
                open index.html
            fi
        fi
        ;;
    3)
        if command -v firefox >/dev/null 2>&1; then
            firefox index.html
        else
            echo "Firefox 未安裝，使用默認瀏覽器啟動..."
            if command -v xdg-open >/dev/null 2>&1; then
                xdg-open index.html
            elif command -v open >/dev/null 2>&1; then
                open index.html
            fi
        fi
        ;;
    4)
        if command -v open >/dev/null 2>&1; then
            open -a Safari index.html
        else
            echo "Safari 僅在 macOS 上可用，使用默認瀏覽器啟動..."
            if command -v xdg-open >/dev/null 2>&1; then
                xdg-open index.html
            elif command -v open >/dev/null 2>&1; then
                open index.html
            fi
        fi
        ;;
    *)
        echo "無效選擇，使用默認瀏覽器啟動..."
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open index.html
        elif command -v open >/dev/null 2>&1; then
            open index.html
        fi
        ;;
esac

echo ""
echo "應用已啟動！如果瀏覽器沒有自動打開，請手動雙擊 index.html 文件"
echo ""
read -p "按 Enter 鍵退出..."
