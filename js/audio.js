// Tiny Web Audio engine: plucked-string synthesis (Karplus-Strong) for chords,
// plus a metronome click. No samples, so nothing to download.

import { OPEN_MIDI, midiToFreq, stringMidi } from './notes.js';

let ctx = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  const c = audio();
  if (c && c.state === 'suspended') c.resume();
}

/** One plucked string, built from filtered noise fed through a delay line. */
function pluck(c, freq, when, gain = 0.6) {
  const N = Math.max(2, Math.round(c.sampleRate / freq));
  const seconds = 3;
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);

  // Excitation: a short burst of noise, one wavelength long.
  for (let i = 0; i < N; i++) data[i] = Math.random() * 2 - 1;

  // Karplus-Strong: average each sample with its neighbour a wavelength back.
  const decay = 0.996;
  for (let i = N; i < data.length; i++) {
    data[i] = decay * 0.5 * (data[i - N] + data[i - N + 1]);
  }

  const src = c.createBufferSource();
  src.buffer = buf;

  // Roll off the fizz so it sounds like wood rather than a modem.
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3200;

  const amp = c.createGain();
  amp.gain.setValueAtTime(0, when);
  amp.gain.linearRampToValueAtTime(gain, when + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 2.6);

  src.connect(tone).connect(amp).connect(c.destination);
  src.start(when);
  src.stop(when + seconds);
}

/** Strum a chord entry from data.js. direction: 'down' | 'up'. */
export function strum(chord, direction = 'down') {
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
  notes.forEach((f, i) => pluck(c, f, t0 + i * spread, 0.5 - i * 0.02));
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
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

export function now() {
  const c = audio();
  return c ? c.currentTime : 0;
}
