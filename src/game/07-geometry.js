/* ---------- 3D geometry: unit shapes and people parts as raw {P,N,T,I} arrays, turned into three BufferGeometry by geo() ---------- */
const GB={
  cyl(seg){const P=[],N=[],T=[],I=[];
    for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,c=Math.cos(a),s=Math.sin(a);P.push(c,-.5,s,c,.5,s);N.push(c,0,s,c,0,s);T.push(i/seg,1,i/seg,0);}
    for(let i=0;i<seg;i++){const b=i*2;I.push(b,b+1,b+2,b+1,b+3,b+2);}
    for(const y of [-.5,.5]){const c0=P.length/3;P.push(0,y,0);N.push(0,Math.sign(y),0);T.push(.5,.5);
      for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2;P.push(Math.cos(a),y,Math.sin(a));N.push(0,Math.sign(y),0);T.push(.5,.5);}
      for(let i=0;i<seg;i++)I.push(c0,c0+1+i,c0+2+i);}
    return {P,N,T,I};},
  sph(la,lo){const P=[],N=[],T=[],I=[];
    for(let i=0;i<=la;i++){const th=i/la*Math.PI,st=Math.sin(th),ct=Math.cos(th);
      for(let j=0;j<=lo;j++){const ph=j/lo*Math.PI*2,x=st*Math.cos(ph),z=st*Math.sin(ph);P.push(x,ct,z);N.push(x,ct,z);T.push(j/lo,i/la);}}
    for(let i=0;i<la;i++)for(let j=0;j<lo;j++){const a=i*(lo+1)+j,b=a+lo+1;I.push(a,b,a+1,b,b+1,a+1);}
    return {P,N,T,I};},
  disk(seg){const P=[0,0,0],N=[0,1,0],T=[.5,.5],I=[];
    for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,x=Math.cos(a),z=Math.sin(a);P.push(x,0,z);N.push(0,1,0);T.push(x*.5+.5,z*.5+.5);}
    for(let i=0;i<seg;i++)I.push(0,1+i,2+i);return {P,N,T,I};},
  plane(){return {P:[-.5,0,-.5,.5,0,-.5,.5,0,.5,-.5,0,.5],N:[0,1,0,0,1,0,0,1,0,0,1,0],T:[0,0,1,0,1,1,0,1],I:[0,1,2,0,2,3]};},
  ann(ri,ro,seg,dash){const P=[],N=[],T=[],I=[];
    for(let i=0;i<seg;i++){if(dash&&i%2)continue;const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2,b=P.length/3;
      for(const [r,a] of [[ri,a0],[ro,a0],[ro,a1],[ri,a1]]){P.push(Math.cos(a)*r,0,Math.sin(a)*r);N.push(0,1,0);T.push(0,0);}
      I.push(b,b+1,b+2,b,b+2,b+3);}
    return {P,N,T,I};},
  bowl(rb,rt,h,seg,rep){const P=[],N=[],T=[],I=[];
    for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
      P.push(c*rb,0,s*rb,c*rt,h,s*rt);N.push(-c,.3,-s,-c,.3,-s);T.push(i/seg*rep,1,i/seg*rep,0);}
    for(let i=0;i<seg;i++){const b=i*2;I.push(b,b+1,b+2,b+1,b+3,b+2);}
    return {P,N,T,I};},
  // grid over rows vs (0..1) x seg around; fn(v,a)->[x,y,z]; smooth normals from fn's partial derivatives, flipped to point away from the ring centre
  surf(vs,seg,fn){const P=[],N=[],T=[],I=[],e=1e-4,c=v=>Math.min(1-1e-3,Math.max(1e-3,v)),D=(p,q)=>[p[0]-q[0],p[1]-q[1],p[2]-q[2]];
    for(const v of vs)for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,p=fn(v,a),u=D(fn(c(v),a+e),fn(c(v),a-e)),w=D(fn(Math.min(1,v+e),a),fn(Math.max(0,v-e),a));
      const n=[w[1]*u[2]-w[2]*u[1],w[2]*u[0]-w[0]*u[2],w[0]*u[1]-w[1]*u[0]],m=[0,1,2,3,4,5].map(k=>fn(c(v),k*Math.PI/3)).reduce((s,q)=>[s[0]+q[0]/6,s[1]+q[1]/6,s[2]+q[2]/6],[0,0,0]);
      let l=Math.hypot(n[0],n[1],n[2])||1;if((p[0]-m[0])*n[0]+(p[1]-m[1])*n[1]+(p[2]-m[2])*n[2]<0)l=-l;
      P.push(p[0],p[1],p[2]);N.push(n[0]/l,n[1]/l,n[2]/l);T.push(i/seg,v);}
    for(let r=0;r<vs.length-1;r++)for(let i=0;i<seg;i++){const a=r*(seg+1)+i,b=a+seg+1;I.push(a,b,a+1,b,b+1,a+1);}
    return {P,N,T,I};},
  join(...gs){const o={P:[],N:[],T:[],I:[]};for(const g of gs){const b=o.P.length/3;o.P.push(...g.P);o.N.push(...g.N);o.T.push(...g.T);for(const i of g.I)o.I.push(i+b);}return o;}
};
// Loads raw arrays into a BufferGeometry (reused per planet). The builders above ignore winding, so each triangle is
// turned to face along its vertex normals: three's double-sided shading flips the normals of back-facing triangles.
function fillGeo(g,r){
  const P=r.P,N=r.N,I=r.I.slice();
  for(let k=0;k<I.length;k+=3){const a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];
    if((uy*vz-uz*vy)*(N[a]+N[b]+N[c])+(uz*vx-ux*vz)*(N[a+1]+N[b+1]+N[c+1])+(ux*vy-uy*vx)*(N[a+2]+N[b+2]+N[c+2])<0){const t=I[k+1];I[k+1]=I[k+2];I[k+2]=t;}}
  g.dispose();
  g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(r.T,2));g.setIndex(I);g.computeBoundingSphere();
  return g;}
const geo=r=>fillGeo(new THREE.BufferGeometry(),r);

/* --- people: smooth procedural parts. Limb parts are centred on the origin along y, between their joint centres --- */
const H2=Math.PI/2,lin=(n,a,b)=>Array.from({length:n+1},(_,i)=>a+(b-a)*i/n);
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
