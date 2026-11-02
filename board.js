'use strict';
// Board game: 50 squares, a dice, three questions per stop. Nothing is saved; play time does not run.

const GOAL = 50, BCOLS = 6, BROWS = 9;
const RACER_COLORS = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00897B'];
const SQUARE_COLORS = ['#FFF59D', '#C5E1A5', '#80DEEA', '#F8BBD0', '#FFCC80', '#B39DDB'];
const SPECIALS = {
  7: { e: '⏩', color: '#81D4FA', steps: 2, badge: '+2', text: () => T('Lépj előre kettőt!', 'Geh zwei Felder vor!', 'Move forward two squares!') },
  13: { e: '⏪', color: '#EF9A9A', steps: -2, badge: '−2', text: () => T('Lépj vissza kettőt!', 'Geh zwei Felder zurück!', 'Move back two squares!') },
  22: { e: '🎲', color: '#A5D6A7', steps: 0, badge: '', again: true, text: () => T('Dobhatsz még egyszer!', 'Du darfst noch einmal würfeln!', 'You can roll again!') },
  29: { e: '⏩', color: '#81D4FA', steps: 3, badge: '+3', text: () => T('Lépj előre hármat!', 'Geh drei Felder vor!', 'Move forward three squares!') },
  41: { e: '⏪', color: '#EF9A9A', steps: -3, badge: '−3', text: () => T('Lépj vissza hármat!', 'Geh drei Felder zurück!', 'Move back three squares!') },
};
function squarePlace(i) {
  const row = Math.floor(i / BCOLS), inRow = i % BCOLS;
  const col = row % 2 === 0 ? inRow : BCOLS - 1 - inRow;
  return [col, row, i === GOAL ? BCOLS - col : 1];
}
function diceSvg(v, size) {
  const a = 25, b = 50, c = 75;
  const pips = { 1: [[b, b]], 2: [[a, a], [c, c]], 3: [[a, a], [b, b], [c, c]], 4: [[a, a], [c, a], [a, c], [c, c]], 5: [[a, a], [c, a], [b, b], [a, c], [c, c]], 6: [[a, a], [c, a], [a, b], [c, b], [a, c], [c, c]] }[v] || [];
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" rx="18" fill="#fff" stroke="#B0BEC5" stroke-width="3"/>${pips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#263238"/>`).join('')}</svg>`;
}

function showBoard() {
  const parentsBody = T('Ezt a játékot szülővel vagy pedagógussal együtt ajánljuk. A kérdésekre nincs jó vagy rossz válasz: hallgassátok meg a gyereket, kérdezzetek vissza, és dicsérjétek meg a gondolatait. Ha egy kérdést megbeszéltetek, nyomjátok meg a „Kész” gombot.',
    'Wir empfehlen, dieses Spiel gemeinsam mit einem Elternteil oder einer pädagogischen Fachkraft zu spielen. Es gibt keine richtigen oder falschen Antworten: Hört dem Kind zu, fragt nach und lobt seine Ideen. Wenn ihr über eine Frage gesprochen habt, tippt auf „Fertig“.',
    'We recommend playing this game together with a parent or a teacher. There are no right or wrong answers: listen to the child, ask follow-up questions and praise their ideas. When a question has been talked through, tap “Done”.');
  const notSaved = T('A játék nem mentődik: ha kiléptek, legközelebb elölről kezdődik.', 'Das Spiel wird nicht gespeichert: Wenn ihr es verlasst, beginnt es beim nächsten Mal von vorn.', 'The game is not saved: if you leave, it starts again from the beginning next time.');
  const noTime = T('Ebben a játékban nem fogy a játékidő.', 'In diesem Spiel läuft die Spielzeit nicht ab.', 'Play time does not run in this game.');
  go('board-intro', (root, scope) => {
    root.append(h('div', { class: 'screen scroll', style: { alignItems: 'center', gap: '14px' } },
      h('div', { class: 'row', style: { width: '100%' } }, roundBtn('🏠', enterApp)),
      h('div', { style: { fontSize: '60px' } }, '🎲 👨‍👩‍👧'),
      h('div', { class: 'h2' }, T('Szülőknek és pedagógusoknak', 'Für Eltern und Pädagogen', 'For parents and teachers')),
      noTimeBadge(true),
      h('div', { class: 'card', style: { padding: '18px', fontSize: '17px', lineHeight: 1.5 } }, parentsBody,
        h('div', { style: { fontSize: '14px', opacity: .7, marginTop: '10px' } }, '💡 ' + notSaved)),
      h('div', { style: { fontSize: '34px', cursor: 'pointer' }, onclick: () => Speech.say(noTime + ' ' + parentsBody + ' ' + notSaved) }, '🔊'),
      bigBtn('▶  ' + T('Kezdjük!', "Los geht's!", "Let's go!"), '#43A047', boardPick, { width: '100%', flex: 'none' }),
      h('div', { style: { height: '10px', flex: 'none' } })));
  }, { exempt: true });
}

function boardPick() {
  go('board-pick', (root, scope) => {
    const adult = { id: -1, avatar: '🧑', name: T('Felnőtt', 'Erwachsener', 'Grown-up') };
    const cands = [...Store.players, adult];
    const chosen = new Set([Store.current.id]);
    scope.later(250, () => Speech.say(T('Ki játszik?', 'Wer spielt mit?', 'Who is playing?')));
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } });
    const btn = bigBtn('', '#43A047', () => playBoard(cands.filter(p => chosen.has(p.id))), { width: '100%', flex: 'none' });
    const draw = () => {
      grid.innerHTML = '';
      cands.forEach(p => {
        const on = chosen.has(p.id), isAdult = p.id === -1;
        grid.append(h('div', {
          class: 'card center press', style: { height: '124px', flexDirection: 'column', cursor: 'pointer', background: on ? '#E8F5E9' : isAdult ? '#F5F5F5' : '#fff', border: on ? '4px solid #43A047' : '4px solid transparent' },
          onclick: () => {
            const kids = [...chosen].filter(id => id !== -1).length;
            if (!on) chosen.add(p.id); else if (isAdult || kids > 1) chosen.delete(p.id);
            draw();
          }
        }, h('div', { style: { fontSize: '50px', opacity: on ? 1 : .45 } }, p.avatar), h('b', null, (on ? '✅ ' : isAdult ? '➕ ' : '') + p.name)));
      });
      btn.textContent = chosen.size === 1 ? '👤  ' + T('Egyedül játszom', 'Allein spielen', 'Play alone') : '👥  ' + T('Együtt játszunk', 'Zusammen spielen', 'Play together');
    };
    draw();
    root.append(h('div', { class: 'screen' }, h('div', { class: 'row' }, roundBtn('🏠', enterApp)),
      h('div', { class: 'title' }, T('Ki játszik?', 'Wer spielt mit?', 'Who is playing?')),
      h('div', { class: 'grow scroll' }, grid,
        h('div', { class: 'small', style: { textAlign: 'center', opacity: .65, padding: '10px' } }, '🧑 ' + T('A felnőtt bábu együtt játszik, de nem kap csillagot és matricát.', 'Die Erwachsenen-Figur spielt mit, bekommt aber keine Sterne und Sticker.', 'The grown-up token plays along but gets no stars or stickers.'))),
      btn));
  }, { exempt: true });
}

function playBoard(players) {
  const racers = players.map(p => ({ p, pos: 0, stars: 0 }));
  let turn = 0;
  let deck = shuffle(data().board);
  const nextSet = () => { if (!deck.length) deck = shuffle(data().board); return deck.shift(); };
  go('board', (root, scope) => {
    const screen = h('div', { class: 'screen', style: { padding: '10px' } });
    root.append(screen);
    const chips = h('div', { class: 'row spacer', style: { justifyContent: 'center', gap: '6px', flexWrap: 'wrap' } });
    const area = h('div', { class: 'grow' });
    let askLeave = () => dialog(root, '🚪 ' + T('Kilépsz a játékból?', 'Möchtest du das Spiel beenden?', 'Do you want to leave the game?'),
      T('Ha kilépsz, a játék elölről kezdődik.', 'Wenn du gehst, beginnt das Spiel von vorn.', 'If you leave, the game starts again from the beginning.'),
      [['❌'], ['✅', enterApp]]);
    screen.append(h('div', { class: 'row' }, roundBtn('🏠', () => askLeave()), chips), noTimeBadge(false), area);
    const drawChips = () => {
      chips.innerHTML = '';
      racers.forEach((r, i) => chips.append(h('div', { style: { borderRadius: '14px', padding: '2px 6px', textAlign: 'center', background: i === turn ? '#fff' : '#ffffff80', border: (i === turn ? 3 : 1) + 'px solid ' + RACER_COLORS[i % 6] } },
        h('div', { style: { fontSize: i === turn ? '24px' : '19px' } }, r.p.avatar),
        h('div', { style: { fontSize: '8px' } }, [1, 2, 3, 4, 5].map(s => h('span', { style: { opacity: s <= r.stars ? 1 : .2 } }, '⭐'))))));
    };
    // ---- board drawing
    const cs = Math.floor(Math.min(area.clientWidth / BCOLS, area.clientHeight / BROWS)) || Math.floor(Math.min(innerWidth - 24, 860) / BCOLS);
    const boardEl = h('div', { style: { position: 'relative', margin: '0 auto' } });
    const left = i => cs * squarePlace(i)[0], top = i => cs * (BROWS - 1 - squarePlace(i)[1]);
    const cx = i => left(i) + cs * squarePlace(i)[2] / 2, cy = i => top(i) + cs / 2;
    const tokens = [];
    const layout = () => {
      const c = Math.floor(Math.min(area.clientWidth / BCOLS, area.clientHeight / BROWS));
      return c;
    };
    const buildBoard = c => {
      boardEl.innerHTML = '';
      boardEl.style.width = c * BCOLS + 'px'; boardEl.style.height = c * BROWS + 'px';
      const L_ = i => c * squarePlace(i)[0], T_ = i => c * (BROWS - 1 - squarePlace(i)[1]);
      let d = '';
      for (let i = 0; i <= GOAL; i++) d += (i ? 'L' : 'M') + (L_(i) + c * squarePlace(i)[2] / 2) + ' ' + (T_(i) + c / 2);
      boardEl.insertAdjacentHTML('beforeend', `<svg width="${c * BCOLS}" height="${c * BROWS}" style="position:absolute;left:0;top:0"><path d="${d}" fill="none" stroke="#ffffffbf" stroke-width="${c * .35}" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
      for (let i = 0; i <= GOAL; i++) {
        const sp = SPECIALS[i];
        const bg = i === 0 ? '#A5D6A7' : i === GOAL ? '#FFD54F' : sp ? sp.color : SQUARE_COLORS[i % 6];
        const sq = h('div', { class: 'center', style: { position: 'absolute', left: L_(i) + c * .06 + 'px', top: T_(i) + c * .06 + 'px', width: c * squarePlace(i)[2] - c * .12 + 'px', height: c * .88 + 'px', borderRadius: c * .2 + 'px', background: bg, boxShadow: '0 1px 3px #0003', fontSize: c * .45 + 'px' } });
        if (i === 0) sq.textContent = '🚩';
        else if (i === GOAL) sq.textContent = '🏆';
        else if (sp) { sq.append(sp.e, h('span', { style: { position: 'absolute', left: '3px', top: '1px', fontSize: c * .24 + 'px', fontWeight: 800, color: '#37474Fb0' } }, i)); if (sp.badge) sq.append(h('span', { style: { position: 'absolute', right: '3px', bottom: '1px', fontSize: c * .24 + 'px', fontWeight: 900, color: '#37474F' } }, sp.badge)); }
        else sq.append(h('span', { style: { fontSize: c * .3 + 'px', fontWeight: 800, color: '#37474Fb0' } }, i));
        boardEl.append(sq);
      }
      tokens.length = 0;
      racers.forEach((r, k) => {
        const t = h('div', { class: 'center', style: { position: 'absolute', borderRadius: '50%', background: '#fff', border: '3px solid ' + RACER_COLORS[k % 6], boxShadow: '0 3px 6px #0004', transition: 'left .3s, top .3s, width .3s, height .3s' } }, r.p.avatar);
        tokens.push(t); boardEl.append(t);
      });
      boardEl.c = c; boardEl.L_ = L_; boardEl.T_ = T_;
    };
    const placeTokens = () => {
      const c = boardEl.c;
      racers.forEach((r, k) => {
        const here = racers.map((x, i) => i).filter(i => racers[i].pos === r.pos); const n = here.length, j = here.indexOf(k);
        const ts = n === 1 ? c * .78 : c * .55;
        const dx = n === 1 ? 0 : c * (j % 2 === 0 ? -.2 : .2), dy = n <= 2 ? 0 : c * (Math.floor(j / 2) === 0 ? -.2 : .2);
        const x = boardEl.L_(r.pos) + c * squarePlace(r.pos)[2] / 2 + dx - ts / 2, y = boardEl.T_(r.pos) + c / 2 + dy - ts / 2;
        const t = tokens[k];
        Object.assign(t.style, { left: x + 'px', top: y + 'px', width: ts + 'px', height: ts + 'px', fontSize: ts * .6 + 'px', zIndex: k === turn ? 5 : 1, animation: k === turn ? 'bounce .8s ease-in-out infinite' : 'none' });
      });
    };
    area.append(h('div', { class: 'center', style: { height: '100%' } }, boardEl));
    buildBoard(layout()); placeTokens(); drawChips();

    const overlay = kids => { const ov = h('div', { class: 'overlay' }, kids); area.append(ov); return ov; };
    const listenBtn = fn => h('div', { class: 'listen calm', style: { fontSize: '28px', padding: '4px 18px' }, onclick: fn }, '🔊👂');
    const finishedFor = r => r.p.name ? TF('{0} beért a célba!', '{0} ist im Ziel!', '{0} has reached the finish!', r.p.name) : T('Beértél a célba!', 'Du bist im Ziel!', 'You reached the finish!');

    const rollPhase = () => {
      drawChips(); placeTokens();
      const r = racers[turn], color = RACER_COLORS[turn % 6];
      const text = r.p.name ? TF('{0}, dobj a kockával!', '{0}, du bist dran: Würfle!', '{0}, roll the dice!', r.p.name) : T('Dobj a kockával!', 'Würfle!', 'Roll the dice!');
      scope.later(300, () => Speech.say(text));
      let rolling = false;
      const die = h('div', { style: { cursor: 'pointer', animation: 'pulse 1.2s infinite', filter: 'drop-shadow(0 8px 12px #0004)' } });
      die.innerHTML = diceSvg(rnd(6) + 1, 140);
      const ov = overlay(h('div', { class: 'col' }, h('div', { style: { fontSize: '46px' } }, r.p.avatar),
        h('div', { style: { background: color, color: '#fff', fontWeight: 800, fontSize: '19px', padding: '6px 16px', borderRadius: '16px', textAlign: 'center' } }, text), die));
      die.onclick = async () => {
        if (rolling) return; rolling = true; die.style.animation = 'none';
        let v = 1, el = 0, step = 60; die.style.transition = 'transform 3s cubic-bezier(.2,.7,.3,1)'; die.style.transform = 'rotate(1440deg)';
        while (el < 2900) { v = rnd(6) + 1; die.innerHTML = diceSvg(v, 140); await scope.wait(step); el += step; step = Math.floor(step * 1.12); }
        v = rnd(6) + 1; die.innerHTML = diceSvg(v, 140);
        Speech.say(String(v));
        await scope.wait(1000);
        ov.remove();
        move(v);
      };
    };
    const move = async dice => {
      const r = racers[turn];
      const steps = Math.min(dice, GOAL - r.pos);
      for (let i = 0; i < steps; i++) { await scope.wait(380); r.pos++; placeTokens(); }
      await scope.wait(500);
      if (r.pos >= GOAL) return finish(r);
      const sp = SPECIALS[r.pos];
      if (sp) specialPhase(sp); else questionPhase();
    };
    const specialPhase = sp => {
      const r = racers[turn];
      scope.later(300, () => Speech.say(sp.text()));
      const ov = overlay(h('div', { class: 'dialog', style: { border: '4px solid ' + sp.color, alignItems: 'center' } },
        h('div', { class: 'row' }, h('span', { style: { fontSize: '40px' } }, r.p.avatar), h('span', { style: { fontSize: '62px', display: 'inline-block', animation: 'shake 1s infinite' } }, sp.e)),
        h('div', { class: 'h2', style: { color: '#37474F', fontSize: '26px' }, onclick: () => Speech.say(sp.text()) }, sp.text()),
        h('div', { class: 'row', style: { width: '100%' } }, listenBtn(() => Speech.say(sp.text())), bigBtn('✅  ' + T('Kész', 'Fertig', 'Done'), '#43A047', async () => {
          ov.remove();
          if (sp.again) return rollPhase();
          const target = clamp(r.pos + sp.steps, 0, GOAL);
          while (r.pos !== target) { await scope.wait(380); r.pos += target > r.pos ? 1 : -1; placeTokens(); }
          await scope.wait(500);
          if (r.pos >= GOAL) finish(r); else questionPhase();
        }, { flex: 1, fontSize: '21px' }))));
    };
    const questionPhase = () => {
      const r = racers[turn], color = RACER_COLORS[turn % 6];
      const qs = nextSet(); let qi = 0;
      const text = h('div', { style: { fontSize: '25px', fontWeight: 800, textAlign: 'center', lineHeight: 1.3, cursor: 'pointer' }, onclick: () => Speech.say(qs[qi]) });
      const dots = h('div', { class: 'row', style: { gap: '6px' } });
      const show = () => {
        text.textContent = qs[qi];
        dots.innerHTML = ''; for (let i = 0; i < 3; i++) dots.append(h('div', { style: { width: '16px', height: '16px', borderRadius: '50%', background: i <= qi ? color : '#0002' } }));
        scope.later(300, () => Speech.say(qs[qi]));
      };
      const ov = overlay(h('div', { class: 'dialog', style: { border: '4px solid ' + color, alignItems: 'center' } },
        h('div', { class: 'row' }, h('span', { style: { fontSize: '40px' } }, r.p.avatar), dots), text,
        h('div', { class: 'row', style: { width: '100%' } }, listenBtn(() => Speech.say(qs[qi])), bigBtn('✅  ' + T('Kész', 'Fertig', 'Done'), '#43A047', async () => {
          if (qi < 2) { qi++; show(); return; }
          ov.remove();
          r.stars = Math.min(r.stars + 1, 4); drawChips();
          Speech.say(praise());
          await scope.wait(1600);
          turn = (turn + 1) % racers.length;
          rollPhase();
        }, { flex: 1, fontSize: '21px' }))));
      show();
    };
    const finish = r => {
      r.stars = 5;
      let sticker = null;
      if (r.p.id !== -1) { Store.addStarsTo(r.p.id, 5); sticker = Store.awardStickerTo(r.p.id); }
      Speech.say(finishedFor(r) + (sticker ? ' ' + data().texts.newSticker : ''));
      askLeave = enterApp;
      screen.innerHTML = '';
      screen.append(h('div', { class: 'grow scroll center', style: { flexDirection: 'column', gap: '14px', padding: '14px' } },
        h('div', { style: { fontSize: '46px' } }, ['🎉', '🏆', '🎉'].map((e, i) => h('span', { class: 'bounce', style: { animationDelay: (i % 2) * .45 + 's' } }, e))),
        h('div', { style: { fontSize: '86px' } }, r.p.avatar), h('div', { class: 'title' }, finishedFor(r)), starsRow(5, 36),
        sticker ? h('div', { style: { fontWeight: 800, fontSize: '20px' } }, data().texts.newSticker) : null,
        sticker ? h('div', { class: 'pop', style: { fontSize: '86px' } }, sticker) : null,
        bigBtn('🎲  ' + T('Új játék', 'Neues Spiel', 'New game'), '#43A047', () => playBoard(players), { width: '100%' }),
        bigBtn('🏠', '#42A5F5', enterApp, { width: '100%' })));
    };
    rollPhase();
  }, { exempt: true });
}
