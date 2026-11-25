/* Registers the service worker and shows an "Install app" button where the browser allows it. */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  var btn = document.getElementById('installBtn');
  var help = document.getElementById('installHelp');
  if (!btn) return;
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return; // already installed
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    btn.classList.remove('hidden');
    if (help) help.classList.add('hidden');
  });
  btn.addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; btn.classList.add('hidden'); });
  });
  window.addEventListener('appinstalled', function () { btn.classList.add('hidden'); if (help) help.classList.add('hidden'); });
  // iPhone/iPad never fire beforeinstallprompt: explain the Share menu instead
  if (help && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
    help.textContent = 'To install on iPhone: tap Share ⬆️ then “Add to Home Screen”.';
    help.classList.remove('hidden');
  }
})();
