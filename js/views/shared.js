// Pieces more than one view draws.

import { h } from '../dom.js';
import { chordDiagram } from '../diagram.js';
import * as store from '../store.js';

export const go = (hash) => { location.hash = hash; };

export function chordCard(chord, { onClick } = {}) {
  const learned = store.isLearned(chord.id);
  const card = h('button', {
    class: 'chord-card' + (learned ? ' is-learned' : ''),
    type: 'button',
    onclick: onClick || (() => go(`#/chord/${chord.id}`)),
  },
    chordDiagram(chord),
    h('span', { class: 'chord-card-name' }, chord.name),
    learned ? h('span', { class: 'tick', 'aria-label': 'Learned' }, '✓') : null,
  );
  return card;
}

export function sectionTitle(text, sub) {
  return h('div', { class: 'sec' },
    h('h2', {}, text),
    sub ? h('p', { class: 'sec-sub' }, sub) : null,
  );
}

/** A back link to a hub, as every drill page carries one. */
export const backTo = (href, label) => h('a', { class: 'back', href }, `‹ ${label}`);
