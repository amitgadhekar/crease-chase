/* ---------- replay: each delivery's view state is recorded per frame (runup to end of result) into one preallocated
   buffer and played back after fours and sixes. Frame layout: t, ball xyz (NaN = none), bowler z/arm (NaN = none)/run/running,
   stumps age (NaN = none)/bails, pose[PN], then per fielder x, z, sin/cos face, run, flags (1 on, 2 running, 4 crouch), then crowd cheer,
   bowler x, non-striker on/x/backing-up distance/gait phase/gait weight. ---------- */
const RF0=10+PN,RNS=RF0+NFL*6+1,RFL=RNS+6,RMAX=600,REC={buf:new Float32Array(RMAX*RFL),n:0,t0:0,nf:0},RX=new Float32Array(RFL),RV=mkView();
const RDISC=new Uint8Array(RFL);RDISC[7]=RDISC[9]=RDISC[RNS+1]=RDISC[RNS+2]=1;for(let j=0;j<NFL;j++)RDISC[RF0+j*6+5]=1;
RV.pose=RX.subarray(10,RF0);
let RP=null;
function recStart(){REC.n=0;REC.t0=clock;}
function recFrame(V,force){
  const r=REC.buf,n=REC.n,t=clock-REC.t0;if(n>=RMAX||(!force&&n&&t-r[(n-1)*RFL]<1/75))return;
  const o=n*RFL,b=V.ball;
  r[o]=t;r[o+1]=b?b.x:NaN;r[o+2]=b?b.y:NaN;r[o+3]=b?b.z:NaN;
  r[o+4]=V.bz;r[o+5]=V.arm==null?NaN:V.arm;r[o+6]=V.brun;r[o+7]=V.brn?1:0;r[o+8]=V.st?V.st.a:NaN;r[o+9]=V.st&&V.st.bails?1:0;
  r.set(V.pose,o+10);
  for(let j=0;j<V.nf;j++){const f=V.f[j],k=o+RF0+j*6;r[k]=f.x;r[k+1]=f.z;r[k+2]=Math.sin(f.face);r[k+3]=Math.cos(f.face);r[k+4]=f.run;r[k+5]=(f.on?1:0)|(f.running?2:0)|(f.crouch?4:0);}
  const ns=V.ns;r[o+RNS-1]=V.cheer;r[o+RNS]=V.bx;r[o+RNS+1]=ns.on?1:0;r[o+RNS+2]=ns.x;r[o+RNS+3]=ns.u;r[o+RNS+4]=ns.ph;r[o+RNS+5]=ns.mv;REC.nf=V.nf;REC.n++;
}
// contact falls between two frames, so the replay gets a frame at exactly that moment: ball on the blade, impact pose
function recContact(){
  if(!S.hit||clock<=S.hitStart||REC.n&&S.hitStart-REC.t0<=REC.buf[(REC.n-1)*RFL])return;
  const c=clock;clock=S.hitStart;recFrame(liveView(),true);clock=c;}
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
  V.st=x[8]===x[8]?(V.so.a=x[8],V.so.bails=!!x[9],V.so):null;
  V.nf=REC.nf;
  for(let j=0;j<V.nf;j++){const k=RF0+j*6,f=V.f[j],fl=x[k+5];
    f.on=!!(fl&1);f.x=x[k];f.z=x[k+1];f.face=Math.atan2(x[k+2],x[k+3]);f.run=x[k+4];f.running=!!(fl&2);f.crouch=fl&4?1:0;}
  V.trail=tr;V.cheer=x[RNS-1];V.bx=x[RNS];
  const ns=V.ns;ns.on=!!x[RNS+1];if(ns.on){ns.x=x[RNS+2];ns.u=x[RNS+3];nsPose(ns.pose,x[RNS+4],x[RNS+5]);}
  return V;
}
function rpStart(nx){
  const tc=S.hitStart-REC.t0,x=recAt(tc);
  RP={t:Math.max(0,S.ball.start-REC.t0-.15),tc,s1:tc+.4,end:Math.min(S.chase.tx-REC.t0+.3,REC.buf[(REC.n-1)*RFL]),nx,t0:clock,h:S.hit,hit:false,
    snd:[batKind(S.res),S.res.q,S.swing&&S.swing.power],hx:x[10+qHX],hz:x[10+qHZ],yaw:null};
  S.phase='replay';S.chase=null;$('#banner').className='';S.trail3=[];S.aim=null;$('#loftBtn').hidden=$('#stick').hidden=true;rpUI(true);updateCam(0);
}
function rpUpdate(dt){
  const R=RP;R.t+=dt*(R.t<R.s1?lerp(.6,.35,smooth(clamp((R.t-R.tc+.5)/.2,0,1))):1);
  if(!R.hit&&R.t>=R.tc){R.hit=true;sfx.bat(...R.snd,.7);}
  if(R.t>=R.end)rpEnd();
}
function rpEnd(){const R=RP;rpUI(false);$('#loftBtn').hidden=$('#stick').hidden=false;R.nx();updateCam(0);}
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
  const h=R.h,b=hitPos(h,R.t-R.tc),ux=h.ux,uz=h.uz,first=R.yaw==null,k=first?1:1-Math.exp(-dt*4);
  const bk=6+b.y*.8,tx=b.x-ux*bk+uz*2,tz=b.z-uz*bk-ux*2,ty=3+b.y*.6;
  setCam(lerp(cam.x,tx,k),lerp(cam.y,ty,k),lerp(cam.z,tz,k),cam.yaw);
  const dx=b.x-cam.x,dz=b.z-cam.z,d=Math.max(1,Math.hypot(dx,dz)),yaw=Math.atan2(dx,dz)/D2R;
  R.yaw=first?yaw:R.yaw+angDiff(yaw,R.yaw)*(1-Math.exp(-dt*8));setCam(cam.x,cam.y,cam.z,R.yaw);
  F=baseF*1.1;HZ=clamp(H*.45+(b.y-cam.y)*F/d,H*.2,H*.6);
}
function rpGlow(b){
  const q=RP&&RP.t>=RP.s1&&b&&proj(b.x,b.y+.05,b.z);if(!q)return;
  const g=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,12);g.addColorStop(0,'rgba(255,240,200,.55)');g.addColorStop(1,'rgba(255,240,200,0)');
  ctx.save();ctx.fillStyle=g;ctx.beginPath();ctx.arc(q.x,q.y,12,0,7);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(6,0.05*q.s+3),0,7);ctx.stroke();ctx.restore();
}
