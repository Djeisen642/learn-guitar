// A look-ahead metronome, shared by the chord changer and the strumming guide.
//
// Both used to carry their own copy of this loop, and both copies had the same
// hole: stopping cleared the repeating timer but not the beats already handed
// out, so for a moment after Stop the lights kept flashing and the chord
// changer could still advance to the next chord. One implementation, canceled
// properly, and neither view has to think about it.
//
// Why a look-ahead at all: setInterval is far too jittery to hear. Beats are
// scheduled onto the audio clock, which is sample-accurate, a fraction of a
// second before they sound; the repeating timer only tops the schedule up.

import { now, unlockAudio } from './audio.js';
import { onLeave } from './lifecycle.js';
import { keepAwake, stopWhenHidden } from './wake.js';

const LOOKAHEAD_S = 0.15;  // how far ahead beats go onto the audio clock
const PUMP_MS = 25;        // how often the schedule is topped up
const LEAD_S = 0.2;        // silence before the first beat, so it isn't clipped

/**
 * @param {object} opts
 * @param {(step:number)=>number} opts.seconds  length of the step about to be
 *        scheduled, read fresh every beat so a tempo slider takes effect at once
 * @param {(step:number, when:number)=>void} [opts.schedule]  audio-clock work
 *        (the click itself), given the exact time the beat sounds
 * @param {(step:number)=>void} [opts.show]  screen work, run at the moment the
 *        beat is heard and canceled if the metronome stops first
 * @param {()=>void} [opts.onStop]  called after any stop, however it was caused
 */
export function createMetronome({ seconds, schedule, show, onStop }) {
  let timer = null;
  let step = 0;
  let nextTime = 0;
  const pending = new Set();   // screen callbacks for beats already scheduled

  function dropPending() {
    pending.forEach(clearTimeout);
    pending.clear();
  }

  function pump() {
    while (nextTime < now() + LOOKAHEAD_S) {
      const at = nextTime;
      const beat = step;
      schedule?.(beat, at);
      if (show) {
        const id = setTimeout(() => {
          pending.delete(id);
          show(beat);
        }, Math.max(0, (at - now()) * 1000));
        pending.add(id);
      }
      step += 1;
      nextTime = at + seconds(beat);
    }
  }

  function start() {
    if (timer) return;
    unlockAudio();
    step = 0;
    nextTime = now() + LEAD_S;
    keepAwake(true);
    timer = setInterval(pump, PUMP_MS);
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    dropPending();
    keepAwake(false);
    onStop?.();
  }

  // Registered once, at construction — not per start, which used to pile up a
  // fresh closure on the teardown list every time someone tapped Start.
  onLeave(stop);
  onLeave(stopWhenHidden(stop));

  return {
    start,
    stop,
    toggle: () => (timer ? stop() : start()),
    isRunning: () => timer !== null,
    /** Begin the pattern again from step 0 without stopping the click. */
    resetStep() {
      step = 0;
      dropPending();
    },
  };
}
