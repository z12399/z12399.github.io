# 🚀 GitHub Pages 部署指南

## 📍 目標網址
`https://z12399.github.io/vocabulary/`

## 🔧 部署步驟

### 1. 創建 GitHub 倉庫
```bash
# 在你的 GitHub 帳號下創建新倉庫
Repository name: vocabulary
Description: 高中英文詞彙學習應用
Visibility: Public
```

### 2. 上傳文件到 GitHub
```bash
# 克隆倉庫
git clone https://github.com/z12399/vocabulary.git
cd vocabulary

# 複製 dist 目錄下的所有文件到倉庫根目錄
# 或者直接將 dist 目錄重命名為根目錄

# 添加文件
git add .

# 提交更改
git commit -m "Initial commit: 單字學習應用"

# 推送到 GitHub
git push origin main
```

### 3. 配置 GitHub Pages
1. 進入倉庫設置 (Settings)
2. 點擊左側的 "Pages"
3. Source 選擇 "Deploy from a branch"
4. Branch 選擇 "main" 或 "master"
5. 點擊 "Save"

### 4. 等待部署
- GitHub 會自動構建和部署你的網站
- 通常需要 5-10 分鐘
- 部署完成後會顯示綠色勾號

## 📁 文件結構
```
vocabulary/
├── index.html              # 主頁面
├── vite.svg                # 圖標
├── assets/                 # 資源文件夾
│   ├── index-CACEot39.js   # 主要JavaScript
│   ├── index-D8b4DHJx.css  # 樣式文件
│   ├── level-1--xUFjS4J.js # 等級1詞彙
│   ├── level-2-DzY-8v3y.js # 等級2詞彙
│   ├── level-3-jfKpFkPh.js # 等級3詞彙
│   ├── level-4-D62Y5MvP.js # 等級4詞彙
│   ├── level-5-Cy2PXVLm.js # 等級5詞彙
│   ├── level-6-YOlUjDT_.js # 等級6詞彙
│   └── vocabulary-index-DHjc4XcU.js # 詞彙索引
├── README.md               # 使用說明
└── GITHUB_PAGES_DEPLOY.md # 本文件
```

## 🌟 新增功能

### 📖 學習網誌
- 6篇精心準備的學習文章
- 涵蓋SRS算法、記憶科學、學習技巧等
- 響應式設計，支持手機和桌面
- 點擊網誌卡片可查看預覽

### 🔗 GitHub 連結
- 右上角固定位置的 GitHub 連結
- 方便用戶訪問源碼和貢獻

## ✅ 部署檢查清單

- [ ] 創建 GitHub 倉庫 `vocabulary`
- [ ] 上傳所有 dist 目錄文件
- [ ] 配置 GitHub Pages 設置
- [ ] 等待部署完成
- [ ] 測試網站功能
- [ ] 檢查響應式設計
- [ ] 驗證數據存儲功能

## 🐛 常見問題

### Q: 網站顯示 404 錯誤
A: 檢查 base href 是否正確設置為 `/vocabulary/`

### Q: 資源文件無法加載
A: 確保所有 assets 文件都已上傳到 GitHub

### Q: 本地存儲不工作
A: 檢查瀏覽器是否支持 localStorage，建議使用 HTTPS

## 📱 訪問方式

### 主要網址
- `https://z12399.github.io/vocabulary/`

### 直接文件
- `https://z12399.github.io/vocabulary/index.html`

## 🎯 下一步計劃

1. **網誌內容完善**
   - 撰寫完整的學習文章
   - 添加圖片和示例
   - 實現文章分類和搜索

2. **功能增強**
   - 添加學習統計圖表
   - 實現學習提醒功能
   - 支持多語言

3. **用戶體驗優化**
   - 添加更多動畫效果
   - 優化手機端體驗
   - 實現深色模式

---

**部署完成後，你的單字學習應用就可以通過 `z12399.github.io/vocabulary` 訪問了！** 🎉
