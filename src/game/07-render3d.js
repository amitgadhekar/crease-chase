/* ---------- 3D scene ---------- */
const glc=$('#gl'),skc=$('#sky'),sk=skc.getContext('2d');
const glOK=E3.init(glc);
const GEO=glOK?{box:E3.geom(GB.box()),cyl:E3.geom(GB.cyl(12)),sph:E3.geom(GB.sph(10,16)),disk:E3.geom(GB.disk(48)),plane:E3.geom(GB.plane()),
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
  lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]};
function mB(p,X,Y,Z){return new Float32Array([X[0],X[1],X[2],0,Y[0],Y[1],Y[2],0,Z[0],Z[1],Z[2],0,p[0],p[1],p[2],1]);}
function mT(p,yaw,sx,sy,sz){const c=Math.cos(yaw),s=Math.sin(yaw);return mB(p,[c*sx,0,-s*sx],[0,sy,0],[s*sz,0,c*sz]);}
function mSeg(a,b,r,side){const d=V3.sub(b,a),Ln=Math.hypot(d[0],d[1],d[2])||1e-6,Y=V3.sc(d,1/Ln);
  let X=V3.cross(Y,side||(Math.abs(Y[1])<0.9?[0,1,0]:[1,0,0]));if(Math.hypot(X[0],X[1],X[2])<1e-3)X=V3.cross(Y,[1,0,0]);X=V3.norm(X);const Z=V3.cross(X,Y);
  return mB(V3.lerp(a,b,0.5),V3.sc(X,Array.isArray(r)?r[0]:r),V3.sc(Y,Ln),V3.sc(Z,Array.isArray(r)?r[1]:r));}
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
  return {dir,sun:[si,si*0.97,si*0.92],sky:V3.sc(sky,0.72),gr:V3.sc(hex(lk.gr),0.72),fogC:lk.fog?hex(lk.fog[0]):[0,0,0],fog:lk.fog?[lk.fog[1],lk.fog[2]]:[0,0]};
}
function viewProj(){
  const tx=-(cam.rx*cam.x+cam.rz*cam.z),tz=-(cam.fx*cam.x+cam.fz*cam.z);
  const view=new Float32Array([cam.rx,0,cam.fx,0, 0,1,0,0, cam.rz,0,cam.fz,0, tx,-cam.y,tz,1]);
  const n=0.15,f=2000,a=(f+n)/(f-n),b=-2*f*n/(f-n);
  const proj=new Float32Array([2*F/W,0,0,0, 0,2*F/H,0,0, 0,1-2*HZ/H,a,1, 0,0,b,0]);
  return {view,proj};
}

/* --- bat poses (world space): hand point + blade direction --- */
const POSE={stance:{h:[-0.27,0.92,1.1],d:V3.norm([0.12,-1,0.12])},back:{h:[-0.33,1.38,0.9],d:V3.norm([-0.15,0.8,-0.6])},
  impact:{h:[-0.2,0.95,1.32],d:V3.norm([0.15,-0.95,0.3])},block:{h:[-0.22,0.98,1.32],d:V3.norm([0.05,-1,0.38])}};
function followPose(aim){const s=Math.sin(aim*D2R),c=Math.cos(aim*D2R);return {h:[-0.32+0.22*s,1.45,1.1+0.22*c],d:V3.norm([0.6*s,0.75,0.6*c])};}
function lerpPose(a,b,u){return {h:V3.lerp(a.h,b.h,u),d:V3.norm(V3.lerp(a.d,b.d,u))};}
function batAngleNow(){
  const B=S.bat,t=clock-B.t0,from=B.from&&B.from.h?B.from:POSE.stance;
  if(B.mode==='backlift')return lerpPose(from,POSE.back,clamp(t/0.18,0,1));
  if(B.mode==='swing'){if(t<SWING_DELAY)return lerpPose(from,POSE.impact,clamp(t/SWING_DELAY,0,1));
    return lerpPose(POSE.impact,followPose(B.aim),1-Math.pow(1-clamp((t-SWING_DELAY)/0.24,0,1),2));}
  if(B.mode==='block')return t<0.1?lerpPose(from,POSE.block,t/0.1):POSE.block;
  return POSE.stance;
}

/* --- people --- */
const SKIN=[0.69,0.48,0.33];
function limb(a,b,r,c){E3.draw(GEO.cyl,mSeg(a,b,r),c);}
function ball3(p,r,c,o){E3.draw(GEO.sph,mT(p,0,r,r,r),c,o);}
function person3D(x,z,face,o){
  const c=Math.cos(face),s=Math.sin(face),W3=(l)=>[x+l[0]*c+l[2]*s,l[1],z-l[0]*s+l[2]*c];
  const ra=o.running?1:0,rn=o.run||0,cr=o.crouch||0;
  const shirt=hex(o.shirt),pants=hex(o.pants),skin=o.skin?hex(o.skin):SKIN;
  const hy=0.92-cr*0.12;
  const fL=[-0.12,Math.max(0,Math.cos(rn))*0.12*ra,Math.sin(rn)*0.34*ra],fR=[0.12,Math.max(0,-Math.cos(rn))*0.12*ra,-Math.sin(rn)*0.34*ra];
  const hL=[-0.1,hy,0],hR=[0.1,hy,0];
  const kL=[(hL[0]+fL[0])/2,(hL[1]+fL[1])/2,(hL[2]+fL[2])/2+0.07+cr*0.1],kR=[(hR[0]+fR[0])/2,(hR[1]+fR[1])/2,(hR[2]+fR[2])/2+0.07+cr*0.1];
  limb(W3(hL),W3(kL),0.075,pants);limb(W3(kL),W3(fL),0.064,pants);limb(W3(hR),W3(kR),0.075,pants);limb(W3(kR),W3(fR),0.064,pants);
  E3.draw(GEO.box,mT(W3([fL[0],fL[1]+0.04,fL[2]+0.05]),face,0.1,0.07,0.22),[0.16,0.16,0.18]);
  E3.draw(GEO.box,mT(W3([fR[0],fR[1]+0.04,fR[2]+0.05]),face,0.1,0.07,0.22),[0.16,0.16,0.18]);
  const lean=ra*0.12+cr*0.12,top=[0,hy+0.54,lean];
  E3.draw(GEO.cyl,mSeg(W3([0,hy-0.04,0]),W3(top),[0.19,0.13]),shirt);
  const sL=[-0.2,top[1]-0.04,lean],sR=[0.2,top[1]-0.04,lean];
  let aL=[-0.25,hy-0.08,-Math.sin(rn)*0.3*ra+cr*0.3],aR=[0.25,hy-0.08,Math.sin(rn)*0.3*ra+cr*0.3];
  if(o.arm!=null){const th=o.arm;aR=[sR[0],sR[1]-Math.cos(th)*0.72,sR[2]-Math.sin(th)*0.72];aL=[-0.25,top[1]+0.1,0.45];}
  limb(W3(sL),W3(aL),0.048,shirt);limb(W3(sR),W3(aR),0.048,shirt);ball3(W3(aL),0.045,skin);ball3(W3(aR),0.045,skin);
  const hd=W3([0,top[1]+0.18,lean]);ball3(hd,0.115,skin);
  E3.draw(GEO.sph,mT([hd[0],hd[1]+0.05,hd[2]],face,0.122,0.075,0.122),shirt);
  E3.draw(GEO.box,mT(W3([0,top[1]+0.22,lean+0.13]),face,0.17,0.018,0.13),shirt);
}
function batsman3D(){
  const k=KIT.you,shirt=hex(k.shirt),pants=hex(k.pants),pad=[0.95,0.95,0.93],hel=hex(k.helmet),x=-0.42;
  const fF=[x-0.03,0,1.4],fB=[x-0.03,0,0.78],hF=[x,0.92,1.13],hB=[x,0.92,0.97];
  const kF=[x+0.06,0.48,1.3],kB=[x+0.06,0.48,0.86];
  limb(hF,kF,0.08,pants);limb(hB,kB,0.08,pants);limb(kF,fF,0.085,pad);limb(kB,fB,0.085,pad);
  E3.draw(GEO.box,mT([fF[0]+0.04,0.04,fF[2]],Math.PI/2,0.1,0.07,0.24),[0.95,0.95,0.95]);
  E3.draw(GEO.box,mT([fB[0]+0.04,0.04,fB[2]],Math.PI/2,0.1,0.07,0.24),[0.95,0.95,0.95]);
  const tB=[x,0.88,1.05],tT=[x+0.04,1.44,1.05];
  E3.draw(GEO.cyl,mSeg(tB,tT,[0.15,0.2],[0,0,1]),shirt);
  E3.draw(GEO.cyl,mSeg([x+0.03,1.3,1.05],[x+0.035,1.34,1.05],[0.162,0.212],[0,0,1]),hex(k.trim));
  const pose=batAngleNow(),hnd=pose.h;
  const sF=[x+0.04,1.4,1.24],sB=[x+0.04,1.4,0.86];
  limb(sF,hnd,0.05,shirt);limb(sB,hnd,0.05,shirt);ball3(hnd,0.055,[0.96,0.96,0.96]);
  const hd=[x+0.03,1.62,1.08];ball3(hd,0.14,hel);
  E3.draw(GEO.box,mT([hd[0],hd[1]-0.03,hd[2]+0.13],0,0.17,0.13,0.02),[0.25,0.27,0.3]);
  E3.draw(GEO.box,mT([hd[0],hd[1]+0.07,hd[2]+0.12],0,0.2,0.025,0.08),hel);
  const d=pose.d,a=V3.add(hnd,V3.sc(d,0.28)),b=V3.add(hnd,V3.sc(d,0.86));
  E3.draw(GEO.cyl,mSeg(hnd,a,0.018),[0.2,0.15,0.1]);
  E3.draw(GEO.box,mSeg(a,b,[0.11,0.05],[1,0,0]),[0.89,0.77,0.56]);
}
function stumps3D(z,hit){
  const t=hit?clock-hit.t0:0,cream=[0.95,0.92,0.82],bail=[0.85,0.64,0.25];
  [-0.114,0,0.114].forEach((x,i)=>{const tilt=hit?Math.min(1,t*7)*[0.35,-0.5,0.55][i]:0;
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
function shadow3(x,z,r,a){E3.draw(GEO.disk,mT([x,0,z],0,r,1,r),[0,0,0],{a,lit:0,fog:0});}

function render3D(bp){
  if(!glOK||!R3)return;
  const v=VIS,{view,proj}=viewProj(),R=R3.R;
  E3.frame(glc.width,glc.height,view,proj,lightFor());
  E3.flat(true);
  E3.draw(GEO.disk,mT([0,0,0],0,R+7,1,R+7),[1,1,1],{tex:R3.groundTex});
  E3.draw(R3.rope,I4,hex(v.rope),{lit:0});
  E3.draw(R3.ring,I4,[1,1,1],{a:0.45,lit:0});
  E3.draw(GEO.plane,mT([0,0,10.06],0,3.05,1,23.4),hex(v.pitch[0]));
  E3.draw(GEO.plane,mT([0,0,10.06],0,1.6,1,17),hex(v.pitch[1]),{a:0.35});
  for(const zf of [2.6,17.6]){E3.draw(GEO.disk,mT([0.15,0,zf],0,0.6,1,1.1),[0,0,0],{a:0.045,lit:0});}
  const [cc,ca]=colA(v.crease),cw=0.05,crease=(px,pz,w,l)=>E3.draw(GEO.plane,mT([px,0,pz],0,w,1,l),cc,{a:ca,lit:0});
  for(const [zb,dirz] of [[0,1],[20.12,-1]]){crease(0,zb,2.64,cw);crease(0,zb+1.22*dirz,3.66,cw);crease(-1.32,zb,cw,2.44);crease(1.32,zb,cw,2.44);}
  if(M){
    S.fpos.forEach((p,i)=>{const f=M.field[i];if(f&&f.n!=='keeper'&&f.n!=='bowler')shadow3(p.x,p.z,0.38,0.22);});
    shadow3(0.42,S.bowlerZ,0.38,0.22);
  }
  shadow3(-0.42,1.08,0.45,0.25);
  if(bp)shadow3(bp.x,bp.z,0.07/(1+bp.y*0.15),0.35);
  if(settings.assist){let b=null;
    if(S.phase==='runup'&&S.t/S.runupDur>0.4)b=S.pending;else if(S.phase==='flight'&&clock-S.ball.start<S.ball.t1)b=S.ball;
    if(b){E3.draw(GEO.disk,mT([b.xb,0,b.zb],0,0.24,1,0.24),[1,0.88,0.4],{a:0.28,lit:0,fog:0});E3.draw(GEO.ann,mT([b.xb,0,b.zb],0,0.26,1,0.26),[1,0.88,0.4],{lit:0,fog:0});}}
  E3.flat(false);
  E3.draw(R3.stand,I4,[1,1,1],{tex:R3.standTex,lit:0});
  stumps3D(20.12,null);stumps3D(0,S.stumps);
  if(M){
    const kit=aiKit();
    S.fpos.forEach((p,i)=>{const f=M.field[i];if(!f||f.n==='keeper'||f.n==='bowler')return;
      const moving=p.mv&&clock-p.mv<0.12,tgt=moving&&S.fanim?[S.fanim.x,S.fanim.z]:[0,BATS_Z];
      person3D(p.x,p.z,Math.atan2(tgt[0]-p.x,tgt[1]-p.z),{...kit,running:moving,run:p.run,crouch:S.phase==='flight'||S.phase==='runup'?1:0});});
    const bs=bowlerState();person3D(0.42,bs.z,Math.PI,{...kit,running:bs.running,run:bs.run,arm:bs.arm});
  }
  const chaseOn=!!(S.chase&&clock>=S.chase.t0);
  if(!chaseOn)batsman3D();
  if(bp)ball3([bp.x,bp.y+0.05,bp.z],0.05,[0.78,0.13,0.1]);
}

/* --- sky (2D canvas behind the 3D layer) --- */
function renderSky(){
  const v=VIS,dB=distToBoundary(cam.x,cam.z,cam.fx,cam.fz)+7,top=HZ-(v.standsH-cam.y)*F/dB;
  const g=sk.createLinearGradient(0,0,0,Math.max(10,top));g.addColorStop(0,v.sky[0]);g.addColorStop(1,v.sky[1]);
  sk.fillStyle=g;sk.fillRect(0,0,W,H);
  yawShift=cam.yaw*D2R*F;
  drawSky(top);
}
function draw(){
  const bp=ballNow();
  renderSky();render3D(bp);
  ctx.clearRect(0,0,W,H);
  if(!glOK){ctx.fillStyle='#fff';ctx.font='600 16px Barlow,sans-serif';ctx.textAlign='center';ctx.fillText('3D graphics are not available on this device.',W/2,H/2);}
  if(S.chase&&clock>=S.chase.t0)S.trail3.forEach((t,i)=>{const q=proj(t.x,t.y,t.z);if(!q)return;ctx.fillStyle='rgba(255,255,255,'+(0.04+i*0.03)+')';ctx.beginPath();ctx.arc(q.x,q.y,Math.max(2,0.05*q.s),0,7);ctx.fill();});
  drawFx();drawAim();drawRadar(bp);drawTimingBar();drawInfo();
}

