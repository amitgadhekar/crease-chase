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
function bot(pk,diff,sigma,loftP,n,fb){
  const P=setPlanet(pk),mem={},ft={x:0,z:0},foot=FOOTBOTS[fb||'stationary'],how={};let runs=0,outs=0,balls=0,fours=0,sixes=0;
  const field=fieldFor([],diff).field;
  for(let i=0;i<n;i++){
    if(i%6===0)rollWind(P);
    const type=Math.random()<0.6?'pace':'spin';
    const b=makeDelivery(planBall(mem,type,diff,{last:[],foot:ft}),diff,Math.random()<.5?1:-1);
    const bp=foot&&foot(b),f=footAt(b,bp);let aim;    // bot picks a sensible shot for the ball as it meets it
    if(f.full>0.65)aim=Math.random()<.5?-85:85;else if(f.xc>0.2)aim=40+Math.random()*40;else if(f.xc<-0.05)aim=-40;else aim=(Math.random()-.5)*30;
    aim+=gauss()*12;const lofted=Math.random()<loftP;
    const sw={tc:f.t-0.005+gauss()*sigma,aim,power:lofted?0.85:0.65,lofted,defend:false,bp};
    const r=evalSwing(b,sw,diff,field),res=r.miss?beaten(b,bp,true):r.res;
    runs+=res.runs;if(!res.wide)balls++;if(res.boundary===4)fours++;if(res.boundary===6)sixes++;
    if(res.out){outs++;const k=/^Caught/.test(res.outText)?'caught':res.outText||'other';how[k]=(how[k]||0)+1;}
    footTrend(ft,bp);brainLearn(mem,b,res.runs,!!res.out);
  }
  return {rpb:runs/balls,bpo:balls/Math.max(1,outs),rpw:runs/Math.max(1,outs),fours:fours/balls,sixes:sixes/balls,how,outs};
}
globalThis.PLANET_ORDER=PLANET_ORDER;globalThis.PLANETS=PLANETS; // top-level consts are not context properties
function aiTarget(diff,overs,wkts,pk,isSuper){const P=setPlanet(pk);let t=0;for(let i=0;i<2000;i++)t+=simulateAI(overs,wkts,diff,P.ai,isSuper).runs;return t/2000+1;}
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
  console.log(`  ${d.padEnd(7)} ${fmt(r)}   AI 2-over target ~${ctx.aiTarget(d, 2, 3, 'earth', false).toFixed(1)}  super-over target ~${ctx.aiTarget(d, 1, 2, 'earth', true).toFixed(1)}`);
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
console.log(failures ? `\n${failures} balance check(s) failed.` : '\nAll balance checks passed.');
process.exit(failures ? 1 : 0);
