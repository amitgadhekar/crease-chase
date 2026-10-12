/* ---------- stadium, 3D crowd and glow effects, rebuilt per planet by arenaBuild (07-render3d build3D).
   Stands, sightscreens, floodlight towers and the rope share one vertex-coloured mesh; the boards and the tier fascia share
   the LED ads texture. Azimuth a is measured from +z toward +x. Decorative randomness uses prng, never Math.random
   (that is the game's RNG). ---------- */
const TCOL=new THREE.Color(),GREY=new THREE.Color(),lc=(c,k=1)=>{TCOL.set(c);return [TCOL.r*k,TCOL.g*k,TCOL.b*k];},mixc=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const raw=()=>({P:[],N:[],T:[],I:[],C:[]});
// revolve the profile edge p->q ([r,y]) between azimuths a0..a1: flat across the edge, smooth around. Normal = (-dy,dr):
// edges walked up or outward face the field. u = arc length * ur (or 0..1), v from v0 at p to v1 at q.
function rev(o,p,q,a0,a1,seg,col,ur,v0=0,v1=1){
  const dr=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dr,dy)||1,nr=-dy/l,ny=dr/l,b=o.P.length/3;
  for(let i=0;i<=seg;i++){const a=a0+(a1-a0)*i/seg,s=Math.sin(a),c=Math.cos(a);
    for(const [r,y,v] of [[p[0],p[1],v0],[q[0],q[1],v1]]){o.P.push(r*s,y,r*c);o.N.push(nr*s,ny,nr*c);o.T.push(ur?a*r*ur:i/seg,v);if(col)o.C.push(col[0],col[1],col[2]);}}
  for(let i=0;i<seg;i++){const k=b+i*2;o.I.push(k,k+1,k+2,k+1,k+3,k+2);}
}
// box from centre c, unit axes X Y Z and half sizes
function box(o,c,X,Y,Z,hx,hy,hz,col){
  for(const [A,B,C,ha,hb,hc] of [[X,Y,Z,hx,hy,hz],[Y,Z,X,hy,hz,hx],[Z,X,Y,hz,hx,hy]])for(const s of [-1,1]){const b=o.P.length/3;
    for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]){for(let j=0;j<3;j++)o.P.push(c[j]+A[j]*ha*s+B[j]*hb*u+C[j]*hc*v);o.N.push(A[0]*s,A[1]*s,A[2]*s);o.T.push(u*.5+.5,.5-v*.5);o.C.push(...col);}
    o.I.push(b,b+1,b+2,b,b+2,b+3);}
}
const SCREEN=R=>({w:clamp(R*.15,8,11),r:R+4.2});
// stands profile: front wall, lower tier, fascia (ads), upper tier (tall stands only), back wall, roof canopy over the back rows.
// The back edge stays at (BOUNDARY+7+1.15*standsH, standsH): fireworks launch from it and renderSky clips the sky there.
function arenaGeo(v,R){
  const h=v.standsH,r0=R+7,rt=r0+1.15*h,two=h>=10.5,o=raw(),st=raw(),rows=[],seg=200,A=2*Math.PI,E=(p,q,c)=>rev(o,p,q,0,A,seg,c);
  const conc=mixc(lc(v.stands),lc('#9aa0a6'),.35),dark=lc(v.stands,.55),seat=[mixc(lc(v.stands,1.6),lc(v.boards[2]),.3),mixc(lc(v.stands,1.4),lc(v.roof),.25)];
  let p=[r0,0],q,r1=r0,fas=null;E(p,q=[r0,1.15],dark);p=q;
  const tier=(rb,yb,n,t)=>{const dr=(rb-p[0])/n,dy=(yb-p[1])/n;
    for(let i=0;i<n;i++){E(p,q=[p[0],p[1]+dy],V3.sc(conc,.85));p=q;E(p,q=[p[0]+dr,p[1]],V3.sc(conc,.7));rows.push({r:p[0]+dr*.45,y:p[1],t,d:dr,k:i/n});rev(st,[q[0]-.1,q[1]],[q[0]-.1,q[1]+.45],0,A,seg,seat[t],1/11.2,1,0);p=q;}};
  const rowsTo=(rb)=>Math.max(2,Math.round((rb-p[0])/.9));
  // two tiers: the upper one is cantilevered 2.5 m over the back of the lower one (soffit), its front face is the LED fascia
  let ro=r0;if(two){r1=r0+.55*(rt-r0);ro=r1-2.5;tier(r1,1.15+.33*(h-1.15),rowsTo(r1),0);const y1=p[1];E(p,q=[r1,y1+1.9],dark);E(q,[ro,y1+1.9],lc(v.stands,.35));fas=[ro,y1+1.9];p=[ro,y1+3];}
  tier(rt-.5,h-1.25,rowsTo(rt-.5),two?1:0);
  E(p,q=[p[0],h+.1],dark);p=q;E(p,[rt,h+.1],dark);
  const rf=rt-.62*(rt-r1),roof=lc(v.roof),under=lc(v.stands,.4);
  E([rf,h+.18],[rt+.4,h+.55],roof);E([rt+.4,h+.12],[rf,h-.22],under);E([rf,h-.22],[rf,h+.18],mixc(roof,dark,.5));
  for(const w of rows)w.sh=w.r>rf-.4?.5:w.t===0&&two&&w.r>ro-.3?.6:w.t===0?1-.2*w.k:1;
  for(let i=0;i<st.C.length;i+=3){const r=Math.hypot(st.P[i],st.P[i+2]);const k=r>rf-.4&&st.P[i+1]>(fas?fas[1]:0)?.5:fas&&r>ro-.3&&st.P[i+1]<fas[1]?.6:1;st.C[i]*=k;st.C[i+1]*=k;st.C[i+2]*=k;}
  // tube rope cushion just inside the boundary
  const rp=lc(v.rope),n=8,b0=o.P.length/3;
  for(let i=0;i<=256;i++){const a=i/256*A,s=Math.sin(a),c=Math.cos(a);
    for(let j=0;j<=n;j++){const t=j/n*A,ct=Math.cos(t),st=Math.sin(t),r=R+.1*ct;o.P.push(r*s,.085+.075*st,r*c);o.N.push(ct*s,st,ct*c);o.T.push(0,0);o.C.push(...rp);}}
  for(let i=0;i<256;i++)for(let j=0;j<n;j++){const k=b0+i*(n+1)+j,k2=k+n+1;o.I.push(k,k2,k+1,k2,k2+1,k+1);}
  // sightscreens just beyond the boundary at both ends: off-white panels with seams, raised on a dark steel frame with
  // posts and back braces, and a darkened patch of ground under them
  const sc=SCREEN(R),hs=clamp(h*.4,3.5,5.5),pc=lc('#cfcfc6'),fr=lc('#2c3036'),X=[1,0,0],Y=[0,1,0],y0=.45;
  for(const z of [1,-1]){const Z=[0,0,z],at=(x,y,d)=>[x,y,(sc.r+d)*z];
    box(o,at(0,.006,.6),X,Y,Z,sc.w/2+.6,.006,1.6,lc(v.ground[1],.35));
    box(o,at(0,y0+hs/2,0),X,Y,Z,sc.w/2,hs/2,.06,pc);box(o,at(0,y0+hs+.1,.02),X,Y,Z,sc.w/2+.15,.1,.1,fr);box(o,at(0,y0-.08,.02),X,Y,Z,sc.w/2+.15,.08,.1,fr);
    const np=Math.round(sc.w/2.4);for(let i=0;i<=np;i++){const x=-sc.w/2+i*sc.w/np;box(o,at(x,(y0+hs+.2)/2,.04),X,Y,Z,i%np?.025:.1,(y0+hs+.2)/2,.08,i%np?lc('#9a9a92'):fr);
      if(i%2===0){box(o,at(x,(y0+hs)/2,1.1),X,Y,Z,.06,(y0+hs)/2,.06,fr);box(o,at(x,.1,.55),X,Y,Z,.06,.06,.6,fr);}}}
  // floodlight towers outside the stands, heads tilted toward the centre; panels and halos are returned for their own meshes
  const tw=lc('#5a6068'),pn=raw(),halo=[],ht=h*1.6+16,rT=rt+6;
  for(const az of [35,-35,145,-145]){const a=az*D2R,s=Math.sin(a),c=Math.cos(a),X=[c,0,-s],f=[-s*Math.cos(.32),-Math.sin(.32),-c*Math.cos(.32)],Y=V3.cross(f,X),hc=[rT*s,ht+2,rT*c];
    box(o,[rT*s,ht/2,rT*c],X,[0,1,0],[s,0,c],.45,ht/2,.45,tw);box(o,hc,X,Y,f,4.2,2.5,.35,lc('#2a2e33'));
    const pc=V3.add(hc,V3.sc(f,.37)),b=pn.P.length/3;
    for(const [u,w] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const P=V3.add(pc,V3.add(V3.sc(X,3.9*u),V3.sc(Y,2.2*w)));pn.P.push(...P);pn.N.push(...f);pn.T.push(u*.5+.5,.5-w*.5);}
    pn.I.push(b,b+1,b+2,b,b+2,b+3);halo.push(V3.add(pc,V3.sc(f,1.2)));}
  // LED boards between the rope and the stands (gaps in front of the sightscreens) and the fascia between tiers
  const ad=raw(),rb=R+3,g=(sc.w/2+1.2)/rb,bt=[rb,0],tp=[rb+.22,.95];
  for(const [a0,a1] of [[g,Math.PI-g],[Math.PI+g,A-g]])rev(ad,bt,tp,a0,a1,90,null,1/7.8,1,0);
  if(fas)rev(ad,[fas[0]-.02,fas[1]],[fas[0]-.02,fas[1]+1.1],0,A,seg,null,Math.round(A*fas[0]/8.8)/(A*fas[0]),1,0);
  return {o,st,rows,pn,ad,halo,screen:{...sc,h:hs}};
}

/* --- crowd: one low-poly spectator (body + head) instanced per 30° sector of the stands, so three culls the sectors out of
   view. Shirt colour per instance (instanceColor), skin colour per instance (aSkin) on the head vertices (aHead). Idle bob and
   cheering jumps run in the vertex shader. Seats are filled most-wanted first (the end behind the bowler is in every
   batting shot), so lowering the count keeps the full-looking end. --- */
const CRWD={u:{uTime:{value:0},uCheer:{value:0},uCam:{value:new THREE.Vector2()},uHaze:{value:new THREE.Color()}},max:0,sec:[]},NSEC=12;
const crowdBase=()=>matchMedia('(pointer:coarse)').matches||Math.min(screen.width,screen.height)<600?9000:15000;
function crowdShader(m){
  m.onBeforeCompile=s=>{Object.assign(s.uniforms,CRWD.u);
    s.vertexShader='uniform float uTime,uCheer;uniform vec2 uCam;uniform vec3 uHaze;attribute float aHead;attribute vec3 aSkin;\n'+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 ip=instanceMatrix[3].xyz;float ph=fract(sin(dot(ip.xz,vec2(12.9898,78.233)))*43758.5453);
      float near=clamp(1.5-length(ip.xz-uCam)/70.,.3,1.),k=uCheer*step(.3,ph)*near;
      transformed.y+=.012*sin(uTime*(1.3+ph)+ph*40.)+k*(.18+.22*ph)*max(0.,sin(uTime*(8.+4.*ph)+ph*30.));
      transformed.x+=k*.06*sin(uTime*(5.+2.*ph)+ph*9.)*transformed.y;`).replace('#include <color_vertex>','#include <color_vertex>\nvColor.rgb=mix(mix(vColor.rgb,aSkin,aHead),uHaze,clamp((length(instanceMatrix[3].xz-uCam)-35.)/260.,0.,.45));');};
  m.customProgramCacheKey=()=>'crowd';return m;}
function crowdMeshes(){
  const N=CRWD.max=crowdBase(),cap=Math.ceil(N*.16),mat=crowdShader(new THREE.MeshStandardMaterial({roughness:.85,side:THREE.DoubleSide}));
  const b=GB.surf([0,.8,1],5,(v,a)=>{const w=v<1?.15+.05*v/.8:.11;return [w*Math.cos(a),.38+(v<1?.5*v/.8:.6),w*.6*Math.sin(a)];}),h=ellG([0,1.1,.02],[.085,.11,.095],6,2);
  const g=geo(GB.join(b,h)),nb=b.P.length/3;g.setAttribute('aHead',new THREE.Float32BufferAttribute(Array.from({length:nb+h.P.length/3},(_,i)=>i<nb?0:1),1));
  for(let i=0;i<NSEC;i++){const m=new THREE.InstancedMesh(g,mat,cap);m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(cap*3),3);
    m.geometry=g.clone();m.geometry.setAttribute('aSkin',new THREE.InstancedBufferAttribute(new Float32Array(cap*3),3));m.n=0;m.count=0;T3.world.add(m);CRWD.sec.push(m);}
}
function crowdBuild(rows,v,R,scr){
  const rng=prng(7),seats=[],hw=(scr.w/2+1.5)/scr.r,A=2*Math.PI;
  for(const w of rows){const st=.56/w.r;
    for(let a=rng()*st;a<A;a+=st){const ae=Math.atan2(Math.sin(a),Math.cos(a)),far=Math.abs(ae)<.7;
      if(w.y<scr.h+1&&(Math.abs(ae)<hw||Math.PI-Math.abs(ae)<hw))continue;
      seats.push({a,w,k:Math.pow(rng(),1/(far?1:.45))});}}
  seats.sort((x,y)=>y.k-x.k);
  const n=Math.min(CRWD.max,Math.round(seats.length*.92)),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),Y=new THREE.Vector3(0,1,0),P=new THREE.Vector3(),Sc=new THREE.Vector3();
  const pal=[...v.crowd,'#ffffff','#e8e4da','#1f2a44','#3a3f47','#6b7078','#8a5a3c','#2e4a6b','#2a2a2a','#5a6b4a'],team=[KIT.you.shirt,(v.kit||{}).shirt||'#7a1f2b'],skin=['#f1c27d','#e0ac69','#c68642','#8d5524','#ffdbac','#5c3a21'];
  for(const m of CRWD.sec)m.n=0;
  for(let i=0;i<n;i++){const s=seats[i],m=CRWD.sec[Math.floor(s.a/A*NSEC)%NSEC],j=m.n;if(j>=m.instanceMatrix.count)continue;m.n++;
    const w=s.w,r=w.r+(rng()-.5)*.12*w.d,k=.82+rng()*.14,blk=Math.floor(s.a/A*48),cl=(blk*7919%5)<2&&rng()<.65,sh=w.sh*(.8+rng()*.35);
    P.set(r*Math.sin(s.a),w.y,r*Math.cos(s.a));q.setFromAxisAngle(Y,s.a+Math.PI+(rng()-.5)*.4);Sc.set(k,k*(.92+rng()*.16),k);m.setMatrixAt(j,m4.compose(P,q,Sc));
    TCOL.set(cl?team[blk&1]:pal[rng()*pal.length|0]);const l=TCOL.r*.3+TCOL.g*.59+TCOL.b*.11;m.setColorAt(j,TCOL.lerp(GREY.setRGB(l,l,l),cl?.2:.5).multiplyScalar(sh*(cl?.8:.62)));
    TCOL.set(rng()<.1?pal[rng()*pal.length|0]:skin[rng()*skin.length|0]).multiplyScalar(sh);m.geometry.attributes.aSkin.setXYZ(j,TCOL.r,TCOL.g,TCOL.b);}
  for(const m of CRWD.sec){m.count=m.n;m.instanceMatrix.needsUpdate=m.instanceColor.needsUpdate=m.geometry.attributes.aSkin.needsUpdate=true;m.computeBoundingSphere();}
}
// tier: keep the first (most wanted) fraction of each sector
function crowdCount(f){for(const m of CRWD.sec)m.count=Math.round(m.n*f);}
function crowdTick(V){const u=CRWD.u;u.uTime.value=clock;u.uCheer.value=V.cheer;u.uCam.value.set(cam.x,cam.z);}

/* --- glow: additive point sprites (fireworks, floodlight halos). Colour adds, alpha is kept, so over the transparent sky
   the premultiplied canvas composites them as light. --- */
const addBlend=m=>Object.assign(m,{transparent:true,depthWrite:false,fog:false,toneMapped:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,
  blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor});
function glowPoints(n,size,tex){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*4),4).setUsage(THREE.DynamicDrawUsage));g.setDrawRange(0,0);
  const p=new THREE.Points(g,addBlend(new THREE.PointsMaterial({size,map:tex,vertexColors:true,sizeAttenuation:true})));p.frustumCulled=false;T3.world.add(p);return p;}
const FWC={},FWR=prng(11),fwCol=c=>FWC[c]||(FWC[c]=lc(c));
function fw3D(pts){
  const g=pts.geometry,P=g.attributes.position.array,C=g.attributes.color.array,cap=P.length/3;let n=0;
  const put=(x,y,z,c,a)=>{if(n>=cap)return;P[n*3]=x;P[n*3+1]=y;P[n*3+2]=z;C[n*4]=c[0];C[n*4+1]=c[1];C[n*4+2]=c[2];C[n*4+3]=a;n++;};
  if(S.cel){const hot=fwCol('#fff3d6');
    for(const q of FW.r){const u=(clock-q.t0)/q.T,e=1-(1-u)*(1-u);
      for(let k=0;k<4;k++){const f=Math.max(0,e-k*.04);put(lerp(q.x0,q.x1,f),lerp(q.y0,q.y1,f),lerp(q.z0,q.z1,f),hot,k?.4/k:.8);}}
    for(const p of FW.p){const f=1-p.age/p.life,a=f<.3&&FWR()<.4?f:Math.min(1,f*1.6),c=fwCol(p.c);
      put(p.x,p.y,p.z,c,a*.6);put(p.x-p.vx*.05,p.y-p.vy*.05,p.z-p.vz*.05,c,a*.3);put(p.x-p.vx*.11,p.y-p.vy*.11,p.z-p.vz*.11,c,a*.12);}}
  if(n||g.drawRange.count){g.setDrawRange(0,n);g.attributes.position.needsUpdate=g.attributes.color.needsUpdate=true;}
}
