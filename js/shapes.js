// Turning a chord into the things a hand actually does.
//
// A chord's data is per string. A shape is per finger, and the two only line up
// when every finger stops exactly one string. Everything here is that
// translation, and it is pure: given a chord it returns targets, with no view
// and no geometry involved.

export const FINGER_NAMES = ['', 'index', 'middle', 'ring', 'pinky'];

/**
 * One target per finger, not per string: a finger barring three strings is a
 * single thing your hand does, so it's drawn and judged as one bar.
 *
 * @returns {Array<{fret:number, finger:number, strings:number[], pair?:boolean}>}
 */
export function targetsFor(chord, join = true) {
  const groups = new Map();
  chord.frets.forEach((fret, s) => {
    if (fret <= 0) return;
    const finger = chord.fingers?.[s] || 0;
    const key = finger ? `f${finger}@${fret}` : `s${s}@${fret}`;
    if (!groups.has(key)) groups.set(key, { fret, finger, strings: [] });
    groups.get(key).strings.push(s);
  });
  const targets = [...groups.values()];
  return join ? joinPairs(targets, chord) : targets;
}

/**
 * Let one flattened finger cover two neighboring strings — but only where a
 * real player would, which is rarer than it looks.
 *
 * Two dots side by side in the same fret is not on its own a reason to merge
 * them. Em, E and Am are always taught with two separate fingers; so are the
 * top two strings of Dsus4, where the whole trick is planting the ring and
 * pinky and leaving them there through the change. Merging those would teach a
 * fingering no one uses, on the instrument this is meant to transfer to.
 *
 * What is real is the mini-barre A — index flat across D and G, middle on B —
 * the standard answer to three fingers not fitting in one fret. So the pairs
 * come from the chord's own `join` list rather than from geometry, and a chord
 * earns an entry there by being played that way, not by being crowded.
 * Chords whose written fingering already bars (the easy F) arrive here as a
 * single target and pass straight through.
 */
function joinPairs(targets, chord) {
  const wanted = chord.join || [];
  if (!wanted.length) return targets;

  const single = new Map();                    // string -> its lone target
  for (const t of targets) {
    if (t.strings.length === 1) single.set(t.strings[0], t);
  }

  const joined = new Map();                    // target -> merged replacement
  const absorbed = [];                         // fingers the joins made spare
  for (const pair of wanted) {
    const [lo, hi] = [...pair].sort((a, b) => a - b);
    const lower = single.get(lo);
    const upper = single.get(hi);
    // The list is per chord, but a shape can arrive fingered differently; only
    // merge when both strings really are stopped at the same fret, and never
    // let one finger end up over three strings.
    if (!lower || !upper || lower.fret !== upper.fret) continue;
    if (joined.has(lower) || joined.has(upper)) continue;

    joined.set(lower, {
      fret: lower.fret,
      finger: Math.min(lower.finger, upper.finger) || lower.finger,
      strings: [lo, hi],
      pair: true,
    });
    joined.set(upper, null);                   // absorbed
    absorbed.push(upper.finger);
  }

  // A shape that used three fingers now uses two, so the ones above the finger
  // that got absorbed shuffle down. Without this A reads "index ×2, ring" and
  // asks you to skip a finger for no reason; the mini-barre is index and middle.
  const renumber = (f) => (f ? f - absorbed.filter((a) => a < f).length : f);

  return targets
    .map((t) => (joined.has(t) ? joined.get(t) : t))
    .filter(Boolean)
    .map((t) => ({ ...t, finger: renumber(t.finger) }));
}

/** How a target is described on screen: "index", "index ×2", "index bar". */
export function targetLabel(t) {
  if (!t.finger) return null;
  if (t.pair) return `${FINGER_NAMES[t.finger]} ×2`;
  if (t.strings.length > 1) return `${FINGER_NAMES[t.finger]} bar`;
  return FINGER_NAMES[t.finger];
}
