// "Play" — the phone becomes the strings.
//
// Pick a chord from the buttons along the top, then drag your thumb across the
// six lanes to strum, or tap one lane to sound a single note. Each lane also
// shows what your fretting hand would be doing on a real guitar, so the screen
// doubles as a chord chart you can hear.

import { CHORD_BY_ID, PROGRESSIONS } from './data.js';
import { noteName, stringMidi } from './notes.js';
import { pluckString, unlockAudio } from './audio.js';
import * as store from './store.js';

const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const FINGER_NAMES = ['', 'index', 'middle', 'ring', 'pinky'];

function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
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

/** The chord sets you can load onto the buttons. */
function chordSets() {
  const sets = PROGRESSIONS.map((p) => ({
    name: p.name,
    chords: p.keys[0].chords.filter((id) => CHORD_BY_ID[id]),
  }));
  const learned = ['A', 'C', 'D', 'E', 'G', 'Am', 'Em', 'Dm', 'F', 'Fmini', 'B', 'Bm', 'E7', 'A7', 'D7', 'G7']
    .filter((id) => store.isLearned(id));
  if (learned.length >= 2) sets.unshift({ name: 'Chords I know', chords: learned.slice(0, 8) });
  return sets;
}

export function PlayView(onLeave) {
  const sets = chordSets();
  let set = sets[0];
  let current = CHORD_BY_ID[set.chords[0]];
  let showNotes = true;

  // --- the strings ---------------------------------------------------------
  const surface = h('div', { class: 'strings', 'aria-label': 'Strum area' });
  const lanes = [];

  for (let s = 0; s < 6; s++) {
    const marker = h('span', { class: 'lane-marker' });
    const wire = h('span', { class: 'lane-wire' });
    const label = h('span', { class: 'lane-note' });
    const lane = h('div', { class: 'lane', 'data-s': String(s) },
      marker, h('span', { class: 'lane-wire-box' }, wire), label);
    lanes.push({ lane, marker, wire, label });
    surface.appendChild(lane);
  }

  function paintLanes() {
    lanes.forEach(({ lane, marker, wire, label }, s) => {
      const fret = current.frets[s];
      const finger = current.fingers?.[s] || 0;
      const midi = stringMidi(current, s);

      lane.classList.toggle('is-muted', fret < 0);
      marker.className = 'lane-marker' + (fret > 0 ? ' is-fretted' : fret === 0 ? ' is-open' : ' is-x');
      marker.textContent = fret > 0 ? String(fret) : fret === 0 ? '○' : '✕';
      marker.title = fret > 0
        ? `Fret ${fret} with your ${FINGER_NAMES[finger] || 'finger'}`
        : fret === 0 ? 'Open string' : 'Do not play this string';

      // Thicker wires for the lower strings, as on a real guitar.
      wire.style.width = `${5 - s * 0.55}px`;

      label.textContent = fret < 0 ? '—' : showNotes ? noteName(midi) : STRING_LABELS[s];
    });
  }

  function ring(s, ok) {
    const { lane, wire } = lanes[s];
    wire.classList.remove('is-ringing');
    lane.classList.remove('is-thud');
    // Force a reflow so the animation restarts on a fast re-strum.
    void wire.offsetWidth;
    if (ok) wire.classList.add('is-ringing');
    else lane.classList.add('is-thud');
  }

  function hitLane(s) {
    const sounded = pluckString(current, s);
    ring(s, sounded);
    if (sounded && navigator.vibrate) navigator.vibrate(8);
  }

  // Strumming: drag across the lanes and each one you cross sounds in turn.
  let strumming = false;
  let lastLane = -1;

  const laneAt = (clientX) => {
    const r = surface.getBoundingClientRect();
    return Math.max(0, Math.min(5, Math.floor(((clientX - r.left) / r.width) * 6)));
  };

  surface.addEventListener('pointerdown', (e) => {
    unlockAudio();
    surface.setPointerCapture(e.pointerId);
    strumming = true;
    lastLane = laneAt(e.clientX);
    hitLane(lastLane);
    e.preventDefault();
  });

  surface.addEventListener('pointermove', (e) => {
    if (!strumming) return;
    const s = laneAt(e.clientX);
    if (s === lastLane) return;
    // Cover every lane the thumb swept over, even on a fast flick.
    const stepDir = s > lastLane ? 1 : -1;
    for (let i = lastLane + stepDir; ; i += stepDir) {
      hitLane(i);
      if (i === s) break;
    }
    lastLane = s;
  });

  const endStrum = () => { strumming = false; lastLane = -1; };
  surface.addEventListener('pointerup', endStrum);
  surface.addEventListener('pointercancel', endStrum);
  onLeave(endStrum);

  // --- chord buttons -------------------------------------------------------
  const buttons = h('div', { class: 'play-chords' });

  function paintButtons() {
    buttons.textContent = '';
    set.chords.forEach((id) => {
      const c = CHORD_BY_ID[id];
      if (!c) return;
      buttons.appendChild(h('button', {
        type: 'button',
        class: 'play-chord' + (c.id === current.id ? ' is-on' : ''),
        onclick: () => {
          current = c;
          paintButtons();
          paintLanes();
        },
      }, c.name));
    });
  }

  const setPicker = h('div', { class: 'chip-row' }, sets.map((s) =>
    h('button', {
      type: 'button',
      class: 'chip toggle' + (s === set ? ' is-on' : ''),
      onclick: (e) => {
        set = s;
        current = CHORD_BY_ID[s.chords[0]] || current;
        [...setPicker.children].forEach((b) => b.classList.toggle('is-on', b === e.currentTarget));
        paintButtons();
        paintLanes();
      },
    }, s.name)));

  const notesToggle = h('button', {
    type: 'button', class: 'chip',
    onclick: (e) => {
      showNotes = !showNotes;
      e.currentTarget.textContent = showNotes ? 'Showing note names' : 'Showing string names';
      paintLanes();
    },
  }, 'Showing note names');

  paintButtons();
  paintLanes();

  return h('div', { class: 'page play-page' },
    h('div', { class: 'sec' },
      h('h2', {}, 'Play'),
      h('p', { class: 'sec-sub' },
        'Pick a chord, then drag your thumb across the strings. The badge on each string is the fret your other hand would hold.'),
    ),
    setPicker,
    buttons,
    surface,
    h('p', { class: 'play-hint' }, 'Drag ↔ to strum · tap a string for one note · ✕ means skip it'),
    h('div', { class: 'play-foot' }, notesToggle),
  );
}
