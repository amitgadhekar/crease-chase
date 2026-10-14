/* ---------- HUD ---------- */
function oversText(b){return Math.floor(b/6)+'.'+(b%6);}
function updateHUD(){
  if(!M)return;
  $('#sRuns').textContent=M.runs+'/'+M.wkts;
  const chips=$('#chips');chips.innerHTML='';
  for(const c of M.overBalls){const e=document.createElement('span');e.className='chip '+(c.cls||'');e.textContent=c.t;chips.appendChild(e);}
  if(M.sc)scenHUD();
  else if(M.mode==='chase'){
    $('#sOvers').textContent=oversText(M.balls)+' of '+M.overs+' overs';
    $('#sTargetLbl').textContent='Target';$('#sTarget').textContent=M.target;
    const need=Math.max(0,M.target-M.runs),left=M.overs*6-M.balls;
    $('#sNeed').textContent=need>0?need+' from '+left+(left===1?' ball':' balls'):'Target reached';
    if(M.t20)t20HUD(need,left);
  }else{
    $('#sOvers').textContent=M.balls+(M.balls===1?' ball':' balls');
    $('#sTargetLbl').textContent='Strike rate';$('#sTarget').textContent=M.balls?Math.round(M.runs/M.balls*100):0;
    $('#sNeed').textContent=isFinite(M.wktsMax)?(M.wktsMax-M.wkts)+(M.wktsMax-M.wkts===1?' wicket left':' wickets left'):M.fours+' fours, '+M.sixes+' sixes';
  }
}
// T20 rows: phase and its restriction, required vs current rate, the batters (as in Scenarios), bowler figures, and the pace
// marker against the chase benchmark "half the target by over 10" (a straight line from 0 to the target over 120 balls)
function t20HUD(need,left){
  const ph=phaseOf(Math.min(19,Math.floor(M.balls/6))),par=M.target*M.balls/120,d=Math.round(M.runs-par),f=figures(M.bi),bw=M.attack[M.bi];
  $('#tPhase').textContent=ph==='pp'?'Powerplay \u00b7 2 out':ph==='mid'?'Middle \u00b7 5 out':'Death';
  $('#tRate').textContent=need>0&&left>0?'Need '+(need/left*6).toFixed(1)+(M.balls?' \u00b7 Now '+(M.runs/M.balls*6).toFixed(1):'')+' an over':'';
  $('#tBowler').textContent=bw.name+' '+f.t+', '+quotaText(4-M.st.bw[M.bi].o);
  $('#tBat0').innerHTML=batCard(M.st,M.st.s);$('#tBat1').innerHTML=batCard(M.st,M.st.ns);
  $('#tPace').textContent=M.balls?(d>0?d+' ahead':d<0?-d+' behind':'on pace'):'';
  $('#tFill').style.width=clamp(M.runs/M.target,0,1)*100+'%';$('#tFill').className=d<0?'behind':'';$('#tTick').style.left=clamp(M.balls/120,0,1)*100+'%';
}
let bannerTimer=0;
function banner(main,sub,cls,dur){
  const b=$('#banner');$('#bMain').textContent=main;$('#bSub').textContent=sub||'';
  b.className='show '+(cls||'');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>b.className=cls||'',dur||1500);
}
function hint(text){const h=$('#hint');h.textContent=text||'';h.style.opacity=text?1:0;}

