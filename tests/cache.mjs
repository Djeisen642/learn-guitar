// Offline caching and cache busting.
//
// Two silent failure modes, both of which have nearly bitten:
//   - a new module ships but isn't precached, so the app breaks only offline
//   - the cache name isn't bumped, so people keep running the old app forever

import { cp, readFile, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { precached, modules, version } from '../tools/stamp-sw.mjs';
import { startServer } from './serve.mjs';

const exec = promisify(execFile);

export async function run(browser, base, log) {
  const problems = [];
  const fail = (s) => { problems.push(s); log(`  ✗ ${s}`); };
  const pass = (s) => log(`  ✓ ${s}`);

  const listed = precached();
  const { version: v, missing } = version();

  if (missing.length) fail(`sw.js precaches files that don't exist: ${missing.join(', ')}`);
  else pass(`all ${listed.length} precached files exist`);

  // Adding a module and forgetting to precache it only shows up offline.
  const unlisted = modules().filter((m) => !listed.includes(m));
  if (unlisted.length) fail(`shipped but not precached, so missing offline: ${unlisted.join(', ')}`);
  else pass(`all ${modules().length} JS modules are precached`);

  // The stamp has to be a pure function of the bytes, or it can't be trusted to
  // change exactly when the app changes.
  if (version().version !== v) fail('cache stamp is not deterministic');
  else pass(`cache stamp is deterministic (${v})`);

  // Every asset must actually be served, or install() rejects and the whole
  // worker fails to register — taking offline support with it.
  const page = await browser.newPage();
  const bad = [];
  for (const file of listed) {
    const res = await page.request.get(base + file);
    if (!res.ok()) bad.push(`${file} → ${res.status()}`);
  }
  await page.close();
  if (bad.length) fail(`precached assets not served: ${bad.join(', ')}`);
  else pass(`all ${listed.length} precached assets serve 200`);

  // The whole point, end to end: ship a change, and the browser must end up
  // running it. Everything above is static checks that pass whether or not the
  // worker ever actually swaps — which it silently didn't, for a while.
  const root = new URL('..', import.meta.url).pathname;
  const dir = await mkdtemp(join(tmpdir(), 'chordgrip-'));
  try {
    for (const f of ['index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'js', 'tools',
      ...listed.filter((n) => n.endsWith('.png') || n.endsWith('.svg'))]) {
      await cp(join(root, f), join(dir, f), { recursive: true });
    }
    const stampIt = () => exec('node', [join(dir, 'tools/stamp-sw.mjs')]);
    const cacheName = async () => (await readFile(join(dir, 'sw.js'), 'utf8')).match(/const CACHE = '([^']*)'/)[1];

    await stampIt();
    const first = await cacheName();

    const site = await startServer(dir);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(site.base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
      .catch(() => fail('service worker never took control'));

    // Ship a change exactly as a deploy would.
    const dataPath = join(dir, 'js/data.js');
    const src = await readFile(dataPath, 'utf8');
    await writeFile(dataPath, src.replace("id: 'horse'", "id: 'horse-changed'"));
    await stampIt();
    const second = await cacheName();

    if (second === first) fail(`cache name unchanged after a file changed (${first})`);
    else pass(`a changed file changes the cache name (${first.slice(-6)} → ${second.slice(-6)})`);

    // The worker must pick it up on its own, not only when poked. The page
    // reloads itself when the new worker takes over, so any evaluate here can
    // be torn down mid-flight — that navigation is the feature, not a fault.
    const keys = async () => {
      try { return await page.evaluate(() => caches.keys()); } catch { return []; }
    };
    await page.reload({ waitUntil: 'networkidle' });
    let swapped = false;
    for (let i = 0; i < 30 && !swapped; i++) {
      swapped = (await keys()).includes(second);
      if (!swapped) await new Promise((r) => setTimeout(r, 500));
    }
    if (!swapped) {
      fail('the new service worker never installed — the stamp is inert and only stale-while-revalidate is updating anything');
    } else {
      await page.waitForLoadState('networkidle').catch(() => {});
      if ((await keys()).includes(first)) fail(`old cache ${first} was not deleted`);
      else pass('a new worker installs on its own and drops the old cache');

      // And the running page must actually be the new code, not the old.
      const live = await page.evaluate(async () => {
        const m = await import('./js/data.js');
        return m.SONGS.some((s) => s.id === 'horse-changed');
      }).catch(() => false);
      if (!live) fail('cache swapped but the page is still running the old code');
      else pass('the page ends up running the shipped change');
    }

    await ctx.close();
    await site.stop();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  return problems;
}
