/* ---------- loop ---------- */
function celCam(t){
  const sH=VIS.standsH,RT=BOUNDARY+7+sH*1.15,d=1.4*RT,h=0.75*RT,kn=(h-sH)/(d-RT),kf=(h-sH)/(d+RT);
  const Fw=Math.min(0.46*W*d/RT,0.5*H/(kn-kf)),HZw=H*0.86-Fw*kn;
  const u=smooth(clamp((t-1)/2.5,0,1)),a=Math.max(0,t-1)*6,ar=a*D2R;
  setCam(-d*Math.sin(ar)*u,lerp(CAM_Y,h,u),lerp(CAM_Z,-d*Math.cos(ar),u),a*u);
  F=baseF*Math.pow(Fw/baseF,u);HZ=lerp(baseHZ,HZw,u);
}
function updateCam(dt){
  if(S.cel)celCam(clock-S.cel.t0);
  else if(S.phase==='replay')rpCam(dt);
  else if(S.phase==='result'&&S.chase&&S.hit&&clock>=S.chase.t0){
    const b=hitPos(S.hit,clock-S.hitStart),ux=S.hit.ux,uz=S.hit.uz;
    let tx=b.x-ux*9,tz=b.z-uz*9;const r=Math.hypot(tx,tz),lim=BOUNDARY-4;if(r>lim){tx*=lim/r;tz*=lim/r;}
    const ty=clamp(b.y*0.75+1.8,1.8,9),yaw=Math.atan2(ux,uz)/D2R,k=1-Math.exp(-dt*5);
    setCam(lerp(cam.x,tx,k),lerp(cam.y,ty,k),lerp(cam.z,tz,k),cam.yaw+angDiff(yaw,cam.yaw)*k);
    HZ=lerp(HZ,H*0.5,k);
    S.trail3.push({x:b.x,y:b.y,z:b.z});if(S.trail3.length>14)S.trail3.shift();
  }else if(cam.x!==0||cam.y!==CAM_Y||cam.z!==CAM_Z||cam.yaw!==0||HZ!==baseHZ||F!==baseF){setCam(0,CAM_Y,CAM_Z,0);HZ=baseHZ;F=baseF;S.trail3=[];}
}
function update(dt){
  updateCam(dt);updateFx(dt);footUpdate(dt);
  if(S.deferred&&clock>=S.deferred.at){showOutcome(S.deferred.res,S.deferred.b);S.deferred=null;}
  switch(S.phase){
    case 'break':S.t+=dt;if(S.t>=S.breakDur)nextBall();break;
    case 'ready':S.t+=dt;if(S.t>=S.readyDur){S.phase='runup';S.t=0;S.bpos.x=S.bpos.z=0;recStart();}break;
    case 'runup':S.t+=dt;if(S.t>=S.runupDur)releaseBall();break;
    case 'flight':flightUpdate();break;
    case 'result':
      S.t+=dt;
      if(S.fanim){const f=S.fpos[S.fanim.i];if(f){const dx=S.fanim.x-f.x,dz=S.fanim.z-f.z,d=Math.hypot(dx,dz),st=S.fanim.speed*dt;
        if(d>0.3){const m=Math.min(st,d);f.x+=dx/d*m;f.z+=dz/d*m;f.run+=dt*14;f.mv=clock;}}}
      if(S.t>=S.resultDur)afterResult();break;
    case 'replay':rpUpdate(dt);break;
    case 'celebrate':{const t=clock-S.cel.t0;fwUpdate(dt,t);
      if(t>=1&&!S.cel.fly){S.cel.fly=true;$('#hud').hidden=true;hint('Tap to continue');}
      if(t>=6)showEnd();break;}
  }
}
function frame(now){
  const dt=Math.min(0.25,(now-clockPerf)/1000);clockPerf=now;
  if(!S.paused){clock+=dt;update(dt);}
  if(!S.paused&&S.phase==='result')recContact();
  const V=S.phase==='replay'?rpView():liveView();
  if(!S.paused&&(S.phase==='runup'||S.phase==='flight'||S.phase==='result'))recFrame(V);
  draw(V);requestAnimationFrame(frame);
}

