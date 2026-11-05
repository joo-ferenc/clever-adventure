'use strict';
// Marble run ("Golyópálya"): the same puzzles and physics as the app (logic.js), drawn on a canvas.
// Pieces are missing from a track. The child drags them from the tray onto the board (a tap on a placed piece turns it
// around), then presses ▶ and the marble rolls. Marble in the basket = solved. Off the track: 🙈, the pieces stay,
// and after two tries the next missing piece is shown blinking.

const MB = JSON.parse(API.webMarbleConst());
const MDEFS = JSON.parse(API.webMarbleDefs());
const M_COLORS = { board: '#FFF8E7', rail: '#8D6E63', railDark: '#5D4037', tramp: '#43A047', start: '#F8BBD0', basket: '#FFE082', basketLine: '#F57C00', marble: '#E53935' };
// The app's pictures of the pieces (drawn instead of the lines when they exist).
const M_PIC_NAMES = { goal: 'golyo_kosar', start: 'golyo_rajt', tramp: 'golyo_trambulin', pin: 'golyo_pocok', wall: 'golyo_fal' };
const M_PICS = {};
for (const [t, n] of Object.entries(M_PIC_NAMES)) {
  if (!PIC_FILES.has(n)) continue;
  const img = new Image(); img.src = picSrc(n); M_PICS[t] = img;
}
/** How far above the start rail's line the groove of golyo_rajt lies (board units, 45 = one cell). */
const START_GROOVE = 4.2;
/** Where the basket's front rim starts in golyo_kosar (share of the picture's height from the top). */
const BASKET_FRONT_TOP = 0.46;

function mCells(p) {
  const d = MDEFS[p.t], out = [];
  for (let i = 0; i < d.w; i++) for (let j = 0; j < d.h; j++) out.push((p.c + i) + ',' + (p.r + j));
  return out;
}
const mPicReady = t => { const im = M_PICS[t]; return im && im.complete && im.naturalWidth > 0 ? im : null; };

/** Draws one piece; s = pixels per board unit. */
function drawMPiece(g, p, s, alpha = 1) {
  const d = MDEFS[p.t], C = MB.C;
  g.save(); g.globalAlpha = alpha;
  const img = mPicReady(p.t);
  if (img && p.t === 'pin') {
    // the peg is a small bumper in the middle of its cell, drawn at its real size
    const cell = C * s, sz = 2 * 6.5 / 45 * cell;
    g.drawImage(img, (p.c + .5) * cell - sz / 2, (p.r + .5) * cell - sz / 2, sz, sz);
    g.restore(); return;
  }
  if (img) {
    const bw = d.w * C * s, bh = d.h * C * s, k = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
    const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
    const left = p.c * C * s + (bw - iw) / 2, top = p.r * C * s + (bh - ih);
    if (p.m === -1) { g.translate(left + iw / 2, 0); g.scale(-1, 1); g.translate(-(left + iw / 2), 0); }
    g.drawImage(img, left, top, iw, ih);
    g.restore(); return;
  }
  const x = lx => (p.c + (p.m === -1 ? d.w - lx : lx)) * C * s, y = ly => (p.r + ly) * C * s;
  g.lineCap = 'round';
  if (p.t === 'start') {
    g.fillStyle = M_COLORS.start; roundRect(g, Math.min(x(0), x(1)) + 1.5 * s, y(.04), C * s - 3 * s, C * .86 * s, 8 * s); g.fill();
  } else if (p.t === 'goal') {
    g.fillStyle = M_COLORS.basket; g.globalAlpha = .8 * alpha;
    g.beginPath(); g.moveTo(x(.08), y(.12)); g.lineTo(x(.2), y(.95)); g.lineTo(x(1.8), y(.95)); g.lineTo(x(1.92), y(.12)); g.closePath(); g.fill();
    g.globalAlpha = alpha;
  }
  for (const [x1, y1, x2, y2, kind] of d.segs) {
    if (kind === 'pin') {
      g.fillStyle = '#78909C'; g.beginPath(); g.arc(x(x1), y(y1), 6 * s, 0, 7); g.fill();
      g.strokeStyle = '#455A64'; g.lineWidth = 1.5 * s; g.stroke();
    } else if (kind === 'tramp') {
      g.strokeStyle = '#90A4AE'; g.lineWidth = 2.5 * s;
      line(g, x(.2), y(.69), x(.2), y(.98)); line(g, x(.8), y(.82), x(.8), y(.98));
      g.strokeStyle = M_COLORS.tramp; g.lineWidth = 7 * s; line(g, x(x1), y(y1), x(x2), y(y2));
    } else {
      const col = p.t === 'goal' ? M_COLORS.basketLine : p.t === 'wall' ? '#78909C' : M_COLORS.rail, w = p.t === 'wall' ? 7 : 6;
      g.strokeStyle = M_COLORS.railDark; g.globalAlpha = .35 * alpha; g.lineWidth = (w + 1) * s; line(g, x(x1), y(y1) + 1.5 * s, x(x2), y(y2) + 1.5 * s);
      g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = w * s; line(g, x(x1), y(y1), x(x2), y(y2));
    }
  }
  g.restore();
}
function line(g, a, b, c, d) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
function roundRect(g, x, y, w, hh, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r);
  g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function drawMarble(g, cx, cy, r) {
  const gr = g.createRadialGradient(cx - r * .35, cy - r * .35, 0, cx - r * .35, cy - r * .35, r * 1.4);
  gr.addColorStop(0, '#FFCDD2'); gr.addColorStop(.5, M_COLORS.marble); gr.addColorStop(1, '#B71C1C');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
}
/** The front rail of the start picture, drawn again over the marble so the marble sits in the groove. */
function drawStartFront(g, p, s) {
  const img = mPicReady('start'); if (!img) return;
  const d = MDEFS.start, C = MB.C, seg = d.segs.find(sg => sg[0] !== sg[2]); if (!seg) return;
  const cell = C * s, bw = d.w * cell, bh = d.h * cell, k = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
  const iw = img.naturalWidth * k, ih = img.naturalHeight * k, left = p.c * cell + (bw - iw) / 2, top = p.r * cell + (bh - ih);
  const gy = xx => ((p.r + seg[1] + (xx - seg[0]) * (seg[3] - seg[1]) / (seg[2] - seg[0])) * C - START_GROOVE) * s;
  g.save();
  if (p.m === -1) { g.translate(left + iw / 2, 0); g.scale(-1, 1); g.translate(-(left + iw / 2), 0); }
  g.beginPath(); g.moveTo(p.c * cell + .15 * cell, gy(.15)); g.lineTo(p.c * cell + seg[2] * cell, gy(seg[2]));
  g.lineTo(p.c * cell + seg[2] * cell, (p.r + d.h) * cell); g.lineTo(p.c * cell + .15 * cell, (p.r + d.h) * cell); g.closePath(); g.clip();
  g.drawImage(img, left, top, iw, ih);
  g.restore();
}
/** The basket's front wall, drawn again over the marble so a marble in the basket is hidden inside it. */
function drawBasketFront(g, p, s) {
  const img = mPicReady('goal'); if (!img) return;
  const d = MDEFS.goal, C = MB.C, bw = d.w * C * s, bh = d.h * C * s, k = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
  const iw = img.naturalWidth * k, ih = img.naturalHeight * k, left = p.c * C * s + (bw - iw) / 2, top = p.r * C * s + (bh - ih);
  g.save();
  g.beginPath(); g.rect(left - 2, top + ih * BASKET_FRONT_TOP, iw + 4, ih * (1 - BASKET_FRONT_TOP) + 2); g.clip();
  if (p.m === -1) { g.translate(left + iw / 2, 0); g.scale(-1, 1); g.translate(-(left + iw / 2), 0); }
  g.drawImage(img, left, top, iw, ih);
  g.restore();
}
/** The marble's centre when it rests on the start piece's slope (for drawing only). */
function startRest(p) {
  const [x, y0] = JSON.parse(API.webMarbleStart(p.t, p.c, p.r, p.m));
  const d = MDEFS[p.t]; if (!d.spawn) return [x, y0];
  const sx = d.spawn[0], seg = d.segs.find(sg => Math.min(sg[0], sg[2]) <= sx && sx <= Math.max(sg[0], sg[2]) && sg[0] !== sg[2]);
  if (!seg) return [x, y0];
  const k = (seg[3] - seg[1]) / (seg[2] - seg[0]), ly = seg[1] + (sx - seg[0]) * k;
  return [x, (p.r + ly) * MB.C - (MB.MR + 2.5) * Math.sqrt(1 + k * k)];
}

GAME_UIS.marble = (r, ctx, area, scope) => {
  const rows = r.rows, cols = MB.COLS, C = MB.C;
  const tray = r.inv.map((x, i) => ({ id: i, t: x.t, m: x.m, c: null, r: null }));
  const onBoard = tp => tp.c != null;
  const pieceOf = tp => ({ t: tp.t, c: tp.c ?? 0, r: tp.r ?? 0, m: tp.m });
  let mode = 'EDIT', fails = 0, selected = null, world = null, worldState = null;
  let dragging = null, ghost = null, ghostOk = false;
  const fixedCells = new Set(r.fixed.flatMap(mCells));
  const fits = (p, except) => {
    const d = MDEFS[p.t];
    if (p.c < 0 || p.r < 0 || p.c + d.w > cols || p.r + d.h > rows) return false;
    const taken = new Set([...fixedCells, ...tray.filter(t => onBoard(t) && t !== except).flatMap(t => mCells(pieceOf(t)))]);
    return mCells(p).every(k => !taken.has(k));
  };
  const same = (a, b) => a.t === b.t && a.c === b.c && a.r === b.r && a.m === b.m;
  const hintPiece = () => (mode === 'EDIT' && (r.hint || fails >= 2))
    ? r.sol.find(s => !tray.some(t => onBoard(t) && same(pieceOf(t), s))) || null : null;

  // ---- layout: sideways the tray is on the right, upright under the board
  const W = area.clientWidth, H = area.clientHeight;
  const wide = W > H * 1.15;
  const trayW = wide ? 190 : W;
  const trayRows = Math.ceil(r.inv.length / 4);
  const trayH = trayRows * 66 + 78;
  const cell = Math.floor(Math.min((wide ? W - trayW - 12 : W) / cols, (wide ? H : H - trayH) / rows));
  const s = cell / C;
  const [cv, g] = setupCanvas(cell * cols, cell * rows);
  cv.style.borderRadius = '16px'; cv.style.boxShadow = '0 4px 12px #0003'; cv.style.background = M_COLORS.board;
  const failBadge = h('div', { class: 'center', style: { position: 'absolute', inset: 0, fontSize: '70px', pointerEvents: 'none', display: 'none' } }, '🙈');
  const boardBox = h('div', { class: 'center', style: { position: 'relative', flex: 1, minHeight: 0, minWidth: 0 } }, cv, failBadge);
  const trayEl = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${wide ? 2 : 4}, 76px)`, gap: '8px', justifyContent: 'center' } });
  const goBtn = h('button', { class: 'bigbtn', style: { width: '150px', height: '58px', padding: 0, fontSize: '28px', borderRadius: '30px', flex: 'none' } }, '▶');
  const side = h('div', { class: 'center', style: { flexDirection: 'column', justifyContent: 'space-evenly', gap: '10px', flex: 'none', width: wide ? trayW + 'px' : '100%', height: wide ? '100%' : trayH + 'px' } }, trayEl, goBtn);
  area.append(h('div', { style: { display: 'flex', flexDirection: wide ? 'row' : 'column', height: '100%', gap: wide ? '12px' : '0' } }, boardBox, side));

  const trayTiles = {};
  const drawTray = () => {
    trayEl.innerHTML = '';
    tray.filter(t => !onBoard(t)).forEach(tp => {
      const sel = selected === tp;
      const [mc, mg] = setupCanvas(68, 50);
      const d = MDEFS[tp.t], ss = Math.min(68 / (d.w * C), 50 / (d.h * C)) * .9;
      mg.translate((68 - d.w * C * ss) / 2, (50 - d.h * C * ss) / 2);
      drawMPiece(mg, { t: tp.t, c: 0, r: 0, m: tp.m }, ss);
      const tile = h('div', { class: 'center', style: { width: '76px', height: '58px', borderRadius: '14px', background: '#fff', boxShadow: sel ? '0 4px 12px #0004' : '0 2px 5px #0002', border: (sel ? 4 : 1) + 'px solid ' + (sel ? '#FFC107' : '#E0E0E0'), boxSizing: 'border-box', touchAction: 'none', cursor: 'grab' } }, mc);
      trayTiles[tp.id] = tile; tp.el = tile;
      trayEl.append(tile);
    });
    goBtn.style.background = mode === 'EDIT' ? '#43A047' : '#B0BEC5';
    goBtn.textContent = mode === 'RUN' ? '⏹' : '▶';
  };

  let blinkT = 0;
  const draw = () => {
    g.clearRect(0, 0, cell * cols, cell * rows);
    g.fillStyle = 'rgba(0,0,0,.13)';
    for (let x = 1; x < cols; x++) for (let y = 1; y < rows; y++) { g.beginPath(); g.arc(x * C * s, y * C * s, 2.2, 0, 7); g.fill(); }
    if (mode === 'EDIT') tray.filter(onBoard).forEach(tp => {
      const p = pieceOf(tp), d = MDEFS[p.t];
      g.fillStyle = 'rgba(255,255,255,.7)'; roundRect(g, (p.c * C + 2) * s, (p.r * C + 2) * s, (d.w * C - 4) * s, (d.h * C - 4) * s, 10 * s); g.fill();
    });
    r.fixed.forEach(p => drawMPiece(g, p, s));
    tray.filter(t => onBoard(t) && t !== dragging).forEach(t => drawMPiece(g, pieceOf(t), s));
    const hp = hintPiece();
    if (hp) {
      const a = .6 + .25 * Math.sin(blinkT / 190);
      drawMPiece(g, hp, s, a);
      const d = MDEFS[hp.t];
      g.save(); g.setLineDash([7 * s, 6 * s]); g.strokeStyle = '#37474F'; g.lineWidth = 2.5 * s;
      roundRect(g, (hp.c * C + 2) * s, (hp.r * C + 2) * s, (d.w * C - 4) * s, (d.h * C - 4) * s, 10 * s); g.stroke(); g.restore();
    }
    if (ghost) {
      drawMPiece(g, ghost, s, .75);
      const d = MDEFS[ghost.t];
      g.strokeStyle = ghostOk ? '#43A047' : '#E53935'; g.lineWidth = 3 * s;
      roundRect(g, (ghost.c * C + 1) * s, (ghost.r * C + 1) * s, (d.w * C - 2) * s, (d.h * C - 2) * s, 8 * s); g.stroke();
    }
    if (worldState) worldState.marbles.forEach(m => { if (!m[4]) drawMarble(g, m[0] * s, m[1] * s, MB.MR * s); });
    else r.fixed.filter(p => p.t === 'start').forEach(p => { const [x, y] = startRest(p); drawMarble(g, x * s, y * s, MB.MR * s); });
    [...r.fixed, ...tray.filter(t => onBoard(t) && t !== dragging).map(pieceOf)].forEach(p => {
      if (p.t === 'start') drawStartFront(g, p, s);
      if (p.t === 'goal') drawBasketFront(g, p, s);
    });
  };
  // pictures arrive a moment later: draw again then
  Object.values(M_PICS).forEach(im => { if (!im.complete) im.addEventListener('load', () => draw(), { once: true }); });
  // blinking hint
  scope.every(60, () => { if (mode === 'EDIT' && hintPiece()) { blinkT += 60; draw(); } });

  // ---- running the marble (the app's physics, 240 steps per second)
  const stopRun = () => { if (world) API.webMarbleFree(world); world = null; worldState = null; };
  scope.onEnd(stopRun);
  const startRun = () => {
    if (mode !== 'EDIT') return;
    ctx.touch(); selected = null;
    const pieces = [...r.fixed, ...tray.filter(onBoard).map(pieceOf)].map(p => `${p.t},${p.c},${p.r},${p.m}`).join(';');
    world = API.webMarbleNew(pieces);
    worldState = JSON.parse(API.webMarbleStep(world, 0));
    mode = 'RUN'; drawTray();
    let last = performance.now(), stall = 0;
    const tick = now => {
      if (scope.dead || mode !== 'RUN' || !world) return;
      const dt = clamp((now - last) / 1000, 0, .1); last = now;
      const steps = clamp(Math.floor(dt / MB.DT), 1, 24);
      worldState = JSON.parse(API.webMarbleStep(world, steps));
      draw();
      if (worldState.won) { mode = 'DONE'; drawTray(); ctx.done(); return; }
      const moving = worldState.marbles.some(m => !m[4] && Math.hypot(m[2], m[3]) > 6);
      stall = moving ? 0 : stall + dt;
      if (!worldState.wonNow && (worldState.marbles.every(m => m[4]) || stall > 1.4 || worldState.t > 22)) {
        mode = 'FAIL'; fails++; ctx.mistake(); failBadge.style.display = 'flex';
        scope.later(1300, () => { failBadge.style.display = 'none'; stopRun(); mode = 'EDIT'; drawTray(); draw(); ctx.touch(); });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  goBtn.onclick = () => {
    if (mode === 'RUN') { stopRun(); mode = 'EDIT'; drawTray(); draw(); ctx.touch(); }
    else startRun();
  };

  // ---- the finger: drag from the tray, tap to pick and tap a place, tap a placed piece to turn it, drag it off to take it back
  const boardRect = () => cv.getBoundingClientRect();
  const inRect = (b, x, y) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  const cellUnder = (x, y, tp, lift) => {
    const b = boardRect(); if (!inRect(b, x, y)) return null;
    const d = MDEFS[tp.t];
    const bx = (x - b.left) / cell, by = (y - b.top - (lift ? cell * .8 : 0)) / cell;
    return { t: tp.t, c: Math.floor(bx - (d.w - 1) / 2), r: Math.floor(by - (d.h - 1) / 2), m: tp.m };
  };
  let down = null;
  area.addEventListener('pointerdown', e => {
    if (mode !== 'EDIT') return;
    const x = e.clientX, y = e.clientY;
    const fromTray = tray.find(t => !onBoard(t) && t.el && inRect(t.el.getBoundingClientRect(), x, y)) || null;
    let onB = null;
    const b = boardRect();
    if (!fromTray && inRect(b, x, y)) {
      const cx = Math.floor((x - b.left) / cell), cy = Math.floor((y - b.top) / cell);
      onB = [...tray].reverse().find(t => onBoard(t) && mCells(pieceOf(t)).includes(cx + ',' + cy)) || null;
    }
    down = { x, y, fromTray, onB, target: fromTray || onB, moved: false, id: e.pointerId };
    if (down.target) { try { area.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); }
    ctx.touch();
  });
  area.addEventListener('pointermove', e => {
    if (!down || e.pointerId !== down.id || !down.target) return;
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 18) down.moved = true;
    if (down.moved) {
      dragging = down.target;
      ghost = cellUnder(e.clientX, e.clientY, down.target, true);
      ghostOk = !!ghost && fits(ghost, down.target);
      draw();
    }
  });
  const up = e => {
    if (!down || e.pointerId !== down.id) return;
    const d = down; down = null;
    const x = e.clientX, y = e.clientY;
    const gst = ghost, ok = ghostOk;
    dragging = null; ghost = null; ghostOk = false;
    if (d.target && d.moved) {
      if (gst && ok) { d.target.c = gst.c; d.target.r = gst.r; }
      else if (onBoard(d.target) && !inRect(boardRect(), x, y)) { d.target.c = null; d.target.r = null; } // back to the tray
      selected = null;
    } else if (d.fromTray) selected = selected === d.fromTray ? null : d.fromTray;
    else if (d.onB) d.onB.m = -d.onB.m; // tap: turn around
    else if (selected && inRect(boardRect(), x, y)) {
      const p = cellUnder(x, y, selected, false);
      if (p && fits(p, selected)) { selected.c = p.c; selected.r = p.r; selected = null; }
    }
    drawTray(); draw();
  };
  area.addEventListener('pointerup', up);
  area.addEventListener('pointercancel', up);
  area.style.touchAction = 'none';

  drawTray(); draw();
};
