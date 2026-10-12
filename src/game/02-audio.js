/* ---------- audio ---------- */
let AC=null,noiseBuf=null,clapBuf=null,bus=null,am=null;
const AMB=0.03,rr=(a,b)=>a+Math.random()*(b-a);
function audio(){
  if(!settings.sound)return null;
  if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}
    const sr=AC.sampleRate;noiseBuf=AC.createBuffer(1,sr*2,sr);let d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    clapBuf=AC.createBuffer(1,sr*4,sr);d=clapBuf.getChannelData(0);const cl=sr*0.015|0;
    for(let n=0;n<300;n++){const p=Math.random()*(d.length-cl)|0,a=rr(0.3,1);for(let j=0;j<cl;j++)d[p+j]+=a*(Math.random()*2-1)*Math.exp(-j/(sr*0.003));}
    bus=AC.createGain();bus.gain.value=0.9;const c=AC.createDynamicsCompressor();
    c.threshold.value=-14;c.knee.value=10;c.ratio.value=12;c.attack.value=0.002;c.release.value=0.2;bus.connect(c);c.connect(AC.destination);}
  if(AC.state!=='running'){try{AC.resume().catch(()=>{});}catch(e){}}
  return AC;
}
['pointerdown','touchend'].forEach(ev=>addEventListener(ev,()=>{if(settings.sound)audio();},{passive:true,capture:true}));
document.addEventListener('visibilitychange',()=>{if(!AC)return;if(document.hidden)AC.suspend().catch(()=>{});else if(settings.sound)audio();});
function tone(type,f0,f1,dur,vol,w){const a=audio();if(!a)return;const t=a.currentTime+(w||0),o=a.createOscillator(),g=a.createGain();
  o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(0.0008,t);g.gain.linearRampToValueAtTime(vol,t+0.002);g.gain.exponentialRampToValueAtTime(0.0008,t+dur);o.connect(g).connect(bus);o.start(t);o.stop(t+dur+0.02);}
function noise(dur,vol,ftype,f0,f1,attack,w,q){const a=audio();if(!a)return;const t=a.currentTime+(w||0),s=a.createBufferSource(),fl=a.createBiquadFilter(),g=a.createGain();
  s.buffer=noiseBuf;s.loop=true;fl.type=ftype;fl.Q.value=q||1;fl.frequency.setValueAtTime(f0,t);fl.frequency.linearRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(0.0008,t);g.gain.linearRampToValueAtTime(vol,t+(attack||0.005));g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
  s.connect(fl).connect(g).connect(bus);s.start(t,Math.random()*1.5);s.stop(t+dur+0.05);}
function modal(ps,vol,w){ps.forEach(([f,d,v])=>{const j=rr(0.97,1.03);tone('sine',f*j,f*j*0.97,d,vol*v,w);});}
const FL=[300,420,560,720,880],FH=[1250,1600,1950,2300,2600];
function crowd(dur,vol,env,fs,n,k,w){const a=audio();if(!a)return;const t=a.currentTime+(w||0);
  for(let i=0;i<n;i++){const hi=i%3===2,f=(hi?FH:FL)[Math.random()*5|0]*(k||1)*rr(0.88,1.12),
      s=a.createBufferSource(),fl=a.createBiquadFilter(),ge=a.createGain(),ga=a.createGain(),lf=a.createOscillator(),lg=a.createGain();
    s.buffer=noiseBuf;s.loop=true;fl.type='bandpass';fl.Q.value=hi?3:5;fl.frequency.setValueAtTime(f,t);
    fs.forEach(([x,m])=>fl.frequency.linearRampToValueAtTime(f*m,t+x*dur));
    ge.gain.setValueAtTime(0,t);env.forEach(([x,l])=>ge.gain.linearRampToValueAtTime(vol*l*(hi?0.6:1),t+x*dur));
    ga.gain.value=0.75;lf.frequency.value=rr(2.5,6.5);lg.gain.value=0.25;lf.connect(lg).connect(ga.gain);
    s.connect(fl).connect(ge).connect(ga).connect(bus);s.start(t,Math.random()*1.5);s.stop(t+dur+0.05);lf.start(t);lf.stop(t+dur+0.05);}}
function clap(dur,vol,w){const a=audio();if(!a)return;const t=a.currentTime+(w||0),s=a.createBufferSource(),fl=a.createBiquadFilter(),g=a.createGain();
  s.buffer=clapBuf;fl.type='bandpass';fl.frequency.value=1900;fl.Q.value=0.7;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+dur*0.2);g.gain.linearRampToValueAtTime(vol*0.7,t+dur*0.6);g.gain.linearRampToValueAtTime(0,t+dur);
  s.connect(fl).connect(g).connect(bus);s.start(t);s.stop(t+Math.min(dur,3.9));}
function amb(on){
  if(!on){if(am){const x=am;am=null;x.g.gain.setTargetAtTime(0,AC.currentTime,0.2);setTimeout(()=>{try{x.s.stop();x.l.stop();}catch(e){}},1200);}return;}
  const a=audio();if(!a)return;if(am){am.g.gain.setTargetAtTime(AMB,a.currentTime,0.1);return;}
  const s=a.createBufferSource(),f1=a.createBiquadFilter(),f2=a.createBiquadFilter(),h=a.createGain(),m=a.createGain(),g=a.createGain(),l=a.createOscillator(),lg=a.createGain();
  s.buffer=noiseBuf;s.loop=true;f1.type=f2.type='bandpass';f1.frequency.value=480;f1.Q.value=0.6;f2.frequency.value=1500;f2.Q.value=1.2;h.gain.value=0.5;
  m.gain.value=0.8;l.frequency.value=0.13;lg.gain.value=0.2;l.connect(lg).connect(m.gain);
  g.gain.setValueAtTime(0,a.currentTime);g.gain.setTargetAtTime(AMB,a.currentTime,0.5);
  s.connect(f1).connect(m);s.connect(f2).connect(h).connect(m);m.connect(g).connect(bus);s.start();l.start();am={s,l,g};
}
function batKind(r){const t=(r.label||'')+' '+(r.sub||'');return /top edge/i.test(t)?'top':/edge/i.test(t)?'edge':r.shot==='Block'?'block':'mid';}
const sfx={
  bat(k,q,pw){q=q==null?0.3:q;pw=pw==null?0.6:pw;const v=0.35+0.5*q*(0.5+0.5*pw),b=0.94+0.12*q;
    if(k==='block'){tone('sine',170,80,0.09,0.4);noise(0.05,0.3,'lowpass',700,300,0.004);}
    else if(k==='edge'){modal([[1900,0.03,1],[3300,0.025,0.6]],0.45);noise(0.02,0.4,'bandpass',4200,3500,0.002,0,2);}
    else if(k==='top'){modal([[480,0.09,1],[870,0.07,0.7],[1250,0.05,0.4]],0.4);tone('sine',150,70,0.1,0.35);[0.03,0.055,0.08].forEach(w=>noise(0.02,0.12,'bandpass',1500,1200,0.002,w,1.5));}
    else{modal([[1050*b,0.09,1],[2300*b,0.06,0.7],[3800*b,0.04,0.5],[5400*b,0.03,0.25]],v);tone('sine',230,110,0.05,v*0.6);noise(0.02,v,'bandpass',3200,2500,0.002,0,0.8);}},
  contact(r,s){sfx.bat(batKind(r),r.q,s&&s.power);},
  swing(pw){pw=pw||0.6;noise(0.28,0.25+0.4*pw,'bandpass',500+400*pw,1500+1800*pw,0.11,0,1.3);},
  keeper(v){v=v==null?1:v;tone('sine',190,85,0.1,0.55*v);noise(0.05,0.4*v,'lowpass',1100,500,0.003);noise(0.03,0.3*v,'bandpass',2400,1800,0.002,0,1);},
  catch(w){tone('sine',230,120,0.07,0.3,w);noise(0.05,0.3,'bandpass',1800,1200,0.002,w,0.9);noise(0.06,0.2,'lowpass',900,400,0.003,w);},
  bounce(){tone('sine',140,60,0.09,0.42);noise(0.05,0.2,'lowpass',500,250,0.004);},
  stumps(){[[0,820],[0.022,740],[0.05,900]].forEach(([w,f])=>{tone('triangle',f,f*0.8,0.08,0.22,w);noise(0.04,0.3,'bandpass',2200,1500,0.002,w,1);});
    [0.012,0.04,0.075,0.12,0.18].forEach(w=>{const f=rr(2600,5000);tone('sine',f,f,0.14,0.07,w);});tone('sine',120,60,0.15,0.3);},
  cheer(big,dist){
    if(!big){crowd(1.7,0.5,[[0,0],[0.12,1],[0.5,0.75],[1,0]],[[0.4,1.15]],5);clap(1.6,0.14,0.2);return;}
    const s=Math.min(1,(dist||60)/100);
    crowd(2.6+1.2*s,0.46+0.24*s,[[0,0],[0.1,1],[0.6,0.85],[1,0]],[[0.3,1.2]],7+(s*3|0));clap(2.4+s,0.15,0.3);},
  groan(w){crowd(1.5,0.45,[[0,0],[0.25,1],[1,0]],[[1,0.6]],4,0.75,w);},
  gasp(w){crowd(0.95,0.42,[[0,0],[0.3,1],[1,0]],[[0.3,1.35],[1,1.05]],5,1.15,w);},
  end(kind){
    if(kind==='win'){crowd(3.8,0.7,[[0,0],[0.1,1],[0.75,0.9],[1,0]],[[0.3,1.15],[0.8,1]],9);clap(3.6,0.2,0.3);}
    else if(kind==='loss'){crowd(1.6,0.4,[[0,0],[0.25,1],[1,0]],[[1,0.7]],4,0.8);clap(2.6,0.18,0.6);}
    else if(kind==='tie'){sfx.gasp();clap(1.6,0.12,0.5);}},
  amb,
  duck(d){if(am)am.g.gain.setTargetAtTime(d?0.004:AMB,AC.currentTime,0.15);},
  fwLaunch(){tone('sine',500,2400,0.75,0.12);noise(0.75,0.25,'bandpass',1500,5000,0.2,0,2);},
  fwBoom(dist){dist=dist||0;const w=dist*0.5,v=1-0.6*dist;
    tone('sine',110,38,0.55,0.6*v,w);noise(0.6,0.7*v,'lowpass',1800-1200*dist,200,0.01,w);
    for(let i=0;i<12;i++)noise(0.025,0.3*v,'bandpass',rr(3000,6000)*(1-0.6*dist),2500,0.002,w+0.15+Math.random()*0.8,1);},
  tick(){tone('sine',1200,1000,0.03,0.05);},
  thunder(){noise(2.2,0.28,'lowpass',260,70,0.08);}
};

