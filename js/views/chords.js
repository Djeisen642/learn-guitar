import { CHORDS } from '../data.js';
import { h, fill } from '../dom.js';
import * as store from '../store.js';
import { chordCard, sectionTitle } from './shared.js';

const GROUPS = ['All', 'Major', 'Minor', '7th', 'Sus / add', 'Power', 'Learned'];

// Kept between visits on purpose: coming back from a chord sheet to an unfiltered
// list would lose your place every time.
let filter = 'All';
let query = '';

const matches = (c) => {
  if (filter === 'Learned') return store.isLearned(c.id);
  if (filter !== 'All' && c.group !== filter) return false;
  return true;
};

export function ChordsView() {
  const grid = h('div', { class: 'chord-grid' });

  function paint() {
    const q = query.trim().toLowerCase();
    const list = CHORDS.filter((c) => matches(c)
      && (!q || c.name.toLowerCase().includes(q) || c.full.toLowerCase().includes(q)));

    fill(grid, list.length
      ? list.map((c) => chordCard(c))
      : h('p', { class: 'empty' }, 'Nothing matches that.'));
  }

  const filters = h('div', { class: 'filters' }, GROUPS.map((g) =>
    h('button', {
      type: 'button',
      class: 'filter' + (g === filter ? ' is-on' : ''),
      onclick: (e) => {
        filter = g;
        [...filters.children].forEach((b) => b.classList.toggle('is-on', b === e.currentTarget));
        paint();
      },
    }, g)));

  const search = h('input', {
    class: 'search', type: 'search', placeholder: 'Search chords…',
    value: query, 'aria-label': 'Search chords',
    oninput: (e) => { query = e.target.value; paint(); },
  });

  paint();
  return h('div', { class: 'page' },
    sectionTitle('Chord library', `${CHORDS.length} shapes. Tap any chord to hear it and read the technique tip.`),
    search,
    filters,
    grid,
  );
}
