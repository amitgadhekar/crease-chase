/* ---------- HUD ---------- */
function oversText(b){return Math.floor(b/6)+'.'+(b%6);}
function updateHUD(){
  if(!M)return;
  $('#sRuns').textContent=M.runs+'/'+M.wkts;
  const chips=$('#chips');chips.innerHTML='';
  for(const c of M.overBalls){const e=document.createElement('span');e.className='chip '+(c.cls||'');e.textContent=c.t;chips.appendChild(e);}
  if(M.mode==='chase'){
    $('#sOvers').textContent=oversText(M.balls)+' of '+M.overs+' overs';
    $('#sTargetLbl').textContent='Target';$('#sTarget').textContent=M.target;
    const need=Math.max(0,M.target-M.runs),left=M.overs*6-M.balls;
    $('#sNeed').textContent=need>0?need+' from '+left+(left===1?' ball':' balls'):'Target reached';
  }else{
    $('#sOvers').textContent=M.balls+(M.balls===1?' ball':' balls');
    $('#sTargetLbl').textContent='Strike rate';$('#sTarget').textContent=M.balls?Math.round(M.runs/M.balls*100):0;
    $('#sNeed').textContent=isFinite(M.wktsMax)?(M.wktsMax-M.wkts)+(M.wktsMax-M.wkts===1?' wicket left':' wickets left'):M.fours+' fours, '+M.sixes+' sixes';
  }
}
let bannerTimer=0;
function banner(main,sub,cls,dur){
  const b=$('#banner');$('#bMain').textContent=main;$('#bSub').textContent=sub||'';
  b.className='show '+(cls||'');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>b.className=cls||'',dur||1500);
}
function hint(text){const h=$('#hint');h.textContent=text||'';h.style.opacity=text?1:0;}

