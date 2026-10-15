/* ---------- loop ---------- */
function celCam(t){
  const sH=VIS.standsH,RT=BOUNDARY+7+sH*1.15,d=1.4*RT,h=0.75*RT,kn=(h-sH)/(d-RT),kf=(h-sH)/(d+RT);
  const Fw=Math.min(0.46*W*d/RT,0.5*H/(kn-kf)),HZw=H*0.86-Fw*kn;
  const u=smooth(clamp((t-1)/2.5,0,1)),a=Math.max(0,t-1)*6,ar=a*D2R;
  setCam(-d*Math.sin(ar)*u,lerp(CAM_Y,h,u),lerp(CAM_Z,-d*Math.cos(ar),u),a*u);
  F=baseF*Math.pow(Fw/baseF,u);HZ=lerp(baseHZ,HZw,u);
}
// main menu: the whole ground from outside the stands (celebration-style framing, lower), the stands' back edge (RT) spanning the
// width, centred higher in portrait so the cards and sheets cover the near side. The camera sweeps slowly (up to 3°/s, real
// time; still with reduced motion) along the off side, where the sun lights the batter, and stays 30° clear of the floodlight
// towers (azimuths ±35° from each end), which would otherwise fill the foreground
const RM=matchMedia('(prefers-reduced-motion: reduce)');
function menuCam(){
  const sH=VIS.standsH,RT=BOUNDARY+7+sH*1.15,d=1.45*RT,h=0.62*RT,kn=(h-sH)/(d-RT),kf=(h-sH)/(d+RT);
  const a=-90+(RM.matches?-12:25*Math.sin(performance.now()/1000*0.12)),ar=a*D2R;
  setCam(-d*Math.sin(ar),h,-d*Math.cos(ar),a);
  F=Math.min(0.5*W*d/RT,(LAND?0.6:0.34)*H/(kn-kf));HZ=H*(LAND?0.72:0.5)-F*kn;
}
function updateCam(dt){
  if(S.cel)celCam(clock-S.cel.t0);
  else if(S.phase==='replay')rpCam(dt);
  else if(S.phase==='result'&&S.chase&&S.hit&&clock>=S.chase.t0){
    const b=hitPos(S.hit,clock-S.hitStart),ux=S.hit.ux,uz=S.hit.uz;
    let tx=b.x-ux*9,tz=b.z-uz*9;const r=Math.hypot(tx,tz),lim=BOUNDARY-4;if(r>lim){tx*=lim/r;tz*=lim/r;}
    const ty=clamp(b.y*0.75+1.8,1.8,9),yaw=Math.atan2(ux,uz)/D2R,k=1-Math.exp(-dt*5);
    setCam(lerp(cam.x,tx,k),lerp(cam.y,ty,k),lerp(cam.z,tz,k),cam.yaw+angDiff(yaw,cam.yaw)*k);
    HZ=lerp(HZ,H*0.5,k);F=lerp(F,followF,k);
    // a stopped (fielded, caught) ball leaves no trail behind: it fades out
    const l=S.trail3[S.trail3.length-1];if(!l||Math.hypot(b.x-l.x,b.y-l.y,b.z-l.z)>.05)S.trail3.push({x:b.x,y:b.y,z:b.z});else S.trail3.shift();if(S.trail3.length>14)S.trail3.shift();
  }else if(S.phase==='result'&&S.cord&&clock>=S.cord.t0){
    // cordon camera: from behind the bowler's stumps like the TV shot, a long lens on the first close catcher's play (P), 9 m of
    // ground across the longer side of the screen
    const c=S.cord,dx=c.x-cam.x,dz=c.z-22,d=Math.hypot(dx,dz);setCam(clamp(c.x*.3,-3,3),4.2,22,Math.atan2(c.x-clamp(c.x*.3,-3,3),dz)/D2R);
    F=Math.max(W,H)/2*d/9;HZ=H*0.6-4.2*F/d;
  }else if(cam.x!==0||cam.y!==HOME.y||cam.z!==HOME.z||cam.yaw!==HOME.yaw||HZ!==baseHZ||F!==baseF){setCam(0,HOME.y,HOME.z,HOME.yaw);HZ=baseHZ;F=baseF;S.trail3=[];}
}
function update(dt){
  updateCam(dt);updateFx(dt);footUpdate(dt);fieldTick(dt);if(M&&M.bowl){aiTick();bowlKeys(dt);}
  if(S.hold&&clock>=S.hold.until)holdEnd(false);
  if(S.deferred&&clock>=S.deferred.at){showOutcome(S.deferred.res,S.deferred.b);S.deferred=null;if(S.hold)$('#holdBtn').hidden=false;}
  switch(S.phase){
    case 'break':S.t+=dt;if(S.t>=S.breakDur)nextBall();break;
    case 'ready':S.t+=dt;if(S.t>=S.readyDur){S.phase='runup';S.t=0;S.bpos.x=S.bpos.z=0;recStart();}break;
    case 'runup':S.t+=dt;if(S.t>=S.runupDur)releaseBall();break;
    case 'flight':flightUpdate();break;
    case 'result':
      S.t+=dt;if(S.t>=S.resultDur)afterResult();break;
    case 'replay':rpUpdate(dt);break;
    case 'celebrate':{const t=clock-S.cel.t0;fwUpdate(dt,t);
      if(t>=1&&!S.cel.fly){S.cel.fly=true;$('#hud').hidden=true;hint('Tap to continue');}
      if(t>=6)showEnd();break;}
  }
}
/* fielders: each fplay event (resolve* in logic.js) drives one fielder. He runs to his launch point on the run profile the
   logic gave him (FS: reaction, sprint, acceleration), then the take, dive, leap or slide lands his hands on the ball at t1
   (s after S.f0, contact); a fielder's later event starts from where he is. The keeper squats as the bowler runs in, rises and
   gathers what passes the bat. Ring and deep fielders walk in over the last second of the run-up; the rest watch the ball. */
const wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a)),toward=(p,x,z)=>Math.atan2(x-p.x,z-p.z);
function fieldTick(dt){
  if(!M||!S.fpos.length)return;
  const ph=S.phase,b=S.ball,t=clock-S.f0,ev=ph==='result'&&S.fev,bl=S.hit?hitPos(S.hit,Math.max(0,t)):b&&(ph==='flight'||ph==='result')?ballPos(b,clock-b.start):null;
  S.fpos.forEach((p,i)=>{
    const x0=p.x,z0=p.z,es=ev&&ev[i];let face=p.face;p.act=0;
    if(es)face=playTick(p,es,t,bl);
    else if(p.kp)face=keepTick(p,ph,b);
    else if(!p.bw){
      const d=Math.hypot(p.bx,p.bz-BATS_Z),w=d<18?0:ph==='runup'?1.5*smooth(clamp(S.t-S.runupDur+1,0,1)):ph==='flight'?1.5:-1;
      if(w>=0){p.x=p.bx-p.bx/d*w;p.z=p.bz-(p.bz-BATS_Z)/d*w;}
      face=ph==='result'&&bl?toward(p,bl.x,bl.z):toward(p,0,BATS_Z);
    }
    const m=Math.hypot(p.x-x0,p.z-z0);p.run+=m*2.3;p.mv=dt>0?m/dt:0;
    p.face=p.act>=3?face:p.face+wrapA(face-p.face)*Math.min(1,dt*14);
  });
}
// a fielder's events (sorted by t1): the last one begun, or the first one still to come; returns the facing wanted
function playTick(p,es,t,bl){
  let e=es[0];for(const x of es)if(x.t0<=t)e=x;
  if(p.ev!==e){if(p.bw){p.x=LV.bx;p.z=S.bowlerZ;}p.ev=e;playGeo(p,e);}
  const g=p.g,k=e.k;
  if(t<e.t0){p.x=g.ax;p.z=g.az;}
  else if(t<g.tL){const D=Math.hypot(g.lx-g.ax,g.lz-g.az),u=t-e.t0,f=D>1e-3?Math.max(Math.min(1,runP(u)/D),runP(u)/Math.max(1e-6,runP(g.tL-e.t0))):1;
    p.x=lerp(g.ax,g.lx,Math.min(1,f));p.z=lerp(g.az,g.lz,Math.min(1,f));}
  else if(t<e.t1){const u=(t-g.tL)/Math.max(1e-3,e.t1-g.tL);p.x=lerp(g.lx,g.bx,u);p.z=lerp(g.lz,g.bz,u);}
  else{const u=k==='slide'?.5*smooth(clamp((t-e.t1)/.5,0,1)):0;p.x=g.bx+g.ux*u;p.z=g.bz+g.uz*u;}
  p.act=k==='dive'?3:k==='jump'?4:k==='slide'?5:k==='run'&&!g.hands?1:2;
  p.ap=t-e.t1;p.e=e.e;p.sd=g.sd;p.hold=g.hold&&p.ap>0;p.hx=e.x;p.hy=e.y;p.hz=e.z;
  // a diver's hands come down with him; a held ball comes up to the chest once he is on his feet
  if(p.act===3&&p.ap>0)p.hy=lerp(e.y,Math.min(e.y,.1),smooth(clamp(p.ap/.3,0,1)));
  if(p.hold){const u=smooth(clamp((p.ap-(p.act>=3?.6:.25))/.6,0,1));p.hx=lerp(e.x,p.x+Math.sin(g.af)*.3,u);p.hy=lerp(p.hy,1.05,u);p.hz=lerp(e.z,p.z+Math.cos(g.af)*.3,u);}
  const D=Math.hypot(g.lx-g.ax,g.lz-g.az);
  if(t<e.t0)return bl?toward(p,bl.x,bl.z):p.face;
  if(D>1.2&&t<g.tL-.25)return g.rf;
  if(D>1.2&&t<g.tL)return g.rf+wrapA(g.af-g.rf)*smooth((t-g.tL+.25)/.25);
  return g.af;
}
function runP(u){const F=FS[physD()],v=F.v*ENV.run,ac=F.ac*ENV.run;return u<=0?0:u<v/ac?.5*ac*u*u:v*(u-v/(2*ac));}
// where an event takes him: launch point (lx,lz) at tL, body at t1 (bx,bz), facing for the action (af) and while running (rf)
function playGeo(p,e){
  const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz),ux=d>1e-3?dx/d:Math.sin(p.face),uz=d>1e-3?dz/d:Math.cos(p.face),k=e.k,AL=SPX?SPX.ua+SPX.fa:.6,h=S.hit;
  const fetch=k==='run'&&!e.o&&h&&!S.res.boundary&&Math.hypot(hitPos(h,e.t1).x-e.x,hitPos(h,e.t1).z-e.z)<1.5,hands=k!=='run'||!!e.o||fetch;
  let rB=hands?HANDS*.85:.4,rL=rB,lead=0;
  if(k==='dive'){const th=(35+45*clamp(e.e/1.2,0,1))*D2R;rB=.45*Math.sin(th)+.9*AL;rL=Math.max(rB,HANDS+e.e);lead=.12+e.e/6;}
  else if(k==='jump'){rB=rL=.45;lead=.35;}
  else if(k==='slide'){rB=.45;rL=1.7;lead=.45;}
  rB=Math.min(d,rB);rL=Math.min(d,rL);
  const g={ax:p.x,az:p.z,lx:e.x-ux*rL,lz:e.z-uz*rL,bx:e.x-ux*rB,bz:e.z-uz*rB,ux,uz,tL:clamp(e.t1-lead,e.t0,e.t1),hands,sd:1,
    hold:e.o==='catch'||e.o==='stop'||fetch};
  g.rf=Math.atan2(g.lx-g.ax,g.lz-g.az);
  const a=Math.atan2(ux,uz),q=h?hitPos(h,Math.max(0,e.t1-.3)):{x:0,z:BATS_Z},qa=Math.hypot(q.x-g.bx,q.z-g.bz)>.3?Math.atan2(q.x-g.bx,q.z-g.bz):Math.atan2(-g.bx,BATS_Z-g.bz);
  // a dive goes out to his side: of the two facings square to it, the one nearer the ball's line
  if(k==='dive'){const r=a-Math.PI/2,l=a+Math.PI/2;g.af=Math.abs(wrapA(r-qa))<=Math.abs(wrapA(l-qa))?r:l;g.sd=g.af===r?1:-1;}
  else if(k==='slide')g.af=a;
  else if(!hands)g.af=d>1?g.rf:Math.atan2(-g.bx,10-g.bz);
  else{g.af=qa;g.sd=(e.x-g.bx)*Math.cos(qa)-(e.z-g.bz)*Math.sin(qa)<0?-1:1;}
  p.g=g;
}
// the keeper: squats through the run-up, rises as the ball pitches (pace) or leaves the hand (spin), shuffles up to 1 m toward its
// line and takes it at his gloves (0.45 m in front); stumped, the gloves go on to the stumps
function keepTick(p,ph,b){
  const run=ph==='runup',fl=b&&(ph==='flight'||ph==='result')&&!S.hit,bt=fl?clock-b.start:0;
  p.x=p.bx;p.z=p.bz;p.ap=-9;p.hold=false;
  if(!run&&!fl){p.act=0;p.e=0;return S.hit?toward(p,S.hit.x0,S.hit.z0):0;}
  p.act=6;p.e=run?smooth(clamp(S.t/S.runupDur*2-.8,0,1)):1-smooth(clamp((bt-(b.type==='spin'?0:b.t1))/.25,0,1));
  const out=S.res&&S.res.out&&!(S.stumps&&S.stumps.bails),tk=fl&&!S.padNow&&!S.padHit&&!out&&b.zb>p.bz+.45?b.t1+(b.zb-p.bz-.45)/b.vz2:0;
  if(!tk){p.hx=p.x;p.hy=.4+.35*(1-p.e);p.hz=p.z+.35;return 0;}
  const G=ballPos(b,tk);p.x=p.bx+clamp(G.x-p.bx,-1,1)*smooth(clamp(bt/tk,0,1));p.ap=bt-tk;p.hold=p.ap>0;
  p.hx=G.x;p.hy=G.y+.05;p.hz=G.z;
  if(p.hold){const u=smooth(clamp(p.ap/(S.stumps&&p.bz>-3?.15:.4),0,1)),T=S.stumps&&p.bz>-3?[0,.62,.1]:[p.x,.95,p.z+.3];p.hx=lerp(G.x,T[0],u);p.hy=lerp(G.y+.05,T[1],u);p.hz=lerp(G.z,T[2],u);}
  return 0;
}
let lastDraw=0;
function frame(now){
  const dt=Math.min(0.25,(now-clockPerf)/1000);clockPerf=now;
  if(!S.paused){clock+=dt;update(dt);}
  // behind the menu and the other overlays (paused): 30 fps. rAF itself stops while the page is hidden
  if(S.paused&&now-lastDraw<30){requestAnimationFrame(frame);return;}
  lastDraw=now;if(MENU.on)menuCam();
  if(!S.paused&&S.phase==='result')recContact();
  const V=S.phase==='replay'?rpView():liveView();
  if(!S.paused&&(S.phase==='runup'||S.phase==='flight'||S.phase==='result'))recFrame(V);
  draw(V);requestAnimationFrame(frame);
}

