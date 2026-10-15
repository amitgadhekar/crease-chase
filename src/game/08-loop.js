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
// cordon camera: from behind the bowler's stumps like the TV shot, a long lens on a close catcher's play at (x,z), span m of ground
// across the longer side of the screen (live and in catch replays), the camera at cx
function cordCam(x,z,span,cx=clamp(x*.3,-3,3)){const dx=x-cx,dz=z-22,d=Math.hypot(dx,dz);setCam(cx,4.2,22,Math.atan2(dx,dz)/D2R);F=Math.max(W,H)/2*d/span;HZ=H*0.6-4.2*F/d;}
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
    cordCam(S.cord.x,S.cord.z,9);
  }else if(cam.x!==0||cam.y!==HOME.y||cam.z!==HOME.z||cam.yaw!==HOME.yaw||HZ!==baseHZ||F!==baseF){setCam(0,HOME.y,HOME.z,HOME.yaw);HZ=baseHZ;F=baseF;S.trail3=[];}
}
function update(dt){
  updateCam(dt);updateFx(dt);footUpdate(dt);fieldTick(dt);thrSnd();if(M&&M.bowl){aiTick();bowlKeys(dt);}
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
    const x0=p.x,z0=p.z,es=ev&&ev[i];let face=p.face;p.act=0;p.hold=false;const tf=S.thr?throwTick(p,i,t,dt):null;
    if(tf!=null)face=tf;
    else if(es)face=playTick(p,es,t,bl);
    else if(p.kp)face=keepTick(p,ph,b);
    else if(!p.bw){
      const d=Math.hypot(p.bx,p.bz-BATS_Z),w=d<18?0:ph==='runup'?1.5*smooth(clamp(S.t-S.runupDur+1,0,1)):ph==='flight'?1.5:-1;
      if(w>=0){p.x=p.bx-p.bx/d*w;p.z=p.bz-(p.bz-BATS_Z)/d*w;}
      face=ph==='result'&&bl?toward(p,bl.x,bl.z):toward(p,0,BATS_Z);
    }
    const m=Math.hypot(p.x-x0,p.z-z0);p.run+=m*2.3;p.mv=dt>0?m/dt:0;
    p.face=p.act>=3?face:p.face+wrapA(face-p.face)*Math.min(1,dt*14);
  });
  const o=S.thr;if(o&&o.td&&o.rd){S.thr=null;if(M.bowl)bowlUI();}
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
  const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz),k=e.k,AL=SPX?SPX.ua+SPX.fa:.6,h=S.hit;let ux=d>1e-3?dx/d:Math.sin(p.face),uz=d>1e-3?dz/d:Math.cos(p.face);
  const fetch=isFetch(e,h,S.res),hands=k!=='run'||!!e.o||fetch;
  // a take or stop: he gets in line behind the ball, so it comes into his hands rather than past him
  const w=h&&hands&&k!=='dive'&&k!=='jump'&&k!=='slide'&&hitPos(h,Math.max(0,e.t1-.3)),wl=w?Math.hypot(e.x-w.x,e.z-w.z):0;
  if(wl>.3){ux=(w.x-e.x)/wl;uz=(w.z-e.z)/wl;}
  let rB=hands?HANDS*.85:.4,rL=rB,lead=0;
  if(k==='dive'){const th=diveTh(e.e,e.y);rB=.45*Math.sin(th)+.9*AL;rL=Math.max(rB,HANDS+e.e);lead=.12+e.e/6;}
  else if(k==='jump'){rB=rL=.45;lead=.35;}
  else if(k==='slide'){rB=.45;rL=1.7;lead=.45;}
  if(wl>.3)rB=rL=Math.max(.35,Math.min(d,rB));else{rB=Math.min(d,rB);rL=Math.min(d,rL);}
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
/* throws back, show only (no runs, outs or logic; decorative randomness from TR): after a stop, a fetch or a fumble the fielder
   throws to the keeper or the bowler, who takes it and walks back to his place with it; the thrower jogs back to his. Nobody runs in
   this game, so the end is chosen by what the camera shows: in the batting view the keeper is hidden, so to the bowler, unless the
   take falls while the cordon or chase camera is still on; bowling, by geometry (straight fielders to the bowler). The bowler
   fielding keeps it (a throw to the keeper would go through the batter). Times are s after S.f0.
   The throw runs on into the next ball's countdown (owner); the result phase does not grow for it. resetFielders keeps the thrower
   (his play goes on from o.es) and the receiver where they are. Batting, the countdown is fixed: the take must come before the next
   run-up, the bowler takes it at his stumps only if he can walk back to his mark in time, else on his way back there (no direct
   hit then), and walks back hurry if late. Bowling, Bowl waits until the throw is over (bowlUI). */
const TR=prng(29),THW={under:.15,flat:.35,bounce:.55,loop:.55},
  // throwing hand from the shoulder (fwd, right, up; x arm length/.61): chest, back at that fraction of the wind-up, release, follow-through
  THK=[[-.4,[.3,-.2,-.35],[-.45,.05,.28],[.35,-.02,.17],[.3,-.3,-.4]],[-.6,[.3,-.2,-.35],[-.3,.05,-.5],[.4,-.05,-.3],[.45,-.05,-.1]],[-.4,[.3,-.2,-.35],[-.45,.05,.28],[.25,0,.4],[.3,-.3,-.4]]];
const isFetch=(e,h,res)=>e.k==='run'&&!e.o&&!!h&&!res.boundary&&(q=>Math.hypot(q.x-e.x,q.z-e.z)<1.5)(hitPos(h,e.t1));
// in doSwing: the throw after this ball, if any (S.thr)
function planThrow(res,D0){
  S.thr=null;const h=S.hit;if(!h||res.out||res.boundary)return;
  let e=null;for(const x of S.fplay)if((x.o==='stop'||x.o==='fumble'||isFetch(x,h,res))&&(!e||x.t1>=e.t1))e=x;
  const p=e&&S.fpos[e.i];if(!p||p.kp||p.bw)return;
  const R=e.o==='fumble'?hitPos(h,99):null,dv=e.k==='dive'||e.k==='slide';let B;
  // where he throws from: behind the ball (the body is captured when the throw takes over, see throwTick); after a fumble he walks to it
  if(R){const dx=R.x-e.x,dz=R.z-e.z,d=Math.hypot(dx,dz)||1;B={x:R.x-dx/d*.45,z:R.z-dz/d*.45};}
  else{const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz),r=Math.min(d,dv?.9:.6);B=d>1e-3?{x:e.x-dx/d*r,z:e.z-dz/d*r}:{x:p.x,z:p.z};}
  const tg=R?e.t1+.75+Math.hypot(B.x-e.x,B.z-e.z)/3.5:dv?e.t1+1.15:e.k==='run'?e.t1+.35:e.t1+.3;
  const Dk=Math.hypot(B.x,B.z),Db=Math.hypot(B.x,B.z-20.12),geo=Db<.75*Dk?['bw','kp']:['kp'],
    ends=M.bowl?geo:S.cord?['kp','bw']:S.chase?[...geo,'bw']:['bw'];
  for(const rv of new Set(ends)){const o=thrPlan(p,e,rv,B,tg,R,clock-S.f0+D0);if(o){S.thr=o;return;}}
}
// at: taken at his stumps; else (the bowler) on his way back to his mark, at the point he reaches about when the throw does
function thrPlan(p,e,rv,B,tg,R,tE){
  const ri=S.fpos.findIndex(q=>rv==='kp'?q.kp:q.bw),q=S.fpos[ri];if(!q)return null;
  // the receiver from his last play or his place: the keeper at 5.5 m/s (x the planet's run, as every fielder), the bowler at 4 m/s
  const le=(S.fev[ri]||[]).reduce((a,x)=>!a||x.t1>a.t1?x:a,null),s0=le?{x:le.x,z:le.z}:rv==='kp'?{x:q.bx,z:q.bz}:{x:LV.bx,z:17.6},
    ks=Math.max(rv==='kp'?.3:.6,le?le.t1+1.1:0),bat=!M.bowl,ru=tE+BALL_GAP,mk={x:LV.bx,z:bowlMark()},st=!(e.k==='dive'||e.k==='slide');
  if(ks>tE)return null;
  for(const at of rv==='kp'||!bat?[1]:[1,0]){
    let X=0,Z=rv==='kp'?0:20.12;
    if(!at){const L=Math.hypot(mk.x-s0.x,mk.z-s0.z),D0=Math.hypot(B.x,B.z-Z),w=clamp(4*(tg+.35+D0/(D0<14?11:28)-.25-ks),1,L-1)/L;X=lerp(s0.x,mk.x,w);Z=lerp(s0.z,mk.z,w);}
    const dx=B.x-X,dz=B.z-Z,D=Math.hypot(dx,dz)||1,u={x:dx/D,z:dz/D},k0=D<14&&st?'under':D<42?'flat':TR()<.7?'bounce':'loop';
    // a loop that would land after the next run-up goes in on the bounce instead (faster over a long way)
    for(const kind of k0==='loop'?['loop','bounce']:[k0]){
      const o={i:e.i,rv,at,kind,ty:kind==='under'?1:kind==='loop'?2:0,wu:THW[kind],hop:kind==='under'?.15:kind==='flat'?.3:.8,X,Z,u,B,R,tg,ts:R?e.t1+.45:tg,
        h:S.hit,es:S.fev[e.i],hit:false,c:null,k0:null,T:null,ks},r=thrRecv(o);
      o.tR=ks+Math.hypot(s0.x-r.bx,s0.z-r.bz)/(rv==='kp'?5.5*ENV.run:4)+.15;
      thrFlight(o);
      o.tr=Math.max(tg+o.wu,o.tR-o.T+.05);o.ta=o.tr+o.T;o.hit=!!at&&kind!=='bounce'&&kind!=='loop'&&D<=30&&TR()<.1;
      const tk=thrRecv(o).tk;
      if(bat&&(rv==='kp'?tk>tE:tk>ru-.3||at&&tk+.6+Math.hypot(r.bx-mk.x,r.bz-mk.z)/(4.5*ENV.run)>ru-.2))continue;
      return o;
    }
  }
  return null;
}
// release point and flight from the body B (planned, then the body where the throw takes over); the flight time is kept. Gravity
// only shapes the arc: each segment's vy comes from its time and end height
const thrSeg=(a,b,t0,T)=>({t0,T,a,b,vy:(b.y-a.y+.5*G*T*T)/T});
function thrFlight(o){
  const Pt=o.Pt={x:o.X+o.u.x*.15,y:.85,z:o.Z+o.u.z*.15},a=o.a=Math.atan2(Pt.x-o.B.x,Pt.z-o.B.z);
  o.Br={x:o.B.x+Math.sin(a)*o.hop,z:o.B.z+Math.cos(a)*o.hop};const P0=o.P0=thrHand(o,o.Br.x,o.Br.z,a,0),D=Math.hypot(Pt.x-P0.x,Pt.z-P0.z);
  const b=o.kind==='bounce';if(o.T==null)o.T=b?.8*D/32+.2*D/22.4:D/{under:11,flat:28,loop:21}[o.kind];
  const f=b?(.8/32)/(.8/32+.2/22.4):1,m={x:lerp(P0.x,Pt.x,.8),y:0,z:lerp(P0.z,Pt.z,.8)};
  o.sg=b?[thrSeg(P0,m,0,o.T*f),thrSeg(m,Pt,o.T*f,o.T*(1-f))]:[thrSeg(P0,Pt,0,o.T)];
  const l=o.sg[o.sg.length-1];o.v=Math.hypot(l.b.x-l.a.x,l.b.z-l.a.z)/l.T;
}
// the throwing (right) hand: keys from the shoulder through the wind-up (ap<0), accelerating into the release, easing after it
function thrHand(o,x,z,f,ap){
  const P=SPX,s=P?(P.ua+P.fa)/.61:1,sy=P?P.an+(P.th+P.sh)*P.kn+P.tor*.926:1.4,sx=P?.2*P.tw:.2,K=THK[o.ty],w=o.wu,tb=K[0]*w;
  const k=ap<=-w?K[1]:ap<=tb?V3.lerp(K[1],K[2],smooth((ap+w)/(tb+w))):ap<=0?V3.lerp(K[2],K[3],((ap-tb)/-tb)**2):V3.lerp(K[3],K[4],1-(1-Math.min(1,ap/.4))**2);
  const fw=k[0]*s,r=sx+k[1]*s,sn=Math.sin(f),cs=Math.cos(f);
  return {x:x+fw*sn+r*cs,y:sy+k[2]*s,z:z+fw*cs-r*sn};
}
// the receiver: body behind his stumps (or the point on his way back), hands in front of them over the line of the throw (a direct
// hit: behind them, he takes the deflection); tk the take
const thrRecv=o=>{const h=o.hit,u=o.u,b=h?.65:.4,r=h?-.3:.15;return {bx:o.X-u.x*b,bz:o.Z-u.z*b,hx:o.X+u.x*r,hy:.85,hz:o.Z+u.z*r,tk:h?o.ta+.15/o.v+.15:o.ta};};
// fieldTick, before the plays: the thrower from the take (after a fumble he first walks to the ball), the receiver from his start
// (found by role, so a field change at the over break can't swap him); returns the facing, or null for a fielder it doesn't drive.
// Once the next ball has reset the field (the plays are gone), each is let go when back at his place: the throw then ends
function throwTick(p,i,t,dt){
  const o=S.thr,res=S.phase==='result';
  if(i===o.i){
    if(o.td)return null;
    if(t<o.ts)return res?null:playTick(p,o.es,t,null);
    if(!o.c){o.c={x:p.x,z:p.z,hx:p.hx,hy:p.hy,hz:p.hz,f:p.face};if(!o.R){o.B={x:p.x,z:p.z};thrFlight(o);}}
    const R=o.R,c=o.c;
    if(t<o.tg){const t2=o.tg-.3,u=smooth(clamp((t-o.ts)/Math.max(.01,t2-o.ts),0,1));p.x=lerp(c.x,o.B.x,u);p.z=lerp(c.z,o.B.z,u);
      if(t<t2){p.act=1;return toward(p,R.x,R.z);}
      p.act=2;p.ap=t-o.tg;p.hold=false;p.hx=R.x;p.hy=.06;p.hz=R.z;return toward(p,R.x,R.z);}
    const ap=t-o.tr,w=o.wu;
    // after the follow-through he watches it in, then jogs back to his place
    if(ap>.6){p.ap=9;p.hold=false;
      if(ap<.9){p.x=o.Br.x;p.z=o.Br.z;const b=thrBall(o,t);return b?toward(p,b.x,b.z):o.a;}
      const f=walkTo(p,p.bx,p.bz,5,dt);if(f!=null){p.act=1;return f;}
      if(!res)o.td=1;return toward(p,0,BATS_Z);}
    const s0=R?{x:o.B.x,z:o.B.z,hx:R.x,hy:.06,hz:R.z,f:Math.atan2(R.x-o.B.x,R.z-o.B.z)}:c,k=smooth(clamp((t-o.tg)/Math.min(.25,o.tr-o.tg),0,1)),
      g=clamp((ap+w)/w,0,1),bx=lerp(o.B.x,o.Br.x,smooth(g)),bz=lerp(o.B.z,o.Br.z,smooth(g)),
      f=o.a+(ap<0?(o.ty===1?.15:.6)*Math.sin(Math.PI*g):-.25*smooth(clamp(ap/.3,0,1))),H=thrHand(o,bx,bz,f,ap);
    p.x=lerp(s0.x,bx,k);p.z=lerp(s0.z,bz,k);p.hx=lerp(s0.hx,H.x,k);p.hy=lerp(s0.hy,H.y,k);p.hz=lerp(s0.hz,H.z,k);
    p.act=7;p.ap=ap;p.e=o.ty;p.hold=ap<0;
    return s0.f+wrapA(f-s0.f)*k;
  }
  if(o.rd||!(o.rv==='kp'?p.kp:p.bw)||t<o.ks)return null;
  if(!o.k0)o.k0=p.bw&&!p.ev?{x:LV.bx,z:S.bowlerZ}:{x:p.x,z:p.z};
  const r=thrRecv(o),ap=t-r.tk,u=smooth(clamp((t-o.ks)/Math.max(.05,o.tR-.15-o.ks),0,1)),w0=o.at?.6:.3;
  let x=lerp(o.k0.x,r.bx,u),z=lerp(o.k0.z,r.bz,u),hx=r.hx,hy=r.hy,hz=r.hz,face=Math.atan2(o.Br.x-x,o.Br.z-z);
  // on his way back he faces where he is going until he turns for the throw
  if(!o.at&&u<1&&t<o.ta-.6)face=Math.atan2(r.bx-o.k0.x,r.bz-o.k0.z);
  // at his stumps the gloves go over the bails after the take (they are put back there: thrView); then he walks back to his place
  // with the ball and turns to face the batter there
  if(ap>0&&o.at){const v=smooth(clamp(ap/.25,0,1));hx=lerp(hx,0,v);hy=lerp(hy,.78,v);hz=lerp(hz,o.Z,v);}
  if(ap>w0){const f=p.kp?walkTo(p,p.bx,p.bz,4.5,dt):walkTo(p,LV.bx,bowlMark(),4.5,dt),q=smooth(clamp((ap-w0)/.3,0,1));
    hx+=p.x-x;hz+=p.z-z;x=p.x;z=p.z;face=f!=null?f:p.kp?0:Math.PI;
    hx=lerp(hx,x+Math.sin(p.face)*.3,q);hy=lerp(hy,1,q);hz=lerp(hz,z+Math.cos(p.face)*.3,q);
    if(f==null&&!res&&Math.abs(wrapA(p.face-face))<.15)o.rd=1;}
  p.x=x;p.z=z;p.act=ap<-.5?1:2;p.ap=ap;p.hold=ap>0;p.hx=hx;p.hy=hy;p.hz=hz;p.e=0;
  return face;
}
// one frame of a jog to (x,z) at v m/s (x the planet's run), faster (up to 7) if he would be back after the 2 s countdown: the next
// run-up batting, Bowl's wait bowling
function walkTo(p,x,z,v,dt){
  const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),ph=S.phase;if(d<.05){p.x=x;p.z=z;return null;}
  const left=ph==='ready'?BALL_GAP-S.t:ph==='break'?S.breakDur-S.t+BALL_GAP:ph==='result'?S.resultDur-S.t+BALL_GAP:9;v=clamp(d/Math.max(.2,left-.2),v,7);
  const s=Math.min(d,v*ENV.run*dt);p.x+=dx/d*s;p.z+=dz/d*s;return Math.atan2(dx,dz);
}
// the ball while a throw drives it: in the thrower's hand, in flight, on to the stumps for a direct hit, then in the receiver's hands;
// kp: held by the keeper (hidden with him in the batting view)
function thrBall(o,t){
  // before he has it: the shot's path (hitPos) once the next ball has cleared S.hit, unless it is in his hands
  if(t<o.tg){const p=S.fpos[o.i];return S.hit||p&&p.hold&&p.ap>0?null:hitPos(o.h,t);}
  if(t<o.tr){const p=S.fpos[o.i];return p?{x:p.hx,y:p.hy-.05,z:p.hz}:null;}
  if(t<o.ta){const g=o.sg[o.sg.length>1&&t-o.tr>=o.sg[1].t0?1:0],u=t-o.tr-g.t0;
    return {x:g.a.x+(g.b.x-g.a.x)*u/g.T,y:Math.max(0,g.a.y+g.vy*u-.5*G*u*u),z:g.a.z+(g.b.z-g.a.z)*u/g.T};}
  const r=thrRecv(o);
  if(o.hit){const th=o.ta+.15/o.v;
    if(t<th){const u=(t-o.ta)/(th-o.ta);return {x:lerp(o.Pt.x,0,u),y:lerp(o.Pt.y,.55,u),z:lerp(o.Pt.z,o.Z,u)};}
    if(t<r.tk){const u=(t-th)/.15;return {x:lerp(0,r.hx,u),y:lerp(.55,r.hy-.05,u),z:lerp(o.Z,r.hz,u)};}}
  const q=S.fpos.find(p=>o.rv==='kp'?p.kp:p.bw);
  return q?{x:q.hx,y:q.hy-.05,z:q.hz,kp:q.kp}:null;
}
// liveView: the thrown ball, and the bails off a direct hit until the receiver's gloves have been over them (the far stumps in V.st2;
// at the striker's end only when S.stumps is free)
function thrView(V){
  const o=S.thr;if(!o)return;const t=clock-S.f0,b=thrBall(o,t);
  if(b){V.ball=(V.bo.x=b.x,V.bo.y=b.y,V.bo.z=b.z,V.bo);V.bk=!!b.kp;}
  const th=o.ta+.15/o.v;
  if(o.hit&&t>=th&&t<thrRecv(o).tk+.6){if(o.rv==='bw')V.st2=(V.so2.a=t-th,V.so2);else if(!S.stumps)V.st=(V.so.a=t-th,V.so.bails=true,V.so);}
}
function thrSnd(){
  const o=S.thr;if(!o||S.phase==='replay')return;const t=clock-S.f0;
  if(o.hit&&!o.sh&&t>=o.ta+.15/o.v){o.sh=1;sfx.stumps();}
  if(!o.sk&&t>=thrRecv(o).tk){o.sk=1;sfx.keeper(.5);}
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

