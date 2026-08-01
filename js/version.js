// What build is actually running, for checking that a deploy landed.
//
// Two separate facts, and the difference between them is the useful part: the
// commit says which source this came from, the cache name says which copy of
// the bytes is being served. Ship a change and both move. Ship a commit that
// touches nothing shipped and only the first moves — which is correct, and
// indistinguishable from a broken deploy unless you can see both.

const ASK_MS = 1500;

/**
 * Ask the controlling worker. Resolves null when there isn't one — a first
 * visit before install, a hard reload, or a browser with no service workers.
 */
function askWorker() {
  const sw = navigator.serviceWorker;
  if (!sw?.controller) return Promise.resolve(null);

  return new Promise((resolve) => {
    const done = (v) => { sw.removeEventListener('message', onReply); clearTimeout(timer); resolve(v); };
    const onReply = (e) => { if (e.data?.build) done(e.data); };
    const timer = setTimeout(() => done(null), ASK_MS);
    sw.addEventListener('message', onReply);
    sw.controller.postMessage('version');
  });
}

/**
 * The cache name without going through the worker. Covers the window after a
 * worker has installed but before it controls this page, where postMessage has
 * nobody to talk to but the cache is already there.
 */
async function cacheName() {
  try {
    const keys = await caches.keys();
    return keys.find((k) => k.startsWith('chordgrip-')) ?? null;
  } catch {
    return null; // no Cache Storage: file://, or a private window somewhere
  }
}

/** `{ build, cache }`, either half possibly null. */
export async function buildInfo() {
  const fromWorker = await askWorker();
  if (fromWorker) return fromWorker;
  return { build: null, cache: await cacheName() };
}

/** One line: "build 4f2a91c · cache 79f2ff58961f", skipping whatever is unknown. */
export function buildLabel({ build, cache }) {
  const parts = [];
  if (build) parts.push(`build ${build}`);
  // The prefix is on every cache name, so it's noise in a line this short.
  if (cache) parts.push(`cache ${cache.replace(/^chordgrip-/, '')}`);
  return parts.join(' · ');
}
