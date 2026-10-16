/* ---------- T20 first innings: the player bowls and the AI bats (pure logic in logic.js: newInn1, inn1Suggest, bowlDelivery, aiBat,
   inn1Record, simRest). Per over the player picks the bowler and field plan (the captain's suggestion preselected); per ball a
   delivery (chips), a pitch marker (dragged on the ground) and a release meter tapped in the run-up. The AI striker's input goes
   into the same S.swing / S.bat / S.bpos the slingshot and stick fill, so flight, pads, pose, contact, fielding and replays are
   the batting game's. ---------- */
// first innings on M: the player's attack bowls at the AI XI. o: a save's remembered delivery and marker per bowler
function inn1Enter(st,o){
  Object.assign(M,{bowl:true,inn:1,i1:st,st,attack:M.mine,target:0,runs:st.runs,wkts:st.wkts,balls:st.balls,bi:st.bi>=0?st.bi:Math.max(0,st.last),
    plan:st.pid?{id:st.pid,mix:TPL[st.pid]}:null,field:st.field||[]});
  M.optK=o?o.optK:M.mine.map(b=>b.opts[0].k);M.mkB=o?o.mkB:M.mine.map(()=>null);
  setKits(true);
}
const inn1Over=()=>M.st.wkts>=10||M.st.balls>=120;
const phaseChip=ph=>ph==='pp'?'Powerplay · 2 out':ph==='mid'?'Middle · 5 out':'Death';
function introBody(h){$('#iBody').innerHTML=h;$('#intro .card').classList.toggle('split',!!h);}
function bowlIntro(){
  const P=M.planet,st=M.st;
  $('#iTitle').textContent='You bowl first';
  $('#iText').textContent=P.name+'. '+P.team+' bat first. Choose the bowler and field for every over, bowl them out or keep them down, then chase what they make.';
  introBody('<p class="sc"><b>'+P.team+'</b> '+st.bat.map(batTag).join(', ')+'</p><p class="sc"><b>Your attack</b> '+
    M.mine.map(b=>b.name+' <small>'+ARCH[b.arch].name+'</small>').join(', ')+'</p>');
  $('#chaseBtn').textContent='Start bowling';showScreen('intro');S.paused=true;
}

/* --- over break: bowler and field picker --- */
const OPK={bi:0,pid:null,sg:null};
function pickUI(on){$('#overPick').hidden=!on;}
function bowlOver(cont){
  const st=M.st;
  if(cont&&st.bi>=0)return bowlOverGo(true);
  M.lastField=M.field;S.phase='pick';S.t=0;
  const sg=OPK.sg=inn1Suggest(st,M.attack);OPK.bi=sg.bi;OPK.pid=sg.pid;
  pickBuild();simUI($('#opSim'),true);pickUI(true);bowlUI();
}
// the plan offered first for a bowler other than the captain's: his archetype's default for the phase, if legal
function planFor(i){
  const ph=phaseOf(Math.floor(M.st.balls/6)),bw=M.attack[i],ids=planIds(bw,ph==='pp');
  return i===OPK.sg.bi?OPK.sg.pid:Object.keys(bw.plans[ph]).find(id=>ids.includes(id))||ids[0];
}
const whyNot=(st,i)=>st.bw[i].o>=4?'Bowled his 4 overs':i===st.last?'Bowled the last over':'Needed to finish the overs';
function pickBuild(){
  const st=M.st,o=Math.floor(st.balls/6),ph=phaseOf(o),legal=legalBowlers(st,o);
  $('#opTitle').textContent='Over '+(o+1)+' of 20';$('#opPhase').textContent=phaseChip(ph);
  $('#opBowlers').innerHTML=M.attack.map((b,i)=>{const ok=legal.includes(i),f=st.bw[i],n=f.o*6+f.b;
    return '<button data-i="'+i+'" aria-pressed="'+(i===OPK.bi)+'"'+(ok?'':' disabled')+'><b>'+b.name+(i===OPK.sg.bi?' <i>captain’s pick</i>':'')+'</b><small>'+ARCH[b.arch].name+'</small>'+
      '<span>'+(ok?(n?figures(i).t+' · ':'')+quotaText(4-f.o):whyNot(st,i))+'</span></button>';}).join('');
  $('#opPlans').innerHTML=planIds(M.attack[OPK.bi],ph==='pp').map(id=>'<button data-p="'+id+'" aria-pressed="'+(id===OPK.pid)+'">'+TPL[id].name+'</button>').join('');
  // preview: the plan's field on the ground and the radar, the bowler at his mark
  const bw=M.attack[OPK.bi];M.bowlerType=bw.type;M.spinDir=bw.dir||1;M.field=tplField(OPK.pid);M.plan={id:OPK.pid,mix:TPL[OPK.pid]};resetFielders();updateHUD();
}
$('#opBowlers').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled||!M||!M.bowl)return;OPK.bi=+b.dataset.i;OPK.pid=planFor(OPK.bi);pickBuild();});
$('#opPlans').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!M||!M.bowl)return;OPK.pid=b.dataset.p;pickBuild();});
$('#opGo').addEventListener('click',()=>{if(!M||!M.bowl||S.phase!=='pick'||S.paused)return;inn1Set(M.st,OPK.bi,OPK.pid);pickUI(false);bowlOverGo(false);});
function bowlOverGo(cont){
  const st=M.st,bw=M.attack[st.bi];
  Object.assign(M,{bi:st.bi,plan:{id:st.pid,mix:TPL[st.pid]},field:st.field,bowlerType:bw.type,spinDir:bw.dir||1});
  if(!cont)t20Save();
  const notes=[ARCH[bw.arch].name+' from '+bw.name+', '+quotaText(4-st.bw[st.bi].o),fieldLine(M.field,cont?[]:M.lastField||[],st.pid)];
  const ws=rollWind(M.planet);if(ws>0.5)notes.push('Wind '+Math.round(ws*3.6)+' km/h');
  if(M.overNo===1||cont)notes.unshift(M.planet.name);
  M.mk=M.mkB[st.bi]||optSpot(bw,bwOpt());
  updateHUD();banner('Over '+M.overNo+' of 20',notes.join('\n'),'small',2900);
  S.phase='break';S.t=0;S.breakDur=2.4;resetFielders();bowlUI();
}

/* --- Simulate rest (picker and pause): confirmed by a second tap; a ball in the air is bowled again by the simulation --- */
function simUI(btn,on){clearTimeout(simUI.t);btn.hidden=!on;btn.classList.remove('confirm');btn.textContent=btn.dataset.t;}
function simClick(btn){
  if(!M||!M.bowl)return;
  if(btn.classList.contains('confirm'))return simulateRest();
  btn.classList.add('confirm');btn.textContent='Tap again to simulate';clearTimeout(simUI.t);simUI.t=setTimeout(()=>simUI(btn,!btn.hidden),3500);
}
for(const id of ['#opSim','#simBtn'])$(id).addEventListener('click',e=>simClick(e.currentTarget));
function simulateRest(){
  const st=M.st;simRest(st,M.mine);M.runs=st.runs;M.wkts=st.wkts;M.balls=st.balls;inningsBreak();
}

/* --- per ball: delivery chips, marker, release meter --- */
const bwOpt=()=>{const bw=M.attack[M.st.bi];return bw.opts.find(o=>o.k===M.optK[bw.i])||bw.opts[0];};
function bowlReady(){
  Object.assign(S,{readyDur:Infinity,runupDur:M.bowlerType==='pace'?1.6:1.3,meter:null,relFb:null,mkDrag:null});
  if(!M.mk)M.mk=optSpot(M.attack[M.st.bi],bwOpt());
  chipsBuild();bowlUI();
}
function chipsBuild(){
  const bw=M.attack[M.st.bi],k=bwOpt().k;
  $('#optChips').innerHTML=bw.opts.map((o,i)=>'<button data-k="'+o.k+'" aria-pressed="'+(o.k===k)+'" aria-keyshortcuts="'+(i+1)+'">'+o.name+'</button>').join('');
}
// a delivery moves the marker to where it is meant to pitch (optSpot: its length, allowing for its movement); dragging adjusts it
function optPick(k){
  if(!M||!M.bowl||S.phase!=='ready'||S.paused)return;const bw=M.attack[M.st.bi],o=bw.opts.find(o=>o.k===k);if(!o)return;
  M.optK[bw.i]=k;M.mk=optSpot(bw,o);chipsBuild();
}
$('#optChips').addEventListener('click',e=>{const b=e.target.closest('button');if(b)optPick(b.dataset.k);});
// Bowl waits for a throw back to end (fieldTick calls this then): its thrower and receiver are then at their places for the run-up
function bowlUI(){
  const ph=S.phase,ru=ph==='runup';$('#optChips').classList.toggle('off',ph!=='ready');
  const b=$('#bowlBtn');b.textContent=ru?'Release':'Bowl';b.classList.toggle('off',ph!=='ready'&&!ru||ph==='ready'&&!!S.thr);
}
// the meter's cursor sweeps -1..1 over the last METER_T s of the run-up, so its end is the moment the ball leaves the hand
const METER_T=1;
function bowlPress(ts){
  if(!M||!M.bowl||S.paused)return;
  if(S.phase==='ready'&&!S.thr){S.mkDrag=null;S.phase='runup';S.t=0;S.bpos.x=S.bpos.z=0;recStart();S.meter={t0:clock+S.runupDur-METER_T,T:METER_T,tap:null};bowlUI();}
  else if(S.phase==='runup')bowlTap(ts);
}
// rel from the tap's own timestamp (gameTimeAt), never the frame that handles it; a tap before the cursor starts is ignored
function bowlTap(ts){
  const m=S.meter;if(!m||m.tap!=null)return;const u=(gameTimeAt(ts)-m.t0)/m.T;if(u<0)return;
  m.tap=clamp(2*u-1,-1,1);
}
function relText(rel,W,b){
  if(rel==null)return 'No release tap: a loose one';
  const e=Math.abs(rel)/W.good;
  if(e<=0.35)return 'Perfect release';if(e<=1)return 'Good release';
  if(e<=3.5)return rel<0?'Early: fuller':'Late: shorter';
  return b.high?'Way early: over head height, wide':b.wide?'Way '+(rel<0?'early':'late')+': wide':rel<0?'Way early: full toss':'Way late: long hop';
}
function bowlRelease(){
  const st=M.st,bw=M.attack[st.bi],m=M.mk,rel=S.meter?S.meter.tap:null,b=bowlDelivery(bw,bwOpt(),m,rel,M.diff);
  b.mark={x:m.x,z:m.z};b.start=clock;b.bounced=false;S.ball=b;S.phase='flight';M.mkB[st.bi]={x:m.x,z:m.z};
  S.relFb={rel,txt:relText(rel,bowlWindow(bw,M.diff),b)};
  const sw=aiBat(st,b,M.field);S.ai={sw,go:false};
  if(!sw.leave)S.bat={mode:'backlift',t0:clock,from:batAngleNow(),aim:0};
  bowlUI();
}
// the AI striker swings at its own time: S.swing and S.bat exactly as the slingshot's release sets them (impact at tc), so
// flightUpdate, the pose, contact targeting (aimSwing, ballNow) and replays treat it as a player's swing. Footwork: footUpdate
function aiTick(){
  const a=S.ai;if(!a||a.go||a.sw.leave||S.phase!=='flight')return;
  const b=S.ball,sw=a.sw,t0=sw.tc-SWING_DELAY;if(clock-b.start<t0)return;a.go=true;
  S.swing={tc:sw.tc,aim:sw.defend?0:sw.aim,power:sw.power,lofted:sw.lofted,defend:sw.defend,done:false};
  S.bat={mode:sw.defend?'block':'swing',t0:b.start+t0,from:batAngleNow(),aim:S.swing.aim};if(!sw.defend)sfx.swing(sw.power);
}
const ballChip=r=>r.out?{t:'W',cls:'cw'}:r.wide?{t:'wd',cls:'cwd'}:r.boundary===6?{t:'6',cls:'c6'}:r.boundary===4?{t:'4',cls:'c4'}:{t:r.runs?String(r.runs):'•'};
function bowlRecord(res,b){
  const st=M.st;M.overDone=inn1Record(st,b,res,S.swing&&S.swing.bp||{x:S.bpos.x,z:S.bpos.z});
  M.runs=st.runs;M.wkts=st.wkts;M.balls=st.balls;M.overBalls.push(ballChip(res));t20Save();
}
function bowlAfter(){
  if(inn1Over())return rpThen(rpWant(true),inningsBreak);
  const nx=M.overDone?newOver:nextBall;M.overDone=false;rpThen(rpWant(),nx);
}

/* --- marker: dragged anywhere (it moves with the finger, offset so the finger doesn't cover it), a tap on the ground puts it
   there, arrows/WASD nudge it. Ground point from the screen with unprojGround (proj's inverse) --- */
function mkSet(x,z){M.mk={x:clamp(x,-1.2,1.4),z:clamp(z,0.3,11.5)};}
function bowlDown(e){
  if(S.paused)return;e.preventDefault();
  if(S.phase==='runup')return bowlTap(perfOf(e));
  if(S.phase!=='ready')return;
  const r=cvs.getBoundingClientRect(),q=proj(M.mk.x,0,M.mk.z);if(!q)return;
  S.mkDrag={id:e.pointerId,x0:e.clientX-r.left,y0:e.clientY-r.top,qx:q.x,qy:q.y,mv:0};try{cvs.setPointerCapture(e.pointerId);}catch(_){}
}
function bowlMove(e){
  const d=S.mkDrag;if(!d||e.pointerId!==d.id||S.phase!=='ready')return;const r=cvs.getBoundingClientRect(),dx=e.clientX-r.left-d.x0,dy=e.clientY-r.top-d.y0;
  d.mv=Math.max(d.mv,Math.hypot(dx,dy));if(d.mv<6)return;const g=unprojGround(d.qx+dx,d.qy+dy);if(g)mkSet(g.x,g.z);
}
function bowlUp(e){const d=S.mkDrag;if(!d||e.pointerId!==d.id)return;S.mkDrag=null;if(d.mv<6&&S.phase==='ready'){const g=unprojGround(d.x0,d.y0);if(g)mkSet(g.x,g.z);}}
function bowlKeys(dt){
  if(S.phase!=='ready'||S.paused)return;let x=0,z=0;for(const k in KEYS){x+=FW_KEYS[k][0];z+=FW_KEYS[k][1];}
  // from the bowler's end screen left is the off side (+x) and up is toward the batter (shorter z)
  if(x||z)mkSet(M.mk.x-x*0.8*dt,M.mk.z-z*3*dt);
}
function bowlKey(e){
  if(S.paused)return false;
  if(e.metaKey||e.ctrlKey||e.altKey)return false;
  if((e.code==='Space'||e.key==='Enter')&&(S.phase==='ready'||S.phase==='runup')){e.preventDefault();if(!e.repeat)bowlPress(perfOf(e));return true;}
  const n=+e.key;if(n>=1&&n<=5&&S.phase==='ready'){const o=M.attack[M.st.bi].opts[n-1];if(o)optPick(o.k);return true;}
  return false;
}
$('#bowlBtn').addEventListener('pointerdown',e=>{e.preventDefault();bowlPress(perfOf(e));});

/* --- drawing (2D overlay with proj): the marker and its length, where the ball pitched, the meter and the release note --- */
const LZN={Y:'Yorker',F:'Full',G:'Good length',S:'Short',B:'Bouncer'};
function ringAt(x,z,r){ctx.beginPath();for(let i=0;i<=24;i++){const a=i/24*2*Math.PI,q=proj(x+r*Math.cos(a),0,z+r*Math.sin(a));if(!q)return false;i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);}return true;}
function drawBowl(){
  if(!M||!M.bowl)return;const ph=S.phase,b=S.ball,bt=b?clock-b.start:0;
  ctx.save();
  if(M.mk&&(ph==='ready'||ph==='runup'||ph==='flight'&&bt<b.t1)){
    const m=M.mk;
    if(ringAt(m.x,m.z,0.3)){ctx.fillStyle='rgba(242,177,52,.28)';ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle=ph==='ready'?'#f2b134':'rgba(242,177,52,.6)';ctx.stroke();}
    const c=proj(m.x,0,m.z);
    if(c&&ph==='ready'){ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1.5;line(c.x-5,c.y,c.x+5,c.y);line(c.x,c.y-4,c.x,c.y+4);
      const t=LZN[lenCode(m.z)];ctx.font='700 14px "Barlow",system-ui,sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.6)';
      ctx.strokeText(t,c.x,c.y-0.3*c.s-10);ctx.fillStyle='#fff';ctx.fillText(t,c.x,c.y-0.3*c.s-10);}
  }
  if(b&&(ph==='flight'&&bt>=b.t1||ph==='result')&&ringAt(b.xb,b.zb,0.1)){ctx.fillStyle='rgba(255,90,74,.75)';ctx.fill();}
  const m=S.meter;
  if(m&&(ph==='runup'||ph==='flight'||ph==='result')){
    // portrait: in the chips' place, left of the Bowl button; landscape: bottom centre
    const Wd=bowlWindow(M.attack[M.bi],M.diff),bw=LAND?Math.min(320,W*0.38):Math.min(300,W-124),x0=LAND?(W-bw)/2:10+(W-114-bw)/2,y=LAND?H-SAFE.b-34:H-56,h=14,X=v=>x0+(v+1)/2*bw;
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(x0-4,y-4,bw+8,h+8);
    for(const [a,c] of [[1,'#8b3a3a'],[Math.min(1,Wd.bad),'#d99a2b'],[Wd.good,'#3ec46d']]){ctx.fillStyle=c;ctx.fillRect(X(-a),y,X(a)-X(-a),h);}
    ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillRect(X(0)-0.5,y,1,h);
    const u=m.tap!=null?(m.tap+1)/2:(clock-m.t0)/m.T;
    if(u>=0&&(m.tap!=null||ph==='runup')){const cx=x0+clamp(u,0,1)*bw;ctx.fillStyle='#fff';ctx.fillRect(cx-2,y-6,4,h+12);
      if(m.tap!=null){ctx.beginPath();ctx.moveTo(cx,y-7);ctx.lineTo(cx-7,y-17);ctx.lineTo(cx+7,y-17);ctx.fill();}}
    ctx.font='600 12.5px "Barlow",system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,.85)';
    ctx.textAlign='left';ctx.fillText('Early: fuller',x0,y+h+15);ctx.textAlign='right';ctx.fillText('Late: shorter',x0+bw,y+h+15);
    const txt=S.relFb?S.relFb.txt:'';
    if(txt){ctx.textAlign='center';ctx.font='700 15px "Barlow",system-ui,sans-serif';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.55)';ctx.strokeText(txt,x0+bw/2,y-22);ctx.fillStyle='#fff';ctx.fillText(txt,x0+bw/2,y-22);}
  }
  ctx.restore();
}

/* --- HUD and cards --- */
function bowlHUD(){
  const st=M.st,ph=phaseOf(Math.min(19,Math.floor(st.balls/6))),rr=st.balls?st.runs/st.balls*6:0,bi=st.bi>=0?st.bi:S.phase==='pick'?OPK.bi:M.bi,bw=M.attack[bi],q=4-st.bw[bi].o;
  $('#sOvers').textContent=oversText(st.balls)+' of 20 overs';
  $('#sTargetLbl').textContent='Run rate';$('#sTarget').textContent=rr.toFixed(1);
  $('#sNeed').textContent=st.balls>=6?'Heading for '+Math.round(st.runs+rr*(120-st.balls)/6):'';
  $('#tPhase').textContent=phaseChip(ph);$('#tRate').textContent=M.plan?TPL[M.plan.id].name:'';
  $('#tBowler').textContent=bw.name+' '+figures(bi).t+', '+(q>0?quotaText(q):'bowled out');$('#tPace').textContent='';
  $('#tBat0').innerHTML=batCard(st,st.s);$('#tBat1').innerHTML=batCard(st,st.ns);
}
const topBat=(st,n)=>st.bat.filter(p=>p.balls||p.out).sort((a,b)=>b.runs-a.runs||a.balls-b.balls).slice(0,n);
const bowled=(st,attack)=>attack.map((b,i)=>({b,i,f:st.bw[i]})).filter(x=>x.f.o||x.f.b).sort((x,y)=>y.f.w-x.f.w||x.f.r-y.f.r);
// the chase's pause card and end text: the first innings in a line
function inn1Line(){const i=M.i1,bb=bowled(i,M.mine)[0];
  return '<p class="sc"><b>1st innings</b> '+M.planet.team+' '+i.runs+'/'+i.wkts+' ('+oversText(i.balls)+' ov)'+(bb?' · best bowling '+bb.b.name+'\u00a0'+bb.f.w+'\u2011'+bb.f.r:'')+'</p>';}
// the innings break: their total, top scorers, the player's bowling (best first), then Chase N
function inningsBreak(){
  const i=M.i1,P=M.planet,row=c=>'<tr>'+c.map(x=>'<td>'+x+'</td>').join('')+'</tr>';
  rpUI(false);pickUI(false);ctlUI(false);
  Object.assign(S,{ball:null,swing:null,ai:null,hit:null,res:null,deferred:null,chase:null,stumps:null,thr:null,meter:null,relFb:null,mkDrag:null,timing:null,phase:'idle',paused:true});
  $('#banner').className='';$('#hud').hidden=true;hint('');
  inn2Enter();t20Save();
  $('#iTitle').textContent=P.team+' '+i.runs+'/'+i.wkts;
  $('#iText').textContent=(i.wkts>=10?'All out in '+oversText(i.balls)+' overs.':'Their 20 overs are done.')+' You need '+M.target+' from 120 balls, with 10 wickets in hand.';
  introBody('<table class="sc"><thead><tr><th>Top scorers</th><th>R</th><th>B</th></tr></thead><tbody>'+topBat(i,3).map(p=>row([batTag(p),p.runs+(p.out?'':'*'),p.balls])).join('')+'</tbody></table>'+
    '<table class="sc"><thead><tr><th>Your bowling</th><th>O</th><th>M</th><th>R</th><th>W</th></tr></thead><tbody>'+
    bowled(i,M.mine).map(x=>{const f=figures(x.i,i);return row([x.b.name+' <small>'+ARCH[x.b.arch].name+'</small>',f.o,f.md,f.r,f.w]);}).join('')+'</tbody></table>');
  $('#chaseBtn').textContent='Chase '+M.target;showScreen('intro');
}
