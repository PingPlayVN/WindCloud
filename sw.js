// sw.js - Service Worker


const CacheManager = (() => {
    const CACHE_NAME = 'wind-share-v11.16';
    const ASSETS_TO_CACHE = [
        './',
        './index.html',
        './style.css',
        './icon.png',
        './js/core.js',
        './js/utils.js',
        './js/cloud.js',
        './js/windgame.js',
        './js/drop.js',
        './js/palette.js',
        './manifest.json',
        './games/tankbattle/index.html',
        './games/tankbattle/css/style.css',
        './games/tankbattle/js/classes.js',
        './games/tankbattle/js/constants.js',
        './games/tankbattle/js/game.js',
        './games/tankbattle/js/interface.js',
        './games/tankbattle/js/network.js',
        './games/tankbattle/thumnail.png',
        // Cache luôn các thư viện ngoài để chạy nhanh hơn
        'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
        'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js',
        'https://www.gstatic.com/firebasejs/8.10.0/firebase-auth.js',
        'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js'
    ];
    return {
        getCacheName: () => CACHE_NAME,
        getAssets: () => ASSETS_TO_CACHE,
        addAssetsToCache: () => caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)),
        deleteOldCaches: () => caches.keys().then(keyList => {
            return Promise.all(keyList.map(key => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    };
})();


class ServiceWorkerController {
    static installHandler(e) {
        console.log('[Service Worker] Install');
        e.waitUntil(CacheManager.addAssetsToCache());
        self.skipWaiting();
    }

    static activateHandler(e) {
        e.waitUntil(CacheManager.deleteOldCaches());
        self.clients.claim();
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                try {
                    client.postMessage({ type: 'SW_ACTIVATED', cache: CacheManager.getCacheName() });
                } catch (e) {}
            });
        });
    }

    static fetchHandler(e) {
        // Không cache các request database của Firebase (để dữ liệu luôn mới)
        if (e.request.url.includes('firebase') || e.request.url.includes('firestore') || e.request.url.includes('googleapis')) {
            return;
        }
        e.respondWith(
            caches.match(e.request).then(response => {
                return response || fetch(e.request).catch(() => {
                    // Nếu mất mạng hoàn toàn và không có trong cache -> Có thể trả về trang offline tùy biến
                });
            })
        );
    }

    static messageHandler(event) {
        if (event.data === 'SKIP_WAITING') {
            self.skipWaiting();
        }
    }
}

self.addEventListener('install', ServiceWorkerController.installHandler);
self.addEventListener('activate', ServiceWorkerController.activateHandler);
self.addEventListener('fetch', ServiceWorkerController.fetchHandler);
self.addEventListener('message', ServiceWorkerController.messageHandler);

// 3. Bắt sự kiện lấy dữ liệu (Fetch) - Ưu tiên Cache, nếu không có mới tải mạng
self.addEventListener('fetch', (e) => {
    // Không cache các request database của Firebase (để dữ liệu luôn mới)
    if (e.request.url.includes('firebase') || e.request.url.includes('firestore') || e.request.url.includes('googleapis')) {
        return; 
    }

    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request).catch(() => {
                // Nếu mất mạng hoàn toàn và không có trong cache -> Có thể trả về trang offline tùy biến
                // Hiện tại cứ để mặc định
            });
        })
    );

});

// 4. Lắng nghe lệnh từ giao diện để ép kích hoạt bản cập nhật ngay lập tức
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});



