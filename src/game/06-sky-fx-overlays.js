/* ---------- drawing ---------- */
function line(x1,y1,x2,y2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function drawBody(b,y0,y1){
  const x=b.x*W-yawShift,y=lerp(y0,y1,b.y),r=b.r*W;
  if(b.t==='sun'){const g=sk.createRadialGradient(x,y,0,x,y,r*3);g.addColorStop(0,b.c);g.addColorStop(0.33,b.c);g.addColorStop(0.36,'rgba(255,240,200,.45)');g.addColorStop(1,'rgba(255,240,200,0)');
    sk.fillStyle=g;sk.beginPath();sk.arc(x,y,r*3,0,7);sk.fill();return;}
  if(b.t==='earth'){const g=sk.createRadialGradient(x-r*.35,y-r*.35,r*.1,x,y,r);g.addColorStop(0,'#8fd3ff');g.addColorStop(.7,'#2b6fc0');g.addColorStop(1,'#123a74');
    sk.fillStyle=g;sk.beginPath();sk.arc(x,y,r,0,7);sk.fill();sk.save();sk.clip();
    sk.fillStyle='#3f8f4a';[[-.3,-.1,.35,.22],[.25,.25,.28,.18],[.1,-.45,.2,.12]].forEach(([a,b2,c,d])=>{sk.beginPath();sk.ellipse(x+a*r,y+b2*r,c*r,d*r,.5,0,7);sk.fill();});
    sk.fillStyle='rgba(255,255,255,.7)';[[-.1,.05,.5,.06],[.2,-.25,.4,.05]].forEach(([a,b2,c,d])=>{sk.beginPath();sk.ellipse(x+a*r,y+b2*r,c*r,d*r,-.2,0,7);sk.fill();});
    sk.fillStyle='rgba(0,0,0,.45)';sk.beginPath();sk.arc(x+r*.55,y+r*.2,r,0,7);sk.fill();sk.restore();return;}
  const g=sk.createRadialGradient(x-r*.35,y-r*.35,r*.1,x,y,r);g.addColorStop(0,b.c1);g.addColorStop(1,b.c2);
  sk.fillStyle=g;sk.beginPath();sk.arc(x,y,Math.max(1.5,r),0,7);sk.fill();
}
function drawSky(top){
  const v=VIS;if(top<=2)return;
  sk.save();sk.beginPath();sk.rect(0,0,W,top);sk.clip();
  const y0=Math.min(hudBottom+8,top*0.5),y1=Math.max(y0+10,top-8);
  if(v.stars)for(const st of STARS){sk.globalAlpha=st.a*v.stars;sk.fillStyle='#fff';sk.fillRect(((st.x*W-yawShift)%W+W)%W,st.y*top,st.r,st.r);}
  sk.globalAlpha=1;
  if(v.bands)for(let i=0;i<9;i++){const y=top*(0.05+i*0.11);sk.globalAlpha=0.33;sk.fillStyle=v.bands[i%v.bands.length];sk.beginPath();sk.moveTo(0,y);
    for(let x=0;x<=W+20;x+=20)sk.lineTo(x,y+Math.sin(x*0.018+i*1.7+clock*0.12)*7);sk.lineTo(W,y+top*0.08);sk.lineTo(0,y+top*0.08);sk.fill();}
  sk.globalAlpha=1;
  if(v.clouds)for(let i=0;i<6;i++){const cx=((i*0.23+clock*0.006*(1+i%3))%1.4-0.2)*W,cy=lerp(y0,top,0.15+(i%3)*0.3);
    sk.fillStyle='rgba(255,236,180,.33)';sk.beginPath();sk.ellipse(cx,cy,W*0.32,top*0.07,0,0,7);sk.fill();}
  for(const b of v.bodies||[])drawBody(b,y0,y1);
  if(v.rings){sk.save();sk.translate(W*0.5,top*1.35);sk.rotate(-0.13);
    [[0,12,'rgba(250,240,215,.8)'],[16,5,'rgba(196,170,120,.75)'],[26,16,'rgba(255,248,228,.65)'],[46,4,'rgba(180,156,110,.7)']].forEach(([o,w,c])=>{
      sk.strokeStyle=c;sk.lineWidth=w;sk.beginPath();sk.ellipse(0,0,W*0.95+o*2,top*0.75+o,0,Math.PI,2*Math.PI);sk.stroke();});
    sk.restore();}
  sk.restore();
}
function updateFx(dt){
  const pv=VIS.particles;
  if(pv)for(const q of PARTS){q.x+=(pv.vx+WIND.x*0.004)*q.s*dt;q.y+=pv.vy*q.s*dt;q.p+=dt;q.x=(q.x%1+1)%1;q.y=(q.y%1+1)%1;}
  if(VIS.lightning){flash=Math.max(0,flash-dt*2.5);if(Math.random()<dt*0.12){flash=1;setTimeout(()=>sfx.thunder(),300+Math.random()*700);}}
}
function drawFx(){
  const pv=VIS.particles;
  if(pv){ctx.fillStyle=pv.color;for(const q of PARTS){ctx.globalAlpha=pv.alpha*(0.6+0.4*Math.sin(q.p*3));ctx.fillRect(q.x*W+Math.sin(q.p)*4,q.y*H,pv.size*q.s,pv.size*q.s);}ctx.globalAlpha=1;}
  if(flash>0){ctx.fillStyle='rgba(255,245,230,'+(flash*flash*0.45)+')';ctx.fillRect(0,0,W,H);}
}
/* ---------- fireworks: simulated here, drawn as glowing 3D points by fw3D (07-arena) ---------- */
const FW={r:[],p:[],next:0,sl:-9,sb:-9},FW_MAX=600,FW_PAL=[['#ffd36b','#fff1c2','#ffa94d'],['#ff5d73','#ffd0d8','#ff9a5c'],['#6fd6ff','#e0f8ff','#a38cff'],['#8dff8a','#f4ffc2','#5df2c8']];
function fwReset(){FW.r.length=FW.p.length=0;}
function fwUpdate(dt,t){
  const sH=VIS.standsH,RT=BOUNDARY+7+sH*1.15;
  if(t<4.6&&clock>=FW.next){FW.next=clock+rnd(0.18,0.42);
    for(let k=Math.random()<0.3?2+(Math.random()*2|0):1;k>0;k--){const a=Math.random()*7,roof=Math.random()<0.65,r=roof?RT:rnd(0,0.6)*BOUNDARY,x=Math.sin(a)*r,z=Math.cos(a)*r;
      FW.r.push({x0:x,y0:roof?sH:0,z0:z,x1:x+rnd(-5,5),y1:sH+rnd(0.6,1.2)*RT,z1:z+rnd(-5,5),t0:clock,T:rnd(0.9,1.3)});}
    if(clock-FW.sl>0.25){FW.sl=clock;sfx.fwLaunch();}}
  FW.r=FW.r.filter(q=>clock-q.t0<q.T||(fwBurst(q.x1,q.y1,q.z1,RT),false));
  const dk=Math.exp(-1.5*dt),g=G*0.5*dt;
  FW.p=FW.p.filter(p=>{p.age+=dt;p.vx*=dk;p.vy=p.vy*dk-g;p.vz*=dk;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;return p.age<p.life;});
}
function fwBurst(x,y,z,RT){
  const n=Math.min(40+(Math.random()*41|0),FW_MAX-FW.p.length),pal=FW_PAL[Math.random()*FW_PAL.length|0],ring=Math.random()<0.3,sp=RT*rnd(0.33,0.46),life=rnd(1.5,2.3);
  const b=Math.random()*7,c=rnd(-0.6,0.6),e1=[Math.cos(b),0,Math.sin(b)],e2=[-Math.sin(b)*Math.sin(c),Math.cos(c),Math.cos(b)*Math.sin(c)];
  for(let i=0;i<n;i++){let d;
    if(ring){const a=i/n*2*Math.PI,ca=Math.cos(a),sa=Math.sin(a);d=[e1[0]*ca+e2[0]*sa,e2[1]*sa,e1[2]*ca+e2[2]*sa];}
    else{const u=Math.random()*2-1,a=Math.random()*2*Math.PI,s=Math.sqrt(1-u*u);d=[s*Math.cos(a),u,s*Math.sin(a)];}
    const v=sp*(ring?1:rnd(0.7,1));FW.p.push({x,y,z,vx:d[0]*v,vy:d[1]*v,vz:d[2]*v,age:0,life:life*rnd(0.8,1.1),c:pal[i%pal.length]});}
  if(clock-FW.sb>0.15){FW.sb=clock;sfx.fwBoom(clamp(Math.hypot(x-cam.x,y-cam.y,z-cam.z)/(3*RT),0,1));}
}
function ballNow(){
  if(S.phase==='flight'){const sw=S.swing,t0=clock-S.ball.start,t=sw&&sw.cp&&!sw.missed?t0+sw.dl*clamp((t0-sw.tc)/SWING_DELAY+1,0,1):t0,p=ballPos(S.ball,S.padNow?Math.min(t,S.padNow.t):t);return p.z>-2.2?p:null;}
  if(S.phase==='result'){
    if(S.hit)return hitPos(S.hit,clock-S.hitStart);
    if(S.padHit){const h=S.padHit,u=clock-h.t0;return {x:h.x+0.15*Math.min(u,0.6),y:Math.max(0,h.y+0.6*u-4.9*u*u),z:h.z+0.5*Math.min(u,0.6)};}
    if(S.ball&&!S.res.out&&!S.stumps){const t=clock-S.ball.start;const p=ballPos(S.ball,t);return p.z>-2.2?p:null;}
  }
  return null;
}
function drawAim(){
  const a=S.aim;if(!a)return;const dx=a.x-a.x0,dy=a.y-a.y0,L=Math.hypot(dx,dy),Lm=dragMax();
  ctx.save();ctx.lineWidth=1.5;ctx.setLineDash([5,6]);ctx.strokeStyle='rgba(255,255,255,.55)';
  ctx.beginPath();ctx.arc(a.x0,a.y0,Lm,0,7);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.arc(a.x0,a.y0,5,0,7);ctx.fill();
  let label='Block';
  if(L>=14){
    ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;line(a.x0,a.y0,a.x,a.y);
    const loft=S.loft,col=loft?'#ffb627':'#f6f1e3',ang=Math.atan2(-dy,-dx),ex=a.x0+Math.cos(ang)*Math.min(L,Lm),ey=a.y0+Math.sin(ang)*Math.min(L,Lm);
    ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=5;ctx.lineCap='round';line(a.x0,a.y0,ex,ey);
    ctx.beginPath();ctx.moveTo(ex+Math.cos(ang)*12,ey+Math.sin(ang)*12);ctx.lineTo(ex+Math.cos(ang+2.4)*12,ey+Math.sin(ang+2.4)*12);ctx.lineTo(ex+Math.cos(ang-2.4)*12,ey+Math.sin(ang-2.4)*12);ctx.fill();
    const sh=shotOf(aimDeg(dx,dy),S.phase==='flight'?S.ball:null);label=loft?sh.loft:sh.name;
  }
  ctx.font='700 15px "Barlow",system-ui,sans-serif';ctx.textAlign='center';ctx.lineWidth=3.5;ctx.strokeStyle='rgba(0,0,0,.6)';
  ctx.font='800 19px "Barlow",system-ui,sans-serif';const ty=hudBottom+26;
  ctx.strokeText(label,W/2,ty);ctx.fillStyle='#fff';ctx.fillText(label,W/2,ty);ctx.restore();
}
function drawRadar(bp){
  if(!M)return;
  // Tests: a square-root radial scale opens up the close catchers (slips, short leg, silly point) around the bat
  const R=clamp(W*0.12,36,58),cx=W-R-10,cy=hudBottom+R+10,k=R/(BOUNDARY+3),tst=!!M.sc;
  const P=tst?(x,z)=>{const d=Math.hypot(x,z),s=d>1e-3?R*Math.sqrt(d/(BOUNDARY+3))/d:0;return [cx+x*s,cy-z*s];}:(x,z)=>[cx+x*k,cy-z*k];
  ctx.save();ctx.fillStyle='rgba(18,52,30,.72)';ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.fill();
  ctx.strokeStyle='rgba(244,239,225,.85)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(cx,cy,tst?R*Math.sqrt(BOUNDARY/(BOUNDARY+3)):BOUNDARY*k,0,7);ctx.stroke();
  const rc=27.43*BOUNDARY/65;if(!tst){ctx.setLineDash([2,3]);ctx.strokeStyle='rgba(255,255,255,.5)';ctx.beginPath();ctx.arc(cx,cy,rc*k,0,7);ctx.stroke();ctx.setLineDash([]);}
  ctx.fillStyle='#d8c08a';
  if(tst){ctx.beginPath();[[-1.5,-1],[1.5,-1],[1.5,21],[-1.5,21]].forEach(([x,z],i)=>{const [a,b]=P(x,z);i?ctx.lineTo(a,b):ctx.moveTo(a,b);});ctx.fill();}
  else{const [px,py]=P(-1.5,21);ctx.fillRect(px,py,3*k+1,22*k);}
  ctx.strokeStyle='#f2b134';ctx.lineWidth=1.2;
  S.fpos.forEach((p,i)=>{const f=M.field[i];if(!f)return;const [x,y]=P(p.x,p.z),fx=f.n==='keeper'||f.n==='bowler';ctx.fillStyle=fx?'rgba(239,232,210,.55)':'#efe8d2';ctx.beginPath();ctx.arc(x,y,tst&&!fx&&Math.hypot(f.x,f.z)<18?1.8:2.2,0,7);ctx.fill();
    if(M.t20&&!fx&&Math.hypot(f.x,f.z)>rc){ctx.beginPath();ctx.arc(x,y,4.2,0,7);ctx.stroke();}});
  if(S.aim){const dx=S.aim.x-S.aim.x0,dy=S.aim.y-S.aim.y0,L=Math.hypot(dx,dy);if(L>=14){const a=aimDeg(dx,dy)*D2R,len=clamp(L/dragMax(),0.3,1)*BOUNDARY;
    ctx.strokeStyle=S.loft?'#ffb627':'#fff';ctx.lineWidth=2;const [x,y]=P(Math.sin(a)*len,Math.cos(a)*len);line(cx,cy,x,y);}}
  if(S.phase==='result'&&S.hit&&bp){S.trail.push(P(bp.x,bp.z));ctx.strokeStyle='rgba(255,120,100,.8)';ctx.lineWidth=1.5;ctx.beginPath();S.trail.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
    const [x,y]=S.trail[S.trail.length-1];ctx.fillStyle='#ff5a4a';ctx.beginPath();ctx.arc(x,y,3,0,7);ctx.fill();}
  ctx.fillStyle='#ff5a4a';ctx.beginPath();ctx.arc(cx,cy,2.4,0,7);ctx.fill();
  const wv=Math.hypot(WIND.x,WIND.z);
  if(wv>0.5){const ux=WIND.x/wv,uz=WIND.z/wv,ax=cx-ux*R*0.55,ay=cy+uz*R*0.55,bx=cx+ux*R*0.55,by=cy-uz*R*0.55,an=Math.atan2(by-ay,bx-ax);
    ctx.strokeStyle='#9fe3ff';ctx.fillStyle='#9fe3ff';ctx.lineWidth=2;line(ax,ay,bx,by);
    ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx-Math.cos(an-0.5)*7,by-Math.sin(an-0.5)*7);ctx.lineTo(bx-Math.cos(an+0.5)*7,by-Math.sin(an+0.5)*7);ctx.fill();
    ctx.font='700 12.5px "Barlow",system-ui,sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.55)';
    const t='Wind '+Math.round(wv*3.6)+' km/h';ctx.strokeText(t,cx,cy+R+15);ctx.fillStyle='#fff';ctx.fillText(t,cx,cy+R+15);}
  ctx.restore();
}
function drawTimingBar(){
  const T=S.timing;if(!T||!M)return;
  const we=windows(M.diff,true,T.win),wl=windows(M.diff,false,T.win),bw=Math.min(320,W*0.8),x0=(W-bw)/2,y=H-40,h=10;
  const ppx=bw/(we.edge+wl.edge),c0=x0+we.edge*ppx,X=t=>c0+t*ppx;
  const zones=[[-we.edge,-we.ok,'#8b3a3a'],[-we.ok,-we.good,'#d99a2b'],[-we.good,-we.perfect,'#9bc53d'],[-we.perfect,wl.perfect,'#3ec46d'],
               [wl.perfect,wl.good,'#9bc53d'],[wl.good,wl.ok,'#d99a2b'],[wl.ok,wl.edge,'#8b3a3a']];
  ctx.save();ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(x0-4,y-4,bw+8,h+8);
  for(const [a,b,c] of zones){ctx.fillStyle=c;ctx.fillRect(X(a),y,X(b)-X(a),h);}
  const mx=clamp(X(T.dt),x0-2,x0+bw+2);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(mx,y-2);ctx.lineTo(mx-7,y-13);ctx.lineTo(mx+7,y-13);ctx.fill();
  ctx.font='600 12.5px "Barlow",system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,.85)';
  ctx.textAlign='left';ctx.fillText('Early',x0,y+h+15);ctx.textAlign='right';ctx.fillText('Late',x0+bw,y+h+15);
  ctx.textAlign='center';ctx.font='700 15px "Barlow",system-ui,sans-serif';
  const ms=Math.round(Math.abs(T.dt)*1000),txt=T.label+(T.zone===3||T.mishit||T.label==='Out of reach'?'':', '+ms+' ms '+(T.early?'early':'late'));
  ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.55)';ctx.strokeText(txt,W/2,y-18);ctx.fillStyle='#fff';ctx.fillText(txt,W/2,y-18);ctx.restore();
}
function drawInfo(){
  if(!M||S.aim)return;let txt='';
  const pace=M.bowlerType==='pace';
  if(S.phase==='ready')txt='Next ball in '+Math.max(1,Math.ceil(S.readyDur-S.t));
  else if(S.phase!=='result')txt=bowlerLabel();
  else if(S.ball)txt=(pace?'Pace':'Spin')+', '+S.ball.kmh+' km/h';
  if(!txt)return;ctx.save();ctx.font='700 15px "Barlow",system-ui,sans-serif';ctx.textAlign='left';
  ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.5)';ctx.strokeText(txt,12,hudBottom+22);ctx.fillStyle='#fff';ctx.fillText(txt,12,hudBottom+22);ctx.restore();
}
