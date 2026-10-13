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

// three's camera must put world points on the same pixels as proj(), which the 2D overlays (aim, trail, glow) use.
let camErr = 0;
const camCheck = async where => { const e = await page.evaluate(() => __t.cam3());
  camErr = Math.max(camErr, e); if (!(e < 0.5)) errors.push(`camera parity ${where}: ${e} px`); };

await page.goto(url);
// the skinned batter must load (the game would silently fall back to the procedural one)
await page.waitForFunction(() => __r.skin().on || __r.skin().err, null, {timeout: 10000, polling: 50}).catch(() => {});
const skin = await page.evaluate(() => __r.skin());
if (!skin.on) errors.push('skinned batter: ' + skin.err);
else console.log('skin     ok  skinned batter loaded');
for (const pk of planets) {
  await page.click('.seg[data-key=mode] button[data-v=nets]');
  await page.click(`#planetGrid button[data-v=${pk}]`);
  await page.click('#startBtn');
  await page.waitForFunction(() => __t.S.phase === 'runup' && __t.S.t > 1.0, null, {timeout: 15000, polling: 30});
  if (pk === planets[0]) {
    await page.waitForFunction(() => { const s = __t.sfx(); return s.expected > 0 && s.decoded === s.expected; }, null, {timeout: 10000, polling: 50})
      .catch(async () => { errors.push('sfx decode: ' + JSON.stringify(await page.evaluate(() => __t.sfx()))); });
    console.log(`sfx      ok  decoded ${JSON.stringify(await page.evaluate(() => __t.sfx()))}`);
  }
  // On the first planet the batter charges down the pitch, so the footwork code path (moved contact point, gait) runs.
  if (pk === planets[0]) await page.evaluate(() => Object.assign(__t.S.bpos, {x: 0.1, z: 1.2}));
  await page.screenshot({path: `${shots}${pk}-runup.png`});
  await camCheck(pk + ' runup');
  await page.waitForFunction(() => __t.S.phase === 'flight', null, {timeout: 15000, polling: 30});
  // Force a perfectly timed lofted cover drive so the hit path and chase camera code run.
  await page.evaluate(() => { const S = __t.S; S.swing = {tc: footAt(S.ball, S.bpos).t + 0.002, aim: 30, power: 1, lofted: true, defend: false, done: false};
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
if (planets.includes('earth')) {
  // Replay: force perfectly timed lofted shots that suit the length (a boundary ~90% of the time) until one goes for four or six.
  // The brain is reset first: after the forced drives above it bowls short, which a lofted drive mishits.
  await page.click('#resetBrain');
  await page.click('.seg[data-key=mode] button[data-v=nets]');
  await page.click('.seg[data-key=netsW] button[data-v="0"]');
  await page.click('#planetGrid button[data-v=earth]');
  await page.click('#startBtn');
  let r = 'no';const tries = [];
  for (let i = 0; i < 8 && r !== 'replay'; i++) {
    await page.waitForFunction(() => __t.S.phase === 'flight', null, {timeout: 20000, polling: 20});
    await page.evaluate(() => { const S = __t.S, f = footAt(S.ball, S.bpos), aim = f.full > 0.62 ? -85 : 30;
      S.swing = {tc: f.t + 0.002, aim, power: 1, lofted: true, defend: false, done: false};
      S.bat = {mode: 'swing', t0: S.ball.start + S.swing.tc - SWING_DELAY, from: null, aim}; });
    r = await (await page.waitForFunction(() => __t.S.phase === 'replay' ? 'replay' : ['ready', 'break'].includes(__t.S.phase) && 'no', null, {timeout: 20000, polling: 20})).jsonValue();
    if (r !== 'replay') tries.push(await page.evaluate(() => __t.S.res && __t.S.res.label + ' off ' + __t.S.ball.len));
  }
  if (r !== 'replay') errors.push('replay: no boundary in 8 forced lofted shots: ' + tries.join(', '));
  else {
    const label = await page.evaluate(() => __t.S.res.label);
    for (const [t, n] of [[1, 1], [3, 2]]) {
      await page.waitForFunction(t => __t.S.phase === 'replay' && __t.clk() - __t.rp().t0 >= t, t, {timeout: 20000, polling: 20});
      await page.screenshot({path: `${shots}earth-replay-${n}.png`});
      await camCheck('replay ' + n);
    }
    if (await page.evaluate(() => __t.S.phase === 'replay')) await page.mouse.click(195, 500);
    await page.waitForFunction(() => ['ready', 'break'].includes(__t.S.phase) && !__t.S.aim, null, {timeout: 2000})
      .catch(async () => errors.push('replay: did not move on after tap, phase ' + await page.evaluate(() => __t.S.phase)));
    console.log(`earth    ok  replay of "${label}" shown, tap skipped it to ${await page.evaluate(() => __t.S.phase)}`);
  }
  await page.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await page.waitForTimeout(100);
  if (await page.isVisible('#end')) await page.click('#menuBtn');
  await page.click('.seg[data-key=mode] button[data-v=chase]');
  await page.click('#planetGrid button[data-v=earth]');
  await page.click('#startBtn');
  await page.click('#chaseBtn');
  await page.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 15000, polling: 30});
  // Reach the target before the next ball; the real result flow then ends the chase with a win.
  await page.evaluate(() => { const M = __t.getM(); M.runs = M.target; });
  for (const [t, n] of [[1, 1], [3.5, 2]]) {
    await page.waitForFunction(t => __t.S.phase === 'celebrate' && __t.clk() - __t.S.cel.t0 >= t, t, {timeout: 20000, polling: 20});
    await page.screenshot({path: `${shots}earth-celebrate-${n}.png`});
    await camCheck('celebration ' + n);
  }
  await page.mouse.click(195, 420);
  await page.waitForFunction(() => document.querySelector('#end').classList.contains('on'), null, {timeout: 2000});
  console.log(`earth    ok  celebration skipped to end screen: ${await page.textContent('#eTitle')}`);
}
await browser.close();
if (errors.length) { console.log('\nPage errors:\n' + errors.join('\n')); process.exit(1); }
console.log(`\nNo page errors. Camera parity within ${camErr.toFixed(4)} px. Screenshots in tests/screenshots/`);
