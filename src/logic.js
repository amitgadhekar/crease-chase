const CAM_Z=-9, CAM_Y=3.2, BATS_Z=1.05, CONTACT_Z=1.8, SWING_DELAY=0.075, STUMP_HALF=0.13, STUMP_H=0.72, D2R=Math.PI/180;
let G=9.8, BOUNDARY=65, WIND={x:0,z:0};
const ENV={air:1,swing:1,spin:1,bounce:1,pace:1,carry:1,acc:3.2,run:1};
const rnd=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function pick(items,weights){const s=weights.reduce((a,b)=>a+b,0);let r=Math.random()*s;for(let i=0;i<items.length;i++){r-=weights[i];if(r<=0)return items[i];}return items[items.length-1];}
const angDiff=(a,b)=>((a-b)%360+540)%360-180;
const normAng=a=>((a+180)%360+360)%360-180;


/* ---------- venues: physics + look ---------- */
const CROWD=['#e85d4a','#f2b134','#ffffff','#3d7dd8','#2ec27e','#f28fb6','#1f2937','#e9e2cf','#12606e'];
const PLANETS={
 earth:{name:'Earth',team:'Earth XI',g:9.8,air:1,swing:1,spin:1,bounce:1,pace:1,boundary:65,wind:0,ai:1,
  blurb:'Home conditions: normal gravity and a little swing. The baseline.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#8fd0ff,#2b78c2 55%,#2d6b3c)',sky:['#5d9ccf','#cfe5f2'],ground:['#3c8a45','#2f7a39'],stripe:.055,
   pitch:['#e3cf9c','#cdb27a'],crease:'rgba(255,255,255,.92)',rope:'#f4efe1',standsH:14,stands:'#34424f',roof:'#d8d3c3',crowd:CROWD,
   boards:['#1d3a2b','#efe8d2','#f2b134'],ads:['Play straight','Crease Chase'],bodies:[],kit:{shirt:'#7a1f2b',pants:'#f1ece0'}}},
 moon:{name:'Moon',team:'Lunar XI',g:1.62,air:1.1,swing:0,spin:1.25,bounce:.95,pace:1,boundary:95,wind:0,ai:1.34,
  blurb:'One-sixth gravity and no air. Lofted shots fly for ages, so mistimed ones hang up to be caught. No swing at all.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#e4e4df,#8d8d88 60%,#5c5c58)',sky:['#000004','#0d0f1a'],stars:1,ground:['#9a9a96','#74736d'],stripe:.03,
   pitch:['#d6d3ca','#b2ada1'],crease:'rgba(255,255,255,.95)',rope:'#e6e9ef',standsH:8,stands:'#22262e',roof:'#aab4c0',
   crowd:['#e9edf2','#c4ccd6','#8fa3b8','#f2b134','#ffffff','#5d6b7a'],boards:['#14181f','#d9e2ec','#7fc8ff'],ads:['One-sixth gravity','Mind the craters'],
   bodies:[{t:'earth',x:.5,y:.5,r:.075}],kit:{shirt:'#dfe3e8',pants:'#9aa4b0',skin:'#c8d2dc'}}},
 mercury:{name:'Mercury',team:'Sunside XI',g:3.7,air:1.1,swing:0,spin:1.25,bounce:1.05,pace:1,boundary:82,wind:0,ai:1.27,
  blurb:'Low gravity, no air and a giant sun. Spinners grip the scorched pitch.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#cfc3b8,#857a70 60%,#57504a)',sky:['#000000','#1a110a'],stars:.6,ground:['#7c7068','#5b524b'],stripe:.03,
   pitch:['#c4b59f','#9e8f7b'],crease:'rgba(255,255,255,.9)',rope:'#efe6da',standsH:7,stands:'#2b2522',roof:'#a99683',
   crowd:['#ffd9a8','#ffffff','#c96f3c','#7f8c99','#f2b134'],boards:['#1c1714','#ffe2b8','#ff9d3d'],ads:['Sunside Ground','Bring sunscreen'],
   bodies:[{t:'sun',x:.2,y:.6,r:.13,c:'#fff3c4'}],haze:{c:'255,214,150',a:.13},kit:{shirt:'#c25b1f',pants:'#efe2d0'}}},
 venus:{name:'Venus',team:'Cloud Deck XI',g:8.87,air:.72,swing:2.4,spin:.9,bounce:.85,pace:.88,boundary:54,wind:2,ai:0.92,
  blurb:'Soupy air slows the ball and makes it swing wildly. A small ground, but sixes are hard to clear.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#fbe6a6,#d9a441 60%,#9a6a1d)',sky:['#c98d2e','#f3d491'],clouds:1,ground:['#8a6a2c','#6a501f'],stripe:.03,
   pitch:['#c99d58','#a98140'],crease:'rgba(255,248,225,.9)',rope:'#fbe8b8',standsH:11,stands:'#4b3818',roof:'#e6c27a',
   crowd:['#ffd36b','#e8743b','#fff2c9','#b5651d','#ffffff'],boards:['#3b2a0e','#fde7b0','#ffcf5c'],ads:['Thick air, big swing','Cloud Deck Oval'],
   bodies:[],haze:{c:'240,196,92',a:.32},particles:{color:'#fff0b3',alpha:.3,size:1.6,vx:.01,vy:-.025,n:40},kit:{shirt:'#6b2f8a',pants:'#f3e3c0'}}},
 mars:{name:'Mars',team:'Red Dust XI',g:3.71,air:1.05,swing:.35,spin:1.1,bounce:1.12,pace:1,boundary:82,wind:7,ai:1.24,
  blurb:'A third of Earth\u2019s gravity on a hard, bouncy deck. Big carry and dusty gusts.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#f2a272,#c1502a 60%,#7a2c14)',sky:['#b9784e','#e8b98c'],ground:['#a4532d','#7c3b1f'],stripe:.04,
   pitch:['#d9a273','#ba7f53'],crease:'rgba(255,240,225,.9)',rope:'#f6dcc4',standsH:10,stands:'#3e231a',roof:'#c99872',
   crowd:['#f2c49b','#e8743b','#ffffff','#8a3b21','#f2b134'],boards:['#3a1a10','#f6dcc4','#ffb07a'],ads:['Red Dust Arena','Thin air, long carry'],
   bodies:[{t:'sun',x:.25,y:.45,r:.028,c:'#f7efe0'},{t:'disc',x:.62,y:.3,r:.009,c1:'#a8978a',c2:'#5e5248'},{t:'disc',x:.5,y:.62,r:.006,c1:'#a39282',c2:'#5e5248'}],
   haze:{c:'232,150,96',a:.15},particles:{color:'#efae7c',alpha:.55,size:2,vx:.07,vy:.012,n:70},kit:{shirt:'#2d4b7a',pants:'#e7d8c9'}}},
 jupiter:{name:'Jupiter',team:'Storm XI',g:24.79,air:1,swing:1.2,spin:.9,bounce:.72,pace:1,boundary:50,wind:13,ai:0.81,
  blurb:'Two and a half times Earth\u2019s gravity. The ball dips hard and keeps low, and storms gust across a small floating deck.',
  vis:{sw:'repeating-linear-gradient(170deg,#ecc89c 0 4px,#b5693c 4px 7px,#f3dcb6 7px 10px)',sky:['#a8592e','#ecc596'],bands:['#c47a46','#f0d3a8','#9e5a34','#e8b98a'],
   ground:['#5d6772','#454d57'],stripe:.06,pitch:['#d8cbb0','#b8aa8d'],crease:'rgba(255,255,255,.9)',rope:'#ffe3c2',standsH:6,stands:'#2d3138',roof:'#8e98a3',
   crowd:['#ffb37a','#ffffff','#e45d3a','#ffd36b','#9aa6b2'],boards:['#262a30','#ffe3c2','#ff8f5a'],ads:['Storm Deck','Heavy gravity, low bounce'],
   bodies:[{t:'disc',x:.7,y:.35,r:.02,c1:'#f2e28a',c2:'#b9952f'},{t:'disc',x:.45,y:.62,r:.012,c1:'#d9d2c4',c2:'#8b8072'}],
   lightning:1,haze:{c:'214,140,90',a:.15},kit:{shirt:'#b3421f',pants:'#f2e6d6'}}},
 saturn:{name:'Saturn',team:'Ringside XI',g:10.44,air:.85,swing:1.4,spin:1,bounce:.95,pace:.97,boundary:62,wind:10,ai:0.87,
  blurb:'Close to Earth gravity under the rings, with steady crosswinds that push lofted shots off line.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#f6e4b8,#c9a66a 60%,#8a6a3a)',sky:['#b89a5c','#f0e2bd'],rings:1,ground:['#5f6f66','#47544c'],stripe:.05,
   pitch:['#e2d6b8','#c3b694'],crease:'rgba(255,255,255,.9)',rope:'#fff4da',standsH:6,stands:'#30352f',roof:'#b9b29a',
   crowd:['#f6e3b0','#ffffff','#7fb38f','#e8c46a','#c06a3a'],boards:['#2c2f28','#fff1cf','#e8c46a'],ads:['Ringside Deck','Watch the gusts'],
   bodies:[{t:'disc',x:.14,y:.3,r:.018,c1:'#efd9a7',c2:'#a8865a'}],haze:{c:'240,220,170',a:.12},
   particles:{color:'#fffbe8',alpha:.55,size:1.4,vx:.035,vy:.006,n:35},kit:{shirt:'#3d6b4f',pants:'#f4ecd6'}}},
 neptune:{name:'Neptune',team:'Deep Blue XI',g:11.15,air:.8,swing:1.8,spin:1.1,bounce:1.12,pace:.95,boundary:60,wind:19,ai:0.82,
  blurb:'Slightly heavier gravity, an icy skiddy pitch and the fastest winds in the solar system.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#9fd0ff,#2f6fd6 60%,#16337a)',sky:['#061a4a','#2a5fb0'],stars:.5,ground:['#2d6a85','#1d4a63'],stripe:.05,
   pitch:['#d4e9f0','#a9c9d6'],crease:'rgba(20,60,110,.85)',rope:'#e6f6ff',standsH:9,stands:'#0f2236',roof:'#6f9fc4',
   crowd:['#9fe3ff','#ffffff','#3d8bd8','#b6f0e6','#f2b134'],boards:['#0b1a2c','#d8f3ff','#7fe0ff'],ads:['Deep Blue Oval','Fastest winds around'],
   bodies:[{t:'disc',x:.55,y:.45,r:.02,c1:'#e7ecf0',c2:'#8a9aa8'}],haze:{c:'120,180,230',a:.12},
   particles:{color:'#ffffff',alpha:.75,size:2,vx:.12,vy:.08,n:90},kit:{shirt:'#1b3f8f',pants:'#e4f2fb'}}}
};
const PLANET_ORDER=['earth','moon','mercury','venus','mars','jupiter','saturn','neptune'];
function setPlanet(key){
  const p=PLANETS[key]||PLANETS.earth;
  G=p.g;BOUNDARY=p.boundary;WIND={x:0,z:0};
  ENV.air=p.air;ENV.swing=p.swing;ENV.spin=p.spin;ENV.bounce=p.bounce;ENV.pace=p.pace;
  ENV.carry=Math.pow(9.8/p.g,0.4)*p.air;
  ENV.acc=3.2*Math.sqrt(p.g/9.8)/Math.sqrt(Math.min(1,p.air));
  ENV.run=clamp(Math.sqrt(p.g/9.8),0.5,1.15);
  return p;
}
function rollWind(p){if(!p.wind){WIND={x:0,z:0};return 0;}const a=Math.random()*Math.PI*2,v=p.wind*rnd(0.4,1);WIND={x:Math.sin(a)*v,z:Math.cos(a)*v};return v;}
const SUPER_AI={easy:{0:.3,1:.28,2:.1,4:.15,6:.08,W:.09},medium:{0:.24,1:.26,2:.1,4:.2,6:.12,W:.08},hard:{0:.2,1:.22,2:.1,4:.24,6:.16,W:.08}};
const DIFF={
  easy:  {pace:[29,34],  win:1.3, k:0.15,slower:0.03,wide:0.04, swing:0.05,catchMul:0.8, fSpeed:5.6,misfield:0.07,deep:1,ai:{0:.38,1:.3,2:.1,4:.1,6:.04,W:.08}},
  medium:{pace:[33,38.5],win:1.0, k:0.5, slower:0.1, wide:0.025,swing:0.09,catchMul:1,   fSpeed:6.3,misfield:0.04,deep:2,ai:{0:.31,1:.3,2:.1,4:.14,6:.08,W:.07}},
  hard:  {pace:[36.5,42],win:0.82,k:0.9, slower:0.17,wide:0.015,swing:0.13,catchMul:1.1, fSpeed:7,  misfield:0.02,deep:3,ai:{0:.25,1:.28,2:.1,4:.19,6:.12,W:.06}}
};
// timing windows in seconds (late side is tighter: the ball is past you)
const EARLY={perfect:.025,good:.055,ok:.095,edge:.14}, LATE={perfect:.025,good:.045,ok:.065,edge:.09};
const LENS={Y:[1.2,1.9],F:[2.4,3.9],G:[4.4,6.5],S:[7.2,8.8],B:[9.4,10.8]};
const LINES={wide:[0.55,0.78],off:[0.14,0.4],mid:[-0.05,0.1],leg:[-0.34,-0.08]};
const LEN_NAME={Y:'yorkers',F:'full balls',G:'good-length balls',S:'short balls',B:'bouncers'};
const SHOTS=[
  {lo:-181,hi:-118,name:'Leg glance',loft:'Scoop',full:.45,line:-.2},
  {lo:-118,hi:-62, name:'Pull',loft:'Hook',full:.82,line:0},
  {lo:-62, hi:-22, name:'Flick',loft:'Lofted flick',full:.3,line:-.12},
  {lo:-22, hi:22,  name:'Straight drive',loft:'Lofted straight drive',full:.25,line:.02},
  {lo:22,  hi:62,  name:'Cover drive',loft:'Lofted cover drive',full:.3,line:.28},
  {lo:62,  hi:118, name:'Cut',loft:'Upper cut',full:.62,line:.5},
  {lo:118, hi:181, name:'Late cut',loft:'Ramp',full:.55,line:.42}
];
const shotFor=a=>SHOTS.find(s=>a>=s.lo&&a<s.hi)||SHOTS[3];
function shotFit(shot,full,xc){
  const lf=clamp(1-Math.abs(full-shot.full)*1.5,0.15,1);
  const nf=clamp(1-Math.abs(xc-shot.line)*1.4,0.15,1);
  return lf*0.55+nf*0.45;
}

/* ---------- delivery physics: z along the pitch, batter's stumps at z=0 ---------- */
function tAt(b,z){return z>=b.zb?(b.zr-z)/b.vz1:b.t1+(b.zb-z)/b.vz2;}
function ballPos(b,t){
  if(t<=b.t1){
    const z=b.zr-b.vz1*t, y=b.yr+b.vy0*t-0.5*G*t*t;
    return {x:b.xr+(b.xb-b.xr)*(b.zr-z)/(b.zr-b.zb),y,z};
  }
  const u=t-b.t1, z=b.zb-b.vz2*u;
  let y=b.vyB*u-0.5*G*u*u;
  if(y<0){const u1=2*b.vyB/G,v2=b.vyB*0.4,w=u-u1;y=Math.max(0,v2*w-0.5*G*w*w);}
  return {x:b.xb+(b.xt-b.xb)*(b.zb-z)/b.zb,y,z};
}
function makeDelivery(plan,diffKey,spinDir){
  const d=DIFF[diffKey], pace=plan.type==='pace';
  let v=(pace?rnd(d.pace[0],d.pace[1]):rnd(21.5,25))*ENV.pace;
  if(plan.slower)v*=rnd(0.74,0.8);
  const zr=pace?19.0:19.3, yr=pace?2.15:1.95, xr=pace?0.3:0.22;
  const zb=rnd(...LENS[plan.len]);
  let xt=rnd(...LINES[plan.line]);
  if(Math.random()<d.wide)xt=(Math.random()<0.7?1:-1)*rnd(1.0,1.2);
  const dev=clamp(pace?gauss()*d.swing*ENV.swing:spinDir*rnd(0.18,0.42)*ENV.spin,-0.65,0.65);
  const x0=xt-dev, xb=xr+(x0-xr)*(zr-zb)/zr;
  const t1=(zr-zb)/v, vy0=(0.5*G*t1*t1-yr)/t1, vImpact=vy0-G*t1;
  const full=clamp((zb-1)/10,0,1);
  const e=(pace?0.55+0.15*full:0.48+0.1*full)*ENV.bounce;
  const b={...plan,v,kmh:Math.round(v*3.6),zr,yr,xr,zb,xb,xt,dev,vz1:v,t1,vy0,vyB:-vImpact*e,vz2:v*(pace?0.88:0.8),full};
  b.tIdeal=tAt(b,CONTACT_Z); b.tStumps=tAt(b,0); b.tEnd=tAt(b,-2.2);
  const ps=ballPos(b,b.tStumps);
  b.onStumps=Math.abs(ps.x)<STUMP_HALF&&ps.y<STUMP_H;
  b.wide=Math.abs(xt)>0.92;
  return b;
}

/* ---------- fielding ---------- */
function fieldName(f){
  if(f.n==='keeper')return 'the keeper';
  if(f.n==='bowler')return 'the bowler';
  if(f.n==='slip')return 'slip';
  const a=Math.atan2(f.x,f.z)/D2R, d=Math.hypot(f.x,f.z), deep=d>BOUNDARY*0.7, x=Math.abs(a);
  if(a>=0){if(x<25)return deep?'long-off':'mid-off';if(x<70)return deep?'deep cover':'cover';if(x<112)return deep?'deep point':'point';if(x<140)return deep?'third man':'gully';return deep?'third man':'slip';}
  if(x<25)return deep?'long-on':'mid-on';if(x<70)return deep?'deep midwicket':'midwicket';if(x<112)return deep?'deep square leg':'square leg';return deep?'fine leg':'short fine leg';
}
const catchText=f=>f.n==='keeper'?'Caught behind':f.n==='bowler'?'Caught and bowled':'Caught at '+fieldName(f);
function nearestFielder(field,x,z,withKeeper){
  let best={i:-1,f:null,dist:1e9};
  field.forEach((f,i)=>{if(f.n==='keeper'&&!withKeeper)return;const d=Math.hypot(f.x-x,f.z-z);if(d<best.dist)best={i,f,dist:d};});
  return best;
}
function distToBoundary(cx,cz,ux,uz){const b=cx*ux+cz*uz,c=cx*cx+cz*cz-BOUNDARY*BOUNDARY;return -b+Math.sqrt(b*b-c);}
const runsFor=t=>t>=8?3:t>=5.4?2:t>=3.0?1:0;
const runLabel=r=>r===1?'1 run':r+' runs';
function hangTime(C){const v=Math.sqrt(C*G/Math.sin(80*D2R));return 2*v*Math.sin(40*D2R)/G;}

const RING=[{a:150,d:17,n:'slip'},{a:96,d:26},{a:52,d:28},{a:16,d:27},{a:-16,d:27},{a:-55,d:28},{a:-96,d:26},{a:-145,d:57},{a:140,d:57}];
function fieldFor(shots,diffKey){
  const sc=BOUNDARY/65,f=RING.map(p=>({...p,d:p.d>45?p.d*sc:p.d}));
  const sec=new Array(8).fill(0);let tot=0,loft=0;
  for(const s of shots){if(s.runs<=0)continue;const i=clamp(Math.floor((normAng(s.a)+180)/45),0,7);sec[i]+=s.runs;tot+=s.runs;if(s.lofted)loft+=s.runs;}
  let moved=0;
  if(tot>0){
    const n=DIFF[diffKey].deep+(tot>=8&&loft/tot>0.5?1:0);
    const order=[0,1,2,3,4,5,6,7].filter(i=>sec[i]>0).sort((x,y)=>sec[y]-sec[x]).slice(0,n);
    for(const i of order){
      const ang=-180+i*45+22.5;
      if(f.some(p=>p.d>BOUNDARY*0.6&&Math.abs(angDiff(p.a,ang))<25))continue;
      let bi=-1,bd=1e9;
      f.forEach((p,j)=>{if(p.n==='slip'||p.d>BOUNDARY*0.6)return;const dd=Math.abs(angDiff(p.a,ang));if(dd<bd){bd=dd;bi=j;}});
      if(bi>=0){f[bi]={a:ang+rnd(-6,6),d:rnd(57,61)*sc};moved++;}
    }
  }
  const out=f.map(p=>({x:p.d*Math.sin(p.a*D2R),z:p.d*Math.cos(p.a*D2R),n:p.n}));
  out.push({x:0.15,z:-1.8,n:'keeper'});out.push({x:0.5,z:17.5,n:'bowler'});
  return {field:out,moved};
}

/* ---------- shot resolution ---------- */
function windows(diffKey,early){const k=DIFF[diffKey].win,b=early?EARLY:LATE;return {perfect:b.perfect*k,good:b.good*k,ok:b.ok*k,edge:b.edge*k};}
function resolveDefend(b,clean){
  if(clean){const r=Math.random()<0.12?1:0;return {runs:r,label:r?'Quick single':'Blocked',cls:r?'runs':'dot',dir:rnd(-25,25),lofted:false,path:{air:false,s:r?8:4,a:4},shot:'Block'};}
  if(b.onStumps&&Math.random()<0.35)return {runs:0,out:true,outText:'Played on',label:'Out!',sub:'Inside edge onto the stumps',cls:'out',stumps:true,shot:'Block'};
  return {runs:0,label:'Inside edge',cls:'dot',dir:rnd(-170,-140),lofted:false,path:{air:false,s:6,a:5},shot:'Block'};
}
function resolveEdge(b,c,sw,field,d,mishit){
  const keeper=field.findIndex(f=>f.n==='keeper'), slip=field.findIndex(f=>f.n==='slip');
  if(mishit&&sw.lofted){
    const C=rnd(10,32),dir=normAng(sw.aim+gauss()*25),T=rnd(2.6,3.3);
    const L={x:c.x+Math.sin(dir*D2R)*C,z:c.z+Math.cos(dir*D2R)*C};
    const nf=nearestFielder(field,L.x,L.z,C<12);
    const reach=(2+4.5*(T-0.6))*(d.fSpeed/6.3);
    if(nf.dist<reach&&Math.random()<(nf.dist<reach*0.5?0.95:0.75)*d.catchMul)
      return {runs:0,out:true,outText:catchText(nf.f),label:'Out!',sub:'Top edge. '+catchText(nf.f),dir,lofted:true,path:{air:true,C,T,stop:true},catcher:nf.i,catchPt:L,cls:'out'};
    const r=Math.random()<0.6?1:0;
    return {runs:r,label:'Top edge',sub:'Lands safely',dir,lofted:true,path:{air:true,C,T,stop:true},cls:r?'runs':'dot'};
  }
  const off=c.x>-0.05;
  let pc=(sw.lofted?0.36:0.22)+(off&&slip>=0?0.12:0);if(!off)pc*=0.5;pc*=d.catchMul;
  if(Math.random()<pc){
    const i=(off&&slip>=0&&Math.random()<0.5)?slip:keeper, f=field[i];
    const dx=f.x-c.x,dz=f.z-c.z;
    return {runs:0,out:true,outText:i===keeper?'Caught behind':'Caught at slip',label:'Out!',sub:i===keeper?'Edged and caught behind':'Edged to slip',
      dir:Math.atan2(dx,dz)/D2R,lofted:false,path:{air:true,C:Math.hypot(dx,dz),T:0.4,stop:true},catcher:i,catchPt:{x:f.x,z:f.z},cls:'out'};
  }
  const r=Math.random(),runs=r<0.5?0:r<0.8?1:4,dir=off?rnd(130,165):rnd(-165,-130);
  return {runs,boundary:runs===4?4:0,label:runs===4?'Four!':runs?'1 run':'Edged',sub:runs===4?'Thick edge, races away':runs?'Thick edge':'Edged, no run',
    dir,lofted:false,path:{air:false,s:runs===4?30:runs?14:9,a:3.2},cls:runs===4?'four':runs?'runs':'dot'};
}
function resolveGround(c,dir,q,power,field,d){
  const ux=Math.sin(dir*D2R),uz=Math.cos(dir*D2R);
  const s=10+32*q*(0.4+0.6*power),acc=ENV.acc,natural=s*s/(2*acc);
  const tTo=A=>{const disc=s*s-2*acc*A;return disc<0?Infinity:(s-Math.sqrt(disc))/acc;};
  const bd=distToBoundary(c.x,c.z,ux,uz);
  let best=null;
  field.forEach((f,i)=>{
    if(f.n==='keeper')return;
    const rx=f.x-c.x,rz=f.z-c.z,A=rx*ux+rz*uz;
    if(A<=1||A>Math.min(natural,bd)+2)return;
    const p=Math.abs(rx*uz-rz*ux),tA=tTo(Math.min(A,natural-0.01));
    const R=2.2+d.fSpeed*Math.max(0,tA-0.3);
    if(p<R&&(!best||A<best.A))best={i,A,p,tA};
  });
  let mis=false;
  if(best&&Math.random()<d.misfield){best=null;mis=true;}
  if(best){
    const f=field[best.i],t=best.tA+best.p/d.fSpeed*0.5+0.5+Math.hypot(f.x,f.z-BATS_Z)/30,runs=runsFor(t);
    return {runs,dir,lofted:false,path:{air:false,s,a:acc,maxD:best.A},fielderTo:{i:best.i,x:c.x+ux*best.A,z:c.z+uz*best.A},
      label:runs?runLabel(runs):'Fielded',sub:'Stopped at '+fieldName(f),cls:runs?'runs':'dot'};
  }
  if(natural>=bd)return {runs:4,boundary:4,dir,lofted:false,path:{air:false,s,a:acc},label:'Four!',misfield:mis,cls:'four'};
  const sx=c.x+ux*natural,sz=c.z+uz*natural,nf=nearestFielder(field,sx,sz);
  const runs=Math.min(3,runsFor(s/acc+nf.dist/d.fSpeed+0.5+Math.hypot(sx,sz)/30));
  return {runs,dir,lofted:false,path:{air:false,s,a:acc},fielderTo:{i:nf.i,x:sx,z:sz},label:runs?runLabel(runs):'No run',sub:mis?'Misfield':'Into the gap',cls:runs?'runs':'dot'};
}
function resolveAir(c,dir,q,power,field,d){
  let C=(10+80*Math.pow(q,1.35)*(0.4+0.6*power))*ENV.carry,T=hangTime(C);
  if(WIND.x||WIND.z){const lx=c.x+Math.sin(dir*D2R)*C+WIND.x*T*0.3,lz=c.z+Math.cos(dir*D2R)*C+WIND.z*T*0.3;
    C=Math.hypot(lx-c.x,lz-c.z);dir=Math.atan2(lx-c.x,lz-c.z)/D2R;T=hangTime(C);}
  const ux=Math.sin(dir*D2R),uz=Math.cos(dir*D2R),bd=distToBoundary(c.x,c.z,ux,uz);
  const Lx=c.x+ux*C,Lz=c.z+uz*C;
  if(C>=bd){
    for(let i=0;i<field.length;i++){
      const f=field[i];if(Math.hypot(f.x,f.z)<BOUNDARY*0.74)continue;
      const rx=f.x-c.x,rz=f.z-c.z,A=rx*ux+rz*uz,p=Math.abs(rx*uz-rz*ux);
      if(p<3.2&&C-A<5&&C-A>-1.5&&Math.random()<0.45*d.catchMul)
        return {runs:0,out:true,outText:catchText(f),label:'Out!',sub:'Caught on the rope at '+fieldName(f),dir,lofted:true,
          path:{air:true,C:A,T,stop:true},catcher:i,catchPt:{x:c.x+ux*A,z:c.z+uz*A},cls:'out'};
    }
    return {runs:6,boundary:6,dir,lofted:true,path:{air:true,C:C+4,T},label:'Six!',dist:Math.round(Math.hypot(Lx,Lz)),cls:'six'};
  }
  const nf=nearestFielder(field,Lx,Lz,C<10);
  const reach=(2+4.5*Math.max(0,T-0.6))*(d.fSpeed/6.3);
  let dropped=false;
  if(nf.dist<reach){
    const p=Math.min(0.97,(nf.dist<reach*0.45?0.95:0.68)*d.catchMul);
    if(Math.random()<p)return {runs:0,out:true,outText:catchText(nf.f),label:'Out!',sub:catchText(nf.f),dir,lofted:true,
      path:{air:true,C,T,stop:true},catcher:nf.i,catchPt:{x:Lx,z:Lz},cls:'out'};
    dropped=true;
  }
  const roll=C*0.25;
  if(C+roll>=bd)return {runs:4,boundary:4,dir,lofted:true,path:{air:true,C,T,roll:roll+6},label:'Four!',sub:dropped?'Dropped, and it bounces over':'One bounce over the rope',cls:'four'};
  const sx=Lx+ux*roll,sz=Lz+uz*roll,nf2=nearestFielder(field,sx,sz);
  let runs=Math.min(3,runsFor(T+roll/8+nf2.dist/d.fSpeed+0.5+Math.hypot(sx,sz)/30));
  if(dropped)runs=Math.max(runs,1);
  return {runs,dir,lofted:true,path:{air:true,C,T,roll},fielderTo:{i:nf2.i,x:sx,z:sz},
    label:dropped?'Dropped!':runs?runLabel(runs):'No run',sub:dropped?'Put down at '+fieldName(nf.f):'Lands safely',cls:runs?'runs':'dot'};
}
function evalSwing(b,sw,diffKey,field){
  const d={...DIFF[diffKey],fSpeed:DIFF[diffKey].fSpeed*ENV.run},dt=sw.tc-b.tIdeal,early=dt<0,a=Math.abs(dt),w=windows(diffKey,early);
  const c=ballPos(b,b.tIdeal);
  const timing={dt,early,
    label:a<=w.perfect?'Perfect':a<=w.good?'Good':a<=w.ok?(early?'Early':'Late'):a<=w.edge?(early?'Very early':'Very late'):(early?'Too early':'Too late'),
    zone:a<=w.perfect?3:a<=w.good?2:a<=w.ok?1:a<=w.edge?0:-1};
  if(!(c.x<0.98&&c.x>-0.8&&c.y<2.05)){timing.label='Out of reach';timing.zone=-1;return {miss:true,timing};}
  if(a>w.edge)return {miss:true,timing};
  if(sw.defend)return {timing,res:resolveDefend(b,a<=w.ok)};
  const shot=shotFor(sw.aim),match=shotFit(shot,b.full,c.x),name=sw.lofted?shot.loft:shot.name;
  let edge=a>w.ok,mishit=false;
  const mt=sw.lofted?0.55:0.42;
  if(!edge&&match<mt&&Math.random()<(mt-match)*1.7){edge=true;mishit=true;}
  if(!edge&&sw.lofted&&a>w.good&&Math.random()<0.18*DIFF[diffKey].catchMul){edge=true;mishit=true;}
  if(edge){const r=resolveEdge(b,c,sw,field,d,mishit);r.shot=name;timing.mishit=mishit;if(mishit)timing.label+=' timing, wrong shot for that ball';return {timing,res:r};}
  const tq=a<=w.perfect?1:1-0.45*clamp((a-w.perfect)/(w.ok-w.perfect),0,1);
  const q=tq*(0.35+0.65*match);
  const dir=normAng(sw.aim+dt*300+gauss()*(1-q)*16);
  const r=sw.lofted?resolveAir(c,dir,q,sw.power,field,d):resolveGround(c,dir,q,sw.power,field,d);
  r.shot=name;r.q=q;r.match=match;
  if(r.boundary&&!r.sub)r.sub=name+(r.dist?', '+r.dist+' m':'')+(r.misfield?', misfield':'');
  return {timing,res:r};
}

/* ---------- AI bowler brain: remembers what each length and line costs it ---------- */
function bScore(mem,k){const s=mem[k]||{r:0,n:0,w:0},n=s.n+2;return (s.r+2.4)/n-5*s.w/n;}
function planBall(mem,type,diffKey,ctx){
  const d=DIFF[diffKey],lens=type==='pace'?['Y','F','G','S','B']:['Y','F','G','S'];
  const base=type==='pace'?{Y:.7,F:1,G:1.6,S:.8,B:.45}:{Y:.3,F:1.3,G:1.7,S:.45};
  const last=ctx.last||[];
  const lw=lens.map(L=>{
    let x=base[L]*Math.exp(-d.k*1.5*bScore(mem,type+':'+L));
    if(ctx.pressure&&L==='Y')x*=1.9;
    if(ctx.pressure&&L==='B')x*=1.3;
    if(d.k>0.3&&last.length>=2&&last[last.length-1]===L&&last[last.length-2]===L)x*=0.3;
    return x;});
  const lines=['wide','off','mid','leg'],lb={wide:.45,off:1.5,mid:1,leg:.55};
  return {type,len:pick(lens,lw),line:pick(lines,lines.map(l=>lb[l]*Math.exp(-d.k*1.2*bScore(mem,'line:'+l)))),
    slower:type==='pace'&&Math.random()<d.slower*(ctx.pressure?1.5:1)};
}
function brainLearn(mem,b,runs,out){
  for(const k of [b.type+':'+b.len,'line:'+b.line]){
    const s=mem[k]||(mem[k]={r:0,n:0,w:0});
    s.r+=runs;s.n++;if(out)s.w++;
    if(s.n>40){s.r*=40/s.n;s.w*=40/s.n;s.n=40;}
  }
}
function brainInsight(mem,type){
  const lens=type==='pace'?['Y','F','G','S','B']:['F','G','S'];
  let best=null,bs=1e9;
  for(const L of lens){const s=mem[type+':'+L];if(!s||s.n<4)continue;const sc=bScore(mem,type+':'+L);if(sc<bs){bs=sc;best=L;}}
  return best&&bs<0.9?'Bowler\u2019s plan: more '+LEN_NAME[best]:'';
}
function simulateAI(overs,wkts,diffKey,mul,isSuper){
  const w=isSuper?SUPER_AI[diffKey]:DIFF[diffKey].ai,keys=Object.keys(w);let runs=0,out=0,balls=0;
  while(balls<overs*6&&out<wkts){const o=pick(keys,keys.map(k=>w[k]));balls++;if(o==='W')out++;else runs+=+o;}
  return {runs:Math.round(runs*(mul||1)),wkts:out,balls};
}
function hitPos(h,t){
  let d,y=0;
  if(h.air){
    if(t<=h.T){d=h.sh*t;y=h.y0+h.vy*t-0.5*G*t*t;}
    else if(h.stop){d=h.C;}
    else{const u=Math.min(1,(t-h.T)/1.2);d=h.C+(h.roll!=null?h.roll:h.C*0.3)*(1-(1-u)*(1-u));}
  }else{const tt=Math.min(t,h.s/h.a);d=h.s*tt-0.5*h.a*tt*tt;y=Math.max(0,h.y0*(1-t*4));}
  if(h.maxD!=null)d=Math.min(d,h.maxD);
  return {x:h.x0+h.ux*d,z:h.z0+h.uz*d,y:Math.max(0,y),d};
}
function preparePath(p,start,dir){
  const h={...p,x0:start.x,z0:start.z,y0:clamp(start.y,0.3,2),ux:Math.sin(dir*D2R),uz:Math.cos(dir*D2R)};
  if(h.air){h.sh=h.C/h.T;h.vy=(0.5*G*h.T*h.T-h.y0)/h.T;}
  return h;
}
