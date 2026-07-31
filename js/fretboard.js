// Play — a life-size slice of a guitar neck.
//
// The point is finger placement, not strumming: the screen shows frets 1-3 at
// real-world spacing, marks where each finger goes, and only lets the chord
// sound once every finger is actually on its spot. Put the phone down, pick up
// a guitar, and your hand has already made the shape.
//
// Geometry is computed in millimetres and converted to pixels ourselves. CSS
// physical units are fiction on a phone (1mm is always 3.78px regardless of the
// real display), so declaring `43mm` would produce a neck two thirds of life size.

import { CHORD_BY_ID } from './data.js';
import { strum, unlockAudio } from './audio.js';
import * as store from './store.js';

const SCALE_MM = 647.7;   // 25.5" scale length, the Fender/Martin standard
const STRING_MM = 7.3;    // string centres at the nut
const EDGE_MM = 3.6;      // fretboard beyond the outer strings
const FRETS = 3;          // every open chord lives inside frets 1-3

// Phones cluster tightly around 6 CSS px per physical millimetre: an iPhone 12
// is 6.04, a Pixel 7 6.24, a Galaxy S23 5.58. There's no API for real DPI, so
// this is the honest average.
const PX_PER_MM = 6.05;

const HOLD_MS = 260;      // shape must be held, not just brushed
const TOUCH_MM = 5.2;     // how close a fingertip must land
const DOT_MM = 3.8;       // drawn fingertip radius — smaller than the tolerance
                          // so neighbouring targets stay readable as separate spots

const fretMM = (n) => SCALE_MM - SCALE_MM / Math.pow(2, n / 12);

// Press just behind the fret wire — that's where a note rings cleanly, so the
// targets sit there and the habit comes along for free.
const pressMM = (n) => fretMM(n - 1) + (fretMM(n) - fretMM(n - 1)) * 0.72;

const PRACTICE = ['Em', 'A', 'D', 'E', 'Am', 'Dm', 'G', 'C', 'A7', 'D7', 'E7', 'G7', 'Cadd9', 'Fmini', 'Dsus4'];

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

/**
 * One target per finger, not per string: a finger barring three strings is a
 * single thing your hand does, so it's drawn and judged as one bar.
 */
function targetsFor(chord) {
  const groups = new Map();
  chord.frets.forEach((fret, s) => {
    if (fret <= 0) return;
    const finger = chord.fingers?.[s] || 0;
    const key = finger ? `f${finger}@${fret}` : `s${s}@${fret}`;
    if (!groups.has(key)) groups.set(key, { fret, finger, strings: [] });
    groups.get(key).strings.push(s);
  });
  return [...groups.values()];
}

export function FretboardView(onLeave) {
  let chordId = PRACTICE.find((id) => !store.bestForm(id)) || PRACTICE[0];
  let chord = CHORD_BY_ID[chordId];
  let targets = [];
  let heldSince = 0;
  let armed = true;        // must let go before the next rep counts
  let startedAt = 0;       // when this attempt began, for the timing stat
  let holdTimer = null;

  const board = h('div', { class: 'fb' });
  const nameEl = h('div', { class: 'fb-chord' });
  const statEl = h('div', { class: 'fb-stat' });
  const pipsEl = h('div', { class: 'fb-pips' });

  // --- scale to the phone in hand -----------------------------------------
  let ppm = PX_PER_MM;
  let boardH = 0;
  let boardW = 0;

  function measure() {
    const markerPx = 30;                       // room above the nut for o / x
    const avail = board.parentElement
      ? board.parentElement.getBoundingClientRect().height - markerPx
      : 600;
    const trueH = fretMM(FRETS) * PX_PER_MM;
    const trueW = (STRING_MM * 5 + EDGE_MM * 2) * PX_PER_MM;
    const room = Math.min(window.innerWidth - 24, 520);
    // Shrink only if the phone genuinely can't fit a real neck.
    ppm = PX_PER_MM * Math.min(1, avail > 0 ? avail / trueH : 1, room / trueW);
    boardH = fretMM(FRETS) * ppm;
    boardW = (STRING_MM * 5 + EDGE_MM * 2) * ppm;
  }

  const stringX = (s) => (EDGE_MM + s * STRING_MM) * ppm;

  // --- drawing -------------------------------------------------------------
  function paint() {
    measure();
    targets = targetsFor(chord).map((t) => ({ ...t, covered: false, el: null }));

    board.textContent = '';
    board.style.width = `${boardW}px`;
    board.style.height = `${boardH}px`;

    board.appendChild(h('div', { class: 'fb-nut' }));

    for (let n = 1; n <= FRETS; n++) {
      board.appendChild(h('div', { class: 'fb-fret', style: `top:${fretMM(n) * ppm}px` }));
    }
    // Real necks carry a position dot at the 3rd fret; it's how you find your place.
    board.appendChild(h('div', {
      class: 'fb-inlay',
      style: `top:${pressMM(3) * ppm}px; left:${boardW / 2}px`,
    }));

    for (let s = 0; s < 6; s++) {
      board.appendChild(h('div', {
        class: 'fb-string',
        style: `left:${stringX(s)}px; width:${Math.max(1.2, (1.1 - s * 0.13) * ppm * 0.9)}px`,
      }));
    }

    // Open and muted strings are information, not something to press.
    chord.frets.forEach((fret, s) => {
      if (fret > 0) return;
      board.appendChild(h('div', {
        class: 'fb-mark' + (fret === 0 ? ' is-open' : ' is-mute'),
        style: `left:${stringX(s)}px`,
      }, fret === 0 ? '○' : '✕'));
    });

    for (const t of targets) {
      const lo = Math.min(...t.strings);
      const hi = Math.max(...t.strings);
      const y = pressMM(t.fret) * ppm;
      const r = DOT_MM * ppm;
      const el = h('div', {
        class: 'fb-target' + (t.strings.length > 1 ? ' is-bar' : ''),
        style: `top:${y}px; left:${stringX(lo)}px; width:${stringX(hi) - stringX(lo) + r * 2}px;`
          + `height:${r * 2}px; margin-left:${-r}px; margin-top:${-r}px`,
      }, t.finger ? String(t.finger) : '');
      t.el = el;
      board.appendChild(el);
    }

    // Your hand covers the targets, so mirror their state above the neck where
    // you can actually see it.
    pipsEl.textContent = '';
    [...targets].sort((a, b) => a.finger - b.finger).forEach((t) => {
      t.pip = h('span', { class: 'fb-pip' }, t.finger ? String(t.finger) : '•');
      pipsEl.appendChild(t.pip);
    });

    nameEl.textContent = chord.name;
    paintStat();
    updateHeld([]);
  }

  function paintStat() {
    const best = store.bestForm(chord.id);
    const scale = Math.round((ppm / PX_PER_MM) * 100);
    statEl.textContent = best
      ? `${chord.full} · best ${(best / 1000).toFixed(1)}s`
      : `${chord.full} · place every numbered finger`;
    statEl.title = scale >= 99 ? 'Shown at life size' : `Shown at ${scale}% of a real neck`;
  }

  // --- touch ---------------------------------------------------------------
  const active = new Map();

  function pointsIn(e) {
    const r = board.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** Distance from a touch to a target, or null if it's out of tolerance. */
  function reach(t, p) {
    const r = TOUCH_MM * ppm;
    const lo = stringX(Math.min(...t.strings));
    const hi = stringX(Math.max(...t.strings));
    const y = pressMM(t.fret) * ppm;
    const dx = p.x < lo ? lo - p.x : p.x > hi ? p.x - hi : 0;  // 0 anywhere along a barre
    const d = Math.hypot(dx, p.y - y);
    return d <= r ? d : null;
  }

  /**
   * Match touches to targets one-to-one, closest pair first. Adjacent targets
   * are only ~7mm apart, so without this a single broad touch would satisfy two
   * positions at once and hand out a clean chord for a sloppy shape.
   */
  function matched(points) {
    const pairs = [];
    targets.forEach((t, ti) => points.forEach((p, pi) => {
      const d = reach(t, p);
      if (d != null) pairs.push({ ti, pi, d });
    }));
    pairs.sort((a, b) => a.d - b.d);
    const takenTarget = new Set();
    const takenTouch = new Set();
    for (const { ti, pi } of pairs) {
      if (takenTarget.has(ti) || takenTouch.has(pi)) continue;
      takenTarget.add(ti);
      takenTouch.add(pi);
    }
    return takenTarget;
  }

  function updateHeld(points) {
    const hit = matched(points);
    let all = targets.length > 0;
    targets.forEach((t, i) => {
      const on = hit.has(i);
      if (on !== t.covered) {
        t.covered = on;
        t.el.classList.toggle('is-on', on);
        t.pip?.classList.toggle('is-on', on);
        if (on && navigator.vibrate) navigator.vibrate(6);
      }
      if (!on) all = false;
    });
    board.classList.toggle('is-formed', all);

    if (all && armed) {
      if (!heldSince) {
        heldSince = Date.now();
        holdTimer = setTimeout(succeed, HOLD_MS);
      }
    } else {
      heldSince = 0;
      clearTimeout(holdTimer);
      if (!points.length) armed = true;
    }
  }

  function succeed() {
    armed = false;
    const ms = Date.now() - startedAt;
    const isBest = store.recordForm(chord.id, ms);
    store.touchStreak();
    unlockAudio();
    strum(chord);                       // the shape is right, so it rings
    if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
    board.classList.add('is-win');
    setTimeout(() => board.classList.remove('is-win'), 600);
    statEl.textContent = isBest
      ? `Clean in ${(ms / 1000).toFixed(1)}s — best yet`
      : `Clean in ${(ms / 1000).toFixed(1)}s · best ${(store.bestForm(chord.id) / 1000).toFixed(1)}s`;
    startedAt = Date.now();
  }

  function sync() {
    updateHeld([...active.values()]);
  }

  board.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    unlockAudio();
    if (!startedAt) startedAt = Date.now();
    board.setPointerCapture(e.pointerId);
    active.set(e.pointerId, pointsIn(e));
    sync();
  });
  board.addEventListener('pointermove', (e) => {
    if (!active.has(e.pointerId)) return;
    active.set(e.pointerId, pointsIn(e));
    sync();
  });
  const lift = (e) => {
    if (!active.delete(e.pointerId)) return;
    sync();
  };
  board.addEventListener('pointerup', lift);
  board.addEventListener('pointercancel', lift);
  onLeave(() => { clearTimeout(holdTimer); active.clear(); });

  // --- chord strip ---------------------------------------------------------
  const strip = h('div', { class: 'fb-strip' });
  PRACTICE.forEach((id) => {
    const c = CHORD_BY_ID[id];
    if (!c) return;
    strip.appendChild(h('button', {
      type: 'button',
      class: 'fb-pick' + (id === chordId ? ' is-on' : ''),
      onclick: (e) => {
        chordId = id;
        chord = c;
        startedAt = Date.now();
        armed = true;
        [...strip.children].forEach((b) => b.classList.toggle('is-on', b === e.currentTarget));
        paint();
      },
    }, c.name));
  });

  const stage = h('div', { class: 'fb-stage' }, board);
  const onResize = () => paint();
  window.addEventListener('resize', onResize);
  onLeave(() => window.removeEventListener('resize', onResize));

  // The board needs its parent measured, so paint after layout settles.
  requestAnimationFrame(paint);

  return h('div', { class: 'fb-page' },
    h('div', { class: 'fb-head' }, nameEl, statEl, pipsEl),
    stage,
    strip,
  );
}
