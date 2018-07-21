import idb from 'idb';

const staticCacheName = 'mws-rest1-static-v3';
const serverPort = '1337';

const dbPromise = idb.open('rest-reviews-store', 1, upgradeDB => {
  switch(upgradeDB.oldVersion) {
    case 0:
      const teststore = upgradeDB.createObjectStore(
        'rest-reviews-json',
        {
          keyPath: 'id',
        }
      );
  }
}).catch(er => console.log(`Failed to create dbPromise(${er})`));


self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(staticCacheName).then(function(cache) {
      return cache.addAll([
        '/js/dbhelper.js',
        '/css/styles.css',
        '/css/responsive.css',
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

const handleApiRequest = requestUrl => {
  /* Get the key. Either id or -1 */
  let restId = requestUrl.href.split('/').slice(-1)[0];
  restId = restId == 'restaurants' ? -1 : restId;
  /* Check IDB cache */
  return dbPromise.then(db => {
    const tx = db.transaction('rest-reviews-json');
    const obStore = tx.objectStore('rest-reviews-json');
    return obStore.get(restId).then(cachedResponse => {
      /* Return cached response if available */
      if (cachedResponse) return cachedResponse.data;
      /* Fetch response instead */
      return fetch(requestUrl).then(response => {
        return response.json();
      }).then(resJson => {
        /* Cache fetched JSON */
        db.transaction('rest-reviews-json', 'readwrite').objectStore('rest-reviews-json')
        .put({
          id: restId,
          data: resJson
        });
        /* Return fetched response */
        return resJson;
      });
    }).then(resJson => {
      /* event.respondWith expects Response object */
      return new Response(JSON.stringify(resJson));
    });
  });
}

self.addEventListener('fetch', function(event) {
  var requestUrl = new URL(event.request.url);
  /* Use IDB cache for requests to server */
  if (requestUrl.port == serverPort) {
    event.respondWith(handleApiRequest(requestUrl));
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
      });
    })
  );
});