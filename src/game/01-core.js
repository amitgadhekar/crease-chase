const $=s=>document.querySelector(s);
const cvs=$('#scene'),ctx=cvs.getContext('2d');
const store={get(k,d){try{const v=localStorage.getItem('cc_'+k);return v?JSON.parse(v):d;}catch(e){return d;}},
             set(k,v){try{localStorage.setItem('cc_'+k,JSON.stringify(v));}catch(e){}},
             del(k){try{localStorage.removeItem('cc_'+k);}catch(e){}}};
const LENGTHS=[{overs:1,w:2},{overs:2,w:3},{overs:5,w:5},{overs:20,w:10,t20:1}];
const settings=Object.assign({mode:'chase',diff:'medium',len:1,netsW:5,planet:'earth',assist:true,sound:true},store.get('settings',{}));
// T20 is its own mode (menu card); settings.len is the Quick match length only (0-2). Saves from the old menu stored T20 as len 3
if(settings.len===3){settings.len=1;if(settings.mode==='chase')settings.mode='t20';}
if(!['chase','t20','nets','scen'].includes(settings.mode))settings.mode='chase';
const BALL_GAP=2;
let mem=store.get('mem',{});
const records=store.get('records',{});
try{for(const d in records)if(records[d]&&typeof records[d].p==='number')records[d]={short:records[d]};}catch(e){}
const KIT={you:{shirt:'#12606e',trim:'#f2b134',pants:'#e9edf0',helmet:'#15324d'},ai:{shirt:'#7a1f2b',pants:'#f1ece0',skin:'#b07a55'}};

let VIS=PLANETS.earth.vis,STARS=[],PARTS=[],lastDpr=1,flash=0;
let W=0,H=0,F=1,baseF=1,CX=0,HZ=0,baseHZ=0,hudBottom=80,stands=null,standsTop=0,standsBottom=0;
let LAND=false,followF=1,radarTop=80;const SAFE={l:0,r:0,b:0};
let clock=0,clockPerf=performance.now();
let M=null;
// the main menu is up: the camera shows the whole ground (menuCam) and frames render at 30 fps
const MENU={on:true};
const S={phase:'idle',t:0,paused:true,ball:null,pending:null,swing:null,aim:null,bat:{mode:'stance',t0:0,from:null,aim:0},
  res:null,hit:null,hitStart:0,trail:[],trail3:[],timing:null,stumps:null,fpos:[],fplay:[],fev:null,f0:0,cord:null,thr:null,resultDur:1,breakDur:1,runupDur:1,hintCount:0,bowlerZ:31,
  bpos:{x:0,z:0},stick:null,padNow:null,padHit:null};

/* ---------- sizing ---------- */
function resize(){
  const r=cvs.getBoundingClientRect();W=r.width;H=r.height;
  const dpr=lastDpr=Math.min(window.devicePixelRatio||1,2.5);
  cvs.width=Math.round(W*dpr);cvs.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  LAND=matchMedia('(orientation: landscape)').matches;
  const sp=getComputedStyle($('#safe'));SAFE.l=parseFloat(sp.paddingLeft)||0;SAFE.r=parseFloat(sp.paddingRight)||0;SAFE.b=parseFloat(sp.paddingBottom)||0;
  // landscape: a short view needs a longer lens so the batter isn't tiny; framed from the bowler's release down to the
  // stumps' base above the timing bar (H minus the home indicator). The chase and spider cameras keep the portrait lens.
  followF=Math.min(W*2.4,H*1.15);CX=W/2;
  if(M&&M.bowl){if(LAND)bowlLens(H-SAFE.b,0.42,0.82);else bowlLens(H,0.55,0.8);}
  else{Object.assign(HOME,{y:CAM_Y,z:CAM_Z,yaw:0});if(LAND){const h=H-SAFE.b;F=baseF=h*1.55;HZ=baseHZ=h*0.235;}else{F=baseF=followF;HZ=baseHZ=H*0.31;}}
  hudMeasure();
  skc.width=Math.round(W*dpr);skc.height=Math.round(H*dpr);glSize();
  sk.setTransform(dpr,0,0,dpr,0,0);
  if(S.cel)celCam(clock-S.cel.t0);else if(MENU.on)menuCam();
}
const cam={x:0,y:CAM_Y,z:CAM_Z,yaw:0,fx:0,fz:1,rx:1,rz:0};
// where the camera rests between balls: behind the batter, or (T20 first innings) behind the bowler's arm
const HOME={y:CAM_Y,z:CAM_Z,yaw:0};
// bowling view: end-on from behind the bowler's arm, raised, looking down the pitch (yaw 180: screen right is the leg side).
// No pitch, like every camera here: the lens and horizon are solved so the batter's feet (z 1.05) and a bouncer's length
// (z 12) land at fixed fractions yb, yn of the height h, so the batter and the marker's range stay the same size on any screen
const BOWL_CAM={y:6,z:34.1};
function bowlLens(h,yb,yn){
  const db=BOWL_CAM.z-BATS_Z,dn=BOWL_CAM.z-12;
  F=baseF=(yn-yb)*h/(BOWL_CAM.y*(1/dn-1/db));HZ=baseHZ=yb*h-BOWL_CAM.y*F/db;Object.assign(HOME,{y:BOWL_CAM.y,z:BOWL_CAM.z,yaw:180});
}
// screen point -> ground point (y 0), the inverse of proj(); null above the horizon
// the HUD's bottom edge (info text, replay tag) and the radar's top; again after a T20 HUD update (its slab changes height)
function hudMeasure(){
  const hud=$('#hud'),r=cvs.getBoundingClientRect();hudBottom=hud.hidden?70:hud.getBoundingClientRect().bottom-r.top;
  radarTop=LAND&&!hud.hidden?$('#targetSlab').getBoundingClientRect().bottom-r.top:hudBottom;
}
function unprojGround(sx,sy){
  if(sy-HZ<1)return null;const zc=cam.y*F/(sy-HZ),xc=(sx-CX)*zc/F;
  return {x:cam.x+xc*cam.rx+zc*cam.fx,z:cam.z+xc*cam.rz+zc*cam.fz};
}
function setCam(x,y,z,yaw){cam.x=x;cam.y=y;cam.z=z;cam.yaw=yaw;const a=yaw*D2R;cam.fx=Math.sin(a);cam.fz=Math.cos(a);cam.rx=Math.cos(a);cam.rz=-Math.sin(a);}
function toCam(x,y,z){const dx=x-cam.x,dz=z-cam.z;return [dx*cam.rx+dz*cam.rz,y-cam.y,dx*cam.fx+dz*cam.fz];}
function projC(c){if(c[2]<0.25)return null;const s=F/c[2];return {x:CX+c[0]*s,y:HZ-c[1]*s,s};}
function proj(x,y,z){return projC(toCam(x,y,z));}
function polyWorld(pts){const c=pts.map(p=>toCam(p[0],p[1],p[2])),N=0.3,out=[];
  for(let i=0;i<c.length;i++){const a=c[i],b=c[(i+1)%c.length],ia=a[2]>=N,ib=b[2]>=N;if(ia)out.push(a);
    if(ia!==ib){const t=(N-a[2])/(b[2]-a[2]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,N]);}}
  return out.map(projC);}
function fillPoly(pts,style){if(pts.length<3)return;ctx.fillStyle=style;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}
// a planet already on screen (previewed in the menu) is not rebuilt when the match starts
let shownP=null;
function applyPlanet(P){
  if(P===shownP)return;shownP=P;
  VIS=P.vis;curPlanet=Object.keys(PLANETS).find(k=>PLANETS[k]===P)||'earth';build3D();
  STARS=[];for(let i=0;i<140;i++)STARS.push({x:Math.random(),y:Math.random(),r:Math.random()<0.15?2:1.2,a:0.4+Math.random()*0.6});
  PARTS=[];const pv=VIS.particles;if(pv)for(let i=0;i<pv.n;i++)PARTS.push({x:Math.random(),y:Math.random(),s:rnd(0.6,1.4),p:Math.random()*6});
}
const aiKit=()=>Object.assign({skin:'#b07a55'},VIS.kit);

