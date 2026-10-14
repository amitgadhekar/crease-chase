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
let scenGood = null; // a valid scenario save, for the landscape menu
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
  await page.waitForFunction(() => __t.S.phase === 'runup' && __t.S.t > 1.0, null, {timeout: 30000, polling: 30});
  if (pk === planets[0]) {
    await page.waitForFunction(() => { const s = __t.sfx(); return s.expected > 0 && s.decoded === s.expected; }, null, {timeout: 10000, polling: 50})
      .catch(async () => { errors.push('sfx decode: ' + JSON.stringify(await page.evaluate(() => __t.sfx()))); });
    console.log(`sfx      ok  decoded ${JSON.stringify(await page.evaluate(() => __t.sfx()))}`);
  }
  // On the first planet the batter charges down the pitch, so the footwork code path (moved contact point, gait) runs.
  if (pk === planets[0]) await page.evaluate(() => Object.assign(__t.S.bpos, {x: 0.1, z: 1.2}));
  await page.screenshot({path: `${shots}${pk}-runup.png`});
  await camCheck(pk + ' runup');
  await page.waitForFunction(() => __t.S.phase === 'flight', null, {timeout: 30000, polling: 30});
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
  await page.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 30000, polling: 30});
  // Reach the target before the next ball; the real result flow then ends the chase with a win.
  await page.evaluate(() => { const M = __t.getM(); M.runs = M.target; });
  for (const [t, n] of [[1, 1], [3.5, 2]]) {
    await page.waitForFunction(t => __t.S.phase === 'celebrate' && __t.clk() - __t.S.cel.t0 >= t, t, {timeout: 20000, polling: 20});
    await page.screenshot({path: `${shots}earth-celebrate-${n}.png`});
    await camCheck('celebration ' + n);
  }
  // a slow screenshot can outlast the celebration (6 s); a tap then would hit the end screen's buttons
  if (await page.evaluate(() => __t.S.phase === 'celebrate')) await page.mouse.click(195, 420);
  await page.waitForFunction(() => document.querySelector('#end').classList.contains('on'), null, {timeout: 10000, polling: 50})
    .catch(async () => errors.push('celebration: no end screen, phase ' + await page.evaluate(() => __t.S.phase + ' ' + document.querySelector('.screen.on')?.id)));
  console.log(`earth    ok  celebration skipped to end screen: ${await page.textContent('#eTitle')}`);
}
if (planets.includes('earth')) {
  // T20: two overs with forced swings (ready/break waits cut short), a bowler change and a field change, every field legal
  // (fieldOk), the strike after every ball (odd runs, wickets, over ends), a Hold, the non-striker drawn, then save, reload,
  // resume and compare the match state (lineup and strike included). A v1 save is not offered.
  await page.evaluate(() => localStorage.removeItem('cc_t20'));
  await page.reload();
  await page.click('.seg[data-key=mode] button[data-v=chase]');
  await page.click('.seg[data-key=len] button[data-v="3"]');
  await page.click('#planetGrid button[data-v=earth]');
  await page.click('#startBtn');
  await page.click('#chaseBtn');
  await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
  // a hot off-side scoring zone, so the captain has a reason to move a fielder (after a boundary, and for the next over)
  await page.evaluate(() => { __t.getM().zones[5] = 20; });
  const skip = () => { const S = __t.S; if (S.phase === 'ready') S.t = Math.max(S.t, S.readyDur - 0.1); if (S.phase === 'break') S.t = Math.max(S.t, S.breakDur - 0.1);
    return S.phase === 'flight'; };
  const seen = {bi: new Set(), field: new Set(), odd: 0, hold: false}, kinds = ['drive', 'push', 'block', 'loft', 'push'];
  let last = await page.evaluate(() => __t.t20());
  for (let i = 0; last.balls < 12 || seen.bi.size < 2 || seen.field.size < 2 || !seen.odd || !seen.hold; i++) {
    if (i >= 40) { errors.push(`T20: after ${i} balls saw ${seen.bi.size} bowlers, ${seen.field.size} fields, ${seen.odd} odd runs, Hold ${seen.hold}`); break; }
    seen.bi.add(last.bi); seen.field.add(last.field);
    if (!last.ok) errors.push(`T20: illegal field in over ${last.overNo}: ${last.field}`);
    if (i && !last.ns3d) errors.push('T20: no non-striker');
    const before = last;
    await page.waitForFunction(`(${skip})()`, null, {timeout: 30000, polling: 30});
    await page.evaluate(([kind, aim0]) => { const S = __t.S, f = footAt(S.ball, S.bpos), aim = kind === 'push' ? aim0 : f.full > 0.62 ? -85 : 30;
      S.swing = {tc: f.t + 0.002, aim, power: kind === 'push' ? 0.35 : 1, lofted: kind === 'loft', defend: kind === 'block', done: false};
      S.bat = {mode: kind === 'block' ? 'block' : 'swing', t0: S.ball.start + S.swing.tc - SWING_DELAY, from: null, aim}; }, [kinds[i % 5], [25, -40, 60, -70][i % 4]]);
    await page.waitForFunction(() => __t.S.phase !== 'flight', null, {timeout: 30000, polling: 30});
    // the first holdable ball is held (the 0.6 s window is game time, so the tap goes in the same evaluate that sees it)
    const r = await page.evaluate(hold => { const h = hold && __t.t20().hold && !document.querySelector('#holdBtn').hidden; if (h) document.querySelector('#holdBtn').click();
      const r = __t.S.res; return {runs: r.runs, out: !!r.out, wide: !!r.wide, boundary: r.boundary || 0, held: !!r.held, h}; }, !seen.hold);
    if (r.h) { seen.hold = true; if (!r.held) errors.push('T20: Hold tapped, ball not held ' + JSON.stringify(r)); }
    await page.waitForFunction(() => ['ready', 'break', 'replay'].includes(__t.S.phase), null, {timeout: 30000, polling: 30});
    if (await page.evaluate(() => __t.S.phase === 'replay')) { await page.waitForTimeout(400); await page.mouse.click(195, 500); }
    await page.waitForFunction(() => ['ready', 'break'].includes(__t.S.phase), null, {timeout: 30000, polling: 30});
    last = await page.evaluate(() => __t.t20());
    // strike: the new batter takes strike after a wicket, odd runs swap (not boundaries or wides), ends swap at the over
    let s = before.s, ns = before.ns;
    if (r.out) s = JSON.parse(before.bat).findIndex((p, j) => !p.out && j !== before.s && j !== before.ns);
    else if (!r.wide && !r.boundary && r.runs % 2) { [s, ns] = [ns, s]; seen.odd++; }
    if (last.balls !== before.balls && last.balls % 6 === 0) [s, ns] = [ns, s];
    if (last.s !== s || last.ns !== ns) errors.push(`T20 strike: ${JSON.stringify(r)} at ball ${before.balls} (${before.s}/${before.ns}) gave ${last.s}/${last.ns}, expected ${s}/${ns}`);
  }
  const bw = JSON.parse(last.bw);
  if (bw.some(f => f.o > 4) || bw.filter(f => f.o > 0).length < 2) errors.push('T20 figures: ' + last.bw);
  await page.screenshot({path: `${shots}earth-t20.png`});
  await page.click('#pauseBtn');
  await page.screenshot({path: `${shots}earth-t20-pause.png`});
  const saved = await page.evaluate(() => __t.t20());
  await page.reload();
  await page.waitForSelector('#resumeT20:not([hidden])', {timeout: 5000}).catch(() => errors.push('T20: no Resume button after reload'));
  await page.click('#resumeT20');
  await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
  const back = await page.evaluate(() => __t.t20());
  for (const k in saved) if (k !== 'ns3d' && saved[k] !== back[k]) errors.push(`T20 resume: ${k} was ${saved[k]}, resumed ${back[k]}`);
  console.log(`earth    ok  T20 ${back.runs}/${back.wkts} after ${back.balls} balls, ${seen.bi.size} bowlers, ${seen.field.size} fields, ${seen.odd} strike changes on odd runs, a Hold, resumed after reload with batter ${back.s} on strike`);
  await page.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await page.waitForTimeout(100);
  if (await page.evaluate(() => localStorage.getItem('cc_t20') === null || document.querySelector('#resumeT20').hidden)) errors.push('T20: save lost on quit (Resume must stay available)');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cc_t20')); s.v = 1; delete s.st.bat; localStorage.setItem('cc_t20', JSON.stringify(s)); });
  await page.reload();
  if (await page.isVisible('#resumeT20')) errors.push('T20: a v1 save is offered for resume');
}
if (planets.includes('earth')) {
  // Scenarios: the list, a briefing, a survive scenario (forced duck under a bouncer, forced swings, then a forced end: result card
  // with stars), a last pair against spin (forced sweep, a Hold, a strike change, legal Test fields), and a staged scenario
  // carried into its next session after the interstitial.
  await page.evaluate(() => { localStorage.removeItem('cc_scen'); localStorage.removeItem('cc_t20'); });
  await page.reload();
  await page.click('.seg[data-key=mode] button[data-v=scen]');
  await page.screenshot({path: `${shots}scen-menu.png`});
  const skipS = () => { const S = __t.S; if (S.phase === 'ready') S.t = Math.max(S.t, S.readyDur - 0.1); if (S.phase === 'break') S.t = Math.max(S.t, S.breakDur - 0.1);
    return S.phase === 'flight'; };
  const settle = async () => { await page.waitForFunction(() => ['ready', 'break', 'replay', 'celebrate', 'idle'].includes(__t.S.phase), null, {timeout: 30000, polling: 30});
    if (await page.evaluate(() => __t.S.phase === 'replay')) { await page.waitForTimeout(400); await page.mouse.click(195, 500); }
    await page.waitForFunction(() => ['ready', 'break', 'celebrate', 'idle'].includes(__t.S.phase), null, {timeout: 30000, polling: 30}); };
  // in the ready phase: the next ball from the current bowler, re-rolled until it fits (b => bool)
  const force = (len, line, pred) => page.evaluate(([len, line, pred]) => { const M = __t.getM(), bw = M.attack[M.bi], f = new Function('b', 'return ' + pred);
    for (let i = 0; i < 300; i++) { const b = makeDelivery({...planBall({}, bw.type, M.diff, {bw, plan: {id: M.pid, mix: TPL[M.pid]}, cond: M.st.cond}), len, line}, M.diff, bw, M.st.cond);
      if (f(b)) { __t.S.pending = b; return true; } } return false; }, [len, line, pred]);
  const bat = (aim, opt = {}) => page.evaluate(([aim, o]) => { const S = __t.S, f = footAt(S.ball, S.bpos), def = aim === 'block';
    S.swing = {tc: f.t + 0.002, aim: def ? 0 : aim, power: o.power || 0.8, lofted: !!o.loft, defend: def, done: false};
    S.bat = {mode: def ? 'block' : 'swing', t0: S.ball.start + S.swing.tc - SWING_DELAY, from: null, aim: S.swing.aim}; }, [aim, opt]);
  const fieldCheck = async where => { const c = await page.evaluate(() => __t.scen()); if (!c.ok || c.viol) errors.push(`Scenario ${c.id} ${where}: field legal ${c.ok}, rule breaches ${c.viol}`); return c; };

  await page.click('#scenSeries .sctile');
  if (!await page.isVisible('#brief') || (await page.textContent('#gTitle')) !== await page.evaluate(() => scenById('s1a').title)) errors.push('Scenarios: no briefing for the first Test');
  await page.screenshot({path: `${shots}scen-brief.png`});
  await page.click('#gPlay');
  await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
  await page.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 30000, polling: 30});
  if (!await force('B', 'mid', '(k=>k&&k.y>1.35)(bodyHit(b,BP0))')) errors.push('Scenarios: no bouncer at the body to duck');
  await page.waitForFunction(`(${skipS})()`, null, {timeout: 30000, polling: 30});
  await page.waitForFunction(() => __t.S.phase === 'flight' && __t.clk() - __t.S.ball.start >= __t.S.ball.t1 + 0.02, null, {timeout: 30000, polling: 10});
  await page.evaluate(() => { __t.S.stick = {id: 999, v: [0, 1]}; });
  await page.waitForFunction(() => __t.S.phase !== 'flight', null, {timeout: 30000, polling: 30});
  const dk = await page.evaluate(() => ({duck: !!__t.S.ball.duck, label: __t.S.res.label, sub: __t.S.res.sub}));
  await page.evaluate(() => { __t.S.stick = null; });
  if (!dk.duck) errors.push('Scenarios: stick back under a bouncer did not duck: ' + JSON.stringify(dk));
  console.log(`scen     ok  s1a duck: ${dk.label}${dk.sub ? ', ' + dk.sub : ''}`);
  await settle();
  for (const k of [10, 'block']) { await page.waitForFunction(`(${skipS})()`, null, {timeout: 30000, polling: 30}); await bat(k); await settle(); await fieldCheck('s1a'); }
  await page.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 30000, polling: 30});
  await page.screenshot({path: `${shots}scen-hud-survive.png`});
  // one ball from the end: the next one meets the objective, then celebration and the result card
  await page.evaluate(() => { const M = __t.getM(); M.st.balls = M.sc.obj.balls - 1; });
  await page.waitForFunction(`(${skipS})()`, null, {timeout: 30000, polling: 30}); await bat('block');
  await page.waitForFunction(() => ['celebrate', 'idle'].includes(__t.S.phase), null, {timeout: 30000, polling: 30});
  if (await page.evaluate(() => __t.S.phase === 'celebrate')) { await page.waitForTimeout(800); await page.mouse.click(195, 420); }
  await page.waitForFunction(() => document.querySelector('#end').classList.contains('on'), null, {timeout: 10000, polling: 50})
    .catch(async () => errors.push('Scenarios: no result card, phase ' + await page.evaluate(() => __t.S.phase)));
  const card = await page.evaluate(() => ({t: document.querySelector('#eTitle').textContent, st: document.querySelector('#eStars').hidden ? '' : document.querySelector('#eStars .big3').textContent,
    rec: JSON.parse(localStorage.getItem('cc_scen') || '{}'), next: !document.querySelector('#nextBtn').hidden}));
  if (!card.st || !(card.rec.stars && card.rec.stars.s1a >= 1) || !card.next) errors.push('Scenarios: result card ' + JSON.stringify(card));
  await page.screenshot({path: `${shots}scen-result.png`});
  console.log(`scen     ok  s1a result card: ${card.t} ${card.st}, saved ${JSON.stringify(card.rec.stars)}`);

  // last pairs: a sweep against two spinners (c4), then a Hold and a strike change against the single-on-offer field (c1). A
  // wicket ends a last-pair scenario, so it is retried from the result card.
  const seen = {sweep: '', hold: false, swap: false};
  const lastPair = async (tile, id, done, n) => {
    if (await page.isVisible('#end')) await page.click('#menuBtn');
    await page.click(`#scenClassics .sctile:nth-child(${tile})`);
    await page.click('#gPlay');
    await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
    for (let i = 0; i < n && !done(); i++) {
      await page.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 30000, polling: 30});
      const before = await fieldCheck(id);
      const sweepNow = !seen.sweep && await page.evaluate(() => { const M = __t.getM(); return M.attack[M.bi].type === 'spin'; });
      if (sweepNow) await force('F', 'off', 'footAt(b,BP0).full<=0.45');
      await page.waitForFunction(`(${skipS})()`, null, {timeout: 30000, polling: 30});
      await bat(sweepNow ? -130 : [25, -40, 0, 60, -70][i % 5], {power: sweepNow ? 0.8 : [0.45, 0.3, 0.6][i % 3]});
      await page.waitForFunction(() => __t.S.phase !== 'flight', null, {timeout: 30000, polling: 30});
      if (sweepNow) {
        const r = await page.evaluate(() => { const S = __t.S; return {sweep: shotForBall(-130, S.ball, footAt(S.ball, S.bpos).full).name, label: S.res.label}; });
        if (!/sweep/i.test(r.sweep)) errors.push('Scenarios: forced sweep played ' + JSON.stringify(r));
        seen.sweep = r.sweep + ': ' + r.label;
      }
      // the Hold window is 0.6 s of game time, so the tap goes in the same evaluate that sees it
      if (await page.evaluate(() => { if (!__t.scen().hold || document.querySelector('#holdBtn').hidden) return false; document.querySelector('#holdBtn').click(); return true; })) {
        const a = await page.evaluate(() => __t.scen()), exp = a.ob === 0 ? before.ns : before.s;
        if (a.hold || a.s !== exp || a.runs % 2 !== before.runs % 2) errors.push('Scenarios: Hold did not keep the strike ' + JSON.stringify([before, a]));
        seen.hold = true;
      }
      await settle();
      if ((await page.evaluate(() => __t.scen())).s !== before.s) seen.swap = true;
      if (await page.evaluate(() => ['celebrate', 'idle'].includes(__t.S.phase))) {
        if (await page.evaluate(() => __t.S.phase === 'celebrate')) { await page.waitForTimeout(800); await page.mouse.click(195, 420); }
        await page.waitForFunction(() => document.querySelector('#end').classList.contains('on'), null, {timeout: 10000, polling: 50});
        await page.click('#againBtn');
        await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
      }
    }
  };
  await lastPair(4, 'c4', () => seen.sweep, 6);
  if (!await page.evaluate(() => __r.skin().on ? __t.scen() && __t.scen().ns3d : true)) errors.push('Scenarios: no non-striker');
  await page.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await lastPair(1, 'c1', () => seen.hold && seen.swap, 40);
  await page.screenshot({path: `${shots}scen-hud-lastpair.png`});
  if (!seen.sweep || !seen.hold || !seen.swap) errors.push('Scenarios: last pairs saw ' + JSON.stringify(seen));
  else console.log(`scen     ok  c4 ${seen.sweep}; c1 Hold kept the strike, strike changed`);

  // the staged final day: session one ends level with the par, the interstitial shows, and session two starts from that state
  await page.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await page.evaluate(() => localStorage.setItem('cc_scen', JSON.stringify({stars: Object.fromEntries(SCEN.filter(s => s.set === 'series' && !s.stage).map(s => [s.id, 1]))})));
  await page.reload();
  await page.click('#scenSeries .screw:nth-child(5) .sctile');
  await page.click('#gPlay');
  await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
  await page.evaluate(() => { const M = __t.getM(); M.st.balls = M.sc.obj.balls - 1; M.st.runs = M.sc.obj.par; });
  await page.waitForFunction(`(${skipS})()`, null, {timeout: 30000, polling: 30}); await bat('block');
  await page.waitForFunction(() => document.querySelector('#brief').classList.contains('on'), null, {timeout: 30000, polling: 50})
    .catch(() => errors.push('Scenarios: no interstitial after the first session'));
  const lunch = await page.textContent('#gTitle');
  await page.screenshot({path: `${shots}scen-stage.png`});
  // the interval saves the next session unplayed: Resume opens its briefing
  const ls = await page.evaluate(() => JSON.parse(localStorage.getItem('cc_scensave')));
  if (!ls || ls.st || ls.sc.id !== 's5b') errors.push('Scenarios: next session not saved at the interval ' + JSON.stringify(ls && {id: ls.sc.id, st: !!ls.st}));
  await page.reload();
  await page.click('#scenResume');
  if (!await page.isVisible('#brief') || (await page.textContent('#gTitle')) !== await page.evaluate(() => scenById('s5b').title)) errors.push('Scenarios: Resume at the interval did not open the next briefing');
  await page.click('#gPlay');
  await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
  const s2 = await page.evaluate(() => { const M = __t.getM(); return {id: M.sc.id, target: M.sc.obj.target, lineup: M.sc.lineup.length}; });
  if (s2.id !== 's5b' || s2.target > 100 || s2.target < 94) errors.push('Scenarios: next session ' + JSON.stringify(s2));
  console.log(`scen     ok  s5a -> "${lunch}" -> ${s2.id}, ${s2.target} to win with ${s2.lineup} batters`);
  await page.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });

  // Save and resume (cc_scensave): a mid-over resume restores score, strike, bowler, field, over chips and HUD and plays on; quitting
  // in a Hold window records that ball; quitting after an over's last ball resumes with a new over and another bowler; a save made in
  // the over break keeps its bowler; a corrupt save is not offered.
  const wf = fn => page.waitForFunction(fn, null, {timeout: 30000, polling: 30});
  const sNow = () => page.evaluate(() => __t.scen());
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cc_scensave')));
  const quit = () => page.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  const toBreak = async () => { await page.click('#scenResume'); await wf(() => __t.S.phase === 'break'); return sNow(); };
  const resume = async () => { await page.reload();
    if (!await page.waitForSelector('#scenResume:not([hidden])', {timeout: 5000}).catch(() => null)) { errors.push('Scenarios: no Resume entry after reload'); return null; }
    return toBreak(); };
  const same = (a, b, where) => { for (const k in a) if (!['ns3d', 'hold'].includes(k) && a[k] !== b[k]) errors.push(`Scenario resume ${where}: ${k} was ${a[k]}, resumed ${b[k]}`); };
  let i = 0;
  const play = async () => { await wf(`(${skipS})()`); await bat([25, -40, 0, 60, -70][i % 5], {power: [0.3, 0.45, 0.35][i % 3]}); i++; await wf(() => __t.S.phase !== 'flight'); };
  await page.evaluate(() => localStorage.removeItem('cc_scensave'));
  await page.reload();
  if (await page.isVisible('#scenResume')) errors.push('Scenarios: Resume shown with no save');
  const c6 = await page.evaluate(() => [...document.querySelectorAll('#scenClassics .sctile')].findIndex(b => b.querySelector('b').textContent === scenById('c6').title) + 1);
  await page.click(`#scenClassics .sctile:nth-child(${c6})`);
  await page.click('#gPlay');
  await wf(() => __t.S.phase === 'break');
  let c = await sNow();
  while (c.balls < 3 || c.ob === 0) { if (i > 14) { errors.push('Scenarios: no mid-over state ' + JSON.stringify(c)); break; } await play(); await settle(); c = await sNow(); }
  const mid = await resume();
  if (mid) {
    same(c, mid, 'mid-over');
    console.log(`scen     ok  c6 mid-over resume: ${mid.runs}/${mid.wkts} after ${mid.balls} balls, ball ${mid.ob + 1} of over ${mid.overNo}, batter ${mid.s} on strike, bowler ${mid.bi}`);
    await play(); await settle(); c = await sNow();
    if (c.chips === mid.chips && c.overNo === mid.overNo) errors.push('Scenarios: no ball played after a mid-over resume');
  }
  // quit while the Hold window is open: the ball is recorded as not held and is in the save
  let hq = null;
  for (let k = 0; k < 20 && !hq; k++) {
    await play();
    hq = await page.evaluate(() => { if (!__t.scen().hold) return null; const a = __t.scen(); __t.S.paused = true; document.querySelector('#quitBtn').click(); return a; });
    if (!hq) await settle();
  }
  const hs = await saved();
  if (!hq) errors.push('Scenarios: no Hold window to quit in');
  else if (!hs || hs.st.balls !== hq.balls + 1 || !await page.isVisible('#scenResume')) errors.push(`Scenarios: quit in a Hold window: ${hq.balls} balls before, saved ${hs && hs.st.balls}`);
  else { c = await toBreak(); if (c.balls !== hq.balls + 1) errors.push('Scenarios: resumed after a Hold quit with ' + c.balls + ' balls'); }
  // quit straight after an over's last ball (st.bi -1 in the save): the resume starts the next over with another bowler
  let ob = null;
  for (let k = 0; k < 16 && !ob; k++) {
    const pre = await sNow();
    await play();
    if (pre.ob !== 5) { await settle(); continue; }
    await quit();
    const sv = await saved();
    if (sv && sv.st && sv.st.bi === -1) ob = {pre, sv}; else await toBreak();
  }
  if (!ob) errors.push('Scenarios: never quit at the end of an over');
  else {
    const nb = await resume();
    if (nb && (nb.overNo !== ob.sv.overNo + 1 || nb.chips !== '' || nb.balls !== ob.sv.st.balls || nb.bi === ob.pre.bi || nb.bi < 0))
      errors.push(`Scenarios: over-boundary resume ${JSON.stringify({overNo: nb.overNo, saved: ob.sv.overNo, chips: nb.chips, bi: nb.bi, was: ob.pre.bi})}`);
    // the save now holds the picked over (bowler and field): a reload in the over break keeps them
    const nb2 = nb && await resume();
    if (nb2) same(nb, nb2, 'over break');
    if (nb2) console.log(`scen     ok  c6 Hold quit kept the ball (${hq && hq.balls + 1} balls); over ${nb2.overNo} resumed after the over's last ball with bowler ${nb2.bi} (was ${ob.pre.bi}), kept after a reload in the break`);
  }
  await quit();
  // a corrupt or foreign save is not offered and causes no page error
  const good = await page.evaluate(() => localStorage.getItem('cc_scensave'));
  for (const bad of ['{bad json', JSON.stringify({...JSON.parse(good), v: 2}), JSON.stringify({...JSON.parse(good), sc: {...JSON.parse(good).sc, id: 'zz'}}),
    JSON.stringify({...JSON.parse(good), st: {...JSON.parse(good).st, bat: [], bi: 'x'}}), '{"v":1,"sc":null}']) {
    await page.evaluate(b => localStorage.setItem('cc_scensave', b), bad);
    await page.reload();
    if (await page.isVisible('#scenResume')) errors.push('Scenarios: a corrupt save is offered: ' + bad.slice(0, 60));
  }
  await page.evaluate(b => localStorage.setItem('cc_scensave', b), good);
  await page.reload();
  await page.screenshot({path: `${shots}scen-resume-menu.png`});
  scenGood = good;
}
{
  // Landscape phone: its own layout and camera framing. A run-up and a forced shot, with camera parity in both.
  const land = await browser.newPage({viewport: {width: 844, height: 390}});
  land.on('pageerror', e => errors.push('landscape: ' + (e.stack || String(e))));
  await land.goto(url);
  if (scenGood) {
    await land.evaluate(b => localStorage.setItem('cc_scensave', b), scenGood);
    await land.reload();
    await land.click('.seg[data-key=mode] button[data-v=scen]');
    const r = await land.evaluate(() => { const b = document.querySelector('#scenResume').getBoundingClientRect(); return {w: b.width, right: b.right, top: b.top, vw: innerWidth}; });
    if (!await land.isVisible('#scenResume') || r.right > r.vw || r.w < 200) errors.push('landscape: Resume entry ' + JSON.stringify(r));
    await land.screenshot({path: `${shots}landscape-scen-menu.png`});
    console.log(`land     ok  scenario Resume entry ${JSON.stringify(r)}`);
  }
  await land.click('.seg[data-key=mode] button[data-v=nets]');
  await land.click('#planetGrid button[data-v=earth]');
  await land.click('#startBtn');
  await land.waitForFunction(() => __t.S.phase === 'runup' && __t.S.t > 1.0, null, {timeout: 30000, polling: 30});
  await land.screenshot({path: `${shots}landscape-runup.png`});
  for (const [where, prep] of [['runup', null], ['shot', async () => {
    await land.waitForFunction(() => __t.S.phase === 'flight', null, {timeout: 30000, polling: 30});
    await land.evaluate(() => { const S = __t.S; S.swing = {tc: footAt(S.ball, S.bpos).t + 0.002, aim: 30, power: 1, lofted: true, defend: false, done: false};
      S.bat = {mode: 'swing', t0: __t.clk(), from: null, aim: 30}; });
    await land.waitForTimeout(400);
    await land.screenshot({path: `${shots}landscape-shot.png`});
  }]]) {
    if (prep) await prep();
    const e = await land.evaluate(() => __t.cam3());
    camErr = Math.max(camErr, e); if (!(e < 0.5)) errors.push(`camera parity landscape ${where}: ${e} px`);
  }
  console.log(`land     ok  844x390 run-up and shot: ${await land.evaluate(() => __t.S.res ? __t.S.res.label : __t.S.phase)}`);
  // T20 in the phone layout: the slab (with the batters) stays in its column above the stick, and the pause scorecard
  await land.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await land.waitForTimeout(100);
  if (await land.isVisible('#end')) await land.click('#menuBtn');
  await land.click('.seg[data-key=mode] button[data-v=chase]');
  await land.click('.seg[data-key=len] button[data-v="3"]');
  await land.click('#startBtn');
  await land.click('#chaseBtn');
  // a spinner's run-up is only 1.1 s
  await land.waitForFunction(() => __t.S.phase === 'runup' && __t.S.t > 0.5, null, {timeout: 30000, polling: 30});
  await land.screenshot({path: `${shots}landscape-t20.png`});
  const lay = await land.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), t = r('#t20Slab');
    return {bottom: t.bottom, stick: r('#stick').top, right: t.right, target: r('#targetSlab').left}; });
  if (lay.bottom > lay.stick || lay.right > lay.target) errors.push('landscape T20 slab overlaps: ' + JSON.stringify(lay));
  await land.click('#pauseBtn');
  await land.screenshot({path: `${shots}landscape-t20-pause.png`});
  console.log(`land     ok  T20 slab ${JSON.stringify(lay)}`);
  await land.close();
}
await browser.close();
if (errors.length) { console.log('\nPage errors:\n' + errors.join('\n')); process.exit(1); }
console.log(`\nNo page errors. Camera parity within ${camErr.toFixed(4)} px. Screenshots in tests/screenshots/`);
