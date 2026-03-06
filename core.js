// js/core.js

import { extractFileId } from './utils.js';
import { showActionModal, closeActionModal, showToast } from './ui.js';
import { updatePaletteSystem } from './palette.js';
import { initWindDrop } from './drop.js';
import { db, auth } from './firebase.js';
import { initWindGame } from './windgame.js';

// --- 2. GLOBAL STATE ---
window.isAdmin = false;
window.appClipboard = { action: null, id: null };
window.currentFolderId = null; 

// --- 3. SYSTEM UTILS ---
// helpers are attached to window by utils.js; only db/export handled elsewhere

function initDeviceLimit() {
    const activeRef = db.ref('active_sessions');
    const myDeviceRef = activeRef.push(); 
    const connectedRef = db.ref('.info/connected');

    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            activeRef.once('value').then(snapshot => {
                const count = snapshot.numChildren();
                const overlay = document.getElementById('limit-overlay');
                
                if (count >= 25 && overlay) { 
                    overlay.style.display = 'flex';
                } else {
                    if(overlay) overlay.style.display = 'none';
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

// --- 5. AUTH SYSTEM ---
function showLogin() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if(sidebar) sidebar.classList.remove('open');
    if(overlay) overlay.classList.remove('open');

    document.getElementById('overlay').style.display = 'block';
    document.getElementById('login-panel').style.display = 'flex'; 
    
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
    const btn = document.getElementById('btnLogin');
    const errObj = document.getElementById('loginError');

    if(btn) { btn.innerText = "Đang xử lý..."; btn.disabled = true; }
    
    auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
            closeLogin();
            showToast("Xin chào Admin! 👋");
        })
        .catch((error) => {
            if(errObj) {
                errObj.innerText = "Sai tài khoản hoặc mật khẩu!";
                errObj.style.display = 'block';
            }
        })
        .finally(() => {
            if(btn) { btn.innerText = "Truy cập!"; btn.disabled = false; }
        });
}

function logout() {
    auth.signOut().then(() => {
        showToast("Đã đăng xuất");
        setTimeout(() => location.reload(), 1000);
    });
}

auth.onAuthStateChanged((user) => {
    const btnNew = document.getElementById('btnNew');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminTool = document.getElementById('adminTool');

    if (user) {
        window.isAdmin = true;
        if(btnNew) btnNew.style.display = 'block';
        if(loginBtn) loginBtn.style.display = 'none';
        if(logoutBtn) logoutBtn.style.display = 'flex'; 
    } else {
        window.isAdmin = false;
        if(btnNew) btnNew.style.display = 'none';
        if(adminTool) adminTool.style.display = 'none';
        if(loginBtn) loginBtn.style.display = 'flex';
        if(logoutBtn) logoutBtn.style.display = 'none';
    }
});

// --- 6. NAVIGATION & THEME ---
function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
}

function switchApp(appName) {
    toggleSidebar();
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => item.classList.remove('active'));

    ['app-cloud', 'app-palette', 'app-drop', 'app-windgame'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    if (appName === 'cloud') {
        if(menuItems[0]) menuItems[0].classList.add('active'); 
        document.getElementById('app-cloud').style.display = 'block';
        document.title = "Wind Cloud - Storage";
    } 
    else if (appName === 'palette') {
        if(menuItems[1]) menuItems[1].classList.add('active');
        document.getElementById('app-palette').style.display = 'block';
        document.title = "Wind Cloud - Color Studio";
        if(typeof updatePaletteSystem === 'function') updatePaletteSystem();
    } 
    else if (appName === 'drop') {
        if(menuItems[2]) menuItems[2].classList.add('active');
        document.getElementById('app-drop').style.display = 'block';
        document.title = "Wind Cloud - Wind Drop";
        if(typeof initWindDrop === 'function') initWindDrop();
    }
    else if (appName === 'windgame') {
        // mark the clicked menu item active (by data-app match)
        const el = document.querySelector(`.sidebar-menu .menu-item[data-app="windgame"]`);
        if (el) el.classList.add('active');
        document.getElementById('app-windgame').style.display = 'block';
        document.title = "Wind Cloud - Wind Game";
        initWindGame();
    }
}

function toggleTheme() {
    const checkbox = document.getElementById('theme-checkbox');
    if (checkbox.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    }
}
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const cb = document.getElementById('theme-checkbox');
    if(cb) cb.checked = true;
}

// --- AUTO-RESTORE WIND GAME TAB ON RETURN FROM GAME ---
function checkAndRestoreWindGame() {
    // Check 1: Hash parameter from game EXIT
    const hash = window.location.hash;
    if (hash === '#windgame') {
        console.log('Hash #windgame detected - restoring Wind Game tab');
        // Clear hash
        window.history.replaceState({}, document.title, window.location.pathname);
        // Use setTimeout to ensure all elements are rendered
        setTimeout(() => {
            goToWindGameTab();
        }, 50);
        return;
    }
    
    // Check 2: sessionStorage flag (backup)
    const shouldReturnToWindGame = sessionStorage.getItem('returnToWindGame');
    if (shouldReturnToWindGame === 'true') {
        console.log('sessionStorage flag detected - restoring Wind Game tab');
        sessionStorage.removeItem('returnToWindGame');
        // Use setTimeout to ensure all elements are rendered
        setTimeout(() => {
            goToWindGameTab();
        }, 50);
    }
}

// Check on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndRestoreWindGame);
} else {
    // DOM already loaded
    checkAndRestoreWindGame();
}

// --- UI Wiring (attachUI) ---
(function attachUI(){
    const btnMenu = document.getElementById('btnMenu'); if (btnMenu) btnMenu.addEventListener('click', toggleSidebar);
    const btnCloseSidebar = document.getElementById('btnCloseSidebar'); if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', toggleSidebar);

    // sidebar menu items
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const app = item.dataset.app;
            if (app) switchApp(app);
        });
    });

    // Login / logout
    const loginBtn = document.getElementById('loginBtn'); if (loginBtn) loginBtn.addEventListener('click', showLogin);
    const logoutBtn = document.getElementById('logoutBtn'); if (logoutBtn) logoutBtn.addEventListener('click', logout);
    const btnCloseLogin = document.getElementById('btnCloseLogin'); if (btnCloseLogin) btnCloseLogin.addEventListener('click', closeLogin);
    const btnLogin = document.getElementById('btnLogin'); if (btnLogin) btnLogin.addEventListener('click', loginAdmin);

    // Theme toggle
    const themeCb = document.getElementById('theme-checkbox'); if (themeCb) themeCb.addEventListener('change', toggleTheme);
})();

// Also check on page visibility (for bfcache scenario)
window.addEventListener('pageshow', checkAndRestoreWindGame);
function goToWindGameTab() {
    console.log('goToWindGameTab() called - switching to Wind Game tab...');
    // Clear query parameters to avoid loops
    window.history.replaceState({}, document.title, window.location.pathname);
    // Switch to windgame app - but skip toggleSidebar to prevent flickering
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => item.classList.remove('active'));

    ['app-cloud', 'app-palette', 'app-drop', 'app-windgame'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Mark windgame as active
    const el = document.querySelector(`.sidebar-menu .menu-item[data-app="windgame"]`);
    if (el) el.classList.add('active');
    
    // Show windgame app
    document.getElementById('app-windgame').style.display = 'block';
    document.title = "Wind Cloud - Wind Game";
    
    // Initialize windgame
    initWindGame();
    
    console.log('Wind Game tab is now active');
}

// --- 7. PWA REGISTRATION (VỚI TỰ ĐỘNG CẬP NHẬT CACHE) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => {
                console.log('PWA Service Worker đã đăng ký!', reg.scope);

                // Lắng nghe sự kiện khi trình duyệt tải về một file sw.js mới (Có bản update)
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;

                    newWorker.addEventListener('statechange', () => {
                        // Khi Service Worker mới đã tải xong và đang trong trạng thái chờ (waiting)
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Show a non-blocking update banner so user can refresh when ready
                            if (!document.getElementById('updateBanner')) {
                                const banner = document.createElement('div');
                                banner.id = 'updateBanner';
                                banner.style.position = 'fixed';
                                banner.style.left = '0';
                                banner.style.right = '0';
                                banner.style.bottom = '16px';
                                banner.style.zIndex = '9999';
                                banner.style.display = 'flex';
                                banner.style.justifyContent = 'center';
                                banner.style.pointerEvents = 'auto';

                                const inner = document.createElement('div');
                                inner.style.background = 'linear-gradient(90deg,#fff,#f7f7f7)';
                                inner.style.border = '1px solid rgba(0,0,0,0.08)';
                                inner.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
                                inner.style.padding = '12px 14px';
                                inner.style.borderRadius = '8px';
                                inner.style.display = 'flex';
                                inner.style.alignItems = 'center';
                                inner.style.gap = '12px';
                                inner.style.maxWidth = '720px';

                                const msg = document.createElement('div');
                                msg.innerText = 'Phiên bản mới đã sẵn sàng. Làm mới để cập nhật.';
                                msg.style.color = 'var(--text)';

                                const btnRefresh = document.createElement('button');
                                btnRefresh.innerText = 'Làm mới';
                                btnRefresh.style.background = 'var(--primary)';
                                btnRefresh.style.color = '#fff';
                                btnRefresh.style.border = 'none';
                                btnRefresh.style.padding = '8px 12px';
                                btnRefresh.style.borderRadius = '6px';
                                btnRefresh.style.cursor = 'pointer';

                                const btnDismiss = document.createElement('button');
                                btnDismiss.innerText = 'Đóng';
                                btnDismiss.style.background = 'transparent';
                                btnDismiss.style.border = 'none';
                                btnDismiss.style.cursor = 'pointer';

                                btnRefresh.onclick = (ev) => {
                                    ev.stopPropagation();
                                    try { newWorker.postMessage('SKIP_WAITING'); } catch (e) {}
                                    banner.remove();
                                };
                                btnDismiss.onclick = (ev) => { ev.stopPropagation(); banner.remove(); };

                                inner.appendChild(msg);
                                inner.appendChild(btnRefresh);
                                inner.appendChild(btnDismiss);
                                banner.appendChild(inner);
                                document.body.appendChild(banner);
                            }
                        }
                    });
                });
            })
            .catch((err) => {
                console.log('Lỗi đăng ký PWA:', err);
            });

        // Sự kiện này bùng nổ khi Service Worker mới (vừa skipWaiting ở trên) chính thức nắm quyền
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                // Tự động tải lại trang để nạp toàn bộ code CSS/JS mới từ Cache mới
                window.location.reload();
            }
        });

        // Listen to messages from service worker (e.g., activation notice)
        if (navigator.serviceWorker) {
            navigator.serviceWorker.addEventListener('message', (ev) => {
                try {
                    const data = ev.data || {};
                    if (data && data.type === 'SW_ACTIVATED') {
                        if (typeof showToast === 'function') showToast('Ứng dụng đã được cập nhật (cache: ' + (data.cache || '') + ')');
                    }
                } catch (e) { /* ignore */ }
            });
        }
    });
}

// Bắt sự kiện cài đặt để hiển thị nút cài đặt
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    console.log("App sẵn sàng để cài đặt!");
});

// --- EXPORTS & GLOBAL ATTACHMENTS ---

export { db, auth, switchApp, toggleSidebar, showLogin, closeLogin, loginAdmin, logout, toggleTheme, goToWindGameTab };

