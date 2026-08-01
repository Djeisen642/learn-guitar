// Play — a life-size slice of a guitar neck.
//
// The point is finger placement, not strumming: the screen shows frets 1-3 at
// real-world spacing, marks where each finger goes, and only lets the chord
// sound once every finger is actually on its spot. Put the phone down, pick up
// a guitar, and your hand has already made the shape.
//
// This file is the view: what gets drawn, what the touches mean, what the
// buttons do. The parts that can be reasoned about without a screen live
// elsewhere — neck.js for the geometry, shapes.js for turning a chord into
// finger targets, playback.js for the song timing.

import { CHORD_BY_ID, SONGS } from './data.js';
import { strum, unlockAudio } from './audio.js';
import { h, fill } from './dom.js';
import { onLeave } from './lifecycle.js';
import { notePractice } from './chrome.js';
import {
  FRETS, MARKER_PX, fitBoard, fretMM, pressMM, stringX, targetRect, matchTouches, sizePercent,
} from './neck.js';
import { targetsFor, targetLabel } from './shapes.js';
import { createPlayback, cycleSpeed, speed, SPEED_LABEL } from './playback.js';
import * as haptics from './haptics.js';
import * as store from './store.js';

const HOLD_MS = 260;      // shape must be held, not just brushed
const WIN_MS = 600;       // how long the board flashes after a clean chord

const PRACTICE = ['Em', 'A', 'D', 'E', 'Am', 'Dm', 'G', 'C', 'A7', 'D7', 'E7', 'G7', 'Cadd9', 'Fmini', 'Dsus4'];

export function FretboardView() {
  // --- what is being practiced ---------------------------------------------
  let chordId = PRACTICE.find((id) => !store.bestForm(id)) || PRACTICE[0];
  let chord = CHORD_BY_ID[chordId];
  let song = null;         // a sequence to play through, or null for one chord
  let step = 0;
  let cleared = false;     // just finished a song, showing the flourish

  // --- how the shape is being held -----------------------------------------
  let targets = [];
  let armed = true;        // ready to count the next clean rep
  let painted = null;      // the shape currently drawn, so resizes aren't changes
  let fresh = false;       // the shape just changed under the fingers
  let repeat = false;      // ...and it changed to the same chord again
  let startedAt = 0;       // when this attempt began, for the timing stat
  let holdTimer = null;
  const active = new Map();

  // --- how big the board came out ------------------------------------------
  let ppm = 0;
  let boardW = 0;
  let boardH = 0;

  const board = h('div', { class: 'fb' });
  const stage = h('div', { class: 'fb-stage' }, board);
  const nameEl = h('div', { class: 'fb-chord' });
  const statEl = h('div', { class: 'fb-stat' });
  const pipsEl = h('div', { class: 'fb-pips' });
  const nextEl = h('div', { class: 'fb-next', hidden: true });
  const progressEl = h('div', { class: 'fb-progress', hidden: true });
  const strip = h('div', { class: 'fb-strip' });
  // Hearing it is the point of the timing data: the chords alone are the right
  // sequence, but only the bar lengths make it the tune.
  const hearBtn = h('button', { class: 'fb-hear', type: 'button', hidden: true }, '▶ hear it');
  const speedBtn = h('button', { class: 'fb-buzz fb-speed', type: 'button', hidden: true });
  const buzzBtn = h('button', { type: 'button', class: 'fb-buzz' });
  const joinBtn = h('button', { type: 'button', class: 'fb-buzz fb-join' });

  const player = createPlayback({
    onPlayingChange: (on) => hearBtn.classList.toggle('is-playing', on),
  });
  onLeave(player.stop);

  // --- drawing the neck ----------------------------------------------------
  function measure() {
    // MARKER_PX must match .fb's top margin, which is layout the board sits
    // below rather than inside.
    const avail = stage.getBoundingClientRect().height - MARKER_PX;
    const fit = fitBoard(avail, window.innerWidth);
    ({ ppm, boardW, boardH } = fit);
    stage.style.width = `${fit.stageW.toFixed(1)}px`;
  }

  function drawNeck() {
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
        style: `left:${stringX(s, ppm)}px; width:${Math.max(1.2, (1.1 - s * 0.13) * ppm * 0.9)}px`,
      }));
    }
    // Open and muted strings are information, not something to press.
    chord.frets.forEach((fret, s) => {
      if (fret > 0) return;
      board.appendChild(h('div', {
        class: 'fb-mark' + (fret === 0 ? ' is-open' : ' is-mute'),
        style: `left:${stringX(s, ppm)}px`,
      }, fret === 0 ? '○' : '✕'));
    });
  }

  function drawTarget(t) {
    const r = targetRect(t, targets, ppm, boardW);
    const label = targetLabel(t);
    // The whole cell counts, but the label sits at the sweet spot just behind
    // the fret so the eye still learns where a note rings cleanest.
    return h('div', {
      class: 'fb-target' + (t.strings.length > 1 ? ' is-bar' : ''),
      style: `left:${r.x1}px; top:${r.y1}px; width:${r.x2 - r.x1}px; height:${r.y2 - r.y1}px`,
    },
      h('span', { class: 'fb-target-label', style: `top:${r.cy - r.y1}px` },
        h('span', { class: 'fb-target-num' }, t.finger ? String(t.finger) : '•'),
        label ? h('span', { class: 'fb-target-name' }, label) : null,
      ),
    );
  }

  function paint() {
    measure();
    targets = targetsFor(chord, !store.getFlag('soloFingers'))
      .map((t) => ({ ...t, covered: false, el: null, pip: null }));

    // A new shape asks for a new hand, not a fresh start: real changes keep
    // whatever fingers already sit where the next chord wants them, so the next
    // rep is armed even though nothing has come off the glass. Resizing repaints
    // the same shape and must not re-arm anything.
    if (painted?.id !== chord.id || painted?.step !== step) {
      repeat = painted?.id === chord.id;
      painted = { id: chord.id, step };
      fresh = true;
      armed = true;
    }

    board.textContent = '';
    board.style.width = `${boardW}px`;
    board.style.height = `${boardH}px`;
    drawNeck();
    for (const t of targets) {
      t.el = drawTarget(t);
      board.appendChild(t.el);
    }

    // Your hand covers the targets, so mirror their state above the neck where
    // you can actually see it.
    fill(pipsEl, [...targets].sort((a, b) => a.finger - b.finger).map((t) => {
      t.pip = h('span', { class: 'fb-pip' }, t.finger ? String(t.finger) : '•');
      return t.pip;
    }));

    nameEl.textContent = chord.name;
    paintStat();
    // Reflect the touches actually down. Passing [] here would re-arm the rep
    // detector while fingers are still on the glass, so a song could advance
    // twice off one press.
    updateHeld([...active.values()]);
  }

  /**
   * While a bar plays, outline where the next chord wants your fingers.
   *
   * The change is the hard part, not the shape, and you can only plan it if you
   * can see it coming — this is the same look ahead as reading a bar early.
   *
   * A spot is marked "stays" only when the chord you are holding already has
   * that same finger on that same string and fret — then it genuinely does not
   * move, which is the whole Am → C change. Where the note is already stopped
   * but the next chord wants a different finger on it, it gets the ordinary
   * outline: saying "stays" there would teach the wrong hand.
   */
  function showNext(here) {
    for (const el of board.querySelectorAll('.fb-ghost')) el.remove();
    const id = song?.chords[here + 1];
    if (!id || !CHORD_BY_ID[id]) return;

    const soon = targetsFor(CHORD_BY_ID[id], !store.getFlag('soloFingers'));
    for (const t of soon) {
      // A finger that doesn't move needs marking on the target under it, not
      // behind it: an outline drawn there is completely covered by the lit spot
      // your finger is already on, which is exactly where you'd look for it.
      const stays = targets.find((c) => c.fret === t.fret
        && c.finger === t.finger
        && c.strings.length === t.strings.length
        && c.strings.every((s, i) => s === t.strings[i]));
      if (stays) {
        stays.el.classList.add('is-stays');
        stays.el.querySelector('.fb-target-label')?.appendChild(h('span', { class: 'fb-stay-tag' }, 'stays'));
        continue;
      }

      const r = targetRect(t, soon, ppm, boardW);
      board.appendChild(h('div', {
        class: 'fb-ghost',
        style: `left:${r.x1}px; top:${r.y1}px; width:${r.x2 - r.x1}px; height:${r.y2 - r.y1}px`,
      }, h('span', { class: 'fb-ghost-label', style: `top:${r.cy - r.y1}px` }, String(t.finger || '•'))));
    }
  }

  // --- the side column -----------------------------------------------------
  function paintStat() {
    const scale = sizePercent(ppm);
    const size = scale >= 99 ? 'life size' : `${scale}% size`;
    statEl.title = scale >= 99
      ? 'Shown at the size of a real 25.5" neck'
      : `This screen is too small for a real neck, so it is shown at ${scale}%`;

    for (const el of [nextEl, progressEl, hearBtn, speedBtn]) el.hidden = !song;

    if (!song) {
      const best = store.bestForm(chord.id);
      // The side column is narrow, so keep this to one short line.
      statEl.textContent = best ? `${size} · ${(best / 1000).toFixed(1)}s best` : size;
      player.stop();     // a lone chord rings once; there is no tempo
      return;
    }

    statEl.textContent = cleared
      ? `${song.name} — all ${song.chords.length}!`
      : `${song.name} · ${step + 1}/${song.chords.length}`;
    const next = song.chords[(step + 1) % song.chords.length];
    nextEl.textContent = `next ${CHORD_BY_ID[next]?.name || next}`;
    paintSpeed();
    // Segments are sized by how long each chord lasts, so the bar doubles as a
    // picture of the rhythm rather than implying every change is equal.
    fill(progressEl, song.chords.map((_, i) => h('i', {
      class: i < step ? 'is-done' : i === step ? 'is-now' : '',
      style: `flex:${song.beats?.[i] || 1}`,
    })));
  }

  function paintList() {
    fill(strip,
      h('p', { class: 'fb-listhead' }, 'Songs'),
      SONGS.map((s) => h('button', {
        type: 'button',
        class: 'fb-pick is-song' + (song?.id === s.id ? ' is-on' : ''),
        title: s.note,
        onclick: () => select({ song: s }),
      }, s.name)),
      h('p', { class: 'fb-listhead' }, 'Chords'),
      PRACTICE.map((id) => CHORD_BY_ID[id]).filter(Boolean).map((c) => h('button', {
        type: 'button',
        class: 'fb-pick' + (!song && c.id === chordId ? ' is-on' : ''),
        onclick: () => select({ chordId: c.id }),
      }, c.name)),
    );
  }

  /** Switch to a song or a single chord. One path, so neither can half-reset. */
  function select({ song: nextSong = null, chordId: nextChord = null }) {
    player.stop();
    song = nextSong;
    chordId = nextSong ? null : nextChord;
    chord = CHORD_BY_ID[nextSong ? nextSong.chords[0] : nextChord];
    step = 0;
    cleared = false;
    armed = true;
    startedAt = Date.now();
    paint();
    paintList();
  }

  // --- touch ---------------------------------------------------------------
  const pointIn = (e) => {
    const r = board.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function updateHeld(points) {
    const hit = matchTouches(targets, points, ppm, boardW);
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

    if (fresh) {
      fresh = false;
      if (all && repeat) {
        // The song is asking for the chord you are already holding, a bar of it
        // having just gone by. Nobody lifts a hand between two bars of the same
        // chord, so carry it: the next bar starts now, on the beat.
        succeed(true);
        return;
      }
      // Otherwise leftover fingers covering the whole of a new shape are not you
      // playing it — the ones the last chord needed and this one doesn't are
      // still down, so it isn't sounding. Something has to move first.
      if (all) armed = false;
    }

    if (all && armed) {
      if (!holdTimer) holdTimer = setTimeout(succeed, HOLD_MS);
      return;
    }
    clearTimeout(holdTimer);
    holdTimer = null;
    // Playing the same shape again is a fresh rep only once the hand has come
    // off it. Moving on to a different shape is handled at paint time.
    if (!points.length) armed = true;
  }

  const sync = () => updateHeld([...active.values()]);

  /**
   * `carried` means the shape was already under the hand when the song asked
   * for it again, so there was nothing to form: no formation time to record, or
   * the best-ever for that chord becomes a few milliseconds of doing nothing.
   */
  function succeed(carried = false) {
    holdTimer = null;
    armed = false;
    const ms = Date.now() - startedAt;
    const isBest = !carried && store.recordForm(chord.id, ms);
    notePractice();
    unlockAudio();
    haptics.chord();
    board.classList.add('is-win');
    setTimeout(() => board.classList.remove('is-win'), WIN_MS);

    if (!song) {
      strum(chord);                      // a lone chord just rings once
      statEl.textContent = isBest
        ? `clean in ${(ms / 1000).toFixed(1)}s — best yet`
        : `clean in ${(ms / 1000).toFixed(1)}s`;
      startedAt = Date.now();
      return;
    }

    const here = step;
    showNext(here);
    player.playBar(song, here, chord, () => {
      cleared = here + 1 >= song.chords.length;
      step = cleared ? 0 : here + 1;
      if (cleared) haptics.finished();
      chord = CHORD_BY_ID[song.chords[step]];
      startedAt = Date.now();
      paint();
      paintList();
    });
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
    active.set(e.pointerId, pointIn(e));
    sync();
  });
  board.addEventListener('pointermove', (e) => {
    if (!active.has(e.pointerId)) return;
    active.set(e.pointerId, pointIn(e));
    sync();
  });
  const lift = (e) => { if (active.delete(e.pointerId)) sync(); };
  board.addEventListener('pointerup', lift);
  board.addEventListener('pointercancel', lift);
  onLeave(() => { clearTimeout(holdTimer); active.clear(); });

  // --- buttons in the side column ------------------------------------------
  hearBtn.addEventListener('click', () => player.playSong(song));

  function paintSpeed() {
    const s = speed();
    speedBtn.textContent = SPEED_LABEL[s];
    speedBtn.classList.toggle('is-on', s < 1);
    speedBtn.title = s < 1
      ? `Bars play at ${Math.round(s * 100)}% of ${song?.name || 'the song'}'s tempo, so there is time to move. Tap to speed up.`
      : 'Bars play at the song\'s own tempo. Tap to slow it down while a change is still new.';
  }
  speedBtn.addEventListener('click', () => {
    cycleSpeed();
    paintSpeed();
    haptics.tick();
    if (player.isPlayingSong()) player.playSong(song);   // re-time what's playing
  });

  // Always rendered, never silently absent: "I feel nothing" needs to be
  // distinguishable from "this phone has no vibration" and from "my fingers
  // aren't landing on the targets", and tapping it buzzes hard enough to tell.
  const BUZZ_LABEL = {
    on: 'buzz on', off: 'buzz off',
    unsupported: 'no buzz here', refused: 'buzz blocked',
  };
  const BUZZ_TITLE = {
    unsupported: 'This browser has no vibration API — Safari has never shipped one',
    refused: 'The phone refused to vibrate. Check touch feedback in its sound settings.',
  };
  function paintBuzz() {
    const state = haptics.support();
    buzzBtn.textContent = BUZZ_LABEL[state];
    buzzBtn.classList.toggle('is-on', state === 'on');
    buzzBtn.classList.toggle('is-warn', state === 'refused' || state === 'unsupported');
    buzzBtn.setAttribute('aria-pressed', String(state === 'on'));
    buzzBtn.title = BUZZ_TITLE[state] || 'Tap to test the vibration on this phone';
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

  // Sharing a finger between two strings is a real technique, but it isn't the
  // fingering the chord is written with — so it's a choice, not a rule. Joined
  // is the default because that's what fits on glass; turn it off to drill the
  // shape exactly as a teacher would write it.
  function paintJoin() {
    const solo = store.getFlag('soloFingers');
    joinBtn.textContent = solo ? 'one each' : 'join ×2';
    joinBtn.classList.toggle('is-on', !solo);
    joinBtn.setAttribute('aria-pressed', String(!solo));
    joinBtn.title = solo
      ? 'One finger per string, exactly as the chord is written. Tap to let neighboring strings share a finger.'
      : 'Neighboring strings at the same fret share one flattened finger. Tap for one finger per string.';
  }
  joinBtn.addEventListener('click', () => {
    store.setFlag('soloFingers', !store.getFlag('soloFingers'));
    paintJoin();
    paint();
    haptics.tick();
  });

  paintBuzz();
  paintJoin();
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

  return h('div', { class: 'fb-page' },
    stage,
    h('div', { class: 'fb-side' },
      h('div', { class: 'fb-head' }, nameEl, statEl),
      progressEl,
      pipsEl,
      nextEl,
      hearBtn,
      speedBtn,
      strip,
      joinBtn,
      buzzBtn,
    ),
  );
}
