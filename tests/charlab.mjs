// Character lab: drives the built game (dist/lab.html, #test: window.__lab) through the sequences in tests/charlab/sequences.json
// on every planet, shoots the cameras in cameras.json at each key, measures motion and contact metrics (metrics.mjs) against
// thresholds.json, and writes tests/charlab/out/<run>/: metrics.json, summary.md, shots/, sheets/ (labelled montages, failures
// outlined red), poses.json (drive vectors for tools/blender), pairs/ for --diff. Usage (npm run lab builds dist/lab.html first):
//   node tests/charlab.mjs [--quick] [--gates] [--seq a,b] [--species x,y] [--kit ai|you] [--run name] [--raw] [--list]
//   node tests/charlab.mjs --diff <runA> <runB>     before/after pairs and a metric delta table
//   node tests/charlab.mjs --baseline <run>         writes tests/charlab/baseline.json (gates and values) from that run; later
//                                                   summaries list the gates that are red now but were green there, and the reverse
// --quick: Earth only, the ai kit, no landscape. --gates: metrics only (no shots or sheets), exit 1 on a failed gate.
// LAB_DIST=dist/other.html points at another build.
import {chromium} from 'playwright';
import {readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join, dirname, basename} from 'node:path';
import * as CM from './charlab/metrics.mjs';
import {createHash} from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), lab = join(root, 'tests/charlab');
const argv = process.argv.slice(2), has = f => argv.includes(f), val = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const PLANETS = ['earth', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'neptune'];
const SEQ = JSON.parse(readFileSync(join(lab, 'sequences.json'), 'utf8')), CAMS = JSON.parse(readFileSync(join(lab, 'cameras.json'), 'utf8')), TH = JSON.parse(readFileSync(join(lab, 'thresholds.json'), 'utf8'));
// a scenario plays on its own planet (SCEN in src/logic.js)
const SCEN_PLANET = Object.fromEntries([...readFileSync(join(root, 'src/logic.js'), 'utf8').matchAll(/\{id:'([a-z0-9]+)',set:'[a-z]+',[^\n]*?planet:'([a-z]+)'/g)].map(m => [m[1], m[2]]));
const quick = has('--quick'), gatesOnly = has('--gates'), raw = has('--raw');
const onlySeq = val('--seq') ? val('--seq').split(',') : null, onlySp = val('--species') ? val('--species').split(',') : quick ? ['earth'] : null, onlyKit = val('--kit') || (quick ? 'ai' : null);
const TIMES = new Set(['start', 'release', 'pitch', 'tEnd', 'swing', 'impact', 'contact', 'f0', 'play', 'result', 'wind', 'thr', 'take', 'ready', 'cel']);
const DEFAULT_KEYS = [['top', 'swing-0.05'], ['impact', 'impact'], ['follow', 'impact+0.15'], ['finish', 'impact+0.45']];
// every sequence instance: group defaults under the sequence's own fields, one per planet and kit
function instances() {
  const out = [];
  for (const [gname, g] of Object.entries(SEQ)) { if (gname === '_') continue;
    for (const s of g.seqs) for (const pk0 of g.species === 'all' ? PLANETS : [g.species]) for (const kit of g.kits || ['ai']) {
      const needs = {...(g.needs || {}), ...(s.needs || {})}, pk = needs.mode === 'scen' ? SCEN_PLANET[needs.scen] || pk0 : pk0;
      const spec = {...g, ...s, seqs: undefined, group: gname, planet: pk, kit, needs};
      if (!spec.keys) spec.keys = DEFAULT_KEYS; if (!spec.end) spec.end = 'impact+0.8'; if (!spec.cams) spec.cams = g.cams;
      spec.needs.planet = spec.needs.mode === 'scen' ? null : pk;
      spec.key = `${s.id}__${pk}__${kit}`;
      if (onlySeq && !onlySeq.some(x => s.id === x || s.id.startsWith(x) || gname === x)) continue;
      if (onlySp && !onlySp.includes(pk)) continue;
      if (onlyKit && kit !== onlyKit) continue;
      if (quick && !g.quick) continue;
      out.push(spec);
      if (spec.land && !quick && !gatesOnly && pk === 'earth' && kit === 'ai') out.push({...spec, land: true, key: spec.key + '__land', cams: spec.cams.filter(c => CAMS[c].game)});
      spec.land = false;
    }
  }
  return out;
}
if (has('--list')) { for (const s of instances()) console.log(s.key + (s.land ? ' (landscape)' : '')); process.exit(0); }
if (has('--diff')) { await diff(argv[argv.indexOf('--diff') + 1], argv[argv.indexOf('--diff') + 2]); process.exit(0); }
if (has('--baseline')) { writeBaseline(val('--baseline')); process.exit(0); }
// the gate definitions (metrics.mjs and thresholds.json): runs and the baseline carry it, and a comparison across different
// definitions says so instead of listing gate changes as motion that broke or got fixed (docs/characters.md, Gates)
const GATES_VER = createHash('sha1').update(readFileSync(join(lab, 'metrics.mjs'))).update(readFileSync(join(lab, 'thresholds.json'))).digest('hex').slice(0, 8);
const BASE = existsSync(join(lab, 'baseline.json')) ? JSON.parse(readFileSync(join(lab, 'baseline.json'), 'utf8')) : null;

const runName = val('--run') || new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/(\d{8})(\d{4})/, '$1-$2') + (quick ? '-quick' : gatesOnly ? '-gates' : '');
const out = join(lab, 'out', runName); for (const d of ['shots', 'sheets', 'pairs', 'raw']) mkdirSync(join(out, d), {recursive: true});
const distFile = process.env.LAB_DIST || 'dist/lab.html', distPath = join(root, distFile);
if (!existsSync(distPath)) { console.error(`${distFile} missing: BUILD_OUT=${distFile} node build.mjs`); process.exit(2); }
const url = pathToFileURL(distPath).href + '#test';
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(4)}s]`, ...a);
const metricsSrc = readFileSync(join(lab, 'metrics.mjs'), 'utf8'), runnerSrc = readFileSync(join(lab, 'runner.js'), 'utf8');
const cmScript = 'window.__cm=(()=>{' + metricsSrc.replace(/^export /gm, '') + '\nreturn {V,wrap,segDist,penetration,reduce,pairKey};})();';
const seedScript = s => `(()=>{let a=${s}>>>0;Math.random=()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};})();`;

const browser = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files']});
const errors = [];
async function openPage(land) {
  const p = await browser.newPage({viewport: land ? {width: 844, height: 390} : {width: 390, height: 844}});
  p.on('pageerror', e => errors.push((land ? 'landscape: ' : '') + (e.stack || String(e))));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_NAME_NOT_RESOLVED|fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });
  await p.addInitScript(seedScript(7)); await p.addInitScript({content: cmScript}); await p.addInitScript({content: runnerSrc});
  await p.goto(url);
  await p.waitForFunction(() => __r.skin().on || __r.skin().err, null, {timeout: 15000, polling: 50}).catch(() => {});
  const sk = await p.evaluate(() => __r.skin()); if (!sk.on) errors.push('skinned batter: ' + sk.err);
  await p.evaluate(() => { __lab.seed(7); __lab.on(); });
  return Object.assign(p, {land, match: null});
}
const pages = {port: await openPage(false), land: null};
// the match a sequence needs: nets on its planet, or its scenario; a new one only when it differs (a fresh seed each time)
async function ensureMatch(p, spec) {
  const need = spec.needs, key = need.mode === 'scen' ? 'scen:' + need.scen : `nets:${need.planet}:${need.diff || 'medium'}`;
  if (p.match === key) return;
  await p.evaluate(([need, seed]) => { __lab.seed(seed); __lab.start(need); }, [need, 7 + PLANETS.indexOf(spec.planet)]);
  p.match = key; p.kit = null;
}
const shotName = (spec, key, cam) => `${spec.key}__${key}__${cam}.png`;
// one sequence instance: origin, then keys in order (shots per camera at each), the end, metrics
async function runSeq(p, spec) {
  await ensureMatch(p, spec);
  if (p.kit !== spec.kit) { await p.evaluate(k => __lab.kits(k), spec.kit); p.kit = spec.kit; }
  const r = {key: spec.key, id: spec.id, group: spec.group, planet: spec.planet, kit: spec.kit, land: !!spec.land, shots: [], keys: [], skipped: [], frames: 0, retries: 0};
  const b = await p.evaluate(spec => __run.begin(spec), spec);
  let origin = r.origin = b.origin, frames = [], impact = null, A = null;
  const keys = [...spec.keys, ['end', spec.end]];
  for (let ki = 0; ki < keys.length; ki++) { const [kname, expr] = keys[ki];
    const u = await p.evaluate(e => __run.until(e), expr);
    if (u.reset) { frames = []; r.shots = []; r.keys = []; r.retries = u.retry; impact = null; }
    // a later anchor never came (a forced play's throw): the next ball was set up, the keys start again
    if (u.restart) { ki = -1; continue; }
    frames.push(...u.frames); A = u.A; if (u.impact) impact = u.impact; if (A && A.start != null) origin = r.origin = A.start;
    if (u.fail) { r.fail = u.fail; break; }
    if (u.skip) { r.skipped.push(u.skip); break; }
    if (!u.reached) { r.skipped.push(kname); if (u.done) break; continue; }
    if (kname === 'end') break;
    r.keys.push({key: kname, t: +(u.t - origin).toFixed(3)});
    if (gatesOnly) continue;
    const poseKey = spec.subject === 'bat' ? await p.evaluate(() => __run.drive()) : null;
    if (poseKey) POSES[`${spec.key}@${kname}`] = poseKey;
    for (const cid of spec.cams) {
      const cam = CAMS[cid]; if (!cam) { errors.push(`camera ${cid} missing`); continue; }
      const v = await p.evaluate(([c, s]) => __run.view(c, s), [cam, spec.subject]);
      if (!v) { r.skipped.push(`${kname}/${cid}`); continue; }
      const info = await p.evaluate(() => __run.shot());
      const file = shotName(spec, kname, cid);
      await p.screenshot({path: join(out, 'shots', file)});
      // tris: the scene without the crowd (the crowd's instanced sectors are counted apart, crowd: its own budget, QT tiers)
      const tris = info.tris - (info.crowd || 0);
      r.shots.push({key: kname, cam: cid, file, t: +(u.t - origin).toFixed(3), subj: v.subj, calls: info.calls, tris, crowd: info.crowd || 0, gv: v.gv});
      if (cam.game) { const vk = cam.game === 'bowl' && spec.group === 'nonstriker' ? 'gbowlns' : cid, V = VIEWS[vk] || (VIEWS[vk] = {calls: 0, tris: 0, crowd: 0});
        if (info.calls > V.calls) { V.calls = info.calls; V.where = file; } if (tris > V.tris) { V.tris = tris; V.whereT = file; }
        if ((info.crowd || 0) > V.crowd) V.crowd = info.crowd; }
    }
  }
  r.frames = frames.length; r.t0 = frames.length ? +(frames[0].t - origin).toFixed(3) : 0; r.t1 = frames.length ? +(frames[frames.length - 1].t - origin).toFixed(3) : 0;
  r.anchors = A && Object.fromEntries(Object.entries(A).filter(([k, v]) => typeof v === 'number' && TIMES.has(k)).map(([k, v]) => [k, +(v - origin).toFixed(3)]));
  if (A) { r.res = A.res; r.play = A.playK ? {k: A.playK, o: A.playO, who: A.playN, fp: A.fp} : null; r.thr = A.thrKind ? {kind: A.thrKind, to: A.thrRv} : null; }
  if (spec.play && spec.swings) r.rates = (await p.evaluate(() => __run.state().rates)) || null;
  const m = CM.seqMetrics(frames, A || {fplay: []}, spec, impact);
  r.metrics = m; r.gates = CM.gates(m, TH, spec); r.impact = impact;
  if (raw) writeFileSync(join(out, 'raw', spec.key + '.json'), JSON.stringify({spec, frames, anchors: A}));
  // the celebration ends the match (end screen): the next sequence starts a fresh one
  if (spec.cel) p.match = null;
  const bad = r.gates.filter(g => !g.pass);
  log(`${spec.key.padEnd(34)} ${r.frames} frames, ${r.shots.length} shots, ${r.retries ? r.retries + ' retries, ' : ''}${r.skipped.length ? 'skipped ' + r.skipped.join(' ') + ', ' : ''}${r.fail ? 'FAIL ' + r.fail + ', ' : ''}${bad.length} red: ${bad.map(g => g.id + '=' + g.value).join(' ').slice(0, 160)}`);
  return r;
}
const VIEWS = {}, POSES = {}, results = [];
const list = instances();
log(`lab run ${runName}: ${list.length} sequences (${quick ? 'quick' : gatesOnly ? 'gates' : 'full'}) from ${distFile}`);
// planets in order, each planet's sequences together (one match per planet), landscape instances on their own page
for (const spec of list.sort((a, b) => PLANETS.indexOf(a.planet) - PLANETS.indexOf(b.planet) || (a.land ? 1 : 0) - (b.land ? 1 : 0) || (a.needs.scen || '').localeCompare(b.needs.scen || '') || a.kit.localeCompare(b.kit))) {
  const p = spec.land ? (pages.land || (pages.land = await openPage(true))) : pages.port;
  try { results.push(await runSeq(p, spec)); }
  catch (e) { errors.push(`${spec.key}: ${e.stack || e}`); log(`${spec.key}: ERROR ${e.message}`); results.push({key: spec.key, id: spec.id, planet: spec.planet, kit: spec.kit, land: !!spec.land, fail: String(e.message), gates: [], shots: [], keys: [], skipped: [], metrics: {}}); }
}
await pages.port.close(); if (pages.land) await pages.land.close();

// global gates: draw calls and triangles per game view, build size, GLB contracts
const global = [];
for (const [k, lim] of Object.entries(TH.draw)) if (VIEWS[k]) global.push({id: 'draw:' + k, value: VIEWS[k].calls, limit: lim, pass: VIEWS[k].calls <= lim, where: VIEWS[k].where});
for (const k in VIEWS) global.push({id: 'tris:' + k, value: VIEWS[k].tris, limit: TH.tris, pass: VIEWS[k].tris <= TH.tris, where: VIEWS[k].whereT});
const size = statSync(distPath).size; global.push({id: 'build', value: size, limit: TH.build, pass: size <= TH.build, where: distFile});
const glb = {};
for (const [name, c] of Object.entries(TH.glb)) { const f = join(root, 'src/models', name + '.glb');
  if (!existsSync(f)) { if (!c.optional) global.push({id: 'glb:' + name, value: 0, limit: 1, pass: false, where: 'missing'}); continue; }
  const g = glbCheck(f, c); glb[name] = g; for (const x of g.checks) global.push({id: `glb:${name}:${x.id}`, value: x.value, limit: x.limit, pass: x.pass, where: name + '.glb'}); }
const allGates = results.flatMap(r => r.gates.map(g => ({...g, seq: r.key}))).concat(global.map(g => ({...g, seq: 'global'})));
const red = allGates.filter(g => !g.pass);
const metrics = {run: runName, gatesVer: GATES_VER, date: new Date().toISOString(), args: argv, dist: distFile, build: size, seconds: +((Date.now() - T0) / 1000).toFixed(0), views: VIEWS, glb, global, seqs: results,
  summary: {sequences: results.length, failed: results.filter(r => r.fail).length, gates: allGates.length, red: red.length, byGate: byGate(allGates)}, baseline: vsBaseline(allGates), errors};
writeFileSync(join(out, 'metrics.json'), JSON.stringify(metrics, null, 1));
if (Object.keys(POSES).length) writeFileSync(join(out, 'poses.json'), JSON.stringify(POSES));
writeFileSync(join(out, 'summary.md'), summary(metrics));
if (!gatesOnly) await sheets(metrics);
await browser.close();
log(`done: ${results.length} sequences, ${allGates.length} gates, ${red.length} red${metrics.baseline ? metrics.baseline.stale ? ` (baseline ${metrics.baseline.run}: other gate definitions, not compared)` : ` (baseline ${metrics.baseline.run}: ${metrics.baseline.worse.length} newly red, ${metrics.baseline.better.length} fixed)` : ''}; ${errors.length} page errors; ${out}`);
if (errors.length) console.log('Page errors:\n' + errors.join('\n'));
if (gatesOnly && (red.length || errors.length)) process.exit(1);
if (errors.length) process.exit(1);

// the baseline: every gate's value and verdict per sequence, the global gates, the views (no shots or motion detail)
function writeBaseline(run) {
  const dir = existsSync(run) ? run : join(lab, 'out', run), m = JSON.parse(readFileSync(join(dir, 'metrics.json'), 'utf8'));
  const b = {run: m.run, gatesVer: m.gatesVer || null, date: m.date, dist: m.dist, build: m.build, seconds: m.seconds, summary: m.summary, views: m.views, global: m.global,
    seqs: m.seqs.map(r => ({key: r.key, fail: r.fail || null, frames: r.frames, res: r.res && r.res.label, play: r.play, retries: r.retries, skipped: r.skipped, gates: r.gates}))};
  writeFileSync(join(lab, 'baseline.json'), JSON.stringify(b).replace(/\{"key"/g, '\n{"key"') + '\n');
  console.log(`tests/charlab/baseline.json from ${m.run}: ${b.seqs.length} sequences, ${m.summary.gates} gates, ${m.summary.red} red`);
}
// gates against the baseline: red now and green there (regressions), green now and red there (fixed)
function vsBaseline(all) {
  if (!BASE) return null;
  if (BASE.gatesVer !== GATES_VER) return {run: BASE.run, stale: true, gatesVer: BASE.gatesVer || null, worse: [], better: [], red: BASE.summary.red};
  const prev = new Map(BASE.seqs.flatMap(r => r.gates.map(g => [r.key + '|' + g.id, g])).concat(BASE.global.map(g => ['global|' + g.id, g])));
  const worse = [], better = [];
  for (const g of all) { const p = prev.get(g.seq + '|' + g.id); if (!p) continue; if (!g.pass && p.pass) worse.push(g); if (g.pass && !p.pass) better.push(g); }
  return {run: BASE.run, worse, better, red: BASE.summary.red};
}
function byGate(all) { const o = {}; for (const g of all) { const k = g.id.replace(/:.*/, ''), x = o[k] || (o[k] = {total: 0, red: 0, worst: null}); x.total++; if (!g.pass) { x.red++; if (!x.worst || Math.abs(g.value - g.limit) > Math.abs(x.worst.value - x.worst.limit)) x.worst = {seq: g.seq, id: g.id, value: g.value, limit: g.limit}; } } return o; }
function summary(m) {
  const L = [`# Character lab: ${m.run}`, '', `${m.date}, ${m.seconds} s, ${m.dist} (${(m.build / 1024).toFixed(0)} KB). ${m.summary.sequences} sequences (${m.summary.failed} failed to run), ${m.summary.gates} gates, **${m.summary.red} red**, ${m.errors.length} page errors.`, '',
    `Gate definitions ${m.gatesVer} (metrics.mjs + thresholds.json). Rules worth knowing when reading the reds: the bowler's hands from 0.15 s before the release to 0.08 s after it are gated as releaseHand (no faster than the ball's release speed per frame; a faster hand is a snap, not a teleportHand); no slip while sliding (act 5); torso-uarm is measured with the armpit radius (a hanging arm touches the side, an arm through the chest is red); jumps under the game's camera cuts are kept as resetJump, not teleports. The countdown is always played.`, '',
    '## Gates by kind', '', '| gate | checks | red | worst |', '|---|---|---|---|'];
  for (const [k, x] of Object.entries(m.summary.byGate).sort((a, b) => b[1].red - a[1].red)) L.push(`| ${k} | ${x.total} | ${x.red} | ${x.worst ? `${x.worst.seq} ${x.worst.id} = ${x.worst.value} (limit ${x.worst.limit})` : ''} |`);
  if (m.baseline && m.baseline.stale) L.push('', `## Against the baseline (${m.baseline.run})`, '', `Not compared: the gate definitions changed since it was taken (${m.baseline.gatesVer || 'unversioned'} -> ${m.gatesVer}). Re-take it: \`node tests/charlab.mjs --baseline <run with these gates>\`.`);
  else if (m.baseline) { L.push('', `## Against the baseline (${m.baseline.run}, ${m.baseline.red} red)`, '', `Newly red: ${m.baseline.worse.length}; fixed: ${m.baseline.better.length}.`, '');
    for (const g of m.baseline.worse) L.push(`- **newly red** ${g.seq} ${g.id} = ${g.value} (limit ${g.limit})`);
    for (const g of m.baseline.better) L.push(`- fixed ${g.seq} ${g.id} = ${g.value} (limit ${g.limit})`); }
  L.push('', '## Global', '', '| gate | value | limit | pass | where |', '|---|---|---|---|---|');
  for (const g of m.global) L.push(`| ${g.id} | ${g.value} | ${g.limit} | ${g.pass ? 'ok' : '**red**'} | ${g.where || ''} |`);
  L.push('', '## Sequences', '', '| sequence | frames | shots | result | red gates |', '|---|---|---|---|---|');
  for (const r of m.seqs) { const bad = r.gates.filter(g => !g.pass); L.push(`| ${r.key} | ${r.frames} | ${r.shots.length} | ${r.fail ? 'FAIL ' + r.fail : (r.res ? r.res.label : '') + (r.play ? ' / ' + r.play.k + ' ' + r.play.o + ' by ' + r.play.who : '') + (r.skipped.length ? ' / skipped ' + r.skipped.join(' ') : '')} | ${bad.map(g => `${g.id}=${g.value}${g.t != null ? '@' + g.t.toFixed(2) : ''}`).join(', ')} |`); }
  L.push('', '## Sheets', '', ...m.seqs.filter(r => r.shots.length).map(r => `- [${r.key}](sheets/${r.key}.png)`), '');
  return L.join('\n');
}
// a sheet per sequence instance (rows: keys, columns: cameras) and one per group and camera (rows: instances at their main key);
// a figure is outlined red when a gate fails within 0.25 s of its time, or any timeless gate fails
async function sheets(m) {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  // timed gates outline the figures within 0.25 s; timeless ones (impact exactness, contact, bat speed, skinning) the impact key's
  const fig = (r, s, label) => { const t = s.t, red = r.gates.some(g => !g.pass && (g.t == null ? s.key === 'impact' : Math.abs(g.t - (r.origin + t)) < .25));
    return `<figure class="${red ? 'fail' : ''}"><img src="../shots/${s.file}" loading="eager"><figcaption>${label}</figcaption></figure>`; };
  const css = `body{margin:0;background:#1b1d22;color:#e8e8e8;font:12px/1.3 -apple-system,Helvetica,Arial,sans-serif}h1{font-size:16px;margin:10px 12px 6px}p{margin:0 12px 8px;color:#aaa}
    .row{display:flex;gap:6px;padding:4px 12px;align-items:flex-start}.row h2{writing-mode:vertical-rl;transform:rotate(180deg);font-size:12px;margin:0;color:#ccc;min-height:160px}
    figure{margin:0;width:170px;flex:none}figure img{width:170px;display:block;background:#333}figure.l img{width:300px}figure.l{width:300px}figcaption{padding:2px 6px;color:#bbb;font-size:10px;white-space:pre-wrap}
    figure.fail{outline:4px solid #e3312d;outline-offset:-4px}figure.fail figcaption{color:#ff8a86}`;
  for (const r of m.seqs) { if (!r.shots.length) continue;
    const keys = [...new Set(r.shots.map(s => s.key))], bad = r.gates.filter(g => !g.pass);
    let h = `<!doctype html><meta charset="utf-8"><style>${css}</style><h1>${r.key}${r.land ? ' (landscape 844x390)' : ''}</h1><p>${r.res ? r.res.label + (r.res.sub ? ', ' + r.res.sub : '') : ''}${r.play ? ' · ' + r.play.k + ' ' + r.play.o + ' by ' + r.play.who : ''}${r.thr ? ' · ' + r.thr.kind + ' throw to the ' + r.thr.to : ''} · ${r.frames} frames${r.retries ? ' · ' + r.retries + ' retries' : ''}<br>red: ${bad.map(g => `${g.id}=${g.value}${g.t != null ? '@' + (g.t - (r.origin || 0)).toFixed(2) + 's' : ''} (limit ${g.limit})`).join(', ') || 'none'}</p>`;
    for (const k of keys) { const ss = r.shots.filter(s => s.key === k); h += `<div class="row"><h2>${k} · ${ss[0].t.toFixed(2)} s</h2>` + ss.map(s => fig(r, s, `${CAMS[s.cam].label}${s.subj && s.subj !== 'bat' ? ' · ' + s.subj : ''} · ${s.calls} calls${CAMS[s.cam].game && s.gv && s.gv !== CAMS[s.cam].game && CAMS[s.cam].game !== 'bat' && CAMS[s.cam].game !== 'bowl' && CAMS[s.cam].game !== 'side' ? ' · game shows ' + s.gv : ''}`).replace('<figure class="', `<figure class="${r.land ? 'l ' : ''}`)).join('') + '</div>'; }
    writeFileSync(join(out, 'sheets', r.key + '.html'), h);
    await page.goto(pathToFileURL(join(out, 'sheets', r.key + '.html')).href); await page.screenshot({path: join(out, 'sheets', r.key + '.png'), fullPage: true}); }
  // overview sheets: per group and camera, every instance at its main key
  const groups = {}; for (const r of m.seqs) if (r.shots.length) (groups[r.group] || (groups[r.group] = [])).push(r);
  for (const [g, rs] of Object.entries(groups)) { const cams = [...new Set(rs.flatMap(r => r.shots.map(s => s.cam)))];
    for (const cid of cams) { const rows = rs.map(r => { const ks = r.shots.filter(s => s.cam === cid); if (!ks.length) return null; const main = ks.find(s => /^(impact|hands|catch|release|take|stance|idle|slide|top|orbit|duck|sway|flinch|backing)$/.test(s.key)) || ks[Math.min(1, ks.length - 1)]; return fig(r, main, `${r.key}\n${main.key} · ${main.t.toFixed(2)} s`); }).filter(Boolean);
      if (!rows.length) continue;
      const h = `<!doctype html><meta charset="utf-8"><style>${css}figure{width:150px}figure img{width:150px}</style><h1>${g} · ${CAMS[cid].label}</h1><div class="row" style="flex-wrap:wrap">${rows.join('')}</div>`;
      const name = `_${g}__${cid}`; writeFileSync(join(out, 'sheets', name + '.html'), h);
      await page.goto(pathToFileURL(join(out, 'sheets', name + '.html')).href); await page.screenshot({path: join(out, 'sheets', name + '.png'), fullPage: true}); } }
  await page.close();
}
// GLB contract: bones (names, parent-first, aim/ref extras), at most 4 influences, mesh and material names, triangle budget
function glbCheck(file, c) {
  const b = readFileSync(file), magic = b.readUInt32LE(0), len = b.readUInt32LE(12), j = magic === 0x46546C67 ? JSON.parse(b.subarray(20, 20 + len).toString()) : null;
  const checks = [], ck = (id, value, limit, pass) => checks.push({id, value, limit, pass});
  if (!j) { ck('parse', 0, 1, false); return {checks}; }
  const nodes = j.nodes || [], names = nodes.map(n => n.name), bones = c.bones || [];
  ck('bones', bones.filter(n => names.includes(n)).length, bones.length, bones.every(n => names.includes(n)));
  const noExtras = bones.filter(n => { const x = nodes.find(q => q.name === n); return !x || !x.extras || !x.extras.aim || !x.extras.ref; });
  ck('extras', bones.length - noExtras.length, bones.length, noExtras.length === 0);
  if (c.twist) ck('twist', c.twist.filter(n => names.includes(n)).length, c.twist.length, c.twist.every(n => names.includes(n)));
  // parent-first: every bone's parent appears before it in the skin's joint order
  const skin = (j.skins || [])[0], parentOf = {}; nodes.forEach((n, i) => (n.children || []).forEach(ch => parentOf[ch] = i));
  const order = skin ? skin.joints : []; ck('parentFirst', order.filter((ni, k) => parentOf[ni] == null || order.indexOf(parentOf[ni]) < k).length, order.length, order.every((ni, k) => parentOf[ni] == null || order.indexOf(parentOf[ni]) < k));
  let tris = 0, j1 = false; for (const mesh of j.meshes || []) for (const p of mesh.primitives) { tris += p.indices != null ? j.accessors[p.indices].count / 3 : j.accessors[p.attributes.POSITION].count / 3; if (p.attributes.JOINTS_1) j1 = true; }
  ck('influences', j1 ? 8 : 4, c.influences || 4, !j1); ck('tris', tris, c.maxTris, tris <= c.maxTris);
  const mats = (j.materials || []).map(x => x.name), meshes = (j.meshes || []).map(x => x.name);
  if (c.materials && c.materials.length) ck('materials', c.materials.filter(n => mats.includes(n)).length, c.materials.length, c.materials.every(n => mats.includes(n)));
  if (c.meshes && c.meshes.length) ck('meshes', c.meshes.filter(n => meshes.includes(n)).length, c.meshes.length, c.meshes.every(n => meshes.includes(n)));
  return {checks, tris, bytes: b.length, materials: mats, meshes, nodes: names.length};
}
// --diff A B: metric deltas per sequence and gate, and side-by-side pairs with a difference heat map for every shot in both runs
async function diff(a, b) {
  const dir = n => existsSync(n) ? n : join(lab, 'out', n), A = JSON.parse(readFileSync(join(dir(a), 'metrics.json'), 'utf8')), B = JSON.parse(readFileSync(join(dir(b), 'metrics.json'), 'utf8'));
  const outD = join(dir(b), 'pairs'); mkdirSync(outD, {recursive: true});
  const same = A.gatesVer && A.gatesVer === B.gatesVer;
  const L = [`# ${A.run} -> ${B.run}`, '', same ? `Gate definitions ${B.gatesVer} in both runs: like for like.` : `**Not like for like:** the gate definitions differ (${A.gatesVer || 'unversioned'} -> ${B.gatesVer || 'unversioned'}), so "broke" and "fixed" below also count gate changes. Re-run A with the current gates (or compare against a run taken with them).`, '',
    `red gates: ${A.summary.red} -> ${B.summary.red}; sequences ${A.summary.sequences} -> ${B.summary.sequences}`, '', '| sequence | gate | A | B | change |', '|---|---|---|---|---|'];
  const ga = new Map(A.seqs.flatMap(r => r.gates.map(g => [r.key + '|' + g.id, g]))), gb = new Map(B.seqs.flatMap(r => r.gates.map(g => [r.key + '|' + g.id, g])));
  for (const k of new Set([...ga.keys(), ...gb.keys()])) { const x = ga.get(k), y = gb.get(k); if (!x || !y) { L.push(`| ${k.split('|')[0]} | ${k.split('|')[1]} | ${x ? x.value : '-'} | ${y ? y.value : '-'} | ${x ? 'gone' : 'new'} |`); continue; }
    if (x.pass !== y.pass || Math.abs((x.value || 0) - (y.value || 0)) > 1e-3) L.push(`| ${k.split('|')[0]} | ${k.split('|')[1]} | ${x.value}${x.pass ? '' : ' red'} | ${y.value}${y.pass ? '' : ' red'} | ${x.pass === y.pass ? 'value' : y.pass ? '**fixed**' : '**broke**'} |`); }
  for (const g of B.global) { const x = A.global.find(q => q.id === g.id); if (x && (x.value !== g.value || x.pass !== g.pass)) L.push(`| global | ${g.id} | ${x.value}${x.pass ? '' : ' red'} | ${g.value}${g.pass ? '' : ' red'} | ${x.pass === g.pass ? 'value' : g.pass ? '**fixed**' : '**broke**'} |`); }
  writeFileSync(join(outD, 'diff.md'), L.join('\n') + '\n');
  const br = await chromium.launch({args: ['--allow-file-access-from-files']}), page = await br.newPage({viewport: {width: 1300, height: 900}});
  const shotsA = new Set(readdirSync(join(dir(a), 'shots'))), pairs = readdirSync(join(dir(b), 'shots')).filter(f => shotsA.has(f));
  // data URIs: file:// images are blocked on a setContent (about:blank) page, which left every pair blank and each waiting out its 5 s timeout
  const png = p => 'data:image/png;base64,' + readFileSync(p).toString('base64');
  const html = (f) => `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1b1d22;color:#ddd;font:12px sans-serif}div{display:flex;gap:8px;padding:8px}figure{margin:0}img,canvas{width:390px;display:block}figcaption{padding:2px}</style>
    <h3 style="margin:8px">${f}</h3><div><figure><img id="a" src="${png(join(dir(a), 'shots', f))}"><figcaption>A: ${A.run}</figcaption></figure><figure><img id="b" src="${png(join(dir(b), 'shots', f))}"><figcaption>B: ${B.run}</figcaption></figure><figure><canvas id="c"></canvas><figcaption id="d">diff</figcaption></figure></div>
    <script>Promise.all([a,b].map(i=>i.complete?1:new Promise(r=>i.onload=r))).then(()=>{const c=document.getElementById('c'),w=c.width=a.naturalWidth,h=c.height=a.naturalHeight,g=c.getContext('2d');const d=document.createElement('canvas');d.width=w;d.height=h;const q=d.getContext('2d');
    g.drawImage(a,0,0);const A=g.getImageData(0,0,w,h);q.drawImage(b,0,0);const B=q.getImageData(0,0,w,h);const O=g.createImageData(w,h);let n=0;for(let i=0;i<A.data.length;i+=4){const e=(Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]))/3;if(e>8)n++;O.data[i]=Math.min(255,e*4);O.data[i+1]=e>8?40:A.data[i+1]*.25;O.data[i+2]=A.data[i+2]*.25;O.data[i+3]=255;}
    g.putImageData(O,0,0);document.getElementById('d').textContent='diff: '+(100*n/(w*h)).toFixed(2)+'% of pixels changed';window.__done=1;});</script>`;
  for (const f of pairs) { await page.setContent(html(f)); await page.waitForFunction(() => window.__done, null, {timeout: 5000}).catch(() => {}); await page.screenshot({path: join(outD, f), fullPage: true}); }
  await br.close();
  console.log(`${pairs.length} pairs and diff.md in ${outD}`);
}
