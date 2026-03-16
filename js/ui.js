// js/ui.js - Cập nhật kiến trúc Event Management

export function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.className = "show";
    setTimeout(() => toast.className = toast.className.replace("show", ""), 3000);
}

// Giữ lại import để không phá vỡ dependency của các file khác nếu có
import { addManagedEventListener, removeManagedEventListener } from './eventManager.js';
import { activateModal, deactivateModal } from './a11yModal.js';

export function showActionModal({ title, desc, type, initialValue = '', onConfirm }) {
    const acModal = document.getElementById('actionModal');
    const acTitle = document.getElementById('acModalTitle');
    const acDesc = document.getElementById('acModalDesc');
    const acInput = document.getElementById('acModalInput');
    const acSelect = document.getElementById('acModalSelect');
    const acBtn = document.getElementById('acModalBtn');
    const acCancelBtn = document.querySelector('.btn-modal-cancel');

    if (!acModal) return;
    
    // 1. Hiển thị modal
    acModal.style.display = 'flex';
    if (acTitle) acTitle.innerText = title || '';
    if (acDesc) acDesc.innerText = desc || '';

    let initialFocusEl = acBtn;

    // 2. Logic xử lý hiển thị động dựa trên biến 'type'
    if (type === 'select') {
        if (acInput) acInput.style.display = 'none';
        if (acSelect) {
            acSelect.style.display = 'block';
            acSelect.value = initialValue;
        }
        initialFocusEl = acSelect || acBtn;
    } else if (type === 'prompt') {
        if (acSelect) acSelect.style.display = 'none';
        if (acInput) {
            acInput.style.display = 'block';
            acInput.value = initialValue;
        }
        initialFocusEl = acInput || acBtn;
    } else {
        // Chế độ 'confirm'
        if (acInput) acInput.style.display = 'none';
        if (acSelect) acSelect.style.display = 'none';
    }

    activateModal(acModal, { initialFocus: initialFocusEl, onClose: closeActionModal });

    // 3. Quản lý Event Listeners (Kiến trúc O(1) Memory Management)
    // Gán đè (overwrite) DOM properties thay vì addEventListener
    // Đảm bảo tại mọi thời điểm chỉ có 1 callback duy nhất tồn tại trên nút bấm
    
    if (acBtn) {
        acBtn.onclick = function() {
            if (onConfirm) {
                let returnValue = null;
                if (type === 'select' && acSelect) {
                    returnValue = acSelect.value;
                } else if (type === 'prompt' && acInput) {
                    returnValue = acInput.value;
                }
                onConfirm(returnValue);
            }
            closeActionModal();
        };
    }

    if (acCancelBtn) {
        acCancelBtn.onclick = function() {
            closeActionModal();
        };
    }

    if (acInput) {
        acInput.onkeydown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Ngăn chặn trigger submit ngoài ý muốn
                if (acBtn) acBtn.click(); // Ủy quyền (delegate) về logic của nút xác nhận
            }
        };
    }
}

export function closeActionModal() {
    const acModal = document.getElementById('actionModal');
    if (acModal) deactivateModal(acModal);
    if (acModal) acModal.style.display = 'none';
}
