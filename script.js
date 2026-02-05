const firebaseConfig = {
  apiKey: "AIzaSyDeQBdoFn7GSISvbApUm3cYibNXLnnfx7U",
  authDomain: "cloudwed.firebaseapp.com",
  databaseURL: "https://cloudwed-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cloudwed",
  storageBucket: "cloudwed.firebasestorage.app",
  messagingSenderId: "439323775591",
  appId: "1:439323775591:web:c51ee6faa887be1b52bac2",
  measurementId: "G-DJKCVMND8M"
};
firebase.initializeApp(firebaseConfig);

const db = firebase.database();
const auth = firebase.auth();

// --- STATE ---
let isAdmin = false;
let currentTab = 'video';
let currentFolderId = null; 
let currentSortMode = 'date_desc';
let currentSearchTerm = ''; 
let currentViewMode = 'grid'; // MỚI: Chế độ xem (grid/list)
let allData = [];
let dataMap = {}; 

// --- PERFORMANCE STATE ---
let processedData = []; 
let renderLimit = 24;   
let searchTimeout = null; 

let appClipboard = { action: null, id: null };
let contextTargetId = null;

// ==============================================
// --- TÍNH NĂNG MỚI: GIỚI HẠN THIẾT BỊ (MAX 20) ---
// ==============================================
function initDeviceLimit() {
    const activeRef = db.ref('active_sessions');
    const myDeviceRef = activeRef.push(); // Tạo ID phiên làm việc mới
    const connectedRef = db.ref('.info/connected');

    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            // Khi kết nối thành công, kiểm tra số lượng
            activeRef.once('value').then(snapshot => {
                const count = snapshot.numChildren();
                console.log("Current devices:", count);

                if (count >= 20) {
                    // Quá 20 người -> Chặn
                    document.getElementById('limit-overlay').style.display = 'flex';
                    // Không cho phép đăng ký phiên làm việc này
                } else {
                    // Chưa quá 20 người -> Cho phép vào
                    document.getElementById('limit-overlay').style.display = 'none';
                    
                    // Đăng ký online và tự xóa khi offline
                    myDeviceRef.onDisconnect().remove();
                    myDeviceRef.set({
                        timestamp: firebase.database.ServerValue.TIMESTAMP,
                        userAgent: navigator.userAgent
                    });
                }
            });
        }
    });
}
initDeviceLimit();

// ==============================================
// --- TÍNH NĂNG MỚI: CHUYỂN ĐỔI LIST VIEW ---
// ==============================================
function initViewMode() {
    const savedMode = localStorage.getItem('viewMode');
    if (savedMode === 'list') {
        currentViewMode = 'list';
        document.getElementById('grid').classList.add('list-view');
        document.getElementById('viewBtn').innerText = '▦'; // Icon lưới
    } else {
        currentViewMode = 'grid';
        document.getElementById('grid').classList.remove('list-view');
        document.getElementById('viewBtn').innerText = '⊞'; // Icon danh sách
    }
}
// Chạy khi tải trang
initViewMode();

function toggleViewMode() {
    const grid = document.getElementById('grid');
    const btn = document.getElementById('viewBtn');
    
    if (currentViewMode === 'grid') {
        currentViewMode = 'list';
        grid.classList.add('list-view');
        btn.innerText = '▦'; 
        localStorage.setItem('viewMode', 'list');
    } else {
        currentViewMode = 'grid';
        grid.classList.remove('list-view');
        btn.innerText = '⊞';
        localStorage.setItem('viewMode', 'grid');
    }
}

// --- THEME ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const checkbox = document.getElementById('theme-checkbox');

    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        // Nếu là dark mode, đánh dấu checkbox là đã chọn (để hiện mặt trăng)
        if(checkbox) checkbox.checked = true;
    } else {
        document.documentElement.removeAttribute('data-theme');
        // Nếu là light mode, bỏ chọn checkbox (để hiện mặt trời)
        if(checkbox) checkbox.checked = false;
    }
}
initTheme();

function toggleTheme() {
    const checkbox = document.getElementById('theme-checkbox');
    
    // Kiểm tra xem người dùng vừa bật hay tắt checkbox
    if (checkbox.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    }
}

// --- AUTH LISTENER ---
auth.onAuthStateChanged((user) => {
    const btnNew = document.getElementById('btnNew');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminTool = document.getElementById('adminTool');

    if (user) {
        isAdmin = true;
        btnNew.style.display = 'block';
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
    } else {
        isAdmin = false;
        btnNew.style.display = 'none';
        adminTool.style.display = 'none';
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
    }
});

// --- DATA FETCHING ---
db.ref('videos').on('value', (snapshot) => {
    allData = [];
    dataMap = {}; 
    
    snapshot.forEach(child => {
        const val = child.val();
        if (val.parentId === undefined) val.parentId = null;
        const item = { key: child.key, ...val };
        allData.push(item);
        dataMap[child.key] = item; 
    });
    // Khi dữ liệu thay đổi, chạy lại luồng xử lý
    updateDataPipeline();
});

// --- CORE: DATA PIPELINE (TỐI ƯU HIỆU SUẤT) ---
function updateDataPipeline() {
    updateBreadcrumb();
    
    // 1. Lọc dữ liệu (Filter)
    let filtered = allData.filter(item => {
        if (item.parentId !== currentFolderId) return false;
        
        let tabMatch = (item.type === 'folder') 
            ? (item.tabCategory === currentTab) 
            : (item.type === currentTab);
        if (!tabMatch) return false;

        if (currentSearchTerm && !item.title.toLowerCase().includes(currentSearchTerm)) {
            return false;
        }
        return true;
    });

    // 2. Sắp xếp (Sort)
    filtered.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;

        const [criteria, order] = currentSortMode.split('_'); 
        
        if (criteria === 'date') {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            return order === 'asc' ? timeA - timeB : timeB - timeA;
        } else {
            const nameA = a.title || "";
            const nameB = b.title || "";
            const options = { numeric: true, sensitivity: 'base' };
            return order === 'asc' 
                ? nameA.localeCompare(nameB, 'vi', options) 
                : nameB.localeCompare(nameA, 'vi', options);
        }
    });

    // 3. Lưu kết quả và Reset hiển thị
    processedData = filtered;
    renderLimit = 24; 
    renderGrid();     
}

// --- RENDER UI (LAZY LOADING) ---
function renderGrid() {
    const grid = document.getElementById('grid');
    
    if (processedData.length === 0) {
        let msg = currentSearchTerm ? `Không tìm thấy "${currentSearchTerm}"` : "Thư mục trống";
        grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--text-sub); margin-top:50px;">${msg}</p>`;
        return;
    }

    const itemsToRender = processedData.slice(0, renderLimit);

    const htmlBuffer = itemsToRender.map(data => {
        const isFolder = data.type === 'folder';
        
        let icon = '▶';
        if (isFolder) icon = '📁';
        else if (data.type === 'image') icon = '📷';
        else if (data.type === 'doc') icon = '📄';
        else if (data.type === 'other') icon = '📦';

        const thumbUrl = !isFolder ? `https://drive.google.com/thumbnail?id=${data.id}&sz=w400` : '';
        
        let thumbContent = '';
        if (isFolder) {
            thumbContent = `<div class="folder-icon">📁</div>`;
        } else if (data.type === 'other') {
            thumbContent = `<div style="font-size:40px">📦</div>`; 
        } else {
            thumbContent = `<img src="${thumbUrl}" loading="lazy" decoding="async" onerror="this.style.display='none'">`;
        }

        const downloadLink = `https://drive.google.com/uc?export=download&id=${data.id}`;
        const downloadIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
        
        const downloadBtn = !isFolder ? `
            <a href="${downloadLink}" class="btn-download" title="Tải xuống" target="_blank" onclick="event.stopPropagation()">
                ${downloadIcon}
            </a>` : '';

        const playOverlay = (!isFolder && data.type === 'video') ? 
            `<div class="play-overlay">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </div>` : '';

        return `
            <div class="card ${isFolder ? 'is-folder' : ''}" 
                 oncontextmenu="showContextMenu(event, '${data.key}', true)"
                 onclick="handleClick('${data.key}', '${data.type}', '${data.id}')">
                
                <div class="thumb-box">
                    ${thumbContent}
                    ${playOverlay}
                </div>

                <div class="card-footer">
                    <div class="file-info">
                        ${!isFolder ? `<span style="margin-right:5px">${icon}</span>` : ''}
                        <span class="file-name" title="${data.title}">${data.title}</span>
                    </div>
                    ${downloadBtn}
                </div>
            </div>
        `;
    }).join('');

    grid.innerHTML = htmlBuffer;
}

// --- INFINITE SCROLL ---
window.addEventListener('scroll', () => {
    if (renderLimit < processedData.length) {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
            renderLimit += 24; 
            renderGrid();      
        }
    }
});

// --- CONTROLLERS ---

function changeSortMode(mode) {
    currentSortMode = mode;
    const select = document.getElementById('sortSelect');
    if(select) select.value = mode;
    updateDataPipeline(); 
}

function handleSearch(val) {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentSearchTerm = val.toLowerCase().trim();
        updateDataPipeline();
    }, 300);
}

function switchTab(type) {
    if (currentTab === type) return; 
    currentTab = type;
    currentFolderId = null; 
    currentSearchTerm = ''; 
    document.getElementById('searchInput').value = '';
    changeSortMode('date_desc'); 

    // CẬP NHẬT GIAO DIỆN TAB MỚI
    // Tự động check vào radio button tương ứng
    const radioBtn = document.getElementById(`tab-${type}-radio`);
    if (radioBtn) radioBtn.checked = true;

    // Load lại dữ liệu
    updateDataPipeline();
}

function handleClick(key, type, driveId) {
    if (type === 'folder') {
        currentFolderId = key;
        currentSearchTerm = '';
        document.getElementById('searchInput').value = '';
        
        const folder = dataMap[key];
        if (folder && folder.defaultSort) {
            changeSortMode(folder.defaultSort); 
        } else {
            updateDataPipeline();
        }
    } else {
        // LẤY TIÊU ĐỀ ĐỂ HIỂN THỊ TRONG POPUP
        const item = dataMap[key];
        const title = item ? item.title : 'Media Viewer';
        openMedia(driveId, type, title);
    }
}

function navigateTo(targetId) {
    currentFolderId = (targetId === 'root') ? null : targetId;
    currentSearchTerm = '';
    document.getElementById('searchInput').value = '';
    
    if (!currentFolderId) {
        changeSortMode('date_desc');
    } else {
        const folder = dataMap[currentFolderId];
        if (folder && folder.defaultSort) changeSortMode(folder.defaultSort);
        else updateDataPipeline();
    }
}

function updateBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    let html = `<span class="crumb-item" onclick="navigateTo('root')">Trang chủ (${currentTab})</span>`;
    
    if (currentFolderId) {
        let path = [];
        let curr = dataMap[currentFolderId];
        let safetyCounter = 0;
        while(curr && safetyCounter < 50) {
            path.unshift(curr);
            if (!curr.parentId) break;
            curr = dataMap[curr.parentId]; 
            safetyCounter++;
        }
        path.forEach(folder => {
            html += ` <span class="crumb-separator">/</span> <span class="crumb-item" onclick="navigateTo('${folder.key}')">${folder.title}</span>`;
        });
    }
    bc.innerHTML = html;
}

// --- CONTEXT MENU ---
const contextMenu = document.getElementById('contextMenu');

document.addEventListener('contextmenu', function(e) {
    if (e.target.closest('.container')) {
        e.preventDefault();
        if (!e.target.closest('.card')) {
            showContextMenu(e, null, false);
        }
    }
});

document.addEventListener('click', () => {
    if (contextMenu.style.display === 'block') contextMenu.style.display = 'none';
});

function showContextMenu(e, key, isItem) {
    e.preventDefault();
    e.stopPropagation();
    contextTargetId = key;

    const contextMenu = document.getElementById('contextMenu');
    const menuFile = document.getElementById('ctx-file-actions');
    const menuBg = document.getElementById('ctx-bg-actions');
    const menuSetSort = document.getElementById('menuSetSort');

    // Reset hiển thị
    menuFile.style.display = 'none';
    menuBg.style.display = 'none';

    if (isItem) {
        // Nếu click vào file/thư mục
        menuFile.style.display = 'block';
        
        // Logic hiển thị nút "Sắp xếp" cho Folder
        const targetItem = dataMap[key];
        if (targetItem && targetItem.type === 'folder' && isAdmin) {
            menuSetSort.style.display = 'flex'; // Dùng flex để giữ layout của .item
        } else {
            menuSetSort.style.display = 'none';
        }
    } else {
        // Nếu click vào vùng trống
        menuBg.style.display = 'block';
    }

    // Xử lý vị trí menu để không bị tràn màn hình
    contextMenu.style.display = 'block';
    let top = e.clientY;
    let left = e.clientX;
    
    // Lấy kích thước menu thực tế
    const menuWidth = 260; // Theo CSS .context-card width
    const menuHeight = contextMenu.offsetHeight || 300; // Ước lượng nếu chưa render kịp

    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
    if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10;

    contextMenu.style.top = `${top}px`;
    contextMenu.style.left = `${left}px`;
}

// --- MODAL & PREVIEW ---
function openMedia(id, type, title) {
    const modal = document.getElementById('mediaModal');
    const content = document.getElementById('modalContent');
    
    // Reset nội dung
    content.innerHTML = '';
    content.className = 'modal-content'; 
    if (type === 'doc') content.classList.add('view-doc');
    if (type === 'image') content.classList.add('view-image');

    modal.style.display = 'flex';
    
    // CẤU TRÚC HTML MỚI: Header + Body
    const htmlStructure = `
        <div class="media-window">
            <div class="media-header">
                <h3 class="media-title" title="${title}">${title}</h3>
                <button class="btn-close-media" onclick="closeMedia(event, true)">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
                </button>
            </div>
            <div class="media-body">
                ${type === 'image' 
                    ? `<img src="https://drive.google.com/thumbnail?id=${id}&sz=w2000" onload="this.classList.add('loaded')" class="media-content">`
                    : `<iframe src="https://drive.google.com/file/d/${id}/preview" allow="autoplay; fullscreen" onload="this.classList.add('loaded')" class="media-content"></iframe>`
                }
            <div class="loader"></div>
            </div>
        </div>
    `;

    content.innerHTML = htmlStructure;
}

function closeMedia(e, force) {
    if (force) {
        document.getElementById('mediaModal').style.display = 'none';
        document.getElementById('modalContent').innerHTML = '';
    }
}

// --- CUSTOM MODAL LOGIC ---
const acModal = document.getElementById('actionModal');
const acTitle = document.getElementById('acModalTitle');
const acDesc = document.getElementById('acModalDesc');
const acInput = document.getElementById('acModalInput');
const acSelect = document.getElementById('acModalSelect');
const acBtn = document.getElementById('acModalBtn');
const acCancelBtn = document.querySelector('.btn-modal-cancel');

function showActionModal({ title, desc, type, initialValue = '', onConfirm }) {
    acModal.style.display = 'flex';
    acTitle.innerText = title;
    acDesc.innerText = desc || '';
    acInput.value = initialValue;
    acBtn.onclick = null; 
    
    acInput.style.display = 'none';
    acDesc.style.display = 'none';
    acSelect.style.display = 'none';
    acCancelBtn.style.display = 'block';

    if (type === 'prompt') {
        acInput.style.display = 'block';
        setTimeout(() => acInput.focus(), 100);
    } 
    else if (type === 'select') {
        acSelect.style.display = 'block';
        acSelect.value = initialValue || 'date_desc';
    }
    else if (type === 'confirm') {
        acDesc.style.display = 'block';
    } 
    else if (type === 'alert') {
        acDesc.style.display = 'block';
        acCancelBtn.style.display = 'none';
    }

    acBtn.onclick = () => {
        let value = null;
        if (type === 'prompt') {
            if (!acInput.value.trim()) return;
            value = acInput.value;
        } else if (type === 'select') {
            value = acSelect.value;
        }
        
        if (onConfirm) onConfirm(value);
        closeActionModal();
    };

    acInput.onkeydown = (e) => {
        if (e.key === 'Enter') acBtn.click();
    };
}

function closeActionModal() {
    acModal.style.display = 'none';
}

// --- ACTION HANDLERS ---

function editLinkUI() {
    if (!isAdmin) { showActionModal({ title: "Thông báo", desc: "Cần quyền Admin!", type: 'alert' }); return; }
    
    const item = dataMap[contextTargetId];
    if (!item) return;
    if (item.type === 'folder') {
        showActionModal({ title: "Lỗi", desc: "Không thể sửa link của thư mục!", type: 'alert' });
        return;
    }

    showActionModal({
        title: "Cập nhật Link File",
        type: 'prompt',
        initialValue: "", 
        onConfirm: (newLink) => {
            const newId = extractFileId(newLink);
            if (newId) {
                db.ref('videos/' + contextTargetId).update({ id: newId })
                  .then(() => showToast("Đã cập nhật link!"));
            } else {
                showActionModal({ title: "Lỗi", desc: "Link không hợp lệ", type: 'alert' });
            }
        }
    });
}

function setFolderSortUI() {
    if (!isAdmin) return;
    const item = dataMap[contextTargetId];
    if (!item) return;

    showActionModal({
        title: "Cài đặt sắp xếp mặc định",
        desc: "Chọn kiểu sắp xếp sẽ áp dụng khi mở thư mục này:",
        type: 'select',
        initialValue: item.defaultSort || 'date_desc',
        onConfirm: (mode) => {
            db.ref('videos/' + contextTargetId).update({ defaultSort: mode })
              .then(() => showToast("Đã lưu cài đặt!"));
        }
    });
}

function createFolderUI() {
    if (!isAdmin) { showActionModal({ title: "Thông báo", desc: "Cần quyền Admin!", type: 'alert' }); return; }
    showActionModal({
        title: "Tạo thư mục mới",
        type: 'prompt',
        initialValue: "Thư mục mới",
        onConfirm: (name) => {
            db.ref('videos').push({
                title: name,
                type: 'folder',
                tabCategory: currentTab,
                parentId: currentFolderId,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });
}

function renameItemUI() {
    if (!isAdmin) { showActionModal({ title: "Thông báo", desc: "Cần quyền Admin!", type: 'alert' }); return; }
    const item = dataMap[contextTargetId];
    if (!item) return;
    showActionModal({
        title: "Đổi tên tệp",
        type: 'prompt',
        initialValue: item.title,
        onConfirm: (newName) => {
            if (newName && newName !== item.title) {
                db.ref('videos/' + contextTargetId).update({ title: newName });
            }
        }
    });
}

// Hàm bổ trợ: Tìm tất cả ID con cháu (đệ quy)
function getDescendantIds(targetId) {
    let ids = [];
    
    // Lọc ra các item con trực tiếp của targetId từ biến toàn cục allData
    // (Vì allData đã chứa toàn bộ dữ liệu tải về nên ta không cần query lại server)
    const children = allData.filter(item => item.parentId === targetId);
    
    children.forEach(child => {
        ids.push(child.key); // Thêm con vào danh sách xóa
        
        // Nếu con là folder, tiếp tục đào sâu tìm cháu chắt
        if (child.type === 'folder') {
            ids = ids.concat(getDescendantIds(child.key));
        }
    });
    
    return ids;
}

function deleteItem() {
    // 1. Kiểm tra quyền Admin
    if (!isAdmin) { 
        showActionModal({ title: "Thông báo", desc: "Cần quyền Admin!", type: 'alert' }); 
        return; 
    }

    // 2. Xác nhận xóa
    showActionModal({
        title: "Xóa mục này?",
        desc: "LƯU Ý: Nếu là thư mục, toàn bộ file bên trong sẽ bị xóa vĩnh viễn!",
        type: 'confirm',
        onConfirm: () => {
            // A. Chuẩn bị danh sách ID cần xóa
            // Bao gồm chính nó và tất cả con cháu (nếu có)
            const allIdsToDelete = [contextTargetId, ...getDescendantIds(contextTargetId)];
            
            // B. Tạo object update để xóa hàng loạt (Multi-path update)
            // Kỹ thuật này giúp chỉ gửi 1 request lên server thay vì gửi hàng trăm request
            const updates = {};
            allIdsToDelete.forEach(id => {
                updates['videos/' + id] = null; // Gán null nghĩa là xóa
            });

            // C. Thực thi xóa
            db.ref().update(updates)
                .then(() => {
                    showToast(`Đã xóa vĩnh viễn ${allIdsToDelete.length} mục.`);
                    // Nếu đang đứng trong thư mục vừa bị xóa (trường hợp hiếm), quay về root
                    if (contextTargetId === currentFolderId) {
                        navigateTo('root');
                    }
                })
                .catch(err => {
                    console.error(err);
                    showActionModal({ title: "Lỗi", desc: "Không thể xóa dữ liệu: " + err.message, type: 'alert' });
                });
        }
    });
}

function copyItem() {
    if (!isAdmin) { showToast("Cần quyền Admin!"); return; }
    appClipboard = { action: 'copy', id: contextTargetId };
    showToast("Đã chép vào bộ nhớ tạm");
}

function cutItem() {
    if (!isAdmin) { showToast("Cần quyền Admin!"); return; }
    appClipboard = { action: 'cut', id: contextTargetId };
    showToast("Đã chọn để di chuyển");
}

function pasteItem() {
    if (!isAdmin) { showToast("Cần quyền Admin!"); return; }
    if (!appClipboard.id) { showToast("Chưa có gì để dán!"); return; }
    if (appClipboard.id === currentFolderId) {
        showActionModal({ title: "Lỗi", desc: "Không thể dán vào chính nó!", type: 'alert' });
        return;
    }
    const sourceItem = dataMap[appClipboard.id];
    if (!sourceItem) return;

    const updates = {
        parentId: currentFolderId,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    if (sourceItem.type === 'folder') updates.tabCategory = currentTab;
    else updates.type = currentTab;

    if (appClipboard.action === 'cut') {
        db.ref('videos/' + appClipboard.id).update(updates)
            .then(() => {
                showToast("Đã di chuyển");
                appClipboard = { action: null, id: null }; 
            });
    } else if (appClipboard.action === 'copy') {
        const newItem = { ...sourceItem, ...updates, title: sourceItem.title + " (Copy)" };
        delete newItem.key; 
        db.ref('videos').push(newItem).then(() => showToast("Đã dán bản sao"));
    }
}

function downloadItem() {
    const item = dataMap[contextTargetId];
    if (item && item.type !== 'folder') {
        window.open(`https://drive.google.com/uc?export=download&id=${item.id}`, '_blank');
    }
}

function openContextItem() {
    const item = dataMap[contextTargetId];
    if (item) handleClick(item.key, item.type, item.id);
}

// --- UTILS ---
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.className = "show";
    setTimeout(() => toast.className = toast.className.replace("show", ""), 3000);
}

function extractFileId(url) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)|id=([a-zA-Z0-9_-]+)/);
    return match ? (match[1] || match[2]) : null;
}

function autoFillID() {
    const id = extractFileId(document.getElementById('mediaUrl').value);
    if (id) document.getElementById('mediaTitle').placeholder = "Nhập tên...";
}

function toggleAdminTool() {
    const el = document.getElementById('adminTool');
    el.style.display = (el.style.display === 'block') ? 'none' : 'block';
}

function addToCloud() {
    if (!isAdmin) return;
    const url = document.getElementById('mediaUrl').value;
    const id = extractFileId(url);
    const title = document.getElementById('mediaTitle').value || ("File " + id?.substring(0,5));
    if (id) {
        db.ref('videos').push({
            id: id, title: title, type: currentTab, 
            parentId: currentFolderId, 
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        document.getElementById('mediaUrl').value = '';
        document.getElementById('mediaTitle').value = '';
        toggleAdminTool();
        showToast("Thêm tệp thành công!"); 
    } else {
        showActionModal({ title: "Lỗi Link", desc: "Link không hợp lệ.", type: 'alert' });
    }
}

// --- AUTH FNS ---
function showLogin() {
    document.getElementById('overlay').style.display = 'block';
    // Đảm bảo dùng 'flex' để ăn theo thuộc tính justify/align trong CSS
    const panel = document.getElementById('login-panel');
    if (panel) panel.style.display = 'flex'; 
    
    const errEl = document.getElementById('loginError');
    if(errEl) errEl.style.display = 'none';
}
function closeLogin() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('login-panel').style.display = 'none';
}

function loginAdmin() {
    const email = document.getElementById('adminEmail').value;
    const pass = document.getElementById('adminPass').value;
    
    const btn = document.getElementById('btnLogin'); // Phải khớp với ID trong index.html
    const errObj = document.getElementById('loginError');

    if(btn) {
        btn.innerText = "Đang xử lý...";
        btn.disabled = true;
    }
    
    auth.signInWithEmailAndPassword(email, pass)
        .then(() => closeLogin())
        .catch((error) => {
            if(errObj) {
                errObj.innerText = "Sai tài khoản hoặc mật khẩu!";
                errObj.style.display = 'block';
            }
        })
        .finally(() => {
            if(btn) {
                btn.innerText = "Truy cập!";
                btn.disabled = false;
            }
        });
}

function logout() {
    auth.signOut().then(() => showToast("Đã đăng xuất"));
}