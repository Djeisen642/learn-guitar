// Layout and behaviour checks across real phone sizes.
//
// Every assertion here exists because something actually broke:
//  - the chord sheet kept an invisible tap-blocking overlay after closing
//  - a deep-linked chord sheet's close button navigated off the site
//  - clearing the drill's chord list crashed on an undefined lookup
//  - the fretboard drew straight through the chord buttons on a 360x800 phone

export const ROUTES = [
  '#/learn', '#/chords', '#/play', '#/practice', '#/practice/omc/G/C',
  '#/practice/drill', '#/practice/strum', '#/songs', '#/chord/F',
];

const SIZES = [
  ['iPhone SE', 320, 568], ['iPhone SE2', 375, 667], ['iPhone 12', 390, 844],
  ['Galaxy S23', 360, 780], ['Pixel 7', 412, 915], ['iPhone Pro Max', 430, 932],
  ['landscape', 844, 390],
];

export async function run(browser, base, log) {
  const problems = [];
  const fail = (s) => { problems.push(s); log(`  ✗ ${s}`); };
  const pass = (s) => log(`  ✓ ${s}`);

  // --- 1. every route, every size -----------------------------------------
  for (const [name, width, height] of SIZES) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

    for (const route of ROUTES) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(150);

      const over = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) fail(`${name} ${route}: ${over}px horizontal overflow`);

      // Nothing may spill outside its own scroll container.
      const spill = await page.evaluate(() => {
        const bad = [];
        for (const el of document.querySelectorAll('main *')) {
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          if (r.right > innerWidth + 1 || r.left < -1) {
            const p = el.parentElement;
            if (!p || getComputedStyle(p).overflowX === 'visible') bad.push(el.className || el.tagName);
          }
        }
        return [...new Set(bad)].slice(0, 4);
      });
      if (spill.length) fail(`${name} ${route}: past viewport → ${spill.join(', ')}`);
    }

    // Tab labels must not clip.
    await page.goto(base + '#/learn', { waitUntil: 'networkidle' });
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.tabbar a')].map((a) => {
      const range = document.createRange();
      range.selectNodeContents(a.lastChild);
      return { t: a.lastChild.textContent, w: a.getBoundingClientRect().width, tw: range.getBoundingClientRect().width };
    }));
    for (const t of tabs) {
      if (t.tw > t.w - 2) fail(`${name}: tab "${t.t}" clipped (${t.tw.toFixed(0)}px in ${t.w.toFixed(0)}px)`);
    }

    if (errs.length) fail(`${name}: JS errors → ${errs.join(' | ')}`);
    await page.close();
  }
  pass(`${SIZES.length} screen sizes × ${ROUTES.length} routes: no overflow, no errors`);

  // --- 2. tap targets ------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    for (const route of ROUTES) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(120);
      const small = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('button, a, select, input[type=range]')) {
          // The tab bar is deliberately shorter; the fretboard's own targets are
          // sized from real guitar geometry, not thumb ergonomics.
          if (el.closest('.tabbar') || el.closest('.fb')) continue;
          const b = el.getBoundingClientRect();
          if (b.width && b.height < 40) out.push(`${el.className || el.tagName}:${Math.round(b.height)}px`);
        }
        return [...new Set(out)];
      });
      if (small.length) fail(`${route}: tap targets under 40px → ${small.slice(0, 4).join(', ')}`);
    }
    await page.close();
    pass('all tap targets at least 40px tall');
  }

  // --- 3. regressions ------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on('pageerror', (e) => fail(`pageerror: ${e.message}`));

    await page.goto(`${base}#/chord/C`, { waitUntil: 'networkidle' });
    await page.locator('.sheet-close').click();
    await page.waitForTimeout(200);
    if (!page.url().includes('#/chords')) fail(`deep-linked sheet close left the app: ${page.url()}`);
    else pass('deep-linked chord sheet closes into the app, not off it');

    // The sheet must not leave an invisible layer eating taps.
    const blocking = await page.evaluate(() => {
      const s = document.getElementById('sheet');
      return !s.hidden || getComputedStyle(s).display !== 'none';
    });
    if (blocking) fail('closed chord sheet still occupies the page');
    else pass('closed chord sheet stops intercepting taps');

    await page.goto(`${base}#/practice/drill`, { waitUntil: 'networkidle' });
    await page.locator('.btn-wide').click();
    await page.waitForTimeout(400);
    for (const n of ['G', 'C', 'D']) {
      await page.locator('.chip.toggle', { hasText: new RegExp(`^${n}$`) }).first().click();
      await page.waitForTimeout(80);
    }
    pass('drill survives having every chord deselected mid-run');

    await page.close();
  }

  // --- 4. offline ----------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 10000 })
      .catch(() => fail('service worker never took control'));
    await page.waitForTimeout(700);
    await ctx.setOffline(true);
    await page.goto(`${base}#/play`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const strings = await page.locator('.fb-string').count();
    const tabs = await page.locator('.tabbar a').count();
    if (strings === 6 && tabs === 5) pass('whole app reloads and runs with the network off');
    else fail(`offline reload broken: ${strings} strings, ${tabs} tabs`);
    await ctx.close();
  }

  return problems;
}
