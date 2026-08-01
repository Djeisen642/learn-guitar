// Offline support, and the cache busting that goes with it.
//
// CACHE is stamped with a hash of the shipped files at deploy time by
// tools/stamp-sw.mjs, so a changed file always means a changed cache name and
// the old one gets dropped on activate. The value in git is only a placeholder.
const CACHE = 'chordgrip-dev';

// The commit this was deployed from, stamped alongside CACHE. It lives here
// rather than in a precached file on purpose: sw.js is excluded from the
// content hash, so naming the commit can't itself change the cache name. A
// commit that ships no byte changes should keep the cache it already has, and
// seeing that happen is half of what this is for.
const BUILD = 'dev';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './icon.svg',
  './icon-maskable.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './manifest.webmanifest',
  // Every module the app ships. `npm test` fails if one is missing here —
  // forgetting a new module is a bug that only ever shows up offline.
  './js/app.js',
  './js/audio.js',
  './js/chrome.js',
  './js/data.js',
  './js/diagram.js',
  './js/dom.js',
  './js/fretboard.js',
  './js/haptics.js',
  './js/lifecycle.js',
  './js/metronome.js',
  './js/neck.js',
  './js/notes.js',
  './js/playback.js',
  './js/router.js',
  './js/shapes.js',
  './js/store.js',
  './js/updates.js',
  './js/wake.js',
  './js/views/chords.js',
  './js/views/drill.js',
  './js/views/learn.js',
  './js/views/omc.js',
  './js/views/practice.js',
  './js/views/shared.js',
  './js/views/sheet.js',
  './js/views/songs.js',
  './js/views/strum.js',
  './js/version.js',
];

// The page asks what it's running; only the worker knows both halves.
self.addEventListener('message', (e) => {
  if (e.data === 'version') e.source?.postMessage({ build: BUILD, cache: CACHE });
});

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: answer instantly from cache, then refresh it in the
// background. Belt and braces against the stamp ever being skipped — a stale
// entry heals itself on the next load instead of persisting forever.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);

    const fresh = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (hit) {
      e.waitUntil(fresh);          // keep the worker alive for the refresh
      return hit;
    }
    return (await fresh) || (await cache.match('./index.html'));
  })());
});
