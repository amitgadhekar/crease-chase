/* ---------- match flow ---------- */
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));}
function startMatch(){
  audio();
  const L=LENGTHS[settings.len];
  const sup=settings.mode==='super',P=setPlanet(settings.planet);applyPlanet(P);
  M={mode:sup?'chase':settings.mode,superOver:sup,planet:P,diff:settings.diff,overs:sup?1:L.overs,wktsMax:settings.mode==='nets'?(settings.netsW||Infinity):sup?2:L.w,target:0,runs:0,wkts:0,balls:0,overBalls:[],fours:0,sixes:0,
     swings:[],perfects:0,shots:[],lastLens:[],typeStats:{pace:{r:0,n:0},spin:{r:0,n:0}},field:[],bowlerType:'pace',spinDir:1,overNo:0};
  S.timing=null;S.hintCount=0;
  if(M.mode==='chase'){
    M.ai=simulateAI(M.overs,M.wktsMax,M.diff,P.ai,sup);M.target=M.ai.runs+1;
    $('#iTitle').textContent=P.team+' '+M.ai.runs+'/'+M.ai.wkts;
    $('#iText').textContent=(sup?'Super over on '+P.name+'. ':P.name+'. ')+'They batted '+oversText(M.ai.balls)+' overs. You need '+M.target+' to win from '+M.overs*6+' balls, with '+M.wktsMax+' wickets in hand.';
    showScreen('intro');S.paused=true;
  }else beginPlay();
}
function beginPlay(){
  showScreen(null);$('#hud').hidden=false;$('#loftBtn').hidden=false;resize();S.paused=false;newOver();
}
function newOver(){
  M.overNo++;M.overBalls=[];
  let type='pace';
  if(M.overNo>1){
    if(M.diff==='hard'){const p=M.typeStats.pace,s=M.typeStats.spin;
      const rp=(p.r+2)/(p.n+2),rs=(s.r+2)/(s.n+2);type=rs<rp?'spin':rp<rs?'pace':(Math.random()<0.4?'spin':'pace');}
    else type=Math.random()<0.4?'spin':'pace';
  }
  if(M.mode==='nets')type=M.overNo%2?'pace':'spin';
  M.bowlerType=type;M.spinDir=Math.random()<0.5?1:-1;
  const ff=fieldFor(M.shots,M.diff);M.field=ff.field;
  const notes=[type==='pace'?'Pace bowler':(M.spinDir>0?'Leg-spinner':'Off-spinner')];
  const ins=brainInsight(mem,type);if(ins)notes.push(ins);
  if(ff.moved)notes.push(ff.moved===1?'One fielder moved deep':ff.moved+' fielders moved deep');
  const ws=rollWind(M.planet);if(ws>0.5)notes.push('Wind '+Math.round(ws*3.6)+' km/h');
  if(M.overNo===1)notes.unshift(M.planet.name);
  updateHUD();
  banner(M.superOver?'Super over':M.mode==='chase'?'Over '+M.overNo+' of '+M.overs:'Over '+M.overNo,notes.join('. '),'small',1900);
  S.phase='break';S.t=0;S.breakDur=1.6;resetFielders();
  if(S.hintCount<4)hint((settings.aim==='push'?'Drag':'Pull back')+' to aim, release to swing, tap to block');
}
function resetFielders(){S.fpos=M.field.map(f=>({x:f.x,z:f.z,run:0}));S.fanim=null;}
function nextBall(){
  S.ball=null;S.swing=null;S.hit=null;S.res=null;S.stumps=null;S.trail=[];S.chase=null;S.deferred=null;setLoft(false);S.bat={mode:S.aim?'backlift':'stance',t0:clock,from:null,aim:0};
  resetFielders();
  const left=M.overs*6-M.balls,need=M.target-M.runs;
  const pressure=M.mode==='chase'&&left>0&&(need/left>1.8||left<=4);
  const plan=planBall(mem,M.bowlerType,M.diff,{last:M.lastLens,pressure});
  S.pending=makeDelivery(plan,M.diff,M.spinDir);
  S.phase='ready';S.t=0;S.readyDur=settings.gap||2;S.runupDur=M.bowlerType==='pace'?1.5:1.1;
}
function releaseBall(){S.ball=S.pending;S.pending=null;S.ball.start=clock;S.ball.bounced=false;S.phase='flight';}

function flightUpdate(){
  const b=S.ball,bt=clock-b.start,sw=S.swing;
  if(!b.bounced&&bt>=b.t1){b.bounced=true;sfx.bounce();}
  const ev=[];
  if(sw&&!sw.done&&bt>=sw.tc)ev.push({t:sw.tc,k:'swing'});
  if(!b.stumpChecked&&bt>=b.tStumps)ev.push({t:b.tStumps,k:'stumps'});
  ev.sort((x,y)=>x.t-y.t);
  for(const e of ev){
    if(S.phase!=='flight')return;
    if(e.k==='swing')doSwing();
    else{b.stumpChecked=true;
      if(b.onStumps){if(sw&&!sw.done){sw.done=true;sw.missed=true;S.timing={dt:sw.tc-b.tIdeal,early:false,label:'Too late',zone:-1};}
        sfx.stumps();S.stumps={t0:clock};commit({runs:0,out:true,outText:'Bowled',label:'Bowled!',sub:sw?'Missed it':'Left it, and it hit the stumps',cls:'out'},1.9);}}
  }
  if(S.phase==='flight'&&bt>=b.tEnd){
    if(sw&&!sw.done){sw.done=true;sw.missed=true;}
    if(b.wide)commit({runs:1,wide:true,label:'Wide',sub:'One extra',cls:'wide'},1.0);
    else commit({runs:0,label:sw?'Beaten':'Left alone',cls:'dot'},0.9);
  }
}
function doSwing(){
  const b=S.ball,sw=S.swing;sw.done=true;
  const r=evalSwing(b,sw,M.diff,M.field);
  S.timing=r.timing;M.swings.push(Math.abs(r.timing.dt));if(r.timing.zone===3)M.perfects++;
  if(r.miss){sw.missed=true;return;}
  const res=r.res,cur=ballPos(b,clock-b.start);
  sfx.bat(res.q!=null?res.q:0.3);
  if(res.stumps){S.stumps={t0:clock};sfx.stumps();}
  if(res.path){S.hit=preparePath(res.path,cur,res.dir);S.hitStart=clock;}
  if(res.catcher!=null){S.fanim={i:res.catcher,x:res.catchPt.x,z:res.catchPt.z,speed:Math.max(4,Math.hypot(M.field[res.catcher].x-res.catchPt.x,M.field[res.catcher].z-res.catchPt.z)/Math.max(0.25,res.path.T*0.92))};}
  else if(res.fielderTo&&res.fielderTo.i>=0){S.fanim={i:res.fielderTo.i,x:res.fielderTo.x,z:res.fielderTo.z,speed:DIFF[M.diff].fSpeed};}
  let dur=1.2,tCross=0;
  if(S.hit)dur=(S.hit.air?Math.min(S.hit.T+(S.hit.stop?0.2:0.9),2.6):Math.min(S.hit.s/S.hit.a,2.2))+0.8;
  if(res.boundary&&S.hit){
    const h=S.hit,bd=distToBoundary(h.x0,h.z0,h.ux,h.uz);
    if(h.air)tCross=res.boundary===6?bd/h.sh:h.T+0.5;
    else{const disc=h.s*h.s-2*h.a*bd;tCross=disc>0?(h.s-Math.sqrt(disc))/h.a:2;}
    tCross=clamp(tCross,0.4,3.4);S.chase={t0:clock+0.15};dur=tCross+1.4;
  }
  commit(res,dur,tCross);
}
function commit(res,dur,delay){
  const b=S.ball;S.res=res;S.phase='result';S.t=0;S.resultDur=dur;
  const legal=!res.wide;
  M.runs+=res.runs;if(legal)M.balls++;if(res.out)M.wkts++;
  if(res.boundary===4)M.fours++;if(res.boundary===6)M.sixes++;
  M.overBalls.push(res.out?{t:'W',cls:'cw'}:res.wide?{t:'wd',cls:'cwd'}:res.boundary===6?{t:'6',cls:'c6'}:res.boundary===4?{t:'4',cls:'c4'}:{t:res.runs?String(res.runs):'\u2022'});
  if(res.dir!=null&&!res.out)M.shots.push({a:res.dir,runs:res.runs,lofted:!!res.lofted});
  brainLearn(mem,b,res.runs,!!res.out);store.set('mem',mem);
  M.typeStats[b.type].r+=res.runs;M.typeStats[b.type].n++;
  M.lastLens.push(b.len);if(M.lastLens.length>6)M.lastLens.shift();
  if(S.swing){S.hintCount++;if(S.hintCount>=4)hint('');}
  if(delay>0)S.deferred={at:clock+delay,res,b};else showOutcome(res,b);
}
function showOutcome(res,b){
  updateHUD();
  const speedNote=b.slower?'Slower ball, '+b.kmh+' km/h':'';
  if(res.out){banner(res.label,res.sub||res.outText,'out',1800);sfx.groan();}
  else if(res.boundary===6){banner('Six!',res.sub,'six',1800);sfx.cheer(true);}
  else if(res.boundary===4){banner('Four!',res.sub||res.shot,'four',1700);sfx.cheer(false);}
  else if(res.wide){banner('Wide','One extra','small',1000);}
  else if(res.runs>0){banner(res.label,res.sub||'','small',1300);}
  else banner(res.label,speedNote||res.sub||'','small',1000);
}
function afterResult(){
  if(S.deferred){showOutcome(S.deferred.res,S.deferred.b);S.deferred=null;}
  if(M.mode==='chase'){
    const out=M.wkts>=M.wktsMax,done=M.balls>=M.overs*6;
    if(M.runs>=M.target)return endMatch('win');
    if(out||done)return endMatch(M.runs===M.target-1?'tie':'loss');
  }else if(M.wkts>=M.wktsMax)return endMatch('nets');
  if(!S.res.wide&&M.balls>0&&M.balls%6===0)newOver();else nextBall();
}
function endMatch(kind){
  S.paused=true;S.phase='idle';
  const rk=M.diff+(M.superOver?'_super':''),r=records[rk]||(records[rk]={w:0,p:0,hs:0});
  if(M.mode==='chase'){r.p++;if(kind==='win')r.w++;}
  const isBest=M.runs>r.hs;if(isBest)r.hs=M.runs;store.set('records',records);
  let title,text;
  if(M.mode==='nets'){title=M.runs+' off '+M.balls;text=isFinite(M.wktsMax)&&M.wkts>=M.wktsMax?'Session over: all '+M.wktsMax+' wickets gone.':'Nets session ended. Out '+M.wkts+(M.wkts===1?' time.':' times.');}
  else if(kind==='win'){const wk=M.wktsMax-M.wkts,bl=M.overs*6-M.balls;title='You won';text='By '+wk+(wk===1?' wicket':' wickets')+(bl?', with '+bl+(bl===1?' ball':' balls')+' to spare.':' off the last ball.');}
  else if(kind==='tie'){title='Tied';text='Scores level on '+M.runs+'.'+(M.superOver?' Play another super over to settle it.':' So close.');}
  else{const by=M.target-1-M.runs;title=M.planet.team+' won';text='They won by '+by+(by===1?' run.':' runs.')+' You made '+M.runs+'/'+M.wkts+'.';}
  $('#eTitle').textContent=title;$('#eText').textContent=text;
  const avg=M.swings.length?Math.round(M.swings.reduce((a,b)=>a+b,0)/M.swings.length*1000):0;
  const sr=M.balls?Math.round(M.runs/M.balls*100):0;
  $('#eStats').innerHTML=[[M.runs+'',M.balls+' balls'],[sr+'','strike rate'],[M.fours+' / '+M.sixes,'fours / sixes'],
    [M.perfects+'','perfect timing'],[avg+' ms','avg timing error'],[M.wkts+'','wickets lost']]
    .map(([a,b])=>'<div class="stat"><b>'+a+'</b><span>'+b+'</span></div>').join('');
  $('#eNote').textContent=isBest&&M.runs>0?'New highest score on '+M.diff+(M.superOver?' super overs':'')+'.':'';
  $('#againBtn').textContent=kind==='tie'&&M.superOver?'Play another super over':'Play again';
  showScreen('end');
}
function quitToMenu(){S.paused=true;S.phase='idle';M=null;$('#hud').hidden=true;$('#loftBtn').hidden=true;hint('');refreshMenu();showScreen('menu');}
function pause(){if(!M||S.paused)return;S.paused=true;S.aim=null;
  $('#pText').textContent=M.mode==='chase'?'You are '+M.runs+'/'+M.wkts+', chasing '+M.target+'.':'Tap "Quit to menu" to see your session summary.';
  $('#quitBtn').textContent=M.mode==='nets'?'End session':'Quit to menu';showScreen('pause');}

