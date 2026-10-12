// Browser smoke test: loads dist/crease-chase.html in headless Chromium (software WebGL), plays a few balls
// on each planet, forces a perfectly timed swing, and fails on any page error. Screenshots go to tests/screenshots/.
// Usage: npm run build && node tests/smoke.mjs [planet ...]
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

const planets = process.argv.slice(2).length ? process.argv.slice(2) : ['earth','moon','mercury','venus','mars','jupiter','saturn','neptune'];
const shots = fileURLToPath(new URL('./screenshots/', import.meta.url));
mkdirSync(shots, {recursive: true});
const url = pathToFileURL(fileURLToPath(new URL('../dist/crease-chase.html', import.meta.url))).href + '#test';

const browser = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport: {width: 390, height: 844}});
const errors = [];
page.on('pageerror', e => errors.push(e.stack || String(e)));
page.on('console', m => { if (m.type() === 'error' && !/ERR_NAME_NOT_RESOLVED|fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });

await page.goto(url);
for (const pk of planets) {
  await page.click('.seg[data-key=mode] button[data-v=nets]');
  await page.click(`#planetGrid button[data-v=${pk}]`);
  await page.click('#startBtn');
  await page.waitForFunction(() => __t.S.phase === 'runup' && __t.S.t > 1.0, null, {timeout: 15000, polling: 30});
  await page.screenshot({path: `${shots}${pk}-runup.png`});
  await page.waitForFunction(() => __t.S.phase === 'flight', null, {timeout: 15000, polling: 30});
  // Force a perfectly timed lofted cover drive so the hit path and chase camera code run.
  await page.evaluate(() => { const S = __t.S; S.swing = {tc: S.ball.tIdeal + 0.002, aim: 30, power: 1, lofted: true, defend: false, done: false};
    S.bat = {mode: 'swing', t0: __t.clk(), from: null, aim: 30}; });
  await page.waitForTimeout(400);
  await page.screenshot({path: `${shots}${pk}-shot.png`});
  await page.waitForTimeout(1200);
  const res = await page.evaluate(() => __t.S.res && `${__t.S.res.label} ${__t.S.res.sub || ''}`.trim());
  console.log(`${pk.padEnd(8)} ok  first shot: ${res || '(still in play)'}`);
  await page.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await page.waitForTimeout(100);
  if (await page.isVisible('#end')) await page.click('#menuBtn');
}
await browser.close();
if (errors.length) { console.log('\nPage errors:\n' + errors.join('\n')); process.exit(1); }
console.log(`\nNo page errors. Screenshots in tests/screenshots/`);
