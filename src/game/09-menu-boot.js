/* ---------- main menu: the hub (Continue, mode cards, settings, how-to) over the live stadium, one sheet per mode ---------- */
const MODES={quick:{t:'Quick match',mode:'chase'},t20:{t:'T20',mode:'t20'},nets:{t:'Nets',mode:'nets'},scen:{t:'Scenarios'}};
let sheetMode=null;
function buildPlanetGrid(){
  const grid=$('#planetGrid');grid.innerHTML='';
  for(const k of PLANET_ORDER){const P=PLANETS[k],b=document.createElement('button');b.dataset.v=k;b.setAttribute('aria-label',P.name);
    b.innerHTML='<i'+(P.vis.rings?' class="ring"':'')+' style="background:'+P.vis.sw+'"></i>';
    b.addEventListener('click',()=>{settings.planet=k;store.set('settings',settings);preview(k);refreshMenu();});grid.appendChild(b);}
}
// the live stadium switches to the chosen planet; the 3D layers fade in over the rebuild
function preview(k){
  if(PLANETS[k]===shownP)return;
  applyPlanet(setPlanet(k));const a=$('#app');a.classList.remove('swap');void a.offsetWidth;a.classList.add('swap');
}
const recText=(r,none,hs)=>r&&(r.p||r.hs)?settings.diff[0].toUpperCase()+settings.diff.slice(1)+': won '+r.w+' of '+r.p+' · '+(hs||'best')+' '+r.hs:none;
const ovShort=b=>b%6?oversText(b):String(b/6);
function refreshMenu(){
  const m=sheetMode,PP=PLANETS[settings.planet]||PLANETS.earth,v=PP.vis,L=LENGTHS[settings.len]||LENGTHS[1],rd=records[settings.diff]||{};
  $('#planetGrid').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===settings.planet)));
  $('#planetBlurb').innerHTML='<b>'+PP.name+'.</b> '+PP.blurb+' Gravity '+(PP.g/9.8).toFixed(2)+'× Earth.';
  document.querySelectorAll('.seg').forEach(seg=>{const k=seg.dataset.key;seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(String(settings[k])===b.dataset.v)));});
  $('#scenOpt').hidden=m!=='scen';$('#venueOpt').hidden=$('#diffOpt').hidden=$('#sgo').hidden=m==='scen';$('#lenOpt').hidden=m!=='quick';$('#netsOpt').hidden=m!=='nets';
  $('#lenBlurb').textContent=m==='quick'?L.overs+(L.overs>1?' overs, ':' over, ')+L.w+' wickets. Chase the '+PP.team+'’s total.'
    :m==='t20'?'A full match. Bowl 20 overs as captain (pick the bowler and field each over, then line, length and release), then chase their total. Saved after every ball.'+(t20Saved()?' A new one replaces your saved T20.':'')
    :m==='nets'?'No target: face pace and spin in turn and work on your shots.':'';
  $('#optAssist').checked=settings.assist;$('#optSound').checked=settings.sound;
  $('#artQuick').style.background='linear-gradient(180deg,'+v.sky[0]+','+v.sky[1]+' 58%,'+v.ground[0]+' 58%,'+v.ground[1]+')';
  $('#recQuick').textContent=recText(rd.short,'Chase a target in 1, 2 or 5 overs');
  $('#recT20').textContent=recText(rd.t20,'Bowl 20 overs, then chase','best chase');
  const n=SCEN.reduce((a,s)=>a+scStars(s.id),0),N=SCEN.length*3;$('#recScen').textContent=n+' of '+N+' stars';$('#scenBar').style.width=n/N*100+'%';
  $('#artScen').innerHTML=[1,2,3,4,5].map(t=>{const ss=SERIES.filter(s=>s.test===t);
    return '<i class="'+(ss.some(s=>scStars(s.id))?'on':'')+'" style="background:'+PLANETS[ss[0].planet].vis.sw+'"></i>';}).join('');
  const sv=t20Saved(),ss=scenSaved(),rb=$('#resumeT20'),cs=$('#contScen');rb.hidden=!sv;cs.hidden=!ss;
  $('#cont').hidden=!sv&&!ss;$('#cont').classList.toggle('two',!!sv&&!!ss);
  if(sv){const st=sv.inn===1?sv.i1:sv.st;rb.innerHTML='<i class="cic">20</i><span><b>Continue T20</b><small>'+PLANETS[sv.pk].name+' · '+
    (sv.inn===1?'Bowling: ':'Chasing '+st.target+': ')+st.runs+'/'+st.wkts+' after '+ovShort(st.balls)+(st.balls===6?' over':' overs')+'</small></span><em></em>';}
  if(ss){const t=scenResumeText(ss);cs.innerHTML='<i class="cic red"></i><span><b>Continue: '+t[0]+'</b><small>'+t[1]+'</small></span><em></em>';}
}
// id: the sheet element; m: the mode it is set up for (mode sheet only)
function openSheet(id,m){
  if(id==='sheet'){sheetMode=m;$('#shTitle').textContent=MODES[m].t;if(m==='scen')buildScenList();else preview(settings.planet);$('#sheet .sbody').scrollTop=0;}
  refreshMenu();
  document.querySelectorAll('.sheet').forEach(s=>s.classList.toggle('open',s.id===id));
  $('#menu').classList.add('sheet-on');$('#hub').inert=true;$('#'+id+' .x').focus({preventScroll:true});
}
function closeSheet(){
  document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('open'));
  $('#menu').classList.remove('sheet-on');$('#hub').inert=false;sheetMode=null;
}
function showMenu(sheet){showScreen('menu');if(sheet)openSheet('sheet',sheet);else{closeSheet();refreshMenu();}}
document.querySelectorAll('.mcard').forEach(c=>c.addEventListener('click',()=>openSheet('sheet',c.dataset.m)));
document.querySelectorAll('.sheet .x').forEach(b=>b.addEventListener('click',closeSheet));
$('#scrim').addEventListener('click',closeSheet);
addEventListener('keydown',e=>{if(e.key==='Escape'&&MENU.on&&$('#menu').classList.contains('sheet-on'))closeSheet();});
$('#setBtn').addEventListener('click',()=>openSheet('setSheet'));
$('#howBtn').addEventListener('click',()=>openSheet('howSheet'));
document.querySelectorAll('.seg').forEach(seg=>seg.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const k=seg.dataset.key;settings[k]=(k==='len'||k==='netsW')?+b.dataset.v:b.dataset.v;store.set('settings',settings);refreshMenu();}));
$('#optAssist').addEventListener('change',e=>{settings.assist=e.target.checked;store.set('settings',settings);});
$('#optSound').addEventListener('change',e=>{settings.sound=e.target.checked;store.set('settings',settings);if(settings.sound)audio();});
$('#startBtn').addEventListener('click',()=>{settings.mode=MODES[sheetMode].mode;store.set('settings',settings);closeSheet();startMatch();});
$('#resumeT20').addEventListener('click',resumeT20);
$('#contScen').addEventListener('click',resumeScen);
$('#scenResume').addEventListener('click',resumeScen);
$('#chaseBtn').addEventListener('click',()=>beginPlay());
$('#introBack').addEventListener('click',quitToMenu);
$('#pauseBtn').addEventListener('click',pause);
$('#loftBtn').addEventListener('click',()=>{if(M&&!S.paused)setLoft(!S.loft);});
$('#resumeBtn').addEventListener('click',()=>{showScreen(null);S.paused=false;sfx.duck(0);});
$('#restartBtn').addEventListener('click',startMatch);
$('#quitBtn').addEventListener('click',()=>{if(M&&M.mode==='nets'&&M.balls>0)endMatch('nets');else quitToMenu();});
$('#againBtn').addEventListener('click',startMatch);
$('#nextBtn').addEventListener('click',()=>{const n=M&&M.sc&&scNextOf(M.sc);if(n)scenBrief(n);});
$('#gPlay').addEventListener('click',()=>startScen(scenBrief.sc));
$('#gBack').addEventListener('click',quitToMenu);
$('#holdBtn').addEventListener('click',()=>{if(S.hold&&!S.paused)holdEnd(true);});
$('#menuBtn').addEventListener('click',quitToMenu);
$('#rpSkip').addEventListener('click',()=>{if(S.phase==='replay'&&!S.paused)rpEnd();});
$('#resetBrain').addEventListener('click',e=>{mem={};store.set('mem',mem);e.target.textContent='Done. The bowler starts fresh.';});

// Test hook for tests/smoke.mjs; only exposed when the page is opened with #test.
if(location.hash==='#test')window.__t={S,getM:()=>M,clk:()=>clock,rp:()=>RP,rec:()=>({n:REC.n,max:RMAX}),cam3:camParity,cam:()=>({yaw:cam.yaw,y:cam.y,F,HZ,base:F===baseF&&HZ===baseHZ,planet:curPlanet,menu:MENU.on,sheet:sheetMode}),t20:()=>M&&M.t20?{runs:M.runs,wkts:M.wkts,balls:M.balls,target:M.target,bi:M.bi,pid:M.plan&&M.plan.id,type:M.bowlerType,overNo:M.overNo,
  ok:fieldOk(M.field,phaseOf(Math.max(0,M.overNo-1))==='pp'),field:M.field.map(f=>f.n+'@'+f.x.toFixed(1)+','+f.z.toFixed(1)).join(' '),bw:JSON.stringify(M.st.bw),
  s:M.st.s,ns:M.st.ns,bat:JSON.stringify(M.st.bat),hold:!!S.hold,ns3d:LV.ns.on,inn:M.inn,aiAtk:M.attack===M.aiAtk,i1:M.i1?M.i1.runs+'/'+M.i1.wkts:'',kit:KS.you}:null,
  // T20 first innings: state, the over picker, the last ball's inputs; bowlTap(rel) taps the meter at the game time that gives rel
  bowl:()=>M&&M.bowl?{inn:M.inn,phase:S.phase,runs:M.st.runs,wkts:M.st.wkts,balls:M.st.balls,bi:M.st.bi,pid:M.st.pid,s:M.st.s,ns:M.st.ns,overNo:M.overNo,
    bw:JSON.stringify(M.st.bw),bat:JSON.stringify(M.st.bat),mk:M.mk&&M.mk.x.toFixed(3)+','+M.mk.z.toFixed(3),optK:M.optK.join(),mkB:JSON.stringify(M.mkB),chips:M.overBalls.map(c=>c.t).join(' '),
    pick:{bi:OPK.bi,pid:OPK.pid,sg:OPK.sg,legal:legalBowlers(M.st,Math.floor(M.st.balls/6)),dis:[...document.querySelectorAll('#opBowlers button:disabled')].map(b=>+b.dataset.i)},
    ball:S.ball&&{opt:S.ball.opt,mk:S.ball.mk,rel:S.ball.rel,mark:S.ball.mark,zb:S.ball.zb,len:S.ball.len},ai:S.ai&&{leave:!!S.ai.sw.leave,defend:!!S.ai.sw.defend,tc:S.ai.sw.tc,go:S.ai.go},
    swing:!!S.swing,meter:S.meter&&{tap:S.meter.tap},rel:S.relFb&&S.relFb.txt,mkScreen:M.mk&&(q=>q&&[q.x,q.y])(proj(M.mk.x,0,M.mk.z)),fieldOk:fieldOk(M.field,phaseOf(Math.floor(M.st.balls/6))==='pp'),
    kit:KS.you}:null,
  bowlTap:rel=>{const m=S.meter;bowlTap(clockPerf+(m.t0+(rel+1)/2*m.T-clock)*1000);return S.meter.tap;},
  scen:()=>M&&M.sc?{id:M.sc.id,runs:M.st.runs,wkts:M.st.wkts,balls:M.st.balls,s:M.st.s,ns:M.st.ns,ob:M.st.ob,hold:!!S.hold,pid:M.pid,ok:fieldOkTest(M.field),
    bi:M.bi,overNo:M.overNo,chips:M.overBalls.map(c=>c.t).join(' '),field:M.field.map(f=>f.n+'@'+f.x.toFixed(1)+','+f.z.toFixed(1)).join(' '),bw:JSON.stringify(M.st.bw),bat:JSON.stringify(M.st.bat),
    md:M.md.join(),hud:['#sOvers','#sTarget','#cObj','#cCond','#cBat0','#cBat1','#cBowl'].map(q=>$(q).textContent).join(' | '),
    viol:M.st.viol.bouncer+M.st.viol.field,ns3d:LV.ns.on}:null,sfx:()=>({decoded:Object.keys(SFXBUF).length,expected:Object.keys(SFX_DATA).length}),
  // fielding: the fielders as drawn (live or replay), the field set for the next ball (keeper at his stance), the camera in use
  fv:()=>{const V=S.phase==='replay'?RV:LV;return V.f.slice(0,V.nf).map(f=>({on:f.on,kp:f.kp,act:f.act,ap:f.ap,x:f.x,z:f.z,hx:f.hx,hy:f.hy,hz:f.hz,face:f.face}));},
  fieldSet:f=>{M.field=f;resetFielders();},view:()=>({bat:batView(),cord:!!S.cord,chase:!!S.chase}),
  // the ball and stumps as drawn (live or replay): bk = held by the keeper, hidden with him in the batting view; st/st2 = hit near/far stumps
  vb:()=>{const V=S.phase==='replay'?RV:LV,b=V.ball;return {b:b&&{x:b.x,y:b.y,z:b.z},bk:V.bk,vis:!!G3&&G3.ball.visible,st:V.st&&{a:V.st.a,bails:V.st.bails},st2:V.st2&&{a:V.st2.a}};},
  pj:(x,y,z)=>proj(x,y,z)};
buildPlanetGrid();applyPlanet(setPlanet(settings.planet));resize();showMenu(null);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(resize);
requestAnimationFrame(frame);
// the loading screen (index.html) fades out once the stadium has drawn a couple of frames
bootStep(.95,'Building the stadium…');requestAnimationFrame(()=>requestAnimationFrame(bootDone));