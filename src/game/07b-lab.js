/* ---------- character lab (#test only; driven by tests/charlab.mjs): window.__lab steps the game deterministically (a lab
   clock behind performance.now, seeded Math.random, the camera locked by LAB.cam: the one guard line at the top of updateCam),
   starts matches, sets up deliveries, footwork, swings and forced fielding plays, and dumps joints, capsules, vertices, bat and
   ball per frame for the metrics in tests/charlab/metrics.mjs. Without #test nothing here runs: LAB.cam stays null.
   People joints: a rig that carries a joint struct J (the shape batJoints returns; the skinned people to come) is read from it,
   else the procedural parts' matrices are decoded (mL centres a limb between its joints, so the ends are origin +- Y*L0/2). */
const LAB={on:false,cam:null,pnow:0,render:null,keeper:false,q:null,frames:0,ch:null,co:null,cot:null,gv:null,cut:false,kh:false,crowd:0,crowdCalls:0};
function labCam(){const c=LAB.cam;setCam(c.x,c.y,c.z,c.yaw);F=c.F;HZ=c.HZ;}
if(location.hash==='#test'){
const PN0=performance.now.bind(performance);
const R3=v=>[+v[0].toFixed(4),+v[1].toFixed(4),+v[2].toFixed(4)];
function labSeed(s){let a=(s>>>0)||1;Math.random=()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};return s;}
// the lab drives the loop: frame() keeps drawing at the paused clock (30 fps) with the GL render stubbed, so only shot() renders.
// Renders into a render target still run: envBuild's PMREM (planet switches) needs them, or the sky light is black
const labStub=(s,c)=>{if(T3.r.getRenderTarget())LAB.render(s,c);};
function labOn(){
  if(LAB.on)return;LAB.on=true;LAB.pnow=PN0();performance.now=()=>LAB.on?LAB.pnow:PN0();
  if(glOK){LAB.render=T3.r.render.bind(T3.r);T3.r.render=labStub;T3.world.updateMatrixWorld(true);
    // the crowd's share of a render's triangles (the triangle gate counts the scene without it): each drawn sector, as three counts it
    for(const m of CRWD.sec)m.onAfterRender=function(){const g=this.geometry;LAB.crowd+=(g.index?g.index.count:g.attributes.position.count)/3*this.count;LAB.crowdCalls++;};}
  S.paused=true;settings.assist=false;
}
function labOff(){if(!LAB.on)return;LAB.on=false;if(glOK)T3.r.render=LAB.render;LAB.cam=null;LAB.keeper=false;LAB.q=null;}
function labUI(on){
  for(const q of ['#hud','#loftBtn','#holdBtn','#bowlBtn','#optChips','#stick','#rpTag','#rpSkip','#overPick','#banner','#hint'])$(q).style.display=on?'':'none';
  cvs.style.visibility=on?'':'hidden';
}
// a match the lab can drive: nets (never ends) or a scenario (sweeps, ducks, the non-striker)
function labStart(o){
  if(M)quitToMenu();
  LAB.cam=null;   // a camera left from the last shot may lie outside the new planet's stadium (distToBoundary -> NaN -> renderSky throws)
  if(o.mode==='scen'){const sc=SCEN.find(s=>s.id===o.scen);if(!sc)throw new Error('scenario '+o.scen);startScen(sc);}
  else{settings.mode='nets';settings.planet=o.planet||'earth';settings.diff=o.diff||'medium';settings.netsW=0;startMatch();M.wktsMax=Infinity;}
  S.paused=true;labUI(false);LAB.frames=0;
  return {planet:curPlanet,type:M.bowlerType,phase:S.phase};
}
// one step of the game at the lab clock (exact: clock = t when given), the view built and recorded as the loop does; render draws it
function labStep(dt,render,t){
  if(t!=null)dt=t-clock;dt=Math.max(0,dt);LAB.pnow+=dt*1000;clock=t!=null?t:clock+dt;LAB.frames++;
  update(dt);
  const rp=S.phase==='replay';if(rp)rpEnd();
  labGameView(rp);
  // the lab's cameras are its own: no chase camera (it would hide the batter), the keeper drawn on request (the home view hides him)
  S.chase=null;if(LAB.keeper){if(!S.cord){S.cord={t0:-1e9,x:0,z:-2,lab:1};LAB.co=S.cord;}else S.cord.t0=-1e9;}
  if(S.phase==='result')recContact();
  const V=liveView();if(S.phase==='runup'||S.phase==='flight'||S.phase==='result')recFrame(V);
  if(render){LAB.crowd=0;LAB.crowdCalls=0;}
  if(render&&glOK){T3.r.render=LAB.render;try{draw(V);}finally{T3.r.render=labStub;}}else draw(V);
  return clock;
}
// the camera the game would show after this step (the lab's own replaces it): its chase and cordon cameras are kept here before the
// lab clears them. LAB.cut: the game's camera cuts before this frame (a replay, a cut in to the cordon camera, back home from a
// chase or cordon shot, a chase into the celebration); easing from home into the chase or the celebration orbit is no cut.
// LAB.kh: the game hides the keeper (the home batting view, batView)
function labGameView(rp){
  if(S.chase)LAB.ch=S.chase;else if(S.phase==='ready'||S.phase==='break')LAB.ch=null;
  if(!S.cord){LAB.cot=null;LAB.co=null;}else if(S.cord!==LAB.co){LAB.co=S.cord;LAB.cot=S.cord.t0;}
  const res=S.phase==='result',gv=S.cel?'cel':res&&LAB.ch&&clock>=LAB.ch.t0?'chase':res&&LAB.cot!=null&&clock>=LAB.cot?'cord':'home',pv=LAB.gv||gv;
  LAB.cut=rp||gv!==pv&&!(pv==='home'&&(gv==='chase'||gv==='cel'));LAB.gv=gv;LAB.kh=!!M&&!M.bowl&&gv==='home';
}
// a render of the current state without a step (a zero-length update is not neutral: fieldTick runs a frame behind S.t)
function labRender(){LAB.crowd=0;LAB.crowdCalls=0;const V=liveView();if(glOK){T3.r.render=LAB.render;try{draw(V);}finally{T3.r.render=labStub;}}else draw(V);}
// the current ball: bowler type (keeper stance, run-up) and a crafted delivery in place of the brain's
function labBall(o){
  if(!M)return null;
  if(o.type){M.bowlerType=o.type;M.spinDir=o.sd||1;S.runupDur=o.type==='pace'?1.5:1.1;resetFielders();}
  if(S.phase==='ready'&&S.pending&&o.len)S.pending=makeDelivery({type:M.bowlerType,len:o.len,line:o.line||'mid',slower:!!o.slower},M.diff,M.spinDir);
  return S.pending&&{len:S.pending.len,zb:S.pending.zb,xb:S.pending.xb,t1:S.pending.t1,type:S.pending.type};
}
// the swing as the slingshot's release sets it, at the lab clock (so the impact pose lands at clock + SWING_DELAY)
function labSwing(o){
  const b=S.ball;if(!b||S.phase!=='flight'||S.swing)return null;
  const aim=o.defend?0:o.aim||0,tc=clock-b.start+SWING_DELAY;
  S.swing={tc,aim,power:clamp(o.power==null?.8:o.power,.3,1),lofted:!o.defend&&!!o.loft,defend:!!o.defend,done:false};
  S.bat={mode:o.defend?'block':'swing',t0:clock,from:batAngleNow(),aim};S.aim=null;
  return {tc,t0:clock,impact:labImpactAt(clock)};
}
// the clock at which poseTick's own subtraction (clock - t0) gives SWING_DELAY exactly: t0 + SWING_DELAY may be an ulp off
const F64=new Float64Array(1),U64=new BigInt64Array(F64.buffer),ulp=(x,n)=>{F64[0]=x;U64[0]+=BigInt(n);return F64[0];};
function labImpactAt(t0){let x=t0+SWING_DELAY;for(let n=0;n<8;n++){for(const c of [ulp(x,n),ulp(x,-n)])if(c-t0===SWING_DELAY)return c;}return x;}
function labBacklift(k,aim){const L=dragMax()*(k==null?1:k),a=(aim||0)*D2R;S.aim={id:-1,x0:0,y0:0,x:-Math.sin(a)*L,y:Math.cos(a)*L};S.bat={mode:'backlift',t0:clock,from:batAngleNow(),aim:0};}
// the time the swing must start for a timing error dt (s) against the ball as it meets the batter now
const labSwingAt=dt=>S.ball?S.ball.start+footAt(S.ball,S.bpos).t+(dt||0)-SWING_DELAY:null;
// footwork through the stick (footUpdate clamps and stops it when the ball pitches); the duck: the stick pulled back after the pitch
function labFoot(tx,tz){const p=S.bpos,dx=tx-p.x,dz=tz-p.z,L=Math.hypot(dx,dz);if(L<.01){S.stick=null;return true;}S.stick={id:-1,v:[dx/L,-dz/L]};return false;}
function labDuck(){S.stick={id:-1,v:[0,1]};}
// a forced fielding play (as tests/smoke.mjs): evalSwing is re-rolled until pred(res, field, ball, swing) holds (seeded, so repeatable)
function labArm(pred,max){
  const want=new Function('r','f','b','s','return '+pred),ev0=evalSwing;LAB.fp=0;
  window.evalSwing=(...a)=>{window.evalSwing=ev0;for(let i=0;i<(max||6000);i++){const r=ev0(...a);if(r.res&&r.res.fplay&&want(r.res,a[3],a[0],a[1])){LAB.fp=i+1;return r;}}return ev0(...a);};
}
// the share of n evalSwing rolls on the current ball (made or pending) with no footwork that bring up pred, for a swing as the lab
// injects it (tests/charlab/runner.js orders a forced play's swings by it)
function labProbe(pred,o,n){
  const want=new Function('r','f','b','s','return '+pred),b=S.phase==='flight'?S.ball:S.pending;if(!b||!M)return 0;const bp={x:0,z:0},fa=footAt(b,bp);
  let dt=o.dt||0;if(o.edge){const w=windows(M.diff,true,1+.35*fa.gain);dt=-(w.ok+w.edge)/2;}
  let k=0;for(let i=0;i<n;i++){const sw={tc:fa.t+dt,aim:o.defend?0:o.aim||0,power:clamp(o.power==null?.8:o.power,.3,1),lofted:!o.defend&&!!o.loft,defend:!!o.defend,done:true,bp};
    const r=evalSwing(b,sw,physD(),M.field,M.st&&M.st.bat?scBat():undefined);if(r.res&&r.res.fplay&&want(r.res,M.field,b,sw))k++;}
  return k/n;
}
const labField=t=>{M.field=tplField(t===1?Object.keys(TPL).find(k=>TPL[k].f.includes('longoff')&&TPL[k].f.includes('longon')):t);resetFielders();};
function labCel(){if(!M)return;celebrate();S.paused=true;return S.cel.t0;}
// both kits on the planet's species: 'you' = the player's colours (fielders) and the planet team's on the batters, 'ai' = the usual
function labKits(k){const you=k==='you',kit=you?KIT.you:aiKit();if(glOK){col(G3.pm.shirt,kit.shirt);col(G3.pm.pants,kit.pants);spApply(curPlanet,kit);}KS.you=you;kitBatter();}

/* --- cameras: locked by LAB.cam (updateCam's guard); horizontal look as every game camera, F and HZ from a span across the shorter
   screen side at the target's distance, the target at fraction fy of the height --- */
function labLook(o){
  const d=Math.hypot(o.at[0]-o.from[0],o.at[2]-o.from[2]),yaw=Math.atan2(o.at[0]-o.from[0],o.at[2]-o.from[2])/D2R,Fv=Math.min(W,H)*d/(o.span||2.2),
    HZv=H*(o.fy==null?.5:o.fy)+(o.at[1]-o.from[1])*Fv/d;
  LAB.cam={x:o.from[0],y:o.from[1],z:o.from[2],yaw,F:Fv,HZ:HZv};labCam();return labCamNow();
}
const labCamNow=()=>({x:cam.x,y:cam.y,z:cam.z,yaw:cam.yaw,F,HZ,W,H});
function labSetCam(c){LAB.cam={x:c.x,y:c.y,z:c.z,yaw:c.yaw,F:c.F,HZ:c.HZ};labCam();return labCamNow();}
// the game's own cameras, computed here so the lock stays on: batting (the home lens), bowling (bowlLens), side-on replay (rpCam's
// first segment at the point p), cordon (cordCam on p), celebration (celCam at t), chase (behind a ball at p flying along u)
function labGameCam(k,o){
  o=o||{};let p=o.p||[0,.95,BATS_Z];
  if(k==='bat'){const h=LAND?H-SAFE.b:H;return labSetCam({x:0,y:CAM_Y,z:CAM_Z,yaw:0,F:LAND?h*1.55:Math.min(W*2.4,H*1.15),HZ:LAND?h*.235:H*.31});}
  if(k==='bowl'){const h=LAND?H-SAFE.b:H,yb=LAND?.42:.55,yn=LAND?.82:.8,db=BOWL_CAM.z-BATS_Z,dn=BOWL_CAM.z-12,Fv=(yn-yb)*h/(BOWL_CAM.y*(1/dn-1/db));
    return labSetCam({x:0,y:BOWL_CAM.y,z:BOWL_CAM.z,yaw:180,F:Fv,HZ:yb*h-BOWL_CAM.y*Fv/db});}
  if(k==='side'){const ch=Math.max(0,p[2]-1.1),tx=p[0]+.25,ty=.95,tz=p[2]+.3-ch*.5,a=25*D2R,D=7.5,cx=tx+D*Math.cos(a),cy=2,cz=tz+D*Math.sin(a),Fv=Math.min(W/(3.1+ch),H/(2.8+ch*.8))*D*1.08;
    return labSetCam({x:cx,y:cy,z:cz,yaw:Math.atan2(tx-cx,tz-cz)/D2R,F:Fv,HZ:H*.56-(cy-ty)*Fv/D});}
  // cordon: on the game's own cut point (S.cord: the catch, drop or first close play) when the game made one, else on p
  if(k==='cord'){const gc=LAB.co&&!LAB.co.lab?LAB.co:null;if(gc)p=[gc.x,0,gc.z];const cx=clamp(p[0]*.3,-3,3),dx=p[0]-cx,dz=p[2]-22,d=Math.hypot(dx,dz),Fv=Math.max(W,H)/2*d/(o.span||9);
    return labSetCam({x:cx,y:4.2,z:22,yaw:Math.atan2(dx,dz)/D2R,F:Fv,HZ:H*.6-4.2*Fv/d});}
  if(k==='cel'){const t=o.t==null?3.5:o.t,sH=VIS.standsH,RT=BOUNDARY+7+sH*1.15,d=1.4*RT,h=.75*RT,kn=(h-sH)/(d-RT),kf=(h-sH)/(d+RT),Fw=Math.min(.46*W*d/RT,.5*H/(kn-kf)),HZw=H*.86-Fw*kn,
    u=smooth(clamp((t-1)/2.5,0,1)),a=Math.max(0,t-1)*6,ar=a*D2R,bF=Math.min(W*2.4,H*1.15),bHZ=H*.31;
    return labSetCam({x:-d*Math.sin(ar)*u,y:lerp(CAM_Y,h,u),z:lerp(CAM_Z,-d*Math.cos(ar),u),yaw:a*u,F:bF*Math.pow(Fw/bF,u),HZ:lerp(bHZ,HZw,u)});}
  if(k==='chase'){const u=o.u||[0,1],ux=u[0],uz=u[1];let tx=p[0]-ux*9,tz=p[2]-uz*9;const r=Math.hypot(tx,tz),lim=BOUNDARY-4;if(r>lim){tx*=lim/r;tz*=lim/r;}
    return labSetCam({x:tx,y:clamp(p[1]*.75+1.8,1.8,9),z:tz,yaw:Math.atan2(ux,uz)/D2R,F:Math.min(W*2.4,H*1.15),HZ:H*.5});}
  throw new Error('camera '+k);
}

/* --- dumps (game coordinates, metres) --- */
const g2w=v=>[-v.x,v.y,v.z];
function labSkel(BB,root){
  if(!SKN.on)return null;root.updateMatrixWorld(true);const v=new THREE.Vector3(),o={};
  SKB.forEach((n,i)=>{BB[i].getWorldPosition(v);o[n]=R3(g2w(v));});return o;}
const copyJ=J=>{const o={};for(const k in J){const x=J[k];o[k]=Array.isArray(x)&&Array.isArray(x[0])?x.map(a=>a.slice()):Array.isArray(x)?x.slice():x;}return o;};
// the batter's joints (BJ as batsman3D left them), bones, pose, swing state and contact
function labBatter(){
  if(!M||!LV.pose)return null;const J=BJ,sw=S.swing,B=S.bat,k=['hip','sh','hc','nt','H','d','fn','face','Y','s','ha'],o={J:{}};
  for(const n of k)o.J[n]=R3(J[n]);for(const n of ['sp','e','hd','hj','kn','an','sole','fw','t','ap','wa'])o.J[n]=J[n].map(R3);
  o.bones=labSkel(SKN.b,SKN.root);o.pose=Array.from(LV.pose);o.cur=Array.from(PB.cur);o.bpos=[S.bpos.x,S.bpos.z];o.mode=B.mode;o.key=PB.key;o.kind=PB.sw?PB.k:null;
  o.swing=sw?{tc:sw.tc,t0:B.t0,impact:B.t0+SWING_DELAY,done:sw.done,missed:!!sw.missed,cp:sw.cp?R3([sw.cp.x,sw.cp.y,sw.cp.z]):null,C:PB.C?R3(PB.C):null,k:PB.k,a:PB.a?Array.from(PB.a):null}:null;
  o.lift=[FT.lift,FT.mv];
  if(glOK){const b=G3.ball.matrix.elements,e=G3.bat.blade.matrix.elements,r=[b[12]-e[12],b[13]-e[13],b[14]-e[14]],c=q=>{const x=[e[q],e[q+1],e[q+2]],l=Math.hypot(...x)||1;return V3.dot(r,x)/l;};
    o.contact={n:+c(8).toFixed(4),u:+(c(4)+.29).toFixed(4),w:+c(0).toFixed(4)};}
  return o;
}
// the non-striker: joints in his own frame (nsPose) put into game coordinates by his group's frame (x mirrored, z reversed)
function labNs(){
  const n=LV.ns;if(!n.on||!M)return null;const J=copyJ(batJoints(n.pose,G3.ns.ikst));batJoints(LV.pose,G3.bat.ikst);
  const P=v=>R3([n.x-v[0],v[1],NS_Z-n.u-v[2]]),D=v=>R3([-v[0],v[1],-v[2]]),o={J:{},x:n.x,u:n.u,ph:n.ph,mv:n.mv};
  for(const k of ['hip','sh','hc','nt','H'])o.J[k]=P(J[k]);for(const k of ['d','fn','face','Y','s','ha'])o.J[k]=D(J[k]);
  for(const k of ['sp','e','hd','hj','kn','an','sole'])o.J[k]=J[k].map(P);for(const k of ['fw','t'])o.J[k]=J[k].map(D);
  o.bones=glOK?labSkel(SKN.b2,G3.ns.g):null;return o;
}
// a procedural person's joints from his part matrices (or his joint struct J when the rig carries one)
function rigJoints(r){
  if(r.J){const J=r.J,o={};for(const k of ['hip','sh','hc'])o[k]=R3(J[k]);for(const k of ['sp','e','hd','hj','kn','an','sole'])o[k]=J[k].map(R3);
    o.fw=R3(J.face||J.n||[0,0,1]);o.up=R3(J.Y||[0,1,0]);o.hr=J.hr||.05;o.lr=J.lr||[.08,.06,.06,.05];o.ar=J.ar||[.05,.044,.038];o.src='J';return o;}
  const P=SPX,E=m=>m.matrix.elements,seg=(m,L0)=>{const e=E(m),o=[e[12],e[13],e[14]],y=[e[4],e[5],e[6]];return [V3.sub(o,V3.sc(y,L0/2)),V3.add(o,V3.sc(y,L0/2)),y];};
  const th=[0,1].map(i=>seg(r.thigh[i],P.th)),sh=[0,1].map(i=>seg(r.shin[i],P.sh)),ua=[0,1].map(i=>seg(r.uarm[i],P.ua)),fa=[0,1].map(i=>seg(r.farm[i],P.fa)),
    t=E(r.torso),h=E(r.head),ft=[0,1].map(i=>E(r.foot[i]));
  const hip=[t[12],t[13],t[14]],X=[t[0],t[1],t[2]],Yc=[t[4],t[5],t[6]],top=[h[12],h[13],h[14]],Uh=[h[4],h[5],h[6]],Fh=[h[8],h[9],h[10]];
  return {src:'m',hip:R3(hip),sh:R3(V3.add(hip,V3.sc(Yc,.5))),hc:R3(V3.add(top,V3.sc(Uh,.17))),top:R3(top),hf:R3(Fh),
    hj:th.map(s=>R3(s[0])),kn:th.map(s=>R3(s[1])),an:sh.map(s=>R3(s[1])),sole:ft.map(e=>R3([e[12],e[13],e[14]])),ftf:ft.map(e=>R3([e[8],e[9],e[10]])),
    sp:ua.map(s=>R3(s[0])),e:ua.map(s=>R3(s[1])),wr:fa.map(s=>R3(s[1])),hd:fa.map(s=>R3(V3.add(V3.lerp(s[0],s[1],.5),V3.sc(s[2],P.fa/2+P.hd)))),
    fw:R3(V3.norm([X[0],0,X[2]])),up:R3(V3.norm(Yc)),hr:Math.max(...P.hr),lr:P.lr.slice(),ar:P.ar.slice(),tw:P.tw,tor:P.tor};
}
// everyone on the field as drawn: fielders (name from M.field, keeper, bowler's slot) and the bowler; off: not drawn (home view keeper)
function labPeople(){
  if(!M||!glOK)return [];const out=[],V=LV;
  for(let i=0;i<V.nf;i++){const f=V.f[i],r=G3.fielders[i],n=M.field[i]&&M.field[i].n||'f'+i;
    out.push({i,n,kp:f.kp,bw:f.bwl,on:r.g.visible,act:f.act,ap:+f.ap.toFixed(3),hold:f.hold,run:f.running,x:+f.x.toFixed(3),z:+f.z.toFixed(3),face:+f.face.toFixed(4),
      h:R3([f.hx,f.hy,f.hz]),J:r.g.visible?rigJoints(r):null});}
  const b=G3.bowler;out.push({i:-1,n:'bowler',on:b.g.visible,act:BO.act||0,ap:BO.ap,arm:V.arm,run:V.brn,x:+V.bx.toFixed(3),z:+V.bz.toFixed(3),face:Math.PI,J:b.g.visible?rigJoints(b):null});
  return out;
}
// capsules [name, a, b, r] per person for the penetration metric (limb vs torso and limb, bat vs body and pads); adjacent parts share a joint
// the batter's forearm bone runs to the grip (hd, on the handle axis): the arm stops at the wrist, 7 cm short of it, tapered (farm, wrst)
// inside the glove's sphere, so a forearm is measured against the handle and the other arm, not the hand that holds the bat
const CAPS={bat:J=>{const H=J.H,d=J.d,c=[];
    for(let i=0;i<2;i++){c.push(['thigh'+i,J.hj[i],J.kn[i],.075],['shin'+i,J.kn[i],J.an[i],.07],['pad'+i,J.an[i],J.kn[i],.085],['uarm'+i,J.sp[i],J.e[i],.05],['glove'+i,J.hd[i],J.hd[i],.055]);
      const w=V3.add(J.hd[i],V3.sc(V3.norm(V3.sub(J.e[i],J.hd[i])),.07)),m=V3.lerp(J.e[i],w,.5);c.push(['farm'+i,J.e[i],m,.042],['wrst'+i,m,w,.03]);}
    c.push(['torso',V3.lerp(J.hip,J.sh,.1),J.sh,.15],['head',J.hc,J.hc,.11],['handle',V3.add(H,V3.sc(d,HTOP)),V3.add(H,V3.sc(d,.3)),.017],['blade',V3.add(H,V3.sc(d,.3)),V3.add(H,V3.sc(d,.86)),.03]);return c;},
  man:J=>{const c=[],lr=J.lr,ar=J.ar;
    for(let i=0;i<2;i++){c.push(['thigh'+i,J.hj[i],J.kn[i],(lr[0]+lr[1])/2],['shin'+i,J.kn[i],J.an[i],(lr[2]+lr[3])/2],['uarm'+i,J.sp[i],J.e[i],(ar[0]+ar[1])/2],['farm'+i,J.e[i],J.wr?J.wr[i]:J.hd[i],(ar[1]+ar[2])/2],['hand'+i,J.hd[i],J.hd[i],J.hr]);}
    // against the upper arms the torso's radius is the armpit's: the shoulder joints' distance from the spine axis less the upper
    // arm's radius (an arm hanging straight touches the side), never wider than the torso; other limbs see the full torso
    const ax=V3.norm(V3.sub(J.sh,J.hip)),off=v=>{const r=V3.sub(v,J.hip);const o=V3.sub(r,V3.sc(ax,V3.dot(r,ax)));return Math.hypot(o[0],o[1],o[2]);},tr=.16*(J.tw||1);
    c.push(['torso',V3.lerp(J.hip,J.sh,.1),J.sh,tr,{uarm:Math.min(tr,(off(J.sp[0])+off(J.sp[1]))/2-(ar[0]+ar[1])/2)}],['head',J.hc,J.hc,.11]);return c;}};
function labCaps(){const o={};const b=labBatter();if(b)o.bat=CAPS.bat(b.J);const n=labNs();if(n)o.ns=CAPS.bat(n.J);
  for(const p of labPeople())if(p.J)o[p.n]=CAPS.man(p.J);return o;}
// lowest point of every drawn body: the skinned batters' vertices (skinning applied), the people's part vertices by their matrices
const VT={v:new THREE.Vector3()};
function lowest(root){let y=9,at=null;root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh||!o.visible)return;const P=o.geometry.attributes.position,v=VT.v;
  for(let i=0;i<P.count;i++){if(o.isSkinnedMesh)o.getVertexPosition(i,v);else v.fromBufferAttribute(P,i).applyMatrix4(o.matrixWorld);if(v.y<y){y=v.y;at=o.name;}}});
  return {y:+y.toFixed(4),at};}
function labVerts(){
  if(!glOK||!M)return {};const o={};
  if(G3.bat.g.visible)o.bat=lowest(G3.bat.g);if(G3.ns.g.visible)o.ns=lowest(G3.ns.g);
  for(let i=0;i<LV.nf;i++)if(G3.fielders[i].g.visible)o[M.field[i]&&M.field[i].n||'f'+i]=lowest(G3.fielders[i].g);
  if(G3.bowler.g.visible)o.bowler=lowest(G3.bowler.g);
  return o;
}
function labBat(){const b=labBatter();if(!b)return null;const J=b.J;return {H:J.H,d:J.d,fn:J.fn,a:R3(V3.add(J.H,V3.sc(J.d,.28))),b:R3(V3.add(J.H,V3.sc(J.d,.86))),kind:b.kind,swing:b.swing,contact:b.contact};}
// the ball as drawn: render3D lifts the path's point by its radius (and the contact solver targets that centre)
function labBallNow(){const b=LV.ball;return {b:b?R3([b.x,b.y+.05,b.z]):null,bk:LV.bk,vis:!!glOK&&G3.ball.visible,st:LV.st?{a:LV.st.a,bails:LV.st.bails}:null,
  thr:S.thr?{i:S.thr.i,rv:S.thr.rv,kind:S.thr.kind,tg:S.thr.tg,tr:S.thr.tr,ta:S.thr.ta,tk:thrRecv(S.thr).tk,hit:S.thr.hit}:null,f0:S.f0,hit:!!S.hit};}
function labFrame(o){o=o||{};const f={t:clock,ph:S.phase,st:S.t,gv:LAB.gv,cut:!!LAB.cut,kh:!!LAB.kh,bat:labBatter(),ns:labNs(),p:labPeople(),ball:labBallNow(),cam:labCamNow(),dej:LV.dej,cel:S.cel?clock-S.cel.t0:null};
  if(o.caps)f.caps=labCaps();if(o.verts)f.verts=labVerts();return f;}
// drive vectors of the batter's pose for tools/blender (rig.pose_armature), plus the bat and the view, in the poses.json shape
function labDrive(){const [A,R,P]=skinVecs(BJ),o={root:BJ.hip.slice(),bones:{},pins:{},bat:labBat(),view:labCamNow(),pose:Array.from(LV.pose||[])};
  SKB.forEach((n,i)=>{o.bones[n]={a:A[i],r:R[i]};});for(const [i,t] of P)o.pins[SKB[i]]=t.slice();return o;}
const labAnchors=()=>{const b=S.ball,o={ph:S.phase,st:S.t,clock,release:b?b.start:null,pitch:b?b.start+b.t1:null,tEnd:b?b.start+b.tEnd:null,
  swing:S.swing?S.bat.t0:null,impact:S.swing?S.bat.t0+SWING_DELAY:null,contact:S.hit?S.hitStart:null,f0:S.f0,res:S.res&&{label:S.res.label,sub:S.res.sub,out:!!S.res.out,bnd:S.res.boundary||0,runs:S.res.runs},
  fplay:S.fplay.map(e=>({i:e.i,n:M.field[e.i]&&M.field[e.i].n,k:e.k,o:e.o,t0:e.t0,t1:e.t1,x:e.x,y:e.y,z:e.z,e:e.e})),thr:S.thr?{i:S.thr.i,rv:S.thr.rv,kind:S.thr.kind,tg:S.thr.tg,tr:S.thr.tr,ta:S.thr.ta,tk:thrRecv(S.thr).tk}:null,
  cel:S.cel?S.cel.t0:null,hitU:S.hit?[S.hit.ux,S.hit.uz]:null,fp:LAB.fp||0,readyDur:S.readyDur,runupDur:S.runupDur,resultDur:S.resultDur,pend:S.pending?{t1:S.pending.t1,tEnd:S.pending.tEnd}:null,bowler:M&&M.bowlerType,fieldN:M&&M.field.map(f=>f.n)};return o;};
window.__lab={LAB,on:labOn,off:labOff,seed:labSeed,ui:labUI,start:labStart,step:labStep,render:labRender,ball:labBall,swing:labSwing,backlift:labBacklift,swingAt:labSwingAt,foot:labFoot,duck:labDuck,
  arm:labArm,probe:labProbe,field:labField,cel:labCel,kits:labKits,look:labLook,cam:labSetCam,game:labGameCam,camNow:labCamNow,
  joints:()=>({bat:labBatter(),ns:labNs(),p:labPeople()}),caps:labCaps,verts:labVerts,bat:labBat,ballNow:labBallNow,frame:labFrame,drive:labDrive,anchors:labAnchors,
  keeper:v=>{LAB.keeper=!!v;},info:()=>Object.assign(__r.info(),{crowd:LAB.crowd||0,crowdCalls:LAB.crowdCalls||0}),skinErr:()=>__r.skinErr(),
  species:()=>({planet:curPlanet,species:SPX&&SPX.name,kit:KS.you?'you':'ai',skin:SKN.on,err:SKN.err}),phase:()=>S.phase,clock:()=>clock,
  size:()=>({W,H,LAND}),end:()=>{if(M){S.paused=true;quitToMenu();}}};
}
