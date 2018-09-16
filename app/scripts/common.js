import idb from 'idb';

const dbPromise = idb.open('rest-reviews-store', 1, upgradeDB => {
  switch(upgradeDB.oldVersion) {
    case 0:
      const teststore = upgradeDB.createObjectStore(
        Common.OBJ_STORE_NAME,
        {
          keyPath: 'id',
        }
      );
  }
}).catch(er => console.log(`Failed to create dbPromise(${er})`));

class Common {
  /**
   * API Requests
   */
  static get serverPort() { return '1337' }
  static get OBJ_STORE_NAME() { return 'rest-reviews-json'}

  static urlToKey(url) {
   return url.pathname.split('/').join('') || -1;
  }

  static storeKeyVal(db, key, val) {
    db.transaction(Common.OBJ_STORE_NAME, 'readwrite').objectStore(Common.OBJ_STORE_NAME)
    .put({
      id: key,
      data: val
    });
  }

  static handleGetRequest(url, db, objStore, key) {
    return objStore.get(key).then(cachedResponse => {
      /* Return cached response if available */
      if (cachedResponse) return cachedResponse.data;
      /* Fetch response instead */
      return fetch(url).then(response => {
        return response.json();
      }).then(resJson => {
        /* Cache fetched JSON */
        Common.storeKeyVal(db, key, resJson);
        /* Return fetched response */
        return resJson;
      });
    }).then(resJson => {
      /* event.respondWith expects Response object */
      return new Response(JSON.stringify(resJson));
    });
  }

  static handlePutRequest(url, db, objStore, key) {
    fetch(url, {method: 'PUT'}).then(response => {
      return response.json();
    }).then(resJson => {
      //Update the info in the local storage
      Common.storeKeyVal(db, key, resJson);
      return true;
    }).catch(err => {
      console.error('Error :', err);
      return false;
    });
  }

  static handleApiRequest(url, method) {
    const key = Common.urlToKey(url);
    /* Check IDB cache */
    return dbPromise.then(db => {
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
    if (Common.handleApiRequest(url, 'PUT')) {
      //Switch appearance if succeeded
      Common.toggleFavButton(favButton);
      Common.toggleFavLable(favButton, wasFav);    
    } else {
      alert('Failed to toggle restaurant favorite status. Please try again later.');
    }
  }

  static createFavButton(el, isFavField, id) {
    const isFav = JSON.parse(isFavField);
    const checkClass = isFav ? 'fav-button-checked' : 'fav-button-not-checked';
    el.setAttribute('class', `fav-button ${checkClass}`);
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

window.Common = Common;