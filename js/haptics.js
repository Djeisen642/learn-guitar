// Vibration feedback.
//
// In practice this is Android-only: Safari has never shipped navigator.vibrate,
// so on an iPhone every call here is a silent no-op and the app just carries on.
//
// Durations matter more than you'd think. A phone's vibration motor needs time
// to spin up, so anything under about 10ms produces nothing you can feel — the
// app used to fire 6ms ticks that were, in effect, invisible. These are tuned to
// the shortest pulse that actually registers.

import * as store from './store.js';

const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const isSupported = () => supported;
export const isEnabled = () => !store.getFlag('hapticsOff');

export function setEnabled(on) {
  store.setFlag('hapticsOff', !on);
  if (on) tick();          // confirm the setting in the medium it controls
}

function buzz(pattern) {
  // A hidden page can't vibrate, and browsers throttle it without user gesture.
  if (!supported || !isEnabled() || document.hidden) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

/** A finger has landed on its target. Crisp and light — this fires often. */
export const tick = () => buzz(15);

/** The whole shape is held and the chord is ringing. */
export const chord = () => buzz([22, 55, 22, 55, 70]);

/** Counting a chord change on the practice pad. */
export const count = () => buzz(12);

/** A timed drill has run out. */
export const finished = () => buzz([70, 90, 70]);
