// Browser smoke test: loads dist/galactic-cricket.html in headless Chromium (software WebGL), plays a few balls
// on each planet, forces a perfectly timed swing, and fails on any page error. Screenshots go to tests/screenshots/.
// Usage: npm run build && node tests/smoke.mjs [planet ...]
// Filters (unset = everything, as CI and the run before a push): SMOKE_ONLY=field,throw runs only those sections (each starts from the
// hub on a fresh page, so it passes alone); SMOKE_PLANETS=earth,mars limits the per-planet loop (argv planets still work).
// `node tests/smoke.mjs --list` prints the section names. Sections run in file order; the skinned-batter check always runs.
import {chromium} from 'playwright';
import {mkdirSync, readFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

const SECTIONS = ['menu', 'planets', 'replay', 'field', 'throw', 'catch', 'celebrate', 'replay2', 't20bowl', 't20chase', 'scen', 'scenlast', 'scenstage', 'scensave', 'land', 'landt20', 'sizes', 'chars'];
if (process.argv.includes('--list')) { console.log(SECTIONS.join('\n')); process.exit(0); }
const ONLY = process.env.SMOKE_ONLY ? process.env.SMOKE_ONLY.split(',').map(x => x.trim()).filter(Boolean) : null;
if (ONLY && ONLY.some(x => !SECTIONS.includes(x))) { console.error(`SMOKE_ONLY: unknown section ${ONLY.filter(x => !SECTIONS.includes(x))}; sections: ${SECTIONS.join(', ')}`); process.exit(2); }
const ran = new Set(), on = n => { const y = !ONLY || ONLY.includes(n); if (y) ran.add(n); return y; }, any = (...n) => n.map(on).some(Boolean);
const argPlanets = process.argv.slice(2).filter(a => !a.startsWith('--')), envPlanets = (process.env.SMOKE_PLANETS || '').split(',').map(x => x.trim()).filter(Boolean);
const planets = argPlanets.length ? argPlanets : envPlanets.length ? envPlanets : ['earth','moon','mercury','venus','mars','jupiter','saturn','neptune'];
console.log(`smoke sections: ${SECTIONS.join(' ')}\nrunning: ${ONLY ? ONLY.join(' ') : 'all'}; planets: ${planets.join(' ')}`);
const smokeT0 = Date.now();
const shots = fileURLToPath(new URL('./screenshots/', import.meta.url));
mkdirSync(shots, {recursive: true});
// SMOKE_DIST=dist/other.html tests another build (a parallel track's, or the lab's)
const url = pathToFileURL(fileURLToPath(new URL('../' + (process.env.SMOKE_DIST || 'dist/galactic-cricket.html'), import.meta.url))).href + '#test';

const browser = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport: {width: 390, height: 844}});
const errors = [];
let scenGood = null; // a valid scenario save, for the landscape menu
page.on('pageerror', e => errors.push(e.stack || String(e)));
// a wait that times out: the game state on every page and the errors so far, instead of a bare stack
process.on('uncaughtException', async e => { console.log('\n' + (e.stack || e));
  for (const pg of browser.contexts().flatMap(c => c.pages())) console.log(pg.viewportSize(), await pg.evaluate(() => window.__t && JSON.stringify({phase: __t.S.phase, paused: __t.S.paused,
    res: __t.S.res && __t.S.res.label, rp: __t.rp() && {t: __t.rp().t, end: __t.rp().end, cls: __t.rp().cls}, M: __t.getM() && {wkts: __t.getM().wkts, max: __t.getM().wktsMax}, screen: document.querySelector('.screen.on')?.id})).catch(x => String(x)));
  console.log('\nPage errors:\n' + errors.join('\n')); process.exit(1); });
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
  four: {sw: {aim: 30, power: 1}, pred: "r.boundary===4&&r.fplay.some(e=>e.k==='dive'&&e.o==='miss')", key: "e=>e.k==='dive'"},
  // throws (noPose: only the play is forced, throwCheck looks at the throw; balls with no replay, which would cut the throw): a standing stop in the ring, a stop in the deep (long-on/long-off back), mid-on or mid-off stopping an AI drive (T20 bowling)
  thr: {sw: {aim: 30, power: 1}, noPose: 1, field: 'PC', pred: "!r.out&&!r.boundary&&!r.lofted&&r.fplay.some(e=>e.k==='stop'&&e.o==='stop'&&Math.hypot(f[e.i].x,f[e.i].z)<35)&&!highlightOf(r,b,f,footAt(b,s.bp).c)",
    key: "e=>e.k==='stop'&&e.o==='stop'"},
  thrDeep: {sw: {aim: 30, power: 0.3, loft: 1}, field: 1, noPose: 1, pred: "!r.out&&!r.boundary&&r.fplay.some(e=>e.k==='stop'&&e.o==='stop'&&e.t1<3.6&&Math.hypot(f[e.i].x,f[e.i].z)>BOUNDARY*.6)&&!highlightOf(r,b,f,footAt(b,s.bp).c)",
    key: "e=>e.k==='stop'&&e.o==='stop'"},
  // a diving stop in the ring (its throw lands in the next ball's countdown), an AI drive stopped or fetched in the deep on the off side (T20 bowling: to the keeper)
  thrDive: {sw: {aim: 30, power: 1}, noPose: 1, pred: "!r.lofted&&!r.boundary&&!r.out&&r.fplay.some(e=>e.k==='dive'&&e.o==='stop'&&e.t1>0.8&&Math.hypot(f[e.i].x,f[e.i].z)<35)&&!highlightOf(r,b,f,footAt(b,s.bp).c)",
    key: "e=>e.k==='dive'&&e.o==='stop'"},
  thrFetch: {noPose: 1, pred: "!r.out&&!r.boundary&&r.fplay.some(e=>(e.o==='stop'||e.k==='run'&&!e.o)&&e.z<35&&Math.hypot(e.x,e.z)>BOUNDARY*.55)&&!highlightOf(r,b,f,footAt(b,s.bp).c)",
    key: "e=>(e.o==='stop'||e.k==='run'&&!e.o)&&e.z<35&&Math.hypot(e.x,e.z)>BOUNDARY*.55"},
  // caught wickets for the catch replays: an edge to the keeper or the cordon, caught and bowled (opt: may not come up), an AI drive caught in the ring
  slipCatch: {sw: {aim: 20, edge: 1}, noPose: 1, pred: "r.out&&r.catcher!=null&&/^(keeper|slip|gully)/.test(f[r.catcher].n)", key: "e=>e.o==='catch'"},
  cab: {sw: {aim: 0, power: 0.5, loft: 1}, noPose: 1, opt: 1, pred: "r.out&&r.catcher!=null&&f[r.catcher].n==='bowler'", key: "e=>e.o==='catch'"},
  aiCatch: {noPose: 1, pred: "r.out&&r.catcher!=null&&!/^(keeper|slip|gully|bowler)/.test(f[r.catcher].n)&&r.fplay.some(e=>e.i===r.catcher&&e.o==='catch')", key: "e=>e.o==='catch'"},
  thrMid: {noPose: 1, pred: "!r.out&&r.fplay.some(e=>e.k==='stop'&&e.o==='stop'&&['midon','midoff'].includes(f[e.i].n))&&!highlightOf(r,b,f,footAt(b,s.bp).c)", key: "e=>e.k==='stop'&&e.o==='stop'"}
};
const armPlay = (p, play) => p.evaluate(pl => {
  const want = new Function('r', 'f', 'b', 's', 'return ' + pl.pred), ev0 = evalSwing; window.__fp = 0;
  window.evalSwing = (...a) => { window.evalSwing = ev0; for (let i = 0; i < 6000; i++) { const r = ev0(...a); if (r.res && r.res.fplay && want(r.res, a[3], a[0], a[1])) { window.__fp = i + 1; return r; } } return ev0(...a); };
}, play);
// hands on the ball at a catch, stop or drop: the character lab's gate (tests/charlab/thresholds.json handsBall)
const HANDS_BALL = JSON.parse(readFileSync(new URL('./charlab/thresholds.json', import.meta.url), 'utf8')).handsBall;
const fieldPlay = async (p, name, play, ai) => {
  for (let n = 0; n < 4; n++) {
    if (!ai) {
      await p.waitForFunction(() => __t.S.phase === 'ready' || __t.S.phase === 'runup', null, {timeout: 30000, polling: 20});
      // long-off and long-on back on the rope for the deep catch (field: 1), or a field template by name
      if (play.field) await p.evaluate(t => __t.fieldSet(tplField(t === 1 ? Object.keys(TPL).find(k => TPL[k].f.includes('longoff') && TPL[k].f.includes('longon')) : t)), play.field);
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
    if (play.noPose) return ev;
    await p.waitForFunction(t => __t.clk() - __t.S.f0 >= t || __t.S.phase !== 'result', ev.t1 + 0.04, {timeout: 20000, polling: 5});
    // paused, frames are still drawn at the paused clock: the rig is read from one of those, not from the frame before the pause
    await p.evaluate(() => { __t.S.paused = true; });
    await p.waitForTimeout(150);
    const st = await p.evaluate(i => ({fv: __t.fv()[i], b: __r.body(i), par: __t.cam3()}), ev.i);
    camErr = Math.max(camErr, st.par); if (!(st.par < 0.5)) errors.push(`camera parity ${name}: ${st.par} px`);
    await p.screenshot({path: `${shots}${name}.png`});
    await p.evaluate(() => { __t.S.paused = false; });
    const f = st.fv, act = {dive: 3, jump: 4, slide: 5}[ev.k] || 2, hd = Math.min(...st.b.hands.map(h => Math.hypot(h[0] - f.hx, h[1] - (f.hy + 0.05), h[2] - f.hz)));   // (the ball as drawn: its centre .05 above the path, as the lab's handsBall)
    if (st.fv.act !== act || !st.b.vis) errors.push(`fielding ${name}: ${ev.k} by ${ev.n || ev.i} drawn as action ${st.fv.act}, visible ${st.b.vis}`);
    if (ev.k === 'dive' && st.b.up > 0.9) errors.push(`fielding ${name}: diving ${ev.n || ev.i} still upright (${st.b.up.toFixed(2)})`);
    if ((ev.o === 'catch' || ev.o === 'stop' || ev.o === 'drop') && Math.hypot(f.hx - ev.x, f.hy - ev.y, f.hz - ev.z) < 0.05 && hd > HANDS_BALL)
      errors.push(`fielding ${name}: hands ${hd.toFixed(2)} m from the ball at ${ev.o}`);
    return {...ev, up: st.b.up, hd};
  }
  if (!play.opt) errors.push(`fielding ${name}: the play did not come up in 4 balls`); return null;
};
// Catch replays: after a forced catch the replay starts with the camera class wanted (close, cab, field), is paused at the catch
// (R.t >= R.tk): the catcher drawn taking it, the ball at his hands, ball and catcher on screen, camera parity, a screenshot; then
// a tap skips it. Returns the phase it moved on to
const catchReplay = async (p, name, cls) => {
  const r = await p.waitForFunction(() => __t.S.phase === 'replay' ? 'replay' : !['result', 'flight'].includes(__t.S.phase) && __t.S.phase, null, {timeout: 20000, polling: 20}).then(h => h.jsonValue());
  if (r !== 'replay') { errors.push(`catch replay ${name}: none, went to ${r}`); return null; }
  const R = await p.evaluate(() => { const R = __t.rp(); return {cls: R.cls, tc: R.tc, tk: R.tk, end: R.end, i: R.ct ? R.ct.i : -1}; });
  if (!R.cls || cls && R.cls !== cls) errors.push(`catch replay ${name}: camera class ${R.cls}, expected ${cls}`);
  if (!R.cls) return null;
  await p.waitForFunction(() => { const R = __t.rp(); if (R && R.t < R.tk) return false; __t.S.paused = true; return true; }, null, {timeout: 20000, polling: 'raf'});
  await p.waitForTimeout(150);
  const s = await p.evaluate(i => { const f = __t.fv()[i], n = __t.getM().field[i].n, r = __r.body(n === 'bowler' ? -1 : i), b = __t.vb().b,
      on = q => !!q && q.x >= 0 && q.x <= innerWidth && q.y >= 0 && q.y <= innerHeight;
    return {n, ph: __t.S.phase, act: f && f.act, vis: r.vis, d: b ? +Math.min(...r.hands.map(h => Math.hypot(h[0] - b.x, h[1] - b.y - 0.05, h[2] - b.z))).toFixed(3) : -1,   // (the ball as drawn)
      ball: !!b && on(__t.pj(b.x, b.y, b.z)), body: !!f && on(__t.pj(f.x, 1, f.z)), par: __t.cam3()}; }, R.i);
  await p.screenshot({path: `${shots}${name}.png`});
  await p.evaluate(() => { __t.S.paused = false; });
  camErr = Math.max(camErr, s.par); if (!(s.par < 0.5)) errors.push(`camera parity ${name}: ${s.par} px`);
  if (s.ph !== 'replay' || ![2, 3, 4, 5].includes(s.act) || !s.vis || !(s.d >= 0 && s.d < 0.2) || !s.ball || !s.body) errors.push(`catch replay ${name}: at the catch ${JSON.stringify(s)}`);
  const vp = p.viewportSize();
  if (await p.evaluate(() => __t.S.phase === 'replay')) { await p.waitForFunction(() => __t.S.phase !== 'replay' || __t.clk() - __t.rp().t0 >= 0.3, null, {timeout: 5000}); await p.mouse.click(vp.width / 2, vp.height * 0.6); }
  const nx = await p.waitForFunction(() => __t.S.phase !== 'replay' && __t.S.phase, null, {timeout: 3000, polling: 20}).then(h => h.jsonValue()).catch(() => 'replay');
  if (nx === 'replay') errors.push(`catch replay ${name}: a tap did not skip it`);
  console.log(`replay   ok  ${name}: ${R.cls} camera, catch by ${s.n} drawn as action ${s.act}, ball ${s.d} m from his hands, on screen ${s.ball && s.body}, then ${nx}`);
  return nx;
};
// Throws (show only): after a forced stop the fielder throws to the keeper or the bowler. Paused at set moments: the ball in the
// thrower's hand in the wind-up, then in flight on the line from the release point to the take point (screenshot), then in the
// receiver's hands (the keeper's is hidden with him in the batting view), before the next run-up (the take may fall in the next
// ball's countdown). hit: a direct hit forced after planning (only at the stumps) knocks the bails off with no wicket and no "Out"
// text. Returns the throw, or null if none was planned (batting, a long one that would land after the next run-up)
const thrNow = p => p.evaluate(() => { const o = __t.S.thr; return o && {i: o.i, rv: o.rv, at: o.at, kind: o.kind, tg: o.tg, tr: o.tr, ta: o.ta, v: o.v, hit: o.hit,
  bw: !!__t.S.fpos[o.i].bw, P0: o.P0, Pt: o.Pt}; });
const pauseAt = (p, t) => p.waitForFunction(t => { const S = __t.S; if (S.thr && __t.clk() - S.f0 < t) return false; S.paused = true; return true; }, t, {timeout: 20000, polling: 'raf'})
  .then(() => p.waitForTimeout(120));
const resume = p => p.evaluate(() => { __t.S.paused = false; });
const throwCheck = async (p, name, hit) => {
  if (hit) await p.evaluate(() => { const o = __t.S.thr; if (o && o.at) o.hit = true; });
  const o = await thrNow(p);
  if (!o) return null;
  const w0 = await p.evaluate(() => __t.getM().wkts);
  // held in the wind-up (the first 0.25 s blend from the stop's own hold, whose hands may be short of a ball on the ground)
  await pauseAt(p, Math.min(o.tr - 0.04, Math.max(o.tg + 0.3, o.tr - 0.2)));
  let s = await p.evaluate(o => { const t = __t.clk() - __t.S.f0, f = __t.fv()[o.i], h = __r.body(o.bw ? -1 : o.i).hands[1], b = __t.vb().b;
    return {t, act: f && f.act, d: b ? Math.hypot(h[0] - b.x, h[1] - b.y, h[2] - b.z) : -1}; }, o);
  await resume(p);
  if (s.t < o.tr && s.t >= o.tg + 0.25 && (s.act !== 7 || !(s.d >= 0 && s.d < 0.12))) errors.push(`throw ${name}: wind-up at ${s.t.toFixed(2)} s drawn as action ${s.act}, ball ${s.d.toFixed(2)} m from his hand`);
  o.hand = s.t < o.tr && s.t >= o.tg + 0.25 ? s.d : null;
  await pauseAt(p, (o.tr + o.ta) / 2);
  s = await p.evaluate(o0 => { const t = __t.clk() - __t.S.f0, b = __t.vb().b, o = __t.S.thr || o0; let off = null;
    if (b) { const dx = o.Pt.x - o.P0.x, dz = o.Pt.z - o.P0.z, L = Math.hypot(dx, dz), u = ((b.x - o.P0.x) * dx + (b.z - o.P0.z) * dz) / (L * L);
      off = Math.max(Math.abs((b.x - o.P0.x) * dz - (b.z - o.P0.z) * dx) / L, u < 0 ? -u * L : u > 1 ? (u - 1) * L : 0); }
    return {t, off, y: b && b.y, ph: __t.S.phase, par: __t.cam3()}; }, o);
  await p.screenshot({path: `${shots}${name}.png`});
  await resume(p);
  camErr = Math.max(camErr, s.par); if (!(s.par < 0.5)) errors.push(`camera parity ${name}: ${s.par} px`);
  if (s.t < o.ta && !(s.off != null && s.off < 0.05)) errors.push(`throw ${name}: in flight at ${s.t.toFixed(2)} s the ball is ${s.off == null ? 'not drawn' : s.off.toFixed(2) + ' m off its line'}`);
  o.flight = s.ph;
  const tk = o.ta + (o.hit ? 0.15 / o.v + 0.15 : 0);
  await pauseAt(p, tk + 0.15);
  s = await p.evaluate(o => { const t = __t.clk() - __t.S.f0, k = __t.fv().findIndex(f => f.kp), r = o.rv === 'bw' ? __r.body(-1) : k >= 0 ? __r.body(k) : null, vb = __t.vb(), b = vb.b;
    return {t, ph: __t.S.phase, on: !!__t.S.thr, vis: !!r && r.vis, ball: vb.vis, d: r && b ? Math.min(...r.hands.map(h => Math.hypot(h[0] - b.x, h[1] - b.y - 0.05, h[2] - b.z))) : -1,
      st: vb.st, st2: vb.st2, out: !!(__t.S.res && __t.S.res.out), w: __t.getM().wkts, banner: document.querySelector('#banner').textContent}; }, o);
  if (o.hit) await p.screenshot({path: `${shots}${name}-hit.png`});
  await resume(p);
  if (s.on && (s.vis ? !(s.d >= 0 && s.d < 0.2) : s.ball)) errors.push(`throw ${name}: at the take (${s.t.toFixed(2)} s) receiver drawn ${s.vis}, ball drawn ${s.ball}, ${s.d.toFixed(2)} m from his hands`);
  o.take = s.vis ? s.d : 'hidden';o.takePh = s.ph;
  if (!['result', 'ready', 'break', 'pick'].includes(s.ph)) errors.push(`throw ${name}: taken in the ${s.ph} phase`);
  if (hit && !o.hit) errors.push(`throw ${name}: no direct hit forced (taken on the way back)`);
  if (o.hit && (!(s.st && s.st.bails || s.st2) || s.out || s.w !== w0 || /out/i.test(s.banner))) errors.push(`throw ${name}: direct hit ${JSON.stringify(s)}`);
  return o;
};
const thrText = o => o ? `${o.kind} to the ${o.rv === 'bw' ? (o.at ? 'bowler at his stumps' : 'bowler on his way back') : 'keeper'}${o.hit ? ', direct hit' : ''}: release ${o.tr.toFixed(2)} s, in ${o.ta.toFixed(2)} s, hand ${o.hand == null ? '-' : o.hand.toFixed(2)} m, flight seen in ${o.flight}, take ${typeof o.take === 'number' ? o.take.toFixed(2) + ' m' : o.take} in ${o.takePh}${o.after || ''}` : '(no throw planned)';
// T20 bowling view, after a throw's take: the next ball waits. Bowl is off (and Space does nothing) while the receiver walks back
// with the ball (screenshot), then on with the thrower and the receiver at their places and the bails on (a direct hit's are put back)
const thrAfter = async (p, name, o) => {
  await p.waitForFunction(() => __t.S.phase !== 'result', null, {timeout: 30000, polling: 20});
  const rx = () => p.evaluate(rv => { const S = __t.S, r = S.fpos.find(f => rv === 'kp' ? f.kp : f.bw), M = __t.getM(), vb = __t.vb();
    return {ph: S.phase, on: !!S.thr, off: document.querySelector('#bowlBtn').classList.contains('off'), x: r.x, z: r.z, act: r.act, hold: r.hold,
      home: rv === 'kp' ? Math.hypot(r.x - r.bx, r.z - r.bz) : Math.abs(r.z - (M.bowlerType === 'pace' ? 28.5 : 23.3)), st: vb.st, st2: vb.st2,
      far: Math.max(...S.fpos.filter(f => !f.bw).map(f => Math.hypot(f.x - f.bx, f.z - f.bz)))}; }, o.rv);
  const a = await rx();
  if (!a.on) { o.after = ', over before the next ball'; return; }
  await p.waitForFunction(() => ['ready', 'pick'].includes(__t.S.phase) || !__t.S.thr, null, {timeout: 30000, polling: 20});
  if (await p.evaluate(() => __t.S.phase === 'ready' && !!__t.S.thr)) {
    if (!(await rx()).off) errors.push(`throw ${name}: Bowl on in the countdown while the throw is on`);
    await p.keyboard.press('Space'); await p.waitForTimeout(100);
    if (await p.evaluate(() => __t.S.phase) !== 'ready') errors.push(`throw ${name}: Space started the run-up during the throw`);
  }
  // half way back (receiver moving with the ball): screenshot
  const b = await p.waitForFunction(rv => { const S = __t.S, r = S.fpos.find(f => rv === 'kp' ? f.kp : f.bw); if (!S.thr) return 'over'; if (!(S.phase !== 'result' && r.hold && r.mv > 0.5)) return false;
    S.paused = true; return 'walk'; }, o.rv, {timeout: 20000, polling: 'raf'}).then(h => h.jsonValue());
  if (b === 'walk') { await p.waitForTimeout(150); const w = await rx(); await p.screenshot({path: `${shots}${name}-walk.png`}); await resume(p);
    if (w.ph === 'ready' && !w.off) errors.push(`throw ${name}: Bowl on while the receiver walks back`); }
  await p.waitForFunction(() => !__t.S.thr, null, {timeout: 20000, polling: 'raf'});
  const z = await rx();
  if (z.ph === 'ready' && z.off || z.home > 0.06 || z.far > 0.06 || z.st || z.st2) errors.push(`throw ${name}: at its end ${JSON.stringify(z)}`);
  o.after = `, walked back ${b === 'walk' ? 'with the ball' : '(not seen)'}, Bowl on with everyone at his place in ${z.ph}`;
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
if(on('menu'))
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
if(on('planets'))
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
if(on('replay')){
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
}
  // Fielding (forced plays, see fieldPlay): an edge to the keeper or slip in the cordon camera, a diving stop in the ring, a running
  // catch in the deep in the chase camera, and a four past a diving fielder, whose dive the replay must show too
if(any('field','throw','catch')){
  await startMode(page, 'nets', {netsW: 0, planet: 'earth'});
  const fp = {};
if(on('field')){
  for (const k of ['edge', 'ring', 'deep']) fp[k] = await fieldPlay(page, 'earth-field-' + k, PLAYS[k]);
  if (fp.deep) await catchReplay(page, 'earth-catch-replay-deep', 'field');
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
}
if(on('throw')){
  // batting: a ring stop and a diving stop throw to the bowler, taken before the next run-up (the dive's in the countdown: up to
  // 4 tries); a deep stop may not be thrown (it would land after the next run-up)
  for (const [k, play] of [['earth-throw', PLAYS.thr], ['earth-throw-dive', PLAYS.thrDive], ['earth-throw-deep', PLAYS.thrDeep]]) {
    let o = null, e = null;
    for (let n = 0; n < (k === 'earth-throw-dive' ? 4 : 1) && !(o && o.takePh === 'ready'); n++) {
      const e1 = await fieldPlay(page, k + '-stop', k === 'earth-throw-dive' ? {...play, opt: 1} : play);
      if (!e1) continue;
      e = e1; o = await throwCheck(page, k);
      if (o) o.after = ', ' + await (await page.waitForFunction(() => __t.S.phase === 'runup' ? 'still walking back at the run-up' : !__t.S.thr && 'both back before the run-up',
        null, {timeout: 30000, polling: 'raf'})).jsonValue();
    }
    if (!e && k === 'earth-throw-dive') errors.push(`throw ${k}: no diving stop came up`);
    if (e && !o && k !== 'earth-throw-deep') errors.push(`throw ${k}: none planned after ${playText(e)}`);
    if (o && k === 'earth-throw-dive' && o.takePh !== 'ready') errors.push(`throw ${k}: no diving stop's throw landed in the countdown (${thrText(o)})`);
    if (o && k === 'earth-throw-deep' && !['bounce', 'loop', 'flat'].includes(o.kind)) errors.push(`throw ${k}: a ${o.kind} throw from the deep`);
    console.log(`throw    ok  ${k}: ${thrText(o)}`);
  }
}
if(on('catch')){
  if (await fieldPlay(page, 'earth-catch-cordon', PLAYS.slipCatch)) await catchReplay(page, 'earth-catch-replay-cordon', 'close');
  if (await fieldPlay(page, 'earth-catch-cab', PLAYS.cab)) await catchReplay(page, 'earth-catch-replay-cab', 'cab');
  else console.log('replay   ok  (no caught and bowled came up in 4 balls)');
  // the last wicket caught: the replay, then the end screen
  await page.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 30000, polling: 20});
  await page.evaluate(() => { const M = __t.getM(); M.wktsMax = M.wkts + 1; });
  if (await fieldPlay(page, 'earth-catch-last', PLAYS.slipCatch)) { const nx = await catchReplay(page, 'earth-catch-replay-last', null);
    if (!await page.isVisible('#end')) errors.push(`catch replay of the last wicket: no end screen after it (${nx})`); }
}
  await page.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await page.waitForTimeout(100);
  if (await page.isVisible('#end')) await page.click('#menuBtn');
}
if(on('celebrate')){
  await startMode(page, 'quick', {planet: 'earth', len: 1});
  await page.click('#chaseBtn');
  await page.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 30000, polling: 30});
  // Reach the target before the next ball; the real result flow then ends the chase with a win. The ball is a ring stop: its throw
  // must not carry on into the celebration
  await page.evaluate(() => { const M = __t.getM(); M.runs = M.target; });
  if (await fieldPlay(page, 'earth-throw-last', PLAYS.thr)) {
    const t0 = await thrNow(page);
    await page.waitForFunction(() => !['flight', 'result'].includes(__t.S.phase), null, {timeout: 20000, polling: 'raf'});
    const c = await page.evaluate(() => ({ph: __t.S.phase, on: !!__t.S.thr}));
    if (c.on) errors.push(`throw on the winning ball: still on in ${c.ph}`);
    console.log(`throw    ok  winning ball: ${t0 ? 'throw planned, cleared at the ' + c.ph : 'no throw planned'}`);
  }
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
}
// ---------- replay2: the replay director's kinds beyond fours, sixes and catches (docs/replays.md) ----------
// Forced per kind: a delivery re-made until it is bowled, LBW, a shout not given, shaves off stump or (a batter charging the spinner)
// is stumped, with no swing; or a swing whose evalSwing is re-rolled (aim and power varied) until highlightOf gives the kind (drop,
// chance, save, leap). The replay must be that kind with its camera class; paused at the event (LBW: in the hold, the path drawn) the
// ball and the focus (the stumps, or the fielder) are on screen, camera parity holds, a screenshot; a tap skips it and play goes on.
// After a drop or a save the keeper is back at his stance, the bowler at his mark and no throw is left. Then the last wicket bowled
// (its replay, then the end screen), a bowled ball in the T20 bowling view and an LBW in landscape
const R2B = {
  bowled: "b.onStumps&&!padHit(b,null)",
  lbw: "(h=>!!h&&padResult(b,h,false).out)(padHit(b,null))",
  shout: "b.onStumps&&(h=>!!h&&!padResult(b,h,false).out)(padHit(b,null))",
  shave: "!b.onStumps&&!padHit(b,null)&&(p=>{const x=Math.abs(p.x)-STUMP_HALF,y=p.y-STUMP_H;return p.x>0&&x>0&&x<=SHAVE&&y<=SHAVE||x<=0&&y>=0&&y<=SHAVE;})(ballPos(b,b.tStumps))",
  stumped: "!b.onStumps&&!padHit(b,{x:0,z:1.5})"
};
const R2S = {
  dropClose: {kind: 'drop', cls: 'close', sw: {aim: 20, edge: 1}},
  dropDeep: {kind: 'drop', cls: 'field', field: 1, opt: 1, sw: {aim: 10, power: 0.5, loft: 1}, vary: {aim: 60, pw: 0.6}},
  save: {kind: 'save', cls: 'field', field: 1, sw: {aim: 8, power: 1}, vary: {aim: 40, pw: 0.5}},
  chance: {kind: 'chance', opt: 1, sw: {aim: 30, power: 0.8, loft: 1}, vary: {aim: 160, pw: 0.7}},
  leap: {kind: 'leap', cls: 'field', field: 1, opt: 1, sw: {aim: 10, power: 0.9, loft: 1}, vary: {aim: 50, pw: 0.7}}
};
// the next delivery (S.pending, in the countdown) re-made until it is the kind wanted; spin: the over turned to spin (keeper up)
const r2Ball = async (p, kind, spin) => {
  await p.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 30000, polling: 20});
  return p.evaluate(([pred, spin]) => { const S = __t.S, M = __t.getM(), want = new Function('b', 'return !b.wide&&' + pred);
    if (spin) { M.bowlerType = 'spin'; S.runupDur = 1.1; __t.fieldSet(M.field); }
    for (let i = 0; i < 60000; i++) { const b = makeDelivery({type: M.bowlerType, len: 'YFGSB'[i % 5], line: ['off', 'mid', 'leg', 'wide'][(i / 5 | 0) % 4]}, M.diff, M.spinDir);
      if (want(b)) { S.pending = b; return true; } }
    return false; }, [R2B[kind], !!spin]) && p.waitForFunction(() => __t.S.phase !== 'ready', null, {timeout: 30000, polling: 10}).then(() => true);
};
// a swing in this flight (as fieldPlay sets it) whose evalSwing is re-rolled until highlightOf gives the kind; true if it came up
const r2Shot = async (p, c) => {
  await p.waitForFunction(() => __t.S.phase === 'ready' || __t.S.phase === 'runup', null, {timeout: 30000, polling: 20});
  if (c.field) await p.evaluate(() => __t.fieldSet(tplField(Object.keys(TPL).find(k => TPL[k].f.includes('longoff') && TPL[k].f.includes('longon')))));
  await p.waitForFunction(() => __t.S.phase === 'flight', null, {timeout: 30000, polling: 10});
  await p.evaluate(([kind, vary, sw]) => {
    const ev0 = evalSwing; window.__fp = 0;
    window.evalSwing = (...a) => { window.evalSwing = ev0; const [b, s, , f] = a, s0 = {aim: s.aim, power: s.power};
      for (let i = 0; i < 8000; i++) {
        if (vary) { s.aim = s0.aim + (Math.random() - 0.5) * vary.aim; s.power = Math.min(1, Math.max(0.3, s0.power + (Math.random() - 0.5) * vary.pw)); }
        const r = ev0(...a), h = r.res && highlightOf(r.res, b, f, footAt(b, s.bp).c); if (h && h.kind === kind) { window.__fp = i + 1; return r; } }
      Object.assign(s, s0); return ev0(...a); };
    const S = __t.S, fa = footAt(S.ball, S.bpos), w = windows(__t.getM().diff, true, 1 + 0.35 * fa.gain);
    S.swing = {tc: fa.t + (sw.edge ? -(w.ok + w.edge) / 2 : 0.002), aim: sw.aim, power: sw.power || 0.8, lofted: !!sw.loft, defend: false, done: false};
    S.bat = {mode: 'swing', t0: S.ball.start + S.swing.tc - SWING_DELAY, from: null, aim: sw.aim}; }, [c.kind, c.vary || null, c.sw]);
  await p.waitForFunction(() => __t.S.phase !== 'flight' && __t.S.phase !== 'runup', null, {timeout: 30000, polling: 10});
  return p.evaluate(() => window.__fp > 0);
};
const r2Check = async (p, name, kind, cls) => {
  const r = await p.waitForFunction(() => __t.S.phase === 'replay' ? 'replay' : !['result', 'flight', 'runup'].includes(__t.S.phase) && __t.S.phase, null, {timeout: 20000, polling: 20}).then(h => h.jsonValue());
  const lab = await p.evaluate(() => __t.S.res ? __t.S.res.label + ', ' + (__t.S.res.sub || '') : '');
  if (r !== 'replay') { errors.push(`replay2 ${name}: no replay, went to ${r} (${lab})`); return null; }
  const R = await p.evaluate(() => { const R = __t.rp(); return {kind: R.kind, cls: R.cls, tk: R.tk, rec: __t.rec(), i: R.ct ? R.ct.i : -1, n: R.ct ? __t.getM().field[R.ct.i].n || '' : ''}; });
  if (R.kind !== kind || (cls ? R.cls !== cls : !['close', 'cab', 'field'].includes(R.cls))) errors.push(`replay2 ${name}: ${R.kind} replay with the ${R.cls} camera, expected ${kind} with ${cls || 'a catch class'}`);
  if (!(R.rec.n < R.rec.max)) errors.push(`replay2 ${name}: the recording hit its budget (${R.rec.n} of ${R.rec.max} frames)`);
  await p.waitForFunction(() => { const R = __t.rp(); if (R && (R.t < R.tk || R.hold && R.hu < 0.45)) return false; __t.S.paused = true; return true; }, null, {timeout: 20000, polling: 'raf'});
  await p.waitForTimeout(150);
  const s = await p.evaluate(i => { const on = q => !!q && q.x >= 0 && q.x <= innerWidth && q.y >= 0 && q.y <= innerHeight, b = __t.vb().b, f = i >= 0 && __t.fv()[i];
    return {ph: __t.S.phase, ball: !!b && on(__t.pj(b.x, b.y, b.z)), focus: on(f ? __t.pj(f.x, 1, f.z) : __t.pj(0, 0.4, 0)), par: __t.cam3()}; }, R.i);
  await p.screenshot({path: `${shots}replay2-${name}.png`});
  await p.evaluate(() => { __t.S.paused = false; });
  camErr = Math.max(camErr, s.par); if (!(s.par < 0.5)) errors.push(`camera parity replay2 ${name}: ${s.par} px`);
  if (s.ph !== 'replay' || !s.ball || !s.focus) errors.push(`replay2 ${name}: at the event ${JSON.stringify(s)}`);
  const vp = p.viewportSize();
  if (await p.evaluate(() => __t.S.phase === 'replay')) { await p.waitForFunction(() => __t.S.phase !== 'replay' || __t.clk() - __t.rp().t0 >= 0.3, null, {timeout: 5000}); await p.mouse.click(vp.width / 2, vp.height * 0.6); }
  const nx = await p.waitForFunction(() => __t.S.phase !== 'replay' && __t.S.phase, null, {timeout: 3000, polling: 20}).then(h => h.jsonValue()).catch(() => 'replay');
  if (nx === 'replay') errors.push(`replay2 ${name}: a tap did not skip it`);
  console.log(`replay2  ok  ${name}: ${R.kind}, ${R.cls} camera${R.n ? ' on ' + R.n : ''} (${lab}), ball and ${R.n ? 'fielder' : 'stumps'} on screen ${s.ball && s.focus}, then ${nx}`);
  return {...R, nx};
};
// after a drop or save (a throw may have been planned): the next ball's countdown with the keeper at his stance, the bowler at his mark
const r2After = async (p, name) => {
  await p.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 20000, polling: 20});
  await p.waitForTimeout(100);
  const k = await p.evaluate(() => { const M = __t.getM(), f = __t.fv().find(f => f.kp), K = KEEP[M.bowlerType] || KEEP.pace;
    return {thr: !!__t.S.thr, d: f ? Math.hypot(f.x - K.x, f.z - K.z) : -1, bz: __t.S.bowlerZ, mark: M.bowlerType === 'pace' ? 28.5 : 23.3}; });
  if (k.thr || !(k.d >= 0 && k.d < 0.05) || Math.abs(k.bz - k.mark) > 0.01) errors.push(`replay2 ${name}: next ball not set up ${JSON.stringify(k)}`);
};
if(on('replay2')){
if (planets.includes('earth')) {
  if (await page.isVisible('#end')) await page.click('#menuBtn');
  await startMode(page, 'nets', {netsW: 0, planet: 'earth'});
  for (const k of ['bowled', 'lbw', 'shout', 'shave', 'stumped']) {
    if (!await r2Ball(page, k, k === 'stumped')) { errors.push(`replay2 ${k}: no such delivery in 60000`); continue; }
    if (k === 'stumped') {
      await page.waitForFunction(() => __t.S.phase === 'flight', null, {timeout: 30000, polling: 10});
      await page.evaluate(() => { Object.assign(__t.S.bpos, {x: 0, z: 1.5}); const st0 = stumpedResult;
        window.stumpedResult = (b, bp) => { window.stumpedResult = st0; const r = Math.random; Math.random = () => 0; try { return st0(b, bp); } finally { Math.random = r; } }; });
    }
    await r2Check(page, k, k, k === 'stumped' ? 'crease' : 'stumps');
  }
  for (const [k, c] of Object.entries(R2S)) {
    let done = false;
    for (let n = 0; n < 4 && !done; n++) {
      if (!await r2Shot(page, c)) continue;
      const r = await r2Check(page, k, c.kind, c.cls);done = true;
      if (r && (c.kind === 'drop' || c.kind === 'save')) await r2After(page, k);
    }
    if (!done) { if (c.opt) console.log(`replay2  ok  (no ${k} came up in 4 balls)`); else errors.push(`replay2 ${k}: did not come up in 4 balls`); }
  }
  // the last wicket bowled: its replay, then the end screen
  await page.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 30000, polling: 20});
  await page.evaluate(() => { const M = __t.getM(); M.wktsMax = M.wkts + 1; });
  if (await r2Ball(page, 'bowled')) { const r = await r2Check(page, 'last-bowled', 'bowled', 'stumps');
    if (r && !await page.isVisible('#end')) errors.push(`replay2 last wicket: no end screen after its replay (${r.nx})`); }
  if (await page.isVisible('#end')) await page.click('#menuBtn');
  // T20 bowling view: the AI batter leaves a ball that hits the stumps
  await page.evaluate(() => localStorage.removeItem('cc_t20'));
  await startMode(page, 't20', {planet: 'earth'});
  await page.click('#chaseBtn');
  await page.waitForFunction(() => __t.S.phase === 'pick', null, {timeout: 30000, polling: 30});
  await page.click('#opGo');
  await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
  await page.evaluate(() => { __t.S.t = Math.max(__t.S.t, __t.S.breakDur - 0.1); });
  await page.waitForFunction(() => __t.S.phase === 'ready', null, {timeout: 30000, polling: 30});
  await page.evaluate(() => { const bd0 = bowlDelivery, ab = aiBat;
    window.bowlDelivery = (bw, o, m, rel, d) => { window.bowlDelivery = bd0; const mm = spotFor(bw, o, 5.4, 0);
      for (let i = 0; i < 20000; i++) { const b = bd0(bw, o, mm, 0, d); if (b.onStumps && !b.wide && !padHit(b, null)) return b; } return bd0(bw, o, m, rel, d); };
    window.aiBat = () => { window.aiBat = ab; return {leave: true, bp: null}; }; });
  await page.click('#bowlBtn');
  await r2Check(page, 't20-bowl-bowled', 'bowled', 'stumps');
  await page.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await page.waitForTimeout(100);
  if (await page.isVisible('#end')) await page.click('#menuBtn');
  // landscape: an LBW, the projection drawn in the hold
  const land = await browser.newPage({viewport: {width: 844, height: 390}});
  land.on('pageerror', e => errors.push('replay2 landscape: ' + (e.stack || String(e))));
  await land.goto(url);
  await startMode(land, 'nets', {netsW: 0, planet: 'earth'});
  if (await r2Ball(land, 'lbw')) await r2Check(land, 'landscape-lbw', 'lbw', 'stumps');
  await land.close();
}
}
if (planets.includes('earth')) {
if(any('t20bowl','t20chase')){
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
  const snap = () => page.evaluate(() => ({res: __t.S.res, swing: !!__t.S.swing, b: __t.bowl()}));
  const bowlOne = async (i, tap) => {
    // a throw runs into the next ball: this ball's result is read before it (r0), the throw's own checks after
    let thrLog = null, r0 = null, b = await toReady();
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
    // ball 7: the AI drives toward mid-off, who stops it and throws to the bowler (a direct hit, forced); ball 9: an AI drive fetched
    // in the deep on the off side, thrown to the keeper (the next ball waits for both)
    // ball 8: the AI lofts a drive, caught in the ring, which gets a replay
    if (i === 7) { await page.evaluate(() => { const ab = aiBat; window.aiBat = (st, b, f) => { window.aiBat = ab; const s = ab(st, b, f), fa = footAt(b, null);
      return {...s, leave: false, defend: false, lofted: true, aim: 25, power: 0.7, bp: null, tc: fa.t + 0.002}; }; }); await armPlay(page, PLAYS.aiCatch); }
    if (i === 6) { await page.evaluate(() => { const ab = aiBat; window.aiBat = (st, b, f) => { window.aiBat = ab; const s = ab(st, b, f), fa = footAt(b, null);
      return {...s, leave: false, defend: false, lofted: false, aim: 14, power: 0.8, bp: null, tc: fa.t + 0.002}; }; }); await armPlay(page, PLAYS.thrMid); }
    if (i === 8) { await page.evaluate(() => { const ab = aiBat; window.aiBat = (st, b, f) => { window.aiBat = ab; const s = ab(st, b, f), fa = footAt(b, null);
      return {...s, leave: false, defend: false, lofted: false, aim: 65, power: 1, bp: null, tc: fa.t + 0.002}; }; }); await armPlay(page, PLAYS.thrFetch); }
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
    if (i === 6) { const e = await fieldPlay(page, 'earth-t20-bowl-stop', {...PLAYS.thrMid, cam: null}, true); r0 = e && await snap(); const o = e && await throwCheck(page, 'earth-t20-bowl-throw', true);
      if (e && (!o || o.rv !== 'bw')) errors.push(`throw T20 bowling: mid-on/off stop thrown ${o ? 'to the keeper' : 'nowhere'} (${playText(e)})`);
      thrLog = [o, 'earth-t20-bowl-throw', `throw    ok  T20 bowling view: ${e ? '' : '(no stop by mid-on or mid-off came up)'}`]; }
    if (i === 8) { const e = await fieldPlay(page, 'earth-t20-bowl-fetch', {...PLAYS.thrFetch, cam: null}, true); r0 = e && await snap(); const o = e && await throwCheck(page, 'earth-t20-bowl-fetch-throw');
      if (e && (!o || o.rv !== 'kp')) errors.push(`throw T20 bowling: deep stop or fetch thrown ${o ? 'to the bowler' : 'nowhere'} (${playText(e)})`);
      thrLog = [o, 'earth-t20-bowl-fetch-throw', `throw    ok  T20 bowling view, deep ${e ? e.o || 'fetch' : ''}: ${e ? '' : '(no deep stop or fetch came up)'}`]; }
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
    const r = r0 || await snap();
    if (!f.ai.leave && !r.swing) errors.push('T20 bowling: the AI batter did not swing ' + JSON.stringify(f.ai));
    if (r.b.balls !== f.balls + (r.res.wide ? 0 : 1) || r.b.runs !== f.runs + r.res.runs || r.b.chips.split(' ').length !== (f.chips ? f.chips.split(' ').length + 1 : 1) && r.b.balls % 6)
      errors.push('T20 bowling: ball not recorded ' + JSON.stringify([f.balls, f.runs, f.chips, r.res.label, r.b.balls, r.b.runs, r.b.chips]));
    seenB.add(r.res.label + (f.ai.leave ? ' (left)' : f.ai.defend ? ' (blocked)' : ''));
    // a throw: the next ball waits for it (after this ball's own checks)
    if (thrLog) { const [o, n, t] = thrLog; if (o) await thrAfter(page, n, o); console.log(t + thrText(o)); }
    if (i === 7 && r.res.out && r.res.catcher != null) await catchReplay(page, 'earth-t20-bowl-catch-replay', null);
    else if (i === 7) console.log(`replay   ok  T20 bowling: no ring catch came up (${r.res.label})`);
    await page.waitForFunction(() => ['ready', 'pick', 'replay', 'break'].includes(__t.S.phase), null, {timeout: 30000, polling: 30});
    if (await page.evaluate(() => __t.S.phase === 'replay')) { await page.waitForTimeout(400); await page.mouse.click(195, 500); }
  };
  const seenB = new Set();
  const taps = [0, -0.2, null, 0.15, 'mouse', 0.05, -0.05, 0.3, 0];
if(on('t20bowl')){
  for (let i = 0; i < 9; i++) await bowlOne(i, taps[i]);
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
}
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
if(on('t20chase')){
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
}
}
if (planets.includes('earth')) {
if(any('scen','scenlast','scenstage','scensave')){
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

if(on('scen')){
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
}
if(on('scenlast')){

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
}
if(on('scenstage')){
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
}
if(on('scensave')){

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
}
}
if(on('land')&&!scenGood){
  // the portrait page starts a scenario, which writes the save the landscape menu shows (when the scen sections did not run)
  await page.reload();
  await openMode(page, 'scen');
  await page.click('#scenSeries .sctile');
  await page.click('#gPlay');
  await page.waitForFunction(() => __t.S.phase === 'break', null, {timeout: 30000, polling: 30});
  scenGood = await page.evaluate(() => localStorage.getItem('cc_scensave'));
}
if(any('land','landt20'))
{
  // Landscape phone: its own layout and camera framing. A run-up and a forced shot, with camera parity in both.
  const land = await browser.newPage({viewport: {width: 844, height: 390}});
  land.on('pageerror', e => errors.push('landscape: ' + (e.stack || String(e))));
  await land.goto(url);
if(on('land')){
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
  await land.evaluate(() => { __t.getM().wktsMax = Infinity; });
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
  { const e = await fieldPlay(land, 'landscape-throw-stop', PLAYS.thr), o = e && await throwCheck(land, 'landscape-throw');
    console.log(`land     ok  throw: ${thrText(o)}`); }
  if (await fieldPlay(land, 'landscape-catch-cordon', PLAYS.slipCatch)) await catchReplay(land, 'landscape-catch-replay', 'close');
  // T20 in the phone layout: the slab (with the batters) stays in its column above the stick, and the pause scorecard
  await land.evaluate(() => { __t.S.paused = true; document.querySelector('#quitBtn').click(); });
  await land.waitForTimeout(100);
  if (await land.isVisible('#end')) await land.click('#menuBtn');
}
if(on('landt20')){
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
}
  await land.close();
}
if(on('sizes'))
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
// Characters (docs/characters.md, Gates): five Earth sequences played by the character lab's runner (tests/charlab/runner.js) on a
// page of their own (__lab steps the game at 120 Hz on a lab clock, seeded), every frame reduced from __lab.frame({caps, verts}), and
// the lab's own gates (tests/charlab/metrics.mjs, thresholds.json: nothing loosened here) asserted for the subject of each: the batter
// in the stance and a cover drive (impact pose exact, contact, skinning, bat speed through the ball), the diver, a cordon catcher, the
// thrower of a stop. KNOWN lists the gates still red at the wrap-up (docs/characters.md, As built: open findings): they are printed,
// not failed, so this section is a ratchet; delete an entry once its finding is fixed. A shot per phase in tests/screenshots/chars-*.
if(on('chars')){
  const CM = await import('./charlab/metrics.mjs'), LAB = new URL('./charlab/', import.meta.url), rd = f => JSON.parse(readFileSync(new URL(f, LAB), 'utf8'));
  const TH = rd('thresholds.json'), SQ = rd('sequences.json'), seq = (g, id, o) => ({...SQ[g], ...SQ[g].seqs.find(s => s.id === id), seqs: undefined, group: g, ...o});
  const DEF = {keys: [['top', 'swing-0.05'], ['impact', 'impact'], ['follow', 'impact+0.15'], ['finish', 'impact+0.45']], end: 'impact+0.8'};
  const CHARS = [
    {name: 'stance', spec: seq('batter', 'bat-stance'), who: 'bat', cam: 'gbat', at: 'stance'},
    {name: 'cover-drive', spec: seq('batter', 'bat-cover', DEF), who: 'bat', cam: 'gside', at: 'impact'},
    {name: 'dive', spec: seq('fielding', 'fld-dive'), who: 'play', cam: 'gchase', at: 'hands'},
    {name: 'cordon-catch', spec: seq('fielding', 'fld-edge', {play: {pred: "r.out&&r.catcher!=null&&/^(keeper|slip|gully)/.test(f[r.catcher].n)", key: "e=>e.o==='catch'"},
      keys: [['edge', 'contact+0.05'], ['catch', 'play'], ['after', 'play+0.4']], end: 'play+0.9'}), who: 'play', cam: 'gcord', at: 'catch'},
    {name: 'throw', spec: seq('fielding', 'fld-stop-throw', {subject: 'thrower'}), who: 'thrower', cam: 'w10', at: 'release'}];
  // red at the wrap-up (2026-10-17; values re-taken after fix pass 4, the fixed ones removed), per sequence: gate id with the subject's name replaced by its role (bat, play, thrower) -> [open finding (B/H/M label in
  // tests/charlab/reviews/round-3.md), value then]. A known gate fails again when it gets worse: more than 1.2x its excess over the
  // limit + 5 mm (the lab is seeded, so an unchanged build repeats its values exactly)
  const KNOWN = {
    stance: {'pen:bat:torso-uarm': ['M8', .0437], 'pen:bat:handle-wrst': ['M2', .0154]},
    'cover-drive': {'pen:bat:torso-uarm': ['M8', .0913]},
    dive: {'slip:play': ['B4', .5094], 'slipTurn:play': ['B4', 1.7929], 'teleport:play': ['H5', .0988], 'teleportHand:play': ['H5', .2772],
      'pen:play:hand-torso': ['H5', .0913], 'pen:play:farm-torso': ['H5', .0833], 'pen:play:shin-thigh': ['M8', .1175]},
    'cordon-catch': {'slip:play': ['B4', .7637], 'pen:play:torso-uarm': ['M1', .0348], 'pen:play:shin-thigh': ['M8', .0434]},
    throw: {'slip:thrower': ['B4', .1025], 'pen:thrower:shin-thigh': ['M8', .0317], 'pen:thrower:thigh-uarm': ['M8', .0205]}};
  const worse = (g, v) => Math.abs(g.value - g.limit) > 1.2 * Math.abs(v - g.limit) + .005;
  const CAMS = rd('cameras.json'), cmScript = 'window.__cm=(()=>{' + readFileSync(new URL('metrics.mjs', LAB), 'utf8').replace(/^export /gm, '') + '\nreturn {V,wrap,segDist,penetration,reduce,pairKey};})();';
  const cp = await browser.newPage({viewport: {width: 390, height: 844}});
  cp.on('pageerror', e => errors.push('chars: ' + (e.stack || String(e))));
  await cp.addInitScript({content: cmScript}); await cp.addInitScript({content: readFileSync(new URL('runner.js', LAB), 'utf8')});
  await cp.goto(url);
  await cp.waitForFunction(() => __r.skin().on || __r.skin().err, null, {timeout: 15000, polling: 50}).catch(() => {});
  await cp.evaluate(() => { __lab.seed(7); __lab.on(); __lab.start({mode: 'nets', planet: 'earth', diff: 'medium'}); });
  const known = [];
  for (const c of CHARS) {
    const spec = {...c.spec, planet: 'earth', kit: 'ai', key: 'chars-' + c.name};
    await cp.evaluate(s => __run.begin(s), spec);
    let frames = [], A = null, impact = null, fail = null; const keys = [...spec.keys, ['end', spec.end]], seen = [];
    for (let ki = 0; ki < keys.length; ki++) { const [k, expr] = keys[ki], u = await cp.evaluate(e => __run.until(e), expr);
      if (u.reset) { frames = []; impact = null; seen.length = 0; }
      if (u.restart) { ki = -1; continue; }
      frames.push(...u.frames); A = u.A; if (u.impact) impact = u.impact;
      if (u.fail || u.skip) { fail = u.fail || u.skip; break; }
      if (!u.reached || k === 'end') { if (u.done) break; continue; }
      seen.push(k);
      for (const cid of ['q4', ...(k === c.at ? [c.cam] : [])]) {
        const v = await cp.evaluate(([cm, s]) => __run.view(cm, s), [CAMS[cid], spec.subject]); if (!v) continue;
        await cp.evaluate(() => __run.shot()); await cp.screenshot({path: `${shots}chars-${c.name}-${k}-${cid}.png`}); } }
    if (fail || !A) { errors.push(`chars ${c.name}: ${fail || 'no anchors'}`); continue; }
    const subj = c.who === 'bat' ? 'bat' : c.who === 'play' ? A.playN : A.thrI != null ? (A.fieldN[A.thrI] || 'f' + A.thrI) : null;
    if (!subj) { errors.push(`chars ${c.name}: no ${c.who} (play ${A.playN}, throw ${A.thrKind})`); continue; }
    const m = CM.seqMetrics(frames, A, spec, impact), all = CM.gates(m, TH, spec);
    const mine = all.filter(g => { const p = g.id.split(':'); return p[1] === subj || c.who === 'bat' && ['impactExact', 'contact', 'skinErr', 'batAV', 'batAxis'].includes(p[0]); });
    const role = id => id.split(':').map((x, i) => i === 1 && x === subj ? c.who : x).join(':');
    const red = mine.filter(g => !g.pass), kn = g => (KNOWN[c.name] || {})[role(g.id)], bad = red.filter(g => !kn(g) || worse(g, kn(g)[1]));
    for (const g of red) if (kn(g) && !worse(g, kn(g)[1])) known.push(`${c.name} ${g.id}=${g.value} (limit ${g.limit}; ${kn(g)[0]}, was ${kn(g)[1]})`);
    for (const g of bad) errors.push(`chars ${c.name}: ${role(g.id)} (${subj}) = ${g.value}, limit ${g.limit}${g.t != null ? ' at ' + (g.t - A.start).toFixed(2) + ' s' : ''}${kn(g) ? `, worse than at the wrap-up (${kn(g)[0]}: ${kn(g)[1]})` : ''}`);
    const play = A.playK ? `, ${A.playK} ${A.playO} by ${A.playN}` : '', thr = A.thrKind ? `, ${A.thrKind} throw to the ${A.thrRv}` : '';
    console.log(`chars    ${bad.length ? 'RED' : 'ok '} ${c.name}: ${frames.length} frames, phases ${seen.join(' ')}${play}${thr}; ${subj}: ${mine.length} gates, ${red.length - bad.length} known red${bad.length ? ', ' + bad.length + ' new red: ' + bad.map(g => role(g.id) + '=' + g.value).join(' ') : ''}`);
  }
  if (known.length) console.log('chars    known (open findings):\n  ' + known.join('\n  '));
  await cp.close();
}
await browser.close();
console.log(`\nsections ran: ${SECTIONS.filter(x => ran.has(x)).join(' ') || '(none)'}\nsections skipped: ${SECTIONS.filter(x => !ran.has(x)).join(' ') || '(none)'}${planets.includes('earth') ? '' : ' (replay to landt20 need earth in the planets)'}; ${((Date.now() - smokeT0) / 1000).toFixed(0)} s`);
if (errors.length) { console.log('\nPage errors:\n' + errors.join('\n')); process.exit(1); }
console.log(`\nNo page errors. Camera parity within ${camErr.toFixed(4)} px. Screenshots in tests/screenshots/`);
