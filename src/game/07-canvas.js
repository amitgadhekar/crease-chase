// Procedural 2D-canvas texture painters. Seeded (never Math.random, that is the game's RNG) so textures are identical every run.
function prng(s){return ()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const cvSs=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const cvCl=(x,a=0,b=255)=>x<a?a:x>b?b:x;
function cvCol(s){
  if(s[0]==='#'){let h=s.slice(1);if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];const n=parseInt(h,16);return[n>>16&255,n>>8&255,n&255,1];}
  const m=s.match(/[\d.]+/g).map(Number);return[m[0],m[1],m[2],m.length>3?m[3]:1];}
const cvRgb=(c,a=1)=>`rgba(${cvCl(c[0])|0},${cvCl(c[1])|0},${cvCl(c[2])|0},${a})`;
const cvShade=(s,k,a=1)=>{const c=cvCol(s);return cvRgb([c[0]*k,c[1]*k,c[2]*k],a);};
const cvMix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
function cvHsl(c){const r=c[0]/255,g=c[1]/255,b=c[2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;
  if(!d)return[0,0,l];const s=d/(1-Math.abs(2*l-1));let h=mx===r?((g-b)/d+6)%6:mx===g?(b-r)/d+2:(r-g)/d+4;return[h*60,s,l];}
function cvFromHsl(h,s,l){h=((h%360)+360)%360;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));return[f(0)*255,f(8)*255,f(4)*255];}
function cvH(x,y,s){let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041)|0;h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296;}
// P>0 wraps the lattice every P cells (tileable)
function cvVn(x,y,s,P){
  let x0=Math.floor(x),y0=Math.floor(y);const fx=x-x0,fy=y-y0,u=fx*fx*(3-2*fx),w=fy*fy*(3-2*fy);let x1=x0+1,y1=y0+1;
  if(P){x0=(x0%P+P)%P;x1=(x1%P+P)%P;y0=(y0%P+P)%P;y1=(y1%P+P)%P;}
  const a=cvH(x0,y0,s),b=cvH(x1,y0,s),c=cvH(x0,y1,s),d=cvH(x1,y1,s);return a+(b-a)*u+(c-a)*w+(a-b-c+d)*u*w;}
// draws fn at the 9 tile offsets so strokes crossing an edge wrap around
function cvWrap(g,n,fn){for(let i=-1;i<2;i++)for(let j=-1;j<2;j++){g.save();g.translate(i*n,j*n);fn();g.restore();}}

function paintGround(c,v,Rd,Rb){
  const n=1024;c.width=n;c.height=n;const g=c.getContext('2d'),im=g.createImageData(n,n),d=im.data,b0=cvCol(v.ground[0]),b1=cvCol(v.ground[1]),ss=v.stripe*0.8;
  for(let py=0;py<n;py++){const z=(py+.5)/n*2*Rd-Rd,t=z/5,idx=Math.floor(t),f=t-idx,sg=(idx&1?1:-1)*cvSs(0,.35,Math.min(f,1-f)*5);
    for(let px=0;px<n;px++){
      const x=(px+.5)/n*2*Rd-Rd,sq=cvSs(0,1.2,11-Math.abs(x))*cvSs(0,1.2,15-Math.abs(z-10.06)),r=Math.hypot(x,z),yb=cvVn(x/22,z/22,3)-.5;
      let k=1+sg*ss*(1-.2*sq)+(cvVn(x/16,z/16,1)-.5)*.05+(cvVn(x/6,z/6,2)-.5)*.03+sq*(.012+(cvVn(x*4,z*4,4)-.5)*.012);
      k*=1-.1*cvSs(Rb,Rd,r)+(cvH(px,py,9)-.5)*.03;
      const o=cvMix(b0,b1,cvSs(.85*Rb,1.12*Rb,r)*.85),i=(py*n+px)*4;
      d[i]=cvCl(o[0]*k*(1+yb*.07));d[i+1]=cvCl(o[1]*k*(1+yb*.03));d[i+2]=cvCl(o[2]*k*(1-yb*.12));d[i+3]=255;}}
  g.putImageData(im,0,0);
}

function paintGrassDetail(c){
  const n=256,r=prng(1234);c.width=n;c.height=n;const g=c.getContext('2d');
  g.fillStyle='rgb(128,128,128)';g.fillRect(0,0,n,n);g.lineCap='round';
  for(let i=0;i<2600;i++){const x=r()*n,y=r()*n,a=(r()-.5)*1.3+(r()<.15?Math.PI/2:0),l=4+r()*9,dark=r()<.5;
    g.strokeStyle=dark?`rgba(20,40,10,${.1+r()*.16})`:`rgba(255,255,215,${.08+r()*.14})`;g.lineWidth=.6+r()*.7;
    cvWrap(g,n,()=>{g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+Math.sin(a)*l*.5+(r()-.5)*2,y-Math.cos(a)*l*.5,x+Math.sin(a)*l,y-Math.cos(a)*l);g.stroke();});}
  const im=g.getImageData(0,0,n,n),d=im.data;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,v0=d[i],lo=cvVn(x/16,y/16,7,16)-.5,sp=cvH(x,y,11)-.5,tn=cvVn(x/32,y/32,8,8)-.5;
    const v=v0+lo*8+sp*12;d[i]=cvCl(v+tn*7+1,96,164);d[i+1]=cvCl(v+tn*3+4,96,164);d[i+2]=cvCl(v-tn*4-9,96,164);}
  g.putImageData(im,0,0);
}

function paintGrassNormal(c){
  const n=256,strength=.35;c.width=n;c.height=n;const g=c.getContext('2d'),im=g.createImageData(n,n),d=im.data,h=new Float32Array(n*n),O=[[8,.35,21],[16,.4,22],[32,.5,23],[64,.35,24],[128,.2,25]];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){let s=0;for(const[P,a,sd]of O)s+=a*cvVn(x/n*P,y/n*P,sd,P);h[y*n+x]=s;}
  const dx=new Float32Array(n*n),dy=new Float32Array(n*n);let ss=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x,a=(h[y*n+(x+1)%n]-h[y*n+(x+n-1)%n])*.5,b=(h[((y+1)%n)*n+x]-h[((y+n-1)%n)*n+x])*.5;dx[i]=a;dy[i]=b;ss+=a*a+b*b;}
  const S=strength/Math.sqrt(ss/(2*n*n));
  for(let i=0;i<n*n;i++){let nx=-dx[i]*S,ny=-dy[i]*S,nz=1;const L=Math.hypot(nx,ny,nz);nx/=L;ny/=L;nz/=L;
    d[i*4]=(nx*.5+.5)*255;d[i*4+1]=(ny*.5+.5)*255;d[i*4+2]=(nz*.5+.5)*255;d[i*4+3]=255;}
  g.putImageData(im,0,0);
}

function paintPitch(c,v){
  const W=512,H=3072,K=128,r=prng(777),X=x=>(x+2)*K,Z=z=>(z+1.94)*K;c.width=W;c.height=H;
  const g=c.getContext('2d'),im=g.createImageData(W,H),d=im.data,p0=cvCol(v.pitch[0]),p1=cvCol(v.pitch[1]),gr=cvCol(v.ground[0]);
  for(let py=0;py<H;py++){const z=(py+.5)/K-1.94;
    for(let px=0;px<W;px++){
      const x=(px+.5)/K-2,e=Math.min(1.525-Math.abs(x),z+1.64,21.76-z)+(cvVn(x*28,z*28,5)-.5)*.022;if(e<-.02)continue;
      const w=cvSs(0,.5,Math.min(z-1.56,18.56-z))*cvSs(0,.4,.8-Math.abs(x)+(cvVn(x*6,z*6,6)-.5)*.2);
      let o=cvMix(p0,p1,w*.42+(cvVn(x*1.3,z*.6,4)-.5)*.25);
      const k=1+(cvVn(x*14,z*1.2,3)-.5)*.035+(cvVn(x*40,z*40,2)-.5)*.045+(cvH(px,py,1)-.5)*.06;
      o=cvMix(gr,o,cvSs(0,.09,e)*.85+.15*(e>0?1:0));const i=(py*W+px)*4;
      d[i]=cvCl(o[0]*k);d[i+1]=cvCl(o[1]*k);d[i+2]=cvCl(o[2]*k);d[i+3]=cvSs(-.015,.07,e)*255;}}
  g.putImageData(im,0,0);
  const dark=cvShade(v.pitch[1],.5),dust=cvShade(v.pitch[0],1.1);
  const blob=(cx,cz,rx,rz,col,a)=>{g.save();g.translate(X(cx),Z(cz));g.scale(rx*K,rz*K);const q=g.createRadialGradient(0,0,0,0,0,1);q.addColorStop(0,cvShade(col,1,a));q.addColorStop(1,cvShade(col,1,0));
    g.fillStyle=q;g.beginPath();g.arc(0,0,1,0,7);g.fill();g.restore();};
  const scuffs=(cx,cz,rx,rz,nn,a)=>{for(let i=0;i<nn;i++){const ox=(r()+r()+r()-1.5)*.67,oz=(r()+r()+r()-1.5)*.67,fall=1-Math.min(1,Math.hypot(ox,oz)*1.3),lt=r()<.3;
    g.fillStyle=lt?cvShade(v.pitch[0],1.12,a*.6*fall):cvShade(v.pitch[1],.35+r()*.4,a*(.35+.65*r())*fall);g.beginPath();g.ellipse(X(cx+ox*2*rx),Z(cz+oz*2*rz),.7+r()*2.4,.5+r()*1.8,r()*3,0,7);g.fill();}};
  const scrapes=(cx,cz,rx,rz,nn,a)=>{g.lineCap='round';for(let i=0;i<nn;i++){const x=X(cx+(r()-.5)*2*rx),y=Z(cz+(r()-.5)*2*rz),an=(r()-.5)*.9+(r()<.25?.9:0),l=8+r()*34,mx=x+Math.sin(an)*l*.5+(r()-.5)*6,my=y+Math.cos(an)*l*.5,ex=x+Math.sin(an)*l,ey=y+Math.cos(an)*l;
    g.lineWidth=1+r()*1.4;g.strokeStyle=cvShade(v.pitch[0],1.1,.4*a);g.beginPath();g.moveTo(x+1.2,y);g.quadraticCurveTo(mx+1.2,my,ex+1.2,ey);g.stroke();
    g.strokeStyle=cvShade(v.pitch[1],.5,a*.7);g.lineWidth*=.8;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(mx,my,ex,ey);g.stroke();}};
  const dent=(x,z)=>{const q=g.createRadialGradient(X(x),Z(z),0,X(x),Z(z),4.6);q.addColorStop(0,cvShade(v.pitch[1],.32,.75));q.addColorStop(.55,cvShade(v.pitch[1],.55,.4));q.addColorStop(.8,cvShade(v.pitch[0],1.1,.25));q.addColorStop(1,cvShade(v.pitch[0],1,0));
    g.fillStyle=q;g.beginPath();g.arc(X(x),Z(z),4.6,0,7);g.fill();};
  g.strokeStyle=cvShade(v.pitch[1],.38,.42);g.lineWidth=.9;g.lineJoin='round';
  for(let i=0;i<9;i++){let x=X((r()-.5)*2),y=Z(6+r()*8),a=Math.PI/2+(r()-.5)*.5;const len=40+r()*170,br=[];
    g.lineWidth=.6+r()*.7;g.beginPath();g.moveTo(x,y);for(let s=0;s<len;s+=5){a+=(r()-.5)*.55;x+=Math.cos(a)*5;y+=Math.sin(a)*5;g.lineTo(x,y);if(r()<.05)br.push([x,y,a]);}g.stroke();
    for(const b of br){let[bx,by,a2]=b;g.lineWidth=.5;g.beginPath();g.moveTo(bx,by);a2+=r()<.5?.7:-.7;for(let s=0;s<20;s+=4){a2+=(r()-.5)*.5;g.lineTo(bx+=Math.cos(a2)*4,by+=Math.sin(a2)*4);}g.stroke();}}
  for(const[z0,z1]of[[4,8.5],[11.6,16]]){const cz=(z0+z1)/2,rz=(z1-z0)/2;blob(0,cz,.55,rz,dark,.18);scuffs(0,cz,.5,rz,800,.4);for(let i=0;i<7;i++)dent((r()-.5)*.8,z0+r()*(z1-z0));}
  blob(.55,19.45,.5,1.25,dark,.34);scuffs(.55,19.45,.38,1.2,1500,.6);scrapes(.55,19.45,.32,1.05,26,.6);
  blob(-.55,19.45,.45,1.2,dark,.16);scuffs(-.55,19.45,.35,1.15,650,.4);scrapes(-.55,19.45,.3,1.05,9,.45);
  blob(.55,.67,.45,1.2,dark,.16);scuffs(.55,.67,.35,1.15,650,.4);scrapes(.55,.67,.3,1.05,9,.45);
  blob(-.55,.67,.45,1.2,dark,.12);scuffs(-.55,.67,.35,1.15,480,.34);
  blob(-.27,1.1,.45,.6,dark,.26);scuffs(-.27,1.1,.33,.5,800,.5);scrapes(-.27,1.1,.25,.4,7,.5);
  const cr=cvCol(v.crease);g.fillStyle=cvRgb(cr,cr[3]);const hw=.025*K;
  for(const[zb,dz]of[[0,1],[20.12,-1]]){const zp=zb+1.22*dz;
    g.fillRect(X(-1.32),Z(zb)-hw,2.64*K,2*hw);g.fillRect(X(-1.83),Z(zp)-hw,3.66*K,2*hw);
    for(const sx of[-1,1])g.fillRect(X(sx*1.32)-hw,Z(zb-1.22),2*hw,2.44*K);}
  g.strokeStyle='rgba(40,30,20,.55)';g.lineWidth=1;g.lineCap='round';
  for(const[xx,l]of[[-.13,9],[-.19,6],[-.08,5]]){g.beginPath();g.moveTo(X(xx),Z(1.22)-l);g.lineTo(X(xx)+(r()-.5)*2,Z(1.22)+l);g.stroke();}
}

function paintAds(c,v){
  const W=2048,H=256,g=c.getContext('2d');c.width=W;c.height=H;
  g.fillStyle=v.boards[0];g.fillRect(0,0,W,H);
  const fs=H*.7,font=s=>`900 ${s}px "Big Shoulders Display","Arial Narrow",Impact,sans-serif`;g.font=font(100);
  const mw=Math.max(...v.ads.map(t=>g.measureText(t).width))/100;let np=2,sz=fs;
  for(let k=8;k>=2;k-=2){const s=Math.min(fs,(W/k-H*.5)/mw);if(s>=H*.45||k===2){np=k;sz=s;break;}}
  g.font=font(sz);g.textBaseline='middle';g.textAlign='center';const pw=W/np,gap=8;
  for(let i=0;i<np;i++){const x=i*pw,t=i&1?1:0;
    const gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,'rgba(255,255,255,.07)');gr.addColorStop(.5,'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(0,0,0,.18)');g.fillStyle=gr;g.fillRect(x,0,pw,H);
    g.fillStyle=v.boards[1+t];g.shadowColor=v.boards[1+t];g.shadowBlur=H*.06;g.fillText(v.ads[t],x+pw/2,H/2+H*.03);g.shadowBlur=0;}
  g.fillStyle=cvShade(v.boards[0],.4);for(let i=0;i<np;i++){g.fillRect(i*pw-gap/2,0,gap,H);if(!i)g.fillRect(W-gap/2,0,gap,H);}
  g.fillStyle='rgba(0,0,0,.12)';for(let y=3;y<H;y+=4)g.fillRect(0,y,W,1);
}

function paintWood(c){
  const W=64,H=256;c.width=W;c.height=H;const g=c.getContext('2d'),im=g.createImageData(W,H),d=im.data,base=cvCol('#e8d4a8'),dk=cvCol('#b98f55');
  for(let y=0;y<H;y++){const wob=(cvVn(y/40,3,1)-.5)*5+(cvVn(y/12,9,2)-.5)*1.2;
    for(let x=0;x<W;x++){const xx=x+wob,gr=cvVn(xx*.9,y*.015,3),fine=cvVn(xx*3.2,y*.04,4),tone=cvVn(xx*.12,y*.01,5)-.5,e=Math.pow(Math.abs(x/(W-1)*2-1),2.5);
      const t=cvCl((gr-.5)*.55+(fine-.5)*.3+Math.max(0,fine-.72)*.9+e*.35+(tone<0?-tone*.3:0),0,1),o=cvMix(base,dk,t*.55),k=1+tone*.07-e*.04,i=(y*W+x)*4;
      d[i]=cvCl(o[0]*k);d[i+1]=cvCl(o[1]*k);d[i+2]=cvCl(o[2]*k);d[i+3]=255;}}
  g.putImageData(im,0,0);
}

function paintBall(c){
  const W=128,H=64,r=prng(4242);c.width=W;c.height=H;const g=c.getContext('2d'),im=g.createImageData(W,H),d=im.data,b=cvCol('#a8231c');
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const m=(cvVn(x/10,y/10,1,13)-.5)*.2+(cvVn(x/3,y/3,2,43)-.5)*.1+(cvH(x,y,3)-.5)*.07,i=(y*W+x)*4;
    d[i]=cvCl(b[0]*(1+m*1.3));d[i+1]=cvCl(b[1]*(1+m*1.8));d[i+2]=cvCl(b[2]*(1+m*1.8));d[i+3]=255;}
  g.putImageData(im,0,0);g.lineCap='round';
  for(let i=0;i<14;i++){const x=r()*W,y=8+r()*48,a=r()*3,l=3+r()*8;g.strokeStyle=r()<.6?'rgba(235,160,140,.16)':'rgba(70,10,10,.2)';g.lineWidth=.6+r();g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();}
  g.fillStyle='rgba(60,8,8,.45)';g.fillRect(0,29.2,W,.9);g.fillRect(0,33.9,W,.9);
  g.fillStyle='#e6dcc2';g.fillRect(0,30.2,W,3.6);g.fillStyle='rgba(120,95,60,.35)';g.fillRect(0,32.9,W,.9);g.fillStyle='rgba(255,255,245,.35)';g.fillRect(0,30.2,W,.8);
  g.strokeStyle='#efe6cc';g.lineWidth=1;const N=42;
  for(const[y,s]of[[27.6,-1],[25.2,-1],[36.4,1],[38.8,1]])for(let i=0;i<N;i++){const x=(i+.5)*W/N+(y%2?.8:0);g.beginPath();g.moveTo(x-.5,y-s*.1-.9);g.lineTo(x+.5,y+.9);g.stroke();}
}

function paintGlow(c){
  c.width=64;c.height=64;const g=c.getContext('2d'),q=g.createRadialGradient(32,32,0,32,32,32);
  for(const[o,a]of[[0,1],[.12,.9],[.3,.35],[.6,.08],[1,0]])q.addColorStop(o,`rgba(255,255,255,${a})`);
  g.fillStyle=q;g.fillRect(0,0,64,64);
}

function paintPanel(c){
  c.width=128;c.height=64;const g=c.getContext('2d');
  g.fillStyle='#2a2c30';g.fillRect(0,0,128,64);g.fillStyle='#3a3d43';g.fillRect(0,0,128,2);g.fillRect(0,0,2,64);g.fillStyle='#17181b';g.fillRect(0,62,128,2);g.fillRect(126,0,2,64);
  for(let j=0;j<4;j++)for(let i=0;i<8;i++){const x=i*16+8,y=j*16+8;
    g.fillStyle='#131416';g.beginPath();g.arc(x,y,7.4,0,7);g.fill();
    const q=g.createRadialGradient(x,y,0,x,y,6.4);q.addColorStop(0,'#fffef6');q.addColorStop(.45,'#fff0c4');q.addColorStop(.85,'#ffd88a');q.addColorStop(1,'#a8844a');g.fillStyle=q;g.beginPath();g.arc(x,y,6.4,0,7);g.fill();}
}

function paintSeats(c,v){
  const W=256,H=32,r=prng(99);c.width=W;c.height=H;const g=c.getContext('2d'),[h,s,l]=cvHsl(cvCol(v.stands)),
    tints=[[h,Math.min(.78,s*2+.1),Math.min(.62,l+.26)],[h+7,Math.min(.78,s*2+.1),Math.min(.55,l+.19)],[h-7,Math.min(.7,s*1.8+.08),Math.min(.68,l+.31)]].map(t=>cvFromHsl(...t));
  g.fillStyle=cvRgb(cvFromHsl(h,s*.5,Math.max(.08,l*.55)));g.fillRect(0,0,W,H);
  g.fillStyle=cvRgb(cvFromHsl(h,s*.25,Math.max(.12,l*.8)));g.fillRect(0,24,W,8);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(0,24,W,1);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(0,31,W,1);
  for(let i=0;i<16;i++){const x=i*16+2,t=tints[(r()*3)|0];
    g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.roundRect(x+.5,5,12,14,3);g.fill();
    const q=g.createLinearGradient(0,3,0,17);q.addColorStop(0,cvRgb(cvMix(t,[255,255,255],.12)));q.addColorStop(1,cvRgb(cvMix(t,[0,0,0],.18)));
    g.fillStyle=q;g.beginPath();g.roundRect(x,3,12,14,3);g.fill();
    g.fillStyle=cvRgb(cvMix(t,[0,0,0],.3));g.beginPath();g.roundRect(x+1,17,10,4,1.5);g.fill();}
}
