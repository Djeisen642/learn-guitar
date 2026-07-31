// Vibration feedback.
//
// Two things make this easy to get wrong, and both were wrong here:
//
//  1. navigator.vibrate() *cancels* whatever is already running. Three fingers
//     landing in quick succession fired three pulses that each cut the last one
//     short, so a chord that should have felt like three ticks felt like one
//     blip — or nothing. Rapid ticks are coalesced instead.
//  2. Durations under roughly 10-20ms don't outlast a vibration motor's spin-up
//     time, so they produce no sensation at all. These are tuned above that.
//
// In practice this is Android-only: Safari has never shipped navigator.vibrate,
// so on an iPhone every call here is a no-op and `support()` says so rather than
// leaving you guessing.

import * as store from './store.js';

const present = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const COALESCE_MS = 45;   // below this, a second tick would just cut off the first
let lastAt = 0;
let lastResult = null;    // what the browser said the last time we asked

export const isEnabled = () => !store.getFlag('hapticsOff');

/**
 * What we can honestly say about vibration here:
 *   'unsupported' — no API at all (every iPhone)
 *   'off'         — supported, switched off by the user
 *   'refused'     — we asked and the browser declined; usually the phone's own
 *                   touch-feedback setting is off
 *   'on'          — supported and the last request was accepted
 */
export function support() {
  if (!present) return 'unsupported';
  if (!isEnabled()) return 'off';
  if (lastResult === false) return 'refused';
  return 'on';
}

function buzz(pattern, { coalesce = false } = {}) {
  if (!present || !isEnabled() || document.hidden) return false;
  const now = Date.now();
  if (coalesce && now - lastAt < COALESCE_MS) return false;
  lastAt = now;
  try {
    lastResult = navigator.vibrate(pattern);
    return lastResult;
  } catch {
    lastResult = false;
    return false;
  }
}

/** A finger has landed on its target. Fires often, so it coalesces. */
export const tick = () => buzz(25, { coalesce: true });

/** The whole shape is held and the chord is ringing. */
export const chord = () => buzz([30, 60, 30, 60, 90]);

/** Counting a chord change on the practice pad. */
export const count = () => buzz(20);

/** A timed drill has run out. */
export const finished = () => buzz([80, 100, 80]);

/** Unmistakable, for checking whether vibration works on this phone at all. */
export const test = () => buzz([120, 90, 120]);

export function setEnabled(on) {
  store.setFlag('hapticsOff', !on);
  if (on) test();   // confirm the setting in the medium it controls
  return support();
}
