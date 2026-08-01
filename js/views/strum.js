// Strumming patterns — a click track and a moving down/up guide.

import { STRUMS } from '../data.js';
import { click } from '../audio.js';
import { h, fill } from '../dom.js';
import { createMetronome } from '../metronome.js';
import { backTo, sectionTitle } from './shared.js';

const ARROWS = { D: '↓', U: '↑' };

export function StrumView() {
  let bpm = 80;
  let current = 2;

  const stageEl = h('div', { class: 'strum-stage' });
  const pattern = () => STRUMS[current];

  function paint() {
    const s = pattern();
    fill(stageEl,
      h('div', { class: 'strum-row' }, s.counts.map((c, i) =>
        h('div', { class: 'strum-cell', 'data-i': String(i) },
          h('span', { class: 'strum-arrow' }, ARROWS[s.pattern[i]] || '·'),
          h('span', { class: 'strum-count' }, c),
        ))),
      h('p', { class: 'tip' }, s.note));
  }

  const cells = () => [...stageEl.querySelectorAll('.strum-cell')];
  const startBtn = h('button', { class: 'btn btn-primary btn-wide', type: 'button' }, 'Start');

  const metro = createMetronome({
    // One bar of 4/4 spread over however many slots the pattern has.
    seconds: () => (60 / bpm) * (4 / pattern().counts.length),
    schedule: (step, when) => {
      const s = pattern();
      const i = step % s.counts.length;
      if (s.pattern[i]) click(i === 0, when);
    },
    show: (step) => {
      const i = step % pattern().counts.length;
      cells().forEach((el, j) => el.classList.toggle('is-on', j === i));
    },
    onStop: () => {
      startBtn.textContent = 'Start';
      cells().forEach((el) => el.classList.remove('is-on'));
    },
  });

  startBtn.addEventListener('click', () => {
    if (metro.isRunning()) return metro.stop();
    startBtn.textContent = 'Stop';
    return metro.start();
  });

  const bpmLabel = h('output', {}, `${bpm} bpm`);

  paint();

  return h('div', { class: 'page' },
    backTo('#/practice', 'Practice'),
    sectionTitle('Strumming patterns', 'Keep your strumming hand swinging down-up in steady eighths the whole time. On the gaps you simply miss the strings.'),
    h('div', { class: 'chip-row wrap' }, STRUMS.map((s, i) =>
      h('button', {
        type: 'button', class: 'chip toggle' + (i === current ? ' is-on' : ''),
        onclick: (e) => {
          current = i;
          [...e.currentTarget.parentNode.children].forEach((b) => b.classList.toggle('is-on', b === e.currentTarget));
          metro.resetStep();
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
