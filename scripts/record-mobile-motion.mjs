import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
process.loadEnvFile('.env.local');
const base = process.argv[2];
if (!base) throw new Error('Pass the tested deployment URL');
const out = `docs/evidence/mobile-performance/${process.argv[3] || 'interaction'}`;
await mkdir(out, { recursive: true });
const { accounts } = JSON.parse(await readFile(process.env.PERF_HANDOFF, 'utf8'));
const customer = accounts.find(a => a.label === 'Customer B');
const login = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: customer.email, password: customer.password }),
});
if (!login.ok) throw new Error(`Login HTTP ${login.status}`);
const session = await login.json();
const key = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const browser = await chromium.launch();
const results = [];
let previewCookies = [];
if (process.env.PERF_PREVIEW_ACCESS) {
  const bootstrap = await browser.newContext();
  const authPage = await bootstrap.newPage();
  await authPage.goto((await readFile(process.env.PERF_PREVIEW_ACCESS, 'utf8')).trim());
  previewCookies = await bootstrap.cookies(base);
  await bootstrap.close();
}
try {
  for (const [width, locale, reduced] of [[390, 'en', false], [320, 'ar', false], [320, 'ar', true]]) {
    const id = `${width}-${locale}-${reduced ? 'reduced' : 'motion'}`;
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference', recordVideo: { dir: `${out}/raw`, size: { width, height: 844 } } });
    await context.addCookies(previewCookies);
    await context.addCookies([{ name: 'qafla_locale', value: locale, url: base }]);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750, connectionType: 'cellular4g' });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    if (width === 390) {
      // One continuous, original-speed clip: fresh entry, then saved-session entry.
      await page.goto(base, { waitUntil: 'commit' });
      await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor({ timeout: 60000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${out}/${id}-fresh-sign-in.png` });
      await page.goto('about:blank');
      await cdp.send('Network.clearBrowserCache');
    }
    await context.addInitScript(({ key, session, origin }) => { if (location.origin === origin) localStorage.setItem(key, JSON.stringify(session)); }, { key, session, origin: new URL(base).origin });
    await context.addInitScript(() => {
      window.returningSignInFrames = 0;
      const inspect = () => {
        if ([...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Sign in' && b.getBoundingClientRect().height > 0)) window.returningSignInFrames++;
        requestAnimationFrame(inspect);
      };
      requestAnimationFrame(inspect);
    });
    // No order or payment action; disposable local cart only.
    await page.goto(base, { waitUntil: 'commit' });
    const truck = page.locator('a[href="/trucks/T01"]').first();
    await truck.waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${id}-explore.png` });
    await truck.tap();
    const add = page.getByRole('button', { name: locale === 'en' ? /^Add / : /^أضف / }).first();
    await add.waitFor({ state: 'visible', timeout: 60000 });
    if (!await add.isEnabled()) throw new Error('T01 is unavailable; do not override production availability');
    await page.waitForTimeout(700);
    await add.tap();
    const quantity = page.locator('.quantity-ack');
    await quantity.first().waitFor();
    const cart = page.locator('a[href="/cart"]').filter({ hasText: locale === 'en' ? 'View order' : 'عرض الطلب' });
    await cart.waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${out}/${id}-added.png` });
    const result = await page.evaluate(() => ({ direction: document.documentElement.dir, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, quantity: document.querySelector('.quantity-ack')?.textContent, animations: [...document.querySelectorAll('.quantity-ack,.bump')].map(e => getComputedStyle(e).animationDuration) }));
    if (result.scrollWidth > width) throw new Error(`Horizontal overflow: ${id}`);
    const cartText = await cart.innerText();
    const returningSignInFrames = await page.evaluate(() => window.returningSignInFrames);
    if (result.quantity !== '1' || !cartText.includes('(1)')) throw new Error('First Add did not update quantity and cart together');
    if (returningSignInFrames) throw new Error('Sign-in flashed during the returning launch');
    results.push({ id, ...result, returningSignInFrames, cartText, cartBounds: await cart.boundingBox() });
    const video = page.video();
    await context.close();
    await rename(await video.path(), `${out}/${id}.webm`);
  }
} finally { await browser.close(); }
await writeFile(`${out}/results.json`, JSON.stringify({ base, browser: browser.version(), device: 'Chrome mobile emulation on Windows; no physical phone', playback: 'Original normal-speed Playwright capture', results }, null, 2));
