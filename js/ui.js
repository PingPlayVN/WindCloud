// js/ui.js - Cập nhật kiến trúc Event Management

export function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.className = "show";
    setTimeout(() => toast.className = toast.className.replace("show", ""), 3000);
}

// Giữ lại import để không phá vỡ dependency của các file khác nếu có
import { addManagedEventListener } from './eventManager.js';

export function attachCoreUIEvents({
    toggleSidebar,
    switchApp,
    showLogin,
    logout,
    closeLogin,
    loginAdmin,
    toggleTheme
}) {
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const btnMenu = document.getElementById('btnMenu');
    const btnCloseSidebar = document.getElementById('btnCloseSidebar');
    [sidebarOverlay, btnMenu, btnCloseSidebar].forEach((el) => {
        if (!el) return;
        addManagedEventListener(el, 'click', toggleSidebar);
    });

    // sidebar menu items
    document.querySelectorAll('.sidebar-menu .menu-item').forEach((item) => {
        addManagedEventListener(item, 'click', () => {
            const app = item.dataset.app;
            if (app) switchApp(app);
        });
    });

    // Login / logout
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) addManagedEventListener(loginBtn, 'click', showLogin);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) addManagedEventListener(logoutBtn, 'click', logout);

    const btnCloseLogin = document.getElementById('btnCloseLogin');
    if (btnCloseLogin) addManagedEventListener(btnCloseLogin, 'click', closeLogin);

    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) addManagedEventListener(btnLogin, 'click', loginAdmin);

    // --- Cải thiện UX đăng nhập bằng phím ENTER ---
    const adminEmail = document.getElementById('adminEmail');
    const adminPass = document.getElementById('adminPass');

    // 1. Nhấn Enter ở ô Email -> Nhảy xuống ô Mật khẩu
    if (adminEmail) {
        addManagedEventListener(adminEmail, 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (adminPass) adminPass.focus();
            }
        });
    }

    // 2. Nhấn Enter ở ô Mật khẩu -> Thực hiện đăng nhập
    if (adminPass) {
        addManagedEventListener(adminPass, 'keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginAdmin();
            }
        });
    }

    // Theme toggle
    const themeCb = document.getElementById('theme-checkbox');
    if (themeCb) addManagedEventListener(themeCb, 'change', toggleTheme);
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
    
    // 1. Hiển thị modal
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
            // Best Practice UX: Tự động focus
            setTimeout(() => acInput.focus(), 50); 
        }
    } else {
        // Chế độ 'confirm'
        if (acInput) acInput.style.display = 'none';
        if (acSelect) acSelect.style.display = 'none';
    }

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
    if (acModal) acModal.style.display = 'none';
}
