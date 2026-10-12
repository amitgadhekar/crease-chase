// Balance simulator: plays thousands of balls with a bot batter against the real game logic (src/logic.js).
// Usage: node tests/balance.mjs [balls]   (default 20000 per row)
// Exits with code 1 if a key number drifts outside its expected band, so it can guard balance changes.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const N = +process.argv[2] || 20000;
const logic = readFileSync(new URL('../src/logic.js', import.meta.url), 'utf8');

const harness = `
function bot(pk,diff,sigma,loftP,n){
  const P=setPlanet(pk);const mem={};let runs=0,outs=0,balls=0,fours=0,sixes=0,miss=0;
  const field=fieldFor([],diff).field;
  for(let i=0;i<n;i++){
    if(i%6===0)rollWind(P);
    const type=Math.random()<0.6?'pace':'spin';
    const b=makeDelivery(planBall(mem,type,diff,{last:[]}),diff,Math.random()<.5?1:-1);
    const c=ballPos(b,b.tIdeal);let aim;               // bot picks a sensible shot for the ball
    if(b.full>0.65)aim=Math.random()<.5?-85:85;else if(c.x>0.2)aim=40+Math.random()*40;else if(c.x<-0.05)aim=-40;else aim=(Math.random()-.5)*30;
    aim+=gauss()*12;const lofted=Math.random()<loftP;
    const sw={tc:b.tIdeal-0.005+gauss()*sigma,aim,power:lofted?0.85:0.65,lofted,defend:false};
    const r=evalSwing(b,sw,diff,field);let res;
    if(r.miss){miss++;res=b.onStumps?{runs:0,out:true}:(b.wide?{runs:1,wide:true}:{runs:0});}else res=r.res;
    runs+=res.runs;if(!res.wide)balls++;if(res.out)outs++;if(res.boundary===4)fours++;if(res.boundary===6)sixes++;
    brainLearn(mem,b,res.runs,!!res.out);
  }
  return {rpb:runs/balls,bpo:balls/Math.max(1,outs),fours:fours/balls,sixes:sixes/balls};
}
globalThis.PLANET_ORDER=PLANET_ORDER;globalThis.PLANETS=PLANETS; // top-level consts are not context properties
function aiTarget(diff,overs,wkts,pk,isSuper){const P=setPlanet(pk);let t=0;for(let i=0;i<2000;i++)t+=simulateAI(overs,wkts,diff,P.ai,isSuper).runs;return t/2000+1;}
`;
const ctx = {console, Math};
vm.createContext(ctx);
vm.runInContext(logic + harness, ctx);

const fmt = r => `${r.rpb.toFixed(2).padStart(5)} rpb  ${r.bpo.toFixed(1).padStart(5)} balls/out  ${(r.fours*100).toFixed(0).padStart(3)}% 4s  ${(r.sixes*100).toFixed(0).padStart(3)}% 6s`;
let failures = 0;
const check = (label, v, lo, hi) => { if (v < lo || v > hi) { failures++; console.log(`  !! ${label} = ${v.toFixed(2)} outside expected ${lo}-${hi}`); } };

console.log(`\nBy difficulty on Earth (bot timing spread 45 ms, 30% lofted), ${N} balls each:`);
for (const d of ['easy', 'medium', 'hard']) {
  const r = ctx.bot('earth', d, 0.045, 0.3, N);
  console.log(`  ${d.padEnd(7)} ${fmt(r)}   AI 2-over target ~${ctx.aiTarget(d, 2, 3, 'earth', false).toFixed(1)}  super-over target ~${ctx.aiTarget(d, 1, 2, 'earth', true).toFixed(1)}`);
}
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
