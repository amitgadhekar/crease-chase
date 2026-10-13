/* ---------- fielder/bowler species, one per planet (the batter stays human). Each species is a parameter set on the shared
   people rig: bone lengths and radii (limb geometry is built once per species, so IK never stretches a bone), torso scale,
   gait (stride, lift, cadence, low-gravity float), a delivery bound, and its own head, hands and feet. Skin, eyes and glowing
   features share one material per species: a 128px atlas (pattern region u<.75, four flat swatches in the last column) as
   colour, emissive and roughness maps, so features cost no extra draw calls. ---------- */
// swatches: 0 accent, 1 eye/dark, 2 glow, 3 accent 2; each [colour, emissive, roughness]
const SPECIES={
  earth:{name:'Humans',th:.465,sh:.43,lr:[.078,.066,.064,.05],tor:.54,tw:1,td:1,ua:.31,fa:.29,ar:[.052,.044,.038],hd:.05,hr:[.04,.05,.03],
    st:1,lf:1,fq:1,fl:0,jp:.12,legs:'pants',feet:'shoe',fs:[1,1,1],skin:'#b07a55',rough:.6,sleeve:1,
    sw:[[PLANETS.earth.vis.kit.shirt,'#000',.88],['#1a1410','#000',.3],['#000','#000',1],['#000','#000',1]],
    head:()=>GB.join(spP(ellG([0,.06,0],[.046,.085,.046],8,4)),spP(ellG([0,.18,0],[.098,.115,.105],14,8)),spP(ellG([0,.165,.1],[.016,.024,.02],6,3))),
    ex:()=>GB.join(ellG([0,.2,-.005],[.108,.1,.114],14,5,0,-.15),ellG([0,.205,.105],[.085,.009,.075],12,3,.2)),exM:'cap'},
  moon:{name:'Selenites',th:.6,sh:.58,lr:[.06,.05,.048,.036],tor:.6,tw:.8,td:.78,ua:.39,fa:.38,ar:[.038,.032,.026],hd:.06,hr:[.026,.07,.016],
    st:1.3,lf:1.4,fq:.62,fl:.13,jp:.06,legs:'pants',feet:'shoe',fs:[.8,.9,1.2],skin:'#c3cad5',rough:.5,em:'#2a3a52',
    pat:(g,e,w,h,r)=>{for(let i=0;i<70;i++){const x=r()*w,y=r()*h,s=2+r()*6;g.fillStyle=r()<.5?'rgba(255,255,255,.12)':'rgba(70,80,100,.1)';g.beginPath();g.arc(x,y,s,0,7);g.fill();}},
    sw:[['#9fb3cc','#000',.5],['#050608','#000',.12],['#d8f0ff','#6ab4ff',.4],['#000','#000',1]],
    head:()=>GB.join(spP(ellG([0,.07,0],[.034,.11,.034],8,4)),spP(ellG([0,.25,-.01],[.082,.13,.098],14,8)),spP(ellG([0,.185,.035],[.05,.075,.06],10,6)),
      ...[-1,1].map(s=>spS(spT(ellG([0,0,0],[.03,.047,.014],10,5),[s*.041,.24,.077],[0,s*.5,-s*.42]),1)),spS(ellG([0,.365,-.035],[.011,.04,.085],8,5,-.25),2))},
  mercury:{name:'Scorchlings',th:.37,sh:.34,lr:[.09,.076,.072,.058],tor:.48,tw:1.2,td:1.15,ua:.29,fa:.27,ar:[.062,.054,.048],hd:.05,hr:[.05,.05,.04],
    st:.9,lf:.85,fq:1.15,fl:0,jp:.24,legs:'pants',feet:'shoe',fs:[1.15,1,1.05],skin:'#2b2624',rough:.85,
    pat:(g,e,w,h,r)=>{for(let i=0;i<40;i++){g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.arc(r()*w,r()*h,3+r()*8,0,7);g.fill();}
      for(let i=0;i<16;i++){let x=r()*w,y=r()*h;const pts=[[x,y]];for(let k=0;k<5;k++){x+=(r()-.5)*22;y+=(r()-.5)*22;pts.push([x,y]);}
        for(const [c,s,lw] of [[g,'#ff8a2e',1.5],[e,'#ff5a0a',2.2]]){c.strokeStyle=s;c.lineWidth=lw;c.lineJoin='round';c.beginPath();pts.forEach((p,j)=>j?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();}}},
    sw:[['#4a2418','#8a2c04',.6],['#0b0909','#000',.25],['#ffc070','#ff8a1a',.4],['#000','#000',1]],
    head:()=>GB.join(spP(ellG([0,.04,0],[.064,.07,.062],8,4)),spP(ellG([0,.15,0],[.1,.105,.1],14,8)),spP(ellG([0,.1,.035],[.086,.056,.076],10,5)),
      spS(ellG([0,.168,.07],[.093,.028,.048],14,5),1),...[-1,1].map(s=>spS(spT(ellG([0,0,0],[.032,.0065,.01],10,4),[s*.04,.17,.113],[0,s*.38,-s*.15]),2)),
      spS(ellG([0,.25,-.035],[.013,.08,.105],8,6,-.35),0))},
  venus:{name:'Cloudwaders',th:.45,sh:.42,lr:[.096,.076,.072,.058],tor:.56,tw:1.3,td:1.35,ua:.3,fa:.28,ar:[.064,.056,.05],hd:.05,hr:[.05,.05,.04],
    st:.85,lf:.8,fq:.95,fl:0,jp:.14,legs:'pants',feet:'shoe',fs:[1.3,1,1.05],hu:.2,nod:-.15,skin:'#c5d48a',rough:.7,
    pat:(g,e,w,h,r)=>{for(let i=0;i<30;i++){g.fillStyle='rgba(255,255,220,.13)';g.beginPath();g.arc(r()*w,r()*h,4+r()*9,0,7);g.fill();}
      for(let i=0;i<60;i++){g.fillStyle='rgba(110,130,60,.35)';g.beginPath();g.arc(r()*w,r()*h,.8+r()*1.4,0,7);g.fill();}},
    sw:[['#e57a8c','#3a0a14',.6],['#14120c','#000',.2],['#000','#000',1],['#8a9a5a','#000',.7]],
    head:()=>GB.join(spP(ellG([0,.05,0],[.072,.08,.07],8,4)),spP(ellG([0,.15,.015],[.118,.1,.108],14,8)),spP(ellG([0,.115,.07],[.082,.05,.06],10,5)),
      ...[-1,1].flatMap(s=>[spS(ellG([s*.05,.172,.106],[.015,.017,.011],6,4),1),
        ...[-.45,.1,.6].map((a,k)=>spS(spSeg([s*.095,.13+.02*k,-.03],[s*(.095+.13*Math.cos(a)),.13+.02*k+.13*Math.sin(a),-.09],.024,.009,8,3),0)),
        ...[0,1,2].map(k=>spS(spT(ellG([0,0,0],[.004,.028,.007],5,3),[s*.07,.035+.022*k,-.005],[0,0,s*.2]),3))]))},
  mars:{name:'Rustkin',th:.56,sh:.54,lr:[.066,.052,.05,.038],tor:.56,tw:.88,td:.85,ua:.42,fa:.44,ar:[.042,.035,.03],hd:.065,hr:[.032,.08,.02],
    st:1.2,lf:1.1,fq:.85,fl:.03,jp:.06,legs:'pants',feet:'shoe',fs:[.95,1,1.15],skin:'#a5462a',rough:.75,
    pat:(g,e,w,h,r)=>{for(let i=0;i<90;i++){g.fillStyle=r()<.6?'rgba(90,30,12,.35)':'rgba(220,120,80,.25)';g.beginPath();g.arc(r()*w,r()*h,.8+r()*2,0,7);g.fill();}},
    sw:[['#caa257','#000',.3],['#0e0907','#000',.1],['#ffbf73','#9a4a0a',.15],['#3b2419','#000',.7]],
    head:()=>GB.join(spP(ellG([0,.07,0],[.04,.1,.04],8,4)),spP(ellG([0,.21,-.005],[.088,.115,.1],14,8)),spP(ellG([0,.16,.03],[.06,.05,.062],10,5)),spS(ellG([0,.142,.088],[.024,.005,.008],6,3),1),
      spS(ellG([0,.222,0],[.094,.02,.105],14,4),3),
      ...[-1,1].flatMap(s=>[spS(spT(ellG([0,0,0],[.043,.041,.018],12,5),[s*.042,.222,.088],[0,s*.42,0]),0),spS(spT(ellG([0,0,0],[.035,.033,.016],12,5),[s*.043,.222,.097],[0,s*.42,0]),2),
        spS(spT(ellG([0,0,0],[.016,.021,.006],8,4),[s*.047,.222,.111],[0,s*.42,0]),1),
        spS(spSeg([s*.035,.31,-.02],[s*.09,.46,-.07],.009,.006,6,2),3),spS(ellG([s*.092,.465,-.072],[.019,.019,.019],8,5),2)]))},
  jupiter:{name:'Gravitons',th:.37,sh:.33,an:.09,kn:.955,lr:[.112,.098,.096,.076],tor:.52,tw:1.42,td:1.3,ua:.32,fa:.32,ar:[.078,.066,.06],hd:.05,hr:[.06,.056,.05],
    st:.55,lf:.55,fq:1.6,fl:0,jp:.34,legs:'shorts',feet:'shoe',fs:[1.4,1.1,1.1],skin:'#e2c296',rough:.7,
    pat:(g,e,w,h,r)=>{const C=['#e8cca2','#c88b5a','#f2ddb8','#9a5a35','#dcab78','#b77446'];let y=0,k=0;
      while(y<h){const t=5+r()*12,ph=r()*6;g.fillStyle=C[k++%C.length];g.beginPath();g.moveTo(0,y);for(let x=0;x<=w;x+=4)g.lineTo(x,y+Math.sin(x*.13+ph)*1.5);g.lineTo(w,y+t+2);g.lineTo(0,y+t+2);g.fill();y+=t;}},
    sw:[['#e9cfa6','#000',.7],['#120a06','#000',.3],['#ffd27a','#ff9a2a',.3],['#b5482a','#000',.6]],
    head:()=>GB.join(spP(ellG([0,.085,.03],[.118,.12,.112],14,8)),spP(ellG([0,.11,.1],[.1,.024,.04],12,4)),
      spS(spT(ellG([0,0,0],[.032,.02,.01],10,5),[-.066,.15,.098],[-.5,-.55,.1]),3),
      ...[-1,1].map(s=>spS(ellG([s*.043,.088,.135],[.014,.01,.008],6,4),2)))},
  saturn:{name:'Ringlings',th:.52,sh:.5,lr:[.068,.056,.052,.04],tor:.56,tw:.86,td:.85,ua:.35,fa:.34,ar:[.044,.037,.032],hd:.055,hr:[.034,.058,.024],
    st:1.1,lf:1.05,fq:.92,fl:0,jp:.1,legs:'pants',feet:'shoe',fs:[.9,1,1.05],skin:'#e2c78a',rough:.45,
    pat:(g,e,w,h,r)=>{for(let y=0;y<h;y+=3){g.fillStyle=`rgba(255,250,220,${.05+r()*.08})`;g.fillRect(0,y,w,1);}},
    sw:[['#000','#000',1],['#1c150a','#000',.12],['#fff4cc','#ffcf6a',.3],['#000','#000',1]],
    head:()=>GB.join(spP(ellG([0,.07,0],[.036,.1,.036],8,4)),spP(ellG([0,.2,0],[.082,.11,.094],14,8)),spP(ellG([0,.152,.025],[.05,.05,.05],10,5)),
      ...[-1,1].map(s=>spS(spT(ellG([0,0,0],[.025,.011,.01],8,4),[s*.036,.2,.083],[0,s*.42,-s*.22]),1)),spS(ellG([0,.255,.088],[.011,.011,.008],6,4),2)),
    ex:()=>GB.join(arcG([0,0,0],.19,[1,0,0],[0,0,1],0,2*Math.PI,.007,48),...[0,1,2,3,4,5].map(k=>ellG([.19*Math.cos(k*Math.PI/3),0,.19*Math.sin(k*Math.PI/3)],[.016,.016,.016],8,5))),
    exM:'ring',ring:[.25,.4]},
  neptune:{name:'Tidefolk',th:.5,sh:.47,lr:[.076,.062,.058,.045],tor:.56,tw:1,td:.95,ua:.34,fa:.33,ar:[.048,.04,.036],hd:.06,hr:[.056,.07,.015],
    st:1.05,lf:1,fq:1,fl:0,jp:.12,legs:'shorts',feet:'skin',skin:'#1a6890',rough:.35,
    pat:(g,e,w,h,r)=>{for(let i=0;i<40;i++){g.fillStyle='rgba(10,30,80,.25)';g.beginPath();g.arc(r()*w,r()*h,3+r()*7,0,7);g.fill();}
      for(let i=0;i<26;i++){const x=r()*w,y=r()*h,s=1.2+r()*1.3;g.fillStyle='#8ff4ff';e.fillStyle='#38d8ff';for(const c of [g,e]){c.beginPath();c.arc(x,y,s,0,7);c.fill();}}},
    sw:[['#4fa3e0','#0a3050',.35],['#03060c','#000',.1],['#a6fbff','#3fe6ff',.3],['#000','#000',1]],
    head:()=>GB.join(spP(ellG([0,.06,0],[.05,.09,.05],8,4)),spP(ellG([0,.18,.01],[.09,.105,.112],14,8)),
      ...[-1,1].flatMap(s=>[spS(spT(ellG([0,0,0],[.022,.025,.012],8,5),[s*.052,.195,.09],[0,s*.55,0]),1),
        spS(spT(ellG([0,0,0],[.008,.065,.05],8,5),[s*.092,.2,-.015],[-.35,0,-s*.55]),0),
        ...[[.072,.15,.075],[.06,.255,.07],[.084,.12,.035]].map(p=>spS(ellG([s*p[0],p[1],p[2]],[.008,.008,.008],5,3),2))]),spS(ellG([0,.285,.04],[.009,.009,.009],5,3),2)),
    foot:()=>GB.join(spP(ellG([0,.022,.05],[.058,.024,.15],10,5)),spP(ellG([0,.05,-.01],[.045,.04,.05],8,4)))}
};
// geometry helpers: pattern UVs, a flat swatch, scale/rotate (z, then x, then y)/translate, a tapered capsule from a to b
function spP(g){for(let i=0;i<g.T.length;i+=2)g.T[i]*=.75;return g;}
function spS(g,k){for(let i=0;i<g.T.length;i+=2){g.T[i]=.875;g.T[i+1]=(k+.5)/4;}return g;}
function spT(g,o,r=[0,0,0],s=[1,1,1]){
  const C=r.map(Math.cos),S=r.map(Math.sin),rot=(x,y,z)=>{let t=x*C[2]-y*S[2];y=x*S[2]+y*C[2];x=t;t=y*C[0]-z*S[0];z=y*S[0]+z*C[0];y=t;t=x*C[1]+z*S[1];z=-x*S[1]+z*C[1];return [t,y,z];},P=g.P,N=g.N;
  for(let i=0;i<P.length;i+=3){const p=rot(P[i]*s[0],P[i+1]*s[1],P[i+2]*s[2]),n=V3.norm(rot(N[i]/s[0],N[i+1]/s[1],N[i+2]/s[2]));
    for(let j=0;j<3;j++){P[i+j]=p[j]+o[j];N[i+j]=n[j];}}
  return g;}
function spSeg(a,b,r1,r2,seg,n){const d=V3.sub(b,a),L=Math.hypot(d[0],d[1],d[2]),Y=V3.sc(d,1/L),X=V3.norm(V3.cross(Y,Math.abs(Y[2])<.9?[0,0,1]:[1,0,0])),Z=V3.cross(X,Y),g=capG(r1,r2,L,seg,n),m=V3.lerp(a,b,.5);
  for(let i=0;i<g.P.length;i+=3)for(const A of [g.P,g.N]){const x=A[i],y=A[i+1],z=A[i+2];for(let j=0;j<3;j++)A[i+j]=X[j]*x+Y[j]*y+Z[j]*z+(A===g.P?m[j]:0);}
  return g;}
// atlas: colour, emissive and roughness canvases (seeded, identical every run)
function spAtlas(P,key){
  const n=128,w=96,mk=()=>{const c=document.createElement('canvas');c.width=c.height=n;return c;},cc=mk(),ce=mk(),cr=mk(),g=cc.getContext('2d'),e=ce.getContext('2d'),q=cr.getContext('2d'),rv=Math.round(255*P.rough);
  g.fillStyle=P.skin;g.fillRect(0,0,w,n);e.fillStyle=P.em||'#000';e.fillRect(0,0,w,n);q.fillStyle=`rgb(${rv},${rv},${rv})`;q.fillRect(0,0,w,n);
  if(P.pat)P.pat(g,e,w,n,prng(key.length*97+7));
  P.sw.forEach(([c,em,ro],k)=>{const v=Math.round(255*ro);g.fillStyle=c;g.fillRect(w,k*32,32,32);e.fillStyle=em;e.fillRect(w,k*32,32,32);q.fillStyle=`rgb(${v},${v},${v})`;q.fillRect(w,k*32,32,32);});
  return {map:canvasTex(cc),em:canvasTex(ce),rough:canvasTex(cr,0,true)};
}
const SPG={};
function spBuild(key){
  const P=SPECIES[key];if(SPG[key])return SPG[key];
  P.an=P.an||.07;P.kn=P.kn||.985;P.hu=P.hu||0;P.nod=P.nod||0;
  const hand=ellG([0,P.fa/2+P.hd,0],P.hr,10,5);
  return SPG[key]={P,thigh:geo(spP(capG(P.lr[0],P.lr[1],P.th,12,3))),shin:geo(spP(capG(P.lr[2],P.lr[3],P.sh,12,3))),
    uarm:geo(spP(capG(P.ar[0],P.ar[1],P.ua,10,3))),farm:geo(GB.join((P.sleeve?g=>spS(g,0):spP)(capG(P.ar[1]*.95,P.ar[2],P.fa,10,3)),spP(hand))),
    foot:geo(P.foot?P.foot():spT(shoeG(12,6),[0,0,0],[0,0,0],P.fs)),head:geo(P.head()),ex:P.ex?geo(P.ex()):null,tex:spAtlas(P,key)};
}
