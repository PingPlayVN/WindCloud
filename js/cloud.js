// js/cloud.js

import { handleImgError, renderSkeleton, extractFileId, confirmDownload, escapeHtml, escapeAttr, openSafe } from './utils.js';
import { showToast, showActionModal, closeActionModal } from './ui.js';
import { switchApp, toggleSidebar, showLogin, closeLogin, loginAdmin, logout, toggleTheme } from './core.js';
import { db } from './firebase.js';
import { updatePaletteSystem, randomBaseColor, exportPalette, exportPaletteJSON, copyColor } from './palette.js';
import { cancelTransfer } from './drop.js';
import { StorageProviders, resolveProvider } from './cloudAdapters.js';
import { initMobileContextMenu, enableMobileContextMenuDismissal } from './mobileContextMenu.js';

let currentTab = 'video';
let currentSortMode = 'date_desc';
let currentSearchTerm = ''; 
let currentViewMode = 'grid';
let allData = [];
let dataMap = {}; 
let processedData = []; 
let renderLimit = 24;   
let searchTimeout = null; 
let contextTargetId = null;
let currentPathRef = null;
let currentFolderPath = ''; // Path to current folder in nested structure (empty = root)
let folderStack = [];
let pendingFileToOpen = new URLSearchParams(window.location.search).get('file');
// e.g., '' for cloud/videos root
// e.g., 'folder1' for cloud/videos/folder1
// e.g., 'folder1/subfolder' for cloud/videos/folder1/subfolder

// Helper: Get Cloud Storage Path
function getCloudPath() {
    const tabMap = {
        'video': 'cloud/videos',
        'image': 'cloud/images',
        'doc': 'cloud/docs',
        'other': 'cloud/others'
    };
    return tabMap[currentTab] || 'cloud/videos';
}

// Helper: Get full path to current folder
function getFullCurrentPath() {
    const basePath = getCloudPath();
    if (currentFolderPath) {
        return basePath + '/' + currentFolderPath;
    }
    return basePath;
}

// Attach listener with proper cleanup
function attachDataListener() {
    if (currentPathRef) {
        currentPathRef.off('value');
    }
    const fullPath = getFullCurrentPath();
    currentPathRef = db.ref(fullPath);
    currentPathRef.on('value', (snapshot) => {
        allData = [];
        dataMap = {}; 
        snapshot.forEach(child => {
            const val = child.val();
            if (val && typeof val === 'object') {
                const item = { key: child.key, ...val };
                allData.push(item);
                dataMap[child.key] = item; 
            }
        });
        updateDataPipeline();
    }, (error) => {
        showToast("❌ Lỗi tải dữ liệu: " + error.message);
    });
}

// [FIX] Gọi Skeleton NGAY LẬP TỨC khi file JS chạy (để lấp đầy màn hình lúc chờ mạng)
renderSkeleton();

// --- XỬ LÝ LINK CHIA SẺ TỪ URL --- //
async function processSharedUrl() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const folder = params.get('folder');

    if (tab) {
        currentTab = tab;
        const radio = document.getElementById(`tab-${tab}-radio`);
        if(radio) radio.checked = true;
    }

    if (folder) {
        currentFolderPath = folder;
        
        // 1. Tái tạo tạm thanh điều hướng với chữ "Đang tải..."
        folderStack = folder.split('/').map(id => ({ id: id, title: 'Đang tải...' }));
        updateBreadcrumb(); // Cập nhật giao diện ngay lập tức

        // 2. Tự động gọi Firebase để lấy tên thật của từng cấp thư mục
        const parts = folder.split('/');
        let basePath = getCloudPath(); // Ví dụ: 'cloud/videos'
        let realStack = [];
        
        for (let i = 0; i < parts.length; i++) {
            basePath += '/' + parts[i]; // Ghép dần từng ID vào đường dẫn
            try {
                // Đọc dữ liệu của thư mục này từ Firebase
                const snap = await db.ref(basePath).once('value');
                const data = snap.val();
                realStack.push({
                    id: parts[i],
                    title: (data && data.title) ? data.title : 'Thư mục' // Lấy tên thật, nếu không có thì để mặc định
                });
            } catch(err) {
                realStack.push({ id: parts[i], title: 'Thư mục' });
            }
        }
        
        // 3. Gắn lại tên thật và cập nhật thanh điều hướng lần cuối
        folderStack = realStack;
        updateBreadcrumb();
    }
}
processSharedUrl(); // Gọi ngay lúc load

// --- DATA FETCHING ---
attachDataListener();

// --- CORE PIPELINE ---
function updateDataPipeline() {
    updateBreadcrumb();
    let filtered = allData.filter(item => {
        // In nested structure, we only show items that are at current level
        // Folders and files are distinguished by type only
        if (currentSearchTerm && !item.title.toLowerCase().includes(currentSearchTerm)) return false;
        return true;
    });

    // Sort
    filtered.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        
        const [criteria, order] = currentSortMode.split('_'); 
        if (criteria === 'date') {
            return order === 'asc' ? (a.timestamp||0) - (b.timestamp||0) : (b.timestamp||0) - (a.timestamp||0);
        } else {
            const nameA = a.title || "";
            const nameB = b.title || "";
            return order === 'asc' 
                ? nameA.localeCompare(nameB, 'vi', {numeric: true}) 
                : nameB.localeCompare(nameA, 'vi', {numeric: true});
        }
    });

    processedData = filtered;
    renderLimit = 24; 
    renderGrid(false);

    if (pendingFileToOpen) {
        const targetItem = dataMap[pendingFileToOpen];
        if (targetItem) {
            handleClick(targetItem.key, targetItem.type, targetItem.id);
            pendingFileToOpen = null; // Đã mở xong thì xóa đi để không mở lại lần nữa
        }
    }
}

// Hàm sinh HTML cho từng item (Tách ra để tái sử dụng)
function generateItemHTML(data) {
    const isFolder = data.type === 'folder';
    const safeKey = escapeAttr(data.key);
    const safeId = escapeAttr(data.id || '');
    const safeTitleText = escapeHtml(data.title || '');
    const safeTitleAttr = escapeAttr(data.title || '');
    let icon = isFolder ? '📁' : (data.type === 'image' ? '📷' : (data.type === 'doc' ? '📄' : '📦'));
    
    // Resolve provider for this item (adapter pattern)
    const provider = resolveProvider(data);

    let thumbContent = '';
    if (isFolder) {
        thumbContent = `<div class="folder-icon">📁</div>`;
    } else if (data.type === 'other') {
        thumbContent = `<div style="font-size:40px">📦</div>`; 
    } else {
        const thumbUrl = provider.getThumb(data.id);
        if (thumbUrl) {
            thumbContent = `<img class="thumb-img" src="${thumbUrl}" loading="lazy" decoding="async" data-id="${safeId}">`;
        } else {
            thumbContent = `<div style="font-size:40px">📦</div>`; 
        }
    }

    // Xử lý một biến downloadLink duy nhất via provider
    const downloadLink = provider.getDownloadUrl(data.id || '');

    const downloadIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
    // Use data attributes and delegate click to avoid embedding raw URLs in HTML
    const safeTitle = escapeAttr((data.title || '').replace(/\n/g, ' '));
    const safeLink = escapeAttr(downloadLink || '');
    const downloadBtn = !isFolder ? `<button type="button" class="btn-download" title="Tải xuống" data-link='${safeLink}' data-title='${safeTitle}'>${downloadIcon}</button>` : '';
    const playOverlay = (!isFolder && data.type === 'video') ? `<div class="play-overlay"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>` : '';

    // Use data attributes instead of inline handlers; clicks/contextmenu delegated in JS
    return `
        <div class="card ${isFolder ? 'is-folder' : ''}" data-key="${safeKey}" data-type="${data.type}" data-id="${safeId}">
            <div class="thumb-box">${thumbContent}${playOverlay}</div>
            <div class="card-footer">
                <div class="file-info">
                    <span class="file-name" title="${safeTitleAttr}">${safeTitleText}</span>
                </div>
                ${downloadBtn}
            </div>
        </div>
    `;
}

// [TỐI ƯU HIỆU NĂNG] Render Grid chống DOM Thrashing
function renderGrid(append = false) {
    const grid = document.getElementById('grid');
    
    // Xử lý trường hợp trống
    if (processedData.length === 0) {
        let msg = currentSearchTerm ? `Không tìm thấy "${currentSearchTerm}"` : "Thư mục trống";
        // Thay thế nội dung bằng replaceChildren thay vì innerHTML để an toàn và tối ưu hơn
        const p = document.createElement('p');
        p.style.cssText = "grid-column:1/-1; text-align:center; color:var(--text-sub); margin-top:50px;";
        p.textContent = msg;
        grid.replaceChildren(p);
        return;
    }

    // Xác định khoảng item cần vẽ
    // [Tối ưu]: Tránh dùng querySelectorAll('.media-grid .card'), thay bằng grid.children.length (O(1))
    const startIndex = append ? grid.children.length : 0;
    const itemsToRender = processedData.slice(startIndex, renderLimit);

    // Nếu không có gì mới để vẽ thì thôi
    if (itemsToRender.length === 0) return;

    // 1. Tạo DocumentFragment (DOM ảo trên RAM)
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    
    // Tạo chuỗi HTML và parse nó thành các DOM Node thực thụ
    tempDiv.innerHTML = itemsToRender.map(data => generateItemHTML(data)).join('');
    
    // Di chuyển các Node từ tempDiv sang fragment
    while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
    }

    // 2. Đồng bộ tác vụ render với Paint Cycle của trình duyệt
    requestAnimationFrame(() => {
        if (append) {
            // Chèn thêm vào cuối (KHÔNG gây reflow lại toàn trang)
            grid.appendChild(fragment);
        } else {
            // Cách mới: Dùng replaceChildren cực kì tối ưu so với innerHTML = ''
            grid.replaceChildren(fragment);
        }
        if (typeof window.animateGridItems === 'function') {
            window.animateGridItems();
        }
    });
}

// --- VIEW & SCROLL ---
function initViewMode() {
    const savedMode = localStorage.getItem('viewMode');
    if (savedMode === 'list') {
        currentViewMode = 'list';
        const grid = document.getElementById('grid');
        if(grid) grid.classList.add('list-view');
        const btn = document.getElementById('viewBtn');
        if(btn) btn.innerText = '▦';
    }
}
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

// [TỐI ƯU] Sự kiện cuộn trang
window.addEventListener('scroll', () => {
    // Chỉ tải thêm khi cuộn gần đáy và còn dữ liệu chưa hiển thị
    if (renderLimit < processedData.length && (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
        renderLimit += 24; 
        renderGrid(true); // true = Chế độ Append (Gắn thêm)
    }
});

// --- NAVIGATION ---
function switchTab(type) {
    if (currentTab === type) return; 
    currentTab = type;
    currentFolderPath = ''; // Reset to root of new tab
    folderStack = [];
    currentSearchTerm = ''; 
    document.getElementById('searchInput').value = '';
    changeSortMode('date_desc'); 
    
    const radio = document.getElementById(`tab-${type}-radio`);
    if(radio) radio.checked = true;

    attachDataListener();
    updateDataPipeline();
}

function handleClick(key, type, driveId) {
    if (type === 'folder') {
        const folder = dataMap[key];
        const folderTitle = folder ? (folder.title || key) : key; 
        folderStack.push({ id: key, title: folderTitle });
        // Navigate into folder
        currentFolderPath = currentFolderPath ? currentFolderPath + '/' + key : key;
        currentSearchTerm = '';
        document.getElementById('searchInput').value = '';
        
        
        attachDataListener(); // Always attach listener for new path
        if (folder && folder.defaultSort) {
            changeSortMode(folder.defaultSort);
        } else {
            updateDataPipeline();
        }
    } else if (type === 'other') {
        // For "other" file type: show confirmation modal before downloading
        const item = dataMap[key];
        if (!item) return;
        const provider = resolveProvider(item);
        const link = provider.getDownloadUrl(item.id || '');

        if (typeof confirmDownload === 'function') {
            confirmDownload(link, item.title);
        } else if (typeof showActionModal === 'function') {
            showActionModal({
                title: 'Tải xuống tệp',
                desc: `Bạn có muốn tải xuống "${item.title}" không?`,
                type: 'confirm',
                onConfirm: () => {
                    openSafe(link);
                }
            });
        } else {
            openSafe(link);
        }
    } else if (type === 'doc') {
        // For document files: prefer in-app preview for Google Drive IDs, fall back to download for direct links
        const item = dataMap[key];
        if (!item) return;
        const provider = resolveProvider(item);
        const link = provider.getDownloadUrl(item.id || '');

        // If provider is drive then preview docs inline, otherwise show download confirm
        if (provider === StorageProviders.drive) {
            openMedia(driveId, 'doc', item ? item.title : 'Document');
        } else {
            if (typeof confirmDownload === 'function') confirmDownload(link, item.title);
            else openSafe(link);
        }
    } else {
        const item = dataMap[key];
        openMedia(driveId, type, item ? item.title : 'Viewer');
    }
}

function navigateTo(pathStr, index) { // 🔥 Thêm tham số index
    if (pathStr === 'root') {
        currentFolderPath = '';
        folderStack = [];
    } else {
        currentFolderPath = pathStr;
        // 🔥 Cắt bỏ các thư mục con trong stack nếu người dùng lùi lại
        if (index !== undefined) {
            folderStack = folderStack.slice(0, parseInt(index) + 1);
        }
    }
    currentSearchTerm = '';
    document.getElementById('searchInput').value = '';
    attachDataListener();
    updateDataPipeline();
}

function updateBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    if (!bc) return;
    bc.innerHTML = '';
    const root = document.createElement('span');
    root.className = 'crumb-item';
    root.dataset.target = 'root';
    root.textContent = `Trang chủ (${currentTab})`;
    bc.appendChild(root);

    // 🔥 Xây dựng đường dẫn dựa trên mảng folderStack thay vì chuỗi currentFolderPath
    let accumulatedPath = '';
    
    folderStack.forEach((folder, index) => {
        accumulatedPath = accumulatedPath ? accumulatedPath + '/' + folder.id : folder.id;
        
        const sep = document.createElement('span');
        sep.className = 'crumb-separator';
        sep.textContent = ' / ';
        
        const el = document.createElement('span');
        el.className = 'crumb-item';
        el.dataset.target = accumulatedPath;
        el.dataset.index = index; // Lưu vị trí index để điều hướng ngược
        el.textContent = folder.title; // 🔥 HIỂN THỊ TÊN THẬT THAY VÌ UID
        
        bc.appendChild(sep);
        bc.appendChild(el);
    });
}

// --- CONTEXT MENU ---
document.addEventListener('contextmenu', function(e) {
    if (e.target.closest('#app-cloud')) {
        e.preventDefault(); 
        if (!e.target.closest('.card')) {
            showContextMenu(e, null, false);
        }
    }
});

document.addEventListener('click', () => {
    const menu = document.getElementById('contextMenu');
    if (menu && menu.style.display === 'block') menu.style.display = 'none';
});

function showContextMenu(e, key, isItem) {
    e.preventDefault();
    e.stopPropagation();
    contextTargetId = key;

    const contextMenu = document.getElementById('contextMenu');
    const menuFile = document.getElementById('ctx-file-actions');
    const menuBg = document.getElementById('ctx-bg-actions');
    const menuSetSort = document.getElementById('menuSetSort');
    const menuToggleLock = document.getElementById('menuToggleLock');
    const menuAddNote = document.querySelector('li[data-action="addNote"]'); // 1. Bắt phần tử nút Ghi chú

    menuFile.style.display = 'none';
    menuBg.style.display = 'none';

    if (isItem) {
        menuFile.style.display = 'block';
        const targetItem = dataMap[key];

        if (menuAddNote) {
            if (targetItem && targetItem.type === 'folder') {
                menuAddNote.style.display = 'none'; // Ẩn nếu là thư mục
            } else {
                menuAddNote.style.display = 'flex'; // Hiện lại bình thường nếu là file
            }
        }
        
        // QUAN TRỌNG: Kiểm tra window.isAdmin để hiện menu
        if (targetItem && targetItem.type === 'folder' && window.isAdmin) {
            menuSetSort.style.display = 'flex'; 
        } else {
            menuSetSort.style.display = 'none';
        }
        
        // Show lock button for non-folder items when admin
        if (targetItem && targetItem.type !== 'folder' && window.isAdmin) {
            menuToggleLock.style.display = 'flex';
            const labelEl = menuToggleLock.querySelector('.label');
            const svgEl = menuToggleLock.querySelector('svg');
            
            if (targetItem.locked) {
                // Trạng thái: Mở khóa file (Hiển thị icon ổ khóa MỞ)
                labelEl.innerText = 'Mở khóa file';
                if (svgEl) {
                    svgEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />';
                }
            } else {
                // Trạng thái: Khóa file (Hiển thị icon ổ khóa ĐÓNG)
                labelEl.innerText = 'Khóa file';
                if (svgEl) {
                    svgEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />';
                }
            }
        } else {
            menuToggleLock.style.display = 'none';
        }
    } else {
        menuBg.style.display = 'block';
    }

    // Phải hiển thị block trước để trình duyệt tính toán kích thước thực tế
    contextMenu.style.display = 'block';
    
    // Lấy chiều rộng/cao thực tế của menu
    const menuWidth = contextMenu.offsetWidth; 
    const menuHeight = contextMenu.offsetHeight; 
    
    let top = e.clientY;
    let left = e.clientX;

    // 1. Xử lý kịch bản tràn viền phải
    if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10;
    }
    
    // 2. Xử lý kịch bản tràn viền dưới (Đẩy menu lên vừa đủ sát đáy màn hình)
    if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 10;
    }

    // 3. An toàn tối đa: Tránh tràn viền trên và trái (nếu màn hình quá nhỏ)
    if (top < 0) top = 10;
    if (left < 0) left = 10;

    contextMenu.style.top = `${top}px`;
    contextMenu.style.left = `${left}px`;
}

// --- ADMIN ACTIONS ---

function editLinkUI() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    const item = dataMap[contextTargetId];
    if (!item) return;
    if (item.type === 'folder') return showToast("Không thể sửa link thư mục!");

    // Get current link based on source
    let currentLink = '';
    const source = item.source || 'drive';
    if (source === 'dropbox') {
        // For Dropbox, the ID is already the full URL
        currentLink = item.id || '';
    } else if (source === 'drive') {
        // For Google Drive, construct the shareable link
        currentLink = item.id ? `https://drive.google.com/file/d/${item.id}/view` : '';
    } else if (source === 'direct_link') {
        // For direct links, just use the ID
        currentLink = item.id || '';
    }

    showActionModal({
        title: "Sửa Link File",
        desc: "Dán link Google Drive mới vào bên dưới:",
        type: 'prompt',
        initialValue: currentLink, 
        onConfirm: (val) => {
            const newId = extractFileId(val);
            if(newId) {
                const updatePath = getFullCurrentPath() + '/' + contextTargetId;
                // Update by reading, modifying, and rewriting
                db.ref(updatePath).once('value').then(snapshot => {
                    const data = snapshot.val();
                    if (data) {
                        data.id = newId;
                        db.ref(updatePath).set(data).then(() => {
                            showToast("✅ Đã cập nhật link!");
                        }).catch(err => {
                            showToast("❌ Lỗi: " + err.message);
                        });
                    }
                });
            } else {
                showToast("Link không hợp lệ!");
            }
        }
    });
}

function setFolderSortUI() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    const item = dataMap[contextTargetId];
    if (!item || item.type !== 'folder') return;

    showActionModal({
        title: "Cài đặt sắp xếp",
        desc: "Chọn cách sắp xếp mặc định cho thư mục này:",
        type: 'select',
        initialValue: item.defaultSort || 'date_desc',
        onConfirm: (mode) => {
            const updatePath = getFullCurrentPath() + '/' + contextTargetId;
            db.ref(updatePath).once('value').then(snapshot => {
                const data = snapshot.val();
                if (data) {
                    data.defaultSort = mode;
                    db.ref(updatePath).set(data).then(() => {
                        showToast("✅ Đã lưu cài đặt!");
                    }).catch(err => {
                        showToast("❌ Lỗi: " + err.message);
                    });
                }
            });
        }
    });
}

function deleteItem() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    
    showActionModal({
        title: "Xác nhận xóa?",
        desc: "Hành động này không thể hoàn tác!",
        type: 'confirm',
        onConfirm: () => {
            const item = dataMap[contextTargetId];
            const deletePath = getFullCurrentPath() + '/' + contextTargetId;
            
            db.ref(deletePath).remove().then(() => {
                showToast("✅ Đã xóa mục.");
                // If deleted item was a folder we were browsing, go back
                if (item && item.type === 'folder') {
                    // Don't navigate back unless we're inside the deleted folder
                    // (which shouldn't happen since we can't delete current folder)
                }
                updateDataPipeline();
            }).catch(err => {
                showToast("❌ Lỗi: " + err.message);
            });
        }
    });
}

function renameItemUI() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    const item = dataMap[contextTargetId];
    if (!item) return;
    
    showActionModal({
        title: "Đổi tên",
        type: 'prompt',
        initialValue: item.title || contextTargetId,
        onConfirm: (newName) => {
            const clean = normalizeName(newName);
            if (!clean) return showToast('Tên không hợp lệ');
            if (clean === item.title) return;
            
            // Check if new name already exists (exclude current item)
            const usedNames = allData.filter(it => it.key !== contextTargetId).map(it => it.title || it.key);
            if (usedNames.includes(clean)) {
                return showToast('Tên này đã tồn tại!');
            }
            
            // 🔥 Cấu trúc UID giúp đổi tên chỉ bằng 1 thao tác update duy nhất!
            const itemPath = getFullCurrentPath() + '/' + contextTargetId;
            
            db.ref(itemPath).update({ title: clean }).then(() => {
                showToast("✅ Đã đổi tên");
                // Không cần gọi attachDataListener lại vì Firebase on('value') sẽ tự động catch event update này!
            }).catch(err => showToast("❌ Lỗi đổi tên: " + err.message));
        }
    });
}

function editNoteUI() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    const item = dataMap[contextTargetId];
    if (!item) return;

    if (item.type === 'folder') return showToast("Không thể thêm ghi chú cho thư mục!");
    
    showActionModal({
        title: "Ghi chú bảo mật",
        desc: `Chỉnh sửa ghi chú cho tệp: ${item.title}`,
        type: 'prompt',
        initialValue: item.note || '', // Hiện lại ghi chú cũ nếu có
        onConfirm: (newNote) => {
            const cleanNote = newNote.trim(); 
            const itemPath = getFullCurrentPath() + '/' + contextTargetId;
            
            // Cập nhật trường 'note' lên Firebase
            db.ref(itemPath).update({ note: cleanNote }).then(() => {
                showToast("✅ Đã lưu ghi chú");
            }).catch(err => showToast("❌ Lỗi lưu ghi chú: " + err.message));
        }
    });
}

function toggleItemLock() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    const item = dataMap[contextTargetId];
    if (!item || item.type === 'folder') return showToast("Chỉ có thể khóa file!");
    
    const itemPath = getFullCurrentPath() + '/' + contextTargetId;
    const newLocked = !item.locked;
    
    db.ref(itemPath).update({ locked: newLocked }).then(() => {
        showToast(newLocked ? "🔒 File đã bị khóa" : "🔓 File đã được mở khóa");
    }).catch(err => showToast("❌ Lỗi: " + err.message));
}

function createFolderUI() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    
    showActionModal({
        title: "Tạo thư mục",
        type: 'prompt',
        initialValue: "Thư mục mới",
        onConfirm: (name) => {
            const clean = normalizeName(name) || 'Thư mục mới';
            // Generate unique folder name within current level only
            const usedNames = allData.map(item => item.title);
            let unique = clean;
            let counter = 1;
            while (usedNames.includes(unique)) {
                unique = `${clean} (${counter++})`;
            }
            
            // Create new folder node with push() UID
            const parentRef = db.ref(getFullCurrentPath());
            const newFolderRef = parentRef.push(); // 🔥 Tạo UID an toàn
            
            newFolderRef.set({
                title: unique,
                type: 'folder',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                showToast("✅ Đã tạo thư mục");
            }).catch(err => {
                showToast("❌ Lỗi tạo thư mục: " + err.message);
            });
        }
    });
}

function shareItem(isBackground = false) {
    let shareUrl = new URL(window.location.origin + window.location.pathname);
    shareUrl.searchParams.set('tab', currentTab);

    if (isBackground) {
        // Nếu click chuột phải ở nền: Chia sẻ thư mục hiện tại đang xem
        if (currentFolderPath) {
            shareUrl.searchParams.set('folder', currentFolderPath);
        }
    } else {
        // Nếu click chuột phải vào 1 mục (File hoặc Folder)
        const item = dataMap[contextTargetId];
        if (!item) return;

        if (item.type === 'folder') {
            const targetPath = currentFolderPath ? currentFolderPath + '/' + contextTargetId : contextTargetId;
            shareUrl.searchParams.set('folder', targetPath);
        } else {
            if (currentFolderPath) {
                shareUrl.searchParams.set('folder', currentFolderPath);
            }
            shareUrl.searchParams.set('file', contextTargetId);
        }
    }

    // Sao chép vào bộ nhớ tạm
    navigator.clipboard.writeText(shareUrl.toString()).then(() => {
        showToast("🔗 Đã chép link chia sẻ vào bộ nhớ tạm!");
    }).catch(err => {
        showToast("❌ Lỗi copy link: " + err.message);
    });
}

// Helpers
function getDescendantIds(targetId) {
    // Build parent -> children map once (O(N)), then traverse (O(N) total)
    const childrenMap = Object.create(null);
    for (let i = 0; i < allData.length; i++) {
        const it = allData[i];
        const p = it.parentId || null;
        if (!childrenMap[p]) childrenMap[p] = [];
        childrenMap[p].push(it);
    }

    const ids = [];
    const visited = new Set();
    const stack = [targetId];
    while (stack.length) {
        const id = stack.pop();
        if (!id || visited.has(id)) continue;
        visited.add(id);
        const children = childrenMap[id] || [];
        for (let j = 0; j < children.length; j++) {
            const child = children[j];
            ids.push(child.key);
            if (child.type === 'folder') stack.push(child.key);
        }
    }
    return ids;
}

// --- HELPERS: name sanitization, unique name, deep copy ---
function normalizeName(name) {
    if (!name) return '';
    // Trim, remove control characters, limit length
    let s = name.toString().trim().replace(/[\u0000-\u001F\u007F]/g, '');
    if (s.length > 200) s = s.slice(0, 200);
    return s;
}

function generateUniqueName(baseName, parentId) {
    baseName = normalizeName(baseName) || 'Untitled';
    const siblings = allData.filter(i => (i.parentId || null) === (parentId || null)).map(i => i.title);
    if (!siblings.includes(baseName)) return baseName;
    // Try suffixes: (copy), (copy 2), ... (use lowercase 'copy' per project convention)
    const copyTag = ' (copy)';
    if (!siblings.includes(baseName + copyTag)) return baseName + copyTag;
    let n = 2;
    while (n < 1000) {
        const candidate = baseName + ` (copy ${n})`;
        if (!siblings.includes(candidate)) return candidate;
        n++;
    }
    return baseName + ` ${Date.now()}`;
}

async function deepCopyFolder(sourceKeyName, targetPath) {
    // In nested structure, copy entire subtree from source to target  
    const sourcePath = getFullCurrentPath() + '/' + sourceKeyName;
    
    // Get entire folder subtree
    const snapshot = await db.ref(sourcePath).once('value');
    const folderData = snapshot.val();
    
    if (!folderData) {
        throw new Error('Folder not found');
    }
    
    // Generate unique name for copy
    const usedNames = new Set(allData.map(item => item.title || item.key));
    const sourceItem = dataMap[sourceKeyName];
    const baseName = sourceItem?.title || sourceKeyName;
    let copiedName = `${baseName} (bản sao)`;
    let counter = 1;
    while (usedNames.has(copiedName)) {
        copiedName = `${baseName} (bản sao ${counter++})`;
    }
    
    // Ensure copied folder has title field
    if (!folderData.title) {
        folderData.title = copiedName;
    }
    
    // Write to new location using UID
    const newRef = db.ref(targetPath).push();
    folderData.title = copiedName;
    await newRef.set(folderData);
    
    return copiedName;
}


function copyItem() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    const sourceItem = dataMap[contextTargetId];
    if (!sourceItem) return showToast("Item không tìm thấy!");
    const sourcePath = getFullCurrentPath() + '/' + contextTargetId;
    window.appClipboard = { 
        action: 'copy', 
        id: contextTargetId, 
        path: sourcePath,
        item: sourceItem  // Save full item data
    };
    showToast("✅ Đã chép vào bộ nhớ tạm");
}

function cutItem() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    const sourceItem = dataMap[contextTargetId];
    if (!sourceItem) return showToast("Item không tìm thấy!");
    const sourcePath = getFullCurrentPath() + '/' + contextTargetId;
    window.appClipboard = { 
        action: 'cut', 
        id: contextTargetId, 
        path: sourcePath,
        item: sourceItem  // Save full item data
    };
    showToast("✅ Đã chọn để di chuyển");
}

function pasteItem() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    if (!window.appClipboard.id || !window.appClipboard.path) return showToast("Chưa có gì để dán!");
    
    const sourceKey = window.appClipboard.id;
    const sourcePath = window.appClipboard.path;
    const sourceItem = window.appClipboard.item;  // Get from clipboard, not from dataMap
    
    if (!sourceItem) {
        return showToast("Thông tin item đã mất. Hãy cắt/chép lại.");
    }

    const targetPath = getFullCurrentPath();
    
    if (window.appClipboard.action === 'cut') {
        // Move: read from source, write to target, delete source
        db.ref(sourcePath).once('value').then(snapshot => {
            const data = snapshot.val();
            if (data) {
                // Generate unique name at target
                const usedNames = new Set(allData.map(it => it.title || it.key));
                const baseName = sourceItem.title || sourceKey;
                let newName = baseName;
                let counter = 1;
                while (usedNames.has(newName)) {
                    newName = `${baseName} (${counter++})`;
                }
                
                const newRef = db.ref(targetPath).push();
                data.title = newName; // Cập nhật lại tên nếu bị trùng
                newRef.set(data).then(() => {
                    db.ref(sourcePath).remove().then(() => {
                        showToast("✅ Đã di chuyển");
                        window.appClipboard = { action: null, id: null, path: null, item: null };
                        // Refresh data
                        setTimeout(() => {
                            attachDataListener();
                            updateDataPipeline();
                        }, 200);
                    }).catch(err => {
                        showToast("❌ Lỗi xóa: " + err.message);
                    });
                }).catch(err => {
                    showToast("❌ Lỗi viết: " + err.message);
                });
            } else {
                showToast("❌ Lỗi: Không tìm thấy file gốc");
            }
        }).catch(err => {
            showToast("❌ Lỗi đọc: " + err.message);
        });
    } else if (window.appClipboard.action === 'copy') {
        if (sourceItem.type === 'folder') {
            // Copy folder with all contents
            deepCopyFolder(sourceKey, targetPath).then(() => {
                showToast("✅ Đã dán bản sao thư mục");
                window.appClipboard = { action: null, id: null, path: null, item: null };
                // Refresh data
                setTimeout(() => {
                    attachDataListener();
                    updateDataPipeline();
                }, 200);
            }).catch(err => {
                showToast("❌ Lỗi: " + err.message);
            });
        } else {
            // Copy file
            const usedNames = new Set(allData.map(item => item.title || item.key));
            let copiedName = `${sourceItem.title || sourceKey} (Copy)`;
            let counter = 1;
            while (usedNames.has(copiedName)) {
                copiedName = `${sourceItem.title} (Copy ${counter++})`;
            }
            
            const newItem = { ...sourceItem };
            delete newItem.key;
            newItem.title = copiedName;
            newItem.timestamp = firebase.database.ServerValue.TIMESTAMP;
            
            const newRef = db.ref(targetPath).push();
            newItem.title = copiedName;
            newRef.set(newItem).then(() => {
                showToast("✅ Đã dán bản sao tệp");
                window.appClipboard = { action: null, id: null, path: null, item: null };
                // Refresh data
                setTimeout(() => {
                    attachDataListener();
                    updateDataPipeline();
                }, 200);
            }).catch(err => {
                showToast("❌ Lỗi: " + err.message);
            });
        }
    }
}

function downloadItem() {
    const item = dataMap[contextTargetId];
    if (item && item.type !== 'folder') {
        // Check if file is locked
        if (item.locked) {
            showToast("🔒 File này đã bị khóa, không thể tải xuống");
            return;
        }
        const provider = resolveProvider(item);
        const link = provider.getDownloadUrl(item.id || '');
        if (typeof confirmDownload === 'function') confirmDownload(link, item.title);
        else openSafe(link);
    }
}

function openContextItem() {
    const item = dataMap[contextTargetId];
    if (item) handleClick(item.key, item.type, item.id);
}

// --- MEDIA MODAL ---
// Properly close media modal
function closeMedia() {
    const modal = document.getElementById('mediaModal');
    const content = document.getElementById('modalContent');
    if (modal) modal.style.display = 'none';
    if (content) content.innerHTML = '';
    // reset any global index
    window.currentMediaIndex = -1;
}

// Open media viewer modal for image/video/docs
function openMedia(id, type, title) {
    const modal = document.getElementById('mediaModal');
    const content = document.getElementById('modalContent');
    if (!modal || !content) return;
    const safeTitle = escapeHtml(title || 'Viewer');
    const safeIdUrl = encodeURIComponent(id || '');

    // find index in processedData for navigation
    let index = -1;
    for (let i = 0; i < processedData.length; i++) {
        if (processedData[i].id === id) { index = i; break; }
    }
    window.currentMediaIndex = index;

    // Logic nút Next/Prev (only for images)
    let navBtns = '';
    if (type === 'image' && index !== -1) {
        const prevItem = processedData[index - 1];
        const nextItem = processedData[index + 1];
        if (prevItem && prevItem.type === 'image') {
            navBtns += `<button class="nav-btn prev" data-id="${prevItem.id}" data-type="image">❮</button>`;
        }
        if (nextItem && nextItem.type === 'image') {
            navBtns += `<button class="nav-btn next" data-id="${nextItem.id}" data-type="image">❯</button>`;
        }
    }

    // choose content
    let bodyHtml = '';
    let protectOverlay = ''; // Khởi tạo biến cho lớp phủ
    
    if (type === 'image') {
        bodyHtml = `<img src="https://drive.google.com/thumbnail?id=${safeIdUrl}&sz=w2000" class="media-content loaded">`;
    } else {
        // Nếu là Docs/Video (dùng iframe), thêm lớp phủ bảo vệ
        protectOverlay = `<div class="drive-protect-overlay" title="Tính năng này đã bị khóa"></div>`;
        
        bodyHtml = `<iframe 
               src="https://drive.google.com/file/d/${safeIdUrl}/preview" 
               class="media-content loaded" 
               allow="autoplay; fullscreen; encrypted-media; picture-in-picture" 
               allowfullscreen 
               webkitallowfullscreen 
               mozallowfullscreen></iframe>`;
    }

    // Render modal
    content.innerHTML = `
        <div class="media-window">
            <div class="media-header">
                <h3 class="media-title">${safeTitle}</h3>
                <button class="btn-close-media">✕</button>
            </div>
            <div class="media-body">
                ${protectOverlay} ${navBtns}
                ${bodyHtml}
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

// --- ADMIN TOOL INPUT ---
function autoFillID() {
    const id = extractFileId(document.getElementById('mediaUrl').value);
    if (id) document.getElementById('mediaTitle').placeholder = "Nhập tên...";
}

function toggleAdminTool() {
    const el = document.getElementById('adminTool');
    el.style.display = (el.style.display === 'block') ? 'none' : 'block';
}

function addToCloud() {
    if (!window.isAdmin) return;
    const url = document.getElementById('mediaUrl').value;
    const extractedIdOrUrl = extractFileId(url);
    
    // KIỂM TRA NGHIỆP VỤ: Chỉ cho phép Dropbox ở tab "File khác" (other)
    const isDropbox = url.includes('dropbox.com');
    if (isDropbox && currentTab !== 'other') {
        return showToast("❌ Link Dropbox chỉ được hỗ trợ trong mục 'File khác'!");
    }

    // Xử lý title mặc định cho Dropbox
    const title = document.getElementById('mediaTitle').value || ("File " + (isDropbox ? "Dropbox" : extractedIdOrUrl?.substring(0,5)));
    
    if (extractedIdOrUrl) {
        // Generate unique name within current level (check both title and key)
        const usedNames = new Set(allData.map(item => item.title || item.key));
        let uniqueName = title;
        let counter = 1;
        while (usedNames.has(uniqueName)) {
            const nameWithoutExt = title.substring(0, title.lastIndexOf('.')) || title;
            const ext = title.substring(title.lastIndexOf('.')) || '';
            uniqueName = `${nameWithoutExt} (${counter++})${ext}`;
        }
        
        const parentRef = db.ref(getFullCurrentPath());
        const newItemRef = parentRef.push(); // 🔥 Firebase tự sinh UID chuẩn
        
        newItemRef.set({
            id: extractedIdOrUrl, 
            title: uniqueName,  // Lưu tên có thể chứa ký tự đặc biệt ở đây
            type: currentTab,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            source: isDropbox ? 'dropbox' : 'drive' 
        }).then(() => {
            document.getElementById('mediaUrl').value = '';
            document.getElementById('mediaTitle').value = '';
            toggleAdminTool();
            showToast("✅ Thêm tệp thành công!"); 
        }).catch(err => {
            showToast("❌ Lỗi: " + err.message);
        });
    } else {
        showToast("❌ Link không hợp lệ");
    }
}

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

// --- NAMES / SANITIZE HELPERS ---
function sanitizeName(name) {
    if (!name && name !== 0) return '';
    name = String(name).trim();
    // Remove control chars and some filesystem-special chars
    name = name.replace(/[\x00-\x1F<>:\/\\|?*"']/g, '');
    if (name.length > 100) name = name.slice(0, 100);
    return name;
}

// Delegate download button clicks to avoid inline JS and escaping issues
// Use capture phase so we intercept the click before parent handlers (card onclick)
document.addEventListener('click', function (e) {
    const btn = e.target.closest ? e.target.closest('.btn-download') : null;
    if (!btn) return;
    // Intercept early to prevent parent onclick from firing (which opens preview)
    try { e.stopPropagation(); e.preventDefault(); } catch (err) {}
    
    // Get the file key from the card
    const card = btn.closest('.card');
    const fileKey = card ? card.dataset.key : null;
    const item = fileKey ? dataMap[fileKey] : null;
    
    // Check if file is locked
    if (item && item.locked) {
        showToast("🔒 File này đã bị khóa, không thể tải xuống");
        return;
    }
    
    const link = btn.getAttribute('data-link');
    const title = btn.getAttribute('data-title') || '';
    if (!link) return;
    if (typeof confirmDownload === 'function') confirmDownload(link, title);
    else openSafe(link);
}, true);

// --- UI wiring: replace former inline handlers with event listeners & delegation ---
(function attachUI() {
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const btnMenu = document.getElementById('btnMenu');
    const btnCloseSidebar = document.getElementById('btnCloseSidebar');
    [sidebarOverlay, btnMenu, btnCloseSidebar].forEach(el => { if (el) el.addEventListener('click', toggleSidebar); });

    // Sidebar menu click is handled centrally in `core.js` to avoid duplicate handlers

    const loginBtn = document.getElementById('loginBtn'); if (loginBtn) loginBtn.addEventListener('click', showLogin);
    const logoutBtn = document.getElementById('logoutBtn'); if (logoutBtn) logoutBtn.addEventListener('click', logout);
    const btnRetry = document.getElementById('btnRetry'); if (btnRetry) btnRetry.addEventListener('click', () => location.reload());
    const themeCheckbox = document.getElementById('theme-checkbox'); if (themeCheckbox) themeCheckbox.addEventListener('change', toggleTheme);

    document.querySelectorAll('input[name="tabs"][data-tab]').forEach(r => {
        r.addEventListener('change', () => { if (r.checked) switchTab(r.dataset.tab); });
    });

    const searchInput = document.getElementById('searchInput'); if (searchInput) searchInput.addEventListener('input', e => handleSearch(e.target.value));
    const viewBtn = document.getElementById('viewBtn'); if (viewBtn) viewBtn.addEventListener('click', toggleViewMode);
    const sortSelect = document.getElementById('sortSelect'); if (sortSelect) sortSelect.addEventListener('change', e => changeSortMode(e.target.value));
    const btnNew = document.getElementById('btnNew'); if (btnNew) btnNew.addEventListener('click', toggleAdminTool);

    document.addEventListener('click', function(e) {
        const crumb = e.target.closest('.crumb-item');
        if (crumb && crumb.dataset.target) {
            // 🔥 Truyền thêm index vào
            navigateTo(crumb.dataset.target, crumb.dataset.index); 
        }
    });

    const closeAdminTool = document.getElementById('closeAdminTool'); if (closeAdminTool) closeAdminTool.addEventListener('click', toggleAdminTool);
    const btnSaveCloud = document.getElementById('btnSaveCloud'); if (btnSaveCloud) btnSaveCloud.addEventListener('click', addToCloud);
    const btnCancelTransfer = document.getElementById('btnCancelTransfer');
    if (btnCancelTransfer) btnCancelTransfer.addEventListener('click', () => {
        if (typeof cancelTransfer === 'function') return cancelTransfer();
    });
    const btnLogin = document.getElementById('btnLogin'); if (btnLogin) btnLogin.addEventListener('click', loginAdmin);
    const btnCloseLogin = document.getElementById('btnCloseLogin'); if (btnCloseLogin) btnCloseLogin.addEventListener('click', closeLogin);
    const acModalCancel = document.getElementById('acModalCancel'); if (acModalCancel) acModalCancel.addEventListener('click', closeActionModal);

    // Context menu actions mapping
    function handleContextAction(action) {
        switch(action) {
            case 'open': return openContextItem();
            case 'download': return downloadItem();
            case 'share': return shareItem(false);
            case 'shareFolder': return shareItem(true);
            case 'rename': return renameItemUI();
            case 'addNote': return editNoteUI();
            case 'copy': return copyItem();
            case 'cut': return cutItem();
            case 'editlink': return editLinkUI();
            case 'setSort': return setFolderSortUI();
            case 'delete': return deleteItem();
            case 'toggleLock': return toggleItemLock();
            case 'createFolder': return createFolderUI();
            case 'paste': return pasteItem();
            case 'reload': return location.reload();
            default: return null;
        }
    }

    document.getElementById('ctx-file-actions')?.addEventListener('click', function(e){ const li = e.target.closest('li.item'); if (!li) return; const action = li.dataset.action; if (action) handleContextAction(action); });
    document.getElementById('ctx-bg-actions')?.addEventListener('click', function(e){ const li = e.target.closest('li.item'); if (!li) return; const action = li.dataset.action; if (action) handleContextAction(action); });

    // Palette action buttons
    document.querySelectorAll('[data-palette-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const a = btn.dataset.paletteAction;
            if (a === 'random') randomBaseColor();
            else if (a === 'copy') exportPalette();
            else if (a === 'export') exportPaletteJSON();
        });
    });

    const baseColorInput = document.getElementById('baseColorInput'); if (baseColorInput) baseColorInput.addEventListener('input', updatePaletteSystem);
    const harmonyRule = document.getElementById('harmonyRule'); if (harmonyRule) harmonyRule.addEventListener('change', updatePaletteSystem);

    // Card click/contextmenu delegation inside app-cloud
    const appCloud = document.getElementById('app-cloud');
    if (appCloud) {
        appCloud.addEventListener('click', function(e) {
            const card = e.target.closest('.card');
            if (!card) return;
            const key = card.dataset.key;
            const type = card.dataset.type;
            const id = card.dataset.id;
            handleClick(key, type, id);
        });

        appCloud.addEventListener('contextmenu', function(e) {
            const card = e.target.closest('.card');
            if (card) { e.preventDefault(); showContextMenu(e, card.dataset.key, true); }
        });
    }

    // Media modal: nav buttons, play buttons and close
    document.addEventListener('click', function(e) {
        const playBtn = e.target.closest('.btn-play');
        if (playBtn) { e.stopPropagation(); const url = playBtn.dataset.url || playBtn.getAttribute('data-url'); if (url && typeof window.launchGame === 'function') return launchGame(url); }
        const nav = e.target.closest('.nav-btn');
        if (nav) { e.stopPropagation(); const id = nav.dataset.id; const t = nav.dataset.type || 'image'; if (id) openMedia(id, t, ''); }
        const close = e.target.closest('.btn-close-media');
        if (close) closeMedia();
    });

    // Image error handling (delegated capture)
    document.addEventListener('error', function(e) {
        const img = e.target;
        if (img && img.classList && img.classList.contains('thumb-img')) handleImgError(img);
    }, true);
})();

// --- MOBILE CONTEXT MENU INITIALIZATION ---
initMobileContextMenu();
enableMobileContextMenuDismissal();
