// Balance simulator: plays thousands of balls with a bot batter against the real game logic (src/logic.js).
// Usage: node tests/balance.mjs [balls]   (default 20000 per row; footwork rows play 5x that)
// Exits with code 1 if a key number drifts outside its expected band, so it can guard balance changes.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const N = +process.argv[2] || 20000;
const logic = readFileSync(new URL('../src/logic.js', import.meta.url), 'utf8');

const harness = `
// Footwork bots return the batter's offset from guard (S.bpos) for a delivery. "reads" only uses what a human sees
// by the time the ball pitches (length and line shown at release) and the joystick speed limits until it pitches: back to
// short balls, forward to good length (staying in the crease against pace, down the pitch to spin unless it is drifting wide).
const FOOTBOTS={
  stationary:null,
  reads:b=>b.zb>5.9?{x:0,z:-Math.min(2*b.t1,0.5)}:b.zb>4.2&&b.xb>-0.35&&b.xb<0.55?{x:0,z:clamp(b.zb-3.8,0,Math.min(2.5*b.t1,b.type==='spin'?1.5:0.4))}:null,
  charges:()=>({x:0,z:1.5}),
  across:()=>({x:0.4,z:0})
};
function botBall(b,bp,diff,sigma,loftP,field){
  const f=footAt(b,bp);let aim;    // bot picks a sensible shot for the ball as it meets it
  if(f.full>0.65)aim=Math.random()<.5?-85:85;else if(f.xc>0.2)aim=40+Math.random()*40;else if(f.xc<-0.05)aim=-40;else aim=(Math.random()-.5)*30;
  aim+=gauss()*12;const lofted=Math.random()<loftP;
  const sw={tc:f.t-0.005+gauss()*sigma,aim,power:lofted?0.85:0.65,lofted,defend:false,bp};
  const r=evalSwing(b,sw,diff,field);return r.miss?beaten(b,bp,true):r.res;
}
function bot(pk,diff,sigma,loftP,n,fb){
  const P=setPlanet(pk),mem={},ft={x:0,z:0},foot=FOOTBOTS[fb||'stationary'],how={};let runs=0,outs=0,balls=0,fours=0,sixes=0;
  const field=fieldFor([],diff).field;
  for(let i=0;i<n;i++){
    if(i%6===0)rollWind(P);
    const type=Math.random()<0.6?'pace':'spin';
    const b=makeDelivery(planBall(mem,type,diff,{last:[],foot:ft}),diff,Math.random()<.5?1:-1);
    const bp=foot&&foot(b),res=botBall(b,bp,diff,sigma,loftP,field);
    runs+=res.runs;if(!res.wide)balls++;if(res.boundary===4)fours++;if(res.boundary===6)sixes++;
    if(res.out){outs++;const k=/^Caught/.test(res.outText)?'caught':res.outText||'other';how[k]=(how[k]||0)+1;}
    footTrend(ft,bp);brainLearn(mem,b,res.runs,!!res.out);
  }
  return {rpb:runs/balls,bpo:balls/Math.max(1,outs),rpw:runs/Math.max(1,outs),fours:fours/balls,sixes:sixes/balls,how,outs};
}
globalThis.PLANET_ORDER=PLANET_ORDER;globalThis.PLANETS=PLANETS;globalThis.DIFF=DIFF; // top-level consts are not context properties
function aiTarget(diff,overs,wkts,pk){const P=setPlanet(pk),m=overs===20?P.t20:P.ai;let t=0;for(let i=0;i<2000;i++)t+=simulateAI(overs,wkts,diff,m).runs;return t/2000+1;}

// T20 chase: the AI innings sets the target, then the bot bats 120 balls / 10 wickets against captain, plans and fields.
// It keeps batting after reaching the target so every innings measures a full 20 overs; the win is runs >= target.
function t20Chase(pk,diff,loft,A){
  const P=setPlanet(pk),target=simulateAI(20,10,diff,P.t20).runs+1,attack=makeAttack(pk,diff),st=newT20(attack,diff,target),
    Z=[0,0,0,0,0,0,0,0],ft={x:0,z:0},last=[];let prev=-1;
  for(let o=0;o<20&&st.wkts<10;o++){
    rollWind(P);
    const bi=captainPick(attack,o,st);
    if(bi<0||bi===prev||st.bw[bi].o>=4){A.bad.captain++;break;}
    prev=bi;
    const bw=attack[bi],ph=phaseOf(o),pp=ph==='pp',plan=planPick(bw,ph,st,ft);
    let field=adjust(tplField(plan.id),Z,{pp,n:Math.min(2,DIFF[diff].deep)}).field;
    A.fields++;if(!fieldOk(field,pp))A.bad.field++;
    A.plan[plan.id]=(A.plan[plan.id]||0)+1;
    let done=false;
    while(!done&&st.wkts<10){
      const b=makeDelivery(planBall(st.mem,bw.type,diff,{last,pressure:t20Pressure(st),foot:ft,bw,plan}),diff,bw);
      const res=botBall(b,null,diff,0.045,loft[ph],field),R=A.ph[ph];
      last.push(b.len);if(last.length>3)last.shift();
      brainLearn(st.mem,b,res.runs,!!res.out);footTrend(ft,null);zoneAdd(Z,res.out?null:res.dir,res.runs);
      R.r+=res.runs;if(!res.wide)R.b++;if(res.out)R.w++;if(res.boundary===4)R.f++;if(res.boundary===6)R.s++;
      done=t20Record(st,bi,res);
      if(res.boundary&&!done){field=adjust(field,Z,{pp,n:1}).field;A.fields++;if(!fieldOk(field,pp))A.bad.field++;}
    }
  }
  if(st.bw.some(f=>f.o>4))A.bad.quota++;
  A.n++;A.runs+=st.runs;A.wk+=st.wkts;A.balls+=st.balls;A.tg+=target;A.win+=st.runs>=target?1:0;A.s.push([st.runs,target]);
}
// the standard T20 bot lofts 30% of balls on average, like the short-format bot, but more at the death as a chaser would
const LOFT_STD={pp:.3,mid:.25,death:.45},LOFT_ALL={pp:1,mid:1,death:1};
function t20Run(pk,diff,loftP,n){
  const A={n:0,runs:0,wk:0,balls:0,tg:0,win:0,s:[],plan:{},fields:0,bad:{captain:0,field:0,quota:0},ph:{}};
  for(const p of ['pp','mid','death'])A.ph[p]={r:0,b:0,w:0,f:0,s:0};
  for(let i=0;i<n;i++)t20Chase(pk,diff,loftP===1?LOFT_ALL:LOFT_STD,A);
  return A;
}
// random attacks, pars and per-over economies: the captain must always find a legal bowler for all 20 overs
function captainFuzz(n){
  let bad=0;const ds=['easy','medium','hard'];
  for(let k=0;k<n;k++){
    const d=ds[k%3],a=makeAttack(PLANET_ORDER[k%8],d),st=newT20(a,d,60+Math.random()*300);let prev=-1;
    for(let o=0;o<20;o++){
      const bi=captainPick(a,o,st);if(bi<0||bi===prev||st.bw[bi].o>=4){bad++;break;}
      prev=st.last=bi;st.bw[bi].o++;st.bw[bi].r+=Math.floor(Math.random()*(Math.random()<.3?36:16));
    }
  }
  return bad;
}
function fieldFuzz(n){
  let bad=0;const ids=Object.keys(TPL);
  for(let k=0;k<n;k++){
    setPlanet(PLANET_ORDER[k%8]);const pp=k%3===0,ok=ids.filter(id=>fieldOk(tplField(id),pp));
    let f=tplField(ok[k%ok.length]);
    for(let j=0;j<6;j++){f=adjust(f,Array.from({length:8},()=>Math.random()<.4?Math.random()*20:0),{pp,n:1+j%2}).field;if(!fieldOk(f,pp))bad++;}
  }
  return bad;
}
`;
const ctx = {console, Math};
vm.createContext(ctx);
vm.runInContext(logic + harness, ctx);

const fmt = r => `${r.rpb.toFixed(2).padStart(5)} rpb  ${r.bpo.toFixed(1).padStart(5)} balls/out  ${(r.fours*100).toFixed(0).padStart(3)}% 4s  ${(r.sixes*100).toFixed(0).padStart(3)}% 6s`;
const mix = r => ['Bowled', 'LBW', 'Stumped', 'caught', 'Played on'].map(k => `${k.toLowerCase()} ${Math.round((r.how[k] || 0) / r.outs * 100)}%`).join(', ');
let failures = 0;
const check = (label, v, lo, hi) => { if (v < lo || v > hi) { failures++; console.log(`  !! ${label} = ${v.toFixed(2)} outside expected ${lo}-${hi}`); } };

console.log(`\nBy difficulty on Earth (bot timing spread 45 ms, 30% lofted), ${N} balls each:`);
for (const d of ['easy', 'medium', 'hard']) {
  const r = ctx.bot('earth', d, 0.045, 0.3, N);
  console.log(`  ${d.padEnd(7)} ${fmt(r)}   AI 2-over target ~${ctx.aiTarget(d, 2, 3, 'earth').toFixed(1)}`);
}

console.log(`\nFootwork bots on Earth (medium), ${5 * N} balls each:`);
const fw = {};
for (const k of ['stationary', 'reads', 'charges', 'across']) {
  const r = fw[k] = ctx.bot('earth', 'medium', 0.045, 0.3, 5 * N, k);
  console.log(`  ${k.padEnd(10)} ${fmt(r)}  ${r.rpw.toFixed(1).padStart(5)} runs/wkt  (${mix(r)})`);
}
// Before footwork and LBW the stationary bot lasted ~24.7 balls per wicket here; LBW may not cut that by more than ~15%.
check('stationary balls/out', fw.stationary.bpo, 21, 32);
check('reads-length runs/wkt vs stationary', fw.reads.rpw / fw.stationary.rpw, 1.05, 1.25);
check('always-charges runs/wkt vs stationary', fw.charges.rpw / fw.stationary.rpw, 0, 1);
check('always-across runs/wkt vs stationary', fw.across.rpw / fw.stationary.rpw, 0, 1);

console.log(`\nBy planet (medium):`);
const earth = ctx.bot('earth', 'medium', 0.045, 0.3, N);
check('earth medium rpb', earth.rpb, 1.6, 2.6);
for (const pk of ctx.PLANET_ORDER) {
  const r = pk === 'earth' ? earth : ctx.bot(pk, 'medium', 0.045, 0.3, N);
  const ratio = r.rpb / earth.rpb, ai = ctx.PLANETS[pk].ai;
  console.log(`  ${pk.padEnd(8)} ${fmt(r)}   scoring vs Earth ${ratio.toFixed(2)}  AI target multiplier ${ai}`);
  check(`${pk} AI multiplier vs measured scoring ratio`, ai / ratio, 0.8, 1.25);
  check(`${pk} six rate`, r.sixes * 100, 1, 35);
}

const T20N = +process.env.T20_N || 600, t0 = Date.now();
const pct = v => `${(v * 100).toFixed(0).padStart(3)}%`;
const rpo = p => (p.r / Math.max(1, p.b) * 6).toFixed(1).padStart(5);
const t20fmt = A => `win ${pct(A.win / A.n)}  target ${(A.tg / A.n).toFixed(0).padStart(3)}  runs ${(A.runs / A.n).toFixed(0).padStart(3)}  wkts ${(A.wk / A.n).toFixed(1).padStart(4)}  ` +
  `balls/wkt ${(A.balls / Math.max(1, A.wk)).toFixed(0).padStart(3)}  per over: PP ${rpo(A.ph.pp)} mid ${rpo(A.ph.mid)} death ${rpo(A.ph.death)}  ` +
  `4s ${pct((A.ph.pp.f + A.ph.mid.f + A.ph.death.f) / (A.balls || 1))} 6s ${pct((A.ph.pp.s + A.ph.mid.s + A.ph.death.s) / (A.balls || 1))}`;
// the DIFF t20 multiplier that would put this row's win rate at `want`, from the same innings
const fitMul = (A, m, want) => {
  let lo = 0.5, hi = 2;
  for (let i = 0; i < 30; i++) { const x = (lo + hi) / 2, w = A.s.filter(([s, t]) => s >= Math.round((t - 1) * x / m) + 1).length / A.n; if (w > want) lo = x; else hi = x; }
  return lo;
};
const bad = {captain: 0, field: 0, quota: 0};
const addBad = A => { for (const k in bad) bad[k] += A.bad[k]; };
console.log(`\nT20 chases on Earth (20 overs, 10 wkts), ${T20N} innings each; std = 45 ms spread, lofts 30% (25% middle, 45% death); loft = always lofted:`);
// option B (owner): targets never fall as difficulty rises (~200 / ~215 / ~230 on Earth), so win rates spread wide
const BAND = {easy: [75, 100], medium: [40, 60], hard: [0, 25]};
for (const d of ['easy', 'medium', 'hard']) {
  const std = ctx.t20Run('earth', d, 0.3, T20N), loft = ctx.t20Run('earth', d, 1, T20N);
  addBad(std); addBad(loft);
  console.log(`  ${d.padEnd(7)}std  ${t20fmt(std)}${d === 'medium' ? `  (DIFF t20 for 50%: ${fitMul(std, ctx.DIFF[d].t20, 0.5).toFixed(3)})` : ''}`);
  console.log(`  ${''.padEnd(7)}loft ${t20fmt(loft)}`);
  check(`T20 ${d} standard win rate`, std.win / std.n * 100, ...BAND[d]);
  // both rows are scored against the same pooled targets, so target noise can't flip a small gap (hard: ~6% vs ~3%)
  const T = [...std.s, ...loft.s].map(x => x[1]), pw = A => A.s.reduce((w, [r]) => w + T.filter(t => r >= t).length, 0) / (A.n * T.length);
  if (d !== 'easy') check(`T20 ${d} always-loft minus standard win rate (pooled targets)`, (pw(loft) - pw(std)) * 100, -100, -0.01);
  check(`T20 ${d} death minus middle runs per over`, std.ph.death.r / std.ph.death.b * 6 - std.ph.mid.r / std.ph.mid.b * 6, 0.01, 99);
  const ov = Object.values(std.plan).reduce((a, b) => a + b, 0);
  if (d === 'medium') console.log(`  plans (share of overs): ${Object.entries(std.plan).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / ov * 100).toFixed(0)}%`).join(', ')}`);
}
console.log(`\nT20 by planet (medium, std), ${T20N >> 1} innings each; mean targets easy / medium / hard:`);
let eRuns = 0;
for (const pk of ctx.PLANET_ORDER) {
  const A = ctx.t20Run(pk, 'medium', 0.3, T20N >> 1);addBad(A);
  if (pk === 'earth') eRuns = A.runs / A.n;
  const ratio = A.runs / A.n / eRuns, m = ctx.PLANETS[pk].t20, tg = ['easy', 'medium', 'hard'].map(d => ctx.aiTarget(d, 20, 10, pk));
  console.log(`  ${pk.padEnd(8)} ${t20fmt(A)}  scoring vs Earth ${ratio.toFixed(2)}  T20 multiplier ${m}  targets ${tg.map(t => t.toFixed(0)).join(' / ')}`);
  check(`${pk} T20 multiplier vs measured scoring ratio`, m / ratio, 0.8, 1.25);
  check(`${pk} T20 targets easy <= medium <= hard`, Math.min(tg[1] - tg[0], tg[2] - tg[1]), 0, 1e9);
}
const cf = ctx.captainFuzz(20000), ff = ctx.fieldFuzz(5000);
console.log(`  captain: 20000 random innings, ${cf} without a legal bowler; fields: 30000 random adjustments, ${ff} illegal`);
console.log(`  restrictions in simulated play: ${bad.field} illegal fields, ${bad.captain} illegal bowler picks, ${bad.quota} quota breaches`);
check('captain fuzz failures', cf, 0, 0); check('field fuzz failures', ff, 0, 0);
for (const k in bad) check(`T20 ${k} violations`, bad[k], 0, 0);
console.log(`  T20 section took ${((Date.now() - t0) / 1000).toFixed(1)} s (T20_N=${T20N}; set T20_N to change)`);
console.log(failures ? `\n${failures} balance check(s) failed.` : '\nAll balance checks passed.');
process.exit(failures ? 1 : 0);
