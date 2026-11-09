'use strict';
// Card games: quiz, memory, what's missing, spot the difference, small to big, puzzle, copy the face, coloring.

function shakeEl(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

function choicesEl(items, onTap) {
  const n = items.length;
  const cols = n === 4 ? 2 : n;
  const ratio = n === 4 ? 1.3 : n === 2 ? 0.8 : 0.9;
  const grid = h('div', { class: 'choices', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
  const cards = items.map((it, i) => {
    const c = h('div', { class: 'choice', style: { aspectRatio: String(ratio) }, onclick: () => onTap(i, c) }, itemEl(it));
    grid.append(c); return c;
  });
  grid.cards = cards;
  return grid;
}

function displayEl(d) {
  const wrap = h('div', { class: 'col' });
  const emGrid = (e, n, perRow, size, crossFrom) => {
    const g = h('div', { class: 'emgrid', style: { gridTemplateColumns: `repeat(${Math.min(perRow, n)}, auto)`, fontSize: size + 'px' } });
    for (let i = 0; i < n; i++) {
      const gone = crossFrom != null && i >= crossFrom;
      g.append(h('span', { style: { position: 'relative', opacity: gone ? .35 : 1 } }, e,
        gone ? h('span', { style: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontSize: '.7em', opacity: 1 } }, '❌') : null));
    }
    return g;
  };
  switch (d.t) {
    case 'group': return emGrid(d.e, d.n, 5, d.n > 10 ? 34 : 44);
    case 'minus': return emGrid(d.e, d.a, 5, 38, d.a - d.b);
    case 'sum': return h('div', { class: 'row' }, emGrid(d.e, d.a, 3, 32), h('span', { style: { fontSize: '46px', fontWeight: 900 } }, '+'), emGrid(d.e, d.b, 3, 32));
    case 'ten': {
      const g = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 50px)', gap: '6px' } });
      for (let i = 0; i < 10; i++) g.append(h('div', { class: 'center', style: { height: '50px', borderRadius: '10px', background: i < d.have ? '#fff' : '#0002', border: '2px solid #7E57C280', fontSize: '30px' } }, i < d.have ? d.e : ''));
      return g;
    }
    case 'big': return h('div', { class: 'bigbox' }, itemEl(d.item));
    case 'seq': {
      const g = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, d.items.length)}, 62px)`, gap: '8px' } });
      d.items.forEach(it => g.append(h('div', { class: 'seqbox' + (it.t === 'q' ? ' qq' : '') }, itemEl(it))));
      return g;
    }
    default: return wrap;
  }
}

GAME_UIS.quiz = (r, ctx, area) => {
  let done = false;
  const top = h('div', { class: 'display', style: { flex: 1, minHeight: 0 }, onclick: () => ctx.repeatPrompt() }, displayEl(r.display));
  const ch = choicesEl(r.choices, (i, card) => {
    if (done || card.classList.contains('bad')) return;
    if (i === r.correct) { done = true; card.classList.add('ok'); ctx.done(r.spoken[i], r.spokenLang); }
    else { card.classList.add('bad'); shakeEl(card); ctx.wrong(r.spoken[i], r.spokenLang); }
  });
  // Four cards on a short screen: keep them from pushing the picture away.
  if (area.clientHeight < 520) ch.style.maxWidth = Math.max(260, area.clientHeight * 0.75) + 'px';
  ch.style.margin = '0 auto'; ch.style.width = '100%';
  area.style.display = 'flex'; area.style.flexDirection = 'column';
  area.append(top, ch);
  // Every picture the same size: if the group is wider than its place, all of them get smaller together.
  requestAnimationFrame(() => {
    top.querySelectorAll('.emgrid').forEach(g => {
      let fs = parseFloat(g.style.fontSize) || 40;
      const room = () => top.clientWidth * 0.94;
      const width = () => [...top.children].reduce((w, c) => Math.max(w, c.scrollWidth), 0);
      for (let i = 0; i < 20 && width() > room() && fs > 16; i++) { fs *= 0.9; top.querySelectorAll('.emgrid').forEach(x => x.style.fontSize = fs + 'px'); }
    });
  });
};

// ---------------------------------------------------------------- memory
GAME_UIS.memory = (r, ctx, area, scope) => {
  const cards = shuffle(r.words.flatMap(w => Array(r.size).fill(w)));
  let open = [], matched = new Set(), busy = false;
  const cols = r.cols, rows = Math.ceil(cards.length / cols);
  const gap = cards.length > 12 ? 6 : 10;
  const W = area.clientWidth, H = area.clientHeight;
  const cw = Math.min((W - gap * (cols - 1)) / cols, (H - gap * (rows - 1)) / rows * 0.85);
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${cols}, ${cw}px)`, gap: gap + 'px', justifyContent: 'center', alignContent: 'center', height: '100%' } });
  const els = cards.map((w, i) => {
    const el = h('div', { class: 'center', style: { width: cw + 'px', height: cw / 0.85 + 'px', borderRadius: '16px', background: '#7E57C2', boxShadow: '0 3px 6px #0003', fontSize: cw * 0.38 + 'px', border: '4px solid transparent', cursor: 'pointer', transition: 'transform .3s' }, onclick: () => tap(i) }, '⭐');
    grid.append(el); return el;
  });
  const draw = () => {
    const partial = r.size === 3 && open.length === 2 && cards[open[0]] === cards[open[1]];
    els.forEach((el, i) => {
      const up = open.includes(i) || matched.has(i);
      el.textContent = up ? cards[i].e : '⭐';
      el.style.background = up ? '#fff' : '#7E57C2';
      el.style.fontSize = (up ? cw * 0.6 : cw * 0.38) + 'px';
      el.style.borderColor = matched.has(i) ? '#43A047' : partial && open.includes(i) ? '#FFCA28' : 'transparent';
    });
  };
  const tap = i => {
    if (busy || matched.has(i) || open.includes(i)) return;
    const w = cards[i]; const now = [...open, i];
    els[i].style.transform = 'rotateY(180deg)'; scope.later(10, () => { els[i].style.transform = ''; });
    if (!now.every(j => cards[j] === w)) {
      open = now; ctx.say(w.text); busy = true; draw();
      scope.later(1100, () => { open = []; busy = false; draw(); });
    } else if (now.length === r.size) {
      now.forEach(j => matched.add(j)); open = [];
      if (matched.size === cards.length) ctx.done(w.text); else ctx.say(w.text);
      draw();
    } else { open = now; ctx.say(w.text); draw(); }
  };
  area.append(grid);
};

// ---------------------------------------------------------------- what's missing
function emojiTiles(list, tile) {
  const g = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, list.length)}, ${tile}px)`, gap: '10px', justifyContent: 'center' } });
  list.forEach(e => g.append(h('div', { class: 'center', style: { height: tile + 'px', borderRadius: '18px', background: e == null ? '#FFF59D' : '#fff', boxShadow: '0 3px 6px #0002', fontSize: tile * 0.62 + 'px', fontWeight: 900, color: '#7E57C2' } }, e == null ? '?' : e)));
  return g;
}
GAME_UIS.missing = async (r, ctx, area, scope) => {
  area.style.display = 'flex'; area.style.flexDirection = 'column';
  const top = h('div', { class: 'center', style: { flex: 1, minHeight: 0 } });
  const bottom = h('div');
  area.append(top, bottom);
  const tile = r.items.length > 6 ? 72 : 82;
  const answers = new Set(r.missing.map(i => r.items[i]));
  const found = new Set();
  const drawTop = phase => {
    top.innerHTML = '';
    if (phase === 0) top.append(emojiTiles(r.items, tile));
    else if (phase === 1) top.append(h('div', { style: { fontSize: '110px' } }, '🙈'));
    else top.append(emojiTiles(r.items.map((e, i) => (r.missing.includes(i) && !found.has(e) ? null : e)), tile));
  };
  drawTop(0);
  ctx.say(r.intro);
  await scope.wait(r.viewMs);
  drawTop(1);
  await scope.wait(1200);
  drawTop(2);
  ctx.say(r.prompt);
  const ch = choicesEl(r.choices.map(e => ({ t: 'emoji', e })), (i, card) => {
    if (found.size === answers.size || card.classList.contains('ok') || card.classList.contains('bad')) return;
    const e = r.choices[i];
    if (answers.has(e)) {
      card.classList.add('ok'); found.add(e); drawTop(2);
      if (found.size === answers.size) ctx.done(); else ctx.say(praise());
    } else { card.classList.add('bad'); shakeEl(card); ctx.wrong(); }
  });
  if (area.clientHeight < 520) { ch.style.maxWidth = Math.max(260, area.clientHeight * 0.7) + 'px'; ch.style.margin = '0 auto'; }
  bottom.append(ch);
};

// ---------------------------------------------------------------- spot the difference
GAME_UIS.diff = (r, ctx, area) => {
  const rows = r.a.length / r.cols;
  const found = new Set(), wrong = new Set();
  const cell = Math.min((area.clientWidth - 24) / r.cols, (area.clientHeight - 40) / 2 / rows) * 0.95;
  const grids = [];
  const tap = i => {
    if (found.size === r.diffs.length || found.has(i) || wrong.has(i)) return;
    if (r.diffs.includes(i)) { found.add(i); if (found.size === r.diffs.length) ctx.done(); else ctx.say(praise()); }
    else { wrong.add(i); ctx.wrong(); }
    grids.forEach(g => g.cells.forEach((c, j) => { c.style.background = found.has(j) ? '#C8E6C9' : wrong.has(j) ? '#FFCDD2' : 'transparent'; }));
  };
  const make = items => {
    const g = h('div', { class: 'card', style: { display: 'grid', gridTemplateColumns: `repeat(${r.cols}, ${cell}px)`, padding: '6px' } });
    g.cells = items.map((e, i) => { const c = h('div', { class: 'center', style: { height: cell + 'px', borderRadius: '10px', fontSize: cell * 0.66 + 'px', cursor: 'pointer' }, onclick: () => tap(i) }, e); g.append(c); return c; });
    grids.push(g); return g;
  };
  area.append(h('div', { class: 'center', style: { flexDirection: 'column', gap: '14px', height: '100%' } }, make(r.a), make(r.b)));
};

// ---------------------------------------------------------------- small to big
GAME_UIS.order = (r, ctx, area) => {
  const n = r.ranks.length;
  let next = 0;
  const factors = r.ranks.map(k => 1 + k * r.step);
  const perRow = n > 6 ? Math.ceil(n / 2) : n;
  const rowsPos = []; for (let i = 0; i < n; i += perRow) rowsPos.push([...Array(Math.min(perRow, n - i)).keys()].map(k => k + i));
  const widest = Math.max(...rowsPos.map(rp => rp.reduce((s, p) => s + factors[p], 0)));
  const unit = Math.min((area.clientWidth - 10 * perRow) / widest * 0.85, 64);
  const wrap = h('div', { class: 'center', style: { flexDirection: 'column', gap: '16px', height: '100%' } });
  rowsPos.forEach(rp => {
    const row = h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '10px' } });
    rp.forEach(pos => {
      const badge = h('div', { class: 'center', style: { width: '32px', height: '32px', borderRadius: '50%', color: '#fff', fontWeight: 800, fontSize: '19px' } }, '');
      const col = h('div', { class: 'col', style: { gap: '4px', cursor: 'pointer' } }, badge, h('div', { style: { fontSize: unit * factors[pos] + 'px', lineHeight: 1.15 } }, r.e));
      col.onclick = () => {
        if (badge.textContent || next >= n) return;
        if (r.ranks[pos] === next) {
          next++; badge.textContent = next; badge.style.background = '#43A047';
          if (next === n) ctx.done(String(n)); else ctx.say(String(next));
        } else { shakeEl(col); ctx.wrong(); }
      };
      row.append(col);
    });
    wrap.append(row);
  });
  area.append(wrap);
};

// ---------------------------------------------------------------- puzzle
function puzzlePicture(r, size) {
  const pic = h('div', { style: { position: 'relative', width: size + 'px', height: size + 'px', background: r.scene.length ? `linear-gradient(135deg, #B3E5FC, #FFF59D, ${r.bg})` : `linear-gradient(#B3E5FC, ${r.bg})`, overflow: 'hidden' } });
  if (!r.scene.length) pic.append(h('div', { class: 'center', style: { position: 'absolute', inset: 0, fontSize: size * 0.68 + 'px', lineHeight: 1 } }, r.e));
  else {
    const k = r.k, piece = size / k, es = piece * r.sceneScale;
    r.scene.forEach((e, i) => {
      const cx = piece * (i % (k - 1) + 1), cy = piece * (Math.floor(i / (k - 1)) + 1);
      pic.append(h('div', { class: 'center', style: { position: 'absolute', left: cx - es / 2 + 'px', top: cy - es / 2 + 'px', width: es + 'px', height: es + 'px', fontSize: es * 0.75 + 'px', lineHeight: 1 } }, e));
    });
  }
  return pic;
}
GAME_UIS.puzzle = (r, ctx, area) => {
  const k = r.k, n = k * k;
  let order; do { order = shuffle([...Array(n).keys()]); } while (order.every((v, i) => v === i));
  let sel = null, solved = false;
  const preview = r.scene.length ? 110 : 70;
  const W = area.clientWidth, H = area.clientHeight - preview - 14;
  const side = Math.min(W, H) * 0.96, gap = 4;
  const t = (side - gap * (k - 1)) / k, picture = t * k;
  const board = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${k}, ${t}px)`, gap: gap + 'px', transition: 'gap .3s' } });
  const draw = () => {
    board.innerHTML = '';
    order.forEach((tile, pos) => {
      const rr = Math.floor(tile / k), cc = tile % k;
      const pic = puzzlePicture(r, picture);
      pic.style.position = 'absolute'; pic.style.left = -t * cc + 'px'; pic.style.top = -t * rr + 'px';
      board.append(h('div', {
        style: { width: t + 'px', height: t + 'px', position: 'relative', overflow: 'hidden', borderRadius: solved ? '0' : '8px', outline: sel === pos ? '5px solid #FFEB3B' : 'none', outlineOffset: '-5px', cursor: 'pointer' },
        onclick: () => tap(pos)
      }, pic));
    });
    board.style.gap = solved ? '0' : gap + 'px';
  };
  const tap = pos => {
    if (solved) return;
    if (sel == null) sel = pos; else if (sel === pos) sel = null;
    else { [order[sel], order[pos]] = [order[pos], order[sel]]; sel = null; ctx.touch(); if (order.every((v, i) => v === i)) { solved = true; ctx.done(); } }
    draw();
  };
  draw();
  const prev = puzzlePicture(r, preview); prev.style.borderRadius = '14px';
  area.append(h('div', { class: 'col', style: { height: '100%', gap: '12px' } }, prev, h('div', { class: 'center', style: { flex: 1, minHeight: 0 } }, board)));
};

// ---------------------------------------------------------------- copy the face
GAME_UIS.mimic = (r, ctx, area, scope) => {
  let ready = false, done = false;
  const btn = h('div', { class: 'center', style: { width: '116px', height: '116px', borderRadius: '50%', background: '#0002', fontSize: '58px', cursor: 'pointer', transition: 'background .3s' }, onclick: () => { if (ready && !done) { done = true; ctx.done(); } } }, '✅');
  scope.later(2500, () => { ready = true; btn.style.background = '#43A047'; btn.style.boxShadow = '0 6px 14px #0003'; });
  area.append(h('div', { class: 'center', style: { flexDirection: 'column', justifyContent: 'space-evenly', height: '100%' } },
    h('div', { style: { fontSize: '140px', animation: 'pulse 1.4s infinite' } }, r.e),
    h('div', { class: 'title', style: { fontSize: '30px' } }, r.label), btn));
};

// ---------------------------------------------------------------- coloring
const PICTURES = (() => {
  const R = (l, t, r, b) => ['rect', l, t, r, b], O = (l, t, r, b) => ['oval', l, t, r, b], C = (x, y, r) => ['circle', x, y, r], P = (...p) => ['poly', ...p];
  return [
    [R(0, 0, 1, .75), R(0, .75, 1, 1), C(.85, .15, .09), R(.2, .44, .7, .8), P(.12, .45, .45, .18, .78, .45), R(.39, .6, .51, .8), R(.25, .52, .34, .61), R(.57, .52, .66, .61)],
    [R(0, 0, 1, 1), P(.72, .5, .95, .3, .95, .7), P(.4, .33, .5, .17, .62, .34), O(.12, .3, .78, .7), C(.3, .45, .045), C(.15, .17, .045), C(.25, .07, .03)],
    [R(0, 0, 1, 1), R(.47, .48, .53, .96), O(.53, .64, .78, .75), O(.22, .72, .47, .83), C(.5, .2, .1), C(.64, .31, .1), C(.58, .47, .1), C(.42, .47, .1), C(.36, .31, .1), C(.5, .35, .08)],
    [R(0, 0, 1, .72), R(0, .72, 1, 1), P(.25, .46, .33, .28, .66, .28, .76, .46), R(.08, .45, .92, .68), P(.36, .44, .4, .32, .6, .32, .65, .44), C(.28, .69, .08), C(.72, .69, .08), C(.88, .52, .025)],
    [R(0, 0, 1, 1), O(.08, .15, .48, .5), O(.52, .15, .92, .5), O(.15, .48, .48, .82), O(.52, .48, .85, .82), C(.28, .33, .06), C(.72, .33, .06), O(.46, .2, .54, .85), C(.5, .17, .06)],
    [R(0, 0, 1, 1), C(.18, .2, .035), C(.82, .15, .035), C(.85, .75, .07), P(.4, .55, .27, .8, .4, .75), P(.6, .55, .73, .8, .6, .75), P(.43, .74, .57, .74, .5, .94), P(.4, .75, .4, .35, .5, .1, .6, .35, .6, .75), C(.5, .42, .06)],
    [R(0, 0, 1, .8), R(0, .8, 1, 1), C(.12, .12, .07), C(.5, .7, .2), C(.5, .43, .15), C(.5, .22, .11), R(.41, .02, .59, .12), R(.35, .11, .65, .14), P(.5, .21, .63, .24, .5, .27), C(.5, .4, .022), C(.5, .48, .022)],
    [R(0, 0, 1, 1), P(.34, .5, .66, .5, .5, .95), C(.5, .42, .17), C(.5, .22, .13), C(.5, .07, .05)],
    [R(0, 0, 1, .65), R(0, .65, 1, 1), C(.85, .15, .08), O(.06, .1, .34, .22), R(.49, .15, .52, .62), P(.48, .18, .48, .58, .22, .58), P(.53, .22, .53, .58, .76, .58), P(.15, .62, .85, .62, .72, .78, .28, .78), O(.2, .84, .36, .92)],
    [R(0, 0, 1, 1), P(.22, .38, .27, .08, .47, .25), P(.78, .38, .73, .08, .53, .25), O(.18, .2, .82, .84), O(.32, .4, .44, .53), O(.56, .4, .68, .53), P(.45, .59, .55, .59, .5, .65), P(.38, .76, .5, .71, .62, .76, .5, .81)],
    [R(0, 0, 1, .8), R(0, .8, 1, 1), O(.7, .05, .96, .16), R(.44, .5, .56, .86), C(.5, .35, .28), C(.38, .28, .045), C(.61, .24, .045), C(.57, .46, .045), C(.36, .47, .045)],
    [R(0, 0, 1, 1), P(.3, .27, .31, .08, .44, .22), P(.7, .27, .69, .08, .56, .22), O(.24, .18, .76, .88), O(.35, .46, .65, .85), O(.37, .86, .46, .93), O(.54, .86, .63, .93), C(.4, .37, .09), C(.6, .37, .09), C(.41, .38, .04), C(.59, .38, .04), P(.46, .49, .54, .49, .5, .57)],
    [R(0, 0, 1, .86), R(0, .86, 1, 1), P(.21, .12, .21, .02, .31, .06), P(.79, .12, .79, .02, .89, .06), R(.12, .3, .3, .86), R(.7, .3, .88, .86), R(.3, .46, .7, .86), P(.09, .3, .21, .12, .33, .3), P(.67, .3, .79, .12, .91, .3), R(.43, .63, .57, .86), R(.18, .42, .24, .51), R(.76, .42, .82, .51)],
  ];
})();
function regionPath(reg, s) {
  const [k, ...v] = reg; const p = new Path2D();
  if (k === 'rect') p.rect(v[0] * s, v[1] * s, (v[2] - v[0]) * s, (v[3] - v[1]) * s);
  else if (k === 'oval') p.ellipse((v[0] + v[2]) / 2 * s, (v[1] + v[3]) / 2 * s, (v[2] - v[0]) / 2 * s, (v[3] - v[1]) / 2 * s, 0, 0, Math.PI * 2);
  else if (k === 'circle') p.arc(v[0] * s, v[1] * s, v[2] * s, 0, Math.PI * 2);
  else { p.moveTo(v[0] * s, v[1] * s); for (let i = 2; i < v.length; i += 2) p.lineTo(v[i] * s, v[i + 1] * s); p.closePath(); }
  return p;
}
GAME_UIS.color = (r, ctx, area) => {
  const regs = PICTURES[r.picture % PICTURES.length];
  const fills = regs.map(() => null);
  const pal = data().palette;
  let selected = 0, finished = false;
  const palH = 2 * (Math.min(area.clientWidth, 600) / 8) + 20;
  const side = Math.min(area.clientWidth, area.clientHeight - palH - 10);
  const dpr = window.devicePixelRatio || 1;
  const cv = h('canvas', { width: side * dpr, height: side * dpr, style: { width: side + 'px', height: side + 'px', borderRadius: '16px', background: '#fff', boxShadow: '0 4px 10px #0002' } });
  const g = cv.getContext('2d');
  const paths = regs.map(rg => regionPath(rg, side * dpr));
  const draw = () => {
    g.clearRect(0, 0, cv.width, cv.height); g.lineWidth = 3 * dpr; g.strokeStyle = '#263238'; g.lineJoin = 'round';
    paths.forEach((p, i) => { g.fillStyle = fills[i] || '#fff'; g.fill(p); g.stroke(p); });
  };
  draw();
  cv.addEventListener('click', e => {
    if (finished) return;
    const b = cv.getBoundingClientRect(); const x = (e.clientX - b.left) * dpr, y = (e.clientY - b.top) * dpr;
    for (let i = paths.length - 1; i >= 0; i--) if (g.isPointInPath(paths[i], x, y)) {
      fills[i] = pal[selected].color; draw(); ctx.touch();
      if (fills.every(f => f)) { finished = true; ctx.done(); }
      return;
    }
  });
  const palEl = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', width: '100%', maxWidth: '600px' } });
  const dots = pal.map((p, i) => {
    const d = h('div', { style: { aspectRatio: '1', borderRadius: '50%', background: p.color, border: '1px solid #0004', cursor: 'pointer', transition: 'transform .15s' }, onclick: () => { selected = i; mark(); ctx.say(p.name); } });
    palEl.append(d); return d;
  });
  const mark = () => dots.forEach((d, i) => { d.style.transform = i === selected ? 'scale(1.15)' : ''; d.style.border = i === selected ? '4px solid #7E57C2' : '1px solid #0004'; });
  mark();
  area.append(h('div', { class: 'col', style: { height: '100%', justifyContent: 'center' } }, cv, palEl));
};
