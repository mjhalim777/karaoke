/* TV page: plays the shared queue and advances automatically. */
(function () {
  'use strict';
  var S = window.KaraokeSync;
  var $ = function (id) { return document.getElementById(id); };

  // ----- room code (kept across refreshes) -----
  var params = new URLSearchParams(location.search);
  var code = S.cleanCode(params.get('room') || localStorage.getItem('karaoke-tv-room'));
  if (!S.isValidCode(code)) code = S.makeRoomCode();
  localStorage.setItem('karaoke-tv-room', code);

  var joinUrl = new URL('remote.html?room=' + code, location.href).href;
  ['startCode', 'idleCode', 'sideCode'].forEach(function (id) { $(id).textContent = code; });
  $('joinUrl').textContent = joinUrl.replace(/^https?:\/\//, '');

  function drawQr(el, size) {
    if (!window.QRCode) { el.textContent = ''; return; }
    el.innerHTML = '';
    new window.QRCode(el, { text: joinUrl, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M });
  }

  $('newRoomLink').addEventListener('click', function (e) {
    e.preventDefault();
    localStorage.removeItem('karaoke-tv-room');
    location.href = location.pathname; // drop ?room=
  });

  var room = S.connect(code);
  S.trackOnline('tv');
  if (room.mode === 'demo') {
    $('modeNote').textContent = 'Demo mode: Firebase is not set up, so only tabs in this browser can join.';
    $('modeNote').classList.remove('hidden');
  }

  // ----- state -----
  var data = {};
  var started = false;
  var player = null, playerReady = false;
  var loadedKey = null;        // key of the song loaded in the player
  var advancingFrom;           // key we asked to move past (undefined = not advancing)
  var appliedPaused = false;

  // ----- queue control (only the TV moves songs from queue to "current") -----
  function advance(reason) {
    var fromKey = data.current ? data.current.key : null;
    if (advancingFrom !== undefined && advancingFrom === fromKey) return; // already on it
    advancingFrom = fromKey;
    var next = S.sortedQueue(data)[0];
    var updates = { skip: null, paused: false };
    if (next) {
      updates.current = {
        key: next.key, videoId: next.videoId, title: next.title || '',
        singer: next.singer || '', startedAt: Date.now()
      };
      updates['queue/' + next.key] = null;
    } else {
      updates.current = null;
    }
    room.update(updates);
  }

  function render() {
    var cur = data.current;
    var queue = S.sortedQueue(data);

    $('nowTitle').textContent = cur ? (cur.title || 'Loading…') : 'Nothing playing';
    $('nowSinger').textContent = cur && cur.singer ? '🎤 ' + cur.singer : '';

    $('nextCount').textContent = queue.length ? '(' + queue.length + ')' : '';
    var list = $('nextList');
    if (!queue.length) {
      list.innerHTML = '<li class="empty">Queue is empty — add songs from your phone</li>';
    } else {
      list.innerHTML = queue.slice(0, 6).map(function (q) {
        return '<li><span class="t">' + S.escapeHtml(q.title || q.videoId) + '</span>' +
          (q.singer ? '<span class="s">🎤 ' + S.escapeHtml(q.singer) + '</span>' : '') + '</li>';
      }).join('') + (queue.length > 6 ? '<li class="more">+ ' + (queue.length - 6) + ' more</li>' : '');
    }

    $('idle').classList.toggle('hidden', !!cur);
    $('playerWrap').classList.toggle('hidden', !cur);
    $('pausedBadge').classList.toggle('hidden', !(cur && data.paused));
    $('pauseBtn').textContent = data.paused ? '▶ Play' : '⏸ Pause';
  }

  function sync() {
    render();
    if (!started) return;
    var cur = data.current;

    // a new "current" arrived -> we're no longer mid-advance
    if ((cur ? cur.key : null) !== advancingFrom) advancingFrom = undefined;

    // idle and songs waiting -> start the next one
    if (!cur && S.sortedQueue(data).length) { advance('idle'); return; }

    // phone asked to skip the song that is playing now
    if (cur && data.skip && data.skip.target === cur.key) { advance('skip'); return; }
    if (data.skip && (!cur || data.skip.target !== cur.key)) room.set('skip', null); // stale request

    if (!playerReady) return;

    if (cur && cur.key !== loadedKey) {
      loadedKey = cur.key;
      appliedPaused = false;
      player.loadVideoById(cur.videoId);
    } else if (!cur && loadedKey) {
      loadedKey = null;
      player.stopVideo();
    }

    if (cur && !!data.paused !== appliedPaused) {
      appliedPaused = !!data.paused;
      if (appliedPaused) player.pauseVideo(); else player.playVideo();
    }
  }

  var announced = false;
  room.on(function (val) {
    data = val || {};
    if (!announced) { announced = true; if (!data.createdAt) room.set('createdAt', Date.now()); }
    sync();
  });

  // ----- YouTube player -----
  window.onYouTubeIframeAPIReady = function () {
    player = new window.YT.Player('player', {
      width: '100%', height: '100%',
      playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, fs: 0 },
      events: {
        onReady: function () { playerReady = true; sync(); },
        onStateChange: function (e) {
          if (e.data === window.YT.PlayerState.ENDED) advance('ended');
          if (e.data === window.YT.PlayerState.PLAYING) fillTitle();
        },
        onError: function () {
          toast("Can't play this video here — skipping…");
          var key = loadedKey;
          setTimeout(function () { if (data.current && data.current.key === key) advance('error'); }, 2500);
        }
      }
    });
  };

  // pasted links may have no title yet: take it from the player
  function fillTitle() {
    var cur = data.current;
    if (!cur || cur.title || !player.getVideoData) return;
    var t = player.getVideoData().title;
    if (t) room.set('current/title', t);
  }

  function loadYouTubeApi() {
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 3000);
  }

  // ----- start (user gesture: needed for sound + fullscreen) -----
  function start() {
    if (started) return;
    started = true;
    var el = document.documentElement;
    var fs = el.requestFullscreen || el.webkitRequestFullscreen;
    if (fs) { try { var p = fs.call(el); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    $('start').classList.add('hidden');
    $('app').classList.remove('hidden');
    drawQr($('qrBig'), 320);
    drawQr($('qrSmall'), 140);
    loadYouTubeApi();
    sync();
    $('skipBtn').focus();
  }
  $('startBtn').addEventListener('click', start);

  // ----- TV controls -----
  $('skipBtn').addEventListener('click', function () { if (data.current) advance('tv-skip'); });
  $('pauseBtn').addEventListener('click', function () { if (data.current) room.set('paused', !data.paused); });

  document.addEventListener('keydown', function (e) {
    if (!started) return;
    var k = e.key;
    if (k === 'MediaPlayPause' || k === ' ' && document.activeElement === document.body) {
      e.preventDefault(); $('pauseBtn').click();
    } else if (k === 'MediaTrackNext') {
      $('skipBtn').click();
    } else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      // move focus between the two big buttons with the remote's arrows
      e.preventDefault();
      ($('pauseBtn') === document.activeElement ? $('skipBtn') : $('pauseBtn')).focus();
    }
  });
})();
