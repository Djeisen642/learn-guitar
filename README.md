# Chordgrip

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

Chords are synthesized in the browser with Karplus–Strong plucked-string synthesis,
so there are no audio files to download and the whole app works offline once loaded.

## Built for a phone

- Installable to the home screen (PNG icons — iOS ignores SVG ones) and fully usable
  offline behind a cache-first service worker.
- Timed drills hold a screen wake lock so the phone doesn't dim mid-count, and the
  one-minute countdown runs against a wall-clock deadline so it can't drift or stall.
  Metronomes stop when you switch away rather than bursting on return.
- Synthesized buffers are cached per pitch, so a six-string strum allocates nothing
  after the first time; everything runs through a limiter so stacked notes don't clip.
- Tap targets are at least 44px, double-tap zoom is disabled on controls, and the
  strum area claims its touches so the page can't scroll under your thumb.
- Verified with no layout overflow from 320px up, plus landscape.
- Asks the platform to lock to portrait where that's allowed (an installed PWA on
  Android), and since neither a browser tab nor iOS honors that, a phone held in
  landscape gets a dismissible banner explaining how to lock rotation by hand.

## Running locally

The app itself has no dependencies and no build step, so any static server works
(ES modules and the service worker need HTTP, not `file://`):

```sh
npm run serve      # or: python3 -m http.server 8000
```

## Tests

```sh
npm install
npm test
```

Drives the real app in headless Chromium. Every assertion exists because
something actually broke:

- **Layout** — 7 phone sizes × 9 routes: no horizontal overflow, nothing spilling
  its container, no clipped tab labels, no console errors, tap targets ≥ 40px.
- **Regressions** — the chord sheet used to leave an invisible tap-blocking
  overlay after closing; a deep-linked sheet's close button navigated off the
  site; clearing the drill's chord list crashed.
- **Offline** — reloads with the network cut and still runs.
- **Fretboard geometry** — asserts frets and string spacing land within 0.5mm of
  a real 25.5" neck, that no chord's finger targets fall off the board, and that
  a phone too small to fit a real neck *says so* rather than quietly shrinking.
- **Touch honesty** — a chord must sound for three fingers one-per-target, and
  must stay silent for two fingers, for one broad touch straddling two targets,
  and for the right shape on the wrong fret.

Set `CHROMIUM_PATH` if Playwright's bundled browser isn't available.

`npm run icons` regenerates the PNG app icons from the SVG sources.

## Cache busting

The service worker's cache name is what invalidates it, and bumping it by hand is
a step you only notice when you forget — the failure is silent, and people keep
running the old app. So it isn't done by hand:

- `tools/stamp-sw.mjs` hashes the shipped bytes and writes the result into the
  cache name. The deploy workflow runs it, so every deploy that changes a file
  changes the cache name. The value committed to git is only a placeholder.
- The fetch strategy is stale-while-revalidate: a cached response is served
  immediately and refreshed in the background, so even a missed stamp heals
  itself on the next load rather than persisting forever.
- `npm test` checks that every shipped module is precached — adding a module and
  forgetting to list it is a bug that only appears offline — and that every
  precached file actually exists and serves.

## Deployment

`.github/workflows/pages.yml` publishes the repository root to GitHub Pages on every
push to `main`. Enable it once under **Settings → Pages → Source → GitHub Actions**.

## Layout

```
index.html        app shell: header, view container, bottom tab bar, chord sheet
styles.css        all styling; dark and light themes, safe-area aware
sw.js             cache-first service worker for offline use

js/app.js         boot: wires the modules below together and renders once
js/router.js      hash -> view, and the tab that goes with it
js/chrome.js      the frame around the view: streak badge, tabs, rotation tip
js/lifecycle.js   what a view registers so navigating away really stops it

js/data.js        chord shapes, curriculum stages, progressions, songs, strums
js/store.js       localStorage progress: learned chords, best scores, day streak
js/notes.js       tuning, note names, fret -> pitch math
js/audio.js       Karplus–Strong pluck synthesis and the metronome click
js/dom.js         the element helper every view builds with
js/wake.js        screen wake lock, and stopping when the user looks away
js/metronome.js   look-ahead beat scheduler, shared by the two click-track views
js/diagram.js     renders a chord as an inline SVG diagram
js/updates.js     picking up a newly deployed version

js/fretboard.js   Play: what's drawn, what the touches mean, what the buttons do
js/neck.js        the geometry behind it — no DOM, so it can be checked directly
js/shapes.js      a chord's frets and fingers -> one target per finger
js/playback.js    playing a song in its own rhythm, and the practice tempo

js/views/*.js     one file per screen, plus shared.js for the common pieces
```

Chord data uses one convention throughout: `frets` and `fingers` run from the low E
(6th string) to the high E (1st), with `-1` for muted and `0` for open.

Two rules keep the wiring honest. A view never cleans up after itself on the way
out — it registers cleanup with `lifecycle.js` and the router empties that before
it renders anything. And one screen hands work to another through the URL, never
through a module variable: the Songs tab's "practice with the changer" link is
`#/practice/drill/G-D-Em-C`, so it can be shared, reloaded and read.
