/* ---------- replay: each delivery's view state is recorded per frame (runup to end of result) into one preallocated
   buffer and played back after fours and sixes. Frame layout: t, ball xyz (NaN = none), bowler z/arm (NaN = none)/run/running,
   stumps age (NaN = none)/bails, bowler bt/bv/bh (NaN = none), pose[PN], then per fielder x, z, sin/cos face, run, flags (1 on,
   2 running, 4 crouch, 8 action to his right, 16 keeper, 32 bowler's slot, 64 ball in hand), action, its time, hands' target xyz,
   stretch (fieldTick), heading vx/vz, then crowd cheer, bowler x, non-striker on/x/backing-up distance and his pose[PN], far
   stumps' age after a thrown hit (NaN = none). ---------- */
const RFF=14,RP0=13,RF0=RP0+PN,RNS=RF0+NFL*RFF+1,RNP=RNS+4,RFL=RNP+PN+1,RMAX=600,REC={buf:new Float32Array(RMAX*RFL),n:0,t0:0,nf:0},RX=new Float32Array(RFL),RV=mkView();
const RDISC=new Uint8Array(RFL);RDISC[7]=RDISC[9]=RDISC[RNS+1]=1;for(let j=0;j<NFL;j++)RDISC[RF0+j*RFF+5]=RDISC[RF0+j*RFF+6]=1;
RV.pose=RX.subarray(RP0,RF0);RV.ns.pose=RX.subarray(RNP,RNP+PN);
let RP=null;
function recStart(){REC.n=0;REC.t0=clock;S.thr=null;}
function recFrame(V,force){
  const r=REC.buf,n=REC.n,t=clock-REC.t0;if(n>=RMAX||(!force&&n&&t-r[(n-1)*RFL]<1/75))return;
  const o=n*RFL,b=V.ball;
  r[o]=t;r[o+1]=b?b.x:NaN;r[o+2]=b?b.y:NaN;r[o+3]=b?b.z:NaN;
  r[o+4]=V.bz;r[o+5]=V.arm==null?NaN:V.arm;r[o+6]=V.brun;r[o+7]=V.brn?1:0;r[o+8]=V.st?V.st.a:NaN;r[o+9]=V.st&&V.st.bails?1:0;
  r[o+10]=V.bt==null?NaN:V.bt;r[o+11]=V.bv==null?NaN:V.bv;r[o+12]=V.bh==null?NaN:V.bh;
  r.set(V.pose,o+RP0);
  for(let j=0;j<V.nf;j++){const f=V.f[j],k=o+RF0+j*RFF;r[k]=f.x;r[k+1]=f.z;r[k+2]=Math.sin(f.face);r[k+3]=Math.cos(f.face);r[k+4]=f.run;
    r[k+5]=(f.on?1:0)|(f.running?2:0)|(f.crouch?4:0)|(f.sd>0?8:0)|(f.kp?16:0)|(f.bwl?32:0)|(f.hold?64:0);r[k+6]=f.act;r[k+7]=f.ap;r[k+8]=f.hx;r[k+9]=f.hy;r[k+10]=f.hz;r[k+11]=f.e;r[k+12]=f.vx||0;r[k+13]=f.vz||0;}
  const ns=V.ns;r[o+RNS-1]=V.cheer;r[o+RNS]=V.bx;r[o+RNS+1]=ns.on?1:0;r[o+RNS+2]=ns.x;r[o+RNS+3]=ns.u;r.set(ns.pose,o+RNP);r[o+RNP+PN]=V.st2?V.st2.a:NaN;REC.nf=V.nf;REC.n++;
}
// contact falls between two frames, so the replay gets a frame at exactly that moment: ball on the blade, impact pose; and one at the
// highlight's play (a catch, drop, save, leap), so its slow motion shows the ball reaching the hands rather than blended short of them.
// The ball's own moments (stumps, pad, keeper) are recorded by flightUpdate as they happen (recAtClock)
function recContact(){
  if(S.hit)recAtClock(S.hitStart);
  const h=S.hl;if(h&&h.ev)recAtClock(S.f0+h.t);}
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
  V.st=x[8]===x[8]?(V.so.a=x[8],V.so.bails=!!x[9],V.so):null;V.st2=x[RNP+PN]===x[RNP+PN]?(V.so2.a=x[RNP+PN],V.so2):null;
  V.bt=x[10]===x[10]?x[10]:null;V.bv=x[11]===x[11]?x[11]:null;V.bh=x[12]===x[12]?x[12]:null;
  V.nf=REC.nf;
  for(let j=0;j<V.nf;j++){const k=RF0+j*RFF,f=V.f[j],fl=x[k+5];
    f.on=!!(fl&1);f.x=x[k];f.z=x[k+1];f.face=Math.atan2(x[k+2],x[k+3]);f.run=x[k+4];f.running=!!(fl&2);f.crouch=fl&4?1:0;
    f.sd=fl&8?1:-1;f.kp=!!(fl&16);f.bwl=!!(fl&32);f.hold=!!(fl&64);f.act=x[k+6];f.ap=x[k+7];f.hx=x[k+8];f.hy=x[k+9];f.hz=x[k+10];f.e=x[k+11];f.vx=x[k+12];f.vz=x[k+13];}
  V.trail=tr;V.cheer=x[RNS-1];V.bx=x[RNS];
  const ns=V.ns;ns.on=!!x[RNS+1];if(ns.on){ns.x=x[RNS+2];ns.u=x[RNS+3];}
  return V;
}
/* the replay director: every replay comes from the ball's highlight (S.hl = highlightOf in commit). Batting, every highlight is replayed
   (a four or six when the chase camera followed it); in the T20 first innings the AI's fours and sixes share one replay per over; at
   the end of an innings (end: before the end screen, innings break or scenario result) only a wicket */
const RP_BND={four:1,six:1,leap:1};
function rpWant(end){
  const h=S.hl;if(!h||REC.n<2||!S.ball)return null;
  if(end)return HL_WK[h.kind]?h:null;
  if(RP_BND[h.kind]){if(!S.chase||!S.hit)return null;if(M.bowl){if(M.rpOver===M.overNo)return null;M.rpOver=M.overNo;}}
  return h;
}
function rpThen(h,nx){if(h)rpStart(h,nx);else nx();}
/* a replay plan from the highlight. All start just before release in the side-on slow motion (0.6x easing to 0.35x near tc, the
   contact or, without one, the event); s1 ends it. Then by class: field (spider-cam on the shot's path: boundaries, rope saves, the
   six's leap, a catch or chance in the ring or deep, slow sa..sb round the play), close (keeper or within 18 m: the cordon camera just
   after contact, or square on from the off side for a play at the batter), cab (bowler's slot: end-on from behind the striker), stumps
   (bowled, LBW, near misses: end-on from behind the bowler's arm, cut at the pitch, the whole flight slow) and crease (stumped: square on
   at the popping crease). ct: the play as drawn (S.fplay, moved onto the drawn path; h.ev is the logic's). tk: the event on the replay clock; ev: sounds at their times; hold: LBW's pause at the pad (rpLbw draws) */
function rpStart(h,nx){
  const b=S.ball,res=S.res,sw=S.swing,last=REC.buf[(REC.n-1)*RFL],bs=b.start-REC.t0,k=h.kind,e=h.ev&&S.fplay[(res.fplay||[]).indexOf(h.ev)]||h.ev||null,hit=!!S.hit,
    tc=hit?S.hitStart-REC.t0:bs+h.t,tk=h.rel?bs+h.t:e?tc+e.t1:tc,x=recAt(Math.min(tc,last)),snd=[batKind(res),res.q,sw&&sw.power];
  const R=RP={kind:k,t:Math.max(0,bs-.15),tc,tk,s1:tc+.4,end:last,nx,t0:clock,h:S.hit,ct:e,cls:'field',sq:false,sa:-1e9,sb:-1e9,slo:1,
    hx:x[RP0+qHX],hz:x[RP0+qHZ],bx:x[RNS],yaw:null,ev:[],hold:0,hu:0,lbw:null},at=(t,f)=>R.ev.push({t,f});
  if(hit)at(tc,()=>sfx.bat(...snd,.7));
  if(h.rel){
    R.cls=k==='stumped'?'crease':'stumps';R.s1=Math.max(R.t+.2,Math.min(bs+b.t1,tk-.25));R.slo=.45;R.sb=1e9;
    R.end=Math.min(tk+(k==='bowled'||k==='stumped'?.7:.5),last);
    if(res.outText==='Played on'&&sw)at(bs+sw.tc,()=>sfx.bat('edge',.3,.5,.7));
    if(k==='lbw'||k==='shout'){R.hold=.6;R.lbw={b,pad:res.pad,out:k==='lbw'};at(tk,()=>play('block',{vol:.5,rate:.7}));}
    else at(tk,k==='shave'?()=>sfx.gasp(0):()=>sfx.stumps());
  }else if(e&&!RP_BND[k]&&k!=='save'){
    const f=M.field[e.i]||{},c=R.cls=f.n==='bowler'?'cab':f.n==='keeper'||Math.hypot(f.x,f.z)<18?'close':'field';
    R.sq=c==='close'&&e.x>-1&&Math.hypot(e.x,e.z-.5)<4;R.s1=tc+(c==='close'?.06:c==='cab'?.12:.4);
    R.end=Math.min(tk+(k==='caught'&&c==='field'?.5:.8),res.boundary&&S.chase?Math.max(tk+.8,S.chase.tx-REC.t0+.3):1e9,last);
    R.slo=c==='close'?.35:c==='cab'?.4:.5;R.sa=c==='field'?tk-.2:-1e9;R.sb=tk+(c==='field'?.1:.25);
    at(tk,k==='caught'?()=>sfx.catch(0):()=>{sfx.keeper(.5);sfx.gasp(0);});
  }else{
    R.end=Math.min(RP_BND[k]?S.chase.tx-REC.t0+.3:tk+.7,last);
    if(e){R.sa=tk-.35;R.sb=tk+.25;R.slo=.45;}
  }
  S.phase='replay';S.chase=S.thr=S.cord=null;$('#banner').className='';S.trail3=[];S.aim=null;ctlUI(false);rpUI(true);updateCam(0);
}
function rpUpdate(dt){
  const R=RP,t=R.t;
  if(R.hold&&t>=R.tk&&R.hu<R.hold)R.hu+=dt;
  else R.t+=dt*(t<R.s1?lerp(.6,.35,smooth(clamp((t-R.tc+.5)/.2,0,1))):lerp(1,R.slo,smooth(clamp((t-R.sa+.3)/.3,0,1))*(1-smooth(clamp((t-R.sb)/.3,0,1)))));
  if(R.hold&&R.hu<R.hold&&R.t>R.tk)R.t=R.tk;
  for(const x of R.ev)if(!x.on&&R.t>=x.t){x.on=1;x.f();}
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
  // bowled, LBW, near misses: end-on from high behind the bowler's arm (on the side away from him, clear of him and the non-striker),
  // a long lens on the batter's stumps, 2.8 m across the shorter side
  if(R.cls==='stumps'){const cx=R.bx>0?-.5:.5,d=Math.hypot(cx,26.4);setCam(cx,3.4,27,Math.atan2(-cx,-26.4)/D2R);F=Math.min(W,H)/2.8*d;HZ=H*.6-2.95*F/d;return;}
  // stumped: low and square on from the off side, a little in front of the popping crease (clear of silly point): back foot, crease,
  // stumps and the keeper across the screen
  if(R.cls==='crease'){const cx=6.5,cz=4.1,d=Math.hypot(cx,cz-1.1);setCam(cx,1.1,cz,Math.atan2(-cx,1.1-cz)/D2R);F=Math.min(W/5.6,H/3.4)*d;HZ=H*.68-.5*F/d;return;}
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
