// Minimal static file server. The app has no build step, so tests only need
// something that speaks HTTP — ES modules and service workers refuse file://.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export function startServer(root, port = 0) {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path.endsWith('/')) path += 'index.html';
      // normalize collapses any ../ before it can escape the site root
      const file = join(root, normalize(path).replace(/^(\.\.[/\\])+/, ''));
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address();
      resolve({
        base: `http://127.0.0.1:${actual}/`,
        stop: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

// `npm run serve` — handy for poking at the app by hand.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { base } = await startServer(new URL('..', import.meta.url).pathname, 8000);
  console.log(`serving ${base}`);
}
