// js/utils.js

// These helper functions are shared across multiple modules.  
// We also attach them to `window` for backward compatibility with inline events.

export function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.className = "show";
    setTimeout(() => toast.className = toast.className.replace("show", ""), 3000);
}
window.showToast = showToast;

export function extractFileId(url) {
    if (!url) return null;
    if (url.includes('dropbox.com')) {
        let finalUrl = url.replace('dl=0', 'dl=1');
        if (!finalUrl.startsWith('http')) {
            finalUrl = 'https://' + finalUrl;
        }
        return finalUrl;
    }
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)|id=([a-zA-Z0-9_-]+)/);
    return match ? (match[1] || match[2]) : null;
}
window.extractFileId = extractFileId;

export function handleImgError(img) {
    img.onerror = null;
    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e0e0e0'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E";
    img.style.objectFit = "contain";
    img.style.padding = "20px";
}
window.handleImgError = handleImgError;

export function renderSkeleton(gridElement) {
    const grid = gridElement || document.getElementById('grid');
    if (!grid) return;
    let html = '';
    for (let i = 0; i < 12; i++) {
        html += `
        <div class="card skeleton-card">
            <div class="thumb-box skeleton" style="height:150px; width:100%"></div>
            <div class="card-footer" style="gap:10px">
                <div class="skeleton" style="width:30px; height:30px; border-radius:50%"></div>
                <div class="skeleton" style="height:15px; width:60%; border-radius:4px"></div>
            </div>
        </div>`;
    }
    grid.innerHTML = html;
}

export function showActionModal({ title, desc, type, initialValue = '', onConfirm }) {
    const acModal = document.getElementById('actionModal');
    const acTitle = document.getElementById('acModalTitle');
    const acDesc = document.getElementById('acModalDesc');
    const acInput = document.getElementById('acModalInput');
    const acSelect = document.getElementById('acModalSelect');
    const acBtn = document.getElementById('acModalBtn');
    const acCancelBtn = document.querySelector('.btn-modal-cancel');

    if (!acModal) return;

    acModal.style.display = 'flex';
    acTitle.innerText = title;
    acDesc.innerText = desc || '';
    acInput.style.display = 'none';
    acDesc.style.display = 'none';
    acSelect.style.display = 'none';
    acCancelBtn.style.display = 'block';

    if (type === 'prompt') {
        acInput.style.display = 'block';
        acInput.value = initialValue;
        setTimeout(() => acInput.focus(), 100);
    } else if (type === 'select') {
        acSelect.style.display = 'block';
        acSelect.value = initialValue || 'date_desc';
    } else if (type === 'confirm') {
        acDesc.style.display = 'block';
    } else if (type === 'alert') {
        acDesc.style.display = 'block';
        acCancelBtn.style.display = 'none';
    }

    acBtn.onclick = () => {
        let value = null;
        if (type === 'prompt') value = acInput.value;
        if (type === 'select') value = acSelect.value;
        if (onConfirm) onConfirm(value);
        closeActionModal();
    };

    acInput.onkeydown = (e) => {
        if (e.key === 'Enter') acBtn.click();
    };
}
window.showActionModal = showActionModal;

export function closeActionModal() {
    const acModal = document.getElementById('actionModal');
    if (acModal) acModal.style.display = 'none';
}
window.closeActionModal = closeActionModal;

// Confirm then download helper
export function confirmDownload(link, title = 'tệp') {
    if (window.showActionModal) {
        window.showActionModal({
            title: 'Tải xuống',
            desc: `Bạn có muốn tải xuống "${title}" không?`,
            type: 'confirm',
            onConfirm: () => {
                window.open(link, '_blank');
            }
        });
    } else {
        window.open(link, '_blank');
    }
}
window.confirmDownload = confirmDownload;
