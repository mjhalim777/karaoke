/* Shared room sync for the TV and the phones.
 *
 * Data lives under rooms/{CODE}:
 *   createdAt   number          set by the TV when it opens the room
 *   queue/{id}  {videoId, title, singer, order, addedAt}   pending songs
 *   current     {key, videoId, title, singer, startedAt}   now playing (TV writes)
 *   paused      boolean         pause state, written by TV or phones, applied by TV
 *   skip        {target, at}    "skip song <target>"; TV ignores it if <target> is no longer playing
 *
 * Two backends with the same interface:
 *   - Firebase Realtime Database, when config.js has a Firebase apiKey + databaseURL
 *   - Demo mode (localStorage), which only syncs tabs of one browser — for local testing
 */
(function () {
  'use strict';

  var ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid mix-ups

  function makeRoomCode() {
    var s = '';
    for (var i = 0; i < 4; i++) s += ROOM_CHARS.charAt(Math.floor(Math.random() * ROOM_CHARS.length));
    return s;
  }

  function cleanCode(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  }

  function isValidCode(code) {
    return new RegExp('^[' + ROOM_CHARS + ']{4}$').test(code);
  }

  function hasFirebase() {
    var c = window.FIREBASE_CONFIG || {};
    return !!(c.apiKey && c.databaseURL && window.firebase);
  }

  var idCounter = 0;
  function makeId() {
    idCounter++;
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) + idCounter;
  }

  // ---------- Firebase backend ----------
  function FirebaseRoom(code) {
    if (!window.firebase.apps.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
    this.ref = window.firebase.database().ref('rooms/' + code);
    this.mode = 'firebase';
  }
  FirebaseRoom.prototype.on = function (cb) {
    this.ref.on('value', function (snap) { cb(snap.val() || {}); });
  };
  FirebaseRoom.prototype.onConnection = function (cb) {
    window.firebase.database().ref('.info/connected').on('value', function (s) { cb(!!s.val()); });
  };
  FirebaseRoom.prototype.update = function (values) { return this.ref.update(values); };
  FirebaseRoom.prototype.set = function (path, value) { return this.ref.child(path).set(value); };
  FirebaseRoom.prototype.push = function (path, value) {
    var r = this.ref.child(path).push();
    r.set(value);
    return r.key;
  };

  // ---------- Demo backend (localStorage + storage events) ----------
  function LocalRoom(code) {
    this.key = 'karaoke-demo/rooms/' + code;
    this.listeners = [];
    this.mode = 'demo';
    var self = this;
    window.addEventListener('storage', function (e) {
      if (e.key === self.key) self.emit();
    });
  }
  LocalRoom.prototype.read = function () {
    try { return JSON.parse(localStorage.getItem(this.key) || '{}') || {}; } catch (e) { return {}; }
  };
  LocalRoom.prototype.write = function (data) {
    localStorage.setItem(this.key, JSON.stringify(data));
    var self = this;
    setTimeout(function () { self.emit(); }, 0); // storage events don't fire in the writing tab
    return Promise.resolve();
  };
  LocalRoom.prototype.emit = function () {
    var data = this.read();
    this.listeners.forEach(function (cb) { cb(data); });
  };
  LocalRoom.prototype.on = function (cb) {
    this.listeners.push(cb);
    var self = this;
    setTimeout(function () { cb(self.read()); }, 0);
  };
  LocalRoom.prototype.onConnection = function (cb) { setTimeout(function () { cb(true); }, 0); };
  function setPath(obj, path, value) {
    var parts = path.split('/').filter(Boolean);
    var node = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    var last = parts[parts.length - 1];
    if (value === null || value === undefined) delete node[last];
    else node[last] = JSON.parse(JSON.stringify(value));
  }
  LocalRoom.prototype.update = function (values) {
    var data = this.read();
    Object.keys(values).forEach(function (p) { setPath(data, p, values[p]); });
    return this.write(data);
  };
  LocalRoom.prototype.set = function (path, value) {
    var v = {}; v[path] = value;
    return this.update(v);
  };
  LocalRoom.prototype.push = function (path, value) {
    var id = makeId();
    this.set(path + '/' + id, value);
    return id;
  };

  // ---------- helpers shared by both pages ----------
  function sortedQueue(room) {
    var q = (room && room.queue) || {};
    return Object.keys(q).map(function (k) {
      var item = q[k]; item.key = k; return item;
    }).sort(function (a, b) {
      return (a.order - b.order) || (a.addedAt - b.addedAt);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }


  // ---------- usage stats (shown on usage.html) ----------
  // stats/searches/{day}: YouTube searches that day. The day follows US Pacific time,
  //   because that is when Google resets the daily YouTube quota.
  // stats/online/{id}: one entry per open TV/phone page, removed when it disconnects.
  function quotaDay() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function statsRef(path) {
    if (!hasFirebase()) return null;
    if (!window.firebase.apps.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
    return window.firebase.database().ref('stats/' + path);
  }
  function countSearch() {
    var r = statsRef('searches/' + quotaDay());
    if (r) r.transaction(function (n) { return (n || 0) + 1; });
  }
  function trackOnline(kind) {
    if (!hasFirebase()) return;
    var me = statsRef('online').push();
    window.firebase.database().ref('.info/connected').on('value', function (s) {
      if (!s.val()) return;
      me.onDisconnect().remove();
      me.set(kind === 'tv' ? 'tv' : 'phone');
    });
  }

  window.KaraokeSync = {
    connect: function (code) { return hasFirebase() ? new FirebaseRoom(code) : new LocalRoom(code); },
    isDemo: function () { return !hasFirebase(); },
    makeRoomCode: makeRoomCode,
    cleanCode: cleanCode,
    isValidCode: isValidCode,
    sortedQueue: sortedQueue,
    escapeHtml: escapeHtml,
    quotaDay: quotaDay,
    statsRef: statsRef,
    countSearch: countSearch,
    trackOnline: trackOnline
  };
})();
