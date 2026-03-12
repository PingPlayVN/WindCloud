// js/offline.js
// Offline support for Color Studio and Wind Game

export function setupOfflineSupport() {
    // Show offline banner
    window.addEventListener('offline', () => {
        showOfflineBanner(true);
    });

    window.addEventListener('online', () => {
        showOfflineBanner(false);
    });

    // Initial check
    if (!navigator.onLine) {
        showOfflineBanner(true);
    }
}

function showOfflineBanner(isOffline) {
    let banner = document.getElementById('offlineBanner');
    
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offlineBanner';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff6b6b;
            color: white;
            padding: 12px 20px;
            text-align: center;
            z-index: 10000;
            font-weight: 600;
            font-size: 14px;
            transition: opacity 0.3s ease;
        `;
        document.body.insertBefore(banner, document.body.firstChild);
    }

    if (isOffline) {
        banner.innerText = '📡 Offline Mode - Color Studio & Wind Game hoạt động bình thường';
        banner.style.opacity = '1';
        banner.style.pointerEvents = 'auto';
        
        // Auto-hide after 10 seconds
        if (banner.timeoutId) clearTimeout(banner.timeoutId);
        banner.timeoutId = setTimeout(() => {
            banner.style.opacity = '0';
            banner.style.pointerEvents = 'none';
        }, 10000);
    } else {
        banner.innerText = '✅ Kết nối Internet đã được khôi phục';
        banner.style.opacity = '1';
        banner.style.backgroundColor = '#51cf66';
        
        // Auto-hide after 3 seconds
        if (banner.timeoutId) clearTimeout(banner.timeoutId);
        banner.timeoutId = setTimeout(() => {
            banner.style.opacity = '0';
            setTimeout(() => {
                banner.style.backgroundColor = '#ff6b6b';
            }, 300);
        }, 3000);
    }
}

// Initialize on import
setupOfflineSupport();
