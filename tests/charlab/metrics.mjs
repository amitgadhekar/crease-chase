// Pure metrics over the character lab's per-frame dumps (src/game/07b-lab.js). tests/charlab.mjs injects this file into the
// page (window.__cm: reduce() runs there per frame, capsules included) and imports it in node (seqMetrics, gates). No DOM,
// no three: node -e "import('./tests/charlab/metrics.mjs').then(m=>m.selfTest())" runs the built-in checks.
export const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sc: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]), dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
};
export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const STEP = 1 / 120;   // the lab's frame: teleports are measured per frame at this rate whatever the step
// closest distance between segments p0-p1 and q0-q1 (Ericson, Real-Time Collision Detection 5.1.9)
export function segDist(p0, p1, q0, q1) {
  const d1 = V.sub(p1, p0), d2 = V.sub(q1, q0), r = V.sub(p0, q0), a = V.dot(d1, d1), e = V.dot(d2, d2), f = V.dot(d2, r);
  let s = 0, t = 0;
  if (a <= 1e-12 && e <= 1e-12) return V.len(r);
  if (a <= 1e-12) t = clamp(f / e, 0, 1);
  else { const c = V.dot(d1, r);
    if (e <= 1e-12) s = clamp(-c / a, 0, 1);
    else { const b = V.dot(d1, d2), den = a * e - b * b;
      s = den !== 0 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); } } }
  return V.dist(V.add(p0, V.sc(d1, s)), V.add(q0, V.sc(d2, t)));
}
// pairs of capsules that may touch: they share a joint (an end point), or are on this list (name prefixes without the side digit,
// either order: the keys are sorted here as pairKey sorts them). torso-uarm is gated: the lab's torso capsule carries the armpit
// radius for the upper arms (07b-lab.js CAPS.man), so a hanging arm reads as touching and an arm through the chest stands out
const base = n => n.replace(/\d$/, '');
export const pairKey = (a, b) => [base(a), base(b)].sort().join('-');
const ALLOW = new Set(['thigh-thigh', 'thigh-torso', 'head-torso', 'glove-handle', 'glove-glove', 'farm-glove',
  'hand-hand', 'farm-hand', 'pad-shin', 'pad-thigh', 'pad-pad', 'shin-shin', 'uarm-uarm', 'farm-uarm',
  // the batter's distal forearm (wrst) keeps the forearm's allowances
  'glove-wrst', 'uarm-wrst', 'pad-wrst'].map(k => pairKey(...k.split('-'))));
// a capsule's radius against another: its 5th field may give one per partner (by name prefix)
const rad = (A, B) => A[4] && A[4][base(B[0])] != null ? A[4][base(B[0])] : A[3];
// penetration depth of every non-adjacent capsule pair ([name, a, b, r, {partner: r}?]), deepest first
export function penetration(caps) {
  const out = [];
  for (let i = 0; i < caps.length; i++) for (let j = i + 1; j < caps.length; j++) {
    const A = caps[i], B = caps[j], k = pairKey(A[0], B[0]);
    if (ALLOW.has(k)) continue;
    if (V.dist(A[1], B[1]) < 1e-3 || V.dist(A[1], B[2]) < 1e-3 || V.dist(A[2], B[1]) < 1e-3 || V.dist(A[2], B[2]) < 1e-3) continue;
    const d = rad(A, B) + rad(B, A) - segDist(A[1], A[2], B[1], B[2]);
    if (d > 0) out.push({a: A[0], b: B[0], d: +d.toFixed(4)});
  }
  return out.sort((x, y) => y.d - x.d);
}
// the per-frame record kept from a lab frame (joints of everyone drawn, the batter's swing state, the ball, penetration summary)
export function reduce(f) {
  const r = {t: f.t, ph: f.ph, st: f.st, gv: f.gv, cut: f.cut, ball: f.ball && f.ball.b, bk: !!(f.ball && f.ball.bk), thr: f.ball && f.ball.thr, cel: f.cel, dej: f.dej, pen: {}};
  if (f.bat) { const J = f.bat.J; r.bat = {hip: J.hip, sh: J.sh, hc: J.hc, sp: J.sp, e: J.e, hd: J.hd, hj: J.hj, kn: J.kn, an: J.an, sole: J.sole, H: J.H, d: J.d, fn: J.fn,
    face: Math.atan2(J.face[0], J.face[2]), mode: f.bat.mode, kind: f.bat.kind, swing: f.bat.swing && {t0: f.bat.swing.t0, impact: f.bat.swing.impact, done: f.bat.swing.done, missed: f.bat.swing.missed, k: f.bat.swing.k, C: f.bat.swing.C},
    contact: f.bat.contact, bpos: f.bat.bpos, lift: f.bat.lift}; }
  if (f.ns) { const J = f.ns.J; r.ns = {hip: J.hip, sh: J.sh, hc: J.hc, sp: J.sp, e: J.e, hd: J.hd, hj: J.hj, kn: J.kn, an: J.an, sole: J.sole, H: J.H, d: J.d, face: Math.atan2(J.face[0], J.face[2]), mv: f.ns.mv}; }
  r.p = (f.p || []).filter(p => p.on && p.J).map(p => ({n: p.n, i: p.i, kp: !!p.kp, gh: !!(p.kp && f.kh), bw: !!p.bw, act: p.act || 0, ap: p.ap, hold: !!p.hold, run: !!p.run, arm: p.arm, face: p.face, h: p.h,
    hip: p.J.hip, sh: p.J.sh, hc: p.J.hc, sp: p.J.sp, e: p.J.e, hd: p.J.hd, wr: p.J.wr, hj: p.J.hj, kn: p.J.kn, an: p.J.an, sole: p.J.sole, fw: p.J.fw, up: p.J.up, hr: p.J.hr}));
  if (f.caps) for (const k in f.caps) { const pen = penetration(f.caps[k]); if (pen.length) r.pen[k] = pen.slice(0, 3); }
  if (f.verts) r.low = f.verts;
  return r;
}
const yaw = v => Math.atan2(v[0], v[2]);
// lowest point of a person from joints: soles, hands (minus the hand radius), knees, head, hips, elbows
const lowJ = (J, hr) => Math.min(J.sole[0][1], J.sole[1][1], J.hd[0][1] - hr, J.hd[1][1] - hr, J.kn[0][1] - .06, J.kn[1][1] - .06, J.hc[1] - .11, J.hip[1] - .1, J.e[0][1] - .04, J.e[1][1] - .04);
// the bend side of a 2-bone limb: the joint's offset from the root-end line (flips count when it reverses)
function bendOff(root, joint, end) { const u = V.norm(V.sub(end, root)), r = V.sub(joint, root); return V.sub(r, V.sc(u, V.dot(r, u))); }
// motion metrics of one person over the frames (each frame holds his record P(f), or null when he isn't drawn)
export function personMetrics(frames, P, opts = {}) {
  const m = {slip: 0, slipTurn: 0, ground: 9, hands: 9, teleport: 0, teleportHand: 0, facing: 0, flips: 0, frames: 0, where: {}};
  const arm = opts.arm;   // the bowler's delivery window [t0, t1]: his hands are gated against the ball's release speed there
  if (arm) m.releaseHand = 0;
  let prev = null, prev2 = null, prevT = 0, prevDt = 0, prevOff = null, prevF = null;
  for (const f of frames) {
    const J = P(f); if (!J) { prev = null; prev2 = null; prevOff = null; prevF = f; continue; }
    const hr = J.hr == null ? .055 : J.hr, face = J.face != null ? J.face : J.fw ? yaw(J.fw) : 0, dt = prev ? f.t - prevT : 0;
    m.frames++;
    const g = lowJ(J, hr); if (g < m.ground) { m.ground = g; m.where.ground = f.t; }
    const hh = V.dist(J.hd[0], J.hd[1]); if (hh < m.hands) { m.hands = hh; m.where.hands = f.t; }
    const off = [bendOff(J.sp[0], J.e[0], J.hd[0]), bendOff(J.sp[1], J.e[1], J.hd[1]), bendOff(J.hj[0], J.kn[0], J.an[0]), bendOff(J.hj[1], J.kn[1], J.an[1])];
    if (prev && dt > 1e-6) {
      // a cut: the game's camera cuts (or he is hidden in the game's view, the keeper behind the batting camera, in either frame)
      const cut = !!(opts.cut && opts.cut(prevF, f)) || !!(J.gh || prev.J.gh);
      const df = Math.abs(wrap(face - prev.face)); if (df > m.facing && !cut) { m.facing = df; m.where.facing = f.t; }
      const turning = df / dt > 1.2;
      // a slide (act 5) slides on purpose: no slip while he is in it
      for (let i = 0; i < 2 && J.act !== 5 && prev.J.act !== 5; i++) {
        // planted: the sole on the ground in both frames
        if (J.sole[i][1] < .012 && prev.J.sole[i][1] < .012) { const v = Math.hypot(J.sole[i][0] - prev.J.sole[i][0], J.sole[i][2] - prev.J.sole[i][2]) / dt;
          if (cut) continue;
          if (turning) { if (v > m.slipTurn) { m.slipTurn = v; m.where.slipTurn = f.t; } } else if (v > m.slip) { m.slip = v; m.where.slip = f.t; } }
      }
      // body (hip, ankles): a teleport is a break in the motion, the distance from where the joint's velocity over the previous
      // step put it (per 120 Hz frame), so a foot swinging 10 cm a frame passes and a 6 cm pop (or the stop after it) fails.
      // Hands move 20 cm a frame in a swing or a throw, so they get their own gate on the plain jump, and the batter's are
      // exempt from the backlift's end to the follow-through. At a cut, or on the first step after one, the plain jump is kept
      // apart as the reset
      let jump = 0, pop = 0, hj = 0;
      for (const [a, b, c] of [[J.hip, prev.J.hip, prev2 && prev2.J.hip], [J.an[0], prev.J.an[0], prev2 && prev2.J.an[0]], [J.an[1], prev.J.an[1], prev2 && prev2.J.an[1]]]) {
        jump = Math.max(jump, V.dist(a, b));
        if (c && prevDt > 1e-6) { const vel = V.sc(V.sub(b, c), 1 / prevDt), pred = V.add(b, V.sc(vel, dt)); pop = Math.max(pop, V.dist(a, pred) * STEP / dt); } }
      for (const [a, b] of [[J.hd[0], prev.J.hd[0]], [J.hd[1], prev.J.hd[1]]]) hj = Math.max(hj, V.dist(a, b));
      if (!cut && prev2 && pop > m.teleport) { m.teleport = pop; m.where.teleport = f.t; }
      const sw = J.swing, inSwing = sw && f.t >= sw.t0 - .05 && f.t <= sw.impact + .35;
      const inArm = arm && f.t >= arm[0] && f.t <= arm[1];
      if (!cut && inArm && hj > m.releaseHand) { m.releaseHand = hj; m.where.releaseHand = f.t; }
      if (!cut && !inSwing && !inArm && hj > m.teleportHand) { m.teleportHand = hj; m.where.teleportHand = f.t; }
      if (cut && Math.max(jump, hj) > (m.resetJump || 0)) { m.resetJump = Math.max(jump, hj); m.where.reset = f.t; }
      if (prevOff) for (let k = 0; k < 4; k++) if (V.len(off[k]) > .02 && V.len(prevOff[k]) > .02 && V.dot(off[k], prevOff[k]) < 0) { m.flips++; m.where.flips = f.t; }
      // the step after a cut starts the motion afresh: no velocity to predict from
      prev2 = cut ? null : prev; prevDt = dt;
    }
    prev = {J, face}; prevT = f.t; prevOff = off; prevF = f;
  }
  if (m.ground === 9) m.ground = null; if (m.hands === 9) m.hands = null;
  return m;
}
// the batter's swing: pose exactness at impact (checked by the runner, passed in), bat angular velocity across the impact, the ball
// on the blade's target point at impact, the lowest skinned vertex
export function batterMetrics(frames, impact) {
  const m = {}; const fi = frames.findIndex(f => f.bat && f.bat.swing && Math.abs(f.t - f.bat.swing.impact) < 1e-9);
  if (impact) { m.impactErr = impact.err; m.contact = impact.contact; m.skinErr = impact.skinErr; m.kind = impact.kind; }
  if (fi > 2 && fi < frames.length - 3 && frames[fi].bat.kind && frames[fi].bat.kind !== 'miss') {
    const w = i => { const a = frames[i].bat.d, b = frames[i + 1].bat.d, dt = frames[i + 1].t - frames[i].t; return dt > 0 ? Math.acos(clamp(V.dot(a, b), -1, 1)) / dt : 0; };
    const wb = (w(fi - 3) + w(fi - 2) + w(fi - 1)) / 3, wa = (w(fi) + w(fi + 1) + w(fi + 2)) / 3;
    m.batAV = {before: +wb.toFixed(2), after: +wa.toFixed(2), change: wb > .5 ? +Math.abs(wa - wb) / wb : 0, axisDot: +V.dot(frames[fi - 1].bat.d, frames[fi + 1].bat.d).toFixed(3)};
  }
  let low = 9, lowAt = null; for (const f of frames) if (f.low && f.low.bat && f.low.bat.y < low) { low = f.low.bat.y; lowAt = f.t; }
  if (low < 9) m.lowVertex = {y: low, at: lowAt};
  return m;
}
// hands on the ball at the plays (catch, stop, drop, fumble) and the keeper's takes
export function handsBall(frames, anchors) {
  const out = [];
  const near = t => { let b = null, bd = 9; for (const f of frames) { const d = Math.abs(f.t - t); if (d < bd) { bd = d; b = f; } } return bd < .02 ? b : null; };
  for (const e of anchors.fplay || []) { if (!e.o || e.o === 'miss') continue;
    const f = near(anchors.f0 + e.t1), p = f && f.p.find(q => q.i === e.i); if (!p || !f.ball) { out.push({who: e.n || e.i, o: e.o, d: null, t: anchors.f0 + e.t1}); continue; }
    out.push({who: e.n || e.i, o: e.o, d: +Math.min(V.dist(p.hd[0], f.ball), V.dist(p.hd[1], f.ball)).toFixed(3), t: f.t}); }
  const kp = frames.find(f => f.p.some(q => q.kp && q.hold && q.ap > 0)); if (kp && kp.ball) { const q = kp.p.find(q => q.kp); out.push({who: 'keeper', o: 'take', d: +Math.min(V.dist(q.hd[0], kp.ball), V.dist(q.hd[1], kp.ball)).toFixed(3), t: kp.t}); }
  return out;
}
// everything for one sequence: per person motion, the batter's swing, hands on the ball, worst penetrations (bat pairs outside the contact window)
export function seqMetrics(frames, anchors, spec, impact) {
  // the game's camera cuts (07b-lab.js labGameView: replays, cordon cuts, back home from a chase); dumps without it: phase changes
  // into the countdown or out of the result
  const cut = (a, b) => b.cut != null ? b.cut : !!a && a.ph !== b.ph && (b.ph === 'ready' || b.ph === 'break' || a.ph === 'result');
  const people = {};
  const names = new Set(); for (const f of frames) for (const p of f.p) names.add(p.n);
  if (frames.some(f => f.bat)) people.bat = personMetrics(frames, f => f.bat, {cut});
  if (frames.some(f => f.ns)) people.ns = personMetrics(frames, f => f.ns, {cut});
  // the bowling arm: from 0.15 s before the release to 0.08 s after it a bowler's hand moves as fast as the ball leaves it (a pace
  // bowler's hand ~30-38 m/s, 0.25-0.32 m a frame), so there it is gated against the ball's own release speed per frame, not the
  // plain teleportHand limit; faster than the ball is a snap
  const rel = anchors.release, fl = rel != null ? frames.filter(f => f.ball && f.t > rel + 1e-6).slice(0, 2) : [];
  const vRel = fl.length === 2 && fl[1].t > fl[0].t ? V.dist(fl[1].ball, fl[0].ball) / (fl[1].t - fl[0].t) : null;
  const arm = vRel ? [rel - .15, rel + .08] : null;
  for (const n of names) people[n] = personMetrics(frames, f => f.p.find(p => p.n === n), {cut, arm: n === 'bowler' ? arm : null});
  if (people.bowler && vRel) people.bowler.releaseLim = vRel * STEP;
  const pen = {}; const win = anchors.impact != null ? [anchors.impact - .15, anchors.impact + .25] : null;
  for (const f of frames) for (const k in f.pen) for (const x of f.pen[k]) {
    const batPair = /blade|handle/.test(x.a + x.b), inWin = win && f.t >= win[0] && f.t <= win[1];
    if (k === 'bat' && batPair && inWin) continue;
    const id = k + ':' + pairKey(x.a, x.b); if (!pen[id] || x.d > pen[id].d) pen[id] = {d: x.d, t: f.t, bat: batPair};
  }
  const low = {}; for (const f of frames) if (f.low) for (const k in f.low) if (!low[k] || f.low[k].y < low[k].y) low[k] = {y: f.low[k].y, at: f.low[k].at, t: f.t};
  return {people, batter: batterMetrics(frames, impact), handsBall: handsBall(frames, anchors), pen, low, n: frames.length, t0: frames.length ? frames[0].t : 0, t1: frames.length ? frames[frames.length - 1].t : 0};
}
// gates over one sequence's metrics; each: {id, value, limit, pass, t}
export function gates(m, T, spec) {
  const out = [], g = (id, value, limit, pass, t) => out.push({id, value: value == null ? null : +(+value).toFixed(4), limit, pass: !!pass, t: t == null ? null : +t.toFixed(3)});
  for (const n in m.people) { const p = m.people[n], w = p.where, isBat = n === 'bat' || n === 'ns';
    g('slip:' + n, p.slip, T.slip, p.slip <= T.slip, w.slip); g('slipTurn:' + n, p.slipTurn, T.slipTurn, p.slipTurn <= T.slipTurn, w.slipTurn);
    if (p.ground != null) g('ground:' + n, p.ground, -T.ground, p.ground >= -T.ground, w.ground);
    if (p.hands != null) { const lim = isBat ? T.handsBatter : 2 * (p.hr || .05) + T.handsFree; g('hands:' + n, p.hands, lim, p.hands >= lim, w.hands); }
    g('teleport:' + n, p.teleport, T.teleport, p.teleport <= T.teleport, w.teleport); g('teleportHand:' + n, p.teleportHand, T.teleportHand, p.teleportHand <= T.teleportHand, w.teleportHand);
    if (p.releaseLim) { const lim = +(Math.max(T.teleportHand, p.releaseLim * T.releaseHand)).toFixed(4); g('releaseHand:' + n, p.releaseHand, lim, p.releaseHand <= lim, w.releaseHand); }
    // a jump under a camera cut (resetJump) is allowed (docs/characters.md, Gates: teleports outside camera cuts): kept in the metrics only
    g('facing:' + n, p.facing, T.facing, p.facing <= T.facing, w.facing); g('flips:' + n, p.flips, 0, p.flips === 0, w.flips); }
  const b = m.batter;
  // bit-exact in float32: the blend lands an ulp either side of SWING_DELAY in the game's own clock subtraction, which only shows
  // as 1e-31 on channels near zero
  if (b.impactErr != null) g('impactExact', b.impactErr, T.impactErr, b.impactErr <= T.impactErr, null);
  if (b.contact != null && b.kind && b.kind !== 'miss') g('contact', b.contact, T.contact, b.contact <= T.contact, null);
  if (b.skinErr != null) g('skinErr', b.skinErr, T.skinErr, b.skinErr <= T.skinErr, null);
  if (b.batAV) { g('batAV', b.batAV.change, T.batAV, b.batAV.change <= T.batAV, null); g('batAxis', b.batAV.axisDot, T.batAxis, b.batAV.axisDot >= T.batAxis, null); }
  if (b.lowVertex) g('vertex:bat', b.lowVertex.y, -T.ground, b.lowVertex.y >= -T.ground, b.lowVertex.at);
  for (const k in m.low) if (k !== 'bat') g('vertex:' + k, m.low[k].y, -T.ground, m.low[k].y >= -T.ground, m.low[k].t);
  for (const k in m.pen) { const x = m.pen[k], lim = x.bat ? T.penBat : T.pen; g('pen:' + k, x.d, lim, x.d <= lim, x.t); }
  for (const h of m.handsBall) g('handsBall:' + h.who + ':' + h.o, h.d, T.handsBall, h.d != null && h.d <= T.handsBall, h.t);
  return out;
}
export function selfTest() {
  const eq = (a, b, m) => { if (Math.abs(a - b) > 1e-6) throw new Error(m + ': ' + a + ' vs ' + b); };
  eq(segDist([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]), 1, 'parallel'); eq(segDist([0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]), 1, 'collinear');
  eq(segDist([0, 0, 0], [0, 0, 0], [0, 0, 1], [0, 0, 1]), 1, 'points'); eq(segDist([-1, 0, 0], [1, 0, 0], [0, -1, .5], [0, 1, .5]), .5, 'crossing');
  const pen = penetration([['thigh0', [0, 1, 0], [0, .5, 0], .08], ['blade', [0, .7, .05], [0, .9, .05], .03], ['shin0', [0, .5, 0], [0, 0, 0], .07]]);
  if (pen.length !== 1 || Math.abs(pen[0].d - .06) > 1e-6) throw new Error('penetration ' + JSON.stringify(pen));
  // allowances match in either order; a per-partner radius (the torso's armpit radius for the upper arm)
  if (penetration([['farm0', [0, 0, 0], [0, 1, 0], .05], ['glove1', [.05, .5, 0], [.05, .5, 0], .05]]).length) throw new Error('allowance glove-farm');
  const arm = [['torso', [0, 1, 0], [0, 1.5, 0], .16, {uarm: .14}], ['uarm0', [.19, 1.45, 0], [.19, 1.15, 0], .05], ['farm0', [.19, 1.15, 0], [.21, .9, 0], .04]];
  if (penetration(arm).some(x => x.b === 'uarm0' || x.a === 'uarm0')) throw new Error('hanging arm ' + JSON.stringify(penetration(arm)));
  const J = t => ({hip: [0, 1, t], sh: [0, 1.5, t], hc: [0, 1.7, t], sp: [[.2, 1.5, t], [-.2, 1.5, t]], e: [[.25, 1.2, t + .05], [-.25, 1.2, t + .05]], hd: [[.2, .9, t], [-.2, .9, t]], hj: [[.1, .95, t], [-.1, .95, t]],
    kn: [[.1, .5, t + .03], [-.1, .5, t + .03]], an: [[.1, .08, t], [-.1, .08, 0]], sole: [[.1, 0, t], [-.1, 0, 0]], fw: [0, 0, 1], hr: .05});
  const fr = [0, 1, 2, 3].map(i => ({t: i / 120, ph: 'flight', p: [{n: 'x', i: 0, ...J(i * .01)}], pen: {}}));
  const pm = personMetrics(fr, f => f.p[0]); eq(pm.slip, 1.2, 'slip: the sliding planted foot'); eq(pm.teleport, 0, 'teleport: steady motion is no teleport'); eq(pm.hands, .4, 'hands'); eq(pm.flips, 0, 'flips');
  const fp = [0, .01, .02, .04, .05].map((z, i) => ({t: i / 120, ph: 'flight', p: [{n: 'x', i: 0, ...J(z)}], pen: {}}));
  eq(personMetrics(fp, f => f.p[0]).teleport, .01, 'teleport: a 1 cm pop in a 1 cm/frame walk');
  const gs = gates(seqMetrics(fr, {fplay: []}, {}, null), {slip: .05, slipTurn: .15, ground: .01, handsBatter: .08, handsFree: .01, teleport: .06, teleportHand: .25, facing: .2, contact: .01, impactErr: 1e-6, skinErr: .02, batAV: .4, batAxis: .5, pen: .02, penBat: .015, handsBall: .12});
  if (!gs.find(x => x.id === 'slip:x' && !x.pass)) throw new Error('gate slip');
  return 'metrics self-test ok';
}
