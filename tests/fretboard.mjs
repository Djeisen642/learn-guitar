// The fretboard's two promises, checked against reality.
//
//  1. It is a real neck, not a picture of one — frets and strings land where a
//     25.5" guitar puts them, or the app says plainly that it scaled down.
//  2. A chord only sounds when the shape is genuinely held. Adjacent targets sit
//     ~7mm apart with a ~5mm touch tolerance, so one broad touch overlaps two of
//     them; without one-to-one matching a sloppy shape would pass.

const PX_PER_MM = 6.05;             // must match js/fretboard.js
const SCALE_MM = 647.7;
const fretMM = (n) => SCALE_MM - SCALE_MM / Math.pow(2, n / 12);

export async function run(browser, base, log) {
  const problems = [];
  const fail = (s) => { problems.push(s); log(`  ✗ ${s}`); };
  const pass = (s) => log(`  ✓ ${s}`);

  // --- geometry ------------------------------------------------------------
  for (const [name, w, h] of [['Galaxy S23', 360, 780], ['iPhone 12', 390, 844], ['Pixel 7', 412, 915]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    await page.goto(`${base}#/play`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const g = await page.evaluate(() => ({
      width: document.querySelector('.fb').getBoundingClientRect().width,
      frets: [...document.querySelectorAll('.fb-fret')].map((f) => parseFloat(f.style.top)),
      strings: [...document.querySelectorAll('.fb-string')].map((s) => parseFloat(s.style.left)),
      stat: document.querySelector('.fb-stat').textContent,
    }));
    const mm = (px) => px / PX_PER_MM;
    const scale = mm(g.frets[0]) / fretMM(1);

    if (scale > 0.99) {
      for (let n = 1; n <= 3 && n <= g.frets.length; n++) {
        const off = Math.abs(mm(g.frets[n - 1]) - fretMM(n));
        if (off > 0.5) fail(`${name}: fret ${n} is ${off.toFixed(1)}mm off a real neck`);
      }
      const gap = mm(g.strings[1] - g.strings[0]);
      if (Math.abs(gap - 7.3) > 0.2) fail(`${name}: string spacing ${gap.toFixed(1)}mm, real is 7.3mm`);
      if (!/life size/.test(g.stat)) fail(`${name}: at life size but says "${g.stat}"`);
      pass(`${name}: life size — neck ${mm(g.width).toFixed(1)}mm wide, frets true to 0.5mm`);
    } else {
      // Too small for a real neck is allowed; quietly pretending isn't.
      if (!/\d+% size/.test(g.stat)) fail(`${name}: scaled to ${(scale * 100).toFixed(0)}% but says "${g.stat}"`);
      else pass(`${name}: too small for a real neck, and says so ("${g.stat}")`);
    }

    // Targets must name the finger, not just number it — "1" means nothing to
    // someone who has never been told the numbering.
    const labels = await page.evaluate(() => [...document.querySelectorAll('.fb-target')].map((t) => ({
      num: t.querySelector('.fb-target-num')?.textContent,
      name: t.querySelector('.fb-target-name')?.textContent,
      w: Math.round(t.getBoundingClientRect().width),
      h: Math.round(t.getBoundingClientRect().height),
    })));
    const named = ['index', 'middle', 'ring', 'pinky'];
    for (const l of labels) {
      if (!named.some((n) => l.name?.startsWith(n))) fail(`${name}: target ${l.num} labelled "${l.name}"`);
      // A circle the size of a fingertip was too small to hit or to label.
      if (l.w < 30 || l.h < 60) fail(`${name}: target ${l.num} only ${l.w}x${l.h}px`);
    }
    if (labels.length) pass(`${name}: targets name the finger`);

    // A major puts three fingers on neighbouring strings at one fret. The middle
    // one must stay inside its 7.3mm lane — widening it would start accepting
    // the neighbouring string, which is a wrong note — while still standing the
    // full height of the fret cell, where the pitch is identical anyway.
    if (scale > 0.99) {
      // A major is the case that matters: three fingers on neighbouring strings
      // in one fret, so the middle one is hemmed in on both sides. A chord like
      // Em only crowds one side, and there the lane is allowed to widen.
      await page.locator('.fb-pick', { hasText: /^A$/ }).first().click();
      await page.waitForTimeout(250);
      const boxed = (await page.evaluate(() => [...document.querySelectorAll('.fb-target')].map((t) => ({
        name: t.querySelector('.fb-target-name')?.textContent,
        w: t.getBoundingClientRect().width,
        h: t.getBoundingClientRect().height,
      })))).find((l) => l.name === 'middle');
      if (!boxed) fail(`${name}: no middle-finger target to measure`);
      else {
        const wide = boxed.w / PX_PER_MM;
        const tall = boxed.h / PX_PER_MM;
        if (wide > 7.6) fail(`${name}: boxed-in target ${wide.toFixed(1)}mm wide, past the 7.3mm string lane`);
        else if (tall < 28) fail(`${name}: target ${tall.toFixed(1)}mm tall, fret cell is ~34mm`);
        else pass(`${name}: boxed-in target ${wide.toFixed(1)}×${tall.toFixed(1)}mm — full cell, never past the lane`);
      }
    }

    // A phone has a rim and a case lip where a fretboard just ends flat, so the
    // outer string must not sit hard against the screen edge.
    const guardMM = await page.evaluate(() => {
      const s = [...document.querySelectorAll('.fb-string')].pop().getBoundingClientRect();
      return window.innerWidth - (s.left + s.width / 2);
    }) / PX_PER_MM;
    if (guardMM < 6.5) fail(`${name}: outer string only ${guardMM.toFixed(1)}mm from the screen edge`);
    else pass(`${name}: outer string ${guardMM.toFixed(1)}mm clear of the phone's edge`);

    // The narrow column must not clip its own labels.
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.fb-pick')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
    if (clipped.length) fail(`${name}: side list clips ${clipped.join(', ')}`);
    else pass(`${name}: every song and chord label fits the column`);

    // Every chord's targets must sit on the board.
    for (const id of ['C', 'G', 'A', 'Fmini']) {
      await page.locator('.fb-pick', { hasText: new RegExp(`^${id === 'Fmini' ? 'F' : id}$`) }).first().click();
      await page.waitForTimeout(200);
      const off = await page.evaluate(() => {
        const b = document.querySelector('.fb').getBoundingClientRect();
        return [...document.querySelectorAll('.fb-target')]
          .filter((t) => { const r = t.getBoundingClientRect(); return r.bottom > b.bottom + 1 || r.top < b.top - 1; })
          .length;
      });
      if (off) fail(`${name}: ${id} has ${off} finger target(s) off the board`);
    }
    await page.close();
  }

  // --- the shape must actually be held -------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on('pageerror', (e) => fail(`pageerror: ${e.message}`));
    await page.goto(`${base}#/play`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.locator('.fb-pick', { hasText: /^A$/ }).first().click();
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      window.__notes = 0;
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...a) { window.__notes++; return start.apply(this, a); };
    });

    const spots = await page.evaluate(() => [...document.querySelectorAll('.fb-target')].map((t) => {
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }));
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: pts.map((p, id) => ({ x: p.x, y: p.y, id })),
    });
    const reset = async () => { await touch('touchEnd', []); await page.waitForTimeout(280); await page.evaluate(() => { window.__notes = 0; }); };
    const rang = () => page.evaluate(() => window.__notes > 0);
    const lit = () => page.locator('.fb-target.is-on').count();

    const cases = [
      ['all three fingers, one per spot', spots, true, 3],
      ['only two of the three', spots.slice(0, 2), false, 2],
      ['one broad touch between two spots', [{ x: (spots[0].x + spots[1].x) / 2, y: (spots[0].y + spots[1].y) / 2 }], false, 1],
      ['three fingers on the wrong fret', spots.map((s) => ({ x: s.x, y: s.y - 120 })), false, 0],
    ];
    for (const [label, pts, shouldRing, shouldLight] of cases) {
      await touch('touchStart', pts);
      await page.waitForTimeout(480);
      const did = await rang();
      const on = await lit();
      if (did !== shouldRing) fail(`${label}: chord ${did ? 'sounded' : 'stayed silent'}, expected the opposite`);
      else if (on !== shouldLight) fail(`${label}: lit ${on} targets, expected ${shouldLight}`);
      else pass(`${label} → ${shouldRing ? 'sounds' : 'silent'}, ${on} lit`);
      await reset();
    }

    // Haptics: a pulse under ~10ms is too short for a phone's motor to spin up,
    // so the old 6ms ticks were felt by nobody.
    await page.evaluate(() => {
      window.__buzz = [];
      navigator.vibrate = (p) => { window.__buzz.push(p); return true; };
    });
    await touch('touchStart', spots.slice(0, 1));
    await page.waitForTimeout(160);
    const onLand = await page.evaluate(() => window.__buzz.slice());
    if (!onLand.length) fail('no vibration when a finger lands on its target');
    else if (onLand.some((p) => typeof p === 'number' && p < 10)) fail(`vibration pulse too short to feel: ${onLand.join(',')}ms`);
    else pass(`finger landing buzzes (${onLand.join(', ')}ms)`);

    // navigator.vibrate cancels whatever is already running, so fingers landing
    // together used to fire pulses that cut each other short. One solid tick.
    await page.evaluate(() => { window.__buzz = []; });
    await touch('touchStart', spots.slice(0, 1));
    await page.waitForTimeout(20);
    await touch('touchMove', spots.slice(0, 2));
    await page.waitForTimeout(20);
    await touch('touchMove', spots);
    await page.waitForTimeout(120);
    const burst = await page.evaluate(() => window.__buzz.filter((p) => typeof p === 'number'));
    if (burst.length > 1) fail(`${burst.length} ticks inside 45ms — they cancel each other`);
    else pass('simultaneous finger landings coalesce into one tick');
    await reset();

    await page.evaluate(() => { window.__buzz = []; });
    await touch('touchStart', spots);
    await page.waitForTimeout(520);
    const onChord = await page.evaluate(() => window.__buzz.slice());
    if (!onChord.some(Array.isArray)) fail('completing a chord gives no distinct buzz pattern');
    else pass(`completed chord buzzes a pattern (${onChord.find(Array.isArray).join('-')}ms)`);
    await reset();

    // Song mode: forming the chord has to move the sequence on, and the
    // finished flourish has to survive the fingers that earned it still being
    // on the glass — clearing it on repaint wiped it instantly.
    await page.locator('.fb-pick.is-song').first().click();
    await page.waitForTimeout(350);
    const seen = [];
    for (let i = 0; i < 4; i++) {
      const at = await page.evaluate(() => [...document.querySelectorAll('.fb-target')].map((t) => {
        const r = t.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }));
      seen.push(await page.locator('.fb-chord').textContent());
      await touch('touchStart', at);
      await page.waitForTimeout(460);
      await touch('touchEnd', []);
      await page.waitForTimeout(300);
    }
    const stat = await page.locator('.fb-stat').textContent();
    if (new Set(seen).size < 2) fail(`song did not advance: stayed on ${seen.join(', ')}`);
    else if (!/all \d+/.test(stat)) fail(`finishing a song shows "${stat}", not a completion`);
    else pass(`song advances ${seen.join(' → ')} and reports "${stat}"`);
    // The loop above already lifted off; no reset needed here.

    // Synthesis buffers are cached per pitch; without that a strum rebuilds
    // ~500KB per string on the main thread.
    await page.evaluate(() => {
      window.__made = 0;
      const real = AudioContext.prototype.createBuffer;
      AudioContext.prototype.createBuffer = function (...a) { window.__made++; return real.apply(this, a); };
    });
    for (let i = 0; i < 4; i++) {
      await touch('touchStart', spots);
      await page.waitForTimeout(420);
      await touch('touchEnd', []);
      await page.waitForTimeout(240);
    }
    const made = await page.evaluate(() => window.__made);
    if (made > 8) fail(`audio buffer cache not working: ${made} allocations for 4 chords`);
    else pass(`4 chords allocated ${made} audio buffers (cache holding)`);

    await page.close();
  }

  return problems;
}
