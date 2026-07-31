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

import { CHORD_BY_ID, SONGS } from './data.js';
import { strum, unlockAudio } from './audio.js';
import * as haptics from './haptics.js';
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
const SIDE_MIN_PX = 62;   // narrowest the column beside the neck may get

// A phone has a rim, a case lip and often a curve where a fretboard just ends
// flat, so a string sitting hard against the edge can't be pressed cleanly.
// This is dead space between the outer string and the screen edge. It costs
// nothing in fidelity: string and fret spacing are what transfer, and the
// distance out to the phone's rim is not part of the instrument. Measured in
// real millimetres against the unscaled constant, because a physical edge does
// not shrink when the board does.
const EDGE_GUARD_MM = 8;
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
  let song = null;         // a sequence to play through, or null for one chord
  let step = 0;
  let cleared = false;     // just finished a song, showing the flourish
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
  const nextEl = h('div', { class: 'fb-next', hidden: true });
  const progressEl = h('div', { class: 'fb-progress', hidden: true });

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
    // The board already draws EDGE_MM of fretboard beyond the outer string, so
    // only the shortfall has to come out of the layout.
    const guard = Math.max(0, (EDGE_GUARD_MM - EDGE_MM) * PX_PER_MM);
    stage.style.paddingRight = `${guard.toFixed(1)}px`;
    const room = window.innerWidth - guard - SIDE_MIN_PX;
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
    // Reflect the touches actually down. Passing [] here would re-arm the rep
    // detector while fingers are still on the glass, so a song could advance
    // twice off one press.
    updateHeld([...active.values()]);
  }

  function paintStat() {
    const scale = Math.round((ppm / PX_PER_MM) * 100);
    const size = scale >= 99 ? 'life size' : `${scale}% size`;
    statEl.title = scale >= 99
      ? 'Shown at the size of a real 25.5" neck'
      : `This screen is too small for a real neck, so it is shown at ${scale}%`;

    if (song) {
      statEl.textContent = cleared
        ? `${song.name} — all ${song.chords.length}!`
        : `${song.name} · ${step + 1}/${song.chords.length}`;
      const next = song.chords[(step + 1) % song.chords.length];
      nextEl.textContent = `next ${CHORD_BY_ID[next]?.name || next}`;
      nextEl.hidden = false;
      progressEl.textContent = '';
      song.chords.forEach((_, i) => progressEl.appendChild(
        h('i', { class: i < step ? 'is-done' : i === step ? 'is-now' : '' })));
      progressEl.hidden = false;
      return;
    }

    const best = store.bestForm(chord.id);
    // The side column is narrow, so keep this to one short line.
    statEl.textContent = best ? `${size} · ${(best / 1000).toFixed(1)}s best` : size;
    nextEl.hidden = true;
    progressEl.hidden = true;
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
        if (on) haptics.tick();
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
    haptics.chord();
    board.classList.add('is-win');
    setTimeout(() => board.classList.remove('is-win'), 600);

    if (song) {
      cleared = step + 1 >= song.chords.length;
      step = cleared ? 0 : step + 1;
      if (cleared) haptics.finished();
      chord = CHORD_BY_ID[song.chords[step]];
      startedAt = Date.now();
      paint();
      paintList();
      // Clear the flourish once they lift off for the next chord.
      return;
    }

    statEl.textContent = isBest
      ? `clean in ${(ms / 1000).toFixed(1)}s — best yet`
      : `clean in ${(ms / 1000).toFixed(1)}s`;
    startedAt = Date.now();
  }

  function sync() {
    updateHeld([...active.values()]);
  }

  board.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    unlockAudio();
    // A finished song keeps its flourish up until the next attempt begins —
    // clearing it on repaint wiped it instantly, since the fingers that
    // completed the song are still down at that moment.
    if (cleared && active.size === 0) { cleared = false; paintStat(); }
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

  // --- side list: songs to play through, then single chords -----------------
  const strip = h('div', { class: 'fb-strip' });

  function selectSong(s) {
    song = s;
    step = 0;
    cleared = false;
    chord = CHORD_BY_ID[s.chords[0]];
    startedAt = Date.now();
    armed = true;
    paint();
    paintList();
  }

  function selectChord(id) {
    song = null;
    cleared = false;
    chordId = id;
    chord = CHORD_BY_ID[id];
    startedAt = Date.now();
    armed = true;
    paint();
    paintList();
  }

  function paintList() {
    strip.textContent = '';
    strip.appendChild(h('p', { class: 'fb-listhead' }, 'Songs'));
    SONGS.forEach((s) => {
      strip.appendChild(h('button', {
        type: 'button',
        class: 'fb-pick is-song' + (song?.id === s.id ? ' is-on' : ''),
        title: s.note,
        onclick: () => selectSong(s),
      }, s.short || s.name));
    });
    strip.appendChild(h('p', { class: 'fb-listhead' }, 'Chords'));
    PRACTICE.forEach((id) => {
      const c = CHORD_BY_ID[id];
      if (!c) return;
      strip.appendChild(h('button', {
        type: 'button',
        class: 'fb-pick' + (!song && id === chordId ? ' is-on' : ''),
        onclick: () => selectChord(id),
      }, c.name));
    });
  }
  paintList();

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

  // Always rendered, never silently absent: "I feel nothing" needs to be
  // distinguishable from "this phone has no vibration" and from "my fingers
  // aren't landing on the targets", and tapping it buzzes hard enough to tell.
  const BUZZ_LABEL = {
    on: 'buzz on', off: 'buzz off',
    unsupported: 'no buzz here', refused: 'buzz blocked',
  };
  const buzzBtn = h('button', {
    type: 'button',
    class: 'fb-buzz',
    title: 'Tap to test the vibration on this phone',
  }, BUZZ_LABEL[haptics.support()]);

  function paintBuzz() {
    const state = haptics.support();
    buzzBtn.textContent = BUZZ_LABEL[state];
    buzzBtn.classList.toggle('is-on', state === 'on');
    buzzBtn.classList.toggle('is-warn', state === 'refused' || state === 'unsupported');
    buzzBtn.setAttribute('aria-pressed', String(state === 'on'));
    buzzBtn.title = state === 'unsupported'
      ? 'This browser has no vibration API — Safari has never shipped one'
      : state === 'refused'
        ? 'The phone refused to vibrate. Check touch feedback in its sound settings.'
        : 'Tap to test the vibration on this phone';
  }
  buzzBtn.addEventListener('click', () => {
    if (haptics.support() === 'unsupported') return;
    // Tapping while on is a test, not an off switch — you need to be able to
    // check it works without losing the setting.
    if (haptics.isEnabled()) haptics.test();
    else haptics.setEnabled(true);
    paintBuzz();
  });
  // Long-press turns it off, so a quiet room is still possible.
  buzzBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    haptics.setEnabled(false);
    paintBuzz();
  });
  paintBuzz();

  return h('div', { class: 'fb-page' },
    stage,
    h('div', { class: 'fb-side' },
      h('div', { class: 'fb-head' }, nameEl, statEl),
      progressEl,
      pipsEl,
      nextEl,
      strip,
      buzzBtn,
    ),
  );
}
