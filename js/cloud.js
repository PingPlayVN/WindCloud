// js/cloud.js

import { handleImgError, renderSkeleton, extractFileId, confirmDownload } from './utils.js';
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

// [FIX] Gọi Skeleton NGAY LẬP TỨC khi file JS chạy (để lấp đầy màn hình lúc chờ mạng)
renderSkeleton();

// --- DATA FETCHING ---
db.ref('videos').on('value', (snapshot) => {
    // Không gọi renderSkeleton() ở đây nữa vì lúc này đã có dữ liệu rồi
    allData = [];
    dataMap = {}; 
    snapshot.forEach(child => {
        const val = child.val();
        if (val.parentId === undefined) val.parentId = null;
        const item = { key: child.key, ...val };
        allData.push(item);
        dataMap[child.key] = item; 
    });
    updateDataPipeline();
});

// --- CORE PIPELINE ---
function updateDataPipeline() {
    updateBreadcrumb();
    let filtered = allData.filter(item => {
        if (item.parentId !== window.currentFolderId) return false;
        let tabMatch = (item.type === 'folder') ? (item.tabCategory === currentTab) : (item.type === currentTab);
        if (!tabMatch) return false;
        if (currentSearchTerm && !item.title.toLowerCase().includes(currentSearchTerm)) return false;
        return true;
    });

    // Sắp xếp
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
    renderGrid(false); // false = Reset (vẽ lại từ đầu)
}

// Hàm sinh HTML cho từng item (Tách ra để tái sử dụng)
function generateItemHTML(data) {
    const isFolder = data.type === 'folder';
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
            thumbContent = `<img class="thumb-img" src="${thumbUrl}" loading="lazy" decoding="async" data-id="${data.id}">`;
        } else {
            thumbContent = `<div style="font-size:40px">📦</div>`; 
        }
    }

    // Xử lý một biến downloadLink duy nhất via provider
    const downloadLink = provider.getDownloadUrl(data.id || '');

    const downloadIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
    // Use data attributes and delegate click to avoid embedding raw URLs in HTML
    const safeTitle = (data.title || '').replace(/'/g, "\\'").replace(/\n/g, ' ');
    const safeLink = (downloadLink || '').replace(/'/g, "\\'");
    const downloadBtn = !isFolder ? `<button type="button" class="btn-download" title="Tải xuống" data-link='${safeLink}' data-title='${safeTitle}'>${downloadIcon}</button>` : '';
    const playOverlay = (!isFolder && data.type === 'video') ? `<div class="play-overlay"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>` : '';

    // Use data attributes instead of inline handlers; clicks/contextmenu delegated in JS
    return `
        <div class="card ${isFolder ? 'is-folder' : ''}" data-key="${data.key}" data-type="${data.type}" data-id="${data.id}">
            <div class="thumb-box">${thumbContent}${playOverlay}</div>
            <div class="card-footer">
                <div class="file-info">
                    ${!isFolder ? `<span style="margin-right:5px">${icon}</span>` : ''}
                    <span class="file-name" title="${data.title}">${data.title}</span>
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
    window.currentFolderId = null; 
    currentSearchTerm = ''; 
    document.getElementById('searchInput').value = '';
    changeSortMode('date_desc'); 
    
    const radio = document.getElementById(`tab-${type}-radio`);
    if(radio) radio.checked = true;

    updateDataPipeline();
}

function handleClick(key, type, driveId) {
    if (type === 'folder') {
        window.currentFolderId = key;
        currentSearchTerm = '';
        document.getElementById('searchInput').value = '';
        
        const folder = dataMap[key];
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
                    window.open(link, '_blank');
                }
            });
        } else {
            window.open(link, '_blank');
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
            else window.open(link, '_blank');
        }
    } else {
        const item = dataMap[key];
        openMedia(driveId, type, item ? item.title : 'Viewer');
    }
}

function navigateTo(targetId) {
    window.currentFolderId = (targetId === 'root') ? null : targetId;
    currentSearchTerm = '';
    document.getElementById('searchInput').value = '';
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

    if (window.currentFolderId) {
        let path = [];
        let curr = dataMap[window.currentFolderId];
        let i = 0;
        while(curr && i < 50) {
            path.unshift(curr);
            if (!curr.parentId) break;
            curr = dataMap[curr.parentId]; 
            i++;
        }
        path.forEach(folder => {
            const sep = document.createElement('span');
            sep.className = 'crumb-separator';
            sep.textContent = ' / ';
            const el = document.createElement('span');
            el.className = 'crumb-item';
            el.dataset.target = folder.key;
            el.textContent = folder.title;
            bc.appendChild(sep);
            bc.appendChild(el);
        });
    }
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

    menuFile.style.display = 'none';
    menuBg.style.display = 'none';

    if (isItem) {
        menuFile.style.display = 'block';
        const targetItem = dataMap[key];
        
        // QUAN TRỌNG: Kiểm tra window.isAdmin để hiện menu
        if (targetItem && targetItem.type === 'folder' && window.isAdmin) {
            menuSetSort.style.display = 'flex'; 
        } else {
            menuSetSort.style.display = 'none';
        }
    } else {
        menuBg.style.display = 'block';
    }

    contextMenu.style.display = 'block';
    let top = e.clientY;
    let left = e.clientX;
    const menuWidth = 260; 
    const menuHeight = contextMenu.offsetHeight || 300; 

    // Logic thông minh: Mở menu lên trên nếu sát đáy
    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
    if (top + menuHeight > window.innerHeight) top = e.clientY - menuHeight; // Mở ngược lên

    contextMenu.style.top = `${top}px`;
    contextMenu.style.left = `${left}px`;
}

// --- ADMIN ACTIONS ---

function editLinkUI() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    const item = dataMap[contextTargetId];
    if (!item) return;
    if (item.type === 'folder') return showToast("Không thể sửa link thư mục!");

    showActionModal({
        title: "Sửa Link File",
        desc: "Dán link Google Drive mới vào bên dưới:",
        type: 'prompt',
        initialValue: "", 
        onConfirm: (val) => {
            const newId = extractFileId(val);
            if(newId) {
                db.ref('videos/' + contextTargetId).update({ id: newId })
                .then(() => showToast("Đã cập nhật link!"));
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
            db.ref('videos/' + contextTargetId).update({ defaultSort: mode })
              .then(() => showToast("Đã lưu cài đặt!"));
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
            const allIdsToDelete = [contextTargetId, ...getDescendantIds(contextTargetId)];
            const updates = {};
            allIdsToDelete.forEach(id => updates['videos/' + id] = null);
            db.ref().update(updates).then(() => {
                showToast(`Đã xóa ${allIdsToDelete.length} mục.`);
                if (contextTargetId === window.currentFolderId) navigateTo('root');
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
        initialValue: item.title,
        onConfirm: (newName) => {
            const clean = normalizeName(newName);
            if (!clean) return showToast('Tên không hợp lệ');
            if (clean === item.title) return;
            // ensure unique among siblings
            const unique = generateUniqueName(clean, item.parentId);
            db.ref('videos/' + contextTargetId).update({ title: unique });
        }
    });
}

function createFolderUI() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    
    showActionModal({
        title: "Tạo thư mục",
        type: 'prompt',
        initialValue: "Thư mục mới",
        onConfirm: (name) => {
            const clean = normalizeName(name) || 'Thư mục mới';
            const unique = generateUniqueName(clean, window.currentFolderId);
            db.ref('videos').push({
                title: unique,
                type: 'folder',
                tabCategory: currentTab,
                parentId: window.currentFolderId,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }
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

async function deepCopyFolder(sourceId, targetParentId) {
    // Build a quick lookup of nodes by id
    const mapById = {};
    allData.forEach(item => { mapById[item.key] = item; });

    // Collect all descendant ids (including source)
    const nodesToCopy = [];
    const q = [sourceId];
    const seen = new Set();
    while (q.length) {
        const id = q.shift();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const node = mapById[id];
        if (!node) continue;
        nodesToCopy.push(node);
        allData.filter(i => i.parentId === id).forEach(child => q.push(child.key));
    }

    // Process nodes only when their new parent exists -> ensure parent created before children
    const idMap = {};
    const remaining = nodesToCopy.slice();
    const topSource = mapById[sourceId];
    const newTopName = generateUniqueName(topSource.title || 'Folder', targetParentId);

    let iterations = 0;
    while (remaining.length) {
        iterations++;
        if (iterations > 5000) throw new Error('deepCopyFolder: too many iterations');
        let progress = false;
        for (let i = 0; i < remaining.length; ) {
            const node = remaining[i];
            const isTop = node.key === sourceId;
            const parentId = node.parentId;
            const parentResolved = isTop || (parentId && idMap[parentId]);
            if (!parentResolved && !isTop) { i++; continue; }

            // Prepare new object
            const newObj = Object.assign({}, node);
            delete newObj.key;
            const newParentId = isTop ? (targetParentId || null) : (idMap[parentId] || parentId || null);
            newObj.parentId = newParentId;
            const desiredTitle = isTop ? newTopName : (newObj.title || 'Untitled');
            newObj.title = generateUniqueName(normalizeName(desiredTitle), newParentId);
            newObj.timestamp = firebase.database.ServerValue.TIMESTAMP;

            // Push and map
            // eslint-disable-next-line no-await-in-loop
            const ref = await db.ref('videos').push(newObj);
            idMap[node.key] = ref.key;

            // remove processed
            remaining.splice(i, 1);
            progress = true;
        }
        if (!progress) {
            // Shouldn't happen; break to avoid infinite loop
            break;
        }
    }

    return idMap;
}

function copyItem() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    window.appClipboard = { action: 'copy', id: contextTargetId };
    showToast("Đã chép vào bộ nhớ tạm");
}

function cutItem() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    window.appClipboard = { action: 'cut', id: contextTargetId };
    showToast("Đã chọn để di chuyển");
}

function pasteItem() {
    if (!window.isAdmin) return showToast("Cần quyền Admin!");
    if (!window.appClipboard.id) return showToast("Chưa có gì để dán!");
    const sourceId = window.appClipboard.id;
    if (sourceId === window.currentFolderId) return showToast("Không thể dán vào chính nó!");

    const sourceItem = dataMap[sourceId];
    if (!sourceItem) return;

    // Prevent pasting into a descendant (would create a cycle)
    const descendants = getDescendantIds(sourceId);
    if (window.currentFolderId && (descendants.includes(window.currentFolderId) || window.currentFolderId === sourceId)) {
        return showToast("Không thể dán vào thư mục con của chính nó!");
    }

    const updates = {
        parentId: window.currentFolderId,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    if (sourceItem.type === 'folder') updates.tabCategory = currentTab;
    else updates.type = currentTab;

    if (window.appClipboard.action === 'cut') {
        // Moving: simple update (already exists) but prevent cycles
        db.ref('videos/' + sourceId).update(updates)
            .then(() => {
                showToast("Đã di chuyển");
                window.appClipboard = { action: null, id: null };
            });
    } else if (window.appClipboard.action === 'copy') {
        // Deep-copy if folder, else simple copy
        if (sourceItem.type === 'folder') {
            // Recursively clone folder and children
            function cloneNode(oldId, newParentId) {
                const node = dataMap[oldId];
                if (!node) return Promise.resolve();
                const newNode = { ...node };
                delete newNode.key;
                newNode.parentId = newParentId;
                newNode.timestamp = firebase.database.ServerValue.TIMESTAMP;
                // Ensure correct tab/type for new parent
                if (node.type === 'folder') newNode.tabCategory = currentTab;
                else newNode.type = currentTab;

                return db.ref('videos').push(newNode).then(ref => {
                    const newId = ref.key;
                    // Find children and clone them
                    const children = allData.filter(item => item.parentId === oldId);
                    return Promise.all(children.map(child => cloneNode(child.key, newId)));
                });
            }

            cloneNode(sourceId, window.currentFolderId).then(() => showToast('Đã dán bản sao'));
        } else {
            const newItem = { ...sourceItem, ...updates, title: (sourceItem.title || '') + " (Copy)" };
            delete newItem.key;
            db.ref('videos').push(newItem).then(() => showToast("Đã dán bản sao"));
        }
    }
}

function downloadItem() {
    const item = dataMap[contextTargetId];
    if (item && item.type !== 'folder') {
        const provider = resolveProvider(item);
        const link = provider.getDownloadUrl(item.id || '');
        if (typeof confirmDownload === 'function') confirmDownload(link, item.title);
        else window.open(link, '_blank');
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
    if (type === 'image') {
        bodyHtml = `<img src="https://drive.google.com/thumbnail?id=${id}&sz=w2000" class="media-content loaded">`;
    } else {
        bodyHtml = `<iframe 
               src="https://drive.google.com/file/d/${id}/preview" 
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
                <h3 class="media-title">${(title||'Viewer').replace(/</g,'&lt;')}</h3>
                <button class="btn-close-media">✕</button>
            </div>
            <div class="media-body">
                ${navBtns}
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
        db.ref('videos').push({
            id: extractedIdOrUrl, 
            title: title, 
            type: currentTab, 
            parentId: window.currentFolderId, 
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            // Thêm trường 'source' để quy hoạch kiến trúc (sẵn sàng mở rộng cho OneDrive/S3 sau này)
            source: isDropbox ? 'dropbox' : 'drive' 
        });
        document.getElementById('mediaUrl').value = '';
        document.getElementById('mediaTitle').value = '';
        toggleAdminTool();
        showToast("✅ Thêm tệp thành công!"); 
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
    const link = btn.getAttribute('data-link');
    const title = btn.getAttribute('data-title') || '';
    if (!link) return;
    if (typeof confirmDownload === 'function') confirmDownload(link, title);
    else window.open(link, '_blank');
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
        if (crumb && crumb.dataset.target) navigateTo(crumb.dataset.target);
    });

    const closeAdminTool = document.getElementById('closeAdminTool'); if (closeAdminTool) closeAdminTool.addEventListener('click', toggleAdminTool);
    const btnSaveCloud = document.getElementById('btnSaveCloud'); if (btnSaveCloud) btnSaveCloud.addEventListener('click', addToCloud);
    const btnCancelTransfer = document.getElementById('btnCancelTransfer');
    if (btnCancelTransfer) btnCancelTransfer.addEventListener('click', () => {
        if (typeof cancelTransfer === 'function') return cancelTransfer();
        console.warn('cancelTransfer not available yet');
    });
    const btnLogin = document.getElementById('btnLogin'); if (btnLogin) btnLogin.addEventListener('click', loginAdmin);
    const btnCloseLogin = document.getElementById('btnCloseLogin'); if (btnCloseLogin) btnCloseLogin.addEventListener('click', closeLogin);
    const acModalCancel = document.getElementById('acModalCancel'); if (acModalCancel) acModalCancel.addEventListener('click', closeActionModal);

    // Context menu actions mapping
    function handleContextAction(action) {
        switch(action) {
            case 'open': return openContextItem();
            case 'download': return downloadItem();
            case 'rename': return renameItemUI();
            case 'copy': return copyItem();
            case 'cut': return cutItem();
            case 'editlink': return editLinkUI();
            case 'setSort': return setFolderSortUI();
            case 'delete': return deleteItem();
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