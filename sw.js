/* Makes the site installable as an app and lets its pages open even with a weak connection.
 * Network first (so updates show up right away); the saved copy is used only when offline.
 * Firebase and YouTube requests are never cached. */
var CACHE = 'karaoke-v4';
var SHELL = ['./', 'tv', 'remote', 'usage', 'index.html', 'tv.html', 'remote.html', 'usage.html', 'config.js',
  'js/sync.js', 'js/tv.js', 'js/sfx.js', 'js/remote.js', 'js/songs.js', 'css/tv.css', 'css/remote.css',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // only our own files
  e.respondWith(fetch(req).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true });
  }));
});
