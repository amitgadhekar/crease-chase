/* ---------- menu wiring ---------- */
function buildPlanetGrid(){
  const grid=$('#planetGrid');grid.innerHTML='';
  for(const k of PLANET_ORDER){const P=PLANETS[k],b=document.createElement('button');b.dataset.v=k;
    b.innerHTML='<i style="background:'+P.vis.sw+'"></i>'+P.name;b.addEventListener('click',()=>{settings.planet=k;store.set('settings',settings);refreshMenu();});grid.appendChild(b);}
}
function refreshMenu(){
  $('#planetGrid').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===settings.planet)));
  const PP=PLANETS[settings.planet]||PLANETS.earth;$('#planetBlurb').textContent=PP.blurb+' Gravity '+(PP.g/9.8).toFixed(2)+'× Earth.';
  document.querySelectorAll('.seg').forEach(seg=>{const k=seg.dataset.key;seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(String(settings[k])===b.dataset.v)));});
  const sm=settings.mode==='scen';
  $('#lenOpt').style.display=settings.mode==='chase'?'':'none';$('#netsOpt').style.display=settings.mode==='nets'?'':'none';
  for(const id of ['#venueOpt','#diffOpt','#startBtn'])$(id).style.display=sm?'none':'';$('#scenOpt').style.display=sm?'':'none';
  $('#optAssist').checked=settings.assist;$('#optSound').checked=settings.sound;
  const fmt=recFmt(),r=(records[settings.diff]||{})[fmt],L=LENGTHS[settings.len]||LENGTHS[1];
  $('#recordLine').textContent=r&&(r.p||r.hs)?'On '+settings.diff+(fmt==='t20'?', T20':'')+': '+r.w+' of '+r.p+' chases won.'+' Highest score '+r.hs+'.':'';
  $('#lenBlurb').textContent=L.t20?'20 overs, 10 wickets, against a five-bowler attack with real fielding restrictions. Saved after every ball.':L.overs+(L.overs>1?' overs, ':' over, ')+L.w+' wickets.';
  if(sm){const n=SCEN.reduce((a,s)=>a+scStars(s.id),0);$('#recordLine').textContent=n?'Scenarios: '+n+' of '+SCEN.length*3+' stars.':'';}
  const sv=t20Saved(),rb=$('#resumeT20');rb.hidden=!sv;
  if(sv)rb.textContent='Resume T20: '+PLANETS[sv.pk].name+', '+sv.st.runs+'/'+sv.st.wkts+' after '+oversText(sv.st.balls)+' overs';
}
document.querySelectorAll('.seg').forEach(seg=>seg.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const k=seg.dataset.key;settings[k]=(k==='len'||k==='netsW')?+b.dataset.v:b.dataset.v;store.set('settings',settings);refreshMenu();}));
$('#optAssist').addEventListener('change',e=>{settings.assist=e.target.checked;store.set('settings',settings);});
$('#optSound').addEventListener('change',e=>{settings.sound=e.target.checked;store.set('settings',settings);if(settings.sound)audio();});
$('#startBtn').addEventListener('click',startMatch);
$('#resumeT20').addEventListener('click',resumeT20);
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
if(location.hash==='#test')window.__t={S,getM:()=>M,clk:()=>clock,rp:()=>RP,cam3:camParity,t20:()=>M&&M.t20?{runs:M.runs,wkts:M.wkts,balls:M.balls,target:M.target,bi:M.bi,pid:M.plan&&M.plan.id,type:M.bowlerType,overNo:M.overNo,
  ok:fieldOk(M.field,phaseOf(Math.max(0,M.overNo-1))==='pp'),field:M.field.map(f=>f.n+'@'+f.x.toFixed(1)+','+f.z.toFixed(1)).join(' '),bw:JSON.stringify(M.st.bw),
  s:M.st.s,ns:M.st.ns,bat:JSON.stringify(M.st.bat),hold:!!S.hold,ns3d:LV.ns.on}:null,
  scen:()=>M&&M.sc?{id:M.sc.id,runs:M.st.runs,wkts:M.st.wkts,balls:M.st.balls,s:M.st.s,ns:M.st.ns,ob:M.st.ob,hold:!!S.hold,pid:M.pid,ok:fieldOkTest(M.field),
    bi:M.bi,overNo:M.overNo,chips:M.overBalls.map(c=>c.t).join(' '),field:M.field.map(f=>f.n+'@'+f.x.toFixed(1)+','+f.z.toFixed(1)).join(' '),bw:JSON.stringify(M.st.bw),bat:JSON.stringify(M.st.bat),
    md:M.md.join(),hud:['#sOvers','#sTarget','#cObj','#cCond','#cBat0','#cBat1','#cBowl'].map(q=>$(q).textContent).join(' | '),
    viol:M.st.viol.bouncer+M.st.viol.field,ns3d:LV.ns.on}:null,sfx:()=>({decoded:Object.keys(SFXBUF).length,expected:Object.keys(SFX_DATA).length})};
buildPlanetGrid();buildScenList();applyPlanet(setPlanet(settings.planet));resize();refreshMenu();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(resize);
requestAnimationFrame(frame);