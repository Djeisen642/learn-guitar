// Note maths shared by the synth and the on-screen fretboard.

export const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4, low -> high

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const noteName = (midi) => NAMES[((midi % 12) + 12) % 12];

/** MIDI note a string sounds in this chord, or null when the string is muted. */
export function stringMidi(chord, s) {
  const fret = chord.frets[s];
  return fret < 0 ? null : OPEN_MIDI[s] + fret;
}
