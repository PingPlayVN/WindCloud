// Khai báo import thư viện Workbox từ CDN của Google
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
    console.log(`[WindCloud SW] Workbox đã khởi động thành công! 🚀`);

    // 1. PRECACHE: Tự động nhúng danh sách mảng file (Không cần gõ tay nữa)
    // Dòng này rất quan trọng, Workbox CLI sẽ thay thế nó bằng mảng thực tế lúc build
    workbox.precaching.precacheAndRoute([{"revision":"7b6298f3549bbff64bc4913c79cec4ff","url":"workbox-config.js"},{"revision":"bbacb9733d0d2b0279de6debbdb3bca6","url":"README.md"},{"revision":"055c32dfe5f3f41f0c23d926623e04d4","url":"package.json"},{"revision":"003e2e285ef3c1459bec4a5c5e421f02","url":"package-lock.json"},{"revision":"8dbf99b088d361f7011796db77841302","url":"manifest.json"},{"revision":"cd9777b6b90f256a705105f75a3fb485","url":"index.html"},{"revision":"570a8b247b045ab14beeca8c7ace4496","url":"icon.png"},{"revision":"2e022bda894bd9e570cf902a452fc455","url":"js/windgame.js"},{"revision":"0351ac00f0bcbbecfbb707887ab661f2","url":"js/vocab.js"},{"revision":"432de871e8095747be3856793e6a8611","url":"js/utils.js"},{"revision":"f5980e77779936c91d9623d8129683d4","url":"js/ui.js"},{"revision":"cd29dbb18857d49b035b0c4704b5276a","url":"js/state.js"},{"revision":"b11e9faebc8b1288ebf9eb1cf83a8434","url":"js/router.js"},{"revision":"65ab3010b1311cb907cefa9493e8f33c","url":"js/protection.js"},{"revision":"b866c0d5d9f9874ba050044819ab1610","url":"js/palette.js"},{"revision":"b21e865659d93ce83379eaaad8ff0783","url":"js/offline.js"},{"revision":"179bd6580c3e159c888081581eb8d69b","url":"js/mobileContextMenu.js"},{"revision":"3355633eb8deb40ed2710eeedffbb614","url":"js/installPrompt.js"},{"revision":"f8840a00b7bc387772a41a7c80346061","url":"js/game-exit.js"},{"revision":"ccd2a3bbfbcd045da06d7b61d3c8dca1","url":"js/firebase.js"},{"revision":"b03067768654569a7aae4ffc06bae44b","url":"js/eventManager.js"},{"revision":"8165e68f5afbb78fd6951af9f8696728","url":"js/drop.js"},{"revision":"0e441d3723fe9fcdc3701afce48d1a69","url":"js/core.js"},{"revision":"c4665359b204fafcb964412ba19fad33","url":"js/cloudAdapters.js"},{"revision":"9f46f80123ab6387c7db11662d1ae070","url":"js/cloud.js"},{"revision":"955673c4e4c244ae5f28a17d11d67c98","url":"js/auth.js"},{"revision":"c1b967ef9cbd66a72d71e04fe0267ab1","url":"games/tankbattle/thumnail.png"},{"revision":"1bd295d9d27d484e1dc1fc092459bc79","url":"games/tankbattle/index.html"},{"revision":"ee0a2e2ab14dc8e9e67eca99d4e8b129","url":"games/tankbattle/js/network.js"},{"revision":"92047ee4529c4849af367bc5c6d296eb","url":"games/tankbattle/js/interface.js"},{"revision":"90f9278023f95d608053f3c976e0fea6","url":"games/tankbattle/js/game.js"},{"revision":"492cf9d215ebfcdb4ae07d8003ce3ec5","url":"games/tankbattle/js/constants.js"},{"revision":"83d506414599d23b834f278cd89a5274","url":"games/tankbattle/js/classes.js"},{"revision":"bdaab123cfc86c47913c7d744e4f69a6","url":"games/tankbattle/css/style.css"},{"revision":"693842ad27b3339f0bf6d1c544dc2aa7","url":"games/tai_xiu/thumnail.png"},{"revision":"52bc25f250641756971fb0673e4034bd","url":"games/tai_xiu/style.css"},{"revision":"da91e39a7222ee9eff7bbaa15ea7f6bb","url":"games/tai_xiu/main.js"},{"revision":"cae50bc3e31a7be09f99eab258d8fc07","url":"games/tai_xiu/index.html"},{"revision":"436214ee857868867deb9f52fc8a93e4","url":"css/windgame.css"},{"revision":"b944cafe08ba88489156e6a94097967b","url":"css/vocab.css"},{"revision":"2ac32511d7ed01a18d52ada77a2407a6","url":"css/variables.css"},{"revision":"92921d22901e97024f30945d3bd522da","url":"css/utilities.css"},{"revision":"991d4e962182084c40ca1413e97d66d8","url":"css/theme-switch.css"},{"revision":"ea4fad61d56fc741ac4a9b2ed12326aa","url":"css/sidebar.css"},{"revision":"b356406d12424250e6afe82f3be36d25","url":"css/palette.css"},{"revision":"1098977e9d95a4494be96f72750662c4","url":"css/modal.css"},{"revision":"de301bc593e516b14012a1854c718cef","url":"css/mobile.css"},{"revision":"16f7a386b014a6b60a41c005d4891900","url":"css/media-grid.css"},{"revision":"b99f394b8e4bea9a03df2c98404ca469","url":"css/header.css"},{"revision":"799c00a9a183beac4245e5d265c75bc2","url":"css/drop.css"},{"revision":"8d33730bf1e17331893b2e3aca0efa91","url":"css/context-menu.css"},{"revision":"7dd47729fe528e1375460c54516e98ca","url":"css/base.css"},{"revision":"d288b89be35e4fc6e69f0e3d553332aa","url":"css/admin.css"}]);

    // 2. CHIẾN LƯỢC CHO FIREBASE & API: Bỏ qua Cache (Network Only)
    // Đảm bảo dữ liệu realtime không bao giờ bị kẹt
    workbox.routing.registerRoute(
        ({url}) => url.hostname.includes('firebaseio.com') || url.hostname.includes('firestore.googleapis.com'),
        new workbox.strategies.NetworkOnly()
    );

    // 3. CHIẾN LƯỢC CHO HTML: Network First (Ưu tiên mạng)
    // Luôn tải giao diện mới nhất nếu có mạng. Nếu rớt mạng mới lôi từ Cache ra.
    workbox.routing.registerRoute(
        ({request}) => request.destination === 'document',
        new workbox.strategies.NetworkFirst({
            cacheName: 'html-cache',
            plugins: [
                new workbox.expiration.ExpirationPlugin({ maxEntries: 10 }),
            ],
        })
    );

    // 4. CHIẾN LƯỢC CHO CSS & JS: Stale-While-Revalidate 
    // Trả về file cũ cho nhanh, nhưng ngầm gọi mạng để cập nhật Cache cho lần F5 tiếp theo
    workbox.routing.registerRoute(
        ({request}) => request.destination === 'style' || request.destination === 'script',
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'assets-cache',
        })
    );

    // 5. CHIẾN LƯỢC CHO ẢNH & FONT: Cache First (Ưu tiên bộ nhớ đệm)
    // Ảnh ít khi thay đổi, cứ lấy thẳng từ Cache cho mượt, lưu tối đa 30 ngày
    workbox.routing.registerRoute(
        ({request}) => request.destination === 'image' || request.destination === 'font',
        new workbox.strategies.CacheFirst({
            cacheName: 'image-cache',
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: 100, // Chỉ lưu tối đa 100 ảnh để tránh đầy bộ nhớ user
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 ngày
                }),
            ],
        })
    );

    // Xử lý thông báo "Skip Waiting" từ phía core.js để update phiên bản mới
    self.addEventListener('message', (event) => {
        if (event.data && event.data === 'SKIP_WAITING') {
            self.skipWaiting();
        }
    });

} else {
    console.error(`[WindCloud SW] Workbox khởi động thất bại! 😬`);
}