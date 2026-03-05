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
    acModal.style.display = 'block';
    if (acTitle) acTitle.innerText = title || '';
    if (acDesc) acDesc.innerText = desc || '';
    if (acInput) acInput.value = initialValue;
    if (acSelect) acSelect.value = initialValue;

    function cleanup() {
        removeManagedEventListener(acBtn, 'click', confirmHandler);
        removeManagedEventListener(acCancelBtn, 'click', cancelHandler);
        removeManagedEventListener(acInput, 'keydown', inputHandler);
    }

    function confirmHandler() {
        cleanup();
        if (onConfirm) onConfirm(acInput ? acInput.value : null);
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
    addManagedEventListener(acInput, 'keydown', inputHandler);
}

export function closeActionModal() {
    const acModal = document.getElementById('actionModal');
    if (acModal) acModal.style.display = 'none';
}
