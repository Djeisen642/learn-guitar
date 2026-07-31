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

const MARKER_PX = 30;     // gap above the nut for the o / x row; matches .fb margin-top
const SIDE_MIN_PX = 92;   // narrowest the column beside the neck may get
const HOLD_MS = 260;      // shape must be held, not just brushed

// Targets are rectangles, sized to the largest area that is still honest.
//
// Vertically that is the whole fret cell: on a real guitar the pitch is
// identical anywhere between two fret wires — only tone and buzz change — so
// every part of the cell is a genuinely correct answer.
//
// Horizontally it is the string lane, because pressing the wrong string is a
// wrong note. That caps the width at the 7.3mm string spacing wherever a chord
// puts fingers on neighbouring strings, which is under the ~10mm that touch
// research treats as the floor for reliable hits (fingertip contact is 8-14mm).
// That gap is exactly why three-in-a-fret feels cramped on glass, and it isn't
// something the app can design away without lying about the instrument. Where
// no neighbouring finger is in the way, the lane widens toward that 10mm.
const LANE_MAX_MM = 10;
const WIRE_INSET_MM = 1;  // keep the fret wires readable as edges
const EDGE_FORGIVE_MM = 1.5;

const FINGER_NAMES = ['', 'index', 'middle', 'ring', 'pinky'];

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
  const stage = h('div', { class: 'fb-stage' }, board);
  const nameEl = h('div', { class: 'fb-chord' });
  const statEl = h('div', { class: 'fb-stat' });
  const pipsEl = h('div', { class: 'fb-pips' });

  // --- scale to the phone in hand -----------------------------------------
  let ppm = PX_PER_MM;
  let boardH = 0;
  let boardW = 0;

  function measure() {
    // MARKER_PX must match .fb's top margin, which is layout the board sits
    // below rather than inside.
    const avail = stage
      ? stage.getBoundingClientRect().height - MARKER_PX
      : 600;
    const trueH = fretMM(FRETS) * PX_PER_MM;
    const trueW = (STRING_MM * 5 + EDGE_MM * 2) * PX_PER_MM;
    const room = window.innerWidth - 3 - SIDE_MIN_PX;
    // Shrink only if the phone genuinely can't fit a real neck.
    ppm = PX_PER_MM * Math.min(1, avail > 0 ? avail / trueH : 1, room / trueW);
    // Never exceed life size, but do let the fretboard run on into any space
    // left over — a real neck doesn't stop dead after the third fret.
    boardH = Math.max(fretMM(FRETS) * ppm, Math.min(avail, fretMM(FRETS + 2) * ppm));
    boardW = (STRING_MM * 5 + EDGE_MM * 2) * ppm;
  }

  const stringX = (s) => (EDGE_MM + s * STRING_MM) * ppm;

  /**
   * The largest rectangle that is still a correct answer: the full fret cell
   * tall, and as wide as the string lane can grow before it would reach a
   * neighbouring finger in the same fret.
   */
  function rectFor(t) {
    const half = (STRING_MM / 2) * ppm;
    const inset = WIRE_INSET_MM * ppm;
    const loX = stringX(Math.min(...t.strings));
    const hiX = stringX(Math.max(...t.strings));

    let x1 = loX - half;
    let x2 = hiX + half;
    const grow = ((LANE_MAX_MM - STRING_MM) / 2) * ppm;
    let left = x1 - grow;
    let right = x2 + grow;
    for (const other of targets) {
      // Only fingers sharing this fret compete: other frets are separate cells.
      if (other === t || other.fret !== t.fret) continue;
      const oLo = stringX(Math.min(...other.strings));
      const oHi = stringX(Math.max(...other.strings));
      if (oHi < loX) left = Math.max(left, (oHi + loX) / 2);
      if (oLo > hiX) right = Math.min(right, (oLo + hiX) / 2);
    }
    x1 = Math.max(0, left);
    x2 = Math.min(boardW, right);

    const y1 = fretMM(t.fret - 1) * ppm + inset;
    const y2 = fretMM(t.fret) * ppm - inset;
    return { x1, x2, y1, y2, cx: (x1 + x2) / 2, cy: pressMM(t.fret) * ppm };
  }

  // --- drawing -------------------------------------------------------------
  function paint() {
    measure();
    targets = targetsFor(chord).map((t) => ({ ...t, covered: false, el: null }));

    board.textContent = '';
    board.style.width = `${boardW}px`;
    board.style.height = `${boardH}px`;

    board.appendChild(h('div', { class: 'fb-nut' }));

    // Draw every fret that fits, not just the three the chords use, so the neck
    // reads as continuing rather than stopping at the edge of the board.
    // `<= boardH` matters: on a short screen fret 3 lands exactly on the bottom
    // edge, and dropping its wire would leave C and G looking unfretted.
    for (let n = 1; n <= FRETS + 2 && fretMM(n) * ppm <= boardH + 1; n++) {
      board.appendChild(h('div', { class: 'fb-fret', style: `top:${fretMM(n) * ppm}px` }));
    }
    // Real necks carry position dots at the 3rd and 5th frets; that's how you
    // find your place without looking at the headstock.
    for (const n of [3, 5]) {
      if (fretMM(n) * ppm >= boardH) continue;
      board.appendChild(h('div', {
        class: 'fb-inlay',
        style: `top:${pressMM(n) * ppm}px; left:${boardW / 2}px`,
      }));
    }

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
      const r = rectFor(t);
      // The whole cell counts, but the label sits at the sweet spot just behind
      // the fret so the eye still learns where a note rings cleanest.
      const el = h('div', {
        class: 'fb-target' + (t.strings.length > 1 ? ' is-bar' : ''),
        style: `left:${r.x1}px; top:${r.y1}px; width:${r.x2 - r.x1}px; height:${r.y2 - r.y1}px`,
      },
        h('span', { class: 'fb-target-label', style: `top:${r.cy - r.y1}px` },
          h('span', { class: 'fb-target-num' }, t.finger ? String(t.finger) : '•'),
          t.finger ? h('span', { class: 'fb-target-name' },
            t.strings.length > 1 ? `${FINGER_NAMES[t.finger]} bar` : FINGER_NAMES[t.finger]) : null,
        ),
      );
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
    // Say so plainly when the phone is too small for a real neck, rather than
    // quietly showing a shrunken one.
    const size = scale >= 99 ? 'life size' : `${scale}% size`;
    // The side column is narrow, so keep this to one short line.
    statEl.textContent = best ? `${size} · ${(best / 1000).toFixed(1)}s best` : size;
    statEl.title = scale >= 99
      ? 'Shown at the size of a real 25.5" neck'
      : `This screen is too small for a real neck, so it is shown at ${scale}%`;
  }

  // --- touch ---------------------------------------------------------------
  const active = new Map();

  function pointsIn(e) {
    const r = board.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /**
   * Distance from a touch to a target's centre, or null if the touch is outside
   * the drawn rectangle. Hit area and drawing come from the same rect, so
   * nothing is secretly bigger or smaller than it looks.
   */
  function reach(t, p) {
    const r = rectFor(t);
    const m = EDGE_FORGIVE_MM * ppm;
    if (p.x < r.x1 - m || p.x > r.x2 + m || p.y < r.y1 - m || p.y > r.y2 + m) return null;
    return Math.hypot(p.x - r.cx, p.y - r.cy);
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

  // Measuring once is not enough: filling in the finger pips grows the header,
  // which shrinks the space the board was just sized against. Watching the stage
  // catches that, plus fonts loading, rotation, and the browser bar sliding away.
  let settling = false;
  const ro = new ResizeObserver(() => {
    if (settling) return;
    const before = boardH;
    settling = true;
    paint();
    settling = false;
    if (Math.abs(before - boardH) > 1) paint();
  });
  ro.observe(stage);
  onLeave(() => ro.disconnect());

  requestAnimationFrame(paint);

  // Neck runs the full height against one screen edge; everything else lives in
  // the column beside it. That reclaimed height is what buys true life size.
  // CSS puts the neck on the right (row-reverse) — see .fb-page.
  return h('div', { class: 'fb-page' },
    stage,
    h('div', { class: 'fb-side' },
      h('div', { class: 'fb-head' }, nameEl, statEl),
      pipsEl,
      strip,
    ),
  );
}
