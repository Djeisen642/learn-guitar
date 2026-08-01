// Getting a newly deployed version in front of someone, once.

const SETTLED_MS = 10_000;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // A new worker takes about three seconds to install after a reload, by which
  // time this page has already been served from the old cache — so without this
  // you'd see the previous version and only get the new one on a second visit.
  // Reload once when a new worker takes over.
  const hadController = !!navigator.serviceWorker.controller;
  const openedAt = Date.now();
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Not on first install — there was no old version to replace. And not once
    // someone is settled in and possibly mid-drill; the next visit will pick it
    // up anyway.
    if (!hadController || reloading || Date.now() - openedAt > SETTLED_MS) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  });
}
