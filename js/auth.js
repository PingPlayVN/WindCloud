// js/auth.js - Auth module (Admin login/logout + auth state handling)

import { auth } from './firebase.js';
import { showToast } from './ui.js';

export function showLogin() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');

    const pageOverlay = document.getElementById('overlay');
    const loginPanel = document.getElementById('login-panel');
    if (pageOverlay) pageOverlay.style.display = 'block';
    if (loginPanel) loginPanel.style.display = 'flex';

    const errEl = document.getElementById('loginError');
    if (errEl) errEl.style.display = 'none';
}

export function closeLogin() {
    const pageOverlay = document.getElementById('overlay');
    const loginPanel = document.getElementById('login-panel');
    if (pageOverlay) pageOverlay.style.display = 'none';
    if (loginPanel) loginPanel.style.display = 'none';
}

export function loginAdmin() {
    const emailEl = document.getElementById('adminEmail');
    const passEl = document.getElementById('adminPass');
    const btn = document.getElementById('btnLogin');
    const errObj = document.getElementById('loginError');

    const email = emailEl ? emailEl.value : '';
    const pass = passEl ? passEl.value : '';

    if (btn) {
        btn.innerText = 'Đang xử lý...';
        btn.disabled = true;
    }

    return auth
        .signInWithEmailAndPassword(email, pass)
        .then(() => {
            closeLogin();
            showToast('Xin chào Admin! 👋');
        })
        .catch(() => {
            if (errObj) {
                errObj.innerText = 'Sai tài khoản hoặc mật khẩu!';
                errObj.style.display = 'block';
            }
        })
        .finally(() => {
            if (btn) {
                btn.innerText = 'Truy cập!';
                btn.disabled = false;
            }
        });
}

export function logout() {
    return auth.signOut().then(() => {
        showToast('Đã đăng xuất');
        setTimeout(() => location.reload(), 1000);
    });
}

export function initAuth() {
    auth.onAuthStateChanged((user) => {
        const btnNew = document.getElementById('btnNew');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const adminTool = document.getElementById('adminTool');

        if (user) {
            window.isAdmin = true;
            if (btnNew) btnNew.style.display = 'block';
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'flex';
        } else {
            window.isAdmin = false;
            if (btnNew) btnNew.style.display = 'none';
            if (adminTool) adminTool.style.display = 'none';
            if (loginBtn) loginBtn.style.display = 'flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
        }
    });
}

