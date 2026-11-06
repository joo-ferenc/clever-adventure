'use strict';
// Clever Adventure – web version. Task generators and texts come from the Android app's Kotlin code (logic.js).
const API = logic.hu.feri.cleveradventure;
const APP_VERSION = '1.3.1';

// ---------------------------------------------------------------- helpers
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Timers belong to a scope; leaving a screen or a task clears them. */
class Scope {
  constructor() { this.ids = []; this.dead = false; this.cleanups = []; }
  later(ms, fn) { const id = setTimeout(() => { if (!this.dead) fn(); }, ms); this.ids.push(id); return id; }
  wait(ms) { return new Promise(res => this.later(ms, res)); }
  every(ms, fn) { const id = setInterval(() => { if (!this.dead) fn(); }, ms); this.ids.push(id); return id; }
  onEnd(fn) { this.cleanups.push(fn); }
  end() { this.dead = true; this.ids.forEach(id => { clearTimeout(id); clearInterval(id); }); this.cleanups.forEach(f => { try { f(); } catch (e) {} }); }
}

// ---------------------------------------------------------------- storage
const mem = {};
const LS = {
  get(k, d) { try { const v = localStorage.getItem('ca_' + k); return v == null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem('ca_' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { delete mem[k]; try { localStorage.removeItem('ca_' + k); } catch (e) {} },
  keys() { const out = new Set(Object.keys(mem)); try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('ca_')) out.add(k.slice(3)); } } catch (e) {} return [...out]; },
};

// The web version speaks Hungarian, German and English (Lang ordinals 0, 1, 2).
const UI_LANGS = [0, 1, 2];
function defaultLang() {
  const n = (navigator.language || 'de').toLowerCase();
  return n.startsWith('hu') ? 0 : n.startsWith('en') ? 2 : 1;
}

const AVATARS = ['🦁', '🐯', '🐻', '🐼', '🐨', '🐸', '🦊', '🐰', '🐶', '🐱', '🦄', '🐲', '🐵', '🐧', '🦉', '🐙'];
const MAX_PLAYERS = 6;

const Store = {
  get lang() { return LS.get('lang', defaultLang()); },
  set lang(v) { LS.set('lang', v); },
  get morning() { return LS.get('limit_am', 15); }, set morning(v) { LS.set('limit_am', v); },
  get afternoon() { return LS.get('limit_pm', 15); }, set afternoon(v) { LS.set('limit_pm', v); },
  get firstStart() { return LS.get('players', null) == null; },
  get players() { return LS.get('players', null) || [{ id: 1, avatar: AVATARS[0], name: '' }]; },
  savePlayers(list) { LS.set('players', list); },
  get current() { const id = LS.get('current', 1); return this.players.find(p => p.id === id) || this.players[0]; },
  select(id) { LS.set('current', id); },
  completeFirstStart(avatar, name) { this.savePlayers([{ id: 1, avatar, name: name.trim() }]); this.select(1); },
  addPlayer(avatar, name) {
    const id = Math.max(0, ...this.players.map(p => p.id)) + 1;
    this.savePlayers([...this.players, { id, avatar, name: name.trim() }]);
    return id;
  },
  deletePlayer(id) {
    if (this.players.length <= 1) return;
    LS.keys().filter(k => k.startsWith(`p${id}_`)).forEach(k => LS.del(k));
    this.savePlayers(this.players.filter(p => p.id !== id));
    if (LS.get('current', 1) === id) this.select(this.players[0].id);
  },
  k(key, id) { return `p${id ?? this.current.id}_${key}`; },
  starsOf(id) { return LS.get(this.k('stars', id), 0); },
  get stars() { return this.starsOf(); },
  addStarsTo(id, n) { LS.set(this.k('stars', id), this.starsOf(id) + n); },
  addStars(n) { this.addStarsTo(this.current.id, n); },
  stickersOf(id) { return LS.get(this.k('stickers', id), []); },
  get stickers() { return this.stickersOf(); },
  awardStickerTo(id) {
    // The same rule as in the app: the mascot after 50 stickers, the golden cup as the very last one.
    const have = this.stickersOf(id);
    const s = API.webPickSticker(have);
    if (!s) return null;
    LS.set(this.k('stickers', id), [...have, s]);
    return s;
  },
  awardSticker() { return this.awardStickerTo(this.current.id); },
  resetPlayer(id, everything) {
    LS.del(this.k('stickers', id));
    if (everything) {
      LS.del(this.k('stars', id));
      LS.keys().filter(k => k.startsWith(`p${id}_solved_`) || k.startsWith(`p${id}_level_`) || k.startsWith(`p${id}_answered_`)).forEach(k => LS.del(k));
    }
  },
  // Questions answered without a mistake, per game and difficulty: they don't come again on the next levels.
  answeredKeys(g, band) { return LS.get(this.k(`answered_${g}_${band}`), []); },
  addAnswered(g, band, key) {
    const now = this.answeredKeys(g, band);
    if (now.includes(key)) return;
    // When (almost) everything was asked, start over, so there are always new questions.
    LS.set(this.k(`answered_${g}_${band}`), now.length >= 400 ? [key] : [...now, key]);
  },
  solved(g) { return LS.get(this.k('solved_' + g), 0); },
  addSolved(g) { LS.set(this.k('solved_' + g), this.solved(g) + 1); },
  level(g) { return clamp(LS.get(this.k('level_' + g), 0), 0, game(g).maxLevel); },
  setLevel(g, v) { LS.set(this.k('level_' + g), clamp(v, 0, game(g).maxLevel)); },
  bandLevel(g, b) { return clamp(LS.get(this.k(`level_${g}_${b}`), b * 3), b * 3, b * 3 + 2); },
  setBandLevel(g, b, v) { LS.set(this.k(`level_${g}_${b}`), clamp(v, b * 3, b * 3 + 2)); },
  hasBand(g, b) { return LS.get(this.k(`level_${g}_${b}`), null) != null; },
  bestLevel(g) {
    if (!game(g).difficulty) return this.level(g);
    const played = [0, 1, 2].filter(b => this.hasBand(g, b));
    return played.length ? Math.max(...played.map(b => this.bandLevel(g, b))) : 0;
  },
  isMorning() { return new Date().getHours() < 12; },
  get limitMinutes() { return this.isMorning() ? this.morning : this.afternoon; },
  sessionKey() { const d = new Date(); return this.k(`used_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}_${this.isMorning() ? 'am' : 'pm'}`); },
  usedSeconds() { return LS.get(this.sessionKey(), 0); },
  addUsedSecond() { LS.set(this.sessionKey(), this.usedSeconds() + 1); },
  remaining() { return Math.max(0, this.limitMinutes * 60 - this.usedSeconds()); },
  resetSession() { LS.del(this.sessionKey()); },
  cleanOldTime() {
    const d = new Date(); const today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    LS.keys().filter(k => k.includes('_used_') && !k.includes(today)).forEach(k => LS.del(k));
  },
};

// ---------------------------------------------------------------- texts and data
const DATA = {};
function data() { const l = Store.lang; return DATA[l] || (DATA[l] = JSON.parse(API.webData(l))); }
function L() { return Store.lang; }
/** Text in the app language (only Hungarian, German, English in the web version). */
function T(hu, de, en) { return [hu, de, en][L()]; }
function TF(hu, de, en, ...a) { let s = T(hu, de, en); a.forEach((x, i) => { s = s.split(`{${i}}`).join(x); }); return s; }
function game(id) { return data().games.find(g => g.id === id); }
function levelLabel(n) { return data().levelLabel.replace('0', String(n)); }
const praise = () => pick(data().texts.praise);
const tryAgain = () => pick(data().texts.tryAgain);

// ---------------------------------------------------------------- pictures
// The app's own pictures instead of emojis (kepek/*.webp). An emoji without a picture simply stays an emoji.
// Every text put on the screen is checked: emojis that have a picture are replaced by it.
const PICS = (() => {
  const all = JSON.parse(API.webPics());
  const m = {};
  // Only real emojis (the mascot's id "kabala" is a word, it is drawn by stickerEl).
  for (const [e, name] of Object.entries(all)) if (PIC_FILES.has(name) && !/^[\x00-\x7f]+$/.test(e)) m[e.replace(/\uFE0F/g, '')] = name;
  return m;
})();
const PIC_RE = (() => {
  const keys = Object.keys(PICS).sort((a, b) => b.length - a.length);
  const esc = k => [...k].map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\uFE0F?') + '\uFE0F?';
  return keys.length ? new RegExp(keys.map(esc).join('|'), 'gu') : null;
})();
function picSrc(name) { return 'kepek/' + name + '.webp'; }
function picImg(name, cls) {
  return h('img', { class: 'pic' + (cls ? ' ' + cls : ''), src: picSrc(name), alt: '', draggable: 'false' });
}
/** The picture name of an emoji, or null. */
function picOf(e) { return PICS[String(e).replace(/\uFE0F/g, '')] || null; }
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'CANVAS', 'TITLE']);
function picify(root) {
  if (!PIC_RE || !root) return;
  if (root.nodeType === 3) { picText(root); return; }
  if (root.nodeType !== 1 || skipEl(root)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (skipEl(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
  });
  const list = []; while (walker.nextNode()) list.push(walker.currentNode);
  list.forEach(picText);
}
function skipEl(el) {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName) || e.namespaceURI === 'http://www.w3.org/2000/svg' || (e.classList && e.classList.contains('nopic'))) return true;
  }
  return false;
}
function picText(node) {
  const text = node.nodeValue;
  if (!text || !node.parentNode || skipEl(node.parentElement)) return;
  PIC_RE.lastIndex = 0;
  if (!PIC_RE.test(text)) return;
  PIC_RE.lastIndex = 0;
  const frag = document.createDocumentFragment();
  let last = 0, m;
  while ((m = PIC_RE.exec(text))) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    const img = picImg(PICS[m[0].replace(/\uFE0F/g, '')]);
    const em = m[0];
    img.onerror = () => img.replaceWith(em);
    frag.append(img);
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  node.replaceWith(frag);
}
function startPictures() {
  const app = document.getElementById('app');
  picify(app);
  new MutationObserver(muts => {
    for (const mu of muts) {
      if (mu.type === 'characterData') picify(mu.target);
      else mu.addedNodes.forEach(n => picify(n));
    }
  }).observe(app, { childList: true, subtree: true, characterData: true });
}
/** A sticker as an element: an emoji, or a picture for the mascot. */
function stickerEl(s, size, faded) {
  const st = { fontSize: size + 'px', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
  if (s === 'kabala') {
    const img = picImg('kabala'); img.style.height = img.style.width = size * 1.15 + 'px';
    return h('span', { class: faded ? 'shadow' : '', style: Object.assign(st, faded ? { opacity: .2 } : {}) }, img);
  }
  return h('span', { class: faded ? 'shadow' : '', style: Object.assign(st, faded ? { opacity: .2 } : {}) }, s);
}

/** The app's name: "Clever" in orange, "Adventure" in purple. */
function appTitle(size) {
  return h('div', { class: 'title nopic', style: size ? { fontSize: size + 'px' } : null },
    h('span', { style: { color: '#FF8A1F' } }, 'Clever'), ' ', h('span', { style: { color: '#7E57C2' } }, 'Adventure'));
}
/** The mascot (the star explorer), or a star while its picture is missing. */
function mascotEl(px) {
  return PIC_FILES.has('kabala') ? h('img', { src: picSrc('kabala'), alt: '', draggable: 'false', style: { height: px + 'px', width: px + 'px', objectFit: 'contain' } })
    : h('div', { style: { fontSize: px * 0.8 + 'px' } }, '⭐');
}

// ---------------------------------------------------------------- the new look (1.3)
// Three worlds of seven games each, so every row is the same length (the same as in the app).
const WORLDS = [
  { title: ['Tanulás', 'Lernen', 'Learning'], color: '#E8660A', soft: '#FFF1E3', games: ['COUNT', 'LETTERS', 'TRACE', 'SHAPES', 'ORDER', 'WORDS', 'FEELINGS'] },
  { title: ['Gondolkodás', 'Denken', 'Thinking'], color: '#7E57C2', soft: '#F1ECFA', games: ['LOGIC', 'MEMORY', 'MISSING', 'DIFF', 'PUZZLE', 'MAZE', 'STORY'] },
  { title: ['Kaland és alkotás', 'Abenteuer und Kreativität', 'Adventure and creativity'], color: '#00897B', soft: '#E3F5F2', games: ['ROBOT', 'MARBLE', 'ICECREAM', 'WASTE', 'WORLD', 'BOARD', 'COLORING'] },
];
/** A picture by name, or the emoji while the picture is missing. */
function picOrEmoji(name, emoji, px) {
  if (PIC_FILES.has(name)) { const i = picImg(name); i.style.width = i.style.height = px + 'px'; i.style.verticalAlign = 'middle'; return h('span', { class: 'nopic', style: { display: 'inline-flex' } }, i); }
  return h('span', { style: { fontSize: px * 0.8 + 'px', lineHeight: 1 } }, emoji);
}
/** A round white button with a picture. */
function picButton(name, emoji, onclick, size = 52, dim = false, label = '') {
  return h('button', { class: 'picbtn', 'aria-label': label, style: { width: size + 'px', height: size + 'px', opacity: dim ? .55 : 1 }, onclick }, picOrEmoji(name, emoji, Math.round(size * 0.62)));
}
/** The child's capsule: figure and stars; a tap changes the player. */
function playerPill(onclick) {
  return h('button', { class: 'pill2', onclick }, h('span', { class: 'pillav' }, Store.current.avatar), picOrEmoji('csillag', '⭐', 22), h('b', null, String(Store.stars)));
}
function calmChip(onclick) {
  return h('button', { class: 'calmchip', onclick }, picOrEmoji('lufi', '🎈', 26), T('Nyugi-lufi', 'Ruhe-Ballon', 'Calm balloon'));
}
/** Slim play-time bar with "x more minutes" (updates every second). */
function slimTimeBar() {
  const fill = h('div', { class: 'fill' }), txt = h('span', { class: 'tlabel' });
  const el = h('div', { class: 'slimtime live-time' }, h('div', { class: 'track' }, fill), txt);
  el.update = () => {
    const total = Store.limitMinutes * 60, rem = Store.remaining(), f = total > 0 ? clamp(rem / total, 0, 1) : 0;
    fill.style.width = f * 100 + '%'; fill.style.background = f > .5 ? '#43A047' : f > .2 ? '#FFB300' : '#E53935';
    const m = Math.ceil(rem / 60); txt.textContent = T(`még ${m} perc`, `noch ${m} Min.`, `${m} min left`);
  };
  el.update(); return el;
}
/** The thin time line at the very top of a game; orange and pulsing in the last minute. */
function topTimeLine() {
  const fill = h('div', { class: 'fill' });
  const el = h('div', { class: 'topline live-time' }, fill);
  el.update = () => {
    const total = Store.limitMinutes * 60, rem = Store.remaining(), f = total > 0 ? clamp(rem / total, 0, 1) : 0;
    fill.style.width = f * 100 + '%';
    el.classList.toggle('last', rem > 0 && rem <= 60);
  };
  el.update(); return el;
}
/** Progress of a set: stars for the solved tasks, the mascot at the current one, empty dots after it. */
function pathProgress(stars, compact) {
  const el = h('div', { class: 'path' + (compact ? ' compact' : ''), role: 'img', 'aria-label': `${stars}/5` });
  for (let i = 0; i < 5; i++) {
    if (i < stars) el.append(picOrEmoji('csillag', '⭐', compact ? 22 : 26));
    else if (i === stars) el.append(picOrEmoji('kabala', '⭐', compact ? 30 : 34));
    else el.append(h('span', { class: 'dot' }));
    if (i < 4) el.append(h('span', { class: 'link' + (i < stars ? ' on' : '') }));
  }
  return el;
}
function levelBadge(text) { return h('span', { class: 'lvl' }, text); }
/** The mascot says the task: a tap on the bubble reads it again; the speaker pulses until it is solved. */
function mascotBubble(prompt, onclick) {
  const spk = h('span', { class: 'spk' }, picOrEmoji('beszed', '🔊', 28));
  const el = h('div', { class: 'mbubble' }, picOrEmoji('kabala', '⭐', 68),
    h('button', { class: 'bubble', onclick }, h('span', { class: 'btxt' }, prompt), spk));
  el.calm = () => spk.classList.add('still');
  return el;
}
/** One game tile: its own picture (or a coloured tile with the emoji) and the name below. */
function gameTile(g, size) {
  const pic = g.pic && PIC_FILES.has(g.pic)
    ? h('img', { class: 'gpic', src: picSrc(g.pic), alt: '', draggable: 'false', style: { width: size + 'px', height: size + 'px' } })
    : h('div', { class: 'gpic center', style: { width: size + 'px', height: size + 'px', background: g.color, fontSize: size * .45 + 'px' } }, g.emoji);
  return h('button', { class: 'gtile', style: { width: size + 'px' }, onclick: () => startGame(g.id) }, pic, h('span', { class: 'gname' }, g.title));
}
/** A world: coloured card with its name and its games in a row that scrolls sideways. */
function worldSection(w, size) {
  return h('section', { class: 'world', style: { background: w.soft } },
    h('div', { class: 'wtitle' }, h('span', { class: 'wdot', style: { background: w.color } }), h('h2', { style: { color: w.color } }, w.title[L()])),
    h('div', { class: 'wrow' }, w.games.map(id => game(id)).filter(Boolean).map(g => gameTile(g, size))));
}
function exitButton(onclick) {
  return h('button', { class: 'exitbtn', onclick }, picOrEmoji('kilepes', '🚪', 30), T('Kilépés', 'Beenden', 'Exit'));
}

// ---------------------------------------------------------------- speech
const Speech = {
  voices: [],
  init() {
    if (!this.supported()) return;
    const load = () => { this.voices = speechSynthesis.getVoices(); };
    load();
    speechSynthesis.onvoiceschanged = load;
  },
  tag(l) { return (data().langs[l] || data().langs[1]).tts; },
  voice(l) {
    const tag = this.tag(l).toLowerCase(); const base = tag.split('-')[0];
    const vs = this.voices;
    return vs.find(v => v.lang.toLowerCase().replace('_', '-') === tag && /premium|enhanced|siri/i.test(v.name))
      || vs.find(v => v.lang.toLowerCase().replace('_', '-') === tag)
      || vs.find(v => v.lang.toLowerCase().startsWith(base)) || null;
  },
  has(l) { return !!this.voice(l); },
  supported() { try { return !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function'; } catch (e) { return false; } },
  sayParts(parts, opts = {}) {
    if (!this.supported() || !parts.length) return;
    // Safari can drop an utterance queued right after cancel(), so wait a moment when something was playing.
    const busy = speechSynthesis.speaking || speechSynthesis.pending;
    speechSynthesis.cancel();
    const token = ++this.token;
    if (busy) setTimeout(() => { if (token === this.token) this.speakNow(parts, opts); }, 80);
    else this.speakNow(parts, opts);
  },
  token: 0,
  speakNow(parts, opts) {
    for (const [text, l] of parts) {
      if (!text) continue;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = this.tag(l); const v = this.voice(l); if (v) u.voice = v;
      u.rate = opts.rate || 0.9; u.pitch = opts.pitch || 1.1;
      speechSynthesis.speak(u);
    }
  },
  say(text, l = L()) { this.sayParts([[text, l]]); },
  calm(text, l = L()) { this.sayParts([[text, l]], { rate: 0.7, pitch: 1.0 }); },
  stop() { this.token++; if (this.supported()) try { speechSynthesis.cancel(); } catch (e) {} },
};

// ---------------------------------------------------------------- navigation
let current = { name: null, scope: new Scope() };
const app = () => document.getElementById('app');
/** counts: does play time run on this screen? */
function go(name, render, opts = {}) {
  current.scope.end();
  Speech.stop();
  const scope = new Scope();
  current = { name, scope, counts: !!opts.counts, exempt: !!opts.exempt, render, opts };
  const root = app(); root.innerHTML = '';
  render(root, scope);
}

// Turning the phone: screens without a running game are simply drawn again in the new shape.
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (['home', 'album'].includes(current.name)) go(current.name, current.render, current.opts);
  }, 250);
});

// ---------------------------------------------------------------- shared widgets
function roundBtn(e, onclick, extra) { return h('button', { class: 'roundbtn' + (extra ? ' ' + extra : ''), onclick }, e); }
function bigBtn(text, color, onclick, style) { return h('button', { class: 'bigbtn', style: Object.assign({ background: color }, style || {}), onclick }, text); }
function starsRow(n, size) {
  return h('div', { class: 'stars', style: size ? { fontSize: size + 'px' } : null },
    [1, 2, 3, 4, 5].map(i => h('span', { class: i <= n ? '' : 'off' }, '⭐')));
}
function timeBar() {
  const fill = h('div', { class: 'fill' });
  const el = h('div', { class: 'timebar' }, h('span', null, '⏳'), h('div', { class: 'track' }, fill));
  el.update = () => {
    const total = Store.limitMinutes * 60; const f = total > 0 ? clamp(Store.remaining() / total, 0, 1) : 0;
    fill.style.width = (f * 100) + '%';
    fill.style.background = f > 0.5 ? '#43A047' : f > 0.2 ? '#FFB300' : '#E53935';
  };
  el.classList.add('live-time'); el.update();
  return el;
}
function noTimeBadge(big) {
  return h('div', { class: 'notime', style: big ? { fontSize: '17px', padding: '10px' } : null },
    '⏳🚫 ' + T('Ebben a játékban nem fogy a játékidő.', 'In diesem Spiel läuft die Spielzeit nicht ab.', 'Play time does not run in this game.'));
}
function calmButton(onclick) {
  return h('div', { class: 'calmbtn', onclick }, h('span', { style: { fontSize: '32px' } }, '🎈'), T('Nyugi-lufi', 'Ruhe-Ballon', 'Calm balloon'));
}
function dialog(root, title, body, buttons) {
  const ov = h('div', { class: 'overlay' },
    h('div', { class: 'dialog' }, h('div', { class: 'dt' }, title), body ? h('div', null, body) : null,
      h('div', { class: 'db' }, buttons.map(([label, fn, color]) => h('button', {
        class: 'textbtn', style: color ? { color } : null, onclick: () => { ov.remove(); fn && fn(); }
      }, label)))));
  root.append(ov);
  return ov;
}

/** An item (card content) as DOM. */
function itemEl(it) {
  switch (it.t) {
    case 'emoji': return h('div', { class: 'item' + (it.label ? ' lbl' : '') }, h('span', { class: 'em' }, it.e), it.label ? h('span', { class: 'lb' }, it.label) : null);
    case 'num': return h('div', { class: 'item' }, h('span', { class: 'num' }, it.n));
    case 'letter': return h('div', { class: 'item' }, h('span', { class: 'let' }, it.c));
    case 'shape': { const d = h('div', { class: 'item' }); d.innerHTML = shapeSvg(it.kind, it.color); return d; }
    case 'group': {
      const rows = []; for (let i = 0; i < it.n; i += 3) rows.push(it.e.repeat(Math.min(3, it.n - i)));
      return h('div', { class: 'item grp' }, rows.map(r => h('div', null, r)));
    }
    case 'shadow': return h('div', { class: 'item' }, h('span', { class: 'em shadow' }, it.e));
    default: return h('div', { class: 'item' }, h('span', { class: 'q' }, '?'));
  }
}
function shapeSvg(kind, color) {
  const s = 100; let d;
  if (kind === 'CIRCLE') return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="${color}"/></svg>`;
  if (kind === 'SQUARE') return `<svg viewBox="0 0 100 100"><rect x="12" y="12" width="76" height="76" fill="${color}"/></svg>`;
  if (kind === 'TRIANGLE') d = 'M50 8 L95 88 L5 88 Z';
  if (kind === 'STAR') {
    d = ''; for (let i = 0; i < 10; i++) { const r = i % 2 ? 48 * 0.45 : 48; const a = (-90 + 36 * i) * Math.PI / 180; d += (i ? 'L' : 'M') + (50 + r * Math.cos(a)).toFixed(1) + ' ' + (53 + r * Math.sin(a)).toFixed(1); } d += 'Z';
  }
  if (kind === 'HEART') d = 'M50 90 C10 62 -2 30 25 16 C38 10 48 18 50 30 C52 18 62 10 75 16 C102 30 90 62 50 90 Z';
  return `<svg viewBox="0 0 ${s} ${s}"><path d="${d}" fill="${color}"/></svg>`;
}

// ---------------------------------------------------------------- play-time clock
function startClock() {
  setInterval(() => {
    if (document.hidden) return;
    if (current.counts && Store.remaining() > 0) {
      Store.addUsedSecond();
      if (Store.remaining() === 60) Speech.say(data().texts.oneMinute);
      if (Store.remaining() === 0) { showTimeUp(); return; }
    }
    document.querySelectorAll('.live-time').forEach(el => el.update());
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) Speech.stop(); });
}
