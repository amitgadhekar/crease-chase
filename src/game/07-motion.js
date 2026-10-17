/* ---------- motion toolkit: pure procedural-motion maths shared by the batter, non-striker, bowler, fielders and keeper.
   Springs, slerp, Bezier arcs, a distance-phased gait, planted-foot anchors, IK with pole hysteresis, ground clamp, head
   look, two-handed catching hands, capsule resolve. No THREE, no DOM, no per-frame allocation: every function writes into
   an `out` the caller owns or into a state made once by MO.*State(); scratch is preallocated here. tests/motion.mjs loads
   this file in node:vm (the last expression is MO). Conventions: game metres, +y up; a facing yaw f gives forward
   (sin f, 0, cos f) and the person's right (cos f, 0, -sin f) (the game's left-handed x), the same as person3D. ---------- */
const MO=(()=>{
  const F=n=>new Float64Array(n),clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),
    smooth=u=>(u=clamp(u,0,1),u*u*(3-2*u)),
    // a swing foot's travel over its swing u: nothing until .12 (the lift comes first), then a trapezoid speed profile (20% ramps,
    // peak 1.25x the mean, far flatter than smoothstep) to .88, still before it lands
    trav=u=>{const v=clamp((u-.12)/.76,0,1);return v<.2?3.125*v*v:v<.8?1.25*v-.125:1-3.125*(1-v)*(1-v);},easeOut=u=>(u=clamp(u,0,1),1-(1-u)*(1-u)),easeIn=u=>(u=clamp(u,0,1),u*u),
    set=(o,x,y,z)=>{o[0]=x;o[1]=y;o[2]=z;return o;},cp=(o,a)=>set(o,a[0],a[1],a[2]),add=(o,a,b)=>set(o,a[0]+b[0],a[1]+b[1],a[2]+b[2]),
    sub=(o,a,b)=>set(o,a[0]-b[0],a[1]-b[1],a[2]-b[2]),sc=(o,a,s)=>set(o,a[0]*s,a[1]*s,a[2]*s),madd=(o,a,b,s)=>set(o,a[0]+b[0]*s,a[1]+b[1]*s,a[2]+b[2]*s),
    mix=(o,a,b,t)=>set(o,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
    len=a=>Math.hypot(a[0],a[1],a[2]),dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),
    cross=(o,a,b)=>{const x=a[1]*b[2]-a[2]*b[1],y=a[2]*b[0]-a[0]*b[2],z=a[0]*b[1]-a[1]*b[0];return set(o,x,y,z);},
    // a zero vector stays zero (never NaN); the caller picks a fallback with perp() when it matters
    norm=(o,a)=>{const l=len(a);return l>1e-12?sc(o,a,1/l):set(o,0,0,0);},
    UP=Object.freeze([0,1,0]),XA=Object.freeze([1,0,0]),T0=F(3),T1=F(3),T2=F(3),T3=F(3),T4=F(3),AX=F(3);
  const fwdOf=(o,f)=>set(o,Math.sin(f),0,Math.cos(f)),rightOf=(o,f)=>set(o,Math.cos(f),0,-Math.sin(f)),yawOf=v=>Math.atan2(v[0],v[2]);
  // unit vector perpendicular to a, as close to hint as possible (any perpendicular when the hint is parallel or missing)
  function perp(o,a,hint){
    if(hint){madd(o,hint,a,-dot(hint,a));if(len(o)>1e-6)return norm(o,o);}
    cross(o,a,Math.abs(a[1])<.9?UP:XA);return norm(o,o);}
  // Rodrigues rotation of v about the unit axis by ang
  function rot(o,v,axis,ang){const c=Math.cos(ang),s=Math.sin(ang),k=dot(axis,v)*(1-c);cross(T4,axis,v);
    return set(o,v[0]*c+T4[0]*s+axis[0]*k,v[1]*c+T4[1]*s+axis[1]*k,v[2]*c+T4[2]*s+axis[2]*k);}

  /* --- critically damped springs: exact over the step for a constant target, so the result is the same at 30 or 120 Hz.
     w is the stiffness in 1/s: from rest the response passes 95% at ~4.7/w s and never overshoots. --- */
  const springState=(x=0)=>({x,v:0}),springVState=p=>({x:F(3),v:F(3),set(q){cp(this.x,q);set(this.v,0,0,0);return this;}});
  function spring(s,target,dt,w){const e=Math.exp(-w*dt),dx=s.x-target,tmp=(s.v+w*dx)*dt;s.x=target+(dx+tmp)*e;s.v=(s.v-tmp*w)*e;return s.x;}
  // angles: the shortest way round; s.x stays continuous (unwrapped), read it with wrap() if a range matters
  function springA(s,target,dt,w){return spring(s,s.x+wrap(target-s.x),dt,w);}
  function springV(s,target,dt,w){const e=Math.exp(-w*dt),x=s.x,v=s.v;
    for(let i=0;i<3;i++){const dx=x[i]-target[i],tmp=(v[i]+w*dx)*dt;x[i]=target[i]+(dx+tmp)*e;v[i]=(v[i]-tmp*w)*e;}return x;}

  /* --- slerp between unit vectors; opposite vectors turn about the hint axis (else any perpendicular), passing through
     cross(hint, a), so the result is never zero or NaN; out may alias a or b --- */
  function slerp(o,a,b,t,hint){
    const d=clamp(dot(a,b),-1,1);
    if(d>.9995){mix(T0,a,b,t);return norm(o,T0);}
    if(d<-.9995){perp(AX,a,hint);add(T1,a,b);rot(T0,a,AX,Math.PI*t);madd(T0,T0,T1,t);return norm(o,T0);} // ends exactly on b
    const ang=Math.acos(d),s=Math.sin(ang),wa=Math.sin((1-t)*ang)/s,wb=Math.sin(t*ang)/s;
    return set(o,a[0]*wa+b[0]*wb,a[1]*wa+b[1]*wb,a[2]*wa+b[2]*wb);}

  /* --- Bezier curves (out may alias any input) and an arc from a to b lifted along up (default +y) at its middle --- */
  function bez(o,p0,p1,p2,t){const u=1-t,a=u*u,b=2*u*t,c=t*t;return set(o,p0[0]*a+p1[0]*b+p2[0]*c,p0[1]*a+p1[1]*b+p2[1]*c,p0[2]*a+p1[2]*b+p2[2]*c);}
  function bez3(o,p0,p1,p2,p3,t){const u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,d=t*t*t;
    return set(o,p0[0]*a+p1[0]*b+p2[0]*c+p3[0]*d,p0[1]*a+p1[1]*b+p2[1]*c+p3[1]*d,p0[2]*a+p1[2]*b+p2[2]*c+p3[2]*d);}
  // the quadratic control point sits at 2*lift so the curve's middle is lift above the chord
  function arc(o,a,b,lift,t,up=UP){mix(T2,a,b,.5);madd(T2,T2,up,2*lift);return bez(o,a,T2,b,t);}
  // tangent of the arc (not normalised)
  function arcTan(o,a,b,lift,t,up=UP){mix(T2,a,b,.5);madd(T2,T2,up,2*lift);
    return set(o,2*(1-t)*(T2[0]-a[0])+2*t*(b[0]-T2[0]),2*(1-t)*(T2[1]-a[1])+2*t*(b[1]-T2[1]),2*(1-t)*(T2[2]-a[2])+2*t*(b[2]-T2[2]));}

  /* --- gait: distance-phased, so a stance foot is locked to the ground point it landed on and only swings move feet. The
     phase advances by distance travelled / stride (nothing moves standing still, no treadmill). Per foot: a stance of D
     cycles from its landing, then a swing of 1-D cycles on an arc from its takeoff point to a target that follows the
     body (predicted to the landing), so turns and speed changes never slide a planted foot. Outputs are relative cues the
     rig turns into joints: feet (ball of the foot on the ground), pelvis bob/sway/yaw, shoulder counter-yaw, arm swing,
     elbow bend, forward lean, species float. Modes: walk, jog, sprint (a flight phase: both feet off the ground),
     sidestep (feet never cross), backpedal. --- */
  const GM={idle:0,walk:1,jog:2,sprint:3,side:4,back:5};
  // per mode: duty (stance share of the cycle), stride a+b*speed, lift, bob, pelvis yaw, shoulder yaw, arm swing, elbow bend
  // (rad, added to the rest bend), lean, landing ahead of the hip as a share of the stance travel, half stance width,
  // run amount (bounce sign and arm carriage), heel-strike pitch
  const GP={
    walk:[.62,.45,.5,.05,.02,.08,.06,.3,.25,.02,.45,.1,0,.35],
    jog:[.5,.6,.45,.1,.035,.1,.12,.6,1.3,.08,.42,.09,1,.15],
    sprint:[.38,1,.4,.16,.045,.14,.22,1,1.8,.2,.38,.07,1,0],
    side:[.62,.3,.22,.04,.015,0,0,.15,.3,.02,.5,.17,0,.1],
    back:[.62,.3,.3,.04,.02,.05,.04,.2,.25,-.05,.4,.1,0,.1]};
  const GN=GP.walk.length,GSP={st:1,lf:1,fq:1,fl:0};
  // outputs, read after gaitStep: foot[i] (0 left, 1 right) = the ball of the foot in world space (y > 0 in a swing), st[i] 1 when
  // planted, u[i] swing progress, pitch[i] (rad, + toes up at heel strike, - toes down at toe-off), pelvis [sway to the right,
  // bob up, yaw (+ turns the right hip back: left leg forward)], sh shoulder yaw (counter), arm[i] swing (+ forward, opposite
  // to its leg), elbow extra bend, lean (rad forward), mode, speed, stride, travel (unit), fw/rt the facing's forward and right
  function gaitState(){return {ph:0,mode:0,speed:0,vf:F(2),p:F(GN),foot:[F(3),F(3)],u:F(2),st:new Uint8Array([1,1]),ls:F(2),lock:[F(3),F(3)],tgt:[F(3),F(3)],
    pitch:F(2),lfh:F(2),pelvis:F(3),sh:0,arm:F(2),elbow:0,lean:0,fly:0,travel:F(3),fw:F(3),rt:F(3),vprev:F(2),acc:springState(),hy:springState(),sway:springState(),stride:1};}
  // put both feet on the ground in the stance for pos (x,z) and facing f (w: half width, ahead: left foot forward by this)
  function gaitReset(g,x,z,f,w=.1,ahead=0){fwdOf(g.fw,f);rightOf(g.rt,f);
    for(let i=0;i<2;i++){const sd=i?1:-1;set(g.foot[i],x+g.rt[0]*sd*w+g.fw[0]*(i?-ahead:ahead)*.5,0,z+g.rt[2]*sd*w+g.fw[2]*(i?-ahead:ahead)*.5);cp(g.lock[i],g.foot[i]);cp(g.tgt[i],g.foot[i]);
      g.st[i]=1;g.u[i]=0;g.ls[i]=i?-.5:0;g.pitch[i]=0;}
    g.ph=0;g.mode=0;g.speed=0;g.vf[0]=g.vf[1]=0;set(g.pelvis,0,0,0);g.sh=0;g.arm[0]=g.arm[1]=0;g.elbow=0;g.lean=0;g.fly=0;g.vprev[0]=g.vprev[1]=0;
    g.acc.x=g.acc.v=0;g.hy.x=g.hy.v=0;g.sway.x=g.sway.v=0;return g;}
  // mode from the velocity's direction relative to the facing (a forced mode wins)
  function gaitMode(speed,along,across,forced){
    if(forced)return forced;if(speed<.05)return GM.idle;
    if(along<-.5*speed)return GM.back;if(Math.abs(across)>.7*speed&&speed<3.5)return GM.side;
    return speed<1.9?GM.walk:speed<4.2?GM.jog:GM.sprint;}
  function gaitParams(o,mode,speed){
    if(mode===GM.side)return cp14(o,GP.side);if(mode===GM.back)return cp14(o,GP.back);
    const t=speed<=1.9?0:speed<=2.6?(speed-1.9)/.7:speed<=4.2?1:speed<=5.5?1+(speed-4.2)/1.3:2;
    const A=t<1?GP.walk:GP.jog,B=t<1?GP.jog:GP.sprint,k=t<1?t:t-1;for(let i=0;i<GN;i++)o[i]=A[i]+(B[i]-A[i])*k;return o;}
  const cp14=(o,a)=>{for(let i=0;i<GN;i++)o[i]=a[i];return o;};
  // one step: body at x,z facing f (yaw), velocity vx,vz over dt; sp = species gait {st stride, lf lift, fl float}
  function gaitStep(g,x,z,f,vx,vz,dt,sp=GSP,forced=0){
    const speed=Math.hypot(vx,vz);fwdOf(g.fw,f);rightOf(g.rt,f);
    const kf=Math.min(1,dt*12);g.vf[0]+=(vx-g.vf[0])*kf;g.vf[1]+=(vz-g.vf[1])*kf; // filtered velocity for the landing prediction
    const along=vx*g.fw[0]+vz*g.fw[2],across=vx*g.rt[0]+vz*g.rt[2],mode=gaitMode(speed,along,across,forced);
    g.mode=mode;g.speed=speed;
    const p=gaitParams(g.p,mode===GM.idle?GM.walk:mode,speed),D=p[0];
    if(speed>1e-6)set(g.travel,vx/speed,0,vz/speed);else if(mode===GM.back)sc(g.travel,g.fw,-1);else if(len(g.travel)<.5)cp(g.travel,g.fw);
    // cadence is speed/stride here, so a species' fq (cadence multiplier) shortens its stride
    const w=p[11]*sp.st;let stride=(p[1]+p[2]*speed)*sp.st/(sp.fq||1);
    if(mode===GM.side){const rt=Math.abs(dot(g.rt,g.travel));stride=Math.min(stride,(2*w-.06)*Math.max(rt,.3)/D);} // feet never cross (6 cm apart at least)
    g.stride=stride;
    // the phase runs with distance; a swing in progress finishes at a walking cadence when the body stops
    const swinging=g.u[0]>0||g.u[1]>0,dph=speed*dt/stride+(speed<.3&&swinging?dt*(1-D)/.28:0);
    g.ph+=dph;
    const ahead=D*stride*p[10],behindMax=D*stride*(1-p[10])+.1;
    for(let i=0;i<2;i++){const sd=i?1:-1,foot=g.foot[i];
      if(g.st[i]){ // stance: locked; toe-off after D cycles, or early when the body has run away from it
        cp(foot,g.lock[i]);const back=-((foot[0]-x)*g.travel[0]+(foot[2]-z)*g.travel[2]);
        const v=(g.ph-g.ls[i])/D;
        if(v>=1||(back>behindMax&&speed>.3&&(g.st[1-i]||D<.45))){g.st[i]=0;g.u[i]=1e-6;cp(g.lock[i],foot);}
        else{g.pitch[i]=v>.8?-.45*(.5+.5*p[12])*((v-.8)/.2):0;continue;}}
      // swing: progress in cycles, target = where the hip will be at landing + ahead + the stance width
      // a swing longer than the stride (the body ran away from the foot, or turned round) takes proportionally longer
      const fresh=g.u[i]<=1e-6,far=fresh||speed<.3?1:Math.min(1,stride/Math.max(stride,dist(g.lock[i],g.tgt[i])));g.u[i]=Math.min(1,g.u[i]+far*dph/(1-D));const u=g.u[i],tl=(1-u)*(1-D)*Math.min(1.2,stride/Math.max(speed,.25)),tg=g.tgt[i];
      // the landing target follows the prediction at a capped rate, and is fixed for the last 30% so the foot lands on a point
      if(u<.7){set(T3,x+(g.vf[0]*tl+g.travel[0]*ahead)+g.rt[0]*sd*w,0,z+(g.vf[1]*tl+g.travel[2]*ahead)+g.rt[2]*sd*w);
        if(fresh)cp(tg,T3);else{sub(T3,T3,tg);const l=len(T3),mx=3*dt;if(l>mx)sc(T3,T3,mx/l);add(tg,tg,T3);}}
      // (running, the heel comes up higher behind; the height is the one the swing started with, so a change of mode mid-swing
      // never moves the foot up or down at once)
      if(fresh)g.lfh[i]=Math.max(.045,p[3]*(1+.8*p[12])*sp.lf*Math.min(1,speed));const e=trav(u),lift=g.lfh[i]||.045;
      set(foot,lerp(g.lock[i][0],tg[0],e),Math.sin(Math.PI*u)*lift,lerp(g.lock[i][2],tg[2],e));
      g.pitch[i]=-.5*(1-u)*(1-u)*(1-p[12]*.5)+p[13]*u*u;
      if(u>=1){ // landing: lock, and nudge the next stance toward antiphase with the other foot
        cp(foot,tg);foot[1]=0;cp(g.lock[i],foot);g.st[i]=1;g.u[i]=0;g.pitch[i]=0;
        const j=1-i;let ls=g.ph;if(g.st[j]){let d=g.ls[j]+.5-g.ph;d-=Math.round(d);ls+=.5*clamp(d,-.2,.2);}g.ls[i]=ls;}}
    // body cues from the feet's actual positions (continuous by construction)
    const fr0=(g.foot[0][0]-x)*g.travel[0]+(g.foot[0][2]-z)*g.travel[2],fr1=(g.foot[1][0]-x)*g.travel[0]+(g.foot[1][2]-z)*g.travel[2],
      span=Math.max(.2,stride*D),frontL=clamp((fr0-fr1)/span,-1,1),ra=p[12],moving=clamp(speed/.6,0,1);
    g.pelvis[2]=p[5]*frontL*moving;g.sh=-p[6]*frontL*moving;
    const fm=(fr0+fr1)/2;g.arm[0]=-p[7]*clamp((fr0-fm)/(span*.5),-1,1)*moving;g.arm[1]=-p[7]*clamp((fr1-fm)/(span*.5),-1,1)*moving;
    g.elbow=p[8]*moving;
    // vertical: walking rides high at midstance, running sinks at midstance and flies between; springs keep it smooth
    let support=0,st=0;for(let i=0;i<2;i++)if(g.st[i]){const v=clamp((g.ph-g.ls[i])/D,0,1);support+=Math.sin(Math.PI*v);st++;}
    const air=st===0?1:0,hyT=moving*(lerp(p[4]*(support-.6),-p[4]*support+(p[3]+sp.fl)*air*1.2,ra));
    g.fly=spring(g.hy,hyT,dt,28);g.pelvis[1]=g.fly;
    const swT=moving*.02*((g.st[1]?1:0)-(g.st[0]?1:0));g.pelvis[0]=spring(g.sway,swT,dt,20);
    // lean: with speed, plus acceleration along the travel (spring-smoothed from the velocity history)
    const acc=dt>1e-6?((vx-g.vprev[0])*g.travel[0]+(vz-g.vprev[1])*g.travel[2])/dt:0;g.vprev[0]=vx;g.vprev[1]=vz;
    spring(g.acc,clamp(acc,-12,12),dt,8);g.lean=p[9]*moving+clamp(g.acc.x*.025,-.15,.25);
    return g;}

  /* --- planted-foot anchors for someone standing or turning: feet stay where they are until a target (the stance for
     the current facing) is too far or too twisted; then one foot at a time steps there on an arc while the other pivots
     on the spot (its yaw follows the facing). A split-step hops both feet up and down a touch wider. --- */
  function anchorsState(){return {foot:[F(3),F(3)],yaw:F(2),st:new Uint8Array([1,1]),u:F(2),from:[F(3),F(3)],tgt:[F(3),F(3)],hold:0,split:-1,wx:0,air:0,w:.1};}
  function anchorsReset(a,x,z,f,w=.1){for(let i=0;i<2;i++){const sd=i?1:-1;set(a.foot[i],x+Math.cos(f)*sd*w,0,z-Math.sin(f)*sd*w);a.yaw[i]=f;a.st[i]=1;a.u[i]=0;}
    a.hold=0;a.split=-1;a.wx=0;a.air=0;a.w=w;return a;}
  function anchorsSplit(a){if(a.split<0&&a.st[0]&&a.st[1]&&a.u[0]===0&&a.u[1]===0){a.split=0;cp(a.from[0],a.foot[0]);cp(a.from[1],a.foot[1]);}return a;}
  // x,z the hip, f the facing; opts: w half width, ahead (left foot forward), thr step threshold (m), yawThr (rad), dur (s)
  function anchorsStep(a,x,z,f,dt,o){
    const w=(o&&o.w!=null?o.w:a.w)+a.wx,ahead=o&&o.ahead||0,thr=o&&o.thr||.1,yawThr=o&&o.yawThr||.6,dur=o&&o.dur||.28,lift=o&&o.lift||.05;
    a.w=w-a.wx;rightOf(T0,f);fwdOf(T1,f);
    if(a.split>=0){ // both feet up together, down a little wider
      a.split=Math.min(1,a.split+dt/.22);const h=.05*Math.sin(Math.PI*a.split);a.air=a.split<1?1:0;
      for(let i=0;i<2;i++){const sd=i?1:-1;
        set(a.tgt[i],x+T0[0]*sd*(w+.03)+T1[0]*(i?-ahead:ahead)*.5,0,z+T0[2]*sd*(w+.03)+T1[2]*(i?-ahead:ahead)*.5);
        mix(a.foot[i],a.from[i],a.tgt[i],smooth(a.split));a.foot[i][1]=h;a.yaw[i]=f;}
      if(a.split>=1){a.split=-1;a.wx+=.03;a.hold=.15;}return a;}
    a.wx*=Math.exp(-dt*.8);a.air=0;
    for(let i=0;i<2;i++){const sd=i?1:-1;set(a.tgt[i],x+T0[0]*sd*w+T1[0]*(i?-ahead:ahead)*.5,0,z+T0[2]*sd*w+T1[2]*(i?-ahead:ahead)*.5);}
    let stepping=-1;for(let i=0;i<2;i++)if(!a.st[i])stepping=i;
    if(stepping<0){a.hold=Math.max(0,a.hold-dt);
      if(a.hold===0){let best=-1,be=0;
        for(let i=0;i<2;i++){const d=Math.hypot(a.tgt[i][0]-a.foot[i][0],a.tgt[i][2]-a.foot[i][2]),ye=Math.abs(wrap(f-a.yaw[i])),e=d/thr+ye/yawThr;if(e>1&&e>be){be=e;best=i;}}
        if(best>=0){stepping=best;a.st[best]=0;a.u[best]=0;cp(a.from[best],a.foot[best]);}}}
    for(let i=0;i<2;i++){
      if(i===stepping){a.u[i]=Math.min(1,a.u[i]+dt/dur);const uu=a.u[i];mix(a.foot[i],a.from[i],a.tgt[i],trav(uu));a.foot[i][1]=Math.sin(Math.PI*uu)*lift*2;a.yaw[i]+=wrap(f-a.yaw[i])*Math.min(1,dt/dur*2);
        if(a.u[i]>=1){cp(a.foot[i],a.tgt[i]);a.st[i]=1;a.u[i]=0;a.yaw[i]=f;a.hold=.1;}}
      else{a.foot[i][1]=0;const e=wrap(f-a.yaw[i]);a.yaw[i]+=clamp(e,-4*dt,4*dt);}} // the pivot foot turns on the spot
    return a;}

  /* --- 2-bone IK with pole hysteresis: the bend direction is a state that turns toward the pole at a limited rate and
     holds when the pole passes close to the limb's axis, so a knee or elbow never flips. Without dt it snaps (first frame). --- */
  const ikState=()=>({d:F(3),ok:0});
  function ikS(st,o,a,t,l1,l2,pole,dt,rate=14){
    sub(T0,t,a);const L=len(T0)||1e-6,D=Math.min(L,(l1+l2)*.9995);sc(T1,T0,1/L); // T1 = axis
    const x=(l1*l1-l2*l2+D*D)/(2*D),h=Math.sqrt(Math.max(0,l1*l1-x*x));
    madd(T2,pole,T1,-dot(pole,T1));const pl=len(T2);
    if(st.ok&&dt!==undefined){madd(T3,st.d,T1,-dot(st.d,T1));if(len(T3)<1e-6)perp(T3,T1,st.d);norm(T3,T3); // last bend, in the new plane
      if(pl>.02){norm(T2,T2);cross(T4,T3,T2);const ang=Math.atan2(dot(T4,T1),dot(T3,T2)),m=rate*dt;rot(T3,T3,T1,clamp(ang,-m,m));}
      cp(st.d,T3);}
    else{if(pl>1e-6)norm(st.d,T2);else perp(st.d,T1,st.d);st.ok=1;}
    return set(o,a[0]+T1[0]*x+st.d[0]*h,a[1]+T1[1]*x+st.d[1]*h,a[2]+T1[2]*x+st.d[2]*h);}
  // plain 2-bone IK (no state); joint on the pole's side, reach capped so bones never stretch
  function ik(o,a,t,l1,l2,pole){
    sub(T0,t,a);const L=len(T0)||1e-6,D=Math.min(L,(l1+l2)*.9995);sc(T1,T0,1/L);
    const x=(l1*l1-l2*l2+D*D)/(2*D),h=Math.sqrt(Math.max(0,l1*l1-x*x));madd(T2,pole,T1,-dot(pole,T1));
    if(len(T2)<1e-6)perp(T2,T1);else norm(T2,T2);
    return set(o,a[0]+T1[0]*x+T2[0]*h,a[1]+T1[1]*x+T2[1]*h,a[2]+T1[2]*x+T2[2]*h);}

  /* --- ground --- */
  // lifts p so a sphere of radius r at it clears the ground y0; returns the lift
  function clampGround(p,r=0,y0=0){const d=y0+r-p[1];if(d>0){p[1]+=d;return d;}return 0;}
  // the lift that would clear every point (radius r each) at once: for a lying body, raise the whole thing by this
  function groundLift(pts,r=0,y0=0){let d=0;for(let i=0;i<pts.length;i++){const q=y0+r-pts[i][1];if(q>d)d=q;}return d;}

  /* --- head look: yaw/pitch relative to the body, limited, spring-smoothed. out = [fwd x,y,z, up x,y,z]. --- */
  const lookState=()=>({yaw:springState(),pitch:springState(),ok:0});
  const LOOK={yaw:1.2,up:.7,down:.9};
  function lookAt(st,o,eye,target,bodyYaw,dt,w=18,lim=LOOK){
    const dx=target[0]-eye[0],dy=target[1]-eye[1],dz=target[2]-eye[2],hz=Math.hypot(dx,dz);
    const yaw=hz>1e-6?clamp(wrap(Math.atan2(dx,dz)-bodyYaw),-lim.yaw,lim.yaw):0,pitch=clamp(Math.atan2(dy,hz),-lim.down,lim.up);
    if(!st.ok||dt===undefined){st.yaw.x=yaw;st.yaw.v=0;st.pitch.x=pitch;st.pitch.v=0;st.ok=1;}
    else{springA(st.yaw,yaw,dt,w);spring(st.pitch,pitch,dt,w);}
    const y=bodyYaw+st.yaw.x,p=st.pitch.x,cy=Math.cos(p),sy=Math.sin(p);
    o[0]=Math.sin(y)*cy;o[1]=sy;o[2]=Math.cos(y)*cy;o[3]=-Math.sin(y)*sy;o[4]=cy;o[5]=-Math.cos(y)*sy;return o;}

  /* --- capsules --- */
  // closest point on segment a-b to p (writes o), returns its parameter
  function segClosest(o,p,a,b){sub(T0,b,a);const l2=dot(T0,T0);let t=l2>1e-12?clamp((dot(p,T0)-dot(a,T0))/l2,0,1):0;return madd(o,a,T0,t),t;}
  // closest distance between segments (Ericson 5.1.9)
  function segDist(p0,p1,q0,q1){
    sub(T0,p1,p0);sub(T1,q1,q0);sub(T2,p0,q0);const a=dot(T0,T0),e=dot(T1,T1),f=dot(T1,T2);let s=0,t=0;
    if(a<=1e-12&&e<=1e-12){cp(T3,p0);cp(T4,q0);return len(T2);}
    if(a<=1e-12)t=clamp(f/e,0,1);
    else{const c=dot(T0,T2);if(e<=1e-12)s=clamp(-c/a,0,1);
      else{const b=dot(T0,T1),den=a*e-b*b;s=den!==0?clamp((b*f-c*e)/den,0,1):0;t=(b*s+f)/e;
        if(t<0){t=0;s=clamp(-c/a,0,1);}else if(t>1){t=1;s=clamp((b-c)/a,0,1);}}}
    madd(T3,p0,T0,s);madd(T4,q0,T1,t);return dist(T3,T4);}
  // pushes p (radius r) out of the capsule a-b (radius R) along the normal from the axis (dir when it sits on the axis); returns the depth
  function pushOut(p,r,a,b,R,dir){segClosest(T3,p,a,b);sub(T4,p,T3);const d=len(T4),pen=R+r-d;if(pen<=0)return 0;
    if(d>1e-6)sc(T4,T4,1/d);else if(dir)norm(T4,dir);else set(T4,0,1,0);madd(p,p,T4,pen);return pen;}
  // moves segment a0-a1 (radius ra) out of capsule b0-b1 (radius rb) by the share w of their penetration; returns the depth
  function capPush(a0,a1,ra,b0,b1,rb,w=1,dir){
    const d=segDist(a0,a1,b0,b1),pen=ra+rb-d;if(pen<=0)return 0; // T3/T4 hold the closest points
    sub(T0,T3,T4);if(len(T0)>1e-6)norm(T0,T0);else if(dir)norm(T0,dir);else set(T0,0,1,0);
    madd(a0,a0,T0,pen*w);madd(a1,a1,T0,pen*w);return pen;}
  // resolves a body of capsules {a,b,r,w,g}: each pair is pushed apart by its mobility w (0 = fixed, e.g. the torso),
  // capsules sharing a group g (one limb's segments, which meet at a joint) are not tested; Gauss-Seidel over iters passes.
  // Returns the deepest penetration left after the last pass (0 when clear); the caller skips it where contact must win and
  // re-solves joints (IK) from the moved end points afterwards.
  function resolve(caps,iters=4,dir){let worst=0;
    for(let k=0;k<iters;k++){worst=0;
      for(let i=0;i<caps.length;i++)for(let j=i+1;j<caps.length;j++){const A=caps[i],B=caps[j];
        if(A.g!==undefined&&A.g===B.g)continue;const ws=A.w+B.w;if(ws<=0)continue;
        const pen=capPush(A.a,A.b,A.r,B.a,B.b,B.r,A.w/ws,dir);if(pen>0&&B.w>0){capPush(B.a,B.b,B.r,A.a,A.b,A.r,1,dir);} // B takes what is left
        if(pen>worst)worst=pen;}}
    return worst;}

  /* --- two hands to a ball: side by side across the ball's line (left hand on the left), hand width + 1 cm apart, palms
     to the ball and its approach, fingers up above the chest, cupped (palms up) below the waist; the pair is pushed clear of
     the torso capsule as one, so the gap holds; far-arm rule: when only the near hand reaches, it takes the ball alone and
     the far hand stretches toward it on the same line. Pure: writes o = hands2Out(). --- */
  function hands2Out(){return {hd:[F(3),F(3)],pn:[F(3),F(3)],fd:[F(3),F(3)],two:1,sep:0,e:F(3),m:F(3)};}
  const H0=F(3),H1=F(3),H2=F(3),H3=F(3),HB=F(3);
  // B ball, bv its velocity (or null), ch chest (shoulder centre), hip hip centre, fwd/rt the torso's forward and right, sp shoulders
  // [left,right], reach shoulder-to-hand centre, hw hand width, hr hand radius (clearance), tr torso radius
  function hands2(o,B,bv,ch,hip,fwd,rt,sp,reach,hw=.1,hr=.05,tr=.17){
    const e=o.e,m=o.m,sep=hw+.01;o.sep=sep;
    sub(H0,B,ch);cross(e,UP,H0);if(len(e)<.05*Math.max(len(H0),1e-6)||len(e)<1e-6)cp(e,rt);norm(e,e);if(dot(e,rt)<0)sc(e,e,-1);
    if(bv&&len(bv)>1e-6){norm(HB,bv);madd(m,B,HB,.03);}else{norm(HB,H0);sc(HB,HB,-1);madd(m,B,HB,-.03);} // HB = the approach, pointing at the hands
    for(let i=0;i<2;i++)madd(o.hd[i],m,e,i?sep/2:-sep/2);
    // reach: the far hand (further from its shoulder) stretches toward its spot; the near hand keeps the ball
    o.two=1;
    for(let k=0;k<3;k++){let moved=0;
      for(let i=0;i<2;i++){sub(H1,o.hd[i],sp[i]);const d=len(H1);if(d>reach){o.two=0;madd(o.hd[i],sp[i],H1,reach/d);moved=1;}}
      if(!moved)break;const g=dist(o.hd[0],o.hd[1]);if(g<sep){sub(H1,o.hd[1],o.hd[0]);if(len(H1)<1e-6)cp(H1,e);norm(H1,H1);
        const n=dist(o.hd[0],sp[0])<dist(o.hd[1],sp[1])?1:0;madd(o.hd[n],o.hd[n],H1,(sep-g)*(n?1:-1));}}
    {const g=dist(o.hd[0],o.hd[1]);if(g<sep){sub(H1,o.hd[1],o.hd[0]);if(len(H1)<1e-6)cp(H1,e);norm(H1,H1);madd(o.hd[0],o.hd[0],H1,-(sep-g)/2);madd(o.hd[1],o.hd[1],H1,(sep-g)/2);}}
    // torso clearance: shift the pair together along the midpoint's normal from the torso axis (forward when it sits on it)
    const R=tr+hr;
    for(let k=0;k<40;k++){let pen=0,w=-1;
      for(let i=0;i<2;i++){segClosest(H2,o.hd[i],hip,ch);const d=dist(o.hd[i],H2);if(R-d>pen){pen=R-d;w=i;}}
      if(pen<=1e-7)break;
      mix(H3,o.hd[0],o.hd[1],.5);segClosest(H2,H3,hip,ch);sub(H1,H3,H2);H1[1]=0;
      if(len(H1)<.02)cp(H1,fwd);norm(H1,H1);
      for(let i=0;i<2;i++)madd(o.hd[i],o.hd[i],H1,pen+1e-4);}
    for(let i=0;i<2;i++)clampGround(o.hd[i],hr);
    // palms: toward the ball and its approach; a low ball dropping in is cupped (palms turned up); fingers point up above
    // the chest and down below the waist (forward when cupped), or along the arm when the palm already faces that way
    const hi=smooth((B[1]-hip[1]-.05)/Math.max(.05,ch[1]-hip[1]-.1)),lo=1-hi,cup=lo*clamp(-HB[1]*2.5,0,1);
    for(let i=0;i<2;i++){const pn=o.pn[i],fd=o.fd[i];sub(H1,B,o.hd[i]);norm(H1,H1);sc(H1,H1,.5);madd(pn,H1,HB,-.85);norm(pn,pn);
      if(len(pn)<1e-6)cp(pn,fwd);mix(pn,pn,UP,.75*cup);norm(pn,pn);
      set(H1,fwd[0]*cup*.8,hi-lo*(1-cup*.6),fwd[2]*cup*.8);madd(fd,H1,pn,-dot(H1,pn));
      if(len(fd)<.3){sub(H1,o.hd[i],sp[i]);madd(fd,H1,pn,-dot(H1,pn));}if(len(fd)<1e-4)cross(fd,e,pn);norm(fd,fd);}
    return o;}

  return {clamp,lerp,wrap,smooth,trav,easeOut,easeIn,set,cp,add,sub,sc,madd,mix,dot,len,dist,cross,norm,perp,rot,fwdOf,rightOf,yawOf,UP,
    springState,springVState,spring,springA,springV,slerp,bez,bez3,arc,arcTan,
    GM,GP,gaitState,gaitReset,gaitStep,gaitParams,anchorsState,anchorsReset,anchorsStep,anchorsSplit,
    ikState,ikS,ik,clampGround,groundLift,lookState,lookAt,LOOK,segClosest,segDist,pushOut,capPush,resolve,hands2Out,hands2};
})();
MO;
