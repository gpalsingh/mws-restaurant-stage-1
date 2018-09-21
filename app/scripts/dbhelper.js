/**
 * Common database helper functions.
 */
const altRestaurantTexts = [
  '',
  'Restaurant mission chinese food inside view',
  'Restaurant emily dish sample',
  'Restaurant KANG HO DONG BAEKJEONG inside view',
  'Restaurant KATZ\'S DELICATESSEN outside view',
  'Restaurant ROBERTA\'S PIZZA inside view',
  'Restaurant HOMETOWN BBQ inside view',
  'Restaurant SUPERIORITY BURGER entrance',
  'Restaurant THE DUTCH outside',
  'Restaurant MU RAMEN inside',
  'Restaurant CASA ENRIQUE inside'
]

const suffixedImagePath = function (restaurant, suffix) {
  const imgDir ='/images'
  /* New data source gives only image name
     Casa Enrique photograph name is missing in data
     Use id instead since both fields are similar */
  const imgName = restaurant.id;
  return `${imgDir}/${imgName}${suffix}.jpg`;
}

class DBHelper {

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337 // Change this to your server port
    return `http://localhost:${port}/restaurants`;
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    Common.handleApiRequest(new URL(DBHelper.DATABASE_URL)).then((response) => {
        // Got a success response from server!
        return response.json();
      }).then((restaurants) => {
        callback(null, restaurants);
      }).catch((error) => {
        // Oops!. Got an error from server.
        callback(error, null);
      });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) { // Got the restaurant
          callback(null, restaurant);
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return (suffixedImagePath(restaurant, '-small'));
  }

  /**
   * Restaurant image alt tag.
   */
  static imageAltForRestaurant(restaurant) {
    return altRestaurantTexts[restaurant.id];
  }

  /**
   * Restaurant image srcset.
   */
  static imageSrcsetForRestaurant(restaurant) {
    return `${suffixedImagePath(restaurant, '-large-2x')} 1600w,
      ${suffixedImagePath(restaurant, '-large-1x')} 800w,
      ${suffixedImagePath(restaurant, '-medium')} 700w,
      ${suffixedImagePath(restaurant, '-small')} 500w`
  }

  /**
   * Restaurant image sizes for homepage.
   */
  static imageSizesForRestaurantHome(restaurant) {
    return '(min-width: 880px) 34vw, (min-width: 550px) 50vw, 90vw'
  }

  /**
   * Restaurant image sizes for restraunt details page.
   */
  static imageSizesForRestaurantDetails(restaurant) {
    return '(min-width: 550px) 50vw, 90vw'
  }

  /**
   * Map marker for a restaurant.
   */
   static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker
    const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng],
      {title: restaurant.name,
      alt: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant)
      })
      marker.addTo(newMap);
    return marker;
  }
  /* static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  } */

}

