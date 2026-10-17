/* ---------- skinned batter: a Blender-made model (tools/blender/batter.py + body.py -> src/models/batter.glb, embedded as base64
   in MODEL_DATA) on the rig.py skeleton (rig v2: 19 bones + 4 arm twist bones), driven every frame by the procedural pose.
   skinDrive writes every bone's world matrix from the pose's joints (batJoints): the head at the joint, the rotation
   mapping the bone's rest aim/ref vectors (glTF extras, from rig.py) onto the same vectors taken from the pose (skinVecs),
   so the runtime doesn't depend on Blender's bone axes and a limb the pose stretches past its reach still ends at the hand
   or ankle. Helmet and shoes are rigid on a bone; gloves are skinned to hand + forearm twist, pads to shin + thigh.
   The bat stays the procedural one (batsman3D), so contact targeting is unchanged. If the model can't be loaded the
   procedural batter stays. ---------- */
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone as skClone} from 'three/examples/jsm/utils/SkeletonUtils.js';
const SKN={on:false,root:null,b:[],b2:[],qL:[],rec:null,rec2:null,err:null};
const SKB=['pelvis','spine','chest','neck','head','clavicle_L','upperarm_L','forearm_L','hand_L','clavicle_R','upperarm_R','forearm_R','hand_R',
  'thigh_L','shin_L','foot_L','thigh_R','shin_R','foot_R','uarm_tw_L','farm_tw_L','uarm_tw_R','farm_tw_R'];
const SKQ={m:new THREE.Matrix4(),a:new THREE.Vector3(),r:new THREE.Vector3(),c:new THREE.Vector3(),q:new THREE.Quaternion(),p:new THREE.Vector3(),s:new THREE.Vector3(),gw:new THREE.Matrix4()};
// rotation taking +x to a and +y to r made perpendicular to a (a fallback axis if r is parallel to a)
function skBasis(a,r,q){
  const A=SKQ.a.set(a[0],a[1],a[2]).normalize(),R=SKQ.r.set(r[0],r[1],r[2]);R.addScaledVector(A,-R.dot(A));
  if(R.lengthSq()<1e-8){R.set(A.y,-A.x,0);if(R.lengthSq()<1e-8)R.set(1,0,0);}
  R.normalize();return q.setFromRotationMatrix(SKQ.m.makeBasis(A,R,SKQ.c.crossVectors(A,R)));}
// a driven skeleton: its bones by SKB index (their world matrices are written, never derived from the parent chain) and
// the rigid kit parented to a bone (helmet, shoes), placed from the bone after it
function skinRec(root,g){
  const b=SKB.map(n=>{const x=root.getObjectByName(n);if(!x||!x.isBone)throw new Error('bone '+n);x.matrixAutoUpdate=false;x.matrixWorldAutoUpdate=false;return x;}),rigid=[];
  for(const x of b)for(const c of x.children)if(!c.isBone)rigid.push(c);
  return {b,rigid,g};}
// one atlas for every mesh (tools/blender/body.py: rgb = AO and painted detail multiplying the kit colour, alpha 0 = the
// material's tint: trim on the shirt and glove cuffs, eye white on the skin); roughness and rim share per art-style section 1
const EYE=[.91,.89,.86];
// rest aim/ref in each bone's own axes (SKB order), from its rest world matrix (the GLB root at identity): the inverse basis
// skinDrive multiplies the current one by
function skRestBasis(root){
  const rq=new THREE.Quaternion(),v=new THREE.Vector3(),u=new THREE.Vector3();root.updateMatrixWorld(true);
  return SKB.map(n=>{const b=root.getObjectByName(n),x=b&&b.userData;if(!x||!x.aim||!x.ref)throw new Error('bone '+n);
    b.matrixWorld.decompose(v,rq,u);rq.invert();
    const la=v.fromArray(x.aim).applyQuaternion(rq).toArray(),lr=u.fromArray(x.ref).applyQuaternion(rq).toArray();
    return skBasis(la,lr,new THREE.Quaternion()).invert();});}
function skinInit(gl){
  const root=gl.scene,k=KIT.you;let tex=null;root.traverse(o=>{if(o.isMesh&&o.material.map&&!tex)tex=o.material.map;});
  if(tex){tex.anisotropy=Math.min(8,T3.r.capabilities.getMaxAnisotropy());tex.colorSpace=THREE.SRGBColorSpace;}
  const mk=(c,o,rim,tint)=>kit(c,Object.assign({map:tex},o),rim,tint),M={skin:mk(SKIN,{roughness:.65},.9,EYE),shirt:mk(k.shirt,{roughness:.86},.4,k.trim),
    trim:mk(k.trim,{roughness:.86},.4),pants:mk(k.pants,{roughness:.88},.4),helmet:mk(k.helmet,{roughness:.3,metalness:.1},1.1),
    grille:mk(GRILLE,{roughness:.35,metalness:.7},1),pad:mk(PAD,{roughness:.58},.6),glove:mk(GLOVE,{roughness:.6},.6,k.trim),shoe:mk([1,1,1],{roughness:.55},.5)};
  root.updateMatrixWorld(true);
  root.traverse(o=>{if(o.isMesh){const m=M[o.material.name];if(!m)throw new Error('material '+o.material.name);o.material.dispose();o.material=m;o.castShadow=o.receiveShadow=true;o.frustumCulled=false;}});
  SKN.qL=skRestBasis(root);
  for(const B of [G3.bat,G3.ns]){for(const p of ['shoe','thigh','pad','uarm','sleeve','farm','glove'])B[p].forEach(m=>m.visible=false);
    for(const p of ['pelvis','torso','neck','head','helmet','grille'])B[p].visible=false;}
  const r2=skClone(root);G3.ns.g.add(r2);G3.bat.g.add(root);T3.world.updateMatrix();
  SKN.rec=skinRec(root,G3.bat.g);SKN.rec2=skinRec(r2,G3.ns.g);SKN.b=SKN.rec.b;SKN.b2=SKN.rec2.b;
  SKN.root=root;SKN.mat=M;SKN.on=true;kitBatter();
}
// both batters share these materials: the planet team's kit while the player bowls (KS.you), else the player's
function kitBatter(){
  const m=SKN.mat;if(!m)return;const ai=KS.you,k=ai?aiKit():KIT.you,trim=k.trim||k.pants;
  m.shirt.color.set(k.shirt);m.trim.color.set(trim);m.pants.color.set(k.pants);m.helmet.color.set(ai?k.cap||k.shirt:k.helmet);if(ai&&!k.cap)m.helmet.color.multiplyScalar(.45);
  m.shirt.userData.tint.set(trim);m.glove.userData.tint.set(trim);
}
// both GLBs (MODEL_DATA, base64 from build.mjs): the batter, then the fielding side's body; #test&nomodel leaves them unloaded
function skinLoad(){
  if(!glOK||typeof MODEL_DATA==='undefined'||NOMODEL)return;
  const load=(key,init,st)=>{if(!MODEL_DATA[key]){st.err='no model';return;}
    try{const s=atob(MODEL_DATA[key]),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);
      new GLTFLoader().parse(u.buffer,'',g=>{try{init(g);}catch(e){st.err=String(e);console.error(e);}},e=>{st.err=String(e);});}
    catch(e){st.err=String(e);}};
  load('batter',g=>{skinInit(g);skfHelmet(g.scene);},SKN);
  load('fielder',skfInit,SKF);
}
// Twist refs. The arm twist bones carry the twist that one bone used to put on a joint, so the skin turns gradually along
// the limb instead of folding in the few centimetres where two bones' weights meet. r is the limb's own ref (perpendicular
// to its unit aim u); the result is r turned about u toward t by frac of the angle, at most cap, and that turn fades to
// nothing as the angle nears 180 deg (SKT.fade before it), where its direction would otherwise flip between frames.
// Linear skinning pinches the limb between two bones twisted apart (cos of half the angle), hence the caps: 60 deg on the
// forearm (the hand's twist from the elbow plane is 38 deg in a typical pose, 120 at the top of a pull), 50 on the upper arm
// toward a torso-fixed elbow direction (SKT.D: forward and up, the poses' mean; the humerus turns through 180 deg across the
// shots, so no fixed direction can take more than a share).
const SKT={fade:60*D2R,fc:60*D2R,uf:.5,uc:50*D2R,D:[Math.cos(40*D2R),Math.sin(40*D2R)]};
function twistTo(r,t,u,frac,cap){
  const tp=V3.sub(t,V3.sc(u,V3.dot(t,u))),l=Math.hypot(tp[0],tp[1],tp[2]);if(l<1e-4)return r;
  const c=V3.dot(r,tp)/l,s=V3.dot(V3.cross(r,tp),u)/l,th=Math.atan2(s,c),a=Math.min(1,(Math.PI-Math.abs(th))/SKT.fade),
    rot=Math.sign(th)*Math.min(Math.abs(th)*frac,cap)*a;
  return V3.add(V3.sc(r,Math.cos(rot)),V3.sc(V3.cross(u,r),Math.sin(rot)));}
// drive vectors (aim, ref) and head positions per bone (SKB order) from the pose's joints: [A, R, P] with P[i] = [i, pos].
// Lengths come from J.L (batJoints). Elbows and knees bend toward the IK pole made perpendicular to the limb line, as in
// ik(); the spine takes half the twist between hips and shoulders, the neck half between chest and face; shins and pads
// face the toe, hands turn with the bat and its face (GA, GF). Clavicles follow the upper arm by 15% of its swing from
// rest (a shrug when the arms go up), so the arms are re-solved from the moved shoulders; the forearm's root keeps the
// elbow plane and its twist bone takes the hand's twist (twistTo), the upper arm's root turns part way toward SKT.D and its
// twist bone keeps the elbow plane. Every bone is placed on its joint: a limb the pose stretches beyond its reach (the
// back leg in a long stride) is closed at the hand or ankle, so gloves stay on the handle and shoes on the ground.
// the bend side of a solved limb (joint j between root r and end e), so the skin's elbow re-solve from the shrugged shoulder keeps
// batJoints' hysteresis instead of flipping with the raw pole
const bendDir=(r,j,e)=>{const u=V3.norm(V3.sub(e,r)),v=V3.sub(j,r),o=V3.sub(v,V3.sc(u,V3.dot(v,u)));return Math.hypot(o[0],o[1],o[2])>1e-3?o:null;};
function skinVecs(J){
  const L=J.L,prp=(v,l)=>V3.sub(v,V3.sc(l,V3.dot(v,l)/V3.dot(l,l))),A=[[0,-1,0],J.Y,J.Y,V3.sub(J.nt,J.sh),J.hv],
    R=[J.ha,V3.add(V3.norm(prp(J.ha,J.Y)),J.s),J.s,V3.add(J.n,J.face),J.face],P=[J.hip,J.hip,V3.add(J.hip,V3.sc(J.Y,L.sp)),J.sh,J.nt],
    D=V3.add(V3.sc(J.n,SKT.D[0]),V3.sc(J.Y,SKT.D[1])),TW=[];
  for(let i=0;i<2;i++){const lat=V3.sc(J.s,i?-1:1),c=V3.add(J.sh,V3.sc(lat,L.sw-L.cl)),u0=V3.add(V3.sc(J.Y,-Math.SQRT1_2),V3.sc(lat,Math.SQRT1_2)),
      ad=V3.norm(V3.sub(J.e[i],J.sp[i])),ca=V3.norm(V3.add(V3.add(lat,V3.sc(V3.sub(ad,u0),.15)),V3.sc(J.Y,.25*Math.max(0,V3.dot(ad,J.Y))))),sp=V3.add(c,V3.sc(ca,L.cl)),   // (an arm raised above the shoulder lifts the clavicle too, up to ~20 deg: the shoulder and chest are not dragged up by the arm)
      bd=bendDir(J.sp[i],J.e[i],J.hd[i])||J.ap[i],e=J.e[i],sd=prp(bd,V3.sub(J.hd[i],sp)),ua=V3.sub(e,sp),f=V3.sub(J.hd[i],e),hr=V3.cross(J.gn[i],J.wa[i]),
      un=V3.norm(ua),fn=V3.norm(f),usd=V3.norm(prp(sd,un)),fsd=V3.norm(prp(sd,fn));
    A.push(ca,ua,f,J.wa[i]);R.push(J.Y,twistTo(usd,D,un,SKT.uf,SKT.uc),fsd,hr);P.push(c,sp,e,J.hd[i]);
    TW.push([ua,usd,V3.lerp(sp,e,.5)],[f,twistTo(fsd,V3.sc(hr,-1),fn,1,SKT.fc),V3.lerp(e,J.hd[i],.5)]);}
  for(let i=0;i<2;i++){const sd=prp(J.kp[i],V3.sub(J.an[i],J.hj[i]));
    A.push(V3.sub(J.kn[i],J.hj[i]),V3.sub(J.an[i],J.kn[i]),J.fw[i]);R.push(sd,J.t[i],[0,1,0]);P.push(J.hj[i],J.kn[i],J.an[i]);}
  for(const [a,r,p] of TW){A.push(a);R.push(r);P.push(p);}
  return [A,R,P.map((p,i)=>[i,p])];}
// writes every bone's world matrix of a driven skeleton (skinRec) from the joints J: head at the joint, rotation from the
// drive vectors, an optional per-bone scale (scale[i]: a number, or [x,y,z] in the bone's own axes, y along the bone) and
// the batter group's world matrix gw (the mirrored T3.world times the group's matrix, so a clone follows its own group).
// The bones' matrices are never derived from their parents (matrixWorldAutoUpdate off), the rigid kit is placed after them.
function skinDrive(rec,J,scale,gw){
  const [A,R,P]=skinVecs(J),q=SKQ.q,p=SKQ.p,s=SKQ.s,qL=rec.qL||SKN.qL;
  for(let i=0;i<SKB.length;i++){
    skBasis(A[i],R[i],q).multiply(qL[i]);
    const t=P[i][1],sc=scale&&scale[i];
    if(sc==null)s.set(1,1,1);else if(typeof sc==='number')s.set(sc,sc,sc);else s.set(sc[0],sc[1],sc[2]);
    rec.b[i].matrixWorld.compose(p.set(t[0],t[1],t[2]),q,s).premultiply(gw);}
  for(const o of rec.rigid)o.updateMatrixWorld(true);
}
// the batter (BB = SKN.b) or the non-striker clone (SKN.b2), as batsman3D calls it
function skin3D(J,BB=SKN.b){
  const rec=BB===SKN.b2?SKN.rec2:SKN.rec;
  skinDrive(rec,J,null,SKQ.gw.multiplyMatrices(T3.world.matrix,rec.g.matrix));
}

/* ---------- skinned fielders, bowler and keeper (tools/blender/fielder.py -> src/models/fielder.glb): one athletic body on the
   same rig.py skeleton. At load every mesh is put into bind space (the GLB's quantised positions dequantised, rigid parts by
   their rest matrices) and given SKB bone indices; per species one merged geometry (body + shoes + the head: the GLB's Earth
   head and cap, or the species' procedural head with head-bone weights) so a person is ONE draw call; the keeper's gauntlets
   and pads are one more (wk), his helmet up to spin (hm, the batter's helmet cloned) another. Each rig gets its own skeleton
   (23 cloned bones, rest inverses shared), driven by skinDrive from personJoints' J; frustum culling uses a bounding sphere
   at the hip. The detail atlas is read back for 07-people's canvas painter (SPC.det) with the Earth head's hair triangles. ---------- */
const SKF={on:false,err:null,qL:null,inv:null,parts:null,geo:{},wk:null,hm:null,hmMat:null,grMat:null,cur:null,hc:null};
// a mesh's vertices in bind space with SKB bone indices: {p,n,uv,si,sw,idx,groups}. Skinned: dequantised through the skin
// (rest world x inverse bind = the quantisation transform, the same for every joint of that skin); rigid: its rest world matrix
// and the parent bone's index
function skfPart(o,bone){
  const g=o.geometry,P=g.attributes.position,N=g.attributes.normal,UV=g.attributes.uv,SI=g.attributes.skinIndex,SW=g.attributes.skinWeight,cnt=P.count,
    p=new Float32Array(cnt*3),n=new Float32Array(cnt*3),uv=new Float32Array(cnt*2),si=new Uint16Array(cnt*4),sw=new Float32Array(cnt*4),v=new THREE.Vector3();
  let D,map=null;
  if(o.isSkinnedMesh){const sk=o.skeleton;D=sk.bones[0].matrixWorld.clone().multiply(sk.boneInverses[0]);map=sk.bones.map(b=>SKB.indexOf(b.name));}
  else D=o.matrixWorld;
  const NM=new THREE.Matrix3().getNormalMatrix(D),bi=bone!=null?bone:SKB.indexOf(o.parent.name);
  for(let i=0;i<cnt;i++){v.fromBufferAttribute(P,i).applyMatrix4(D);p[i*3]=v.x;p[i*3+1]=v.y;p[i*3+2]=v.z;
    v.fromBufferAttribute(N,i).applyMatrix3(NM).normalize();n[i*3]=v.x;n[i*3+1]=v.y;n[i*3+2]=v.z;
    if(UV){uv[i*2]=UV.getX(i);uv[i*2+1]=UV.getY(i);}
    if(map){for(let k=0;k<4;k++){const w=SW.getComponent(i,k),j=map[SI.getComponent(i,k)];si[i*4+k]=w>0&&j>=0?j:0;sw[i*4+k]=w>0&&j>=0?w:0;}}
    else{si[i*4]=bi;sw[i*4]=1;}}
  const I=g.index,idx=new Uint32Array(I?I.count:cnt);for(let i=0;i<idx.length;i++)idx[i]=I?I.getX(i):i;
  return {p,n,uv,si,sw,idx,groups:g.groups.map(x=>({start:x.start,count:x.count,mi:x.materialIndex}))};}
// a procedural head (07-people, head frame: x his right, y up, z forward, origin at the head centre) as a bind-space part on the
// head bone: forward is +x and left +z in the rig's rest pose, so (x,y,z) -> (z, y, -x) at the head centre
function skfHead(raw){
  const P=raw.P,N=raw.N,T=raw.T,I=raw.I.slice(),cnt=P.length/3,hc=SKF.hc,p=new Float32Array(cnt*3),n=new Float32Array(cnt*3),si=new Uint16Array(cnt*4),sw=new Float32Array(cnt*4),hb=SKB.indexOf('head');
  for(let i=0;i<cnt;i++){p[i*3]=hc[0]+P[i*3+2];p[i*3+1]=hc[1]+P[i*3+1];p[i*3+2]=hc[2]-P[i*3];n[i*3]=N[i*3+2];n[i*3+1]=N[i*3+1];n[i*3+2]=-N[i*3];si[i*4]=hb;sw[i*4]=1;}
  // the builders ignore winding: face each triangle along its normals (as fillGeo)
  for(let k=0;k<I.length;k+=3){const a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
    if((uy*vz-uz*vy)*(n[a]+n[b]+n[c])+(uz*vx-ux*vz)*(n[a+1]+n[b+1]+n[c+1])+(ux*vy-uy*vx)*(n[a+2]+n[b+2]+n[c+2])<0){const t=I[k+1];I[k+1]=I[k+2];I[k+2]=t;}}
  return {p,n,uv:new Float32Array(T),si,sw,idx:Uint32Array.from(I),groups:[]};}
// one geometry from parts (groups kept, offset)
function skfMerge(parts){
  let nv=0,ni=0;for(const q of parts){nv+=q.p.length/3;ni+=q.idx.length;}
  const p=new Float32Array(nv*3),n=new Float32Array(nv*3),uv=new Float32Array(nv*2),si=new Uint16Array(nv*4),sw=new Float32Array(nv*4),idx=new Uint32Array(ni),g=new THREE.BufferGeometry();
  let ov=0,oi=0;
  for(const q of parts){p.set(q.p,ov*3);n.set(q.n,ov*3);uv.set(q.uv,ov*2);si.set(q.si,ov*4);sw.set(q.sw,ov*4);for(let i=0;i<q.idx.length;i++)idx[oi+i]=q.idx[i]+ov;
    for(const x of q.groups)g.addGroup(oi+x.start,x.count,x.mi);ov+=q.p.length/3;oi+=q.idx.length;}
  g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(n,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4));g.setIndex(new THREE.BufferAttribute(idx,1));
  g.computeBoundingSphere();return g;}
function skfInit(gl){
  const root=gl.scene;root.updateMatrixWorld(true);
  const bones=SKB.map(n=>{const b=root.getObjectByName(n);if(!b||!b.isBone)throw new Error('bone '+n);return b;}),M={};
  root.traverse(o=>{if(o.isMesh)M[o.name]=o;});
  for(const n of ['body','head_earth','cap','shoe_L','shoe_R','wkglove_L','wkglove_R','wkpad_L','wkpad_R'])if(!M[n])throw new Error('mesh '+n);
  SKF.qL=skRestBasis(root);SKF.inv=bones.map(b=>b.matrixWorld.clone().invert());
  const hv=new THREE.Vector3();bones[SKB.indexOf('head')].matrixWorld.decompose(hv,SKQ.q,SKQ.s);SKF.hc=[hv.x,hv.y+.06,hv.z];
  const pt=SKF.parts={};for(const n in M)pt[n]=skfPart(M[n]);
  // the detail atlas read back for the painter, and the Earth head's hair zone (crown, back and sides above the ears) as UV triangles
  const tex=M.body.material.map;if(!tex||!tex.image)throw new Error('no atlas');
  const c=document.createElement('canvas');c.width=c.height=SPC.n;const g=c.getContext('2d');g.drawImage(tex.image,0,0,SPC.n,SPC.n);SPC.det=g.getImageData(0,0,SPC.n,SPC.n).data;
  {const h=pt.head_earth,hc=SKF.hc,tri=[];
    for(let k=0;k<h.idx.length;k+=3){let cy=0,cf=0,cr=0;for(let j=0;j<3;j++){const a=h.idx[k+j]*3;cf+=h.p[a]-hc[0];cy+=h.p[a+1]-hc[1];cr-=h.p[a+2]-hc[2];}cy/=3;cf/=3;cr/=3;
      if(cy>.085||(cy>-.005&&cf<-.04)||(cy>.035&&Math.abs(cr)>.07&&cf<.035)){const t=[];for(let j=0;j<3;j++){const a=h.idx[k+j]*2;t.push(h.uv[a],h.uv[a+1]);}tri.push(t);}}
    SPC.hair=tri;}
  SKF.wk=skfMerge([pt.wkglove_L,pt.wkglove_R,pt.wkpad_L,pt.wkpad_R]);
  const C=spCanvas(),mat=G3.pm.skin;T3.world.updateMatrix();
  for(const r of [...G3.fielders,G3.bowler]){
    const bs=SKB.map((n,i)=>{const b=new THREE.Bone();b.name=n;b.userData=bones[i].userData;b.matrixAutoUpdate=false;b.matrixWorldAutoUpdate=false;return b;});
    bones.forEach((b,i)=>{const pi=SKB.indexOf(b.parent.name);if(pi>=0)bs[pi].add(bs[i]);});
    const skel=new THREE.Skeleton(bs,SKF.inv),mk=(geo,m)=>{const x=new THREE.SkinnedMesh(geo,m);x.matrixAutoUpdate=false;x.castShadow=x.receiveShadow=true;x.bind(skel,new THREE.Matrix4());r.g.add(x);return x;};
    r.sk=mk(SKF.wk,mat);r.sk.add(bs[0]);r.sk.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1.7);
    r.wk=mk(SKF.wk,mat);r.wk.visible=false;r.wk.boundingSphere=r.sk.boundingSphere;
    if(SKF.hmGeo){r.hm=mk(SKF.hmGeo,[SKF.hmMat,SKF.grMat]);r.hm.visible=false;r.hm.boundingSphere=r.sk.boundingSphere;}
    r.rec={b:bs,rigid:[],g:r.g,qL:SKF.qL};}
  SKF.on=true;kitApply();
}
// the keeper's helmet: the batter GLB's helmet (dome + grille, rigid on its head bone, the same rest rig) as a head-bone skinned
// part; its colour follows the fielding kit (spApply)
function skfHelmet(root){
  const h=root.getObjectByName('helmet');if(!h)return;const parts=[];
  h.traverse(o=>{if(!o.isMesh)return;const q=skfPart(o,SKB.indexOf('head'));q.groups=[{start:0,count:q.idx.length,mi:o.material===SKN.mat.grille?1:0}];parts.push(q);});
  if(!parts.length)return;
  SKF.hmGeo=skfMerge(parts);SKF.hmMat=kit([.3,.3,.3],{roughness:.3,metalness:.1},1.1);SKF.grMat=kit(GRILLE,{roughness:.35,metalness:.7},1);
  for(const r of [...G3.fielders,G3.bowler])if(r.sk&&!r.hm){const x=new THREE.SkinnedMesh(SKF.hmGeo,[SKF.hmMat,SKF.grMat]);x.matrixAutoUpdate=false;x.castShadow=x.receiveShadow=true;
    x.bind(r.sk.skeleton,new THREE.Matrix4());x.visible=false;x.boundingSphere=r.sk.boundingSphere;r.g.add(x);r.hm=x;}
}
// the merged body geometries for a species (cached): with the cap (fielders) and without (the bowler, a keeper in his helmet);
// only Earth has a cap, the other species' heads carry their feature
function skfSpecies(key,B){
  let g=SKF.geo[key];
  if(!g){const pt=SKF.parts,base=[pt.body,pt.shoe_L,pt.shoe_R],head=key==='earth'?pt.head_earth:skfHead(B.headRaw),nocap=skfMerge([...base,head]);
    g=SKF.geo[key]={nocap,cap:key==='earth'?skfMerge([...base,head,pt.cap]):nocap,earth:key==='earth'};}
  SKF.cur=g;
}
// one person per frame: the skeleton from J, the geometry for his role (bowler and the helmeted keeper capless), the keeper's kit
// and helmet (Earth humans up to spin), the culling sphere at the hip
function skinPerson(r,J,kp){
  const g=SKF.cur;if(!g)return;
  skinDrive(r.rec,J,null,SKQ.gw.multiplyMatrices(T3.world.matrix,r.g.matrix));
  const hm=!!(kp&&r.hm&&g.earth&&M&&M.bowlerType==='spin');
  r.sk.geometry=r.bowler||hm?g.nocap:g.cap;
  r.wk.visible=!!kp;if(r.hm)r.hm.visible=hm;
  r.sk.boundingSphere.center.set(J.hip[0],J.hip[1],J.hip[2]);
}
skinLoad();
if(location.hash==='#test')Object.assign(window.__r,{
  skin:()=>({on:SKN.on,err:SKN.err,batter:{on:SKN.on,err:SKN.err},fielder:{on:SKF.on,err:SKF.err}}),
  // a person's rig (-1: the bowler), the fielder skin state and three itself, for debugging in the lab
  rig:i=>i<0?G3.bowler:G3.fielders[i],skf:()=>SKF,SKB,T:THREE,vecs:J=>skinVecs(J),
  // skeleton joints vs the pose's joints (m), and the lowest shoe point vs the pose's sole height
  skinErr:()=>{if(!SKN.on)return null;const J=BJ,v=new THREE.Vector3(),inv=new THREE.Matrix4();SKN.root.updateMatrixWorld(true);inv.copy(SKN.root.matrixWorld).invert();
    const at=(n,p)=>{SKN.b[SKB.indexOf(n)].getWorldPosition(v).applyMatrix4(inv);return Math.hypot(v.x-p[0],v.y-p[1],v.z-p[2]);};
    const shoe=n=>{let y=9;SKN.root.getObjectByName(n).traverse(o=>{if(!o.isMesh)return;const P=o.geometry.attributes.position;
      for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);y=Math.min(y,v.y);}});return y;};
    return {hand:[at('hand_L',J.hd[0]),at('hand_R',J.hd[1])],elbow:[at('forearm_L',J.e[0]),at('forearm_R',J.e[1])],
      knee:[at('shin_L',J.kn[0]),at('shin_R',J.kn[1])],ankle:[at('foot_L',J.an[0]),at('foot_R',J.an[1])],
      sole:[shoe('shoe_L')-J.sole[0][1],shoe('shoe_R')-J.sole[1][1]],lift:[J.sole[0][1],J.sole[1][1]]};},
  // ball on the blade at the shown frame: offset from the face (along the face normal, from the blade axis), along and across
  contact:()=>{const b=G3.ball.matrix.elements,e=G3.bat.blade.matrix.elements,r=[b[12]-e[12],b[13]-e[13],b[14]-e[14]],c=k=>{const x=[e[k],e[k+1],e[k+2]],l=Math.hypot(...x);return V3.dot(r,x)/l;};
    return {n:c(8),u:c(4)+.29,w:c(0)};},
  pose:()=>Array.from(LV.pose||[]),
  // drive vectors and heads of the current pose for tools/blender (rig.pose_armature): {root, bones: {name: {a, r, p}}, pins}
  drive:()=>{const [A,R,P]=skinVecs(BJ),o={root:BJ.hip.slice(),bones:{},pins:{}};SKB.forEach((n,i)=>{o.bones[n]={a:A[i],r:R[i],p:P[i][1].slice()};o.pins[n]=P[i][1].slice();});return o;}});
