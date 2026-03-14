// Khai báo import thư viện Workbox từ CDN của Google
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
    console.log(`[WindCloud SW] Workbox đã khởi động thành công! 🚀`);

    // 1. PRECACHE: Tự động nhúng danh sách mảng file (Không cần gõ tay nữa)
    // Dòng này rất quan trọng, Workbox CLI sẽ thay thế nó bằng mảng thực tế lúc build
    workbox.precaching.precacheAndRoute([{"revision":"7b6298f3549bbff64bc4913c79cec4ff","url":"workbox-config.js"},{"revision":"1745fc79563d0a6ac48f0632f38bf7f5","url":"README.md"},{"revision":"e7850f5ea11e154674e344fe140f71e5","url":"package.json"},{"revision":"08765cf17b239e41e58d3f089043aade","url":"package-lock.json"},{"revision":"38066b56d7f04bd5005c17808ac9ca01","url":"manifest.json"},{"revision":"26f852ea4b3dc3949c3555f5641bc020","url":"index.html"},{"revision":"570a8b247b045ab14beeca8c7ace4496","url":"icon.png"},{"revision":"4832c4accdb914336a4e079d7137fbef","url":"js/windgame.js"},{"revision":"e23ebf34e5e41f492965bfff8da9cc5e","url":"js/vocab.js"},{"revision":"e8b6724029edb4229e66d59698330c2a","url":"js/utils.js"},{"revision":"759d8937281bdda894e1b8726cd129e3","url":"js/ui.js"},{"revision":"6ebb2017fd0abc02bed9f0a935853fba","url":"js/state.js"},{"revision":"02141570f9fb774299024b9c675dd2e2","url":"js/router.js"},{"revision":"75d5181e454a36033043beecf8b8e464","url":"js/protection.js"},{"revision":"af7efe995ca9a0645b6c315e35c1c54b","url":"js/palette.js"},{"revision":"e185a46b91e32202a3d9618e8656e105","url":"js/offline.js"},{"revision":"1c3c44c992b3ea2fb15b18a44c872acd","url":"js/mobileContextMenu.js"},{"revision":"8592debebbd025ae37b2bee279de00b7","url":"js/installPrompt.js"},{"revision":"ef0e15431f97fc8a2acf5a3619969ee7","url":"js/game-exit.js"},{"revision":"616daa697c341165acb641d83e5a0a44","url":"js/firebase.js"},{"revision":"a345bff306002d539238cd0f09743b14","url":"js/eventManager.js"},{"revision":"8e8658ac4018b1391552342f72f84fc6","url":"js/drop.js"},{"revision":"7aa9eb8edf87a2a6f4143e2b2f5a5759","url":"js/core.js"},{"revision":"198c1125d561b8473092bada9867cc69","url":"js/cloudAdapters.js"},{"revision":"4a9585c206d071fa063b3b30f4e48daf","url":"js/cloud.js"},{"revision":"c1b967ef9cbd66a72d71e04fe0267ab1","url":"games/tankbattle/thumnail.png"},{"revision":"69b71e79661a6eff76cc4c09d3b715d2","url":"games/tankbattle/index.html"},{"revision":"460e0e609ce353a9ce1c063e5d02e5c9","url":"games/tankbattle/js/network.js"},{"revision":"a72c432bf2717d9b512d424dad63e0f6","url":"games/tankbattle/js/interface.js"},{"revision":"3e6875ec69fe61b7ea88045446ae8c2b","url":"games/tankbattle/js/game.js"},{"revision":"db2e17a4419e75efd195153754d81c55","url":"games/tankbattle/js/constants.js"},{"revision":"89fcd0c88d1a0ca1fedd3f658a4514a8","url":"games/tankbattle/js/classes.js"},{"revision":"d4b257720eabba4b11fb32a65ed77441","url":"games/tankbattle/css/style.css"},{"revision":"6cd7bb75fab39b1d3cd7e39d63407678","url":"css/windgame.css"},{"revision":"d9dce1f73421b11f3d93a16310175d33","url":"css/vocab.css"},{"revision":"6b2004432c329f6b2416a0d301f08130","url":"css/variables.css"},{"revision":"d2d8ceb45756a67f6f535343211ee2f0","url":"css/utilities.css"},{"revision":"f52c0938be371cfaf590802093a6a1f2","url":"css/theme-switch.css"},{"revision":"e6aabf8805d2f9126119d2ea66f7b6c8","url":"css/sidebar.css"},{"revision":"6aae22a6c17128a9cbdea119f7af47c5","url":"css/palette.css"},{"revision":"ab76eb9195a2c7777d16ec9f30f4e32a","url":"css/modal.css"},{"revision":"10a8158bfecb4fdbb4dbb7feb6056640","url":"css/mobile.css"},{"revision":"9d728db86c20e89761b18c452ac106e4","url":"css/media-grid.css"},{"revision":"cc701246e7f8ab082b5de4337676b959","url":"css/header.css"},{"revision":"ce717c1718f7d0674cdafefc45e94e34","url":"css/drop.css"},{"revision":"313821b2b578ed69ab6b5c607df4981e","url":"css/context-menu.css"},{"revision":"afd78bdac6dbcad1f98b970219b31eaf","url":"css/base.css"},{"revision":"d0bff22e41bc0b4d5a13cd9a1573e948","url":"css/admin.css"}]);

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