/* ---------- Scenarios: Test situations (SCEN in logic.js). Briefing, per-over captain and field, per-ball strike, Hold and duck,
   sessions (stageNext), stars and unlocks (cc_scen). The player bats whoever is on strike. ---------- */
const scenRec=(()=>{const r=store.get('scen',null);return r&&r.stars&&typeof r.stars==='object'?r:{stars:{}};})();
const SERIES=SCEN.filter(s=>s.set==='series'),CLASSICS=SCEN.filter(s=>s.set==='classic');
const scStars=id=>Math.min(3,Math.max(0,Math.round(+scenRec.stars[id])||0));
const scOpen=sc=>{const i=SERIES.indexOf(sc);return i<1||scStars(SERIES[i-1].id)>0;};
const starStr=n=>'★'.repeat(n)+'☆'.repeat(3-n);
const scBase=sc=>scenById(sc.id);
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
function objText(sc){
  const o=sc.obj,w=o.wkts===1?'one wicket left':plural(o.wkts,'wicket')+' in hand';
  switch(o.type){
    case 'chase':return 'Score '+o.target+' to win in '+o.balls+' balls, '+w+'.';
    case 'scoreBy':return 'Score '+o.target+' in '+o.balls+' balls, '+w+'.';
    case 'session':return 'Score '+o.par+' this session ('+o.balls+' balls) without being bowled out. '+o.target+' wins it.';
    case 'avoidFO':return 'Score '+o.target+' in '+o.balls+' balls to avoid the follow-on, '+w+'.';
    case 'tieOrWin':return o.target+' to win, '+(o.target-1)+' to tie, from '+o.balls+' balls, '+w+'.';
    case 'survive':return 'Survive '+o.balls+' balls'+(o.wkts===1?' without losing a wicket.':', losing at most '+plural(o.wkts-1,'wicket')+'.');
  }
  return '';
}
function starText(s,sc){
  const o=sc.obj,L=sc.lineup;
  if(s.t==='win')return 'Meet the objective';
  if(s.balls!=null)return 'With '+s.balls+' balls to spare';
  if(s.runs!=null)return o.type==='survive'?'Score '+s.runs+' while you survive':o.type==='session'?s.runs+' beyond the par':s.runs+' beyond the target';
  if(s.wkts!=null)return 'With '+plural(s.wkts,'wicket')+' in hand';
  if(s.win)return 'Win it, not just a tie';
  if(s.noWkt)return 'Lose no wicket';
  if(s.tail!=null)return 'Tail-enders face at most '+s.tail+' balls';
  if(s.bat)return L[s.bat.i].name+' reaches '+s.bat.runs;
  if(s.sixes!=null)return s.sixes===1?'Hit a six':'Hit '+s.sixes+' sixes';
  if(s.inBalls!=null)return 'Inside '+s.inBalls+' balls';
  return '';
}
const condTag=(day,age,spin)=>'Day '+day+' · Ball '+age+' ov'+(spin&&day>=3?' · Turning':!spin&&age>=35?' · Reverse':!spin&&age<15?' · Swing':'');
const kickText=sc=>sc.stage?'Test '+sc.test+' · Session '+sc.stage.n+' of '+sc.stage.of:sc.set==='series'?'Test '+sc.test+' of 5 · '+sc.team:'Classic';
const batTag=p=>p.name+' <i class="tier t'+p.tier+'" title="'+TIER[p.tier].n+'">'+p.tier+'</i>';

/* --- menu list and briefing --- */
function scenTile(sc){
  const n=scStars(sc.id),open=scOpen(sc),b=document.createElement('button');b.className='sctile'+(open?'':' locked');b.disabled=!open;
  b.innerHTML='<b>'+sc.title+'</b><span class="st'+(n?' on':'')+'">'+(open?starStr(n):'Locked')+'</span>';
  b.addEventListener('click',()=>scenBrief(scBase(sc)));return b;
}
function buildScenList(){
  const se=$('#scenSeries'),cl=$('#scenClassics');se.innerHTML=cl.innerHTML='';
  for(let t=1;t<=5;t++){const row=document.createElement('div'),ss=SERIES.filter(s=>s.test===t),P=PLANETS[ss[0].planet];row.className='screw';
    row.innerHTML='<span class="sct"><i style="background:'+P.vis.sw+'"></i>Test '+t+'<small>'+P.name+'</small></span>';
    ss.forEach(s=>row.appendChild(scenTile(s)));se.appendChild(row);}
  CLASSICS.forEach(s=>cl.appendChild(scenTile(s)));
  const tot=SCEN.reduce((a,s)=>a+scStars(s.id),0);$('#scenTotal').textContent=tot+' of '+SCEN.length*3+' stars';
}
// the briefing card, also shown between sessions of a staged scenario (st = the session just played)
function scenBrief(sc,done){
  const P=PLANETS[sc.planet],L=sc.lineup,bw=sc.attack.map(a=>ARCH[a.arch]),spin=bw[0].type==='spin';
  $('#gKick').textContent=kickText(sc);$('#gTitle').textContent=done?(sc.stage.n===2?'Lunch':'Tea'):sc.title;
  $('#gText').textContent=done?'Session over: '+done.st.runs+' runs for '+plural(done.st.wkts,'wicket')+'. '+(done.n?starStr(done.n)+' earned.':'Short of the par, but still in it.')+' Next: '+sc.title.toLowerCase().replace(/^final day: /,'the ')+'.':sc.brief;
  $('#gOpp').textContent=done?'':sc.oppText;
  $('#gObj').textContent=objText(sc);
  $('#gStars').innerHTML=sc.stars.map((s,i)=>'<li class="'+(i<scStars(sc.id)?'on':'')+'">'+starText(s,sc)+'</li>').join('');
  $('#gCond').innerHTML=[P.name,condTag(sc.day,sc.ballAge,spin),sc.diff[0].toUpperCase()+sc.diff.slice(1)+' bowling'].map(t=>'<span>'+t+'</span>').join('');
  $('#gPair').innerHTML='<span><b>On strike</b> '+batTag(L[sc.striker])+(L[sc.striker].runs?' '+L[sc.striker].runs+'*':'')+'</span><span><b>Non-striker</b> '+batTag(L[sc.nonStriker])+(L[sc.nonStriker].runs?' '+L[sc.nonStriker].runs+'*':'')+'</span>';
  $('#gPlay').textContent=done?'Start the session':'Play';$('#gBack').textContent=done?'Quit to scenarios':'Back';
  M=null;S.paused=true;S.phase='idle';S.cel=null;S.chase=null;S.hold=null;updateCam(0);$('#hud').hidden=$('#loftBtn').hidden=$('#stick').hidden=$('#holdBtn').hidden=true;showScreen('brief');scenBrief.sc=sc;
}

/* --- match start, overs, balls --- */
function startScen(sc){
  if(M&&M.saved)store.del('t20');
  const st=newTest(sc);
  M=newMatch(setPlanet(sc.planet),'scen',sc.diff,{overs:Math.ceil(sc.obj.balls/6),w:sc.obj.wkts});
  Object.assign(M,{sc,st,attack:st.A,md:st.A.map(()=>0),ovR:0,target:sc.obj.target||0,next:null,pid:null,overDone:false});
  beginPlay();
}
// "Umbrella field: 4 slips, gully, silly point, short leg": the close catchers, else the deep fielders
function testFieldLine(f,id){
  const cl=f.filter(p=>p.a!=null&&p.d<=17),dp=f.filter(isDeep),sl=cl.filter(p=>/^slip/.test(p.n)).length,L=cl.length?cl.filter(p=>!/^slip/.test(p.n)).map(p=>POS[p.n][2]):dp.map(p=>POS[p.n][2]);
  if(cl.length&&sl)L.unshift(sl>1?sl+' slips':'slip');
  return TPL[id].name+(L.length?': '+L.slice(0,4).join(', ')+(L.length>4?' and '+(L.length-4)+' more':''):'');
}
function scenOver(){
  const st=M.st,nx=M.next=testBall(st),bw=st.A[st.bi],B=st.bw[st.bi];
  M.bi=st.bi;M.bowlerType=bw.type;M.spinDir=bw.dir||1;M.field=nx.field;M.pid=nx.id;
  return [...nx.notes,ARCH[bw.arch].name+' from '+bw.name+(B.sp?', over '+(B.sp+1)+' of his spell':', new spell')+(B.fat>=0.5?', tiring':''),testFieldLine(nx.field,nx.id)];
}
function scenNext(){
  const st=M.st,nx=M.next||testBall(st);M.next=null;
  if(nx.id!==M.pid){const p=st.bat[st.s];M.note=TPL[nx.id].name+(isTail(st,st.s)?' for '+p.name:'');}
  M.field=nx.field;M.pid=nx.id;return nx.b;
}
const scBat=()=>({tier:M.st.bat[M.st.s].tier});
const holdable=r=>!r.out&&!r.wide&&!r.boundary&&!r.lofted&&r.runs%2===1;
function scenCommit(res,b,delay){
  if(S.swing){S.hintCount++;if(S.hintCount>=4)hint('');}
  if(holdable(res)){S.hold={until:clock+0.6,res,b};$('#holdBtn').hidden=false;}else scenRecord(res,b,false,delay>0);
  if(delay>0)S.deferred={at:clock+delay,res,b};else showOutcome(res,b);
}
function holdEnd(held){
  const h=S.hold;if(!h)return;S.hold=null;$('#holdBtn').hidden=true;
  scenRecord(h.res,h.b,held);if(held){S.res=applyHold(h.res);banner('Held','Kept the strike','small',1000);}
}
function scenRecord(res,b,held,quiet){
  const st=M.st,bi=st.bi,r=held?applyHold(res):res,bp=S.swing&&S.swing.bp||{x:S.bpos.x,z:S.bpos.z};
  const done=testRecord(st,b,res,held,bp);
  M.runs=st.runs;M.wkts=st.wkts;M.balls=st.balls;M.fours=st.fours;M.sixes=st.sixes;M.ovR+=r.runs;
  if(done){if(!M.ovR)M.md[bi]++;M.ovR=0;}
  M.overDone=done;
  M.overBalls.push(r.out?{t:'W',cls:'cw'}:r.wide?{t:'wd',cls:'cwd'}:r.boundary===6?{t:'6',cls:'c6'}:r.boundary===4?{t:'4',cls:'c4'}:{t:r.runs?String(r.runs):'•'});
  if(!quiet)updateHUD();
}
function scenAfter(){
  holdEnd(false);
  const e=scenEnd(M.st);if(e)return scenFinish(e);
  const nx=M.overDone?newOver:nextBall;M.overDone=false;
  if(S.res.boundary&&S.chase&&REC.n>1)rpStart(nx);else nx();
}
// stars are saved per scenario id (each session of a staged chase has its own); a drawn session carries on into the next one
function scenFinish(e){
  const sc=M.sc,st=M.st,n=scenStars(st,e),best=Math.max(n,scStars(sc.id));
  scenRec.stars[sc.id]=best;store.set('scen',scenRec);
  const nx=e.result==='draw'&&sc.stage&&stageNext(sc,st);
  if(nx){rpUI(false);S.cel=null;fwReset();hint('');sfx.amb(false);
    const done={st,n};scenBrief(nx,done);return;}
  sfx.end(e.met?(e.result==='tie'?'tie':'win'):'loss');
  const o=sc.obj,need=e.need,left=e.left;
  $('#eTitle').textContent=e.met?(e.result==='win'?'You did it':e.result==='tie'?'Tied':'Saved'):e.result==='loss'?(st.wkts>=o.wkts&&o.type!=='survive'?'All out':'Lost'):'Fell short';
  $('#eText').textContent=objText(sc)+' '+(e.met?(left>0&&o.type!=='survive'?'Done with '+plural(left,'ball')+' to spare.':'Done.'):
    e.result==='loss'?(o.type==='survive'?'A wicket too many, with '+plural(left,'ball')+' to go.':need>0?plural(need,'run')+' short.':''):'Time ran out '+plural(Math.max(0,need),'run')+' short.');
  $('#eStars').innerHTML='<div class="big3'+(n?'':' none')+'">'+starStr(n)+'</div><span>'+(best>n?'Best '+starStr(best):n?'Your best':'No stars')+'</span>'+
    '<ul>'+sc.stars.map((s,i)=>'<li class="'+(i<n?'on':'')+'">'+starText(s,sc)+'</li>').join('')+'</ul>';
  $('#eStars').hidden=false;
  const avg=M.swings.length?Math.round(M.swings.reduce((a,b)=>a+b,0)/M.swings.length*1000):0;
  $('#eStats').innerHTML=[[st.runs+'',st.balls+' balls'],[st.wkts+'','wickets lost'],[st.fours+' / '+st.sixes,'fours / sixes'],
    [M.perfects+'','perfect timing'],[avg+' ms','avg timing error'],[st.tailB+'','balls faced by the tail']]
    .map(([a,b])=>'<div class="stat"><b>'+a+'</b><span>'+b+'</span></div>').join('');
  $('#eNote').textContent='';
  const nxs=scNextOf(sc);$('#nextBtn').hidden=!nxs;if(nxs)$('#nextBtn').textContent='Next: '+nxs.title;
  $('#againBtn').textContent='Retry';$('#againBtn').className=nxs?'secondary':'primary';$('#menuBtn').textContent='Back to scenarios';
  if(e.met)celebrate();else showEnd();
}
// next in the list (series order, then classics), once unlocked; sessions of a staged chase are reached by playing on
function scNextOf(sc){
  const L=[...SERIES,...CLASSICS];let i=L.findIndex(s=>s.id===sc.id)+1;
  while(i<L.length&&L[i].stage&&L[i].stage.n>1)i++;
  return i<L.length&&scOpen(L[i])?L[i]:null;
}

/* --- HUD: objective, partner card, conditions, bowler --- */
function scenHUD(){
  const st=M.st,o=M.sc.obj,left=Math.max(0,o.balls-st.balls),wl=o.wkts-st.wkts,need=Math.max(0,(o.target||0)-st.runs),C=st.cond,bi=M.bi;
  $('#sOvers').textContent=oversText(st.balls)+' of '+oversText(o.balls)+' overs';
  const sv=o.type==='survive',ss=o.type==='session';
  $('#sTargetLbl').textContent=sv?'Survive':ss?'Par':'Need';
  $('#sTarget').textContent=sv?left:ss?Math.max(0,o.par-st.runs):need;
  $('#sNeed').textContent=sv?plural(left,'ball').replace(/^\d+ /,''):'from '+plural(left,'ball');
  const wt=wl===1?'last pair':wl+' wkts left';
  $('#cObj').textContent=sv?'Survive '+plural(left,'ball')+(wl===1?', no wicket':', '+(wl-1)+' wkt to spare'):ss?'Par '+o.par+', '+need+' to win, '+wt:
    need>0?'Need '+need+(o.type==='tieOrWin'&&need>1?' ('+(need-1)+' ties)':'')+', '+wt:'Target reached';
  const bw=bi>=0?st.A[bi]:null;
  $('#cCond').textContent=condTag(C.day,C.ballAge,bw&&bw.type==='spin');
  const card=i=>{const p=st.bat[i];return '<b>'+(i===st.s?'▸ ':'')+'</b>'+batTag(p)+' <em>'+p.runs+(p.out?'':'*')+'</em><small>('+p.balls+')</small>';};
  $('#cBat0').innerHTML=card(st.s);$('#cBat1').innerHTML=card(st.ns);
  if(bw){const f=st.bw[bi];$('#cBowl').textContent=bw.name+' '+f.o+(f.b?'.'+f.b:'')+'-'+M.md[bi]+'-'+f.r+'-'+f.w;$('#cPlan').textContent=M.pid?TPL[M.pid].name:'';}
}
