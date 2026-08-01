// The hash router: pick a view, put it on screen, light the right tab.
//
// Nothing here knows how any view works — it hands out the URL segments and
// gets a node back. Views clean up after themselves through lifecycle.js, which
// is emptied here before anything else happens.

import { fill } from './dom.js';
import { runTeardown } from './lifecycle.js';
import { paintStreak, setActiveTab, setPlayMode } from './chrome.js';
import { FretboardView } from './fretboard.js';
import { openSheet, closeSheet, noteAppRoute } from './views/sheet.js';
import { LearnView } from './views/learn.js';
import { ChordsView } from './views/chords.js';
import { SongsView } from './views/songs.js';
import { PracticeView } from './views/practice.js';
import { OmcView } from './views/omc.js';
import { DrillView } from './views/drill.js';
import { StrumView } from './views/strum.js';

// #/practice/<tool>/<args…>
const DRILLS = {
  omc: (parts) => OmcView(parts[2], parts[3]),
  drill: (parts) => DrillView(parts[2]),
  strum: () => StrumView(),
};

// #/<section>/<args…>. Every entry carries the tab it lights, so the two can't
// disagree — they used to be a switch and a separate list of section names.
const SECTIONS = {
  learn: { tab: 'learn', view: () => LearnView() },
  chords: { tab: 'chords', view: () => ChordsView() },
  songs: { tab: 'songs', view: () => SongsView() },
  play: { tab: 'play', view: () => FretboardView() },
  practice: { tab: 'practice', view: (parts) => (DRILLS[parts[1]] || PracticeView)(parts) },
};

export function render() {
  runTeardown();
  const parts = (location.hash.replace(/^#\/?/, '') || 'learn').split('/');

  // The chord sheet lays over whatever view is already there rather than
  // replacing it, so it leaves <main> alone.
  if (parts[0] === 'chord') {
    openSheet(parts[1]);
    return;
  }
  closeSheet();
  noteAppRoute();

  const section = SECTIONS[parts[0]] || SECTIONS.learn;
  fill(document.getElementById('view'), section.view(parts));
  window.scrollTo(0, 0);
  setPlayMode(parts[0] === 'play');
  setActiveTab(section.tab);
  paintStreak();
}
