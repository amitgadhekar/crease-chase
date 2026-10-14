/* ---------- skinned batter: a Blender-made model (tools/blender/batter.py -> src/models/batter.glb, embedded as base64
   in MODEL_DATA) on the rig.py skeleton, driven every frame by the procedural pose. Each bone's rotation maps its rest
   aim/ref vectors (glTF extras, from rig.py) onto the same vectors taken from the pose's joints (batJoints), so the
   runtime doesn't depend on Blender's bone axes. Bone lengths equal the pose's limb lengths, so joints land on the pose's
   joints (elbows move a little with the clavicle shrug); only the pelvis, hands and feet get positions. Helmet and shoes are rigid
   on a bone; gloves are skinned to hand + forearm, pads to shin + thigh.
   The bat stays the procedural one (batsman3D), so contact targeting is unchanged. If the model can't be loaded the
   procedural batter stays. ---------- */
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone as skClone} from 'three/examples/jsm/utils/SkeletonUtils.js';
const SKN={on:false,root:null,b:[],qL:[],qP:[],par:[],err:null};
const SKB=['pelvis','spine','chest','neck','head','clavicle_L','upperarm_L','forearm_L','hand_L','clavicle_R','upperarm_R','forearm_R','hand_R',
  'thigh_L','shin_L','foot_L','thigh_R','shin_R','foot_R'];
const SKQ={m:new THREE.Matrix4(),a:new THREE.Vector3(),r:new THREE.Vector3(),c:new THREE.Vector3(),q:new THREE.Quaternion(),w:SKB.map(()=>new THREE.Quaternion())};
// rotation taking +x to a and +y to r made perpendicular to a (a fallback axis if r is parallel to a)
function skBasis(a,r,q){
  const A=SKQ.a.set(a[0],a[1],a[2]).normalize(),R=SKQ.r.set(r[0],r[1],r[2]);R.addScaledVector(A,-R.dot(A));
  if(R.lengthSq()<1e-8){R.set(A.y,-A.x,0);if(R.lengthSq()<1e-8)R.set(1,0,0);}
  R.normalize();return q.setFromRotationMatrix(SKQ.m.makeBasis(A,R,SKQ.c.crossVectors(A,R)));}
function skinInit(gl){
  const root=gl.scene,k=KIT.you,vc={vertexColors:true},M={skin:kit(SKIN,{roughness:.6,...vc}),shirt:kit(k.shirt,{roughness:.88,...vc}),
    trim:kit(k.trim,{roughness:.88,...vc}),pants:kit(k.pants,{roughness:.9,...vc}),helmet:kit(k.helmet,{roughness:.22,metalness:.1,...vc}),
    grille:kit(GRILLE,{roughness:.35,metalness:.7,...vc}),pad:kit(PAD,{roughness:.45,...vc}),glove:kit(GLOVE,{roughness:.55,...vc}),shoe:kit([1,1,1],{roughness:.6,...vc})};
  root.updateMatrixWorld(true);
  const bones={},rq=new THREE.Quaternion(),v=new THREE.Vector3(),u=new THREE.Vector3();
  root.traverse(o=>{if(o.isBone)bones[o.name]=o;
    if(o.isMesh){const m=M[o.material.name];if(!m)throw new Error('material '+o.material.name);o.material.dispose();o.material=m;o.castShadow=o.receiveShadow=true;o.frustumCulled=false;}});
  SKB.forEach((n,i)=>{const b=bones[n],x=b&&b.userData;if(!x||!x.aim||!x.ref)throw new Error('bone '+n);
    b.matrixWorld.decompose(v,rq,u);rq.invert();
    const la=v.fromArray(x.aim).applyQuaternion(rq).toArray(),lr=u.fromArray(x.ref).applyQuaternion(rq).toArray();
    SKN.b[i]=b;SKN.qL[i]=skBasis(la,lr,new THREE.Quaternion()).invert();SKN.par[i]=SKB.indexOf(b.parent.name);
    SKN.qP[i]=b.parent.getWorldQuaternion(new THREE.Quaternion());});
  for(const B of [G3.bat,G3.ns]){for(const p of ['shoe','thigh','pad','uarm','sleeve','farm','glove'])B[p].forEach(m=>m.visible=false);
    for(const p of ['pelvis','torso','neck','head','helmet','grille'])B[p].visible=false;}
  const r2=skClone(root);SKN.b2=SKB.map(n=>r2.getObjectByName(n));G3.ns.g.add(r2);
  G3.bat.g.add(root);SKN.root=root;SKN.on=true;
}
function skinLoad(){
  if(!glOK||typeof MODEL_DATA==='undefined'||!MODEL_DATA.batter)return;
  try{const s=atob(MODEL_DATA.batter),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);
    new GLTFLoader().parse(u.buffer,'',g=>{try{skinInit(g);}catch(e){SKN.err=String(e);}},e=>{SKN.err=String(e);});}
  catch(e){SKN.err=String(e);}
}
// drive vectors (aim, ref) per bone from the pose's joints, plus pins. Elbows and knees bend toward the IK pole made
// perpendicular to the limb line, as in ik(); the spine takes half the twist between hips and shoulders, the neck half
// between chest and face; shins and pads face the toe, hands turn with the bat and its face (GA, GF), forearms take half
// of the hand's twist (pronation). Clavicles follow the upper arm by 15% of
// its swing from rest (a shrug when the arms go up), so the arms are re-solved from the moved shoulders. A limb the pose
// stretches beyond its reach (the back leg in a long stride) stops short, so hands and feet are pinned to the pose's hand
// points and ankles: gloves stay on the handle and shoes on the ground (the stretch is inside the glove cuff or the pad).
function skinVecs(J){
  const prp=(v,l)=>V3.sub(v,V3.sc(l,V3.dot(v,l)/V3.dot(l,l))),A=[[0,-1,0],J.Y,J.Y,V3.sub(J.nt,J.sh),J.hv],
    R=[J.ha,V3.add(V3.norm(prp(J.ha,J.Y)),J.s),J.s,V3.add(J.n,J.face),J.face],P=[];
  for(let i=0;i<2;i++){const lat=V3.sc(J.s,i?-1:1),c=V3.add(J.sh,V3.sc(lat,.02)),u0=V3.add(V3.sc(J.Y,-Math.SQRT1_2),V3.sc(lat,Math.SQRT1_2)),
      ca=V3.norm(V3.add(lat,V3.sc(V3.sub(V3.norm(V3.sub(J.e[i],J.sp[i])),u0),.15))),sp=V3.add(c,V3.sc(ca,.17)),
      e=ik(sp,J.hd[i],.31,.3,J.ap[i]),sd=prp(J.ap[i],V3.sub(J.hd[i],sp)),f=V3.sub(J.hd[i],e),hr=V3.cross(J.gn[i],J.wa[i]),
      fr=V3.add(V3.norm(prp(sd,f)),V3.sub(V3.sc(sd,.01),V3.norm(prp(hr,f))));
    A.push(ca,V3.sub(e,sp),f,J.wa[i]);R.push(J.Y,sd,fr,hr);P.push([SKP[i],J.hd[i],e]);}
  for(let i=0;i<2;i++){const sd=prp(J.kp[i],V3.sub(J.an[i],J.hj[i]));
    A.push(V3.sub(J.kn[i],J.hj[i]),V3.sub(J.an[i],J.kn[i]),J.fw[i]);R.push(sd,J.t[i],[0,1,0]);P.push([SKP[2+i],J.an[i],J.kn[i]]);}
  return [A,R,P];}
// Each hand bone is turned so the glove's handle lies exactly on the bat axis at its grip point, with the back of the hand
// as batJoints sets it (GA, GF); the glove's forearm-skinned cuff absorbs the remaining wrist bend.
const SKP=['hand_L','hand_R','foot_L','foot_R'].map(n=>SKB.indexOf(n));
function skin3D(J,BB=SKN.b){
  const [A,R,P]=skinVecs(J),W=SKQ.w;
  for(let i=0;i<SKB.length;i++){
    skBasis(A[i],R[i],W[i]).multiply(SKN.qL[i]);
    const b=BB[i],p=SKN.par[i];b.quaternion.copy(p<0?SKN.qP[i]:W[p]).invert().multiply(W[i]);}
  BB[0].position.set(J.hip[0],J.hip[1],J.hip[2]);
  for(const [i,t,o] of P)BB[i].position.set(t[0]-o[0],t[1]-o[1],t[2]-o[2]).applyQuaternion(SKQ.q.copy(W[SKN.par[i]]).invert());
}
skinLoad();
if(location.hash==='#test')Object.assign(window.__r,{
  skin:()=>({on:SKN.on,err:SKN.err}),
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
  // drive vectors of the current pose for tools/blender (rig.pose_armature): {root, bones: {name: {a, r}}}
  drive:()=>{const [A,R,P]=skinVecs(BJ),o={root:BJ.hip.slice(),bones:{},pins:{}};SKB.forEach((n,i)=>{o.bones[n]={a:A[i],r:R[i]};});
    for(const [i,t] of P)o.pins[SKB[i]]=t.slice();return o;}});
