// 檔案名稱映射表 - 中文名稱到英文檔案名稱的對照
const filenameMapping = {
    // 角色映射
    "冰岩": "Frostrock",
    "冰薄荷": "Ice_Mint",
    "雪花糖球": "Sugar_Globe",
    "羅勒青醬": "Basil_Pesto",
    "哈拉帕辣椒": "Jalapeno",
    "紫玉甘藍": "Kohlrabi",
    "檸檬皮": "Lemon_Zest",
    "奶油蘇打": "Cream_Soda",
    "黑麥": "Rye",
    "甜辣醬": "Chili_Pepper",
    "黑巧克力": "Dark_Choco",
    "麻花捲": "Twisted_Donut",
    "大理石漿果": "Marbleberry",
    
    // 法寶卡映射
    "覺醒的瞬間": "Moment_of_Awakening",
    "雪地飛馳": "Snow_Racing",
    "幸福的回憶": "Happy_Memory",
    "特製料理": "Special_Dish",
    "狂熱狙擊": "Zealous_Snipe",
    "被喚醒的回憶": "Awakened_Memory",
    "穿透之光": "Piercing_Light",
    "努力的成果": "Effort_Result",
    "黃昏追擊戰": "Dusk_Pursuit",
    "作戰開始": "Operation_Start",
    "無法回頭的選擇": "No_Return_Choice",
    "被遺忘的魔法書的秘密": "Forgotten_Book_Secret",
    "充電的時機": "Well-timed_Recharge",
    
    // 輔助法寶卡映射
    "悠閒的下午": "Leisurely_Afternoon",
    "午夜的華爾滋": "Midnight_Waltz",
    "好眠秘訣": "The_Secret_of_Sweet_Sleep",
    "溫柔的希望": "Lovely_Wish",
    
    // 套裝映射
    "屬性套": "Attribute_Set",
    "甜蜜白糖羽毛": "Sugar_Feather",
    "傳說幽靈海盜": "Ghost_Captain",
    "謎樣流浪者": "Mysterious_Wanderer",
    "詭異的獵人": "Suspicious_Hunter",
    "時間管理局": "TBD_Uniform",
    "被遺忘的英雄": "Forgotten_Hero",
    "記憶的奧妙世界": "Memory_Shard",
    "黃金禮服": "Golden_Finery",
    
    // 輔助套裝映射
    "雪怪的暴風雪": "Snowstrider",
    "永恆大魔術師": "Eternal_Magician",
    
    // 套裝部件映射
    
    // 輔助角色映射
    "檸檬": "Lemon",
    "桃子": "Peach",
    "辣椒碎片": "Crushed_Pepper",
    "搖滾": "Rockstar",
    "白玉草": "Greenbell"
};

// 映射函數 - 將中文名稱轉換為對應的檔案名稱
function mapFilename(chineseName, defaultExtension = ".webp") {
    // 檢查是否有對應的映射
    if (filenameMapping[chineseName]) {
        return filenameMapping[chineseName] + defaultExtension;
    }
    
    // 如果沒有找到映射，返回原始名稱
    return chineseName + defaultExtension;
}

// 獲取圖片路徑的函數，自動處理中英文轉換
function getImagePath(imagePath) {
    if (!imagePath) return null;
    
    // 檢查路徑是否已經包含副檔名
    const hasExtension = /\.(webp|png|jpg|jpeg|gif)$/i.test(imagePath);
    
    // 分解路徑
    const parts = imagePath.split('/');
    const filename = parts[parts.length - 1];
    
    // 檢查檔名是否為中文
    const filenameWithoutExt = hasExtension ? filename.substring(0, filename.lastIndexOf('.')) : filename;
    const extension = hasExtension ? filename.substring(filename.lastIndexOf('.')) : '.webp'; // 預設副檔名
    
    // 判斷是否有對應的英文映射
    const hasMapping = filenameMapping[filenameWithoutExt] !== undefined;
    
    // 保存原始路徑用於回退
    const originalPath = imagePath;
    
    // 只有在有對應映射時才進行替換
    if (hasMapping) {
        // 映射檔名
        const mappedFilename = mapFilename(filenameWithoutExt, extension);
        parts[parts.length - 1] = mappedFilename;
    }
    
    // 重組路徑
    const mappedPath = parts.join('/');
    
    // 創建一個臨時圖片物件來測試映射後的圖片是否存在
    // 注意：這段代碼在頁面加載後執行
    if (hasMapping && typeof document !== 'undefined') {
        const imgTest = new Image();
        const originalImagePath = originalPath;
        
        imgTest.onerror = function() {
            // 如果映射後的圖片加載失敗，則替換所有使用此路徑的圖片為原始路徑
            const allImgs = document.querySelectorAll(`img[src="${mappedPath}"]`);
            allImgs.forEach(img => {
                img.src = originalImagePath;
                console.log(`圖片 ${mappedPath} 不存在，回退到 ${originalImagePath}`);
            });
        };
        
        // 嘗試加載映射後的圖片
        imgTest.src = mappedPath;
    }
    
    return mappedPath;
} 