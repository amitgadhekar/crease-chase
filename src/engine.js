const E3=(()=>{
  let gl=null,L={},bound=null,white=null;
  const VS=`attribute vec3 aP;attribute vec3 aN;attribute vec2 aT;uniform mat4 uM,uV,uP;uniform mat3 uNM;
varying vec3 vN;varying vec2 vT;varying float vD;
void main(){vec4 v=uV*(uM*vec4(aP,1.0));gl_Position=uP*v;vN=uNM*aN;vT=aT;vD=v.z;}`;
  const FS=`precision mediump float;varying vec3 vN;varying vec2 vT;varying float vD;
uniform vec3 uC,uSD,uSC,uSky,uGr,uFC;uniform float uA,uLit,uTex,uFogOn;uniform vec2 uUV,uFog;uniform sampler2D uS;
void main(){vec4 b=vec4(uC,uA);if(uTex>0.5)b*=texture2D(uS,vT*uUV);vec3 c=b.rgb;
if(uLit>0.5){vec3 n=normalize(vN);vec3 amb=mix(uGr,uSky,n.y*0.5+0.5);c=b.rgb*(amb+uSC*max(dot(n,uSD),0.0));}
if(uFogOn>0.5&&uFog.y>0.0){c=mix(c,uFC,clamp((vD-uFog.x)/(uFog.y-uFog.x),0.0,1.0));}
gl_FragColor=vec4(c,b.a);}`;
  function sh(t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  function init(cv){
    try{gl=cv.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});}catch(e){gl=null;}
    if(!gl)return false;
    const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))return false;gl.useProgram(p);
    for(const a of ['aP','aN','aT'])L[a]=gl.getAttribLocation(p,a);
    for(const u of ['uM','uV','uP','uNM','uC','uSD','uSC','uSky','uGr','uFC','uA','uLit','uTex','uFogOn','uUV','uFog','uS'])L[u]=gl.getUniformLocation(p,u);
    gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);
    gl.uniform1i(L.uS,0);
    return true;
  }
  function buf(arr,type){const b=gl.createBuffer();gl.bindBuffer(type,b);gl.bufferData(type,arr,gl.STATIC_DRAW);return b;}
  function geom(g){return {p:buf(new Float32Array(g.P),gl.ARRAY_BUFFER),n:buf(new Float32Array(g.N),gl.ARRAY_BUFFER),t:buf(new Float32Array(g.T),gl.ARRAY_BUFFER),
    i:buf(new Uint16Array(g.I),gl.ELEMENT_ARRAY_BUFFER),c:g.I.length};}
  function bind(g){
    if(bound===g)return;bound=g;
    gl.bindBuffer(gl.ARRAY_BUFFER,g.p);gl.enableVertexAttribArray(L.aP);gl.vertexAttribPointer(L.aP,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,g.n);gl.enableVertexAttribArray(L.aN);gl.vertexAttribPointer(L.aN,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,g.t);gl.enableVertexAttribArray(L.aT);gl.vertexAttribPointer(L.aT,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,g.i);
  }
  function tex(canvas,repeat){
    const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
    const w=repeat?gl.REPEAT:gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,w);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    return t;
  }
  function frame(w,h,view,proj,lt){
    gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(L.uV,false,view);gl.uniformMatrix4fv(L.uP,false,proj);
    gl.uniform3fv(L.uSD,lt.dir);gl.uniform3fv(L.uSC,lt.sun);gl.uniform3fv(L.uSky,lt.sky);gl.uniform3fv(L.uGr,lt.gr);
    gl.uniform3fv(L.uFC,lt.fogC);gl.uniform2fv(L.uFog,lt.fog);
  }
  function flat(on){if(on){gl.disable(gl.DEPTH_TEST);gl.depthMask(false);}else{gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.depthFunc(gl.LEQUAL);}}
  const NM=new Float32Array(9);
  function draw(g,m,c,o){
    o=o||{};bind(g);gl.uniformMatrix4fv(L.uM,false,m);
    for(let k=0;k<3;k++){const a=m[k*4],b=m[k*4+1],d=m[k*4+2],l=a*a+b*b+d*d||1;NM[k*3]=a/l;NM[k*3+1]=b/l;NM[k*3+2]=d/l;}
    gl.uniformMatrix3fv(L.uNM,false,NM);
    gl.uniform3fv(L.uC,c);gl.uniform1f(L.uA,o.a==null?1:o.a);gl.uniform1f(L.uLit,o.lit===0?0:1);gl.uniform1f(L.uFogOn,o.fog===0?0:1);
    if(o.tex){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,o.tex);gl.uniform1f(L.uTex,1);gl.uniform2fv(L.uUV,o.uv||[1,1]);}else gl.uniform1f(L.uTex,0);
    gl.drawElements(gl.TRIANGLES,g.c,gl.UNSIGNED_SHORT,0);
  }
  return {init,geom,tex,frame,flat,draw};
})();
/* unit geometry builders (return raw arrays) */
const GB={
  box(){const P=[],N=[],T=[],I=[];const f=(n,u,v)=>{const b=P.length/3;for(const [a,c] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
      P.push(.5*(n[0]+a*u[0]+c*v[0]),.5*(n[1]+a*u[1]+c*v[1]),.5*(n[2]+a*u[2]+c*v[2]));N.push(n[0],n[1],n[2]);T.push((a+1)/2,(c+1)/2);}I.push(b,b+1,b+2,b,b+2,b+3);};
    f([1,0,0],[0,1,0],[0,0,1]);f([-1,0,0],[0,0,1],[0,1,0]);f([0,1,0],[0,0,1],[1,0,0]);f([0,-1,0],[1,0,0],[0,0,1]);f([0,0,1],[1,0,0],[0,1,0]);f([0,0,-1],[0,1,0],[1,0,0]);
    return {P,N,T,I};},
  cyl(seg){const P=[],N=[],T=[],I=[];
    for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,c=Math.cos(a),s=Math.sin(a);P.push(c,-.5,s,c,.5,s);N.push(c,0,s,c,0,s);T.push(i/seg,1,i/seg,0);}
    for(let i=0;i<seg;i++){const b=i*2;I.push(b,b+1,b+2,b+1,b+3,b+2);}
    for(const y of [-.5,.5]){const c0=P.length/3;P.push(0,y,0);N.push(0,Math.sign(y),0);T.push(.5,.5);
      for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2;P.push(Math.cos(a),y,Math.sin(a));N.push(0,Math.sign(y),0);T.push(.5,.5);}
      for(let i=0;i<seg;i++)I.push(c0,c0+1+i,c0+2+i);}
    return {P,N,T,I};},
  sph(la,lo){const P=[],N=[],T=[],I=[];
    for(let i=0;i<=la;i++){const th=i/la*Math.PI,st=Math.sin(th),ct=Math.cos(th);
      for(let j=0;j<=lo;j++){const ph=j/lo*Math.PI*2,x=st*Math.cos(ph),z=st*Math.sin(ph);P.push(x,ct,z);N.push(x,ct,z);T.push(j/lo,i/la);}}
    for(let i=0;i<la;i++)for(let j=0;j<lo;j++){const a=i*(lo+1)+j,b=a+lo+1;I.push(a,b,a+1,b,b+1,a+1);}
    return {P,N,T,I};},
  disk(seg){const P=[0,0,0],N=[0,1,0],T=[.5,.5],I=[];
    for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,x=Math.cos(a),z=Math.sin(a);P.push(x,0,z);N.push(0,1,0);T.push(x*.5+.5,z*.5+.5);}
    for(let i=0;i<seg;i++)I.push(0,1+i,2+i);return {P,N,T,I};},
  plane(){return {P:[-.5,0,-.5,.5,0,-.5,.5,0,.5,-.5,0,.5],N:[0,1,0,0,1,0,0,1,0,0,1,0],T:[0,0,1,0,1,1,0,1],I:[0,1,2,0,2,3]};},
  ann(ri,ro,seg,dash){const P=[],N=[],T=[],I=[];
    for(let i=0;i<seg;i++){if(dash&&i%2)continue;const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2,b=P.length/3;
      for(const [r,a] of [[ri,a0],[ro,a0],[ro,a1],[ri,a1]]){P.push(Math.cos(a)*r,0,Math.sin(a)*r);N.push(0,1,0);T.push(0,0);}
      I.push(b,b+1,b+2,b,b+2,b+3);}
    return {P,N,T,I};},
  bowl(rb,rt,h,seg,rep){const P=[],N=[],T=[],I=[];
    for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
      P.push(c*rb,0,s*rb,c*rt,h,s*rt);N.push(-c,.3,-s,-c,.3,-s);T.push(i/seg*rep,1,i/seg*rep,0);}
    for(let i=0;i<seg;i++){const b=i*2;I.push(b,b+1,b+2,b+1,b+3,b+2);}
    return {P,N,T,I};}
};
