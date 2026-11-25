/* Celebration sounds for the score pop-up, made with the Web Audio API (no sound files needed).
 * KaraokeSfx.celebrate(score): drum roll while counting, then a fanfare + crowd clapping.
 * Higher scores get a bigger fanfare and longer applause. */
(function () {
  'use strict';
  var ctx = null;
  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // browsers only allow sound after someone has tapped/pressed a key on the page: unlock on first input
  ['click', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function () { ac(); }, { capture: true, passive: true });
  });

  function noiseBuffer(c) {
    var len = Math.floor(c.sampleRate * 0.25);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  var noise = null;

  // one hand clap: a short filtered noise burst
  function clap(c, t, vol) {
    noise = noise || noiseBuffer(c);
    var src = c.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    var bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 1400;
    bp.Q.value = 0.8;
    var g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09 + Math.random() * 0.05);
    src.connect(bp); bp.connect(g); g.connect(c.destination);
    src.start(t, Math.random() * 0.1, 0.2);
  }

  // crowd applause: many claps at random times, swelling then fading
  function applause(c, start, seconds, crowd) {
    var total = Math.floor(seconds * crowd);
    for (var i = 0; i < total; i++) {
      var p = i / total;
      var t = start + p * seconds + Math.random() * 0.05;
      var env = Math.min(1, p * 5) * (1 - Math.pow(p, 3)); // swell in, fade out
      clap(c, t, 0.05 + 0.25 * env * Math.random());
    }
  }

  function tone(c, freq, t, dur, vol, type) {
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // drum roll under the counting numbers
  function drumRoll(c, t, seconds) {
    for (var x = 0; x < seconds; x += 0.045) clap(c, t + x, 0.08 + 0.12 * (x / seconds));
  }

  // "ta-da": rising arpeggio and a held chord
  function fanfare(c, t, big) {
    var notes = big ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    notes.forEach(function (f, i) { tone(c, f, t + i * 0.12, 0.25, 0.18, 'square'); });
    var end = t + notes.length * 0.12;
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f) { tone(c, f, end, big ? 1.4 : 0.9, 0.09, 'sawtooth'); });
    return end;
  }

  // sad trombone for low scores
  function womp(c, t) {
    [392, 370, 349.2, 329.6].forEach(function (f, i) { tone(c, f, t + i * 0.35, i === 3 ? 0.9 : 0.33, 0.14, 'sawtooth'); });
  }

  window.KaraokeSfx = {
    celebrate: function (score, countSeconds) {
      var c = ac();
      if (!c) return;
      var t = c.currentTime + 0.05;
      drumRoll(c, t, countSeconds || 0.8);
      var at = t + (countSeconds || 0.8);
      if (score < 70) {
        womp(c, at);
        applause(c, at + 0.6, 1.5, 25); // polite clapping
      } else {
        var big = score >= 90;
        fanfare(c, at, big);
        applause(c, at + 0.15, score >= 98 ? 5 : big ? 4 : 3, score >= 90 ? 90 : 60);
      }
    }
  };
})();
