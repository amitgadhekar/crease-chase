/* ---------- 3D scene (three.js) ----------
   The scene graph is built once at boot (renderer, meshes, materials) and refreshed per planet by build3D (textures,
   boundary geometry, colours, lights). Each frame render3D(V) only sets transforms, visibility and fog from V.
   Game coordinates are left-handed (+x is screen right looking down +z) and three's are right-handed, so every object
   lives in T3.world, a group mirrored in x. */
const glc=$('#gl'),skc=$('#sky'),sk=skc.getContext('2d');
// sRGB output with ACES tone mapping. three mixes fog after tone mapping, in the output colour space, so fog colours match
// the 2D sky canvas exactly.
function colourSetup(r){
  THREE.ColorManagement.enabled=true;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;
}
const T3=(()=>{let r;try{r=new THREE.WebGLRenderer({canvas:glc,alpha:true,antialias:true,premultipliedAlpha:true});}catch(e){return null;}
  colourSetup(r);r.setClearColor(0,0);r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFShadowMap;
  const scene=new THREE.Scene(),world=new THREE.Group(),sun=new THREE.DirectionalLight(0xffffff,3);
  world.scale.x=-1;world.add(sun,sun.target);scene.add(world);
  Object.assign(sun.shadow,{bias:-.00004,normalBias:.025});sun.castShadow=true;sun.shadow.camera.near=1;sun.shadow.camera.far=320;
  return {r,scene,world,sun,cam:new THREE.PerspectiveCamera(50,1,0.15,2000),fog:new THREE.Fog(0,1,2),pmrem:new THREE.PMREMGenerator(r),env:null};})();
const glOK=!!T3;
let curPlanet='earth',yawShift=0;
// per planet: sun [colour, intensity, azimuth from +z toward +x, elevation], sky-dome environment intensity, exposure, shadow
// strength and softness, rim light on players, floodlight glow, fog [colour, near, far]; envSky overrides VIS.sky for the dome
const LOOK3D={
  earth:{sun:['#fff0d8',3.1,140,50],env:1,exp:1,sh:.85,shr:2.5,rim:.22,glow:.35,fog:['#cfe5f2',140,700]},
  moon:{sun:['#ffffff',3.6,115,28],env:.55,exp:1.08,sh:.97,shr:1.2,rim:.3,glow:1,fog:null},
  mercury:{sun:['#fff0cf',4.2,110,22],env:.6,exp:1,sh:.95,shr:1.5,rim:.3,glow:.6,fog:null},
  venus:{sun:['#ffe2a0',1.5,150,64],env:1.45,exp:1.02,sh:.45,shr:7,rim:.2,glow:.7,fog:['#e9c47c',8,120]},
  mars:{sun:['#ffe0c0',2.7,115,36],env:1.05,exp:1.02,sh:.78,shr:3,rim:.22,glow:.5,fog:['#dba67c',60,320]},
  jupiter:{sun:['#fff2e0',2.2,150,62],env:.75,exp:1.12,sh:.8,shr:3,rim:.28,glow:.95,fog:['#d99f70',35,220]},
  saturn:{sun:['#fff1d2',2.7,130,42],env:.95,exp:1.02,sh:.8,shr:3,rim:.22,glow:.6,fog:['#e6d9b4',70,340]},
  neptune:{sun:['#e4eeff',2.6,160,64],env:.7,exp:1.1,sh:.85,shr:2.5,rim:.3,glow:1,fog:['#5f92d2',45,270]}
};
const V3={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sc:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];},
  dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]};
// mesh transforms in game coordinates: origin p and axes X, Y, Z
function mB(m,p,X,Y,Z){const e=m.matrix.elements;
  e[0]=X[0];e[1]=X[1];e[2]=X[2];e[3]=0;e[4]=Y[0];e[5]=Y[1];e[6]=Y[2];e[7]=0;e[8]=Z[0];e[9]=Z[1];e[10]=Z[2];e[11]=0;e[12]=p[0];e[13]=p[1];e[14]=p[2];e[15]=1;}
function mT(m,p,sx,sy,sz){mB(m,p,[sx,0,0],[0,sy,0],[0,0,sz]);}
// a->b frame for geometry centred on the origin along y with nominal length L0; x/z scaled by sx/sz
function mL(m,a,b,L0,side,sx=1,sz=1){const d=V3.sub(b,a),Ln=Math.hypot(d[0],d[1],d[2])||1e-6,Y=V3.sc(d,1/Ln);
  let X=V3.cross(Y,side||(Math.abs(Y[1])<0.9?[0,1,0]:[1,0,0]));if(Math.hypot(X[0],X[1],X[2])<1e-3)X=V3.cross(Y,[1,0,0]);X=V3.norm(X);
  mB(m,V3.lerp(a,b,0.5),V3.sc(X,sx),V3.sc(Y,Ln/L0),V3.sc(V3.cross(X,Y),sz));}
function mSeg(m,a,b,r){mL(m,a,b,1,null,r,r);}

const GCV=document.createElement('canvas'),PCV=document.createElement('canvas'),ADV=document.createElement('canvas'),SEV=document.createElement('canvas'),WDV=document.createElement('canvas');
const RIM={value:new THREE.Color()},DET={tDet:{value:null},uDetRep:{value:60}};
const sunDir=lk=>{const a=lk.sun[2]*D2R,e=lk.sun[3]*D2R;return [Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];};
// image-based light: a sky dome (zenith, horizon, a band of stands, grass below, brighter toward the sun) prefiltered by PMREM
let envDome=null;
function envBuild(v,lk,d){
  if(!envDome){const c=()=>({value:new THREE.Color()});envDome=new THREE.Scene();envDome.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{top:c(),hor:c(),std:c(),gnd:c(),sc:c(),sd:{value:new THREE.Vector3()}},
    vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform vec3 top,hor,std,gnd,sc,sd;varying vec3 vD;void main(){float y=vD.y;vec3 c=mix(hor,top,sqrt(clamp(y,0.,1.)));c=mix(std,c,smoothstep(.05,.2,y));'+
      'if(y<0.)c=mix(std,gnd,smoothstep(0.,.12,-y));c+=sc*pow(max(dot(vD,sd),0.),6.)*step(0.,y);gl_FragColor=vec4(c,1.);}'})));}
  const u=envDome.children[0].material.uniforms,sky=lk.envSky||v.sky;
  const ds=x=>{const l=x.r*.3+x.g*.59+x.b*.11;x.lerp(TCOL.setRGB(l,l,l),.45);};u.top.value.set(sky[0]);u.hor.value.set(sky[1]);ds(u.top.value);ds(u.hor.value);u.std.value.set(v.stands).multiplyScalar(.6);u.gnd.value.set(v.ground[0]).multiplyScalar(.55);
  u.sc.value.set(lk.sun[0]).multiplyScalar(.12*lk.sun[1]);u.sd.value.set(-d[0],d[1],d[2]);
  if(T3.env)T3.env.dispose();T3.env=T3.pmrem.fromScene(envDome,0,.1,100,{size:128});T3.scene.environment=T3.env.texture;
}
// land around the stadium for the wide celebration view: dark ground fading into the horizon colour, then transparent, so
// it meets the 2D sky without an edge (fog is off on it)
function surround(c,v,lk,r0){
  const n=256,g=c.getContext('2d');c.width=c.height=n;const hz=lk.fog?lk.fog[0]:v.sky[1],gr=g.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);
  gr.addColorStop(0,v.stands);gr.addColorStop(r0*1.05,v.stands);gr.addColorStop(Math.min(.3,r0*2),v.ground[1]);gr.addColorStop(.6,hz);gr.addColorStop(.97,hz.slice(0,7)+'00');
  g.fillStyle=gr;g.fillRect(0,0,n,n);
}
// per planet: canvas textures are redrawn, the stadium and crowd rebuilt, lights, environment and fog retuned
function build3D(){
  if(!glOK)return;
  const v=VIS,R=BOUNDARY,r27=27*R/65,G=G3,lk=LOOK3D[curPlanet]||LOOK3D.earth,k=aiKit();
  paintGround(GCV,v,R+7,R);G.groundTex.needsUpdate=true;paintPitch(PCV,v);G.pitchTex.needsUpdate=true;paintAds(ADV,v);G.adsTex.needsUpdate=true;
  DET.uDetRep.value=2*(R+7)/1.6;
  fillGeo(G.ring.geometry,GB.ann(r27-0.07,r27+0.07,120,true));mT(G.ground,[0,0,0],R+7,1,R+7);
  const A=arenaGeo(v,R);fillGeo(G.arena.geometry,A.o);fillGeo(G.ads.geometry,A.ad);fillGeo(G.seats.geometry,A.st);paintSeats(SEV,v);G.seatTex.needsUpdate=true;fillGeo(G.panels.geometry,A.pn);
  const hp=G.halo.geometry.attributes,gl=lk.glow;
  A.halo.forEach((p,i)=>{hp.position.array.set(p,i*3);hp.color.array.set([1,.93,.8,.55*gl],i*4);});
  G.halo.geometry.setDrawRange(0,A.halo.length);hp.position.needsUpdate=hp.color.needsUpdate=true;G.panels.material.color.setScalar(.45+.55*gl);
  crowdBuild(A.rows,v,R,A.screen);qApply();
  surround(WDV,v,lk,(R+7+1.15*v.standsH)/1800);G.wide.material.map.needsUpdate=true;CRWD.u.uHaze.value.set(lk.fog?lk.fog[0]:v.sky[1]);col(G.pm.shirt,k.shirt);col(G.pm.pants,k.pants);spApply(curPlanet);
  const d=G.dir=sunDir(lk);T3.sun.color.set(lk.sun[0]);T3.sun.intensity=lk.sun[1];Object.assign(T3.sun.shadow,{intensity:lk.sh,radius:lk.shr});
  T3.r.toneMappingExposure=lk.exp;T3.scene.environmentIntensity=lk.env;RIM.value.set(v.sky[1]).multiplyScalar(lk.rim);envBuild(v,lk,d);
  T3.scene.fog=lk.fog?T3.fog:null;if(lk.fog)T3.fog.color.set(lk.fog[0]);
}
// camera = cam position + yaw, no pitch; F and the off-centre principal point (CX, HZ) come in through setViewOffset,
// so a world point lands on the same pixel as proj(), which the 2D overlays use
function syncCamera(){
  const c=T3.cam,fw=2*Math.max(CX,W-CX),fh=2*Math.max(HZ,H-HZ);
  c.position.set(-cam.x,cam.y,cam.z);c.rotation.set(0,Math.PI-cam.yaw*D2R,0);
  c.fov=2*Math.atan(fh/(2*F))/D2R;c.aspect=fw/fh;c.setViewOffset(fw,fh,fw/2-CX,fh/2-HZ,W,H);c.updateMatrixWorld();
}
// dev check (smoke test): largest pixel distance between three's projection and proj() over a spread of world points
function camParity(){
  if(!glOK)return null;syncCamera();T3.world.updateMatrixWorld();let e=0;const v=new THREE.Vector3();
  for(const p of [[0,0,0],[0,.71,20.12],[1.32,0,1.22],[-1.32,.5,0],[0,1.6,1.05],[-30,0,40],[40,6,15],[-55,10,-20],[5,25,60],[0,0,-60]]){
    const q=proj(p[0],p[1],p[2]);if(!q)continue;
    T3.world.localToWorld(v.set(p[0],p[1],p[2])).project(T3.cam);e=Math.max(e,Math.hypot((v.x+1)/2*W-q.x,(1-v.y)/2*H-q.y));}
  return e;
}

/* --- batter pose: feet, hips, spine, shoulders, hands (relative to hip), bat direction. Every change of target
   blends from the pose actually shown, so nothing snaps. Knees and elbows come from 2-bone IK at draw time. --- */
const PN=25,qFX=0,qFZ=1,qFR=2,qBX=3,qBZ=4,qBR=5,qHL=6,qHX=7,qHY=8,qHZ=9,qHR=10,qLX=11,qLZ=12,qSR=13,qAX=14,qAY=15,qAZ=16,qDX=17,qDY=18,qDZ=19,qNOD=20,qFLY=21,qBLY=22,qHDY=23,qFC=24;
const PK=[['heel',qHL],['hr',qHR],['lx',qLX],['lz',qLZ],['sr',qSR],['nod',qNOD],['ffr',qFR],['fbr',qBR],['hd',qHDY],['fc',qFC]];
function poseSet(p,o){
  const v=(i,a)=>{if(a)for(let k=0;k<a.length;k++)p[i+k]=a[k];};
  v(qFX,o.ff);v(qBX,o.fb);v(qHX,o.hip);v(qAX,o.h);if(o.d)v(qDX,V3.norm(o.d));
  if(o.dh){p[qHX]+=o.dh[0];p[qHY]+=o.dh[1];p[qHZ]+=o.dh[2];}
  for(let j=0;j<PK.length;j++){const x=o[PK[j][0]];if(x!=null)p[PK[j][1]]=x;}
  return p;}
const BP={st:poseSet(new Float32Array(PN),{ff:[-.45,1.36,.15],fb:[-.45,.8,0],hip:[-.43,.85,1.06],hr:.1,lx:.28,lz:.04,sr:.15,h:[.16,.1,-.02],d:[.12,-1,.12],nod:.25,hd:.2,fc:.7})};
BP.fw=poseSet(new Float32Array(BP.st),{ff:[-.33,1.8,.55],fb:[-.47,.8,.1],heel:.35,hip:[-.38,.8,1.31],hr:.2,lx:.3,lz:.22,sr:.2,nod:.55});
BP.bk=poseSet(new Float32Array(BP.st),{ff:[-.38,1.18,.1],fb:[-.22,.6,-.1],hip:[-.32,.9,.9],hr:.05,lx:.18,lz:-.06,sr:.1,h:[.15,.12,-.02],nod:.2});
BP.tr=poseSet(new Float32Array(BP.st),{ff:[-.43,1.46,.2],fb:[-.38,.76,0],hip:[-.4,.87,1.1]});
const UP={bl:{h:[.1,.5,-.18],d:[-.15,.8,-.6],sr:.08,fc:1.3},
  block:{dh:[0,-.03,.04],h:[.2,.12,.19],d:[.1,-1,-.25],sr:.3,lx:.34,lz:.18,nod:1,fc:0},
  leave:{h:[.02,.775,-.08],d:[-.1,.75,-.65],sr:.15,lx:.2,nod:.35,fc:1.1},
  cel:{h:[0,.82,0],d:[.1,1,.2],sr:-1.2,hr:-.6,lx:-.05,lz:-.12,nod:-.3,hd:-1.4,fc:0}};
// per SHOTS entry: i impact, f follow-through, li/lf lofted overrides. Drive follow-throughs are aimed in shotKeys.
const SH3=[
  {i:{h:[.17,.16,.14],d:[.05,-1,-.05],sr:.25,hr:.15,lx:.3,nod:.7},f:{h:[.1,.12,.1],d:[-.55,-.8,-.3],sr:.35,nod:.6},
   li:{h:[.15,.285,.18],d:[.4,-.5,.6]},lf:{h:[.05,.45,.05],d:[-.3,.55,-.75],sr:.3}},
  {i:{dh:[0,-.05,-.02],hr:.9,sr:1.1,h:[.31,.3,.18],d:[.75,-.3,.55],lx:.1,lz:-.08,nod:.3,ffr:.7,heel:0},
   f:{dh:[0,-.05,-.04],hr:1.3,sr:1.75,h:[-.12,.62,.02],d:[-.25,.35,-.9],lx:0,lz:-.12,ffr:.9,fbr:.5},
   li:{h:[.3,.48,.18],d:[.7,.1,.6]},lf:{h:[-.1,.82,0],d:[-.2,.65,-.75],lz:-.18}},
  {i:{h:[.22,.2,.2],d:[0,-1,.18],sr:.4,hr:.25,lz:.15,nod:.7},f:{h:[.05,.25,.22],d:[-.85,-.25,.45],sr:.55,hr:.4,nod:.5},
   lf:{h:[.01,.6,.16],d:[-.6,.65,.4],lz:0}},
  {i:{dh:[0,-.05,.08],h:[.22,.14,.24],d:[.08,-1,-.05],sr:.45,hr:.25,lx:.28,lz:.3,nod:.9,heel:.4},f:{sr:.6,lz:.25,heel:.7,nod:.5},
   li:{dh:[0,-.02,.04]},lf:{sr:.75,lx:.15,lz:.05}},
  {i:{dh:[0,-.05,.06],h:[.3,.135,.2],d:[.25,-.97,0],sr:.45,hr:.2,lx:.32,lz:.25,nod:.9,heel:.4,ffr:.7},f:{sr:.65,lz:.2,heel:.7,nod:.5},
   li:{dh:[0,-.02,.03]},lf:{sr:.8,lx:.15,lz:.05}},
  {i:{dh:[.06,0,-.08],h:[.5,.28,.06],d:[.75,-.45,-.35],sr:.35,hr:.2,lx:.35,lz:-.05,nod:.5},f:{h:[.46,.22,-.04],d:[.45,-.75,-.45],sr:.45},
   li:{h:[.45,.45,.08],d:[.8,-.1,-.4]},lf:{h:[.35,.8,0],d:[.55,.7,-.4],lz:-.12}},
  {i:{dh:[0,-.06,-.05],h:[.27,.06,-.02],d:[.4,-.88,-.3],sr:.2,lx:.4,nod:.8},f:{h:[.26,.06,-.02],d:[.55,-.7,-.45],sr:.25},
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
  if(sp===SH3[3]||sp===SH3[4]){const s=Math.sin(aim*D2R),c=Math.cos(aim*D2R);poseSet(f,{h:[.1+.25*s+(L?.02:0),L?.77:.78,.1+.15*c],d:[.3*s-(L?.25:.35),L?.95:.7,L?-.35:-.55]});}
  a[qFLY]=a[qBLY]=f[qFLY]=f[qBLY]=0;
  const k=.55+.45*(sw.power||.7);for(let j=0;j<PN;j++)f[j]=a[j]+(f[j]-a[j])*k;
  PB.a=a;PB.b=f;PB.fd=L?.4:.3;}
function blockKeys(b){const a=footPose(new Float32Array(PN),b,1);poseSet(a,UP.block);a[qFLY]=a[qBLY]=0;PB.a=a;PB.b=poseSet(new Float32Array(a),{dh:[0,0,.03]});PB.fd=.25;}
/* contact targeting: the impact pose is bent so the blade meets the ball at tc. The contact point sw.cp is on the ball's path,
   clamped to where the batter can reach; ballNow time-warps the last SWING_DELAY of the delivery so the ball is there at tc.
   The kind is guessed from timing at swing start and settled at resolution (mishits are random), before tc is drawn. */
const BK={mid:[.63,0],block:[.6,0],edge:[.6,.05],toe:[.8,.02],top:[.36,.03],miss:[.63,0]};
function aimSwing(b){
  const sw=S.swing;PB.a0=PB.a;PB.b0=PB.b;PB.fin=!sw||!M;if(PB.fin)return;
  const fa=footAt(b,S.bpos),dt=sw.tc-fa.t,a=Math.abs(dt),w=windows(M.diff,dt<0,1+.35*fa.gain);
  const hit=fa.xc<.98&&fa.xc>REACH_LEG&&fa.c.y<2.05&&a<=w.edge&&!(b.onStumps&&!padHit(b,S.bpos)&&b.tStumps<sw.tc);
  const k=!hit?'miss':a>w.ok?'edge':sw.defend?'block':'mid',L=PB.L=sw.defend?FAM.block:FAM[SHOT_FAM[SHOTS.indexOf(shotFor(sw.aim))]],N=facePt(PB.a0,[0,0,0,0,0,0,0,0,0],.63,0,0);
  const pv=t=>{const q=ballPos(b,t);return [q.x,q.y+.05,q.z];},T0=sw.tc-.05,T1=sw.tc+.14;
  let t=clamp(tAt(b,clamp(ballPos(b,sw.tc).z,N[2]+L.zw[0],N[2]+L.zw[1])),T0,T1);
  PB.P=pv(t);PB.xc=fa.xc;aimBat(k,sw.defend?-1:1,sw.aim+clamp(dt*300,-60,60));
  // out of reach within the shot's natural shape: meet the ball where the path passes closest to the blade instead
  for(let i=0;hit&&i<2&&V3.dist(PB.C,PB.P)>.015;i++){let bt=t,bd=9;for(let s=T0;s<=T1;s+=.004){const e=V3.dist(pv(s),PB.C);if(e<bd){bd=e;bt=s;}}
    if(Math.abs(bt-t)<.002)break;t=bt;PB.P=pv(t);aimBat(k,PB.es,PB.dir);}
  if(hit){sw.cp=ballPos(b,t);sw.dl=t-sw.tc;}}
function settleSwing(){
  const sw=S.swing,r=S.res,k=sw.missed?'miss':!r?PB.k:batKind(r)==='edge'&&S.timing&&S.timing.mishit?'toe':batKind(r),es=r&&r.dir>0?1:-1;PB.fin=true;
  const dir=r&&r.dir!=null&&k!=='edge'&&k!=='block'?r.dir:PB.dir;
  if(k!==PB.k||(k==='edge'&&es!==PB.es)||Math.abs(dir-PB.dir)>3)aimBat(k,es,dir);}
// face normal azimuth at impact: between the incoming ball and the shot direction, so the face meets the ball and sends it
// that way; edges keep it toward the ball, a block points it straight back down the pitch
const faceFor=(k,dir)=>D2R*(k==='block'?0:k==='edge'?.3*clamp(dir,-60,60):clamp(.75*dir,-85,85));
function aimBat(k,es,dir){
  const P=PB.P,[u0,w]=BK[k==='top'&&P[1]<.35?'toe':k],L=shapeFor(PB.L,P[1]),u=u0+(k==='mid'||k==='block'?.1*L.low:0);
  PB.k=k;PB.es=es;PB.dir=dir;const fc=faceFor(k,dir),fresh=()=>(PB.a=new Float32Array(PB.a0),PB.b=new Float32Array(PB.b0),PB.a[qFC]=PB.b[qFC]=fc);fresh();let x=bend(PB.a,P,u,w*es,.05,L);
  if(k==='miss'){const n=V3.norm(V3.cross([PB.a[qDX],PB.a[qDY],PB.a[qDZ]],[0,0,1])),sg=Math.sign(V3.dot(n,[PB.xc<-.2?1:-1,1.2,0]))||1;let best=-1,bx;
    for(const m of [V3.sc(n,.25*sg),V3.sc(n,-.25*sg),V3.sc(n,.45*sg),V3.sc(n,-.45*sg),[0,.45,0],[0,-.35,0]]){fresh();x=bend(PB.a,V3.add(P,m),u,0,0,L);const g=sweepGap();if(g>best){best=g;bx=[x,PB.a,PB.b];}if(g>.03)break;}
    [x,PB.a,PB.b]=bx;}for(let i=0;i<3;i++)PB.b[qHX+i]+=x[i];PB.b[qLZ]+=x[8];PB.C=facePt(PB.a,null,u,w*es,.05);}
// closest the blade comes to the ball over the swing (downswing, impact, follow-through), while the ball is still coming
function sweepGap(){
  const sw=S.swing,b=S.ball,o=PB.tmp,ph=padHit(b,S.bpos);let g=9;
  for(let t=sw.tc-SWING_DELAY;t<sw.tc+.35;t+=.006){
    if(t>b.tEnd||ph&&t>ph.t)break;const v=t<sw.tc?((t-sw.tc)/SWING_DELAY+1)**2:1-(1-clamp((t-sw.tc)/PB.fd,0,1))**2,x=t<sw.tc?PB.from:PB.a,y=t<sw.tc?PB.a:PB.b;
    for(let j=0;j<PN;j++)o[j]=x[j]+(y[j]-x[j])*v;
    const d=V3.norm([o[qDX],o[qDY],o[qDZ]]),n=faceN(d,o[qFC]),X=V3.norm(V3.cross(n,d)),q=ballPos(b,t),r=[q.x-o[qHX]-o[qAX]-S.bpos.x,q.y+.05-o[qHY]-o[qAY],q.z-o[qHZ]-o[qAZ]-S.bpos.z];
    const a=V3.dot(r,d);g=Math.min(g,Math.hypot(Math.max(0,.28-a,a-.86),Math.max(0,Math.abs(V3.dot(r,X))-.054),Math.max(0,Math.abs(V3.dot(r,n))-.03))-.05);}
  return g;}
// pattern search over hip shift, hand shift, bat direction and forward lean: the blade point (u along it, w across, f out of
// the face, so the ball sits on it) goes to T
// with as little change as it takes, both hands within arm's reach of the shoulders, toe above the ground
// per shot family: bend limits (hip x y z, hands x y z, bat yaw, bat pitch, forward lean), bat tilt from vertical at most
// tilt (rad), contact z window around the pose's own contact point. Drives and blocks stay upright; pulls and cuts go flat.
const FAM={drive:{lo:[-.08,-.05,-.12,-.3,-.3,-.3,-1.2,-1,-.1],hi:[.08,.03,.15,.3,.45,.3,1.2,1,.3],tilt:.5,zw:[-.35,.3]},
  block:{lo:[-.06,-.04,-.1,-.25,-.25,-.25,-1,-1,-.1],hi:[.06,.03,.12,.25,.4,.25,1,1,.3],tilt:.35,zw:[-.25,.25]},
  pull:{lo:[-.15,-.1,-.2,-.45,-.45,-.45,-3,-2,-.2],hi:[.15,.04,.2,.45,.55,.45,3,2,.2],tilt:1.9,zw:[-.5,.3]},
  glance:{lo:[-.12,-.1,-.2,-.4,-.4,-.4,-2,-1.5,-.15],hi:[.12,.04,.2,.4,.45,.4,2,1.5,.3],tilt:1.1,zw:[-.6,.2]}};
const SHOT_FAM=['glance','pull','drive','drive','drive','pull','glance'];
// a low ball bends the front knee a little more, leans the head over it and meets it lower on the blade; a ball above the
// waist can't be met with an upright bat, so the bat flattens toward a fend or hook as it rises
function shapeFor(L,y){const low=clamp((.4-y)/.3,0,1),high=clamp((y-.95)/.5,0,1),lo=L.lo.slice(),hi=L.hi.slice();
  lo[1]-=.07*low;hi[8]+=.15*low;hi[4]+=.3*high;return {lo,hi,tilt:L.tilt+1.1*high,low};}
// face point of a pose (plus bend x if given) in world coordinates, footwork offset included
function facePt(a,x,u,w,f){x=x||[0,0,0,0,0,0,0,0,0];
  const H=[a[qHX]+x[0]+S.bpos.x+a[qAX]+x[3],a[qHY]+x[1]+a[qAY]+x[4],a[qHZ]+x[2]+S.bpos.z+a[qAZ]+x[5]],d=V3.norm([a[qDX],a[qDY],a[qDZ]]),fn=faceN(d,a[qFC]);
  return V3.add(V3.add(V3.add(H,V3.sc(d,u)),V3.sc(V3.norm(V3.cross(fn,d)),w)),V3.sc(fn,f));}
function bend(a,T,u,w,f,L){
  const d0=V3.norm([a[qDX],a[qDY],a[qDZ]]),yw=Math.atan2(d0[0],d0[2]),pt=Math.asin(d0[1]),bp=S.bpos;
  const s0=[-Math.sin(a[qSR]),0,Math.cos(a[qSR])],x=[0,0,0,0,0,0,0,0,0],sq=v=>v*v,far=(p,q)=>sq(Math.max(0,Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])-.6));
  const dir=()=>{const y=yw+x[6],p=clamp(pt+x[7],-1.55,Math.min(.3,L.tilt-1.5708)),c=Math.cos(p);return [c*Math.sin(y),Math.sin(p),c*Math.cos(y)];};
  const cost=()=>{
    const hip=[a[qHX]+x[0]+bp.x,a[qHY]+x[1],a[qHZ]+x[2]+bp.z],Y=V3.norm([a[qLX],1,a[qLZ]+x[8]]),s=V3.norm(V3.sub(s0,V3.sc(Y,V3.dot(s0,Y)))),sh=V3.add(hip,V3.sc(Y,.5));
    const H=[hip[0]+a[qAX]+x[3],hip[1]+a[qAY]+x[4],hip[2]+a[qAZ]+x[5]],d=dir(),fn=faceN(d,a[qFC]),X=V3.norm(V3.cross(fn,d));
    const C=V3.add(V3.add(V3.add(H,V3.sc(d,u)),V3.sc(X,w)),V3.sc(fn,f)),dd=V3.sub(d,d0);
    return 100*(sq(C[0]-T[0])+sq(C[1]-T[1])+sq(C[2]-T[2]))+.5*(sq(x[0])+sq(x[2]))+sq(x[1])+.25*(sq(x[3])+sq(x[4])+sq(x[5]))+.08*V3.dot(dd,dd)+.3*sq(x[8])
      +400*(far(V3.add(H,V3.sc(d,HAND_AT[0])),V3.add(sh,V3.sc(s,.19)))+far(V3.add(H,V3.sc(d,HAND_AT[1])),V3.sub(sh,V3.sc(s,.19)))+sq(Math.max(0,.03-H[1]-.86*d[1])));};
  let c=cost(),st=.08;
  for(let n=0;n<300&&st>.002;n++){let imp=false;
    for(let i=0;i<9;i++)for(let sg=-1;sg<2;sg+=2){const v=x[i];x[i]=clamp(v+sg*st,L.lo[i],L.hi[i]);const c2=cost();if(c2<c){c=c2;imp=true;}else x[i]=v;}
    if(!imp)st*=.5;}
  const d=dir();for(let i=0;i<3;i++){a[qHX+i]+=x[i];a[qAX+i]+=x[3+i];a[qDX+i]=d[i];}a[qLZ]+=x[8];
  return x;}
function poseTick(){
  const B=S.bat,b=S.ball,ph=S.phase,cel=B.mode==='celebrate',fly=!cel&&!!b&&(ph==='flight'||ph==='result'),bt=fly?clock-b.start:0,tg=PB.tg;
  const fa=fly?footAt(b,S.bpos):null;
  footPose(tg,fly?b:null,fly?footProg(fa.t,bt):0,fa);
  let key='st',dur=.4,now=clock,sw=false;
  if(cel){now=performance.now()/1000;key='cel';dur=.45;poseSet(tg,UP.cel);tg[qAY]+=Math.sin(now*5)*.025;}
  else if(fly&&(B.mode==='swing'||B.mode==='block')){key='sw'+B.t0;sw=true;}
  else if(B.mode==='backlift'){key='bl'+B.t0;dur=.18;
    const k=S.aim?.55+.45*clamp(Math.hypot(S.aim.x-S.aim.x0,S.aim.y-S.aim.y0)/dragMax(),0,1):1;
    idlePose(tg,ph==='ready'||ph==='break'?1:0);PB.tmp.set(tg);poseSet(tg,UP.bl);for(let j=qAX;j<=qDZ;j++)tg[j]=PB.tmp[j]+(tg[j]-PB.tmp[j])*k;}
  else if(fly&&!S.swing&&(ph==='result'||bt>fa.t+.03)){key='lv';dur=.28;poseSet(tg,UP.leave);}
  else idlePose(tg,ph==='ready'||ph==='break'?1:ph==='runup'?clamp(1-S.t/(S.runupDur*.6),0,1):0);
  if(key!==PB.key){PB.from.set(PB.cur);PB.key=key;PB.sw=sw;PB.dur=dur;PB.t0=sw?B.t0:now;if(sw){if(B.mode==='block')blockKeys(b);else shotKeys(b,B.aim);aimSwing(b);}}
  if(sw&&!PB.fin&&S.swing&&S.swing.done)settleSwing();
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

/* --- materials and meshes --- */
const SKIN=[0.69,0.48,0.33],PAD=[.95,.95,.93],GLOVE=[.96,.96,.96],GRIP=[.2,.15,.1],GRILLE=[.34,.36,.4];
const col=(m,c)=>{if(typeof c==='string')m.color.set(c);else m.color.setRGB(c[0],c[1],c[2],THREE.SRGBColorSpace);return m;};
const std=(c,o)=>col(new THREE.MeshStandardMaterial(Object.assign({side:THREE.DoubleSide,roughness:.85},o)),c);
const bas=(c,map)=>col(new THREE.MeshBasicMaterial({side:THREE.DoubleSide,map:map||null}),c);
// players: a view-dependent rim in the sky colour (RIM, per planet) so they read against the grass
function kit(c,o){const m=std(c,o);
  m.onBeforeCompile=s=>{s.uniforms.uRim=RIM;s.fragmentShader='uniform vec3 uRim;\n'+s.fragmentShader.replace('#include <opaque_fragment>',
    'outgoingLight+=uRim*pow(1.-abs(dot(geometryNormal,geometryViewDir)),3.);\n#include <opaque_fragment>');};
  m.customProgramCacheKey=()=>'kit';return m;}
// flat ground layers are drawn first, in renderOrder, without depth and alpha-blended like the old engine.
// CustomBlending keeps them in three's opaque list: the transparent list would be drawn after the solids.
function flat(m,a=1,fog=true){return Object.assign(m,{depthTest:false,depthWrite:false,opacity:a,fog,blending:THREE.CustomBlending,
  blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor});}
function part(g,m,parent){const x=new THREE.Mesh(g,m);x.matrixAutoUpdate=false;(parent||T3.world).add(x);return x;}
let flatOrder=-100;
function layer(g,m){const x=part(g,m);x.renderOrder=flatOrder++;x.receiveShadow=true;return x;}
function canvasTex(c,repeat,data){const t=new THREE.CanvasTexture(c);t.flipY=false;t.colorSpace=data?THREE.NoColorSpace:THREE.SRGBColorSpace;
  t.anisotropy=Math.min(8,T3.r.capabilities.getMaxAnisotropy());if(repeat)t.wrapS=THREE.RepeatWrapping;if(repeat>1)t.wrapT=THREE.RepeatWrapping;return t;}
function paint(w,h,f){const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);return canvasTex(c,true);}
const painted=(f,repeat,data)=>{const c=document.createElement('canvas');f(c);return canvasTex(c,repeat,data);};
function rig(){const g=new THREE.Group();g.matrixAutoUpdate=false;T3.world.add(g);return g;}
const shade=o=>{o.traverse(m=>{m.castShadow=m.receiveShadow=true;});return o;};
const pair=f=>[f(),f()];
// fielder or bowler: 13 parts (legs, feet, torso, sleeves, forearms with hands, head with its features, one extra: cap or
// ring); geometry and materials are swapped per planet by spApply
function personRig(G){const g=rig(),P=SPG.earth,m=G.pm,p=(x,y)=>part(x,y,g);
  const r={g,thigh:pair(()=>p(P.thigh,m.pants)),shin:pair(()=>p(P.shin,m.pants)),foot:pair(()=>p(P.foot,m.shoe)),torso:p(G.torso,m.torso),
    uarm:pair(()=>p(P.uarm,m.shirt)),farm:pair(()=>p(P.farm,m.skin)),head:p(P.head,m.skin),ex:p(P.ex,m.ex)};shade(g);return r;}
let SPX=null;
function spApply(key){
  const G=G3,B=spBuild(SPECIES[key]?key:'earth'),P=SPX=B.P,m=G.pm,k=aiKit(),sk=m.skin,tc=m.torso.map.image,g=tc.getContext('2d');
  g.fillStyle=k.shirt;g.fillRect(0,0,16,64);g.fillStyle=k.pants;g.fillRect(0,0,16,14);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(0,13,16,1);m.torso.map.needsUpdate=true;
  sk.map=B.tex.map;sk.emissiveMap=B.tex.em;sk.roughnessMap=B.tex.rough;
  const ring=P.exM==='ring';col(m.ex,ring?'#f4dea2':k.shirt);m.ex.emissive.set(ring?'#c9a050':'#000');Object.assign(m.ex,{roughness:ring?.3:.88,metalness:ring?.4:0});
  for(const r of [...G.fielders,G.bowler]){
    for(let i=0;i<2;i++){r.thigh[i].geometry=B.thigh;r.shin[i].geometry=B.shin;r.foot[i].geometry=B.foot;r.uarm[i].geometry=B.uarm;r.farm[i].geometry=B.farm;
      r.thigh[i].material=P.legs==='skin'?sk:m.pants;r.shin[i].material=P.legs==='pants'?m.pants:sk;r.foot[i].material=P.feet==='skin'?sk:m.shoe;}
    r.head.geometry=B.head;r.ex.visible=!!B.ex;if(B.ex)r.ex.geometry=B.ex;}
}
function batterRig(){
  const k=KIT.you,g=rig(),p=(x,y)=>part(geo(x),y,g),pp=(x,y)=>{const q=geo(x);return pair(()=>part(q,y,g));},skin=kit(SKIN,{roughness:.6}),
    bar=(y,R,sp)=>arcG([0,y,0],R,[1,0,0],[0,0,1],H2-sp,H2+sp,.0055,14),vb=(th)=>arcG([0,-.03,0],.162,[0,1,0],[Math.sin(th),0,Math.cos(th)],1.2,2.25,.0055,10),
    shirtTex=paint(64,128,(x,w,h)=>{x.fillStyle=k.shirt;x.fillRect(0,0,w,h);x.fillStyle=k.trim;x.fillRect(0,h*.755,w,2);
      for(const o of [0,w]){x.beginPath();x.moveTo(o-9,h);x.lineTo(o,h*.87);x.lineTo(o+9,h);x.lineTo(o+5,h);x.lineTo(o,h*.91);x.lineTo(o-5,h);x.fill();}
      x.fillRect(0,h*.958,w,h*.025);x.fillStyle=k.shirt;x.fillRect(0,h*.985,w,h*.015);}),
    padTex=paint(128,8,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#c9cbc8';for(let i=1;i<7;i++)x.fillRect(i/14*w-1,0,2,h);}),
    shoeTex=paint(4,64,(x,w,h)=>{x.fillStyle='#f2f2f2';x.fillRect(0,0,w,h);x.fillStyle='#8a8f96';x.fillRect(0,0,w,h*.46);}),
    pants=kit(k.pants,{roughness:.9}),hm=kit(k.helmet,{roughness:.22,metalness:.1});
  const r={g,shoe:pp(shoeG(24,12),kit([1,1,1],{map:shoeTex,roughness:.6})),thigh:pp(capG(.088,.062,.43,20,6),pants),pad:pp(padG(70,24),kit(PAD,{map:padTex,roughness:.45})),
    pelvis:p(GB.surf(lin(12,0,1),28,(v,a)=>{const y=-.15+.26*v,[,w,d]=crv([[-.15,0,0],[-.14,.08,.07],[-.11,.145,.125],[-.04,.168,.145],[.04,.16,.14],[.1,.15,.13],[.11,0,0]],y);return [d*Math.cos(a),y,w*Math.sin(a)];}),pants),
    torso:p(torsoG(32,24),kit([1,1,1],{map:shirtTex,roughness:.88})),uarm:pp(capG(.054,.044,.31,18,6),skin),sleeve:pp(capG(.066,.06,.15,18,5),kit(k.shirt,{roughness:.88})),
    farm:pp(capG(.044,.034,.3,18,6),skin),glove:pp(capG(.042,.056,.09,18,6),kit(GLOVE,{roughness:.55})),neck:p(capG(.056,.05,.17,16,5),skin),
    head:p(GB.join(ellG([0,-.025,.005],[.098,.118,.108],24,14),ellG([0,-.035,.108],[.016,.026,.02],8,5)),skin),
    helmet:p(GB.join(GB.surf(lin(12,0,1),36,(v,a)=>{const s=Math.sin(a),lb=-.8+smooth(clamp((s+.35)/1.1,0,1)),l=lb+(H2-lb)*v,c=Math.cos(l);
        return [.132*c*Math.cos(a),.015+.14*Math.sin(l),-.005+(s>0?.142:.152)*c*s];}),
      ellG([0,.04,.09],[.128,.012,.1],24,6,.18),ellG([0,-.105,-.118],[.082,.032,.024],16,5,-.5),ellG([.128,-.005,.072],[.018,.028,.028],10,5),ellG([-.128,-.005,.072],[.018,.028,.028],10,5)),hm),
    grille:p(GB.join(bar(-.005,.158,1),bar(-.055,.156,.95),bar(-.1,.142,.85),vb(0),vb(.42),vb(-.42)),kit(GRILLE,{roughness:.35,metalness:.7})),
    handle:p(capG(.017,.017,.3-HTOP,12,3),kit(GRIP,{roughness:.8})),blade:p(bladeG(24,32),kit([1,1,1],{map:painted(paintWood),roughness:.5}))};
  shade(g);return r;
}
function buildScene(){
  const sph=geo(GB.sph(10,16)),cyl=geo(GB.cyl(12)),disk=geo(GB.disk(48)),plane=geo(GB.plane()),black=[0,0,0],glow=painted(paintGlow);
  const G={groundTex:canvasTex(GCV,false),pitchTex:canvasTex(PCV,false),adsTex:canvasTex(ADV,true),seatTex:canvasTex(SEV,true)};
  G.wide=layer(disk,flat(bas([1,1,1],canvasTex(WDV,false)),1,false));mT(G.wide,[0,0,0],1800,1,1800);
  // outfield: large-scale colour from the ground canvas, close-up grain from a tiled detail texture multiplied in, tiled normal map
  const gm=std([1,1,1],{map:G.groundTex,roughness:.92,normalMap:painted(paintGrassNormal,2,true),normalScale:new THREE.Vector2(.5,.5)});
  gm.normalMap.repeat.setScalar(90);DET.tDet.value=painted(paintGrassDetail,2,true);
  gm.onBeforeCompile=s=>{Object.assign(s.uniforms,DET);s.fragmentShader='uniform sampler2D tDet;uniform float uDetRep;\n'+s.fragmentShader.replace('#include <map_fragment>',
    '#include <map_fragment>\ndiffuseColor.rgb*=texture2D(tDet,vMapUv*uDetRep).rgb*2.;');};gm.customProgramCacheKey=()=>'grass';
  G.ground=layer(disk,flat(gm));
  G.ring=layer(new THREE.BufferGeometry(),flat(std([1,1,1],{roughness:.9}),.5));
  G.pitch=layer(plane,flat(std([1,1,1],{map:G.pitchTex,roughness:.8})));mT(G.pitch,[0,0,10.06],4,1,24);
  G.fsh=Array.from({length:NFL},()=>layer(disk,flat(bas(black,glow),.4,false)));
  G.mk=layer(disk,flat(bas([1,0.88,0.4]),.28,false));G.mkr=layer(geo(GB.ann(0.66,1,48,false)),flat(bas([1,0.88,0.4]),1,false));
  for(const m of [G.mk,G.mkr])m.material.toneMapped=false;
  G.arena=part(new THREE.BufferGeometry(),std([1,1,1],{vertexColors:true,roughness:.88}));
  G.seats=part(new THREE.BufferGeometry(),std([1,1,1],{map:G.seatTex,vertexColors:true,roughness:.7}));
  G.ads=part(new THREE.BufferGeometry(),std([1,1,1],{map:G.adsTex,emissiveMap:G.adsTex,emissive:0xffffff,emissiveIntensity:.5,roughness:.45}));
  G.panels=part(new THREE.BufferGeometry(),Object.assign(bas([1,1,1],painted(paintPanel)),{toneMapped:false}));
  G.halo=glowPoints(8,26,glow);G.fw=glowPoints(FW_MAX*3+400,2.1,glow);crowdMeshes();
  const cream=std([0.95,0.92,0.82],{roughness:.45}),bail=std([0.85,0.64,0.25],{roughness:.5}),stumps=()=>[cream,cream,cream,bail,bail].map(m=>shade(part(cyl,m)));
  G.stumps=[stumps(),stumps()];stumps3D(G.stumps[1],20.12,null);
  G.ball=shade(part(sph,std([1,1,1],{map:painted(paintBall),roughness:.38})));G.ball.receiveShadow=false;
  const e=spBuild('earth').tex;
  G.pm={shirt:kit(black,{roughness:.88}),pants:kit(black,{roughness:.9}),skin:kit([1,1,1],{map:e.map,emissiveMap:e.em,emissive:0xffffff,roughnessMap:e.rough,roughness:1}),
    shoe:kit([0.16,0.16,0.18],{roughness:.6}),ex:kit(black,{roughness:.88,emissive:0}),torso:kit([1,1,1],{roughness:.88,map:painted(c=>{c.width=16;c.height=64;})})};
  G.torso=geo(torsoG(14,10,[[-.09,0,0],[-.08,.12,.09],[-.04,.165,.11],...TORSO.slice(3)]));
  G.fielders=Array.from({length:NFL},()=>personRig(G));G.bowler=personRig(G);G.bat=batterRig();
  return G;
}

// a limb from a toward t, clamped to its reach, joint by IK toward the pole; bones keep the species' lengths
function limb(m1,m2,a,t,l1,l2,pole,side){
  const d=V3.sub(t,a),D=Math.hypot(d[0],d[1],d[2]),M=(l1+l2)*.999;if(D>M)t=V3.add(a,V3.sc(d,M/D));
  const k=ik(a,t,l1,l2,pole);mL(m1,a,k,l1,side);mL(m2,k,t,l2,side);return t;}
// dejected variants (lost the match): torso lean, head drop; arms hanging, hands on hips, hands on knees
const DEJ=[[.38,.95],[.24,.8],[.8,.4]];
function person3D(r,x,z,face,o,id=0,dj=0){
  const P=SPX,c=Math.cos(face),s=Math.sin(face),W=l=>[x+l[0]*c+l[2]*s,l[1],z-l[0]*s+l[2]*c],Wd=l=>[l[0]*c+l[2]*s,l[1],-l[0]*s+l[2]*c],R=Wd([1,0,0]),Fw=Wd([0,0,1]),U=[0,1,0];
  const ra=o.running?1:0,cr=o.crouch||0,dv=id%3,dl=DEJ[dv],rn=(o.run||0)*P.fq,sn=Math.sin(rn),cs=Math.cos(rn),L=P.th+P.sh,k=L/.93,AL=P.ua+P.fa,tw=P.tw,bw=o.arm!=null;
  const up=P.fl*ra*sn*sn+(bw?P.jp*Math.sin(Math.PI*clamp((o.arm-.4*Math.PI)/(.9*Math.PI),0,1)):0);
  const A=.34*k*P.st*ra,lf=.12*k*P.lf*ra,fw=.12*tw+cr*.06,hw=.1*tw,kd=dv===2?dj:0;
  const fL=[-fw,up+Math.max(0,cs)*lf,sn*A],fR=[fw,up+Math.max(0,-cs)*lf,-sn*A];
  let hy=up+P.an+L*(P.kn-ra*.08-cr*.1-kd*.1);
  for(const f of [fL,fR])hy=Math.min(hy,f[1]+P.an+Math.sqrt(Math.max(0,(L*.995)**2-f[2]**2-(fw-hw)**2)));
  [fL,fR].forEach((f,i)=>{const sd=i?1:-1,a=limb(r.thigh[i],r.shin[i],W([sd*hw,hy,0]),W([f[0],f[1]+P.an,f[2]]),P.th,P.sh,Wd([sd*.12,0,1]),R);
    mB(r.foot[i],[a[0],a[1]-P.an,a[2]],R,U,Fw);});
  const ln=P.hu+ra*.12+cr*.3+dj*dl[0],cl=Math.cos(ln),sl=Math.sin(ln),Yl=[0,cl,sl],hip=[0,hy,0],top=V3.add(hip,V3.sc(Yl,P.tor));
  mB(r.torso,W(hip),V3.sc(Wd([0,-sl,cl]),P.td),V3.sc(Wd(Yl),P.tor/.54),V3.sc(R,tw));
  const shy=P.tor*.926-dj*.04,slump=[0,-sl*dj*.06,cl*dj*.06];
  for(let i=0;i<2;i++){const sd=i?1:-1,S=V3.add(V3.add(V3.add(hip,V3.sc(Yl,shy)),slump),[sd*(.2*tw-dj*.02),0,0]);
    let t=[sd*.07,-AL*.93,.07],p=[sd*.3,0,-1];
    if(ra)t=V3.lerp(t,[sd*.03,-AL*.55,.12+sd*sn*.28*k],ra);
    if(cr){t=V3.lerp(t,[-sd*.02,-AL*.62,AL*.5],cr);p=V3.lerp(p,[sd,-.2,-.3],cr);}
    if(dj){const d=dv===0?[sd*.02,-AL*.97,.06]:V3.sub(dv===1?[sd*(.17*tw+.03),hy+.06,-.02]:[sd*fw,P.an+L*.55,L*.2],S);t=V3.lerp(t,d,dj);if(dv)p=V3.lerp(p,[sd,-.2,-.6],dj);}
    if(bw&&i===1){const a=o.arm,tr=clamp(2*Math.PI-Math.acos(clamp((S[1]-o.rel)/(AL+P.hd),-1,1)),Math.PI+.2,Math.PI+.8),th=a<=Math.PI?a*tr/Math.PI:tr+(a-Math.PI)*(2*Math.PI-tr)/Math.PI;
      t=[0,-Math.cos(th)*AL,-Math.sin(th)*AL];p=[1,0,0];}
    else if(bw)t=V3.lerp(V3.sc([-.07,.2,.62],AL),t,clamp((o.arm-Math.PI)/Math.PI,0,1));
    limb(r.uarm[i],r.farm[i],W(S),W(V3.add(S,t)),P.ua,P.fa,Wd(p),R);}
  const hq=P.nod+ln*.35+dj*dl[1],Uh=Wd([0,Math.cos(hq),Math.sin(hq)]),Fh=Wd([0,-Math.sin(hq),Math.cos(hq)]),T=W(V3.add(top,slump));
  mB(r.head,T,R,Uh,Fh);
  if(r.ex.visible){
    if(P.ring){const a=P.ring[1],ph=clock*.7+id,n=V3.norm(V3.add(V3.sc(Uh,Math.cos(a)),V3.sc(V3.add(V3.sc(R,Math.cos(ph)),V3.sc(Fh,Math.sin(ph))),Math.sin(a)))),
        e1=V3.norm(V3.cross(n,Fh)),e2=V3.cross(e1,n),ps=clock*1.6,X=V3.add(V3.sc(e1,Math.cos(ps)),V3.sc(e2,Math.sin(ps)));
      mB(r.ex,V3.add(T,V3.sc(Uh,P.ring[0]+.012*Math.sin(clock*2.3+id))),X,n,V3.cross(X,n));}
    else mB(r.ex,T,R,Uh,Fh);}
}
// 2-bone IK: joint on the circle where both bones meet, on the side of the pole vector; reach is capped so bones never stretch
function ik(a,t,l1,l2,pole){
  const d=V3.sub(t,a),L=Math.hypot(d[0],d[1],d[2])||1e-6,u=V3.sc(d,1/L),D=Math.min(L,l1+l2-1e-4),x=(l1*l1-l2*l2+D*D)/(2*D),h=Math.sqrt(Math.max(0,l1*l1-x*x));
  return V3.add(V3.add(a,V3.sc(u,x)),V3.sc(V3.norm(V3.sub(pole,V3.sc(u,V3.dot(pole,u)))),h));}
// blade face normal: azimuth ps (0 = toward the bowler, +90 = off side) made perpendicular to the blade; up if the blade points along it
function faceN(d,ps){const n=[Math.sin(ps),0,Math.cos(ps)],m=V3.sub(n,V3.sc(d,V3.dot(n,d)));return Math.hypot(m[0],m[1],m[2])>.25?V3.norm(m):V3.norm(V3.sub([0,1,0],V3.sc(d,d[1])));}
// batter joints of a pose (game coordinates). Index 0 = front side (left leg, left arm/top hand), 1 = back side. The
// procedural parts and the skinned skeleton (07-skin.js) are both placed from these; lengths match rig.py's HUMAN.
// grip points along the bat from the pose's hand point H (the bat anchor): top (left) hand at the top of the handle, bottom
// (right) hand touching it, just above the blade (0.28). Gloves are 0.09 long; the handle's rounded top starts at HTOP.
const HAND_AT=[.095,.18],HTOP=.055;
// right-hander's grip (gloves: tools/blender/batter.py glove_frame): the handle crosses each palm at GA to the forearm, the
// back of the hand at GF from the blade face toward the edge (fn x d): top hand toward the bowler, bottom hand's palm behind
// the handle. Fitted to the poses for the least wrist bend; the elbow then bends toward where the glove wants the forearm.
const GA=-30*D2R,GF=[-30*D2R,165*D2R];
const BJ={t:[],an:[],hj:[],kp:[],kn:[],fw:[],sole:[],sp:[],ap:[],hd:[],e:[],wa:[],gn:[]};
function batJoints(p){
  const J=BJ,hip=[p[qHX],p[qHY],p[qHZ]],ha=[-Math.sin(p[qHR]),0,Math.cos(p[qHR])];
  const Y=V3.norm([p[qLX],1,p[qLZ]]),s0=[-Math.sin(p[qSR]),0,Math.cos(p[qSR])],s=V3.norm(V3.sub(s0,V3.sc(Y,V3.dot(s0,Y)))),n=V3.cross(Y,s);
  Object.assign(J,{hip,ha,Y,s,n});
  const leg=(i,fx,fz,fr,ly,heel,side)=>{const t=[Math.cos(fr),0,Math.sin(fr)],an=[fx,.08+ly+heel*.05,fz],hj=V3.add(hip,V3.sc(ha,.1*side));hj[1]-=.04;
    const fw=V3.norm([t[0]*.24,-heel*.07,t[2]*.24]),kp=V3.add(t,V3.sc(ha,.25*side));
    J.t[i]=t;J.an[i]=an;J.hj[i]=hj;J.kp[i]=kp;J.kn[i]=ik(hj,an,.43,.43,kp);J.fw[i]=fw;J.sole[i]=V3.sub([fx+t[0]*.16,ly,fz+t[2]*.16],V3.sc(fw,.16));};
  leg(0,p[qFX],p[qFZ],p[qFR],p[qFLY],0,1);leg(1,p[qBX],p[qBZ],p[qBR],p[qBLY],p[qHL],-1);
  const sh=V3.add(hip,V3.sc(Y,.5)),H=[hip[0]+p[qAX],hip[1]+p[qAY],hip[2]+p[qAZ]],d=V3.norm([p[qDX],p[qDY],p[qDZ]]),fn=faceN(d,p[qFC]),m=V3.norm(V3.cross(fn,d));
  for(let i=0;i<2;i++){const side=i?-1:1,sp=V3.add(sh,V3.sc(s,.19*side)),hd=V3.add(H,V3.sc(d,HAND_AT[i])),
      N=V3.sc(V3.add(V3.sc(fn,Math.cos(GF[i])),V3.sc(m,Math.sin(GF[i]))),-side),wa=V3.sub(V3.sc(d,Math.cos(GA)),V3.sc(V3.cross(N,d),Math.sin(GA))),
      ap=V3.add(V3.sub(V3.sub(hd,V3.sc(wa,.3)),sp),[s[0]*.03*side,-.03,s[2]*.03*side]);
    J.sp[i]=sp;J.ap[i]=ap;J.hd[i]=hd;J.wa[i]=wa;J.gn[i]=N;J.e[i]=ik(sp,hd,.31,.3,ap);}
  const hv=V3.norm([Y[0]+p[qNOD]*.3,Y[1],Y[2]+p[qNOD]*.12]),hc=V3.add(V3.add(hip,V3.sc(Y,.54)),V3.sc(hv,.19)),yw=p[qHDY],f=[Math.sin(yw),0,Math.cos(yw)];
  const fw=V3.norm(V3.sub(f,V3.sc(hv,V3.dot(f,hv))));
  Object.assign(J,{sh,H,d,fn,hv,hc,face:fw,hx:V3.cross(hv,fw),nt:V3.sub(hc,V3.sc(hv,.06))});
  return J;}
// skin: the skinned model is shown, so only the bat is placed here
function batsman3D(B,p,skin){
  const J=batJoints(p),U=[0,1,0];
  if(!skin){
    for(let i=0;i<2;i++){const fw=J.fw[i],X=V3.norm(V3.cross(U,fw)),sp=J.sp[i],e=J.e[i],hd=J.hd[i],f=V3.norm(V3.sub(hd,e));
      mB(B.shoe[i],J.sole[i],X,V3.cross(fw,X),fw);mL(B.thigh[i],J.hj[i],J.kn[i],.43);mL(B.pad[i],J.an[i],J.kn[i],.43,J.t[i]);
      mL(B.uarm[i],sp,e,.31);mL(B.sleeve[i],sp,V3.lerp(sp,e,.48),.15);mL(B.farm[i],e,hd,.3);
      mL(B.glove[i],V3.sub(hd,V3.sc(f,.06)),V3.add(hd,V3.sc(f,.03)),.09);}
    mB(B.pelvis,J.hip,V3.cross(U,J.ha),U,J.ha);mB(B.torso,J.hip,J.n,J.Y,J.s);mL(B.neck,J.sh,J.nt,.17);
    for(const m of [B.head,B.helmet,B.grille])mB(m,J.hc,J.hx,J.hv,J.face);}
  const H=J.H,d=J.d,a=V3.add(H,V3.sc(d,.28)),b=V3.add(H,V3.sc(d,.86));
  mL(B.handle,V3.add(H,V3.sc(d,HTOP)),V3.add(a,V3.sc(d,.02)),.3-HTOP);
  mL(B.blade,a,b,.58,J.fn);
  return J;
}
// s = 3 stumps then 2 bails
function stumps3D(s,z,hit){
  const t=hit?hit.a:0;
  [-0.114,0,0.114].forEach((x,i)=>{const tilt=hit&&!hit.bails?Math.min(1,t*7)*[0.35,-0.5,0.55][i]:0;
    mSeg(s[i],[x,0,z],[x+Math.sin(tilt)*0.7,Math.cos(tilt)*0.71,z-Math.abs(tilt)*0.3],0.019);});
  if(!hit){s[3].visible=s[4].visible=true;mSeg(s[3],[-0.114,0.725,z],[0,0.725,z],0.011);mSeg(s[4],[0,0.725,z],[0.114,0.725,z],0.011);}
  else [-1,1].forEach((k,j)=>{const y=0.73+3.2*t-4.9*t*t,b=s[3+j];b.visible=y>=0;if(y<0)return;const px=k*(0.06+0.9*t),pz=z-1.2*t;mSeg(b,[px-0.05,y,pz],[px+0.05,y+0.02,pz],0.011);});
}
const BZR={pace:19.45,spin:19.6};
function bowlerState(){
  let z=S.bowlerZ,arm=null,run=0,running=false;const pace=M.bowlerType==='pace';
  if(S.phase==='runup'){const p=S.t/S.runupDur;z=lerp(pace?31:25.5,BZR[M.bowlerType],p);run=S.t*(pace?13:10);running=true;
    if(p>0.72)arm=lerp(0,Math.PI,(p-0.72)/0.28);}
  else if(S.phase==='ready'||S.phase==='break'){z=pace?31:25.5;}
  else if(S.phase==='flight'||S.phase==='result'){const t=S.phase==='flight'?clock-S.ball.start:S.t+0.8;
    z=Math.max(17.6,BZR[M.bowlerType]-t*2.4);arm=Math.min(2*Math.PI,Math.PI+t*12);run=t*8;running=t<0.9;}
  S.bowlerZ=z;return {z,arm,run,running};
}
/* --- view state: everything render3D/draw take from the game. Live frames are built here; a replay feeds recorded
   frames instead (08b-replay). New per-frame render state goes here AND into the recorded frame layout. --- */
const NFL=12,wideCam=()=>!!S.cel||S.phase==='replay';
const mkView=()=>({pose:null,ball:null,bo:{x:0,y:0,z:0},st:null,so:{a:0,bails:false},mk:null,bz:0,arm:null,brun:0,brn:false,
  nf:0,f:Array.from({length:NFL},()=>({on:false,x:0,z:0,face:0,run:0,running:false,crouch:0})),hideBat:false,trail:null,cheer:0,dej:0});
const LV=mkView(),CH={on:false,t0:-9},BO={};
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
  V.dej=S.cel?smooth(clamp((clock-S.cel.t0-.2)/.9,0,1)):0;
  V.hideBat=!!(S.chase&&clock>=S.chase.t0);V.trail=V.hideBat?S.trail3:null;
  // the crowd jumps once a boundary's ball crosses the rope (its outcome is no longer deferred) and through the win celebration
  const on=S.cel?clock-S.cel.t0>.4:ph==='result'&&!!S.res&&!!S.res.boundary&&!S.deferred;
  if(on!==CH.on){CH.on=on;CH.t0=clock;}
  V.cheer=on?Math.min(1,(clock-CH.t0)/.3):Math.max(0,1-(clock-CH.t0)/.6);
  return V;
}
/* --- adaptive quality: frame time is measured over the first seconds of a match (after a warm-up); while it is slow the tier
   steps down: shadow map size, then crowd count, then pixel ratio. No settings UI. --- */
const QT=[{sm:2048,crowd:1,dpr:2.5},{sm:1024,crowd:1,dpr:2.5},{sm:1024,crowd:.5,dpr:2.5},{sm:1024,crowd:.5,dpr:1.5}];
const Q={t:0,lock:false,last:0,warm:0,n:0,acc:0};
function glSize(){if(glOK){const d=Math.min(window.devicePixelRatio||1,QT[Q.t].dpr);T3.r.setSize(Math.round(W*d),Math.round(H*d),false);}}
function qApply(){
  if(!glOK)return;const q=QT[Q.t],sh=T3.sun.shadow;
  if(sh.mapSize.x!==q.sm){sh.mapSize.set(q.sm,q.sm);if(sh.map){sh.map.dispose();sh.map=null;}}
  crowdCount(q.crowd);glSize();
}
function qTick(){
  const now=performance.now(),dt=now-Q.last;Q.last=now;
  if(Q.lock||!M||S.paused||S.phase==='idle'||dt>250){Q.warm=Q.n=Q.acc=0;return;}
  if((Q.warm+=dt)<1200)return;
  Q.acc+=dt;if(++Q.n<90)return;
  if(Q.acc/Q.n>22&&Q.t<QT.length-1){Q.t++;qApply();Q.warm=Q.n=Q.acc=0;}else Q.lock=true;
}
/* --- shadows: the directional light's orthographic frustum is fitted each frame to the ground the camera sees (up to a far
   distance), in light space, so it works for the batting view, chase, replays and the wide celebration orbit alike.
   Casters project onto their own shadows in light space, so covering the visible ground covers them too. --- */
const SHB={x:[1,0,0],y:[0,1,0],x0:0,x1:0,y0:0,y1:0};
function fitShadow(d){
  const z=[-d[0],d[1],d[2]],x=V3.norm([z[2],0,-z[0]]),y=V3.cross(z,x),far=S.cel?Math.hypot(cam.x,cam.z)+BOUNDARY+12:wideCam()?60:46;
  const dn=Math.max(.5,H-HZ>1?cam.y*F/(H-HZ):.5);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(const dd of [dn,far])for(const sx of [-CX,W-CX]){const l=sx*dd/F,gx=-(cam.x+cam.fx*dd+cam.rx*l),gz=cam.z+cam.fz*dd+cam.rz*l,a=x[0]*gx+x[2]*gz,b=y[0]*gx+y[2]*gz;
    x0=Math.min(x0,a);x1=Math.max(x1,a);y0=Math.min(y0,b);y1=Math.max(y1,b);}
  const m=1.5,cx=(x0+x1)/2,cy=(y0+y1)/2,hw=(x1-x0)/2+m,hh=(y1-y0)/2+m,c=V3.add(V3.sc(x,cx),V3.sc(y,cy)),L=T3.sun,sc=L.shadow.camera;
  L.target.position.set(-c[0],c[1],c[2]);L.position.set(-(c[0]+z[0]*160),c[1]+z[1]*160,c[2]+z[2]*160);
  sc.left=-hw;sc.right=hw;sc.bottom=-hh;sc.top=hh;sc.updateProjectionMatrix();
  Object.assign(SHB,{x,y,x0:cx-hw+1,x1:cx+hw-1,y0:cy-hh+1,y1:cy+hh-1});
}
const inShadow=(gx,gz)=>{const a=-gx*SHB.x[0]+gz*SHB.x[2],b=-gx*SHB.y[0]+gz*SHB.y[2];return a>SHB.x0&&a<SHB.x1&&b>SHB.y0&&b<SHB.y1;};
const G3=glOK?buildScene():null;

function render3D(V){
  if(!glOK)return;
  const G=G3,bp=V.ball,pz=V.pose,mk=V.mk,lk=LOOK3D[curPlanet]||LOOK3D.earth;
  qTick();syncCamera();fitShadow(G.dir);crowdTick(V);fw3D(G.fw);
  if(lk.fog){const fo=wideCam()?Math.max(0,Math.hypot(cam.x,cam.z)+CAM_Z):0;T3.fog.near=lk.fog[1]+fo;T3.fog.far=lk.fog[2]+fo;}
  T3.scene.environmentIntensity=lk.env*(1+flash*2.5);
  G.wide.visible=wideCam();
  for(let i=0;i<NFL;i++){const p=V.f[i],on=!!M&&i<V.nf&&p.on;G.fielders[i].g.visible=on;G.fsh[i].visible=on&&!inShadow(p.x,p.z);
    if(on){mT(G.fsh[i],[p.x,0,p.z],.5,1,.5);person3D(G.fielders[i],p.x,p.z,p.face,p,i,V.dej);}}
  G.bowler.g.visible=!!M;
  if(M){const pc=M.bowlerType==='pace';Object.assign(BO,{running:V.brn,run:V.brun,arm:V.arm,rel:pc?2.2:2});person3D(G.bowler,(pc?.3:.22)+.2*SPX.tw,V.bz,Math.PI,BO,1,V.dej);}
  G.ball.visible=!!bp;
  if(bp)mT(G.ball,[bp.x,bp.y+0.05,bp.z],.05,.05,.05);
  G.mk.visible=G.mkr.visible=!!mk;
  if(mk){mT(G.mk,[mk.xb,0,mk.zb],0.24,1,0.24);mT(G.mkr,[mk.xb,0,mk.zb],0.26,1,0.26);}
  stumps3D(G.stumps[0],0,V.st);
  G.bat.g.visible=!V.hideBat;if(!V.hideBat){const J=batsman3D(G.bat,pz,SKN.on);if(SKN.on)skin3D(J);}
  T3.r.render(T3.scene,T3.cam);
}
if(location.hash==='#test')window.__r={info:()=>({calls:T3.r.info.render.calls,tris:T3.r.info.render.triangles}),tier:()=>Q.t,setTier:n=>{Q.t=n;Q.lock=true;qApply();}};

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
  if(!S.cel&&S.phase!=='replay'){drawAim();drawRadar(bp);drawTimingBar();drawInfo();}
}
