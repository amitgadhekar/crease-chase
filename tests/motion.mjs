// Analytic tests over src/game/07-motion.js (loaded in node:vm, no DOM, no three). Usage: node tests/motion.mjs
// Exits 1 on the first failed check. Species gait parameters are read from src/game/07-people.js (st/lf/fq/fl per species).
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../src/game/07-motion.js', import.meta.url), 'utf8');
const ctx = {}; vm.createContext(ctx);
const MO = vm.runInContext(src, ctx);
if (!MO || typeof MO.gaitStep !== 'function') { console.error('07-motion.js did not evaluate to MO'); process.exit(1); }

const people = readFileSync(new URL('../src/game/07-people.js', import.meta.url), 'utf8');
const SP = {};
for (const m of people.matchAll(/^\s*(\w+):\{name:'[^']*'[^\n]*?st:([\d.]+),lf:([\d.]+),fq:([\d.]+),fl:([\d.]+)/gm)) SP[m[1]] = {st: +m[2], lf: +m[3], fq: +m[4], fl: +m[5]};
if (!SP.earth) SP.earth = {st: 1, lf: 1, fq: 1, fl: 0};

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.error('FAIL ' + msg); } };
const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b} (eps ${eps})`);
const fin = v => v.every(Number.isFinite);
// seeded RNG (mulberry32) so the random sets are the same every run
const prng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const DT = 1 / 120;

// ---- springs: no overshoot from rest, settles, the step is exact (dt-independent), angles go the short way
{
  const s = MO.springState(0); let mx = -1;
  for (let t = 0; t < 1; t += DT) { MO.spring(s, 1, DT, 20); mx = Math.max(mx, s.x); ok(s.x <= 1 + 1e-12, 'spring never overshoots'); }
  ok(Math.abs(s.x - 1) < 1e-6, 'spring settles (' + s.x + ')');
  let t95 = 0; const s2 = MO.springState(0); while (s2.x < .95) { MO.spring(s2, 1, DT, 20); t95 += DT; }
  near(t95, 4.74 / 20, .02, 'spring 95% at ~4.7/w');
  const a = MO.springState(0), b = MO.springState(0); a.v = b.v = 3;
  MO.spring(a, 1, 1 / 30, 20); for (let i = 0; i < 4; i++) MO.spring(b, 1, DT, 20);
  near(a.x, b.x, 1e-12, 'spring step composes exactly'); near(a.v, b.v, 1e-10, 'spring velocity composes');
  const an = MO.springState(3); for (let i = 0; i < 240; i++) MO.springA(an, -3, DT, 20);
  near(MO.wrap(an.x), -3, 1e-6, 'angle spring arrives'); ok(an.x > 3, 'angle spring went the short way through pi');
  const v = MO.springVState().set([1, 2, 3]); for (let i = 0; i < 240; i++) MO.springV(v, [0, 0, 0], DT, 20);
  ok(MO.len(v.x) < 1e-6, 'vector spring settles');
}

// ---- slerp: unit, endpoints exact, no NaN at 179 and 180 deg, turns on the hint side
{
  const o = new Float64Array(3), a = [0, 0, 1];
  for (const deg of [0, 1, 45, 90, 179, 179.99, 180]) {
    const r = deg * Math.PI / 180, b = [Math.sin(r), 0, Math.cos(r)];
    for (const t of [0, .25, .5, .75, 1]) { MO.slerp(o, a, b, t, [0, 1, 0]); ok(fin(o), `slerp ${deg} t=${t} finite`); near(MO.len(o), 1, 1e-9, `slerp ${deg} t=${t} unit`); }
    MO.slerp(o, a, b, 0, [0, 1, 0]); near(MO.dist(o, a), 0, 1e-9, `slerp ${deg} t=0 is a`);
    MO.slerp(o, a, b, 1, [0, 1, 0]); near(MO.dist(o, b), 0, 1e-9, `slerp ${deg} t=1 is b`);
  }
  MO.slerp(o, a, [0, 0, -1], .5, [0, 1, 0]); near(o[0], 1, 1e-9, 'opposite vectors turn about the hint axis (y: through +x)');
  MO.slerp(o, a, [0, 0, -1], .5, [1, 0, 0]); near(o[1], -1, 1e-9, 'opposite vectors turn about an x hint (through -y)');
  MO.slerp(o, a, [0, 0, -1], .5); ok(fin(o) && Math.abs(MO.len(o) - 1) < 1e-9 && Math.abs(o[2]) < 1e-9, 'opposite vectors without a hint still turn');
  MO.slerp(o, a, [0, 0, -1], .5, [0, 0, 1]); ok(fin(o) && Math.abs(MO.len(o) - 1) < 1e-9, 'a parallel hint is replaced');
  // continuity across the 179/180 boundary at the same t
  const p = new Float64Array(3); MO.slerp(p, a, [Math.sin(3.1407), 0, Math.cos(3.1407)], .5, [0, 1, 0]); MO.slerp(o, a, [Math.sin(3.1415), 0, Math.cos(3.1415)], .5, [0, 1, 0]);
  ok(MO.dist(o, p) < .05, 'slerp continuous near 180 deg (' + MO.dist(o, p).toFixed(4) + ')');
  // out aliasing a
  const al = Float64Array.from(a); MO.slerp(al, al, [1, 0, 0], .5); near(al[0], Math.SQRT1_2, 1e-9, 'slerp out may alias a');
}

// ---- arcs
{
  const o = new Float64Array(3), a = [0, 0, 0], b = [1, 0, 1];
  MO.arc(o, a, b, .2, 0); near(MO.dist(o, a), 0, 1e-12, 'arc starts at a'); MO.arc(o, a, b, .2, 1); near(MO.dist(o, b), 0, 1e-12, 'arc ends at b');
  MO.arc(o, a, b, .2, .5); near(o[1], .2, 1e-12, 'arc lifts by lift at its middle'); near(o[0], .5, 1e-12, 'arc middle over the chord');
  MO.bez3(o, a, [0, 1, 0], [1, 1, 1], b, .5); ok(fin(o), 'cubic finite');
  MO.arcTan(o, a, b, .2, .5); near(o[1], 0, 1e-12, 'arc tangent level at the top');
}

// ---- gait: zero slip of a planted foot on a straight run, per species stride; flight only when sprinting; feet off the
// ground never below it; stride matches the phase; turning keeps the lock; sidestep and backpedal never cross the feet
{
  const run = (sp, speed, secs, f = .3, forced = 0, turn = 0) => {
    const g = MO.gaitState(); MO.gaitReset(g, 0, 0, f);
    let x = 0, z = 0, maxSlip = 0, flight = 0, both = 0, minY = 9, swings = 0, maxStep = 0, land = [], cross = 0, maxDy = 0, prevFly = 0;
    const prev = [Float64Array.from(g.foot[0]), Float64Array.from(g.foot[1])], pst = [1, 1];
    let vx = Math.sin(f) * speed, vz = Math.cos(f) * speed; if (forced === MO.GM.back) { vx = -vx; vz = -vz; }
    if (forced === MO.GM.side) { vx = Math.cos(f) * speed; vz = -Math.sin(f) * speed; }
    for (let t = 0; t < secs; t += DT) {
      if (turn) { f += turn * DT; const sp2 = Math.hypot(vx, vz); vx = Math.sin(f) * sp2; vz = Math.cos(f) * sp2; }
      x += vx * DT; z += vz * DT;
      MO.gaitStep(g, x, z, f, vx, vz, DT, sp, forced);
      for (let i = 0; i < 2; i++) {
        if (g.st[i] && pst[i]) maxSlip = Math.max(maxSlip, MO.dist(g.foot[i], prev[i]) / DT);
        if (!g.st[i] && pst[i]) swings++;
        if (g.st[i] && !pst[i]) land.push([g.foot[i][0], g.foot[i][2]]);
        minY = Math.min(minY, g.foot[i][1]); pst[i] = g.st[i]; prev[i].set(g.foot[i]);
      }
      if (!g.st[0] && !g.st[1]) flight++;
      if (g.st[0] && g.st[1]) both++;
      const rx = Math.cos(f), rz = -Math.sin(f), d = (g.foot[1][0] - g.foot[0][0]) * rx + (g.foot[1][2] - g.foot[0][2]) * rz; if (d < .04) cross++;
      maxDy = Math.max(maxDy, Math.abs(g.fly - prevFly)); prevFly = g.fly;
      for (const k of ['pelvis', 'arm', 'foot']) for (const v of (k === 'foot' ? g.foot : [g[k]])) ok(fin(v), 'gait ' + k + ' finite');
    }
    for (let i = 1; i < land.length; i++) maxStep = Math.max(maxStep, Math.hypot(land[i][0] - land[i - 1][0], land[i][1] - land[i - 1][1]));
    return {g, maxSlip, flight, both, minY, swings, maxStep, cross, maxDy, frames: Math.round(secs / DT)};
  };
  for (const [k, sp] of Object.entries(SP)) for (const speed of [1.2, 3, 7]) {
    const r = run(sp, speed, 6);
    ok(r.maxSlip < 1e-9, `${k} ${speed} m/s: planted foot slip ${r.maxSlip}`);
    ok(r.minY >= -1e-12, `${k} ${speed} m/s: feet never below ground (${r.minY})`);
    ok(r.swings >= 4, `${k} ${speed} m/s: steps taken (${r.swings})`);
    const stride = r.g.stride, steps = r.swings / 6 / 2, expect = speed / stride;
    near(steps, expect, expect * .25 + .2, `${k} ${speed} m/s: cadence ${steps.toFixed(2)} strides/s vs ${expect.toFixed(2)} (stride ${stride.toFixed(2)} m)`);
    if (speed >= 7) ok(r.flight > 0, `${k} sprint has a flight phase (${r.flight} frames)`);
    if (speed <= 1.2) ok(r.flight === 0 && r.both > 0, `${k} walk has double support (${r.both}) and no flight (${r.flight})`);
    ok(r.maxStep < stride * .75 + .1, `${k} ${speed} m/s: step length ${r.maxStep.toFixed(2)} within the stride ${stride.toFixed(2)}`);
    ok(r.maxDy < .02, `${k} ${speed} m/s: body height continuous (${r.maxDy.toFixed(4)} per frame)`);
  }
  // a species' fq is a cadence multiplier: at the same speed, twice the cadence means half the stride
  { const q = run({st: 1, lf: 1, fq: 2, fl: 0}, 3, 3), e = run(SP.earth, 3, 3); near(q.g.stride, e.g.stride / 2, 1e-9, 'species fq halves the stride'); ok(q.swings > e.swings * 1.5, `species fq doubles the cadence (${q.swings} vs ${e.swings} steps)`); }
  // turning run: locks still hold; idle: nothing moves; sidestep and backpedal keep the feet apart; mode detection
  const rt = run(SP.earth, 3, 6, .3, 0, .8); ok(rt.maxSlip < 1e-9, 'turning run: planted foot slip ' + rt.maxSlip);
  const rs = run(SP.earth, 2, 6, 0, MO.GM.side); ok(rs.cross === 0, 'sidestep: feet never cross (' + rs.cross + ' frames)'); ok(rs.maxSlip < 1e-9, 'sidestep slip');
  const rb = run(SP.earth, 1.5, 6, 0, MO.GM.back); ok(rb.cross === 0, 'backpedal: feet never cross'); ok(rb.maxSlip < 1e-9, 'backpedal slip'); ok(rb.swings >= 4, 'backpedal steps');
  const g = MO.gaitState(); MO.gaitReset(g, 1, 2, .5); const f0 = Float64Array.from(g.foot[0]), f1 = Float64Array.from(g.foot[1]);
  for (let i = 0; i < 120; i++) MO.gaitStep(g, 1, 2, .5, 0, 0, DT, SP.earth);
  ok(MO.dist(g.foot[0], f0) === 0 && MO.dist(g.foot[1], f1) === 0 && g.mode === MO.GM.idle, 'idle: feet stay, mode idle');
  MO.gaitStep(g, 1, 2, .5, Math.sin(.5) * 1.2, Math.cos(.5) * 1.2, DT, SP.earth); ok(g.mode === MO.GM.walk, 'mode walk');
  MO.gaitStep(g, 1, 2, .5, Math.sin(.5) * 3, Math.cos(.5) * 3, DT, SP.earth); ok(g.mode === MO.GM.jog, 'mode jog');
  MO.gaitStep(g, 1, 2, .5, Math.sin(.5) * 7, Math.cos(.5) * 7, DT, SP.earth); ok(g.mode === MO.GM.sprint, 'mode sprint');
  MO.gaitStep(g, 1, 2, .5, -Math.sin(.5) * 1.5, -Math.cos(.5) * 1.5, DT, SP.earth); ok(g.mode === MO.GM.back, 'mode backpedal');
  MO.gaitStep(g, 1, 2, .5, Math.cos(.5) * 2, -Math.sin(.5) * 2, DT, SP.earth); ok(g.mode === MO.GM.side, 'mode sidestep');
  // stopping mid-swing: the swinging foot still lands
  const gs = MO.gaitState(); MO.gaitReset(gs, 0, 0, 0); let z = 0;
  for (let i = 0; i < 60; i++) { z += 2 * DT; MO.gaitStep(gs, 0, z, 0, 0, 2, DT, SP.earth); }
  for (let i = 0; i < 60; i++) MO.gaitStep(gs, 0, z, 0, 0, 0, DT, SP.earth);
  ok(gs.st[0] && gs.st[1] && gs.foot[0][1] === 0 && gs.foot[1][1] === 0, 'a stop lands the swinging foot');
  // arm swing and pelvis yaw are antisymmetric cues of bounded size
  const ga = run(SP.earth, 3, 3).g; ok(Math.abs(ga.arm[0] + ga.arm[1]) < 1e-9 && Math.abs(ga.pelvis[2]) <= .2 && Math.abs(ga.sh) <= .3, 'arm swing antisymmetric, yaws bounded');
}

// ---- anchors: a standing turn steps one foot at a time, the other stays planted; the feet end up in the new stance
{
  const a = MO.anchorsState(); MO.anchorsReset(a, 0, 0, 0, .12);
  let bothUp = 0, slip = 0, steps = 0; const prev = [Float64Array.from(a.foot[0]), Float64Array.from(a.foot[1])], pst = [1, 1];
  for (let t = 0; t < 3; t += DT) {
    const f = Math.min(Math.PI / 2, t * 2); MO.anchorsStep(a, 0, 0, f, DT, {w: .12});
    if (!a.st[0] && !a.st[1]) bothUp++;
    for (let i = 0; i < 2; i++) { if (a.st[i] && pst[i]) slip = Math.max(slip, MO.dist(a.foot[i], prev[i]) / DT); if (!a.st[i] && pst[i]) steps++; pst[i] = a.st[i]; prev[i].set(a.foot[i]); }
    ok(fin(a.foot[0]) && fin(a.foot[1]), 'anchors finite');
  }
  ok(bothUp === 0, 'anchors: one foot at a time'); ok(slip < 1e-9, 'anchors: planted foot slip ' + slip); ok(steps >= 2 && steps <= 4, 'anchors: a 90 deg turn takes 2-4 steps (' + steps + ')');
  ok(a.st[0] && a.st[1], 'anchors: settled');
  const rx = Math.cos(Math.PI / 2), rz = -Math.sin(Math.PI / 2);
  near(a.foot[0][0] * rx + a.foot[0][2] * rz, -.12, .02, 'anchors: left foot on the left of the new facing'); near(a.foot[1][0] * rx + a.foot[1][2] * rz, .12, .02, 'anchors: right foot on the right');
  near(MO.wrap(a.yaw[0] - Math.PI / 2), 0, .1, 'anchors: feet turned to the facing');
  // split-step: both feet up and down, a little wider, then planted
  MO.anchorsSplit(a); let up = 0, maxH = 0; for (let t = 0; t < .5; t += DT) { MO.anchorsStep(a, 0, 0, Math.PI / 2, DT, {w: .12}); if (a.air) up++; maxH = Math.max(maxH, a.foot[0][1], a.foot[1][1]); }
  ok(up > 10 && up < 40 && maxH > .03 && a.foot[0][1] === 0 && a.st[0] && a.st[1], `split-step: ${up} frames in the air, ${maxH.toFixed(3)} m high, lands planted`);
  ok(Math.abs(a.foot[1][0] * rx + a.foot[1][2] * rz - (a.foot[0][0] * rx + a.foot[0][2] * rz)) > .27, 'split-step lands wider');
}

// ---- ikS: a pole sweeping through the limb's axis never flips the joint; plain ik does
{
  const st = MO.ikState(), o = new Float64Array(3), p = new Float64Array(3), a = [0, 1, 0], t = [0, .3, 0];
  let maxJump = 0, plainJump = 0, prev = null, pprev = null;
  for (let i = 0; i <= 400; i++) {
    const th = (i / 400) * Math.PI; // the pole swings from +z through the axis (-y) to -z
    const pole = [0, -Math.sin(th) * .4 - .6, Math.cos(th)]; // passes within .4 of the axis direction, through it at th=pi/2 (x=z=0)
    const pole2 = [Math.sin(th) * 0, pole[1], Math.cos(th)];
    MO.ikS(st, o, a, t, .43, .43, pole2, DT); ok(fin(o), 'ikS finite');
    MO.ik(p, a, t, .43, .43, pole2);
    if (prev) { maxJump = Math.max(maxJump, MO.dist(o, prev)); plainJump = Math.max(plainJump, MO.dist(p, pprev)); }
    prev = Float64Array.from(o); pprev = Float64Array.from(p);
    near(MO.dist(o, a), .43, 1e-9, 'ikS thigh length'); near(MO.dist(o, t), .43, 1e-9, 'ikS shin length');
  }
  ok(maxJump < 14 * DT * .43 + 1e-9, 'ikS joint moves at most rate*dt per frame (' + maxJump.toFixed(4) + ')');
  ok(plainJump > .3, 'plain ik flips across the pole crossing (' + plainJump.toFixed(3) + ') so the test is meaningful');
  // it still follows a pole that stays clear of the axis
  const s2 = MO.ikState(); MO.ikS(s2, o, a, t, .43, .43, [0, 0, 1]); for (let i = 0; i < 120; i++) MO.ikS(s2, o, a, t, .43, .43, [1, 0, 0], DT);
  ok(o[0] > .2 && Math.abs(o[2]) < 1e-6, 'ikS converges to a new pole side');
  // reach capped: a target beyond the limb keeps the bone lengths
  MO.ik(p, a, [0, -2, 0], .43, .43, [0, 0, 1]); near(MO.dist(p, a), .43, 1e-9, 'ik reach cap keeps the thigh');
}

// ---- ground, look, capsules
{
  const p = [0, -.03, 0]; near(MO.clampGround(p, .05), .08, 1e-12, 'clampGround lifts by radius + depth'); near(p[1], .05, 1e-12, 'clampGround sets y');
  near(MO.groundLift([[0, -.1, 0], [0, .2, 0], [0, -.04, 0]], .02), .12, 1e-12, 'groundLift takes the deepest');
  const st = MO.lookState(), o = new Float64Array(6);
  MO.lookAt(st, o, [0, 1.7, 0], [0, 1.7, 5], 0); near(o[2], 1, 1e-9, 'look straight'); near(o[4], 1, 1e-9, 'look up vector');
  MO.lookAt(st, o, [0, 1.7, 0], [0, 1.7, -5], 0); near(Math.abs(Math.atan2(o[0], o[2])), MO.LOOK.yaw, 1e-9, 'look behind clamps to the yaw limit'); ok(fin(o), 'look finite behind');
  MO.lookAt(st, o, [0, 1.7, 0], [0, 9, 0], 0); near(Math.asin(o[1]), MO.LOOK.up, 1e-9, 'look up clamps'); ok(fin(o), 'look finite straight up');
  for (let i = 0; i < 60; i++) MO.lookAt(st, o, [0, 1.7, 0], [3, 1.7, 3], 0, DT); near(Math.atan2(o[0], o[2]), Math.PI / 4, .01, 'look springs onto the target');
  near(MO.segDist([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]), 1, 1e-12, 'segDist parallel'); near(MO.segDist([-1, 0, 0], [1, 0, 0], [0, -1, .5], [0, 1, .5]), .5, 1e-12, 'segDist crossing');
  const q = [.05, .5, 0]; near(MO.pushOut(q, .04, [0, 0, 0], [0, 1, 0], .15), .14, 1e-12, 'pushOut depth'); near(q[0], .19, 1e-12, 'pushOut moves along the normal');
  const a0 = [.1, .5, 0], a1 = [.1, .8, 0]; near(MO.capPush(a0, a1, .04, [0, 0, 0], [0, 1, 0], .15), .09, 1e-12, 'capPush depth'); near(a0[0], .19, 1e-12, 'capPush moves the segment');
  // resolve: a fixed torso, two arm segments of one limb (same group, never pushed apart from each other), a free hand inside the torso
  const torso = {a: [0, .9, 0], b: [0, 1.5, 0], r: .17, w: 0, g: 0}, up = {a: [.19, 1.45, 0], b: [.1, 1.2, 0], r: .05, w: 1, g: 1}, fo = {a: [.1, 1.2, 0], b: [.05, 1, .02], r: .04, w: 1, g: 1};
  const left = MO.resolve([torso, up, fo], 6); near(left, 0, 1e-6, 'resolve clears the body (' + left + ')');
  near(torso.a[0], 0, 0, 'resolve never moves a fixed capsule'); ok(MO.segDist(up.a, up.b, torso.a, torso.b) >= .17 + .05 - 1e-6 && MO.segDist(fo.a, fo.b, torso.a, torso.b) >= .17 + .04 - 1e-6, 'resolve: arm segments clear of the torso');
  const c1 = {a: [0, 1, 0], b: [0, 1.3, 0], r: .05, w: 1}, c2 = {a: [.02, 1, 0], b: [.02, 1.3, 0], r: .05, w: 1};
  MO.resolve([c1, c2], 1); near(c2.a[0] - c1.a[0], .1, 1e-9, 'resolve: equal mobility splits the push evenly'); ok(fin(c1.a) && fin(c2.a), 'resolve finite on near-coincident axes');
}

// ---- hands2: 10k random balls (in front, beside, behind, inside the torso, on the ground, rising or dropping): hands apart by
// hand width + 1 cm (exactly when both reach), clear of the torso, never below ground; palms unit and toward the ball's
// approach; fingers perpendicular to the palms, up for high balls, down for low ones, cupped (palms up) for a low ball
// dropping in; left hand on the left
{
  const o = MO.hands2Out(), r = prng(7), sc = [0, 1.45, 0], hip = [0, .95, 0], fwd = [0, 0, 1], rt = [1, 0, 0], sp = [[-.19, 1.45, 0], [.19, 1.45, 0]];
  const hw = .1, hr = .05, tr = .17, reach = .62, sep = hw + .01, R = tr + hr, c = new Float64Array(3);
  let two = 0, minSep = 9, minClear = 9, minY = 9, bad = 0, hiOk = 0, hiN = 0, loOk = 0, loN = 0, ordOk = 0;
  for (let n = 0; n < 10000; n++) {
    const B = r() < .4 ? [sc[0] + (r() - .5) * 1.1, sc[1] + (r() - .5) * 1.1, sc[2] + (r() - .5) * 1.1] : [(r() - .5) * 2.6, r() * 2.4 - .1, (r() - .5) * 2.6], hasV = r() < .7, bv = hasV ? [(r() - .5) * 20, (r() - .5) * 10, -r() * 30] : null;
    MO.hands2(o, B, bv, sc, hip, fwd, rt, sp, reach, hw, hr, tr);
    if (!fin(o.hd[0]) || !fin(o.hd[1]) || !fin(o.pn[0]) || !fin(o.pn[1]) || !fin(o.fd[0]) || !fin(o.fd[1])) { bad++; continue; }
    const d = MO.dist(o.hd[0], o.hd[1]); minSep = Math.min(minSep, d);
    if (o.two) { two++; if (Math.abs(d - sep) > 1e-9) bad++; }
    for (let i = 0; i < 2; i++) { MO.segClosest(c, o.hd[i], hip, sc); minClear = Math.min(minClear, MO.dist(o.hd[i], c) - R); minY = Math.min(minY, o.hd[i][1] - hr);
      if (Math.abs(MO.len(o.pn[i]) - 1) > 1e-9 || Math.abs(MO.len(o.fd[i]) - 1) > 1e-9 || Math.abs(MO.dot(o.pn[i], o.fd[i])) > 1e-9) bad++;
      if (bv && MO.dot(o.pn[i], bv) > 0) bad++; } // palms face the oncoming ball
    const ord = MO.dot(o.hd[1], o.e) - MO.dot(o.hd[0], o.e); if (ord > 0) ordOk++;
    if (B[1] > sc[1] - .05) { hiN++; if (o.fd.every((f, i) => f[1] > .5 || Math.abs(o.pn[i][1]) > .7)) hiOk++; } // a palm facing up or down sends the fingers along the arm
    if (B[1] < hip[1] + .05 && B[1] > .1) { loN++; const drop = bv && bv[1] < -.4 * MO.len(bv); if (drop ? o.pn[0][1] > .3 && o.pn[1][1] > .3 : o.fd.every((f, i) => f[1] < .05 || Math.abs(o.pn[i][1]) > .7)) loOk++; }
  }
  ok(bad === 0, 'hands2: finite, unit palms and fingers, exact gap when both reach, palms to the ball (' + bad + ' bad)');
  ok(minSep >= sep - 1e-9, 'hands2: never closer than hand width + 1 cm (' + minSep.toFixed(4) + ')');
  ok(minClear >= -1e-4, 'hands2: clear of the torso (' + minClear.toFixed(5) + ')');
  ok(minY >= -1e-12, 'hands2: never below ground');
  ok(two > 1500, 'hands2: both hands reach the balls near the body (' + two + ')');
  ok(ordOk === 10000, 'hands2: left hand on the left, every ball (' + ordOk + ')');
  ok(hiOk === hiN, `hands2: fingers up above the chest, never down (${hiOk}/${hiN})`);
  ok(loOk === loN, `hands2: fingers down below the waist, palms up when the ball drops in (${loOk}/${loN})`);
  // a ball far to the right: the right hand takes it, the left stretches toward it without crossing
  MO.hands2(o, [.75, 1.3, .15], null, sc, hip, fwd, rt, sp, reach, hw, hr, tr);
  ok(!o.two && MO.dist(o.hd[1], [.75, 1.3, .15]) < .06 && o.hd[0][0] < o.hd[1][0] && Math.abs(MO.dist(o.hd[0], sp[0]) - reach) < .02, 'hands2 far-arm rule');
}

console.log(`${checks - fails}/${checks} motion checks passed`);
if (fails) { console.error(fails + ' motion checks failed'); process.exit(1); }
console.log('All motion checks passed');
