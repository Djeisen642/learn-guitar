// Everything outside the view container: the streak badge, the tab bar, and the
// rotation tip. Views own what's inside <main>; this owns the frame around it.

import * as store from './store.js';
import { buildInfo, buildLabel } from './version.js';

export function paintStreak() {
  const n = store.streak();
  const el = document.getElementById('streak');
  el.textContent = n ? `🔥 ${n}` : '';
  el.hidden = !n;
}

/**
 * Someone practiced. Records the day and repaints the badge together, because
 * doing one without the other leaves the header lying until the next route
 * change — which is exactly what the Play view used to do.
 */
export function notePractice() {
  store.touchStreak();
  paintStreak();
}

export function setActiveTab(tab) {
  document.querySelectorAll('.tabbar a').forEach((a) => {
    const on = a.dataset.tab === tab;
    a.classList.toggle('is-on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/** Play gives the fretboard the whole screen, header included. */
export const setPlayMode = (on) => document.body.classList.toggle('play-mode', on);

/**
 * The build stamp under the last view. Painted once at startup and never
 * repainted: it can only change by the worker swapping, and updates.js reloads
 * the page when that happens.
 */
export async function paintBuild() {
  const el = document.getElementById('build');
  const label = buildLabel(await buildInfo());
  el.textContent = label;
  // Nothing to say on a first load before any worker exists, and an empty line
  // reserving space under every page is worse than no line.
  el.hidden = !label;
}

/**
 * The manifest asks for portrait, but that only binds an installed PWA on
 * Android — a browser tab and iOS both ignore it. So ask the platform to lock
 * where we're allowed to, and otherwise tell people how to do it themselves.
 */
export function initOrientationTip() {
  const tip = document.getElementById('rotate-tip');
  const landscape = window.matchMedia('(orientation: landscape) and (max-height: 560px)');

  try {
    // iOS Safari has screen.orientation but no lock(), and elsewhere this only
    // resolves for an installed or fullscreen app — either way, never fatal.
    screen.orientation?.lock?.('portrait')?.catch(() => {});
  } catch { /* not permitted here */ }

  const update = () => {
    tip.hidden = !landscape.matches || store.getFlag('rotateTipSeen');
  };
  document.getElementById('rotate-dismiss').addEventListener('click', () => {
    store.setFlag('rotateTipSeen');
    tip.hidden = true;
  });
  landscape.addEventListener('change', update);
  update();
}
