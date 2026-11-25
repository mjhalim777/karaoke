/* Phone remote: join a room, search/add songs, manage the queue, control the TV. */
(function () {
  'use strict';
  var S = window.KaraokeSync;
  var $ = function (id) { return document.getElementById(id); };
  var esc = S.escapeHtml;

  var room = null, code = null, data = {};

  // ---------- join ----------
  var initial = S.cleanCode(new URLSearchParams(location.search).get('room') || localStorage.getItem('karaoke-remote-room'));
  if (S.isValidCode(initial)) join(initial); else $('joinView').classList.remove('hidden');

  $('joinCode').addEventListener('input', function (e) { e.target.value = S.cleanCode(e.target.value); });
  $('joinForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var c = S.cleanCode($('joinCode').value);
    if (!S.isValidCode(c)) { $('joinError').textContent = 'Room codes are 4 letters/numbers, like on the TV.'; return; }
    join(c);
  });

  var onlineTracked = false;
  function join(c) {
    code = c;
    localStorage.setItem('karaoke-remote-room', c);
    if (new URLSearchParams(location.search).get('room') !== c) history.replaceState(null, '', '?room=' + c);
    room = S.connect(c);
    if (!onlineTracked) { S.trackOnline('phone'); onlineTracked = true; }
    $('roomCode').textContent = c;
    $('joinView').classList.add('hidden');
    $('mainView').classList.remove('hidden');
    if (room.mode === 'demo') {
      $('modeNote').textContent = 'Demo mode (Firebase not set up): only works with a TV tab in this same browser.';
      $('modeNote').classList.remove('hidden');
    }
    room.on(function (val) { data = val || {}; render(); });
  }

  $('leaveBtn').addEventListener('click', function () {
    localStorage.removeItem('karaoke-remote-room');
    location.href = location.pathname;
  });

  // ---------- render ----------
  function render() {
    var cur = data.current;
    $('tvStatus').textContent = data.createdAt ? '● TV connected' : '○ No TV with this code yet';
    $('tvStatus').className = 'status ' + (data.createdAt ? 'ok' : 'warn');
    $('nowTitle').textContent = cur ? (cur.title || 'Loading…') : 'Nothing playing';
    $('nowSinger').textContent = cur && cur.singer ? '🎤 ' + cur.singer : '';
    $('pauseBtn').textContent = data.paused ? '▶' : '⏸';
    $('pauseBtn').setAttribute('aria-label', data.paused ? 'Play' : 'Pause');
    $('pauseBtn').disabled = $('skipBtn').disabled = !cur;

    var q = S.sortedQueue(data);
    $('queueCount').textContent = q.length;
    if (!q.length) {
      $('queueList').innerHTML = '<li class="empty">No songs waiting. Add one from “Add songs”.</li>';
      return;
    }
    $('queueList').innerHTML = q.map(function (item, i) {
      return '<li class="item" data-key="' + esc(item.key) + '">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '<div class="info"><p class="title">' + esc(item.title || item.videoId) + '</p>' +
        (item.singer ? '<p class="small accent">🎤 ' + esc(item.singer) + '</p>' : '') + '</div>' +
        '<div class="item-btns">' +
        '<button class="icon-btn" data-act="up" ' + (i === 0 ? 'disabled' : '') + ' aria-label="Move up">▲</button>' +
        '<button class="icon-btn" data-act="down" ' + (i === q.length - 1 ? 'disabled' : '') + ' aria-label="Move down">▼</button>' +
        '<button class="icon-btn danger" data-act="remove" aria-label="Remove">✕</button>' +
        '</div></li>';
    }).join('');
  }

  // ---------- queue actions ----------
  $('queueList').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var key = btn.closest('li').getAttribute('data-key');
    var q = S.sortedQueue(data);
    var i = q.findIndex(function (x) { return x.key === key; });
    if (i < 0) return;
    var act = btn.getAttribute('data-act');
    if (act === 'remove') {
      room.set('queue/' + key, null);
    } else {
      var j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= q.length) return;
      var a = q[i], b = q[j];
      var ao = a.order, bo = b.order;
      if (ao === bo) { bo = ao + (j > i ? 1 : -1); }
      var u = {};
      u['queue/' + a.key + '/order'] = bo;
      u['queue/' + b.key + '/order'] = ao;
      room.update(u);
    }
  });

  function addSong(videoId, title) {
    var singer = $('singerName').value.trim();
    var q = S.sortedQueue(data);
    var maxOrder = q.length ? q[q.length - 1].order : 0;
    room.push('queue', {
      videoId: videoId,
      title: title || '',
      singer: singer,
      order: Math.max(Date.now(), maxOrder + 1),
      addedAt: Date.now()
    });
    toast('Added: ' + (title || 'song') + (singer ? ' — ' + singer : ''));
  }

  // ---------- controls ----------
  $('skipBtn').addEventListener('click', function () {
    if (!data.current) return;
    room.set('skip', { target: data.current.key, at: Date.now() });
    toast('Skipping…');
  });
  $('pauseBtn').addEventListener('click', function () {
    if (data.current) room.set('paused', !data.paused);
  });

  // ---------- tabs ----------
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () {
      var name = t.getAttribute('data-tab');
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) { x.classList.toggle('active', x === t); });
      $('tab-search').classList.toggle('hidden', name !== 'search');
      $('tab-queue').classList.toggle('hidden', name !== 'queue');
    });
  });

  // ---------- singer name (remembered on this phone) ----------
  $('singerName').value = localStorage.getItem('karaoke-singer') || '';
  $('singerName').addEventListener('input', function () {
    localStorage.setItem('karaoke-singer', $('singerName').value);
    updateRandomBtn();
  });
  // the random song button only works once a singer name is typed
  function updateRandomBtn() {
    var btn = $('randomBtn');
    if (btn.classList.contains('spin')) return; // busy picking
    var hasName = !!$('singerName').value.trim();
    btn.disabled = !hasName;
    btn.textContent = hasName ? '🎲 Add a random song' : '🎲 Type your name to get a random song';
  }

  // ---------- YouTube search ----------
  var apiKey = window.YOUTUBE_API_KEY;
  if (apiKey) {
    $('searchForm').classList.remove('hidden');
    $('searchNote').classList.remove('hidden');
    $('randomBtn').classList.remove('hidden');
    updateRandomBtn();
  } else {
    $('linkBox').open = true;
    $('searchStatus').textContent = 'Search is off (no YouTube API key). Copy a link from the YouTube app (Share → Copy link) and paste it above.';
  }

  // ---------- Random song ----------
  var lastRandom = '';
  $('randomBtn').addEventListener('click', function () {
    var list = window.KARAOKE_RANDOM_SONGS || [];
    if (!list.length || !room || !$('singerName').value.trim()) return;
    var pick;
    do { pick = list[Math.floor(Math.random() * list.length)]; } while (list.length > 1 && pick === lastRandom);
    lastRandom = pick;
    var btn = $('randomBtn');
    btn.disabled = true;
    btn.classList.add('spin');
    btn.textContent = '🎲 Picking… ' + pick;
    S.countSearch();
    var url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=1' +
      '&q=' + encodeURIComponent(pick + ' karaoke') + '&key=' + encodeURIComponent(apiKey);
    fetch(url).then(function (r) { return r.json(); }).then(function (json) {
      if (json.error) throw new Error(json.error.message || 'YouTube error');
      var it = (json.items || [])[0];
      if (!it || !it.id || !it.id.videoId) throw new Error('nothing found for ' + pick);
      addSong(it.id.videoId, decodeEntities(it.snippet.title));
    }).catch(function (err) {
      toast('Random song failed: ' + err.message);
    }).then(function () {
      btn.classList.remove('spin');
      updateRandomBtn();
    });
  });

  var lastResults = [];
  $('searchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('searchInput').value.trim();
    if (!q) return;
    $('searchInput').blur();
    if (!/karaoke/i.test(q)) q += ' karaoke';
    $('searchStatus').textContent = 'Searching…';
    $('results').innerHTML = '';
    var url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=15' +
      '&q=' + encodeURIComponent(q) + '&key=' + encodeURIComponent(apiKey);
    S.countSearch();
    fetch(url).then(function (r) { return r.json(); }).then(function (json) {
      if (json.error) throw new Error(json.error.message || 'YouTube error');
      lastResults = (json.items || []).filter(function (it) { return it.id && it.id.videoId; }).map(function (it) {
        return {
          videoId: it.id.videoId,
          title: decodeEntities(it.snippet.title),
          channel: decodeEntities(it.snippet.channelTitle),
          thumb: it.snippet.thumbnails && it.snippet.thumbnails.default ? it.snippet.thumbnails.default.url : ''
        };
      });
      $('searchStatus').textContent = lastResults.length ? '' : 'No results. Try other words.';
      $('results').innerHTML = lastResults.map(function (r, i) {
        return '<li class="item result">' +
          (r.thumb ? '<img src="' + esc(r.thumb) + '" alt="" loading="lazy">' : '') +
          '<div class="info"><p class="title">' + esc(r.title) + '</p><p class="small muted">' + esc(r.channel) + '</p></div>' +
          '<button class="btn primary add" data-i="' + i + '">Add</button></li>';
      }).join('');
    }).catch(function (err) {
      $('searchStatus').textContent = 'Search failed: ' + err.message + ' — you can still paste a link.';
      $('linkBox').open = true;
    });
  });

  $('results').addEventListener('click', function (e) {
    var btn = e.target.closest('button.add');
    if (!btn) return;
    var r = lastResults[+btn.getAttribute('data-i')];
    addSong(r.videoId, r.title);
    btn.textContent = 'Added ✓';
    btn.disabled = true;
  });

  function decodeEntities(s) {
    var t = document.createElement('textarea');
    t.innerHTML = s || '';
    return t.value;
  }

  // ---------- paste a link ----------
  function parseVideoId(text) {
    text = (text || '').trim();
    if (/^[\w-]{11}$/.test(text)) return text;
    var m = text.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  $('linkForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = parseVideoId($('linkInput').value);
    if (!id) { toast("That doesn't look like a YouTube link."); return; }
    $('linkInput').value = '';
    // get the title from YouTube's oEmbed (no key needed); the TV fills it in if this fails
    fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id))
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (info) { addSong(id, info.title || ''); });
  });

  // ---------- toast ----------
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 2200);
  }
})();
