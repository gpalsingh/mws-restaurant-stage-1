class Common {
  /**
   * API Requests
   */
  static get serverPort() { return '1337' }
  static get OBJ_STORE_NAME() { return 'rest-reviews-json' }
  static get FLAG_STORE_NAME() { return 'rest-reviews-flags' }

  static get dbPromise() {
    return idb.open('rest-reviews-store', 2, upgradeDB => {
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
    }
    }).catch(er => console.log(`Failed to create dbPromise(${er})`));
  }

  static urlToKey(url) {
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

  static handleGetRequest(url, db, objStore, key) {
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

  static handlePutRequest(url, db, objStore, key, jsonData) {
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

  static handleApiRequest(url, method='GET') {
    const key = Common.urlToKey(url);
    /* Check IDB cache */
    return Common.dbPromise.then(db => {
      const tx = db.transaction(Common.OBJ_STORE_NAME);
      const objStore = tx.objectStore(Common.OBJ_STORE_NAME);
      if (method == 'PUT') {
        return Common.handlePutRequest(url, db, objStore, key);
      }
      return Common.handleGetRequest(url, db, objStore, key);
    });
  }

  /**
   * Favorite buttons
   */ 

  static toggleFavButton(el) {
    el.classList.toggle('fav-button-not-checked');
    el.classList.toggle('fav-button-checked');
  }

  static toggleFavLable(el, wasFav) {
    if (wasFav) {
      el.setAttribute('aria-label', 'Mark not favorite');
      return;
    }
    el.setAttribute('aria-label', 'Mark favorite');
  }

  static handleFavButtonClick(event) {
    const favButton = event.target || event.srcElement;
    const id = favButton.getAttribute('data-id');
    const wasFav = favButton.classList.contains('fav-button-checked');
    const newState = !wasFav;
    //Try to send message to server
    const url = new URL(`http://localhost:${Common.serverPort}/restaurants/${id}/?is_favorite=${newState}`);
    //Switch appearance if succeeded
    Common.handleApiRequest(url, 'PUT').isFul
    Common.toggleFavButton(favButton);
    Common.toggleFavLable(favButton, wasFav);

  }

  static createFavButton(el, isFavField, id) {
    const isFav = JSON.parse(isFavField);
    const checkClass = isFav ? 'fav-button-checked' : 'fav-button-not-checked';
    el.setAttribute('class', `fav-button ${checkClass}`);
    el.setAttribute('aria-role', 'button');
    //Accessibility
    el.setAttribute('role', 'button');
    const ariaText = isFav ? 'Mark not favorite' : 'Mark favorite';
    el.setAttribute('aria-label', ariaText);
    el.setAttribute('tabindex', '0');
    //Make button clickable
    el.addEventListener('click', Common.handleFavButtonClick);
    //Associate button with restaurant
    el.setAttribute('data-id', id);
  }

}