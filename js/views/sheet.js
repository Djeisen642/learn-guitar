// The chord detail sheet. It lives outside <main>, so it isn't rendered by the
// router like the other views — it's shown and hidden over whatever is there.

import { CHORD_BY_ID } from '../data.js';
import { chordDiagram } from '../diagram.js';
import { strum, arpeggiate } from '../audio.js';
import { h, fill } from '../dom.js';
import * as store from '../store.js';
import { go } from './shared.js';

const sheet = document.getElementById('sheet');
const backdrop = document.getElementById('backdrop');

const FINGER_NAMES = ['—', 'index', 'middle', 'ring', 'pinky'];
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

// True once a normal tab has rendered, so we know going back stays in the app.
// Someone opening a shared #/chord/… link directly would otherwise be thrown
// off the site by the close button.
let hasRoutedInApp = false;

/** The router calls this whenever it renders a real view. */
export const noteAppRoute = () => { hasRoutedInApp = true; };

function dismissSheet() {
  if (hasRoutedInApp) history.back();
  else go('#/chords');
}

export function closeSheet() {
  sheet.hidden = true;
  backdrop.hidden = true;
  document.body.classList.remove('sheet-open');
}

function stringRow(name, i, chord) {
  const fret = chord.frets[i];
  const where = fret === -1 ? 'muted' : fret === 0 ? 'open' : `fret ${fret}`;
  const who = fret > 0 ? ` · ${FINGER_NAMES[chord.fingers?.[i] || 0]}` : '';
  return h('li', { class: fret === -1 ? 'is-muted' : '' },
    h('b', {}, name === 'e' ? 'e (high)' : name), `${where}${who}`);
}

function learnedButton(id) {
  const label = () => (store.isLearned(id) ? '✓ Learned' : 'Mark as learned');
  const btn = h('button', {
    type: 'button',
    class: 'btn' + (store.isLearned(id) ? ' btn-on' : ''),
    onclick: () => {
      const on = store.toggleLearned(id);
      btn.classList.toggle('btn-on', on);
      btn.textContent = label();
    },
  }, label());
  return btn;
}

export function openSheet(id) {
  const chord = CHORD_BY_ID[id];
  if (!chord) return closeSheet();

  fill(sheet,
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
    h('ul', { class: 'stringlist' }, STRING_NAMES.map((s, i) => stringRow(s, i, chord))),
    learnedButton(id),
    h('div', { class: 'sheet-links' },
      h('a', { class: 'chip', href: `#/practice/omc/${chord.id}/` }, 'Drill changes with this chord'),
    ),
  );

  sheet.hidden = false;
  backdrop.hidden = false;
  document.body.classList.add('sheet-open');
  sheet.scrollTop = 0;
  return undefined;
}

backdrop.addEventListener('click', dismissSheet);
