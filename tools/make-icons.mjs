// Regenerates the PNG app icons from the SVG sources.
//
// PNGs are needed because iOS ignores an SVG apple-touch-icon, so a home-screen
// install would otherwise get a blank tile. Run after editing icon.svg:
//   npm run icons

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;

const JOBS = [
  // Square: iOS applies its own corner mask, so baked-in corners double-round.
  { src: 'icon.svg', out: 'icon-180.png', size: 180, square: true },
  { src: 'icon.svg', out: 'icon-192.png', size: 192 },
  { src: 'icon.svg', out: 'icon-512.png', size: 512 },
  { src: 'icon-maskable.svg', out: 'icon-maskable-512.png', size: 512 },
];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

for (const job of JOBS) {
  let svg = readFileSync(root + job.src, 'utf8');
  if (job.square) svg = svg.replace('rx="112" ', '');
  const page = await browser.newPage({ viewport: { width: job.size, height: job.size } });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${job.size}px;height:${job.size}px}</style>${svg}`,
  );
  await page.screenshot({ path: root + job.out });
  await page.close();
  console.log(`wrote ${job.out} (${job.size}px)`);
}

await browser.close();
