// One-minute changes — the JustinGuitar drill.

import { CHORDS, CHORD_BY_ID } from '../data.js';
import { chordDiagram } from '../diagram.js';
import { strum, click, unlockAudio } from '../audio.js';
import { h, fill } from '../dom.js';
import { onLeave } from '../lifecycle.js';
import { keepAwake } from '../wake.js';
import { notePractice } from '../chrome.js';
import * as haptics from '../haptics.js';
import * as store from '../store.js';
import { backTo, sectionTitle } from './shared.js';

const ROUND_S = 60;

export function OmcView(a, b) {
  let chordA = CHORD_BY_ID[a] ? a : 'G';
  let chordB = CHORD_BY_ID[b] && b !== chordA ? b : (chordA === 'C' ? 'G' : 'C');

  let count = 0;
  let running = false;
  let tick = null;

  const timeEl = h('div', { class: 'omc-time' }, String(ROUND_S));
  const countEl = h('div', { class: 'omc-count' }, '0');
  const bestEl = h('div', { class: 'omc-best' });
  const tapBtn = h('button', { class: 'tap', type: 'button' }, 'Tap to start');
  const startBtn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Start');

  function refreshBest() {
    const best = store.bestChanges(chordA, chordB);
    bestEl.textContent = best ? `Best: ${best} changes/min` : 'No score yet — set one.';
  }

  function stop(finished) {
    if (!running) return;
    running = false;
    clearInterval(tick);
    tick = null;
    keepAwake(false);
    tapBtn.classList.remove('is-live');
    startBtn.textContent = 'Start';
    if (!finished) return;

    const isBest = store.recordChanges(chordA, chordB, count);
    notePractice();
    tapBtn.textContent = isBest ? 'New best!' : 'Time!';
    haptics.finished();
    bestEl.textContent = isBest
      ? `New best: ${count} changes/min`
      : `${count} this round · best ${store.bestChanges(chordA, chordB)}`;
    click(true);
  }

  function start() {
    if (running) return stop(false);
    unlockAudio();
    count = 0;
    countEl.textContent = '0';
    timeEl.textContent = String(ROUND_S);
    running = true;
    startBtn.textContent = 'Stop';
    tapBtn.classList.add('is-live');
    tapBtn.textContent = 'Tap on every change';
    click(true);
    keepAwake(true);

    // Count down against a wall-clock deadline: a plain 1s interval drifts and
    // stalls outright while the phone is asleep or the tab is backgrounded.
    const deadline = Date.now() + ROUND_S * 1000;
    let shown = ROUND_S;
    tick = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remaining !== shown) {
        shown = remaining;
        timeEl.textContent = String(remaining);
        if (remaining <= 5 && remaining > 0) click(false);
      }
      if (remaining <= 0) stop(true);
    }, 200);
    return undefined;
  }
  // Registered once, not per start: starting and stopping ten times used to
  // leave ten copies of this on the teardown list.
  onLeave(() => stop(false));

  startBtn.addEventListener('click', start);

  function registerTap() {
    if (!running) return start();
    count += 1;
    countEl.textContent = String(count);
    haptics.count();
    tapBtn.classList.add('is-hit');
    setTimeout(() => tapBtn.classList.remove('is-hit'), 90);
    return undefined;
  }
  // pointerdown, not click: counting changes should feel instant under a thumb.
  tapBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); registerTap(); });
  // Keyboard-generated clicks have detail 0, so this won't double-count taps.
  tapBtn.addEventListener('click', (e) => { if (e.detail === 0) registerTap(); });

  const diagrams = h('div', { class: 'omc-pair' });
  function paintPair() {
    const box = (id) => {
      const c = CHORD_BY_ID[id];
      return h('button', { class: 'omc-chord', type: 'button', onclick: () => strum(c) },
        chordDiagram(c), h('span', { class: 'omc-label' }, c.name));
    };
    fill(diagrams, box(chordA), h('span', { class: 'omc-arrows' }, '⇄'), box(chordB));
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
    backTo('#/practice', 'Practice'),
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
