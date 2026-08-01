import { CHORDS, CHORD_BY_ID, STAGES } from '../data.js';
import { h } from '../dom.js';
import * as store from '../store.js';
import { chordCard } from './shared.js';

function stageSection(stage, i) {
  const chords = stage.chords.map((id) => CHORD_BY_ID[id]).filter(Boolean);
  const done = chords.filter((c) => store.isLearned(c.id)).length;

  return h('section', { class: 'stage' },
    h('header', { class: 'stage-head' },
      h('span', { class: 'stage-num' }, String(i + 1)),
      h('div', {},
        h('h3', {}, stage.title),
        h('p', { class: 'stage-count' }, `${done}/${chords.length} learned`),
      ),
    ),
    h('p', { class: 'stage-blurb' }, stage.blurb),
    h('div', { class: 'chord-grid' }, chords.map((c) => chordCard(c))),
    h('div', { class: 'stage-goal' }, h('strong', {}, 'Goal: '), stage.goal),
    h('div', { class: 'chip-row' }, stage.changes.map(([a, b]) => {
      const best = store.bestChanges(a, b);
      return h('a', { class: 'chip', href: `#/practice/omc/${a}/${b}` },
        `${CHORD_BY_ID[a]?.name || a} ↔ ${CHORD_BY_ID[b]?.name || b}`,
        best ? h('b', {}, String(best)) : null,
      );
    })),
    stage.songs?.length ? h('p', { class: 'stage-song' }, stage.songs[0]) : null,
  );
}

export function LearnView() {
  const total = CHORDS.length;
  const done = store.learnedCount();

  return h('div', { class: 'page' },
    h('section', { class: 'hero' },
      h('h2', {}, 'Learn chords, one stage at a time'),
      h('p', {}, 'Work down the list. Each stage only uses shapes from the stages above it, and every chord has a sound button so you can check yourself.'),
      h('div', { class: 'progress' },
        h('div', { class: 'progress-bar' }, h('i', { style: `width:${Math.round((done / total) * 100)}%` })),
        h('span', { class: 'progress-label' }, `${done} of ${total} chords marked learned`),
      ),
    ),
    STAGES.map(stageSection),
  );
}
