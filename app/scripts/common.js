class Common {
  /**
   * API Requests
   */
  static get serverPort() { return '1337' }
  static get OBJ_STORE_NAME() { return 'rest-reviews-json' }
  static get FLAG_STORE_NAME() { return 'rest-reviews-flags' }
  static get OFFLINE_REVIEWS_STORE() { return 'rest-offline-reviews' }

  static get dbPromise() {
    return idb.open('rest-reviews-store', 3, upgradeDB => {
    switch(upgradeDB.oldVersion) {
      case 0:
        const teststore = upgradeDB.createObjectStore(
          Common.OBJ_STORE_NAME,
          {
            keyPath: 'id',
          }
        );
      case 1:
        const flagstore = upgradeDB.createObjectStore(
          Common.FLAG_STORE_NAME,
          {
            keyPath: 'id',
          }
        );
      case 2:
        const offlinestore = upgradeDB.createObjectStore(
          Common.OFFLINE_REVIEWS_STORE,
          {
            keyPath: 'id',
            autoIncrement: true
          }
        );
        offlinestore.createIndex('restId', 'restaurant_id');
    }
    }).catch(er => console.log(`Failed to create dbPromise(${er})`));
  }

  static urlToKey(rawUrl) {
    const url = new URL(rawUrl);
    const base = url.pathname.split('/').join('') || '-1';
    if (base.match(/^\w+\d+$/)) {
      return base; //No need to look at params if we got id
    }
    const id = url.searchParams.get('restaurant_id');
    if (id) {
      return base + 'restaurant_id' + id;
    }
    const fav = url.searchParams.get('is_favorite');
    if (fav) {
      return base + 'is_favorite';
    }
      return base;
    }

  static markKeysStale(keys, val=true) {
    return Common.dbPromise.then(db => {
      const tx = db.transaction(Common.FLAG_STORE_NAME, 'readwrite');
      const objStore = tx.objectStore(Common.FLAG_STORE_NAME);
      keys.forEach((key, index) => {
        objStore.put({
          id: key,
          data: val
        });
      });
    });
  }

  static checkKeyStale(key) {
    return Common.dbPromise.then(db => {
      return db.transaction(Common.FLAG_STORE_NAME).objectStore(Common.FLAG_STORE_NAME)
      .get(key).then(storeRes => {
        if (!storeRes) return true;
        return storeRes.data;
      })
    });
  }

  static storeKeyVal(db, key, val) {
    db.transaction(Common.OBJ_STORE_NAME, 'readwrite').objectStore(Common.OBJ_STORE_NAME)
    .put({
      id: key,
      data: val
    });
    Common.markKeysStale([key], false); //Mark keys as updated now
  }

  static storeReview(db, data) {
    return db.transaction(Common.OFFLINE_REVIEWS_STORE, 'readwrite')
    .objectStore(Common.OFFLINE_REVIEWS_STORE)
    .put(data);
  }

  static handleGetRequest(url, db, key) {
    const tx = db.transaction(Common.OBJ_STORE_NAME);
    const objStore = tx.objectStore(Common.OBJ_STORE_NAME);
    return objStore.get(key).then(cachedResponse => {
      /* Return cached response if available 
         Defer updating data until asked for it */
      let deferredCachedResponse;
      if (cachedResponse) {
        if (Common.checkKeyStale(key)) {
          /* Keep stale data if network not available */
          try {
            if (!window.navigator.onLine) return cachedResponse.data;
          }
          catch (err) {
            /* Can't access window object in service worker :( */
            deferredCachedResponse = cachedResponse;
          }
        } else {
          return cachedResponse.data;
        }
      }
      /* Fetch response instead */
      return fetch(url).then(response => {
        return response.json();
      }).then(resJson => {
        /* Cache fetched JSON */
        Common.storeKeyVal(db, key, resJson);
        /* Return fetched response */
        return resJson;
      }).catch(err => {
        /* sw only: serve stale cached data because of network outage */
        if (deferredCachedResponse) return deferredCachedResponse;
        console.error(err);
      });
    }).then(resJson => {
      /* event.respondWith expects Response object */
      return new Response(JSON.stringify(resJson));
    });
  }

  static handlePutRequest(url, db, key, jsonData) {
    let options = { method: 'PUT'}
    if (jsonData) {
      options.body = JSON.stringify(jsonData)
      options.headers = { 'Content-Type': 'application/json' }
    }
    return fetch(url, options).then(response => {
      return response.json();
    }).then(resJson => {
      //Update the info in the local storage
      Common.storeKeyVal(db, key, resJson);
      //Mark stale data for future fetch
      const type = key.match(/^[a-z]+/)[0];
      let staleKeys = ['restaurants', 'restaurantsis_favorite'];
      if (type == 'reviews') {
        const id = key.match(/^\w+/)[0];
        staleKeys = staleKeys.concat([
          'reviews',
          'reviewsrestaurant_id' + id]);
        staleKeys.shift();
      }
      Common.markKeysStale(staleKeys);
      return true;
    }).catch(err => {
      console.error('Error :', err);
      return false;
    });
  }

  static handlePostRequest(url, data, db) {
    const postData = JSON.stringify(data);
    const options = {
      method: 'POST',
      body: postData,
    }
    //Try creating new review
    return fetch(url, options).then(response => {
      if (!response) {
        console.error('POST response was null');
        return false;
      }
      return response.json();
    }).then(resJson => {
      if (!resJson) {
        return false;
      }
      //Create key now that we have the id
      const id = resJson.id;
      const key = Common.urlToKey(`http://localhost:1337/reviews/${id}`);
      //Cache the data for newly created review
      Common.storeKeyVal(db, key, resJson);
      //Only one stale keys because review never existed
      Common.markKeysStale(['reviews']);
      return resJson;
    }).catch(err => {
      console.log('Saving review to upload later');
      console.error(err);
      Common.storeReview(db, data);
      return false;
    });
  }

  static handleApiRequest(rawUrl, method='GET', data=null, backgroundTask=false) {
    const url = new URL(rawUrl);
    const key = Common.urlToKey(url);;
    /* Check IDB cache */
    return Common.dbPromise.then(db => {
      if (method == 'PUT') {
        return Common.handlePutRequest(url, db, key);
      }
      if (method == 'GET') {
        return Common.handleGetRequest(url, db, key);
      }
      if (method == 'POST') {
        const postPromise = Common.handlePostRequest(url, data, db);
        if (backgroundTask) return postPromise;
        postPromise.then(success => {window.location.reload()});
        return;
      }
      console.error(`method ${method} not supported yet`);
    });
  }

  /**
   * Favorite buttons
   */ 

  static toggleFavButton(el, isFav) {
    el.classList.toggle('fav-button-not-checked');
    el.classList.toggle('fav-button-checked');
    if (isFav) {
      el.setAttribute('aria-pressed', 'true')
      return;
    }
    el.setAttribute('aria-pressed', 'false');
  }

  static handleFavButtonClick(event) {
    if (event.key) { //Keyboard event
      //Catch only spacebar and enter keys
      if ((event.key != " ") && (event.key != "Enter")) return;
      event.preventDefault();
    }
    const favButton = event.target || event.srcElement;
    const id = favButton.getAttribute('data-id');
    const wasFav = favButton.classList.contains('fav-button-checked');
    const newState = !wasFav;
    //Try to send message to server
    const url = new URL(`http://localhost:${Common.serverPort}/restaurants/${id}/?is_favorite=${newState}`);
    //Switch appearance if succeeded
    Common.handleApiRequest(url, 'PUT');
    Common.toggleFavButton(favButton, newState);
  }

  static createFavButton(el, isFavField, id) {
    const isFav = JSON.parse(isFavField);
    const checkClass = isFav ? 'fav-button-checked' : 'fav-button-not-checked';
    const ariaPressed = isFav ? 'true' : 'false';
    el.setAttribute('class', `fav-button ${checkClass}`);
    //Accessibility
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Add restaurant to favorites');
    el.setAttribute('aria-pressed', ariaPressed);
    el.setAttribute('tabindex', '0');
    //Make button clickable and accessible
    el.addEventListener('click', Common.handleFavButtonClick);
    el.addEventListener('keypress', Common.handleFavButtonClick);
    //Associate button with restaurant
    el.setAttribute('data-id', id);
  }

}