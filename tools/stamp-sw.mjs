// Stamps a content hash into the service worker's cache name.
//
// The cache name is what invalidates it: a new name makes the next install
// refetch everything and the old cache get dropped. Bumping that by hand is a
// step you only notice when you forget, and the failure is silent — people keep
// running the old app. This derives it from the bytes instead.
//
// Run at deploy time (see .github/workflows/pages.yml) so the shipped worker
// always matches the shipped files. The copy in git keeps a placeholder; there
// is still no build step for local development.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const swPath = `${root}sw.js`;

/** The files sw.js precaches, read out of sw.js so the two can't drift. */
export function precached(sw = readFileSync(swPath, 'utf8')) {
  const listed = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  return [...new Set(['index.html', ...listed])].sort();
}

/**
 * Every ES module the app actually ships, subdirectories included — this is
 * what catches a new module that nobody remembered to precache, and it would be
 * a poor guard if moving a file one folder down made it stop looking.
 */
export function modules(dir = 'js') {
  return readdirSync(`${root}${dir}`, { withFileTypes: true })
    .flatMap((e) => {
      if (e.isDirectory()) return modules(join(dir, e.name));
      return e.name.endsWith('.js') ? [join(dir, e.name)] : [];
    })
    .sort();
}

/**
 * Hash of the shipped bytes. sw.js is deliberately excluded — it's the file
 * being rewritten, so including it would never settle.
 */
export function version() {
  const files = precached();
  const hash = createHash('sha256');
  const missing = [];
  for (const file of files) {
    try {
      hash.update(file);
      hash.update(readFileSync(root + file));
    } catch {
      missing.push(file);
    }
  }
  return { version: hash.digest('hex').slice(0, 12), files, missing };
}

export function stamp() {
  const sw = readFileSync(swPath, 'utf8');
  const { version: v, files, missing } = version();
  if (missing.length) throw new Error(`sw.js precaches files that don't exist: ${missing.join(', ')}`);
  const next = sw.replace(/const CACHE = '[^']*';/, `const CACHE = 'chordgrip-${v}';`);
  if (next !== sw) writeFileSync(swPath, next);
  return { version: v, count: files.length, changed: next !== sw };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const r = stamp();
    console.log(r.changed
      ? `stamped cache chordgrip-${r.version} over ${r.count} files`
      : `cache already stamped ${r.version}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
