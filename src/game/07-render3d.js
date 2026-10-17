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
const RIM={value:new THREE.Color()},FILL={value:new THREE.Color()},DET={tDet:{value:null},uDetRep:{value:60}};
// camera-side fill on people (kit, peopleMat): the side a camera sees is often the one the sun doesn't light (the batting view
// sees the batter's back, the cordon camera his front), and under a black or dark sky (Moon, Mercury, Neptune) the sky light
// gives that side nothing, so players read as cut-outs. Scaled by how dark the sky is: zero on Earth, Venus, Mars, Saturn
const fillFor=(v,lk)=>{const c=FILL.value.set(v.sky[1]),l=c.r*.2126+c.g*.7152+c.b*.0722;return c.set(lk.sun[0]).multiplyScalar(Math.min(lk.sun[1],3.2)*.15*Math.max(0,1-l*lk.env/.35));};
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
  const v=VIS,R=BOUNDARY,r27=27*R/65,G=G3,lk=LOOK3D[curPlanet]||LOOK3D.earth;
  paintGround(GCV,v,R+7,R);G.groundTex.needsUpdate=true;paintPitch(PCV,v);G.pitchTex.needsUpdate=true;paintAds(ADV,v);G.adsTex.needsUpdate=true;
  DET.uDetRep.value=2*(R+7)/1.6;
  fillGeo(G.ring.geometry,GB.ann(r27-0.07,r27+0.07,120,true));mT(G.ground,[0,0,0],R+7,1,R+7);
  const A=arenaGeo(v,R);fillGeo(G.arena.geometry,A.o);fillGeo(G.ads.geometry,A.ad);fillGeo(G.seats.geometry,A.st);paintSeats(SEV,v);G.seatTex.needsUpdate=true;fillGeo(G.panels.geometry,A.pn);
  const hp=G.halo.geometry.attributes,gl=lk.glow;
  A.halo.forEach((p,i)=>{hp.position.array.set(p,i*3);hp.color.array.set([1,.93,.8,.55*gl],i*4);});
  G.halo.geometry.setDrawRange(0,A.halo.length);hp.position.needsUpdate=hp.color.needsUpdate=true;G.panels.material.color.setScalar(.45+.55*gl);
  crowdBuild(A.rows,v,R,A.screen);qApply();
  surround(WDV,v,lk,(R+7+1.15*v.standsH)/1800);G.wide.material.map.needsUpdate=true;CRWD.u.uHaze.value.set(lk.fog?lk.fog[0]:v.sky[1]);kitApply();
  const d=G.dir=sunDir(lk);T3.sun.color.set(lk.sun[0]);T3.sun.intensity=lk.sun[1];Object.assign(T3.sun.shadow,{intensity:lk.sh,radius:lk.shr});
  T3.r.toneMappingExposure=lk.exp;T3.scene.environmentIntensity=lk.env;RIM.value.set(v.sky[1]).multiplyScalar(lk.rim);fillFor(v,lk);envBuild(v,lk,d);
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

/* --- batter pose: feet, hips, spine, shoulders, hands (relative to hip), bat direction, head, blade face, kneel, and the
   top hand's offset from its grip point (zero on the handle; the non-striker's carry and the celebration punch take it off).
   Every change of target blends from the pose actually shown, so nothing snaps. Knees and elbows come from 2-bone IK at
   draw time (batJoints), the bend direction with hysteresis so a joint never flips. --- */
const PN=29,qFX=0,qFZ=1,qFR=2,qBX=3,qBZ=4,qBR=5,qHL=6,qHX=7,qHY=8,qHZ=9,qHR=10,qLX=11,qLZ=12,qSR=13,qAX=14,qAY=15,qAZ=16,qDX=17,qDY=18,qDZ=19,qNOD=20,qFLY=21,qBLY=22,qHDY=23,qFC=24,qKN=25,qTX=26,qTY=27,qTZ=28;
const PK=[['heel',qHL],['hr',qHR],['lx',qLX],['lz',qLZ],['sr',qSR],['nod',qNOD],['ffr',qFR],['fbr',qBR],['hd',qHDY],['fc',qFC],['kn',qKN]];
function poseSet(p,o){
  const v=(i,a)=>{if(a)for(let k=0;k<a.length;k++)p[i+k]=a[k];};
  v(qFX,o.ff);v(qBX,o.fb);v(qHX,o.hip);v(qAX,o.h);if(o.d)v(qDX,V3.norm(o.d));v(qTX,o.th);
  if(o.dh){p[qHX]+=o.dh[0];p[qHY]+=o.dh[1];p[qHZ]+=o.dh[2];}
  for(let j=0;j<PK.length;j++){const x=o[PK[j][0]];if(x!=null)p[PK[j][1]]=x;}
  return p;}
const BP={st:poseSet(new Float32Array(PN),{ff:[-.45,1.36,.15],fb:[-.45,.8,0],hip:[-.43,.85,1.06],hr:.1,lx:.28,lz:.04,sr:.15,h:[.16,.1,-.02],d:[.12,-1,.12],nod:.3,hd:.15,fc:.7})};
BP.fw=poseSet(new Float32Array(BP.st),{ff:[-.33,1.8,.55],fb:[-.47,.8,.1],heel:.35,hip:[-.38,.8,1.31],hr:.2,lx:.3,lz:.22,sr:.2,nod:.55});
BP.bk=poseSet(new Float32Array(BP.st),{ff:[-.38,1.18,.1],fb:[-.22,.6,-.1],hip:[-.32,.9,.9],hr:.05,lx:.18,lz:-.06,sr:.1,h:[.15,.12,-.02],nod:.2});
BP.tr=poseSet(new Float32Array(BP.st),{ff:[-.43,1.46,.2],fb:[-.38,.76,0],hip:[-.4,.87,1.1]});
// backlifts per shot family: toward first slip, hands at chest height; higher and more open for the cross-bat shots, short for a block
// The hands sit in front of the chest line (x) and beside or behind the back shoulder, never on the spine line behind the body:
// from there the top arm would have to pass through the chest. The top elbow points at the bowler, the bottom one back.
// The top arm stays bent (hands beside the back hip, not behind it: reach from the front shoulder ~.45), so its elbow can point at
// the bowler clear of the chest rather than the arm lying straight across it.
const BL={drive:{h:[.26,.4,-.16],d:[.16,.78,-.6],sr:.1,fc:1.1},block:{h:[.24,.3,-.14],d:[.22,.86,-.45],sr:.1,fc:1.1},
  pull:{h:[.28,.42,-.2],d:[.5,.68,-.55],sr:.05,fc:1.2},glance:{h:[.26,.4,-.16],d:[.3,.78,-.55],sr:.1,fc:1.1}};
const BLVIA=V3.norm([.15,.75,-.65]);
const UP={bl:BL.drive,
  block:{dh:[0,-.03,.04],h:[.2,.12,.19],d:[.1,-1,-.25],sr:.3,lx:.34,lz:.18,nod:1,fc:0},
  // the leave: bat lifted high to the off side, hands at chest-shoulder height, the head follows the ball (lookAt)
  leave:{h:[.38,.58,-.14],d:[.32,.84,-.44],sr:.2,lx:.2,nod:.25,fc:1.1},
  // between balls: upright, the bat grounded by the back foot
  relax:{hip:[-.43,.9,1.06],hr:.1,lx:.1,lz:.02,sr:.15,h:[.3,.06,.1],d:[.15,-.8,.55],nod:.15,hd:.15,fc:.7,heel:0},
  // the win: standing tall (knees soft), the bat overhead in both hands
  cel:{hip:[-.43,.97,1.06],ff:[-.41,1.25,.2],fb:[-.45,.88,-.1],heel:0,h:[.15,.78,-.11],d:[.1,.97,.1],sr:-.4,hr:-.2,lx:.02,lz:-.02,nod:-.45,hd:-.6,fc:0},
  // Tests: duck under a short ball at the body, sway back from one outside it, flinch when hit
  duck:{hip:[-.45,.56,.98],ff:[-.5,1.3,.3],fb:[-.42,.72,-.1],hr:.2,lx:.95,lz:-.1,sr:.1,h:[.12,-.08,-.22],d:[-.25,-.55,-.8],nod:1.25,hd:-.5,heel:.3,fc:1.2},
  sway:{dh:[-.12,-.06,-.14],lx:-.5,lz:-.3,sr:-.1,h:[-.02,.58,-.2],d:[-.15,.85,-.5],nod:-.3,hd:.5,fc:1.2},
  hit:{dh:[-.03,-.05,-.08],hr:-.25,sr:-.6,lx:.45,lz:-.3,h:[.2,.44,.16],d:[.3,.9,-.3],nod:1,hd:-1.1,fc:1.3}};
// per SHOTS entry: i impact, f follow (the fast wrap after impact), e finish (the slow settle), li/lf/le lofted overrides.
// Finishes keep the hands outside and forward of the helmet: the bat crosses behind the head, the arms never do.
const SH3=[
  // leg glance: the wrists roll and the bat goes to fine leg; the hands finish in front of the leading hip, never behind the body
  {i:{h:[.17,.16,.14],d:[.05,-1,-.05],sr:.25,hr:.15,lx:.3,nod:.7},f:{h:[-.02,.26,.28],d:[-.75,-.2,-.62],sr:.35,nod:.6},e:{h:[-.06,.3,.3],d:[-.7,-.4,-.58],sr:.35,nod:.5},
   li:{h:[.15,.285,.18],d:[.4,-.5,.6]},lf:{h:[0,.42,.26],d:[-.45,.3,-.8],sr:.3},le:{h:[-.04,.52,.22],d:[-.3,.6,-.74],sr:.3}},
  {i:{dh:[0,-.05,-.1],ff:[-.36,1.05,.2],fb:[-.14,.42,-.15],hr:.9,sr:1.1,h:[.31,.3,.18],d:[.75,-.3,.55],lx:.1,lz:-.08,nod:.3,ffr:.7,heel:0},
   f:{dh:[0,-.05,-.12],hr:1.2,sr:1.5,h:[0,.36,.2],d:[-.6,.1,-.8],lx:.02,lz:-.1,nod:.3,hd:-.6,ffr:.9,fbr:.4},
   e:{dh:[0,-.05,-.12],hr:1.3,sr:1.75,h:[-.3,.5,.1],d:[-.35,.45,-.82],lx:0,lz:-.12,nod:.35,hd:-.8,ffr:.9,fbr:.5},
   li:{h:[.3,.48,.18],d:[.7,.1,.6]},lf:{h:[-.04,.5,.18],d:[-.4,.55,-.73]},le:{h:[-.32,.66,.1],d:[-.2,.65,-.73],lz:-.18}},
  {i:{dh:[0,-.04,.08],h:[.22,.2,.24],d:[0,-1,.18],sr:.4,hr:.25,lz:.4,nod:.7,heel:.7},f:{h:[.08,.3,.32],d:[-.55,.3,.72],sr:.5,hr:.3,nod:.6},e:{h:[-.1,.42,.36],d:[-.75,-.2,-.62],sr:.55,hr:.4,nod:.5,hd:-.3},
   lf:{h:[.02,.44,.3],d:[-.5,.7,.5],lz:.05},le:{h:[-.12,.55,.36],d:[-.55,.68,-.45],lz:0}},
  {i:{dh:[0,-.08,.2],h:[.22,.14,.26],d:[.08,-1,-.05],sr:.45,hr:.3,lx:.28,lz:.8,nod:1,heel:1.2},f:{h:[.12,.3,.5],d:[.1,.6,.8],sr:.55,lz:.35,heel:1.1,nod:.6},
   e:{h:[-.06,.52,.42],d:[-.38,.6,-.7],sr:.6,lz:.22,heel:.8,nod:.5,hd:-.3},
   li:{dh:[0,0,.03]},lf:{h:[.1,.42,.5],d:[.1,.85,.5],sr:.65},le:{sr:.75,lx:.12,lz:.05,h:[-.02,.84,.34],d:[-.4,-.05,-.92]}},
  {i:{dh:[0,-.08,.18],h:[.3,.135,.22],d:[.25,-.97,0],sr:.45,hr:.3,lx:.36,lz:.75,nod:1,heel:1.2,ffr:.7},f:{h:[.25,.3,.44],d:[.55,.6,.58],sr:.55,lz:.3,heel:1.1,nod:.6},
   e:{h:[-.05,.52,.42],d:[-.35,.6,-.7],sr:.65,lz:.2,heel:.8,nod:.5,hd:-.3},
   li:{dh:[0,0,.03]},lf:{h:[.2,.42,.44],d:[.5,.82,.3],sr:.65},le:{sr:.8,lx:.15,lz:.05,h:[-.06,.64,.36],d:[-.28,.74,-.6]}},
  {i:{dh:[.06,0,-.1],ff:[-.38,1.0,.15],fb:[-.1,.45,-.05],h:[.58,.14,.04],d:[.75,-.45,-.35],sr:.35,hr:.2,lx:.35,lz:-.05,nod:.5},
   f:{h:[.5,.36,.1],d:[.5,.3,-.8],sr:.5,nod:.2,hd:.4},e:{h:[.42,.44,-.08],d:[.3,.72,-.62],sr:.55,nod:.3,hd:.5},
   li:{h:[.45,.45,.08],d:[.8,-.1,-.4]},lf:{h:[.46,.5,-.14],d:[.45,.6,-.65]},le:{h:[.38,.6,-.24],d:[.2,.8,-.56],lz:-.12}},
  {i:{dh:[0,-.06,-.05],h:[.27,.06,-.02],d:[.4,-.88,-.3],sr:.2,lx:.4,nod:.8},f:{h:[.3,.18,-.14],d:[.6,.1,-.8],sr:.25,nod:.7,hd:.4},e:{h:[.28,.32,-.16],d:[.4,.45,-.8],sr:.3,nod:.5,hd:.5},
   li:{h:[.22,.32,.05],d:[.3,-.2,-.9]},lf:{h:[.24,.4,-.04],d:[.3,.3,-.9]},le:{h:[.2,.5,-.06],d:[.3,.55,-.78]}}];
// Tests' sweeps (SWEEPS in logic.js): down on the back knee, front leg bent, bat flat across the line in front of the front pad;
// the reverse sweep brings the bat back the other way with the face turned to the off side (faceFor). Same keys as SH3, plus l: the
// crouch while the player aims a sweep (the backlift), so the batter is already down when the swing starts. The back knee is put on
// the ground by batJoints (qKN), so the hip height here only sets the thigh's lean.
const SWK={ff:[-.3,1.97,1],fb:[-.62,.78,-1.5708],hip:[-.5,.55,1.22],heel:1,kn:1,hr:.5,lx:.35,lz:1,nod:1};
const SW3={Sweep:{i:{...SWK,sr:.55,h:[.12,-.03,.59],d:[.6,-.2,.77],hd:.1},f:{sr:.85,h:[.0,.12,.5],d:[-.75,.15,-.64],nod:.9,hd:-.25},e:{sr:.9,h:[-.04,.3,.4],d:[-.62,.4,-.6],nod:.8,hd:-.3},
    lf:{sr:1,h:[-.04,.4,.34],d:[-.5,.55,-.6]},le:{sr:1.05,h:[-.08,.62,.24],d:[-.4,.78,-.45],nod:.55,hd:-.45,lz:.8},l:{...SWK,lz:.5,sr:.15,h:[.2,.38,.42],d:[.5,.7,-.5],hd:.15}},
  'Reverse sweep':{i:{...SWK,sr:.35,h:[.32,.1,.56],d:[.3,-.2,.93],hd:.15},f:{sr:.25,h:[.36,.12,.38],d:[.75,.15,-.64],nod:.9,hd:.3},e:{sr:.15,h:[.4,.24,.3],d:[.76,.32,-.56],nod:.8,hd:.4},
    lf:{sr:.1,h:[.4,.4,.28],d:[.6,.55,-.58]},le:{sr:.05,h:[.38,.55,.2],d:[.55,.72,-.42],nod:.6,hd:.5},l:{...SWK,lz:.5,sr:.6,h:[.38,.36,.42],d:[.1,.8,-.6],hd:0}}};
/* the swing: from = the pose shown when the swing started (the top of the backlift), a = impact (bit-exact at t0 + SWING_DELAY),
   b = follow (the fast wrap just after impact), e = finish (the slow settle). The bat's angular speed is continuous through
   impact: the downswing accelerates to w = 1.7 * angle / SWING_DELAY, the follow starts at that speed and decelerates (a
   cubic in the bat angle: d1, m0, m1 from swingTiming), the finish starts at the follow's residual speed and runs out. o: the
   previous keys fading out by impact, or n: the result's re-aimed keys fading in over the 60 ms after it (xt, xd). */
const PB={key:'',sw:false,t0:0,dur:.4,fd:.3,from:new Float32Array(PN),cur:new Float32Array(BP.st),tg:new Float32Array(PN),tmp:new Float32Array(PN),tmp2:new Float32Array(PN),out:new Float32Array(PN),
  a:null,b:null,e:null,d1:.1,d2:.3,m0:0,m1:0,P1:1,pw:1.7,o:null,n:null,xt:-1e9,xd:.06,ax:[1,0,0],upT:0};
const smooth=u=>u*u*(3-2*u);
function batAngleNow(){return new Float32Array(PB.cur);}
// trigger step: weights by the length met after footwork (full is high for short balls), toward the line of the ball relative
// to the batter, done well before contact. BP.fw/bk/tr feet match FOOT in logic.js, which places the pads for LBW.
function footPose(out,b,p,fa){
  out.set(BP.st);if(!b)return out;
  fa=fa||footAt(b,S.bpos);const [wf,wb,wt]=strideW(fa.full),e=smooth(p),ef=smooth(clamp((p-.15)/.7,0,1)); // the feet lift before they travel
  for(let i=0;i<PN;i++){const k=i<=qBR?ef:e;out[i]+=k*(wf*(BP.fw[i]-BP.st[i])+wb*(BP.bk[i]-BP.st[i])+wt*(BP.tr[i]-BP.st[i]));}
  out[qFX]+=ef*(wf*clamp(fa.xc*.45,-.12,.25)+wt*clamp(fa.xc*.3,-.1,.15));out[qBX]+=ef*wb*clamp(fa.xc*.3,-.1,.15);
  // a foot that travels clears the ground by 3.5 cm at least, however small its share of the step (a 6 mm lift read as a slide)
  const lift=Math.sin(Math.PI*p),trav=(i,j)=>Math.hypot(wf*(BP.fw[i]-BP.st[i])+wb*(BP.bk[i]-BP.st[i])+wt*(BP.tr[i]-BP.st[i]),wf*(BP.fw[j]-BP.st[j])+wb*(BP.bk[j]-BP.st[j])+wt*(BP.tr[j]-BP.st[j])),
    amp=(a,d)=>d>.003?Math.max(.035,a):a;
  out[qFLY]+=lift*amp(.09*wf+.045*wt,trav(qFX,qFZ));out[qBLY]+=lift*amp(.065*wb+.05*wf+.04*wt,trav(qBX,qBZ));
  return out;}
function footProg(tI,bt){const te=Math.max(.12,Math.min(tI*.6,tI-.2));return clamp((bt-.04)/(te-.04),0,1);}
// footwork gait: a chasse, one foot at a time stepping to just ahead of where the body is heading, so planted feet never slide.
// Once a swing has started the step in progress finishes by impact, so the drawn hip is exactly the pose's hip + bpos there.
// per foot (0 front, 1 back): offset f/b, step progress u (-1 planted), start a, landing g, duration; mv = a foot stepping (-1 none);
// lf = each foot's lift (lift = the higher); vx/vz the body's filtered velocity
const FT={f:[0,0],b:[0,0],mv:-1,last:1,u:[-1,-1],a:[[0,0],[0,0]],g:[[0,0],[0,0]],dur:[.14,.14],la:[.06,.06],lf:[0,0],lift:0,t:0,px:0,pz:0,vx:0,vz:0};
function feetTick(){
  const dt=clamp(clock-FT.t,0,.1),p=S.bpos,P=[FT.f,FT.b];FT.t=clock;
  if(dt>0&&Math.hypot(p.x-FT.px,p.z-FT.pz)>.15){FT.f[0]=FT.b[0]=p.x;FT.f[1]=FT.b[1]=p.z;FT.u[0]=FT.u[1]=-1;FT.vx=FT.vz=0;} // a reset, not a walk: the feet go with it
  else if(dt>0){const k=Math.min(1,dt*15);FT.vx+=((p.x-FT.px)/dt-FT.vx)*k;FT.vz+=((p.z-FT.pz)/dt-FT.vz)*k;}FT.px=p.x;FT.pz=p.z;
  const sw=!!S.swing,thr=sw?.01:.06,other=FT.u[0]>=0?0:FT.u[1]>=0?1:-1;
  // a foot steps when it is behind the body; the second may leave once the first is 70% down (a quick shuffle has both up for a moment)
  if(other<0||FT.u[other]>.5&&FT.u[1-other]<0){
    const beh=[0,1].map(i=>Math.hypot(p.x-P[i][0],p.z-P[i][1])),cand=[0,1].filter(i=>FT.u[i]<0&&beh[i]>thr&&i!==other);
    if(cand.length){const k=cand.length===2?(FT.vz<0?1:0):cand[0];FT.u[k]=0;FT.a[k]=P[k].slice();
      // the step lands where the body will be half way through it; its duration keeps the foot under ~6.5 m/s at its fastest
      let dur=sw?.05:clamp(beh[k]/2.5,.1,.16),g=[sw?p.x:p.x+FT.vx*dur*.5,sw?p.z:p.z+FT.vz*dur*.5];
      if(!sw){dur=clamp(Math.hypot(g[0]-FT.a[k][0],g[1]-FT.a[k][1])/3.3,.1,.22);g=[p.x+FT.vx*dur*.5,p.z+FT.vz*dur*.5];}FT.dur[k]=dur;FT.g[k]=g;FT.la[k]=sw?.04:.06;} // the lift is fixed at the step's start: a swing starting mid-step must not drop the foot
  }
  for(let i=0;i<2;i++){FT.lf[i]=0;if(FT.u[i]<0)continue;
    FT.u[i]=Math.min(1,FT.u[i]+dt/FT.dur[i]);const u=FT.u[i],e=MO.trav(u),F=P[i];
    F[0]=lerp(FT.a[i][0],FT.g[i][0],e);F[1]=lerp(FT.a[i][1],FT.g[i][1],e);FT.lf[i]=Math.sin(Math.PI*u)*FT.la[i];
    if(u>=1){FT.last=i;FT.u[i]=-1;FT.lf[i]=0;}}
  FT.lift=Math.max(FT.lf[0],FT.lf[1]);FT.mv=FT.u[0]>=0?0:FT.u[1]>=0?1:-1;
}
// idle life in the stance: weight shifts foot to foot, knees breathe, a bat tap; amplitude a
function idlePose(p,a){
  if(a<=0)return;const w=clock,tap=Math.pow(Math.max(0,Math.sin(w*1.7)),8)*a;
  p[qHY]+=Math.sin(w*2.1)*.008*a;p[qLX]+=Math.sin(w*2.1+.6)*.02*a;p[qHZ]+=Math.sin(w*.75)*.025*a;p[qHX]+=Math.sin(w*.75+.4)*.012*a;
  p[qSR]+=Math.sin(w*.75)*.03*a;p[qAY]+=tap*.05;p[qDZ]-=tap*.12;p[qAZ]-=tap*.02;}
// the shot the logic plays for this aim and ball: sweeps only in Tests (shotForBall), at the length met after footwork
const shotOf=(aim,b)=>M&&M.sc&&b?shotForBall(aim,b,footAt(b,S.bpos).full):shotFor(aim);
const famOf=sh=>sh.sweep?'sweep':SHOT_FAM[SHOTS.indexOf(sh)]||'drive';
// the hands of a key stay in front of the chest: a finish that wraps the bat over the shoulder puts the hands beside the front
// shoulder, and from there the bottom arm would cross the chest unless the hands are at least `min` ahead of the chest plane
// (the pose's lean and shoulder turn included). Shifts the bat anchor along the chest's normal.
function frontClamp(p,min=.18){
  const Y=V3.norm([p[qLX],1,p[qLZ]]),s0=[-Math.sin(p[qSR]),0,Math.cos(p[qSR])],s=V3.norm(V3.sub(s0,V3.sc(Y,V3.dot(s0,Y)))),n=V3.cross(Y,s),sh=V3.sc(Y,.5),d=V3.norm([p[qDX],p[qDY],p[qDZ]]);
  let dm=9;for(let i=0;i<2;i++){const hd=[p[qAX]+d[0]*HAND_AT[i]-sh[0],p[qAY]+d[1]*HAND_AT[i]-sh[1],p[qAZ]+d[2]*HAND_AT[i]-sh[2]];dm=Math.min(dm,V3.dot(hd,n));}
  if(dm<min){const k=min-dm;p[qAX]+=n[0]*k;p[qAY]+=n[1]*k;p[qAZ]+=n[2]*k;}return p;}
// the keys of a shot: a = impact (from the trigger step), b = follow, e = finish, scaled from a by the swing's power
function shotKeys(b,aim){
  const sw=S.swing||{},L=!!sw.lofted,sh=shotOf(aim,b),sp=sh.sweep?SW3[sh.name]:SH3[SHOTS.indexOf(sh)]||SH3[3],a=footPose(new Float32Array(PN),b,1);
  poseSet(a,sp.i);if(L&&sp.li)poseSet(a,sp.li);
  const f=poseSet(new Float32Array(a),sp.f);if(L&&sp.lf)poseSet(f,sp.lf);
  const e=poseSet(new Float32Array(f),sp.e);if(L&&sp.le)poseSet(e,sp.le);
  // drives follow through along the shot: the bat points up the line of the shot before it wraps over the front shoulder
  if(sp===SH3[3]||sp===SH3[4]){const s=Math.sin(aim*D2R),c=Math.cos(aim*D2R);poseSet(f,{h:[.12+.2*s,L?.4:.3,.25+.25*c],d:[.55*s,L?.85:.62,.55*c]});}
  a[qFLY]=a[qBLY]=f[qFLY]=f[qBLY]=e[qFLY]=e[qBLY]=0;
  const k=.55+.45*(sw.power||.7);for(let j=0;j<PN;j++){f[j]=a[j]+(f[j]-a[j])*k;e[j]=a[j]+(e[j]-a[j])*k;}
  frontClamp(f);frontClamp(e);
  PB.a=a;PB.b=f;PB.e=e;PB.fd=L?.42:.32;PB.pw=1.7;}
// a block: a controlled downswing (pw: the bat meets the ball at 1.25x its mean speed, a drive's whip is 1.7x) and soft hands,
// the bat pushed on a short way to the front pad after impact
function blockKeys(b){const a=footPose(new Float32Array(PN),b,1);poseSet(a,UP.block);a[qFLY]=a[qBLY]=0;PB.a=a;PB.b=poseSet(new Float32Array(a),{dh:[0,0,.03],h:[.21,.1,.26],d:[.25,-.86,.42]});PB.e=poseSet(new Float32Array(PB.b),{h:[.2,.11,.25],d:[.22,-.88,.4]});frontClamp(PB.b);frontClamp(PB.e);PB.fd=.3;PB.pw=1.25;}
/* contact targeting: the impact pose is bent so the blade meets the ball at tc. The contact point sw.cp is on the ball's path,
   clamped to where the batter can reach; ballNow time-warps the last SWING_DELAY of the delivery so the ball is there at tc.
   The kind is guessed from timing at swing start and settled at resolution (mishits are random), before tc is drawn. */
const BK={mid:[.63,0],block:[.6,0],edge:[.6,.05],toe:[.8,.02],top:[.36,.03],miss:[.63,0]};
function aimSwing(b){
  const sw=S.swing;PB.a0=PB.a;PB.b0=PB.b;PB.e0=PB.e;PB.fin=!sw||!M;if(PB.fin){swingTiming();return;}
  const fa=footAt(b,S.bpos),dt=sw.tc-fa.t,a=Math.abs(dt),sh=shotOf(sw.aim,b),T=M.st&&M.st.bat&&TIER[M.st.bat[M.st.s].tier];
  const w=windows(physD(),dt<0,(1+.35*fa.gain)*(T?sw.defend?Math.pow(T.win,.3):T.win*(sh.sweep?sh.tw:1):1));
  const hit=fa.xc<.98&&fa.xc>REACH_LEG&&fa.c.y<2.05&&a<=w.edge&&!(b.onStumps&&!padHit(b,S.bpos)&&b.tStumps<sw.tc);
  const k=!hit?'miss':a>w.ok?'edge':sw.defend?'block':'mid',L=PB.L=sw.defend?FAM.block:sw.lofted&&famOf(sh)==='drive'?FAM.loft:FAM[famOf(sh)],N=facePt(PB.a0,[0,0,0,0,0,0,0,0,0],.63,0,0);
  const pv=t=>{const q=ballPos(b,t);return [q.x,q.y+.05,q.z];},T0=sw.tc-.05,T1=sw.tc+.14;
  let t=clamp(tAt(b,clamp(ballPos(b,sw.tc).z,N[2]+L.zw[0],N[2]+L.zw[1])),T0,T1);
  PB.P=pv(t);PB.xc=fa.xc;aimBat(k,sw.defend?-1:1,sw.aim+clamp(dt*300,-60,60));
  // out of reach within the shot's natural shape: meet the ball where the path passes closest to the blade instead
  for(let i=0;hit&&i<3&&V3.dist(PB.C,PB.P)>.006;i++){let bt=t,bd=9;for(let s=T0;s<=T1;s+=.004){const e=V3.dist(pv(s),PB.C);if(e<bd){bd=e;bt=s;}}
    if(Math.abs(bt-t)<.002)break;t=bt;PB.P=pv(t);aimBat(k,PB.es,PB.dir);}
  if(hit){sw.cp=ballPos(b,t);sw.dl=t-sw.tc;}
  swingTiming();}
// the result re-aims the blade (an edge, a top edge, a changed direction) and the shown pose cross-fades over 60 ms. The result
// arrives at the contact time, so the keys shown at impact stay the ones the swing started with (bit-exact) and the new keys
// (PB.n) fade in after it; a result known before impact fades the old keys (PB.o) out by impact instead.
const keysOf=()=>({a:PB.a,b:PB.b,e:PB.e,d1:PB.d1,d2:PB.d2,m0:PB.m0,m1:PB.m1,P1:PB.P1,ax:PB.ax.slice(),pw:PB.pw});
function settleSwing(){
  const sw=S.swing,r=S.res,k=sw.missed?'miss':!r?PB.k:batKind(r)==='edge'&&S.timing&&S.timing.mishit?'toe':batKind(r),es=r&&r.dir>0?1:-1;PB.fin=true;
  const dir=r&&r.dir!=null&&k!=='edge'&&k!=='block'?r.dir:PB.dir;
  if(k!==PB.k||(k==='edge'&&es!==PB.es)||Math.abs(dir-PB.dir)>3){
    const ti=PB.t0+SWING_DELAY,old=keysOf();PB.xt=clock;
    aimBat(k,es,dir);
    // the feet keep the swing's own keys (capStep, the step taken): a re-aimed bat never makes the planted feet hop
    for(const q of ['a','b','e'])for(const j of [qFX,qFZ,qFR,qBX,qBZ,qBR,qFLY,qBLY,qHL])PB[q][j]=old[q][j];
    swingTiming();
    if(clock<ti-1e-6){PB.o=old;PB.xd=ti-clock;}else{PB.n=keysOf();Object.assign(PB,old);PB.xd=.06;}}}
// face normal azimuth at impact: between the incoming ball and the shot direction, so the face meets the ball and sends it
// that way; edges keep it toward the ball, a block points it straight back down the pitch
const faceFor=(k,dir)=>D2R*(k==='block'?0:k==='edge'?.3*clamp(dir,-60,60):clamp(.75*dir,-85,85));
function aimBat(k,es,dir){
  const P=PB.P,[u0,w]=BK[k==='top'&&P[1]<.35?'toe':k],L=shapeFor(PB.L,P[1]),u=Math.min(.84,u0+(k==='mid'||k==='block'||k==='edge'?.25*L.low:0));
  PB.k=k;PB.es=es;PB.dir=dir;const fc=faceFor(k,dir),fresh=()=>(PB.a=new Float32Array(PB.a0),PB.b=new Float32Array(PB.b0),PB.e=new Float32Array(PB.e0),PB.a[qFC]=PB.b[qFC]=PB.e[qFC]=fc);fresh();let x=bend(PB.a,P,u,w*es,.05,L);
  if(k==='miss'){const n=V3.norm(V3.cross([PB.a[qDX],PB.a[qDY],PB.a[qDZ]],[0,0,1])),sg=Math.sign(V3.dot(n,[PB.xc<-.2?1:-1,1.2,0]))||1;let best=-1,bx;
    for(const m of [V3.sc(n,.25*sg),V3.sc(n,-.25*sg),V3.sc(n,.45*sg),V3.sc(n,-.45*sg),[0,.45,0],[0,-.35,0]]){fresh();x=bend(PB.a,V3.add(P,m),u,0,0,L);swingTiming();const g=sweepGap();if(g>best){best=g;bx=[x,PB.a,PB.b,PB.e];}if(g>.03)break;}
    if(bx)[x,PB.a,PB.b,PB.e]=bx;}
  [[PB.b,.5],[PB.e,.2]].forEach(([q,kq])=>{for(let i=0;i<3;i++){q[qHX+i]+=x[i];q[qAX+i]+=x[3+i]*kq*(i===1&&x[4]>0?.5:1);}q[qLZ]+=x[8];q[qSR]+=x[10];
    const d0=V3.norm([q[qDX],q[qDY],q[qDZ]]),yw=Math.atan2(d0[0],d0[2])+x[6]*kq,pt=clamp(Math.asin(d0[1])+x[7]*kq,-1.55,1.55),cp=Math.cos(pt);q[qDX]=cp*Math.sin(yw);q[qDY]=Math.sin(pt);q[qDZ]=cp*Math.cos(yw);});
  reachClamp(PB.b);reachClamp(PB.e);
  PB.u=u+(x[9]||0);PB.C=facePt(PB.a,null,PB.u,w*es,.05);}
// the arms of a pose stay bent: a glove further than .56 from its shoulder (straight is .61) draws the bat anchor (both hands)
// back toward that shoulder. Used between keys (mixPose) and on the follow/finish keys after the contact solver shifts them.
function reachOf(p){const Y=V3.norm([p[qLX],1,p[qLZ]]),s0=[-Math.sin(p[qSR]),0,Math.cos(p[qSR])],s=V3.norm(V3.sub(s0,V3.sc(Y,V3.dot(s0,Y)))),d=V3.norm([p[qDX],p[qDY],p[qDZ]]);let m=0;
  for(let i=0;i<2;i++){const sp=V3.add(V3.sc(Y,.5),V3.sc(s,.19*(i?-1:1)));m=Math.max(m,Math.hypot(p[qAX]+d[0]*HAND_AT[i]-sp[0],p[qAY]+d[1]*HAND_AT[i]-sp[1],p[qAZ]+d[2]*HAND_AT[i]-sp[2]));}return m;}
function reachClamp(p,lim=.56){
  const Y=V3.norm([p[qLX],1,p[qLZ]]),s0=[-Math.sin(p[qSR]),0,Math.cos(p[qSR])],s=V3.norm(V3.sub(s0,V3.sc(Y,V3.dot(s0,Y)))),d=V3.norm([p[qDX],p[qDY],p[qDZ]]);
  for(let n=0;n<3;n++){let moved=false;for(let i=0;i<2;i++){const sp=V3.add(V3.sc(Y,.5),V3.sc(s,.19*(i?-1:1))),g=[p[qAX]+d[0]*HAND_AT[i]-sp[0],p[qAY]+d[1]*HAND_AT[i]-sp[1],p[qAZ]+d[2]*HAND_AT[i]-sp[2]],L=Math.hypot(g[0],g[1],g[2]);
      if(L>lim){const k=(L-lim)/L;p[qAX]-=g[0]*k;p[qAY]-=g[1]*k;p[qAZ]-=g[2]*k;moved=true;}}if(!moved)break;}
  return p;}
// angle between two poses' bat directions
const batAng=(p,q)=>{const a=V3.norm([p[qDX],p[qDY],p[qDZ]]),b=V3.norm([q[qDX],q[qDY],q[qDZ]]);return Math.acos(clamp(V3.dot(a,b),-1,1));};
// the follow-through's timing from the keys: the downswing's speed at impact w (pw x the mean, its ease is s^pw: 1.7 for a shot,
// 1.25 for a block), the follow over d1 from w down to the finish's start speed wr (a cubic in the bat angle, tangents capped so
// it never overshoots), the finish over d2 from wr to rest. The swing plane's axis (ax) is the slerp's hint when a key turns the
// bat right round.
function swingTiming(){
  const th1=Math.max(.4,batAng(PB.from,PB.a)),w=PB.pw*th1/SWING_DELAY,P1=Math.max(.25,batAng(PB.a,PB.b)),P2=Math.max(.15,batAng(PB.b,PB.e)),d2=PB.fd,wr=2*P2/d2;
  const d1=clamp(2.2*P1/w,.06,.25);PB.d1=d1;PB.d2=d2;PB.P1=P1;PB.m0=Math.min(w*d1,2.9*P1);PB.m1=Math.min(wr*d1,2.9*P1);
  const ax=V3.cross([PB.from[qDX],PB.from[qDY],PB.from[qDZ]],[0,0,-1]);PB.ax=Math.hypot(ax[0],ax[1],ax[2])>.2?V3.norm(ax):[1,0,0];}
const MT=[new Float64Array(3),new Float64Array(3),new Float64Array(3),new Float64Array(3),new Float64Array(3),new Float64Array(3)];
// o = the pose between keys A and B at e (0..1): channels lerp, the bat direction slerps (through the swing plane when the keys
// are opposite), the hands travel on an arc about the shoulders (at arm's length, never through the body), a foot that moves
// between the keys lifts. Exact at e = 0 (A) and e = 1 (B).
function mixPose(o,A,B,e,ax,eb,via){
  if(e<=0){o.set(A);return o;}if(e>=1){o.set(B);return o;}
  for(let j=0;j<PN;j++)o[j]=A[j]+(B[j]-A[j])*e;
  // eb: the body's own ease (hip, lean, hip and shoulder turn): the weight transfer of a swing runs steadily through the
  // downswing while the bat whips (e), so the hip never jumps in the last frame before impact
  if(eb!==undefined)for(const j of [qHX,qHY,qHZ,qHR,qLX,qLZ,qSR])o[j]=A[j]+(B[j]-A[j])*eb;
  const [a,b,c,m,u]=MT;MO.set(a,A[qDX],A[qDY],A[qDZ]);MO.norm(a,a);MO.set(b,B[qDX],B[qDY],B[qDZ]);MO.norm(b,b);
  if(via&&MO.dot(a,b)<-.3){if(e<.5)MO.slerp(c,a,via,2*e,ax);else MO.slerp(c,via,b,2*e-1,ax);o[qDX]=c[0];o[qDY]=c[1];o[qDZ]=c[2];} // up the backlift's plane first
  else if(MO.dot(a,b)<.995){MO.slerp(c,a,b,e,ax);o[qDX]=c[0];o[qDY]=c[1];o[qDZ]=c[2];}
  // hands: an arc that keeps them at arm's length, bulging outward (horizontally: round the body, never over the head)
  MO.set(a,A[qAX],A[qAY],A[qAZ]);MO.set(b,B[qAX],B[qAY],B[qAZ]);MO.set(c,o[qLX]*.5,.5,o[qLZ]*.5);
  const r=(MO.dist(a,c)+MO.dist(b,c))/2;MO.mix(m,a,b,.5);MO.sub(u,m,c);const dm=MO.len(u);u[1]=0;const dh=MO.len(u);
  if(dh>.03&&r-dm>.004){MO.sc(u,u,1/dh);MO.arc(m,a,b,Math.min(r-dm,.25),e,u);o[qAX]=m[0];o[qAY]=m[1];o[qAZ]=m[2];}
  // the hands go round the body, not through it: where the straight path between the keys passes within RT of the torso axis
  // (hip to shoulders, in the pose's frame), the path bulges out along the normal there by what it lacks, peaking at that point.
  // A function of the two keys only, so it is continuous in e and exact at both keys (the per-frame push in handsClear stays small).
  {MO.set(c,o[qLX],1,o[qLZ]);MO.norm(c,c);let dmin=9,emin=.5;const q=MT[5];
    for(let k=1;k<8;k++){const s=k/8;MO.mix(q,a,b,s);const t=clamp(MO.dot(q,c),.05,.5);MO.sc(u,c,t);const dd=MO.dist(q,u);if(dd<dmin){dmin=dd;emin=s;MO.set(m,u[0],u[1],u[2]);}}
    const RT=.24;if(dmin<RT){MO.mix(q,a,b,emin);MO.sub(u,q,m);const dl=MO.len(u);if(dl>1e-4)MO.sc(u,u,1/dl);else MO.set(u,Math.cos(o[qSR]),0,Math.sin(o[qSR]));
      const hump=e<emin?smooth(e/emin):smooth((1-e)/(1-emin)),k=(RT-dmin)*hump;o[qAX]+=u[0]*k;o[qAY]+=u[1]*k;o[qAZ]+=u[2]*k;}}
  reachClamp(o,Math.max(.56,reachOf(A)*(1-e)+reachOf(B)*e)); // a key that reaches further is met exactly
  // the hands never pass through the head: pushed out to 26 cm from its centre between keys
  const hc=headRel(o),gx=o[qAX]-hc[0],gy=o[qAY]-hc[1],gz=o[qAZ]-hc[2],gd=Math.hypot(gx,gy*.6,gz);
  // faded in and out over the first and last quarter, so a key with the hands nearer than that is still met without a jump
  if(gd<.37&&gd>1e-4){const k=(.37-gd)/gd*smooth(clamp(Math.min(e,1-e)/.25,0,1));o[qAX]+=gx*k;o[qAY]+=gy*.6*k;o[qAZ]+=gz*k;}
  // feet: lift before they travel, land before they stop
  const eF=eb!==undefined?eb:e,ef=smooth(clamp((eF-.15)/.7,0,1)),bump=Math.sin(Math.PI*eF),df=Math.hypot(B[qFX]-A[qFX],B[qFZ]-A[qFZ]),db=Math.hypot(B[qBX]-A[qBX],B[qBZ]-A[qBZ]);
  // a small shuffle (under 1.2 cm) travels only in the middle of a 2 cm lift, so the sole is never dragged along the ground
  const es=smooth(clamp((eF-.3)/.4,0,1));
  for(const [x,z,ly,dd] of [[qFX,qFZ,qFLY,df],[qBX,qBZ,qBLY,db]]){const k=dd>.012?ef:es;o[x]=A[x]+(B[x]-A[x])*k;o[z]=A[z]+(B[z]-A[z])*k;
    if(dd>.012)o[ly]+=bump*clamp(.3*dd,.04,.08);else if(dd>.002)o[ly]+=bump*.02;}
  return o;}
// the head's centre relative to the hip for a pose (as batJoints places it)
function headRel(p){const Y=V3.norm([p[qLX],1,p[qLZ]]),Yh=V3.norm([Y[0]*.4,Y[1]*.4+.6,Y[2]*.4]),yw=p[qHDY],f=[Math.sin(yw),0,Math.cos(yw)],fY=V3.norm(V3.sub(f,V3.sc(Yh,V3.dot(f,Yh)))),
    nd=clamp(p[qNOD],-1.2,1.6)*.5,hv=V3.norm(V3.add(V3.sc(Yh,Math.cos(nd)),V3.sc(fY,Math.sin(nd))));return V3.add(V3.sc(Y,.54),V3.sc(hv,.19));}
// the swing's pose at t after its start, from the keys K (PB, or PB.o during the settle cross-fade)
function swingAt(o,t,K){
  const u=t-SWING_DELAY;if(Math.abs(u)<=1e-9){o.set(K.a);return o;} // the impact instant (to an ulp): the impact pose itself
  if(u<0)return mixPose(o,PB.from,K.a,Math.pow(t/SWING_DELAY,K.pw),K.ax,t/SWING_DELAY);
  if(u<K.d1){const v=u/K.d1,v2=v*v,v3=v2*v,ph=K.P1*(3*v2-2*v3)+K.m0*(v3-2*v2+v)+K.m1*(v3-v2);return mixPose(o,K.a,K.b,clamp(ph/K.P1,0,1),K.ax);}
  const v=Math.min(1,(u-K.d1)/K.d2);return mixPose(o,K.b,K.e,v*(2-v),K.ax);}
// closest the blade comes to the ball over the swing (downswing, impact, follow-through), while the ball is still coming
function sweepGap(){
  const sw=S.swing,b=S.ball,o=PB.tmp,ph=padHit(b,S.bpos);let g=9;
  for(let t=sw.tc-SWING_DELAY;t<sw.tc+.35;t+=.006){
    if(t>b.tEnd||ph&&t>ph.t)break;swingAt(o,t-sw.tc+SWING_DELAY,PB);
    const d=V3.norm([o[qDX],o[qDY],o[qDZ]]),n=faceN(d,o[qFC]),X=V3.norm(V3.cross(n,d)),q=ballPos(b,t),r=[q.x-o[qHX]-o[qAX]-S.bpos.x,q.y+.05-o[qHY]-o[qAY],q.z-o[qHZ]-o[qAZ]-S.bpos.z];
    const a=V3.dot(r,d);g=Math.min(g,Math.hypot(Math.max(0,.28-a,a-.86),Math.max(0,Math.abs(V3.dot(r,X))-.054),Math.max(0,Math.abs(V3.dot(r,n))-.03))-.05);}
  return g;}
// pattern search over hip shift, hand shift, bat direction and forward lean: the blade point (u along it, w across, f out of
// the face, so the ball sits on it) goes to T
// with as little change as it takes, both hands within arm's reach of the shoulders, toe above the ground
// per shot family: bend limits (hip x y z, hands x y z, bat yaw, bat pitch, forward lean), bat tilt from vertical at most
// tilt (rad), contact z window around the pose's own contact point. Drives and blocks stay upright; pulls and cuts go flat.
// drives: the body goes to the ball (the hip may come .25 forward and .15 down, the lean up to .6 rad), so the head gets over the
// front knee and the arms stay bent, rather than the batter standing up and reaching
const FAM={drive:{lo:[-.1,-.15,-.12,-.3,-.3,-.3,-1.2,-1,-.1],hi:[.1,.03,.25,.3,.45,.3,1.2,1,.6],tilt:.5,zw:[-.35,.3]},
  loft:{lo:[-.1,-.15,-.12,-.3,-.3,-.3,-1.2,-1,-.1],hi:[.1,.03,.25,.3,.45,.3,1.2,1,.6],tilt:1.0,zw:[-.35,.3]},
  block:{lo:[-.06,-.04,-.1,-.25,-.25,-.25,-1,-1,-.1],hi:[.06,.03,.12,.25,.4,.25,1,1,.3],tilt:.35,zw:[-.25,.25]},
  // pull and cut keep the bat flat: the pitch may drop .7 rad at most, so a ball cramping the batter is jabbed with the hands
  // brought across at chest height rather than the bat hung vertically from the chin
  pull:{lo:[-.15,-.1,-.2,-.45,-.45,-.45,-3,-.7,-.2],hi:[.15,.04,.2,.45,.25,.45,3,2,.2],tilt:1.9,zw:[-.5,.3]},
  glance:{lo:[-.12,-.1,-.2,-.4,-.4,-.4,-2,-1.5,-.15],hi:[.12,.04,.2,.4,.45,.4,2,1.5,.3],tilt:1.1,zw:[-.6,.2]},
  sweep:{lo:[-.12,-.03,-.15,-.4,-.25,-.4,-1,-.4,-.2],hi:[.12,.05,.15,.4,.35,.4,1,.4,.3],tilt:1.9,zw:[-.15,.35],kn:1}};
const SHOT_FAM=['glance','pull','drive','drive','drive','pull','glance'];
// a low ball bends the front knee a little more, leans the head over it and meets it lower on the blade; a ball above the
// waist can't be met with an upright bat, so the bat flattens toward a fend or hook as it rises
function shapeFor(L,y){const low=clamp((.4-y)/.3,0,1),high=clamp((y-.7)/.6,0,1),lo=L.lo.slice(),hi=L.hi.slice();
  if(!L.kn)lo[1]-=.12*low;hi[8]+=.25*low;hi[4]+=.3*high;lo[4]-=.15*low;return {lo,hi,tilt:L.tilt+1.1*high+.6*low,low,kn:L.kn};}
// face point of a pose (plus bend x if given) in world coordinates, footwork offset included
function facePt(a,x,u,w,f){x=x||[0,0,0,0,0,0,0,0,0];
  const H=[a[qHX]+x[0]+S.bpos.x+a[qAX]+x[3],a[qHY]+x[1]+a[qAY]+x[4],a[qHZ]+x[2]+S.bpos.z+a[qAZ]+x[5]],d=V3.norm([a[qDX],a[qDY],a[qDZ]]),fn=faceN(d,a[qFC]);
  return V3.add(V3.add(V3.add(H,V3.sc(d,u)),V3.sc(V3.norm(V3.cross(fn,d)),w)),V3.sc(fn,f));}
// x[9] slides the contact point along the blade (toward the toe when the ball is a stretch, up it when cramped), as a batter
// does rather than contort; it costs more than moving the hands, so the middle is kept whenever the body can reach
function bend(a,T,u,w,f,L){
  const d0=V3.norm([a[qDX],a[qDY],a[qDZ]]),yw=Math.atan2(d0[0],d0[2]),pt=Math.asin(d0[1]),bp=S.bpos;
  // the arms stay bent: a hand more than .53 from its shoulder (straight is .61) costs, so the body goes to the ball before the arms do
  // x[10] turns the shoulders (toward a leg-side ball, open for a cut) so the hands stay in front of the chest
  const x=[0,0,0,0,0,0,0,0,0,0,0],sq=v=>v*v,far=(p,q)=>sq(Math.max(0,Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])-.53)),
    LO=L.lo.concat([T[1]>.95?-.22:-.1,-(L.sr||.45)]),HI=L.hi.concat([u<.5?.08:Math.min(.17,.84-u),L.sr||.45]); // a ball above the chest may be taken near the splice
  const dir=()=>{const y=yw+x[6],p=clamp(pt+x[7],-1.55,Math.min(.3,L.tilt-1.5708)),c=Math.cos(p);return [c*Math.sin(y),Math.sin(p),c*Math.cos(y)];};
  const cost=()=>{
    const hip=[a[qHX]+x[0]+bp.x,a[qHY]+x[1],a[qHZ]+x[2]+bp.z],Y=V3.norm([a[qLX],1,a[qLZ]+x[8]]),s0=[-Math.sin(a[qSR]+x[10]),0,Math.cos(a[qSR]+x[10])],s=V3.norm(V3.sub(s0,V3.sc(Y,V3.dot(s0,Y)))),sh=V3.add(hip,V3.sc(Y,.5));
    const H=[hip[0]+a[qAX]+x[3],hip[1]+a[qAY]+x[4],hip[2]+a[qAZ]+x[5]],d=dir(),fn=faceN(d,a[qFC]),X=V3.norm(V3.cross(fn,d));
    const C=V3.add(V3.add(V3.add(H,V3.sc(d,u+x[9])),V3.sc(X,w)),V3.sc(fn,f)),dd=V3.sub(d,d0),hc=V3.add(hip,headRel(a)),hg=Math.hypot(H[0]-hc[0],(H[1]-hc[1])*.6,H[2]-hc[2]);
    // both gloves stay off the torso (the lab's capsule, BC.tr, plus the glove's radius): a cramped shot is jabbed in front of the body
    // and so does each arm's chord (shoulder to glove: an arm reaching across the body crosses it whatever the elbow does)
    const t0=V3.lerp(hip,sh,.1),g0=V3.add(H,V3.sc(d,HAND_AT[0])),g1=V3.add(H,V3.sc(d,HAND_AT[1])),sp0=V3.add(sh,V3.sc(s,.19)),sp1=V3.sub(sh,V3.sc(s,.19)),
      gt=sq(Math.max(0,.19-MO.segDist(g0,g0,t0,sh)))+sq(Math.max(0,.19-MO.segDist(g1,g1,t0,sh)))+sq(Math.max(0,.18-MO.segDist(sp0,g0,t0,sh)))+sq(Math.max(0,.18-MO.segDist(sp1,g1,t0,sh)));
    return 100*(sq(C[0]-T[0])+sq(C[1]-T[1])+sq(C[2]-T[2]))+400*sq(Math.max(0,.33-hg))+400*gt+.25*(sq(x[0])+sq(x[2]))+.6*sq(x[1])+.5*(sq(x[3])+sq(x[4])+sq(x[5]))+.08*V3.dot(dd,dd)+.15*sq(x[8])+3*sq(x[9])+.4*sq(x[10])
      +400*(1-.7*L.low)*(far(g0,sp0)+far(g1,sp1))+2000*sq(Math.max(0,.03+.06*Math.max(0,1-1.6*Math.abs(d[1]))-H[1]-.86*d[1]));};
  const search=()=>{let c=cost(),st=.08;
    for(let n=0;n<300&&st>.002;n++){let imp=false;
      for(let i=0;i<11;i++)for(let sg=-1;sg<2;sg+=2){const v=x[i];x[i]=clamp(v+sg*st,LO[i],HI[i]);const c2=cost();if(c2<c){c=c2;imp=true;}else x[i]=v;}
      if(!imp)st*=.5;}
    return c;};
  let c=search();
  // a low ball may need the bat angled down with the hands low (another valley): try that start too and keep the better
  if(L.low>.2&&c>.05){const x1=x.slice();x.fill(0);x[7]=clamp(.9*L.low,L.lo[7],L.hi[7]);x[1]=L.lo[1]*.6;x[4]=L.lo[4]*.5;x[8]=L.hi[8]*.5;const c2=search();if(c2>=c){for(let i=0;i<11;i++)x[i]=x1[i];}}
  const d=dir();for(let i=0;i<3;i++){a[qHX+i]+=x[i];a[qAX+i]+=x[3+i];a[qDX+i]=d[i];}a[qLZ]+=x[8];a[qSR]+=x[10];
  return x;}
/* --- the head: eyes on the ball. The look target by phase (the bowler's hand before release, the ball in flight, the shot after
   contact), yaw limited about the chest, pitch limited, spring-smoothed; written into the head channels of the drawn pose with a
   weight that holds through impact and fades after the shot. The keyed head (nod, hd) is what the poses author; the look overrides
   it while there is something to watch. --- */
const LK={st:MO.lookState(),w:0,o:new Float64Array(6),lim:{yaw:1.7,up:.5,down:.95},t:0,yaw:0,ok:0};
function headLook(o){
  const b=S.ball,ph=S.phase,dt=clamp(clock-LK.t,0,.1);LK.t=clock;let tg=null,wt=0;
  if(S.cel||B_mode()==='celebrate')wt=0;
  else if(ph==='flight'&&b){const bt=clock-b.start;if(S.hit&&bt>=S.swing.tc){const q=hitPos(S.hit,clock-S.hitStart);tg=[q.x,q.y+.05,q.z];}else{const q=ballPos(b,Math.min(bt,b.tEnd+.2));tg=[q.x,q.y+.05,q.z];}wt=1;}
  else if(ph==='result'&&b){if(S.hit){const t=clock-S.hitStart,q=hitPos(S.hit,t);tg=[q.x,q.y+.05,q.z];wt=t<.3?1:clamp(1-(t-.3)/.9,0,1);}
    else{const q=ballPos(b,Math.min(clock-b.start,b.tEnd+.3));tg=[q.x,q.y+.05,q.z];wt=clamp(1-(S.t-.5)/.6,0,1);}}
  else if(ph==='ready'||ph==='runup'||ph==='break'||ph==='pick'){tg=[S.bowlerZ>25?.3:(S.pending?S.pending.xr:.3),ph==='runup'?1.9:1.6,S.bowlerZ||30];wt=1;}
  LK.w+=(wt-LK.w)*Math.min(1,dt*(wt>LK.w?12:4));
  // nothing left to watch (the celebration): the last target is held while the look fades, so the head turns back, not snaps
  if(tg)LK.tg=tg;else if(LK.w>=1e-3)tg=LK.tg;
  if(LK.w<1e-3||!tg){LK.st.ok=0;LK.ok=0;LK.okO=0;return;}
  // eye point and the chest's yaw from the drawn pose
  const Y=V3.norm([o[qLX],1,o[qLZ]]),eye=[o[qHX]+S.bpos.x+Y[0]*.73,o[qHY]+Y[1]*.73,o[qHZ]+S.bpos.z+Y[2]*.73],s0=[-Math.sin(o[qSR]),0,Math.cos(o[qSR])],
    s=V3.norm(V3.sub(s0,V3.sc(Y,V3.dot(s0,Y)))),n=V3.cross(Y,s),by=Math.atan2(n[0],n[2]),L=LK.o;
  MO.lookAt(LK.st,L,eye,tg,by,dt,12,LK.lim);
  let yaw=Math.atan2(L[0],L[2]);const pitch=Math.asin(clamp(L[1],-1,1)),w=LK.w,cap=dt*9;
  if(LK.ok){yaw=LK.yaw+clamp(MO.wrap(yaw-LK.yaw),-cap,cap);}LK.yaw=yaw;LK.ok=1;
  let hy=o[qHDY]+MO.wrap(yaw-o[qHDY])*w;if(LK.okO)hy=LK.out+clamp(MO.wrap(hy-LK.out),-cap,cap);LK.out=hy;LK.okO=1;
  o[qHDY]=hy;o[qNOD]+=(-2*pitch-o[qNOD])*w;}
const B_mode=()=>S.bat.mode;
/* --- the celebration (game clock t since S.cel.t0): he stands tall with the bat raised overhead in both hands, the top hand
   comes off and punches the air while the bat stays aloft in the bottom hand (the only hand the rig can free is the top one),
   a real jump (dip, take-off, airborne, absorbed landing), then he turns toward the bowler's end on pivoting feet (anchors), bat
   and fist still up. Hand targets are authored in the chest's frame at the start and turn with it. --- */
const CEL={an:MO.anchorsState(),on:false},CEL_B={h:[0,0,0],d:[0,0,0]};
const CELB={h:[-.08,.84,-.31],d:[.05,.95,-.25]},CELF=[.17,1.06,.22];
const rotY=(v,a)=>{const c=Math.cos(a),n=Math.sin(a);return [v[0]*c-v[2]*n,v[1],v[0]*n+v[2]*c];};
function celPose(tg,t){
  poseSet(tg,UP.cel);
  // the jump: preload dip, take-off, airborne (feet leave once the hip is above standing height), landing absorbed
  let hy=0,j=0;
  if(t>=1.15&&t<2.05){const u=(t-1.15)/.9;
    if(u<.22)hy=-.09*smooth(u/.22);
    else if(u<.72){const v=(u-.22)/.5;j=4*v*(1-v);hy=-.09+.35*j;}
    else hy=-.09*(1-smooth((u-.72)/.28));}
  const air=Math.max(0,hy);tg[qHY]+=hy+Math.sin(t*4)*.008;tg[qFLY]+=air*1.25;tg[qBLY]+=air*1.25;
  // the top hand lets go from .75 s: the bat stays up in the bottom hand, the fist punches (higher in the jump, a pump after it)
  const k=smooth(clamp((t-.75)/.3,0,1)),tn=smooth(clamp((t-2.4)/1.6,0,1))*1.15;
  for(let i=0;i<3;i++){CEL_B.h[i]=tg[qAX+i]+(CELB.h[i]-tg[qAX+i])*k;CEL_B.d[i]=tg[qDX+i]+(CELB.d[i]-tg[qDX+i])*k;}
  const h=rotY(CEL_B.h,tn),d=V3.norm(rotY(CEL_B.d,tn));tg[qAX]=h[0];tg[qAY]=h[1];tg[qAZ]=h[2];tg[qDX]=d[0];tg[qDY]=d[1];tg[qDZ]=d[2];
  const pump=.05*air/.26+.04*Math.max(0,Math.sin(Math.PI*clamp((t-2.15)/.35,0,1))),F=rotY([CELF[0],CELF[1]+pump,CELF[2]],tn),gp=V3.add(h,V3.sc(d,HAND_AT[0]));
  // the top hand leaves the handle sideways (out past the front shoulder), not up past the bottom hand above it
  const so=rotY([.39*.12,0,.92*.12],tn),ko=Math.sin(Math.PI*k);
  tg[qTX]=(F[0]-gp[0])*k+so[0]*ko;tg[qTY]=(F[1]-gp[1])*k*k;tg[qTZ]=(F[2]-gp[2])*k+so[2]*ko;
  // turn to the bowler's end from 2.4 s: the body yaws, the feet pivot one at a time (anchors)
  if(t>=2.3){const dt=1/60,hx=tg[qHX],hz=tg[qHZ],f=Math.PI/2-tn;
    if(!CEL.on){CEL.on=true;MO.anchorsReset(CEL.an,hx,hz,Math.PI/2,.28);MO.set(CEL.an.foot[0],tg[qFX],0,tg[qFZ]);MO.set(CEL.an.foot[1],tg[qBX],0,tg[qBZ]);}
    MO.anchorsStep(CEL.an,hx,hz,f,dt,{w:.26,thr:.12,yawThr:.5,dur:.3,lift:.06});
    const A=CEL.an;tg[qFX]=A.foot[0][0];tg[qFZ]=A.foot[0][2];tg[qFLY]+=A.foot[0][1];tg[qBX]=A.foot[1][0];tg[qBZ]=A.foot[1][2];tg[qBLY]+=A.foot[1][1];
    tg[qFR]=Math.PI/2-A.yaw[0];tg[qBR]=Math.PI/2-A.yaw[1];tg[qHR]+=tn;tg[qSR]+=tn;tg[qHDY]+=tn*.6;}
  else CEL.on=false;
  return tg;}
// a step the backlift did not take (a swing off a short drag, a keyboard swing, the lab's injected one) cannot be made in the
// 75 ms downswing: the impact key keeps each foot within .2 m of where it is (6 m/s at the ease's peak), the follow-through
// keeps the feet the bat was met on (the follow and finish keys too, when the step was cut short)
function capStep(a,from){let c=false;for(const [x,z] of [[qFX,qFZ],[qBX,qBZ]]){const dx=a[x]-from[x],dz=a[z]-from[z],d=Math.hypot(dx,dz);if(d>.2){a[x]=from[x]+dx*.2/d;a[z]=from[z]+dz*.2/d;c=true;}}return c;}
function poseTick(){
  const B=S.bat,b=S.ball,ph=S.phase,cel=B.mode==='celebrate',fly=!cel&&!!b&&(ph==='flight'||ph==='result'),bt=fly?clock-b.start:0,tg=PB.tg;
  const fa=fly?footAt(b,S.bpos):null,aiSw=M&&M.bowl&&S.ai&&S.ai.sw;
  footPose(tg,fly?b:null,fly?footProg(fa.t,bt):0,fa);
  let key='st',dur=.4,sw=false;
  if(cel){key='cel';dur=.45;celPose(tg,clock-(S.cel?S.cel.t0:B.t0));}
  else if(ph==='result'&&S.res&&S.res.body&&S.t<.7){key='hit';dur=.1;poseSet(tg,UP.hit);}
  else if(fly&&b.duck&&!S.swing&&ph==='flight'){key='dk';dur=.16;poseSet(tg,bodyHit(b,S.bpos)?UP.duck:UP.sway);}
  else if(fly&&(B.mode==='swing'||B.mode==='block')){key='sw'+B.t0;sw=true;}
  else if(ph==='result'&&S.t>(S.res&&S.res.body?.7:.85)||ph==='ready'&&S.t<.9&&!S.aim){
    const up=ph==='result'&&S.t<(S.res&&S.res.body?1.0:1.15);key=up?'rl0':'rl';dur=up?.3:ph==='ready'?.5:.6;poseSet(tg,UP.relax);if(up)poseSet(tg,{h:[.16,.3,.3],d:[.1,.95,.3]});idlePose(tg,.5);}
  else if(B.mode==='backlift'||fly&&B.mode==='stance'&&!S.aim&&ph==='flight'&&!(aiSw&&aiSw.leave)&&bt<fa.t-.1){
    // the backlift: with the slingshot its height follows the drag, else a baseline lift at release (keyboard, the AI). The shot
    // it is aimed at (the drag's direction, or the AI's choice) picks the family's lift and starts its feet moving (the lunge, the
    // back-and-across step) so the swing starts from where the shot is played
    const drag=S.aim?Math.hypot(S.aim.x-S.aim.x0,S.aim.y-S.aim.y0):0,k=S.aim?.55+.45*clamp(drag/dragMax(),0,1):B.mode==='backlift'?1:.6;
    const aim=S.aim&&drag>=14?aimDeg(S.aim.x-S.aim.x0,S.aim.y-S.aim.y0):aiSw&&!aiSw.defend?aiSw.aim:null,sh=fly&&aim!=null?shotOf(aim,b):null;
    key=(B.mode==='backlift'?'bl':'b0')+(sh?famOf(sh)+(sh.sweep?sh.name:''):'')+B.t0;dur=.25;
    if(fly)footPose(tg,b,Math.max(footProg(fa.t,bt),clamp((clock-B.t0)/.4,0,1)),fa);
    idlePose(tg,ph==='ready'||ph==='break'?1:0);PB.tmp.set(tg);
    const fam=sh?famOf(sh):aiSw&&aiSw.defend?'block':'drive';poseSet(tg,BL[fam]||BL.drive);
    if(sh&&!sh.sweep){const sp=SH3[SHOTS.indexOf(sh)];if(sp&&sp.i.ff)poseSet(tg,{ff:sp.i.ff,fb:sp.i.fb,dh:sp.i.dh});}
    for(let j=qAX;j<=qDZ;j++)tg[j]=PB.tmp[j]+(tg[j]-PB.tmp[j])*k;
    if(sh&&sh.sweep){dur=.3;poseSet(tg,SW3[sh.name].l);}}
  else if(fly&&!S.swing&&(ph==='result'||bt>fa.t-(aiSw&&aiSw.leave?.25:.1))){key='lv';dur=.28;poseSet(tg,UP.leave);}
  else{idlePose(tg,ph==='ready'||ph==='break'?1:ph==='runup'?clamp(1-S.t/(S.runupDur*.6),0,1):0);
    // the trigger press in the last 0.3 s of the run-up: weight onto the balls of the feet, a small step in, the bat starts to lift
    if(ph==='runup'){const pr=smooth(clamp((S.t-(S.runupDur-.3))/.3,0,1));tg[qHZ]+=.04*pr;tg[qHY]-=.015*pr;tg[qFZ]+=.04*smooth(clamp((pr-.15)/.7,0,1));tg[qFLY]+=.035*Math.sin(Math.PI*pr);tg[qAY]+=.08*pr;tg[qAZ]-=.05*pr;tg[qDZ]-=.25*pr;tg[qDX]+=.1*pr;}}
  if((key==='st'||key==='rl')&&(PB.key==='rl0'&&clock<PB.upT||PB.key!=='rl0'&&PB.cur[qDZ]<-.3&&PB.cur[qDY]>.2&&PB.cur[qAY]>.3)){if(PB.key!=='rl0')PB.upT=clock+.3;key='rl0';dur=.3;poseSet(tg,{h:[.16,.3,.3],d:[.1,.95,.3]});}
  if(!sw)frontClamp(tg,.15);
  if(key!==PB.key){PB.from.set(PB.cur);PB.key=key;PB.sw=sw;PB.dur=dur;PB.t0=sw?B.t0:clock;PB.o=PB.n=null;if(sw){if(B.mode==='block')blockKeys(b);else shotKeys(b,B.aim);aimSwing(b);
    // a step cut short at impact is not then finished in 25 ms: the follow and finish stay on the feet the bat was met on
    if(capStep(PB.a,PB.from))for(const q of [PB.b,PB.e])for(const j of [qFX,qFZ,qFR,qBX,qBZ,qBR])q[j]=PB.a[j];}}
  if(sw&&!PB.fin&&S.swing&&S.swing.done)settleSwing();
  const c=PB.cur;
  if(sw){const t=Math.max(0,clock-PB.t0);swingAt(c,t,PB);
    if(PB.o){const w=smooth(clamp((clock-PB.xt)/PB.xd,0,1));if(w>=1)PB.o=null;else{swingAt(PB.tmp2,t,PB.o);for(let j=0;j<PN;j++)c[j]=PB.tmp2[j]+(c[j]-PB.tmp2[j])*w;}}
    else if(PB.n){const w=smooth(clamp((clock-PB.xt)/PB.xd,0,1));if(w>0){swingAt(PB.tmp2,t,PB.n);for(let j=0;j<PN;j++)c[j]+=(PB.tmp2[j]-c[j])*w;}if(w>=1){Object.assign(PB,PB.n);PB.n=null;}}}
  // a backlift turning the bat right round (stance to a sweep's crouch) lifts it toward slip first, then over: the toe never
  // swings back through the pads and body
  else{const u=clamp((clock-PB.t0)/PB.dur,0,1);mixPose(c,PB.from,tg,smooth(u),PB.ax,undefined,/^b[l0]/.test(PB.key)?BLVIA:null);}
  feetTick();
  // the drawn pose: footwork puts the hip between the pose's guard and bpos while the feet chasse, exactly at bpos by impact
  const o=PB.out,p=S.bpos,F=FT,wi=sw?clamp((clock-PB.t0)/SWING_DELAY,0,1):0;o.set(c);
  o[qHX]+=lerp(.5*p.x+.25*(F.f[0]+F.b[0]),p.x,wi);o[qHZ]+=lerp(.5*p.z+.25*(F.f[1]+F.b[1]),p.z,wi);o[qHY]-=F.lift*.2*(1-wi);
  o[qFX]+=F.f[0];o[qFZ]+=F.f[1];o[qBX]+=F.b[0];o[qBZ]+=F.b[1];o[qFLY]+=F.lf[0];o[qBLY]+=F.lf[1];
  headLook(o);
  handsClear(o,sw?smooth(clamp((Math.abs(clock-PB.t0-SWING_DELAY)-.03)/.1,0,1)):1);
  if(!sw||Math.abs(clock-PB.t0-SWING_DELAY)>1e-3){const dy=V3.norm([o[qDX],o[qDY],o[qDZ]])[1],toe=o[qHY]+o[qAY]+.86*dy,min=.03+.08*Math.max(0,1-1.6*Math.abs(dy));if(toe<min)o[qAY]+=min-toe;}
  return o;}
/* the hands never sit inside the body: both gloves (r .055) and the handle (r .017) are pushed clear of the torso capsule and the
   thighs (as tests/charlab measures them, BC) by moving the bat anchor (both hands with it; the bat direction is kept). Faded out
   within 30 ms of impact (the impact pose is bit-exact and the blade is on the ball) and in by 130 ms: the swing keys themselves
   are kept clear by bend()'s glove term. The drawn pose is in world coordinates here (hip with bpos, feet with the chasse). */
const HC={x:[0,0,0],t:-1};
function handsClear(o,w){
  const hip=[o[qHX],o[qHY],o[qHZ]],Y=V3.norm([o[qLX],1,o[qLZ]]),sh=V3.add(hip,V3.sc(Y,.5)),ha=[-Math.sin(o[qHR]),0,Math.cos(o[qHR])],obs=[[V3.lerp(hip,sh,.1),sh,BC.tr,1]];
  for(let i=0;i<2;i++){const side=i?-1:1,fr=o[i?qBR:qFR],t=[Math.cos(fr),0,Math.sin(fr)],hj=V3.add(hip,V3.sc(ha,.1*side));hj[1]-=.04;
    const an=[o[i?qBX:qFX],.08+o[i?qBLY:qFLY]+(i?o[qHL]*.05:0),o[i?qBZ:qFZ]],kn=ik(hj,an,.43,.43,V3.add(t,V3.sc(ha,.25*side)));obs.push([hj,kn,.075,1],[an,kn,.085,0]);} // thigh (hands and bat), pad (bat only)
  const d=V3.norm([o[qDX],o[qDY],o[qDZ]]),x=[0,0,0],s0=[-Math.sin(o[qSR]),0,Math.cos(o[qSR])],s=V3.norm(V3.sub(s0,V3.sc(Y,V3.dot(s0,Y)))),SP=[V3.add(sh,V3.sc(s,.19)),V3.sub(sh,V3.sc(s,.19))];
  // the head (as batJoints places it): the gloves and each arm's chord (shoulder to glove, r .05: the arm is near straight when it
  // reaches across the face) stay clear of it; the chords also stay off the chest (BC.tc: an arm reaching across the body crosses
  // it whatever the elbow does, so the hands are brought round in front)
  const hr=headRel(o),hc=V3.add(hip,hr),head=[hc,hc,BC.hr,2],n=V3.cross(Y,s),fr=Math.hypot(o[qTX],o[qTY],o[qTZ])>.01; // fr: the top hand is off the handle
  for(let it=0;it<8;it++){const H=[hip[0]+o[qAX]+x[0],hip[1]+o[qAY]+x[1],hip[2]+o[qAZ]+x[2]],g0=V3.add(H,V3.sc(d,HAND_AT[0])),g1=V3.add(H,V3.sc(d,HAND_AT[1]));
    let pen=0,pi=-1;for(const [a,b,r,hand] of [[g0,g0,.055,1],[g1,g1,.055,1],[V3.add(H,V3.sc(d,HTOP)),V3.add(H,V3.sc(d,.3)),.017,0],[V3.add(H,V3.sc(d,.3)),V3.add(H,V3.sc(d,.86)),.03,0],[SP[0],g0,.05,2],[SP[1],g1,.05,2]]){pi++;let oi=-1;if(fr&&(pi===0||pi===4))continue;
      for(const [oa,ob,or,hands] of obs.concat([head])){oi++;if(hands<hand||hand===2&&hands!==2)continue;const a0=a.slice(),b0=b.slice();
        if(MO.capPush(a0,b0,r-BC.m,oa,ob,or,1)>0){const k=hand===2?2:1;x[0]+=(b0[0]-b[0])*k;x[1]+=(b0[1]-b[1])*k;x[2]+=(b0[2]-b[2])*k;pen=1;if(HC.log)HC.log.push([clock,it,pi,oi,+(b0[0]-b[0]).toFixed(3),+(b0[1]-b[1]).toFixed(3),+(b0[2]-b[2]).toFixed(3)]);break;}} // a chord's push lands on its hand end: doubled, since the shoulder stays
      if(pen)break;}
    // and in front of the chest plane (frontClamp for the keys; here for the blends between them): a glove behind it would have
    // its arm through the chest whatever the elbow does
    if(!pen){let dm=9;for(let i=fr?1:0;i<2;i++)dm=Math.min(dm,V3.dot(V3.sub(i?g1:g0,sh),n));if(dm<.14){const k=.14-dm;x[0]+=n[0]*k;x[1]+=n[1]*k;x[2]+=n[2]*k;pen=1;if(HC.log)HC.log.push([clock,it,6,-1,+(n[0]*k).toFixed(3),+(n[1]*k).toFixed(3),+(n[2]*k).toFixed(3)]);}}
    // and the arms stay bent: a glove further than .56 from its shoulder (straight is .61) is drawn back toward it
    if(!pen)for(let i=fr?1:0;i<2;i++){const g=i?g1:g0,v=V3.sub(g,SP[i]),L=Math.hypot(v[0],v[1],v[2]);if(L>.56){const k=(L-.56)/L;x[0]-=v[0]*k;x[1]-=v[1]*k;x[2]-=v[2]*k;pen=1;break;}}
    if(!pen)break;}
  // the push eases (<= 6 m/s), so a normal that flips as the hands pass the body's axis cannot throw them across it in one frame
  const dt=HC.t>=0?clamp(clock-HC.t,0,.1):0,cap=HC.t>=0?6*dt:9,p=HC.x;HC.t=clock;
  for(let i=0;i<3;i++)p[i]+=clamp(x[i]*w-p[i],-cap,cap);
  o[qAX]+=p[0];o[qAY]+=p[1];o[qAZ]+=p[2];}

/* --- non-striker (Tests and T20): the same model in its own frame (facing +z at the origin, so his left is -x there), placed at
   the bowler's end facing the striker on the side away from the bowler. A distance-phased gait (MO.gait) drives his feet from
   his position on the track: he walks in behind the bowler's run-up (backing up), backpedals to the crease after the ball and
   walks across when the bowler changes side; planted feet never slide. The bat hangs in the bottom hand, the free top hand
   swings with the walk (its offset channels take it off the handle). The pose is recorded per frame for replays. --- */
const NSP=poseSet(new Float32Array(PN),{ff:[-.12,.06,1.62],fb:[.12,-.06,1.5],hip:[0,.9,0],hr:1.5708,lx:0,lz:.05,sr:1.5708,h:[.25,.08,.06],d:[.22,-.95,.22],nod:.15,hd:0,fc:0,th:[-.37,-.35,-.08]});
const NS={on:false,x:1.05,u:0,t:0,g:MO.gaitState(),su:MO.springState(),sx:MO.springState()},NS_Z=19.55,NSW=.11;
// the pose from his gait: feet from the gait (world -> his frame), pelvis bob/sway/yaw, shoulder counter-yaw, lean, arm swing
function nsPose(o,g,wx,wz){
  o.set(NSP);const L=(w)=>[wx-w[0],w[1],wz-w[2]],f0=L(g.foot[0]),f1=L(g.foot[1]);
  o[qFX]=f0[0];o[qFZ]=f0[2];o[qFLY]=f0[1];o[qBX]=f1[0];o[qBZ]=f1[2];o[qBLY]=f1[1];
  o[qFR]=1.62;o[qBR]=1.5;o[qHL]=0;
  o[qHX]+=g.pelvis[0];o[qHY]+=g.pelvis[1];o[qHR]-=g.pelvis[2];o[qSR]-=g.sh;o[qLZ]+=g.lean;
  const mv=clamp(g.speed/.5,0,1),a0=g.arm[0],a1=g.arm[1];
  // bottom (right) hand carries the bat, swinging with its arm; the free top hand hangs and swings opposite
  o[qAZ]+=.22*a1;o[qAY]+=.04*Math.abs(a1);o[qDZ]+=.2*a1*mv;
  const H=[o[qAX],o[qAY],o[qAZ]],d=V3.norm([o[qDX],o[qDY],o[qDZ]]),gp=V3.add(H,V3.sc(d,HAND_AT[0])),
    free=[-.25,-.04-.03*Math.abs(a0),.05+.26*a0];
  o[qTX]=free[0]-gp[0];o[qTY]=free[1]-gp[1];o[qTZ]=free[2]-gp[2];
  if(mv<.5){o[qHZ]+=Math.sin(clock*.8)*.012*(1-mv);o[qHX]+=Math.sin(clock*.55)*.01*(1-mv);}
  return o;}
function nsTick(n,bx){
  const dt=clamp(clock-NS.t,0,.1);NS.t=clock;n.on=!!(M&&(M.sc||M.t20));if(!n.on){NS.on=false;return;}
  const ph=S.phase,tx=bx>0?-1.05:1.05;
  if(!NS.on){NS.on=true;NS.x=tx;NS.u=0;NS.su.x=0;NS.su.v=0;NS.sx.x=tx;NS.sx.v=0;MO.gaitReset(NS.g,NS.x,NS_Z,Math.PI,NSW,.1);}
  // backing up: ~1.4 m through the run-up and a little more in flight; back to the crease after the result; across when the
  // bowler changes side (between balls)
  const tu=ph==='runup'?1.4*smooth(clamp((S.t/S.runupDur-.3)/.7,0,1)):ph==='flight'?1.4+Math.min(.5,(clock-S.ball.start)*1.4):ph==='result'?(S.t<.5?NS.u:0):0;
  // critically damped toward the targets, the speed capped: a smooth velocity for the gait
  const u0=NS.u,x0=NS.x;MO.spring(NS.su,tu,dt,6);NS.u=u0+clamp(NS.su.x-u0,-1.2*dt,1.5*dt);NS.su.x=NS.u;
  if(ph!=='flight'){MO.spring(NS.sx,tx,dt,5);NS.x=x0+clamp(NS.sx.x-x0,-1.1*dt,1.1*dt);}NS.sx.x=NS.x;
  const vz=dt>0?-(NS.u-u0)/dt:0,vx=dt>0?(NS.x-x0)/dt:0;
  MO.gaitStep(NS.g,NS.x,NS_Z-NS.u,Math.PI,vx,vz,dt);
  n.x=NS.x;n.u=NS.u;nsPose(n.pose,NS.g,NS.x,NS_Z-NS.u);
}

/* --- materials and meshes --- */
const SKIN=[0.69,0.48,0.33],PAD=[.95,.95,.93],GLOVE=[.96,.96,.96],GRIP=[.2,.15,.1],GRILLE=[.34,.36,.4];
const col=(m,c)=>{if(typeof c==='string')m.color.set(c);else m.color.setRGB(c[0],c[1],c[2],THREE.SRGBColorSpace);return m;};
const std=(c,o)=>col(new THREE.MeshStandardMaterial(Object.assign({side:THREE.DoubleSide,roughness:.85},o)),c);
const bas=(c,map)=>col(new THREE.MeshBasicMaterial({side:THREE.DoubleSide,map:map||null}),c);
// players: a view-dependent rim in the sky colour (RIM, per planet) so they read against the grass; rim = this material's
// share of it (art-style: cloth .4, pads/gloves .6, shoes .5, skin .9, helmet 1.1). tint: a second colour the atlas mixes
// in where its alpha is 0 (m.userData.tint, see tools/blender/body.py); its texture's alpha never reaches the canvas.
const cc=c=>typeof c==='string'?new THREE.Color(c):new THREE.Color().setRGB(c[0],c[1],c[2],THREE.SRGBColorSpace);
function kit(c,o,rim=1,tint){const m=std(c,o),uK={value:rim},uT={value:tint?cc(tint):null};if(tint)m.userData.tint=uT.value;
  m.onBeforeCompile=s=>{s.uniforms.uRim=RIM;s.uniforms.uRimK=uK;s.uniforms.uFill=FILL;if(tint)s.uniforms.uTint=uT;
    s.fragmentShader='uniform vec3 uRim;uniform float uRimK;uniform vec3 uFill;'+(tint?'uniform vec3 uTint;':'')+'\n'+s.fragmentShader
      .replace('#include <map_fragment>',tint?'#ifdef USE_MAP\nvec4 kTx=texture2D(map,vMapUv);diffuseColor.rgb=mix(uTint,diffuseColor.rgb,kTx.a)*kTx.rgb;\n#endif':'#include <map_fragment>')
      .replace('#include <opaque_fragment>','outgoingLight+=uRim*uRimK*pow(1.-abs(dot(geometryNormal,geometryViewDir)),3.)+uFill*diffuseColor.rgb*(.3+.7*abs(dot(geometryNormal,geometryViewDir)));\n#include <opaque_fragment>');};
  m.customProgramCacheKey=()=>tint?'kitT':'kit';return m;}
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
// the one material every fielder, bowler and keeper wears (and the fallback rig's skin parts): the people atlas canvases
// (07-people spPaint: colour with the detail baked in, emissive, roughness in G) with the rim share read from the roughness
// map's R channel (x1.2), so cloth, skin and kit each keep their art-style rim strength inside one material
function peopleMat(){
  const C=spCanvas(),m=std([1,1,1],{map:C.tex.col,emissiveMap:C.tex.em,emissive:0xffffff,roughnessMap:C.tex.rough,roughness:1});
  m.onBeforeCompile=s=>{s.uniforms.uRim=RIM;s.uniforms.uFill=FILL;s.fragmentShader='uniform vec3 uRim;uniform vec3 uFill;\n'+s.fragmentShader
    .replace('#include <opaque_fragment>','outgoingLight+=uRim*1.2*texture2D(roughnessMap,vRoughnessMapUv).r*pow(1.-abs(dot(geometryNormal,geometryViewDir)),3.)+uFill*diffuseColor.rgb*(.3+.7*abs(dot(geometryNormal,geometryViewDir)));\n#include <opaque_fragment>');};
  m.customProgramCacheKey=()=>'people';return m;}
// fielder or bowler: the fallback rig's 13 parts (legs, feet, torso, sleeves, forearms with hands, head, one extra: cap or ring),
// swapped per planet by spApply; with fielder.glb loaded, a SkinnedMesh (sk) plus the keeper's kit (wk) and helmet (hm) on a
// skeleton clone (07-skin skfInit) replace them and the parts are hidden. J: the joints last drawn (lab, __r.body)
function personRig(G,bowler){const g=rig(),P=SPG.earth,m=G.pm,p=(x,y)=>part(x,y,g);
  const r={g,bowler:!!bowler,thigh:pair(()=>p(P.thigh,m.pants)),shin:pair(()=>p(P.shin,m.pants)),foot:pair(()=>p(P.foot,m.shoe)),torso:p(G.torso,m.torso),
    uarm:pair(()=>p(P.uarm,m.shirt)),farm:pair(()=>p(P.farm,m.skin)),head:p(P.head,m.skin),ex:p(P.ex,m.ex),sk:null,wk:null,hm:null,rec:null,J:null};
  r.parts=[...r.thigh,...r.shin,...r.foot,r.torso,...r.uarm,...r.farm,r.head];shade(g);return r;}
let SPX=null;
// kits per innings (T20): bowling first, the fielders and bowler are the player's side (humans in KIT.you) and the batters wear
// the planet team's kit; otherwise the planet's species in its kit and the batters in KIT.you. Set per innings, not per frame
const KS={you:false};
function setKits(you){if(KS.you===you)return;KS.you=you;if(glOK)kitApply();kitBatter();}
function kitApply(){const k=KS.you?KIT.you:aiKit();col(G3.pm.shirt,k.shirt);col(G3.pm.pants,k.pants);spApply(KS.you?'earth':curPlanet,k);}
// the species and kit on every person: the atlas repainted (skin, shirt, trim, trousers, cap, keeper kit), the fallback parts'
// geometry per species, and, skinned, the merged body geometry per species (with the cap for fielders, without for the bowler
// and the keeper in a helmet); Saturn's ring is the one separate part either way
function spApply(key,k){
  const G=G3,B=spBuild(SPECIES[key]?key:'earth'),P=SPX=B.P,m=G.pm,tc=m.torso.map.image,g=tc.getContext('2d');
  g.fillStyle=k.shirt;g.fillRect(0,0,16,64);g.fillStyle=k.pants;g.fillRect(0,0,16,14);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(0,13,16,1);m.torso.map.needsUpdate=true;
  spPaint(SPECIES[key]?key:'earth',k);
  const ring=P.exM==='ring';col(m.ex,ring?'#f4dea2':k.cap||k.shirt);m.ex.emissive.set(ring?'#c9a050':'#000');Object.assign(m.ex,{roughness:ring?.3:.88,metalness:ring?.4:0});
  const sk=SKF.on;if(sk)skfSpecies(SPECIES[key]?key:'earth',B);
  for(const r of [...G.fielders,G.bowler]){
    for(let i=0;i<2;i++){r.thigh[i].geometry=B.thigh;r.shin[i].geometry=B.shin;r.foot[i].geometry=B.foot;r.uarm[i].geometry=B.uarm;r.farm[i].geometry=B.farm;}
    r.head.geometry=B.head;r.ex.visible=sk?ring:!!B.ex;if(B.ex)r.ex.geometry=B.ex;
    for(const q of r.parts)q.visible=!sk;
    if(r.sk){r.sk.visible=sk;if(!sk){r.wk.visible=false;if(r.hm)r.hm.visible=false;}}}
  if(sk&&SKF.hmMat)col(SKF.hmMat,k.cap||k.shirt);
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
  spBuild('earth');
  G.pm={shirt:kit(black,{roughness:.88}),pants:kit(black,{roughness:.9}),skin:peopleMat(),
    shoe:kit([0.9,0.9,0.9],{roughness:.6}),ex:kit(black,{roughness:.88,emissive:0}),torso:kit([1,1,1],{roughness:.88,map:painted(c=>{c.width=16;c.height=64;})})};
  G.torso=geo(torsoG(14,10,[[-.09,0,0],[-.08,.12,.09],[-.04,.165,.11],...TORSO.slice(3)]));
  G.fielders=Array.from({length:NFL},()=>personRig(G));G.bowler=personRig(G,true);G.bat=batterRig();G.ns=batterRig();G.ns.g.visible=false;
  return G;
}

// a limb from a toward t, clamped to its reach: [joint by IK toward the pole, the end it can reach]; bones keep the species' lengths
function reach(a,t,l1,l2,pole,st,dt){
  const d=V3.sub(t,a),D=Math.hypot(d[0],d[1],d[2]),M=(l1+l2)*.999;if(D>M)t=V3.add(a,V3.sc(d,M/D));
  return [st?MO.ikS(st,[0,0,0],a,t,l1,l2,pole,dt,40):ik(a,t,l1,l2,pole),t];}
// dejected variants (lost the match): torso lean, head drop; arms hanging, hands on hips, hands on knees
const DEJ=[[.38,.95],[.24,.8],[.8,.4]];
// fielding actions (o.act, from fplay in fieldTick): 1 run, 2 take or stop, 3 dive, 4 leap, 5 slide, 6 keeper (o.e: squat), 7 throw
// (o.e: 0 overarm, 1 underarm, 2 looping; the right hand on o.hx/hy/hz, the left arm leading toward the target);
// o.ap s after the hands meet the ball (negative: approach, launch), o.hx/hy/hz their target, o.e the stretch, o.sd +1 to his
// right. The body is posed standing, then turned as a whole about the hip (roll for a dive, pitch back for a slide) and lifted
const HJD=.04,H2O=MO.hands2Out();
// a dive's roll: further for a longer stretch, and for a lower ball (a short dive at the grass would leave the hands above it)
const diveTh=(e,y)=>(35+45*clamp(Math.max(e/1.2,(.9-y)/.8),0,1))*D2R;
// per-rig motion state: IK hysteresis (mkIk) plus the gait (planted feet while moving), the anchors (planted feet standing: pivot
// steps, the split-step), the head's look springs, the run amount; gm 1 while the gait has the feet; ring: a ring/deep fielder
// (split-steps at the release); t/x/z the last frame (a restart or a teleport resets everything)
const mkPIk=()=>Object.assign(mkIk(),{g:MO.gaitState(),a:MO.anchorsState(),lk:MO.lookState(),ra:MO.springState(),cr:MO.springState(),idl:MO.springState(),gv:[MO.springState(),MO.springState()],hy:MO.springState(),gp:[MO.springState(),MO.springState()],gm:0,ring:0,x:0,z:0,bf:[[0,0,0],[0,0,0]],bfc:[0,0],bw:0,tf:[[0,0,0],[0,0,0]],tfy:[0,0],tfc:0});
// per-frame cues render3D sets before the people are posed: the release clock (split-step), where everyone looks (the ball, else
// the batter), the ball's position when it is in play (idle glances only without it)
const PS={split:-9,pbt:null,look:[0,1.1,BATS_Z],ball:false};
/* planted feet for a standing or moving person: the gait while he moves (feet locked to the ground, swings on arcs), the anchors
   when he stands (feet stay, one pivot step at a time when the facing turns, a split-step at the release); one hands the feet
   to the other where they are. Writes PFT: foot world positions [left, right] (y = lift), yaw per foot, the gait cues (null when
   standing), sp 1 while a split-step is in the air */
const PFT={f:[[0,0,0],[0,0,0]],yaw:[0,0],st:[1,1],g:null,sp:0},GPP=new Float64Array(14),GSP2={st:1,lf:1,fq:1,fl:0};
// the gait taking over planted feet: each foot's stance phase from where it stands along the travel (a foot already behind
// the hip toes off soon, one ahead stays planted), the two kept half a cycle apart; otherwise the first stance of a foot
// starting beside the hip would run on until it is far beyond the leg's reach
function gaitPhase(g,x,z,vx,vz,speed,gp,P2){
  const ux=vx/speed,uz=vz/speed,D=gp[0],stride=(gp[1]+gp[2]*speed)*P2.st/(P2.fq||1),ahead=D*stride*gp[10],v=[0,0];
  for(let i=0;i<2;i++){const fr=(g.foot[i][0]-x)*ux+(g.foot[i][2]-z)*uz;v[i]=clamp((ahead-fr)/(D*stride),0,1);}
  // the foot further back toes off at once (a standing start: the other, still beside the hip, then toes off as it lands)
  // the foot further back toes off at once; the other's stance ends as it lands (a walk toes off only with the other foot down)
  const m=v[0]>=v[1]?0:1,vm=Math.max(v[m],.9);g.ls[m]=g.ph-vm*D;g.ls[1-m]=g.ph-clamp(1-((1-vm)*D+(1-D))/D,0,1)*D;
}
function feetStep(ik,x,z,face,vx0,vz0,dt,P,reset){
  if(reset){ik.gv[0].x=vx0;ik.gv[0].v=0;ik.gv[1].x=vz0;ik.gv[1].v=0;}
  const vx=MO.spring(ik.gv[0],vx0,dt,16),vz=MO.spring(ik.gv[1],vz0,dt,16);
  const g=ik.g,a=ik.a,hw=.1*P.tw,speed=Math.hypot(vx,vz),gp=MO.gaitParams(GPP,speed<1.9?1:speed<4.2?2:3,speed),cyc=(gp[1]+gp[2]*speed)*P.st/(P.fq||1);
  // a cycle longer than 2.6 m would leave a planted foot beyond the leg (the sprint's 3.8 m): the stride shortens, the cadence rises
  GSP2.st=P.st*Math.min(1,2.3/Math.max(.1,cyc));GSP2.lf=P.lf;GSP2.fq=P.fq;GSP2.fl=P.fl;const P2=GSP2;
  if(reset){MO.gaitReset(g,x,z,face,hw,0);MO.anchorsReset(a,x,z,face,hw);ik.gm=0;}
  // a planted foot the body has left beyond the leg's reach (a backpedal, a turn) toes off now rather than being dragged
  if(ik.gm&&dt>0)for(let i=0;i<2;i++)if(g.st[i]&&g.st[1-i]){const dx=g.foot[i][0]-x,dz=g.foot[i][2]-z,fr=dx*Math.sin(face)+dz*Math.cos(face);
    if(Math.hypot(dx,dz)>(fr<-.05?.62:.4)){g.st[i]=0;g.u[i]=1e-6;MO.cp(g.lock[i],g.foot[i]);break;}}
  if(ik.gm){MO.gaitStep(g,x,z,face,vx,vz,dt,P2);
    if(speed<.08&&g.st[0]&&g.st[1]&&g.u[0]===0&&g.u[1]===0){ik.gm=0;
      for(let i=0;i<2;i++){MO.cp(a.foot[i],g.foot[i]);a.foot[i][1]=0;a.yaw[i]=g.mode===MO.GM.side||g.mode===MO.GM.back?face:MO.yawOf(g.travel);a.st[i]=1;a.u[i]=0;}
      a.hold=.12;a.split=-1;a.wx=0;a.air=0;}}
  if(!ik.gm){
    // (a split-step lands first; a pivot step in the air goes on as the gait's swing, from where it started to where it was going)
    if(speed>.3&&a.split<0){ik.gm=1;MO.gaitReset(g,x,z,face,hw,0);
      for(let i=0;i<2;i++){MO.cp(g.foot[i],a.foot[i]);if(a.st[i]){g.foot[i][1]=0;MO.cp(g.lock[i],g.foot[i]);MO.cp(g.tgt[i],g.foot[i]);}}
      gaitPhase(g,x,z,vx,vz,speed,gp,P2);
      for(let i=0;i<2;i++)if(!a.st[i]){g.st[i]=0;g.u[i]=Math.max(2e-6,a.u[i]);MO.cp(g.lock[i],a.from[i]);g.lock[i][1]=0;MO.cp(g.tgt[i],a.tgt[i]);}
      MO.gaitStep(g,x,z,face,vx,vz,dt,P2);}
    else{if(PS.split===clock&&ik.ring&&dt>0)MO.anchorsSplit(a);
      // a pivot step lands where it was aimed over its last 40%, turned with him (the target would otherwise follow the hips and slide it as it lands)
      const iu=!a.st[0]?0:!a.st[1]?1:-1,stp=iu>=0&&a.u[iu]>=.6;if(!stp||ik.ax==null){ik.ax=x;ik.az=z;ik.af=face;}
      MO.anchorsStep(a,stp?ik.ax:x,stp?ik.az:z,face,dt,{w:hw+(ik.ws||0),thr:.14,yawThr:.55,dur:.3,lift:.0225});}}
  const gm=ik.gm;
  for(let i=0;i<2;i++){const f=gm?g.foot[i]:a.foot[i];MO.cp(PFT.f[i],f);PFT.yaw[i]=gm?(g.mode===MO.GM.side||g.mode===MO.GM.back?face:MO.yawOf(g.travel)):a.yaw[i];PFT.st[i]=gm?g.st[i]:a.st[i];}
  PFT.g=gm?g:null;PFT.sp=gm?0:a.air;return PFT;
}
/* --- the bowling action (o.bt: s to/from the release, o.pc pace, o.rp the ball's release point). The run-up and the follow-through
   strides come from the gait; inside the window the hips, shoulders, lean, hands and feet follow keys over bt (BKP: pace, BKS:
   spin), the feet landing on fixed points about the hip's z at release (zh) so they stay planted; the bowling hand's release
   key is the solved release point, so it meets the ball exactly at bt 0. Pace: gather (hands together), a bound off the left
   foot, back-foot contact side-on (hips and shoulders turned to the off), the front arm high then pulled down, a braced front
   leg, the hips opening before the shoulders (separation), release with the arm over the top, a follow-through across the
   body to the off side. Spin: a short approach, the pivot on the back foot, a slower arm, the wrist turning through release. --- */
const kf=(K,t,lin)=>{if(t<=K[0][0])return K[0][1];const n=K.length;if(t>=K[n-1][0])return K[n-1][1];
  let i=1;while(K[i][0]<t)i++;const a=K[i-1],b=K[i],u=(t-a[0])/(b[0]-a[0]),e=lin?u:smooth(u);
  return Array.isArray(a[1])?V3.lerp(a[1],b[1],e):lerp(a[1],b[1],e);};
// hip height x hy0, hips yaw, shoulders yaw (+: the right side back), lean (rad), the hands from their shoulders (x his right, y
// up, z toward the batter, x AL; 'rp' = the release point), the back of each hand, elbow poles; feet: [takeoff, landing, point
// about zh (x his right of the hip's x, z toward the batter = -z), yaw (0 toward the batter), lift]; w0/w1 the window
// times are s from the release (bt). Pace: the bound off the left foot (-.42), back-foot contact side-on (-.22: hips .9 rad and
// shoulders 1.25 turned, the front arm high, the bowling hand low behind), front-foot contact (-.06: the front leg braced, the
// front arm pulling down, the bowling arm coming through from low behind, the chest closing), release over the top (0), the arm
// down across the body outside the front thigh, the back leg through (.2), then the follow-through strides
const BKP={w0:-.42,w1:.45,sht:[[-.2,0],[-.04,.1],[0,.16],[.12,.04],[.3,0]],hy:[[-.42,1],[-.3,1.05],[-.22,.92],[-.09,.88],[0,.95],[.15,.92],[.45,.96]],
  gy:[[-.42,.2],[-.3,.6],[-.22,.9],[-.09,.6],[0,0],[.12,-.35],[.3,-.2],[.45,-.05]],sy:[[-.42,.3],[-.3,1],[-.22,1.25],[-.09,1],[0,.05],[.12,-.6],[.3,-.35],[.45,-.1]],
  ln:[[-.42,.1],[-.3,-.05],[-.22,-.1],[-.09,0],[0,.35],[.12,.65],[.3,.4],[.45,.25]],
  hr:[[-.6,[-.1,-.32,.42]],[-.42,[-.05,-.2,.62]],[-.3,[.1,0,.66]],[-.26,[.36,-.3,.3]],[-.22,[.3,-.62,-.35]],[-.09,[.2,-.72,-.5]],[-.06,[.22,-.15,-.9]],[-.03,[.18,.65,-.6]],[0,'rp'],[.04,[-.05,.5,.55]],[.12,[-.35,-.3,.65]],[.3,[-.7,-.5,.35]],[.45,[-.25,-.7,.35]]],
  hl:[[-.6,[.1,-.32,.42]],[-.42,[.15,-.35,.55]],[-.3,[0,.3,.6]],[-.22,[-.05,.85,.5]],[-.09,[-.12,.72,.6]],[-.03,[-.3,.25,.6]],[0,[-.35,-.35,.35]],[.12,[-.3,-.65,-.05]],[.3,[-.1,-.72,0]]],
  gr:[[-.42,[.3,-.3,-.9]],[-.22,[.3,-.5,-.8]],[-.04,[.2,.4,-.9]],[0,[0,.2,-1]],[.12,[-.7,.5,.4]]],gl:[[-.42,[-.3,-.3,-.9]],[-.22,[-.8,.3,-.4]],[0,[-.6,-.3,-.7]]],
  pr:[[-.42,[1,-.3,-.3]],[-.22,[1,.3,-.4]],[-.04,[1,.1,-.2]],[.04,[.8,-.4,.5]],[.3,[.3,-.5,.8]]],pl:[[-.42,[-1,-.3,-.3]],[-.22,[-1,.4,.1]],[0,[-1,-.3,-.5]]],
  // feet: [from, to, landing point (x his right of his line, z behind the release hip line zh = -z ahead), yaw, lift]; a key with
  // no lift on the same point turns the planted foot about its ball
  ft:[[[-.42,-.09,[-.05,.15],Math.PI-.25,.3],[.22,.45,[-.22,-1.52],Math.PI-.3,.12,-.12]],[[-.42,-.22,[.05,1.35],Math.PI/2,.25,.15],[-.2,-.11,[.05,1.35],Math.PI/2+.35,0],[-.1,.2,[.3,-.85],Math.PI-.4,.12,.2]]]};
// spin: a short approach, a small gather, the back foot landing side-on (-.25) and pivoting on its ball, the front arm up and
// leading at the target, the front foot down (-.08), a rounder, slower arm with the wrist cocked, then a short follow-through
const BKS={w0:-.4,w1:.5,sht:[[-.15,0],[0,.1],[.15,.03],[.4,0]],hy:[[-.4,1],[-.3,1.03],[-.25,.93],[-.1,.92],[0,.98],[.2,.95],[.5,.97]],
  gy:[[-.4,.1],[-.25,.7],[-.1,.5],[0,.1],[.2,-.3],[.5,-.1]],sy:[[-.4,.2],[-.25,1.1],[-.1,.9],[0,.15],[.2,-.45],[.5,-.15]],
  ln:[[-.4,.05],[-.25,-.05],[-.1,.05],[0,.25],[.2,.4],[.5,.25]],
  hr:[[-.6,[-.1,-.3,.45]],[-.4,[-.05,-.25,.6]],[-.25,[.05,.1,.62]],[-.18,[.36,-.35,.25]],[-.1,[.3,-.72,-.3]],[-.06,[.25,-.1,-.9]],[-.03,[.18,.65,-.6]],[0,'rp'],[.06,[-.1,.35,.55]],[.18,[-.45,-.3,.5]],[.4,[-.3,-.65,.35]]],
  hl:[[-.6,[.1,-.3,.45]],[-.4,[.15,-.3,.5]],[-.25,[0,.55,.6]],[-.12,[-.05,.8,.5]],[-.05,[-.15,.55,.7]],[0,[-.35,-.2,.45]],[.2,[-.2,-.62,0]]],
  gr:[[-.25,[.3,-.4,-.85]],[0,[.5,.1,-.85]],[.15,[-.4,.7,.3]]],gl:[[-.25,[-.8,.3,-.4]],[0,[-.6,-.3,-.7]]],
  pr:[[-.25,[1,.3,-.4]],[0,[1,0,0]],[.15,[.5,-.4,.6]]],pl:[[-.25,[-1,.4,.1]],[0,[-1,-.3,-.5]]],
  ft:[[[-.4,-.08,[-.05,.15],Math.PI-.2,.2],[.3,.5,[-.2,-.8],Math.PI-.3,.1,-.12]],[[-.4,-.25,[.05,1],Math.PI/2+.3,.15],[-.22,-.1,[.05,1],Math.PI-.6,0],[-.08,.25,[.22,-.45],Math.PI-.4,.1,.18]]]};
// the bowler's x drift after the release: across to the off side (the release side's), off the pitch
const bdrift=(bt,pc,bx)=>bt==null||bt<=0?0:(pc?.9:.6)*smooth(clamp(bt/(pc?.8:.6),0,1))*(bx<0?-1:1);
// his weight on the bowling pose: 1 inside the window and through the follow-through, fading as he runs through
const bowlW=(bt,K)=>bt==null?0:bt<K.w0-.25?0:bt<K.w0?smooth((bt-K.w0+.25)/.25):bt<=K.w1?1:1-smooth(clamp((bt-K.w1)/.3,0,1));
// a fielder's, keeper's or bowler's joints (game coordinates, the whole-body turn and lift applied), in the shape batJoints returns:
// index 0 = his left, 1 = his right; s/ha point to his left, hx to his right, up/fwd the body frame after the turn; wr the wrist
// (end of the forearm) = hd, the hand bone's head (the skinned palm sits on it); wa the hand's aim (fingers), gn the back of the
// hand; nt the neck top (rig.py neck above the shoulder centre), hc the head's centre .06 above it; kp/ap the knee and elbow poles
// (directions); L = the shared body's lengths. Two-handed plays (take, catch, leap, dive, keeper) use MO.hands2: hands side by
// side across the ball's line, palms to it, fingers up above the chest and cupped below, the shoulders turned toward the ball so
// the arms reach in front of the chest (never across each other) and the head turned to watch it. Feet come from feetStep (the
// gait or the anchors) unless an action has the body off its feet (dive, leap, slide) or the bowling keys place them.
function personJoints(x,z,face,o,id=0,dj=0,ik=null){
  const P=SPX,c=Math.cos(face),s=Math.sin(face),act=o.act||0,ap=o.ap||0,os=o.sd||1,vx=o.vx||0,vz=o.vz||0,speed=Math.hypot(vx,vz);
  // per-rig state: a restart or a teleport (a replay reusing the rig, a camera cut) snaps everything
  let dt=0,jump=true;if(ik){dt=clock-ik.t;jump=ik.t<0||dt<0||dt>.25||Math.hypot(x-ik.x,z-ik.z)>.5+speed*dt*1.5;
    if(jump){dt=0;for(const q of [...ik.e,...ik.k])q.ok=0;ik.lk.ok=0;}ik.t=clock;ik.x=x;ik.z=z;ik.ring=!o.kp&&!o.bwl&&o.bt==null&&Math.hypot(x,z-BATS_Z)>18?1:0;}
  const dv=id%3,dl=DEJ[dv],L=P.th+P.sh,k=L/.93,AL=P.ua+P.fa,tw=P.tw,hy0=P.an+HJD+L*P.kn,bt=o.bt,bw=bt!=null,BKK=o.pc?BKP:BKS,bww=bw?bowlW(bt,BKK):0;
  // run amount (the arms' carriage) from the recorded speed, eased
  // the idle variant (hands on hips) settles in slowly and leaves at once when he moves off
  const ra=ik?MO.spring(ik.ra,clamp((speed-1.4)/1.2,0,1),dt,12):clamp((speed-1.4)/1.2,0,1),
    idlT=speed<.15&&!act&&!(o.crouch||0)&&bt==null&&!dj?1:0,idl=ik?MO.spring(ik.idl,idlT,dt,idlT>ik.idl.x?5:18):0;
  // the ready crouch (a recorded flag) eases in and out
  let cr=ik?MO.spring(ik.cr,o.crouch||0,dt,8):o.crouch||0,st=0,sq=0,rl=0,pt=0,hip=null,jh=0,wh=0,sl5=0,sp=0,db=0,dvh=null;if(ik&&jump){ik.cr.x=o.crouch||0;ik.cr.v=0;cr=ik.cr.x;}
  const rel=(a,b,u)=>ap<0?smooth(clamp((ap-a)/(b-a),0,1)):o.hold?1:1-smooth(clamp((ap-u)/.45,0,1));
  if(act===2){wh=rel(-.35,-.05,.25);st=wh*clamp((1.05-o.hy)/.85,0,1);sq=wh*clamp((.75-o.hy)/.5,0,1);jh=clamp(o.hy-(hy0+P.tor*.926+AL*.93)+.04,0,.5)*wh;}
  else if(act===3){const T=.12+o.e/6,th=os*diveTh(o.e,o.hy),lo=Math.max(.2+.07*clamp((Math.abs(th)-.87)/.52,0,1),hy0*Math.cos(th)+.06),hc=clamp(o.hy-.1,lo+.05,1.6);
    if(ap<-T)wh=.5*smooth(clamp((ap+T+.25)/.25,0,1));
    else if(ap<=0){const g=smooth((ap+T)/T);rl=th*g;dvh=[0,g,hc,lo];wh=.5+.5*smooth(clamp(g*3,0,1));sp=1;db=g;}
    else{const g=ap<.5?0:smooth(clamp((ap-.5)/.6,0,1));rl=th*(1-g);dvh=[1,g,hc,lo];wh=o.hold?1:1-g;sp=1-g;db=1-g;}}
  else if(act===4){const jm=1.2*FS[M?physD():'medium'].jp*Math.min(9,9.8/G);jh=clamp(o.hy-(hy0+P.tor*.926+AL)+.06,0,jm+.06)*(ap>-.35&&ap<.35?Math.sin(Math.PI*(ap+.35)/.7):0);   // (+.06: the wrist sits below a fingertip catch)
    st=ap<-.35?.45*smooth(clamp((ap+.6)/.25,0,1)):ap>.35?.4*(1-smooth(clamp((ap-.35)/.3,0,1))):0;wh=rel(-.55,-.2,.4);}
  else if(act===5){const g=ap<0?smooth(clamp((ap+.45)/.45,0,1)):ap<.6?1:1-smooth(clamp((ap-.6)/.5,0,1));sl5=g;pt=.85*g;hip=lerp(hy0,.34,g);wh=rel(-.35,-.1,.6);}
  else if(act===6){wh=1;st=.9*(1-o.e)*clamp((1.05-o.hy)/.85,0,1);sq=Math.max(o.e,clamp((.75-o.hy)/.5,0,1));}
  else if(act===7)st=Math.max(Math.floor(o.e+1e-6)===1?.3:.1,clamp((1.05-o.hy)/.85,0,1));
  // feet: planted by the gait/anchors (world), lifted together in a leap or a split-step; the bowling keys place them in the window
  const hw=.1*tw;if(ik)ik.ws=act===7&&Math.floor(o.e+1e-6)!==1?.15*smooth(clamp((ap+.6)/.3,0,1))*(1-smooth(clamp((ap-.4)/.4,0,1))):0;   // a throw's wide stance: side-on, his width lies along the throw
  const F=ik?feetStep(ik,x,z,face,vx,vz,dt,P,jump):null,GT=F&&F.g,tk=.14*k*smooth(clamp(jh/.08,0,1));   // up on the toes, then a hop, for a ball above the reach
  const Wi0=w=>{const dx=w[0]-x,dz=w[2]-z;return [dx*c-dz*s,w[1],dx*s+dz*c];};
  let fL,fR,fyL=face,fyR=face;const fpl=[1,1];   // fpl: planted (on the ground, not a swing or an arc)
  if(F){fL=Wi0(F.f[0]);fR=Wi0(F.f[1]);fyL=F.yaw[0];fyR=F.yaw[1];fL[1]+=tk;fR[1]+=tk;fpl[0]=F.st[0];fpl[1]=F.st[1];}
  else{fL=[-hw,tk,0];fR=[hw,tk,0];}
  let kb=0;
  if(bw&&bt>=BKK.w0-.001&&bt<=BKK.w1+.001&&ik){const zh=BZR[o.pc?'pace':'spin'],sx=o.bx<0?-1:1;
    // the window's feet: from where the gait left them (each captured as its own first key starts) on arcs to their landing
    // points, then planted
    if(!ik.bw){ik.bw=1;ik.bfc[0]=ik.bfc[1]=0;}
    const fw=[fL,fR];for(let i=0;i<2;i++){const KF=BKK.ft[i];let pos=null,yaw=face;
      if(!ik.bfc[i]){if(bt<KF[0][0])continue;ik.bfc[i]=1;MO.cp(ik.bf[i],F.f[i]);}
      // (facing down the pitch his right is -x: points and yaws are mirrored into game x; plus his drift to the off side)
      for(const [t0,t1,pt,yw0,lf,bg] of KF){const land=[o.bx+bdrift(t1,o.pc,o.bx)-pt[0]*sx,0,zh+pt[1]],yw=sx>0?2*Math.PI-yw0:yw0;
        if(bt<t0)break;if(bt<t1){const u=(bt-t0)/(t1-t0),from=pos||ik.bf[i];pos=[lerp(from[0],land[0],MO.trav(u))-(bg||0)*sx*Math.sin(Math.PI*u),lerp(from[1],0,smooth(u))+Math.sin(Math.PI*u)*lf,lerp(from[2],land[2],MO.trav(u))];   /* (bg: a swing leg passing the planted one bows out round it) */yaw=lerp(yaw,yw,smooth(u));}
        else{pos=land;yaw=yw;}}
      if(pos){const l=Wi0(pos);fw[i][0]=l[0];fw[i][1]=l[1];fw[i][2]=l[2];if(i)fyR=yaw;else fyL=yaw;fpl[i]=pos[1]===0?1:0;}}
    kb=1;
    // the gait takes the feet back where the keys left them, planted
    if(bt>BKK.w1-.02){const g=ik.g;ik.gm=1;MO.gaitReset(g,x,z,face,hw,0);for(let i=0;i<2;i++){const w=[x+fw[i][0]*c+fw[i][2]*s,0,z-fw[i][0]*s+fw[i][2]*c];MO.cp(g.foot[i],w);MO.cp(g.lock[i],w);MO.cp(g.tgt[i],w);}
      if(speed>.3)gaitPhase(g,x,z,vx,vz,speed,MO.gaitParams(GPP,speed<1.9?1:speed<4.2?2:3,speed),GSP2);}}
  else if(ik)ik.bw=0;
  // a dive's launch: the legs trail and bend (the feet lifted toward the hip bend the knees); a slide places them along the ground
  // (the feet lift before they tuck, and come down after they return, so a foot on the ground never slides)
  if(db>0){const dL=[-hw,.22,-.05],dR=[hw,.12,-.2],dy=Math.min(1,db*3),dxz=smooth(clamp((db-.2)/.8,0,1));
    [[fL,dL],[fR,dR]].forEach(([f,d])=>{f[0]=lerp(f[0],d[0],dxz);f[2]=lerp(f[2],d[2],dxz);f[1]=lerp(f[1],d[1],dy);});}
  // a throw: the feet stay with the gait/anchors, which step him through the crow-hop (his body travels toward the target over the
  // wind-up) and pivot them as he turns side-on; nothing places them, so a planted foot never slides
  const ty7=act===7?Math.floor(o.e+1e-6):0,gth=act===7?(o.e-ty7)*4:0;   // the throw's kind and its gather blend (both hands still on the ball)
  const up=GT?GT.pelvis[1]:0;
  let hy=up+P.an+HJD+L*(P.kn-Math.min(.52,ra*.06+cr*.1+(dv===2?dj:0)*.1+.34*st+.44*sq+idl*.012));
  if(kb)hy=lerp(hy,hy0*kf(BKK.hy,bt),bww);
  // a planted foot beyond the leg's reach (the trailing foot before toe-off) lifts onto its toes (reach clamps the leg) rather
  // than pulling the hips to the ground: the hips give at most a deep crouch
  // (a planted foot's ankle may pivot up to .2 on its toes before the hips need to give)
  // the pelvis turns with the stride (the right hip back when the left leg leads) and sways over the stance foot
  let gy=GT?GT.pelvis[2]:0;const swy=(GT?GT.pelvis[0]:0)+idl*(id&2?.03:-.03);if(kb)gy=lerp(gy,kf(BKK.gy,bt),bww);
  const cgy=Math.cos(gy),sgy=Math.sin(gy);
  // the reach ceiling from the hip joints as they are drawn (pelvis yaw and sway included), a little inside the leg's clamp, so
  // a planted foot is never pulled along the ground by the IK
  // (hyR for the feet on the ground, a hard ceiling; hyS also eases the hips down for a foot coming down to land)
  // (a gait foot in its swing also eases them toward where it will land, over the swing's last third)
  let hyR=9,hyS=9;if(!sl5)for(let i=0;i<2;i++){const sd=i?1:-1,jx=sd*hw*cgy+swy,jz=-sd*hw*sgy,
      ceil=f=>Math.max(hy0*.78,f[1]+(f[1]<.1&&f[2]-jz<-.05&&db===0?.18:0)+P.an+HJD+Math.sqrt(Math.max(0,(L*.985)**2-(f[0]-jx)**2-(f[2]-jz)**2)));
    const f=i?fR:fL,cy=ceil(f),up=Math.max(0,f[1]-tk);hyS=Math.min(hyS,cy+up*2.5);if(up<.012)hyR=Math.min(hyR,cy);
    if(GT&&!kb&&!GT.st[i]&&GT.u[i]>0){const t=Wi0(GT.tgt[i]);t[1]=tk;hyS=Math.min(hyS,ceil(t)+(1-GT.u[i])*.35);}}
  if(sl5)hy=hy0;else hy=Math.min(hy,hyS);
  // the standing height eases (the reach floor releasing at toe-off would pop the hips up otherwise), never above the ceiling
  if(ik){if(jump){ik.hy.x=hy;ik.hy.v=0;}hy=MO.spring(ik.hy,hy,dt,30);if(!sl5&&hy>Math.min(hyR,hyS)){hy=Math.min(hyR,hyS);ik.hy.x=hy;ik.hy.v=Math.min(ik.hy.v,0);}}
  // a dive's hip: launch from the current height up to the flight height, down to the ground, then back up
  if(dvh){const [ph2,g,hc,lo]=dvh;hip=ph2===0?lerp(hy,hc,g)+.12*Math.sin(Math.PI*g):ap<.3?lerp(hc,lo,(ap/.3)**2):lerp(lo,hy,g);}
  // torso lean ln forward about the hips (the gait's lean with speed and acceleration); for a two-handed take the lean grows (then
  // the hips drop) until the ball is within the arms' reach of the shoulder centre, so the hands get there instead of stopping short
  let ln=P.hu+ra*.1+(GT?GT.lean:0)+cr*.3+dj*dl[0]+st*1.05+sq*.4;if(kb)ln=lerp(ln,kf(BKK.ln,bt),bww);
  // a throw: a little back at the top of the wind-up, the weight forward onto the front foot through the release
  if(act===7&&ty7!==1)ln+=ap<0?-.12*smooth(clamp((ap+.45)/.3,0,1))*smooth(clamp(-ap/.15,0,1)):.3*smooth(clamp(ap/.22,0,1))*(1-smooth(clamp((ap-.5)/.4,0,1)));
  const shy=P.tor*.926-dj*.04,two=wh>0&&act!==7;
  if(two&&(act===2||act===6)){const dx=o.hx-x,dz=o.hz-z,bl=[dx*c-dz*s,o.hy-jh,dx*s+dz*c],r=AL*.88,low=bl[1]<hy+shy*Math.cos(ln)-.05;
    // the extra lean and hip drop come in with wh (the hands' blend), never in one frame
    if(low){let l2=ln,h2=hy;for(let k=0;k<12;k++){const sc=[0,h2+shy*Math.cos(l2),shy*Math.sin(l2)];if(V3.dist(bl,sc)<=r)break;if(l2<1.25)l2+=.1;else if(h2>.45)h2-=.04;else break;}
      ln+=(l2-ln)*wh;hy+=(h2-hy)*wh;}
    else{const sc=[0,hy+shy*Math.cos(ln),shy*Math.sin(ln)];jh+=clamp(V3.dist(bl,sc)-r,0,.3)*wh;}}
  // the bowling hand must reach the release point at bt 0: the body rises onto the toes for what the arm lacks
  // the bowling hand must reach the release point at bt 0: what the arm lacks, the spine and shoulder stretch up (stx), the feet stay planted
  let rpB=null,stx=0;if(kb){const st2=kf(BKK.sht,bt)*bww,S1=[.2*tw*Math.cos(kf(BKK.sy,bt)),hy+(shy+st2*.8)*Math.cos(ln),shy*Math.sin(ln)-.2*tw*Math.sin(kf(BKK.sy,bt))];rpB=Wi0(o.rp);
    const need=V3.dist(rpB,S1)-AL*.985,wr=smooth(clamp(1-Math.abs(bt)/.1,0,1));if(need>0)stx=Math.min(.12,need)*wr;}
  // whole-body turn about the hip (py): roll rl about the forward axis (+: head to his right), pitch pt (+: head back), then lift
  const py=hy,lift=hip!=null?hip-hy:jh,cl=Math.cos(rl),slr=Math.sin(rl),cp=Math.cos(pt),spt=Math.sin(pt);
  const Qd=l=>{const x1=l[0]*cl+l[1]*slr,y1=-l[0]*slr+l[1]*cl;return [x1,y1*cp+l[2]*spt,-y1*spt+l[2]*cp];},
    Q=l=>{const q=Qd([l[0],l[1]-py,l[2]]);q[1]+=py+lift;return q;},
    Qi=q=>{const b=q[1]-py-lift,y1=b*cp-q[2]*spt,z1=b*spt+q[2]*cp;return [q[0]*cl-y1*slr,q[0]*slr+y1*cl+py,z1];},
    W=l=>{const q=Q(l);return [x+q[0]*c+q[2]*s,q[1],z-q[0]*s+q[2]*c];},Wd=l=>{const q=Qd(l);return [q[0]*c+q[2]*s,q[1],-q[0]*s+q[2]*c];},
    Wi=w=>{const dx=w[0]-x,dz=w[2]-z;return Qi([dx*c-dz*s,w[1],dx*s+dz*c]);},R=Wd([1,0,0]),Fw=Wd([0,0,1]),U=Wd([0,1,0]);
  const J={L:P,hr:P.hr[1],lr:P.lr,ar:P.ar,hx:R,up:U,fwd:Fw,t:[],an:[],hj:[],kp:[],kn:[],fw:[],sole:[],sp:[],ap:[],e:[],wr:[],hd:[],wa:[],gn:[]};
  // slide: the leading leg along the ground ahead, the other tucked under (feet placed in the turned frame)
  if(sl5){const uy=Math.min(1,sl5*4),uxz=smooth(clamp((sl5-.25)/.75,0,1));   // off the ground first, then along it (and back the same way)
    [[fL,[-.16,P.an+.03,.28*k]],[fR,[.1,P.an+.03,.95*k]]].forEach(([f,a])=>{const l=Qi(a);for(let j=0;j<3;j++)f[j]=lerp(f[j],l[j]-(j===1?P.an:0),j===1?uy:uxz);if(f[1]<.03*uy)f[1]=.03*uy;});}
  [fL,fR].forEach((f,i)=>{const sd=i?1:-1,hj=W([sd*hw*cgy+swy,hy-HJD,-sd*hw*sgy]),fy=i?fyR:fyL,ff=[Math.sin(fy-face),0,Math.cos(fy-face)],
      kp=Wd(sl5||db>0||kb?[sd*.12+sd*.3*sq,0,1]:V3.lerp([sd*.1,0,1],[ff[0],-.15+.6*Math.max(st,sq),ff[2]],.7)),ft=W([f[0],f[1]+P.an,f[2]]),fy0=P.an+(sl5?.035*Math.min(1,sl5*4):db>0?.035*Math.min(1,db*5):0);if(ft[1]<fy0)ft[1]=fy0;   // (a sliding or diving foot leaves the turf first: it never skids on it)
    // a planted foot the leg can no longer reach flat (the trailing foot before toe-off) pivots on its toes: the heel and ankle
    // rise toward the hip and the foot pitches down, so the toe stays where it is instead of the foot sliding
    // (also a foot just off the ground at toe-off, still beyond the leg: the swing lifts it before it travels)
    // the gait's heel strike (toes up) and toe-off (heel rising about the ball of the foot) pitch the foot
    const gp0=GT&&!sl5&&db===0?GT.pitch[i]:0,gq=ik&&ik.gp[i];if(gq&&jump){gq.x=gp0;gq.v=0;}const gpt=gq?MO.spring(gq,gp0,dt,40):gp0;
    let tilt=0;if(!sl5&&db===0){const Lr=(P.th+P.sh)*.99,dh=V3.sub(ft,hj),hd=dh[0]*dh[0]+dh[2]*dh[2],back=-(dh[0]*s+dh[2]*c),y0=P.an+Math.min(f[1],tk),gR=gpt<0?Math.sin(-gpt)*.15:0;
      // a low foot behind the hip rises onto its toes as it trails (the heel up .24 by .65 m behind), and at least enough for the
      // leg to reach it (the hips keep an .18 allowance for that: hy above), as a floor under the ankle (a foot lifting into its
      // swing carries on from it, never drops); a foot too far for any pivot is drawn in along the ground instead of being hoisted
      // up the leg's line by the IK clamp
      let y=Math.max(ft[1]+gR,y0+(back>.2?.24*smooth(clamp((back-.2)/.45,0,1)):0));
      if(back>0&&hd+(hj[1]-y)**2>Lr*Lr)y=clamp(hj[1]-Math.sqrt(Math.max(0,Lr*Lr-hd)),y,Math.max(y,y0+.2));
      const r=y-ft[1];if(r>0){ft[1]=y;tilt=gpt<0&&gR>=r-1e-6?-gpt:Math.asin(Math.min(1,r/.27));dh[1]=ft[1]-hj[1];}
      const mh=Math.sqrt(Math.max(0,Lr*Lr-dh[1]*dh[1]));if(hd>mh*mh&&hd>1e-9){const q=mh/Math.sqrt(hd);ft[0]=hj[0]+dh[0]*q;ft[2]=hj[2]+dh[2]*q;}}
    if(gpt>0)ft[1]+=Math.sin(gpt)*.07;   // about the heel
    const [kn,an]=reach(hj,ft,P.th,P.sh,kp,ik&&ik.k[i],dt),pa=(gpt>0?gpt:0)-tilt,fwt=pa?[ff[0]*Math.cos(pa),Math.sin(pa),ff[2]*Math.cos(pa)]:ff;
    J.hj[i]=hj;J.kp[i]=kp;J.kn[i]=kn;J.an[i]=an;J.sole[i]=V3.sub(an,V3.sc(U,P.an));J.fw[i]=J.t[i]=sl5||db>0?Fw:Wd(fwt);});
  // torso frame; the shoulders yaw sy toward a two-handed play (the head follows further, hyw), counter to the pelvis in a stride
  const cn=Math.cos(ln),snl=Math.sin(ln),Yl=[0,cn,snl],n0=[0,-snl,cn],hp=[0,hy,0];
  const sht=kb?kf(BKK.sht,bt)*bww:0,slump=[0,-snl*dj*.06,cn*dj*.06],SC=V3.add(V3.add(hp,V3.sc(Yl,shy+sht*.3+stx)),slump);   // sht: the bowling shoulder up, the spine stretched
  let sy=GT?GT.sh:0,hyw=0;if(kb)sy=lerp(sy,kf(BKK.sy,bt),bww);
  if(act===7&&ty7!==1)sy+=(1-gth)*(ap<0?.75*smooth(clamp((ap+.55)/.3,0,1))*(1-smooth(clamp((ap+.1)/.1,0,1))):-.45*smooth(clamp(ap/.25,0,1)));
  if(two){const d=V3.sub(Wi([o.hx,o.hy,o.hz]),SC),yb=Math.atan2(d[0],d[2]);sy=clamp(yb,-1.1,1.1)*.85*wh;hyw=clamp(yb-sy,-.9,.9)*wh;}
  const csy=Math.cos(sy),ssy=Math.sin(sy),rt=[csy,ssy*snl,-ssy*cn],nn=[ssy,-csy*snl,csy*cn];
  J.hip=W(hp);J.n=Wd(nn);J.Y=Wd(Yl);J.s=Wd(V3.sc(rt,-1));J.ha=Wd([-1,0,0]);J.sh=W(SC);J.t0=V3.lerp(J.hip,J.sh,.1);
  const SP=[0,1].map(i=>V3.add(V3.add(SC,V3.sc(rt,(i?1:-1)*(.2*tw-dj*.02))),V3.sc(Yl,(i?1:-1)*sht*.5))),shp=SP.map(W);
  // head: eyes on the ball, else the batter (MO.lookAt, springs per rig; an idle glance wanders a little without a ball in play);
  // pitch hq (nod, lean, dejection, a stoop), yaw hyw about its own up; the neck leans between the spine and the head
  let hpit=0;
  if(ik&&!two){const eye=[x,hy+shy+P.nk,z],tg=PS.look;MO.lookAt(ik.lk,LKO,eye,tg,face,jump?undefined:dt,14);
    hyw=clamp(ik.lk.yaw.x,-1.1,1.1)*(1-bww)+(bww?clamp(MO.wrap(Math.atan2(tg[0]-x,tg[2]-z)-face),-1.1,1.1)*bww:0);hpit=ik.lk.pitch.x;
    if(!PS.ball&&speed<.2&&!dj&&act===0)hyw+=.18*Math.sin(clock*.29+id*2.1)*(1-bww);}
  const hq=P.nod+ln*.35+dj*dl[1]-st*.5-hpit*.7,Uh0=[0,Math.cos(hq),Math.sin(hq)],Fh0=[Math.sin(hyw),-Math.cos(hyw)*Math.sin(hq),Math.cos(hyw)*Math.cos(hq)],
    Yn=V3.norm(V3.lerp(Yl,Uh0,.5)),T=W(V3.add(SC,V3.sc(Yn,P.nk))),Uh=Wd(Uh0),Fh=Wd(Fh0);
  J.nt=T;J.hv=Uh;J.face=Fh;J.hc=V3.add(T,V3.sc(Uh,.06));
  let H2=null,HG=null;if(two){MO.hands2(H2O,[o.hx,o.hy,o.hz],null,J.sh,J.hip,J.n,V3.sc(J.s,-1),shp,AL*.96,o.kp?.13:.105,.05,.16);H2=H2O;
    // the bones' heads from the cupped palms (back along the fingers, off the palm); kept as far apart as the palms, since
    // fingers splayed inward would bring the wrists together
    HG=[0,1].map(i=>V3.sub(V3.sub(H2.hd[i],V3.sc(H2.fd[i],.035)),V3.sc(H2.pn[i],.02)));
    const gd=V3.sub(HG[1],HG[0]),gl=Math.hypot(gd[0],gd[1],gd[2]);if(gl<H2.sep&&gl>1e-6){const push=V3.sc(gd,(H2.sep-gl)/2/gl);HG[0]=V3.sub(HG[0],push);HG[1]=V3.add(HG[1],push);}}
  const bulge=Math.sin(Math.PI*wh)*.22;   // the hands swing out and round to the ball, not through the body
  for(let i=0;i<2;i++){const sd=i?1:-1,S=SP[i],sw=GT?GT.arm[i]:0;
    // t: the wrist from the shoulder (body frame), p: the elbow pole, gb: the back of the hand (body frame; gw: world), wa: the fingers
    // hanging arms swing with the stride (forward with the opposite leg); running, they bend to 90 deg and pump
    // hanging: soft elbows, hands by the thighs; running: elbows bent and tucked back, hands near the hip line, pumping
    let t=V3.lerp([sd*.05,-AL*.9,.06],[sd*.03,-AL*.56,.1],ra),p=V3.lerp([sd*.3,0,-1],[sd*.35,-.25,-.9],ra),gb=V3.lerp([sd*.9,0,-.4],[sd*.5,.2,-.8],ra),gw=null,wa=null;
    t[2]+=sw*AL*(.7-.3*ra);t[1]+=Math.abs(sw)*AL*.14*(1-.4*ra)+(GT?GT.elbow*.03:0);
    if(cr){t=V3.lerp(t,[-sd*.02,-AL*.62,AL*.5],cr);p=V3.lerp(p,[sd,-.2,-.3],cr);gb=V3.lerp(gb,[sd*.6,-.3,-.6],cr);}
    // standing between balls: every other fielder rests his hands on his hips (the wrist at the hip's side, below the shoulder,
    // elbows out and back, the back of the hand outward), the rest let them hang
    if(idl>0&&(id&1)){t=V3.lerp(t,[sd*(.17*tw+.03-.2*tw),-shy+.1,.03],idl);p=V3.lerp(p,[sd,-.2,-.6],idl);gb=V3.lerp(gb,[sd*.9,.1,-.4],idl);}
    if(dj){const d=dv===0?[sd*.02,-AL*.97,.06]:V3.sub(dv===1?[sd*(.17*tw+.03),hy+.06,-.02]:[sd*hw,P.an+L*.55,L*.2],S);t=V3.lerp(t,d,dj);if(dv)p=V3.lerp(p,[sd,-.2,-.6],dj);if(dv)gb=V3.lerp(gb,dv===1?[sd*.3,.3,-.9]:[sd*.3,-1,-.2],dj);}
    if(bww>0){const K=i?BKK.hr:BKK.hl,ri=K.findIndex(q=>q[1]==='rp');let kt;
      // the bowling hand's release key is the solved point; it passes through it between the keys either side at speed (linear)
      if(ri>=0&&bt>K[ri-1][0]&&bt<K[ri+1][0]){const rp=V3.sub(rpB,S),a=K[ri-1],b=K[ri+1];kt=bt<0?V3.lerp(V3.sc(a[1],AL),rp,(bt-a[0])/-a[0]):V3.lerp(rp,V3.sc(b[1],AL),bt/b[0]);}
      else{kt=kf(K,bt);kt=kt==='rp'?V3.sub(rpB,S):V3.sc(kt,AL);}
      t=V3.lerp(t,kt,bww);p=V3.lerp(p,kf(i?BKK.pr:BKK.pl,bt),bww);gb=V3.lerp(gb,kf(i?BKK.gr:BKK.gl,bt),bww);}
    if(H2){const g=HG[i],hi=smooth(clamp((o.hy-J.sh[1]+.2)/.5,0,1));
      t=V3.lerp(t,V3.sub(Wi(g),S),wh);t[0]+=sd*bulge;p=V3.lerp(p,V3.lerp([sd,-.3,-.3],[sd,.3,.1],hi),wh);gw=V3.sc(H2.pn[i],-1);wa=H2.fd[i];}
    // sliding, the far hand goes back to the ground for support
    if(sl5&&sd!==os){const a=Wi([x-s*.35+c*sd*.3,.07,z-c*.35-s*sd*.3]);t=V3.lerp(t,V3.sub(a,S),wh);p=[sd,-.3,-.3];gb=[sd*.3,-1,0];gw=null;wa=null;}
    if(act===7){const hb=V3.sub(Wi([o.hx,o.hy,o.hz]),S);
      if(i){t=hb;p=ty7===1?[1,-.5,-.3]:[1,.3,-.5];gb=ap<0?[.3,-.6,-.7]:[0,.6,-.8];}
      else{if(ty7!==1){const l=smooth(clamp((ap+.6)/.3,0,1))*(1-smooth(clamp((ap+.18)/.22,0,1)));t=V3.lerp(t,[-.45*AL,.3*AL,.68*AL],l);p=V3.lerp(p,[-1,-.3,.2],l);gb=V3.lerp(gb,[-.5,0,-.8],l);}
        // the gather: the free hand stays on the ball beside the throwing hand, then lets go
        if(gth>0){t=V3.lerp(t,[hb[0]-.12,hb[1],hb[2]],gth);p=V3.lerp(p,[-1,-.3,-.3],gth);gb=V3.lerp(gb,[-.8,.2,-.5],gth);}}}
    const shw=W(S),pl=Wd(p);let [e,wr]=reach(shw,W(V3.add(S,t)),P.ua,P.fa,pl,ik&&ik.e[i],dt);
    // a bowling or throwing arm swinging across the body keeps its elbow clear of the chest and head (armClear, as the batter's)
    if((bww>0||act===7)&&ik)e=armClear(J,shw,wr,e,ik.e[i],-sd,dt);
    const fa=V3.norm(V3.sub(wr,e)),ha=wa?V3.norm(V3.lerp(fa,wa,.6)):fa;
    let g=gw||Wd(gb);g=V3.sub(g,V3.sc(ha,V3.dot(g,ha)));
    J.sp[i]=shw;J.ap[i]=pl;J.e[i]=e;J.wr[i]=J.hd[i]=wr;J.wa[i]=ha;J.gn[i]=Math.hypot(g[0],g[1],g[2])>1e-4?V3.norm(g):U;}
  // nothing below the turf: a lying or diving body is lifted as a whole by what its lowest part (hip and shoulders on their side,
  // knees, elbows, hands, head, with the skinned body's width around each joint) would sink; standing, the hips rise and the
  // legs are re-solved so a deep squat's knees stay above the ground
  const lyb=smooth(clamp((Math.max(Math.abs(rl),pt)-.15)/.4,0,1)),lying=lyb>0||!!dvh,hm=J.hr+(o.kp?.06:.03),lowOf=()=>{let m=9;for(let i=0;i<2;i++)m=Math.min(m,J.kn[i][1]-.09,J.e[i][1]-.06,J.hd[i][1]-hm,J.sp[i][1]-.1);
    return Math.min(m,J.hc[1]-.12,J.hip[1]-lerp(.1,o.kp?.21:.17,lyb));};
  const low=lowOf();
  if(low<-.003){const d=-low+.003;
    if(lying||sl5){for(const q of [J.hip,J.sh,J.nt,J.hc,...J.hj,...J.kn,...J.an,...J.sole,...J.sp,...J.e,...J.hd])q[1]+=d;}
    else{for(const q of [J.hip,J.sh,J.nt,J.hc,...J.hj,...J.sp,...J.e,...J.hd])q[1]+=d;
      for(let i=0;i<2;i++){const ft=V3.add(J.sole[i],V3.sc(U,P.an)),[kn,an]=reach(J.hj[i],ft,P.th,P.sh,J.kp[i],ik&&ik.k[i],0);J.kn[i]=kn;J.an[i]=an;J.sole[i]=V3.sub(an,V3.sc(U,P.an));}}}
  return J;
}
const LKO=new Float64Array(6);
// the rigid 13-part fallback rig placed on a person's joints
function placeParts(r,J,id=0){
  const P=J.L,R=J.hx,U=J.up;
  for(let i=0;i<2;i++){mL(r.thigh[i],J.hj[i],J.kn[i],P.th,R);mL(r.shin[i],J.kn[i],J.an[i],P.sh,R);mB(r.foot[i],J.sole[i],R,U,J.fw[i]);
    mL(r.uarm[i],J.sp[i],J.e[i],P.ua,R);mL(r.farm[i],J.e[i],J.wr[i],P.fa,R);}
  mB(r.torso,J.hip,V3.sc(J.n,P.td),V3.sc(J.Y,P.tor/.54),V3.sc(R,P.tw));
  mB(r.head,J.hc,R,J.hv,J.face);
  placeEx(r,J,id);
}
// the species' extra part: Saturn's ring floating over the head (skinned too), or the fallback's cap. The ring keeps to world
// up, above the head centre whatever the head does (on the head's own axes it stood up like a hoop in a dive)
function placeEx(r,J,id){
  if(!r.ex.visible)return;const P=J.L,R=J.hx,Uh=J.hv,Fh=J.face;
  if(P.ring){const a=P.ring[1],ph=clock*.7+id,sa=Math.sin(a),n=[Math.cos(ph)*sa,Math.cos(a),Math.sin(ph)*sa],
      e1=V3.norm(V3.cross(n,[0,0,1])),e2=V3.cross(e1,n),ps=clock*1.6,X=V3.add(V3.sc(e1,Math.cos(ps)),V3.sc(e2,Math.sin(ps)));
    mB(r.ex,[J.hc[0],J.hc[1]+P.ring[0]+.012*Math.sin(clock*2.3+id),J.hc[2]],X,n,V3.cross(X,n));}
  else mB(r.ex,J.hc,R,Uh,Fh);
}
// a person drawn from his view state: skinned (fielder.glb) when loaded, else the fallback parts; kp: the keeper (his kit)
function person3D(r,x,z,face,o,id=0,dj=0,kp=false){const J=personJoints(x,z,face,o,id,dj,r.ik||(r.ik=mkPIk()));r.J=J;
  if(r.sk&&r.sk.visible){skinPerson(r,J,kp);placeEx(r,J,id);}else placeParts(r,J,id);return J;}
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
// per-rig IK state (bend directions with hysteresis, so knees and elbows never flip between frames); the batter and the
// non-striker each carry one (batsman3D). Without it the joints are solved plainly (the lab's read of the non-striker).
const mkIk=()=>({e:[MO.ikState(),MO.ikState()],k:[MO.ikState(),MO.ikState()],t:-1});
function batJoints(p,st){
  const J=BJ,hip=[p[qHX],p[qHY],p[qHZ]],ha=[-Math.sin(p[qHR]),0,Math.cos(p[qHR])];
  const Y=V3.norm([p[qLX],1,p[qLZ]]),s0=[-Math.sin(p[qSR]),0,Math.cos(p[qSR])],s=V3.norm(V3.sub(s0,V3.sc(Y,V3.dot(s0,Y)))),n=V3.cross(Y,s);
  Object.assign(J,{hip,ha,Y,s,n});J.L||(J.L={ua:.31,fa:.3,th:.43,sh:.43,cl:.17,sw:.19,sp:.22,nk:.17});   // limb lengths (rig.py HUMAN) for the skinned rig (07-skin.js)
  const dt=st&&st.t>=0?clamp(clock-st.t,0,.1):undefined;if(st)st.t=clock;
  const IK=(ks,a,t,l1,l2,pole)=>ks?MO.ikS(ks,[0,0,0],a,t,l1,l2,pole,dt,25):ik(a,t,l1,l2,pole);
  const kneel=clamp(p[qKN],0,1);
  const leg=(i,fx,fz,fr,ly,heel,side)=>{const t=[Math.cos(fr),0,Math.sin(fr)],an=[fx,.08+ly+heel*.05,fz],hj=V3.add(hip,V3.sc(ha,.1*side));hj[1]-=.04;
    const fw=V3.norm([t[0]*.24,-heel*.07,t[2]*.24]),kp=i&&kneel?V3.lerp(V3.add(t,V3.sc(ha,.25*side)),[0,-.6,1],kneel):V3.add(t,V3.sc(ha,.25*side));
    let kn=IK(st&&st.k[i],hj,an,.43,.43,kp);
    // kneeling (sweeps): the back knee rests on the ground with the shin flat behind it, the thigh closed to its reach
    if(i&&kneel){const ax=V3.sub(an,hj),D=Math.min(Math.hypot(ax[0],ax[1],ax[2])||1e-6,.8598),u=V3.norm(ax),x=D/2,h=Math.sqrt(Math.max(0,.43*.43-x*x)),c=V3.add(hj,V3.sc(u,x)),
        dn=V3.sub([0,-1,0],V3.sc(u,-u[1])),dl=Math.hypot(dn[0],dn[1],dn[2]);
      if(dl>1e-3&&h>1e-3){const u1=V3.sc(dn,1/dl),u2=V3.cross(u,u1),cs=clamp((.095-c[1])/(h*u1[1]),-1,1),sn=Math.sqrt(1-cs*cs)*(V3.dot(u2,kp)<0?-1:1);
        kn=V3.lerp(kn,V3.add(c,V3.add(V3.sc(u1,h*cs),V3.sc(u2,h*sn))),kneel);}}
    J.t[i]=t;J.an[i]=an;J.hj[i]=hj;J.kp[i]=kp;J.kn[i]=kn;J.fw[i]=fw;J.sole[i]=V3.sub([fx+t[0]*.16,ly,fz+t[2]*.16],V3.sc(fw,.16));};
  leg(0,p[qFX],p[qFZ],p[qFR],p[qFLY],0,1);leg(1,p[qBX],p[qBZ],p[qBR],p[qBLY],p[qHL],-1);
  const sh=V3.add(hip,V3.sc(Y,.5)),H=[hip[0]+p[qAX],hip[1]+p[qAY],hip[2]+p[qAZ]],d=V3.norm([p[qDX],p[qDY],p[qDZ]]),fn=faceN(d,p[qFC]),m=V3.norm(V3.cross(fn,d));
  const free=Math.hypot(p[qTX],p[qTY],p[qTZ])>.01;
  // the head (before the arms: they are kept clear of it): nod tips it toward where it looks (chin down), hd is the face's yaw
  const yw=p[qHDY],f=[Math.sin(yw),0,Math.cos(yw)],Yh=V3.norm([Y[0]*.4,Y[1]*.4+.6,Y[2]*.4]),fY=V3.norm(V3.sub(f,V3.sc(Yh,V3.dot(f,Yh)))),nd=clamp(p[qNOD],-1.2,1.6)*.5,
    hv=V3.norm(V3.add(V3.sc(Yh,Math.cos(nd)),V3.sc(fY,Math.sin(nd)))),hc=V3.add(V3.add(hip,V3.sc(Y,.54)),V3.sc(hv,.19));
  const fw=V3.norm(V3.sub(f,V3.sc(hv,V3.dot(f,hv))));
  Object.assign(J,{sh,H,d,fn,hv,hc,face:fw,hx:V3.cross(hv,fw),nt:V3.sub(hc,V3.sc(hv,.06)),t0:V3.lerp(hip,sh,.1)});
  for(let i=0;i<2;i++){const side=i?-1:1,sp=V3.add(sh,V3.sc(s,.19*side));let hd=V3.add(H,V3.sc(d,HAND_AT[i])),
      N=V3.sc(V3.add(V3.sc(fn,Math.cos(GF[i])),V3.sc(m,Math.sin(GF[i]))),-side),wa=V3.sub(V3.sc(d,Math.cos(GA)),V3.sc(V3.cross(N,d),Math.sin(GA))),
      ap=V3.add(V3.sub(V3.sub(hd,V3.sc(wa,.3)),sp),[s[0]*.03*side,i?-.2:-.03,s[2]*.03*side]); // the bottom elbow leans down (it points at the ground or the keeper, never flips up over the hands)
    // the top hand off the handle (the offset channels): a free arm, elbow out and back, the back of the hand outward
    if(!i&&free){hd=[hd[0]+p[qTX],hd[1]+p[qTY],hd[2]+p[qTZ]];const up=clamp((hd[1]-sp[1])/.35,0,1);
      ap=V3.add(V3.sc(V3.add(V3.add(V3.sc(n,-.8),V3.sc(s,.35)),V3.sc(Y,-.25)),1-up),V3.sc(V3.add(V3.sc(s,.9),V3.sc(n,-.3)),up));} // a raised fist: the elbow out to the side
    const e=armClear(J,sp,hd,IK(st&&st.e[i],sp,hd,.31,.3,ap),st&&st.e[i],side,dt,q=>armX(J,i,q,hd,free));
    if(!i&&free){wa=V3.norm(V3.sub(hd,e));const g=V3.add(V3.sc(s,.85),V3.sc(n,.3));N=V3.norm(V3.sub(g,V3.sc(wa,V3.dot(g,wa))));}
    J.sp[i]=sp;J.ap[i]=ap;J.hd[i]=hd;J.wa[i]=wa;J.gn[i]=N;J.e[i]=e;}
  // the bottom arm could not get its forearm clear of the top one (a straight bottom arm has little room): the top elbow moves
  if(!free&&armX(J,1,J.e[1],J.hd[1],free)>BC.m){J.e[0]=armClear(J,J.sp[0],J.hd[0],J.e[0],st&&st.e[0],1,dt,q=>armX(J,0,q,J.hd[0],free,true));}
  return J;}
/* body clearance for an arm: the torso capsule (J.t0..J.sh, r BC.tr) and the head (J.hc, r BC.hr) as tests/charlab measures them.
   The glove's pole (ap) can put the elbow inside the chest (the top hand at the backlift, the hands behind the body); then the
   elbow is swung about the shoulder-hand axis, where both bones keep their length, to the nearest angle that clears both by the
   margin m (the side it went last time first, so it never flips between equal sides), and the IK state follows so the next
   frame's bend starts there. A hand inside the torso cannot be cleared here (poseTick moves the hands). */
const BC={tr:.15,hr:.11,ua:.05,fa:.04,m:.01};
// the arms against the chest as it is (art-style section 2): an ellipse along the torso axis t0..sh, half width ES inside the
// shoulders, half depth EN, so an arm crossing in front of the pec is clear where the lab's round capsule (BC.tr) would not be,
// and an arm pulled into the side of the ribs is not. ellPen: the deepest penetration of segment a-b (radius r) over 7 samples,
// where along a-b (u) and the outward normal there; points beyond the shoulder end count the overshoot as clearance.
const ES=.145,EN=.12,EP={pen:0,u:0,n:[1,0,0]};
function ellPen(t0,sh,s,n,a,b,r){const ax=V3.sub(sh,t0),al=V3.dot(ax,ax),aL=Math.sqrt(al);let best=-9,bu=0,bn=null;
  for(let k=0;k<=6;k++){const u=k/6,p=V3.lerp(a,b,u),tt=V3.dot(V3.sub(p,t0),ax)/al,t=clamp(tt,0,1),q=V3.sub(p,V3.add(t0,V3.sc(ax,t))),ds=V3.dot(q,s),dn=V3.dot(q,n),dy=Math.max(0,tt-1,-tt)*aL;
    const rho=Math.hypot(ds/ES,dn/EN),rr=Math.hypot(ds,dn),d=r+(rho>1e-6?rr/rho:EN)*(1-rho)-dy;
    if(d>best){best=d;bu=u;bn=rho>1e-6?[ds/(ES*ES),dn/(EN*EN)]:[0,1];}}
  EP.pen=best;EP.u=bu;const g=V3.add(V3.sc(s,bn[0]),V3.sc(n,bn[1])),gl=Math.hypot(g[0],g[1],g[2]);EP.n=gl>1e-9?V3.sc(g,1/gl):n.slice();return EP;}
const torsoPen=(J,sp,e,hd)=>Math.max(ellPen(J.t0,J.sh,J.s,J.n,sp,e,BC.ua).pen,ellPen(J.t0,J.sh,J.s,J.n,e,hd,BC.fa).pen);
const headPen=(J,sp,e,hd)=>Math.max(BC.ua+BC.hr-MO.segDist(sp,e,J.hc,J.hc),BC.fa+BC.hr-MO.segDist(e,hd,J.hc,J.hc));
/* the batter's forearm (elbow to wrist, 7 cm short of the glove, as tests/charlab measures it) against the handle and, for the
   bottom arm, against the top arm's forearm: both forearms converge on the grip, so a pole that puts both elbows in one place
   crosses them */
function farmCaps(e,hd){const w=V3.add(hd,V3.sc(V3.norm(V3.sub(e,hd)),.07)),m=V3.lerp(e,w,.5);return [[e,m,.042],[m,w,.03]];}
function armX(J,i,e,hd,free,both){let p=-9;const c=farmCaps(e,hd),o=1-i;
  if(!(i===0&&free)){const h0=V3.add(J.H,V3.sc(J.d,HTOP)),h1=V3.add(J.H,V3.sc(J.d,.3));for(const [a,b,r] of c)p=Math.max(p,r+.017-MO.segDist(a,b,h0,h1));}
  if(!free&&(i===1||both))for(const [a,b,r] of farmCaps(J.e[o],J.hd[o]))for(const [a2,b2,r2] of c)p=Math.max(p,r+r2-MO.segDist(a,b,a2,b2));
  return p;}
function armClear(J,sp,hd,e,ks,side,dt,xp){
  const ax=V3.sub(hd,sp),L=Math.hypot(ax[0],ax[1],ax[2])||1e-6,u=V3.sc(ax,1/L),r=V3.sub(e,sp),c=V3.add(sp,V3.sc(u,V3.dot(r,u))),v1=V3.sub(e,c),h=Math.hypot(v1[0],v1[1],v1[2]);
  if(h<.01)return e;const ik=V3.sc(v1,1/h);
  const at=(v)=>V3.add(c,V3.sc(v,h)),turn=(v,th)=>{const w=V3.cross(u,v),cs=Math.cos(th),sn=Math.sin(th);return V3.norm([v[0]*cs+w[0]*sn,v[1]*cs+w[1]*sn,v[2]*cs+w[2]*sn]);},
    pen=v=>Math.max(torsoPen(J,sp,at(v),hd),headPen(J,sp,at(v),hd),xp?xp(at(v)):-9);
  // the start is where the elbow was drawn last frame (brought into this frame's circle plane), not the pole's wish: the pole
  // pulls back toward the body every frame, so starting from it would never let the elbow get clear
  let dir=ik;if(ks&&ks.cd){const p=V3.sub(ks.cd,V3.sc(u,V3.dot(ks.cd,u))),pl=Math.hypot(p[0],p[1],p[2]);if(pl>1e-3)dir=V3.sc(p,1/pl);}
  let tg=ik;const cost=v=>{const q=at(v);return Math.max(torsoPen(J,sp,q,hd),2*headPen(J,sp,q,hd),xp?xp(q):-9);};
  if(pen(ik)>BC.m){tg=dir;
    // one sweep from here for torso and head together (the head counts double: an elbow at the face shows on every camera),
    // toward the elbow out to the side first (lateral, a little up and forward: a batter's elbows point there, the top hand's at
    // the bowler, the bottom hand's back toward the keeper): the first clear angle, else the least penetration on the whole circle
    const f=V3.add(V3.add(V3.sc(J.s,.8*side),V3.sc(J.Y,.3)),V3.sc(J.n,.3)),fp=V3.sub(f,V3.sc(u,V3.dot(f,u))),fl=Math.hypot(fp[0],fp[1],fp[2]);
    const sg=fl>.05&&V3.dot(V3.cross(u,dir),fp)<0?-1:1;let bp=cost(dir);
    if(bp>BC.m)out:for(let th=.1;th<=3.15;th+=.1)for(const g of [sg,-sg]){const d2=turn(dir,g*th),q=cost(d2);if(q<bp-1e-4){bp=q;tg=d2;}if(q<=BC.m)break out;}}
  // the elbow turns at most 20 rad/s toward its target, so a clear angle far from the last one never flips the elbow across in one frame
  // and it goes round the way that passes clear of the head and chest (the short way can sweep across the face)
  if(ks&&ks.cd&&dt!==undefined){let ang=Math.acos(clamp(V3.dot(dir,tg),-1,1)),sg=V3.dot(V3.cross(u,dir),tg)<0?-1:1;
    if(ang>.3){const worst=(g,A)=>{let w=-9;for(let k=1;k<6;k++)w=Math.max(w,cost(turn(dir,g*A*k/6)));return w;};
      if(worst(-sg,2*Math.PI-ang)<worst(sg,ang)-.01){sg=-sg;ang=2*Math.PI-ang;}}
    tg=turn(dir,sg*Math.min(ang,20*dt));}
  if(ks){ks.cd=tg;ks.d[0]=tg[0];ks.d[1]=tg[1];ks.d[2]=tg[2];}
  (J.dbg||(J.dbg=[]))[side>0?0:1]=[pen(ik),pen(dir),pen(tg),h,!!(ks&&ks.cd),dt];
  return at(tg);}
// skin: the skinned model is shown, so only the bat is placed here
function batsman3D(B,p,skin){
  const J=batJoints(p,B.ikst||(B.ikst=mkIk())),U=[0,1,0];
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
// the bowler's hip z at the release (the ball leaves the hand .2 m ahead of it: makeDelivery/bowlDelivery zr 19.0 pace, 19.3 spin)
const BZR={pace:19.22,spin:19.52};
// the bowler's mark: start of his run-up
const BWP={pace:{mk:31,ta:.35,tb:.25,v1:4.5,tf:1},spin:{mk:25.5,ta:.4,tb:.3,v1:2.5,tf:.7}};
const bowlMark=()=>BWP[M.bowlerType].mk;
/* the bowler's persistent state (BW: never a jump): the run-up at a steady pace from the mark to the release, a decelerating
   follow-through (v0 into a stop over .75 s pace / .55 s spin) across to the off side, a turn to watch the ball, then (still in
   the result phase) a jog back to his mark along the pitch's edge, facing the way he goes, turning at the mark. bt = s from the
   release (null once he stands at his mark), v his speed, f his facing: V.bt/bv/bh, recorded with bz; his x is a function of bt
   and bz (bowlX), so replays draw him where he was without another slot. */
const BW={x:.5,z:31,f:Math.PI,t:-1,v:0,ff:MO.springState(Math.PI),rel:-9};
// the follow-through's geometry for the current bowler: v0 approach speed, a deceleration, zs where it ends
// the run-up: from a standing start (accelerating over ta), steady at vm, slowing into the delivery stride (over tb) to v1 at the
// release, then the follow-through slowing from v1 to a stop over tf; vm from the distance and the run-up's time
const bowlGeo=()=>{const pace=M.bowlerType==='pace',T=S.runupDur,B=BWP[M.bowlerType],mk=B.mk,zr=BZR[M.bowlerType],D=mk-zr-.25,
  vm=(D-B.v1*B.tb/2)/Math.max(.3,T-B.ta/2-B.tb/2);return {pace,T,mk,zr,D,vm,ta:B.ta,tb:B.tb,v1:B.v1,tf:B.tf,v0:vm,a:B.v1/B.tf,zs:zr+.25-B.v1*B.tf/2};};
// distance still to run to the release line and the speed, u s before the release
function bowlRun(g,u){const {T,D,vm,ta,tb,v1}=g;if(u<=tb)return [v1*u+(vm-v1)*u*u/(2*tb),v1+(vm-v1)*u/tb];
  if(u<=T-ta)return [v1*tb+(vm-v1)*tb/2+vm*(u-tb),vm];const t=Math.max(0,T-u);return [D-vm*t*t/(2*ta),vm*t/ta];}
// his x: the release side's, drifting to the off side through the follow-through and back as he walks to his mark (by his z)
const bowlX=(bx,bt,bz)=>{if(bt==null||!M)return bx;const g=bowlGeo();return bx+bdrift(bt,g.pace,bx)*clamp((bz-g.mk)/(g.zs-g.mk),0,1);};
function bowlerState(){
  const g=bowlGeo(),{pace,T,mk,zr,v0,a,zs}=g,ph=S.phase,dt=clamp(clock-BW.t,0,.1);BW.t=clock;
  const bb=S.ball||S.pending,bx=(bb?bb.xr:pace?.3:.22)+.2*(SPX?SPX.tw:1),slot=S.fpos&&S.fpos.find(p=>p.bw);
  let z=BW.z,bt=null,v=0,f=BW.f;
  let xx=null;
  if(ph==='runup'){bt=S.t-T;const r=bowlRun(g,Math.max(0,T-S.t));z=zr+.25+r[0];v=r[1];f=Math.PI;BW.ff.x=f;BW.ff.v=0;BW.rel=clock-S.t+T;xx=bx;}
  else if(slot&&slot.act){z=slot.z;xx=slot.x;f=slot.face;BW.ff.x=f;BW.ff.v=0;v=slot.mv||0;bt=BW.rel>-9?clock-BW.rel:null;}   // his slot's play drives him (c&b, a throw)
  else if((ph==='flight'||ph==='result')&&S.ball){bt=clock-S.ball.start;const ts=v0/a;
    if(bt<=g.tf+.45){const tb=Math.min(bt,g.tf);z=zr+.25-(g.v1*tb-.5*a*tb*tb);v=Math.max(0,g.v1-a*bt);
      // through the follow-through he faces down the pitch, then turns to the ball (or the batter)
      const tg=S.hit?hitPos(S.hit,Math.max(0,clock-S.f0)):null,x=bowlX(bx,bt,z),want=bt<.4?Math.PI:tg?Math.atan2(tg.x-x,tg.z-z):Math.atan2(-x,BATS_Z-z);
      f=MO.springA(BW.ff,want,dt,5);xx=x;}
    else{const r=back(ph==='result'?S.resultDur-S.t+BALL_GAP:9);z=r.z;xx=r.x;v=r.v;f=r.f;}}
  else if(BW.rel>-9&&Math.hypot(BW.z-mk,BW.x-bx)>.03){bt=clock-BW.rel;const r=back(ph==='ready'?BALL_GAP-S.t:ph==='break'?S.breakDur-S.t+BALL_GAP:9);z=r.z;xx=r.x;v=r.v;f=r.f;}
  else{z=mk;xx=bx;f=MO.springA(BW.ff,Math.PI,dt,4);BW.rel=-9;}
  // the jog back to the mark (the next ball's side): 3.2 m/s, or what the time left needs (up to 7), facing the way he goes
  function back(left){const x0=BW.x,d=Math.hypot(bx-x0,mk-BW.z);
    if(d<.03)return {z:mk,x:bx,v:0,f:MO.springA(BW.ff,Math.PI,dt,4)};
    const want=Math.atan2(bx-x0,mk-BW.z),f=d>.8?MO.springA(BW.ff,want,dt,6):MO.springA(BW.ff,Math.PI,dt,4),
      // he runs only as fast as he faces the way he goes (turning first, never sprinting backwards) and slows into his mark
      al=Math.cos(MO.wrap(f-want)),sp=Math.min(7.5,Math.max(3.2,d/Math.max(.4,left-.3)),Math.sqrt(12*d))*clamp(.25+.75*al,.25,1),
      s=Math.min(d,sp*dt),zz=BW.z+(mk-BW.z)/d*s;
    return {z:zz,x:x0+(bx-x0)/d*s,v:Math.min(sp,d/.1),f};}
  BW.z=z;BW.f=f;BW.v=v;BW.x=xx==null?BW.x:xx;S.bowlerZ=z;return {z,bt,v,f};
}
/* --- view state: everything render3D/draw take from the game. Live frames are built here; a replay feeds recorded
   frames instead (08b-replay). New per-frame render state goes here AND into the recorded frame layout. --- */
const NFL=12,SHADOW_D=28,wideCam=()=>!!S.cel||S.phase==='replay'||MENU.on;
// the home batting camera: the keeper is hidden there (standing up he would block the batter; standing back he is behind it)
function batView(){return !!M&&!M.bowl&&!S.cel&&S.phase!=='replay'&&!(S.chase&&clock>=S.chase.t0)&&!(S.cord&&clock>=S.cord.t0)&&!MENU.on;}
const mkView=()=>({pose:null,ball:null,bk:false,bo:{x:0,y:0,z:0},st:null,so:{a:0,bails:false},st2:null,so2:{a:0,bails:true},mk:null,bz:0,bx:0,bt:null,bv:0,bh:Math.PI,ns:{on:false,x:0,u:0,ph:0,mv:0,pose:new Float32Array(PN)},
  nf:0,f:Array.from({length:NFL},()=>({on:false,x:0,z:0,face:0,run:0,running:false,crouch:0,act:0,ap:0,hx:0,hy:0,hz:0,e:0,sd:1,kp:false,bwl:false,hold:false,vx:0,vz:0})),hideBat:false,trail:null,cheer:0,dej:0});
const LV=mkView(),CH={on:false,t0:-9},BO={};
function liveView(){
  const V=LV,ph=S.phase;
  V.pose=poseTick();V.ball=ballNow();
  V.st=S.stumps&&clock>=S.stumps.t0?(V.so.a=clock-S.stumps.t0,V.so.bails=!!S.stumps.bails,V.so):null;V.st2=null;V.bk=false;
  V.mk=!settings.assist||M&&M.bowl?null:ph==='runup'&&S.t/S.runupDur>0.4?S.pending:ph==='flight'&&clock-S.ball.start<S.ball.t1?S.ball:null;
  V.nf=0;
  if(M){
    const bs=bowlerState(),bb=S.ball||S.pending;V.bz=bs.z;V.bt=bs.bt;V.bv=bs.v;V.bh=bs.f;V.bx=(bb?bb.xr:M.bowlerType==='pace'?.3:.22)+.2*(SPX?SPX.tw:1);
    // fielders from fieldTick; the bowler's slot only carries a caught-and-bowled attempt (he is drawn from bowlerState)
    S.fpos.forEach(p=>{if(V.nf>=NFL)return;const o=V.f[V.nf++];
      Object.assign(o,{on:!p.bw,kp:p.kp,bwl:p.bw,x:p.x,z:p.z,face:p.face,running:p.mv>.8,run:p.run,crouch:!p.kp&&(ph==='flight'||ph==='runup')?1:0,
        act:p.act,ap:p.ap,hx:p.hx,hy:p.hy,hz:p.hz,e:p.e,sd:p.sd,hold:p.hold,vx:p.vx||0,vz:p.vz||0});
      // a caught or gathered ball stays in the hands (bk: the keeper's, hidden with him in the batting view by render3D)
      if(p.hold&&p.ap>0){V.ball=(V.bo.x=p.hx,V.bo.y=p.hy-.05,V.bo.z=p.hz,V.bo);V.bk=p.kp;}});
    thrView(V);
  }
  nsTick(V.ns,V.bx);
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
  const z=[-d[0],d[1],d[2]],x=V3.norm([z[2],0,-z[0]]),y=V3.cross(z,x),far=S.cel||MENU.on?Math.hypot(cam.x,cam.z)+BOUNDARY+12:wideCam()||M&&M.bowl?60:46;
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
  const kh=batView();let cb=null;
  // cues for the people (personJoints): the release this frame (split-step), where they look (the ball in play, else the batter)
  const pc=!!M&&M.bowlerType==='pace';
  if(V.bt!=null&&V.bt>=0&&(PS.pbt==null||PS.pbt<0))PS.split=clock;PS.pbt=V.bt;
  PS.ball=!!bp&&(V.bt==null||V.bt>=0);if(PS.ball){PS.look[0]=bp.x;PS.look[1]=bp.y+.05;PS.look[2]=bp.z;}else{PS.look[0]=pz?pz[qHX]:0;PS.look[1]=1.4;PS.look[2]=BATS_Z+(pz?pz[qHZ]:0);}
  for(let i=0;i<NFL;i++){const p=V.f[i],r=G.fielders[i],on=!!M&&i<V.nf&&p.on&&!(p.kp&&kh),near=!r.sk||!r.sk.visible||Math.hypot(p.x-cam.x,p.z-cam.z)<SHADOW_D;r.g.visible=on;G.fsh[i].visible=on&&(!near||!inShadow(p.x,p.z));
    if(r.sk)r.sk.castShadow=r.wk.castShadow=near;
    if(i<V.nf&&p.bwl&&p.act)cb=p;
    if(on){mT(G.fsh[i],[p.x,0,p.z],.5,1,.5);person3D(r,p.x,p.z,p.face,p,i,V.dej,p.kp);}}
  G.bowler.g.visible=!!M;let JB=null;
  if(M){const tw=SPX?SPX.tw:1,bx=S.phase==='replay'?bowlX(V.bx,V.bt,V.bz):BW.x;
    // the bowler from his state (bt/bv/bh); a caught-and-bowled attempt (his field slot's play) takes over, the bowling pose fading
    Object.assign(BO,{act:0,ap:0,hx:0,hy:0,hz:0,e:0,sd:1,hold:false,kp:false,bwl:true,crouch:0,bt:V.bt,pc,bx:V.bx,rp:BO.rp||[0,0,0],vx:V.bv*Math.sin(V.bh),vz:V.bv*Math.cos(V.bh)});
    BO.rp[0]=V.bx-.2*tw;BO.rp[1]=pc?2.15:1.95;BO.rp[2]=pc?19.0:19.3;
    if(cb)Object.assign(BO,{act:cb.act,ap:cb.ap,hx:cb.hx,hy:cb.hy,hz:cb.hz,e:cb.e,sd:cb.sd,hold:cb.hold,vx:cb.vx,vz:cb.vz});
    JB=cb?person3D(G.bowler,cb.x,cb.z,cb.face,BO,1,V.dej):person3D(G.bowler,bx,V.bz,V.bh,BO,1,V.dej);}
  // the ball: in the bowler's hand through his run-up (V.bt < 0), else where the view puts it
  const inHand=!bp&&JB&&V.bt!=null&&V.bt<0,hb=inHand?V3.add(JB.hd[1],V3.sc(JB.wa[1],.06)):null;
  G.ball.visible=(!!bp&&!(V.bk&&kh))||inHand;
  if(bp)mT(G.ball,[bp.x,bp.y+0.05,bp.z],.05,.05,.05);else if(hb)mT(G.ball,hb,.05,.05,.05);
  G.mk.visible=G.mkr.visible=!!mk;
  if(mk){mT(G.mk,[mk.xb,0,mk.zb],0.24,1,0.24);mT(G.mkr,[mk.xb,0,mk.zb],0.26,1,0.26);}
  stumps3D(G.stumps[0],0,V.st);stumps3D(G.stumps[1],20.12,V.st2);
  const n=V.ns;G.ns.g.visible=!!M&&n.on;
  if(G.ns.g.visible){mB(G.ns.g,[n.x,0,NS_Z-n.u],[-1,0,0],[0,1,0],[0,0,-1]);const J=batsman3D(G.ns,n.pose,SKN.on);if(SKN.on)skin3D(J,SKN.b2);}
  G.bat.g.visible=!V.hideBat;if(!V.hideBat){const J=batsman3D(G.bat,pz,SKN.on);if(SKN.on)skin3D(J);}
  T3.r.render(T3.scene,T3.cam);
}
if(location.hash==='#test')window.__r={bj:()=>BJ,hc:()=>HC,info:()=>({calls:T3.r.info.render.calls,tris:T3.r.info.render.triangles}),tier:()=>Q.t,setTier:n=>{Q.t=n;Q.lock=true;qApply();},
  // a fielder's rig's part matrices (-1: the bowler): thighs, shins, feet, upper arms, forearms (left, right), torso, head, extra
  parts:i=>{const r=i<0?G3.bowler:G3.fielders[i];return {vis:r.g.visible,ex:r.ex.visible,m:['thigh','shin','foot','uarm','farm'].flatMap(k=>[0,1].map(j=>Array.from(r[k][j].matrix.elements))).concat(['torso','head','ex'].map(k=>Array.from(r[k].matrix.elements)))};},
  // a fielder's rig as drawn (-1: the bowler): torso up axis (1 upright, 0 lying), hip height, the hands (the wrists), visible, skinned
  body:i=>{const r=i<0?G3.bowler:G3.fielders[i],J=r.J;if(!J)return {up:1,hipY:0,hands:[[0,0,0],[0,0,0]],vis:r.g.visible,skin:!!(r.sk&&r.sk.visible)};
    return {up:J.Y[1],hipY:J.hip[1],hands:[J.hd[0].slice(),J.hd[1].slice()],vis:r.g.visible,skin:!!(r.sk&&r.sk.visible)};}};

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
  if(S.phase==='replay'){rpGlow(bp);rpLbw();}
  if(!S.cel&&S.phase!=='replay'){drawBowl();drawAim();drawRadar(bp);drawTimingBar();drawInfo();}
}
