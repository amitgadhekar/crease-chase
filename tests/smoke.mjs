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

// menu: a mode card on the hub opens its sheet (it slides in; wait until it is still), options are picked there, Play starts
const openMode = async (p, m) => { await p.click(`.mcard[data-m=${m}]`);
  await p.waitForFunction(() => { const s = document.querySelector('#sheet'); return s.classList.contains('open') && getComputedStyle(s).transform === 'none'; }, null, {timeout: 5000, polling: 30}); };
const startMode = async (p, m, opt = {}) => { await openMode(p, m);
  for (const [k, v] of Object.entries(opt)) await p.click(k === 'planet' ? `#planetGrid button[data-v=${v}]` : `.seg[data-key=${k}] button[data-v="${v}"]`);
  await p.click('#startBtn'); };
// Fielding plays: the next ball's swing is set (an edge: inside the edge window; else perfect), and evalSwing is re-rolled in the
// page (fresh fielding randomness each time) until the play wanted comes up (pred over the result r and field f; key picks the
// event to look at). At its t1 the fielder is checked: the action in the view state, the rig's pose (a diver lying out, a leaper
// off the ground), and his hands on the ball for a catch or stop; then a screenshot. AI swings (T20 bowling) are set by forcing aiBat.
const PLAYS = {
  edge: {sw: {aim: 20, edge: 1}, cam: 'cord', pred: "r.fplay.some(e=>(f[e.i].n==='keeper'||f[e.i].n==='slip')&&(e.k==='dive'||e.k==='jump'))",
    key: "(e,f)=>(f[e.i].n==='keeper'||f[e.i].n==='slip')&&(e.k==='dive'||e.k==='jump')"},
  ring: {sw: {aim: 30, power: 1}, pred: "!r.lofted&&!r.boundary&&r.fplay.some(e=>e.k==='dive'&&e.o==='stop'&&Math.hypot(f[e.i].x,f[e.i].z)<35)",
    key: "e=>e.k==='dive'&&e.o==='stop'"},
  deep: {sw: {aim: 10, power: 0.3, loft: 1}, cam: 'chase', field: 1,
    pred: "r.out&&r.catcher!=null&&Math.hypot(f[r.catcher].x,f[r.catcher].z)>BOUNDARY*.6&&r.fplay.some(e=>e.i===r.catcher&&e.o==='catch'&&Math.hypot(f[e.i].x-e.x,f[e.i].z-e.z)>3)",
    key: "e=>e.o==='catch'"},
  four: {sw: {aim: 30, power: 1}, pred: "r.boundary===4&&r.fplay.some(e=>e.k==='dive'&&e.o==='miss')", key: "e=>e.k==='dive'"}
};
const armPlay = (p, play) => p.evaluate(pl => {
  const want = new Function('r', 'f', 'return ' + pl.pred), ev0 = evalSwing; window.__fp = 0;
  window.evalSwing = (...a) => { window.evalSwing = ev0; for (let i = 0; i < 6000; i++) { const r = ev0(...a); if (r.res && r.res.fplay && want(r.res, a[3])) { window.__fp = i + 1; return r; } } return ev0(...a); };
}, play);
const fieldPlay = async (p, name, play, ai) => {
  for (let n = 0; n < 4; n++) {
    if (!ai) {
      await p.waitForFunction(() => __t.S.phase === 'ready' || __t.S.phase === 'runup', null, {timeout: 30000, polling: 20});
      // long-off and long-on back on the rope for the deep catch
      if (play.field) await p.evaluate(() => __t.fieldSet(tplField(Object.keys(TPL).find(k => TPL[k].f.includes('longoff') && TPL[k].f.includes('longon')))));
      await p.waitForFunction(() => __t.S.phase === 'flight', null, {timeout: 30000, polling: 10});
      await armPlay(p, play);
      await p.evaluate(sw => { const S = __t.S, fa = footAt(S.ball, S.bpos), w = windows(__t.getM().diff, true, 1 + 0.35 * fa.gain);
        S.swing = {tc: fa.t + (sw.edge ? -(w.ok + w.edge) / 2 : 0.002), aim: sw.aim, power: sw.power || 0.8, lofted: !!sw.loft, defend: false, done: false};
        S.bat = {mode: 'swing', t0: S.ball.start + S.swing.tc - SWING_DELAY, from: null, aim: sw.aim}; }, play.sw);
    }
    await p.waitForFunction(() => __t.S.phase !== 'flight' && __t.S.phase !== 'runup', null, {timeout: 30000, polling: 10});
    const ev = await p.evaluate(key => { if (!window.__fp || __t.S.phase !== 'result') return null; const f = __t.getM().field, e = __t.S.fplay.find(x => new Function('return ' + key)()(x, f));
      return e && {...e, n: f[e.i].n || '', label: __t.S.res.label + ', ' + (__t.S.res.sub || ''), view: __t.view()}; }, play.key);
    if (!ev) { if (ai) return null; await p.waitForFunction(() => __t.S.phase !== 'result', null, {timeout: 30000, polling: 20}); continue; }
    if (play.cam && !ev.view[play.cam]) errors.push(`fielding ${name}: expected the ${play.cam} camera, got ${JSON.stringify(ev.view)}`);
    await p.waitForFunction(t => __t.clk() - __t.S.f0 >= t || __t.S.phase !== 'result', ev.t1 + 0.04, {timeout: 20000, polling: 5});
    // paused, frames are still drawn at the paused clock: the rig is read from one of those, not from the frame before the pause
    await p.evaluate(() => { __t.S.paused = true; });
    await p.waitForTimeout(150);
    const st = await p.evaluate(i => ({fv: __t.fv()[i], b: __r.body(i), par: __t.cam3()}), ev.i);
    camErr = Math.max(camErr, st.par); if (!(st.par < 0.5)) errors.push(`camera parity ${name}: ${st.par} px`);
    await p.screenshot({path: `${shots}${name}.png`});
    await p.evaluate(() => { __t.S.paused = false; });
    const f = st.fv, act = {dive: 3, jump: 4, slide: 5}[ev.k] || 2, hd = Math.min(...st.b.hands.map(h => Math.hypot(h[0] - f.hx, h[1] - f.hy, h[2] - f.hz)));
    if (st.fv.act !== act || !st.b.vis) errors.push(`fielding ${name}: ${ev.k} by ${ev.n || ev.i} drawn as action ${st.fv.act}, visible ${st.b.vis}`);
    if (ev.k === 'dive' && st.b.up > 0.9) errors.push(`fielding ${name}: diving ${ev.n || ev.i} still upright (${st.b.up.toFixed(2)})`);
    if ((ev.o === 'catch' || ev.o === 'stop' || ev.o === 'drop') && Math.hypot(f.hx - ev.x, f.hy - ev.y, f.hz - ev.z) < 0.05 && hd > 0.35)
      errors.push(`fielding ${name}: hands ${hd.toFixed(2)} m from the ball at ${ev.o}`);
    return {...ev, up: st.b.up, hd};
  }
  errors.push(`fielding ${name}: the play did not come up in 4 balls`); return null;
};
const playText = e => e ? `${e.k} ${e.o || 'run'} by ${e.n || 'fielder ' + e.i} at t1 ${e.t1.toFixed(2)} s${e.up != null ? `, torso up ${e.up.toFixed(2)}, hands ${e.hd.toFixed(2)} m off` : ''} (${e.label})` : '(none)';
const openPanel = async (p, btn, id) => { await p.click(btn);
  await p.waitForFunction(id => getComputedStyle(document.querySelector(id)).transform === 'none', id, {timeout: 5000, polling: 30}); };

await page.goto(url);
// the skinned batter must load (the game would silently fall back to the procedural one)
await page.waitForFunction(() => __r.skin().on || __r.skin().err, null, {timeout: 10000, polling: 50}).catch(() => {});
const skin = await page.evaluate(() => __r.skin());
if (!skin.on) errors.push('skinned batter: ' + skin.err);
else console.log('skin     ok  skinned batter loaded');
{
  // Menu: the hub over the live stadium (a sweeping camera, in parity with the overlays), each mode's sheet, a planet picked in a
  // sheet switches the stadium behind it, options persist, settings toggles, how to play; Play puts the batting lens back
  await page.waitForTimeout(600);
  const c0 = await page.evaluate(() => __t.cam());
  await page.waitForTimeout(700);
  const c1 = await page.evaluate(() => __t.cam());
  if (!c0.menu || c0.base || c0.y < 20 || c0.yaw === c1.yaw) errors.push('menu: no moving menu camera ' + JSON.stringify([c0, c1]));
  await camCheck('menu camera');
  await page.screenshot({path: `${shots}menu-hub.png`});
  await openMode(page, 'quick');
  const ms = await page.evaluate(() => { const t = performance.now(); document.querySelector('#planetGrid button[data-v=mars]').click(); return Math.round(performance.now() - t); });
  await page.click('.seg[data-key=diff] button[data-v=hard]');
  await page.click('.seg[data-key=len] button[data-v="2"]');
  const st = await page.evaluate(() => ({cam: __t.cam(), set: JSON.parse(localStorage.getItem('cc_settings')), blurb: document.querySelector('#planetBlurb').textContent}));
  if (st.cam.planet !== 'mars' || st.set.planet !== 'mars' || st.set.diff !== 'hard' || st.set.len !== 2 || !/^Mars/.test(st.blurb)) errors.push('menu: Quick match sheet ' + JSON.stringify(st));
  await page.waitForTimeout(500);
  await page.screenshot({path: `${shots}menu-quick.png`});
  await page.click('#planetGrid button[data-v=earth]');
  await page.click('.seg[data-key=diff] button[data-v=medium]');
  await page.click('#sheet .x');
  for (const m of ['t20', 'nets', 'scen']) {
    await openMode(page, m);
    const v = await page.evaluate(() => ['#venueOpt', '#diffOpt', '#lenOpt', '#netsOpt', '#scenOpt', '#sgo'].map(q => document.querySelector(q).hidden ? 0 : 1).join(''));
    const want = {t20: '110001', nets: '110101', scen: '000010'}[m];
    if (v !== want) errors.push(`menu: ${m} sheet shows ${v}, expected ${want}`);
    await page.screenshot({path: `${shots}menu-${m}.png`});
    await page.click('#sheet .x');
  }
  await openPanel(page, '#setBtn', '#setSheet');
  await page.click('#optAssist');
  const as = await page.evaluate(() => JSON.parse(localStorage.getItem('cc_settings')).assist);
  await page.click('#optAssist');
  if (as !== false || await page.evaluate(() => JSON.parse(localStorage.getItem('cc_settings')).assist) !== true) errors.push('menu: pitch marker toggle did not persist');
  await page.screenshot({path: `${shots}menu-settings.png`});
  await page.click('#setSheet .x');
  await openPanel(page, '#howBtn', '#howSheet');
  await page.screenshot({path: `${shots}menu-how.png`});
  await page.keyboard.press('Escape');
  if (await page.evaluate(() => document.querySelector('#menu').classList.contains('sheet-on'))) errors.push('menu: Escape did not close the panel');
  console.log(`menu     ok  hub camera sweep (yaw ${c0.yaw.toFixed(1)} -> ${c1.yaw.toFixed(1)}), four mode sheets, live planet switch ${ms} ms, settings and how-to`);
}
for (const pk of planets) {
  await startMode(page, 'nets', {planet: pk});
  await page.waitForFunction(() => __t.S.phase === 'runup' && __t.S.t > 1.0, null, {timeout: 30000, polling: 30});
  if (pk === planets[0]) { const c = await page.evaluate(() => __t.cam()); if (c.menu || !c.base) errors.push('menu: the batting lens was not restored ' + JSON.stringify(c)); }
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
  await openPanel(page, '#setBtn', '#setSheet');
  await page.click('#resetBrain');
  await page.click('#setSheet .x');
  await startMode(page, 'nets', {netsW: 0, planet: 'earth'});
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
  // Fielding (forced plays, see fieldPlay): an edge to the keeper or slip in the cordon camera, a diving stop in the ring, a running
  // catch in the deep in the chase camera, and a four past a diving fielder, whose dive the replay must show too
  await startMode(page, 'nets', {netsW: 0, planet: 'earth'});
  const fp = {};
  for (const k of ['edge', 'ring', 'deep']) fp[k] = await fieldPlay(page, 'earth-field-' + k, PLAYS[k]);
  fp.four = await fieldPlay(page, 'earth-field-four', PLAYS.four);
  if (fp.four) {
    await page.waitForFunction(() => __t.S.phase === 'replay', null, {timeout: 20000, polling: 20}).catch(() => errors.push('fielding: no replay of the four'));
    const rd = await page.waitForFunction(() => __t.S.phase !== 'replay' || __t.fv().findIndex(f => f.act === 3 && Math.abs(f.ap) < 0.12) + 1, null, {timeout: 20000, polling: 5})
      .then(h => h.jsonValue()).catch(() => 0);
    if (typeof rd !== 'number' || rd < 1) errors.push('fielding: the replay did not show the dive');
    else { const b = await page.evaluate(i => { __t.S.paused = true; return __r.body(i); }, rd - 1);
      await page.waitForTimeout(120); await page.screenshot({path: `${shots}earth-field-replay.png`}); await page.evaluate(() => { __t.S.paused = false; });
      if (b.up > 0.9) errors.push('fielding: the replayed diver is upright ' + b.up.toFixed(2)); fp.four.up = b.up; fp.four.hd = 0; }
  }
  for (const k in fp) console.log(`field    ok  ${k}: ${playText(fp[k])}`);
  await page.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await page.waitForTimeout(100);
  if (await page.isVisible('#end')) await page.click('#menuBtn');
  await startMode(page, 'quick', {planet: 'earth', len: 1});
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
  await startMode(page, 't20', {planet: 'earth'});
  // First innings, the player bowls: intro, the over picker (captain's pick preselected, last over's bowler disabled), per ball a
  // delivery chip, a marker drag, a meter tap at a known rel (and a no-tap ball and a real tap), checked on the delivery; the AI
  // swings and every ball is recorded. Then save, reload and resume mid-over, Simulate rest, the innings break and the chase
  // against the AI attack with target = total + 1.
  if (!/bowl first/i.test(await page.textContent('#iTitle'))) errors.push('T20: no bowling intro, title ' + await page.textContent('#iTitle'));
  await page.screenshot({path: `${shots}earth-t20-intro.png`});
  await page.click('#chaseBtn');
  const bNow = () => page.evaluate(() => __t.bowl());
  const toReady = async () => { await page.waitForFunction(() => ['ready', 'pick'].includes(__t.S.phase), null, {timeout: 30000, polling: 30});
    let b = await bNow();
    if (b.phase === 'pick') {
      const last = await page.evaluate(() => __t.getM().st.last);
      if (last >= 0 && !b.pick.dis.includes(last)) errors.push(`T20 bowling: last over's bowler ${last} not disabled in the picker ${JSON.stringify(b.pick)}`);
      if (b.pick.bi !== b.pick.sg.bi || b.pick.pid !== b.pick.sg.pid || b.pick.dis.length !== 5 - b.pick.legal.length) errors.push('T20 bowling: picker ' + JSON.stringify(b.pick));
      if (b.overNo === 1) { await page.waitForTimeout(300); await page.screenshot({path: `${shots}earth-t20-pick.png`}); }
      // a different legal bowler than suggested in over 2: his default plan is offered, and it is legal
      if (b.overNo === 2) { const alt = b.pick.legal.find(i => i !== b.pick.sg.bi); if (alt != null) await page.click(`#opBowlers button[data-i="${alt}"]`); }
      if (!(await bNow()).fieldOk) errors.push('T20 bowling: picker previews an illegal field');
      await page.click('#opGo');
      await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
      await page.evaluate(() => { __t.S.t = Math.max(__t.S.t, __t.S.breakDur - 0.1); });
      await page.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 30000, polling: 30});
    }
    return bNow(); };
  const bowlOne = async (i, tap) => {
    let b = await toReady();
    if (!b.kit) errors.push('T20 bowling: fielders not in the player\'s kit');
    const chips = await page.$$('#optChips button'), ci = i % chips.length;
    await chips[ci].click();
    const k = await chips[ci].getAttribute('data-k');
    b = await bNow();
    const [mx, my] = b.mkScreen;
    await page.mouse.move(mx + 30, my + 30); await page.mouse.down(); await page.mouse.move(mx + 30 + [12, -15, 6, -8][i % 4], my + 30 - [18, 10, -14, 22][i % 4], {steps: 4}); await page.mouse.up();
    const b1 = await bNow();
    if (b1.mk === b.mk) errors.push('T20 bowling: marker drag did not move the marker');
    if (i === 0) await page.screenshot({path: `${shots}earth-t20-bowl.png`});
    if (i === 0) await camCheck('bowling view');
    // fielding in the bowling view: on ball 4 the AI batter edges it to the keeper or slip, on ball 6 it leaves it for the keeper
    if (i === 3 || i === 5) await page.evaluate(leave => { const ab = aiBat; window.aiBat = (st, b, f) => { window.aiBat = ab; const s = ab(st, b, f);
      if (leave) return {leave: true, bp: null}; const fa = footAt(b, null), w = windows(BOWL_D, true, 1 + 0.35 * fa.gain);
      return {...s, leave: false, defend: false, lofted: false, aim: 20, power: 0.8, bp: null, tc: fa.t - (w.ok + w.edge) / 2}; }; }, i === 5);
    if (i === 3) await armPlay(page, PLAYS.edge);
    await page.click('#bowlBtn');
    await page.waitForFunction(() => __t.S.phase === 'runup' && __t.S.t > __t.S.runupDur - 0.6, null, {timeout: 30000, polling: 20});
    if (tap === 'mouse') await page.mouse.click(60, 300);
    else if (tap != null) await page.evaluate(r => __t.bowlTap(r), tap);
    if (i === 0) await page.screenshot({path: `${shots}earth-t20-meter.png`});
    await page.waitForFunction(() => __t.S.phase === 'flight', null, {timeout: 30000, polling: 20});
    const f = await bNow(), [mkx, mkz] = b1.mk.split(',').map(Number);
    if (f.ball.opt !== k || f.ball.mk !== 'b' + f.bi + ':' || Math.abs(f.ball.mark.x - mkx) > 1e-3 || Math.abs(f.ball.mark.z - mkz) > 1e-3) errors.push('T20 bowling: delivery ' + JSON.stringify([k, b1.mk, f.ball]));
    if (tap === null ? f.meter.tap !== null || Math.abs(f.ball.rel) < 0.1 : tap === 'mouse' ? f.meter.tap == null || f.ball.rel !== f.meter.tap : Math.abs(f.ball.rel - tap) > 1e-6)
      errors.push(`T20 bowling: release ${tap} gave ${JSON.stringify([f.meter, f.ball.rel])}`);
    if (i === 3) { const e = await fieldPlay(page, 'earth-t20-bowl-field', {...PLAYS.edge, cam: null}, true); console.log(`field    ok  T20 bowling view: ${e ? playText(e) : '(no edge play came up: ball out of reach)'}`); }
    if (i === 5) {
      // the keeper (drawn in the bowling view) takes the ball at his gloves, which then hold it
      const g = await page.waitForFunction(() => { const S = __t.S, k = __t.fv().findIndex(f => f.kp);
        return S.phase !== 'flight' && S.phase !== 'result' ? -1 : S.res && (S.res.out || S.padHit) ? -2 : k >= 0 && __t.fv()[k].ap > 0.1 && k + 1; }, null, {timeout: 20000, polling: 5})
        .then(h => h.jsonValue());
      if (g === -2) console.log('field    ok  T20 bowling view: the ball left alone hit the pads or stumps, no gather to check');
      else if (!(g > 0)) errors.push('fielding: the keeper did not gather a ball left alone in the bowling view');
      else { const k = await page.evaluate(i => { __t.S.paused = true; const f = __t.fv()[i], b = __r.body(i), q = __t.S;
          return {vis: b.vis, act: f.act, d: Math.min(...b.hands.map(h => Math.hypot(h[0] - f.hx, h[1] - f.hy, h[2] - f.hz))), info: __r.info()}; }, g - 1);
        await page.waitForTimeout(120); await page.screenshot({path: `${shots}earth-t20-keeper.png`}); await page.evaluate(() => { __t.S.paused = false; });
        if (!k.vis || k.act !== 6 || k.d > 0.3) errors.push('fielding: keeper gather ' + JSON.stringify(k));
        else console.log(`field    ok  T20 bowling view: keeper gathers, gloves ${k.d.toFixed(2)} m from the ball, ${k.info.calls} draw calls, ${k.info.tris} triangles`); }
    }
    await page.waitForFunction(() => __t.S.phase !== 'flight', null, {timeout: 30000, polling: 20});
    const r = await page.evaluate(() => ({res: __t.S.res, swing: !!__t.S.swing, b: __t.bowl()}));
    if (!f.ai.leave && !r.swing) errors.push('T20 bowling: the AI batter did not swing ' + JSON.stringify(f.ai));
    if (r.b.balls !== f.balls + (r.res.wide ? 0 : 1) || r.b.runs !== f.runs + r.res.runs || r.b.chips.split(' ').length !== (f.chips ? f.chips.split(' ').length + 1 : 1) && r.b.balls % 6)
      errors.push('T20 bowling: ball not recorded ' + JSON.stringify([f.balls, f.runs, f.chips, r.res.label, r.b.balls, r.b.runs, r.b.chips]));
    seenB.add(r.res.label + (f.ai.leave ? ' (left)' : f.ai.defend ? ' (blocked)' : ''));
    await page.waitForFunction(() => ['ready', 'pick', 'replay', 'break'].includes(__t.S.phase), null, {timeout: 30000, polling: 30});
    if (await page.evaluate(() => __t.S.phase === 'replay')) { await page.waitForTimeout(400); await page.mouse.click(195, 500); }
  };
  const seenB = new Set();
  const taps = [0, -0.2, null, 0.15, 'mouse', 0.05, -0.05, 0.3];
  for (let i = 0; i < 8; i++) await bowlOne(i, taps[i]);
  let bw1 = await toReady();
  if (bw1.overNo < 2 || JSON.parse(bw1.bw).filter(f => f.o || f.b).length < 2) errors.push('T20 bowling: no second bowler ' + bw1.bw);
  await page.click('#pauseBtn');
  await page.screenshot({path: `${shots}earth-t20-bowl-pause.png`});
  await page.click('#resumeBtn');
  const sv1 = await bNow();
  await page.reload();
  if (!/Bowling: /.test(await page.textContent('#resumeT20').catch(() => ''))) errors.push('T20: Continue banner after reload in the first innings: ' + await page.textContent('#resumeT20').catch(() => '(none)'));
  await page.click('#resumeT20');
  bw1 = await toReady();
  for (const k of ['runs', 'wkts', 'balls', 'bi', 'pid', 's', 'ns', 'bat', 'bw', 'overNo', 'optK', 'mkB', 'chips', 'mk']) if (sv1[k] !== bw1[k]) errors.push(`T20 bowling resume: ${k} was ${sv1[k]}, resumed ${bw1[k]}`);
  await bowlOne(9, 0);
  console.log(`earth    ok  T20 bowling ${bw1.runs}/${bw1.wkts} after ${bw1.balls} balls, resumed mid-over ${bw1.overNo}; results: ${[...seenB].join(', ')}`);
  // Simulate rest from the pause screen (two taps), the innings break, then the chase
  await toReady();
  await page.click('#pauseBtn');
  await page.click('#simBtn');
  if (!await page.isVisible('#pause')) errors.push('T20: one tap on Simulate rest did not wait for a confirmation');
  await page.click('#simBtn');
  await page.waitForFunction(() => document.querySelector('#intro').classList.contains('on'), null, {timeout: 10000, polling: 50});
  const brk = await page.evaluate(() => { const M = __t.getM(); return {i1: M.i1.runs, w: M.i1.wkts, b: M.i1.balls, target: M.target, btn: document.querySelector('#chaseBtn').textContent, kit: __t.t20().kit}; });
  if (brk.target !== brk.i1 + 1 || brk.btn !== 'Chase ' + brk.target || !(brk.w >= 10 || brk.b >= 120) || brk.kit) errors.push('T20 innings break ' + JSON.stringify(brk));
  await page.screenshot({path: `${shots}earth-t20-break.png`});
  console.log(`earth    ok  T20 simulated rest: ${brk.i1}/${brk.w} in ${brk.b} balls, chase ${brk.target}`);
  await page.click('#chaseBtn');
  await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
  { const c = await page.evaluate(() => __t.t20());
    if (c.target !== brk.target || !c.aiAtk || c.kit || c.inn !== 2) errors.push('T20 chase start ' + JSON.stringify(c)); }
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
  await page.waitForSelector('#resumeT20:not([hidden])', {timeout: 5000}).catch(() => errors.push('T20: no Continue banner after reload'));
  await page.screenshot({path: `${shots}menu-hub-continue.png`});
  await page.click('#resumeT20');
  await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
  const back = await page.evaluate(() => __t.t20());
  for (const k in saved) if (k !== 'ns3d' && saved[k] !== back[k]) errors.push(`T20 resume: ${k} was ${saved[k]}, resumed ${back[k]}`);
  console.log(`earth    ok  T20 ${back.runs}/${back.wkts} after ${back.balls} balls, ${seen.bi.size} bowlers, ${seen.field.size} fields, ${seen.odd} strike changes on odd runs, a Hold, resumed after reload with batter ${back.s} on strike`);
  await page.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await page.waitForTimeout(100);
  if (await page.evaluate(() => localStorage.getItem('cc_t20') === null || document.querySelector('#resumeT20').hidden)) errors.push('T20: save lost on quit (Resume must stay available)');
  if (!/Chasing \d+: /.test(await page.textContent('#resumeT20'))) errors.push('T20: Continue banner in the chase: ' + await page.textContent('#resumeT20'));
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cc_t20')); s.v = 2; localStorage.setItem('cc_t20', JSON.stringify(s)); });
  await page.reload();
  if (await page.isVisible('#resumeT20')) errors.push('T20: a v2 save is offered for resume');
}
if (planets.includes('earth')) {
  // Scenarios: the list, a briefing, a survive scenario (forced duck under a bouncer, forced swings, then a forced end: result card
  // with stars), a last pair against spin (forced sweep, a Hold, a strike change, legal Test fields), and a staged scenario
  // carried into its next session after the interstitial.
  await page.evaluate(() => { localStorage.removeItem('cc_scen'); localStorage.removeItem('cc_t20'); });
  await page.reload();
  await openMode(page, 'scen');
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
  await openMode(page, 'scen');
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
  await page.click('#contScen');
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
  // after a quit the Scenarios sheet is open (its resume tile); after a reload the hub (its Continue banner)
  const toBreak = async (sel = '#scenResume') => { await page.click(sel); await wf(() => __t.S.phase === 'break'); return sNow(); };
  const resume = async () => { await page.reload();
    if (!await page.waitForSelector('#contScen:not([hidden])', {timeout: 5000}).catch(() => null)) { errors.push('Scenarios: no Continue banner after reload'); return null; }
    return toBreak('#contScen'); };
  const same = (a, b, where) => { for (const k in a) if (!['ns3d', 'hold'].includes(k) && a[k] !== b[k]) errors.push(`Scenario resume ${where}: ${k} was ${a[k]}, resumed ${b[k]}`); };
  let i = 0;
  const play = async () => { await wf(`(${skipS})()`); await bat([25, -40, 0, 60, -70][i % 5], {power: [0.3, 0.45, 0.35][i % 3]}); i++; await wf(() => __t.S.phase !== 'flight'); };
  await page.evaluate(() => localStorage.removeItem('cc_scensave'));
  await page.reload();
  if (await page.isVisible('#contScen')) errors.push('Scenarios: Continue shown with no save');
  await openMode(page, 'scen');
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
    if (await page.isVisible('#contScen')) errors.push('Scenarios: a corrupt save is offered: ' + bad.slice(0, 60));
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
    await land.waitForTimeout(600);
    await land.screenshot({path: `${shots}landscape-hub.png`});
    await openMode(land, 'scen');
    const r = await land.evaluate(() => { const b = document.querySelector('#scenResume').getBoundingClientRect(); return {w: b.width, right: b.right, top: b.top, vw: innerWidth}; });
    if (!await land.isVisible('#scenResume') || r.right > r.vw || r.w < 200) errors.push('landscape: Resume entry ' + JSON.stringify(r));
    await land.screenshot({path: `${shots}landscape-scen-menu.png`});
    console.log(`land     ok  scenario Resume entry ${JSON.stringify(r)}`);
  }
  if (scenGood) await land.click('#sheet .x');
  await openMode(land, 'quick');
  await land.screenshot({path: `${shots}landscape-quick.png`});
  const sh = await land.evaluate(() => { const r = document.querySelector('#startBtn').getBoundingClientRect(); return {bottom: r.bottom, vh: innerHeight, scroll: document.querySelector('#sheet .sbody').scrollHeight - document.querySelector('#sheet .sbody').clientHeight}; });
  if (sh.bottom > sh.vh || sh.scroll > 0) errors.push('landscape: Quick match sheet does not fit ' + JSON.stringify(sh));
  await land.click('#sheet .x');
  await startMode(land, 'nets', {planet: 'earth'});
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
  { const e = await fieldPlay(land, 'landscape-field-edge', PLAYS.edge); const c = await land.evaluate(() => __t.cam3());
    camErr = Math.max(camErr, c); if (!(c < 0.5)) errors.push(`camera parity landscape cordon: ${c} px`);
    console.log(`land     ok  cordon camera: ${playText(e)}`); }
  // T20 in the phone layout: the slab (with the batters) stays in its column above the stick, and the pause scorecard
  await land.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await land.waitForTimeout(100);
  if (await land.isVisible('#end')) await land.click('#menuBtn');
  await land.evaluate(() => localStorage.removeItem('cc_t20'));
  await startMode(land, 't20');
  // bowling first: the over picker, the bowling view (chips, Bowl, HUD and radar apart), the meter in the run-up
  await land.click('#chaseBtn');
  await land.waitForFunction(() => __t.S.phase === 'pick', null, {timeout: 30000, polling: 30});
  await land.screenshot({path: `${shots}landscape-t20-pick.png`});
  const pk = await land.evaluate(() => { const r = document.querySelector('#overPick').getBoundingClientRect(), g = document.querySelector('#opGo').getBoundingClientRect();
    return {bottom: r.bottom, vh: innerHeight, go: g.bottom <= r.bottom + 1 && g.top >= r.top}; });
  if (pk.bottom > pk.vh || !pk.go) errors.push('landscape: over picker ' + JSON.stringify(pk));
  await land.click('#opGo');
  await land.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 30000, polling: 30});
  await land.waitForTimeout(2700);
  await land.screenshot({path: `${shots}landscape-t20-bowl.png`});
  const bl = await land.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), c = [...document.querySelectorAll('#optChips button')].map(b => b.getBoundingClientRect());
    return {chipsR: Math.max(...c.map(b => b.right)), chipsL: Math.min(...c.map(b => b.left)), chipsT: Math.min(...c.map(b => b.top)), chipsB: Math.max(...c.map(b => b.bottom)), bowl: r('#bowlBtn').left,
      slab: r('#t20Slab').bottom, vh: innerHeight, mk: __t.bowl().mkScreen}; });
  if (bl.chipsR > bl.bowl || bl.chipsT < bl.slab || bl.chipsB > bl.vh || bl.chipsL < 0 || bl.mk[1] > bl.chipsT) errors.push('landscape bowling layout overlaps: ' + JSON.stringify(bl));
  await land.click('#bowlBtn');
  await land.waitForFunction(() => __t.S.phase === 'runup' && __t.S.t > __t.S.runupDur - 0.5, null, {timeout: 30000, polling: 20});
  await land.screenshot({path: `${shots}landscape-t20-meter.png`});
  { const e = await land.evaluate(() => __t.cam3()); camErr = Math.max(camErr, e); if (!(e < 0.5)) errors.push(`camera parity landscape bowling: ${e} px`); }
  console.log(`land     ok  T20 bowling layout ${JSON.stringify(bl)}`);
  await land.click('#pauseBtn');
  await land.click('#simBtn');await land.click('#simBtn');
  await land.waitForFunction(() => document.querySelector('#intro').classList.contains('on'), null, {timeout: 10000, polling: 50});
  await land.screenshot({path: `${shots}landscape-t20-break.png`});
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
for (const [w, h] of [[375, 667], [430, 932]]) {
  const p = await browser.newPage({viewport: {width: w, height: h}});
  p.on('pageerror', e => errors.push(`${w}x${h}: ` + (e.stack || String(e))));
  await p.goto(url);
  await p.waitForTimeout(600);
  const f = await p.evaluate(() => ({sw: document.documentElement.scrollWidth, vw: innerWidth, vh: innerHeight,
    low: Math.max(...[...document.querySelectorAll('.mcard,.htitle,.hicons')].map(e => e.getBoundingClientRect().bottom)),
    right: Math.max(...[...document.querySelectorAll('.mcard,.hicons')].map(e => e.getBoundingClientRect().right))}));
  if (f.sw > f.vw || f.low > f.vh || f.right > f.vw) errors.push(`menu ${w}x${h}: overflows ${JSON.stringify(f)}`);
  await p.screenshot({path: `${shots}menu-hub-${w}.png`});
  if (w === 430) { await p.emulateMedia({colorScheme: 'dark'}); await openMode(p, 'nets'); await p.screenshot({path: `${shots}menu-nets-dark.png`}); }
  console.log(`menu     ok  ${w}x${h} hub fits ${JSON.stringify(f)}`);
  await p.close();
}
await browser.close();
if (errors.length) { console.log('\nPage errors:\n' + errors.join('\n')); process.exit(1); }
console.log(`\nNo page errors. Camera parity within ${camErr.toFixed(4)} px. Screenshots in tests/screenshots/`);
