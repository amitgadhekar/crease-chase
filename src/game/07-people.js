/* ---------- fielding sides: ONE athletic human body (tools/blender/fielder.py -> src/models/fielder.glb, rig.py lengths) in
   real cricket kit for every planet; a species is a head, a skin colour/pattern and one signature feature (docs/art-style.md
   section 5). Per-planet gait physics (stride, lift, cadence, low-gravity float, delivery bound) stay. Heads are authored in
   the head frame (origin at the head centre, x = his right, y up, z forward) so they fit the shared neck socket; Saturn's ring
   is a separate mesh. Skinned, the head is merged into the body's geometry with head-bone weights (one draw call per person);
   the procedural 13-part rig stays as the fallback (placeParts) and uses the same heads.
   Textures: every person shares one material (peopleMat, 07-render3d) over three 512^2 canvases painted here (spPaint): colour,
   emissive and roughness (G) + rim share (R), laid out in REGIONS (shared with fielder.py). The GLB's detail atlas (AO, seams,
   face; alpha = 1 - tint mask) is read back once (SPC.det) and multiplied in on the CPU, so a kit change is a repaint, not a
   shader change, and the Earth sleeve-colour bug (sleeves baked from one kit) cannot come back. The 'species' region holds the
   old 128 px species atlas (pattern + four swatches) for the procedural heads. ---------- */
// #test&nomodel: the lab/test hooks with the GLBs left unloaded (the fallbacks on screen); the hash is put back to #test for the
// other modules' checks
const NOMODEL=/[#&]nomodel\b/.test(location.hash);
if(NOMODEL)history.replaceState(null,'',location.pathname+location.search+'#test');
// fielder.py's REGIONS (u0,v0,u1,v1) are in Blender's v (up from the bottom of the image); the glTF exporter flips v, so here,
// in texture space (v down, as the canvas rows), each rect is [u0, 1-v1, u1, 1-v0]
const REGIONS={skin:[0,.5,.5,1],shirt:[.5,.6,1,1],trim:[.5,.5,1,.6],pants:[0,.25,.5,.5],shin:[.5,.25,.75,.5],shoe:[.75,.25,1,.5],
  cap:[0,0,.25,.25],wkglove:[.25,0,.5,.25],wkpad:[.5,0,.75,.25],species:[.75,0,1,.25]};
// the shared body: rig.py HUMAN lengths (th/sh thigh/shin, an ankle height, ua/fa upper arm/forearm to the wrist, tor hip to the
// neck top, cl/sw/sp/nk clavicle, half shoulder width, spine, neck), kn standing knee bend, radii for the fallback parts and the
// lab's capsules (lr legs, ar arms, hr hand), hu/nod idle lean/head pitch; gait defaults (st stride, lf lift, fq cadence, fl
// low-gravity float, jp delivery bound)
const BODY={th:.43,sh:.43,an:.08,ua:.31,fa:.3,hd:0,tor:.54,tw:1,td:1,kn:.985,hu:0,nod:0,cl:.17,sw:.19,sp:.22,nk:.17,
  lr:[.085,.062,.056,.04],ar:[.055,.046,.038],hr:[.045,.05,.03],fs:[1,1,1],legs:'pants',feet:'shoe',st:1,lf:1,fq:1,fl:0,jp:.12};
// head frame helpers: E ellipsoid, C truncated cone along y, the neck cover every head wears over the body's neck stub
const E=(o,r,seg=12,n=7,rx=0,l0)=>ellG(o,r,seg,n,rx,l0);
const coneG=(y0,r0,y1,r1,seg=14)=>GB.surf(lin(1,0,1),seg,(v,a)=>{const r=r0+(r1-r0)*v;return [r*Math.cos(a),y0+(y1-y0)*v,r*Math.sin(a)];});
const NECK=()=>spP(coneG(-.105,.06,-.044,.056));
const EYES=(x,y,z,r,k=1,ry=.45,rz=0)=>[-1,1].map(s=>spS(spT(E([0,0,0],r,8,4),[s*x,y,z],[0,s*ry,-s*rz]),k));
// swt swatches: 0 accent, 1 eye/dark, 2 glow, 3 accent 2; each [colour, emissive, roughness]. skin/pat/em/rough paint the skin.
const SPECIES={
  earth:{name:'Humans',skin:'#b07a55',rough:.62,
    swt:[['#f0e9df','#000',.8],['#1a1410','#000',.3],['#000','#000',1],['#3a2618','#000',.7]],
    head:()=>GB.join(NECK(),spP(E([0,.012,-.012],[.088,.112,.103],14,8)),spP(E([0,-.048,.03],[.066,.066,.07],12,6)),spP(E([0,-.03,.108],[.016,.02,.02],6,3)),
      ...[-1,1].map(s=>spP(E([s*.095,-.005,-.008],[.009,.029,.019],6,4))),...EYES(.033,.004,.086,[.011,.008,.006],1,.35)),
    ex:()=>GB.join(E([0,.04,-.01],[.1,.095,.11],16,6,0,-.12),E([0,.045,.1],[.082,.008,.072],14,3,.15)),exM:'cap'},
  moon:{name:'Selenites',skin:'#c3cad5',rough:.5,em:'#2a3a52',st:1.3,lf:1.4,fq:.62,fl:.13,jp:.06,
    pat:(g,e,w,h,r)=>{for(let i=0;i<70;i++){const x=r()*w,y=r()*h,s=2+r()*6;g.fillStyle=r()<.5?'rgba(255,255,255,.12)':'rgba(70,80,100,.14)';g.beginPath();g.arc(x,y,s,0,7);g.fill();}},
    swt:[['#9fb3cc','#000',.5],['#050608','#000',.12],['#d8f0ff','#6ab4ff',.4],['#000','#000',1]],
    head:()=>GB.join(NECK(),spP(E([0,.035,-.01],[.088,.13,.095],14,9)),spP(E([0,-.065,.025],[.062,.05,.062],12,6)),
      ...EYES(.04,.012,.08,[.03,.04,.012],1,.5,.3),spS(E([0,.15,-.02],[.009,.03,.08],8,5,-.2),2))},
  // ember-orange skin with darker cracked veins (no glow: the crest fin is the one emissive feature, art-style sections 4-5)
  mercury:{name:'Scorchlings',skin:'#e6843f',rough:.7,st:.9,lf:.85,fq:1.15,jp:.24,
    pat:(g,e,w,h,r)=>{for(let i=0;i<40;i++){g.fillStyle=r()<.6?'rgba(120,30,0,.16)':'rgba(255,190,110,.14)';g.beginPath();g.arc(r()*w,r()*h,3+r()*8,0,7);g.fill();}
      for(let i=0;i<16;i++){let x=r()*w,y=r()*h;const pts=[[x,y]];for(let k=0;k<5;k++){x+=(r()-.5)*22;y+=(r()-.5)*22;pts.push([x,y]);}
        for(const [c,s,lw] of [[g,'#6a2208',1.4]]){c.strokeStyle=s;c.lineWidth=lw;c.lineJoin='round';c.beginPath();pts.forEach((p,j)=>j?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();}}},
    swt:[['#4a2418','#8a2c04',.6],['#0b0909','#000',.25],['#ffc070','#ff8a1a',.4],['#6a2e16','#7a2a08',.55]],
    // the crest fin: a low blade along the skull's midline from the brow to the nape, highest over the crown, its edge raked
    // back (art-style section 5: short, swept back), ember at the root and a dim glow along the edge
    head:()=>GB.join(NECK(),spP(E([0,.008,-.01],[.094,.112,.097],12,8)),spP(E([0,-.066,.024],[.086,.05,.08],12,5)),spP(E([0,.036,.064],[.088,.022,.042],10,4)),
      spS(E([0,.012,.07],[.093,.02,.045],14,4),1),
      spBlade(v=>{const z=.065-.16*v,q=(z+.01)/.095;return [0,.012+.1*Math.sqrt(Math.max(0,1-q*q)),z];},[0,0,-1],[0,1,0],v=>.055*Math.pow(Math.sin(Math.PI*Math.min(1,v*1.2)),.6),v=>.016*(1-.4*v),.07,8,10,0,3),
      spS(E([0,-.075,.098],[.03,.004,.01],8,3),1))},
  venus:{name:'Cloudwaders',skin:'#8fc4bc',rough:.7,st:.85,lf:.8,fq:.95,jp:.14,hu:.1,nod:-.1,
    pat:(g,e,w,h,r)=>{for(let i=0;i<34;i++){g.fillStyle='rgba(190,150,220,.35)';g.beginPath();g.arc(r()*w,r()*h,4+r()*9,0,7);g.fill();}
      for(let i=0;i<50;i++){g.fillStyle='rgba(235,245,240,.25)';g.beginPath();g.arc(r()*w,r()*h,1+r()*2,0,7);g.fill();}},
    swt:[['#d98bb8','#000',.6],['#14120c','#000',.2],['#000','#000',1],['#b7739e','#000',.7]],
    head:()=>GB.join(NECK(),spP(E([0,.02,0],[.095,.1,.095],14,8)),spP(E([0,-.04,.085],[.052,.04,.05],10,5)),spP(E([0,-.07,.02],[.07,.045,.07],12,5)),
      ...EYES(.048,.022,.078,[.016,.018,.01],1,.5),
      // two pairs of gill fronds behind the cheeks: flat feathery blades (a scalloped free edge) sweeping back, out and down
      ...[-1,1].flatMap(s=>[0,1].map(j=>spBlade(v=>[s*(.078-.006*j),.0-.03*v-.036*j,-.03+.008*j],[0,-1,0],[s*.45,-.45-.3*j,-.9],
        v=>(.12-.03*j)*(1-.3*Math.abs(2*v-1))*(1+.2*Math.sin(v*8*Math.PI)),()=>.0055,.012,6,10,j?3:0,j?3:0))),
      ...[-1,1].map(s=>spP(E([s*.016,-.03,.13],[.006,.004,.004],5,3))))},
  mars:{name:'Rustkin',skin:'#a5462a',rough:.75,st:1.2,lf:1.1,fq:.85,fl:.03,jp:.06,
    pat:(g,e,w,h,r)=>{for(let i=0;i<90;i++){g.fillStyle=r()<.6?'rgba(90,30,12,.35)':'rgba(220,120,80,.25)';g.beginPath();g.arc(r()*w,r()*h,.8+r()*2,0,7);g.fill();}},
    swt:[['#caa257','#000',.3],['#0e0907','#000',.1],['#ffbf73','#9a4a0a',.15],['#3b2419','#000',.7]],
    head:()=>GB.join(NECK(),spP(E([0,.02,-.005],[.092,.1,.095],14,7)),spP(E([0,-.06,.02],[.07,.055,.07],12,5)),spS(E([0,.045,.035],[.1,.02,.078],14,4),3),
      ...[-1,1].flatMap(s=>[spS(E([s*.06,.025,.072],[.02,.016,.012],10,4),0),spS(E([s*.06,.025,.082],[.011,.01,.006],8,3),1),
        spS(spSeg([s*.03,.11,-.01],[s*.058,.18,-.03],.008,.006,6,2),3),spS(E([s*.06,.183,-.032],[.015,.015,.015],8,5),2)]),
      spP(E([0,-.02,.1],[.014,.018,.016],6,3)),spS(E([0,-.07,.09],[.024,.005,.008],6,3),1))},
  jupiter:{name:'Gravitons',skin:'#e2c296',rough:.7,st:.55,lf:.55,fq:1.6,jp:.34,
    pat:(g,e,w,h,r)=>{const C=['#e8cca2','#c88b5a','#f2ddb8','#9a5a35','#dcab78','#b77446'];let y=0,k=0;
      while(y<h){const t=5+r()*12,ph=r()*6;g.fillStyle=C[k++%C.length];g.beginPath();g.moveTo(0,y);for(let x=0;x<=w;x+=4)g.lineTo(x,y+Math.sin(x*.13+ph)*1.5);g.lineTo(w,y+t+2);g.lineTo(0,y+t+2);g.fill();y+=t;}},
    swt:[['#e9cfa6','#000',.7],['#120a06','#000',.3],['#ffd27a','#ff9a2a',.3],['#b5482a','#000',.6]],
    head:()=>GB.join(NECK(),spP(E([0,0,-.005],[.115,.095,.1],14,7)),spP(E([0,.035,.055],[.105,.028,.05],12,4)),spP(E([0,-.065,.02],[.095,.05,.082],12,5)),
      ...[-1,1].map(s=>spS(E([s*.048,.012,.086],[.016,.012,.008],8,4),2)),spS(E([0,-.07,.095],[.035,.005,.01],8,3),3),spP(E([0,-.02,.105],[.02,.02,.018],6,3)))},
  saturn:{name:'Ringlings',skin:'#e2c78a',rough:.45,st:1.1,lf:1.05,fq:.92,jp:.1,
    pat:(g,e,w,h,r)=>{for(let y=0;y<h;y+=3){g.fillStyle=`rgba(255,250,220,${.05+r()*.08})`;g.fillRect(0,y,w,1);}},
    swt:[['#000','#000',1],['#1c150a','#000',.12],['#fff4cc','#ffcf6a',.3],['#000','#000',1]],
    head:()=>GB.join(NECK(),spP(E([0,.03,0],[.082,.135,.09],14,9)),spP(E([0,-.085,.02],[.05,.04,.05],10,4)),
      ...EYES(.035,.03,.08,[.022,.012,.008],1,.4,.2),spS(E([0,.09,.075],[.01,.01,.007],6,3),2),spS(E([0,-.04,.088],[.02,.004,.008],6,3),1)),
    // the ring: a solid flat band (22 cm wide, 2.6 cm across) round the upper skull, part of the head as Saturn's ring is of the
    // planet (a ring floating over the crown read as a halo); ring = [its centre above the head centre on the head's up axis, tilt
    // up at the front], placed in 07-render3d. Its band (radius .094-.126) passes outside the head (.082 x .09 half-width)
    ex:()=>ringG(.11,.016,.007,40,8),exM:'ring',ring:[.06,.42]},
  neptune:{name:'Tidefolk',skin:'#1a6890',rough:.35,st:1.05,jp:.12,
    pat:(g,e,w,h,r)=>{for(let i=0;i<40;i++){g.fillStyle='rgba(10,30,80,.25)';g.beginPath();g.arc(r()*w,r()*h,3+r()*7,0,7);g.fill();}
      for(let i=0;i<26;i++){const x=r()*w,y=r()*h,s=1.2+r()*1.3;g.fillStyle='#8ff4ff';if(e)e.fillStyle='#38d8ff';for(const c of [g,e]){if(!c)continue;c.beginPath();c.arc(x,y,s,0,7);c.fill();}}},
    swt:[['#4fa3e0','#0a3050',.35],['#03060c','#000',.1],['#a6fbff','#3fe6ff',.3],['#000','#000',1]],
    head:()=>GB.join(NECK(),spP(E([0,.02,0],[.09,.105,.098],14,8)),spP(E([0,-.065,.02],[.068,.05,.07],12,5)),...EYES(.05,.02,.08,[.024,.026,.012],1,.55),
      ...[-1,1].flatMap(s=>[spS(spT(E([0,0,0],[.008,.06,.05],8,5),[s*.095,.04,-.02],[-.3,0,s*.5]),0),spS(E([s*.1,.075,-.04],[.008,.008,.008],5,3),2),spS(E([s*.075,.11,.03],[.007,.007,.007],5,3),2)]),
      spS(E([0,.12,-.02],[.008,.008,.008],5,3),2))}
};
for(const k in SPECIES)SPECIES[k]=Object.assign({},BODY,SPECIES[k]);
// geometry helpers: pattern UVs and swatch UVs in the species region, scale/rotate (z, then x, then y)/translate, a tapered
// capsule from a to b
const SPR=REGIONS.species,spUV=(u,v)=>[SPR[0]+u*(SPR[2]-SPR[0]),SPR[1]+v*(SPR[3]-SPR[1])];
function spP(g){for(let i=0;i<g.T.length;i+=2){const [u,v]=spUV(g.T[i]*.75,g.T[i+1]);g.T[i]=u;g.T[i+1]=v;}return g;}
function spS(g,k){for(let i=0;i<g.T.length;i+=2){const [u,v]=spUV(.875,(k+.5)/4);g.T[i]=u;g.T[i+1]=v;}return g;}
function spT(g,o,r=[0,0,0],s=[1,1,1]){
  const C=r.map(Math.cos),S=r.map(Math.sin),rot=(x,y,z)=>{let t=x*C[2]-y*S[2];y=x*S[2]+y*C[2];x=t;t=y*C[0]-z*S[0];z=y*S[0]+z*C[0];y=t;t=x*C[1]+z*S[1];z=-x*S[1]+z*C[1];return [t,y,z];},P=g.P,N=g.N;
  for(let i=0;i<P.length;i+=3){const p=rot(P[i]*s[0],P[i+1]*s[1],P[i+2]*s[2]),n=V3.norm(rot(N[i]/s[0],N[i+1]/s[1],N[i+2]/s[2]));
    for(let j=0;j<3;j++){P[i+j]=p[j]+o[j];N[i+j]=n[j];}}
  return g;}
// a thin blade (crest fin, gill frond): rows v along a root line root(v) (length along D), rising in U by hgt(v) (hf 0 at the
// root, 1 at the free edge, so hgt(v) shapes that edge: a rake pulls the edge back along D), a lens section of thickness
// thk(v) across N = D x U; swatch k at the root, kTip over the outer part of the blade
function spBlade(root,D,U,hgt,thk,rake,n,seg,k,kTip){
  D=V3.norm(D);U=V3.norm(V3.sub(U,V3.sc(D,V3.dot(U,D))));const N=V3.cross(D,U);
  const g=GB.surf(lin(n,0,1),seg,(v,a)=>{const hf=(1-Math.cos(a))/2,r=root(v),h=hgt(v)*hf,w=thk(v)*Math.sin(a)*Math.sqrt(1.02-hf),d=rake*hf;
    return [r[0]+D[0]*d+U[0]*h+N[0]*w,r[1]+D[1]*d+U[1]*h+N[1]*w,r[2]+D[2]*d+U[2]*h+N[2]*w];});
  for(let i=0,j=0;i<g.T.length;i+=2,j++){const hf=(1-Math.cos(j%(seg+1)/seg*2*Math.PI))/2,[u,v]=spUV(.875,((hf>.55?kTip:k)+.5)/4);g.T[i]=u;g.T[i+1]=v;}
  return g;}
// a solid flat ring (Saturn): an elliptical section w across (radial), h thick, round the y axis at radius R
const ringG=(R,w,h,seg,n)=>GB.surf(lin(n,0,1),seg,(v,a)=>{const b=v*2*Math.PI,q=R+w*Math.cos(b);return [q*Math.cos(a),h*Math.sin(b),q*Math.sin(a)];});
function spSeg(a,b,r1,r2,seg,n){const d=V3.sub(b,a),L=Math.hypot(d[0],d[1],d[2]),Y=V3.sc(d,1/L),X=V3.norm(V3.cross(Y,Math.abs(Y[2])<.9?[0,0,1]:[1,0,0])),Z=V3.cross(X,Y),g=capG(r1,r2,L,seg,n),m=V3.lerp(a,b,.5);
  for(let i=0;i<g.P.length;i+=3)for(const A of [g.P,g.N]){const x=A[i],y=A[i+1],z=A[i+2];for(let j=0;j<3;j++)A[i+j]=X[j]*x+Y[j]*y+Z[j]*z+(A===g.P?m[j]:0);}
  return g;}
/* --- the shared people atlas: three canvases (colour, emissive, roughness G + rim share R), painted per species and kit by
   spPaint. det: the GLB detail atlas read back (RGBA bytes, 512^2; null until fielder.glb has loaded or without it), hair: the
   Earth head's hair-zone triangles in UV space (07-skin), tex: the three CanvasTextures (made once the renderer exists). --- */
const SPN=512,SPC={n:SPN,col:null,em:null,rough:null,tex:null,det:null,hair:null,key:null};
function spCanvas(){
  if(SPC.col)return SPC;const mk=()=>{const c=document.createElement('canvas');c.width=c.height=SPN;return c;};
  SPC.col=mk();SPC.em=mk();SPC.rough=mk();
  SPC.tex={col:canvasTex(SPC.col),em:canvasTex(SPC.em),rough:canvasTex(SPC.rough,0,true)};
  return SPC;}
const spRect=n=>{const r=REGIONS[n];return [Math.round(r[0]*SPN),Math.round(r[1]*SPN),Math.round((r[2]-r[0])*SPN),Math.round((r[3]-r[1])*SPN)];};
const hexRGB=h=>{const c=new THREE.Color(h);return [Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255)];};
// a region's roughness (G) and rim share/1.2 (R) as a flat grey
const spRough=(q,n,ro,rim)=>{const [x,y,w,h]=spRect(n);q.fillStyle=`rgb(${Math.round(rim/1.2*255)},${Math.round(ro*255)},0)`;q.fillRect(x,y,w,h);};
// paints a region: base colour (or a painter over it), then per texel: mixed toward the tint where the detail alpha says so and
// multiplied by the detail (AO, seams, face). Without the detail (fallback) the flat colour stays.
function spRegion(g,n,colour,tint,paintFn){
  const [x,y,w,h]=spRect(n);g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.fillStyle=colour;g.fillRect(x,y,w,h);
  if(paintFn)paintFn(x,y,w,h);g.restore();
  const D=SPC.det;if(!D)return;
  const im=g.getImageData(x,y,w,h),d=im.data,T=tint?hexRGB(tint):null;
  for(let j=0;j<h;j++){let o=((y+j)*SPN+x)*4,p=j*w*4;
    for(let i=0;i<w;i++,o+=4,p+=4){const a=D[o+3];
      if(T&&a<255){const t=a/255;d[p]=T[0]+(d[p]-T[0])*t;d[p+1]=T[1]+(d[p+1]-T[1])*t;d[p+2]=T[2]+(d[p+2]-T[2])*t;}
      d[p]=d[p]*D[o]/255;d[p+1]=d[p+1]*D[o+1]/255;d[p+2]=d[p+2]*D[o+2]/255;}}
  g.putImageData(im,x,y);}
// the species' skin pattern over a region (the old 128 px pattern, scaled), seeded so it is the same every run
const spPattern=(P,key,g,e,x,y,w,h)=>{if(!P.pat)return;const sc=w/128;g.save();g.translate(x,y);g.scale(sc,sc);if(e){e.save();e.translate(x,y);e.scale(sc,sc);}
  P.pat(g,e,128,Math.round(h/sc),prng(key.length*97+7));g.restore();if(e)e.restore();};
const EYE_WHITE='#efebe6',HAIR='#3a2618';
function spPaint(key,k){
  const P=SPECIES[key],C=spCanvas(),g=C.col.getContext('2d'),e=C.em.getContext('2d'),q=C.rough.getContext('2d'),earth=key==='earth',skin=earth?k.skin||P.skin:P.skin;
  e.fillStyle='#000';e.fillRect(0,0,SPN,SPN);
  spRegion(g,'skin',skin,EYE_WHITE,(x,y,w,h)=>{if(!earth)spPattern(P,key,g,null,x,y,w,h);
    else if(SPC.hair){g.fillStyle=g.strokeStyle=HAIR;g.lineWidth=1.2;g.lineJoin='round';for(const t of SPC.hair){g.beginPath();g.moveTo(t[0]*SPN,t[1]*SPN);g.lineTo(t[2]*SPN,t[3]*SPN);g.lineTo(t[4]*SPN,t[5]*SPN);g.closePath();g.fill();g.stroke();}}});
  spRegion(g,'shirt',k.shirt,k.trim);spRegion(g,'trim',k.trim);spRegion(g,'pants',k.pants);spRegion(g,'shin',k.pants);spRegion(g,'shoe','#f2f2f2');
  spRegion(g,'cap',k.cap||k.shirt);spRegion(g,'wkglove','#e9e2d4',k.trim);spRegion(g,'wkpad','#f5f3ef');
  // species region: the pattern area (u < .75) and the four swatches, colour and emissive
  {const [x,y,w,h]=spRect('species'),pw=Math.round(w*.75);g.fillStyle=P.skin;g.fillRect(x,y,pw,h);e.fillStyle=P.em||'#000';e.fillRect(x,y,pw,h);
    g.save();g.beginPath();g.rect(x,y,pw,h);g.clip();e.save();e.beginPath();e.rect(x,y,pw,h);e.clip();spPattern(P,key,g,e,x,y,w,h);g.restore();e.restore();
    const sw=h/4;P.swt.forEach(([c,em],i)=>{g.fillStyle=c;g.fillRect(x+pw,y+i*sw,w-pw,sw);e.fillStyle=em;e.fillRect(x+pw,y+i*sw,w-pw,sw);});
    q.fillStyle=`rgb(${Math.round(.9/1.2*255)},${Math.round(P.rough*255)},0)`;q.fillRect(x,y,pw,h);
    P.swt.forEach(([,,ro],i)=>{q.fillStyle=`rgb(${Math.round(.9/1.2*255)},${Math.round(ro*255)},0)`;q.fillRect(x+pw,y+i*sw,w-pw,sw);});}
  // roughness and rim per region (art-style section 1: cloth .4, pads/gloves .6, shoes .5, skin .9 of the rim)
  spRough(q,'skin',P.rough,.9);for(const n of ['shirt','trim','pants','shin'])spRough(q,n,.86,.4);spRough(q,'shoe',.55,.5);spRough(q,'cap',.8,.5);spRough(q,'wkglove',.6,.6);spRough(q,'wkpad',.6,.6);
  for(const t of Object.values(C.tex))t.needsUpdate=true;
  SPC.key=key;
}
// the species' fallback parts (built once each): the shared limbs, the species head (head frame) and its extra (cap or ring); raw
// head arrays are kept for the skinned merge (07-skin)
const SPG={};let SPL=null;
function spBuild(key){
  const P=SPECIES[key];if(SPG[key])return SPG[key];
  if(!SPL){const B=BODY,hand=ellG([0,B.fa/2,0],B.hr,10,5);
    SPL={thigh:geo(spP(capG(B.lr[0],B.lr[1],B.th,12,3))),shin:geo(spP(capG(B.lr[2],B.lr[3],B.sh,12,3))),uarm:geo(spP(capG(B.ar[0],B.ar[1],B.ua,10,3))),
      farm:geo(GB.join(spP(capG(B.ar[1]*.95,B.ar[2],B.fa,10,3)),spP(hand))),foot:geo(shoeG(12,6))};}
  const headRaw=P.head();
  return SPG[key]=Object.assign({P,headRaw,head:geo(headRaw),ex:P.ex?geo(P.ex()):null},SPL);
}
