/* ---------- replay: each delivery's view state is recorded per frame (runup to end of result) into one preallocated
   buffer and played back after fours and sixes. Frame layout: t, ball xyz (NaN = none), bowler z/arm (NaN = none)/run/running,
   stumps age (NaN = none)/bails, pose[PN], then per fielder x, z, sin/cos face, run, flags (1 on, 2 running, 4 crouch, 8 action to his right,
   16 keeper, 32 bowler's slot, 64 ball in hand), action, its time, hands' target xyz, stretch (fieldTick), then crowd cheer,
   bowler x, non-striker on/x/backing-up distance/gait phase/gait weight, far stumps' age after a thrown hit (NaN = none). ---------- */
const RFF=12,RF0=10+PN,RNS=RF0+NFL*RFF+1,RFL=RNS+7,RMAX=600,REC={buf:new Float32Array(RMAX*RFL),n:0,t0:0,nf:0},RX=new Float32Array(RFL),RV=mkView();
const RDISC=new Uint8Array(RFL);RDISC[7]=RDISC[9]=RDISC[RNS+1]=RDISC[RNS+2]=1;for(let j=0;j<NFL;j++)RDISC[RF0+j*RFF+5]=RDISC[RF0+j*RFF+6]=1;
RV.pose=RX.subarray(10,RF0);
let RP=null;
function recStart(){REC.n=0;REC.t0=clock;S.thr=null;}
function recFrame(V,force){
  const r=REC.buf,n=REC.n,t=clock-REC.t0;if(n>=RMAX||(!force&&n&&t-r[(n-1)*RFL]<1/75))return;
  const o=n*RFL,b=V.ball;
  r[o]=t;r[o+1]=b?b.x:NaN;r[o+2]=b?b.y:NaN;r[o+3]=b?b.z:NaN;
  r[o+4]=V.bz;r[o+5]=V.arm==null?NaN:V.arm;r[o+6]=V.brun;r[o+7]=V.brn?1:0;r[o+8]=V.st?V.st.a:NaN;r[o+9]=V.st&&V.st.bails?1:0;
  r.set(V.pose,o+10);
  for(let j=0;j<V.nf;j++){const f=V.f[j],k=o+RF0+j*RFF;r[k]=f.x;r[k+1]=f.z;r[k+2]=Math.sin(f.face);r[k+3]=Math.cos(f.face);r[k+4]=f.run;
    r[k+5]=(f.on?1:0)|(f.running?2:0)|(f.crouch?4:0)|(f.sd>0?8:0)|(f.kp?16:0)|(f.bwl?32:0)|(f.hold?64:0);r[k+6]=f.act;r[k+7]=f.ap;r[k+8]=f.hx;r[k+9]=f.hy;r[k+10]=f.hz;r[k+11]=f.e;}
  const ns=V.ns;r[o+RNS-1]=V.cheer;r[o+RNS]=V.bx;r[o+RNS+1]=ns.on?1:0;r[o+RNS+2]=ns.x;r[o+RNS+3]=ns.u;r[o+RNS+4]=ns.ph;r[o+RNS+5]=ns.mv;r[o+RNS+6]=V.st2?V.st2.a:NaN;REC.nf=V.nf;REC.n++;
}
// contact falls between two frames, so the replay gets a frame at exactly that moment: ball on the blade, impact pose; and one at
// a catch, so its slow motion shows the ball reaching the hands rather than blended short of them
function recContact(){
  if(S.hit)recAtClock(S.hitStart);
  const e=S.f0!=null&&rpCatchEv();if(e)recAtClock(S.f0+e.t1);}
function recAtClock(t){
  if(clock<=t||REC.n&&t-REC.t0<=REC.buf[(REC.n-1)*RFL])return;
  const c=clock;clock=t;recFrame(liveView(),true);clock=c;}
// frame at time t: blended between the two recorded frames around it; flags and NaN slots come from the nearer one
function recAt(t){
  const r=REC.buf;let lo=0,hi=REC.n-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(r[m*RFL]<=t)lo=m;else hi=m;}
  const a=lo*RFL,b=hi*RFL,u=r[b]>r[a]?clamp((t-r[a])/(r[b]-r[a]),0,1):0,nr=u<.5?a:b;
  for(let j=0;j<RFL;j++){const x=r[a+j],y=r[b+j];RX[j]=RDISC[j]||x!==x||y!==y?r[nr+j]:x+(y-x)*u;}
  return RX;
}
function rpView(){
  const V=RV,R=RP;let tr=null;
  if(R.t>=R.s1){tr=[];for(let k=14;k>0;k--){const x=recAt(R.t-k*.03);if(x[1]===x[1])tr.push({x:x[1],y:x[2],z:x[3]});}}
  const x=recAt(R.t);
  V.ball=x[1]===x[1]?(V.bo.x=x[1],V.bo.y=x[2],V.bo.z=x[3],V.bo):null;
  V.bz=x[4];V.arm=x[5]===x[5]?x[5]:null;V.brun=x[6];V.brn=!!x[7];
  V.st=x[8]===x[8]?(V.so.a=x[8],V.so.bails=!!x[9],V.so):null;V.st2=x[RNS+6]===x[RNS+6]?(V.so2.a=x[RNS+6],V.so2):null;
  V.nf=REC.nf;
  for(let j=0;j<V.nf;j++){const k=RF0+j*RFF,f=V.f[j],fl=x[k+5];
    f.on=!!(fl&1);f.x=x[k];f.z=x[k+1];f.face=Math.atan2(x[k+2],x[k+3]);f.run=x[k+4];f.running=!!(fl&2);f.crouch=fl&4?1:0;
    f.sd=fl&8?1:-1;f.kp=!!(fl&16);f.bwl=!!(fl&32);f.hold=!!(fl&64);f.act=x[k+6];f.ap=x[k+7];f.hx=x[k+8];f.hy=x[k+9];f.hz=x[k+10];f.e=x[k+11];}
  V.trail=tr;V.cheer=x[RNS-1];V.bx=x[RNS];
  const ns=V.ns;ns.on=!!x[RNS+1];if(ns.on){ns.x=x[RNS+2];ns.u=x[RNS+3];nsPose(ns.pose,x[RNS+4],x[RNS+5]);}
  return V;
}
// a caught wicket's catch (drops are not out), and whether this ball gets a replay: a four or six seen in the chase camera (not at the
// end of an innings), or a catch (the last wicket's too, before the end screen, the innings break or the scenario's result)
const rpCatchEv=()=>REC.n>1&&S.res&&S.res.out&&S.res.catcher!=null&&S.fplay.find(e=>e.i===S.res.catcher&&e.o==='catch');
const rpCatch=()=>!!rpCatchEv(),rpWant=()=>rpCatch()||REC.n>1&&!!S.res&&!!S.res.boundary&&!!S.chase;
function rpThen(want,nx){if(want)rpStart(nx);else nx();}
/* a catch replay (tk: the catch on the replay clock) by where it is taken: close (keeper, or within 18 m) cuts to the cordon camera
   just after contact (a catch at the batter on the off side or straight: square on from the off side), slow until the catch; cab
   (caught and bowled) to an end-on lens from behind the striker; field (ring, deep, rope) keeps the side-on shot and the spider-cam,
   easing into slow motion briefly around the catch. Slow-motion span sa..sb at speed slo */
function rpStart(nx){
  const tc=S.hitStart-REC.t0,x=recAt(tc),ct=rpCatchEv()||null,last=REC.buf[(REC.n-1)*RFL];
  const R=RP={t:Math.max(0,S.ball.start-REC.t0-.15),tc,s1:tc+.4,end:0,nx,t0:clock,h:S.hit,hit:false,ct,cls:null,
    snd:[batKind(S.res),S.res.q,S.swing&&S.swing.power],hx:x[10+qHX],hz:x[10+qHZ],yaw:null};
  if(ct){const f=M.field[ct.i]||{},c=R.cls=f.n==='bowler'?'cab':f.n==='keeper'||Math.hypot(f.x,f.z)<18?'close':'field';
    R.tk=tc+ct.t1;R.sq=c==='close'&&ct.x>-1&&Math.hypot(ct.x,ct.z-.5)<4;R.s1=tc+(c==='close'?.06:c==='cab'?.12:.4);
    R.end=Math.min(R.tk+(c==='field'?.5:.8),last);R.slo=c==='close'?.35:c==='cab'?.4:.5;R.sa=c==='field'?R.tk-.2:-1e9;R.sb=R.tk+(c==='field'?.1:.25);}
  else R.end=Math.min(S.chase.tx-REC.t0+.3,last);
  S.phase='replay';S.chase=S.thr=S.cord=null;$('#banner').className='';S.trail3=[];S.aim=null;ctlUI(false);rpUI(true);updateCam(0);
}
function rpUpdate(dt){
  const R=RP,t=R.t;
  R.t+=dt*(t<R.s1?lerp(.6,.35,smooth(clamp((t-R.tc+.5)/.2,0,1))):R.ct?lerp(1,R.slo,smooth(clamp((t-R.sa+.3)/.3,0,1))*(1-smooth(clamp((t-R.sb)/.3,0,1)))):1);
  if(!R.hit&&R.t>=R.tc){R.hit=true;sfx.bat(...R.snd,.7);}
  if(R.ct&&!R.ck&&R.t>=R.tk){R.ck=1;sfx.catch(0);}
  if(R.t>=R.end)rpEnd();
}
function rpEnd(){const R=RP;rpUI(false);ctlUI(true);R.nx();updateCam(0);}
function rpSkip(e){
  if(S.phase!=='replay'||S.paused||(e.target&&e.target.closest&&e.target.closest('#hud')))return false;
  if(clock-RP.t0>=.3)rpEnd();return true;
}
function rpUI(on){$('#rpTag').hidden=$('#rpSkip').hidden=!on;$('#hint').style.visibility=on?'hidden':'';if(on)$('#rpTag').style.top=(hudBottom+10)+'px';else{RP=null;if(S.phase==='replay')S.phase='idle';}}
function rpCam(dt){
  const R=RP;
  if(R.t<R.s1){
    const ch=Math.max(0,R.hz-1.1),tx=R.hx+.25,ty=.95,tz=R.hz+.3-ch*.5,a=25*D2R,D=7.5,cx=tx+D*Math.cos(a),cy=2,cz=tz+D*Math.sin(a);
    setCam(cx,cy,cz,Math.atan2(tx-cx,tz-cz)/D2R);
    F=Math.min(W/(3.1+ch),H/(2.8+ch*.8))*D*(1+.08*clamp((R.t-R.tc+1)/1.4,0,1));HZ=H*.56-(cy-ty)*F/D;
    return;
  }
  // a catch at the batter (keeper up, silly point): square on from the off side, as the batter hides it from the cordon camera; on the
  // leg side (short leg) he would hide it from there, so those take the cordon camera
  // (framing the catch and the batter, 2.4 m up from the grass at 0.78 of the height)
  if(R.sq){const c=R.ct,d=7-c.x,zl=Math.min(c.z,BATS_Z)-.8,zr=Math.max(c.z,BATS_Z)+.6;setCam(7,1.6,(zl+zr)/2,-90);
    F=Math.min(W/(zr-zl),H*.7/2.4)*d;HZ=H*.78-1.6*F/d;return;}
  // 3.2 m of ground across the shorter side (cordCam's span is half the longer side), so the catcher is as big in landscape; the
  // camera 2.2 m further out than live, so the line to a keeper or slip passes clear of the batter
  if(R.cls==='close'){const c=R.ct;return cordCam(c.x,c.z,1.6*Math.max(W,H)/Math.min(W,H),clamp(c.x*.3+(c.x<0?-2.2:2.2),-4.5,4.5));}
  if(R.cls==='cab'){const c=R.ct,dx=c.x-2.4,dz=c.z+5,d=Math.hypot(dx,dz);setCam(2.4,2.2,-5,Math.atan2(dx,dz)/D2R);F=Math.max(W,H)/2*d/5;HZ=H*.62-2.2*F/d;return;}
  const h=R.h,b=hitPos(h,R.t-R.tc),ux=h.ux,uz=h.uz,first=R.yaw==null,k=first?1:1-Math.exp(-dt*4);
  const bk=6+b.y*.8,tx=b.x-ux*bk+uz*2,tz=b.z-uz*bk-ux*2,ty=3+b.y*.6;
  setCam(lerp(cam.x,tx,k),lerp(cam.y,ty,k),lerp(cam.z,tz,k),cam.yaw);
  const dx=b.x-cam.x,dz=b.z-cam.z,d=Math.max(1,Math.hypot(dx,dz)),yaw=Math.atan2(dx,dz)/D2R;
  R.yaw=first?yaw:R.yaw+angDiff(yaw,R.yaw)*(1-Math.exp(-dt*8));setCam(cam.x,cam.y,cam.z,R.yaw);
  F=followF*1.1;HZ=clamp(H*.45+(b.y-cam.y)*F/d,H*.2,H*.6);
}
function rpGlow(b){
  const q=RP&&RP.t>=RP.s1&&b&&proj(b.x,b.y+.05,b.z);if(!q)return;
  const g=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,12);g.addColorStop(0,'rgba(255,240,200,.55)');g.addColorStop(1,'rgba(255,240,200,0)');
  ctx.save();ctx.fillStyle=g;ctx.beginPath();ctx.arc(q.x,q.y,12,0,7);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(6,0.05*q.s+3),0,7);ctx.stroke();ctx.restore();
}
