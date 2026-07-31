// Playing a song back, in its own rhythm — the timing half of the Play view.
//
// Split out from the fretboard because it shares nothing with it: no geometry,
// no touches, no DOM. What it does own is a set of pending timers that several
// things need to cancel, and getting that wrong is what made re-pressing a
// chord mid-bar lay a second bar over the first.

import { strumSchedule, stepStrums, CHORD_BY_ID } from './data.js';
import { strum, unlockAudio } from './audio.js';
import * as store from './store.js';

// "Start slow" is the oldest advice there is, and the only way a change gets
// clean: the bar has to last long enough for your hand to arrive.
export const SPEEDS = [0.5, 0.7, 1];
export const SPEED_LABEL = { 0.5: 'half speed', 0.7: '70% speed', 1: 'full speed' };

export const speed = () => {
  const saved = store.getSetting('tempo');
  return SPEEDS.includes(saved) ? saved : 1;
};

export const cycleSpeed = () => {
  const next = SPEEDS[(SPEEDS.indexOf(speed()) + 1) % SPEEDS.length];
  store.setSetting('tempo', next);
  return next;
};

/** Seconds per beat for this song at the chosen practice speed. */
export const beatSeconds = (song) => 60 / ((song?.bpm || 90) * speed());

/**
 * @param {object} opts
 * @param {(playing:boolean)=>void} [opts.onPlayingChange] for the listen button's state
 */
export function createPlayback({ onPlayingChange } = {}) {
  let timers = [];
  let mode = null;          // 'song' while listening, 'bar' while you play one

  const at = (seconds, fn) => timers.push(setTimeout(fn, seconds * 1000));

  function settle(next) {
    if (mode === next) return;
    mode = next;
    onPlayingChange?.(mode === 'song');
  }

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    settle(null);
  }

  /** Play the whole song through, so you can hear what you're aiming at. */
  function playSong(song) {
    stop();
    if (!song) return;
    unlockAudio();
    settle('song');
    const spb = beatSeconds(song);
    for (const s of strumSchedule(song)) {
      at(s.beat * spb, () => strum(CHORD_BY_ID[s.chord], s.direction, s.velocity));
    }
    at(song.beats.reduce((a, b) => a + b, 0) * spb, stop);
  }

  /**
   * You fret, the phone strums: hold the shape and it plays that chord's bar in
   * the song's own rhythm, then calls `done` so the sequence can move on.
   * A single strike told you the shape was right but never sounded like the song.
   *
   * Cancels anything still sounding first. Lifting off mid-bar re-arms the shape
   * detector, so re-pressing used to lay a second bar over the first and queue a
   * second advance with it.
   */
  function playBar(song, index, chord, done) {
    stop();
    unlockAudio();
    settle('bar');
    const spb = beatSeconds(song);
    for (const s of stepStrums(song, index)) {
      at(s.offset * spb, () => strum(chord, s.direction, s.velocity));
    }
    at(song.beats[index] * spb, () => {
      settle(null);
      done();
    });
  }

  return {
    playSong,
    playBar,
    stop,
    /** True only while listening to the whole song, not while a bar plays out. */
    isPlayingSong: () => mode === 'song',
  };
}
