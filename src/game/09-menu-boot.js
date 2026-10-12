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
  $('#lenOpt').style.display=settings.mode==='chase'?'':'none';$('#netsOpt').style.display=settings.mode==='nets'?'':'none';
  $('#optAssist').checked=settings.assist;$('#optSound').checked=settings.sound;
  const r=records[settings.diff];
  $('#recordLine').textContent=r&&(r.p||r.hs)?'On '+settings.diff+': '+r.w+' of '+r.p+' chases won.'+' Highest score '+r.hs+'.':'';
}
document.querySelectorAll('.seg').forEach(seg=>seg.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const k=seg.dataset.key;settings[k]=(k==='len'||k==='netsW')?+b.dataset.v:b.dataset.v;store.set('settings',settings);refreshMenu();}));
$('#optAssist').addEventListener('change',e=>{settings.assist=e.target.checked;store.set('settings',settings);});
$('#optSound').addEventListener('change',e=>{settings.sound=e.target.checked;store.set('settings',settings);if(settings.sound)audio();});
$('#startBtn').addEventListener('click',startMatch);
$('#chaseBtn').addEventListener('click',beginPlay);
$('#introBack').addEventListener('click',quitToMenu);
$('#pauseBtn').addEventListener('click',pause);
$('#loftBtn').addEventListener('click',()=>{if(M&&!S.paused)setLoft(!S.loft);});
$('#resumeBtn').addEventListener('click',()=>{showScreen(null);S.paused=false;sfx.duck(0);});
$('#restartBtn').addEventListener('click',startMatch);
$('#quitBtn').addEventListener('click',()=>{if(M&&M.mode==='nets'&&M.balls>0)endMatch('nets');else quitToMenu();});
$('#againBtn').addEventListener('click',startMatch);
$('#menuBtn').addEventListener('click',quitToMenu);
$('#rpSkip').addEventListener('click',()=>{if(S.phase==='replay'&&!S.paused)rpEnd();});
$('#resetBrain').addEventListener('click',e=>{mem={};store.set('mem',mem);e.target.textContent='Done. The bowler starts fresh.';});

// Test hook for tests/smoke.mjs; only exposed when the page is opened with #test.
if(location.hash==='#test')window.__t={S,getM:()=>M,clk:()=>clock,rp:()=>RP,cam3:camParity,sfx:()=>({decoded:Object.keys(SFXBUF).length,expected:Object.keys(SFX_DATA).length})};
buildPlanetGrid();applyPlanet(setPlanet(settings.planet));resize();refreshMenu();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(resize);
requestAnimationFrame(frame);