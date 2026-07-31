// npm test — boots a static server, drives the app in headless Chromium.
//
// Set CHROMIUM_PATH if Playwright's bundled browser isn't where it expects
// (some sandboxes ship a preinstalled one).

import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import * as layout from './layout.mjs';
import * as fretboard from './fretboard.mjs';

const root = new URL('..', import.meta.url).pathname;
const { base, stop } = await startServer(root);
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const log = (s) => console.log(s);
const suites = [['layout & behaviour', layout], ['fretboard', fretboard]];
let problems = [];

for (const [name, suite] of suites) {
  console.log(`\n${name}`);
  problems = problems.concat(await suite.run(browser, base, log));
}

await browser.close();
await stop();

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  problems.forEach((p) => console.log(`  - ${p}`));
  process.exit(1);
}
console.log('\nAll clear.');
