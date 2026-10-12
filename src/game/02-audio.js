/* ---------- audio ---------- */
let AC=null,noiseBuf=null;
function audio(){
  if(!settings.sound)return null;
  if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}
    noiseBuf=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  if(AC.state==='suspended')AC.resume();
  return AC;
}
function tone(type,f0,f1,dur,vol){const a=audio();if(!a)return;const t=a.currentTime,o=a.createOscillator(),g=a.createGain();
  o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0008,t+dur);o.connect(g).connect(a.destination);o.start(t);o.stop(t+dur+0.02);}
function noise(dur,vol,ftype,f0,f1,attack){const a=audio();if(!a)return;const t=a.currentTime,s=a.createBufferSource(),fl=a.createBiquadFilter(),g=a.createGain();
  s.buffer=noiseBuf;fl.type=ftype;fl.frequency.setValueAtTime(f0,t);fl.frequency.linearRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(0.0008,t);g.gain.linearRampToValueAtTime(vol,t+(attack||0.005));g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
  s.connect(fl).connect(g).connect(a.destination);s.start(t);s.stop(t+dur+0.05);}
const sfx={
  bat(q){tone('triangle',700+700*q,260,0.11,0.35+0.4*q);noise(0.06,0.4,'bandpass',2600,1800);},
  bounce(){tone('sine',150,70,0.08,0.25);},
  stumps(){[0,40,90].forEach(ms=>setTimeout(()=>{tone('square',900,500,0.05,0.12);noise(0.05,0.25,'highpass',3000,2500);},ms));},
  cheer(big){noise(big?2.2:1.5,big?0.35:0.22,'bandpass',700,1500,0.25);},
  groan(){noise(1.2,0.18,'lowpass',900,300,0.1);},
  tick(){tone('sine',1200,1000,0.03,0.05);},
  thunder(){noise(2.2,0.28,'lowpass',260,70,0.08);}
};

