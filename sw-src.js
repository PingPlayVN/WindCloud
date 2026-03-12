// Khai báo import thư viện Workbox từ CDN của Google
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
    console.log(`[WindCloud SW] Workbox đã khởi động thành công! 🚀`);

    // 1. PRECACHE: Tự động nhúng danh sách mảng file (Không cần gõ tay nữa)
    // Dòng này rất quan trọng, Workbox CLI sẽ thay thế nó bằng mảng thực tế lúc build
    workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);

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