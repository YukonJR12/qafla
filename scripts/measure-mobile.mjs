// Read-only hosted benchmark: Add changes only this disposable browser's cart.
// Credentials/session stay outside evidence; traces omit network headers/bodies.
import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

process.loadEnvFile('.env.local');
const base = process.argv[2] || 'https://qafla-rjqd.vercel.app';
const label = process.argv[3] || 'before';
const out = `docs/evidence/mobile-performance/${label}`;
await mkdir(out, { recursive: true });
const handoff = JSON.parse(await readFile(process.env.PERF_HANDOFF, 'utf8'));
const customer = handoff.accounts.find(a => a.label === 'Customer B');
const login = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: customer.email, password: customer.password }),
});
if (!login.ok) throw new Error(`Test login HTTP ${login.status}`);
const session = await login.json();
const authKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const browser = await chromium.launch();
const runs = [];
const fast = process.env.PERF_FAST === '1';
try {
  for (let pair = 1; pair <= Number(process.env.PERF_PAIRS || 3); pair++) for (const returning of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'no-preference', serviceWorkers: 'block' });
    if (returning) await context.addInitScript(({ key, session, origin }) => { if (location.origin === origin) localStorage.setItem(key, JSON.stringify(session)); }, { key: authKey, session, origin: new URL(base).origin });
    const page = await context.newPage();
    if (process.env.PERF_PREVIEW_ACCESS) {
      // Establish only the deployment cookie before timing; cold cache is cleared below.
      await page.goto((await readFile(process.env.PERF_PREVIEW_ACCESS, 'utf8')).trim());
      await page.goto('about:blank');
    }
    await page.addInitScript(() => {
      window.launchFrames = [];
      const frame = () => {
        const el = document.querySelector('.launch img');
        if (el) window.launchFrames.push({ t: performance.now(), complete: el.complete && el.naturalWidth > 0, transform: getComputedStyle(el).transform, animation: getComputedStyle(el).animationName });
        if (performance.now() < 15000) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: fast ? 0 : 150, downloadThroughput: fast ? -1 : 1_600_000 / 8, uploadThroughput: fast ? -1 : 750_000 / 8, connectionType: 'cellular4g' });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: fast ? 1 : 4 });
    let network = new Map();
    cdp.on('Network.requestWillBeSent', e => network.set(e.requestId, { url: e.request.url, start: e.timestamp, type: e.type, initiator: e.initiator.type }));
    cdp.on('Network.responseReceived', e => { const r = network.get(e.requestId); if (r) Object.assign(r, { response: e.timestamp, status: e.response.status, cache: e.response.fromDiskCache, timing: e.response.timing }); });
    cdp.on('Network.loadingFinished', e => { const r = network.get(e.requestId); if (r) Object.assign(r, { end: e.timestamp, bytes: e.encodedDataLength }); });
    for (const temperature of ['cold', 'warm']) {
      if (temperature === 'cold') await cdp.send('Network.clearBrowserCache');
      const id = `${returning ? 'returning' : 'fresh'}-${pair}-${temperature}`;
      network = new Map();
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,v8,disabled-by-default-devtools.timeline,disabled-by-default-devtools.screenshot', transferMode: 'ReturnAsStream' });
      const start = Date.now();
      await page.goto(base, { waitUntil: 'commit' });
      const usable = returning ? page.getByRole('link', { name: /Karak Corner\. Next pickup/ }) : page.getByRole('button', { name: 'Sign in', exact: true });
      await usable.waitFor({ state: 'visible', timeout: 60000 });
      if (!await usable.isEnabled()) throw new Error('Destination is disabled');
      const launchMs = Date.now() - start;
      const frames = await page.evaluate(() => window.launchFrames);
      let menuMs = null, addMs = null;
      if (returning) {
        const tap = Date.now(); await usable.tap();
        const add = page.getByRole('button', { name: 'Add Karak tea', exact: true });
        await add.waitFor({ state: 'visible', timeout: 60000 });
        if (!await add.isEnabled()) throw new Error('Menu Add unavailable');
        menuMs = Date.now() - tap;
        await page.evaluate(() => {
          document.addEventListener('click', e => {
            if (e.target.closest('button')?.getAttribute('aria-label') !== 'Add Karak tea') return;
            window.addStart = performance.now();
            const check = () => {
              const quantity = document.querySelector('[role=group][aria-label*="Karak tea"]');
              const cart = [...document.querySelectorAll('a[href="/cart"]')].find(a => a.textContent.includes('View order'));
              if (quantity && cart) requestAnimationFrame(() => { window.addResult = performance.now() - window.addStart; });
              else requestAnimationFrame(check);
            }; requestAnimationFrame(check);
          }, { once: true, capture: true });
        });
        await add.tap();
        await page.waitForFunction(() => window.addResult !== undefined);
        addMs = await page.evaluate(() => window.addResult);
        await page.screenshot({ path: `${out}/${id}-added.png` });
        await page.getByRole('button', { name: 'Remove Karak tea', exact: true }).tap();
      }
      const endTrace = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
      await cdp.send('Tracing.end');
      const { stream } = await endTrace;
      let trace = ''; for (;;) { const chunk = await cdp.send('IO.read', { handle: stream }); trace += chunk.data; if (chunk.eof) break; }
      await cdp.send('IO.close', { handle: stream });
      await writeFile(`${out}/${id}.trace.json.gz`, gzipSync(trace));
      await writeFile(`${out}/${id}.network.json`, JSON.stringify([...network.values()], null, 2));
      await writeFile(`${out}/${id}.frames.json`, JSON.stringify(frames));
      const result = { id, launchMs, menuMs, addMs }; runs.push(result); console.log(JSON.stringify(result));
    }
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${out}/results.json`, JSON.stringify({ base, browser: browser.version(), viewport: '390x844', profile: fast ? 'Unthrottled diagnostic, CPU 1x' : '150ms RTT, 1.6 Mbps down, 750 Kbps up; CPU 4x', cache: 'Cold: new context and cleared HTTP cache; warm: same context HTTP cache. No Map visit. Server/CDN cache uncontrolled.', runs }, null, 2));
