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
    workbox.precaching.precacheAndRoute([{"revision":"de6d09abb01152b45355f3866edda960","url":"apps/tu_vi/assets/app.css"},{"revision":"bd915e04769131f52e832e0b78184b92","url":"apps/tu_vi/assets/app.js"},{"revision":"588238c430ee803e1d97e2f4c199005a","url":"apps/tu_vi/index.html"},{"revision":"af5f32143e32a981931a9a90699d4354","url":"apps/tu_vi/thumbnail.svg"},{"revision":"8e3a10e157f75ada21ab742c022d5430","url":"apps/tu_vi/vite.svg"},{"revision":"d288b89be35e4fc6e69f0e3d553332aa","url":"css/admin.css"},{"revision":"7dd47729fe528e1375460c54516e98ca","url":"css/base.css"},{"revision":"8d33730bf1e17331893b2e3aca0efa91","url":"css/context-menu.css"},{"revision":"799c00a9a183beac4245e5d265c75bc2","url":"css/drop.css"},{"revision":"b99f394b8e4bea9a03df2c98404ca469","url":"css/header.css"},{"revision":"16f7a386b014a6b60a41c005d4891900","url":"css/media-grid.css"},{"revision":"de301bc593e516b14012a1854c718cef","url":"css/mobile.css"},{"revision":"1098977e9d95a4494be96f72750662c4","url":"css/modal.css"},{"revision":"b356406d12424250e6afe82f3be36d25","url":"css/palette.css"},{"revision":"ea4fad61d56fc741ac4a9b2ed12326aa","url":"css/sidebar.css"},{"revision":"991d4e962182084c40ca1413e97d66d8","url":"css/theme-switch.css"},{"revision":"92921d22901e97024f30945d3bd522da","url":"css/utilities.css"},{"revision":"2ac32511d7ed01a18d52ada77a2407a6","url":"css/variables.css"},{"revision":"b944cafe08ba88489156e6a94097967b","url":"css/vocab.css"},{"revision":"436214ee857868867deb9f52fc8a93e4","url":"css/windgame.css"},{"revision":"41c0d18d88bb4d6443cd2daf7852e1e1","url":"css/windtool.css"},{"revision":"783b42b8c1138f8b42a75822ff8b6273","url":"games/tai_xiu/index.html"},{"revision":"aba16b287e26f0fcecffcb04b08add69","url":"games/tai_xiu/main.js"},{"revision":"a0ed214185712be2744c9260563f0a03","url":"games/tai_xiu/style.css"},{"revision":"55e8f4f29f13892000f458915ea4ce8c","url":"games/tai_xiu/thumnail.svg"},{"revision":"bdaab123cfc86c47913c7d744e4f69a6","url":"games/tankbattle/css/style.css"},{"revision":"1bd295d9d27d484e1dc1fc092459bc79","url":"games/tankbattle/index.html"},{"revision":"83d506414599d23b834f278cd89a5274","url":"games/tankbattle/js/classes.js"},{"revision":"492cf9d215ebfcdb4ae07d8003ce3ec5","url":"games/tankbattle/js/constants.js"},{"revision":"90f9278023f95d608053f3c976e0fea6","url":"games/tankbattle/js/game.js"},{"revision":"92047ee4529c4849af367bc5c6d296eb","url":"games/tankbattle/js/interface.js"},{"revision":"ee0a2e2ab14dc8e9e67eca99d4e8b129","url":"games/tankbattle/js/network.js"},{"revision":"c1b967ef9cbd66a72d71e04fe0267ab1","url":"games/tankbattle/thumnail.png"},{"revision":"570a8b247b045ab14beeca8c7ace4496","url":"icon.png"},{"revision":"f138a81c229ae27c40a3351b362ce677","url":"index.html"},{"revision":"955673c4e4c244ae5f28a17d11d67c98","url":"js/auth.js"},{"revision":"9f46f80123ab6387c7db11662d1ae070","url":"js/cloud.js"},{"revision":"c4665359b204fafcb964412ba19fad33","url":"js/cloudAdapters.js"},{"revision":"1a6892adf35ef69486ce65a2b4675339","url":"js/core.js"},{"revision":"8165e68f5afbb78fd6951af9f8696728","url":"js/drop.js"},{"revision":"b03067768654569a7aae4ffc06bae44b","url":"js/eventManager.js"},{"revision":"ccd2a3bbfbcd045da06d7b61d3c8dca1","url":"js/firebase.js"},{"revision":"0524426f1df6651079ba4054b65d8746","url":"js/game-exit.js"},{"revision":"3355633eb8deb40ed2710eeedffbb614","url":"js/installPrompt.js"},{"revision":"179bd6580c3e159c888081581eb8d69b","url":"js/mobileContextMenu.js"},{"revision":"b21e865659d93ce83379eaaad8ff0783","url":"js/offline.js"},{"revision":"b866c0d5d9f9874ba050044819ab1610","url":"js/palette.js"},{"revision":"65ab3010b1311cb907cefa9493e8f33c","url":"js/protection.js"},{"revision":"b11e9faebc8b1288ebf9eb1cf83a8434","url":"js/router.js"},{"revision":"cd29dbb18857d49b035b0c4704b5276a","url":"js/state.js"},{"revision":"f5980e77779936c91d9623d8129683d4","url":"js/ui.js"},{"revision":"432de871e8095747be3856793e6a8611","url":"js/utils.js"},{"revision":"0351ac00f0bcbbecfbb707887ab661f2","url":"js/vocab.js"},{"revision":"2be888f93ac53a477e440f012ed04c8d","url":"js/windgame.js"},{"revision":"2b4a3b716259189020b5a48cd484c1f5","url":"js/windtool.js"},{"revision":"8dbf99b088d361f7011796db77841302","url":"manifest.json"},{"revision":"003e2e285ef3c1459bec4a5c5e421f02","url":"package-lock.json"},{"revision":"c69ab930eb28ab9c2862d9a7eaf4abc3","url":"package.json"},{"revision":"bbacb9733d0d2b0279de6debbdb3bca6","url":"README.md"},{"revision":"ac4ae01185a0b915d8a46901093b8411","url":"workbox-config.js"}]);

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
