// Renders a chord as an inline SVG diagram.
// Strings run vertically, low E on the left, exactly as you'd see a chart in a book.

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, text) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

/**
 * @param {object} chord   entry from data.js
 * @param {object} opts    { size: 'sm' | 'lg', showFingers: boolean }
 */
export function chordDiagram(chord, opts = {}) {
  const { showFingers = true } = opts;
  const FRETS = 5;
  const left = 14;
  const top = 26;
  const w = 72;              // width of the string grid
  const h = 88;              // height of the fret grid
  const dx = w / 5;          // string spacing
  const dy = h / FRETS;      // fret spacing

  const svg = el('svg', {
    viewBox: '0 0 100 130',
    class: 'chord-svg',
    role: 'img',
    'aria-label': `${chord.full} chord diagram`,
  });

  // Where does the grid start? Chords like B sit above the nut.
  const played = chord.frets.filter((f) => f > 0);
  const minFret = played.length ? Math.min(...played) : 1;
  const maxFret = played.length ? Math.max(...played) : 1;
  const baseFret = maxFret > FRETS ? minFret : 1;
  const openPosition = baseFret === 1;

  // --- grid ---------------------------------------------------------------
  for (let s = 0; s < 6; s++) {
    svg.appendChild(el('line', {
      x1: left + s * dx, y1: top, x2: left + s * dx, y2: top + h, class: 'd-string',
    }));
  }
  for (let f = 0; f <= FRETS; f++) {
    svg.appendChild(el('line', {
      x1: left, y1: top + f * dy, x2: left + w, y2: top + f * dy, class: 'd-fret',
    }));
  }
  if (openPosition) {
    svg.appendChild(el('rect', { x: left - 1, y: top - 3.5, width: w + 2, height: 4, class: 'd-nut' }));
  } else {
    svg.appendChild(el('text', {
      x: left - 5, y: top + dy * 0.72, class: 'd-basefret', 'text-anchor': 'end',
    }, `${baseFret}fr`));
  }

  // --- open / muted markers ----------------------------------------------
  chord.frets.forEach((fret, s) => {
    const x = left + s * dx;
    if (fret === -1) {
      const r = 2.6;
      svg.appendChild(el('line', { x1: x - r, y1: top - 12 - r, x2: x + r, y2: top - 12 + r, class: 'd-mute' }));
      svg.appendChild(el('line', { x1: x - r, y1: top - 12 + r, x2: x + r, y2: top - 12 - r, class: 'd-mute' }));
    } else if (fret === 0) {
      svg.appendChild(el('circle', { cx: x, cy: top - 12, r: 2.8, class: 'd-open' }));
    }
  });

  // --- barres -------------------------------------------------------------
  for (const barre of chord.barres || []) {
    const row = barre.fret - baseFret;
    if (row < 0 || row >= FRETS) continue;
    const y = top + row * dy + dy / 2;
    const x1 = left + barre.from * dx;
    const x2 = left + barre.to * dx;
    svg.appendChild(el('rect', {
      x: x1 - 5, y: y - 5, width: (x2 - x1) + 10, height: 10, rx: 5, class: 'd-barre',
    }));
  }

  // --- finger dots --------------------------------------------------------
  chord.frets.forEach((fret, s) => {
    if (fret <= 0) return;
    const row = fret - baseFret;
    if (row < 0 || row >= FRETS) return;
    const x = left + s * dx;
    const y = top + row * dy + dy / 2;
    svg.appendChild(el('circle', { cx: x, cy: y, r: 5.4, class: 'd-dot' }));
    const finger = chord.fingers?.[s];
    if (showFingers && finger) {
      svg.appendChild(el('text', {
        x, y: y + 2.4, class: 'd-finger', 'text-anchor': 'middle',
      }, String(finger)));
    }
  });

  // --- string names -------------------------------------------------------
  ['E', 'A', 'D', 'G', 'B', 'E'].forEach((n, s) => {
    svg.appendChild(el('text', {
      x: left + s * dx, y: top + h + 11, class: 'd-stringname', 'text-anchor': 'middle',
    }, n));
  });

  return svg;
}
