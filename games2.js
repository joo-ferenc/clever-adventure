'use strict';
// Games with their own mechanics: maze, recycling, tracing, little robot, what came first, ice cream shop.

function setupCanvas(w, hgt) {
  const dpr = window.devicePixelRatio || 1;
  const cv = h('canvas', { width: Math.round(w * dpr), height: Math.round(hgt * dpr), style: { width: w + 'px', height: hgt + 'px', display: 'block', touchAction: 'none' } });
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  return [cv, g];
}
function localPoint(cv, e) { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }

// ---------------------------------------------------------------- maze
GAME_UIS.maze = (r, ctx, area) => {
  const cols = r.cols, rows = r.rows;
  const cs = Math.floor(Math.min((area.clientWidth - 8) / cols, (area.clientHeight - 8) / rows));
  const W = cs * cols, H = cs * rows;
  const [cv, g] = setupCanvas(W, H);
  const start = [0, rows - 1], goal = [cols - 1, 0];
  let cur = start.slice(); const trail = [start.slice()]; let finished = false;
  const canMove = (x, y, nx, ny) => {
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return false;
    if (nx === x + 1 && ny === y) return !r.east[y * cols + x];
    if (nx === x - 1 && ny === y) return !r.east[y * cols + nx];
    if (ny === y + 1 && nx === x) return !r.south[y * cols + x];
    if (ny === y - 1 && nx === x) return !r.south[ny * cols + x];
    return false;
  };
  const wrap = h('div', { style: { position: 'relative', width: W + 'px', height: H + 'px', borderRadius: '12px', background: '#FFFDE7', border: '5px solid #3949AB', boxSizing: 'content-box', boxShadow: '0 4px 10px #0002' } }, cv);
  const home = h('div', { class: 'center', style: { position: 'absolute', left: goal[0] * cs + 'px', top: '0', width: cs + 'px', height: cs + 'px', fontSize: cs * 0.62 + 'px', pointerEvents: 'none' } }, '🏠');
  const tok = cs * 0.84;
  const token = h('div', { class: 'center', style: { position: 'absolute', width: tok + 'px', height: tok + 'px', borderRadius: '50%', background: '#fff', border: '3px solid #E53935', fontSize: tok * 0.6 + 'px', boxShadow: '0 2px 5px #0004', transition: 'left .12s, top .12s', pointerEvents: 'none' } }, ctx.avatar);
  wrap.append(home, token);
  const draw = () => {
    g.clearRect(0, 0, W, H);
    if (trail.length > 1) {
      g.strokeStyle = 'rgba(255,138,101,.75)'; g.lineWidth = cs * 0.32; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
      trail.forEach(([x, y], i) => { const px = (x + .5) * cs, py = (y + .5) * cs; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
    }
    g.strokeStyle = '#5C6BC0'; g.lineWidth = Math.max(4, cs * 0.14); g.lineCap = 'round'; g.beginPath();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (x < cols - 1 && r.east[i]) { g.moveTo((x + 1) * cs, y * cs); g.lineTo((x + 1) * cs, (y + 1) * cs); }
      if (y < rows - 1 && r.south[i]) { g.moveTo(x * cs, (y + 1) * cs); g.lineTo((x + 1) * cs, (y + 1) * cs); }
    }
    g.stroke();
    token.style.left = cur[0] * cs + (cs - tok) / 2 + 'px'; token.style.top = cur[1] * cs + (cs - tok) / 2 + 'px';
  };
  const stepToward = ([tx, ty]) => {
    let guard = 0;
    while (!finished && (cur[0] !== tx || cur[1] !== ty) && guard++ < 30) {
      const [x, y] = cur; const dx = tx - x, dy = ty - y;
      const hz = dx ? [x + Math.sign(dx), y] : null, vt = dy ? [x, y + Math.sign(dy)] : null;
      const opts = (Math.abs(dx) >= Math.abs(dy) ? [hz, vt] : [vt, hz]).filter(Boolean);
      const next = opts.find(([nx, ny]) => canMove(x, y, nx, ny));
      if (!next) break;
      cur = next;
      const prev = trail[trail.length - 2];
      if (prev && prev[0] === next[0] && prev[1] === next[1]) trail.pop(); else trail.push(next.slice());
      if (next[0] === goal[0] && next[1] === goal[1]) { finished = true; ctx.done(); }
    }
    draw();
  };
  const cellAt = p => [clamp(Math.floor(p.x / cs), 0, cols - 1), clamp(Math.floor(p.y / cs), 0, rows - 1)];
  let down = false;
  cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); ctx.touch(); stepToward(cellAt(localPoint(cv, e))); });
  cv.addEventListener('pointermove', e => { if (down) stepToward(cellAt(localPoint(cv, e))); });
  cv.addEventListener('pointerup', () => { down = false; });
  cv.addEventListener('pointercancel', () => { down = false; });
  draw();
  area.append(h('div', { class: 'center', style: { height: '100%' } }, wrap));
};

// ---------------------------------------------------------------- recycling
GAME_UIS.waste = (r, ctx, area, scope) => {
  let solved = false;
  const note = h('div', { style: { minHeight: '0' } });
  const item = h('div', { class: 'center', style: { width: '124px', height: '124px', borderRadius: '50%', background: '#fff', boxShadow: '0 6px 16px #0003', fontSize: '72px', touchAction: 'none', cursor: 'grab', transition: 'transform .3s' } }, r.item.e);
  const binsRow = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-end', padding: '4px' } });
  const binEls = r.bins.map(b => {
    const lid = h('div', { style: { height: '13px', borderRadius: '8px 8px 3px 3px', background: b.dark, transformOrigin: '0 100%', transition: 'transform .3s' } });
    const face = h('div', { class: 'center', style: { width: '62%', aspectRatio: '1', borderRadius: '50%', background: '#ffffffe6', fontSize: '21px' } }, b.icon);
    const body = h('div', { style: { aspectRatio: '.72', borderRadius: '6px 6px 16px 16px', background: b.color, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '8px', gap: '4px', border: '4px solid transparent', boxShadow: '0 3px 6px #0003' } },
      face, h('div', { style: { color: '#fff', fontWeight: 900, fontSize: '12px', textAlign: 'center', lineHeight: 1.1, padding: '0 2px' } }, b.label));
    const el = h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', cursor: 'pointer' }, onclick: () => choose(b, el) }, lid, body);
    el.lid = lid; el.body = body; el.face = face; el.bin = b;
    binsRow.append(el); return el;
  });
  const choose = (b, el) => {
    if (solved) return;
    ctx.touch();
    const right = binEls.find(x => x.bin.id === r.item.bin);
    if (b.id === r.item.bin) {
      solved = true;
      const ib = item.getBoundingClientRect(), bb = el.getBoundingClientRect();
      item.style.transition = 'transform .45s'; item.style.transform = `translate(${bb.left + bb.width / 2 - ib.left - ib.width / 2}px, ${bb.top + bb.height / 2 - ib.top - ib.height / 2}px) scale(.1)`;
      el.lid.style.transform = 'rotate(-28deg)'; el.face.textContent = '😋';
      el.body.style.borderColor = '#fff';
      note.replaceChildren(h('div', { class: 'card', style: { padding: '10px', border: '3px solid #43A047', fontWeight: 700, textAlign: 'center', margin: '0 8px 6px' } }, '♻️ ' + r.fact));
      ctx.done(r.fact);
    } else {
      shakeEl(el); item.style.transform = '';
      right.body.style.borderColor = '#fff';
      note.replaceChildren(h('div', { class: 'card', style: { padding: '10px', border: '3px solid ' + right.bin.color, fontWeight: 700, textAlign: 'center', margin: '0 8px 6px' } }, '👉 ' + r.hint));
      ctx.wrong(r.hint);
    }
  };
  // Drag the item into a bin (or simply tap a bin).
  let start = null;
  item.addEventListener('pointerdown', e => { if (solved) return; start = { x: e.clientX, y: e.clientY }; item.setPointerCapture(e.pointerId); item.style.transition = 'none'; ctx.touch(); });
  item.addEventListener('pointermove', e => { if (start) item.style.transform = `translate(${e.clientX - start.x}px, ${e.clientY - start.y}px)`; });
  item.addEventListener('pointerup', e => {
    if (!start) return; const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y); start = null;
    item.style.transition = 'transform .3s';
    const hit = binEls.find(el => { const b = el.getBoundingClientRect(); return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top - 30 && e.clientY <= b.bottom; });
    if (hit && moved > 20) choose(hit.bin, hit); else { item.style.transform = ''; if (moved < 10) ctx.say(r.item.name); }
  });
  area.style.display = 'flex'; area.style.flexDirection = 'column';
  area.append(h('div', { class: 'center', style: { flex: 1, flexDirection: 'column', gap: '6px', minHeight: 0 } }, item, h('b', { style: { fontSize: '19px', textAlign: 'center' } }, r.item.name)), note, binsRow);
};

// ---------------------------------------------------------------- tracing
GAME_UIS.trace = (r, ctx, area) => {
  const W = area.clientWidth, H = area.clientHeight;
  const [cv, g] = setupCanvas(W, H);
  const ink = { LINE: '#FF7043', SHAPE: '#42A5F5', DIGIT: '#66BB6A', LETTER: '#7E57C2' }[r.kind];
  const pathW = Math.min(W, H) * (r.kind === 'LINE' ? 0.12 : 0.10);
  const all = r.strokes.flat();
  const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]));
  const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]));
  const bw = maxX - minX, bh = maxY - minY, pad = pathW * 1.4;
  const scale = Math.min(bw > .01 ? (W - 2 * pad) / bw : Infinity, bh > .01 ? (H - 2 * pad) / bh : Infinity);
  const ox = (W - bw * scale) / 2 - minX * scale, oy = (H - bh * scale) / 2 - minY * scale;
  const S = r.strokes.map(s => s.map(([x, y]) => ({ x: ox + x * scale, y: oy + y * scale })));
  const tol = pathW * 0.95 * r.tolerance, look = 14;
  let si = 0, prog = 0, finished = false;
  const wrap = h('div', { style: { position: 'relative', width: W + 'px', height: H + 'px' } }, cv);
  const overlay = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } });
  wrap.append(overlay);
  const line = (pts, upTo) => { g.beginPath(); for (let i = 0; i <= Math.min(upTo, pts.length - 1); i++) i ? g.lineTo(pts[i].x, pts[i].y) : g.moveTo(pts[i].x, pts[i].y); };
  const badge = (x, y, text, color) => h('div', { class: 'center', style: { position: 'absolute', left: x - pathW * 0.52 + 'px', top: y - pathW * 0.52 + 'px', width: pathW * 1.05 + 'px', height: pathW * 1.05 + 'px', borderRadius: '50%', background: color, border: '3px solid #fff', color: '#fff', fontWeight: 900, fontSize: pathW * 0.55 + 'px' } }, text);
  const em = (x, y, e, size, dy = 0.5, extra) => h('div', { style: Object.assign({ position: 'absolute', left: x - size / 2 + 'px', top: y - size * dy + 'px', fontSize: size * 0.8 + 'px', lineHeight: 1 }, extra || {}) }, e);
  const draw = () => {
    g.clearRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';
    S.forEach((s, k) => {
      line(s, s.length); g.strokeStyle = '#E6EBEE'; g.lineWidth = pathW; g.setLineDash([]); g.stroke();
      g.strokeStyle = '#B0BEC5'; g.lineWidth = pathW * 0.12; g.setLineDash([pathW * 0.05, pathW * 0.45]); g.stroke(); g.setLineDash([]);
      const doneTo = finished || k < si ? s.length - 1 : k === si ? prog : 0;
      if (doneTo > 0) { line(s, doneTo); g.strokeStyle = ink; g.lineWidth = pathW * 0.72; g.stroke(); }
    });
    if (!finished) {
      const s = S[si]; const k = Math.min(prog + 10, s.length - 1), k0 = Math.min(prog + 6, s.length - 1);
      if (k > k0) {
        const a = Math.atan2(s[k].y - s[k0].y, s[k].x - s[k0].x), t = s[k], len = pathW * 0.38;
        g.fillStyle = '#fff'; g.beginPath();
        g.moveTo(t.x + Math.cos(a) * len * .6, t.y + Math.sin(a) * len * .6);
        g.lineTo(t.x + Math.cos(a + 2.5) * len, t.y + Math.sin(a + 2.5) * len);
        g.lineTo(t.x + Math.cos(a - 2.5) * len, t.y + Math.sin(a - 2.5) * len); g.fill();
      }
    }
    overlay.innerHTML = '';
    if (r.kind === 'LINE') {
      const s = S[0], end = s[s.length - 1];
      overlay.append(em(end.x, end.y, r.goal, pathW * 1.7, 0.5, finished ? { transform: 'scale(1.5)', transition: 'transform .6s' } : null));
      if (prog === 0 && !finished) overlay.append(badge(s[0].x, s[0].y, '', '#43A047'));
      const at = s[finished ? s.length - 1 : prog];
      overlay.append(em(at.x, at.y, r.figure, pathW * 1.5, 0.75));
    } else if (!finished) {
      S.forEach((s, k) => { if (k > si || (k === si && prog === 0)) overlay.append(badge(s[0].x, s[0].y, k + 1, k === si ? '#43A047' : '#90A4AE')); });
    }
    if (finished) {
      const pts = S.flat(); const every = Math.max(1, Math.floor(pts.length / 9));
      pts.forEach((p, i) => { if (i % every === 0) overlay.append(h('div', { class: 'pop', style: { position: 'absolute', left: p.x - 15 + 'px', top: p.y - 15 + 'px', fontSize: '26px' } }, '✨')); });
      if (r.kind !== 'LINE') overlay.append(h('div', { class: 'center pop', style: { position: 'absolute', right: '6px', top: '6px', width: '84px', height: '84px', borderRadius: '50%', background: '#fff', border: '4px solid ' + ink, color: ink, fontSize: '44px', fontWeight: 900 } }, r.label));
    }
  };
  const advance = p => {
    if (finished) return;
    const s = S[si]; let best = prog;
    for (let j = prog; j <= Math.min(s.length - 1, prog + look); j++) if (Math.hypot(s[j].x - p.x, s[j].y - p.y) < tol) best = j;
    prog = best;
    if (prog >= s.length - 1) {
      if (si < S.length - 1) { si++; prog = 0; } else { finished = true; ctx.done(r.spokenName); }
    }
    draw();
  };
  let down = false;
  cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); ctx.touch(); advance(localPoint(cv, e)); });
  cv.addEventListener('pointermove', e => { if (down) advance(localPoint(cv, e)); });
  cv.addEventListener('pointerup', () => { down = false; });
  cv.addEventListener('pointercancel', () => { down = false; });
  draw();
  area.append(wrap);
};

// ---------------------------------------------------------------- little robot
const DIRS = [['LEFT', -1, 0, '⬅️'], ['UP', 0, -1, '⬆️'], ['DOWN', 0, 1, '⬇️'], ['RIGHT', 1, 0, '➡️']];
GAME_UIS.robot = (r, ctx, area, scope) => {
  const n = r.size;
  const blocks = new Map(r.blocks.map(([x, y, e]) => [x + ',' + y, e]));
  const starSet = new Set(r.stars.map(([x, y]) => x + ',' + y));
  const free = (x, y) => x >= 0 && y >= 0 && x < n && y < n && !blocks.has(x + ',' + y);
  const program = []; let running = false, solved = false;
  let pos = r.start.slice(); let trail = new Set([pos.join(',')]); let got = new Set(); let stepIdx = -1;
  const wide = area.clientWidth > area.clientHeight * 1.15;
  const controlsH = 58 + 8 + 56 + 14 + Math.ceil(r.maxSteps / 7) * 44 + 24;
  const side = wide ? Math.min(area.clientHeight, area.clientWidth * 0.5) - 8 : Math.min(area.clientWidth, area.clientHeight - controlsH) - 4;
  const cs = Math.floor(side / n);
  const board = h('div', { style: { position: 'relative', width: cs * n + 'px', height: cs * n + 'px', borderRadius: '14px', border: '4px solid #558B2F', boxSizing: 'content-box', overflow: 'hidden', boxShadow: '0 4px 10px #0002', flex: 'none' } });
  const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const c = h('div', { class: 'center', style: { position: 'absolute', left: x * cs + 'px', top: y * cs + 'px', width: cs + 'px', height: cs + 'px', fontSize: cs * 0.6 + 'px' } });
    c.x = x; c.y = y; cells.push(c); board.append(c);
  }
  const robot = h('div', { class: 'center', style: { position: 'absolute', width: cs * 0.86 + 'px', height: cs * 0.86 + 'px', borderRadius: '50%', background: '#fff', border: '3px solid #1E88E5', fontSize: cs * 0.55 + 'px', boxShadow: '0 2px 5px #0004', transition: 'left .38s, top .38s' } }, '🤖');
  board.append(robot);
  const bar = h('div', { class: 'card', style: { padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', gap: '6px', flex: 'none' } });
  const draw = () => {
    cells.forEach(c => {
      const k = c.x + ',' + c.y;
      c.style.background = trail.has(k) ? '#FFF176' : (c.x + c.y) % 2 ? '#DCEDC8' : '#E8F5E9';
      c.textContent = blocks.get(k) || (r.gem[0] === c.x && r.gem[1] === c.y ? '💎' : starSet.has(k) && !got.has(k) ? '⭐' : '');
    });
    robot.style.left = pos[0] * cs + cs * 0.07 + 'px'; robot.style.top = pos[1] * cs + cs * 0.07 + 'px';
    bar.innerHTML = '';
    for (let i = 0; i < r.maxSteps; i++) {
      const d = program[i];
      bar.append(h('div', { class: 'center', style: { width: '38px', height: '38px', borderRadius: '10px', fontSize: '20px', background: i === stepIdx ? '#FFEB3B' : d ? '#E3F2FD' : '#F5F5F5', border: '2px solid ' + (i === stepIdx ? '#F9A825' : '#CFD8DC') } }, d ? d[3] : ''));
    }
  };
  const reset = () => { pos = r.start.slice(); trail = new Set([pos.join(',')]); got = new Set(); stepIdx = -1; draw(); };
  const locked = () => running || solved;
  const key = (label, color, fn) => h('button', { class: 'roundbtn press', style: { width: '56px', height: '56px', borderRadius: '16px', background: color, fontSize: '27px' }, onclick: fn }, label);
  const go2 = async () => {
    if (locked()) return; ctx.touch();
    if (!program.length) { ctx.say(T('Előbb tegyél le nyilakat!', 'Leg zuerst Pfeile hin!', 'Put down some arrows first!')); return; }
    running = true; buttons.style.opacity = .45; reset();
    await scope.wait(250);
    let cur = r.start.slice(); const collected = new Set(); let crashed = null, success = false;
    for (let i = 0; i < program.length; i++) {
      const d = program[i]; const nx = cur[0] + d[1], ny = cur[1] + d[2];
      stepIdx = i;
      if (!free(nx, ny)) { crashed = i; break; }
      cur = [nx, ny]; pos = cur.slice(); trail.add(cur.join(','));
      if (starSet.has(cur.join(','))) { collected.add(cur.join(',')); got.add(cur.join(',')); }
      draw();
      await scope.wait(520);
      if (cur[0] === r.gem[0] && cur[1] === r.gem[1] && collected.size === starSet.size) { success = true; break; }
    }
    if (success) { stepIdx = -1; solved = true; draw(); ctx.done(); return; }
    if (crashed != null) {
      draw(); const d = program[crashed];
      robot.style.transition = 'transform .14s'; robot.style.transform = `translate(${d[1] * cs * 0.25}px, ${d[2] * cs * 0.25}px)`;
      await scope.wait(160); robot.style.transform = ''; await scope.wait(220); robot.style.transition = 'left .38s, top .38s';
    }
    ctx.say(T('Majdnem! Javítsunk a programon!', 'Fast! Verbessern wir das Programm!', "Almost! Let's fix the program!"));
    await scope.wait(1900);
    reset(); running = false; buttons.style.opacity = 1;
  };
  const buttons = h('div', { class: 'col', style: { gap: '8px', flex: 'none' } },
    h('div', { class: 'row', style: { gap: '8px' } },
      ...DIRS.map(d => key(d[3], '#42A5F5', () => { if (locked()) return; ctx.touch(); if (program.length < r.maxSteps) program.push(d); draw(); })),
      key('↩️', '#FFA726', () => { if (locked()) return; ctx.touch(); program.pop(); draw(); })),
    bigBtn('▶  ' + T('Indulj!', 'Los!', 'Go!'), '#43A047', go2, { fontSize: '24px', padding: '10px 34px', borderRadius: '30px' }));
  draw();
  const controls = h('div', { class: 'col', style: { gap: '12px' } }, bar, buttons);
  area.append(h('div', { class: 'center', style: { height: '100%', flexDirection: wide ? 'row' : 'column', gap: '12px', justifyContent: 'space-evenly' } }, board, controls));
};

// ---------------------------------------------------------------- what came first?
GAME_UIS.story = (r, ctx, area, scope) => {
  const steps = r.steps, n = steps.length;
  const placed = []; let finished = false;
  const gap = 8;
  const card = Math.min((area.clientWidth - gap * (n - 1)) / n, 130, (area.clientHeight - 60) / 2.6 * 0.85);
  const ch = card / 0.85;
  const slotsRow = h('div', { style: { display: 'flex', gap: gap + 'px' } });
  const poolRow = h('div', { style: { display: 'flex', gap: gap + 'px' } });
  const box = (extra, kids, onclick) => h('div', { class: 'center', style: Object.assign({ width: card + 'px', height: ch + 'px', borderRadius: '18px', flex: 'none', transition: 'transform .25s' }, extra), onclick }, kids);
  const slots = [];
  const drawSlots = () => {
    slotsRow.innerHTML = ''; slots.length = 0;
    for (let s = 0; s < n; s++) {
      const st = placed[s];
      const el = st != null
        ? box({ background: '#fff', boxShadow: '0 4px 10px #0002', border: '2px solid #8E24AA80', fontSize: card * 0.5 + 'px', cursor: 'pointer' }, steps[st].e, () => ctx.say(steps[st].text))
        : box({ background: '#F3E5F5', border: '2px solid #8E24AA80', fontSize: card * 0.35 + 'px', fontWeight: 900, color: '#8E24AA73' }, String(s + 1));
      slots.push(el); slotsRow.append(el);
    }
  };
  const drawPool = () => {
    poolRow.innerHTML = '';
    r.shuffled.forEach(i => {
      if (placed.includes(i)) { poolRow.append(box({}, '')); return; }
      const el = box({ background: '#fff', boxShadow: '0 4px 10px #0002', border: '2px solid #E0E0E0', fontSize: card * 0.5 + 'px', cursor: 'pointer' }, steps[i].e, () => tap(i, el));
      poolRow.append(el);
    });
  };
  const tap = (i, el) => {
    if (finished || placed.includes(i)) return;
    ctx.touch();
    if (i === placed.length) {
      placed.push(i); drawSlots(); drawPool();
      if (placed.length === n) { finished = true; ctx.done(steps.map(s => s.text).join(' ')); light(); } else ctx.say(steps[i].text);
    } else {
      el.style.borderColor = '#E53935'; shakeEl(el); scope.later(400, () => { el.style.borderColor = '#E0E0E0'; });
      ctx.say(T('Ez még nem az. Mi jön előbb?', 'Das kommt noch nicht. Was kommt vorher?', 'Not this one yet. What comes before?'));
    }
  };
  const light = async () => {
    for (let s = 0; s < n; s++) {
      slots.forEach((el, k) => { el.style.transform = k === s ? 'scale(1.12)' : ''; el.style.borderColor = k === s ? '#FFC107' : '#8E24AA80'; el.style.borderWidth = k === s ? '4px' : '2px'; });
      await scope.wait(2500);
    }
    slots.forEach(el => { el.style.transform = ''; el.style.borderColor = '#8E24AA80'; el.style.borderWidth = '2px'; });
  };
  drawSlots(); drawPool();
  area.append(h('div', { class: 'center', style: { height: '100%', flexDirection: 'column', justifyContent: 'space-evenly' } }, slotsRow, h('div', { style: { fontSize: '26px' } }, '⬆️'), poolRow));
};

// ---------------------------------------------------------------- ice cream shop
function iceSvg(ice, w, hh) {
  const D = data();
  const r = Math.min(w * 0.2, hh * 0.135), cx = w / 2;
  const base = ice.holder === 'CONE' ? hh * 0.56 : ice.holder === 'CUP' ? hh * 0.62 : hh * 0.85;
  const sy = i => base - r * 0.55 - i * r * 1.3;
  let s = `<svg width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}" xmlns="http://www.w3.org/2000/svg">`;
  if (ice.holder === 'CONE') {
    const tip = hh * 0.98;
    s += `<path d="M${cx - r * 1.05} ${base} L${cx + r * 1.05} ${base} L${cx} ${tip} Z" fill="#E0A85C" stroke="#B9813A" stroke-width="3"/>`;
    for (let k = 1; k <= 3; k++) {
      const f = k / 4, ly = base + (tip - base) * f;
      s += `<line x1="${cx - r * 1.05 * (1 - f)}" y1="${ly}" x2="${cx + r * 1.05}" y2="${base}" stroke="#B9813A" stroke-width="2.5"/>`;
      s += `<line x1="${cx + r * 1.05 * (1 - f)}" y1="${ly}" x2="${cx - r * 1.05}" y2="${base}" stroke="#B9813A" stroke-width="2.5"/>`;
    }
  } else if (ice.holder === 'CUP') {
    const bottom = hh * 0.95, yy = base + (bottom - base) * 0.45;
    s += `<path d="M${cx - r * 1.3} ${base} L${cx + r * 1.3} ${base} L${cx + r * .95} ${bottom} L${cx - r * .95} ${bottom} Z" fill="#F8BBD0" stroke="#EC407A" stroke-width="3"/>`;
    s += `<line x1="${cx - r * 1.14}" y1="${yy}" x2="${cx + r * 1.14}" y2="${yy}" stroke="#EC407A" stroke-width="${r * .22}"/>`;
  }
  ice.scoops.forEach((id, i) => {
    const c = D.flavors.find(f => f.id === id).color, y = sy(i);
    s += `<circle cx="${cx}" cy="${y}" r="${r}" fill="${c}" stroke="#0003" stroke-width="3"/>`;
    for (let d = -2; d <= 2; d++) s += `<circle cx="${cx + d * r * .42}" cy="${y + r * .82}" r="${r * .24}" fill="${c}"/>`;
    s += `<circle cx="${cx - r * .4}" cy="${y - r * .4}" r="${r * .2}" fill="#fff" opacity=".55"/>`;
  });
  if (ice.topping) {
    const top = ice.scoops.length ? sy(ice.scoops.length - 1) - r * 0.95 : base - r * 0.4;
    const icon = D.toppings.find(t => t.id === ice.topping).icon;
    s += `<text x="${cx}" y="${top + r * 0.35}" font-size="${r * 0.9}" text-anchor="middle">${icon}</text>`;
  }
  if (!ice.holder && !ice.scoops.length && !ice.topping) s += `<text x="${cx}" y="${hh / 2 + r * .4}" font-size="${r * 1.2}" text-anchor="middle" opacity=".3">❔</text>`;
  return s + '</svg>';
}
function sameIce(a, b) {
  return a.holder === b.holder && a.topping === b.topping && a.scoops.slice().sort().join() === b.scoops.slice().sort().join();
}
GAME_UIS.ice = (r, ctx, area, scope) => {
  const D = data();
  let made = { holder: null, scoops: [], topping: null };
  let solved = false, free = false, showOrder = true, hideTimer = null;
  const wide = area.clientWidth > area.clientHeight * 1.15;
  const customerEl = h('div', { style: { fontSize: '60px', position: 'relative', cursor: 'pointer' }, onclick: () => { if (!free) ctx.repeatPrompt(); } });
  const hearts = h('div', { style: { position: 'absolute', left: '50%', top: '-10px', transform: 'translateX(-50%)', fontSize: '24px', opacity: 0, transition: 'all 1.2s', whiteSpace: 'nowrap' } }, '💖💖💖');
  const bubble = h('div', { class: 'center', style: { width: '104px', height: '104px', borderRadius: '22px', background: '#fff', border: '3px solid #FF80AB', boxShadow: '0 3px 8px #0002', flexDirection: 'column', cursor: 'pointer', flex: 'none' }, onclick: () => { if (!free) ctx.repeatPrompt(); } });
  const toggle = h('div', { class: 'center press', style: { flexDirection: 'column', borderRadius: '16px', padding: '6px 10px', cursor: 'pointer', flex: 'none' } });
  const build = h('div', { class: 'center', style: { flex: 1, minHeight: 0, width: '100%' } });
  const drawTop = () => {
    customerEl.firstChild ? customerEl.firstChild.textContent = free ? '🦄' : r.customer : customerEl.append(h('span', null, free ? '🦄' : r.customer));
    customerEl.append(hearts);
    bubble.innerHTML = '';
    if (free) bubble.append(h('div', { style: { fontSize: '26px' } }, '✨💭✨'));
    else if (showOrder) bubble.innerHTML = iceSvg(r.order, 92, 92);
    else bubble.append(h('div', { style: { fontSize: '38px' } }, '❓'), h('div', { style: { fontSize: '12px' } }, T('Emlékszel?', 'Weißt du es noch?', 'Do you remember?')));
    toggle.style.background = free ? '#E1BEE7' : '#F3E5F5';
    toggle.innerHTML = '';
    toggle.append(h('div', { style: { fontSize: '25px' } }, free ? '🐾' : '🦄'), h('b', { style: { fontSize: '12px' } }, free ? T('Vendégek', 'Gäste', 'Customers') : T('Szabad mód', 'Freies Spiel', 'Free play')));
  };
  const drawBuild = () => {
    const w = build.clientWidth || 200, hh = build.clientHeight || 200;
    build.innerHTML = iceSvg(made, Math.min(w, hh * 0.9), hh);
  };
  const clear = () => { made = { holder: null, scoops: [], topping: null }; drawBuild(); };
  const hide = ms => {
    if (r.hideMs <= 0) return;
    showOrder = true; drawTop(); if (hideTimer) clearTimeout(hideTimer);
    hideTimer = scope.later(ms, () => { showOrder = false; drawTop(); });
  };
  const flyHearts = () => { hearts.style.transition = 'none'; hearts.style.opacity = 1; hearts.style.top = '-10px'; void hearts.offsetWidth; hearts.style.transition = 'all 1.2s'; hearts.style.top = '-80px'; hearts.style.opacity = 0; };
  toggle.onclick = () => {
    ctx.touch(); free = !free; clear(); drawTop();
    if (free) ctx.say(T('Szabad mód: készíts bármilyen fagyit az egyszarvúnak!', 'Freies Spiel: Mach dem Einhorn ein Eis, wie du magst!', 'Free play: make any ice cream you like for the unicorn!'));
    else ctx.repeatPrompt();
  };
  const serve = () => {
    if (solved) return; ctx.touch();
    if (free) {
      if (!made.scoops.length) return;
      flyHearts(); scope.later(1200, clear);
      ctx.say(T('Nyam-nyam! Az egyszarvú nagyon boldog!', 'Mjam mjam! Das Einhorn ist sehr glücklich!', 'Yum yum! The unicorn is very happy!'));
      return;
    }
    const o = r.order;
    if (sameIce(made, o)) { solved = true; flyHearts(); ctx.done(T('Nyam-nyam, köszönöm!', 'Mjam mjam, danke!', 'Yum yum, thank you!')); return; }
    let msg;
    if (made.holder !== o.holder) msg = o.holder === 'CONE' ? T('Hmm, finom! De én tölcsérben kértem.', 'Hmm, lecker! Aber ich wollte eine Waffel.', 'Hmm, yummy! But I asked for a cone.')
      : T('Hmm, finom! De én pohárban kértem.', 'Hmm, lecker! Aber ich wollte einen Becher.', 'Hmm, yummy! But I asked for a cup.');
    else if (made.scoops.slice().sort().join() !== o.scoops.slice().sort().join()) msg = T('Hmm, finom! De én más gombócokat kértem. Nézd meg újra!', 'Hmm, lecker! Aber ich wollte andere Kugeln. Schau noch einmal!', 'Hmm, yummy! But I asked for other scoops. Look again!');
    else msg = T('Hmm, finom! De a tetejére mást kértem.', 'Hmm, lecker! Aber obendrauf wollte ich etwas anderes.', 'Hmm, yummy! But I wanted something else on top.');
    ctx.say(msg);
    hide(3000);
  };
  const keyEl = (label, onclick, size = 54, bg = '#fff') => h('div', { class: 'center press', style: { width: size + 'px', height: size + 'px', borderRadius: '16px', background: bg, boxShadow: '0 2px 5px #0002', fontSize: size * 0.5 + 'px', cursor: 'pointer', border: '3px solid transparent', flex: 'none' }, onclick }, label);
  const holderKeys = D.holders.map(x => { const k = keyEl(x.icon, () => { ctx.touch(); made.holder = x.id; ctx.say(x.word); mark(); drawBuild(); }, 56, '#FFF8E1'); k.id_ = x.id; return k; });
  const toppingKeys = D.toppings.map(x => { const k = keyEl(x.icon, () => { ctx.touch(); made.topping = x.id; ctx.say(x.word); mark(); drawBuild(); }, 48); k.id_ = x.id; return k; });
  const mark = () => {
    holderKeys.forEach(k => { k.style.borderColor = made.holder === k.id_ ? '#FF4081' : 'transparent'; });
    toppingKeys.forEach(k => { k.style.borderColor = made.topping === k.id_ ? '#FF4081' : 'transparent'; });
  };
  const flavorKeys = D.flavors.map(f => h('div', {
    class: 'center press', style: { width: '46px', height: '46px', borderRadius: '50%', background: f.color, border: '3px solid #0003', fontSize: '17px', cursor: 'pointer', flex: 'none' },
    onclick: () => { ctx.touch(); if (made.scoops.length < 3) made.scoops.push(f.id); ctx.say(f.word); drawBuild(); }
  }, f.icon));
  const controls = h('div', { class: 'col', style: { gap: '8px' } },
    h('div', { class: 'row' }, ...holderKeys, keyEl('🗑️', () => { ctx.touch(); clear(); mark(); }, 56, '#ECEFF1')),
    h('div', { class: 'row', style: { gap: '6px' } }, ...flavorKeys),
    h('div', { class: 'row', style: { gap: '6px' } }, ...toppingKeys),
    bigBtn(T('Tessék!', 'Bitte schön!', 'Here you are!'), '#43A047', serve, { fontSize: '23px', padding: '11px 34px', borderRadius: '30px' }));
  const top = h('div', { class: 'row', style: { justifyContent: 'center' } }, customerEl, bubble, toggle);
  drawTop();
  if (wide) area.append(h('div', { style: { display: 'flex', height: '100%', gap: '10px' } }, h('div', { class: 'col', style: { flex: 1, minWidth: 0 } }, top, build), h('div', { class: 'center', style: { flex: 1 } }, controls)));
  else area.append(h('div', { class: 'col', style: { height: '100%', gap: '6px' } }, top, build, controls));
  requestAnimationFrame(drawBuild);
  if (r.hideMs > 0) hide(r.hideMs);
};
