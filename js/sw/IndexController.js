class IndexController {
  constructor(container) {
    this._container = container;
  }

  registerServiceWorker() {
    if (!navigator.serviceWorker) return;

    navigator.serviceWorker.register('./sw.js', {scope: '/'}).then(function(reg) {
      if (!navigator.serviceWorker.controller) {
        return;
      }
      console.log('Service worker registered');
    }).catch(function(err) {
      console.log('Failed to register serviceWorker');
      console.log(err);
    });
  }
}

const ic = new IndexController(document.getElementById('maincontent'));
ic.registerServiceWorker();