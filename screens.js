'use strict';
// Start, home, album, players, parents, time up, calm balloon.

let welcomedFor = -1;

function showSplash() {
  go('splash', root => {
    root.append(h('div', { class: 'screen center', style: { flexDirection: 'column', gap: '18px' } },
      h('div', { style: { fontSize: '110px' } }, '🦉'),
      h('div', { class: 'title', style: { fontSize: '36px' } }, 'Clever Adventure'),
      h('div', { class: 'row', style: { justifyContent: 'center' } }, UI_LANGS.map(l => h('button', {
        class: 'pill' + (l === L() ? ' on' : ''), onclick: () => { Store.lang = l; showSplash(); }
      }, data().langs[l].flag + ' ' + data().langs[l].name))),
      h('button', {
        class: 'bigbtn', style: { background: '#43A047', fontSize: '40px', padding: '18px 60px', borderRadius: '40px' },
        onclick: () => {
          // iPhone: the first speech must start from a tap.
          try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
          if (Store.firstStart) showWelcome(); else enterApp();
        }
      }, '▶'),
      Speech.supported() ? null : h('div', { class: 'card', style: { padding: '10px 14px', textAlign: 'center', maxWidth: '360px', border: '2px solid #FFB300', fontWeight: 700 } },
        T('⚠️ Ebben az alkalmazásban nem működik a felolvasás. Nyisd meg a linket a böngészőben (Chrome, Safari).',
          '⚠️ In dieser App funktioniert die Sprachausgabe nicht. Öffne den Link im Browser (Chrome, Safari).',
          '⚠️ Speech does not work in this app. Open the link in your browser (Chrome, Safari).')),
      h('div', { class: 'small', style: { opacity: .6, textAlign: 'center', maxWidth: '320px' } },
        T('Kapcsold fel a hangot! 🔊 Az iPhone némító kapcsolója se legyen bekapcsolva.',
          'Schalte den Ton ein! 🔊 Der Stummschalter am iPhone sollte aus sein.',
          'Turn the sound on! 🔊 The mute switch on the iPhone should be off.'))
    ));
  });
}

function enterApp() { if (Store.remaining() <= 0) showTimeUp(); else showHome(); }

function showWelcome() {
  let avatar = AVATARS[0];
  go('welcome', root => {
    const input = h('input', { class: 'name', maxlength: '15', placeholder: T('Név (nem kötelező)', 'Name (optional)', 'Name (optional)') });
    const grid = h('div', { class: 'avatars' });
    const startBtn = bigBtn('', '#43A047', () => { Store.completeFirstStart(avatar, input.value || ''); welcomedFor = -1; showHome(); });
    const draw = () => {
      grid.innerHTML = '';
      AVATARS.forEach(a => grid.append(h('div', { class: 'av' + (a === avatar ? ' on' : ''), onclick: () => { avatar = a; draw(); } }, a)));
      startBtn.textContent = avatar + '  ' + T('Kezdjük!', "Los geht's!", "Let's go!");
    };
    draw();
    root.append(h('div', { class: 'screen scroll' },
      h('div', { class: 'col' }, h('div', { style: { fontSize: '56px' } }, '🦉'), h('div', { class: 'title' }, 'Clever Adventure')),
      h('div', { class: 'row', style: { justifyContent: 'center', flexWrap: 'wrap' } }, UI_LANGS.map(l => h('button', {
        class: 'pill' + (l === L() ? ' on' : ''), onclick: () => { Store.lang = l; showWelcome(); }
      }, data().langs[l].flag + ' ' + data().langs[l].name))),
      h('div', { class: 'h2', style: { color: '#37474F' } }, T('Ki játszik?', 'Wer spielt?', 'Who is playing?')),
      h('div', { style: { textAlign: 'center' } }, T('Válassz figurát:', 'Wähle eine Figur:', 'Pick a character:')),
      grid, input, startBtn));
  });
}

function showHome() {
  go('home', (root, scope) => {
    const p = Store.current;
    if (welcomedFor !== p.id) {
      welcomedFor = p.id;
      scope.later(300, () => Speech.say(p.name ? TF('Szia, {0}! Mit játsszunk?', 'Hallo {0}! Was spielen wir?', 'Hi {0}! What shall we play?', p.name) : data().texts.welcome));
    }
    const perRow = Math.min(innerWidth, 900) >= 600 ? 3 : 2;
    root.append(h('div', { class: 'screen' },
      h('div', { class: 'row' },
        roundBtn(p.avatar, () => parentGate(showPlayers)),
        h('span', { style: { fontSize: '22px', fontWeight: 800 } }, '⭐ ' + Store.stars),
        roundBtn('📒', showAlbum),
        h('div', { class: 'spacer' }),
        h('span', { style: { fontSize: '22px', opacity: .5, padding: '8px', cursor: 'pointer' }, onclick: () => parentGate(showParent) }, '⚙️')),
      h('div', { class: 'title' }, '🦉 Clever Adventure'),
      timeBar(),
      calmButton(showCalm),
      h('div', { class: 'grow scroll' },
        h('div', { class: 'tilegrid', style: { gridTemplateColumns: `repeat(${perRow}, 1fr)` } },
          data().games.map(g => h('div', { class: 'tile', style: { background: g.color }, onclick: () => startGame(g.id) },
            h('div', { class: 'e' }, g.emoji), h('div', { class: 't' }, g.title)))))));
  }, { counts: true });
}

function showAlbum() {
  go('album', root => {
    const owned = Store.stickers; const all = data().stickers;
    root.append(h('div', { class: 'screen' },
      h('div', { class: 'row' }, roundBtn('🏠', showHome),
        h('div', { class: 'h2', style: { flex: 1, textAlign: 'left' } }, Store.current.avatar + ' ' + data().texts.album),
        h('b', { style: { fontSize: '19px' } }, `${owned.length}/${all.length}`)),
      h('div', { class: 'grow scroll' }, h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', paddingBottom: '12px' } },
        all.map(e => h('div', {
          style: { aspectRatio: '1', borderRadius: '18px', background: owned.includes(e) ? '#fff' : '#ffffff73', fontSize: '44px' }, class: 'center'
        }, h('span', { class: owned.includes(e) ? '' : 'shadow', style: owned.includes(e) ? null : { opacity: .2 } }, e)))))));
  }, { counts: true });
}

function showTimeUp() {
  go('timeup', (root, scope) => {
    const morning = Store.isMorning();
    const text = morning ? data().texts.timeUpMorning : data().texts.timeUpAfternoon;
    scope.later(300, () => Speech.say(text));
    root.append(h('div', { class: 'screen center', style: { flexDirection: 'column', gap: '22px', padding: '28px' } },
      h('span', { style: { position: 'absolute', top: '14px', right: '14px', fontSize: '22px', opacity: .4, padding: '8px' }, onclick: () => parentGate(showParent) }, '⚙️'),
      h('div', { class: 'listen calm', style: { background: 'none', boxShadow: 'none', fontSize: '110px', animation: 'pulse 2.4s infinite' } }, morning ? '🌞' : '🌙'),
      h('div', { class: 'title' }, text),
      h('div', { style: { fontSize: '30px', fontWeight: 800 } }, `${Store.current.avatar}  ⭐ ${Store.stars}`),
      h('div', { style: { width: '100%' } }, calmButton(showCalm))));
  }, { exempt: true });
}

function parentGate(next) {
  const back = Store.remaining() <= 0 ? showTimeUp : showHome;
  go('gate', root => {
    const a = 6 + rnd(4), b = 5 + rnd(5), sum = a + b;
    const opts = shuffle([sum, ...shuffle([sum - 2, sum - 1, sum + 1, sum + 2]).slice(0, 3)]);
    root.append(h('div', { class: 'screen center', style: { flexDirection: 'column', gap: '22px', padding: '24px' } },
      h('div', { style: { fontSize: '26px', fontWeight: 800 } }, T('🔒 Szülői rész', '🔒 Elternbereich', '🔒 Parents only')),
      h('div', { class: 'title', style: { fontSize: '34px' } }, T('Mennyi', 'Wie viel ist', 'What is') + ` ${a} + ${b} ?`),
      h('div', { class: 'row', style: { width: '100%' } }, opts.map(o => bigBtn(String(o), '#7E57C2', () => (o === sum ? next() : back()), { flex: 1 }))),
      h('button', { class: 'textbtn', style: { color: '#37474F', fontSize: '19px' }, onclick: back }, T('Mégse', 'Abbrechen', 'Cancel'))));
  }, { exempt: true });
}

function fmt(sec) { return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }

function showParent() {
  go('parent', root => {
    const min = T('perc', 'Min.', 'min');
    const section = (title, ...kids) => h('div', { class: 'section' }, h('div', { class: 'st' }, title), ...kids);
    const minutesRow = (label, get, set) => {
      const val = h('b', { style: { fontSize: '19px', minWidth: '70px', textAlign: 'center' } }, `${get()} ${min}`);
      return h('div', { class: 'row' }, h('span', { style: { flex: 1, fontSize: '17px' } }, label),
        h('button', { class: 'pill', onclick: () => { set(Math.max(0, get() - 5)); val.textContent = `${get()} ${min}`; } }, '−'), val,
        h('button', { class: 'pill', onclick: () => { set(Math.min(60, get() + 5)); val.textContent = `${get()} ${min}`; } }, '+'));
    };
    const session = h('div', null);
    const drawSession = () => {
      session.textContent = (Store.isMorning() ? T('Reggeli alkalom', 'Morgens', 'Morning') : T('Délutáni alkalom', 'Nachmittags', 'Afternoon')) +
        ' · ' + T('eltelt', 'gespielt', 'played') + ' ' + fmt(Store.usedSeconds()) + ' · ' + T('hátra', 'übrig', 'left') + ' ' + fmt(Store.remaining());
    };
    drawSession();
    const l = L();
    root.append(h('div', { class: 'screen scroll', style: { gap: '12px' } },
      h('div', { style: { fontSize: '25px', fontWeight: 800 } }, T('⚙️ Szülői beállítások', '⚙️ Einstellungen für Eltern', '⚙️ Parent settings')),
      section(T('Nyelv', 'Sprache', 'Language'),
        h('div', { class: 'row', style: { flexWrap: 'wrap' } }, UI_LANGS.map(x => h('button', {
          class: 'pill' + (x === l ? ' on' : ''), onclick: () => { Store.lang = x; showParent(); }
        }, data().langs[x].flag + ' ' + data().langs[x].name))),
        h('div', { class: 'small' }, T('Minden szöveg és felolvasás csak ezen a nyelven szól. Kivétel az „Idegen szavak” játék: ott egy másik nyelv szavait gyakorolja.',
          'Alle Texte und Ansagen sind nur in dieser Sprache. Ausnahme ist das Spiel „Fremde Wörter“: Dort übt das Kind die Wörter einer anderen Sprache.',
          'All texts and speech use only this language. The exception is the “Other languages” game, where your child practises the words of another language.'))),
      section(T('Játékosok', 'Spieler', 'Players'),
        h('div', { style: { fontSize: '18px' } }, Store.players.map(p => p.avatar + (p.name ? ' ' + p.name : '')).join('   ')),
        bigBtn(T('Játékosok kezelése', 'Spieler verwalten', 'Manage players'), '#7E57C2', showPlayers, { fontSize: '18px' })),
      section(T('Játékidő', 'Spielzeit', 'Play time'),
        minutesRow(T('🌞 Reggel', '🌞 Morgens', '🌞 Morning'), () => Store.morning, v => { Store.morning = v; drawSession(); }),
        minutesRow(T('🌙 Délután', '🌙 Nachmittags', '🌙 Afternoon'), () => Store.afternoon, v => { Store.afternoon = v; drawSession(); }),
        h('div', { class: 'small' }, T('Reggel = 12:00 előtt, délután = 12:00 után. 0 perc: abban a napszakban nincs játék. Az idő csak akkor fogy, amikor a játék a képernyőn van. Minden játékosnak külön jár az idő.',
          'Morgens = vor 12:00, nachmittags = ab 12:00. 0 Minuten: in dieser Tageszeit kein Spiel. Die Zeit läuft nur, wenn das Spiel auf dem Bildschirm ist. Jeder Spieler hat seine eigene Zeit.',
          'Morning = before 12:00, afternoon = from 12:00. 0 minutes: no play at that time of day. Time only runs while the game is on screen. Each player has their own time.'))),
      section(T('Mostani alkalom', 'Aktuelle Spielzeit', 'Current session') + ' – ' + Store.current.avatar, session,
        bigBtn(T('Idő visszaállítása most', 'Zeit jetzt zurücksetzen', 'Reset time now'), '#FF7043', () => { Store.resetSession(); drawSession(); }, { fontSize: '18px' })),
      section(T('Felolvasó hang', 'Sprachausgabe', 'Voice'),
        h('div', null, data().langs[l].flag + ' ' + data().langs[l].name + ': ' + (Speech.has(l) ? T('✅ elérhető', '✅ verfügbar', '✅ available') : T('⚠️ nem található', '⚠️ nicht gefunden', '⚠️ not found'))),
        h('div', { class: 'small' }, T('iPhone-on: Beállítások → Kisegítő lehetőségek → Felolvasott tartalom → Hangok. Ott letölthetsz jobb minőségű hangot is.',
          'iPhone: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen. Dort kannst du auch bessere Stimmen laden.',
          'iPhone: Settings → Accessibility → Spoken Content → Voices. You can also download better voices there.')),
        bigBtn('🔊 ' + T('Próba', 'Test', 'Test'), '#42A5F5', () => Speech.say(data().texts.welcome), { fontSize: '18px' })),
      section(T('Haladás', 'Fortschritt', 'Progress') + ' – ' + Store.current.avatar,
        ...data().games.map(g => h('div', null, `${g.emoji} ${g.title}: ${Store.solved(g.id)} ` + T('jó válasz', 'richtig', 'correct') + ' · ' + levelLabel(Store.bestLevel(g.id) + 1))),
        h('div', null, T('Összes csillag', 'Sterne gesamt', 'Total stars') + ': ⭐ ' + Store.stars)),
      section(T('Tipp', 'Tipp', 'Tip'), h('div', { class: 'small' }, T(
        'Safariban: Megosztás → „Főképernyőhöz adás”, így a játék saját ikonnal, teljes képernyőn indul. Az iPhone „Irányított hozzáférés” funkciójával a gyerek nem tud kilépni.',
        'In Safari: Teilen → „Zum Home-Bildschirm“, dann startet das Spiel mit eigenem Symbol im Vollbild. Mit „Geführter Zugriff“ am iPhone kann das Kind das Spiel nicht verlassen.',
        'In Safari: Share → “Add to Home Screen”, then the game starts full screen with its own icon. With the iPhone’s “Guided Access” your child can’t leave the game.'))),
      bigBtn(T('Vissza', 'Zurück', 'Back'), '#7E57C2', enterApp),
      h('div', { style: { height: '20px', flex: 'none' } })));
  }, { exempt: true });
}

function showPlayers() {
  go('players', root => {
    const screen = h('div', { class: 'screen' });
    const draw = () => {
      screen.innerHTML = '';
      const cells = [...Store.players, ...(Store.players.length < MAX_PLAYERS ? [null] : [])];
      const grid = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingBottom: '12px' } });
      cells.forEach(p => {
        if (!p) {
          grid.append(h('div', { class: 'card center press', style: { height: '180px', flexDirection: 'column', border: '3px dashed #B39DDB', background: '#ffffffaa', cursor: 'pointer' }, onclick: addDialog },
            h('div', { style: { fontSize: '46px' } }, '➕'), h('b', { class: 'purple' }, T('Új játékos', 'Neuer Spieler', 'New player'))));
          return;
        }
        const sel = p.id === Store.current.id;
        const card = h('div', {
          class: 'card center press', style: { height: '180px', flexDirection: 'column', position: 'relative', cursor: 'pointer', background: sel ? '#E1F5FE' : '#fff', border: sel ? '4px solid #7E57C2' : '4px solid transparent' },
          onclick: () => { Store.select(p.id); welcomedFor = -1; enterApp(); }
        }, h('div', { style: { fontSize: '62px' } }, p.avatar), p.name ? h('b', { style: { fontSize: '19px' } }, p.name) : null,
          h('div', null, `⭐ ${Store.starsOf(p.id)}   📒 ${Store.stickersOf(p.id).length}`));
        card.append(h('div', { class: 'center', style: { position: 'absolute', top: '8px', left: '8px', width: '32px', height: '32px', borderRadius: '50%', background: '#0002' }, onclick: e => { e.stopPropagation(); resetDialog(p); } }, '🔄'));
        if (Store.players.length > 1) card.append(h('div', { class: 'center', style: { position: 'absolute', top: '8px', right: '8px', width: '32px', height: '32px', borderRadius: '50%', background: '#0002' }, onclick: e => { e.stopPropagation(); deleteDialog(p); } }, '✕'));
        grid.append(card);
      });
      screen.append(h('div', { class: 'row' }, roundBtn('🏠', enterApp), h('div', { class: 'title', style: { flex: 1 } }, T('Ki játszik?', 'Wer spielt?', 'Who is playing?')), h('div', { style: { width: '52px' } })),
        h('div', { class: 'grow scroll' }, grid));
    };
    const addDialog = () => {
      const used = Store.players.map(p => p.avatar);
      let avatar = AVATARS.find(a => !used.includes(a)) || AVATARS[0];
      const g = h('div', { class: 'avatars' });
      const drawAv = () => { g.innerHTML = ''; AVATARS.forEach(a => g.append(h('div', { class: 'av' + (a === avatar ? ' on' : ''), style: { fontSize: '28px' }, onclick: () => { avatar = a; drawAv(); } }, a))); };
      drawAv();
      const input = h('input', { class: 'name', maxlength: '15', placeholder: T('Név (nem kötelező)', 'Name (optional)', 'Name (optional)') });
      dialog(root, T('Új játékos', 'Neuer Spieler', 'New player'), h('div', { class: 'col', style: { alignItems: 'stretch' } }, h('div', null, T('Válassz figurát:', 'Wähle eine Figur:', 'Pick a character:')), g, input),
        [[T('Mégse', 'Abbrechen', 'Cancel')], [T('Mentés', 'Speichern', 'Save'), () => { Store.addPlayer(avatar, input.value || ''); draw(); }]]);
    };
    const resetDialog = p => dialog(root, `${p.avatar} ${p.name}`, h('div', null, T('Mit szeretnél újrakezdeni?', 'Was soll neu beginnen?', 'What should start over?'),
      h('div', { class: 'small', style: { opacity: .7, marginTop: '6px' } }, T('A játékidő nem változik.', 'Die Spielzeit bleibt gleich.', 'Play time is not changed.'))), [
      [T('📒 Csak a matricaalbum', '📒 Nur das Stickeralbum', '📒 Only the sticker album'), () => { Store.resetPlayer(p.id, false); draw(); }],
      [T('🔄 Minden (csillagok, matricák, szintek)', '🔄 Alles (Sterne, Sticker, Stufen)', '🔄 Everything (stars, stickers, levels)'), () => { Store.resetPlayer(p.id, true); draw(); }, '#E53935'],
      [T('Mégse', 'Abbrechen', 'Cancel')]]);
    const deleteDialog = p => dialog(root, `${p.avatar} ${p.name}`, T('Biztosan törlöd ezt a játékost? Minden csillaga és matricája elvész.', 'Diesen Spieler wirklich löschen? Alle Sterne und Sticker gehen verloren.', 'Really delete this player? All stars and stickers will be lost.'),
      [[T('Mégse', 'Abbrechen', 'Cancel')], [T('Törlés', 'Löschen', 'Delete'), () => { Store.deletePlayer(p.id); draw(); }, '#E53935']]);
    draw();
    root.append(screen);
  }, { exempt: true });
}

// ---------------------------------------------------------------- calm balloon
function showCalm() {
  const title = T('Nyugi-lufi', 'Ruhe-Ballon', 'Calm balloon');
  const back = () => enterApp();
  go('calm', (root, scope) => {
    const body = h('div', { class: 'grow center', style: { flexDirection: 'column', gap: '16px' } });
    root.append(h('div', { class: 'screen' }, h('div', { class: 'row' }, roundBtn('🏠', back), h('div', { class: 'h2' }, '🎈 ' + title)), body));
    const howMany = T('Hány levegőt veszünk?', 'Wie oft atmen wir?', 'How many breaths?');
    const choose = () => {
      body.innerHTML = '';
      scope.later(200, () => Speech.calm(howMany));
      body.append(h('div', { class: 'h2', style: { color: '#37474F' } }, howMany),
        ...[3, 5].map(n => h('div', { class: 'card center press', style: { width: '100%', height: '120px', flexDirection: 'column', cursor: 'pointer' }, onclick: () => breathe(n) },
          h('div', { style: { fontSize: '36px' } }, '🎈'.repeat(n)), h('b', { class: 'purple', style: { fontSize: '22px' } }, n))));
    };
    const breathe = async count => {
      body.innerHTML = '';
      const ball = h('div', { class: 'center', style: { width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(#FFF59D, #FFB74D, #F06292)', fontSize: '90px', transform: 'scale(.45)', transition: 'transform 4s cubic-bezier(.4,0,.2,1)' } }, '🎈');
      const label = h('div', { class: 'h2' }, '');
      const dots = h('div', { style: { fontSize: '26px' } });
      const drawDots = d => { dots.textContent = Array.from({ length: count }, (_, i) => (i < d ? '🟢' : '⚪')).join(' '); };
      drawDots(0);
      body.append(ball, label, dots);
      Speech.calm(T('Lélegezzünk együtt! Figyeld a lufit.', 'Lass uns zusammen atmen! Schau auf den Ballon.', "Let's breathe together! Watch the balloon."));
      await scope.wait(3500);
      for (let i = 0; i < count; i++) {
        const inT = T('Lélegezz be…', 'Einatmen…', 'Breathe in…'), outT = T('…és ki.', '…und aus.', '…and out.');
        label.textContent = inT; Speech.calm(inT); ball.style.transition = 'transform 4s cubic-bezier(.4,0,.2,1)'; ball.style.transform = 'scale(1)';
        await scope.wait(4000);
        label.textContent = outT; Speech.calm(outT); ball.style.transition = 'transform 5s cubic-bezier(.4,0,.2,1)'; ball.style.transform = 'scale(.45)';
        await scope.wait(5000);
        drawDots(i + 1);
      }
      const done = T('Ügyes voltál! Most nyugodtabb vagy?', 'Gut gemacht! Fühlst du dich jetzt ruhiger?', 'Well done! Do you feel calmer now?');
      Speech.calm(done);
      body.innerHTML = '';
      body.append(h('div', { style: { fontSize: '110px' } }, '😌'), h('div', { class: 'h2' }, done),
        h('div', { class: 'row' }, h('div', { class: 'card center press', style: { width: '110px', height: '90px', fontSize: '44px', cursor: 'pointer' }, onclick: choose }, '🔁'),
          h('div', { class: 'card center press', style: { width: '110px', height: '90px', fontSize: '44px', cursor: 'pointer' }, onclick: back }, '🏠')));
    };
    choose();
  }, { exempt: true });
}
