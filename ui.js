// ui.js - UI utilities module

export function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.className = "show";
    setTimeout(() => toast.className = toast.className.replace("show", ""), 3000);
}

import { addManagedEventListener, removeManagedEventListener } from './eventManager.js';

export function showActionModal({ title, desc, type, initialValue = '', onConfirm }) {
    const acModal = document.getElementById('actionModal');
    const acTitle = document.getElementById('acModalTitle');
    const acDesc = document.getElementById('acModalDesc');
    const acInput = document.getElementById('acModalInput');
    const acSelect = document.getElementById('acModalSelect');
    const acBtn = document.getElementById('acModalBtn');
    const acCancelBtn = document.querySelector('.btn-modal-cancel');

    if (!acModal) return;
    
    // 1. Hiển thị modal (sử dụng flex để căn giữa như đã fix trước đó)
    acModal.style.display = 'flex';
    if (acTitle) acTitle.innerText = title || '';
    if (acDesc) acDesc.innerText = desc || '';

    // 2. Logic xử lý hiển thị động dựa trên biến 'type'
    if (type === 'select') {
        if (acInput) acInput.style.display = 'none';
        if (acSelect) {
            acSelect.style.display = 'block';
            acSelect.value = initialValue;
        }
    } else if (type === 'prompt') {
        if (acSelect) acSelect.style.display = 'none';
        if (acInput) {
            acInput.style.display = 'block';
            acInput.value = initialValue;
            // Best Practice UX: Tự động focus vào ô input khi mở popup
            setTimeout(() => acInput.focus(), 50); 
        }
    } else {
        // Chế độ 'confirm' (Chỉ có text xác nhận, ẩn cả input và select)
        if (acInput) acInput.style.display = 'none';
        if (acSelect) acSelect.style.display = 'none';
    }

    // 3. Quản lý Event Listeners
    function cleanup() {
        removeManagedEventListener(acBtn, 'click', confirmHandler);
        removeManagedEventListener(acCancelBtn, 'click', cancelHandler);
        if (acInput) removeManagedEventListener(acInput, 'keydown', inputHandler);
    }

    function confirmHandler() {
        cleanup();
        if (onConfirm) {
            // Logic trả về đúng dữ liệu theo từng type
            let returnValue = null;
            if (type === 'select' && acSelect) {
                returnValue = acSelect.value;
            } else if (type === 'prompt' && acInput) {
                returnValue = acInput.value;
            }
            onConfirm(returnValue);
        }
        closeActionModal();
    }

    function cancelHandler() {
        cleanup();
        closeActionModal();
    }

    function inputHandler(e) {
        if (e.key === 'Enter') {
            confirmHandler();
        }
    }

    addManagedEventListener(acBtn, 'click', confirmHandler);
    addManagedEventListener(acCancelBtn, 'click', cancelHandler);
    if (acInput) addManagedEventListener(acInput, 'keydown', inputHandler);
}

export function closeActionModal() {
    const acModal = document.getElementById('actionModal');
    if (acModal) acModal.style.display = 'none';
}