# Working on Chordgrip

A dependency-free static site: no build step, no framework, ES modules loaded
straight from `index.html`. `README.md` has the file-by-file layout — read it
before adding anything.

## Commands

```sh
npm test        # headless Chromium against the real app; set CHROMIUM_PATH if
                # Playwright's bundled browser isn't where it expects
npm run serve   # static server; ES modules and the service worker need HTTP
```

There is no linter and no CI running the suite — `npm test` before pushing is
the only gate there is.

## Keep the complexity low

The app is small and should stay legible without tooling. The rules below are
not style preferences; each one exists because breaking it already caused a bug
here.

**One responsibility per module.** If you can't say what a file does in a single
line, it's doing more than one thing — split it. `app.js` was once the router,
seven views, the chord sheet, the wake lock and the service worker in 818 lines;
`fretboard.js` was geometry, touch handling, playback timing and three toggles
in one closure. Both hid live bugs in the seams.

**A second copy is a refactor, not a shortcut.** Two `h()` helpers drifted apart
until one grew a prop the other didn't have. The chord changer and the strumming
guide each carried the same look-ahead loop, and the same hole in it: stopping
cleared the repeating timer but not the beats already scheduled. Shared
behavior belongs in one module (`dom.js`, `metronome.js`), even at two callers.

**Separate what needs a screen from what doesn't.** Geometry, chord-shape
translation and playback timing are pure (`neck.js`, `shapes.js`,
`playback.js`); the view imports them. Logic that can only be checked by taking
a screenshot is logic nobody checks.

**Give each kind of record its own bag.** `store.js` keeps `learned`, `changes`,
`forms`, `flags` and `settings` apart. Don't multiplex one map with a key prefix
or a naming convention — change scores and formation times shared `best` once,
one higher-is-better and one lower-is-better, and the tempo sat among the
booleans where `getFlag` would have read it as `true`.

**Views clean up through `lifecycle.js`, once.** Register with `onLeave` at
construction, not inside a start handler — the router empties the registry
before it renders. Anything with a timer, an observer or a wake lock needs it.

**Hand work between screens through the URL.** The Songs tab links to
`#/practice/drill/G-D-Em-C`; it does not set a module variable for the drill to
find on its way past. A link that says what it loads can be shared, reloaded
and read.

**Ownership of the page is split and stays split.** Views own what's inside
`<main>`, `chrome.js` owns the frame around it (streak, tabs, rotation tip), and
`router.js` only maps URL segments to a view and a tab.

## Traps

- **A new module must be listed in `sw.js`.** Miss it and the app breaks only
  when offline. `npm test` fails if you forget, and `tools/stamp-sw.mjs` walks
  subdirectories, so `js/views/` is covered too.
- **Never bump the service worker's cache name by hand.** It's stamped from a
  hash of the shipped bytes at deploy time; the value in git is a placeholder.
- **Chord data runs low E to high E** — `frets` and `fingers` are ordered from
  the 6th string to the 1st, `-1` muted, `0` open. Same convention everywhere.
- **American spelling throughout**, in prose and comments alike.

## Comments

Say why, not what. The existing comments explain the reason a thing is the way
it is — the physical size of a fingertip, why a look-ahead scheduler beats
`setInterval`, which bug an assertion is guarding. Match that; don't narrate the
code underneath.
