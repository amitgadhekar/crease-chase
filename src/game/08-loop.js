/* ---------- loop ---------- */
function updateCam(dt){
  if(S.phase==='result'&&S.chase&&S.hit&&clock>=S.chase.t0){
    const b=hitPos(S.hit,clock-S.hitStart),ux=S.hit.ux,uz=S.hit.uz;
    let tx=b.x-ux*9,tz=b.z-uz*9;const r=Math.hypot(tx,tz),lim=BOUNDARY-4;if(r>lim){tx*=lim/r;tz*=lim/r;}
    const ty=clamp(b.y*0.75+1.8,1.8,9),yaw=Math.atan2(ux,uz)/D2R,k=1-Math.exp(-dt*5);
    setCam(lerp(cam.x,tx,k),lerp(cam.y,ty,k),lerp(cam.z,tz,k),cam.yaw+angDiff(yaw,cam.yaw)*k);
    HZ=lerp(HZ,H*0.5,k);
    S.trail3.push({x:b.x,y:b.y,z:b.z});if(S.trail3.length>14)S.trail3.shift();
  }else if(cam.x!==0||cam.y!==CAM_Y||cam.z!==CAM_Z||cam.yaw!==0||HZ!==baseHZ){setCam(0,CAM_Y,CAM_Z,0);HZ=baseHZ;S.trail3=[];}
}
function update(dt){
  updateCam(dt);updateFx(dt);
  if(S.deferred&&clock>=S.deferred.at){showOutcome(S.deferred.res,S.deferred.b);S.deferred=null;}
  switch(S.phase){
    case 'break':S.t+=dt;if(S.t>=S.breakDur)nextBall();break;
    case 'ready':S.t+=dt;if(S.t>=S.readyDur){S.phase='runup';S.t=0;}break;
    case 'runup':S.t+=dt;if(S.t>=S.runupDur)releaseBall();break;
    case 'flight':flightUpdate();break;
    case 'result':
      S.t+=dt;
      if(S.fanim){const f=S.fpos[S.fanim.i];if(f){const dx=S.fanim.x-f.x,dz=S.fanim.z-f.z,d=Math.hypot(dx,dz),st=S.fanim.speed*dt;
        if(d>0.3){const m=Math.min(st,d);f.x+=dx/d*m;f.z+=dz/d*m;f.run+=dt*14;f.mv=clock;}}}
      if(S.t>=S.resultDur)afterResult();break;
  }
}
function frame(now){
  const dt=Math.min(0.25,(now-clockPerf)/1000);clockPerf=now;
  if(!S.paused){clock+=dt;update(dt);}
  draw();requestAnimationFrame(frame);
}

