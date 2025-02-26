console.log('modal.js 開始載入');

// 全局函數，可以直接從 HTML 調用
function showModal(title, data, buttonId) {
    console.log('showModal 被調用:', title);
    
    const modal = document.getElementById('selectionModal');
    const modalTitle = document.getElementById('modalTitle');
    const optionsGrid = document.getElementById('optionsGrid');
    const button = document.getElementById(buttonId);
    
    if (!modal || !modalTitle || !optionsGrid || !button) {
        console.error('找不到必要的 DOM 元素:', {
            modal: !!modal,
            modalTitle: !!modalTitle,
            optionsGrid: !!optionsGrid,
            button: !!button
        });
        return;
    }

    console.log('開始顯示模態框');
    modal.style.display = 'block';
    modalTitle.textContent = title;
    optionsGrid.innerHTML = '';
    
    // 添加選項
    for (const key in data) {
        if (key.startsWith('No')) continue;
        
        console.log('添加選項:', key);
        const item = document.createElement('div');
        item.className = 'option-item';
        
        const img = document.createElement('img');
        if (title === '選擇角色' || title === '選擇輔助') {
            const baseCharacterName = key.split('(')[0];
            img.src = `TOA_image/${baseCharacterName}.webp`;
        } else if (title === '選擇法寶卡' || title === '選擇輔助法寶卡') {
            img.src = data[key].image || 'image/光.png';
        } else {
            img.src = 'image/光.png';
        }
        img.alt = key;
        
        const name = document.createElement('div');
        name.style.textAlign = 'center';  // 確保文字置中
        
        // 檢查是否包含括號
        if (key.includes('(')) {
            const [baseName, ...rest] = key.split('(');
            const bracketContent = rest.join('(');  // 處理名稱中可能包含多個括號的情況
            name.innerHTML = `${baseName.trim()}<br>(${bracketContent}`;
        } else {
            // 不包含括號的情況，直接顯示文字
            name.textContent = key;
        }
        
        item.appendChild(img);
        item.appendChild(name);
        
        item.onclick = () => {
            console.log('選項被點擊:', key);
            button.textContent = key;  // 按鈕上仍然顯示完整文字（不換行）
            modal.style.display = 'none';
            calculate();
        };
        
        optionsGrid.appendChild(item);
    }
}

// 點擊外部關閉模態框
window.onclick = (event) => {
    const modal = document.getElementById('selectionModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

// 關閉按鈕功能
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.querySelector('.close');
    const modal = document.getElementById('selectionModal');
    
    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
});

console.log('modal.js 載入完成'); 