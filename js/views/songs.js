// Songs — the progressions that unlock most of popular music.

import { PROGRESSIONS, CHORD_BY_ID } from '../data.js';
import { strum, unlockAudio } from '../audio.js';
import { h } from '../dom.js';
import { onLeave } from '../lifecycle.js';
import { go, sectionTitle } from './shared.js';

const CHORD_MS = 1400;

function playProgression(ids, btn) {
  unlockAudio();
  const chords = ids.map((id) => CHORD_BY_ID[id]).filter(Boolean);
  btn.disabled = true;
  chords.forEach((c, i) => {
    const t = setTimeout(() => {
      strum(c);
      if (i === chords.length - 1) setTimeout(() => { btn.disabled = false; }, CHORD_MS);
    }, i * CHORD_MS);
    onLeave(() => clearTimeout(t));
  });
}

function keyRow(k) {
  // Key name and playback share the top line so the chords below always read as
  // a single uninterrupted row.
  return h('div', { class: 'prog-key' },
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
}

function progression(p) {
  return h('section', { class: 'prog' },
    h('header', {},
      h('h3', {}, p.name),
      h('span', { class: 'numerals' }, p.numerals),
    ),
    h('p', { class: 'prog-note' }, p.note),
    h('div', { class: 'prog-keys' }, p.keys.map(keyRow)),
    h('p', { class: 'prog-eg' }, p.examples.join(' · ')),
    // The chords ride in the link rather than in a variable the drill reads on
    // its way past, so the handoff is visible in the URL bar.
    h('a', {
      class: 'chip',
      href: `#/practice/drill/${p.keys[0].chords.join('-')}`,
    }, 'Practise with the changer'),
  );
}

export function SongsView() {
  return h('div', { class: 'page' },
    sectionTitle('Progressions that unlock songs',
      'Learn the pattern, not the song. Each of these covers a huge slice of popular music.'),
    PROGRESSIONS.map(progression),
  );
}
