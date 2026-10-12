const $=s=>document.querySelector(s);
const cvs=$('#scene'),ctx=cvs.getContext('2d');
const store={get(k,d){try{const v=localStorage.getItem('cc_'+k);return v?JSON.parse(v):d;}catch(e){return d;}},
             set(k,v){try{localStorage.setItem('cc_'+k,JSON.stringify(v));}catch(e){}}};
const LENGTHS=[{overs:1,w:2},{overs:2,w:3},{overs:5,w:5}];
const settings=Object.assign({mode:'chase',diff:'medium',len:1,netsW:5,planet:'earth',assist:true,sound:true},store.get('settings',{}));
if(settings.mode!=='chase'&&settings.mode!=='nets')settings.mode='chase';
const BALL_GAP=2;
let mem=store.get('mem',{});
const records=store.get('records',{});
const KIT={you:{shirt:'#12606e',trim:'#f2b134',pants:'#e9edf0',helmet:'#15324d'},ai:{shirt:'#7a1f2b',pants:'#f1ece0',skin:'#b07a55'}};

let VIS=PLANETS.earth.vis,STARS=[],PARTS=[],lastDpr=1,flash=0;
let W=0,H=0,F=1,baseF=1,CX=0,HZ=0,baseHZ=0,hudBottom=80,stands=null,standsTop=0,standsBottom=0;
let clock=0,clockPerf=performance.now();
let M=null;
const S={phase:'idle',t:0,paused:true,ball:null,pending:null,swing:null,aim:null,bat:{mode:'stance',t0:0,from:null,aim:0},
  res:null,hit:null,hitStart:0,trail:[],trail3:[],timing:null,stumps:null,fpos:[],fanim:null,resultDur:1,breakDur:1,runupDur:1,hintCount:0,bowlerZ:31,
  bpos:{x:0,z:0},stick:null,padNow:null,padHit:null};

/* ---------- sizing ---------- */
function resize(){
  const r=cvs.getBoundingClientRect();W=r.width;H=r.height;
  const dpr=lastDpr=Math.min(window.devicePixelRatio||1,2.5);
  cvs.width=Math.round(W*dpr);cvs.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  F=baseF=Math.min(W*2.4,H*1.15);CX=W/2;HZ=baseHZ=H*0.31;
  const hud=$('#hud');hudBottom=hud.hidden?70:hud.getBoundingClientRect().bottom-r.top;
  skc.width=Math.round(W*dpr);skc.height=Math.round(H*dpr);glSize();
  sk.setTransform(dpr,0,0,dpr,0,0);
  if(S.cel)celCam(clock-S.cel.t0);
}
const cam={x:0,y:CAM_Y,z:CAM_Z,yaw:0,fx:0,fz:1,rx:1,rz:0};
function setCam(x,y,z,yaw){cam.x=x;cam.y=y;cam.z=z;cam.yaw=yaw;const a=yaw*D2R;cam.fx=Math.sin(a);cam.fz=Math.cos(a);cam.rx=Math.cos(a);cam.rz=-Math.sin(a);}
function toCam(x,y,z){const dx=x-cam.x,dz=z-cam.z;return [dx*cam.rx+dz*cam.rz,y-cam.y,dx*cam.fx+dz*cam.fz];}
function projC(c){if(c[2]<0.25)return null;const s=F/c[2];return {x:CX+c[0]*s,y:HZ-c[1]*s,s};}
function proj(x,y,z){return projC(toCam(x,y,z));}
function polyWorld(pts){const c=pts.map(p=>toCam(p[0],p[1],p[2])),N=0.3,out=[];
  for(let i=0;i<c.length;i++){const a=c[i],b=c[(i+1)%c.length],ia=a[2]>=N,ib=b[2]>=N;if(ia)out.push(a);
    if(ia!==ib){const t=(N-a[2])/(b[2]-a[2]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,N]);}}
  return out.map(projC);}
function fillPoly(pts,style){if(pts.length<3)return;ctx.fillStyle=style;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}
function applyPlanet(P){
  VIS=P.vis;curPlanet=Object.keys(PLANETS).find(k=>PLANETS[k]===P)||'earth';build3D();
  STARS=[];for(let i=0;i<140;i++)STARS.push({x:Math.random(),y:Math.random(),r:Math.random()<0.15?2:1.2,a:0.4+Math.random()*0.6});
  PARTS=[];const pv=VIS.particles;if(pv)for(let i=0;i<pv.n;i++)PARTS.push({x:Math.random(),y:Math.random(),s:rnd(0.6,1.4),p:Math.random()*6});
}
const aiKit=()=>Object.assign({skin:'#b07a55'},VIS.kit);

