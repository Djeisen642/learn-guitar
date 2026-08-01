// Tiny Web Audio engine: plucked-string synthesis (Karplus-Strong) for chords,
// plus a metronome click. No samples, so nothing to download.

import { OPEN_MIDI, midiToFreq, stringMidi } from './notes.js';

const RING_SECONDS = 2.4;

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    // Strumming stacks six voices at once and re-strumming stacks more on top,
    // so everything goes through a limiter to stop the phone speaker clipping.
    // A fast attack here squashed the strum's own transient — six tapered
    // excitations landing within 150ms still add up to a peak the plain gain
    // stage can't absorb — so the pump was audible as a dull "thud" then a
    // rise back up rather than a clean pluck. Threshold and attack are eased
    // off so it only catches the peak, not the whole envelope.
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -18;
    squash.knee.value = 14;
    squash.ratio.value = 4;
    squash.attack.value = 0.012;
    squash.release.value = 0.18;

    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(squash).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  const c = audio();
  if (c && c.state === 'suspended') c.resume();
}

// Building a Karplus-Strong buffer means filling ~100k samples, which is far too
// much to redo for every pluck of a six-string strum on a phone. The waveform
// only depends on the wavelength, so cache one buffer per pitch.
const buffers = new Map();

function buffer(c, freq) {
  // The wavelength in samples is essentially never a whole number, but the
  // delay line can only hold whole samples. Rounding it off both strings goes
  // sharp or flat by however much got rounded away — a few cents on the low
  // strings, up to ten on the high ones where a wavelength is only ~130
  // samples and half a sample is a much bigger fraction of it. Chords then
  // beat against each other instead of sounding in tune. The two-sample
  // average below already delays the signal by half a sample on its own, so
  // what's left after removing that is tuned the rest of the way with a
  // one-pole allpass, which shifts pitch without coloring the tone the way
  // rounding the delay length would.
  const period = c.sampleRate / freq;
  const wavelength = Math.max(1, Math.floor(period - 0.5));
  const frac = period - 0.5 - wavelength;
  const allpass = (1 - frac) / (1 + frac);

  const cacheKey = `${wavelength}:${frac.toFixed(4)}`;
  const cached = buffers.get(cacheKey);
  if (cached) return cached;

  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * RING_SECONDS), c.sampleRate);
  const data = buf.getChannelData(0);

  // Excitation: a burst of noise, one wavelength long, shaped to taper at
  // both ends instead of starting and stopping flat. A flat burst has a hard
  // edge where it meets silence, and the delay line echoes that edge back
  // every single period — audible as a buzzy click riding under the note.
  // A real pluck's initial displacement tapers toward the nut and the
  // bridge too, so the shape isn't just cosmetic.
  for (let i = 0; i <= wavelength; i++) {
    const taper = 0.5 * (1 - Math.cos((2 * Math.PI * i) / wavelength));
    data[i] = (Math.random() * 2 - 1) * taper;
  }

  // Karplus-Strong: average each sample with its neighbor a wavelength back,
  // then nudge the result through the allpass for the fractional remainder.
  const decay = 0.996;
  let allpassIn = 0;
  let allpassOut = 0;
  for (let i = wavelength + 1; i < data.length; i++) {
    const avg = 0.5 * (data[i - wavelength] + data[i - wavelength - 1]);
    const tuned = allpass * avg + allpassIn - allpass * allpassOut;
    allpassIn = avg;
    allpassOut = tuned;
    data[i] = decay * tuned;
  }

  if (buffers.size > 72) buffers.clear();
  buffers.set(cacheKey, buf);
  return buf;
}

/** One plucked string, built from filtered noise fed through a delay line. */
function pluck(c, freq, when, gain = 0.6) {
  const src = c.createBufferSource();
  src.buffer = buffer(c, freq);

  // Roll off the fizz so it sounds like wood rather than a modem. A single
  // fixed cutoff treats a low E and a high E the same, but the low string
  // has thirty-odd harmonics under 3200Hz to a treble string's ten — all of
  // them let through at full brightness, which is what made dense low
  // voicings (like C, with no open bass string to anchor them) sound like a
  // pile of noise rather than a chord. Scaling the cutoff with the note
  // keeps roughly the same harmonic count bright on every string.
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = Math.min(3200, Math.max(1100, freq * 9));

  const amp = c.createGain();
  amp.gain.setValueAtTime(0, when);
  amp.gain.linearRampToValueAtTime(gain, when + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + RING_SECONDS * 0.92);

  src.connect(tone).connect(amp).connect(master);
  src.start(when);
  src.stop(when + RING_SECONDS);
  // Let the graph be collected as soon as the note has finished.
  src.onended = () => { src.disconnect(); tone.disconnect(); amp.disconnect(); };
}

/**
 * Strum a chord entry from data.js. direction: 'down' | 'up'.
 * `velocity` scales how hard: real players lean on beat one and brush the
 * offbeats, and without that a pattern comes out as a machine tick.
 */
export function strum(chord, direction = 'down', velocity = 1) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + 0.02;
  const notes = [];
  chord.frets.forEach((fret, s) => {
    if (fret < 0) return;
    notes.push(midiToFreq(OPEN_MIDI[s] + fret));
  });
  if (direction === 'up') notes.reverse();
  const spread = 0.028;
  notes.forEach((f, i) => pluck(c, f, t0 + i * spread, (0.5 - i * 0.02) * velocity));
}

/** Play the strings one at a time, slowly, so you can check each one rings. */
export function arpeggiate(chord) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + 0.02;
  let i = 0;
  chord.frets.forEach((fret, s) => {
    if (fret < 0) return;
    pluck(c, midiToFreq(OPEN_MIDI[s] + fret), t0 + i * 0.42, 0.55);
    i++;
  });
}

/** Sound a single string of a chord. Returns false if that string is muted. */
export function pluckString(chord, s, gain = 0.55) {
  const midi = stringMidi(chord, s);
  if (midi == null) return false;
  const c = audio();
  if (!c) return false;
  pluck(c, midiToFreq(midi), c.currentTime + 0.01, gain);
  return true;
}

export function click(accent = false, when = null) {
  const c = audio();
  if (!c) return;
  const t = when ?? c.currentTime;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.frequency.value = accent ? 1500 : 950;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.28, t + 0.001);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  osc.connect(amp).connect(master);
  osc.start(t);
  osc.stop(t + 0.08);
  osc.onended = () => { osc.disconnect(); amp.disconnect(); };
}

export function now() {
  const c = audio();
  return c ? c.currentTime : 0;
}
