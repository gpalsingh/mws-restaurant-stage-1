let restaurant;
var newMap;

/**
 * Initialize map as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  initMap();
});

/**
 * Initialize leaflet map
 */
initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
      return;
    }
    fetchReviewsFromURL((error) => {
      if (error) {
        console.error(error);
        return;
      }
      self.newMap = L.map('map', {
        center: [restaurant.latlng.lat, restaurant.latlng.lng],
        zoom: 16,
        scrollWheelZoom: false
      });
      L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}', {
        mapboxToken: 'pk.eyJ1IjoiZ3BhbHNpbmdoIiwiYSI6ImNqaW1tM3AxNTA1NDIzcHE3OGo0ZWVtNXoifQ.gFppghLy-ZE0TIJ0judonA',
        maxZoom: 18,
        attribution: 'Map data &copy; <a tabindex="-1" href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
          '<a tabindex="-1" href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
          'Imagery © <a tabindex="-1" href="https://www.mapbox.com/">Mapbox</a>',
        id: 'mapbox.streets'
      }).addTo(newMap);
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
      //Make add restaurants form functional
      makeFormFucntional();
      //Upload pending reviews
      window.addEventListener('online', uploadPendingReviews);
      uploadPendingReviews();
    });
  });
}

/* window.initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
  });
} */

/**
 * Make add restaurants form functional.
 */
 makeFormFucntional = () => {
  form = document.getElementById('new-review-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    //Get data to post
    const rid = getParameterByName('id');
    const rname = document.getElementById('review-name-label').value;
    const rating = document.getElementById('review-rating').value;
    const comments = document.getElementById('review-comments').value;
    postData = {
      'restaurant_id': parseInt(rid),
      'name': rname,
      'rating': parseInt(rating),
      'comments': comments
    };
    //Send data
    Common.handleApiRequest('http://localhost:1337/reviews/',
                            'POST',
                            postData);
  });
 }

 /**
 * Upload pending reviews. Mark reviews uploaded on the page too.
 */
uploadPendingReviews = () => {
  //Try to upload only if we're online
  if (!navigator.onLine) return;
  if (!self.restaurant) return;

  const restId = self.restaurant.id;

  Common.dbPromise.then(db => {
    const tx = db.transaction(Common.OFFLINE_REVIEWS_STORE);
    tx.objectStore(Common.OFFLINE_REVIEWS_STORE).getAll().then(reviews => {
      reviews.forEach(review => {
        //Upload to server
        postData = {
          'restaurant_id': review.restaurant_id,
          'name': review.name,
          'rating': review.rating,
          'comments': review.comments
        }
        Common.handleApiRequest('http://localhost:1337/reviews', 'POST', postData, true)
          .then((resJson) => {
          if (review.restaurant_id == restId) {
            //Update the html if review is visible on current page
            const reviewDate = document.getElementById('pending-review-date-' + review.id);
            reviewDate.innerHTML = new Date(resJson.updatedAt).toDateString();
          }
          //Remove the review from database
          db.transaction(Common.OFFLINE_REVIEWS_STORE, 'readwrite')
            .objectStore(Common.OFFLINE_REVIEWS_STORE)
            .delete(review.id);
        });
      });
    });
  });
}

/**
 * Get pending reviews for this restaurant from idb
 */
getPendingReviews = (restaurant_id) => {
  return Common.dbPromise.then(db => {
    const tx = db.transaction(Common.OFFLINE_REVIEWS_STORE);
    const pendingRevStore = tx.objectStore(Common.OFFLINE_REVIEWS_STORE);
    var restIdIndex = pendingRevStore.index('restId');

    return restIdIndex.getAll(restaurant_id);
  }).then(reviews => {
    self.pendingReviews = reviews;
  });
}

/**
 * Get current restaurant from page URL.
 */
fetchReviewsFromURL = (callback) => {
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error);
  } else {
    getPendingReviews(id);
    DBHelper.fetchReviewsByRestaurantId(id, (error, reviews) => {
      self.reviews = reviews;
      fillReviewsHTML();
      callback(null)
    });
  }
}

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const fav = document.getElementById('button-fav');
  Common.createFavButton(fav, restaurant.is_favorite, restaurant.id);

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img'
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = DBHelper.imageAltForRestaurant(restaurant);
  image.setAttribute('srcset',DBHelper.imageSrcsetForRestaurant(restaurant));
  image.setAttribute('sizes', DBHelper.imageSizesForRestaurantDetails(restaurant));

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.reviews) => {
  const pendingReviews = self.pendingReviews;
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h2');
  title.innerHTML = 'Reviews';
  title.setAttribute('tabindex', '0');
  container.appendChild(title);

  if (!reviews && !pendingReviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    noReviews.setAttribute('tabindex', '0');
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  if (reviews) {
    reviews.forEach(review => {
      /**
       * We get reviews in oldest first order
       * Stack the reviews on top of each other to show latest first
       */
      ul.insertBefore(createReviewHTML(review), ul.childNodes[0]);
    });
  }
  if (pendingReviews.length > 0) {
    pendingReviews.forEach(review => {
      ul.insertBefore(createReviewHTML(review, true), ul.childNodes[0]);
    });
  }
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review, pending=false) => {
  const li = document.createElement('li');
  li.className = 'review-container';
  const name = document.createElement('p');
  name.innerHTML = review.name;
  name.className = 'review-name';
  name.setAttribute('tabindex', '0');
  li.appendChild(name);

  const date = document.createElement('p');
  if (pending) {
    date.innerHTML = 'PENDING UPLOAD';
    date.setAttribute('id', 'pending-review-date-' + review.id);
  } else {
    date.innerHTML = new Date(review.updatedAt).toDateString();
  }
  date.className = 'review-date';
  date.setAttribute('tabindex', '0');
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  rating.className = 'review-rating';
  rating.setAttribute('tabindex', '0');
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.className = 'review-comment';
  comments.setAttribute('tabindex', '0');
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  if ((name == 'id') && (self.restaurant)) {
    return self.restaurant.id;
  }
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
