/* ---------- 3D scene ---------- */
const glc=$('#gl'),skc=$('#sky'),sk=skc.getContext('2d');
const glOK=E3.init(glc);
const GEO=glOK?{cyl:E3.geom(GB.cyl(12)),sph:E3.geom(GB.sph(10,16)),disk:E3.geom(GB.disk(48)),plane:E3.geom(GB.plane()),
  ann:E3.geom(GB.ann(0.66,1,48,false))}:null;
let R3=null,curPlanet='earth',yawShift=0;
const LOOK3D={
  earth:{sky:'#d6e8f7',gr:'#55804a',k:1,fog:['#cfe5f2',150,700]},
  moon:{sky:'#3b4252',gr:'#262626',k:1.1,fog:null},
  mercury:{sky:'#4d3c30',gr:'#2a211b',k:1.1,fog:null},
  venus:{sky:'#f3d18a',gr:'#7a5a22',k:.75,fog:['#e9c47c',22,150]},
  mars:{sky:'#ebbd92',gr:'#7c3b1f',k:1,fog:['#dba67c',60,300]},
  jupiter:{sky:'#efc79a',gr:'#3e3a3a',k:1,fog:['#d99f70',35,210]},
  saturn:{sky:'#efe0bb',gr:'#47544c',k:1,fog:['#e6d9b4',70,330]},
  neptune:{sky:'#86b4ea',gr:'#1d3a52',k:1,fog:['#5f92d2',45,260]}
};
const hex=h=>{const n=parseInt(h.slice(1),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];};
function colA(str){if(str[0]==='#')return [hex(str),1];const m=str.match(/[\d.]+/g).map(Number);return [[m[0]/255,m[1]/255,m[2]/255],m[3]==null?1:m[3]];}
const V3={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sc:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];},
  lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]};
function mB(p,X,Y,Z){return new Float32Array([X[0],X[1],X[2],0,Y[0],Y[1],Y[2],0,Z[0],Z[1],Z[2],0,p[0],p[1],p[2],1]);}
function mT(p,yaw,sx,sy,sz){const c=Math.cos(yaw),s=Math.sin(yaw);return mB(p,[c*sx,0,-s*sx],[0,sy,0],[s*sz,0,c*sz]);}
// a->b frame for geometry centred on the origin along y with nominal length L0; x/z scaled by sx/sz
function mL(a,b,L0,side,sx=1,sz=1){const d=V3.sub(b,a),Ln=Math.hypot(d[0],d[1],d[2])||1e-6,Y=V3.sc(d,1/Ln);
  let X=V3.cross(Y,side||(Math.abs(Y[1])<0.9?[0,1,0]:[1,0,0]));if(Math.hypot(X[0],X[1],X[2])<1e-3)X=V3.cross(Y,[1,0,0]);X=V3.norm(X);
  return mB(V3.lerp(a,b,0.5),V3.sc(X,sx),V3.sc(Y,Ln/L0),V3.sc(V3.cross(X,Y),sz));}
function mSeg(a,b,r,side){const A=Array.isArray(r);return mL(a,b,1,side,A?r[0]:r,A?r[1]:r);}
const I4=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);

function buildStands(){
  const v=VIS,w=1024,h=256,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  g.fillStyle=v.stands;g.fillRect(0,0,w,h);
  g.fillStyle=v.roof;g.fillRect(0,0,w,h*0.1);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(0,h*0.1,w,3);
  for(let y=h*0.14;y<h*0.83;y+=4)for(let x=0;x<w;x+=4){
    if(Math.random()<0.2)continue;g.globalAlpha=0.45+Math.random()*0.55;g.fillStyle=v.crowd[(Math.random()*v.crowd.length)|0];
    g.fillRect(x+Math.random(),y+Math.random(),2.6,3);}
  g.globalAlpha=1;
  const bh=h*0.15;g.fillStyle=v.boards[0];g.fillRect(0,h-bh,w,bh);
  g.font=`900 ${bh*0.72}px "Big Shoulders Display","Arial Narrow",Impact,sans-serif`;g.textBaseline='middle';
  const gap=bh*1.4,tw=v.ads.map(t=>g.measureText(t).width),cyc=tw[0]+tw[1]+2*gap,reps=Math.max(1,Math.floor(w/cyc)),sp=(w-reps*(tw[0]+tw[1]))/(2*reps);
  for(let x=sp/2,i=0;i<reps*2;i++){const t=v.ads[i%2];g.fillStyle=v.boards[1+i%2];g.fillText(t,x,h-bh/2+2);x+=tw[i%2]+sp;}
  return c;
}
function groundCanvas(v,R){
  const n=512,c=document.createElement('canvas');c.width=n;c.height=n;const g=c.getContext('2d');
  g.fillStyle=v.ground[0];g.fillRect(0,0,n,n);
  const per=5/(2*R)*n;g.fillStyle='rgba(255,255,255,'+(v.stripe*1.4)+')';
  for(let y=0,i=0;y<n;y+=per,i++)if(i%2)g.fillRect(0,y,n,per);
  const rg=g.createRadialGradient(n/2,n/2,n*0.2,n/2,n/2,n*0.5);rg.addColorStop(0,'rgba(0,0,0,0)');rg.addColorStop(1,v.ground[1]+'99');
  g.fillStyle=rg;g.fillRect(0,0,n,n);
  for(let i=0;i<2500;i++){g.fillStyle=Math.random()<0.5?'rgba(0,0,0,.05)':'rgba(255,255,255,.04)';g.fillRect(Math.random()*n,Math.random()*n,2,2);}
  return c;
}
function build3D(){
  if(!glOK)return;
  const v=VIS,R=BOUNDARY,r27=27*R/65;
  R3={R,groundTex:E3.tex(groundCanvas(v,R+7),false),standTex:E3.tex(buildStands(),true),
    rope:E3.geom(GB.ann(R-0.13,R+0.13,160,false)),ring:E3.geom(GB.ann(r27-0.07,r27+0.07,120,true)),
    stand:E3.geom(GB.bowl(R+7,R+7+v.standsH*1.15,v.standsH,128,-9))};
}
function lightFor(){
  const lk=LOOK3D[curPlanet]||LOOK3D.earth,sky=hex(lk.sky),dir=V3.norm([-0.35,0.85,-0.4]);
  const lum=0.3*sky[0]+0.59*sky[1]+0.11*sky[2],si=clamp((1.02-0.72*lum)/dir[1],0.25,1.6)*lk.k;
  const fo=wideCam()?Math.max(0,Math.hypot(cam.x,cam.z)+CAM_Z):0;
  return {dir,sun:[si,si*0.97,si*0.92],sky:V3.sc(sky,0.72),gr:V3.sc(hex(lk.gr),0.72),fogC:lk.fog?hex(lk.fog[0]):[0,0,0],fog:lk.fog?[lk.fog[1]+fo,lk.fog[2]+fo]:[0,0],eye:[cam.x,cam.y,cam.z]};
}
function viewProj(){
  const tx=-(cam.rx*cam.x+cam.rz*cam.z),tz=-(cam.fx*cam.x+cam.fz*cam.z);
  const view=new Float32Array([cam.rx,0,cam.fx,0, 0,1,0,0, cam.rz,0,cam.fz,0, tx,-cam.y,tz,1]);
  const n=0.15,f=2000,a=(f+n)/(f-n),b=-2*f*n/(f-n);
  const proj=new Float32Array([2*F/W,0,0,0, 0,2*F/H,0,0, 0,1-2*HZ/H,a,1, 0,0,b,0]);
  return {view,proj};
}

/* --- batter pose: feet, hips, spine, shoulders, hands (relative to hip), bat direction. Every change of target
   blends from the pose actually shown, so nothing snaps. Knees and elbows come from 2-bone IK at draw time. --- */
const PN=24,qFX=0,qFZ=1,qFR=2,qBX=3,qBZ=4,qBR=5,qHL=6,qHX=7,qHY=8,qHZ=9,qHR=10,qLX=11,qLZ=12,qSR=13,qAX=14,qAY=15,qAZ=16,qDX=17,qDY=18,qDZ=19,qNOD=20,qFLY=21,qBLY=22,qHDY=23;
const PK=[['heel',qHL],['hr',qHR],['lx',qLX],['lz',qLZ],['sr',qSR],['nod',qNOD],['ffr',qFR],['fbr',qBR],['hd',qHDY]];
function poseSet(p,o){
  const v=(i,a)=>{if(a)for(let k=0;k<a.length;k++)p[i+k]=a[k];};
  v(qFX,o.ff);v(qBX,o.fb);v(qHX,o.hip);v(qAX,o.h);if(o.d)v(qDX,V3.norm(o.d));
  if(o.dh){p[qHX]+=o.dh[0];p[qHY]+=o.dh[1];p[qHZ]+=o.dh[2];}
  for(let j=0;j<PK.length;j++){const x=o[PK[j][0]];if(x!=null)p[PK[j][1]]=x;}
  return p;}
const BP={st:poseSet(new Float32Array(PN),{ff:[-.45,1.36,.15],fb:[-.45,.8,0],hip:[-.43,.88,1.06],hr:.1,lx:.28,lz:.04,sr:.15,h:[.16,.05,.02],d:[.12,-1,.12],nod:.25,hd:.2})};
BP.fw=poseSet(new Float32Array(BP.st),{ff:[-.33,1.8,.55],fb:[-.47,.8,.1],heel:.35,hip:[-.38,.8,1.31],hr:.2,lx:.3,lz:.22,sr:.2,nod:.55});
BP.bk=poseSet(new Float32Array(BP.st),{ff:[-.38,1.18,.1],fb:[-.22,.6,-.1],hip:[-.32,.9,.9],hr:.05,lx:.18,lz:-.06,sr:.1,h:[.15,.08,.02],nod:.2});
BP.tr=poseSet(new Float32Array(BP.st),{ff:[-.43,1.46,.2],fb:[-.38,.76,0],hip:[-.4,.87,1.1]});
const UP={bl:{h:[.1,.5,-.18],d:[-.15,.8,-.6],sr:.08},
  block:{dh:[0,-.03,.04],h:[.2,.08,.2],d:[.1,-1,-.25],sr:.3,lx:.34,lz:.18,nod:1},
  leave:{h:[.02,.82,-.12],d:[-.1,.75,-.65],sr:.15,lx:.2,nod:.35},
  cel:{h:[.04,.88,.02],d:[.1,1,.2],sr:-1.2,hr:-.6,lx:-.05,lz:-.12,nod:-.3,hd:-1.4}};
// per SHOTS entry: i impact, f follow-through, li/lf lofted overrides. Drive follow-throughs are aimed in shotKeys.
const SH3=[
  {i:{h:[.17,.08,.14],d:[.05,-1,-.05],sr:.25,hr:.15,lx:.3,nod:.7},f:{h:[.1,.12,.1],d:[-.55,-.8,-.3],sr:.35,nod:.6},
   li:{h:[.15,.25,.18],d:[.4,-.5,.6]},lf:{h:[.05,.45,.05],d:[-.3,.55,-.75],sr:.3}},
  {i:{dh:[0,-.05,-.02],hr:.9,sr:1.1,h:[.32,.3,.18],d:[.75,-.3,.55],lx:.1,lz:-.08,nod:.3,ffr:.7,heel:0},
   f:{dh:[0,-.05,-.04],hr:1.3,sr:1.75,h:[-.12,.62,.02],d:[-.25,.35,-.9],lx:0,lz:-.12,ffr:.9,fbr:.5},
   li:{h:[.3,.48,.18],d:[.7,.1,.6]},lf:{h:[-.1,.82,0],d:[-.2,.65,-.75],lz:-.18}},
  {i:{h:[.22,.12,.22],d:[0,-1,.18],sr:.4,hr:.25,lz:.15,nod:.7},f:{h:[.05,.25,.22],d:[-.85,-.25,.45],sr:.55,hr:.4,nod:.5},
   lf:{h:[-.02,.6,.2],d:[-.6,.65,.4],lz:0}},
  {i:{dh:[0,-.05,.08],h:[.22,.1,.24],d:[.08,-1,-.05],sr:.45,hr:.25,lx:.28,lz:.3,nod:.9,heel:.4},f:{sr:.6,lz:.25,heel:.7,nod:.5},
   li:{dh:[0,-.02,.04]},lf:{sr:.75,lx:.15,lz:.05}},
  {i:{dh:[0,-.05,.06],h:[.3,.1,.2],d:[.25,-.97,0],sr:.45,hr:.2,lx:.32,lz:.25,nod:.9,heel:.4,ffr:.7},f:{sr:.65,lz:.2,heel:.7,nod:.5},
   li:{dh:[0,-.02,.03]},lf:{sr:.8,lx:.15,lz:.05}},
  {i:{dh:[.06,0,-.08],h:[.5,.28,.06],d:[.75,-.45,-.35],sr:.35,hr:.2,lx:.35,lz:-.05,nod:.5},f:{h:[.48,.18,-.04],d:[.45,-.75,-.45],sr:.45},
   li:{h:[.45,.45,.08],d:[.8,-.1,-.4]},lf:{h:[.35,.8,0],d:[.55,.7,-.4],lz:-.12}},
  {i:{dh:[0,-.06,-.05],h:[.3,.02,-.02],d:[.4,-.88,-.3],sr:.2,lx:.4,nod:.8},f:{h:[.32,.02,-.06],d:[.55,-.7,-.45],sr:.25},
   li:{h:[.22,.32,.05],d:[.3,-.2,-.9]},lf:{h:[.2,.45,0],d:[.3,.45,-.85]}}];
const PB={key:'',sw:false,t0:0,dur:.4,fd:.3,from:new Float32Array(PN),cur:new Float32Array(BP.st),tg:new Float32Array(PN),tmp:new Float32Array(PN),out:new Float32Array(PN),a:null,b:null};
const smooth=u=>u*u*(3-2*u);
function batAngleNow(){return new Float32Array(PB.cur);}
// trigger step: weights by the length met after footwork (full is high for short balls), toward the line of the ball relative
// to the batter, done well before contact. BP.fw/bk/tr feet match FOOT in logic.js, which places the pads for LBW.
function footPose(out,b,p,fa){
  out.set(BP.st);if(!b)return out;
  fa=fa||footAt(b,S.bpos);const [wf,wb,wt]=strideW(fa.full),e=smooth(p);
  for(let i=0;i<PN;i++)out[i]+=e*(wf*(BP.fw[i]-BP.st[i])+wb*(BP.bk[i]-BP.st[i])+wt*(BP.tr[i]-BP.st[i]));
  out[qFX]+=e*(wf*clamp(fa.xc*.45,-.12,.25)+wt*clamp(fa.xc*.3,-.1,.15));out[qBX]+=e*wb*clamp(fa.xc*.3,-.1,.15);
  const lift=Math.sin(Math.PI*p);out[qFLY]+=lift*(.09*wf+.03*wt);out[qBLY]+=lift*.06*wb;
  return out;}
function footProg(tI,bt){const te=Math.max(.12,Math.min(tI*.6,tI-.2));return clamp((bt-.04)/(te-.04),0,1);}
// footwork gait: a chasse, one foot at a time stepping to just ahead of where the body is heading, so planted feet never slide
const FT={f:[0,0],b:[0,0],mv:-1,last:1,go:false,u:0,a:[0,0],lift:0,t:0,px:0,pz:0};
function feetTick(){
  const dt=clamp(clock-FT.t,0,.1),p=S.bpos;FT.t=clock;
  const lx=dt?clamp((p.x-FT.px)/dt*.08,-.25,.25):0,lz=dt?clamp((p.z-FT.pz)/dt*.08,-.25,.25):0,tx=p.x+lx,tz=p.z+lz;FT.px=p.x;FT.pz=p.z;
  if(FT.mv<0){
    const nf=Math.hypot(tx-FT.f[0],tz-FT.f[1])>.06,nb=Math.hypot(tx-FT.b[0],tz-FT.b[1])>.06;
    const k=nf&&nb?(FT.go?1-FT.last:lz<0?1:0):nf?0:nb?1:-1;
    FT.go=k>=0;if(FT.go){FT.mv=k;FT.u=0;FT.a=(k?FT.b:FT.f).slice();}
  }
  FT.lift=0;
  if(FT.mv>=0){
    FT.u=Math.min(1,FT.u+dt/.14);const F=FT.mv?FT.b:FT.f,e=smooth(FT.u);
    F[0]=lerp(FT.a[0],tx,e);F[1]=lerp(FT.a[1],tz,e);FT.lift=Math.sin(Math.PI*FT.u)*.07;
    if(FT.u>=1){FT.last=FT.mv;FT.mv=-1;}
  }
}
function idlePose(p,a){
  if(a<=0)return;const w=clock,tap=Math.pow(Math.max(0,Math.sin(w*1.7)),8)*a;
  p[qHY]+=Math.sin(w*2.1)*.006*a;p[qLX]+=Math.sin(w*2.1+.6)*.015*a;p[qHZ]+=Math.sin(w*.75)*.018*a;p[qHX]+=Math.sin(w*.75)*.005*a;
  p[qAY]+=tap*.04;p[qDZ]-=tap*.1;}
function shotKeys(b,aim){
  const sw=S.swing||{},L=!!sw.lofted,sp=SH3[SHOTS.indexOf(shotFor(aim))]||SH3[3],a=footPose(new Float32Array(PN),b,1);
  poseSet(a,sp.i);if(L&&sp.li)poseSet(a,sp.li);
  const f=poseSet(new Float32Array(a),sp.f);if(L&&sp.lf)poseSet(f,sp.lf);
  if(sp===SH3[3]||sp===SH3[4]){const s=Math.sin(aim*D2R),c=Math.cos(aim*D2R);poseSet(f,{h:[.1+.25*s,L?.85:.78,.1+.15*c],d:[.3*s-(L?.25:.35),L?.95:.7,L?-.35:-.55]});}
  a[qFLY]=a[qBLY]=f[qFLY]=f[qBLY]=0;
  const k=.55+.45*(sw.power||.7);for(let j=0;j<PN;j++)f[j]=a[j]+(f[j]-a[j])*k;
  PB.a=a;PB.b=f;PB.fd=L?.4:.3;}
function poseTick(){
  const B=S.bat,b=S.ball,ph=S.phase,cel=B.mode==='celebrate',fly=!cel&&!!b&&(ph==='flight'||ph==='result'),bt=fly?clock-b.start:0,tg=PB.tg;
  const fa=fly?footAt(b,S.bpos):null;
  footPose(tg,fly?b:null,fly?footProg(fa.t,bt):0,fa);
  let key='st',dur=.4,now=clock,sw=false;
  if(cel){now=performance.now()/1000;key='cel';dur=.45;poseSet(tg,UP.cel);tg[qAY]+=Math.sin(now*5)*.025;}
  else if(fly&&B.mode==='swing'){key='sw'+B.t0;sw=true;}
  else if(fly&&B.mode==='block'){key='bk'+B.t0;dur=.12;poseSet(tg,UP.block);}
  else if(B.mode==='backlift'){key='bl'+B.t0;dur=.18;
    const k=S.aim?.55+.45*clamp(Math.hypot(S.aim.x-S.aim.x0,S.aim.y-S.aim.y0)/dragMax(),0,1):1;
    idlePose(tg,ph==='ready'||ph==='break'?1:0);PB.tmp.set(tg);poseSet(tg,UP.bl);for(let j=qAX;j<=qDZ;j++)tg[j]=PB.tmp[j]+(tg[j]-PB.tmp[j])*k;}
  else if(fly&&!S.swing&&(ph==='result'||bt>fa.t+.03)){key='lv';dur=.28;poseSet(tg,UP.leave);}
  else idlePose(tg,ph==='ready'||ph==='break'?1:ph==='runup'?clamp(1-S.t/(S.runupDur*.6),0,1):0);
  if(key!==PB.key){PB.from.set(PB.cur);PB.key=key;PB.sw=sw;PB.dur=dur;PB.t0=sw?B.t0:now;if(sw)shotKeys(b,B.aim);}
  const c=PB.cur,f=PB.from,mix=(x,y,e)=>{for(let j=0;j<PN;j++)c[j]=x[j]+(y[j]-x[j])*e;};
  if(sw){const t=Math.max(0,clock-PB.t0);
    if(t<SWING_DELAY)mix(f,PB.a,(t/SWING_DELAY)*(t/SWING_DELAY));
    else{const u=clamp((t-SWING_DELAY)/PB.fd,0,1);mix(PB.a,PB.b,1-(1-u)*(1-u));}}
  else{const u=clamp((now-PB.t0)/PB.dur,0,1),bump=Math.sin(Math.PI*u);mix(f,tg,smooth(u));
    c[qFLY]+=bump*Math.min(.08,.3*Math.hypot(tg[qFX]-f[qFX],tg[qFZ]-f[qFZ]));c[qBLY]+=bump*Math.min(.08,.3*Math.hypot(tg[qBX]-f[qBX],tg[qBZ]-f[qBZ]));}
  feetTick();
  const o=PB.out,p=S.bpos,F=FT;o.set(c);
  o[qHX]+=.5*p.x+.25*(F.f[0]+F.b[0]);o[qHZ]+=.5*p.z+.25*(F.f[1]+F.b[1]);o[qHY]-=F.lift*.2;
  o[qFX]+=F.f[0];o[qFZ]+=F.f[1];o[qBX]+=F.b[0];o[qBZ]+=F.b[1];if(F.mv>=0)o[F.mv?qBLY:qFLY]+=F.lift;
  return o;}

/* --- people: smooth procedural parts, built once. Limb parts are centred on the origin along y, between their joint centres --- */
const SKIN=[0.69,0.48,0.33],PAD=[.95,.95,.93],GLOVE=[.96,.96,.96],GRIP=[.2,.15,.1],BLADE=[.89,.77,.56],GRILLE=[.34,.36,.4],H2=Math.PI/2;
const lin=(n,a,b)=>Array.from({length:n+1},(_,i)=>a+(b-a)*i/n);
function crv(K,y){let i=0;while(i<K.length-2&&y>K[i+1][0])i++;
  const a=K[Math.max(0,i-1)],b=K[i],c=K[i+1],d=K[Math.min(K.length-1,i+2)],t=clamp((y-b[0])/(c[0]-b[0]),0,1),t2=t*t,t3=t2*t;
  return b.map((_,j)=>.5*(2*b[j]+(c[j]-a[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t2+(3*b[j]-a[j]-3*c[j]+d[j])*t3));}
// tapered capsule: spheres r1 (y=-L/2) and r2 (y=L/2) joined by their tangent cone, so joints blend without steps
function capG(r1,r2,L,seg,n){const f=Math.asin(clamp((r1-r2)/L,-1,1));
  return GB.surf([...lin(n,0,.4),...lin(n,.6,1)],seg,(v,a)=>{const t=clamp((v-.4)/.2,0,1),R=r1+(r2-r1)*t,l=v<.4?-H2+(f+H2)*v/.4:v>.6?f+(H2-f)*(v-.6)/.4:f,c=Math.cos(l);
    return [R*c*Math.cos(a),L*(t-.5)+R*Math.sin(l),R*c*Math.sin(a)];});}
function ellG(o,r,seg,n,rx=0,l0=-H2){const cr=Math.cos(rx),sr=Math.sin(rx);
  return GB.surf(lin(n,0,1),seg,(v,a)=>{const l=l0+(H2-l0)*v,x=r[0]*Math.cos(l)*Math.cos(a),y=r[1]*Math.sin(l),z=r[2]*Math.cos(l)*Math.sin(a);
    return [o[0]+x,o[1]+y*cr-z*sr,o[2]+y*sr+z*cr];});}
function arcG(o,R,A,B,t0,t1,r,n){const C=[A[1]*B[2]-A[2]*B[1],A[2]*B[0]-A[0]*B[2],A[0]*B[1]-A[1]*B[0]];
  return GB.surf(lin(n,0,1),6,(v,a)=>{const t=t0+(t1-t0)*v,q=R+r*Math.cos(a),w=r*Math.sin(a);
    return [0,1,2].map(j=>o[j]+(Math.cos(t)*A[j]+Math.sin(t)*B[j])*q+C[j]*w);});}
// x = chest, y = spine from the hip, z = shoulder line
const TORSO=[[-.09,0,0],[-.08,.095,.08],[-.05,.135,.105],[.05,.142,.106],[.2,.165,.118],[.33,.188,.128],[.43,.2,.122],[.5,.188,.108],[.55,.135,.085],[.585,.075,.06],[.6,0,0]];
const torsoG=(seg,n,K=TORSO)=>GB.surf(lin(n,0,1),seg,(v,a)=>{const y=-.09+.69*v,[,w,d]=crv(K,y),c=Math.cos(a),s=Math.sin(a),p=x=>Math.sign(x)*Math.pow(Math.abs(x),.8);
  return [d*p(c),y,w*p(s)];});
// x lateral, z toward the toe, sole at y=0
const shoeG=(seg,n)=>GB.surf(lin(n,0,1),seg,(v,a)=>{const l=(v-.5)*Math.PI,c=Math.cos(l),s=Math.sin(a),f=Math.max(0,s);
  return [.05*(1-.15*f)*c*Math.cos(a),.02+Math.sin(l)*(l<0?.02:.07-.03*f),(s>0?.16:.085)*s*c];});
// shin pad from ankle (y=-.215) to knee (y=.215): ridged front (+z), knee roll, rounded ends
const PADK=[[-.27,.055,.062],[-.2,.066,.08],[0,.074,.086],[.17,.078,.09],[.215,.084,.1],[.26,.08,.094],[.3,.074,.082],[.335,.066,.07]];
const padG=(seg,n)=>GB.surf(lin(n,0,1),seg,(v,a)=>{const y=-.27+.605*v,[,hw,fz]=crv(PADK,y),e=Math.sqrt(clamp((y+.27)/.045,0,1)*clamp((.335-y)/.05,0,1)),c=Math.cos(a),s=Math.sin(a),
  f=Math.max(0,s),rid=f*(.008*(.5-.5*Math.cos(a*14))+.011*Math.exp(-(((y-.225)/.022)**2)));
  return [e*(hw+rid)*c,y,e*(s>0?fz+rid:.062)*s];});
// blade from shoulder (y=-.29) to toe: flat face (+z), spine on the back, rounded edges and toe
const bladeG=(seg,n)=>GB.surf(lin(n,0,1),seg,(v,a)=>{const c=Math.cos(a),s=Math.sin(a),p=x=>Math.sign(x)*Math.pow(Math.abs(x),.35),
  e=Math.sqrt(clamp((1-v)/.03,0,1)),wf=v<.07?.3+.7*Math.sqrt(v/.07):1,sp=.02+.03*Math.pow(Math.sin(Math.PI*clamp((v-.05)/.9,0,1)),.7),x=p(c);
  return [.054*wf*x*e,.58*(v-.5),e*wf*(s>0?.012*p(s):p(s)*(.016+(sp-.016)*(1-x*x)))];});
function canvasTex(w,h,f){const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);return E3.tex(c,true);}
const BG=glOK&&(()=>{const g=x=>E3.geom(x),k=KIT.you,
  bar=(y,R,sp)=>arcG([0,y,0],R,[1,0,0],[0,0,1],H2-sp,H2+sp,.0055,14),vb=(th)=>arcG([0,-.03,0],.162,[0,1,0],[Math.sin(th),0,Math.cos(th)],1.2,2.25,.0055,10);
  return {thigh:g(capG(.088,.062,.43,20,6)),pad:g(padG(70,24)),uarm:g(capG(.054,.044,.31,18,6)),sleeve:g(capG(.066,.06,.15,18,5)),farm:g(capG(.044,.034,.3,18,6)),
    glove:g(capG(.042,.056,.09,18,6)),neck:g(capG(.056,.05,.17,16,5)),handle:g(capG(.017,.017,.36,12,3)),shoe:g(shoeG(24,12)),blade:g(bladeG(24,32)),
    pelvis:g(GB.surf(lin(12,0,1),28,(v,a)=>{const y=-.15+.26*v,[,w,d]=crv([[-.15,0,0],[-.14,.08,.07],[-.11,.145,.125],[-.04,.168,.145],[.04,.16,.14],[.1,.15,.13],[.11,0,0]],y);return [d*Math.cos(a),y,w*Math.sin(a)];})),
    torso:g(torsoG(32,24)),head:g(GB.join(ellG([0,-.025,.005],[.098,.118,.108],24,14),ellG([0,-.035,.108],[.016,.026,.02],8,5))),
    helmet:g(GB.join(GB.surf(lin(12,0,1),36,(v,a)=>{const s=Math.sin(a),lb=-.8+smooth(clamp((s+.35)/1.1,0,1)),l=lb+(H2-lb)*v,c=Math.cos(l);
        return [.132*c*Math.cos(a),.015+.14*Math.sin(l),-.005+(s>0?.142:.152)*c*s];}),
      ellG([0,.04,.09],[.128,.012,.1],24,6,.18),ellG([0,-.105,-.118],[.082,.032,.024],16,5,-.5),ellG([.128,-.005,.072],[.018,.028,.028],10,5),ellG([-.128,-.005,.072],[.018,.028,.028],10,5))),
    grille:g(GB.join(bar(-.005,.158,1),bar(-.055,.156,.95),bar(-.1,.142,.85),vb(0),vb(.42),vb(-.42))),
    shirtTex:canvasTex(64,128,(x,w,h)=>{x.fillStyle=k.shirt;x.fillRect(0,0,w,h);x.fillStyle=k.trim;x.fillRect(0,h*.755,w,2);
      for(const o of [0,w]){x.beginPath();x.moveTo(o-9,h);x.lineTo(o,h*.87);x.lineTo(o+9,h);x.lineTo(o+5,h);x.lineTo(o,h*.91);x.lineTo(o-5,h);x.fill();}
      x.fillRect(0,h*.958,w,h*.025);x.fillStyle=k.shirt;x.fillRect(0,h*.985,w,h*.015);}),
    padTex:canvasTex(128,8,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#c9cbc8';for(let i=1;i<7;i++)x.fillRect(i/14*w-1,0,2,h);}),
    shoeTex:canvasTex(4,64,(x,w,h)=>{x.fillStyle='#f2f2f2';x.fillRect(0,0,w,h);x.fillStyle='#8a8f96';x.fillRect(0,0,w,h*.46);})};})();
const PG=glOK&&(()=>{const g=x=>E3.geom(x);
  return {thigh:g(capG(.078,.066,.465,12,3)),shin:g(capG(.064,.05,.465,12,3)),arm:g(capG(.052,.04,.6,12,3)),shoe:g(shoeG(12,6)),torso:g(torsoG(14,10,[[-.09,0,0],[-.08,.12,.09],[-.04,.165,.11],...TORSO.slice(3)])),
    head:g(GB.join(ellG([0,.06,0],[.046,.085,.046],8,4),ellG([0,.18,0],[.098,.115,.105],14,8),ellG([0,.165,.1],[.016,.024,.02],6,3))),
    cap:g(GB.join(ellG([0,.2,-.005],[.108,.1,.114],14,5,0,-.15),ellG([0,.205,.105],[.085,.009,.075],12,3,.2)))};})();
function limb(a,b,r,c){E3.draw(GEO.cyl,mSeg(a,b,r),c);}
function ball3(p,r,c,o){E3.draw(GEO.sph,mT(p,0,r,r,r),c,o);}
function person3D(x,z,face,o){
  const c=Math.cos(face),s=Math.sin(face),W3=(l)=>[x+l[0]*c+l[2]*s,l[1],z-l[0]*s+l[2]*c],R=[c,0,-s],U=[0,1,0],Fw=[s,0,c];
  const ra=o.running?1:0,rn=o.run||0,cr=o.crouch||0;
  const shirt=hex(o.shirt),pants=hex(o.pants),skin=o.skin?hex(o.skin):SKIN;
  const hy=0.92-cr*0.12;
  const fL=[-0.12,Math.max(0,Math.cos(rn))*0.12*ra,Math.sin(rn)*0.34*ra],fR=[0.12,Math.max(0,-Math.cos(rn))*0.12*ra,-Math.sin(rn)*0.34*ra];
  const hL=[-0.1,hy,0],hR=[0.1,hy,0];
  const kL=[(hL[0]+fL[0])/2,(hL[1]+fL[1])/2,(hL[2]+fL[2])/2+0.07+cr*0.1],kR=[(hR[0]+fR[0])/2,(hR[1]+fR[1])/2,(hR[2]+fR[2])/2+0.07+cr*0.1];
  for(const [h,k,f] of [[hL,kL,fL],[hR,kR,fR]]){E3.draw(PG.thigh,mL(W3(h),W3(k),.465),pants);E3.draw(PG.shin,mL(W3(k),W3(f),.465),pants);
    E3.draw(PG.shoe,mB(W3(f),R,U,Fw),[0.16,0.16,0.18]);}
  const lean=ra*0.12+cr*0.12,top=[0,hy+0.54,lean];
  E3.draw(PG.torso,mB(W3([0,hy,0]),Fw,V3.sc(V3.sub(W3(top),W3([0,hy,0])),1/.54),R),shirt);
  const sL=[-0.2,top[1]-0.04,lean],sR=[0.2,top[1]-0.04,lean];
  let aL=[-0.25,hy-0.08,-Math.sin(rn)*0.3*ra+cr*0.3],aR=[0.25,hy-0.08,Math.sin(rn)*0.3*ra+cr*0.3];
  if(o.arm!=null){const th=o.arm;aR=[sR[0],sR[1]-Math.cos(th)*0.72,sR[2]-Math.sin(th)*0.72];aL=[-0.25,top[1]+0.1,0.45];}
  E3.draw(PG.arm,mL(W3(sL),W3(aL),.6),shirt);E3.draw(PG.arm,mL(W3(sR),W3(aR),.6),shirt);ball3(W3(aL),0.045,skin);ball3(W3(aR),0.045,skin);
  const hm=mB(W3(top),R,U,Fw);E3.draw(PG.head,hm,skin);E3.draw(PG.cap,hm,shirt);
}
// 2-bone IK: joint on the circle where both bones meet, on the side of the pole vector; reach is capped so bones never stretch
function ik(a,t,l1,l2,pole){
  const d=V3.sub(t,a),L=Math.hypot(d[0],d[1],d[2])||1e-6,u=V3.sc(d,1/L),D=Math.min(L,l1+l2-1e-4),x=(l1*l1-l2*l2+D*D)/(2*D),h=Math.sqrt(Math.max(0,l1*l1-x*x));
  return V3.add(V3.add(a,V3.sc(u,x)),V3.sc(V3.norm(V3.sub(pole,V3.sc(u,V3.dot(pole,u)))),h));}
function batsman3D(p){
  const B=BG,k=KIT.you,shirt=hex(k.shirt),pants=hex(k.pants),hel=hex(k.helmet),W=[1,1,1];
  const hip=[p[qHX],p[qHY],p[qHZ]],ha=[-Math.sin(p[qHR]),0,Math.cos(p[qHR])];
  const Y=V3.norm([p[qLX],1,p[qLZ]]),s0=[-Math.sin(p[qSR]),0,Math.cos(p[qSR])],s=V3.norm(V3.sub(s0,V3.sc(Y,V3.dot(s0,Y)))),n=V3.cross(Y,s);
  const leg=(fx,fz,fr,ly,heel,side)=>{const t=[Math.cos(fr),0,Math.sin(fr)],an=[fx,.08+ly+heel*.05,fz],hj=V3.add(hip,V3.sc(ha,.1*side));hj[1]-=.04;
    const fw=V3.norm([t[0]*.24,-heel*.07,t[2]*.24]),X=V3.norm(V3.cross([0,1,0],fw));
    E3.draw(B.shoe,mB(V3.sub([fx+t[0]*.16,ly,fz+t[2]*.16],V3.sc(fw,.16)),X,V3.cross(fw,X),fw),W,{tex:B.shoeTex});
    const kn=ik(hj,an,.43,.43,V3.add(t,V3.sc(ha,.25*side)));E3.draw(B.thigh,mL(hj,kn,.43),pants);E3.draw(B.pad,mL(an,kn,.43,t),PAD,{spec:.12,tex:B.padTex});};
  leg(p[qFX],p[qFZ],p[qFR],p[qFLY],0,1);leg(p[qBX],p[qBZ],p[qBR],p[qBLY],p[qHL],-1);
  E3.draw(B.pelvis,mB(hip,V3.cross([0,1,0],ha),[0,1,0],ha),pants);
  E3.draw(B.torso,mB(hip,n,Y,s),W,{tex:B.shirtTex});
  const sh=V3.add(hip,V3.sc(Y,.5)),H=[hip[0]+p[qAX],hip[1]+p[qAY],hip[2]+p[qAZ]],d=V3.norm([p[qDX],p[qDY],p[qDZ]]),H2=V3.add(H,V3.sc(d,.11));
  const arm=(hd,side)=>{const sp=V3.add(sh,V3.sc(s,.19*side)),e=ik(sp,hd,.31,.3,[s[0]*.6*side+n[0]*.2,-.7,s[2]*.6*side+n[2]*.2]),f=V3.norm(V3.sub(hd,e));
    E3.draw(B.uarm,mL(sp,e,.31),SKIN);E3.draw(B.sleeve,mL(sp,V3.lerp(sp,e,.48),.15),shirt);E3.draw(B.farm,mL(e,hd,.3),SKIN);
    E3.draw(B.glove,mL(V3.sub(hd,V3.sc(f,.06)),V3.add(hd,V3.sc(f,.03)),.09),GLOVE,{spec:.1});};
  arm(H,1);arm(H2,-1);
  const hv=V3.norm([Y[0]+p[qNOD]*.3,Y[1],Y[2]+p[qNOD]*.12]),hd=V3.add(V3.add(hip,V3.sc(Y,.54)),V3.sc(hv,.19)),yw=p[qHDY],f=[Math.sin(yw),0,Math.cos(yw)];
  E3.draw(B.neck,mL(sh,V3.sub(hd,V3.sc(hv,.06)),.17),SKIN);
  const fw=V3.norm(V3.sub(f,V3.sc(hv,V3.dot(f,hv)))),hm=mB(hd,V3.cross(hv,fw),hv,fw);
  E3.draw(B.head,hm,SKIN);E3.draw(B.helmet,hm,hel,{spec:.35});E3.draw(B.grille,hm,GRILLE,{spec:.3});
  const a=V3.add(H,V3.sc(d,.28)),b=V3.add(H,V3.sc(d,.86));
  E3.draw(B.handle,mL(V3.add(H,V3.sc(d,-.06)),V3.add(a,V3.sc(d,.02)),.36),GRIP);
  E3.draw(B.blade,mL(a,b,.58,[1,Math.max(0,Math.abs(d[0])-.4)*3,0]),BLADE,{spec:.15});
}
function stumps3D(z,hit){
  const t=hit?hit.a:0,cream=[0.95,0.92,0.82],bail=[0.85,0.64,0.25];
  [-0.114,0,0.114].forEach((x,i)=>{const tilt=hit&&!hit.bails?Math.min(1,t*7)*[0.35,-0.5,0.55][i]:0;
    limb([x,0,z],[x+Math.sin(tilt)*0.7,Math.cos(tilt)*0.71,z-Math.abs(tilt)*0.3],0.019,cream);});
  if(!hit){limb([-0.114,0.725,z],[0,0.725,z],0.011,bail);limb([0,0.725,z],[0.114,0.725,z],0.011,bail);}
  else [-1,1].forEach(k=>{const y=0.73+3.2*t-4.9*t*t;if(y<0)return;const px=k*(0.06+0.9*t),pz=z-1.2*t;limb([px-0.05,y,pz],[px+0.05,y+0.02,pz],0.011,bail);});
}
function bowlerState(){
  let z=S.bowlerZ,arm=null,run=0,running=false;const pace=M.bowlerType==='pace';
  if(S.phase==='runup'){const p=S.t/S.runupDur;z=lerp(pace?31:25.5,20.3,p);run=S.t*(pace?13:10);running=true;
    if(p>0.72)arm=lerp(0,Math.PI,(p-0.72)/0.28);}
  else if(S.phase==='ready'||S.phase==='break'){z=pace?31:25.5;}
  else if(S.phase==='flight'||S.phase==='result'){const t=S.phase==='flight'?clock-S.ball.start:S.t+0.8;
    z=Math.max(17.6,20.3-t*2.4);arm=Math.min(2*Math.PI,Math.PI+t*12);run=t*8;running=t<0.9;}
  S.bowlerZ=z;return {z,arm,run,running};
}
/* --- view state: everything render3D/draw take from the game. Live frames are built here; a replay feeds recorded
   frames instead (08b-replay). New per-frame render state goes here AND into the recorded frame layout. --- */
const NFL=12,wideCam=()=>!!S.cel||S.phase==='replay';
const mkView=()=>({pose:null,ball:null,bo:{x:0,y:0,z:0},st:null,so:{a:0,bails:false},mk:null,bz:0,arm:null,brun:0,brn:false,
  nf:0,f:Array.from({length:NFL},()=>({on:false,x:0,z:0,face:0,run:0,running:false,crouch:0})),hideBat:false,trail:null});
const LV=mkView();
function liveView(){
  const V=LV,ph=S.phase;
  V.pose=poseTick();V.ball=ballNow();
  V.st=S.stumps?(V.so.a=clock-S.stumps.t0,V.so.bails=!!S.stumps.bails,V.so):null;
  V.mk=!settings.assist?null:ph==='runup'&&S.t/S.runupDur>0.4?S.pending:ph==='flight'&&clock-S.ball.start<S.ball.t1?S.ball:null;
  V.nf=0;
  if(M){
    const bs=bowlerState();V.bz=bs.z;V.arm=bs.arm;V.brun=bs.run;V.brn=bs.running;
    S.fpos.forEach((p,i)=>{if(V.nf>=NFL)return;const f=M.field[i],o=V.f[V.nf++];o.on=!!f&&f.n!=='keeper'&&f.n!=='bowler';if(!o.on)return;
      const mv=!!p.mv&&clock-p.mv<0.12,tx=mv&&S.fanim?S.fanim.x:0,tz=mv&&S.fanim?S.fanim.z:BATS_Z;
      o.x=p.x;o.z=p.z;o.face=Math.atan2(tx-p.x,tz-p.z);o.running=mv;o.run=p.run;o.crouch=ph==='flight'||ph==='runup'?1:0;});
  }
  V.hideBat=!!(S.chase&&clock>=S.chase.t0);V.trail=V.hideBat?S.trail3:null;
  return V;
}
function shadow3(x,z,r,a){E3.draw(GEO.disk,mT([x,0,z],0,r,1,r),[0,0,0],{a,lit:0,fog:0});}

function render3D(V){
  if(!glOK||!R3)return;
  const bp=V.ball,v=VIS,{view,proj}=viewProj(),R=R3.R;
  E3.frame(glc.width,glc.height,view,proj,lightFor());
  E3.flat(true);
  if(wideCam())E3.draw(GEO.disk,mT([0,0,0],0,1800,1,1800),hex(v.ground[1]));
  E3.draw(GEO.disk,mT([0,0,0],0,R+7,1,R+7),[1,1,1],{tex:R3.groundTex});
  E3.draw(R3.rope,I4,hex(v.rope),{lit:0});
  E3.draw(R3.ring,I4,[1,1,1],{a:0.45,lit:0});
  E3.draw(GEO.plane,mT([0,0,10.06],0,3.05,1,23.4),hex(v.pitch[0]));
  E3.draw(GEO.plane,mT([0,0,10.06],0,1.6,1,17),hex(v.pitch[1]),{a:0.35});
  for(const zf of [2.6,17.6]){E3.draw(GEO.disk,mT([0.15,0,zf],0,0.6,1,1.1),[0,0,0],{a:0.045,lit:0});}
  const [cc,ca]=colA(v.crease),cw=0.05,crease=(px,pz,w,l)=>E3.draw(GEO.plane,mT([px,0,pz],0,w,1,l),cc,{a:ca,lit:0});
  for(const [zb,dirz] of [[0,1],[20.12,-1]]){crease(0,zb,2.64,cw);crease(0,zb+1.22*dirz,3.66,cw);crease(-1.32,zb,cw,2.44);crease(1.32,zb,cw,2.44);}
  if(M){
    for(let i=0;i<V.nf;i++){const p=V.f[i];if(p.on)shadow3(p.x,p.z,0.38,0.22);}
    shadow3(0.42,V.bz,0.38,0.22);
  }
  const bpz=V.pose;shadow3(bpz[qHX],bpz[qHZ]+.02,0.45,0.25);
  if(bp)shadow3(bp.x,bp.z,0.07/(1+bp.y*0.15),0.35);
  const mk=V.mk;
  if(mk){E3.draw(GEO.disk,mT([mk.xb,0,mk.zb],0,0.24,1,0.24),[1,0.88,0.4],{a:0.28,lit:0,fog:0});E3.draw(GEO.ann,mT([mk.xb,0,mk.zb],0,0.26,1,0.26),[1,0.88,0.4],{lit:0,fog:0});}
  E3.flat(false);
  E3.draw(R3.stand,I4,[1,1,1],{tex:R3.standTex,lit:0});
  stumps3D(20.12,null);stumps3D(0,V.st);
  if(M){
    const kit=aiKit();
    for(let i=0;i<V.nf;i++){const p=V.f[i];if(p.on)person3D(p.x,p.z,p.face,{...kit,running:p.running,run:p.run,crouch:p.crouch});}
    person3D(0.42,V.bz,Math.PI,{...kit,running:V.brn,run:V.brun,arm:V.arm});
  }
  if(!V.hideBat)batsman3D(bpz);
  if(bp)ball3([bp.x,bp.y+0.05,bp.z],0.05,[0.78,0.13,0.1]);
}

/* --- sky (2D canvas behind the 3D layer) --- */
function renderSky(){
  const v=VIS,dB=distToBoundary(cam.x,cam.z,cam.fx,cam.fz)+7;let top=HZ-(v.standsH-cam.y)*F/dB;
  if(wideCam()&&!(top<HZ))top=HZ;
  const g=sk.createLinearGradient(0,0,0,Math.max(10,top));g.addColorStop(0,v.sky[0]);g.addColorStop(1,v.sky[1]);
  sk.fillStyle=g;sk.fillRect(0,0,W,H);
  yawShift=cam.yaw*D2R*F;
  drawSky(top);
}
function draw(V){
  const bp=V.ball;
  renderSky();render3D(V);
  ctx.clearRect(0,0,W,H);
  if(!glOK){ctx.fillStyle='#fff';ctx.font='600 16px Barlow,sans-serif';ctx.textAlign='center';ctx.fillText('3D graphics are not available on this device.',W/2,H/2);}
  if(V.trail)V.trail.forEach((t,i)=>{const q=proj(t.x,t.y,t.z);if(!q)return;ctx.fillStyle='rgba(255,255,255,'+(0.04+i*0.03)+')';ctx.beginPath();ctx.arc(q.x,q.y,Math.max(2,0.05*q.s),0,7);ctx.fill();});
  drawFx();
  if(S.phase==='replay')rpGlow(bp);
  if(S.cel)fwDraw();else if(S.phase!=='replay'){drawAim();drawRadar(bp);drawTimingBar();drawInfo();}
}

