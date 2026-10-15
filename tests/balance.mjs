// Balance simulator: plays thousands of balls with a bot batter against the real game logic (src/logic.js).
// Usage: node tests/balance.mjs [balls]   (default 20000 per row; footwork rows play 5x that; T20_N and SCEN_N scale those sections)
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
function botBall(b,bp,diff,sigma,loftP,field,bat){
  const f=footAt(b,bp);let aim;    // bot picks a sensible shot for the ball as it meets it
  if(f.full>0.65)aim=Math.random()<.5?-85:85;else if(f.xc>0.2)aim=40+Math.random()*40;else if(f.xc<-0.05)aim=-40;else aim=(Math.random()-.5)*30;
  aim+=gauss()*12;const lofted=Math.random()<loftP;
  const sw={tc:f.t-0.005+gauss()*sigma,aim,power:lofted?0.85:0.65,lofted,defend:false,bp};
  const r=evalSwing(b,sw,diff,field,bat);return r.miss?beaten(b,r.bp||bp,true,bat):r.res;
}
function bot(pk,diff,sigma,loftP,n,fb){
  const P=setPlanet(pk),mem={},ft={x:0,z:0},foot=FOOTBOTS[fb||'stationary'],how={},hq={r:0,n:0};let runs=0,outs=0,balls=0,fours=0,sixes=0;
  const field=fieldFor([],diff).field;
  for(let i=0;i<n;i++){
    if(i%6===0)rollWind(P);
    const type=Math.random()<0.6?'pace':'spin';
    const b=makeDelivery(planBall(mem,type,diff,{last:[],foot:ft}),diff,Math.random()<.5?1:-1);
    const bp=foot&&foot(b),res=botBall(b,bp,diff,sigma,loftP,field);
    runs+=res.runs;if(!res.wide)balls++;if(res.boundary===4)fours++;if(res.boundary===6)sixes++;if(res.q>=0.85&&!res.lofted){hq.r+=res.runs;hq.n++;}
    if(res.out){outs++;const k=/^Caught/.test(res.outText)?'caught':res.outText||'other';how[k]=(how[k]||0)+1;}
    footTrend(ft,bp);brainLearn(mem,b,res.runs,!!res.out);
  }
  return {rpb:runs/balls,bpo:balls/Math.max(1,outs),rpw:runs/Math.max(1,outs),fours:fours/balls,sixes:sixes/balls,how,outs,hq:hq.r/Math.max(1,hq.n)};
}
globalThis.PLANET_ORDER=PLANET_ORDER;globalThis.PLANETS=PLANETS;globalThis.DIFF=DIFF; // top-level consts are not context properties
// fielding events (res.fplay) that could not happen: a fielder covering more ground than his run (from his reaction, or 1 s after
// his previous event, from where it ended) plus his hands, dive (at most his dive) or jump allows; hands not at the ball on a catch,
// drop, stop or fumble; a miss further than 1.2 m (dive) or 1 m (above a leap) from it; malformed fields
const FK=['run','take','dive','jump','slide','stop'],FO=['catch','drop','stop','fumble','miss',''];
function fplayBad(res,b,c,field,F){
  const E=res.fplay;if(!Array.isArray(E))return 1;let bad=0,t=-1;const last={},h=res.path&&preparePath(res.path,c,res.dir);
  for(const e of E){
    const f=field[e.i];if(!f||!FK.includes(e.k)||!FO.includes(e.o)||Math.abs(e.sd)!==1||e.t1<t){bad++;continue;}
    const k=fsk(f,F,b),p=last[e.i];t=e.t1;last[e.i]=e;
    if(p){if(e.t0<p.t1+1-1e-6)bad++;k.x=p.x;k.z=p.z;}
    if(e.t1<e.t0||e.t1<=0)bad++;
    k.re=e.t0;if(e.k==='run')k.mx=1e9;
    if(Math.hypot(e.x-k.x,e.z-k.z)>runD(k,e.t1)+HANDS+(e.k==='dive'||e.k==='slide'?e.e:e.k==='jump'?.3:0)+1e-3||e.e>k.dv+1e-6)bad++;
    if(!h||!e.o)continue;
    const q=hitPos(h,e.t1),g=Math.hypot(q.x-e.x,q.z-e.z);
    if(e.o==='miss'?g>1.2+1e-3||q.y-e.y>1+1e-3:g>0.02||Math.abs(Math.max(.05,q.y)-e.y)>0.02)bad++;
    if(e.o==='catch'&&(res.catcher!==e.i||Math.hypot(res.catchPt.x-e.x,res.catchPt.z-e.z)>1e-6))bad++;
  }
  return bad;
}
// the same balls (delivery, swing and random numbers) fielded at each level's skill (FS) on Earth, against the short-format ring
// field and the T20 templates: runs, catches, chances to the keeper and close catchers (edges in reach) and to deep fielders
function fieldSkill(n){
  setPlanet('earth');const F0={...FS},ids=Object.keys(TPL).filter(k=>!TPL[k].test),R0=Math.random,R={};
  for(const L in F0)R[L]={r:0,b:0,w:0,cc:0,ck:0,dc:0,dk:0,rope:0,lofts:0,bad:0};
  for(let i=0;i<n;i++){
    const field=i%2?fieldFor([],'medium').field:tplField(ids[i%ids.length]),type=Math.random()<0.6?'pace':'spin',
      b=makeDelivery(planBall({},type,'medium',{last:[],foot:null}),'medium',Math.random()<.5?1:-1),seed=Math.floor(Math.random()*4294967296);
    for(const L in F0){
      FS.medium=F0[L];Math.random=seeded(seed);const res=botBall(b,null,'medium',0.045,0.3,field),A=R[L];Math.random=R0;
      A.r+=res.runs;if(!res.wide)A.b++;if(res.out&&/^Caught/.test(res.outText))A.w++;if(res.lofted&&res.q!=null)A.lofts++;if(/^Caught on the rope/.test(res.sub||''))A.rope++;
      for(const e of res.fplay||[])if(e.o==='catch'||e.o==='drop'){const k=fsk(field[e.i],F0[L],b);if(k.cl){A.cc++;if(e.o==='catch')A.ck++;}if(k.dp){A.dc++;if(e.o==='catch')A.dk++;}}
    }
  }
  FS.medium=F0.medium;return R;
}
// fielding events of random balls on every planet and level, short-format, T20 and Test fields, batters of every tier (fends, bat-pad)
function fplayAudit(n){
  const ids=Object.keys(TPL),DS=['easy','medium','hard'];let bad=0,ev=0;
  for(let i=0;i<n;i++){
    const P=setPlanet(PLANET_ORDER[i%8]),d=DS[i%3];if(i%6===0)rollWind(P);
    const field=i%3?tplField(ids[i%ids.length]):fieldFor([],d).field,bat=i%2?{tier:'ABCDE'[i%5]}:undefined,
      b=makeDelivery(planBall({},Math.random()<0.6?'pace':'spin',d,{last:[],foot:null}),d,Math.random()<.5?1:-1),f=footAt(b,null);
    const sw=Math.random()<0.15?{tc:f.t-0.005+gauss()*0.045,aim:0,power:0.3,lofted:false,defend:true,bp:null}
      :{tc:f.t-0.005+gauss()*0.06,aim:rnd(-180,180),power:rnd(0.3,1),lofted:Math.random()<0.4,defend:false,bp:null};
    const r=evalSwing(b,sw,d,field,bat);if(r.miss)continue;ev+=r.res.fplay.length;bad+=fplayBad(r.res,b,f.c,field,FS[d]);
  }
  return {bad,ev};
}
function aiTarget(diff,overs,wkts,pk){const P=setPlanet(pk);let t=0;for(let i=0;i<2000;i++)t+=simulateAI(overs,wkts,diff,P.ai).runs;return t/2000+1;}

// T20 first innings: the player's attack (bowled by a bot) against the AI batters, through simRest. Bowling bots: std = the
// auto-bowler (plan's mix, marker allowing for movement, release error sd 0.09 of the meter, a human tap); acc = the same with
// sd 0.05; careless = random option and marker, sd 0.2; yorker / bouncer / spot = the same ball every time (spinners: stock
// yorker, quicker one short, stock on a good length)
function bowlBot(kind){
  if(kind==='std')return null;
  if(kind==='acc')return (st,bw)=>autoBowl(st,bw,0.05);
  if(kind==='careless')return (st,bw)=>({o:bw.opts[Math.floor(Math.random()*bw.opts.length)],m:{x:rnd(-0.6,0.9),z:rnd(1,11)},rel:gauss()*0.2});
  const one=(k,z,xt)=>(st,bw)=>{const o=bw.opts.find(o=>o.k===k)||bw.opts[0];return {o,m:spotFor(bw,o,z,xt),rel:gauss()*0.09};};
  if(kind==='yorker')return one('yorker',1.6,0.05);
  if(kind==='bouncer')return (st,bw)=>bw.type==='pace'?one('bouncer',10.1,0)(st,bw):one('quick',8,0)(st,bw);
  if(kind==='spot')return one('stock',5.4,0.12);
}
// one first innings; legality of the auto-captain's picks (bowler, field) is checked every over
function inn1Sim(pk,diff,kind,A){
  setPlanet(pk);const mine=myAttack(pk),st=newInn1(mine,aiXI(pk,makeAttack(pk,diff)),diff,pk);
  simRest(st,mine,bowlBot(kind),(st,bw,ph)=>{
    const o=Math.floor(st.balls/6),bi=mine.indexOf(bw),id=planPick(bw,ph,st,st.foot).id;
    if(!legalBowlers(st,o).includes(bi)||st.bw[bi].o>=4)A.bad.captain++;
    A.fields++;if(!fieldOk(tplField(id),ph==='pp'))A.bad.field++;
    return id;});
  if(st.bw.some(f=>f.o>4))A.bad.quota++;
  A.n++;A.runs+=st.runs;A.wk+=st.wkts;A.balls+=st.balls;A.s.push(st.runs);
  for(let o=0;o<20;o++)if(st.ov[o]){const p=phaseOf(o);A.ph[p].r+=st.ov[o].r;A.ph[p].b+=6;if(o&&st.ov[o-1]&&st.ov[o-1].b===st.ov[o].b)A.bad.consec++;}
  return st;
}
function newAcc(){const A={n:0,runs:0,wk:0,balls:0,tg:0,win:0,s:[],plan:{},fields:0,bad:{captain:0,field:0,quota:0,consec:0},ph:{}};for(const p of ['pp','mid','death'])A.ph[p]={r:0,b:0,w:0,f:0,s:0,t:{}};return A;}
function bowlRun(pk,diff,kind,n){const A=newAcc();for(let i=0;i<n;i++)inn1Sim(pk,diff,kind,A);return A;}
// field plans: every ball of std innings is also played, with the same random numbers, against a random legal field for the
// over (same delivery and bowling plan; the AI batter sees that field). Paired, so a few per cent shows above the noise
function fieldPair(pk,diff,n){
  const R={cap:{r:0,w:0},rnd:{r:0,w:0},n:0},R0=Math.random;
  for(let i=0;i<n;i++){setPlanet(pk);const mine=myAttack(pk),st=newInn1(mine,aiXI(pk,makeAttack(pk,diff)),diff,pk);let rf=null;
    simRest(st,mine,(st,bw)=>{
      const o=Math.floor(st.balls/6);if(!rf||rf.o!==o){const ids=planIds(bw,o<6);rf={o,f:tplField(ids[Math.floor(Math.random()*ids.length)])};}
      const c=autoBowl(st,bw),seed=Math.floor(Math.random()*4294967296);
      for(const [k,f] of [['cap',st.field],['rnd',rf.f]]){Math.random=seeded(seed);const b=bowlDelivery(bw,c.o,c.m,c.rel,st.diff),res=aiResult(b,aiBat(st,b,f),f,{tier:st.bat[st.s].tier,t20:1});R[k].r+=res.runs;R[k].w+=res.out?1:0;}
      Math.random=R0;R.n++;return c;});
  }
  return R;
}

// T20 chase: the bot bats 120 balls / 10 wickets against captain, plans and fields, as whoever is on strike (the XI's tiers,
// strike rotation in t20Record; no Hold), to the target set by the first innings. It keeps batting after reaching the target
// so every innings measures a full 20 overs; the win is runs >= target.
function t20Chase(pk,diff,loft,A,target){
  const P=setPlanet(pk),attack=makeAttack(pk,diff),st=newT20(attack,diff,target),
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
      const tier=st.bat[st.s].tier,res=botBall(b,null,diff,0.045,loft[ph],field,{tier,t20:1}),R=A.ph[ph],T=R.t[tier]||(R.t[tier]={r:0,b:0});
      last.push(b.len);if(last.length>3)last.shift();
      brainLearn(st.mem,b,res.runs,!!res.out);footTrend(ft,null);zoneAdd(Z,res.out?null:res.dir,res.runs);
      R.r+=res.runs;T.r+=res.runs;if(!res.wide){R.b++;T.b++;}if(res.out)R.w++;if(res.boundary===4)R.f++;if(res.boundary===6)R.s++;
      done=t20Record(st,bi,res);
      if(res.boundary&&!done){field=adjust(field,Z,{pp,n:1}).field;A.fields++;if(!fieldOk(field,pp))A.bad.field++;}
    }
  }
  if(st.bw.some(f=>f.o>4))A.bad.quota++;
  A.n++;A.runs+=st.runs;A.wk+=st.wkts;A.balls+=st.balls;A.tg+=target;A.win+=st.runs>=target?1:0;A.s.push([st.runs,target]);
}
// the standard T20 bot lofts 30% of balls on average, like the short-format bot, but more at the death as a chaser would
const LOFT_STD={pp:.3,mid:.25,death:.45},LOFT_ALL={pp:1,mid:1,death:1};
// full matches: the std bowling bot's first innings sets each target (I = its accumulator), then the chase
function t20Run(pk,diff,loftP,n,I){
  const A=newAcc();
  for(let i=0;i<n;i++)t20Chase(pk,diff,loftP===1?LOFT_ALL:LOFT_STD,A,inn1Sim(pk,diff,'std',I||newAcc()).runs+1);
  return A;
}
// Scenario bots. std: the short-format bot (swings at everything; lofts 30% when surviving, more as the asking rate climbs; in a
// session of a staged chase the rate is the session's par).
// farm: std plus strike farming: with a tail-ender at the other end, the set batter keeps the ball on the ground (unless the
// asking rate is above a run a ball), holds odd runs on balls 1-4 (the tail-ender would face the rest of the over) and takes a
// single at the end of it; a tail-ender with a set partner blocks (quick singles
// welcome) unless the last over or the asking rate forces him to swing (along the ground, for a single), and holds a last-ball single.
// careful: survival play: ducks bouncers at the body, leaves outside off (judged with noise), blocks the rest. slog: always lofts.
function scenShot(st,b,field,kind){
  const o=st.sc.obj,bat={tier:st.bat[st.s].tier},left=Math.max(1,o.balls-st.balls),need=o.type==='session'?o.par-st.runs:o.target!=null?o.target-st.runs:0,
    surv=o.type==='survive',rr=surv?0:need/left,last=st.ob===5,tS=isTail(st,st.s),tN=isTail(st,st.ns),sig=0.045;
  const block=()=>{const f=footAt(b,null),r=evalSwing(b,{tc:f.t-0.005+gauss()*sig,aim:0,power:0.3,lofted:false,defend:true,bp:null},st.diff,field,bat);return r.miss?beaten(b,null,true,bat):r.res;};
  if(kind==='careful'){
    const k=bodyHit(b,null);
    if(k&&k.y>1.15+gauss()*0.1){b.duck=true;return {res:beaten(b,null,false,bat)};}
    if(ballPos(b,b.tStumps).x+gauss()*0.06>0.24)return {res:beaten(b,null,false,bat)};
    return {res:block()};
  }
  const farm=kind==='farm'&&tS!==tN,loftP=kind==='slog'?1:farm&&(tS||rr<=1)?0:surv?0.3:clamp(0.1+0.3*rr,0.1,0.8);
  if(farm&&tS&&(surv||rr<1.2&&left>6)){const r=block();return {res:r,hold:last};}
  const res=botBall(b,null,st.diff,sig,loftP,field,bat);
  return {res,hold:farm&&(tS?last:st.ob<4)&&(surv||res.runs<need)};
}
// plays one scenario (and, for a staged chase, the sessions after it, carrying the state) to its result
function scenPlay(sc,kind,A){
  let cur=sc,st=newTest(sc),e;
  for(;;){
    const P=setPlanet(cur.planet);
    while(!(e=scenEnd(st))){
      if(st.bi<0)rollWind(P);
      if(A&&st.bi<0){const o=st.ovs;testOver(st);if(o>0&&st.bi===A.prevB)A.consec++;A.prevB=st.bi;}
      const {b,field}=testBall(st),{res,hold}=scenShot(st,b,field,kind);
      testRecord(st,b,res,hold,null);
    }
    if(A){A.vb+=st.viol.bouncer;A.vf+=st.viol.field;A.balls+=st.balls;A.newBall+=st.newBall;}
    const nx=A&&A.chain&&e.result==='draw'&&stageNext(cur,st);
    if(!nx)break;
    cur=nx;st=newTest(nx);if(A)A.prevB=-1;
  }
  return {e,st};
}
function scenRun(sc,kind,n,chain){
  const A={n,met:0,res:{win:0,draw:0,tie:0,loss:0},stars:0,runs:0,balls:0,vb:0,vf:0,newBall:0,consec:0,prevB:-1,chain};
  for(let i=0;i<n;i++){A.prevB=-1;const {e,st}=scenPlay(sc,kind,A);A.met+=e.met?1:0;A.res[e.result]++;A.stars+=scenStars(st,e);A.runs+=st.runs;}
  return A;
}
// delivery statistics under Test conditions: one archetype at a given day and ball age
function condStats(arch,day,age,n){
  setPlanet('earth');const bw={...ARCH[arch],...TARCH[arch],i:0,arch},C={day,ballAge:age},S={sw:0,rev:0,revN:0,seam:0,turn:0,e:[],n};
  for(let i=0;i<n;i++){
    const p=planBall({},bw.type,'medium',{bw,plan:{id:bw.type==='pace'?'SC':'SR',mix:TPL[bw.type==='pace'?'SC':'SR']},cond:C}),b=makeDelivery(p,'medium',bw,C);
    S.sw+=Math.abs(b.swC);if(b.swR){S.revN++;S.rev+=Math.abs(b.swR);}S.seam+=Math.abs(b.seam);S.turn+=Math.abs(b.turn);S.e.push(b.eK);
  }
  const m=S.e.reduce((a,x)=>a+x,0)/n;
  return {sw:S.sw/n,rev:S.rev/n,revShare:S.revN/n,seam:S.seam/n,turn:S.turn/n,bsd:Math.sqrt(S.e.reduce((a,x)=>a+(x-m)*(x-m),0)/n)};
}
// around the wicket (express, good length at the stumps): share pitching outside leg (no LBW) and LBW-eligible pad hits
function arStats(ar,n){
  setPlanet('earth');const bw={...ARCH.express,i:0,arch:'express'},C={day:2,ballAge:30};let leg=0,lbw=0;
  for(let i=0;i<n;i++){const b=makeDelivery({type:'pace',len:'G',line:'mid',ar,fat:0},'medium',bw,C),h=padHit(b,null);if(b.xb<-STUMP_HALF)leg++;if(h&&padResult(b,h,false).out)lbw++;}
  return {leg:leg/n,lbw:lbw/n};
}
// fatigue: mean speed and line spread of an express bowler, fresh or spent
function fatStats(fat,n){
  setPlanet('earth');const bw={...ARCH.express,i:0,arch:'express'},C={day:2,ballAge:30};let v=0,x=0,x2=0;
  for(let i=0;i<n;i++){const b=makeDelivery({type:'pace',len:'G',line:'off',fat},'medium',bw,C);v+=b.kmh;x+=b.xt;x2+=b.xt*b.xt;}
  return {kmh:v/n,sd:Math.sqrt(x2/n-(x/n)*(x/n))};
}
// the captain takes the new ball when it is due at 80 overs
function newBallCheck(){
  const sc={...SCEN[0],ballAge:79,obj:{type:'survive',balls:24,wkts:1}},st=newTest(sc);setPlanet(sc.planet);
  while(!scenEnd(st)){const {b}=testBall(st);testRecord(st,b,{runs:0,label:'Blocked',cls:'dot'},false,null);}
  return {taken:st.newBall,age:st.cond.ballAge};
}
// sweeps against an off-spinner (A tier, day 4): aim null = the standard bot; otherwise every full ball is swept at that aim
function sweepRow(aim,loft,fid,n){
  setPlanet('earth');const bw={...ARCH.off,i:0,arch:'off'},C={day:4,ballAge:30},field=tplField(fid),bat={tier:'A'};let runs=0,balls=0,outs=0,lbw=0;
  for(let i=0;i<n;i++){
    const b=makeDelivery(planBall({},'spin','medium',{bw,plan:{id:'SR',mix:TPL.SR},cond:C}),'medium',bw,C),f=footAt(b,null);let r;
    if(aim!=null&&f.full<=SWEEP_FULL){const e=evalSwing(b,{tc:f.t-0.005+gauss()*0.045,aim:aim+gauss()*8,power:0.65,lofted:loft,defend:false,bp:null},'medium',field,bat);r=e.miss?beaten(b,e.bp||null,true,bat):e.res;}
    else r=botBall(b,null,'medium',0.045,0.3,field,bat);
    runs+=r.runs;if(!r.wide)balls++;if(r.out){outs++;if(r.outText==='LBW')lbw++;}
  }
  return {rpb:runs/balls,bpo:balls/Math.max(1,outs),lbw:lbw/Math.max(1,outs)};
}
// Test fields: every template legal, and the captain's adjustments keep them legal on every planet
function testFieldFuzz(n){
  let bad=0;const ids=Object.keys(TPL).filter(k=>TPL[k].test);
  for(const id of ids)for(const pk of PLANET_ORDER){setPlanet(pk);if(!fieldOkTest(tplField(id)))bad++;}
  for(let k=0;k<n;k++){setPlanet(PLANET_ORDER[k%8]);let f=tplField(ids[k%ids.length]);
    for(let j=0;j<6;j++){f=adjust(f,Array.from({length:8},()=>Math.random()<.4?Math.random()*20:0),{ok:fieldOkTest,n:1+j%2}).field;if(!fieldOkTest(f))bad++;}}
  return bad;
}
// the band is measured with the play the objective asks for: careful for survive, the standard bot otherwise
const bandBot=sc=>sc.obj.type==='survive'?'careful':'std';
globalThis.SCEN=SCEN;globalThis.TPL=TPL;globalThis.TIER=TIER;globalThis.NEW_BALL=NEW_BALL;globalThis.bandBot=bandBot;
// random attacks, pars and per-over economies: the captain must always find a legal bowler for all 20 overs. Batting first (the
// player's attack, no target), the player may pick any bowler legalBowlers offers: random legal picks must never run out
function captainFuzz(n){
  let bad=0;const ds=['easy','medium','hard'];
  for(let k=0;k<n;k++){
    const d=ds[k%3],pk=PLANET_ORDER[k%8],mine=k%2,a=mine?myAttack(pk):makeAttack(pk,d),st=mine?newInn1(a,XI,d,pk):newT20(a,d,60+Math.random()*300);let prev=-1;
    for(let o=0;o<20;o++){
      const L=legalBowlers(st,o),bi=mine&&k%4===1?L[Math.floor(Math.random()*L.length)]:captainPick(a,o,st);
      if(bi==null||bi<0||bi===prev||st.bw[bi].o>=4){bad++;break;}
      prev=st.last=bi;st.bw[bi].o++;const r=Math.floor(Math.random()*(Math.random()<.3?36:16));st.bw[bi].r+=r;st.runs+=r;st.balls+=6;
    }
  }
  return bad;
}
function fieldFuzz(n){
  let bad=0;const ids=Object.keys(TPL);
  for(let k=0;k<n;k++){
    setPlanet(PLANET_ORDER[k%8]);const pp=k%3===0,ok=ids.filter(id=>fieldOk(tplField(id),pp));
    for(const t of ['pace','spin'])for(const id of planIds({type:t},pp))if(!fieldOk(tplField(id),pp))bad++;
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
// runs per well-timed ground shot (q >= 0.85) before fielding v2: stronger fielding must not take them away from good shots
const HQ0 = {easy: 1.43, medium: 1.21, hard: 0.99};
for (const d of ['easy', 'medium', 'hard']) {
  const r = ctx.bot('earth', d, 0.045, 0.3, N);
  console.log(`  ${d.padEnd(7)} ${fmt(r)}   AI 2-over target ~${ctx.aiTarget(d, 2, 3, 'earth').toFixed(1)}   well-timed ground shots ${r.hq.toFixed(2)} runs (was ${HQ0[d]})`);
  check(`${d} runs per well-timed ground shot vs before fielding v2`, r.hq / HQ0[d], 0.95, 9);
}

console.log(`\nFielding: the same ${N} balls (deliveries, swings, random numbers) fielded at each level's skill, Earth, ring field and T20 templates:`);
const FSK = ctx.fieldSkill(N), fpc = (k, n) => `${(k / Math.max(1, n) * 100).toFixed(0).padStart(3)}%`;
for (const d of ['easy', 'medium', 'hard']) { const A = FSK[d];
  console.log(`  ${d.padEnd(7)} ${(A.r / A.b).toFixed(3)} rpb  caught ${(A.w / A.b * 1000).toFixed(1).padStart(5)} per 1000 balls  keeper/close chances taken ${fpc(A.ck, A.cc)} of ${A.cc}  deep chances taken ${fpc(A.dk, A.dc)} of ${A.dc}  rope catches ${(A.rope / Math.max(1, A.lofts) * 100).toFixed(1)}% of lofts`); }
check('fielding: easy minus medium runs per ball (same balls)', FSK.easy.r / FSK.easy.b - FSK.medium.r / FSK.medium.b, 0.01, 9);
check('fielding: medium minus hard runs per ball (same balls)', FSK.medium.r / FSK.medium.b - FSK.hard.r / FSK.hard.b, 0.01, 9);
check('fielding: catches medium minus easy (per 1000 balls)', (FSK.medium.w / FSK.medium.b - FSK.easy.w / FSK.easy.b) * 1000, 0.5, 99);
check('fielding: catches hard minus medium (per 1000 balls)', (FSK.hard.w / FSK.hard.b - FSK.medium.w / FSK.medium.b) * 1000, 0.5, 99);
for (const d of ['easy', 'medium', 'hard']) {
  check(`fielding ${d}: keeper and close catchers take chances in reach (%)`, FSK[d].ck / FSK[d].cc * 100, ...{easy: [50, 80], medium: [58, 85], hard: [65, 90]}[d]);
  check(`fielding ${d}: deep fielders take running catches in reach (%)`, FSK[d].dk / FSK[d].dc * 100, ...{easy: [55, 85], medium: [60, 88], hard: [65, 92]}[d]);
  check(`fielding ${d}: rope catches (% of lofts)`, FSK[d].rope / FSK[d].lofts * 100, 0.3, 10);
}
const AU = ctx.fplayAudit(N);
console.log(`  fielding events of ${N} random balls (every planet and level, all fields, every tier): ${AU.ev} events, ${AU.bad} impossible`);
check('impossible fielding events', AU.bad, 0, 0);

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

const T20N = +process.env.T20_N || 300, t0 = Date.now();
const pct = v => `${(v * 100).toFixed(0).padStart(3)}%`;
const rpo = p => (p.r / Math.max(1, p.b) * 6).toFixed(1).padStart(5);
const mean = A => A.runs / A.n;
const bfmt = A => { const m = mean(A), sd = Math.sqrt(A.s.reduce((a, x) => a + (x - m) * (x - m), 0) / A.n);
  return `total ${m.toFixed(0).padStart(3)} (sd ${sd.toFixed(0).padStart(2)})  wkts ${(A.wk / A.n).toFixed(1).padStart(4)}  balls ${(A.balls / A.n).toFixed(0).padStart(3)}  per over: PP ${rpo(A.ph.pp)} mid ${rpo(A.ph.mid)} death ${rpo(A.ph.death)}`; };
const t20fmt = A => `win ${pct(A.win / A.n)}  target ${(A.tg / A.n).toFixed(0).padStart(3)}  runs ${(A.runs / A.n).toFixed(0).padStart(3)}  wkts ${(A.wk / A.n).toFixed(1).padStart(4)}  ` +
  `balls/wkt ${(A.balls / Math.max(1, A.wk)).toFixed(0).padStart(3)}  per over: PP ${rpo(A.ph.pp)} mid ${rpo(A.ph.mid)} death ${rpo(A.ph.death)} (${deathGain(A).toFixed(1).padStart(4)} same batters)  ` +
  `4s ${pct((A.ph.pp.f + A.ph.mid.f + A.ph.death.f) / (A.balls || 1))} 6s ${pct((A.ph.pp.s + A.ph.mid.s + A.ph.death.s) / (A.balls || 1))}`;
// the tail bats more of the death overs, so the death is compared with the middle overs tier by tier (weighted by death balls)
const deathGain = A => { const D = A.ph.death.t, Md = A.ph.mid.t; let g = 0, n = 0;
  for (const k in D) if (Md[k] && Md[k].b) { g += D[k].r - D[k].b * Md[k].r / Md[k].b; n += D[k].b; } return g / Math.max(1, n) * 6; };
const bad = {captain: 0, field: 0, quota: 0, consec: 0};
const addBad = A => { for (const k in bad) bad[k] += A.bad[k] || 0; };
const DS = ['easy', 'medium', 'hard'];

console.log(`\nT20 first innings on Earth: the player's attack (bot) vs the AI batters, ${T20N} innings per row (variants ${T20N >> 1});` +
  ` std = auto-bowler, release sd 0.09 of the meter; acc 0.05; careless = random option, marker, sd 0.2; yorker/bouncer/spot = same ball every time:`);
const B = {};
for (const d of DS) {
  B[d] = {std: ctx.newAcc()};
  B[d].match = ctx.t20Run('earth', d, 0.3, T20N, B[d].std); addBad(B[d].std); addBad(B[d].match);
  const kinds = d === 'easy' ? [] : [...(d === 'medium' ? ['acc', 'careless'] : []), 'yorker', 'bouncer', 'spot'];
  for (const k of kinds) { B[d][k] = ctx.bowlRun('earth', d, k, T20N >> 1); addBad(B[d][k]); }
  for (const k in B[d]) if (k !== 'match') console.log(`  ${d.padEnd(7)}${k.padEnd(10)}${bfmt(B[d][k])}`);
}
// option B (owner): first-innings totals, i.e. targets, never fall as difficulty rises; the old fixed targets were ~157 / ~166 / ~184
check('Earth medium AI total (std bowling)', mean(B.medium.std), 140, 200);
check('Earth AI totals easy <= medium <= hard', Math.min(mean(B.medium.std) - mean(B.easy.std), mean(B.hard.std) - mean(B.medium.std)), 0, 1e9);
check('accurate bowling vs careless (total ratio)', mean(B.medium.acc) / mean(B.medium.careless), 0, 0.9);
for (const d of ['medium', 'hard']) for (const k of ['yorker', 'bouncer', 'spot']) check(`${d}: always ${k} minus standard (runs conceded)`, mean(B[d][k]) - mean(B[d].std), 0.01, 1e9);
for (const d of ['medium', 'hard']) {
  const R = ctx.fieldPair('earth', d, T20N >> 1), f = k => `${(R[k].r / R.n).toFixed(3)} runs, ${(R[k].w / R.n * 100).toFixed(2)}% wickets per ball`;
  console.log(`  ${d.padEnd(7)}field plans, ${R.n} balls each: captain's ${f('cap')}; random legal field ${f('rnd')}`);
  check(`${d}: random legal field minus captain's plan (runs per ball, same deliveries)`, (R.rnd.r - R.cap.r) / R.n, 0.01, 9);
}

console.log(`\nT20 full matches on Earth: std bowling bot innings, then the chase; std = 45 ms spread, lofts 30% (25% middle, 45% death); loft = always lofted:`);
const BAND = {easy: [75, 100], medium: [40, 60], hard: [0, 25]};
for (const d of DS) {
  const std = B[d].match, loft = d === 'easy' ? null : ctx.t20Run('earth', d, 1, T20N);
  if (loft) addBad(loft);
  console.log(`  ${d.padEnd(7)}std  ${t20fmt(std)}`);
  if (loft) console.log(`  ${''.padEnd(7)}loft ${t20fmt(loft)}`);
  check(`T20 ${d} standard win rate`, std.win / std.n * 100, ...BAND[d]);
  // both rows are scored against the same pooled targets, so target noise can't flip a small gap
  if (loft) { const T = [...std.s, ...loft.s].map(x => x[1]), pw = A => A.s.reduce((w, [r]) => w + T.filter(t => r >= t).length, 0) / (A.n * T.length);
    check(`T20 ${d} always-loft minus standard win rate (pooled targets)`, (pw(loft) - pw(std)) * 100, -100, -0.01); }
  // not on hard: the bot's top order is rarely still in at the death there, too noisy to check
  if (d !== 'hard') check(`T20 ${d} death minus middle runs per over, same batters`, deathGain(std), 0.01, 99);
  const ov = Object.values(std.plan).reduce((a, b) => a + b, 0);
  if (d === 'medium') console.log(`  AI plans in the chase (share of overs): ${Object.entries(std.plan).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / ov * 100).toFixed(0)}%`).join(', ')}`);
}
const PN = Math.round(T20N * 2 / 3);
console.log(`\nT20 by planet, ${PN} each: full matches on medium; first-innings totals (std bowling) easy / medium / hard:`);
for (const pk of ctx.PLANET_ORDER) {
  const I = {}, A = pk === 'earth' ? null : ctx.t20Run(pk, 'medium', 0.3, PN, I.medium = ctx.newAcc());
  if (A) { addBad(A); addBad(I.medium); for (const d of ['easy', 'hard']) { I[d] = ctx.bowlRun(pk, d, 'std', PN); addBad(I[d]); } }
  const M = A || B.medium.match, tg = DS.map(d => mean(pk === 'earth' ? B[d].std : I[d]));
  console.log(`  ${pk.padEnd(8)} ${t20fmt(M)}  totals ${tg.map(t => t.toFixed(0)).join(' / ')}`);
  if (A) check(`${pk} T20 medium standard win rate`, A.win / A.n * 100, 35, 65);
  check(`${pk} T20 totals easy <= medium <= hard`, Math.min(tg[1] - tg[0], tg[2] - tg[1]), 0, 1e9);
}
const cf = ctx.captainFuzz(20000), ff = ctx.fieldFuzz(5000);
console.log(`  captain: 20000 random innings (half of them the player's attack, a quarter random legal picks), ${cf} without a legal bowler; fields: 30000 random adjustments and every offered plan, ${ff} illegal`);
console.log(`  restrictions in simulated play: ${bad.field} illegal fields, ${bad.captain} illegal bowler picks, ${bad.consec} consecutive overs, ${bad.quota} quota breaches`);
check('captain fuzz failures', cf, 0, 0); check('field fuzz failures', ff, 0, 0);
for (const k in bad) check(`T20 ${k} violations`, bad[k], 0, 0);
console.log(`  T20 section took ${((Date.now() - t0) / 1000).toFixed(1)} s (T20_N=${T20N}; set T20_N to change)`);

// ---------- Tests: conditions, rules, shots and scenarios ----------
const t1 = Date.now();
// Short formats and T20 must not change when Test code is added: the same seeded rows hash the same as before the Test code.
// Update FP only when short-format or T20 balance is changed on purpose.
const FP = '96fcd588';
{
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const SM = Object.create(Math); SM.random = mulberry(20261014);
  const c = {console, Math: SM}; vm.createContext(c); vm.runInContext(logic + harness, c);
  const out = [];
  for (const d of ['easy', 'medium', 'hard']) out.push(c.bot('earth', d, 0.045, 0.3, 4000));
  out.push(c.bot('earth', 'medium', 0.045, 0.3, 4000, 'reads'), c.bot('mars', 'medium', 0.045, 0.3, 3000));
  for (const [pk, d, l, n] of [['earth', 'medium', 0.3, 12], ['venus', 'hard', 1, 6]]) { const t = c.t20Run(pk, d, l, n); out.push({r: t.runs, w: t.wk, b: t.balls, tg: t.tg, win: t.win}); }
  const js = JSON.stringify(out, (k, v) => typeof v === 'number' ? +v.toFixed(9) : v);
  let h = 0x811c9dc5; for (let i = 0; i < js.length; i++) { h ^= js.charCodeAt(i); h = Math.imul(h, 16777619); }
  const fp = (h >>> 0).toString(16);
  console.log(`\nShort formats and T20 unchanged by Test code: seeded fingerprint ${fp} (expected ${FP})`);
  if (fp !== FP) { failures++; console.log('  !! short-format or T20 numbers changed'); }
}

const f3 = v => v.toFixed(3);
console.log('\nTest conditions (Earth, medium, 20000 deliveries each):');
const ages = [0, 10, 20, 30, 40, 60, 79].map(a => ({a, s: ctx.condStats('swing', 2, a, 20000), x: ctx.condStats('express', 2, a, 20000)}));
console.log('  ball age   ' + ages.map(r => String(r.a).padStart(6)).join(''));
console.log('  swing |m|  ' + ages.map(r => f3(r.s.sw).padStart(6)).join('') + '   (swing bowler, conventional)');
console.log('  reverse    ' + ages.map(r => f3(r.x.rev).padStart(6)).join('') + '   (express, mean over all balls)');
console.log('  rev share  ' + ages.map(r => r.x.revShare.toFixed(2).padStart(6)).join(''));
console.log('  seam |m|   ' + ages.map(r => f3(r.s.seam).padStart(6)).join(''));
for (let i = 1; i < 4; i++) check(`swing falls with ball age (${ages[i].a} vs ${ages[i - 1].a} overs)`, ages[i - 1].s.sw - ages[i].s.sw, 1e-3, 9);
check('swing at 30 overs vs new ball', ages[3].s.sw / ages[0].s.sw, 0, 0.3);
check('no reverse swing before 35 overs', ages[3].x.revShare, 0, 0);
check('reverse swing at 60 overs (m)', ages[5].x.rev, 0.04, 1);
check('reverse grows from 40 to 60 overs', ages[5].x.rev - ages[4].x.rev, 1e-3, 9);
const days = [1, 2, 3, 4, 5].map(d => ({d, o: ctx.condStats('off', d, 30, 20000), l: ctx.condStats('leg', d, 30, 20000), p: ctx.condStats('swing', d, 30, 20000)}));
console.log('  day        ' + days.map(r => String(r.d).padStart(6)).join(''));
console.log('  turn |m|   ' + days.map(r => f3(r.o.turn).padStart(6)).join('') + '   (off-spin)');
console.log('  turn |m|   ' + days.map(r => f3(r.l.turn).padStart(6)).join('') + '   (leg-spin)');
console.log('  bounce sd  ' + days.map(r => f3(r.o.bsd).padStart(6)).join('') + '   (spin, x bounce)');
console.log('  bounce sd  ' + days.map(r => f3(r.p.bsd).padStart(6)).join('') + '   (pace)');
const ar = [false, true].map(a => ctx.arStats(a, 20000)), fs = [0, 1].map(f => ctx.fatStats(f, 20000)), nb = ctx.newBallCheck();
console.log(`  around the wicket: pitched outside leg ${(ar[1].leg * 100).toFixed(0)}% (over ${(ar[0].leg * 100).toFixed(0)}%), LBW if padded ${(ar[1].lbw * 100).toFixed(1)}% (over ${(ar[0].lbw * 100).toFixed(1)}%)`);
console.log(`  fatigue (express): ${fs[0].kmh.toFixed(0)} km/h, line sd ${f3(fs[0].sd)} fresh; ${fs[1].kmh.toFixed(0)} km/h, line sd ${f3(fs[1].sd)} spent`);
console.log(`  new ball: due at ${ctx.NEW_BALL} overs, taken ${nb.taken}x in a scenario starting at 79 (ball age now ${nb.age})`);
check('around the wicket pitches outside leg more often', ar[1].leg - ar[0].leg, 0.05, 1);
check('fatigue costs pace (km/h)', fs[0].kmh - fs[1].kmh, 1, 20);
check('fatigue costs accuracy (line sd)', fs[1].sd - fs[0].sd, 0.005, 1);
check('new ball taken at 80 overs', nb.taken, 1, 1);
for (let i = 1; i < 5; i++) {
  check(`turn rises with the day (day ${i + 1} vs ${i})`, days[i].o.turn - days[i - 1].o.turn, 1e-3, 9);
  check(`bounce variance rises with the day (day ${i + 1} vs ${i})`, days[i].o.bsd - days[i - 1].o.bsd, 1e-3, 9);
}

const SN = +process.env.SCEN_N || 300, pc = (A) => (A.met / A.n * 100);
const ff2 = ctx.testFieldFuzz(3000);
console.log(`\nTest fields: ${Object.keys(ctx.TPL).filter(k => ctx.TPL[k].test).length} templates on 8 planets plus 18000 captain adjustments, ${ff2} breaking Law 28.4 (max 2 behind square on the leg side)`);
check('Test field legality failures', ff2, 0, 0);

const sw = {std: ctx.sweepRow(null, false, 'SR', 30000), sweep: ctx.sweepRow(-130, false, 'SR', 30000), stdDF: ctx.sweepRow(null, false, 'DF', 30000),
  slog: ctx.sweepRow(-130, true, 'DF', 30000), rev: ctx.sweepRow(135, false, 'DF', 30000)};
const swf = r => `${r.rpb.toFixed(2)} rpb ${r.bpo.toFixed(1).padStart(5)} balls/out  LBW ${(r.lbw * 100).toFixed(0)}% of outs`;
console.log('\nSweeps vs off-spin, day 4 (A tier; every full ball swept):');
console.log(`  standard bot, spin-attack field    ${swf(sw.std)}`);
console.log(`  sweep fine, spin-attack field      ${swf(sw.sweep)}   (no fine leg: sweeping pays)`);
console.log(`  standard bot, defensive field      ${swf(sw.stdDF)}`);
console.log(`  slog-sweep, defensive field        ${swf(sw.slog)}   (deep fine leg and square leg wait for it)`);
console.log(`  reverse sweep, defensive field     ${swf(sw.rev)}`);
check('sweep beats the standard bot into an open fine leg (rpb)', sw.sweep.rpb - sw.std.rpb, 0.01, 9);
check('slog-sweep into a deep leg-side field is out sooner than the standard bot (balls/out)', sw.stdDF.bpo - sw.slog.bpo, 0.01, 99);
check('missed sweeps bring LBW (share of outs vs the standard bot)', sw.sweep.lbw - sw.std.lbw, 0.02, 1);

console.log(`\nScenarios, ${SN} plays per bot (SCEN_N to change); met % for the standard, farming, careful and slogging bots:`);
console.log('  id   objective  band     std  farm  care  slog   ref  stars  balls');
const sBad = {bouncer: 0, field: 0, consec: 0};
for (const sc of ctx.SCEN) {
  const o = sc.obj, ids = ctx.SCEN.filter(x => x.id === sc.id).length;
  const ok = ids === 1 && o.wkts >= 1 && o.wkts <= sc.lineup.length - 1 && sc.attack.length >= 2 && sc.striker !== sc.nonStriker &&
    Math.max(sc.striker, sc.nonStriker) < sc.lineup.length && sc.stars.length === 3 && sc.band && (!sc.stage || sc.stage.n === 1 || ctx.SCEN.some(x => x.stage && x.stage.g === sc.stage.g && x.stage.n === sc.stage.n - 1));
  if (!ok) { failures++; console.log(`  !! ${sc.id}: malformed scenario data`); continue; }
  const R = {}; for (const k of ['std', 'farm', 'careful', 'slog']) { R[k] = ctx.scenRun(sc, k, SN); sBad.bouncer += R[k].vb; sBad.field += R[k].vf; sBad.consec += R[k].consec; }
  const ref = ctx.bandBot(sc), v = pc(R[ref]);
  console.log(`  ${sc.id.padEnd(4)} ${o.type.padEnd(9)}  ${('[' + sc.band + ']').padEnd(8)}${[R.std, R.farm, R.careful, R.slog].map(A => pc(A).toFixed(0).padStart(5)).join(' ')}  ${ref.padStart(4)}  ${(R[ref].stars / SN).toFixed(2)}  ${(R.std.balls / SN).toFixed(0).padStart(5)}`);
  check(`${sc.id} ${ref} win rate (%)`, v, ...sc.band);
  const tS = ctx.TIER[sc.lineup[sc.striker].tier].tail, tN = ctx.TIER[sc.lineup[sc.nonStriker].tier].tail;
  if (o.wkts === 1 && tS !== tN) {
    const s3 = ctx.scenRun(sc, 'std', 3 * SN), f3r = ctx.scenRun(sc, 'farm', 3 * SN);
    console.log(`       last pair, ${3 * SN} plays: farming ${pc(f3r).toFixed(1)}% vs standard ${pc(s3).toFixed(1)}%`);
    check(`${sc.id} farming minus standard (last pair, %)`, pc(f3r) - pc(s3), 0.01, 100);
  }
  if (o.type === 'survive') check(`${sc.id} careful minus slogging (survive, %)`, pc(R.careful) - pc(R.slog), 0.01, 100);
  if (sc.stage && sc.stage.n === 1) { const C = ctx.scenRun(sc, 'std', SN, true); sBad.bouncer += C.vb; sBad.field += C.vf; console.log(`       all ${sc.stage.of} sessions in a row (state carried): standard bot ${pc(C).toFixed(0)}%`); }
}
console.log(`  rules in simulated play: ${sBad.bouncer} overs with a third bouncer, ${sBad.field} illegal Test fields, ${sBad.consec} consecutive overs by one bowler`);
check('bouncer limit breaches', sBad.bouncer, 0, 0); check('Test leg-side field breaches', sBad.field, 0, 0); check('consecutive overs', sBad.consec, 0, 0);
console.log(`  Test section took ${((Date.now() - t1) / 1000).toFixed(1)} s`);
console.log(failures ? `\n${failures} balance check(s) failed.` : '\nAll balance checks passed.');
process.exit(failures ? 1 : 0);
