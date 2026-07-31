# Fretwise

A mobile-first web app for learning guitar chords on your phone. No build step, no
dependencies, no accounts — just static files served by GitHub Pages.

**Live site:** https://djeisen642.github.io/learn-guitar/

## What's in it

- **Learn** — a seven-stage path, ordered so each stage only uses shapes from the
  stages before it. Mark chords as learned; progress is saved on the device.
- **Chords** — all 35 shapes, with search and filters. Every chord opens a sheet
  with an SVG diagram, a per-string breakdown, a technique tip, and playback.
- **Play** — a life-size slice of a guitar neck. Frets 1-3 are drawn at true 25.5"
  scale spacing (36.4 / 34.3 / 32.4mm apart, strings 7.3mm apart), so the shape your
  hand makes on the glass is the shape it makes on the instrument. Place every
  numbered finger on its target and the chord only sounds once the whole shape is
  genuinely held — one finger per position, pressed just behind the fret.
- **Practice**
  - *One-minute changes* — the JustinGuitar drill: pick two chords, swap for 60
    seconds, tap on each clean change. Personal bests are stored per chord pair.
  - *Chord changer* — a metronome that calls chords on the downbeat at your tempo,
    so you learn to change in time rather than whenever you happen to be ready.
  - *Strumming patterns* — four patterns with a click track and a moving down/up guide.
- **Songs** — seven progressions (I–V–vi–IV, I–IV–V, 12-bar blues and friends) in
  several keys, each playable and loadable into the chord changer.

Chords are synthesised in the browser with Karplus–Strong plucked-string synthesis,
so there are no audio files to download and the whole app works offline once loaded.

## Built for a phone

- Installable to the home screen (PNG icons — iOS ignores SVG ones) and fully usable
  offline behind a cache-first service worker.
- Timed drills hold a screen wake lock so the phone doesn't dim mid-count, and the
  one-minute countdown runs against a wall-clock deadline so it can't drift or stall.
  Metronomes stop when you switch away rather than bursting on return.
- Synthesised buffers are cached per pitch, so a six-string strum allocates nothing
  after the first time; everything runs through a limiter so stacked notes don't clip.
- Tap targets are at least 44px, double-tap zoom is disabled on controls, and the
  strum area claims its touches so the page can't scroll under your thumb.
- Verified with no layout overflow from 320px up, plus landscape.
- Asks the platform to lock to portrait where that's allowed (an installed PWA on
  Android), and since neither a browser tab nor iOS honours that, a phone held in
  landscape gets a dismissible banner explaining how to lock rotation by hand.

## Running locally

Any static server works — ES modules and the service worker need HTTP, not `file://`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment

`.github/workflows/pages.yml` publishes the repository root to GitHub Pages on every
push to `main`. Enable it once under **Settings → Pages → Source → GitHub Actions**.

## Layout

```
index.html      app shell: header, view container, bottom tab bar, chord sheet
styles.css      all styling; dark and light themes, safe-area aware
js/data.js      chord shapes, curriculum stages, progressions, strum patterns
js/diagram.js   renders a chord as an inline SVG diagram
js/notes.js     tuning, note names, fret -> pitch maths
js/audio.js     Karplus–Strong pluck synthesis and the metronome click
js/fretboard.js the life-size neck: real fret maths, multi-touch finger targets
js/store.js     localStorage progress: learned chords, best scores, day streak
js/app.js       hash router and all views
sw.js           cache-first service worker for offline use
```

Chord data uses one convention throughout: `frets` and `fingers` run from the low E
(6th string) to the high E (1st), with `-1` for muted and `0` for open.
