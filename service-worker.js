// Cache version — increment this string when deploying a new build to bust old caches
var CACHE_NAME = 'fullcomposite-v1';

// On activate: delete any caches from previous versions
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

    // Cache-first for large, stable build assets — saves the full 87 MB re-download on repeat visits
    if (url.pathname.startsWith('/Build/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(function(cache) {
                return cache.match(event.request).then(function(cached) {
                    if (cached) return cached;
                    return fetch(event.request).then(function(response) {
                        if (response.ok) cache.put(event.request, response.clone());
                        return response;
                    });
                });
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
