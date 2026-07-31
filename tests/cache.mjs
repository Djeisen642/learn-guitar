// Offline caching and cache busting.
//
// Two silent failure modes, both of which have nearly bitten:
//   - a new module ships but isn't precached, so the app breaks only offline
//   - the cache name isn't bumped, so people keep running the old app forever

import { precached, modules, version } from '../tools/stamp-sw.mjs';

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

  return problems;
}
