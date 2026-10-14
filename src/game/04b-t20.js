/* ---------- T20 chase: attack, captain, plans and fields per over, save and resume ---------- */
function bowlerLabel(){
  if(M.t20){const bw=M.attack[M.bi];return bw?ARCH[bw.arch].name:'';}
  return M.bowlerType==='pace'?'Pace bowler':M.spinDir>0?'Leg-spinner':'Off-spinner';
}
const quotaText=n=>n===1?'last over':n+' overs left';
const isDeep=p=>p.a!=null&&p.d>BOUNDARY*0.6;
// "Wide-yorker field: third man, deep point back": the deep fielders new this over, else the close catchers
function fieldLine(f,old,id){
  const was=old.filter(isDeep).map(p=>p.n),nw=f.filter(p=>isDeep(p)&&!was.includes(p.n)).map(p=>p.n),cl=f.filter(p=>CLOSE.includes(p.n)).map(p=>p.n),L=nw.length?nw:cl;
  return TPL[id].name+(L.length?': '+L.slice(0,2).map(n=>POS[n][2]).join(', ')+(L.length>2?' and '+(L.length-2)+' more':'')+(nw.length?' back':' in'):'');
}
function t20Over(cont){
  const st=M.st,o=Math.floor(st.balls/6),ph=phaseOf(o),old=M.field;
  if(!cont){
    M.bi=captainPick(M.attack,o,st);M.plan=planPick(M.attack[M.bi],ph,st,M.foot);
    M.field=adjust(tplField(M.plan.id),M.zones,{pp:ph==='pp',n:Math.min(2,DIFF[M.diff].deep)}).field;t20Save();
  }
  const bw=M.attack[M.bi],mv={},pre='b'+M.bi+':';
  M.bowlerType=bw.type;M.spinDir=bw.dir||1;
  for(const k in st.mem)if(k.startsWith(pre))mv[k.slice(pre.length)]=st.mem[k];
  const notes=[ARCH[bw.arch].name+' from '+bw.name+', '+quotaText(4-st.bw[M.bi].o),fieldLine(M.field,cont?[]:old,M.plan.id)];
  const ins=brainInsight(mv,bw.type,M.foot);if(ins)notes.push(ins);
  return notes;
}
// after every ball: figures, decaying scoring zones, a captain's swap after a boundary mid-over, then the save
function t20Ball(res){
  const st=M.st;zoneAdd(M.zones,res.out?null:res.dir,res.runs);
  const done=t20Record(st,M.bi,res);
  if(res.boundary&&!done){const a=adjust(M.field,M.zones,{pp:phaseOf(Math.floor(st.balls/6))==='pp',n:1});
    if(a.moved.length){const m=a.moved[0],t=POS[m.from][2];M.field=a.field;M.note=t[0].toUpperCase()+t.slice(1)+' moves to '+POS[m.to][2];}}
  if(M.runs>=M.target||M.wkts>=10||M.balls>=120){store.del('t20');M.saved=false;}else t20Save();
}
// overNo counts the overs started, so a save made after an over's last ball (overNo*6 == balls) resumes with a new over
function t20Save(){
  store.set('t20',{v:1,pk:M.pk,diff:M.diff,target:M.target,ai:M.ai,attack:M.attack.map(b=>({arch:b.arch,name:b.name})),st:M.st,zones:M.zones,foot:M.foot,
    bi:M.bi,pid:M.plan.id,field:M.field,overNo:M.overNo,overBalls:M.overBalls,fours:M.fours,sixes:M.sixes,perfects:M.perfects,swings:M.swings,lastLens:M.lastLens});
  M.saved=true;
}
function t20Saved(){const s=store.get('t20',null);
  return s&&s.v===1&&s.st&&PLANETS[s.pk]&&DIFF[s.diff]&&Array.isArray(s.attack)&&s.attack.length===5&&s.attack.every(a=>a&&ARCH[a.arch])
    &&Array.isArray(s.st.bw)&&s.st.bw.length===5&&(s.pid==null||TPL[s.pid])&&(s.field==null||Array.isArray(s.field))?s:null;}
function resumeT20(){
  const s=t20Saved();if(!s)return;
  Object.assign(settings,{mode:'chase',len:3,planet:s.pk,diff:s.diff});store.set('settings',settings);
  M=newMatch(setPlanet(s.pk),'chase',s.diff,LENGTHS[3]);
  Object.assign(M,{target:s.target,ai:s.ai,st:s.st,zones:s.zones,foot:s.foot,bi:s.bi,plan:{id:s.pid,mix:TPL[s.pid]},field:s.field,overNo:s.overNo,overBalls:s.overBalls,
    fours:s.fours,sixes:s.sixes,perfects:s.perfects,swings:s.swings,lastLens:s.lastLens,runs:s.st.runs,balls:s.st.balls,wkts:s.st.wkts,saved:true,
    attack:s.attack.map((a,i)=>({...ARCH[a.arch],i,arch:a.arch,name:a.name}))});
  beginPlay(s.overNo*6>s.st.balls);
}
function figures(i){
  const st=M.st,f=st.bw[i],md=st.ov.filter((v,o)=>v&&v.b===i&&!v.r&&o<Math.floor(st.balls/6)).length;
  return {o:f.o+(f.b?'.'+f.b:''),md,r:f.r,w:f.w,t:(f.o+(f.b?'.'+f.b:''))+'-'+md+'-'+f.r+'-'+f.w};
}
// pause screen: bowling figures, fall of wickets, runs per over
function t20Card(){
  const st=M.st,row=(c,tag)=>'<tr>'+c.map(x=>'<'+(tag||'td')+'>'+x+'</'+(tag||'td')+'>').join('')+'</tr>';
  let h='<table class="sc"><thead>'+row(['Bowling','O','M','R','W','Econ'],'th')+'</thead><tbody>';
  M.attack.forEach((b,i)=>{const f=figures(i),bl=st.bw[i].o*6+st.bw[i].b;
    h+=row([b.name+' <small>'+ARCH[b.arch].name+'</small>',f.o,f.md,f.r,f.w,bl?(f.r/bl*6).toFixed(1):'-']);});
  h+='</tbody></table><p class="sc"><b>Fall of wickets</b> '+(st.fow.length?st.fow.map(w=>w.w+'-'+w.runs+' ('+oversText(w.balls)+')').join(', '):'none')+'</p>';
  const n=Math.ceil(st.balls/6);
  if(n){h+='<p class="sc"><b>Runs per over</b></p><table class="sc ov"><tbody>';
    for(let r=0;r<n;r+=10){const k=[...Array(Math.min(10,n-r)).keys()].map(j=>r+j);h+=row(k.map(o=>o+1),'th')+row(k.map(o=>st.ov[o]?st.ov[o].r:0));}
    h+='</tbody></table>';}
  return h;
}
