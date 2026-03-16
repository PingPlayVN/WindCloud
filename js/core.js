// js/core.js

import { extractFileId } from './utils.js';
import { showActionModal, closeActionModal, showToast } from './ui.js';
import { updatePaletteSystem } from './palette.js';
import { initWindDrop } from './drop.js';
import { db, auth } from './firebase.js';
import { initWindGame } from './windgame.js';
import { setupProtection } from './protection.js';
import './offline.js'; // Offline support for Color Studio & Wind Game

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

    ['app-cloud', 'app-palette', 'app-drop', 'app-windgame', 'app-vocab'].forEach(id => {
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
    else if (appName === 'vocab') {
        // Tìm đúng menu item có data-app là 'vocab' để đổi màu Active
        const el = document.querySelector(`.sidebar-menu .menu-item[data-app="vocab"]`);
        if (el) el.classList.add('active');
        
        // Hiển thị div container của tính năng từ vựng
        const appContainer = document.getElementById('app-vocab');
        if (appContainer) appContainer.style.display = 'block';
        
        // Cập nhật title trình duyệt chuẩn SEO/UX
        document.title = "Wind Cloud - Vocab Checker";
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

    // --- CẢI THIỆN UX ĐĂNG NHẬP BẰNG PHÍM ENTER ---
    const adminEmail = document.getElementById('adminEmail');
    const adminPass = document.getElementById('adminPass');

    // 1. Nhấn Enter ở ô Email -> Nhảy xuống ô Mật khẩu
    if (adminEmail) {
        adminEmail.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Ngăn trình duyệt reload
                if (adminPass) adminPass.focus(); // Đưa con trỏ nhấp nháy vào ô mật khẩu
            }
        });
    }

    // 2. Nhấn Enter ở ô Mật khẩu -> Thực hiện đăng nhập
    if (adminPass) {
        adminPass.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Ngăn trình duyệt reload
                loginAdmin(); // Gọi hàm xử lý đăng nhập
            }
        });
    }
    // ----------------------------------------------

    // Theme toggle
    const themeCb = document.getElementById('theme-checkbox'); if (themeCb) themeCb.addEventListener('change', toggleTheme);
})();

// Initialize protection (block context menu & DevTools for non-admin users)
setupProtection();

// Also check on page visibility (for bfcache scenario)
window.addEventListener('pageshow', checkAndRestoreWindGame);
function goToWindGameTab() {
    console.log('goToWindGameTab() called - switching to Wind Game tab...');
    // Clear query parameters to avoid loops
    window.history.replaceState({}, document.title, window.location.pathname);
    // Switch to windgame app - but skip toggleSidebar to prevent flickering
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => item.classList.remove('active'));

    ['app-cloud', 'app-palette', 'app-drop', 'app-windgame', 'app-vocab'].forEach(id => {
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
                                // Tạo background mờ bao phủ toàn màn hình
                                const overlay = document.createElement('div');
                                overlay.id = 'updateBanner';
                                overlay.style.position = 'fixed';
                                overlay.style.top = '0';
                                overlay.style.left = '0';
                                overlay.style.width = '100vw';
                                overlay.style.height = '100vh';
                                overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
                                overlay.style.zIndex = '9999';
                                overlay.style.display = 'flex';
                                overlay.style.alignItems = 'center';
                                overlay.style.justifyContent = 'center';

                                // Tạo hộp thoại ở chính giữa
                                const box = document.createElement('div');
                                box.style.background = 'var(--bg-surface, #fff)';
                                box.style.padding = '30px';
                                box.style.borderRadius = '12px';
                                box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
                                box.style.textAlign = 'center';
                                box.style.maxWidth = '90%';
                                box.style.width = '350px';

                                const title = document.createElement('h3');
                                title.innerText = '🚀 Bản Cập Nhật Mới';
                                title.style.margin = '0 0 10px 0';
                                title.style.color = 'var(--text-main, #333)';

                                const desc = document.createElement('p');
                                desc.innerText = 'Hệ thống đã tải xong phiên bản mới. Web sẽ tự động làm mới sau:';
                                desc.style.margin = '0 0 20px 0';
                                desc.style.color = 'var(--text-sub, #666)';
                                desc.style.lineHeight = '1.5';

                                const countdownObj = document.createElement('div');
                                countdownObj.innerText = '5';
                                countdownObj.style.fontSize = '40px';
                                countdownObj.style.fontWeight = 'bold';
                                countdownObj.style.color = 'var(--primary, #1a73e8)';

                                box.appendChild(title);
                                box.appendChild(desc);
                                box.appendChild(countdownObj);
                                overlay.appendChild(box);
                                document.body.appendChild(overlay);

                                // Bộ đếm ngược 5 giây
                                let timeLeft = 5;
                                const timer = setInterval(() => {
                                    timeLeft -= 1;
                                    countdownObj.innerText = timeLeft;
                                    
                                    if (timeLeft <= 0) {
                                        clearInterval(timer);
                                        // Ra lệnh cho Service Worker mới kích hoạt ngay lập tức
                                        try { newWorker.postMessage('SKIP_WAITING'); } catch (e) {}
                                    }
                                }, 1000);
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

// --- LOAD OWNER NAME FROM FIREBASE ---
function loadOwnerName() {
    const ownerElement = document.getElementById('ownerName');
    if (!ownerElement) return;

    // Fetch owner name from Firebase config
    db.ref('config/ownerName').once('value').then((snapshot) => {
        const ownerName = snapshot.val();
        if (ownerName) {
            ownerElement.textContent = ownerName;
        }
    }).catch(() => {
        // Silently fail, keep default value
    });
}

// Call after a short delay to ensure Firebase is initialized
setTimeout(() => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadOwnerName);
    } else {
        loadOwnerName();
    }
}, 500);

// --- EXPORTS & GLOBAL ATTACHMENTS ---

export { db, auth, switchApp, toggleSidebar, showLogin, closeLogin, loginAdmin, logout, toggleTheme, goToWindGameTab };

// TỰ ĐỘNG XOAY NGANG KHI XEM TOÀN MÀN HÌNH (FULLSCREEN)
document.addEventListener('fullscreenchange', () => {
    // Nếu có một phần tử đang được bật Toàn màn hình (thường là Video)
    if (document.fullscreenElement) {
        // Mở khóa và ép thiết bị xoay ngang (Landscape)
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch((err) => {
                console.log("Không thể ép xoay ngang (Có thể do thiết bị không hỗ trợ):", err);
            });
        }
    } else {
        // Khi người dùng bấm thoát Toàn màn hình -> Ép thiết bị khóa lại thành dọc (Portrait)
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('portrait').catch((err) => {
                console.log("Không thể khóa dọc:", err);
            });
        }
    }
});

// --- 8. GSAP ANIMATIONS & SCROLLTRIGGER ---

// 1. Đăng ký plugin
gsap.registerPlugin(ScrollTrigger);

function animateGridItems() {
    // Chỉ chọn những card CHƯA được animate (tránh lỗi khi tải thêm file lúc cuộn)
    const newCards = gsap.utils.toArray('#grid .card:not(.gsap-loaded)');
    
    if (newCards.length === 0) return;

    // Đánh dấu các card này chuẩn bị được xử lý
    newCards.forEach(card => card.classList.add('gsap-loaded'));

    // Đặt trạng thái ban đầu: mờ và tụt xuống 40px
    gsap.set(newCards, { opacity: 0, y: 40 });

    // Sử dụng batch để nhóm các card xuất hiện cùng lúc trên màn hình
    ScrollTrigger.batch(newCards, {
        // Hiệu ứng kích hoạt khi đỉnh của thẻ nằm ở 90% chiều cao màn hình (từ trên xuống)
        start: "top 90%", 
        onEnter: (batch) => {
            gsap.to(batch, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.05, // Hiện lần lượt cách nhau 0.05s
                ease: "back.out(1.2)",
                clearProps: "all" // Trả lại quyền CSS sau khi chạy xong để hiệu ứng hover hoạt động
            });
        }
    });

    // Rất quan trọng: Báo cho ScrollTrigger cập nhật lại vị trí do DOM vừa thay đổi
    ScrollTrigger.refresh();
}

window.animateGridItems = animateGridItems;