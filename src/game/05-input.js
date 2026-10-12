/* ---------- input ---------- */
const dragMax=()=>Math.min(W,H)*0.3;
function setLoft(v){S.loft=!!v;$('#loftBtn').setAttribute('aria-pressed',String(S.loft));}
function aimDeg(dx,dy){return Math.atan2(-dx,dy)/D2R;}
function perfOf(e){const n=performance.now(),t=e.timeStamp;return (t>0&&t<=n+5&&n-t<1000)?t:n;}
function gameTimeAt(p){return clock+(p-clockPerf)/1000;}
function canAim(){return M&&!S.paused&&!S.swing&&(S.phase==='ready'||S.phase==='runup'||S.phase==='flight'||S.phase==='break');}
cvs.addEventListener('pointerdown',e=>{
  if(!canAim())return;e.preventDefault();
  const r=cvs.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  S.aim={id:e.pointerId,x0:x,y0:y,x,y};try{cvs.setPointerCapture(e.pointerId);}catch(_){}
  S.bat={mode:'backlift',t0:clock,from:batAngleNow(),aim:0};
});
cvs.addEventListener('pointermove',e=>{if(!S.aim||e.pointerId!==S.aim.id)return;const r=cvs.getBoundingClientRect();S.aim.x=e.clientX-r.left;S.aim.y=e.clientY-r.top;});
function release(ts,a){
  if(S.phase!=='flight'||S.swing){S.bat={mode:'stance',t0:clock,from:null,aim:0};if(S.phase==='ready'||S.phase==='runup'||S.phase==='break')hint('Too soon. Let go as the ball reaches you.');return;}
  const dx=a.x-a.x0,dy=a.y-a.y0,L=Math.hypot(dx,dy),Lm=dragMax(),defend=L<14;
  const aim=defend?0:aimDeg(dx,dy);
  S.swing={tc:gameTimeAt(ts)-S.ball.start+SWING_DELAY,aim,power:clamp(L/Lm,0.3,1),lofted:!defend&&S.loft,defend,done:false};if(!defend)sfx.swing(S.swing.power);
  S.bat={mode:defend?'block':'swing',t0:gameTimeAt(ts),from:batAngleNow(),aim};
}
cvs.addEventListener('pointerup',e=>{if(!S.aim||e.pointerId!==S.aim.id)return;const a=S.aim;S.aim=null;if(!M||S.paused)return;release(perfOf(e),a);});
cvs.addEventListener('pointercancel',()=>{S.aim=null;S.bat={mode:'stance',t0:clock,from:null,aim:0};});
function skipCelebration(){if(S.phase!=='celebrate'||S.paused||clock-S.cel.t0<0.5)return false;showEnd();return true;}
addEventListener('pointerdown',e=>{if(skipCelebration())e.preventDefault();else if(rpSkip(e)){e.preventDefault();e.stopPropagation();}},true);
window.addEventListener('keydown',e=>{
  if(skipCelebration())return;
  if(S.phase==='replay'&&e.key!=='p'&&e.key!=='Escape'){if(!e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!['Shift','Meta','Control','Alt','Tab'].includes(e.key))rpSkip(e);return;}
  if(FW_KEYS[e.code]&&!e.metaKey&&!e.ctrlKey&&!e.altKey){KEYS[e.code]=1;if(M)e.preventDefault();return;}
  if((e.key==='l'||e.key==='L')&&M&&!S.paused){setLoft(!S.loft);return;}
  if(e.key==='p'||e.key==='Escape'){if(M&&!S.paused)pause();return;}
  if(e.code==='Space'&&canAim()){e.preventDefault();S.bat.from=batAngleNow();release(performance.now(),{x0:0,y0:0,x:0,y:0});}
});
window.addEventListener('keyup',e=>{delete KEYS[e.code];});
window.addEventListener('blur',()=>{for(const k in KEYS)delete KEYS[k];});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});

/* ---------- footwork: joystick (own pointer, so the other thumb can bat) or arrows/WASD, until the ball pitches ---------- */
const stickEl=$('#stick'),knob=stickEl.firstElementChild,KEYS={},FOOT_V={fwd:2.5,back:2,side:2};
const FW_KEYS={ArrowUp:[0,1],KeyW:[0,1],ArrowDown:[0,-1],KeyS:[0,-1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
function stickXY(e){const r=stickEl.getBoundingClientRect(),R=r.width/2,dx=(e.clientX-r.left-R)/R,dy=(e.clientY-r.top-R)/R,L=Math.hypot(dx,dy);return L>1?[dx/L,dy/L]:[dx,dy];}
stickEl.addEventListener('pointerdown',e=>{if(!M||S.paused)return;e.preventDefault();S.stick={id:e.pointerId,v:stickXY(e)};try{stickEl.setPointerCapture(e.pointerId);}catch(_){}});
stickEl.addEventListener('pointermove',e=>{if(S.stick&&e.pointerId===S.stick.id)S.stick.v=stickXY(e);});
for(const t of ['pointerup','pointercancel'])stickEl.addEventListener(t,e=>{if(S.stick&&e.pointerId===S.stick.id)S.stick=null;});
const footFree=()=>S.phase==='runup'||(S.phase==='flight'&&!S.swing&&clock-S.ball.start<S.ball.t1);
let knobAt='';
function footUpdate(dt){
  const p=S.bpos,free=footFree();
  if(S.phase==='ready'||S.phase==='break'){const d=Math.hypot(p.x,p.z),m=Math.min(d,FOOT_V.back*dt);if(d>0){p.x-=p.x/d*m;p.z-=p.z/d*m;}}
  let vx=0,vz=0;
  if(S.stick&&Math.hypot(...S.stick.v)>0.15){vx=S.stick.v[0];vz=-S.stick.v[1];}
  for(const k in KEYS){vx+=FW_KEYS[k][0];vz+=FW_KEYS[k][1];}
  const L=Math.hypot(vx,vz);if(L>1){vx/=L;vz/=L;}
  if(free){p.x=clamp(p.x+vx*FOOT_V.side*dt,-0.6,0.6);p.z=clamp(p.z+vz*(vz>0?FOOT_V.fwd:FOOT_V.back)*dt,-0.5,1.8);}
  const k=S.stick?S.stick.v:[vx,-vz],t='translate('+Math.round(k[0]*33)+'px,'+Math.round(k[1]*33)+'px)';
  if(t!==knobAt){knobAt=t;knob.style.transform=t;}
  stickEl.classList.toggle('locked',!free);
}
window.addEventListener('resize',resize);

