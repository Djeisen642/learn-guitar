// Boot. Everything this file does is wiring — the work lives in the modules it
// pulls together:
//
//   router.js     hash -> view
//   chrome.js     the frame around the view: streak, tabs, rotation tip
//   lifecycle.js  what a view registers so navigating away stops it
//   updates.js    picking up a newly deployed version
//
// See README for the rest of the layout.

import { unlockAudio } from './audio.js';
import { initOrientationTip, paintStreak } from './chrome.js';
import { render } from './router.js';
import { registerServiceWorker } from './updates.js';

initOrientationTip();

window.addEventListener('hashchange', render);
document.addEventListener('click', unlockAudio, { once: true });

if (!location.hash) location.hash = '#/learn';
render();
paintStreak();

registerServiceWorker();
