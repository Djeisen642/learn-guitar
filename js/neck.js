// The maths behind the life-size neck: where frets and strings land, how big a
// target may honestly be, and which touch belongs to which target.
//
// Kept apart from the view because none of it needs a DOM. Geometry that can
// only be checked by taking a screenshot is geometry nobody checks.
//
// Everything is computed in millimetres and converted to pixels here. CSS
// physical units are fiction on a phone (1mm is always 3.78px regardless of the
// real display), so declaring `43mm` would produce a neck two thirds of life size.

export const SCALE_MM = 647.7;   // 25.5" scale length, the Fender/Martin standard
export const STRING_MM = 7.3;    // string centres at the nut
export const EDGE_MM = 3.6;      // fretboard beyond the outer strings
export const FRETS = 3;          // every open chord lives inside frets 1-3

// Phones cluster tightly around 6 CSS px per physical millimetre: an iPhone 12
// is 6.04, a Pixel 7 6.24, a Galaxy S23 5.58. There's no API for real DPI, so
// this is the honest average.
export const PX_PER_MM = 6.05;

export const MARKER_PX = 30;     // gap above the nut for the o / x row; matches .fb margin-top
const SIDE_MIN_PX = 62;          // narrowest the column beside the neck may get

// A real neck carries ~3.6mm of fretboard past the outer string, and your hand
// wraps around it. A phone can't be wrapped around, so that margin is just
// glass you have to reach across before the first string. The board is run off
// the right edge instead and the surplus clipped, putting the outer string
// almost against the rim — where a finger curling over the edge actually lands.
// Physical millimetres, against the unscaled constant, since the phone's rim
// doesn't shrink when the board does.
const STRING_EDGE_MM = 1.5;
const LAYOUT_GAP_PX = 12;        // page padding plus the gap to the side column

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
const WIRE_INSET_MM = 1;         // keep the fret wires readable as edges
const EDGE_FORGIVE_MM = 1.5;

/** Distance from the nut to fret `n`, in millimetres. */
export const fretMM = (n) => SCALE_MM - SCALE_MM / Math.pow(2, n / 12);

// Press just behind the fret wire — that's where a note rings cleanly, so the
// targets sit there and the habit comes along for free.
export const pressMM = (n) => fretMM(n - 1) + (fretMM(n) - fretMM(n - 1)) * 0.72;

/** Where string `s` sits across the board, in pixels. */
export const stringX = (s, ppm) => (EDGE_MM + s * STRING_MM) * ppm;

/** How close to life size the board ended up, as a whole percentage. */
export const sizePercent = (ppm) => Math.round((ppm / PX_PER_MM) * 100);

/**
 * Size the neck to the phone in hand: life size where it fits, scaled down
 * where it doesn't, never larger than life.
 *
 * @param {number} avail   pixels of height the board may use
 * @param {number} viewW   viewport width in pixels
 */
export function fitBoard(avail, viewW) {
  const trueH = fretMM(FRETS) * PX_PER_MM;

  // Only the board up to the outer string takes layout width — everything past
  // it runs off the screen and is clipped.
  const toOuter = EDGE_MM + STRING_MM * 5;
  const edgePx = STRING_EDGE_MM * PX_PER_MM;
  const roomW = viewW - SIDE_MIN_PX - LAYOUT_GAP_PX;

  const ppm = Math.min(
    PX_PER_MM,                                  // never larger than life
    avail > 0 ? (avail / trueH) * PX_PER_MM : PX_PER_MM,
    (roomW - edgePx) / toOuter,
  );

  return {
    ppm,
    boardW: (STRING_MM * 5 + EDGE_MM * 2) * ppm,
    boardH: Math.max(fretMM(FRETS) * ppm, Math.min(avail, fretMM(FRETS + 2) * ppm)),
    // The stage is the visible slice; the board overflows it and gets cut off.
    stageW: toOuter * ppm + edgePx,
  };
}

/**
 * The largest rectangle that is still a correct answer for target `t`: the full
 * fret cell tall, and as wide as the string lane can grow before it would reach
 * a neighbouring finger in the same fret.
 *
 * `others` is every target in the shape, `t` included; only the ones sharing a
 * fret can crowd it.
 */
export function targetRect(t, others, ppm, boardW) {
  const half = (STRING_MM / 2) * ppm;
  const inset = WIRE_INSET_MM * ppm;
  const loX = stringX(Math.min(...t.strings), ppm);
  const hiX = stringX(Math.max(...t.strings), ppm);

  const grow = ((LANE_MAX_MM - STRING_MM) / 2) * ppm;
  let left = loX - half - grow;
  let right = hiX + half + grow;
  for (const other of others) {
    // Only fingers sharing this fret compete: other frets are separate cells.
    if (other === t || other.fret !== t.fret) continue;
    const oLo = stringX(Math.min(...other.strings), ppm);
    const oHi = stringX(Math.max(...other.strings), ppm);
    if (oHi < loX) left = Math.max(left, (oHi + loX) / 2);
    if (oLo > hiX) right = Math.min(right, (oLo + hiX) / 2);
  }

  const x1 = Math.max(0, left);
  const x2 = Math.min(boardW, right);
  const y1 = fretMM(t.fret - 1) * ppm + inset;
  const y2 = fretMM(t.fret) * ppm - inset;
  return { x1, x2, y1, y2, cx: (x1 + x2) / 2, cy: pressMM(t.fret) * ppm };
}

/**
 * Distance from a touch to a target's centre, or null if the touch is outside
 * the drawn rectangle. Hit area and drawing come from the same rect, so nothing
 * is secretly bigger or smaller than it looks.
 */
function reach(rect, p, ppm) {
  const m = EDGE_FORGIVE_MM * ppm;
  if (p.x < rect.x1 - m || p.x > rect.x2 + m || p.y < rect.y1 - m || p.y > rect.y2 + m) return null;
  return Math.hypot(p.x - rect.cx, p.y - rect.cy);
}

/**
 * Match touches to targets one-to-one, closest pair first, and return the
 * indices of the targets that ended up covered.
 *
 * Adjacent targets are only ~7mm apart, so without this a single broad touch
 * would satisfy two positions at once and hand out a clean chord for a sloppy
 * shape.
 */
export function matchTouches(targets, points, ppm, boardW) {
  const rects = targets.map((t) => targetRect(t, targets, ppm, boardW));

  const pairs = [];
  targets.forEach((t, ti) => points.forEach((p, pi) => {
    const d = reach(rects[ti], p, ppm);
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
