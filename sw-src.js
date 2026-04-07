// Khai bÃ¡o import thÆ° viá»‡n Workbox tá»« CDN cá»§a Google
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
    console.log(`[WindCloud SW] Workbox Ä‘Ã£ khá»Ÿi Ä‘á»™ng thÃ nh cÃ´ng! ðŸš€`);

    // Activate new SW ASAP and claim clients to reduce stale-cache issues after refresh
    try {
        workbox.core.skipWaiting();
        workbox.core.clientsClaim();
    } catch (e) {}


    // 1. PRECACHE: Tá»± Ä‘á»™ng nhÃºng danh sÃ¡ch máº£ng file (KhÃ´ng cáº§n gÃµ tay ná»¯a)
    // DÃ²ng nÃ y ráº¥t quan trá»ng, Workbox CLI sáº½ thay tháº¿ nÃ³ báº±ng máº£ng thá»±c táº¿ lÃºc build
    workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);

    // 2. CHIáº¾N LÆ¯á»¢C CHO FIREBASE & API: Bá» qua Cache (Network Only)
    // Äáº£m báº£o dá»¯ liá»‡u realtime khÃ´ng bao giá» bá»‹ káº¹t
    workbox.routing.registerRoute(
        ({url}) => url.hostname.includes('firebaseio.com') || url.hostname.includes('firestore.googleapis.com'),
        new workbox.strategies.NetworkOnly()
    );

    // 3. CHIáº¾N LÆ¯á»¢C CHO HTML: Network First (Æ¯u tiÃªn máº¡ng)
    // LuÃ´n táº£i giao diá»‡n má»›i nháº¥t náº¿u cÃ³ máº¡ng. Náº¿u rá»›t máº¡ng má»›i lÃ´i tá»« Cache ra.
    workbox.routing.registerRoute(
        ({request}) => request.destination === 'document',
        new workbox.strategies.NetworkFirst({
            cacheName: 'html-cache',
            plugins: [
                new workbox.expiration.ExpirationPlugin({ maxEntries: 10 }),
            ],
        })
    );

    // 4. CHIáº¾N LÆ¯á»¢C CHO CSS & JS: Stale-While-Revalidate 
    // Tráº£ vá» file cÅ© cho nhanh, nhÆ°ng ngáº§m gá»i máº¡ng Ä‘á»ƒ cáº­p nháº­t Cache cho láº§n F5 tiáº¿p theo
    workbox.routing.registerRoute(
        ({request}) => request.destination === 'style' || request.destination === 'script',
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'assets-cache',
        })
    );

    // 5. CHIáº¾N LÆ¯á»¢C CHO áº¢NH & FONT: Cache First (Æ¯u tiÃªn bá»™ nhá»› Ä‘á»‡m)
    // áº¢nh Ã­t khi thay Ä‘á»•i, cá»© láº¥y tháº³ng tá»« Cache cho mÆ°á»£t, lÆ°u tá»‘i Ä‘a 30 ngÃ y
    workbox.routing.registerRoute(
        ({request}) => request.destination === 'image' || request.destination === 'font',
        new workbox.strategies.CacheFirst({
            cacheName: 'image-cache',
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: 100, // Chá»‰ lÆ°u tá»‘i Ä‘a 100 áº£nh Ä‘á»ƒ trÃ¡nh Ä‘áº§y bá»™ nhá»› user
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 ngÃ y
                }),
            ],
        })
    );

    // Xá»­ lÃ½ thÃ´ng bÃ¡o "Skip Waiting" tá»« phÃ­a core.js Ä‘á»ƒ update phiÃªn báº£n má»›i
    self.addEventListener('message', (event) => {
        if (event.data && event.data === 'SKIP_WAITING') {
            self.skipWaiting();
        }
    });

} else {
    console.error(`[WindCloud SW] Workbox khá»Ÿi Ä‘á»™ng tháº¥t báº¡i! ðŸ˜¬`);
}
