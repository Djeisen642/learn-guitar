import { CHORDS, CHORD_BY_ID, STAGES, PROGRESSIONS, STRUMS } from './data.js';
import { chordDiagram } from './diagram.js';
import { strum, arpeggiate, click, unlockAudio, now } from './audio.js';
import * as store from './store.js';
import { FretboardView } from './fretboard.js';
import * as haptics from './haptics.js';

const view = document.getElementById('view');
const sheet = document.getElementById('sheet');
const backdrop = document.getElementById('backdrop');

// Anything a view starts (timers, metronomes) registers here so navigating away
// reliably stops it.
let teardown = [];
const onLeave = (fn) => teardown.push(fn);
function runTeardown() {
  teardown.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  teardown = [];
}

// Timed drills are useless if the phone dims mid-count, so hold a screen wake
// lock while one is running. Unsupported browsers just carry on without it.
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on) {
      if (!wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    } else if (wakeLock) {
      const held = wakeLock;
      wakeLock = null;
      await held.release();
    }
  } catch {
    wakeLock = null; // denied or released by the system — not worth surfacing
  }
}

/** Run `stop` if the user switches away, so metronomes don't burst on return. */
function stopWhenHidden(stop) {
  const onHide = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', onHide);
  return () => document.removeEventListener('visibilitychange', onHide);
}

// --- tiny DOM helper -------------------------------------------------------
function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return node;
}

const go = (hash) => { location.hash = hash; };

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function chordCard(chord, { onClick } = {}) {
  const card = h('button', {
    class: 'chord-card' + (store.isLearned(chord.id) ? ' is-learned' : ''),
    type: 'button',
    onclick: onClick || (() => go(`#/chord/${chord.id}`)),
  },
    h('span', { class: 'chord-card-name' }, chord.name),
  );
  card.insertBefore(chordDiagram(chord), card.firstChild);
  if (store.isLearned(chord.id)) card.appendChild(h('span', { class: 'tick', 'aria-label': 'Learned' }, '✓'));
  return card;
}

function sectionTitle(text, sub) {
  return h('div', { class: 'sec' },
    h('h2', {}, text),
    sub ? h('p', { class: 'sec-sub' }, sub) : null,
  );
}

// ---------------------------------------------------------------------------
// Learn
// ---------------------------------------------------------------------------

function LearnView() {
  const total = CHORDS.length;
  const done = store.learnedCount();

  const frag = h('div', { class: 'page' },
    h('section', { class: 'hero' },
      h('h2', {}, 'Learn chords, one stage at a time'),
      h('p', {}, 'Work down the list. Each stage only uses shapes from the stages above it, and every chord has a sound button so you can check yourself.'),
      h('div', { class: 'progress' },
        h('div', { class: 'progress-bar' }, h('i', { style: `width:${Math.round((done / total) * 100)}%` })),
        h('span', { class: 'progress-label' }, `${done} of ${total} chords marked learned`),
      ),
    ),
  );

  STAGES.forEach((stage, i) => {
    const stageChords = stage.chords.map((id) => CHORD_BY_ID[id]).filter(Boolean);
    const stageDone = stageChords.filter((c) => store.isLearned(c.id)).length;

    frag.appendChild(h('section', { class: 'stage' },
      h('header', { class: 'stage-head' },
        h('span', { class: 'stage-num' }, String(i + 1)),
        h('div', {},
          h('h3', {}, stage.title),
          h('p', { class: 'stage-count' }, `${stageDone}/${stageChords.length} learned`),
        ),
      ),
      h('p', { class: 'stage-blurb' }, stage.blurb),
      h('div', { class: 'chord-grid' }, stageChords.map((c) => chordCard(c))),
      h('div', { class: 'stage-goal' },
        h('strong', {}, 'Goal: '), stage.goal,
      ),
      h('div', { class: 'chip-row' }, stage.changes.map(([a, b]) => {
        const best = store.bestChanges(a, b);
        return h('a', { class: 'chip', href: `#/practice/omc/${a}/${b}` },
          `${CHORD_BY_ID[a]?.name || a} ↔ ${CHORD_BY_ID[b]?.name || b}`,
          best ? h('b', {}, String(best)) : null,
        );
      })),
      stage.songs?.length ? h('p', { class: 'stage-song' }, stage.songs[0]) : null,
    ));
  });

  return frag;
}

// ---------------------------------------------------------------------------
// Chord library
// ---------------------------------------------------------------------------

const GROUPS = ['All', 'Major', 'Minor', '7th', 'Sus / add', 'Power', 'Learned'];
let chordFilter = 'All';
let chordQuery = '';

function ChordsView() {
  const grid = h('div', { class: 'chord-grid' });

  function paint() {
    grid.textContent = '';
    const q = chordQuery.trim().toLowerCase();
    const list = CHORDS.filter((c) => {
      if (chordFilter === 'Learned' && !store.isLearned(c.id)) return false;
      if (chordFilter !== 'All' && chordFilter !== 'Learned' && c.group !== chordFilter) return false;
      if (q && !(c.name.toLowerCase().includes(q) || c.full.toLowerCase().includes(q))) return false;
      return true;
    });
    if (!list.length) {
      grid.appendChild(h('p', { class: 'empty' }, 'Nothing matches that.'));
      return;
    }
    list.forEach((c) => grid.appendChild(chordCard(c)));
  }

  const filters = h('div', { class: 'filters' }, GROUPS.map((g) =>
    h('button', {
      type: 'button',
      class: 'filter' + (g === chordFilter ? ' is-on' : ''),
      onclick: (e) => {
        chordFilter = g;
        [...filters.children].forEach((b) => b.classList.toggle('is-on', b === e.currentTarget));
        paint();
      },
    }, g)));

  const search = h('input', {
    class: 'search', type: 'search', placeholder: 'Search chords…',
    value: chordQuery, 'aria-label': 'Search chords',
    oninput: (e) => { chordQuery = e.target.value; paint(); },
  });

  paint();
  return h('div', { class: 'page' },
    sectionTitle('Chord library', `${CHORDS.length} shapes. Tap any chord to hear it and read the technique tip.`),
    search,
    filters,
    grid,
  );
}

// ---------------------------------------------------------------------------
// Chord detail sheet
// ---------------------------------------------------------------------------

function openSheet(id) {
  const chord = CHORD_BY_ID[id];
  if (!chord) return closeSheet();

  const learnedBtn = h('button', {
    type: 'button',
    class: 'btn' + (store.isLearned(id) ? ' btn-on' : ''),
    onclick: () => {
      const on = store.toggleLearned(id);
      learnedBtn.classList.toggle('btn-on', on);
      learnedBtn.textContent = on ? '✓ Learned' : 'Mark as learned';
    },
  }, store.isLearned(id) ? '✓ Learned' : 'Mark as learned');

  const fingerNames = ['—', 'index', 'middle', 'ring', 'pinky'];
  const rows = ['E', 'A', 'D', 'G', 'B', 'e'].map((s, i) => {
    const f = chord.frets[i];
    const where = f === -1 ? 'muted' : f === 0 ? 'open' : `fret ${f}`;
    const who = f > 0 ? ` · ${fingerNames[chord.fingers?.[i] || 0]}` : '';
    return h('li', { class: f === -1 ? 'is-muted' : '' },
      h('b', {}, s === 'e' ? 'e (high)' : s), `${where}${who}`);
  });

  sheet.textContent = '';
  sheet.append(
    h('button', { class: 'sheet-close', type: 'button', 'aria-label': 'Close', onclick: dismissSheet }, '✕'),
    h('div', { class: 'sheet-head' },
      h('h2', {}, chord.name),
      h('p', {}, chord.full),
    ),
    h('div', { class: 'sheet-diagram' }, chordDiagram(chord)),
    h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => strum(chord) }, '▶︎ Strum'),
      h('button', { class: 'btn', type: 'button', onclick: () => arpeggiate(chord) }, 'One string at a time'),
    ),
    h('p', { class: 'tip' }, chord.tip),
    h('ul', { class: 'stringlist' }, rows),
    learnedBtn,
    h('div', { class: 'sheet-links' },
      h('a', { class: 'chip', href: `#/practice/omc/${chord.id}/` }, 'Drill changes with this chord'),
    ),
  );

  sheet.hidden = false;
  backdrop.hidden = false;
  document.body.classList.add('sheet-open');
  sheet.scrollTop = 0;
}

// True once a normal tab has rendered, so we know going back stays in the app.
// Someone opening a shared #/chord/… link directly would otherwise be thrown
// off the site by the close button.
let hasRoutedInApp = false;

function dismissSheet() {
  if (hasRoutedInApp) history.back();
  else go('#/chords');
}

function closeSheet() {
  sheet.hidden = true;
  backdrop.hidden = true;
  document.body.classList.remove('sheet-open');
}

backdrop.addEventListener('click', dismissSheet);

// ---------------------------------------------------------------------------
// Practice hub
// ---------------------------------------------------------------------------

function PracticeView() {
  return h('div', { class: 'page' },
    sectionTitle('Practice', 'Short, focused drills. Ten minutes of these beats an hour of noodling.'),
    h('div', { class: 'tool-list' },
      h('a', { class: 'tool', href: '#/practice/omc' },
        h('h3', {}, 'One-minute changes'),
        h('p', {}, 'Pick two chords and swap between them for sixty seconds. Count every clean change. This is the single fastest way to stop stalling between chords.'),
      ),
      h('a', { class: 'tool', href: '#/practice/drill' },
        h('h3', {}, 'Chord changer'),
        h('p', {}, 'A metronome calls out chords at your tempo. Trains you to change in time rather than whenever you happen to be ready.'),
      ),
      h('a', { class: 'tool', href: '#/practice/strum' },
        h('h3', {}, 'Strumming patterns'),
        h('p', {}, 'Four patterns with a click track and a moving down/up guide.'),
      ),
    ),
    h('div', { class: 'note' },
      h('h3', {}, 'A 10-minute routine'),
      h('ol', {},
        h('li', {}, '2 min — play each chord you know and check every string rings'),
        h('li', {}, '4 min — one-minute changes on four pairs'),
        h('li', {}, '3 min — chord changer on a progression from the Songs tab'),
        h('li', {}, '1 min — play something you enjoy, badly, and finish smiling'),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// One-minute changes
// ---------------------------------------------------------------------------

function OmcView(a, b) {
  let chordA = CHORD_BY_ID[a] ? a : 'G';
  let chordB = CHORD_BY_ID[b] && b !== chordA ? b : (chordA === 'C' ? 'G' : 'C');

  let count = 0;
  let running = false;
  let remaining = 60;
  let tick = null;

  const timeEl = h('div', { class: 'omc-time' }, '60');
  const countEl = h('div', { class: 'omc-count' }, '0');
  const bestEl = h('div', { class: 'omc-best' });
  const tapBtn = h('button', { class: 'tap', type: 'button' });
  const startBtn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Start');

  function refreshBest() {
    const best = store.bestChanges(chordA, chordB);
    bestEl.textContent = best ? `Best: ${best} changes/min` : 'No score yet — set one.';
  }

  function stop(finished) {
    running = false;
    clearInterval(tick);
    tick = null;
    keepAwake(false);
    tapBtn.classList.remove('is-live');
    startBtn.textContent = 'Start';
    if (finished) {
      const isBest = store.recordChanges(chordA, chordB, count);
      store.touchStreak();
      paintStreak();
      tapBtn.textContent = isBest ? 'New best!' : 'Time!';
      haptics.finished();
      bestEl.textContent = isBest
        ? `New best: ${count} changes/min`
        : `${count} this round · best ${store.bestChanges(chordA, chordB)}`;
      click(true);
    }
  }

  function start() {
    if (running) return stop(false);
    unlockAudio();
    count = 0;
    remaining = 60;
    countEl.textContent = '0';
    timeEl.textContent = '60';
    running = true;
    startBtn.textContent = 'Stop';
    tapBtn.classList.add('is-live');
    tapBtn.textContent = 'Tap on every change';
    click(true);
    keepAwake(true);

    // Count down against a wall-clock deadline: a plain 1s interval drifts and
    // stalls outright while the phone is asleep or the tab is backgrounded.
    const deadline = Date.now() + 60_000;
    let lastShown = 60;
    tick = setInterval(() => {
      remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remaining !== lastShown) {
        lastShown = remaining;
        timeEl.textContent = String(remaining);
        if (remaining <= 5 && remaining > 0) click(false);
      }
      if (remaining <= 0) stop(true);
    }, 200);
    onLeave(() => { clearInterval(tick); keepAwake(false); });
  }

  startBtn.addEventListener('click', start);

  const registerTap = () => {
    if (!running) return start();
    count += 1;
    countEl.textContent = String(count);
    haptics.count();
    tapBtn.classList.add('is-hit');
    setTimeout(() => tapBtn.classList.remove('is-hit'), 90);
  };
  // pointerdown, not click: counting changes should feel instant under a thumb.
  tapBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); registerTap(); });
  // Keyboard-generated clicks have detail 0, so this won't double-count taps.
  tapBtn.addEventListener('click', (e) => { if (e.detail === 0) registerTap(); });
  tapBtn.textContent = 'Tap to start';

  const diagrams = h('div', { class: 'omc-pair' });
  function paintPair() {
    diagrams.textContent = '';
    [chordA, chordB].forEach((id, i) => {
      const c = CHORD_BY_ID[id];
      const box = h('button', { class: 'omc-chord', type: 'button', onclick: () => strum(c) },
        h('span', { class: 'omc-label' }, c.name));
      box.insertBefore(chordDiagram(c), box.firstChild);
      diagrams.appendChild(box);
      if (i === 0) diagrams.appendChild(h('span', { class: 'omc-arrows' }, '⇄'));
    });
    refreshBest();
  }

  const pick = (which) => h('select', {
    class: 'select',
    'aria-label': which === 'a' ? 'First chord' : 'Second chord',
    onchange: (e) => {
      if (which === 'a') chordA = e.target.value; else chordB = e.target.value;
      paintPair();
    },
  }, CHORDS.map((c) => h('option', {
    value: c.id, selected: (which === 'a' ? chordA : chordB) === c.id,
  }, c.full)));

  paintPair();

  return h('div', { class: 'page' },
    h('a', { class: 'back', href: '#/practice' }, '‹ Practice'),
    sectionTitle('One-minute changes', 'Sixty seconds, one pair of chords. Tap the pad each time you land a change with every note ringing.'),
    h('div', { class: 'pickers' }, pick('a'), h('span', { class: 'pickers-sep' }, '↔'), pick('b')),
    diagrams,
    h('div', { class: 'omc-stats' },
      h('div', {}, timeEl, h('span', {}, 'seconds left')),
      h('div', {}, countEl, h('span', {}, 'changes')),
    ),
    tapBtn,
    bestEl,
    startBtn,
    h('div', { class: 'note' },
      h('p', {}, 'A change only counts if the chord sounds. Beginners usually start around 10–15; 30 is comfortable, 60 is fluent. Do one pair, rest your hand, then move on.'),
    ),
  );
}

// ---------------------------------------------------------------------------
// Chord changer drill (metronome + prompts)
// ---------------------------------------------------------------------------

function DrillView() {
  // The Songs tab can hand us a progression to load.
  let selected = drillPreset?.length ? drillPreset.slice() : ['G', 'C', 'D'];
  drillPreset = null;
  let bpm = 70;
  let barsPer = 1;
  let running = false;
  let timer = null;
  let beat = 0;
  let idx = 0;
  let nextNoteTime = 0;

  const nowEl = h('div', { class: 'drill-now' });
  const nextEl = h('div', { class: 'drill-next' });
  const beatEl = h('div', { class: 'beats' }, [0, 1, 2, 3].map(() => h('i')));

  function paintChords() {
    if (!selected.length) return;
    const cur = CHORD_BY_ID[selected[idx % selected.length]];
    const nxt = CHORD_BY_ID[selected[(idx + 1) % selected.length]];
    nowEl.textContent = '';
    nowEl.appendChild(chordDiagram(cur));
    nowEl.appendChild(h('span', { class: 'drill-name' }, cur.name));
    nextEl.textContent = '';
    nextEl.appendChild(h('span', { class: 'drill-next-label' }, 'next'));
    nextEl.appendChild(h('span', { class: 'drill-next-name' }, nxt.name));
  }

  function scheduler() {
    const spb = 60 / bpm;
    while (nextNoteTime < now() + 0.15) {
      const accent = beat % 4 === 0;
      click(accent, nextNoteTime);
      const thisBeat = beat;
      const when = nextNoteTime;
      setTimeout(() => {
        [...beatEl.children].forEach((el, i) => el.classList.toggle('is-on', i === thisBeat % 4));
        if (thisBeat % (4 * barsPer) === 0 && thisBeat > 0) {
          idx += 1;
          paintChords();
        }
      }, Math.max(0, (when - now()) * 1000));
      beat += 1;
      nextNoteTime += spb;
    }
  }

  const startBtn = h('button', { class: 'btn btn-primary btn-wide', type: 'button' }, 'Start');
  function stopDrill() {
    if (!running) return;
    running = false;
    clearInterval(timer);
    keepAwake(false);
    startBtn.textContent = 'Start';
    [...beatEl.children].forEach((el) => el.classList.remove('is-on'));
  }
  function toggle() {
    if (running) return stopDrill();
    if (selected.length < 2) return;
    unlockAudio();
    running = true;
    beat = 0;
    idx = 0;
    paintChords();
    nextNoteTime = now() + 0.2;
    startBtn.textContent = 'Stop';
    store.touchStreak();
    paintStreak();
    keepAwake(true);
    timer = setInterval(scheduler, 25);
    onLeave(() => { clearInterval(timer); keepAwake(false); });
  }
  startBtn.addEventListener('click', toggle);
  onLeave(stopWhenHidden(stopDrill));

  const chips = h('div', { class: 'chip-row wrap' }, CHORDS.map((c) =>
    h('button', {
      type: 'button',
      class: 'chip toggle' + (selected.includes(c.id) ? ' is-on' : ''),
      onclick: (e) => {
        if (selected.includes(c.id)) selected = selected.filter((x) => x !== c.id);
        else selected = [...selected, c.id];
        e.currentTarget.classList.toggle('is-on', selected.includes(c.id));
        if (selected.length < 2) stopDrill();
        if (!running) { idx = 0; paintChords(); }
      },
    }, c.name)));

  const bpmLabel = h('output', {}, `${bpm} bpm`);
  const bpmInput = h('input', {
    type: 'range', min: '40', max: '160', step: '2', value: String(bpm), class: 'range',
    'aria-label': 'Tempo',
    oninput: (e) => { bpm = +e.target.value; bpmLabel.textContent = `${bpm} bpm`; },
  });

  const barsSel = h('select', {
    class: 'select', 'aria-label': 'Bars per chord',
    onchange: (e) => { barsPer = +e.target.value; },
  }, [1, 2, 4].map((n) => h('option', { value: String(n), selected: n === barsPer },
    `${n} bar${n > 1 ? 's' : ''} per chord`)));

  paintChords();

  return h('div', { class: 'page' },
    h('a', { class: 'back', href: '#/practice' }, '‹ Practice'),
    sectionTitle('Chord changer', 'The click keeps time and the chord changes on the downbeat whether you are ready or not. That pressure is the point.'),
    h('div', { class: 'drill-stage' }, nowEl, nextEl),
    beatEl,
    h('div', { class: 'controls' },
      h('label', { class: 'ctl' }, h('span', {}, 'Tempo'), bpmInput, bpmLabel),
      h('label', { class: 'ctl' }, h('span', {}, 'Length'), barsSel),
    ),
    startBtn,
    h('h3', { class: 'sub' }, 'Chords in the loop'),
    chips,
  );
}

// ---------------------------------------------------------------------------
// Strumming
// ---------------------------------------------------------------------------

function StrumView() {
  let bpm = 80;
  let current = 2;
  let running = false;
  let timer = null;
  let step = 0;
  let nextTime = 0;

  const stageEl = h('div', { class: 'strum-stage' });

  function paint() {
    const s = STRUMS[current];
    stageEl.textContent = '';
    stageEl.appendChild(h('div', { class: 'strum-row' }, s.counts.map((c, i) =>
      h('div', { class: 'strum-cell', 'data-i': String(i) },
        h('span', { class: 'strum-arrow' }, s.pattern[i] === 'D' ? '↓' : s.pattern[i] === 'U' ? '↑' : '·'),
        h('span', { class: 'strum-count' }, c),
      ))));
    stageEl.appendChild(h('p', { class: 'tip' }, s.note));
  }

  function scheduler() {
    const s = STRUMS[current];
    const perStep = (60 / bpm) * (4 / s.counts.length);
    while (nextTime < now() + 0.15) {
      const i = step % s.counts.length;
      const mark = s.pattern[i];
      if (mark) click(i === 0, nextTime);
      const when = nextTime;
      setTimeout(() => {
        [...stageEl.querySelectorAll('.strum-cell')].forEach((el, j) => el.classList.toggle('is-on', j === i));
      }, Math.max(0, (when - now()) * 1000));
      step += 1;
      nextTime += perStep;
    }
  }

  const startBtn = h('button', { class: 'btn btn-primary btn-wide', type: 'button' }, 'Start');
  function stopStrum() {
    if (!running) return;
    running = false;
    clearInterval(timer);
    keepAwake(false);
    startBtn.textContent = 'Start';
    stageEl.querySelectorAll('.strum-cell').forEach((el) => el.classList.remove('is-on'));
  }
  startBtn.addEventListener('click', () => {
    if (running) return stopStrum();
    unlockAudio();
    running = true;
    step = 0;
    nextTime = now() + 0.2;
    startBtn.textContent = 'Stop';
    keepAwake(true);
    timer = setInterval(scheduler, 25);
    onLeave(() => { clearInterval(timer); keepAwake(false); });
  });
  onLeave(stopWhenHidden(stopStrum));

  const bpmLabel = h('output', {}, `${bpm} bpm`);

  paint();

  return h('div', { class: 'page' },
    h('a', { class: 'back', href: '#/practice' }, '‹ Practice'),
    sectionTitle('Strumming patterns', 'Keep your strumming hand swinging down-up in steady eighths the whole time. On the gaps you simply miss the strings.'),
    h('div', { class: 'chip-row wrap' }, STRUMS.map((s, i) =>
      h('button', {
        type: 'button', class: 'chip toggle' + (i === current ? ' is-on' : ''),
        onclick: (e) => {
          current = i;
          [...e.currentTarget.parentNode.children].forEach((b) => b.classList.toggle('is-on', b === e.currentTarget));
          step = 0;
          paint();
        },
      }, s.name))),
    stageEl,
    h('div', { class: 'controls' },
      h('label', { class: 'ctl' }, h('span', {}, 'Tempo'),
        h('input', {
          type: 'range', min: '50', max: '140', step: '2', value: String(bpm), class: 'range',
          'aria-label': 'Tempo',
          oninput: (e) => { bpm = +e.target.value; bpmLabel.textContent = `${bpm} bpm`; },
        }), bpmLabel),
    ),
    startBtn,
  );
}

// ---------------------------------------------------------------------------
// Songs / progressions
// ---------------------------------------------------------------------------

function SongsView() {
  const page = h('div', { class: 'page' },
    sectionTitle('Progressions that unlock songs',
      'Learn the pattern, not the song. Each of these covers a huge slice of popular music.'),
  );

  PROGRESSIONS.forEach((p) => {
    const body = h('div', { class: 'prog-keys' });
    p.keys.forEach((k) => {
      // Key name and playback share the top line so the chords below always
      // read as a single uninterrupted row.
      const row = h('div', { class: 'prog-key' },
        h('div', { class: 'prog-key-top' },
          h('span', { class: 'prog-keyname' }, `Key of ${k.key}`),
          h('button', {
            class: 'btn btn-small', type: 'button',
            onclick: (e) => playProgression(k.chords, e.currentTarget),
          }, '▶︎ Hear it'),
        ),
        h('div', { class: 'prog-chords' }, k.chords.map((id) => {
          const c = CHORD_BY_ID[id];
          return h('button', {
            class: 'prog-chord', type: 'button',
            onclick: () => (c ? go(`#/chord/${c.id}`) : null),
          }, c ? c.name : id);
        })),
      );
      body.appendChild(row);
    });

    page.appendChild(h('section', { class: 'prog' },
      h('header', {},
        h('h3', {}, p.name),
        h('span', { class: 'numerals' }, p.numerals),
      ),
      h('p', { class: 'prog-note' }, p.note),
      body,
      h('p', { class: 'prog-eg' }, p.examples.join(' · ')),
      h('a', {
        class: 'chip', href: `#/practice/drill`,
        onclick: () => { drillPreset = p.keys[0].chords.slice(); },
      }, 'Practise with the changer'),
    ));
  });

  return page;
}

let drillPreset = null;

function playProgression(ids, btn) {
  unlockAudio();
  const chords = ids.map((id) => CHORD_BY_ID[id]).filter(Boolean);
  btn.disabled = true;
  chords.forEach((c, i) => {
    const t = setTimeout(() => {
      strum(c);
      if (i === chords.length - 1) setTimeout(() => { btn.disabled = false; }, 1400);
    }, i * 1400);
    onLeave(() => clearTimeout(t));
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function paintStreak() {
  const n = store.streak();
  const el = document.getElementById('streak');
  el.textContent = n ? `🔥 ${n}` : '';
  el.hidden = !n;
}

function render() {
  runTeardown();
  const parts = (location.hash.replace(/^#\/?/, '') || 'learn').split('/');

  if (parts[0] === 'chord') {
    openSheet(parts[1]);
    return;
  }
  closeSheet();
  hasRoutedInApp = true;

  let node;
  switch (parts[0]) {
    case 'chords': node = ChordsView(); break;
    case 'songs': node = SongsView(); break;
    case 'play': node = FretboardView(onLeave); break;
    case 'practice':
      if (parts[1] === 'omc') node = OmcView(parts[2], parts[3]);
      else if (parts[1] === 'drill') {
        node = DrillView();
      } else if (parts[1] === 'strum') node = StrumView();
      else node = PracticeView();
      break;
    default: node = LearnView();
  }

  view.textContent = '';
  view.appendChild(node);
  window.scrollTo(0, 0);
  // Play gives the fretboard the whole screen, header included.
  document.body.classList.toggle('play-mode', parts[0] === 'play');

  const tab = parts[0] === 'practice' ? 'practice'
    : ['chords', 'songs', 'play'].includes(parts[0]) ? parts[0] : 'learn';
  document.querySelectorAll('.tabbar a').forEach((a) => {
    a.classList.toggle('is-on', a.dataset.tab === tab);
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  paintStreak();
}

// --- orientation -----------------------------------------------------------
// The manifest asks for portrait, but that only binds an installed PWA on
// Android — a browser tab and iOS both ignore it. So ask the platform to lock
// where we're allowed to, and otherwise tell people how to do it themselves.
(function orientationTip() {
  const tip = document.getElementById('rotate-tip');
  const landscape = window.matchMedia('(orientation: landscape) and (max-height: 560px)');

  try {
    // iOS Safari has screen.orientation but no lock(), and elsewhere this only
    // resolves for an installed or fullscreen app — either way, never fatal.
    screen.orientation?.lock?.('portrait')?.catch(() => {});
  } catch { /* not permitted here */ }

  const update = () => {
    tip.hidden = !landscape.matches || store.getFlag('rotateTipSeen');
  };
  document.getElementById('rotate-dismiss').addEventListener('click', () => {
    store.setFlag('rotateTipSeen');
    tip.hidden = true;
  });
  landscape.addEventListener('change', update);
  update();
}());

window.addEventListener('hashchange', render);
document.addEventListener('click', unlockAudio, { once: true });

if (!location.hash) location.hash = '#/learn';
render();
paintStreak();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  });
}
