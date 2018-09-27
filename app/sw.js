const staticCacheName = 'mws-rest1-static-v4';

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(staticCacheName).then(function(cache) {
      return cache.addAll([
        '/js/dbhelper.js',
        '/css/styles.css',
        '/css/responsive.css',
        '/',
        'js/restaurant_info.js',
        'js/common.js',
        'js/main.js',
        'js/sw/IndexController.js',
        'js/lib/idb.js',
        'manifest.json',
        'restaurant.html?id=1',
        'restaurant.html?id=2',
        'restaurant.html?id=3',
        'restaurant.html?id=4',
        'restaurant.html?id=5',
        'restaurant.html?id=6',
        'restaurant.html?id=7',
        'restaurant.html?id=8',
        'restaurant.html?id=9',
        'restaurant.html?id=10',
      ]);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName.startsWith('mws-rest1-') &&
                 cacheName != staticCacheName;
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  var requestUrl = new URL(event.request.url);

  /* Cache only GET requests */
  if (event.request.method != 'GET') {
    event.respondWith(
      fetch(event.request).catch(err => {
        console.log('Failed to fetch non GET request');
        return new Response(
          `sw.js not caching ${event.request.method} requests`
        );
      })
    );
    return;
  }

  /* Use IDB cache for requests to server */
  if (requestUrl.port == Common.serverPort) {
    event.respondWith(Common.handleApiRequest(requestUrl));
    return;
  }
  
  /* Handle normal requests like usual */
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      /* Get response from cache if available */
      if (cachedResponse) return cachedResponse;
      /* Or fetch the response first */
      return fetch(event.request).then(function(response) {
        /* Can only cache GET requests */
        if(event.request.method !== 'GET') return response;
        /* Cache the response before returning it */
        return caches.open(staticCacheName).then(function(cache) {
          cache.put(event.request, response.clone());
          return response;
        })
      }).catch(err => {
        console.log('Assuming user is offline');
        return new Response('Page not cached for offline use');
      });
    })
  );
});