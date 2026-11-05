'use strict';
// The frame of every game: difficulty choice, stars, listen button, celebration.

const GAME_UIS = {}; // type -> function(round, ctx, area, scope)

function startGame(id) {
  if (id === 'BOARD') return showBoard();
  if (id === 'WORDS') return foreignPicker(f => runGame(id, null, f));
  if (game(id).difficulty) return difficultyPicker(id, band => runGame(id, band, null));
  runGame(id, null, null);
}

function difficultyPicker(id, onPick) {
  go('pick', (root, scope) => {
    const g = game(id);
    const q = id === 'MAZE' ? T('Milyen nehéz legyen a labirintus?', 'Wie schwer soll das Labyrinth sein?', 'How hard should the maze be?')
      : T('Milyen nehéz legyen?', 'Wie schwer soll es sein?', 'How hard should it be?');
    scope.later(250, () => Speech.say(q));
    const opts = [['🌱', T('Könnyű', 'Leicht', 'Easy'), '#66BB6A'], ['🌿', T('Közepes', 'Mittel', 'Medium'), '#FFA726'], ['🌳', T('Nehéz', 'Schwer', 'Hard'), '#EF5350']];
    root.append(h('div', { class: 'screen' },
      h('div', { class: 'row' }, roundBtn('🏠', showHome)),
      h('div', { style: { fontSize: '54px', textAlign: 'center' } }, g.emoji),
      h('div', { class: 'h2', onclick: () => Speech.say(q) }, q),
      h('div', { class: 'grow scroll col', style: { alignItems: 'stretch', gap: '14px', paddingTop: '10px' } },
        opts.map(([e, name, color], band) => h('div', {
          class: 'press', style: { height: '104px', borderRadius: '28px', background: color, display: 'flex', alignItems: 'center', gap: '16px', padding: '0 20px', color: '#fff', boxShadow: '0 4px 10px #0003', cursor: 'pointer', flex: 'none' },
          onclick: () => { Speech.say(name); onPick(band); }
        }, h('span', { style: { fontSize: '52px' } }, e),
          h('div', null, h('div', { style: { fontSize: '27px', fontWeight: 900 } }, name),
            h('div', { style: { fontSize: '16px', fontWeight: 700, opacity: .9 } }, levelLabel(`${band * 3 + 1}–${band * 3 + 3}`))))))));
  }, { counts: true });
}

function foreignPicker(onPick) {
  go('pick', (root, scope) => {
    const q = data().texts.pickLanguage;
    scope.later(250, () => Speech.say(q));
    root.append(h('div', { class: 'screen' },
      h('div', { class: 'row' }, roundBtn('🏠', showHome)),
      h('div', { style: { fontSize: '56px', textAlign: 'center' } }, '🗣️'),
      h('div', { class: 'h2', onclick: () => Speech.say(q) }, q),
      h('div', { class: 'grow scroll' }, h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '6px 2px 12px' } },
        data().langs.map((x, i) => i === L() ? null : h('div', { class: 'card center press', style: { height: '112px', flexDirection: 'column', cursor: 'pointer' }, onclick: () => onPick(i) },
          h('div', { style: { fontSize: '48px' } }, x.flag), h('b', null, x.name)))))));
  }, { counts: true });
}

function runGame(id, band, foreign) {
  const g = game(id);
  const topLevel = band != null ? band * 3 + 2 : g.maxLevel;
  let level = band != null ? Store.bandLevel(id, band) : Store.level(id);
  if (band != null) Store.setBandLevel(id, band, level);
  let stars = 0, roundNo = 0;
  // Questions already asked in this set of 5 stars (cleared for every new set).
  const asked = new Set();
  // Questions answered without a mistake in this difficulty (all its levels, kept for the player):
  // they don't come again on the next levels. Questions with a mistake come again in the next set.
  const bandKey = band ?? -1;
  const answered = new Set(Store.answeredKeys(id, bandKey));
  let missedThisSet = [];
  const replayQueue = [];
  const nextSet = () => {
    const seen = new Set();
    missedThisSet.forEach(r => { if (!seen.has(r.key)) { seen.add(r.key); replayQueue.push(r); } });
    missedThisSet = [];
  };

  go('game', (root, scope) => {
    const screen = h('div', { class: 'screen' });
    root.append(screen);
    let roundScope = null;

    const nextRound = () => {
      if (roundScope) roundScope.end();
      Speech.stop();
      roundScope = new Scope();
      scope.onEnd(() => roundScope.end());
      const rs = roundScope;
      let r = replayQueue.shift() || null;
      if (r) r = JSON.parse(JSON.stringify(r));
      else for (let t = 0; t < 60; t++) { r = JSON.parse(API.webRound(id, L(), level, roundNo, foreign ?? 3)); if (!asked.has(r.key) && !answered.has(r.key)) break; }
      asked.add(r.key);
      const thisRound = r;
      let solved = false, idle = null, hadMistake = false;
      const lang = L();
      const speakPrompt = () => Speech.sayParts(r.speech);
      const armIdle = () => {
        if (idle) clearTimeout(idle);
        if (!r.autoRepeat || solved) return;
        let n = 0;
        const tick = () => { idle = rs.later(10000, () => { if (solved) return; speakPrompt(); if (++n < 2) tick(); }); };
        tick();
      };
      const ctx = {
        round: r, level, lang, scope: rs, avatar: Store.current.avatar,
        touch() { armIdle(); },
        say(text, l = lang) { armIdle(); Speech.say(text, l); },
        repeatPrompt() { armIdle(); speakPrompt(); },
        wrong(spoken, l = lang) { armIdle(); if (!solved) hadMistake = true; Speech.sayParts([...(spoken ? [[spoken, l]] : []), [tryAgain(), lang]]); },
        /** A mistake without the "try again" sentence (the game says its own). */
        mistake() { if (!solved) hadMistake = true; },
        done(spoken, l = lang) {
          if (solved) return false;
          solved = true; stars++; Store.addSolved(id);
          if (hadMistake) missedThisSet.push(thisRound);
          else { answered.add(thisRound.key); Store.addAnswered(id, bandKey, thisRound.key); }
          if (idle) clearTimeout(idle);
          Speech.sayParts([...(spoken ? [[spoken, l]] : []), [praise(), lang]]);
          starsEl.replaceWith(starsEl = starsRow(stars));
          listen.classList.add('calm');
          rs.later(r.doneDelay, () => { if (stars >= 5) celebrate(); else { roundNo++; nextRound(); } });
          return true;
        },
      };
      let starsEl = starsRow(stars);
      const listen = h('div', { class: 'listen', onclick: () => ctx.repeatPrompt() }, '🔊👂');
      const area = h('div', { class: 'grow' });
      screen.innerHTML = '';
      if (innerWidth > innerHeight * 1.15) {
        // Sideways: the task text on the left, the game gets the full height on the right.
        const left = h('div', { class: 'col', style: { width: '27%', flex: 'none', gap: '10px', justifyContent: 'flex-start', paddingTop: '4px' } },
          h('div', { class: 'row', style: { width: '100%' } }, roundBtn('🏠', showHome), h('div', { class: 'level', style: { flex: 1, textAlign: 'right' } }, levelLabel(level + 1))),
          starsEl, timeBar(), listen, h('div', { class: 'prompt' }, r.prompt));
        left.querySelector('.timebar').style.width = '100%';
        screen.append(h('div', { style: { display: 'flex', gap: '12px', flex: 1, minHeight: 0 } }, left, area));
        area.style.flex = '1'; area.style.minWidth = '0';
      } else {
        screen.append(
          h('div', { class: 'row' }, roundBtn('🏠', showHome), h('div', { class: 'spacer center' }, starsEl), h('div', { class: 'level' }, levelLabel(level + 1))),
          timeBar(), listen, h('div', { class: 'prompt' }, r.prompt), area);
      }
      // Some games use the whole height: the starsEl reference must stay in the header.
      starsEl = screen.querySelector('.stars');
      if (r.autoSpeak) rs.later(300, speakPrompt);
      armIdle();
      requestAnimationFrame(() => { if (!rs.dead) (GAME_UIS[r.type] || (() => area.append('?')))(r, ctx, area, rs); });
    };

    const celebrate = () => {
      if (roundScope) roundScope.end();
      Store.addStars(5);
      const sticker = Store.awardSticker();
      const t = data().texts;
      Speech.say(t.reward + (sticker ? ' ' + t.newSticker : ''));
      const again = () => { nextSet(); stars = 0; asked.clear(); roundNo++; nextRound(); };
      screen.innerHTML = '';
      screen.append(h('div', { class: 'grow scroll center', style: { flexDirection: 'column', gap: '16px', padding: '10px 14px' } },
        h('div', { style: { fontSize: '46px' } }, ['🌟', '🎉', '🏆', '🎉', '🌟'].map((e, i) => h('span', { class: 'bounce', style: { animationDelay: (i % 2) * 0.45 + 's' } }, e))),
        h('div', { class: 'title' }, t.reward), starsRow(5, 36),
        sticker ? h('div', { style: { fontSize: '21px', fontWeight: 800 } }, t.newSticker) : null,
        sticker ? h('div', { class: 'pop' }, stickerEl(sticker, 90)) : null,
        bigBtn('▶  ' + t.more, '#43A047', again, { width: '100%' }),
        level < topLevel ? bigBtn('⬆️  ' + t.harder, '#FF7043', () => {
          level = Math.min(level + 1, topLevel);
          if (band != null) Store.setBandLevel(id, band, level); else Store.setLevel(id, level);
          again();
        }, { width: '100%' }) : h('div', { class: 'h2', style: { fontSize: '20px' } }, t.hardest),
        bigBtn('🏠', '#42A5F5', showHome, { width: '100%' })));
    };

    nextRound();
  }, { counts: true });
}
