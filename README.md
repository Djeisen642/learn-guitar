# Fretwise

A mobile-first web app for learning guitar chords on your phone. No build step, no
dependencies, no accounts — just static files served by GitHub Pages.

**Live site:** https://djeisen642.github.io/learn-guitar/

## What's in it

- **Learn** — a seven-stage path, ordered so each stage only uses shapes from the
  stages before it. Mark chords as learned; progress is saved on the device.
- **Chords** — all 35 shapes, with search and filters. Every chord opens a sheet
  with an SVG diagram, a per-string breakdown, a technique tip, and playback.
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
js/audio.js     Karplus–Strong pluck synthesis and the metronome click
js/store.js     localStorage progress: learned chords, best scores, day streak
js/app.js       hash router and all views
sw.js           cache-first service worker for offline use
```

Chord data uses one convention throughout: `frets` and `fingers` run from the low E
(6th string) to the high E (1st), with `-1` for muted and `0` for open.
