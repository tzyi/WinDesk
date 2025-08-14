// WinDesk - Chrome Extension JavaScript
class WinDesk {
    constructor() {
        this.currentDesktopId = 'default';
        this.desktops = {};
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderDesktops();
        this.renderCurrentDesktop();
        this.handleSearch();
    }

    // 數據管理
    async loadData() {
        try {
            const data = await chrome.storage.sync.get(['windesk_data']);
            if (data.windesk_data) {
                this.desktops = data.windesk_data.desktops || {};
                this.currentDesktopId = data.windesk_data.currentDesktopId || 'default';
            }
            
            // 確保有預設桌面
            if (!this.desktops[this.currentDesktopId]) {
                this.desktops[this.currentDesktopId] = {
                    name: '主桌面',
                    websites: [],
                    background: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
                };
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            this.desktops = {
                'default': {
                    name: '主桌面',
                    websites: [],
                    background: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
                }
            };
        }
    }

    async saveData() {
        try {
            await chrome.storage.sync.set({
                windesk_data: {
                    desktops: this.desktops,
                    currentDesktopId: this.currentDesktopId
                }
            });
        } catch (error) {
            console.error('Failed to save data:', error);
        }
    }

    // 事件監聽器設置
    setupEventListeners() {
        // 新增桌面按鈕
        document.querySelector('.add-desktop-btn').addEventListener('click', () => {
            this.addDesktop();
        });

        // 右鍵選單
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.desktop-content')) {
                e.preventDefault();
                this.showContextMenu(e.pageX, e.pageY);
            }
        });

        // 隱藏選單
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenu();
            }
        });

        // 右鍵選單項目
        document.getElementById('addWebsiteBtn').addEventListener('click', () => {
            this.showAddWebsiteModal();
            this.hideContextMenu();
        });

        document.getElementById('changeBackgroundBtn').addEventListener('click', () => {
            this.showChangeBackgroundModal();
            this.hideContextMenu();
        });

        // 模態對話框
        this.setupModalEvents();

        // 匯入匯出
        document.getElementById('importBtn').addEventListener('click', () => {
            this.importData();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        // 搜索功能
        document.querySelector('.search-input').addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        document.querySelector('.search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch(e.target.value);
            }
        });
    }

    setupModalEvents() {
        // 新增網站模態
        document.getElementById('closeModal').addEventListener('click', () => {
            this.hideModal('addWebsiteModal');
        });

        document.getElementById('cancelAdd').addEventListener('click', () => {
            this.hideModal('addWebsiteModal');
        });

        document.getElementById('confirmAdd').addEventListener('click', () => {
            this.addWebsite();
        });

        // 更換背景模態
        document.getElementById('closeBackgroundModal').addEventListener('click', () => {
            this.hideModal('changeBackgroundModal');
        });

        document.getElementById('cancelBackground').addEventListener('click', () => {
            this.hideModal('changeBackgroundModal');
        });

        document.getElementById('confirmBackground').addEventListener('click', () => {
            this.changeBackground();
        });

        // 重命名桌面模態
        document.getElementById('closeRenameModal').addEventListener('click', () => {
            this.hideModal('renameDesktopModal');
        });

        document.getElementById('cancelRename').addEventListener('click', () => {
            this.hideModal('renameDesktopModal');
        });

        document.getElementById('confirmRename').addEventListener('click', () => {
            this.renameDesktop();
        });

        // 文件選擇處理
        document.getElementById('backgroundFile').addEventListener('change', (e) => {
            this.handleBackgroundFileSelect(e);
        });

        document.getElementById('importFile').addEventListener('change', (e) => {
            this.handleImportFile(e);
        });
    }

    // 桌面管理
    addDesktop() {
        const id = 'desktop_' + Date.now();
        const name = `桌面 ${Object.keys(this.desktops).length + 1}`;
        
        this.desktops[id] = {
            name: name,
            websites: [],
            background: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
        };
        
        this.saveData();
        this.renderDesktops();
    }

    switchDesktop(desktopId) {
        this.currentDesktopId = desktopId;
        this.saveData();
        this.renderDesktops();
        this.renderCurrentDesktop();
        this.updateBackground();
    }

    deleteDesktop(desktopId) {
        if (Object.keys(this.desktops).length <= 1) {
            alert('至少需要保留一個桌面！');
            return;
        }

        if (confirm('確定要刪除這個桌面嗎？')) {
            delete this.desktops[desktopId];
            
            if (this.currentDesktopId === desktopId) {
                this.currentDesktopId = Object.keys(this.desktops)[0];
            }
            
            this.saveData();
            this.renderDesktops();
            this.renderCurrentDesktop();
            this.updateBackground();
        }
    }

    showRenameDesktopModal(desktopId) {
        const modal = document.getElementById('renameDesktopModal');
        const input = document.getElementById('desktopName');
        input.value = this.desktops[desktopId].name;
        modal.dataset.desktopId = desktopId;
        this.showModal('renameDesktopModal');
    }

    renameDesktop() {
        const modal = document.getElementById('renameDesktopModal');
        const desktopId = modal.dataset.desktopId;
        const newName = document.getElementById('desktopName').value.trim();
        
        if (newName) {
            this.desktops[desktopId].name = newName;
            this.saveData();
            this.renderDesktops();
            this.hideModal('renameDesktopModal');
        }
    }

    renderDesktops() {
        const desktopList = document.getElementById('desktopList');
        desktopList.innerHTML = '';

        for (const [id, desktop] of Object.entries(this.desktops)) {
            const desktopElement = document.createElement('div');
            desktopElement.className = `desktop-item ${id === this.currentDesktopId ? 'active' : ''}`;
            desktopElement.innerHTML = `
                <div class="desktop-name">${desktop.name}</div>
                <div class="desktop-actions">
                    <button class="desktop-action-btn" onclick="windesk.showRenameDesktopModal('${id}')" title="重命名">✏️</button>
                    <button class="desktop-action-btn" onclick="windesk.deleteDesktop('${id}')" title="刪除">🗑️</button>
                </div>
            `;
            
            desktopElement.addEventListener('click', (e) => {
                if (!e.target.closest('.desktop-actions')) {
                    this.switchDesktop(id);
                }
            });

            desktopList.appendChild(desktopElement);
        }
    }

    // 網站管理
    addWebsite() {
        const name = document.getElementById('websiteName').value.trim();
        const url = document.getElementById('websiteUrl').value.trim();
        const icon = document.getElementById('websiteIcon').value.trim();

        if (!name || !url) {
            alert('請填寫網站名稱和網址！');
            return;
        }

        const website = {
            id: 'website_' + Date.now(),
            name: name,
            url: url.startsWith('http') ? url : 'https://' + url,
            icon: icon || `https://www.google.com/s2/favicons?domain=${new URL(url.startsWith('http') ? url : 'https://' + url).hostname}&sz=48`
        };

        this.desktops[this.currentDesktopId].websites.push(website);
        this.saveData();
        this.renderCurrentDesktop();
        this.hideModal('addWebsiteModal');
        
        // 清空表單
        document.getElementById('websiteName').value = '';
        document.getElementById('websiteUrl').value = '';
        document.getElementById('websiteIcon').value = '';
    }

    deleteWebsite(websiteId) {
        if (confirm('確定要刪除這個網站嗎？')) {
            const websites = this.desktops[this.currentDesktopId].websites;
            const index = websites.findIndex(w => w.id === websiteId);
            if (index !== -1) {
                websites.splice(index, 1);
                this.saveData();
                this.renderCurrentDesktop();
            }
        }
    }

    renderCurrentDesktop() {
        const desktopContent = document.getElementById('desktopContent');
        const currentDesktop = this.desktops[this.currentDesktopId];
        
        if (!currentDesktop) {
            desktopContent.innerHTML = '<div>桌面不存在</div>';
            return;
        }

        desktopContent.innerHTML = '';

        currentDesktop.websites.forEach(website => {
            const websiteElement = document.createElement('a');
            websiteElement.className = 'website-icon';
            websiteElement.href = website.url;
            websiteElement.target = '_blank';
            websiteElement.innerHTML = `
                <img src="${website.icon}" alt="${website.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/><path d=%22M12 6v6l4 2%22/></svg>'">
                <div class="name">${website.name}</div>
                <button class="delete-btn" onclick="event.preventDefault(); event.stopPropagation(); windesk.deleteWebsite('${website.id}')" title="刪除">×</button>
            `;
            desktopContent.appendChild(websiteElement);
        });

        this.updateBackground();
    }

    // 背景管理
    updateBackground() {
        const desktopArea = document.getElementById('desktopArea');
        const currentDesktop = this.desktops[this.currentDesktopId];
        if (currentDesktop && currentDesktop.background) {
            desktopArea.style.backgroundImage = `url('${currentDesktop.background}')`;
        }
    }

    changeBackground() {
        const url = document.getElementById('backgroundUrl').value.trim();
        const file = document.getElementById('backgroundFile').files[0];

        if (url) {
            this.desktops[this.currentDesktopId].background = url;
            this.saveData();
            this.updateBackground();
            this.hideModal('changeBackgroundModal');
        } else if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.desktops[this.currentDesktopId].background = e.target.result;
                this.saveData();
                this.updateBackground();
                this.hideModal('changeBackgroundModal');
            };
            reader.readAsDataURL(file);
        } else {
            alert('請輸入背景圖片網址或選擇本地圖片！');
        }

        // 清空表單
        document.getElementById('backgroundUrl').value = '';
        document.getElementById('backgroundFile').value = '';
    }

    handleBackgroundFileSelect(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            document.getElementById('backgroundUrl').value = '';
        }
    }

    // 右鍵選單
    showContextMenu(x, y) {
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.display = 'block';
        contextMenu.style.left = Math.min(x, window.innerWidth - contextMenu.offsetWidth) + 'px';
        contextMenu.style.top = Math.min(y, window.innerHeight - contextMenu.offsetHeight) + 'px';
    }

    hideContextMenu() {
        document.getElementById('contextMenu').style.display = 'none';
    }

    // 模態對話框
    showModal(modalId) {
        document.getElementById(modalId).classList.add('show');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    }

    showAddWebsiteModal() {
        this.showModal('addWebsiteModal');
    }

    showChangeBackgroundModal() {
        this.showModal('changeBackgroundModal');
    }

    // 搜索功能
    handleSearch(query = '') {
        if (!query) return;
        
        // 如果輸入看起來像URL，直接跳轉
        if (query.includes('.') && !query.includes(' ')) {
            this.performSearch(query);
        }
    }

    performSearch(query) {
        if (query.startsWith('http://') || query.startsWith('https://')) {
            window.location.href = query;
        } else if (query.includes('.') && !query.includes(' ')) {
            window.location.href = 'https://' + query;
        } else {
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }
    }

    // 匯入匯出功能
    exportData() {
        const data = {
            desktops: this.desktops,
            currentDesktopId: this.currentDesktopId,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `windesk-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importData() {
        document.getElementById('importFile').click();
    }

    handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.desktops && typeof data.desktops === 'object') {
                    if (confirm('確定要匯入這個設定嗎？這將會覆蓋當前的所有桌面設定。')) {
                        this.desktops = data.desktops;
                        this.currentDesktopId = data.currentDesktopId || Object.keys(data.desktops)[0];
                        
                        // 確保當前桌面存在
                        if (!this.desktops[this.currentDesktopId]) {
                            this.currentDesktopId = Object.keys(this.desktops)[0];
                        }
                        
                        this.saveData();
                        this.renderDesktops();
                        this.renderCurrentDesktop();
                        alert('匯入成功！');
                    }
                } else {
                    alert('無效的設定檔案格式！');
                }
            } catch (error) {
                alert('檔案解析失敗：' + error.message);
            }
        };
        reader.readAsText(file);
        
        // 重置文件輸入
        e.target.value = '';
    }
}

// 初始化應用程式
const windesk = new WinDesk();

// 全局變數供HTML onclick使用
window.windesk = windesk;