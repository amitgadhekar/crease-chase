/* ---------- audio ---------- */
let AC=null,noiseBuf=null,bus=null,am=null,ambOn=false;
const SFXBUF={},AMB=0.12,rr=(a,b)=>a+Math.random()*(b-a),jit=r=>rr(1-r,1+r);
function audio(){
  if(!settings.sound)return null;
  if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}
    const sr=AC.sampleRate;noiseBuf=AC.createBuffer(1,sr*2,sr);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    bus=AC.createGain();bus.gain.value=0.9;const c=AC.createDynamicsCompressor();
    c.threshold.value=-14;c.knee.value=10;c.ratio.value=12;c.attack.value=0.002;c.release.value=0.2;bus.connect(c);c.connect(AC.destination);
    Object.entries(SFX_DATA).forEach(([k,v])=>{const r=atob(v),u=new Uint8Array(r.length);for(let i=0;i<r.length;i++)u[i]=r.charCodeAt(i);
      AC.decodeAudioData(u.buffer).then(b=>{SFXBUF[k]=b;if(k==='crowd'&&ambOn)amb(true);}).catch(()=>{});});}
  if(AC.state!=='running'){try{AC.resume().catch(()=>{});}catch(e){}}
  return AC;
}
['pointerdown','touchend'].forEach(ev=>addEventListener(ev,()=>{if(settings.sound)audio();},{passive:true,capture:true}));
document.addEventListener('visibilitychange',()=>{if(!AC)return;if(document.hidden)AC.suspend().catch(()=>{});else if(settings.sound)audio();});
function play(name,o){o=o||{};const a=audio(),b=SFXBUF[name];if(!a||!b)return;
  const s=a.createBufferSource(),g=a.createGain();s.buffer=b;s.playbackRate.value=o.rate||1;g.gain.value=o.vol==null?1:o.vol;
  if(o.lp){const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;s.connect(f).connect(g);}else s.connect(g);
  g.connect(bus);s.start(a.currentTime+(o.delay||0));}
function amb(on){
  ambOn=on;
  if(!on){if(am){const x=am;am=null;x.g.gain.setTargetAtTime(0,AC.currentTime,0.2);setTimeout(()=>{try{x.s.stop();}catch(e){}},1200);}return;}
  const a=audio();if(!a)return;if(am){am.g.gain.setTargetAtTime(AMB,a.currentTime,0.1);return;}
  const b=SFXBUF.crowd;if(!b)return;
  const s=a.createBufferSource(),g=a.createGain();s.buffer=b;s.loop=true;s.loopStart=0.04;s.loopEnd=b.duration-0.04;
  g.gain.setValueAtTime(0,a.currentTime);g.gain.setTargetAtTime(AMB,a.currentTime,0.5);s.connect(g).connect(bus);s.start(0,s.loopStart);am={s,g};
}
function batKind(r){const t=(r.label||'')+' '+(r.sub||'');return /top edge/i.test(t)?'top':/edge/i.test(t)?'edge':r.shot==='Block'?'block':'mid';}
const sfx={
  bat(k,q,pw){q=q==null?0.3:q;pw=pw==null?0.6:pw;const rate=jit(0.04),v=jit(0.08);
    if(k==='block')play('block',{vol:0.8*v,rate});
    else if(k==='edge')play('edge',{vol:0.7*v,rate});
    else if(k==='top')play('mishit',{vol:0.9*v,rate});
    else play('bat',{vol:(0.55+0.45*q*(0.5+0.5*pw))*v,rate});},
  contact(r,s){sfx.bat(batKind(r),r.q,s&&s.power);},
  swing(pw){pw=pw||0.6;play('swing',{vol:0.25+0.35*pw,rate:jit(0.06)});},
  keeper(v){play('gloves',{vol:0.9*(v==null?1:v),rate:jit(0.04)});},
  catch(w){play('gloves',{vol:0.9,rate:jit(0.04),delay:w});},
  bounce(){play('bounce',{vol:0.45,rate:jit(0.04)});},
  stumps(){play('stumps',{vol:0.6,rate:jit(0.03)});},
  cheer(big,dist){
    if(!big){play('cheer',{vol:0.55});return;}
    play('roar',{vol:0.35+0.4*Math.min(1,(dist||60)/100)});},
  groan(w){play('groan',{vol:0.5,delay:w});},
  gasp(w){play('gasp',{vol:0.45,delay:w});},
  end(kind){
    if(kind==='win'){play('roar',{vol:0.8});play('cheer',{vol:0.4,delay:0.4});}
    else if(kind==='loss')play('applause',{vol:0.5});
    else if(kind==='tie'){play('gasp',{vol:0.45});play('applause',{vol:0.45,delay:0.9});}},
  amb,
  duck(d){if(am)am.g.gain.setTargetAtTime(d?0.02:AMB,AC.currentTime,0.15);},
  fwLaunch(){play('fwLaunch',{vol:0.4,rate:jit(0.06)});},
  fwBoom(dist){dist=dist||0;play('fwBurst',{vol:0.95-0.55*dist,lp:12000-9000*dist,delay:dist*0.5});},
  thunder(){const a=audio();if(!a)return;const t=a.currentTime,s=a.createBufferSource(),fl=a.createBiquadFilter(),g=a.createGain();
    s.buffer=noiseBuf;s.loop=true;fl.type='lowpass';fl.frequency.setValueAtTime(260,t);fl.frequency.linearRampToValueAtTime(70,t+2.2);
    g.gain.setValueAtTime(0.0008,t);g.gain.linearRampToValueAtTime(0.28,t+0.08);g.gain.exponentialRampToValueAtTime(0.0008,t+2.2);
    s.connect(fl).connect(g).connect(bus);s.start(t,Math.random()*1.5);s.stop(t+2.25);}
};
