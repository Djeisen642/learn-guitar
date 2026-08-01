import { h } from '../dom.js';
import { sectionTitle } from './shared.js';

const TOOLS = [
  ['#/practice/omc', 'One-minute changes',
    'Pick two chords and swap between them for sixty seconds. Count every clean change. This is the single fastest way to stop stalling between chords.'],
  ['#/practice/drill', 'Chord changer',
    'A metronome calls out chords at your tempo. Trains you to change in time rather than whenever you happen to be ready.'],
  ['#/practice/strum', 'Strumming patterns',
    'Four patterns with a click track and a moving down/up guide.'],
];

const ROUTINE = [
  '2 min — play each chord you know and check every string rings',
  '4 min — one-minute changes on four pairs',
  '3 min — chord changer on a progression from the Songs tab',
  '1 min — play something you enjoy, badly, and finish smiling',
];

export function PracticeView() {
  return h('div', { class: 'page' },
    sectionTitle('Practice', 'Short, focused drills. Ten minutes of these beats an hour of noodling.'),
    h('div', { class: 'tool-list' }, TOOLS.map(([href, title, blurb]) =>
      h('a', { class: 'tool', href }, h('h3', {}, title), h('p', {}, blurb)))),
    h('div', { class: 'note' },
      h('h3', {}, 'A 10-minute routine'),
      h('ol', {}, ROUTINE.map((step) => h('li', {}, step))),
    ),
  );
}
