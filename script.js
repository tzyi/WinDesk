// WinDesk - Chrome Extension JavaScript
class WinDesk {
    constructor() {
        this.currentDesktopId = 'default';
        this.desktops = {};
        this.desktopOrder = [];
        this.selectedIcons = new Set();
        this.isSelecting = false;
        this.selectionStart = null;
        this.isBatchDragging = false;
        this.init();
    }

    async init() {
        console.log('WinDesk initializing...');
        try {
            await this.loadData();
            console.log('Data loaded, desktops:', Object.keys(this.desktops), 'current:', this.currentDesktopId);
            
            this.setupEventListeners();
            console.log('Event listeners set up');
            
            this.renderDesktops();
            console.log('Desktops rendered');
            
            this.renderCurrentDesktop();
            console.log('Current desktop rendered');
            
            this.handleSearch();
            console.log('WinDesk initialization complete');
        } catch (error) {
            console.error('Failed to initialize WinDesk:', error);
            // 緊急恢復
            this.desktops = {
                'default': {
                    name: '主桌面',
                    websites: [],
                    background: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
                }
            };
            this.currentDesktopId = 'default';
            await this.saveData();
            this.setupEventListeners();
            this.renderDesktops();
            this.renderCurrentDesktop();
        }
    }

    // 數據管理
    async loadData() {
        let dataLoaded = false;
        
        try {
            // 優先從本地儲存載入（更可靠）
            const localData = await chrome.storage.local.get(['windesk_data']);
            if (localData.windesk_data && localData.windesk_data.desktops) {
                this.desktops = localData.windesk_data.desktops;
                this.currentDesktopId = localData.windesk_data.currentDesktopId || 'default';
                this.desktopOrder = localData.windesk_data.desktopOrder || Object.keys(this.desktops);
                dataLoaded = true;
                console.log('Data loaded from local storage');
            }
        } catch (localError) {
            console.warn('Failed to load from local storage:', localError);
        }
        
        // 如果本地儲存失敗，嘗試從同步儲存載入
        if (!dataLoaded) {
            try {
                const syncData = await chrome.storage.sync.get(['windesk_data']);
                if (syncData.windesk_data && syncData.windesk_data.desktops) {
                    this.desktops = syncData.windesk_data.desktops;
                    this.currentDesktopId = syncData.windesk_data.currentDesktopId || 'default';
                    this.desktopOrder = syncData.windesk_data.desktopOrder || Object.keys(this.desktops);
                    dataLoaded = true;
                    console.log('Data loaded from sync storage');
                    // 將同步數據備份到本地儲存
                    await chrome.storage.local.set({
                        windesk_data: {
                            desktops: this.desktops,
                            currentDesktopId: this.currentDesktopId,
                            desktopOrder: this.desktopOrder,
                            lastSaveTime: Date.now()
                        }
                    });
                }
            } catch (syncError) {
                console.warn('Failed to load from sync storage:', syncError);
            }
        }
        
        // 確保桌面數據完整性
        if (!dataLoaded || !this.desktops || Object.keys(this.desktops).length === 0) {
            // 如果沒有任何桌面，創建預設桌面
            this.desktops = {
                'default': {
                    name: '主桌面',
                    websites: [],
                    background: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
                }
            };
            this.currentDesktopId = 'default';
            this.desktopOrder = ['default'];
            console.log('Created default desktop');
        } else if (!this.desktops[this.currentDesktopId]) {
            // 如果當前桌面不存在，使用第一個可用的桌面或創建新的
            const availableDesktopIds = Object.keys(this.desktops);
            if (availableDesktopIds.length > 0) {
                this.currentDesktopId = availableDesktopIds[0];
                console.log('Switched to available desktop:', this.currentDesktopId);
            } else {
                // 如果沒有可用桌面，創建預設桌面
                this.desktops['default'] = {
                    name: '主桌面',
                    websites: [],
                    background: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
                };
                this.currentDesktopId = 'default';
                this.desktopOrder = ['default'];
                console.log('Created fallback desktop');
            }
        }
        
        // 立即保存修復後的數據
        await this.saveData();
    }

    async saveData() {
        try {
            // 驗證數據完整性
            if (!this.desktops || Object.keys(this.desktops).length === 0 || !this.currentDesktopId) {
                console.warn('Invalid data detected, skipping save');
                return;
            }
            
            const dataToSave = {
                desktops: this.desktops,
                currentDesktopId: this.currentDesktopId,
                desktopOrder: this.desktopOrder,
                lastSaveTime: Date.now()
            };
            
            // 優先使用本地儲存（立即生效，更可靠）
            await chrome.storage.local.set({ windesk_data: dataToSave });
            console.log('Data saved to local storage successfully');
            
            // 同時嘗試同步儲存（跨裝置同步）
            try {
                await chrome.storage.sync.set({ windesk_data: dataToSave });
                console.log('Data synced successfully');
            } catch (syncError) {
                console.warn('Sync storage failed, but local storage succeeded:', syncError);
            }
            
        } catch (error) {
            console.error('Failed to save data to local storage:', error);
            
            // 本地儲存失敗時，嘗試同步儲存作為備份
            try {
                const dataToSave = {
                    desktops: this.desktops,
                    currentDesktopId: this.currentDesktopId,
                    lastSaveTime: Date.now()
                };
                await chrome.storage.sync.set({ windesk_data: dataToSave });
                console.log('Data saved to sync storage as fallback');
            } catch (fallbackError) {
                console.error('All storage methods failed:', fallbackError);
                alert('無法保存設定，請檢查瀏覽器權限設定');
            }
        }
    }

    // 同步保存方法（用於頁面關閉前）
    saveDataSync() {
        try {
            // 驗證數據完整性
            if (!this.desktops || Object.keys(this.desktops).length === 0 || !this.currentDesktopId) {
                console.warn('Invalid data detected, skipping sync save');
                return;
            }
            
            const dataToSave = {
                desktops: this.desktops,
                currentDesktopId: this.currentDesktopId,
                desktopOrder: this.desktopOrder,
                lastSaveTime: Date.now()
            };
            
            // 使用同步API確保立即保存
            chrome.storage.local.set({ windesk_data: dataToSave });
            
            // 也嘗試同步儲存
            try {
                chrome.storage.sync.set({ windesk_data: dataToSave });
            } catch (syncError) {
                console.warn('Sync save failed:', syncError);
            }
            
            console.log('Data saved synchronously before unload');
        } catch (error) {
            console.error('Failed to save data synchronously:', error);
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
                this.hideIconContextMenu();
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

        // 圖示右鍵選單事件
        document.getElementById('editWebsiteBtn').addEventListener('click', () => {
            this.editCurrentWebsite();
            this.hideIconContextMenu();
        });

        document.getElementById('deleteWebsiteBtn').addEventListener('click', () => {
            this.deleteCurrentWebsite();
            this.hideIconContextMenu();
        });

        // 編輯網站模態事件
        document.getElementById('closeEditModal').addEventListener('click', () => {
            this.hideModal('editWebsiteModal');
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.hideModal('editWebsiteModal');
        });

        document.getElementById('confirmEdit').addEventListener('click', () => {
            this.updateWebsite();
        });

        // 多選功能事件
        this.setupMultiSelectEvents();
    }

    // 多選功能設置
    setupMultiSelectEvents() {
        const desktopContent = document.getElementById('desktopContent');
        
        desktopContent.addEventListener('mousedown', (e) => {
            // 只處理左鍵點擊，且不是在圖示上
            if (e.button !== 0 || e.target.closest('.website-icon')) return;
            
            this.startSelection(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isSelecting) {
                this.updateSelection(e);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.isSelecting) {
                this.endSelection(e);
            }
        });

        // 鍵盤事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSelection();
            }
        });

        // 頁面關閉前確保資料保存
        window.addEventListener('beforeunload', (e) => {
            // 使用同步保存確保立即生效
            this.saveDataSync();
        });

        // 頁面隱藏時保存數據（例如切換到其他分頁）
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveData();
            }
        });

        // 定期自動保存（每30秒）
        setInterval(() => {
            this.saveData();
        }, 30000);
    }

    // 選取功能
    startSelection(e) {
        this.clearSelection();
        this.isSelecting = true;
        
        const desktopArea = document.getElementById('desktopArea');
        const rect = desktopArea.getBoundingClientRect();
        
        this.selectionStart = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        const selectionBox = document.getElementById('selectionBox');
        selectionBox.style.display = 'block';
        selectionBox.style.left = this.selectionStart.x + 'px';
        selectionBox.style.top = this.selectionStart.y + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        
        e.preventDefault();
    }

    updateSelection(e) {
        if (!this.isSelecting || !this.selectionStart) return;
        
        const desktopArea = document.getElementById('desktopArea');
        const rect = desktopArea.getBoundingClientRect();
        
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        const left = Math.min(this.selectionStart.x, currentX);
        const top = Math.min(this.selectionStart.y, currentY);
        const width = Math.abs(currentX - this.selectionStart.x);
        const height = Math.abs(currentY - this.selectionStart.y);
        
        const selectionBox = document.getElementById('selectionBox');
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        
        // 檢查哪些圖示在選取範圍內
        this.updateSelectedIcons(left, top, width, height);
    }

    updateSelectedIcons(left, top, width, height) {
        const icons = document.querySelectorAll('.website-icon');
        const selectionRect = { left, top, right: left + width, bottom: top + height };
        
        this.selectedIcons.clear();
        
        icons.forEach(icon => {
            const iconRect = icon.getBoundingClientRect();
            const desktopArea = document.getElementById('desktopArea');
            const desktopRect = desktopArea.getBoundingClientRect();
            
            const iconRelativeRect = {
                left: iconRect.left - desktopRect.left,
                top: iconRect.top - desktopRect.top,
                right: iconRect.right - desktopRect.left,
                bottom: iconRect.bottom - desktopRect.top
            };
            
            // 檢查是否相交
            const intersects = !(
                iconRelativeRect.right < selectionRect.left ||
                iconRelativeRect.left > selectionRect.right ||
                iconRelativeRect.bottom < selectionRect.top ||
                iconRelativeRect.top > selectionRect.bottom
            );
            
            if (intersects) {
                const websiteId = icon.dataset.websiteId;
                this.selectedIcons.add(websiteId);
                icon.classList.add('selected');
            } else {
                icon.classList.remove('selected');
            }
        });
    }

    endSelection(e) {
        this.isSelecting = false;
        
        const selectionBox = document.getElementById('selectionBox');
        selectionBox.style.display = 'none';
        
        // 如果有選中的圖示，設置批量拖拽
        if (this.selectedIcons.size > 0) {
            this.setupBatchDrag();
        }
    }

    clearSelection() {
        this.selectedIcons.clear();
        const icons = document.querySelectorAll('.website-icon');
        icons.forEach(icon => {
            icon.classList.remove('selected', 'batch-dragging');
        });
        
        const selectionBox = document.getElementById('selectionBox');
        selectionBox.style.display = 'none';
        this.isBatchDragging = false;
    }

    setupBatchDrag() {
        const selectedIcons = document.querySelectorAll('.website-icon.selected');
        
        selectedIcons.forEach(icon => {
            // 暫時移除原有的拖拽事件，添加批量拖拽
            icon.addEventListener('dragstart', (e) => {
                if (this.selectedIcons.has(icon.dataset.websiteId)) {
                    this.isBatchDragging = true;
                    e.dataTransfer.setData('text/plain', 'batch:' + Array.from(this.selectedIcons).join(','));
                    
                    // 為所有選中的圖示添加拖拽樣式
                    this.selectedIcons.forEach(websiteId => {
                        const selectedIcon = document.querySelector(`[data-website-id="${websiteId}"]`);
                        if (selectedIcon) {
                            selectedIcon.classList.add('batch-dragging');
                        }
                    });
                }
            });

            icon.addEventListener('dragend', (e) => {
                // 移除拖拽樣式
                this.selectedIcons.forEach(websiteId => {
                    const selectedIcon = document.querySelector(`[data-website-id="${websiteId}"]`);
                    if (selectedIcon) {
                        selectedIcon.classList.remove('batch-dragging');
                    }
                });
                this.isBatchDragging = false;
            });
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
        
        // 將新桌面添加到順序列表的末尾
        if (!this.desktopOrder) {
            this.desktopOrder = Object.keys(this.desktops);
        } else {
            this.desktopOrder.push(id);
        }
        
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
            
            // 從順序列表中移除
            if (this.desktopOrder) {
                const index = this.desktopOrder.indexOf(desktopId);
                if (index > -1) {
                    this.desktopOrder.splice(index, 1);
                }
            }
            
            // 如果刪除的是當前桌面，切換到第一個可用桌面
            if (this.currentDesktopId === desktopId) {
                const availableDesktops = this.desktopOrder.length > 0 ? this.desktopOrder : Object.keys(this.desktops);
                if (availableDesktops.length > 0) {
                    this.currentDesktopId = availableDesktops[0];
                } else {
                    // 緊急情況：沒有可用桌面，創建新的預設桌面
                    console.error('No available desktops after deletion, creating default');
                    this.desktops['default'] = {
                        name: '主桌面',
                        websites: [],
                        background: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
                    };
                    this.currentDesktopId = 'default';
                    this.desktopOrder = ['default'];
                }
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
        
        // 確保至少有一個桌面
        if (!this.desktops || Object.keys(this.desktops).length === 0) {
            console.warn('No desktops found, creating default desktop');
            this.desktops = {
                'default': {
                    name: '主桌面',
                    websites: [],
                    background: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
                }
            };
            this.currentDesktopId = 'default';
            this.saveData();
        }

        // 獲取桌面順序（如果沒有設定則使用預設順序）
        const desktopOrder = this.desktopOrder || Object.keys(this.desktops);
        
        // 確保所有桌面都在順序中
        const allDesktops = Object.keys(this.desktops);
        allDesktops.forEach(id => {
            if (!desktopOrder.includes(id)) {
                desktopOrder.push(id);
            }
        });
        
        // 移除不存在的桌面
        this.desktopOrder = desktopOrder.filter(id => this.desktops[id]);

        for (const id of this.desktopOrder) {
            const desktop = this.desktops[id];
            if (!desktop) continue;
            
            const desktopElement = document.createElement('div');
            desktopElement.className = `desktop-item ${id === this.currentDesktopId ? 'active' : ''}`;
            desktopElement.draggable = true;
            desktopElement.dataset.desktopId = id;
            desktopElement.innerHTML = `
                <div class="desktop-name">${desktop.name}</div>
                <div class="desktop-actions">
                    <button class="desktop-action-btn rename-btn" title="重命名">✏️</button>
                    <button class="desktop-action-btn delete-btn" title="刪除">🗑️</button>
                </div>
            `;
            
            // 添加拖拽事件
            this.setupDesktopDragEvents(desktopElement);
            
            // 添加重命名按鈕事件
            const renameBtn = desktopElement.querySelector('.rename-btn');
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showRenameDesktopModal(id);
            });
            
            // 添加刪除按鈕事件
            const deleteBtn = desktopElement.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteDesktop(id);
            });
            
            // 桌面切換事件
            desktopElement.addEventListener('click', (e) => {
                if (!e.target.closest('.desktop-actions')) {
                    this.switchDesktop(id);
                }
            });

            desktopList.appendChild(desktopElement);
        }
    }

    // 網站管理
    getFaviconUrl(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            
            // 返回Google的favicon服務作為主要來源
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        } catch (error) {
            console.warn('Failed to parse URL for favicon:', url, error);
            // 如果URL解析失敗，使用預設圖示
            return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
        }
    }

    setupFaviconFallback(imgElement, websiteUrl) {
        try {
            const urlObj = new URL(websiteUrl);
            const domain = urlObj.hostname;
            
            // 定義多個favicon來源的優先級列表
            const faviconSources = [
                `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
                `${urlObj.protocol}//${domain}/favicon.ico`,
                `${urlObj.protocol}//${domain}/favicon.png`,
                `${urlObj.protocol}//${domain}/apple-touch-icon.png`,
                // 最後的預設圖示
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'
            ];
            
            let currentSourceIndex = 0;
            
            const tryNextSource = () => {
                if (currentSourceIndex < faviconSources.length - 1) {
                    currentSourceIndex++;
                    imgElement.src = faviconSources[currentSourceIndex];
                }
            };
            
            imgElement.addEventListener('error', tryNextSource);
            
        } catch (error) {
            console.warn('Failed to setup favicon fallback:', error);
            imgElement.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
        }
    }

    addWebsite() {
        const name = document.getElementById('websiteName').value.trim();
        const url = document.getElementById('websiteUrl').value.trim();
        const icon = document.getElementById('websiteIcon').value.trim();

        if (!name || !url) {
            alert('請填寫網站名稱和網址！');
            return;
        }

        const finalUrl = url.startsWith('http') ? url : 'https://' + url;
        const website = {
            id: 'website_' + Date.now(),
            name: name,
            url: finalUrl,
            icon: icon || this.getFaviconUrl(finalUrl),
            gridPosition: this.findNextAvailableGrid()
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
        
        // 確保當前桌面存在，如果不存在則重新初始化
        if (!this.desktops[this.currentDesktopId]) {
            console.warn('Current desktop not found, recreating...');
            this.desktops[this.currentDesktopId] = {
                name: '主桌面',
                websites: [],
                background: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
            };
            this.saveData();
        }
        
        const currentDesktop = this.desktops[this.currentDesktopId];
        
        if (!currentDesktop) {
            console.error('Failed to get current desktop, creating emergency desktop');
            desktopContent.innerHTML = '<div style="color: white; text-align: center; padding: 20px;">正在重新載入桌面...</div>';
            // 重新初始化
            this.currentDesktopId = 'default';
            this.desktops['default'] = {
                name: '主桌面',
                websites: [],
                background: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
            };
            this.saveData().then(() => {
                this.renderCurrentDesktop();
                this.renderDesktops();
            });
            return;
        }

        // 建立20x9的網格
        desktopContent.innerHTML = '';
        
        // 創建180個網格單元格 (20 columns x 9 rows)
        for (let i = 0; i < 180; i++) {
            const gridCell = document.createElement('div');
            gridCell.className = 'grid-cell';
            gridCell.dataset.gridIndex = i;
            desktopContent.appendChild(gridCell);
        }

        // 放置網站圖示到對應位置
        currentDesktop.websites.forEach(website => {
            const gridIndex = website.gridPosition || 0;
            const gridCell = desktopContent.querySelector(`[data-grid-index="${gridIndex}"]`);
            
            if (gridCell && !gridCell.querySelector('.website-icon')) {
                const websiteElement = document.createElement('div');
                websiteElement.className = 'website-icon';
                websiteElement.draggable = true;
                websiteElement.dataset.websiteId = website.id;
                websiteElement.dataset.websiteUrl = website.url;
                const imgElement = document.createElement('img');
                imgElement.src = website.icon;
                imgElement.alt = website.name;
                
                // 為圖片添加錯誤處理，嘗試多個favicon來源
                this.setupFaviconFallback(imgElement, website.url);
                
                websiteElement.innerHTML = `
                    <div class="name">${website.name}</div>
                    <button class="delete-btn" title="刪除">×</button>
                `;
                
                // 將圖片插入到第一個位置
                websiteElement.insertBefore(imgElement, websiteElement.firstChild);
                
                // 添加點擊打開網站事件
                websiteElement.addEventListener('click', (e) => {
                    if (!e.target.closest('.delete-btn') && !websiteElement.classList.contains('dragging')) {
                        window.open(website.url, '_blank');
                    }
                });
                
                // 添加刪除按鈕事件
                const deleteBtn = websiteElement.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.deleteWebsite(website.id);
                });
                
                // 添加拖曳事件
                this.setupDragEvents(websiteElement);
                
                // 添加右鍵選單事件
                this.setupIconContextMenu(websiteElement, website);
                
                gridCell.appendChild(websiteElement);
            }
        });

        // 設置放置區域事件
        this.setupDropEvents();
        this.updateBackground();
        
        // 清除任何現有的選取狀態
        this.clearSelection();
    }

    // 拖曳功能
    setupDragEvents(websiteElement) {
        let isDragging = false;
        
        websiteElement.addEventListener('mousedown', (e) => {
            if (e.target.closest('.delete-btn')) return;
            isDragging = false;
        });
        
        websiteElement.addEventListener('dragstart', (e) => {
            isDragging = true;
            console.log('Drag start:', websiteElement.dataset.websiteId);
            e.dataTransfer.setData('text/plain', websiteElement.dataset.websiteId);
            e.dataTransfer.effectAllowed = 'move';
            websiteElement.classList.add('dragging');
        });

        websiteElement.addEventListener('dragend', (e) => {
            console.log('Drag end');
            websiteElement.classList.remove('dragging');
            setTimeout(() => {
                isDragging = false;
            }, 100);
        });
        
        // 防止拖曳時觸發點擊事件
        websiteElement.addEventListener('click', (e) => {
            if (isDragging) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });
    }

    setupDropEvents() {
        const gridCells = document.querySelectorAll('.grid-cell');
        
        gridCells.forEach(cell => {
            // 清除之前的事件監聽器
            cell.removeEventListener('dragover', this.handleDragOver);
            cell.removeEventListener('dragleave', this.handleDragLeave);
            cell.removeEventListener('drop', this.handleDrop);
            
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                cell.classList.add('drag-over');
                console.log('Drag over grid:', cell.dataset.gridIndex);
            });

            cell.addEventListener('dragleave', (e) => {
                // 只有當離開的是cell本身而不是子元素時才移除樣式
                if (!cell.contains(e.relatedTarget)) {
                    cell.classList.remove('drag-over');
                }
            });

            cell.addEventListener('drop', (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                
                const transferData = e.dataTransfer.getData('text/plain');
                const newGridIndex = parseInt(cell.dataset.gridIndex);
                
                console.log('Drop on grid:', newGridIndex, 'data:', transferData);
                
                if (transferData && !isNaN(newGridIndex)) {
                    if (transferData.startsWith('batch:')) {
                        // 批量移動
                        const websiteIds = transferData.replace('batch:', '').split(',');
                        this.moveBatchToGrid(websiteIds, newGridIndex);
                        this.clearSelection();
                    } else {
                        // 單個移動
                        this.moveWebsiteToGrid(transferData, newGridIndex);
                    }
                }
            });
        });
    }

    moveWebsiteToGrid(websiteId, newGridIndex) {
        console.log('Moving website:', websiteId, 'to grid:', newGridIndex);
        
        const currentDesktop = this.desktops[this.currentDesktopId];
        const website = currentDesktop.websites.find(w => w.id === websiteId);
        
        if (!website) {
            console.error('Website not found:', websiteId);
            return;
        }

        // 檢查目標位置是否已被佔用
        const existingWebsite = currentDesktop.websites.find(w => 
            w.gridPosition === newGridIndex && w.id !== websiteId
        );
        
        if (existingWebsite) {
            // 交換位置
            const oldGridIndex = website.gridPosition || 0;
            existingWebsite.gridPosition = oldGridIndex;
            console.log('Swapping positions with website:', existingWebsite.id);
        }

        // 更新位置
        const oldPosition = website.gridPosition;
        website.gridPosition = newGridIndex;
        
        console.log('Updated position from', oldPosition, 'to', newGridIndex);
        
        this.saveData();
        this.renderCurrentDesktop();
    }

    moveBatchToGrid(websiteIds, dropGridIndex) {
        console.log('Moving batch:', websiteIds, 'to grid:', dropGridIndex);
        
        const currentDesktop = this.desktops[this.currentDesktopId];
        const websites = websiteIds.map(id => 
            currentDesktop.websites.find(w => w.id === id)
        ).filter(Boolean);
        
        if (websites.length === 0) return;

        // 計算所有選中圖示的相對位置（以最小位置為基準）
        const positions = websites.map(w => w.gridPosition || 0);
        const minPosition = Math.min(...positions);
        
        // 計算相對偏移量
        const relativeOffsets = websites.map(website => {
            const currentPos = website.gridPosition || 0;
            const row = Math.floor(currentPos / 20);
            const col = currentPos % 20;
            const minRow = Math.floor(minPosition / 20);
            const minCol = minPosition % 20;
            
            return {
                website: website,
                rowOffset: row - minRow,
                colOffset: col - minCol,
                originalPosition: currentPos
            };
        });

        // 計算新的基準位置
        const newBaseRow = Math.floor(dropGridIndex / 20);
        const newBaseCol = dropGridIndex % 20;

        // 暫時記錄需要移動的圖示的原始位置
        const originalPositions = new Map();
        websites.forEach(website => {
            originalPositions.set(website.id, website.gridPosition);
        });

        // 計算新位置並處理位置衝突
        const newPositions = new Map();
        const conflictedWebsites = [];

        relativeOffsets.forEach(({ website, rowOffset, colOffset }) => {
            const newRow = newBaseRow + rowOffset;
            const newCol = newBaseCol + colOffset;
            const newPosition = newRow * 20 + newCol;

            // 檢查新位置是否在邊界內
            if (newRow >= 0 && newRow < 9 && newCol >= 0 && newCol < 20) {
                // 檢查目標位置是否被其他圖示佔用（不包括正在移動的圖示）
                const existingWebsite = currentDesktop.websites.find(w => 
                    w.gridPosition === newPosition && !websiteIds.includes(w.id)
                );
                
                if (existingWebsite) {
                    conflictedWebsites.push(existingWebsite);
                }
                
                newPositions.set(website.id, newPosition);
            } else {
                // 如果超出邊界，保持原位置
                newPositions.set(website.id, website.gridPosition);
            }
        });

        // 將被衝突的圖示移動到空位
        const reservedPositions = new Set(Array.from(newPositions.values()));
        conflictedWebsites.forEach(website => {
            const emptyPosition = this.findNextAvailableGridExcluding(reservedPositions);
            website.gridPosition = emptyPosition;
            reservedPositions.add(emptyPosition);
        });

        // 應用新位置
        websites.forEach(website => {
            const newPosition = newPositions.get(website.id);
            if (newPosition !== undefined) {
                website.gridPosition = newPosition;
            }
        });
        
        this.saveData();
        this.renderCurrentDesktop();
    }

    findAvailablePositions(count, startIndex) {
        const currentDesktop = this.desktops[this.currentDesktopId];
        const usedPositions = new Set(currentDesktop.websites.map(w => w.gridPosition || 0));
        const positions = [];
        
        // 嘗試從起始位置開始找連續位置
        let currentIndex = startIndex;
        let found = 0;
        
        while (found < count && currentIndex < 180) {
            if (!usedPositions.has(currentIndex)) {
                positions.push(currentIndex);
                found++;
            } else {
                // 如果遇到已佔用的位置，重新開始尋找
                positions.length = 0;
                found = 0;
            }
            currentIndex++;
        }
        
        // 如果找不到足夠的連續位置，就分散放置
        if (positions.length < count) {
            positions.length = 0;
            for (let i = 0; i < 180 && positions.length < count; i++) {
                if (!usedPositions.has(i)) {
                    positions.push(i);
                }
            }
        }
        
        return positions;
    }

    findNextAvailableGrid() {
        const currentDesktop = this.desktops[this.currentDesktopId];
        const usedPositions = currentDesktop.websites.map(w => w.gridPosition || 0);
        
        for (let i = 0; i < 180; i++) {
            if (!usedPositions.includes(i)) {
                return i;
            }
        }
        return 0;
    }

    findNextAvailableGridExcluding(excludePositions) {
        const currentDesktop = this.desktops[this.currentDesktopId];
        const usedPositions = new Set(currentDesktop.websites.map(w => w.gridPosition || 0));
        
        // 合併已使用位置和需要排除的位置
        const allExcluded = new Set([...usedPositions, ...excludePositions]);
        
        for (let i = 0; i < 180; i++) {
            if (!allExcluded.has(i)) {
                return i;
            }
        }
        return 0;
    }

    // 桌面拖拽功能
    setupDesktopDragEvents(desktopElement) {
        const desktopId = desktopElement.dataset.desktopId;
        
        desktopElement.addEventListener('dragstart', (e) => {
            // 防止在按鈕上拖拽
            if (e.target.closest('.desktop-actions')) {
                e.preventDefault();
                return;
            }
            
            console.log('Desktop drag start:', desktopId);
            e.dataTransfer.setData('text/plain', `desktop:${desktopId}`);
            e.dataTransfer.effectAllowed = 'move';
            desktopElement.classList.add('dragging');
        });

        desktopElement.addEventListener('dragend', (e) => {
            console.log('Desktop drag end');
            desktopElement.classList.remove('dragging');
        });

        desktopElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const dragData = e.dataTransfer.types.includes('text/plain');
            if (dragData) {
                desktopElement.classList.add('drag-over');
            }
        });

        desktopElement.addEventListener('dragleave', (e) => {
            // 只有當離開的是desktop本身而不是子元素時才移除樣式
            if (!desktopElement.contains(e.relatedTarget)) {
                desktopElement.classList.remove('drag-over');
            }
        });

        desktopElement.addEventListener('drop', (e) => {
            e.preventDefault();
            desktopElement.classList.remove('drag-over');
            
            const transferData = e.dataTransfer.getData('text/plain');
            if (transferData && transferData.startsWith('desktop:')) {
                const draggedDesktopId = transferData.replace('desktop:', '');
                const dropTargetId = desktopElement.dataset.desktopId;
                
                if (draggedDesktopId !== dropTargetId) {
                    this.reorderDesktop(draggedDesktopId, dropTargetId);
                }
            }
        });
    }

    reorderDesktop(draggedDesktopId, dropTargetId) {
        console.log('Reordering desktop:', draggedDesktopId, 'to position of:', dropTargetId);
        
        const draggedIndex = this.desktopOrder.indexOf(draggedDesktopId);
        const dropTargetIndex = this.desktopOrder.indexOf(dropTargetId);
        
        if (draggedIndex === -1 || dropTargetIndex === -1) {
            console.warn('Invalid desktop IDs for reordering');
            return;
        }
        
        // 移除被拖拽的項目
        this.desktopOrder.splice(draggedIndex, 1);
        
        // 重新計算目標位置（因為移除了一個項目，索引可能改變）
        const newTargetIndex = this.desktopOrder.indexOf(dropTargetId);
        
        // 將被拖拽的項目插入到目標位置之前
        this.desktopOrder.splice(newTargetIndex, 0, draggedDesktopId);
        
        console.log('New desktop order:', this.desktopOrder);
        
        this.saveData();
        this.renderDesktops();
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

    // 圖示右鍵選單
    setupIconContextMenu(websiteElement, website) {
        websiteElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.currentEditingWebsite = website;
            this.hideContextMenu();
            this.showIconContextMenu(e.pageX, e.pageY);
        });
    }

    showIconContextMenu(x, y) {
        const iconContextMenu = document.getElementById('iconContextMenu');
        iconContextMenu.style.display = 'block';
        iconContextMenu.style.left = Math.min(x, window.innerWidth - iconContextMenu.offsetWidth) + 'px';
        iconContextMenu.style.top = Math.min(y, window.innerHeight - iconContextMenu.offsetHeight) + 'px';
    }

    hideIconContextMenu() {
        document.getElementById('iconContextMenu').style.display = 'none';
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

    // 編輯網站功能
    editCurrentWebsite() {
        if (!this.currentEditingWebsite) return;
        
        const website = this.currentEditingWebsite;
        document.getElementById('editWebsiteName').value = website.name;
        document.getElementById('editWebsiteUrl').value = website.url;
        document.getElementById('editWebsiteIcon').value = website.icon.startsWith('data:') ? '' : website.icon;
        
        this.showModal('editWebsiteModal');
    }

    deleteCurrentWebsite() {
        if (!this.currentEditingWebsite) return;
        this.deleteWebsite(this.currentEditingWebsite.id);
    }

    updateWebsite() {
        if (!this.currentEditingWebsite) return;

        const name = document.getElementById('editWebsiteName').value.trim();
        const url = document.getElementById('editWebsiteUrl').value.trim();
        const icon = document.getElementById('editWebsiteIcon').value.trim();

        if (!name || !url) {
            alert('請填寫網站名稱和網址！');
            return;
        }

        const currentDesktop = this.desktops[this.currentDesktopId];
        const website = currentDesktop.websites.find(w => w.id === this.currentEditingWebsite.id);
        
        if (website) {
            const finalUrl = url.startsWith('http') ? url : 'https://' + url;
            website.name = name;
            website.url = finalUrl;
            website.icon = icon || this.getFaviconUrl(finalUrl);
            
            this.saveData();
            this.renderCurrentDesktop();
            this.hideModal('editWebsiteModal');
            
            // 清空表單
            document.getElementById('editWebsiteName').value = '';
            document.getElementById('editWebsiteUrl').value = '';
            document.getElementById('editWebsiteIcon').value = '';
        }
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
                        this.desktopOrder = data.desktopOrder || Object.keys(data.desktops);
                        
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