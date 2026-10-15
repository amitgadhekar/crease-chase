/* ---------- match flow ---------- */
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));MENU.on=id==='menu';}
function newMatch(P,mode,diff,L){
  sfx.amb(true);rpUI(false);applyPlanet(P);setKits(false);ctlUI(false);pickUI(false);S.ai=S.meter=S.pending=null;
  S.timing=null;S.bpos.x=S.bpos.z=0;S.hintCount=0;S.cel=null;S.bat={mode:'stance',t0:clock,from:null,aim:0};fwReset();updateCam(0);
  return {mode,planet:P,pk:curPlanet,diff,overs:L.overs,wktsMax:mode==='nets'?(settings.netsW||Infinity):L.w,t20:mode==='chase'&&!!L.t20,target:0,runs:0,wkts:0,balls:0,overBalls:[],fours:0,sixes:0,
     swings:[],perfects:0,shots:[],lastLens:[],typeStats:{pace:{r:0,n:0},spin:{r:0,n:0}},field:[],bowlerType:'pace',spinDir:1,overNo:0,foot:{x:0,z:0}};
}
function startMatch(){
  if(M&&M.sc)return startScen(M.sc);
  if(M&&M.saved)store.del('t20');
  if(settings.mode==='t20')return startT20();
  M=newMatch(setPlanet(settings.planet),settings.mode,settings.diff,LENGTHS[settings.len]);
  if(M.mode==='chase'){M.ai=simulateAI(M.overs,M.wktsMax,M.diff,M.planet.ai);M.target=M.ai.runs+1;chaseIntro();}
  else beginPlay();
}
// the shot physics of this innings: the player's difficulty, or BOWL_D while the player bowls (difficulty is then the meter and the AI batter)
const physD=()=>M.bowl?BOWL_D:M.diff;
// the innings break before a chase: the AI's total and the target
function chaseIntro(){
  const P=M.planet;introBody('');$('#chaseBtn').textContent='Start the chase';
  $('#iTitle').textContent=P.team+' '+M.ai.runs+'/'+M.ai.wkts;
  $('#iText').textContent=P.name+'. '+'They batted '+oversText(M.ai.balls)+' overs. You need '+M.target+' to win from '+M.overs*6+' balls, with '+M.wktsMax+' wickets in hand.';
  showScreen('intro');S.paused=true;
}
function beginPlay(cont){
  showScreen(null);$('#hud').hidden=false;$('#t20Slab').hidden=!M.t20;$('#tBar').hidden=!!M.bowl;$('#scenSlab').hidden=!M.sc;ctlUI(true);resize();S.paused=false;newOver(cont);
}
// in-play controls: the slingshot's Loft and the footwork stick when batting, the delivery chips and Bowl when bowling
function ctlUI(on){const b=!!(M&&M.bowl);$('#loftBtn').hidden=$('#stick').hidden=!on||b;$('#bowlBtn').hidden=$('#optChips').hidden=!on||!b;}
// cont: a resumed T20 carries on with the saved over (bowler, plan, field)
function newOver(cont){
  if(!cont){M.overNo++;M.overBalls=[];}
  if(M.bowl)return bowlOver(cont);
  let notes;
  if(M.t20)notes=t20Over(cont);
  else if(M.sc)notes=scenOver();
  else{
    let type='pace';
    if(M.overNo>1){
      if(M.diff==='hard'){const p=M.typeStats.pace,s=M.typeStats.spin;
        const rp=(p.r+2)/(p.n+2),rs=(s.r+2)/(s.n+2);type=rs<rp?'spin':rp<rs?'pace':(Math.random()<0.4?'spin':'pace');}
      else type=Math.random()<0.4?'spin':'pace';
    }
    if(M.mode==='nets')type=M.overNo%2?'pace':'spin';
    M.bowlerType=type;M.spinDir=Math.random()<0.5?1:-1;
    const ff=fieldFor(M.shots,M.diff);M.field=ff.field;
    notes=[bowlerLabel()];
    const ins=brainInsight(mem,type,M.foot);if(ins)notes.push(ins);
    if(ff.moved)notes.push(ff.moved===1?'One fielder moved deep':ff.moved+' fielders moved deep');
  }
  const ws=rollWind(M.planet);if(ws>0.5)notes.push('Wind '+Math.round(ws*3.6)+' km/h');
  if(M.overNo===1||cont)notes.unshift(M.planet.name);
  updateHUD();
  const lng=M.t20||M.sc;
  banner(M.mode!=='nets'?'Over '+M.overNo+' of '+M.overs:'Over '+M.overNo,notes.join(lng?'\n':'. '),'small',lng?2900:1900);
  S.phase='break';S.t=0;S.breakDur=lng?2.4:1.6;resetFielders();
  if(S.hintCount<4)hint('Pull back to aim, release to swing, tap to block');
}
// fielders back at their places (the keeper at his stance for this bowler, KEEP), with the motion state fieldTick (08) drives
function resetFielders(){S.fpos=M.field.map(f=>{const kp=f.n==='keeper',p=kp?KEEP[M.bowlerType]||KEEP.pace:f;
  return {x:p.x,z:p.z,bx:p.x,bz:p.z,run:0,mv:0,face:kp?0:Math.atan2(-p.x,BATS_Z-p.z),act:0,ap:0,hx:0,hy:0,hz:0,e:0,sd:1,hold:false,ev:null,kp,bw:f.n==='bowler'};});
  S.fplay=[];S.fev=null;S.cord=null;}
function nextBall(){
  $('#holdBtn').hidden=true;S.ball=null;S.swing=null;S.ai=null;S.hit=null;S.res=null;S.stumps=null;S.padNow=S.padHit=S.padBp=S.hold=null;S.trail=[];S.chase=null;S.deferred=null;setLoft(false);S.bat={mode:S.aim?'backlift':'stance',t0:clock,from:null,aim:0};
  const sb=M.sc?scenNext():null;
  if(M.note){banner('Field change',M.note,'small',1600);M.note='';}
  resetFielders();
  S.phase='ready';S.t=0;S.readyDur=BALL_GAP;S.runupDur=M.bowlerType==='pace'?1.5:1.1;
  if(M.bowl)return bowlReady();
  if(sb){S.pending=sb;return;}
  const left=M.overs*6-M.balls,need=M.target-M.runs;
  const pressure=M.t20?t20Pressure(M.st):M.mode==='chase'&&left>0&&(need/left>1.8||left<=4);
  const bw=M.t20?M.attack[M.bi]:null,plan=planBall(M.t20?M.st.mem:mem,M.bowlerType,M.diff,{last:M.lastLens,pressure,foot:M.foot,bw,plan:M.plan});
  S.pending=makeDelivery(plan,M.diff,bw||M.spinDir);
}
function releaseBall(){if(M.bowl)return bowlRelease();S.ball=S.pending;S.pending=null;S.ball.start=clock;S.ball.bounced=false;S.phase='flight';}

// a pending swing resolves before the pads, as the timing model lets late swings still reach the ball
// Tests: a missed sweep lunges the front pad (S.padBp); a short ball at the body that was not ducked stops there (bodyHit)
function flightUpdate(){
  const b=S.ball,bt=clock-b.start,sw=S.swing,bp=S.padBp||S.bpos,pd=padHit(b,bp),bh=!pd&&M.sc&&bodyHit(b,bp),bo=bh&&!(b.duck&&bh.y>1.15)?bh:null,ph=S.padNow=pd||bo;
  if(!b.bounced&&bt>=b.t1){b.bounced=true;sfx.bounce();}
  const ev=[],pend=sw&&!sw.done;
  if(pend&&bt>=sw.tc)ev.push({t:sw.tc,k:0});
  if(ph){const t=Math.max(ph.t,pend?sw.tc:0);if(bt>=t)ev.push({t,k:1});}
  else if(!b.stumpChecked&&bt>=b.tStumps)ev.push({t:b.tStumps,k:2});
  ev.sort((x,y)=>x.t-y.t||x.k-y.k);
  for(const e of ev){
    if(S.phase!=='flight')return;
    if(e.k===0)doSwing();
    else if(e.k===1){tooLate(sw,b);S.padHit={x:ph.x,y:ph.y,z:ph.z,t0:clock};play('block',{vol:bo?0.7:0.5,rate:bo?0.55:0.7});const of=!!sw||!!(S.ai&&!S.ai.sw.leave),r=pd?padResult(b,ph,of):beaten(b,bp,of,scBat());commit(r,r.out?1.9:1.1);}
    else{b.stumpChecked=true;
      if(b.onStumps){tooLate(sw,b);sfx.stumps();S.stumps={t0:clock};commit({runs:0,out:true,outText:'Bowled',label:'Bowled!',sub:sw?'Missed it':'Left it, and it hit the stumps',cls:'out'},1.9);}}
  }
  if(S.phase==='flight'&&bt>=b.tEnd&&!ph){
    sfx.keeper(b.wide?0.5:1);
    if(sw&&!sw.done){sw.done=true;sw.missed=true;}
    const st=M.sc?beaten(b,bp,!!sw,scBat()):stumpedResult(b,S.bpos);
    if(st&&st.stumped){sfx.stumps();S.stumps={t0:clock,bails:true};commit(st,1.9);}
    else if(st)commit(st,st.out?1.9:1.0);
    else if(b.wide)commit({runs:1,wide:true,label:'Wide',sub:'One extra',cls:'wide'},1.0);
    else commit({runs:0,label:sw?'Beaten':'Left alone',cls:'dot'},0.9);
  }
}
function tooLate(sw,b){if(sw&&!sw.done){sw.done=true;sw.missed=true;S.timing={dt:sw.tc-footAt(b,S.bpos).t,early:false,label:'Too late',zone:-1};}}
function doSwing(){
  const b=S.ball,sw=S.swing;sw.done=true;sw.bp={x:S.bpos.x,z:S.bpos.z};
  const r=evalSwing(b,sw,physD(),M.field,M.st&&M.st.bat?scBat():undefined);
  S.timing=r.timing;if(!M.bowl){M.swings.push(Math.abs(r.timing.dt));if(r.timing.zone===3)M.perfects++;}
  if(r.miss){sw.missed=true;if(r.bp)S.padBp=r.bp;return;}
  const res=r.res,cp=sw.cp,cur=cp||ballPos(b,clock-b.start),c0=footAt(b,sw.bp).c;
  sfx.contact(res,sw);if(res.catcher!=null)sfx.catch(res.path.T);
  if(res.stumps){S.stumps={t0:clock};sfx.stumps();}
  if(res.path){const h=S.hit=preparePath(res.path,cur,res.dir);S.hitStart=clock;
    if(cp){S.hitStart=b.start+sw.tc;if(h.air)h.vy+=(h.y0-cp.y)/h.T;h.y0=cp.y;}
    // the drawn path starts up to 0.5 m from the logic's: a six still lands over the rope, a one-bounce four inside it
    if(h.air&&res.boundary&&!h.stop){const bd=distToBoundary(h.x0,h.z0,h.ux,h.uz),C=res.boundary===6?Math.max(h.C,bd+1):Math.min(h.C,bd-.5);
      if(C!==h.C){h.C=C;h.sh=C/h.T;}}}
  // the fielding events, moved onto the drawn path (it starts at the blade's contact point, the logic's at footAt's)
  S.f0=S.hitStart;S.fplay=(res.fplay||[]).map(e=>({...e,x:e.x+cur.x-c0.x,z:e.z+cur.z-c0.z}));S.fev={};
  for(const e of S.fplay)(S.fev[e.i]||(S.fev[e.i]=[])).push(e);
  let dur=1.2,tCross=0;
  if(S.hit){const h=S.hit;dur=(h.air?Math.min(h.T+(h.stop?0.2:0.9),2.6):Math.min(h.s/h.a,2.2))+0.8;
    // long enough to see every attempt land (a diver is up again 1.1 s after it)
    for(const e of S.fplay)if(e.k!=='run'||e.o)dur=Math.max(dur,Math.min(3.4,e.t1+1));}
  if(res.boundary&&S.hit){
    const h=S.hit,bd=distToBoundary(h.x0,h.z0,h.ux,h.uz);
    if(h.air)tCross=bd<=h.C?bd/h.sh:h.T+(h.rt||1.2)*(1-Math.sqrt(Math.max(0,1-(bd-h.C)/(h.roll!=null?h.roll:h.C*0.3))));
    else{const disc=h.s*h.s-2*h.a*bd;tCross=disc>0?(h.s-Math.sqrt(disc))/h.a:2;}
    tCross=clamp(tCross,0.4,3.4);S.chase={t0:clock+0.15,tx:clock+tCross};dur=tCross+1.4;
  }else if(S.hit){
    // a catch or chance out of the batting camera's view: the chase camera for the deep, the cordon camera (bowler's end) for a
    // catch, drop, dive or leap by the keeper or a close catcher (on the catch or drop if there is one), the chase camera again for
    // a dive, leap or slide off screen that gets a hand to the ball; the outcome waits for that moment. Near misses and plain
    // stops stay in the batting view, which keeps the follow-through on most balls
    const h=S.hit,f=M.field,deep=S.fplay.find(e=>(e.k!=='run'||e.o)&&f[e.i]&&Math.hypot(f[e.i].x,f[e.i].z)>BOUNDARY*0.6),act=e=>e.k==='dive'||e.k==='slide'||e.k==='jump',
      ct=e=>e.o==='catch'||e.o==='drop',cl=!M.bowl&&S.fplay.filter(e=>f[e.i]&&(ct(e)||act(e))&&(f[e.i].n==='keeper'||f[e.i].n!=='bowler'&&Math.hypot(f[e.i].x,f[e.i].z)<18)),
      c=cl&&(cl.find(ct)||cl[0]);
    if(h.air&&res.lofted&&(h.C>=30||deep)){S.chase={t0:clock+0.15,tx:clock+h.T};tCross=h.T;dur=Math.max(dur,h.T+1.4);}
    else if(c){S.cord={t0:clock+0.12,x:c.x,z:c.z};tCross=Math.min(2,c.t1);}
    else{const q=e=>proj(e.x,e.y,e.z),dv=S.fplay.find(e=>act(e)&&e.o&&e.o!=='miss'&&!(x=>x&&x.x>0&&x.x<W&&x.y>0&&x.y<H)(q(e)));
      if(dv){S.chase={t0:clock+0.15,tx:clock+dv.t1};tCross=Math.min(2.5,dv.t1);}}
  }
  commit(res,dur,tCross);
}
function commit(res,dur,delay){
  const b=S.ball;S.res=res;S.phase='result';S.t=0;S.resultDur=dur;
  if(S.swing){S.hintCount++;if(S.hintCount>=4)hint('');}
  // Tests and T20: a holdable ball is recorded when Hold is tapped or its window closes (holdEnd)
  // a deferred outcome (a camera cut) opens the window when it is shown, so a Hold is never overwritten by the runs before it
  if((M.sc||M.t20&&!M.bowl)&&holdable(res)){S.hold={until:clock+Math.max(0,delay||0)+0.6,res,b};$('#holdBtn').hidden=delay>0;}else if(M.sc)scenRecord(res,b,false,delay>0);else if(M.bowl)bowlRecord(res,b);else recordBall(res,b);
  if(delay>0)S.deferred={at:clock+delay,res,b};else showOutcome(res,b);
}
function recordBall(res,b){
  const legal=!res.wide;
  M.runs+=res.runs;if(legal)M.balls++;if(res.out)M.wkts++;
  if(res.boundary===4)M.fours++;if(res.boundary===6)M.sixes++;
  M.overBalls.push(res.out?{t:'W',cls:'cw'}:res.wide?{t:'wd',cls:'cwd'}:res.boundary===6?{t:'6',cls:'c6'}:res.boundary===4?{t:'4',cls:'c4'}:{t:res.runs?String(res.runs):'\u2022'});
  if(res.dir!=null&&!res.out)M.shots.push({a:res.dir,runs:res.runs,lofted:!!res.lofted});
  brainLearn(M.t20?M.st.mem:mem,b,res.runs,!!res.out);if(!M.t20)store.set('mem',mem);footTrend(M.foot,S.bpos);
  M.typeStats[b.type].r+=res.runs;M.typeStats[b.type].n++;
  M.lastLens.push(b.len);if(M.lastLens.length>6)M.lastLens.shift();
  if(M.t20)t20Ball(res);
}
function showOutcome(res,b){
  updateHUD();
  // the crowd reacts when the ball reaches the hands (contact + T): a deferred outcome is shown about then already
  const speedNote=b.slower?'Slower ball, '+b.kmh+' km/h':'',w=res.path?Math.max(0,S.hitStart+res.path.T-clock):0.3;
  if(res.label==='Dropped!')sfx.gasp(w);
  if(res.out){banner(res.label,res.sub||res.outText,'out',1800);sfx.groan(res.catcher!=null?w:0.3);}
  else if(res.boundary===6){banner('Six!',res.sub,'six',1800);sfx.cheer(true,res.dist);}
  else if(res.boundary===4){banner('Four!',res.sub||res.shot,'four',1700);sfx.cheer(false);}
  else if(res.wide){banner('Wide','One extra','small',1000);}
  else if(res.runs>0){banner(res.label,res.sub||'','small',1300);}
  else banner(res.label,speedNote||res.sub||'','small',1000);
}
function afterResult(){
  if(S.deferred){showOutcome(S.deferred.res,S.deferred.b);S.deferred=null;}
  if(M.sc)return scenAfter();
  if(M.bowl)return bowlAfter();
  holdEnd(false);
  if(M.mode==='chase'){
    const out=M.wkts>=M.wktsMax,done=M.balls>=M.overs*6;
    if(M.runs>=M.target)return endMatch('win');
    if(out||done)return endMatch(M.runs===M.target-1?'tie':'loss');
  }else if(M.wkts>=M.wktsMax)return endMatch('nets');
  const nx=!S.res.wide&&M.balls>0&&M.balls%6===0?newOver:nextBall;
  if(S.res.boundary&&S.chase&&REC.n>1)rpStart(nx);else nx();
}
function endMatch(kind){
  sfx.end(kind);
  if(M.saved)store.del('t20');
  $('#eStars').hidden=$('#nextBtn').hidden=true;$('#againBtn').textContent='Play again';$('#againBtn').className='primary';$('#menuBtn').textContent='Back to menu';
  const fmt=M.t20?'t20':'short',rd=records[M.diff]||(records[M.diff]={}),r=rd[fmt]||(rd[fmt]={w:0,p:0,hs:0});
  if(M.mode==='chase'){r.p++;if(kind==='win')r.w++;}
  const isBest=M.runs>r.hs;if(isBest)r.hs=M.runs;store.set('records',records);
  let title,text;
  if(M.mode==='nets'){title=M.runs+' off '+M.balls;text=isFinite(M.wktsMax)&&M.wkts>=M.wktsMax?'Session over: all '+M.wktsMax+' wickets gone.':'Nets session ended. Out '+M.wkts+(M.wkts===1?' time.':' times.');}
  else if(kind==='win'){const wk=M.wktsMax-M.wkts,bl=M.overs*6-M.balls;title='You won';text='By '+wk+(wk===1?' wicket':' wickets')+(bl?', with '+bl+(bl===1?' ball':' balls')+' to spare.':' off the last ball.');}
  else if(kind==='tie'){title='Tied';text='Scores level on '+M.runs+'. So close.';}
  else{const by=M.target-1-M.runs;title=M.planet.team+' won';text='They won by '+by+(by===1?' run.':' runs.')+' You made '+M.runs+'/'+M.wkts+'.';}
  if(M.i1)text=M.planet.team+' made '+M.i1.runs+'/'+M.i1.wkts+'. '+text;
  $('#eTitle').textContent=title;$('#eText').textContent=text;
  const avg=M.swings.length?Math.round(M.swings.reduce((a,b)=>a+b,0)/M.swings.length*1000):0;
  const sr=M.balls?Math.round(M.runs/M.balls*100):0;
  $('#eStats').innerHTML=[[M.runs+'',M.balls+' balls'],[sr+'','strike rate'],[M.fours+' / '+M.sixes,'fours / sixes'],
    [M.perfects+'','perfect timing'],[avg+' ms','avg timing error'],[M.wkts+'','wickets lost']]
    .map(([a,b])=>'<div class="stat"><b>'+a+'</b><span>'+b+'</span></div>').join('');
  $('#eNote').textContent=isBest&&M.runs>0?'New highest '+(M.t20?'T20 ':'')+'score on '+M.diff+'.':'';
  if(kind==='win')celebrate();else showEnd();
}
function celebrate(){
  S.phase='celebrate';S.cel={t0:clock,fly:false};S.chase=null;S.trail3=[];S.aim=null;S.bat={mode:'celebrate',t0:clock,from:null,aim:0};
  ctlUI(false);fwReset();FW.next=clock+0.8;
}
function showEnd(){const rp=S.phase==='replay';rpUI(false);if(rp)updateCam(0);S.paused=true;S.phase='idle';sfx.amb(false);hint('');fwReset();showScreen('end');}
// a ball still in its Hold window is recorded as not held, so the T20 or scenario save includes it
// back to the hub; from a scenario (its result, pause or briefing) straight into the Scenarios sheet
function quitToMenu(){const toScen=!!(M&&M.sc)||$('#brief').classList.contains('on');if(M&&S.hold)holdEnd(false);rpUI(false);S.hold=null;$('#holdBtn').hidden=true;ctlUI(false);pickUI(false);setKits(false);S.ai=S.meter=null;S.paused=true;S.phase='idle';sfx.amb(false);S.cel=null;fwReset();S.bat={mode:'stance',t0:clock,from:null,aim:0};updateCam(0);M=null;S.bpos.x=S.bpos.z=0;$('#hud').hidden=true;$('#loftBtn').hidden=true;$('#stick').hidden=true;hint('');showMenu(toScen?'scen':null);}
function pause(){if(!M||S.paused)return;S.paused=true;S.aim=null;sfx.duck(1);
  $('#pText').textContent=M.sc?M.sc.title+'. '+objText(M.sc):M.bowl?M.planet.team+' are '+M.runs+'/'+M.wkts+' after '+oversText(M.balls)+' overs.':M.mode==='chase'?'You are '+M.runs+'/'+M.wkts+', chasing '+M.target+'.':'Tap "Quit to menu" to see your session summary.';
  $('#pCard').innerHTML=M.t20?(M.i1&&!M.bowl?inn1Line()+'\n':'')+t20Card(M.st,M.attack):'';$('#pause .card').classList.toggle('split',!!M.t20);
  simUI($('#simBtn'),!!M.bowl);
  $('#quitBtn').textContent=M.mode==='nets'?'End session':'Quit to menu';showScreen('pause');}

