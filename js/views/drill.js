// Chord changer — a metronome that calls the next chord on the downbeat.

import { CHORDS, CHORD_BY_ID } from '../data.js';
import { chordDiagram } from '../diagram.js';
import { click } from '../audio.js';
import { h, fill } from '../dom.js';
import { createMetronome } from '../metronome.js';
import { notePractice } from '../chrome.js';
import { backTo, sectionTitle } from './shared.js';

const BEATS_PER_BAR = 4;
const DEFAULT_LOOP = ['G', 'C', 'D'];

/**
 * The Songs tab links here with a progression in the URL — `#/practice/drill/C-G-Am-Fmini`
 * — rather than leaving one in a module variable for this view to pick up. A
 * link that says what it loads can be shared, reloaded and read.
 */
function loopFrom(preset) {
  const ids = (preset || '').split('-').filter((id) => CHORD_BY_ID[id]);
  return ids.length >= 2 ? ids : DEFAULT_LOOP.slice();
}

export function DrillView(preset) {
  let selected = loopFrom(preset);
  let bpm = 70;
  let barsPer = 1;
  let idx = 0;

  const nowEl = h('div', { class: 'drill-now' });
  const nextEl = h('div', { class: 'drill-next' });
  const beatEl = h('div', { class: 'beats' }, [0, 1, 2, 3].map(() => h('i')));

  function paintChords() {
    if (!selected.length) return;
    const cur = CHORD_BY_ID[selected[idx % selected.length]];
    const nxt = CHORD_BY_ID[selected[(idx + 1) % selected.length]];
    fill(nowEl, chordDiagram(cur), h('span', { class: 'drill-name' }, cur.name));
    fill(nextEl,
      h('span', { class: 'drill-next-label' }, 'next'),
      h('span', { class: 'drill-next-name' }, nxt.name));
  }

  const startBtn = h('button', { class: 'btn btn-primary btn-wide', type: 'button' }, 'Start');

  const metro = createMetronome({
    seconds: () => 60 / bpm,
    schedule: (beat, when) => click(beat % BEATS_PER_BAR === 0, when),
    show: (beat) => {
      [...beatEl.children].forEach((el, i) => el.classList.toggle('is-on', i === beat % BEATS_PER_BAR));
      if (beat > 0 && beat % (BEATS_PER_BAR * barsPer) === 0) {
        idx += 1;
        paintChords();
      }
    },
    onStop: () => {
      startBtn.textContent = 'Start';
      [...beatEl.children].forEach((el) => el.classList.remove('is-on'));
    },
  });

  startBtn.addEventListener('click', () => {
    if (metro.isRunning()) return metro.stop();
    if (selected.length < 2) return undefined;   // nothing to change between
    idx = 0;
    paintChords();
    startBtn.textContent = 'Stop';
    notePractice();
    return metro.start();
  });

  const chips = h('div', { class: 'chip-row wrap' }, CHORDS.map((c) =>
    h('button', {
      type: 'button',
      class: 'chip toggle' + (selected.includes(c.id) ? ' is-on' : ''),
      onclick: (e) => {
        selected = selected.includes(c.id)
          ? selected.filter((x) => x !== c.id)
          : [...selected, c.id];
        e.currentTarget.classList.toggle('is-on', selected.includes(c.id));
        if (selected.length < 2) metro.stop();
        if (!metro.isRunning()) { idx = 0; paintChords(); }
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
    backTo('#/practice', 'Practice'),
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
