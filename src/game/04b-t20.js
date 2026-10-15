/* ---------- T20 chase: attack, captain, plans and fields per over, save and resume ---------- */
function bowlerLabel(){
  if(M.t20||M.sc){const bw=M.attack[M.bi];return bw?ARCH[bw.arch].name:'';}
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
// overNo counts the overs started, so a save made after an over's last ball (overNo*6 == balls) resumes with a new over.
// v3: both innings. i1 = the first innings (its st carries the over's bowler, plan and field), the delivery and marker each of
// the player's bowlers last used; in the chase also its st as in v2. The player's attack is rebuilt (seeded), the AI's is stored
function t20Save(){
  const c={v:3,pk:M.pk,diff:M.diff,inn:M.inn,ai:M.aiAtk.map(b=>({arch:b.arch,name:b.name})),i1:M.i1,optK:M.optK,mkB:M.mkB,
    overNo:M.overNo,overBalls:M.overBalls,fours:M.fours,sixes:M.sixes,perfects:M.perfects,swings:M.swings,lastLens:M.lastLens};
  if(M.inn===2)Object.assign(c,{st:M.st,zones:M.zones,foot:M.foot,bi:M.bi,pid:M.plan&&M.plan.id,field:M.field});
  store.set('t20',c);M.saved=true;
}
const ixOk=(i,n)=>Number.isInteger(i)&&i>=0&&i<n;
// a saved innings: five bowlers' figures, eleven batters with tiers, two distinct batters in
const innOk=st=>st&&Array.isArray(st.bw)&&st.bw.length===5&&Array.isArray(st.bat)&&st.bat.length===11&&st.bat.every(p=>p&&TIER[p.tier])
  &&st.s!==st.ns&&ixOk(st.s,11)&&ixOk(st.ns,11)&&[st.runs,st.balls,st.wkts].every(Number.isInteger)&&Array.isArray(st.fow)&&Array.isArray(st.ov);
function t20Saved(){const s=store.get('t20',null);
  try{
    if(!(s&&s.v===3&&(s.inn===1||s.inn===2)&&PLANETS[s.pk]&&DIFF[s.diff]&&Array.isArray(s.ai)&&s.ai.length===5&&s.ai.every(a=>a&&ARCH[a.arch])
      &&innOk(s.i1)&&s.i1.bm&&Array.isArray(s.i1.Z)&&Array.isArray(s.optK)&&s.optK.length===5&&Array.isArray(s.mkB)&&s.mkB.length===5&&Number.isInteger(s.overNo)&&Array.isArray(s.overBalls)))return null;
    if(s.inn===1)return Number.isInteger(s.i1.bi)&&s.i1.bi>=-1&&s.i1.bi<5&&(s.i1.bi<0||TPL[s.i1.pid]&&Array.isArray(s.i1.field))?s:null;
    return innOk(s.st)&&(s.pid==null||TPL[s.pid])&&(s.field==null||Array.isArray(s.field))&&s.st.target===s.i1.runs+1?s:null;
  }catch(e){return null;}
}
// the T20 card's Play (and Restart): a full match. The player bowls the first innings, then chases (startInn2)
function startT20(){
  M=newMatch(setPlanet(settings.planet),'chase',settings.diff,LENGTHS[3]);
  M.mine=myAttack(M.pk);M.aiAtk=makeAttack(M.pk,M.diff);
  inn1Enter(newInn1(M.mine,aiXI(M.pk,M.aiAtk),M.diff,M.pk));bowlIntro();
}
function resumeT20(){
  const s=t20Saved();if(!s)return;
  Object.assign(settings,{mode:'t20',planet:s.pk,diff:s.diff});store.set('settings',settings);
  M=newMatch(setPlanet(s.pk),'chase',s.diff,LENGTHS[3]);
  M.mine=myAttack(s.pk);M.aiAtk=s.ai.map((a,i)=>({...ARCH[a.arch],i,arch:a.arch,name:a.name}));
  Object.assign(M,{overNo:s.overNo,overBalls:s.overBalls,fours:s.fours,sixes:s.sixes,perfects:s.perfects,swings:s.swings,lastLens:s.lastLens,saved:true});
  if(s.inn===1){inn1Enter(s.i1,s);return inn1Over()?inningsBreak():beginPlay(s.i1.bi>=0);}
  M.i1=s.i1;M.optK=s.optK;M.mkB=s.mkB;inn2Enter();
  Object.assign(M,{st:s.st,zones:s.zones,foot:s.foot,bi:s.bi,plan:{id:s.pid,mix:TPL[s.pid]},field:s.field,overNo:s.overNo,overBalls:s.overBalls,lastLens:s.lastLens,runs:s.st.runs,balls:s.st.balls,wkts:s.st.wkts});
  beginPlay(s.overNo*6>s.st.balls);
}
// the chase: the AI attack bowls as before (captain, plans, fields), the target is the first innings + 1
function inn2Enter(){
  const i=M.i1;
  Object.assign(M,{bowl:false,inn:2,attack:M.aiAtk,target:i.runs+1,ai:{runs:i.runs,wkts:i.wkts,balls:i.balls},zones:[0,0,0,0,0,0,0,0],foot:{x:0,z:0},
    runs:0,wkts:0,balls:0,overNo:0,overBalls:[],lastLens:[],field:[],plan:null,bi:0});
  M.st=newT20(M.aiAtk,M.diff,M.target);setKits(false);
}
function figures(i,st){
  st=st||M.st;const f=st.bw[i],md=st.ov.filter((v,o)=>v&&v.b===i&&!v.r&&o<Math.floor(st.balls/6)).length;
  return {o:f.o+(f.b?'.'+f.b:''),md,r:f.r,w:f.w,t:(f.o+(f.b?'.'+f.b:''))+'-'+md+'-'+f.r+'-'+f.w};
}
// pause screen: batting (the striker marked; the rest of the XI yet to bat), bowling figures, fall of wickets, runs per over
function t20Card(st,attack){
  const row=(c,tag)=>'<tr>'+c.map(x=>'<'+(tag||'td')+'>'+x+'</'+(tag||'td')+'>').join('')+'</tr>';
  let h='<table class="sc"><thead>'+row(['Batting','','R','B'],'th')+'</thead><tbody>';
  st.bat.forEach((p,i)=>{if(i===st.s||i===st.ns||p.out||p.balls)h+=row([(i===st.s?'▸ ':'')+batTag(p),p.out?p.how||'out':'not out',p.runs,p.balls]);});
  const yet=st.bat.filter((p,i)=>!p.out&&!p.balls&&i!==st.s&&i!==st.ns);
  h+='</tbody></table>'+(yet.length?'<p class="sc"><b>Yet to bat</b> '+yet.map(p=>p.name).join(', ')+'</p>':'');
  h+='<table class="sc"><thead>'+row(['Bowling','O','M','R','W','Econ'],'th')+'</thead><tbody>';
  attack.forEach((b,i)=>{const f=figures(i,st),bl=st.bw[i].o*6+st.bw[i].b;
    h+=row([b.name+' <small>'+ARCH[b.arch].name+'</small>',f.o,f.md,f.r,f.w,bl?(f.r/bl*6).toFixed(1):'-']);});
  h+='</tbody></table><p class="sc"><b>Fall of wickets</b> '+(st.fow.length?st.fow.map(w=>w.w+'-'+w.runs+' ('+oversText(w.balls)+')').join(', '):'none')+'</p>';
  const n=Math.ceil(st.balls/6);
  if(n){h+='<p class="sc"><b>Runs per over</b></p><table class="sc ov"><tbody>';
    for(let r=0;r<n;r+=10){const k=[...Array(Math.min(10,n-r)).keys()].map(j=>r+j);h+=row(k.map(o=>o+1),'th')+row(k.map(o=>st.ov[o]?st.ov[o].r:0));}
    h+='</tbody></table>';}
  return h;
}
