/* =========================================================
   SEÑAL — App by Allan
   ES5 a propósito: el motor de webOS 4.5 es Chromium 53 y no
   tiene async/await. Se usan var, funciones y concatenación.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Geometría del carrusel (en rem del diseño) ---------- */
  var TILE   = 13;      /* ancho/alto base del mosaico */
  var SCALE  = 2.0;     /* cuánto crece el mosaico enfocado */
  var GAP    = 2.2;     /* aire entre mosaicos */
  var WINDOW = 7;       /* mosaicos renderizados a cada lado */

  var BARS = ['#EEF1F6', '#E3C24A', '#12B8C8', '#3FA86A',
              '#B65CA8', '#D6453B', '#2B4FA8'];

  /* ---------- Estado ---------- */
  var groups = [];      /* [{name, items:[canal,...]}] */
  var gi = 0;           /* índice de categoría */
  var ci = 0;           /* índice de canal dentro de la categoría */
  var tiles = [];       /* nodos DOM del carrusel actual */
  var inPlayer = false;
  var bannerTimer = null;
  var watchdog = null;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Puente de plataforma ----------
     En webOS el <video> reproduce HLS nativo y basta con eso.
     En Android TV el WebView NO soporta HLS, asi que la capa nativa
     expone window.Android y el video lo pone ExoPlayer por debajo.
     La UI es identica en ambos: solo cambia quien decodifica. */
  var NATIVE = !!(window.Android && window.Android.play);
  var root = document.documentElement;

  function nativeOn()  { root.className = 'nvid'; }
  function nativeOff() { root.className = ''; }

  var el = {
    boot:   $('boot'),   browse: $('browse'), rail:  $('rail'),
    track:  $('track'),  mNum:   $('mNum'),   mName: $('mName'),
    mLine:  $('mLine'),  mCount: $('mCount'), fill:  $('tunerFill'),
    clock:  $('clock'),  player: $('player'), video: $('video'),
    banner: $('pBanner'),pLogo:  $('pLogo'),  pNum:  $('pNum'),
    pName:  $('pName'),  pGroup: $('pGroup'), status:$('pStatus'),
    pMsg:   $('pMsg'),   pSub:   $('pSub')
  };

  function host(url) {
    var m = /^https?:\/\/([^\/:]+)/i.exec(url || '');
    return m ? m[1].replace(/^www\./, '') : 'fuente desconocida';
  }

  function rem() {
    var fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return fs > 0 ? fs : 16;
  }

  /* ---------- Datos ---------- */
  function buildGroups() {
    var list = window.CANALES || [];
    var order = [], map = {};
    for (var i = 0; i < list.length; i++) {
      var g = list[i].group;
      if (!map[g]) { map[g] = { name: g, items: [] }; order.push(map[g]); }
      map[g].items.push(list[i]);
    }
    return order;
  }

  function current() {
    var g = groups[gi];
    return g ? g.items[ci] : null;
  }

  /* ---------- Riel de categorías ---------- */
  function renderRail() {
    var html = '';
    for (var i = 0; i < groups.length; i++) {
      html += '<div class="rail__item' + (i === gi ? ' rail__item--on' : '') + '">'
           +  groups[i].name
           +  '<span class="rail__n">' + groups[i].items.length + '</span>'
           +  '</div>';
    }
    el.rail.innerHTML = html;
  }

  function updateRail() {
    var nodes = el.rail.childNodes;
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].className = 'rail__item' + (i === gi ? ' rail__item--on' : '');
    }
  }

  /* ---------- Carrusel ---------- */
  function ribbon() {
    var s = '<div class="tile__rib">';
    for (var i = 0; i < BARS.length; i++) {
      s += '<i style="background:' + BARS[i] + '"></i>';
    }
    return s + '</div>';
  }

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderTrack() {
    var items = groups[gi].items;
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var c = items[i];
      html += '<div class="tile" data-i="' + i + '">'
           +  ribbon()
           +  '<div class="tile__fallback">' + esc(c.name) + '</div>';
      if (c.logo) {
        html += '<img class="tile__logo" src="' + esc(c.logo)
             +  '" alt="' + esc(c.name) + '">';
      }
      html += '</div>';
    }
    el.track.innerHTML = html;
    tiles = el.track.getElementsByClassName('tile');

    /* Si el logo remoto falla, se cae al nombre en texto. */
    var imgs = el.track.getElementsByTagName('img');
    for (var k = 0; k < imgs.length; k++) {
      imgs[k].onerror = function () { this.style.display = 'none'; };
    }
  }

  function layout() {
    var u = rem();
    var cx = window.innerWidth / 2;
    var halfBig = (TILE * SCALE) / 2 * u;
    var w = TILE * u;
    var step = (TILE + GAP) * u;
    var gapPx = GAP * u;

    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      var o = i - ci;
      var a = o < 0 ? -o : o;

      if (a > WINDOW) { t.className = 'tile'; continue; }

      var x, cls;
      if (o === 0) {
        x = cx - w / 2;
        cls = 'tile tile--vis tile--on';
      } else if (o > 0) {
        x = cx + halfBig + gapPx + (o - 1) * step;
        cls = 'tile tile--vis';
      } else {
        x = cx - halfBig - gapPx - (a - 1) * step - w;
        cls = 'tile tile--vis';
      }

      var sc = o === 0 ? SCALE : 1;
      t.style.transform = 'translate3d(' + Math.round(x) + 'px,0,0) scale(' + sc + ')';
      t.className = cls;

      /* Los mosaicos lejanos se apagan progresivamente. */
      if (o !== 0) { t.style.opacity = String(Math.max(0.12, 0.5 - (a - 1) * 0.07)); }
      else { t.style.opacity = '1'; }
    }
  }

  function updateMeta() {
    var c = current();
    if (!c) { return; }
    var items = groups[gi].items;
    el.mNum.textContent   = c.num < 10 ? '0' + c.num : String(c.num);
    el.mName.textContent  = c.name;
    el.mLine.textContent  = c.group + ' · señal abierta · ' + host(c.url);
    el.mCount.textContent = (ci + 1) + ' / ' + items.length;
    var pct = items.length > 1 ? (ci / (items.length - 1)) * 100 : 100;
    el.fill.style.width = pct.toFixed(1) + '%';
  }

  function refresh(full) {
    if (full) { renderTrack(); updateRail(); }
    layout();
    updateMeta();
  }

  /* ---------- Navegación ---------- */
  function moveChannel(d) {
    var n = groups[gi].items.length;
    ci = (ci + d + n) % n;
    layout();
    updateMeta();
  }

  function moveGroup(d) {
    gi = (gi + d + groups.length) % groups.length;
    ci = 0;
    refresh(true);
  }

  /* ---------- Reproductor ---------- */
  function showStatus(msg, sub, isErr) {
    el.pMsg.textContent = msg;
    el.pSub.textContent = sub || '';
    el.status.className = 'status status--on' + (isErr ? ' status--err' : '');
  }
  function hideStatus() { el.status.className = 'status'; }

  function showBanner() {
    el.banner.className = 'banner';
    if (bannerTimer) { clearTimeout(bannerTimer); }
    bannerTimer = setTimeout(function () {
      el.banner.className = 'banner banner--hide';
    }, 4500);
  }

  function play(c) {
    inPlayer = true;
    el.player.className = 'player player--on';

    el.pNum.textContent   = (c.num < 10 ? '0' : '') + c.num;
    el.pName.textContent  = c.name;
    el.pGroup.textContent = c.group;
    if (c.logo) {
      el.pLogo.onerror = function () { this.style.display = 'none'; };
      el.pLogo.style.display = '';
      el.pLogo.src = c.logo;
    } else {
      el.pLogo.style.display = 'none';
    }

    showBanner();
    showStatus('Sintonizando…', c.name, false);

    if (NATIVE) {
      nativeOn();
      window.Android.play(c.url, c.name);
      return;                       /* ExoPlayer avisa por window.SENAL.native */
    }

    var v = el.video;
    v.src = c.url;
    v.load();
    var p = v.play();
    if (p && p['catch']) {
      p['catch'](function () { /* webOS reintenta solo al cargar el manifiesto */ });
    }

    if (watchdog) { clearTimeout(watchdog); }
    watchdog = setTimeout(function () {
      if (inPlayer && v.readyState < 3) {
        showStatus('Sin señal',
          'El canal no respondió. Prueba otro o revisa la conexión.', true);
      }
    }, 15000);
  }

  function stop() {
    inPlayer = false;
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }

    if (NATIVE) {
      window.Android.stop();
      nativeOff();
    } else {
      var v = el.video;
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
    el.player.className = 'player';
    hideStatus();
  }

  el.video.addEventListener('playing', function () {
    hideStatus();
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
  });
  el.video.addEventListener('waiting', function () {
    if (inPlayer) { showStatus('Cargando…', '', false); }
  });
  el.video.addEventListener('error', function () {
    if (!inPlayer) { return; }
    showStatus('Sin señal',
      'La fuente no está disponible ahora. Vuelve con ATRÁS.', true);
  });

  /* ---------- Teclas del control remoto ---------- */
  var K = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13,
    BACK: 461, ESC: 27, BKSP: 8,
    CH_UP: 33, CH_DOWN: 34
  };

  function onKey(e) {
    var k = e.keyCode;

    if (inPlayer) {
      if (k === K.BACK || k === K.ESC || k === K.BKSP) {
        e.preventDefault(); stop(); return;
      }
      if (k === K.RIGHT || k === K.CH_UP || k === K.UP) {
        e.preventDefault(); moveChannel(1); play(current()); return;
      }
      if (k === K.LEFT || k === K.CH_DOWN || k === K.DOWN) {
        e.preventDefault(); moveChannel(-1); play(current()); return;
      }
      if (k === K.OK) { e.preventDefault(); showBanner(); return; }
      return;
    }

    switch (k) {
      case K.LEFT:  e.preventDefault(); moveChannel(-1); break;
      case K.RIGHT: e.preventDefault(); moveChannel(1);  break;
      case K.UP:    e.preventDefault(); moveGroup(-1);   break;
      case K.DOWN:  e.preventDefault(); moveGroup(1);    break;
      case K.OK:    e.preventDefault(); if (current()) { play(current()); } break;
      case K.BACK:
      case K.ESC:
        e.preventDefault();
        if (window.webOS && window.webOS.platformBack) { window.webOS.platformBack(); }
        break;
    }
  }

  /* ---------- Reloj ---------- */
  function tick() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    el.clock.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /* ---------- Arranque ---------- */
  function start() {
    groups = buildGroups();
    if (!groups.length) {
      el.mName.textContent = 'Sin canales';
      el.mLine.textContent = 'Revisa js/data.js';
      return;
    }
    renderRail();
    refresh(true);
    tick();
    setInterval(tick, 20000);

    document.addEventListener('keydown', onKey, false);
    window.addEventListener('resize', function () { layout(); }, false);

    /* La secuencia de barras es la firma visual; se retira sola. */
    setTimeout(function () {
      el.boot.className = 'boot boot--collapse';
    }, 1900);
    setTimeout(function () {
      el.boot.className = 'boot boot--gone';
      el.browse.className = 'browse browse--on';
    }, 2400);
  }

  /* Superficie que llama el codigo Kotlin. En webOS nadie la usa. */
  window.SENAL = {
    back: function () {
      if (inPlayer) { stop(); return true; }
      return false;               /* false => que el shell cierre la app */
    },
    native: function (ev, detail) {
      if (!inPlayer) { return; }
      if (ev === 'playing')      { hideStatus(); }
      else if (ev === 'buffering') { showStatus('Cargando…', '', false); }
      else if (ev === 'error')   {
        showStatus('Sin señal',
          detail || 'La fuente no está disponible ahora.', true);
      }
    }
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, false);
  }
})();
