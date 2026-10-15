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
 earth:{name:'Earth',team:'Earth XI',g:9.8,air:1,swing:1,spin:1,bounce:1,pace:1,boundary:65,wind:0,ai:1,t20:1,
  blurb:'Home conditions: normal gravity and a little swing. The baseline.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#8fd0ff,#2b78c2 55%,#2d6b3c)',sky:['#5d9ccf','#cfe5f2'],ground:['#3c8a45','#2f7a39'],stripe:.055,
   pitch:['#e3cf9c','#cdb27a'],crease:'rgba(255,255,255,.92)',rope:'#f4efe1',standsH:14,stands:'#34424f',roof:'#d8d3c3',crowd:CROWD,
   boards:['#1d3a2b','#efe8d2','#f2b134'],ads:['Play straight','Crease Chase'],bodies:[],kit:{shirt:'#7a1f2b',pants:'#f1ece0'}}},
 moon:{name:'Moon',team:'Lunar XI',g:1.62,air:1.1,swing:0,spin:1.25,bounce:.95,pace:1,boundary:95,wind:0,ai:1.34,t20:0.98,
  blurb:'One-sixth gravity and no air. Lofted shots fly for ages, so mistimed ones hang up to be caught. No swing at all.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#e4e4df,#8d8d88 60%,#5c5c58)',sky:['#000004','#0d0f1a'],stars:1,ground:['#9a9a96','#74736d'],stripe:.03,
   pitch:['#d6d3ca','#b2ada1'],crease:'rgba(255,255,255,.95)',rope:'#e6e9ef',standsH:8,stands:'#22262e',roof:'#aab4c0',
   crowd:['#e9edf2','#c4ccd6','#8fa3b8','#f2b134','#ffffff','#5d6b7a'],boards:['#14181f','#d9e2ec','#7fc8ff'],ads:['One-sixth gravity','Mind the craters'],
   bodies:[{t:'earth',x:.5,y:.5,r:.075}],kit:{shirt:'#dfe3e8',pants:'#9aa4b0',skin:'#c8d2dc'}}},
 mercury:{name:'Mercury',team:'Sunside XI',g:3.7,air:1.1,swing:0,spin:1.25,bounce:1.05,pace:1,boundary:82,wind:0,ai:1.27,t20:0.88,
  blurb:'Low gravity, no air and a giant sun. Spinners grip the scorched pitch.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#cfc3b8,#857a70 60%,#57504a)',sky:['#000000','#1a110a'],stars:.6,ground:['#7c7068','#5b524b'],stripe:.03,
   pitch:['#c4b59f','#9e8f7b'],crease:'rgba(255,255,255,.9)',rope:'#efe6da',standsH:7,stands:'#2b2522',roof:'#a99683',
   crowd:['#ffd9a8','#ffffff','#c96f3c','#7f8c99','#f2b134'],boards:['#1c1714','#ffe2b8','#ff9d3d'],ads:['Sunside Ground','Bring sunscreen'],
   bodies:[{t:'sun',x:.2,y:.6,r:.13,c:'#fff3c4'}],haze:{c:'255,214,150',a:.13},kit:{shirt:'#c25b1f',pants:'#efe2d0'}}},
 venus:{name:'Venus',team:'Cloud Deck XI',g:8.87,air:.72,swing:2.4,spin:.9,bounce:.85,pace:.88,boundary:54,wind:2,ai:0.92,t20:1.18,
  blurb:'Soupy air slows the ball and makes it swing wildly. A small ground, but sixes are hard to clear.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#fbe6a6,#d9a441 60%,#9a6a1d)',sky:['#c98d2e','#f3d491'],clouds:1,ground:['#8a6a2c','#6a501f'],stripe:.03,
   pitch:['#c99d58','#a98140'],crease:'rgba(255,248,225,.9)',rope:'#fbe8b8',standsH:11,stands:'#4b3818',roof:'#e6c27a',
   crowd:['#ffd36b','#e8743b','#fff2c9','#b5651d','#ffffff'],boards:['#3b2a0e','#fde7b0','#ffcf5c'],ads:['Thick air, big swing','Cloud Deck Oval'],
   bodies:[],haze:{c:'240,196,92',a:.32},particles:{color:'#fff0b3',alpha:.3,size:1.6,vx:.01,vy:-.025,n:40},kit:{shirt:'#6b2f8a',pants:'#f3e3c0'}}},
 mars:{name:'Mars',team:'Red Dust XI',g:3.71,air:1.05,swing:.35,spin:1.1,bounce:1.12,pace:1,boundary:82,wind:7,ai:1.24,t20:0.89,
  blurb:'A third of Earth\u2019s gravity on a hard, bouncy deck. Big carry and dusty gusts.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#f2a272,#c1502a 60%,#7a2c14)',sky:['#b9784e','#e8b98c'],ground:['#a4532d','#7c3b1f'],stripe:.04,
   pitch:['#d9a273','#ba7f53'],crease:'rgba(255,240,225,.9)',rope:'#f6dcc4',standsH:10,stands:'#3e231a',roof:'#c99872',
   crowd:['#f2c49b','#e8743b','#ffffff','#8a3b21','#f2b134'],boards:['#3a1a10','#f6dcc4','#ffb07a'],ads:['Red Dust Arena','Thin air, long carry'],
   bodies:[{t:'sun',x:.25,y:.45,r:.028,c:'#f7efe0'},{t:'disc',x:.62,y:.3,r:.009,c1:'#a8978a',c2:'#5e5248'},{t:'disc',x:.5,y:.62,r:.006,c1:'#a39282',c2:'#5e5248'}],
   haze:{c:'232,150,96',a:.15},particles:{color:'#efae7c',alpha:.55,size:2,vx:.07,vy:.012,n:70},kit:{shirt:'#2d4b7a',pants:'#e7d8c9'}}},
 jupiter:{name:'Jupiter',team:'Storm XI',g:24.79,air:1,swing:1.2,spin:.9,bounce:.72,pace:1,boundary:50,wind:13,ai:0.81,t20:1,
  blurb:'Two and a half times Earth\u2019s gravity. The ball dips hard and keeps low, and storms gust across a small floating deck.',
  vis:{sw:'repeating-linear-gradient(170deg,#ecc89c 0 4px,#b5693c 4px 7px,#f3dcb6 7px 10px)',sky:['#a8592e','#ecc596'],bands:['#c47a46','#f0d3a8','#9e5a34','#e8b98a'],
   ground:['#5d6772','#454d57'],stripe:.06,pitch:['#d8cbb0','#b8aa8d'],crease:'rgba(255,255,255,.9)',rope:'#ffe3c2',standsH:6,stands:'#2d3138',roof:'#8e98a3',
   crowd:['#ffb37a','#ffffff','#e45d3a','#ffd36b','#9aa6b2'],boards:['#262a30','#ffe3c2','#ff8f5a'],ads:['Storm Deck','Heavy gravity, low bounce'],
   bodies:[{t:'disc',x:.7,y:.35,r:.02,c1:'#f2e28a',c2:'#b9952f'},{t:'disc',x:.45,y:.62,r:.012,c1:'#d9d2c4',c2:'#8b8072'}],
   lightning:1,haze:{c:'214,140,90',a:.15},kit:{shirt:'#b3421f',pants:'#f2e6d6'}}},
 saturn:{name:'Saturn',team:'Ringside XI',g:10.44,air:.85,swing:1.4,spin:1,bounce:.95,pace:.97,boundary:62,wind:10,ai:0.87,t20:1.2,
  blurb:'Close to Earth gravity under the rings, with steady crosswinds that push lofted shots off line.',
  vis:{sw:'radial-gradient(circle at 35% 35%,#f6e4b8,#c9a66a 60%,#8a6a3a)',sky:['#b89a5c','#f0e2bd'],rings:1,ground:['#5f6f66','#47544c'],stripe:.05,
   pitch:['#e2d6b8','#c3b694'],crease:'rgba(255,255,255,.9)',rope:'#fff4da',standsH:6,stands:'#30352f',roof:'#b9b29a',
   crowd:['#f6e3b0','#ffffff','#7fb38f','#e8c46a','#c06a3a'],boards:['#2c2f28','#fff1cf','#e8c46a'],ads:['Ringside Deck','Watch the gusts'],
   bodies:[{t:'disc',x:.14,y:.3,r:.018,c1:'#efd9a7',c2:'#a8865a'}],haze:{c:'240,220,170',a:.12},
   particles:{color:'#fffbe8',alpha:.55,size:1.4,vx:.035,vy:.006,n:35},kit:{shirt:'#3d6b4f',pants:'#f4ecd6'}}},
 neptune:{name:'Neptune',team:'Deep Blue XI',g:11.15,air:.8,swing:1.8,spin:1.1,bounce:1.12,pace:.95,boundary:60,wind:19,ai:0.82,t20:1.25,
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
const DIFF={
  easy:  {pace:[29,34],  win:1.3, k:0.15,slower:0.03,wide:0.04, swing:0.05,catchMul:0.8, fSpeed:5.6,misfield:0.07,deep:1,acc:.7,spd:.95,turn:.85,ai:{0:.38,1:.3,2:.1,4:.1,6:.04,W:.08}},
  medium:{pace:[33,38.5],win:1.0, k:0.5, slower:0.1, wide:0.025,swing:0.09,catchMul:1,   fSpeed:6.3,misfield:0.04,deep:2,acc:.85,spd:1,turn:1,ai:{0:.31,1:.3,2:.1,4:.14,6:.08,W:.07}},
  hard:  {pace:[36.5,42],win:0.82,k:0.9, slower:0.17,wide:0.015,swing:0.13,catchMul:1.1, fSpeed:7,  misfield:0.02,deep:3,acc:1,spd:1.04,turn:1.1,ai:{0:.25,1:.28,2:.1,4:.19,6:.12,W:.06}}
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
// Tests only, against spin pitched up (met length <= SWEEP_FULL): the slingshot aim picks a sweep instead of the glance/late cut.
// kf/kl: length/line tolerance (sweeps forgive line, not length); tw: timing window x (cross-bat); risk raises the mishit
// threshold; te: mishits balloon (top edge, glove)
const SWEEP_FULL=0.6;
const SWEEPS=[
  {lo:-165,hi:-100,name:'Sweep',loft:'Slog-sweep',full:.3,line:.05,kf:2.2,kl:.8,tw:.85,risk:.12,te:1,sweep:1},
  {lo:110, hi:165, name:'Reverse sweep',loft:'Lofted reverse sweep',full:.32,line:.3,kf:2.4,kl:1,tw:.75,risk:.2,te:1,sweep:1}
];
function shotForBall(a,b,full){if(b.type==='spin'&&full<=SWEEP_FULL){const s=SWEEPS.find(s=>a>=s.lo&&a<s.hi);if(s)return s;}return shotFor(a);}
// the lunge of a sweep: front pad further down the pitch and across, so a missed sweep is often LBW
const sweepBp=bp=>({x:(bp?bp.x:0)+0.12,z:(bp?bp.z:0)+0.35});
// batting tiers (Tests): timing window x, power x, edge/mishit x, xe = chance a shot timed short of perfect finds the edge anyway
const TIER={A:{n:'Top order',win:1,pow:1,edge:1,xe:0},B:{n:'Batter',win:.88,pow:.95,edge:1.3,xe:.03},C:{n:'All-rounder',win:.72,pow:.85,edge:1.8,xe:.07},
  D:{n:'Tail',win:.55,pow:.72,edge:2.6,xe:.14,tail:1},E:{n:'Number eleven',win:.4,pow:.6,edge:3.5,xe:.22,tail:1}};
function shotFit(shot,full,xc){
  const lf=clamp(1-Math.abs(full-shot.full)*(shot.kf||1.5),0.15,1);
  const nf=clamp(1-Math.abs(xc-shot.line)*(shot.kl||1.4),0.15,1);
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
function makeDelivery(plan,diffKey,sd,cond){
  const d=DIFF[diffKey], pace=plan.type==='pace', bw=typeof sd==='object'?sd:null, fat=cond&&plan.fat||0;
  let v=(bw?(pace?rnd(d.pace[0]*bw.pace[0],d.pace[1]*bw.pace[1]):rnd(...bw.v)*d.spd*(plan.flat?1.08:1)):pace?rnd(d.pace[0],d.pace[1]):rnd(21.5,25))*ENV.pace;
  if(plan.slower)v*=rnd(0.74,0.8);
  if(cond)v*=(1-0.07*fat)*(SPINV[plan.var]||1);
  const zr=pace?19.0:19.3, yr=pace?2.15:1.95, xr=(pace?0.3:0.22)*(cond&&plan.ar?-1.8:1), rough=cond&&plan.line==='rough';
  let zb=rnd(...LENS[plan.len]);
  if(fat)zb=clamp(zb+gauss()*0.6*fat,1.1,11);
  let xt=rough?0:rnd(...LINES[plan.line]);
  if(bw)xt+=gauss()*0.14*(1-bw.acc*d.acc*(1-0.4*fat));
  if(Math.random()<d.wide*(bw?bw.wide:1)*(1+fat))xt=(Math.random()<0.7?1:-1)*rnd(1.0,1.2);
  const T=cond?testDev(plan,d,bw,pace,v,cond,sd):null;
  let dev=T?T.dev:clamp(pace?(bw?(bw.swDir*0.5+gauss())*bw.sw*(plan.sw||1):gauss())*d.swing*ENV.swing:(bw?(plan.dir||bw.dir)*rnd(...bw.turn)*d.turn:sd*rnd(0.18,0.42))*ENV.spin,-0.65,0.65);
  let x0=xt-dev, xb=xr+(x0-xr)*(zr-zb)/zr, eK=1;
  if(T){
    // footmarks outside both stumps from day 3: a spinner who lands in them gets more turn and less even bounce
    const px=Math.abs(rough?T.rx:xb),inR=cond.day>=3&&zb>3&&zb<7.5&&px>0.22&&px<0.62,rk=inR?0.25*(cond.day-2):0;
    if(rough)xb=T.rx;
    if(!pace&&rk)dev=clamp(dev+T.turn*rk,-0.8,0.8);
    if(rough){x0=xr+(xb-xr)*zr/(zr-zb);xt=x0+dev;}else{x0=xt-dev;xb=xr+(x0-xr)*(zr-zb)/zr;}
    eK=clamp(1+gauss()*BOUNCE_VAR[cond.day-1]*(inR?1.6:1),0.6,1.45)*(plan.var==='top'?1.15:plan.var==='arm'?0.92:1);
    T.rough=inR;
  }
  const b=launch(plan,v,zr,yr,xr,zb,xb,xt,dev,eK);
  if(T){b.swC=T.swC;b.swR=T.swR;b.seam=T.seam;b.turn=T.turn;b.rough=T.rough;b.eK=eK;b.bouncer=ballPos(b,tAt(b,POPPING)).y>SHOULDER;}
  return b;
}
// release (zr,yr,xr), pitch (zb,xb), line at the stumps (xt) and movement off the pitch (dev) -> flight, bounce, stumps, wide
function launch(p,v,zr,yr,xr,zb,xb,xt,dev,eK){
  const pace=p.type==='pace',t1=(zr-zb)/v, vy0=(0.5*G*t1*t1-yr)/t1, vImpact=vy0-G*t1;
  const full=clamp((zb-1)/10,0,1);
  const e=(pace?0.55+0.15*full:0.48+0.1*full)*ENV.bounce*eK;
  const b={...p,v,kmh:Math.round(v*3.6),zr,yr,xr,zb,xb,xt,dev,vz1:v,t1,vy0,vyB:-vImpact*e,vz2:v*(pace?0.88:0.8),full};
  b.tIdeal=tAt(b,CONTACT_Z); b.tStumps=tAt(b,0); b.tEnd=tAt(b,-2.2);
  const ps=ballPos(b,b.tStumps);
  b.onStumps=Math.abs(ps.x)<STUMP_HALF&&ps.y<STUMP_H;
  b.wide=Math.abs(xt)>0.92;
  return b;
}
/* ---------- Test conditions: cond = {day 1-5, ballAge overs since the new ball, planet} ---------- */
const SHOULDER=1.45, NEW_BALL=80;
const DAY_TURN=[.75,.9,1.05,1.25,1.45], BOUNCE_VAR=[.03,.045,.07,.1,.14], DAY_SEAM=[1,.8,.6,.5,.45];
const SPINV={arm:1.07,carrom:1.05,top:.97};
// swing fades over ~25 overs of ball age; reverse builds from ~35 overs and needs pace (opposite way to the seam's conventional
// swing); seam movement off the pitch is greenest on day 1 and with a hard new ball; turn grows with the day
function testDev(plan,d,bw,pace,v,cond,sd){
  const a=cond.ballAge,r={swC:0,swR:0,seam:0,turn:0,dev:0,rx:0};
  if(pace){
    const s0=bw?bw.swDir*0.5+gauss():gauss(),k=(bw?bw.sw*(plan.sw||1):1)*d.swing*ENV.swing,
      conv=lerp(1.35,0.15,clamp(a/25,0,1)),rev=clamp((a-35)/20,0,1)*clamp((v-30.5)/6,0,1);
    r.swC=s0*conv*k;r.swR=rev?-Math.sign(s0)*rev*rnd(0.6,1.2)*k:0;
    r.seam=gauss()*0.07*DAY_SEAM[cond.day-1]*(1-0.5*clamp(a/40,0,1))*(bw&&TARCH[bw.arch]?TARCH[bw.arch].seam:1);
    r.dev=clamp(r.swC+r.swR+r.seam,-0.75,0.75);
  }else{
    const sd0=bw?bw.dir:sd,dir=plan.dir===0||plan.dir===1||plan.dir===-1?plan.dir:sd0,
      t=(bw?rnd(...bw.turn)*d.turn:rnd(0.18,0.42))*DAY_TURN[cond.day-1]*ENV.spin;
    r.turn=plan.var==='arm'?-sd0*rnd(0.02,0.08):plan.var==='top'?sd0*rnd(0,0.05):dir*t*(plan.var==='carrom'?0.6:plan.var==='doosra'?0.85:1);
    r.dev=clamp(r.turn,-0.75,0.75);
    if(plan.line==='rough')r.rx=sd0>0?rnd(-0.55,-0.26):rnd(0.26,0.58);
  }
  return r;
}

/* ---------- footwork: bp = batter offset from guard in metres (+z down the pitch, +x across to off) ---------- */
const POPPING=1.22,LEG_H=0.9,PAD_W=0.36,REACH_LEG=-0.65,BP0={x:0,z:0};
const FOOT={fw:[-.33,1.8,-.47,.8],bk:[-.38,1.18,-.22,.6],tr:[-.43,1.46,-.38,.76]};
function strideW(full){const wf=clamp((.36-full)/.14,0,1),wb=clamp((full-.52)/.12,0,1);return [wf,wb,1-wf-wb];}
// Good length is the zone of uncertainty: footwork that takes the ball out of it, or goes back to a short ball (more time),
// earns a gain (wider timing windows, better shot fit); footwork into it costs. Charging a short ball meets it on the rise (awk).
const lenDanger=f=>clamp(1-Math.abs(f-0.45)/0.2,0,1);
function footAt(b,bp){
  bp=bp||BP0;const t=tAt(b,CONTACT_Z+bp.z),c=ballPos(b,t),full=clamp((b.zb-bp.z-1)/10,0,1);
  const gain=lenDanger(b.full)-lenDanger(full)+0.2*clamp(-bp.z/0.4,0,1)*clamp((b.full-0.55)/0.1,0,1);
  return {t,c,xc:c.x-bp.x,full,gain,awk:clamp((b.zb-6.5)/2,0,1)*clamp((bp.z-0.3)/0.9,0,1)};
}
function legsAt(b,bp){
  bp=bp||BP0;const f=footAt(b,bp),[wf,wb,wt]=strideW(f.full),v=i=>wf*FOOT.fw[i]+wb*FOOT.bk[i]+wt*FOOT.tr[i];
  return [{x:v(0)+wf*clamp(f.xc*.45,-.12,.25)+wt*clamp(f.xc*.3,-.1,.15)+bp.x,z:v(1)+bp.z},{x:v(2)+wb*clamp(f.xc*.3,-.1,.15)+bp.x,z:v(3)+bp.z}];
}
// knees bow toward the off side, so a leg covers from just behind the foot to well in front of it (ball radius included)
function padHit(b,bp){
  for(const L of legsAt(b,bp)){const t=tAt(b,L.z),p=ballPos(b,t);if(p.x>L.x-0.1&&p.x<L.x+PAD_W&&p.y<LEG_H)return {t,x:p.x,y:p.y,z:L.z};}
  return null;
}
// LBW law: not if it pitched outside leg; impact in line, or outside off only when no shot was offered; and it would hit the stumps
function padResult(b,h,offered){
  const leg=b.zb>h.z&&b.xb<-STUMP_HALF,inLine=Math.abs(h.x)<STUMP_HALF;
  if(b.onStumps&&!leg&&(inLine||(h.x>0&&!offered)))
    return {runs:0,out:true,outText:'LBW',label:'LBW',sub:offered?'Trapped in front':'Padded up, no shot offered',cls:'out',pad:h};
  if(b.wide)return {runs:1,wide:true,label:'Wide',sub:'One extra',cls:'wide',pad:h};
  return {runs:0,label:'Hit on the pad',sub:!b.onStumps?'Missing the stumps':leg?'Pitched outside leg':'Hit outside the line',cls:'dot',pad:h};
}
const outOfCrease=(b,bp)=>!!bp&&legsAt(b,bp)[1].z>POPPING;
// the keeper stands up to spin, so a charging batter who is beaten is usually stumped
function stumpedResult(b,bp){
  if(!outOfCrease(b,bp)||Math.random()>=(b.type==='spin'?0.88:0.3))return null;
  return {runs:b.wide?1:0,wide:!!b.wide,out:true,outText:'Stumped',label:'Stumped!',sub:b.type==='spin'?'Down the pitch and beaten':'Out of the crease, keeper threw it in',cls:'out',stumped:true};
}
// a short ball reaching the batter at body or head height, inside his body line
function bodyHit(b,bp){
  bp=bp||BP0;const z=BATS_Z+0.3+bp.z,t=tAt(b,z),p=ballPos(b,t),x=p.x-bp.x;
  return p.y>0.95&&p.y<2&&x>-0.62&&x<-0.05?{t,x:p.x,y:p.y,z,head:p.y>1.5}:null;
}
// bat (Tests; not {t20}): a ball at the body that was not ducked (b.duck) or played hits the batter (no run, no injury); a duck under
// a ball that keeps low is hit on the helmet
function beaten(b,bp,offered,bat){
  const h=padHit(b,bp);if(h)return padResult(b,h,offered);
  if(bat&&!bat.t20){
    const k=bodyHit(b,bp);
    if(k&&!(b.duck&&k.y>1.15))return {runs:0,label:k.head?'Hit on the helmet':'Hit on the body',sub:b.duck?'Ducked into it':offered?'Beaten by the bounce':'Could not get out of the way',cls:'dot',body:k};
    if(b.duck&&!b.onStumps)return b.wide?{runs:1,wide:true,label:'Wide',sub:'One extra',cls:'wide'}:{runs:0,label:'Ducked',sub:'Under the bouncer',cls:'dot'};
  }
  if(b.onStumps)return {runs:0,out:true,outText:'Bowled',label:'Bowled!',sub:offered?'Missed it':'Left it, and it hit the stumps',cls:'out',stumps:true};
  return stumpedResult(b,bp)||(b.wide?{runs:1,wide:true,label:'Wide',sub:'One extra',cls:'wide'}:{runs:0,label:offered?'Beaten':'Left alone',cls:'dot'});
}

/* ---------- fielding ---------- */
function fieldName(f){
  if(f.n==='keeper')return 'the keeper';
  if(f.n==='bowler')return 'the bowler';
  if(f.n==='slip')return 'slip';
  if(POS[f.n])return POS[f.n][2];
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

/* ---------- T20: positions, field templates, fielding restrictions ---------- */
// [angle, metres or 'deep' (0.9 x boundary), name]. Ring positions scale with BOUNDARY/65; close catchers (<=17 m) stay put.
const POS={slip:[150,17,'slip'],gully:[125,14,'gully'],third:[140,20,'short third'],silly:[80,4,'silly point'],point:[96,24,'point'],
 cover:[52,26,'cover'],midoff:[16,26,'mid-off'],midon:[-16,26,'mid-on'],midwk:[-55,26,'midwicket'],sqleg:[-96,24,'square leg'],
 shortleg:[-75,4,'short leg'],sfine:[-140,14,'short fine leg'],longoff:[12,'deep','long-off'],longon:[-12,'deep','long-on'],
 dcover:[50,'deep','deep cover'],dpoint:[95,'deep','deep point'],tman:[150,'deep','third man'],dmid:[-50,'deep','deep midwicket'],
 dsq:[-90,'deep','deep square leg'],fine:[-150,'deep','fine leg'],
 slip2:[143,17,'second slip',1],slip3:[136,17,'third slip',1],slip4:[129,17,'fourth slip',1],lslip:[-150,17,'leg slip',1],
 fshort:[-60,4.5,'short leg',1],dbsq:[-125,'deep','deep backward square',1]};
// each template pairs a field with a delivery mix: len/line base weights, sw swing x, slow slower-ball x, wrong googly x, flat quicker spin
const TPL={
 PA:{name:'Attacking pace field',f:'slip gully point cover midoff midon midwk tman fine',atk:1,len:{Y:.5,F:1.4,G:1.6,S:.5,B:.3},line:{wide:.3,off:2,mid:1,leg:.3},sw:1.3},
 PC:{name:'Pace containing field',f:'point cover midoff midon midwk sqleg third tman fine',len:{Y:.5,F:.6,G:1.8,S:1,B:.4},line:{wide:.3,off:1.3,mid:1.5,leg:.5}},
 PS:{name:'Powerplay spin field',f:'slip shortleg point cover midoff midon midwk dmid longon',atk:1,len:{Y:.3,F:1,G:2,S:.4},line:{wide:.2,off:1,mid:2,leg:.5}},
 OF:{name:'Off-side field',f:'point cover midoff midwk dcover longoff tman dmid longon',len:{Y:.5,F:.8,G:1.6,S:1,B:.3},line:{wide:.8,off:2,mid:.7,leg:.2},slow:1.5},
 SB:{name:'Short-ball trap',f:'sfine sqleg midon midoff cover point third dsq dmid',atk:1,len:{Y:.3,F:.3,G:.6,S:2,B:1.6},line:{wide:.2,off:.6,mid:1.5,leg:1.2}},
 WY:{name:'Wide-yorker field',f:'point cover midon midwk tman dpoint dcover longoff longon',len:{Y:1.2,F:.9,G:.5,S:.4,B:.4},line:{wide:2,off:1.5,mid:.3,leg:.1},slow:1.5},
 SY:{name:'Straight-yorker field',f:'point cover midoff midon fine dmid longon longoff dcover',len:{Y:1.4,F:.9,G:.5,S:.3,B:.5},line:{wide:.1,off:.8,mid:2,leg:.6},slow:1.3},
 SL:{name:'Slower-ball field',f:'midoff midon cover point midwk sqleg dcover dmid longon',len:{Y:.6,F:1.3,G:1.5,S:.6,B:.3},line:{wide:.4,off:1.5,mid:1,leg:.3},slow:3},
 OA:{name:'Attacking off-spin field',f:'slip shortleg point cover midoff midon midwk dmid longon',atk:1,len:{Y:.2,F:1,G:2,S:.3},line:{wide:.1,off:1,mid:2,leg:.4}},
 OC:{name:'Off-spin containing field',f:'cover midoff third midon longon dmid dsq longoff dcover',len:{Y:.4,F:1.5,G:1.5,S:.4},line:{wide:.2,off:.8,mid:2,leg:.8}},
 LA:{name:'Attacking wrist-spin field',f:'slip silly point cover midoff midon midwk dmid longoff',atk:1,len:{Y:.2,F:1,G:2,S:.4},line:{wide:.3,off:1.5,mid:1.5,leg:.3},wrong:2},
 LC:{name:'Spin containing field',f:'point cover midoff midwk dcover longoff longon dmid dpoint',len:{Y:.3,F:1.5,G:1.3,S:.5},line:{wide:.7,off:2,mid:.7,leg:.2}},
 CH:{name:'Field for the charge',f:'midon third cover point dcover dpoint longoff longon dmid',len:{Y:.5,F:.4,G:1,S:1.8,B:.8},line:{wide:2,off:1.5,mid:.4,leg:.3},flat:1},
 // Tests (test:1): ar = around-the-wicket share, rough = line into the footmarks (day 4-5)
 SC:{test:1,name:'Slip cordon',f:'slip slip2 slip3 gully point cover midoff midon fine',atk:1,len:{Y:.4,F:1.5,G:1.8,S:.5,B:.3},line:{wide:.4,off:2.2,mid:.8,leg:.15},sw:1.3},
 UM:{test:1,name:'Umbrella field',f:'slip slip2 slip3 slip4 gully silly fshort midon fine',atk:1,len:{Y:1.6,F:1.2,G:1,S:.5,B:1},line:{wide:.1,off:1.2,mid:2,leg:.6}},
 LT:{test:1,name:'Leg trap',f:'lslip fshort dbsq midwk dmid midon slip gully cover',atk:1,len:{Y:.5,F:.3,G:.5,S:1.8,B:2.2},line:{wide:.05,off:.3,mid:1,leg:2},ar:.6},
 TF:{test:1,name:'Single on offer',f:'slip dpoint dcover longoff longon dmid dsq fine tman',len:{Y:.8,F:1.1,G:1.5,S:.6,B:.4},line:{wide:.5,off:1.6,mid:1,leg:.3}},
 SV:{test:1,name:'Saving the single',f:'slip gully point cover midoff midon midwk sqleg fine',len:{Y:1,F:1,G:1.5,S:.5,B:.4},line:{wide:.3,off:1.4,mid:1.4,leg:.3}},
 SR:{test:1,name:'Spin into the rough',f:'slip fshort silly cover midoff midon midwk dmid longon',atk:1,len:{Y:.2,F:1.2,G:2,S:.3},line:{wide:.1,off:1,mid:1,leg:.3,rough:2.5},ar:.25},
 DF:{test:1,name:'Defensive field',f:'point cover midoff midon midwk sqleg dcover dmid fine',len:{Y:.5,F:.9,G:1.8,S:.8,B:.3},line:{wide:.5,off:1.8,mid:.9,leg:.4}},
 RV:{test:1,name:'Reverse-swing field',f:'slip point cover midoff midon midwk sqleg fine longon',atk:1,len:{Y:1.6,F:1.3,G:1.2,S:.5,B:.4},line:{wide:.1,off:.8,mid:2,leg:.6}}
};
for(const k in TPL)TPL[k].f=TPL[k].f.split(' ');
// boundary riders (T20 templates): 0.9 x boundary; c widens their catching reach (they are set to take the catch, not save the single)
const RIDER=0.9,RIDER_C=1.3;
const phaseOf=o=>o<6?'pp':o<16?'mid':'death';
const spot=(n,a,d,c)=>({x:d*Math.sin(a*D2R),z:d*Math.cos(a*D2R),n,a,d,c:c||1});
function tplField(id){
  const sc=BOUNDARY/65,f=TPL[id].f.map(n=>{const [a,d]=POS[n];return d==='deep'?spot(n,a,BOUNDARY*RIDER,RIDER_C):spot(n,a,d>17?d*sc:d);});
  f.push({x:0.15,z:-1.8,n:'keeper'},{x:0.5,z:17.5,n:'bowler'});
  return f;
}
// ICC T20I clause 28: outside the 30-yard circle max 2 in the powerplay, else 5; leg side max 5; max 2 behind square on the leg side
function fieldOk(field,pp){
  const rc=27.43*BOUNDARY/65;let out=0,leg=0,fine=0;
  for(const f of field){
    if(f.n==='keeper'||f.n==='bowler')continue;
    const a=f.a!=null?f.a:Math.atan2(f.x,f.z)/D2R;
    if(Math.hypot(f.x,f.z)>rc)out++;
    if(a<0){leg++;if(a<-90)fine++;}
  }
  return out<=(pp?2:5)&&leg<=5&&fine<=2;
}
// Law 28.4 (Tests): at most 2 fielders, keeper excluded, behind the popping crease on the on side; no circle, no powerplay
function fieldOkTest(field){let n=0;for(const f of field)if(f.n!=='keeper'&&f.n!=='bowler'&&f.x<0&&f.z<POPPING)n++;return n<=2;}
const zoneOf=a=>clamp(Math.floor((normAng(a)+180)/45),0,7);
// scoring zones: runs per 45-degree sector, decaying per ball (half-life ~14 balls)
function zoneAdd(Z,dir,runs){for(let i=0;i<8;i++)Z[i]*=0.95;if(runs>0&&dir!=null)Z[zoneOf(dir)]+=runs;return Z;}
const CLOSE=['slip','slip2','slip3','slip4','lslip','gully','silly','shortleg','fshort'];
// at most ctx.n (default 2) fielders go deep into the hottest uncovered sectors: an inner fielder if the quota allows, else a
// deep fielder from a cold sector; every change must still pass fieldOk
function adjust(field,Z,ctx){
  const f=field.slice(),moved=[],deep=BOUNDARY*0.6,max=ctx.n==null?2:ctx.n,D=BOUNDARY*RIDER,ok=ctx.ok||(g=>fieldOk(g,ctx.pp));
  const hot=[0,1,2,3,4,5,6,7].filter(i=>Z[i]>=4).sort((x,y)=>Z[y]-Z[x]);
  for(const s of hot){
    if(moved.length>=max)break;
    const ang=-157.5+s*45;
    if(f.some(p=>p.a!=null&&p.d>deep&&Math.abs(angDiff(p.a,ang))<25))continue;
    const idx=f.map((p,j)=>j).filter(j=>f[j].a!=null),
      inner=idx.filter(j=>f[j].d<=deep&&!CLOSE.includes(f[j].n)).sort((x,y)=>Math.abs(angDiff(f[x].a,ang))-Math.abs(angDiff(f[y].a,ang))),
      cold=idx.filter(j=>f[j].d>deep&&Z[zoneOf(f[j].a)]<Z[s]*0.5).sort((x,y)=>Z[zoneOf(f[x].a)]-Z[zoneOf(f[y].a)]);
    let nk='',bd=1e9;for(const k in POS)if(POS[k][1]==='deep'&&!POS[k][3]&&Math.abs(angDiff(POS[k][0],ang))<bd){bd=Math.abs(angDiff(POS[k][0],ang));nk=k;}
    for(const j of [...inner,...cold]){
      const old=f[j];f[j]=spot(nk,ang,D,RIDER_C);
      if(ok(f)){moved.push({from:old.n,to:nk});break;}
      f[j]=old;
    }
  }
  return {field:f,moved};
}

/* ---------- T20: bowlers ---------- */
// pace: x DIFF pace range; v: spin speed m/s; sw: x DIFF swing, swDir: outswing bias; turn: spin metres, dir +1 turns to off
// (leg-spin, left-arm orthodox), -1 off-spin, wrong: googly share; slow: x DIFF slower share; acc: line accuracy; wide: x DIFF wide;
// len: length bias (yorker/bouncer share); role: suitability per phase; plans: preferred templates per phase
const ARCH={
 express:{type:'pace',name:'Express pace',pace:[1.04,1.1],sw:.7,swDir:0,slow:.6,acc:.6,wide:1.5,len:{Y:1,F:.8,G:.9,S:1.3,B:1.6},
  role:{pp:.8,mid:.5,death:.7},plans:{pp:{PA:2,SB:1,PC:1},mid:{SB:2,OF:1.5,SL:.5},death:{SY:2,WY:1,SB:.6}}},
 swing:{type:'pace',name:'Swing and seam',pace:[.95,1],sw:1.8,swDir:1,slow:.8,acc:.85,wide:1,len:{Y:.8,F:1.3,G:1.1,S:.7,B:.5},
  role:{pp:1,mid:.45,death:.35},plans:{pp:{PA:3,PC:1},mid:{OF:2,SL:1},death:{WY:1.5,SY:1,SL:1}}},
 cutter:{type:'pace',name:'Cutters',pace:[.92,.98],sw:.5,swDir:0,slow:2,acc:.8,wide:1,len:{Y:.8,F:.8,G:1.3,S:1.2,B:.9},
  role:{pp:.5,mid:.9,death:.6},plans:{pp:{PC:2,SB:1},mid:{OF:2,SL:2,SB:1},death:{SL:2,WY:1}}},
 death:{type:'pace',name:'Death specialist',pace:[.98,1.04],sw:.6,swDir:0,slow:1.6,acc:.9,wide:.8,len:{Y:1.4,F:1.1,G:.9,S:.8,B:.9},
  role:{pp:.3,mid:.4,death:1},plans:{pp:{PC:2,PA:1},mid:{SL:1,OF:1},death:{WY:2,SY:2,SL:1}}},
 off:{type:'spin',name:'Off-spin',v:[21.5,24.5],turn:[.18,.38],dir:-1,acc:.85,wide:.6,len:{Y:.8,F:1.1,G:1.1,S:.8},
  role:{pp:.35,mid:1,death:.25},plans:{pp:{PS:2},mid:{OC:2,OA:1},death:{OC:1}}},
 leg:{type:'spin',name:'Leg-spin',v:[20.5,23.5],turn:[.25,.5],dir:1,wrong:.15,acc:.7,wide:1,len:{Y:.7,F:1.1,G:1,S:1.2},
  role:{pp:.2,mid:1,death:.35},plans:{pp:{LA:1,PS:1},mid:{LA:1.5,LC:1.5},death:{LC:1}}},
 sla:{type:'spin',name:'Left-arm orthodox',v:[22,25],turn:[.15,.32],dir:1,acc:.9,wide:.6,len:{Y:1,F:1.1,G:1.1,S:.7},
  role:{pp:.5,mid:.9,death:.3},plans:{pp:{PS:1,LA:1},mid:{LC:2,LA:1},death:{LC:1}}}
};
const NAMES={
 earth:['Brox Cald Dorv Fenn Hask Kell Lorr Merr Pask Quill Rask Tolv Wend','by den holm ick mere ton wyn sett'],
 moon:['Sel Lun Thal Cyn Ves Ori Aph Nox','ene ith ara ion uvis orn'],
 mercury:['Sol Ign Pyr Cind Brim Hel Scor Vulc','ax ek ith orr yx ane'],
 venus:['Vap Nim Mist Sulf Zeph Aur Cael Hal','ora iel esh una is ette'],
 mars:['Rux Ferr Duss Kar Rast Ox Tark Vorr','ok an ek ul ax orn'],
 jupiter:['Gor Thun Brom Krag Vast Mog Dral Zorr','dak gar um oth ax ung'],
 saturn:['Ril Cass Hyp Lyr Enc Mim Pan Tet','ello ira eon ova ath is'],
 neptune:['Tid Nere Cor Ond Pel Sal Thal Vey','ine ix ossa eth yn ora']
};
function wpick(items,weights,rng){const s=weights.reduce((a,b)=>a+b,0);let r=rng()*s;for(let i=0;i<items.length;i++){r-=weights[i];if(r<=0)return items[i];}return items[items.length-1];}
// 5 bowlers: always a death specialist and a spinner, the rest weighted by the planet (swing air, gripping pitches)
function makeAttack(pk,diffKey,rng){
  rng=rng||Math.random;const P=PLANETS[pk]||PLANETS.earth,N=(NAMES[pk]||NAMES.earth).map(s=>s.split(' ')),one=a=>a[Math.floor(rng()*a.length)];
  const ks=['death',one(['off','leg','sla'])],pool=['express','swing','cutter','off','leg','sla'];
  const w={express:diffKey==='hard'?1.6:1,swing:.5+.5*P.swing,cutter:diffKey==='easy'?1.3:1,off:.4*P.spin,leg:.4*P.spin,sla:.4*P.spin};
  while(ks.length<5){
    const nSpin=ks.filter(k=>ARCH[k].type==='spin').length,ok=pool.filter(k=>ks.filter(x=>x===k).length<2&&(ARCH[k].type==='pace'||nSpin<2));
    ks.push(wpick(ok,ok.map(k=>w[k]),rng));
  }
  ks.sort((a,b)=>(ARCH[a].type==='spin')-(ARCH[b].type==='spin'));
  const names=new Set();
  return ks.map((k,i)=>{
    let sn;do sn=one(N[0])+one(N[1]);while(names.has(sn));names.add(sn);
    return {...ARCH[k],i,arch:k,name:'ABCDEFGHJKLMNPRSTVWZ'[Math.floor(rng()*20)]+'. '+sn};
  });
}
// greedy (most overs left first, never the previous bowler) is exact for "no two adjacent", so this is a true feasibility test
function canFinish(q,last,R){
  q=q.slice();
  for(let k=0;k<R;k++){let b=-1;for(let i=0;i<q.length;i++)if(i!==last&&q[i]>0&&(b<0||q[i]>q[b]))b=i;if(b<0)return false;q[b]--;last=b;}
  return true;
}
// the player bats the XI in order (tiers as in Tests), whoever is on strike
function newT20(attack,diffKey,target){
  return {diff:diffKey,target,par:target/20,runs:0,balls:0,wkts:0,last:-1,bw:attack.map(()=>({o:0,b:0,r:0,w:0})),fow:[],ov:[],mem:{},
    bat:XI.map(p=>({name:p.name,tier:p.tier,runs:0,balls:0,out:false})),s:0,ns:1};
}
// max 4 overs each, never two in a row, phase roles; a bowler going above par+3 an over (hard: +2) is rested unless the quotas
// force him; on hard the best death bowler keeps 2 overs for overs 18-20
// bowlers who may bowl over o (0-based): not the last over's bowler, overs left, and the rest of the innings still coverable
function legalBowlers(st,o){
  const q=st.bw.map(f=>4-f.o);
  return q.map((v,i)=>i).filter(i=>i!==st.last&&q[i]>0&&canFinish(q.map((v,j)=>v-(j===i?1:0)),i,19-o));
}
// par: the chase's required rate; batting first (no target), the innings' own rate so far
function captainPick(attack,o,st){
  const ph=phaseOf(o),hard=st.diff==='hard',q=attack.map((b,i)=>4-st.bw[i].o);
  const legal=legalBowlers(st,o);
  if(!legal.length)return -1;
  const lim=(st.par!=null?st.par:st.balls>=12?st.runs/st.balls*6:9)+(hard?2:3),best=attack.reduce((m,b,i)=>b.role.death>attack[m].role.death?i:m,0);
  const pref=legal.filter(i=>!(st.bw[i].o>0&&st.bw[i].r/st.bw[i].o>lim)&&!(hard&&o<17&&i===best&&q[i]<=2));
  const pool=pref.length?pref:legal,k=st.diff==='easy'?1:hard?3:2;
  return pick(pool,pool.map(i=>Math.pow(attack[i].role[ph],k)));
}
// needing well above par or losing wickets: attack; a set batter (30+ since the last wicket): contain; charging: CH vs spin, SB vs pace
function planPick(bw,ph,st,ft){
  const d=DIFF[st.diff],pp=ph==='pp',def=Object.keys(bw.plans[ph])[0],w={...bw.plans[ph]},fp=footPlan(ft),ck=bw.type==='spin'?'CH':'SB';
  if(fp&&fp.ch>0)w[ck]=(w[ck]||0)+2.5*fp.ch;
  const left=120-st.balls,rrr=left>0?(st.target-st.runs)/left*6:0,lw=st.fow.length?st.fow[st.fow.length-1]:{runs:0},
    attack=st.target!=null&&rrr>st.par*1.25||st.fow.filter(f=>f.balls>st.balls-18).length>=2,set=st.runs-lw.runs>=30;
  const ids=Object.keys(w).filter(id=>fieldOk(tplField(id),pp));
  const id=st.diff==='easy'&&ids.includes(def)&&Math.random()<0.6?def:pick(ids,ids.map(id=>
    w[id]*(attack?(TPL[id].atk?1.8:1):set?(TPL[id].atk?0.6:1.4):1)*Math.exp(-d.k*1.5*(bScore(st.mem,'b'+bw.i+':T:'+id)-1.2))));
  return {id,mix:TPL[id]};
}
// the bowler's pressure deliveries (more yorkers, bouncers, slower balls): the death overs, or the chase running ahead of par
function t20Pressure(st){const left=120-st.balls;return phaseOf(Math.floor(st.balls/6))==='death'||left>0&&(st.target-st.runs)/left>1.2*st.target/120;}
// records one ball against bowler bi; returns true when it completed the over
function t20Record(st,bi,res){
  const f=st.bw[bi],o=Math.floor(st.balls/6);st.runs+=res.runs;f.r+=res.runs;st.ov[o]={b:bi,r:(st.ov[o]?st.ov[o].r:0)+res.runs};
  if(res.out){st.wkts++;f.w++;st.fow.push({runs:st.runs,balls:st.balls+(res.wide?0:1),w:st.wkts});}
  batRecord(st,res);
  if(res.wide)return false;
  st.balls++;if(++f.b<6)return false;
  f.b=0;f.o++;st.last=bi;swapStrike(st);return true;
}
// T20 and Tests: the striker's runs and balls; after a wicket the next batter in takes strike (Law 18.11); odd runs swap the
// strike (not boundaries or wides). Ends swap at the over (swapStrike)
const swapStrike=st=>{const t=st.s;st.s=st.ns;st.ns=t;};
function batRecord(st,res){
  const bt=st.bat[st.s];
  if(!res.wide){bt.balls++;bt.runs+=res.runs;}
  if(res.out){bt.out=true;bt.how=res.outText;const nx=st.bat.findIndex((p,i)=>!p.out&&i!==st.s&&i!==st.ns);if(nx>=0)st.s=nx;}
  else if(!res.wide&&!res.boundary&&res.runs%2)swapStrike(st);
}

/* ---------- Tests: attack, spells, captain, plans, strike rotation, objectives ---------- */
// per archetype in Tests: seam movement x, tire = fatigue per over in a spell, var = spin variation shares per ball
const TARCH={express:{seam:.8,tire:.15},swing:{seam:1.3,tire:.11},cutter:{seam:1.2,tire:.09},death:{seam:.9,tire:.12},
 off:{tire:.04,var:{doosra:.07,carrom:.05,arm:.1}},leg:{tire:.05,var:{top:.12}},sla:{tire:.04,var:{arm:.12}}};
const SPELL={pace:6,spin:12};
const hashStr=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const seeded=a=>()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
// names are fixed per team and archetype (sc.team, else the scenario), so a series rival keeps the same bowlers in every Test
function testAttack(sc){
  const team=sc.team||sc.id,N=(NAMES[sc.team?'earth':sc.planet]||NAMES.earth).map(s=>s.split(' ')),seen={},names=new Set();
  return sc.attack.map((a,i)=>{
    const rng=seeded(hashStr(team+a.arch+(seen[a.arch]=(seen[a.arch]||0)+1))),one=x=>x[Math.floor(rng()*x.length)];let sn;
    do sn=one(N[0])+one(N[1]);while(names.has(sn));names.add(sn);
    return {...ARCH[a.arch],i,arch:a.arch,name:'ABCDEFGHJKLMNPRSTVWZ'[Math.floor(rng()*20)]+'. '+sn};
  });
}
// bowlers given oversLeft are on at the start (first two take the ends); fatigue 0..1 cuts pace and accuracy
function newTest(sc){
  const A=testAttack(sc),on=sc.attack.map((a,i)=>a.oversLeft!=null?i:-1).filter(i=>i>=0);
  return {sc,A,diff:sc.diff,cond:{day:sc.day,ballAge:sc.ballAge,planet:sc.planet},runs:0,balls:0,wkts:0,ovs:0,ob:0,ovB:0,bi:-1,
    ends:[on.length?on[0]:-1,on.length>1?on[1]:-1],pid:null,fc:{},
    bat:sc.lineup.map(p=>({name:p.name,tier:p.tier,runs:p.runs||0,balls:p.balls||0,out:false})),s:sc.striker,ns:sc.nonStriker,
    bw:sc.attack.map(a=>({o:0,b:0,r:0,w:0,sp:0,sr:0,cap:a.oversLeft!=null?a.oversLeft:SPELL[ARCH[a.arch].type],rest:a.oversLeft!=null?0:9,fat:a.fatigue||0})),
    mem:{},Z:[0,0,0,0,0,0,0,0],foot:{x:0,z:0},last:[],fow:[],tailB:0,fours:0,sixes:0,newBall:0,viol:{bouncer:0,field:0}};
}
const isTail=(st,i)=>!!TIER[st.bat[i].tier].tail;
// new ball: swing; old ball: reverse (express, death) or spin, more so as the pitch wears; tail on strike: express
function suitTest(bw,st){
  const C=st.cond,a=C.ballAge,k=bw.arch,P=st.sc.plan;
  let x=bw.type==='spin'?[.5,.6,.9,1.3,1.6][C.day-1]*(a<15?0.5:1):a<15?(k==='swing'?2:k==='express'?1.5:1):a>=35?(k==='express'?1.5:k==='death'?1.3:1):1;
  if(P!=='contain'&&isTail(st,st.s)&&(k==='express'||k==='death'))x*=1.6;
  if(P==='contain'&&(bw.type==='spin'||k==='cutter'))x*=1.3;
  return x;
}
// a bowler stays on at his end until his spell is over (cap overs), he tires or he is expensive; never two overs in a row; the
// replacement is picked by suitability and freshness (pace needs 2 overs' rest, spin 1)
function captainPickTest(st){
  const e=st.ovs%2,cur=st.ends[e],other=st.ends[1-e],B=st.bw,k=st.diff==='easy'?1:st.diff==='hard'?3:2,lim=st.diff==='hard'?13:16;
  if(cur>=0&&cur!==other&&B[cur].sp<B[cur].cap&&B[cur].fat<0.8&&!(B[cur].sp>=2&&B[cur].sr/B[cur].sp>lim))return cur;
  const all=st.A.map((b,i)=>i).filter(i=>i!==other),ok=all.filter(i=>i!==cur&&B[i].fat<0.6&&B[i].rest>=(st.A[i].type==='spin'?1:2)),pool=ok.length?ok:all;
  const i=pick(pool,pool.map(i=>Math.pow(suitTest(st.A[i],st)*(1-B[i].fat),k)));
  B[i].sp=0;B[i].sr=0;B[i].cap=SPELL[st.A[i].type];
  return i;
}
// the over's stock plan, weighted by conditions and what has worked against this batter (per-bowler mem)
function testStock(bw,st){
  const a=st.cond.ballAge,P=st.sc.plan,w={};
  if(bw.type==='spin'){w.SR=st.cond.day>=3?2:1;w.DF=P==='contain'?2:.5;}
  else{w.SC=a<25?2.5:.6;w.RV=a>=35?2:0;w.DF=P==='contain'?2:.6;w.LT=bw.arch==='express'?.6:.2;}
  if(P==='attack')for(const k in w)if(TPL[k].atk)w[k]*=1.5;
  const ids=Object.keys(w).filter(k=>w[k]>0),d=DIFF[st.diff];
  return pick(ids,ids.map(id=>w[id]*Math.exp(-d.k*1.5*(bScore(st.mem,'b'+bw.i+':T:'+id)-1.2))));
}
function testOver(st){
  const notes=[];
  if(st.cond.ballAge>=NEW_BALL){st.cond.ballAge=0;st.newBall++;notes.push('New ball taken');}
  st.bi=captainPickTest(st);st.ends[st.ovs%2]=st.bi;st.pid=testStock(st.A[st.bi],st);st.ob=0;st.ovB=0;st.fc={};
  return notes;
}
// tail plans per ball. 'tail': offer the set batter a single early in the over (a single puts the tail-ender on strike for the
// rest of it), save the single on the last two balls (a single then keeps him on strike); 'tail' and 'attack': attack a tail-ender
// with the umbrella or the leg trap (bouncers while the limit allows), spin into the rough
function testPlanId(st){
  const bw=st.A[st.bi],P=st.sc.plan,ts=isTail(st,st.s);
  if(P==='tail'&&!ts&&isTail(st,st.ns))return st.ob<4?'TF':'SV';
  if(P!=='contain'&&ts)return bw.type==='spin'?(st.cond.day>=3?'SR':'UM'):st.ovB<2&&bw.arch!=='swing'?'LT':'UM';
  return st.pid;
}
// at most 2 balls an over above shoulder height (ICC Test clause 41.6): S and B are not planned after two, and a ball that still
// bounces above the shoulder is re-planned
function testBall(st){
  const notes=st.bi<0?testOver(st):[],bw=st.A[st.bi],id=testPlanId(st),B=st.bw[st.bi];
  const field=st.fc[id]||(st.fc[id]=id===st.pid?adjust(tplField(id),st.Z,{ok:fieldOkTest,n:Math.min(2,DIFF[st.diff].deep)}).field:tplField(id));
  const ctx={last:st.last,foot:st.foot,bw,plan:{id,mix:TPL[id]},cond:st.cond,bouncers:st.ovB,tail:st.sc.plan!=='contain'&&isTail(st,st.s),fat:B.fat};
  let p,b;
  for(let k=0;k<6;k++){p=planBall(st.mem,bw.type,st.diff,ctx);b=makeDelivery(p,st.diff,bw,st.cond);if(!(b.bouncer&&st.ovB>=2))break;}
  if(b.bouncer&&st.ovB>=2)b=makeDelivery({...p,len:'Y'},st.diff,bw,st.cond);
  if(!fieldOkTest(field))st.viol.field++;
  return {b,field,id,notes};
}
// one ball: runs, strike (batRecord; ends swap at the over), bowler figures, fatigue,
// ball age; hold refuses the odd run. Returns true when the over is complete
function testRecord(st,b,res,hold,bp){
  if(hold)res=applyHold(res);
  const B=st.bw[st.bi];
  st.runs+=res.runs;B.r+=res.runs;B.sr+=res.runs;
  if(b.bouncer&&++st.ovB>2)st.viol.bouncer++;
  if(res.boundary===4)st.fours++;if(res.boundary===6)st.sixes++;
  zoneAdd(st.Z,res.out?null:res.dir,res.wide?0:res.runs);st.last.push(b.len);if(st.last.length>3)st.last.shift();
  brainLearn(st.mem,b,res.runs,!!res.out);footTrend(st.foot,bp);
  if(!res.wide){st.balls++;st.ob++;B.b++;if(isTail(st,st.s))st.tailB++;}
  if(res.out){st.wkts++;B.w++;st.fow.push({runs:st.runs,balls:st.balls,w:st.wkts});}
  batRecord(st,res);
  if(st.ob<6)return false;
  swapStrike(st);st.ovs++;st.ob=0;st.ovB=0;st.cond.ballAge++;
  B.o++;B.b=0;B.sp++;B.fat=Math.min(1,B.fat+TARCH[st.A[st.bi].arch].tire);
  st.bw.forEach((x,i)=>{if(i===st.bi)x.rest=0;else{x.rest++;x.fat=Math.max(0,x.fat-0.05);}});
  st.bi=-1;
  return true;
}
// obj.wkts = wickets the side can lose (all out, or the collapse that ends a survive); obj.balls = the time left. A draw is a real
// result: surviving meets 'survive'; a tie needs the scores level with the side all out
function scenEnd(st){
  const o=st.sc.obj,need=o.target!=null?o.target-st.runs:1,out=st.wkts>=o.wkts,time=st.balls>=o.balls,
    R=(result,met)=>({result,met,need,left:o.balls-st.balls});
  switch(o.type){
    case 'chase':case 'scoreBy':if(need<=0)return R('win',true);if(out)return R('loss',false);if(time)return R('draw',false);break;
    case 'session':if(need<=0)return R('win',true);if(out)return R('loss',false);if(time)return R('draw',st.runs>=o.par);break;
    case 'survive':if(out)return R('loss',false);if(time)return R('draw',true);break;
    case 'avoidFO':if(need<=0)return R('draw',true);if(out)return R('loss',false);if(time)return R('draw',false);break;
    case 'tieOrWin':if(need<=0)return R('win',true);if(out)return need===1?R('tie',true):R('loss',false);if(time)return R('draw',false);break;
  }
  return null;
}
// stars: 1 = objective met; +1 margin ({balls} to spare, {runs} beyond the target or par, or scored while surviving, {wkts} in hand, {win}
// not a tie); +1 bonus ({noWkt}, {tail: max balls faced by tail-enders}, {bat:{i,runs}}, {sixes}, {inBalls})
function starOk(s,st,e){
  const o=st.sc.obj;
  return s.balls!=null?e.left>=s.balls:s.runs!=null?st.runs-(o.type==='survive'?0:o.type==='session'?o.par:o.target||0)>=s.runs:s.wkts!=null?o.wkts-st.wkts>=s.wkts:s.win?e.result==='win':
    s.noWkt?st.wkts===0:s.tail!=null?st.tailB<=s.tail:s.bat?st.bat[s.bat.i].runs>=s.bat.runs:s.sixes!=null?st.sixes>=s.sixes:s.inBalls!=null?st.balls<=s.inBalls:false;
}
function scenStars(st,e){if(!e.met)return 0;let n=1;for(const s of st.sc.stars)if(s.t!=='win'&&starOk(s,st,e))n++;return Math.min(3,n);}
// staged chases carry the state into the next session: runs still needed, wickets in hand, batters in and to come, ball age
function stageNext(sc,st){
  const nx=sc.stage&&SCEN.find(s=>s.stage&&s.stage.g===sc.stage.g&&s.stage.n===sc.stage.n+1);
  if(!nx)return null;
  const keep=st.bat.map((p,i)=>i).filter(i=>!st.bat[i].out),lineup=keep.map(i=>({...st.bat[i]}));
  return {...nx,ballAge:st.cond.ballAge,lineup,striker:keep.indexOf(st.s),nonStriker:keep.indexOf(st.ns),
    obj:{...nx.obj,target:sc.obj.target-st.runs,wkts:sc.obj.wkts-st.wkts}};
}

/* ---------- shot resolution ---------- */
function windows(diffKey,early,m){const k=DIFF[diffKey].win*(m||1),b=early?EARLY:LATE;return {perfect:b.perfect*k,good:b.good*k,ok:b.ok*k,edge:b.edge*k};}
// Tests (x = {field,c,T}): a block at chest height or above is a fend off the gloves; an inside edge can go to the close leg catchers
function resolveDefend(b,clean,x){
  if(x&&x.c.y>1.2&&Math.random()<clamp((x.c.y-1.2)/0.6,0,1)*(clean?0.12:0.35)*Math.sqrt(x.T.edge)){
    const F=x.field,ks=(x.c.x<-0.1?['fshort','shortleg','lslip','gully','slip']:['gully','slip','silly','fshort']).map(n=>F.findIndex(f=>f.n===n)).filter(i=>i>=0),
      i=ks.length&&Math.random()<0.75?ks[0]:Math.random()<0.25?F.findIndex(f=>f.n==='keeper'):-1;
    if(i>=0){const f=F[i];return {runs:0,out:true,outText:catchText(f),label:'Out!',sub:'Fended off the gloves to '+fieldName(f),dir:Math.atan2(f.x,f.z)/D2R,lofted:true,
      path:{air:true,C:Math.hypot(f.x,f.z-x.c.z),T:0.7,stop:true},catcher:i,catchPt:{x:f.x,z:f.z},cls:'out',shot:'Fend'};}
    return {runs:0,label:'Fended away',sub:'Off the gloves, safe',cls:'dot',dir:rnd(-60,60),lofted:false,path:{air:false,s:6,a:5},shot:'Fend'};
  }
  const po=!clean&&b.onStumps&&Math.random()<0.35;
  if(po)return {runs:0,out:true,outText:'Played on',label:'Out!',sub:'Inside edge onto the stumps',cls:'out',stumps:true,shot:'Block'};
  if(x&&!clean){
    const i=x.field.findIndex(f=>f.n==='fshort'||f.n==='shortleg');
    if(i>=0&&Math.random()<0.2){const f=x.field[i];return {runs:0,out:true,outText:catchText(f),label:'Out!',sub:'Bat-pad to '+fieldName(f),dir:-60,lofted:true,
      path:{air:true,C:4.5,T:0.5,stop:true},catcher:i,catchPt:{x:f.x,z:f.z},cls:'out',shot:'Block'};}
    return {runs:0,label:'Inside edge',cls:'dot',dir:rnd(-170,-140),lofted:false,path:{air:false,s:6,a:5},shot:'Block'};
  }
  if(clean){const r=Math.random()<0.12?1:0;return {runs:r,label:r?'Quick single':'Blocked',cls:r?'runs':'dot',dir:rnd(-25,25),lofted:false,path:{air:false,s:r?8:4,a:4},shot:'Block'};}
  return {runs:0,label:'Inside edge',cls:'dot',dir:rnd(-170,-140),lofted:false,path:{air:false,s:6,a:5},shot:'Block'};
}
function resolveEdge(b,c,sw,field,d,mishit){
  const keeper=field.findIndex(f=>f.n==='keeper'), slips=field.reduce((a,f,i)=>(/^slip/.test(f.n)&&a.push(i),a),[]), slip=slips.length?slips[0]:-1,
    gully=field.findIndex(f=>f.n==='gully'), ls=field.findIndex(f=>f.n==='lslip');
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
  let pc=(sw.lofted?0.36:0.22)+(off&&slip>=0?0.12:0)+(off&&gully>=0?0.06:0)+(off?0.05*Math.max(0,slips.length-1):0);if(!off)pc*=ls>=0?0.8:0.5;pc*=d.catchMul;
  if(Math.random()<pc){
    const ws=slips.length,wg=gully>=0?0.5:0,r=off&&ws+wg>0?Math.random()*(1+ws+wg):9,
      i=r<ws?slips[Math.floor(r)]:r<ws+wg?gully:!off&&ls>=0&&Math.random()<0.5?ls:keeper, f=field[i], nm=fieldName(f);
    const dx=f.x-c.x,dz=f.z-c.z;
    return {runs:0,out:true,outText:i===keeper?'Caught behind':'Caught at '+nm,label:'Out!',sub:i===keeper?'Edged and caught behind':'Edged to '+nm,
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
  const reach=(2+4.5*Math.max(0,T-0.6))*(d.fSpeed/6.3)*(nf.f.c||1);
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
// bat: {tier}; scales the timing window (less for a block: a tail-ender can defend, not score), power and edges, and enables
// fends and hooking risk, and in Tests sweeps ({tier,t20:1} in T20: no sweeps). Without it: short formats
function evalSwing(b,sw,diffKey,field,bat){
  const T=bat?TIER[bat.tier]||TIER.A:null,fa=footAt(b,sw.bp),d={...DIFF[diffKey],fSpeed:DIFF[diffKey].fSpeed*ENV.run},dt=sw.tc-fa.t,early=dt<0,a=Math.abs(dt),
    c=fa.c,shot=T&&!bat.t20?shotForBall(sw.aim,b,fa.full):shotFor(sw.aim),mb=T&&shot.sweep&&!sw.defend?{bp:sweepBp(sw.bp)}:null,
    wm=(1+0.35*fa.gain)*(T?sw.defend?Math.pow(T.win,0.3):T.win*(mb?shot.tw:1):1),w=windows(diffKey,early,wm);
  const timing={dt,early,win:wm,
    label:a<=w.perfect?'Perfect':a<=w.good?'Good':a<=w.ok?(early?'Early':'Late'):a<=w.edge?(early?'Very early':'Very late'):(early?'Too early':'Too late'),
    zone:a<=w.perfect?3:a<=w.good?2:a<=w.ok?1:a<=w.edge?0:-1};
  if(!(fa.xc<0.98&&fa.xc>REACH_LEG&&c.y<2.05)){timing.label='Out of reach';timing.zone=-1;return {miss:true,timing,...mb};}
  if(a>w.edge)return {miss:true,timing,...mb};
  if(sw.defend)return {timing,res:resolveDefend(b,a<=w.ok,T&&{field,c,T})};
  const match=clamp(shotFit(shot,fa.full,fa.xc)*(1-0.5*fa.awk)*(mb?clamp(1-(c.y-0.75)*1.5,0.3,1):1)+0.25*fa.gain,0.1,1),name=sw.lofted?shot.loft:shot.name;
  let edge=a>w.ok,mishit=false;
  const mt=(sw.lofted?0.55:0.42)+(shot.risk||0),em=T?T.edge:1,hook=T&&shot===SHOTS[1]&&c.y>1.5;
  if(!edge&&match<mt&&Math.random()<(mt-match)*1.7*em){edge=true;mishit=true;}
  if(!edge&&sw.lofted&&a>w.good&&Math.random()<0.18*DIFF[diffKey].catchMul*em){edge=true;mishit=true;}
  if(T&&!edge&&T.xe&&a>w.perfect&&Math.random()<T.xe)edge=true;
  if(hook&&!edge&&Math.random()<0.12*em){edge=true;mishit=true;}
  if(edge){const r=resolveEdge(b,c,T&&mishit&&(shot.te||hook)?{...sw,lofted:true}:sw,field,d,mishit);r.shot=name;timing.mishit=mishit;if(mishit)timing.label+=' timing, wrong shot for that ball';return {timing,res:r};}
  const tq=a<=w.perfect?1:1-0.45*clamp((a-w.perfect)/(w.ok-w.perfect),0,1);
  const q=tq*(0.35+0.65*match),pw=sw.power*(T?T.pow:1);
  const dir=normAng(sw.aim+dt*300+gauss()*(1-q)*16);
  const r=sw.lofted?resolveAir(c,dir,q,pw,field,d):resolveGround(c,dir,q,pw,field,d);
  r.shot=name;r.q=q;r.match=match;
  if(r.boundary&&!r.sub)r.sub=name+(r.dist?', '+r.dist+' m':'')+(r.misfield?', misfield':'');
  return {timing,res:r};
}
// Hold (Tests): refuse the last run of an odd number, so the striker keeps the strike
function applyHold(res){
  if(res.boundary||res.out||res.wide||!(res.runs%2))return res;
  return {...res,runs:res.runs-1,held:true,label:res.runs>1?runLabel(res.runs-1):'Held',sub:'Kept the strike',cls:res.runs>1?'runs':'dot'};
}

/* ---------- AI bowler brain: remembers what each length and line costs it ---------- */
function bScore(mem,k){const s=mem[k]||{r:0,n:0,w:0},n=s.n+2;return (s.r+2.4)/n-5*s.w/n;}
/* footwork tendency (recent bp where the ball pitched): ch = charges, bk = goes back, ac = moves across to off */
function footTrend(ft,bp){ft.x+=((bp?bp.x:0)-ft.x)*0.2;ft.z+=((bp?bp.z:0)-ft.z)*0.2;return ft;}
function footPlan(ft){return ft?{ch:clamp((ft.z-0.25)/0.6,0,1),bk:clamp((-ft.z-0.1)/0.25,0,1),ac:clamp((ft.x-0.12)/0.25,0,1)}:null;}
const FOOT_LEN={ch:{Y:.7,F:.7,S:1.8,B:1.5},bk:{Y:1.5,F:1.6,S:.7,B:.7},ac:{Y:1.7,F:1.2,S:.8}};
const FOOT_LINE={ch:{wide:2.2,leg:.7},bk:{},ac:{mid:1.8,leg:1.3,wide:.6}};
const FOOT_NOTE={ch:'shorter and wider, you keep coming down the pitch',bk:'fuller, you keep going back',ac:'straight at the stumps, you keep moving across'};
const footMul=(fp,T,k)=>fp?['ch','bk','ac'].reduce((m,j)=>m*lerp(1,T[j][k]||1,fp[j]),1):1;
// ctx.bw (bowler profile) and ctx.plan (planPick) are T20 and Tests; ctx.cond (Tests) adds the bouncer limit (ctx.bouncers this
// over), the tail plan (ctx.tail: yorkers and bouncers), the rough line on day 4-5, spin variations, around the wicket and fatigue
function planBall(mem,type,diffKey,ctx){
  const d=DIFF[diffKey],bw=ctx.bw,mix=ctx.plan&&ctx.plan.mix,mk=bw?'b'+bw.i+':':'',lens=type==='pace'?['Y','F','G','S','B']:['Y','F','G','S'],C=ctx.cond;
  const base=mix?mix.len:type==='pace'?{Y:.7,F:1,G:1.6,S:.8,B:.45}:{Y:.3,F:1.3,G:1.7,S:.45};
  const last=ctx.last||[],fp=footPlan(ctx.foot);
  const lw=lens.map(L=>{
    let x=(base[L]||0.1)*(bw?bw.len[L]:1)*Math.exp(-d.k*1.5*bScore(mem,mk+type+':'+L))*footMul(fp,FOOT_LEN,L);
    if(ctx.pressure&&L==='Y')x*=1.9;
    if(ctx.pressure&&L==='B')x*=1.3;
    if(d.k>0.3&&last.length>=2&&last[last.length-1]===L&&last[last.length-2]===L)x*=0.3;
    if(C){if(ctx.tail)x*=L==='Y'?2.2:L==='B'?1.8:1;if(ctx.bouncers>=2&&type==='pace'&&(L==='B'||L==='S'))x=0;}
    return x;});
  const lines=C&&type==='spin'&&C.day>=4?['wide','off','mid','leg','rough']:['wide','off','mid','leg'],lb=mix?mix.line:{wide:.45,off:1.5,mid:1,leg:.55};
  const p={type,len:pick(lens,lw),line:pick(lines,lines.map(l=>(l==='rough'?(lb.rough||.6)*(C.day-3):lb[l])*footMul(fp,FOOT_LINE,l)*Math.exp(-d.k*1.2*bScore(mem,mk+'line:'+l)))),
    slower:type==='pace'&&Math.random()<d.slower*(bw?bw.slow*(mix.slow||1):1)*(ctx.pressure?1.5:1)};
  if(bw){p.mk=mk;p.pid=ctx.plan.id;p.sw=mix.sw;p.flat=mix.flat;p.dir=bw.dir*(bw.wrong&&Math.random()<bw.wrong*(mix.wrong||1)?-1:1);}
  if(C&&bw){
    p.fat=ctx.fat||0;p.ar=Math.random()<(mix.ar||0)+(ctx.tail&&type==='pace'?0.2:0);
    const V=TARCH[bw.arch]&&TARCH[bw.arch].var;
    if(type==='spin'&&p.dir!==bw.dir)p.var='googly';
    else if(V){let r=Math.random();for(const k in V)if((r-=V[k])<0){p.var=k;break;}}
    if(p.var==='doosra'||p.var==='carrom')p.dir=-bw.dir;
    if(p.var==='arm'||p.var==='top')p.dir=0;
  }
  return p;
}
function brainLearn(mem,b,runs,out){
  const mk=b.mk||'';
  for(const k of b.pid?[mk+b.type+':'+b.len,mk+'line:'+b.line,mk+'T:'+b.pid]:[b.type+':'+b.len,'line:'+b.line]){
    const s=mem[k]||(mem[k]={r:0,n:0,w:0});
    s.r+=runs;s.n++;if(out)s.w++;
    if(s.n>40){s.r*=40/s.n;s.w*=40/s.n;s.n=40;}
  }
}
function brainInsight(mem,type,ft){
  const fp=footPlan(ft),fk=fp&&['ch','bk','ac'].find(k=>fp[k]>=0.5);
  if(fk)return 'Bowler\u2019s plan: '+FOOT_NOTE[fk];
  const lens=type==='pace'?['Y','F','G','S','B']:['F','G','S'];
  let best=null,bs=1e9;
  for(const L of lens){const s=mem[type+':'+L];if(!s||s.n<4)continue;const sc=bScore(mem,type+':'+L);if(sc<bs){bs=sc;best=L;}}
  return best&&bs<0.9?'Bowler\u2019s plan: more '+LEN_NAME[best]:'';
}
function simulateAI(overs,wkts,diffKey,mul){
  const w=DIFF[diffKey].ai,keys=Object.keys(w);let runs=0,out=0,balls=0;
  while(balls<overs*6&&out<wkts){const o=pick(keys,keys.map(k=>w[k]));balls++;if(o==='W')out++;else runs+=+o;}
  return {runs:Math.round(runs*(mul||1)),wkts:out,balls};
}
/* ---------- T20 first innings: the player bowls, the AI bats ---------- */
// the player's deliveries and the AI batter's shots use medium physics (pace, swing, timing windows, fielding) on every level:
// difficulty is the release meter and the batter's skill (a harder DIFF would give the player faster bowlers and the batter
// tighter windows, i.e. make bowling easier)
const BOWL_D='medium',HEAD=1.85;
// delivery options (max 5 per bowler). v: pace x; sd: swing direction (+1 away from the right-hander), sw: swing x; cut: seam
// movement into the batter; tm: turn x; dir: turn direction x the bowler's (-1 wrong'un, 0 arm ball); L: suggested length
const OPTS={stock:{name:'Stock ball'},out:{name:'Outswinger',sd:1,sw:1.2},in:{name:'Inswinger',sd:-1,sw:1.2},
 yorker:{name:'Yorker',L:'Y'},bouncer:{name:'Bouncer',L:'B',v:1.03},slower:{name:'Slower ball',slower:1,L:'F'},cutter:{name:'Cutter',v:.88,cut:1},
 flight:{name:'Flighted',v:.9,tm:1.25,L:'F'},quick:{name:'Quicker one',v:1.1,tm:.55},wrong:{name:'Wrong\u2019un',dir:-1},arm:{name:'Arm ball',v:1.05,dir:0}};
function bowlOpts(bw){
  const k=bw.type==='pace'?[...(bw.sw>=1.2?['out','in']:['stock']),'yorker','bouncer','slower',...(bw.slow>=1.5?['cutter']:[])]
    :['stock','flight','quick',...(bw.wrong?['wrong']:[]),'arm'];
  return k.map(k=>({k,...OPTS[k]}));
}
// the player's attack: the XI's lower order (7-11), archetypes seeded per planet (a death specialist and a spinner, the rest suited
// to the conditions, as makeAttack picks the AI's)
function myAttack(pk){return makeAttack(pk,BOWL_D,seeded(hashStr('XI:'+pk))).map((b,i)=>({...b,name:XI[6+i].name,opts:bowlOpts(b)}));}
// the AI side's batting order: six batters named from the planet, then its five bowlers; tiers as the player's XI
function aiXI(pk,attack){
  const N=(NAMES[pk]||NAMES.earth).map(s=>s.split(' ')),one=a=>a[Math.floor(Math.random()*a.length)],names=new Set(attack.map(b=>b.name.slice(3))),bat=[];
  while(bat.length<6){const sn=one(N[0])+one(N[1]);if(names.has(sn))continue;names.add(sn);bat.push({name:'ABCDEFGHJKLMNPRSTVWZ'[Math.floor(Math.random()*20)]+'. '+sn,tier:XI[bat.length].tier});}
  return bat.concat(attack.map((b,i)=>({name:b.name,tier:XI[6+i].tier})));
}
// mean movement off the pitch of option o (m, + toward off)
function optDev(bw,o){
  const d=DIFF[BOWL_D];
  return bw.type==='pace'?(o.sd!=null?o.sd*0.9:bw.swDir*0.5)*bw.sw*(o.sw||1)*d.swing*ENV.swing-(o.cut?0.1:0)
    :o.dir===0?-bw.dir*0.05:(o.dir==null?1:o.dir)*bw.dir*(bw.turn[0]+bw.turn[1])/2*d.turn*(o.tm||1)*ENV.spin;
}
// the marker (pitch point) that sends option o from length z on to line xt at the stumps
function spotFor(bw,o,z,xt){const p=bw.type==='pace',zr=p?19:19.3,xr=p?0.3:0.22;return {x:xr+(xt-optDev(bw,o)-xr)*(zr-z)/zr,z};}
const LZ={Y:1.6,F:3.2,G:5.4,S:8,B:10.1};
const optSpot=(bw,o)=>spotFor(bw,o,LZ[o.L||'G'],0.12);
// release meter: rel in -1..1 (0 = centre); |rel| <= good is a good release, beyond bad a very bad one
const BOWL_W={easy:.16,medium:.11,hard:.075};
function bowlWindow(bw,diffKey){const w=BOWL_W[diffKey]*bw.acc/0.85;return {good:w,bad:3.5*w};}
const lenCode=z=>z<2.1?'Y':z<4.2?'F':z<7?'G':z<9.2?'S':'B',lineCode=x=>x>0.47?'wide':x>0.12?'off':x>-0.07?'mid':'leg';
// marker m = pitch point {x line at the bounce, z length}; rel = signed release error (early < 0 floats it up fuller, late > 0
// drags it into the pitch, shorter; null = no tap, a poor release). Line scatter and lost pace grow with the error; a very bad
// release is a wide, a full toss (early) or a long hop (late). Above head height at the popping crease is a wide (ICC playing conditions)
function bowlDelivery(bw,o,m,rel,diffKey){
  const d=DIFF[BOWL_D],pace=bw.type==='pace',W=bowlWindow(bw,diffKey);
  if(rel==null)rel=(Math.random()<0.5?-1:1)*W.good*rnd(2,3);
  const e=Math.abs(rel)/W.good,x=Math.max(0,e-1),sg=Math.sign(rel),zr=pace?19.0:19.3,yr=pace?2.15:1.95,xr=pace?0.3:0.22;
  let v=(pace?rnd(d.pace[0]*bw.pace[0],d.pace[1]*bw.pace[1]):rnd(...bw.v)*d.spd)*(o.v||1)*(1-0.04*Math.min(x,2))*ENV.pace;
  if(o.slower)v*=rnd(0.74,0.8);
  // the same release error moves a full ball's pitch point further (flatter descent): length error x ((zr-z)/(zr-5.4))^2
  const kz=clamp(((zr-m.z)/(zr-5.4))**2,0.5,2);
  let zb=clamp(m.z+sg*(0.25*Math.min(e,1)+2*x)*kz+gauss()*0.12*kz,-1.2,11.5),xb=m.x+gauss()*(0.03+0.1*(1-bw.acc)+0.15*x),wide=false;
  const dev=pace?clamp((o.sd!=null?o.sd*0.9+gauss()*0.45:bw.swDir*0.5+gauss())*bw.sw*(o.sw||1)*d.swing*ENV.swing-(o.cut?rnd(0.05,0.15):0),-0.65,0.65)
    :o.dir===0?-bw.dir*rnd(0.02,0.08):clamp((o.dir==null?1:o.dir)*bw.dir*rnd(...bw.turn)*d.turn*(o.tm||1)*ENV.spin,-0.65,0.65);
  if(e>3.5){if(Math.random()<0.5)wide=true;else zb=sg<0?rnd(-1.2,0.6):rnd(9.6,11);}
  let xt=xr+(xb-xr)*zr/(zr-zb)+dev;
  if(wide){xt=(Math.random()<0.7?1:-1)*rnd(1.0,1.25);xb=xr+(xt-dev-xr)*(zr-zb)/zr;}
  const b=launch({type:bw.type,len:lenCode(zb),line:lineCode(xt),slower:!!o.slower,opt:o.k,mk:'b'+bw.i+':',rel},v,zr,yr,xr,zb,xb,xt,dev,1);
  const y=ballPos(b,tAt(b,POPPING)).y;b.bouncer=y>SHOULDER;if(y>HEAD)b.wide=b.high=true;
  return b;
}
// AI batter skill by difficulty: sig = timing spread (s; x the planet's t20, measured so a medium full match is ~50% on every
// planet), read = share of a change of pace picked from the hand, mis = misreading of length and line x, foot = footwork x
const AIB={easy:{sig:.071,read:.5,mis:1.15,foot:.85},medium:{sig:.064,read:.6,mis:1,foot:1},hard:{sig:.058,read:.7,mis:.85,foot:1.15}};
const AI_LOFT={pp:.18,mid:.12,death:.3};
// how open direction a is [along the ground, lofted]: lofted, no boundary rider within 18 degrees; along the ground, the angle
// to the nearest fielder in the ring, less with a rider behind it
function gapAt(field,a){
  let gi=180,deep=false;
  for(const f of field){if(f.n==='keeper')continue;const d=Math.hypot(f.x,f.z),g=Math.abs(angDiff(a,Math.atan2(f.x,f.z)/D2R));
    if(d>BOUNDARY*0.6){if(g<18)deep=true;}else if(d>5&&g<gi)gi=g;}
  return [(0.35+0.65*clamp((gi-6)/22,0,1))*(deep?0.7:1),deep?0.35:1];
}
// the aims the AI batter weighs for each of SHOTS, and their gaps cached on the field array (fields are replaced, never moved)
const AIMS=SHOTS.map(s=>{const a=[];for(let x=s.lo+8;x<s.hi-4;x+=12)a.push(x);return a;});
const gapsOf=field=>field.gp||(field.gp=AIMS.map(xs=>xs.map(x=>gapAt(field,x))));
// the AI striker's input for delivery b, as a player's would be: {leave:true,bp} or the swing evalSwing takes
// ({tc,aim,power,lofted,defend,bp}). Length is read at release and line at the bat with an error (more for swing), smaller for a
// length the attack keeps bowling (st.bm: the batters learn the attack's lengths and each bowler's pace, so predictable bowling
// is easier to time, to use the feet to and to aim into a gap). Good length and yorkers at the stumps are harder to time, loose
// balls easier (half-volley, full toss, long hop, short and wide, on the pads); an unread slower ball makes it early. Footwork
// is committed on the length as read, within the joystick's speed limits: back to short balls, forward to good length (down
// the pitch to spin), across to off to flick an expected yorker. Shots: the best fit for the ball (SHOTS) toward a gap; lofts
// by phase and carry, more at a loose ball, fewer after quick wickets, with a rider there or without a lofted shot that fits
function aiBat(st,b,field){
  const S=AIB[st.diff],bt=st.bat[st.s],ti='ABCDE'.indexOf(bt.tier),ph=phaseOf(Math.floor(st.balls/6)),k=st.bm,
    a=clamp(((k.L[b.len]||0)-0.3)/0.4,0,1)*clamp(k.n/3,0,1),m=S.mis*(1-0.5*a),
    careful=bt.balls<4||st.fow.filter(f=>f.balls>st.balls-12).length>=2,zp=b.zb+gauss()*0.9*m;
  let bp=null;const fw=(0.55-0.1*ti)*S.foot;
  if(zp<2.3){if(Math.random()<S.foot*(0.15+0.8*a))bp={x:Math.min(0.35,2*b.t1),z:0};}
  else if(Math.random()<fw*(1+a)){
    if(zp>(b.type==='spin'?6.5:6))bp={x:0,z:-Math.min(2*b.t1,0.5)};
    else if(zp>3.6&&b.xb>-0.35&&b.xb<0.55)bp={x:0,z:clamp(zp-3.6,0,Math.min(2.5*b.t1,b.type==='spin'?1.5:0.4))};
  }
  const f=footAt(b,bp),xp=f.xc+gauss()*(0.08+(b.type==='pace'?1.5*Math.abs(b.dev):0))*m,fp=clamp(f.full+gauss()*0.05*m,0,1);
  if(xp<-0.6||xp>0.85&&Math.random()<0.6)return {leave:true,bp};
  const zm=b.zb-(bp?bp.z:0),slot=b.zb<0.9||zm>2.2&&zm<3.6||b.zb>9&&f.c.y<1.25||zm>6.5&&f.xc>0.45||zm<6&&f.xc<-0.08&&f.xc>-0.5,york=b.zb>=0.9&&b.zb<2.1?(Math.abs(b.xt)<0.3?1:0.5):0,
    h=(1+(0.35*lenDanger(f.full)+0.45*york)*(1-a))*(slot?0.6:1)*(1-0.5*a),
    tc=f.t-0.005+gauss()*S.sig*(PLANETS[st.pk]||PLANETS.earth).t20*h-(1-S.read)*f.t*(1-b.v/(k.v[st.bi]||(b.type==='pace'?35.7:22.5)*ENV.pace));
  if(careful&&h>1.2&&Math.random()<0.5)return {tc,aim:0,power:0.3,lofted:false,defend:true,bp};
  const best=[null,null],gw=0.15+0.75*a;
  const GP=gapsOf(field);
  SHOTS.forEach((s,i)=>{const ft=shotFit(s,fp,xp),p=ft**(3-a);AIMS[i].forEach((x,j)=>{for(const l of [0,1]){
    const g=GP[i][j][l],v=p*(1-gw+gw*g)*(1+(Math.random()-0.5)*0.5*m);if(!best[l]||v>best[l].v)best[l]={x,v,g,ft};}});});
  const lofted=Math.random()<AI_LOFT[ph]*ENV.carry*(1+0.1*ti)*(careful?0.5:1)*(slot?2.5:york?0.5:1)*(best[1].g===1?2:0.4)*clamp((best[1].ft-0.5)/0.3,0,1),c=best[lofted?1:0];
  return {tc,aim:c.x+gauss()*14,power:lofted?rnd(0.85,1):rnd(0.55,0.85),lofted,defend:false,bp};
}
// resolves the AI batter's input as the game's flight does (Simulate rest, balance)
function aiResult(b,sw,field,bat){
  if(sw.leave)return beaten(b,sw.bp,false,bat);
  const r=evalSwing(b,sw,BOWL_D,field,bat);return r.miss?beaten(b,r.bp||sw.bp,true,bat):r.res;
}
// first innings: the AI side bats its XI against the player's attack; shapes as newT20 (bw = the player's bowlers' figures, no
// target), plus the over's bowler, plan and field (bi, pid, field), the batters' read of the attack (bm: length shares, each
// bowler's pace), scoring zones (Z), footwork trend and recent lengths (ll) for the auto-captain and auto-bowler
function newInn1(attack,xi,diffKey,pk){
  return {pk,diff:diffKey,target:null,par:null,runs:0,balls:0,wkts:0,last:-1,bw:attack.map(()=>({o:0,b:0,r:0,w:0})),fow:[],ov:[],mem:{},
    bat:xi.map(p=>({name:p.name,tier:p.tier,runs:0,balls:0,out:false})),s:0,ns:1,bi:-1,pid:null,field:null,bm:{n:0,L:{},v:{}},Z:[0,0,0,0,0,0,0,0],foot:{x:0,z:0},ll:[]};
}
const PLAN_IDS={pace:['PA','PC','OF','SB','WY','SY','SL'],spin:['PS','OA','OC','LA','LC','CH']};
// the field plans offered for this bowler in this phase (all legal)
const planIds=(bw,pp)=>PLAN_IDS[bw.type].filter(id=>fieldOk(tplField(id),pp));
// the captain's suggestion for the next over: bowler (captainPick) and plan (planPick)
function inn1Suggest(st,attack){const o=Math.floor(st.balls/6),bi=captainPick(attack,o,st);return {bi,pid:bi<0?null:planPick(attack[bi],phaseOf(o),st,st.foot).id};}
function inn1Set(st,bi,pid){st.bi=bi;st.pid=pid;st.field=tplField(pid);}
// one ball: figures and strike (t20Record), the batters' read of the attack, zones, footwork trend, the plan's learning. True at
// the end of the over (st.bi is then -1 until the next over is set)
function inn1Record(st,b,res,bp){
  const k=st.bm,v=k.v[st.bi];
  k.n++;k.v[st.bi]=v==null?b.v:v+(b.v-v)*0.35;for(const L of 'YFGSB')k.L[L]=(k.L[L]||0)*0.7+(L===b.len?0.3:0);
  zoneAdd(st.Z,res.out?null:res.dir,res.wide?0:res.runs);footTrend(st.foot,bp);st.ll.push(b.len);if(st.ll.length>3)st.ll.shift();
  brainLearn(st.mem,{...b,pid:st.pid},res.runs,!!res.out);
  const done=t20Record(st,st.bi,res);if(done)st.bi=-1;return done;
}
// the auto-bowler (Simulate rest, balance): length, line and variation from the plan's mix, the bowler's lengths and what has cost
// runs (planBall on the player's side's mem, learning at the hard rate), the marker allowing for movement, release error
// ~ N(0, sig), default 0.09 (a human tap)
function autoBowl(st,bw,sig){
  const O=bw.opts,has=k=>O.find(o=>o.k===k),r=Math.random(),
    p=planBall(st.mem,bw.type,'hard',{last:st.ll,pressure:phaseOf(Math.floor(st.balls/6))==='death',foot:st.foot,bw,plan:{id:st.pid,mix:TPL[st.pid]}});
  const o=bw.type==='pace'?p.len==='Y'&&has('yorker')||p.len==='B'&&has('bouncer')||p.slower&&has('slower')||r<0.25&&has('cutter')||has(r<0.6?'out':'in')||has('stock')
    :p.dir!==bw.dir&&has('wrong')||p.len==='F'&&r<0.5&&has('flight')||r<0.25&&has('quick')||r>0.9&&has('arm')||has('stock');
  return {o,m:spotFor(bw,o,rnd(...LENS[p.len]),rnd(...LINES[p.line])),rel:gauss()*(sig==null?0.09:sig)};
}
function inn1Ball(st,bw,o,m,rel){
  const b=bowlDelivery(bw,o,m,rel,st.diff),sw=aiBat(st,b,st.field),res=aiResult(b,sw,st.field,{tier:st.bat[st.s].tier,t20:1});
  inn1Record(st,b,res,sw.bp);return {b,sw,res};
}
// plays the first innings out from wherever it stands (Simulate rest): auto-captain, auto-bowler, AI batter. The balance bots pass
// their own bowl(st,bw) -> {o,m,rel} and plan(st,bw,phase) -> template id
function simRest(st,attack,bowl,plan){
  const P=PLANETS[st.pk]||PLANETS.earth;
  while(st.balls<120&&st.wkts<10){
    if(st.bi<0){rollWind(P);const s=inn1Suggest(st,attack);inn1Set(st,s.bi,plan?plan(st,attack[s.bi],phaseOf(Math.floor(st.balls/6))):s.pid);}
    const bw=attack[st.bi],c=bowl?bowl(st,bw):autoBowl(st,bw);inn1Ball(st,bw,c.o,c.m,c.rel);
  }
  return st;
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

/* ---------- Scenarios: Test situations as data (all teams and names fictional) ---------- */
// lineup string: 'Name;tier;runs;balls|...' in batting order; band = intended win-rate band (%) for the standard balance bot
const lu=s=>s.split('|').map(p=>{const [name,tier,runs,balls]=p.split(';');return {name,tier,runs:+runs||0,balls:+balls||0};});
const atk=s=>s.split(' ').map(p=>{const [arch,f,o]=p.split(':');return {arch,fatigue:+f||0,oversLeft:o===''||o==null?null:+o};});
const MER='Meridian XI';
// the player's side: the Series lineup in full, also the T20 batting order
const XI=lu('A. Brennick;A|T. Voss;A|M. Calvane;A|D. Imrie;A|S. Pellow;B|K. Lathan;B|R. Quarry;C|J. Ashby;C|F. Marlow;D|L. Tenby;E|O. Gage;E');
const SCEN=[
 // ---- Series: a five-Test series against the Meridian XI; three moments per Test ----
 {id:'s1a',set:'series',test:1,team:MER,title:'The new ball',brief:'Meridian made 412. Your reply starts under cloud on day two. Ten overs without losing a wicket.',
  planet:'earth',diff:'easy',day:2,ballAge:0,oppText:'Meridian XI 412. You 0/0.',obj:{type:'survive',balls:60,wkts:1},
  lineup:lu('A. Brennick;A|T. Voss;A|M. Calvane;A|D. Imrie;A|S. Pellow;B|K. Lathan;B'),striker:0,nonStriker:1,
  attack:atk('swing:0:6 express:0:5 cutter off'),plan:'attack',stars:[{t:'win'},{t:'margin',runs:25},{t:'bonus',bat:{i:0,runs:20}}],band:[55,90]},
 {id:'s1b',set:'series',test:1,team:MER,title:'Save the follow-on',brief:'Fifty more and Meridian must bat again. Quarry is set; the tail is not.',
  planet:'earth',diff:'easy',day:3,ballAge:55,oppText:'Meridian XI 412. You 163/6.',obj:{type:'avoidFO',target:50,balls:120,wkts:4},
  lineup:lu('R. Quarry;C;31;58|J. Ashby;C|F. Marlow;D|L. Tenby;E|O. Gage;E'),striker:0,nonStriker:1,
  attack:atk('express:.3:3 death:0:4 swing off'),plan:'tail',stars:[{t:'win'},{t:'margin',wkts:2},{t:'bonus',tail:12}],band:[50,85]},
 {id:'s1c',set:'series',test:1,team:MER,title:'Sprint to stumps',brief:'Day four, chasing 360. Eight overs to stumps: a hundred and twenty of them tonight and the last day is yours.',
  planet:'earth',diff:'easy',day:4,ballAge:30,oppText:'Meridian XI 412 & 211. You 264 & 120/2.',obj:{type:'scoreBy',target:120,balls:48,wkts:6},
  lineup:lu('M. Calvane;A;44;61|D. Imrie;A;12;20|S. Pellow;B|K. Lathan;B|R. Quarry;C|J. Ashby;C|F. Marlow;D'),striker:0,nonStriker:1,
  attack:atk('cutter off sla:0:5 death:0:4'),plan:'contain',stars:[{t:'win'},{t:'margin',balls:6},{t:'bonus',sixes:4}],band:[50,85]},
 {id:'s2a',set:'series',test:2,team:MER,title:'Nightwatchman',brief:'Late on day two in thick, swinging air. Marlow goes in to shield Calvane until stumps. Lose both and the day is undone.',
  planet:'venus',diff:'medium',day:2,ballAge:22,oppText:'Meridian XI 301. You 188/3.',obj:{type:'survive',balls:54,wkts:2},
  lineup:lu('F. Marlow;D;0;0|M. Calvane;A;64;121|S. Pellow;B|K. Lathan;B|R. Quarry;C'),striker:0,nonStriker:1,
  attack:atk('swing:.3:3 express:0:4 cutter off'),plan:'attack',stars:[{t:'win'},{t:'margin',runs:12},{t:'bonus',noWkt:1}],band:[45,85]},
 {id:'s2b',set:'series',test:2,team:MER,title:'Reverse at the death',brief:'Day five. An old, scuffed ball and a fast bowler who knows how to hide it. Eighty-five to win in twenty overs.',
  planet:'venus',diff:'medium',day:5,ballAge:45,oppText:'Meridian XI 301 & 198. You 233 & 182/3.',obj:{type:'chase',target:85,balls:120,wkts:7},
  lineup:lu('M. Calvane;A;41;77|D. Imrie;A;6;15|S. Pellow;B|K. Lathan;B|R. Quarry;C|J. Ashby;C|L. Tenby;E|O. Gage;E'),striker:0,nonStriker:1,
  attack:atk('express:0:4 death:0:3 swing cutter off'),plan:'attack',stars:[{t:'win'},{t:'margin',wkts:4},{t:'bonus',bat:{i:0,runs:80}}],band:[35,70]},
 {id:'s2c',set:'series',test:2,team:MER,title:'Last pair',brief:'Nine down, twelve to win. Imrie is set and Gage can barely hold a bat. Keep Gage away from the strike.',
  planet:'venus',diff:'medium',day:5,ballAge:62,oppText:'Meridian XI 301 & 198. You 233 & 255/9.',obj:{type:'chase',target:12,balls:90,wkts:1},
  lineup:lu('D. Imrie;A;71;133|O. Gage;E;0;0'),striker:0,nonStriker:1,
  attack:atk('express:.2:3 death:0:4 swing off'),plan:'tail',stars:[{t:'win'},{t:'margin',balls:66},{t:'bonus',tail:4}],band:[25,60]},
 {id:'s3a',set:'series',test:3,team:MER,title:'Sweep your way',brief:'Day three on a dust bowl, two spinners and a straight field. A hundred and thirty by stumps keeps you in this Test. Sweep for them.',
  planet:'mercury',diff:'medium',day:3,ballAge:40,oppText:'Meridian XI 388. You 131/3.',obj:{type:'scoreBy',target:130,balls:36,wkts:5},
  lineup:lu('D. Imrie;A;35;50|S. Pellow;B;20;31|K. Lathan;B|R. Quarry;C|J. Ashby;C|F. Marlow;D'),striker:0,nonStriker:1,
  attack:atk('off:0:10 sla:0:10 leg cutter'),plan:'contain',stars:[{t:'win'},{t:'margin',runs:15},{t:'bonus',sixes:3}],band:[35,70]},
 {id:'s3b',set:'series',test:3,team:MER,title:'Session in the rough',brief:'Day four, last session. Meridian set 300 and spin into the footmarks from both ends. Lose no more than one wicket.',
  planet:'mercury',diff:'medium',day:4,ballAge:20,oppText:'Meridian XI 388 & 172/8d. You 261 & 41/2.',obj:{type:'survive',balls:90,wkts:2},
  lineup:lu('M. Calvane;A;18;37|D. Imrie;A;9;22|S. Pellow;B|K. Lathan;B|R. Quarry;C|J. Ashby;C|F. Marlow;D'),striker:0,nonStriker:1,
  attack:atk('off:0:8 leg:0:6 sla express'),plan:'attack',stars:[{t:'win'},{t:'margin',runs:20},{t:'bonus',noWkt:1}],band:[30,70]},
 {id:'s3c',set:'series',test:3,team:MER,title:'The final-day chase',brief:'Day five. The rough is wider, the turn sharper. A hundred and ninety to win in twenty overs with four wickets to lose.',
  planet:'mercury',diff:'medium',day:5,ballAge:30,oppText:'Meridian XI 388 & 172/8d. You 261 & 110/2.',obj:{type:'chase',target:190,balls:120,wkts:4},
  lineup:lu('M. Calvane;A;30;61|D. Imrie;A;24;40|S. Pellow;B|K. Lathan;B|R. Quarry;C|J. Ashby;C|F. Marlow;D'),striker:0,nonStriker:1,
  attack:atk('off:0:8 leg:0:6 sla express swing'),plan:'attack',stars:[{t:'win'},{t:'margin',balls:12},{t:'bonus',wkts:2}],band:[35,70]},
 {id:'s4a',set:'series',test:4,team:MER,title:'Short-ball barrage',brief:'A bouncy deck, two quicks round the wicket and a leg trap. Duck, sway or play: eight overs without losing a wicket.',
  planet:'mars',diff:'medium',day:2,ballAge:12,oppText:'Meridian XI 355. You 120/4.',obj:{type:'survive',balls:48,wkts:1},
  lineup:lu('D. Imrie;A;33;70|S. Pellow;B;14;29|K. Lathan;B|R. Quarry;C|J. Ashby;C|F. Marlow;D'),striker:0,nonStriker:1,
  attack:atk('express:0:5 express:0:4 death swing'),plan:'attack',stars:[{t:'win'},{t:'margin',runs:20},{t:'bonus',bat:{i:0,runs:50}}],band:[35,80]},
 {id:'s4b',set:'series',test:4,team:MER,title:'Lead with the tail',brief:'Ashby and the tail want a first-innings lead before the new ball is due. Thirty-eight more in six overs.',
  planet:'mars',diff:'medium',day:3,ballAge:74,oppText:'Meridian XI 355. You 318/7.',obj:{type:'scoreBy',target:38,balls:36,wkts:3},
  lineup:lu('J. Ashby;C;27;40|F. Marlow;D;2;6|L. Tenby;E|O. Gage;E'),striker:0,nonStriker:1,
  attack:atk('express:.2:3 death:0:4 swing cutter'),plan:'tail',stars:[{t:'win'},{t:'margin',balls:6},{t:'bonus',tail:14}],band:[30,65]},
 {id:'s4c',set:'series',test:4,team:MER,title:'Win or tie',brief:'The last over of the match. Twelve to win, eleven to tie, two wickets left.',
  planet:'mars',diff:'medium',day:5,ballAge:70,oppText:'Meridian XI 355 & 230. You 357 & 217/8.',obj:{type:'tieOrWin',target:12,balls:6,wkts:2},
  lineup:lu('R. Quarry;C;48;81|L. Tenby;E;3;11|O. Gage;E'),striker:0,nonStriker:1,
  attack:atk('death:.2:1 express'),plan:'tail',stars:[{t:'win'},{t:'margin',win:1},{t:'bonus',noWkt:1}],band:[30,65]},
 {id:'s5a',set:'series',test:5,team:MER,stage:{g:'s5',n:1,of:3},title:'Final day: morning',brief:'The decider. Two hundred to win on the last day, in three sessions. First, a hundred by lunch with wickets in hand.',
  planet:'saturn',diff:'medium',day:5,ballAge:8,oppText:'Meridian XI 302 & 241. You 344 & 0/0.',obj:{type:'session',target:200,par:100,balls:60,wkts:10},
  lineup:XI,striker:0,nonStriker:1,
  attack:atk('swing:0:6 express:0:5 cutter off leg'),plan:'attack',stars:[{t:'win'},{t:'margin',runs:15},{t:'bonus',noWkt:1}],band:[40,85]},
 {id:'s5b',set:'series',test:5,team:MER,stage:{g:'s5',n:2,of:3},title:'Final day: afternoon',brief:'After lunch: spin from both ends and an older ball. Fifty-five more by tea and keep the tail out of it.',
  planet:'saturn',diff:'medium',day:5,ballAge:18,oppText:'Meridian XI 302 & 241. You 344 & 100/2.',obj:{type:'session',target:100,par:55,balls:60,wkts:7},
  lineup:lu('M. Calvane;A;30;45|D. Imrie;A;12;20|S. Pellow;B|K. Lathan;B|R. Quarry;C|J. Ashby;C|F. Marlow;D|L. Tenby;E|O. Gage;E'),striker:0,nonStriker:1,
  attack:atk('off:0:8 leg:0:6 cutter swing express'),plan:'attack',stars:[{t:'win'},{t:'margin',runs:15},{t:'bonus',wkts:5}],band:[30,70]},
 {id:'s5c',set:'series',test:5,team:MER,stage:{g:'s5',n:3,of:3},title:'Final day: evening',brief:'The last session. Reverse swing, tired bowlers and the series on the line.',
  planet:'saturn',diff:'medium',day:5,ballAge:28,oppText:'Meridian XI 302 & 241. You 344 & 155/4.',obj:{type:'chase',target:45,balls:60,wkts:4},
  lineup:lu('S. Pellow;B;25;40|K. Lathan;B;10;18|R. Quarry;C|J. Ashby;C|F. Marlow;D|L. Tenby;E|O. Gage;E'),striker:0,nonStriker:1,
  attack:atk('express:.3:4 death:.2:3 swing:.4 off leg'),plan:'attack',stars:[{t:'win'},{t:'margin',balls:12},{t:'bonus',wkts:3}],band:[35,70]},
 // ---- Classics: one-off finishes. Numbers are inspired by famous Tests (docs/scenarios-mode.md); teams and names are invented ----
 {id:'c1',set:'classic',title:'Last-wicket heist',brief:'The last man walks out with twenty still needed. Strand is set at the other end. The number eleven must not face.',
  planet:'earth',diff:'medium',day:4,ballAge:52,oppText:'Northgate XI 179 & 246. You 67 & 339/9.',obj:{type:'chase',target:20,balls:150,wkts:1},
  lineup:lu('H. Strand;A;61;160|B. Quill;E;0;0'),striker:0,nonStriker:1,attack:atk('express:.2:4 swing:0:3 death off'),plan:'tail',
  stars:[{t:'win'},{t:'margin',balls:120},{t:'bonus',tail:6}],band:[10,45]},
 {id:'c2',set:'classic',title:'Two short',brief:'Thirty to win with two wickets left on the final morning. The ball is reversing and the quicks are fresh.',
  planet:'earth',diff:'medium',day:4,ballAge:58,oppText:'Harbour XI 407 & 182. You 308 & 252/8.',obj:{type:'chase',target:30,balls:150,wkts:2},
  lineup:lu('C. Durran;B;20;35|Y. Holt;D;4;12|Z. Arden;E'),striker:0,nonStriker:1,attack:atk('express:0:5 death:0:4 swing off'),plan:'tail',
  stars:[{t:'win'},{t:'margin',wkts:1},{t:'bonus',tail:10}],band:[15,50]},
 {id:'c3',set:'classic',title:'Hold out',brief:'Four overs left. Last pair. A ring of slips and a bowler steaming in.',
  planet:'earth',diff:'medium',day:5,ballAge:30,oppText:'Westmere XI 444 & 280/6d. You 302 & 371/9.',obj:{type:'survive',balls:24,wkts:1},
  lineup:lu('Y. Holt;D;9;30|Z. Arden;E;2;8'),striker:0,nonStriker:1,attack:atk('express:.2:2 swing:0:2 off'),plan:'attack',
  stars:[{t:'win'},{t:'margin',runs:4},{t:'bonus',sixes:1}],band:[15,55]},
 {id:'c4',set:'classic',title:'The long stand',brief:'Nine down and still behind. Sixty-nine balls to the close against spin and an old ball.',
  planet:'earth',diff:'easy',day:5,ballAge:65,oppText:'Valemouth XI 674/6d. You 435 & 233/9.',obj:{type:'survive',balls:69,wkts:1},
  lineup:lu('E. Fallow;C;12;40|B. Quill;E;0;0'),striker:0,nonStriker:1,attack:atk('off:0:8 leg:0:6 express swing'),plan:'attack',
  stars:[{t:'win'},{t:'margin',runs:12},{t:'bonus',tail:30}],band:[15,55]},
 {id:'c5',set:'classic',title:'Follow-on turnaround',brief:'Following on, three wickets left and barely ahead. Durran and the tail swing for a lead worth bowling at.',
  planet:'earth',diff:'medium',day:4,ballAge:40,oppText:'Fairhaven XI 401/9d. You 174 & 232/7.',obj:{type:'scoreBy',target:50,balls:150,wkts:3},
  lineup:lu('C. Durran;A;39;54|G. Rook;C;1;4|Y. Holt;D|Z. Arden;E'),striker:0,nonStriker:1,attack:atk('express:.3:3 swing:0:4 cutter off'),plan:'attack',
  stars:[{t:'win'},{t:'margin',runs:20},{t:'bonus',bat:{i:0,runs:100}}],band:[15,50]},
 {id:'c6',set:'classic',title:'Pace the chase',brief:'The last thirty overs of a long fourth-innings chase on a bouncy deck. Wickets in hand, but the rate is climbing.',
  planet:'mars',diff:'medium',day:5,ballAge:68,oppText:'Southreach XI 369 & 294. You 336 & 178/4.',obj:{type:'chase',target:150,balls:180,wkts:6},
  lineup:lu('N. Ellery;A;56;140|W. Pask;B;22;35|C. Durran;B|E. Fallow;C|G. Rook;C|Y. Holt;D|Z. Arden;E'),striker:0,nonStriker:1,
  attack:atk('express:.4:3 swing:.2:4 death cutter off'),plan:'attack',stars:[{t:'win'},{t:'margin',balls:24},{t:'bonus',wkts:4}],band:[30,70]},
 {id:'c7',set:'classic',title:'Level or win',brief:'The final over, against a spinner. Four to win, three to tie, one wicket left. Mender has the strike; Quill must not face.',
  planet:'earth',diff:'medium',day:5,ballAge:50,oppText:'Ashgrove XI 574/7d & 170/5d. You 397 & 344/9.',obj:{type:'tieOrWin',target:4,balls:6,wkts:1},
  lineup:lu('I. Mender;C;39;60|B. Quill;E;0;0'),striker:0,nonStriker:1,attack:atk('sla:0:1 off'),plan:'tail',
  stars:[{t:'win'},{t:'margin',win:1},{t:'bonus',inBalls:3}],band:[50,85]},
 {id:'c8',set:'classic',title:'One-run thriller',brief:'Last pair, seven to win, and the quicks bang it in at the body with a leg trap set.',
  planet:'neptune',diff:'medium',day:5,ballAge:75,oppText:'Tidewater XI 435/8d & 256. You 209 & 476/9.',obj:{type:'chase',target:7,balls:30,wkts:1},
  lineup:lu('V. Corrie;B;34;61|Z. Arden;E;0;0'),striker:0,nonStriker:1,attack:atk('express:.2:3 express:0:4 death'),plan:'tail',
  stars:[{t:'win'},{t:'margin',balls:18},{t:'bonus',tail:2}],band:[30,70]},
 {id:'c9',set:'classic',title:'Tail with the master',brief:'Thirty to win, eight down. Mender is in and in form; the two left with him are not.',
  planet:'earth',diff:'medium',day:5,ballAge:35,oppText:'Kestrel XI 428 & 192. You 405 & 186/8.',obj:{type:'chase',target:30,balls:150,wkts:2},
  lineup:lu('I. Mender;A;50;77|Y. Holt;D;0;0|B. Quill;E'),striker:0,nonStriker:1,attack:atk('express:0:4 swing:0:3 off leg'),plan:'tail',
  stars:[{t:'win'},{t:'margin',wkts:1},{t:'bonus',bat:{i:0,runs:75}}],band:[15,50]},
 {id:'c10',set:'classic',title:'Day-five collapse',brief:'Survive to tea on a wearing pitch. A leg-spinner is landing it in the rough. Two more wickets and it is lost.',
  planet:'mercury',diff:'medium',day:5,ballAge:42,oppText:'Brightwater XI 513 & 168/4d. You 551/6d & 69/4.',obj:{type:'survive',balls:90,wkts:2},
  lineup:lu('W. Pask;B;14;48|N. Ellery;A;21;62|C. Durran;B|E. Fallow;C|G. Rook;C|Y. Holt;D|Z. Arden;E'),striker:0,nonStriker:1,
  attack:atk('leg:0:10 off:0:8 express swing'),plan:'attack',stars:[{t:'win'},{t:'margin',runs:20},{t:'bonus',noWkt:1}],band:[25,65]}
];
const scenById=id=>SCEN.find(s=>s.id===id);
