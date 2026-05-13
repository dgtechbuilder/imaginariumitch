// Cache version — increment this string when deploying a new build to bust old caches
var CACHE_NAME = 'fullcomposite-v1';

// Skip waiting so a newly installed SW takes over immediately on next navigation
self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting());
});

// On activate: delete caches from previous versions and claim all open clients
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE_NAME; })
                    .map(function(k) { return caches.delete(k); })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function(event) {
    var url = new URL(event.request.url);

    // Cache-first for large, stable build assets — saves the full 87 MB re-download on repeat visits.
    // Top-level .catch() ensures any Cache API failure (e.g. storage quota exceeded on first load)
    // falls back to a direct network fetch rather than propagating as net::ERR_FAILED.
    if (url.pathname.startsWith('/Build/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(function(cache) {
                return cache.match(event.request).then(function(cached) {
                    if (cached) return cached;
                    return fetch(event.request).then(function(response) {
                        if (response.ok) {
                            // Fire-and-forget cache write; quota errors must not affect the response stream
                            cache.put(event.request, response.clone()).catch(function() {});
                        }
                        return response;
                    });
                });
            }).catch(function() {
                // Cache API unavailable or threw — bypass it entirely for this request
                return fetch(event.request);
            })
        );
        return;
    }

    // Network-first for HTML — ensures users always get the latest entry point
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(function() {
                return caches.match('/index.html');
            })
        );
    }
});
