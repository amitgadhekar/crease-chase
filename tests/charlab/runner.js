// In-page sequence runner for tests/charlab.mjs (injected with addInitScript, after metrics.mjs as window.__cm). It drives
// window.__lab (src/game/07b-lab.js) one sequence at a time: begin(spec) steps to the sequence origin, until(expr) steps at
// 120 Hz to a key time (landing on it exactly), applying the spec's actions (backlift, footwork, swing, duck, forced play,
// celebration) and recording reduced frames; view(cam) locks a camera on a subject; shot() renders. Plain script, no DOM.
window.__run = (() => {
  const L = () => window.__lab, T = () => window.__t, STEP = 1 / 120, MAXSTEPS = 4000;
  let Q = null;
  const keyT = (expr, A) => { const m = /^([a-zA-Z]+)([+-][\d.]+)?$/.exec(expr || ''); if (!m) return null; const b = A[m[1]]; return b == null ? null : b + (m[2] ? +m[2] : 0); };
  const fresh = () => ({A: {}, frames: [], started: false, ballSet: false, fieldSet: false, armed: false, bl: false, inj: false, ducked: false, cel: false, foot: null, n: 0, impact: null, ok: false, prevPh: null});
  function begin(spec) {
    Q = Object.assign(fresh(), {spec, retry: 0, steps: 0, foot: spec.foot ? {x: spec.foot.x, z: spec.foot.z} : null});
    L().keeper(!!spec.keeper);
    T().S.stick = null;
    const r = seek();
    return r;
  }
  // step until the sequence origin: the run-up starts (or the countdown, from: ready), the delivery set up on the way. The countdown
  // is played, not skipped: everyone walks back and to a changed field or keeper stance as in a match
  function seek() {
    const spec = Q.spec, from = spec.from || 'runup';
    for (let g = 0; g < 2000; g++) {
      const ph = L().phase(), a = L().anchors();
      if (ph === 'ready' && !Q.ballSet) { if (spec.play && spec.play.field) L().field(spec.play.field); if (spec.play && spec.swings) order();
        const sw = swingNow(); L().ball(sw && sw.ball || spec.ball || {}); Q.ballSet = true; }
      if (ph === from && Q.ballSet && a.st === 0) { Q.started = true; Q.A.start = L().clock(); Q.prevPh = ph; predict(a, from); return {origin: Q.A.start, retry: Q.retry}; }
      L().step(STEP); Q.steps++;
    }
    throw new Error('seek: no ' + from + ' phase in 2000 steps');
  }
  // a forced play's swing for this ball: the one most likely to bring the play up on this planet and this ball's field (the field
  // changes over by over), each candidate's ball made and its swing rolled through evalSwing (__lab.probe); when none of the listed
  // swings can, an aim and power grid around them; when nothing can, the listed swings in turn as before
  function order() {
    const spec = Q.spec, pred = spec.play.pred, rate = (sw, n) => { L().ball(sw.ball || spec.ball || {}); return L().probe(pred, sw, n || 150); };
    let cands = spec.swings.slice(), rates = cands.map(sw => rate(sw));
    if (Math.max(...rates) === 0) { const t = spec.swings[0];
      for (const power of [.3, .55, .85]) for (let aim = -60; aim <= 60; aim += 10) { const sw = {...t, aim, power}; cands.push(sw); rates.push(rate(sw, 80)); } }
    const best = rates.indexOf(Math.max(...rates));
    Q.pick = rates[best] > 0 ? cands[best] : spec.swings[Q.retry % spec.swings.length];
    (Q.rates || (Q.rates = [])).push(+rates[best].toFixed(3));
  }
  // the release, pitch and the keeper's take are known before they happen (fixed run-up, the delivery already made); the exact
  // times replace them as they come
  function predict(a, from) { const A = Q.A, rel = (from === 'ready' ? A.start + a.readyDur : A.start) + a.runupDur; A.release = rel; A.pred = true;
    if (a.pend) { A.pitch = rel + a.pend.t1; A.tEnd = rel + a.pend.tEnd; } }
  function retry() { Q.retry++; const n = Q.retry; Object.assign(Q, fresh(), {spec: Q.spec, retry: n, steps: Q.steps, rates: Q.rates, foot: Q.spec.foot ? {x: Q.spec.foot.x, z: Q.spec.foot.z} : null}); T().S.stick = null; seek(); }
  // anchors from the lab, latched as they appear
  function anchors() {
    const a = L().anchors(), A = Q.A, spec = Q.spec, c = L().clock();
    if (a.release != null && (A.release == null || A.pred)) { A.release = a.release; A.pitch = a.pitch; A.tEnd = a.tEnd; A.pred = false; }
    if (a.swing != null && A.swing == null && A.release != null && !A.pred) { A.swing = a.swing; A.impact = a.impact; A.swPred = false; }
    if (a.contact != null && A.contact == null && A.release != null) { A.contact = a.contact; A.f0 = a.f0; A.hitU = a.hitU; A.fp = a.fp; A.res = a.res; A.fplay = a.fplay; A.fieldN = a.fieldN;
      if (spec.play) { const key = new Function('return ' + spec.play.key)(), f = a.fieldN.map(n => ({n})), e = a.fplay.find(x => key(x, f));
        if (e) { A.play = a.f0 + e.t1; A.playI = e.i; A.playN = e.n || 'f' + e.i; A.playP = [e.x, e.y, e.z]; A.playK = e.k; A.playO = e.o; } } }
    if (a.ph === 'result' && A.result == null && Q.prevPh !== 'result') { A.result = c; if (!A.res) A.res = a.res; if (!A.fplay) { A.fplay = a.fplay; A.f0 = a.f0; A.fieldN = a.fieldN; } }
    if (a.thr && A.thr == null) { A.wind = a.f0 + a.thr.tg; A.thr = a.f0 + a.thr.tr; A.take = a.f0 + a.thr.tk; A.thrI = a.thr.i; A.thrRv = a.thr.rv; A.thrKind = a.thr.kind; }
    if (a.ph === 'ready' && A.ready == null && A.release != null && Q.prevPh !== 'ready') A.ready = c;
    if (a.cel != null && A.cel == null) A.cel = a.cel;
    Q.prevPh = a.ph;
    return A;
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // the swing for this ball: a forced play may list one per retry (spec.swings), else the one swing
  const swingNow = () => Q.pick ? Q.pick : Q.spec.swings ? Q.spec.swings[Q.retry % Q.spec.swings.length] : Q.spec.swing;
  // one step: the next exact landing time (a key, the backlift, the swing, the end), actions, anchors, the frame
  function tick(tKey) {
    const spec = Q.spec, A = Q.A, S = T().S, c = L().clock(), ph = L().phase();
    const cand = [tKey, keyT(spec.end, A)];
    let tInj = null;
    if (spec.swing && !Q.inj && ph === 'flight') { const sw = swingNow(); let dt = sw.dt || 0;
      if (sw.edge) { const fa = footAt(S.ball, S.bpos), w = windows(T().getM().diff, true, 1 + .35 * fa.gain); dt = -(w.ok + w.edge) / 2; }
      tInj = L().swingAt(dt); cand.push(tInj); if (tInj != null && A.swing == null) { A.swing = tInj; A.impact = tInj + SWING_DELAY; A.swPred = true; } }
    if (spec.bl && spec.swing && !Q.bl) cand.push(keyT(spec.bl, A));
    if (spec.duck && !Q.ducked && A.pitch != null) cand.push(A.pitch + .02);
    // an event within a step is landed on exactly (a plain step may fall an ulp short of it)
    let tn = c + STEP; for (const x of cand) if (x != null && x > c + 1e-9 && x < tn + 1e-9) tn = x;
    // actions due at this clock (before stepping), then the step
    if (spec.bl && spec.swing && !Q.bl && keyT(spec.bl, A) != null && c >= keyT(spec.bl, A) - 1e-9) { Q.bl = true; const sw = swingNow(); L().backlift(sw.power == null ? 1 : sw.power, sw.aim || 0); }
    if (tInj != null && c >= tInj - 1e-9 && !Q.inj) { Q.inj = true; const sw = swingNow(), n = spec.play && !spec.swings ? Q.retry : 0;
      const o = L().swing(n ? {...sw, aim: (sw.aim || 0) + 12 * n, power: (sw.power == null ? .8 : sw.power) * (1 - .08 * n)} : sw); if (o) { A.swing = o.t0; A.impact = o.impact; A.swPred = false; } }
    else if (tInj != null && A.swPred) { A.swing = tInj; A.impact = tInj + SWING_DELAY; }
    if (spec.play && !Q.armed && ph === 'flight') { Q.armed = true; L().arm(spec.play.pred); }
    if (spec.duck && !Q.ducked && A.pitch != null && c >= A.pitch + .02 - 1e-9) { Q.ducked = true; L().duck(); }
    if (Q.ducked && A.tEnd != null && c >= A.tEnd) S.stick = null;
    if (Q.foot && (ph === 'runup' || ph === 'flight') && !(A.pitch != null && c >= A.pitch)) { if (L().foot(Q.foot.x, Q.foot.z)) Q.foot = null; }
    if (spec.cel && !Q.cel && ph === 'result' && S.t >= (spec.cel.at || .3)) { Q.cel = true; L().cel(); }
    L().step(0, false, tn); Q.steps++; Q.n++;
    anchors();
    const f = __cm.reduce(L().frame({caps: 1, verts: Q.n % 4 === 1}));
    f.retry = Q.retry; Q.frames.push(f);
    // the impact frame: pose bit-exact against the impact key, ball on the solver's target, skinning error
    if (A.impact != null && L().clock() === A.impact && !Q.impact) { const j = L().joints().bat, b = L().ballNow().b, e = L().skinErr();
      Q.impact = {t: A.impact, err: j.swing && j.swing.a && j.cur.length === j.swing.a.length ? Math.max(...j.cur.map((v, i) => Math.abs(v - j.swing.a[i]))) : null, kind: j.swing && j.swing.k,
        contact: j.swing && j.swing.C && b ? +dist(b, j.swing.C).toFixed(4) : null, raw: j.contact, skinErr: e ? +Math.max(...e.hand, ...e.elbow, ...e.knee, ...e.ankle).toFixed(4) : null, sole: e && e.sole}; }
    // a forced play that did not come up (or no contact at all): the next ball
    if (spec.play && !Q.ok) { if (A.contact != null) { if (A.fp > 0 && A.play != null) Q.ok = true; else return 'retry'; } else if (A.result != null) return 'retry'; }
    return null;
  }
  // step until expr's time (returns the frames since the last call); done when the end passes first
  function until(expr) {
    const out = {reached: false, done: false, retry: Q.retry, t: null};
    for (let g = 0; g < MAXSTEPS; g++) {
      const A = Q.A, tk = keyT(expr, A), te = keyT(Q.spec.end, A), c = L().clock();
      if (tk != null && c >= tk - 1e-9) { out.reached = true; break; }
      if (te != null && c >= te - 1e-9) { out.done = true; break; }
      if (tk == null && A.ready != null && Q.spec.end && /^ready/.test(Q.spec.end) === false && A.result != null && c > A.result + 3) { out.done = true; break; }
      const r = tick(tk);
      if (r === 'retry') { if (Q.retry >= (Q.spec.swings ? Q.spec.swings.length : 4) - 1) { out[Q.spec.optional ? 'skip' : 'fail'] = 'the play did not come up in ' + (Q.retry + 1) + ' balls'; out.done = true; break; } out.frames = []; retry(); out.retry = Q.retry; out.reset = true; }
    }
    // a forced play whose later anchor never came (no throw after the stop: it did not fit the result phase): the next ball, the
    // keys from the first again
    if (!out.reached && !out.fail && !out.skip && Q.spec.play && keyT(expr, Q.A) == null && /^(wind|thr|take)/.test(expr)) {
      if (Q.retry < (Q.spec.swings ? Q.spec.swings.length : 4) - 1) { retry(); out.retry = Q.retry; out.reset = true; out.restart = true; out.done = false; out.frames = []; Q.frames = []; }
      else out[Q.spec.optional ? 'skip' : 'fail'] = 'the ' + expr.replace(/[+-].*/, '') + ' did not come in ' + (Q.retry + 1) + ' balls'; }
    out.t = L().clock(); out.A = Object.assign({}, Q.A); out.frames = Q.frames; Q.frames = []; out.impact = Q.impact; out.steps = Q.steps;
    return out;
  }
  // the subject's hip and facing (yaw of the direction his chest faces; the batter's is the off side, the non-striker's the striker)
  function subject(sel) {
    const J = L().joints(), A = Q ? Q.A : {};
    if (sel === 'bat') return J.bat && {pos: J.bat.J.hip, hc: J.bat.J.hc, yaw: Math.PI / 2, n: 'bat'};
    if (sel === 'ns') return J.ns && {pos: J.ns.J.hip, hc: J.ns.J.hc, yaw: Math.PI, n: 'ns'};
    const P = J.p; let p = null;
    if (sel === 'bowler') p = P.find(x => x.n === 'bowler' && x.on);
    else if (sel === 'keeper') p = P.find(x => x.kp && x.on);
    // the bowler's slot in the field is drawn by the bowler's own rig
    else if (sel === 'play' || sel === 'thrower') { const i = sel === 'play' ? A.playI : A.thrI, q = P.find(x => x.i === i); p = q && q.bw ? P.find(x => x.n === 'bowler' && x.on) : q && q.on ? q : null; }
    else if (sel === 'f:ring') p = P.find(x => x.on && !x.kp && !x.bw && /^(cover|point|midoff|midwkt|midon|square)/.test(x.n)) ||
      P.filter(x => x.on && !x.kp && !x.bw && x.n !== 'slip' && x.J).sort((u, v) => Math.abs(Math.hypot(u.x, u.z) - 25) - Math.abs(Math.hypot(v.x, v.z) - 25))[0];
    else if (sel && sel.startsWith('f:')) p = P.find(x => x.n === sel.slice(2) && x.on);
    if (!p || !p.J) return null;
    return {pos: p.J.hip, hc: p.J.hc, yaw: Math.atan2(p.J.fw[0], p.J.fw[2]), n: p.n, i: p.i};
  }
  function view(c, subj) {
    const A = Q ? Q.A : {};
    if (c.game) { let p = null, u = null, t = null;
      if (c.at === 'bat') { const s = subject('bat'); p = s && s.pos; }
      else if (c.at === 'play') p = A.playP || (s => s && s.pos)(subject('play'));
      else if (c.at === 'ball') { const b = L().ballNow().b; p = b || A.playP || null; u = A.hitU; }
      if (c.game === 'cel') t = A.cel != null ? L().clock() - A.cel : 3.5;
      if ((c.game === 'side' || c.game === 'cord' || c.game === 'chase') && !p) return null;
      return {cam: L().game(c.game, {p, u, t}), subj: c.at || null, gv: L().LAB.gv}; }
    const s = subject(c.rel === 'subject' ? subj : c.rel); if (!s) return null;
    const az = s.yaw + (c.az || 0) * Math.PI / 180, d = c.d || 4;
    // ty 'head': the subject's head centre (species differ in height), the camera at the same height
    const ty = c.ty === 'head' ? s.hc[1] : c.ty == null ? .95 : c.ty, h = c.ty === 'head' ? s.hc[1] + .05 : c.h == null ? 1.25 : c.h;
    const from = [s.pos[0] + Math.sin(az) * d, h, s.pos[2] + Math.cos(az) * d], at = [s.pos[0], ty, s.pos[2]];
    // a camera outside the stadium circle (a rope fielder, a 10 m camera, a small planet) has no distToBoundary (NaN): renderSky throws on the next step
    const rr = Math.hypot(from[0], from[2]), lim = (typeof BOUNDARY === 'number' ? BOUNDARY : 1e9) - 0.5; if (rr > lim) { from[0] *= lim / rr; from[2] *= lim / rr; }
    return {cam: L().look({from, at, span: c.span || 2.4, fy: c.fy}), subj: s.n};
  }
  function shot() { L().render(); return L().info(); }
  return {begin, until, view, shot, subject, keyT: expr => keyT(expr, Q ? Q.A : {}), state: () => ({A: Q && Q.A, retry: Q && Q.retry, steps: Q && Q.steps, rates: Q && Q.rates}), drive: () => L().drive()};
})();
