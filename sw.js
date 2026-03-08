// sw.js - Service Worker
// Version 2.1 - Updated with modular CSS & JS

const CacheManager = (() => {
    const CACHE_VERSION = '2.1.1';
    const CACHE_NAME = `wind-share-v${CACHE_VERSION}`;
    
    const ASSETS_TO_CACHE = [
        './',
        './index.html',
        './manifest.json',
        './icon.png',
        
        // ✅ CSS Modules (modular structure)
        './css/variables.css',
        './css/base.css',
        './css/header.css',
        './css/media-grid.css',
        './css/modal.css',
        './css/context-menu.css',
        './css/admin.css',
        './css/sidebar.css',
        './css/theme-switch.css',
        './css/palette.css',
        './css/drop.css',
        './css/windgame.css',
        './css/mobile.css',
        './css/utilities.css',
        
        // ✅ JavaScript Modules
        './js/core.js',
        './js/utils.js',
        './js/router.js',
        './js/ui.js',
        './js/cloud.js',
        './js/cloudAdapters.js',
        './js/palette.js',
        './js/drop.js',
        './js/windgame.js',
        './js/eventManager.js',
        './js/firebase.js',
        './js/network.js',
        './js/game-exit.js',
        './js/installPrompt.js',
        './js/mobileContextMenu.js',
        
        // ✅ Wind Game - Tank Battle
        './games/tankbattle/index.html',
        './games/tankbattle/css/style.css',
        './games/tankbattle/js/classes.js',
        './games/tankbattle/js/constants.js',
        './games/tankbattle/js/game.js',
        './games/tankbattle/js/interface.js',
        './games/tankbattle/js/network.js',
        
        // ✅ External Libraries (CDN - optional, for offline support)
        'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
        'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js',
        'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js',
        'https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js'
    ];

    return {
        getCacheName: () => CACHE_NAME,
        getVersion: () => CACHE_VERSION,
        getAssets: () => ASSETS_TO_CACHE,
        
        addAssetsToCache: () => {
            return caches.open(CACHE_NAME)
                .then(cache => {
                    // Add assets, skip failed ones to prevent install failure
                    return Promise.allSettled(
                        ASSETS_TO_CACHE.map(asset => cache.add(asset))
                    );
                })
                .catch(err => console.error('[SW] Cache addAll failed:', err));
        },
        
        deleteOldCaches: () => {
            return caches.keys().then(keyList => {
                return Promise.all(
                    keyList.map(key => {
                        if (key !== CACHE_NAME) {
                            console.log(`[SW] Deleting old cache: ${key}`);
                            return caches.delete(key);
                        }
                    })
                );
            });
        },
        
        // ✅ Auto-update cache when new version available
        updateCache: () => {
            return caches.open(CACHE_NAME).then(cache => {
                // Re-fetch critical assets
                const criticalAssets = [
                    './index.html',
                    './js/router.js',
                    './js/core.js',
                    './css/base.css'
                ];
                return Promise.allSettled(
                    criticalAssets.map(asset => 
                        fetch(asset).then(response => {
                            if (response.ok) {
                                cache.put(asset, response);
                                console.log(`[SW] Updated: ${asset}`);
                            }
                        })
                    )
                );
            });
        }
    };
})();


class ServiceWorkerController {
    static installHandler(e) {
        console.log('[Service Worker] Install event triggered');
        e.waitUntil(CacheManager.addAssetsToCache());
        self.skipWaiting(); // Activate immediately
    }

    static activateHandler(e) {
        console.log('[Service Worker] Activate event - cleaning old caches');
        e.waitUntil(CacheManager.deleteOldCaches());
        self.clients.claim(); // Take control of all existing pages
        
        // Notify all clients about new cache
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                try {
                    client.postMessage({ 
                        type: 'SW_ACTIVATED', 
                        cache: CacheManager.getCacheName(),
                        version: CacheManager.getVersion()
                    });
                } catch (e) {
                    console.error('[SW] Message to client failed:', e);
                }
            });
        });
    }

    static fetchHandler(e) {
        const { request } = e;
        const url = request.url;
        
        // ✅ Don't cache Firebase/API requests (keep data fresh)
        if (url.includes('firebase') || 
            url.includes('firestore') || 
            url.includes('googleapis') ||
            url.includes('gstatic.com/firebasejs')) {
            return; // Skip caching, let network request through
        }

        e.respondWith(
            caches.match(request)
                .then(response => {
                    if (response) {
                        // Found in cache - return it
                        return response;
                    }
                    
                    // Not in cache - fetch from network
                    return fetch(request)
                        .then(response => {
                            // Cache successful responses (GET, CSS, JS only)
                            if (request.method === 'GET' && response && response.status === 200) {
                                const responseToCache = response.clone();
                                caches.open(CacheManager.getCacheName())
                                    .then(cache => {
                                        cache.put(request, responseToCache);
                                    });
                            }
                            return response;
                        })
                        .catch(err => {
                            console.error('[SW] Fetch failed:', err);
                            // Return offline fallback if needed
                            // return caches.match('./offline.html');
                            throw err;
                        });
                })
        );
    }

    static messageHandler(event) {
        const { data } = event;
        
        if (data === 'SKIP_WAITING') {
            console.log('[SW] SKIP_WAITING received - activating immediately');
            self.skipWaiting();
        }
        
        // ✅ NEW: Auto-update cache on demand
        if (data === 'UPDATE_CACHE') {
            console.log('[SW] UPDATE_CACHE requested - refreshing cache');
            CacheManager.updateCache().then(() => {
                event.ports[0].postMessage({ success: true, message: 'Cache updated' });
            });
        }
        
        // ✅ NEW: Check for cache status
        if (data === 'CACHE_STATUS') {
            caches.keys().then(keys => {
                event.ports[0].postMessage({ 
                    cache: CacheManager.getCacheName(),
                    version: CacheManager.getVersion(),
                    allCaches: keys
                });
            });
        }
    }
}


// ✅ Register Event Listeners
self.addEventListener('install', ServiceWorkerController.installHandler);
self.addEventListener('activate', ServiceWorkerController.activateHandler);
self.addEventListener('fetch', ServiceWorkerController.fetchHandler);
self.addEventListener('message', ServiceWorkerController.messageHandler);

// ✅ Periodic sync (check for updates every 24 hours)
// self.addEventListener('sync', event => {
//     if (event.tag === 'update-cache') {
//         event.waitUntil(CacheManager.updateCache());
//     }
// });

console.log(`[Service Worker] Registered - Cache: ${CacheManager.getCacheName()}`);





