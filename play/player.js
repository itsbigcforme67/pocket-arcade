/* Pocket Arcade - the pages for the consoles that run on EmulatorJS (gb/, ws/, ngp/).
   Copyright (C) 2026 the Pocket Arcade authors. GPL-3.0-or-later; see LICENSE.

   Each console's page sets window.ARCADE_SYSTEM and loads this file. It shows the list of games
   (ones you opened from this device, kept in this browser, and any files in roms/<console>/),
   and starts EmulatorJS from the copy in ../emulatorjs/data/. Nothing is fetched from another site. */
(function () {
  'use strict';

  var SYS = window.ARCADE_SYSTEM;
  var ROOT = '../';
  var DATA = ROOT + 'emulatorjs/data/';
  var ROMS = ROOT + 'roms/' + SYS.id + '/';
  var D = document;
  var ROM_EXT = new RegExp('\\.(' + SYS.exts.join('|') + ')$', 'i');
  var ZIP_EXT = /\.(zip|7z)$/i;              // EmulatorJS unpacks these itself
  var LANGS = ['af-FR', 'ar-AR', 'ben-BEN', 'de-GER', 'el-GR', 'es-ES', 'fa-AF', 'hi-HI', 'it-IT', 'ja-JA', 'jv-JV', 'ko-KO',
               'pt-BR', 'ro-RO', 'ru-RU', 'tr-TR', 'vi-VN', 'zh-CN'];

  // Space kept clear of the picture, in CSS pixels: a strip along the top for the buttons, and room
  // for the touch controls (underneath when the phone is upright, either side when it is sideways).
  var TOP = 40, PAD_BELOW = 250, PAD_SIDE = 150;

  // Touch controls. The numbers are libretro's button ids: 0 B, 1 Y, 2 Select, 3 Start, 4-7 up/down/left/right,
  // 8 A, 9 X, 10 L, 11 R, 12 L2, 13 R2. Positions are EmulatorJS's own, minus its fast/slow buttons.
  var DPAD = { type: 'dpad', id: 'dpad', location: 'left', left: '50%', right: '50%', joystickInput: false, inputValues: [4, 5, 6, 7] };
  var PADS = {
    gb: [
      { type: 'button', text: 'A', id: 'a', location: 'right', left: 81, top: 40, bold: true, input_value: 8 },
      { type: 'button', text: 'B', id: 'b', location: 'right', left: 10, top: 70, bold: true, input_value: 0 },
      DPAD,
      { type: 'button', text: 'Start', id: 'start', location: 'center', left: 60, fontSize: 15, block: true, input_value: 3 },
      { type: 'button', text: 'Select', id: 'select', location: 'center', left: -5, fontSize: 15, block: true, input_value: 2 }
    ],
    ngp: [
      { type: 'button', text: 'A', id: 'a', location: 'right', right: 75, top: 70, bold: true, input_value: 0 },
      { type: 'button', text: 'B', id: 'b', location: 'right', right: 5, top: 50, bold: true, input_value: 8 },
      DPAD,
      { type: 'button', text: 'Option', id: 'option', location: 'center', left: 30, fontSize: 15, block: true, input_value: 3 }
    ],
    // The WonderSwan has two four-way pads (X and Y) plus A, B and Start. Held flat, X is under the left
    // thumb and Y under the right. Held upright, the core turns the buttons with the screen: the left pad
    // becomes Y, and X, A and B arrive on other ids, so a second set of controls (t_*) is shown instead.
    ws: [
      { type: 'dpad', id: 'x_dpad', location: 'left', left: '50%', right: '50%', joystickInput: false, inputValues: [4, 5, 6, 7] },
      { type: 'dpad', id: 'y_dpad', location: 'right', left: '50%', right: '50%', joystickInput: false, inputValues: [13, 12, 10, 11] },
      { type: 'button', text: 'B', id: 'b', location: 'right', right: 75, top: 150, bold: true, input_value: 0 },
      { type: 'button', text: 'A', id: 'a', location: 'right', right: 5, top: 150, bold: true, input_value: 8 },
      { type: 'dpad', id: 't_dpad', location: 'right', left: '50%', right: '50%', joystickInput: false, inputValues: [9, 0, 1, 8] },
      { type: 'button', text: 'B', id: 't_b', location: 'right', right: 75, top: 150, bold: true, input_value: 11 },
      { type: 'button', text: 'A', id: 't_a', location: 'right', right: 5, top: 150, bold: true, input_value: 10 },
      { type: 'button', text: 'Start', id: 'start', location: 'center', left: 30, fontSize: 15, block: true, input_value: 3 }
    ]
  };

  function el(tag, attrs, kids) {
    var e = D.createElement(tag), k;
    for (k in attrs || {}) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function title(name) { return name.replace(/\.[^.]+$/, ''); }
  function byTitle(x, y) { return title(x).localeCompare(title(y), undefined, { sensitivity: 'base', numeric: true }) || x.localeCompare(y); }

  /* ---------- games opened from this device, kept in this browser ---------- */

  var memory = {};              // used instead when the browser refuses storage (some private windows)
  var dbReady = null;
  function db() {
    if (!dbReady) {
      dbReady = new Promise(function (ok, no) {
        if (!window.indexedDB) return no(new Error('no storage'));
        var r = indexedDB.open('pocket-arcade', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('roms'); r.result.createObjectStore('list'); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = r.onblocked = function () { no(r.error || new Error('no storage')); };
      });
    }
    return dbReady;
  }
  function store(names, mode, work) {
    return db().then(function (d) {
      return new Promise(function (ok, no) {
        var t = d.transaction(names, mode), out;
        t.oncomplete = function () { ok(out); };
        t.onerror = t.onabort = function () { no(t.error); };
        work(t, function (v) { out = v; });
      });
    });
  }
  var key = function (name) { return SYS.id + '/' + name; };
  var Mine = {
    all: function () {
      return store(['list'], 'readonly', function (t, done) {
        var q = t.objectStore('list').getAll(IDBKeyRange.bound(SYS.id + '/', SYS.id + '/￿'));
        q.onsuccess = function () { done(q.result); };
      }).catch(function () { return Object.keys(memory).map(function (n) { return memory[n].info; }); })
        .then(function (a) { return a.sort(function (x, y) { return byTitle(x.name, y.name); }); });
    },
    put: function (name, buf) {
      var info = { name: name, size: buf.byteLength, added: Date.now() };
      return store(['roms', 'list'], 'readwrite', function (t) {
        t.objectStore('roms').put(buf, key(name));
        t.objectStore('list').put(info, key(name));
      }).catch(function () { memory[name] = { info: info, data: buf }; });
    },
    get: function (name) {
      if (memory[name]) return Promise.resolve(memory[name].data);
      return store(['roms'], 'readonly', function (t, done) {
        var q = t.objectStore('roms').get(key(name));
        q.onsuccess = function () { done(q.result); };
      }).then(function (buf) { if (!buf) throw new Error('missing'); return buf; });
    },
    drop: function (name) {
      delete memory[name];
      return store(['roms', 'list'], 'readwrite', function (t) {
        t.objectStore('roms').delete(key(name));
        t.objectStore('list').delete(key(name));
      }).catch(function () {});
    }
  };

  /* ---------- games in roms/<console>/ on the site ---------- */

  // A static host cannot list a folder, so the list comes from roms/<console>/index.json when there is
  // one (tools/roms-index.sh writes it), and otherwise from the folder listing a local server shows.
  function siteGames() {
    function names(list) {
      var seen = {};
      return list.map(String).filter(function (n) { return ROM_EXT.test(n) && n.indexOf('/') < 0 && !seen[n] && (seen[n] = 1); })
        .sort(byTitle);
    }
    return fetch(ROMS + 'index.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { return names(Array.isArray(j) ? j : (j && j.files) || []); })
      .catch(function () {
        return fetch(ROMS, { cache: 'no-cache' })
          .then(function (r) { return r.ok ? r.text() : ''; })
          .then(function (html) {
            var links = new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a[href]');
            return names([].map.call(links, function (a) {
              try { return decodeURIComponent(a.getAttribute('href').split(/[?#]/)[0]); } catch (e) { return ''; }
            }));
          });
      })
      .catch(function () { return []; });
  }

  /* ---------- the page ---------- */

  var ui = {};
  function build() {
    D.body.appendChild(el('div', { id: 'library' }, [
      el('a', { class: 'back', href: ROOT, text: '‹ All consoles' }),
      el('h1', { text: SYS.name }),
      el('p', { class: 'sub', text: SYS.blurb }),
      el('label', { class: 'btn' }, [
        D.createTextNode('Open a game from this device…'),
        ui.file = el('input', { type: 'file', multiple: '', class: 'file', onchange: picked })
      ]),
      ui.note = el('p', { class: 'note', role: 'status', text: 'Files ending in ' + SYS.exts.map(function (e) { return '.' + e; }).join(' or ') + ', or a zip of one. They stay in this browser and are not uploaded.' }),
      ui.mine = el('section', { hidden: '' }, [el('h2', { text: 'On this device' }), ui.mineList = el('ul', { class: 'games' })]),
      ui.site = el('section', { hidden: '' }, [el('h2', { text: 'On this site' }), ui.siteList = el('ul', { class: 'games' })]),
      el('div', { class: 'fine', html:
        '<p>No games are included. Saves and save states are kept in this browser; clearing its site data erases them, so export the ones you care about from the menu while playing.</p>' +
        '<p>Emulation by <a href="https://emulatorjs.org/" rel="noopener">EmulatorJS</a> with the ' + SYS.coreName + ' core, both served from this site ' +
        '(<a href="' + ROOT + 'emulatorjs/README.md">licences and source</a>). ' +
        'Unofficial fan project; console names are trademarks of their owners.</p>' })
    ]));
    D.body.appendChild(ui.stage = el('div', { id: 'stage', hidden: '' }, [el('div', { id: 'game' })]));
  }
  function say(text, bad) { ui.note.textContent = text; ui.note.classList.toggle('bad', !!bad); }

  function row(from, name, bytes) {
    var li = el('li', {}, [
      el('button', { class: 'pick', type: 'button', onclick: function () { play({ from: from, name: name }, true); } }, [
        el('span', { class: 'name', text: title(name) }),
        el('span', { class: 'meta', text: name.split('.').pop().toUpperCase() + (bytes ? ' · ' + size(bytes) : '') }),
        el('span', { class: 'go', 'aria-hidden': 'true', text: '›' })
      ])
    ]);
    if (from === 'mine') {
      li.appendChild(el('button', { class: 'drop', type: 'button', 'aria-label': 'Remove ' + title(name) + ' from this device', text: '✕', onclick: function () {
        if (!window.confirm('Remove "' + title(name) + '" from this browser?\n\nIts saves are kept.')) return;
        Mine.drop(name).then(refresh);
      } }));
    }
    return li;
  }
  function refresh() {
    return Promise.all([Mine.all(), siteGames()]).then(function (r) {
      ui.mineList.textContent = ''; ui.siteList.textContent = '';
      r[0].forEach(function (g) { ui.mineList.appendChild(row('mine', g.name, g.size)); });
      r[1].forEach(function (n) { ui.siteList.appendChild(row('site', n, 0)); });
      ui.mine.hidden = !r[0].length; ui.site.hidden = !r[1].length;
    });
  }

  function picked() {
    var files = [].slice.call(ui.file.files || []);
    ui.file.value = '';
    var good = files.filter(function (f) { return ROM_EXT.test(f.name) || ZIP_EXT.test(f.name); });
    var bad = files.length - good.length;
    if (!good.length) {
      if (files.length) say('That is not a ' + SYS.name + ' game. Choose a file ending in ' + SYS.exts.map(function (e) { return '.' + e; }).join(' or ') + '.', true);
      return;
    }
    Promise.all(good.map(function (f) { return f.arrayBuffer().then(function (buf) { return Mine.put(f.name, buf); }); }))
      .then(refresh)
      .then(function () {
        if (good.length === 1 && !bad) return play({ from: 'mine', name: good[0].name }, true);
        say('Added ' + good.length + ' games.' + (bad ? ' Skipped ' + bad + ' that ' + (bad === 1 ? 'is not a ' : 'are not ') + SYS.name + ' game' + (bad === 1 ? '.' : 's.') : ''), false);
      })
      .catch(function () { say('Could not read that file.', true); });
  }

  /* ---------- playing ---------- */

  function bytesOf(game) {
    if (game.from === 'mine') return Mine.get(game.name);
    return fetch(ROMS + encodeURIComponent(game.name)).then(function (r) { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); });
  }

  // A WonderSwan cartridge says in its last bytes whether it is played with the console held upright.
  function heldUpright(buf) {
    var b = new Uint8Array(buf);
    return SYS.id === 'ws' && b.length >= 16 && b[b.length - 16] === 0xEA && (b[b.length - 4] & 1) === 1;
  }

  function script(src) {
    return new Promise(function (ok, no) { D.head.appendChild(el('script', { src: src, onload: ok, onerror: function () { no(new Error('Could not load ' + src)); } })); });
  }
  var engine = null;
  function loadEngine() {
    if (engine) return engine;
    D.head.appendChild(el('link', { rel: 'stylesheet', href: DATA + 'emulator.min.css' }));
    engine = script(DATA + 'emulator.min.js').then(function () {
      var E = window.EmulatorJS, G = window.EJS_GameManager;
      // Only ever ask this site for files: no version check, and no falling back to EmulatorJS's CDN.
      E.prototype.checkForUpdates = function () {};
      var download = E.prototype.downloadFile;
      E.prototype.downloadFile = function (path) {
        if (typeof path === 'string' && /^(https?:)?\/\//i.test(path) && path.indexOf(location.origin + '/') !== 0) return Promise.resolve(-1);
        return download.apply(this, arguments);
      };
      // Whole-number scaling only, and saves filed per console so two systems' games of one name cannot collide.
      var config = G.prototype.getRetroArchCfg;
      G.prototype.getRetroArchCfg = function () {
        return config.call(this) + 'video_scale_integer = true\nsort_savefiles_enable = true\n';
      };
    });
    return engine;
  }
  function language() {
    var want;
    try { want = Intl.DateTimeFormat().resolvedOptions().locale; } catch (e) {}
    var lang = want && LANGS.filter(function (l) { return l.split('-')[0] === String(want).split('-')[0].toLowerCase(); })[0];
    if (!lang) return Promise.resolve(null);
    return fetch(DATA + 'localization/' + lang + '.json').then(function (r) { return r.json(); })
      .then(function (json) { return { language: lang, langJson: json }; }).catch(function () { return null; });
  }

  var ejs = null, playing = null, starting = false, pushed = false, upright = false;

  function play(game, tapped) {
    if (playing || starting) return Promise.resolve();
    starting = true;
    say('Loading…', false);
    return Promise.all([bytesOf(game), loadEngine(), language()]).then(function (r) {
      var buf = r[0], lang = r[2];
      var touch = (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && matchMedia('(any-pointer: coarse)').matches);
      var defaults = { 'save-state-location': 'browser', 'save-save-interval': '30' };
      if (touch) defaults['virtual-gamepad'] = 'enabled';
      if (SYS.id === 'ws') {
        defaults.wswan_rotate_display = heldUpright(buf) ? 'portrait' : 'landscape';
        defaults.wswan_rotate_keymap = 'auto';
      }
      var config = {
        gameUrl: new File([buf], game.name),
        gameName: game.name,              // names the saved settings and the save state
        dataPath: DATA,
        system: SYS.id,
        startOnLoad: !!tapped,            // after a reload the browser wants a tap before sound may play
        defaultOptions: defaults,
        VirtualGamepadSettings: JSON.parse(JSON.stringify(PADS[SYS.id])),
        buttonOpts: { cacheManager: false, screenRecord: false, exitEmulation: false },
        backgroundColor: '#000',
        shaders: Object.assign({}, window.EJS_SHADERS)
      };
      if (lang) { config.language = lang.language; config.langJson = lang.langJson; }

      playing = game;
      if (tapped) {
        history.pushState({ play: 1 }, '', '?play=' + encodeURIComponent(game.from + ':' + game.name));
        pushed = true;
      }
      D.title = title(game.name) + ' – ' + SYS.name;
      D.body.classList.add('playing');
      ui.stage.hidden = false;

      ejs = window.EJS_emulator = new window.EmulatorJS('#game', config);
      chips();
      ejs.on('start', started);
    }).catch(function (e) {
      starting = false;
      if (!tapped) history.replaceState(null, '', location.pathname);
      say(e && e.message === 'missing' ? '"' + title(game.name) + '" is no longer here.' : 'Could not start the game. ' + (e && e.message ? e.message : ''), true);
    });
  }

  var ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var ICON_TURN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3v5h-5"/></svg>';
  function chips() {
    var root = ejs.elements.parent;
    var bar = el('div', { class: 'pa-chips' }, [
      el('button', { class: 'pa-chip', type: 'button', id: 'pa-back', html: ICON_BACK + 'Games', onclick: leave }),
      SYS.id === 'ws' ? (ui.turn = el('button', { class: 'pa-chip', type: 'button', id: 'pa-turn', hidden: '', html: ICON_TURN + 'Rotate', onclick: function () { turn(!upright); } })) : null
    ]);
    // Keep taps on these from reaching EmulatorJS's own handlers on the same element.
    ['click', 'mousedown', 'touchstart', 'touchend', 'pointerdown'].forEach(function (t) { bar.addEventListener(t, function (e) { e.stopPropagation(); }); });
    root.appendChild(bar);
  }

  function started() {
    var root = ejs.elements.parent;
    if (SYS.id === 'ws') {
      upright = ejs.getSettingValue('wswan_rotate_display') === 'portrait';
      root.classList.toggle('pa-tall', upright);
      ui.turn.hidden = false;
    }
    layout();
    window.addEventListener('resize', layout);
    if (window.ResizeObserver) new ResizeObserver(layout).observe(root);
    if (ejs.virtualGamepad && window.MutationObserver) {
      new MutationObserver(layout).observe(ejs.virtualGamepad, { attributes: true, attributeFilter: ['style'] });
    }
    // When the page closes, EmulatorJS writes the cartridge save and then unmounts the folder it lives in. The
    // write is copied to the browser's storage a moment later, by which time the folder looks empty, and the
    // stored saves are deleted instead. So its closing-down step is dropped; the save is written out here.
    ejs.functions.exit = [];
    // Phones often give no warning before closing a page, so also do it whenever the page is hidden.
    D.addEventListener('visibilitychange', function () { if (D.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', function () { flush(); });
  }

  function turn(on) {
    upright = on;
    ejs.changeSettingOption('wswan_rotate_display', on ? 'portrait' : 'landscape');   // also remembered for this game
    ejs.elements.parent.classList.toggle('pa-tall', on);
    layout();
  }

  // Draw at the screen's own pixels. EmulatorJS makes the canvas as many pixels as its CSS size, which on a
  // phone is two or three times coarser than the screen; so the canvas is given the real pixel count as its
  // CSS size and shrunk back with a transform. RetroArch then picks the largest whole-number scale that fits.
  function layout() {
    if (!ejs || !ejs.canvas || !ejs.canvas.parentNode) return;
    var root = ejs.elements.parent, box = root.getBoundingClientRect();
    if (!box.width || !box.height) return;
    var dpr = window.devicePixelRatio || 1;
    var pad = ejs.virtualGamepad, padShown = !!pad && pad.style.display !== 'none' && pad.style.opacity !== '0';
    var wide = box.width > box.height;
    var x = 0, y = TOP, w = box.width, h = box.height - TOP;
    if (padShown && wide) { x = PAD_SIDE; w -= 2 * PAD_SIDE; }
    if (padShown && !wide) h -= PAD_BELOW;
    var snap = function (v) { return Math.round(v * dpr) / dpr; };
    var s = ejs.canvas.style;
    s.left = snap(x) + 'px';
    s.top = snap(y) + 'px';
    s.width = Math.max(1, Math.floor(w * dpr)) + 'px';
    s.height = Math.max(1, Math.floor(h * dpr)) + 'px';
    s.transform = 'scale(' + (1 / dpr) + ')';
    root.classList.toggle('pa-wide', wide);
  }

  function flush(then) {
    var done = false, finish = function () { if (!done) { done = true; if (then) then(); } };
    try {
      if (ejs && ejs.started && !ejs.failedToStart && ejs.gameManager) {
        ejs.gameManager.saveSaveFiles();
        if (then) { ejs.gameManager.FS.syncfs(false, finish); setTimeout(finish, 1500); return; }
      }
    } catch (e) {}
    finish();
  }

  var leaving = false;
  function leave() {
    if (leaving) return;
    leaving = true;
    flush(function () {
      if (pushed) history.back();                     // back to the list: handled by "popstate" below
      else location.replace(location.pathname);
    });
  }
  window.addEventListener('popstate', function () { if (playing) location.reload(); });

  /* ---------- start ---------- */

  build();
  var asked = new URLSearchParams(location.search).get('play');
  refresh().then(function () {
    var m = asked && /^(mine|site):(.+)$/.exec(asked);
    if (m) play({ from: m[1], name: m[2] }, false);
  });

  window.pocketArcade = { get emulator() { return ejs; }, layout: layout, turn: turn, flush: flush, Mine: Mine, refresh: refresh };   // for tests
})();
