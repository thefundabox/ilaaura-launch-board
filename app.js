(function(){
  const AREAS=[
    {n:"Legal & GST",v:"--c-legal"},{n:"Product & QC",v:"--c-product"},{n:"Store & payments",v:"--c-store"},
    {n:"Content & videos",v:"--c-content"},{n:"Marketing & community",v:"--c-mktg"},
    {n:"Shipping & Diwali delivery",v:"--c-ship"},{n:"Launch ops",v:"--c-ops"}];
  const MILES=[{k:"Pre-launch",d:"2026-10-20",key:true},{k:"Launch",d:"2026-11-01",key:true},{k:"Dhanteras",d:"2026-11-06"},{k:"Diwali",d:"2026-11-08"}];
  const PEOPLE=["Aamir","Shamika"];
  const STATUS={todo:"To do",doing:"In progress",blocked:"Blocked",done:"Done"};
  const NEXT={todo:"doing",doing:"done",blocked:"doing",done:"todo"};
  const PRI={high:0,med:1,low:2};

  // Launch numbers. Values are running totals; targets are checkpoints joined by straight lines.
  const METRICS=[
    {k:"waitlist",n:"Waitlist sign-ups",unit:"sign-ups"},
    {k:"orders",n:"Orders",sub:"incl. pre-orders",unit:"orders"},
    {k:"revenue",n:"Revenue",money:true},
    {k:"adspend",n:"Ad spend",money:true,budget:true}];
  const DEFAULT_TARGETS=[
    ["waitlist","2026-09-28",0],["waitlist","2026-10-20",400],["waitlist","2026-11-01",600],
    ["orders","2026-10-20",0],["orders","2026-10-31",50],["orders","2026-11-08",150],
    ["revenue","2026-10-20",0],["revenue","2026-10-31",110000],["revenue","2026-11-08",330000],
    ["adspend","2026-10-01",0],["adspend","2026-10-20",20000],["adspend","2026-11-08",60000]]
    .map(([k,day,v])=>({id:k+":"+day,k,day,v})).concat([{id:"cpo",k:"cpo",day:"",v:400}]);

  let tasks=[],metrics=[],targetRows=[],loaded=false,db=null,editingId=null,canWrite=true,curStatus="todo",curDeps=[];
  let memberName="";
  const ui={area:"",owner:"",q:"",hideDone:false,me:""};
  const ls={get:k=>{try{return localStorage.getItem(k);}catch(e){return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}}};
  ui.hideDone=ls.get("ila_hide")==="1";ui.area=ls.get("ila_area")||"";ui.me=ls.get("ila_me")||"";

  const $=id=>document.getElementById(id);
  function h(tag,attrs,...kids){const el=document.createElement(tag);if(attrs)for(const k in attrs){const v=attrs[k];if(v==null||v===false)continue;if(k==="class")el.className=v;else if(k==="text")el.textContent=v;else if(k==="style")el.setAttribute("style",v);else if(k.startsWith("on"))el.addEventListener(k.slice(2),v);else el.setAttribute(k,v===true?"":v);}for(const c of kids){if(c==null)continue;el.append(c.nodeType?c:document.createTextNode(c));}return el;}
  const svgEl=(tag,attrs)=>{const el=document.createElementNS("http://www.w3.org/2000/svg",tag);for(const k in attrs)el.setAttribute(k,attrs[k]);return el;};
  const T0=(()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());})();
  const pad=n=>String(n).padStart(2,"0");
  const TODAY=T0.getFullYear()+"-"+pad(T0.getMonth()+1)+"-"+pad(T0.getDate());
  function daysTo(iso){if(!iso)return null;const [y,m,d]=iso.split("-").map(Number);return Math.round((new Date(y,m-1,d)-T0)/864e5);}
  const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fmt(iso){if(!iso)return "No date";const [,m,d]=iso.split("-").map(Number);return d+" "+MON[m-1];}
  const num=n=>Math.round(n).toLocaleString("en-IN");
  const money=n=>"₹"+num(n);
  const rate1=n=>(Math.round(n*10)/10).toLocaleString("en-IN");
  function toast(m){const t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,3000);}
  function areaVar(name){const a=AREAS.find(x=>x.n===name);return a?a.v:"--c-other";}
  function acStyle(name){return "--ac:var("+areaVar(name)+")";}
  const isOver=t=>t.s!=="done"&&t.d&&daysTo(t.d)<0;
  const sortT=(a,b)=>{const ad=a.d||"9999",bd=b.d||"9999";if(ad!==bd)return ad<bd?-1:1;return (PRI[a.p]??1)-(PRI[b.p]??1)||(a.t||"").localeCompare(b.t||"");};
  const initials=o=>{if(!o)return "?";if(o.toLowerCase()==="both")return "A+S";return o.trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();};
  function allAreas(){const extra=[...new Set(tasks.map(t=>t.c).filter(c=>c&&!AREAS.some(a=>a.n===c)))].sort();return [...AREAS.map(a=>a.n),...extra];}
  const byId=id=>tasks.find(t=>t.id===id);
  const openDeps=t=>(t.dep||[]).map(byId).filter(d=>d&&d.s!=="done");
  const isWaiting=t=>t.s!=="done"&&openDeps(t).length>0;
  const me=()=>ui.me||memberName;
  const isMine=t=>{const m=me();return !!m&&(t.o===m||(t.o||"").toLowerCase()==="both");};
  const dueTxt=t=>{const n=daysTo(t.d);if(n==null)return "No date";if(n<0)return (-n)+"d late";if(n===0)return "today";return fmt(t.d);};

  // ---------- header band ----------
  function renderBand(){
    const d=$("dates");d.textContent="";
    MILES.forEach(x=>{const n=daysTo(x.d);d.append(h("div",{class:"date"+(x.key?" key":"")},
      h("span",{class:"dl",text:x.k}),
      h("span",{class:"dn"},n>0?String(n):n===0?"Today":"✓",n>0?h("small",{text:n===1?"day":"days"}):null),
      h("span",{class:"dd",text:fmt(x.d)+" 2026"})));});
    const r=$("ring");r.textContent="";if(!loaded)return;
    const total=tasks.length,done=tasks.filter(t=>t.s==="done").length,p=total?done/total:0,C=2*Math.PI*38;
    r.innerHTML='<svg viewBox="0 0 92 92" role="img" aria-label="'+Math.round(p*100)+'% done"><circle cx="46" cy="46" r="38" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="8"/><circle cx="46" cy="46" r="38" fill="none" stroke="#E3A03A" stroke-width="8" stroke-linecap="round" transform="rotate(-90 46 46)" stroke-dasharray="'+(C*p).toFixed(1)+' '+C.toFixed(1)+'"/><text x="46" y="55" text-anchor="middle" class="pct">'+Math.round(p*100)+'%</text></svg>';
    r.append(h("div",{class:"rl"},h("b",{text:done+" of "+total+" done"}),"overall readiness"));
  }

  // ---------- my day ----------
  function myLists(){
    const mine=tasks.filter(t=>t.s!=="done"&&isMine(t));
    const waiting=mine.filter(t=>t.s==="blocked"||isWaiting(t)).sort(sortT);
    const today=mine.filter(t=>!waiting.includes(t)&&t.d&&daysTo(t.d)<=0).sort(sortT);
    const next=mine.filter(t=>!waiting.includes(t)&&!today.includes(t)&&t.d).sort(sortT).slice(0,3);
    return {today,next,waiting};
  }
  function mrow(t,extra){
    const n=daysTo(t.d);
    return h("div",{class:"mrow"},
      h("button",{class:"dotbtn s-"+t.s,type:"button",disabled:!canWrite,title:"Mark done","aria-label":"Mark “"+t.t+"” done",onclick:()=>setStatus(t,"done")}),
      h("span",{style:"flex:1;min-width:0"},h("button",{class:"mt",type:"button",onclick:()=>openEditor(t),text:t.t}),extra?h("span",{class:"mw",text:extra}):null),
      h("span",{class:"md"+(n!=null&&n<0?" over":""),text:dueTxt(t)}));
  }
  function mcol(title,tone,list,empty,extraFn){
    const c=h("div",{class:"mcol",style:"--tone:var("+tone+")"},h("h3",null,h("span",{text:title}),h("b",{text:String(list.length)})));
    if(!list.length)c.append(h("div",{class:"none",text:empty}));
    list.forEach(t=>c.append(mrow(t,extraFn&&extraFn(t))));
    return c;
  }
  function renderMyDay(){
    const p=$("mePills");p.textContent="";
    PEOPLE.forEach(n=>p.append(h("button",{type:"button","aria-pressed":me()===n?"true":"false",onclick:()=>{ui.me=n;ls.set("ila_me",n);renderMyDay();}},n)));
    const g=$("myday");g.textContent="";
    if(!loaded)return;
    if(!me()){g.append(h("div",{class:"empty",text:"Pick your name above to see your day."}));return;}
    const {today,next,waiting}=myLists();
    const waitNote=t=>{const d=openDeps(t)[0];return d?"Waiting on: "+d.t+(d.o?" ("+d.o+")":""):"Blocked";};
    g.append(mcol("Do today","--bad",today,"Nothing due today. Pull something forward."),
             mcol("Next up","--doing",next,"Nothing scheduled."),
             mcol("Waiting on something","--warn",waiting,"Nothing blocked.",waitNote));
  }

  // ---------- numbers ----------
  const targets=()=>targetRows.length?targetRows:DEFAULT_TARGETS;
  const cps=k=>targets().filter(t=>t.k===k&&t.day).map(t=>({day:t.day,v:Number(t.v)})).sort((a,b)=>a.day<b.day?-1:1);
  const series=k=>metrics.filter(m=>m.k===k).map(m=>({day:m.day,v:Number(m.v)})).sort((a,b)=>a.day<b.day?-1:1);
  const latest=k=>{const s=series(k);return s.length?s[s.length-1]:null;};
  const dnum=iso=>{const [y,m,d]=iso.split("-").map(Number);return Date.UTC(y,m-1,d)/864e5;};
  function expectedAt(k,iso){
    const c=cps(k);if(!c.length)return null;
    if(iso<=c[0].day)return c[0].v;
    for(let i=1;i<c.length;i++){if(iso<=c[i].day){const a=c[i-1],b=c[i];return a.v+(b.v-a.v)*(dnum(iso)-dnum(a.day))/Math.max(1,dnum(b.day)-dnum(a.day));}}
    return c[c.length-1].v;
  }
  function evalMetric(m){
    const c=cps(m.k),cur=latest(m.k),exp=expectedAt(m.k,TODAY);
    const f=m.money?money:num;
    const r={cur,exp,f,status:"No numbers yet",tone:"neutral",need:"",tgt:""};
    if(m.budget){
      const total=c.length?c[c.length-1]:null;
      r.tgt=total?"Budget "+f(total.v)+" by "+fmt(total.day):"No budget set";
      if(!cur)return r;
      if(exp!=null&&cur.v>exp*1.1&&cur.v-exp>1000){r.status="Spending ahead of plan";r.tone="warn";}
      else{r.status="Within plan";r.tone="good";}
      if(total){const left=total.v-cur.v;r.need=left>=0?f(left)+" left to spend":"Over budget by "+f(-left);if(left<0)r.tone="bad";}
      return r;
    }
    const v=cur?cur.v:0;
    const next=c.find(x=>x.day>=TODAY&&x.v>v)||null;
    const goal=next||c[c.length-1];
    r.tgt=goal?"Target "+f(goal.v)+" by "+fmt(goal.day):"No target set";
    const startDay=(c.filter(x=>x.v===0).pop()||{}).day;
    const notStarted=exp!=null&&exp<=0&&startDay&&TODAY<startDay;
    if(notStarted&&!(cur&&cur.v>0)){r.status="Starts "+fmt(startDay);r.tone="neutral";}
    else if(!cur)return r;
    else if(exp==null||exp<=0){r.status=v>0?"Ahead":"Not started";r.tone=v>0?"good":"neutral";}
    else{const q=v/exp;if(q>=1){r.status="Ahead of target";r.tone="good";}else if(q>=0.9){r.status="On track";r.tone="good";}else{r.status="Behind · "+Math.round(q*100)+"% of plan";r.tone="bad";}}
    if(next&&notStarted){const days=Math.max(1,dnum(next.day)-dnum(startDay));const per=(next.v-v)/days;r.need="Plan: "+(m.money?money(per):rate1(per))+"/day from "+fmt(startDay);}
    else if(next){const days=Math.max(1,daysTo(next.day));const per=(next.v-v)/days;r.need="Need "+(m.money?money(per):rate1(per))+"/day to hit "+fmt(next.day);}
    else if(goal&&v>=goal.v)r.need="Final target reached 🎉";
    return r;
  }
  function spark(k){
    const c=cps(k),s=series(k);
    const days=[...c.map(x=>x.day),...s.map(x=>x.day),TODAY].sort();
    if(!c.length&&!s.length)return null;
    const x0=dnum(days[0]),x1=Math.max(x0+1,dnum(days[days.length-1]));
    const vmax=Math.max(1,...c.map(x=>x.v),...s.map(x=>x.v));
    const W=240,H=54,P=4,X=d=>P+(dnum(d)-x0)/(x1-x0)*(W-2*P),Y=v=>H-P-(v/vmax)*(H-2*P);
    const svg=svgEl("svg",{viewBox:"0 0 "+W+" "+H,preserveAspectRatio:"none","aria-hidden":"true"});
    svg.append(svgEl("line",{x1:X(TODAY),x2:X(TODAY),y1:0,y2:H,stroke:"var(--line)","stroke-width":1}));
    if(c.length)svg.append(svgEl("polyline",{points:c.map(p=>X(p.day)+","+Y(p.v)).join(" "),fill:"none",stroke:"var(--muted)","stroke-width":1.5,"stroke-dasharray":"4 3","vector-effect":"non-scaling-stroke"}));
    if(s.length){
      svg.append(svgEl("polyline",{points:s.map(p=>X(p.day)+","+Y(p.v)).join(" "),fill:"none",stroke:"var(--gold)","stroke-width":2.5,"stroke-linejoin":"round","vector-effect":"non-scaling-stroke"}));
      const l=s[s.length-1];svg.append(svgEl("circle",{cx:X(l.day),cy:Y(l.v),r:3,fill:"var(--gold)"}));
    }
    return svg;
  }
  function cpo(){
    const o=latest("orders"),a=latest("adspend"),t=targets().find(x=>x.k==="cpo");
    const tv=t?Number(t.v):null;
    if(!(o&&a&&o.v>0))return {text:"Cost per order: —"+(tv!=null?" (target ≤ "+money(tv)+")":""),tone:""};
    const c=a.v/o.v;
    return {text:"Cost per order: "+money(c)+(tv!=null?" (target ≤ "+money(tv)+")":""),tone:tv==null?"":c<=tv?"good":"bad"};
  }
  function renderNumbers(){
    const g=$("nums");g.textContent="";
    METRICS.forEach(m=>{
      const r=evalMetric(m);
      g.append(h("div",{class:"num"},
        h("div",{class:"nh"},h("span",{text:m.n}),h("span",{class:"pill "+r.tone,text:r.status})),
        h("div",{class:"nv"},r.cur?r.f(r.cur.v):"—",r.cur?h("small",{text:"as of "+fmt(r.cur.day)}):null),
        h("div",{class:"nt",text:r.tgt+(r.exp!=null&&r.exp>0&&!m.budget?" · plan today "+r.f(r.exp):"")}),
        r.need?h("div",{class:"nneed",text:r.need}):null,
        m.budget?(c=>h("div",{class:"nt"+(c.tone?" t-"+c.tone:""),text:c.text}))(cpo()):null,
        spark(m.k)));
    });
    $("numBtn").hidden=!canWrite;$("tgtBtn").hidden=!canWrite;
  }

  // ---------- pace ----------
  function paceFor(deadline){
    const open=tasks.filter(t=>t.s!=="done"&&t.d&&t.d<=deadline);
    const days=daysTo(deadline);
    const doneAts=tasks.map(t=>t.done_at).filter(Boolean).map(Number);
    const now=Date.now(),wk=7*864e5;
    let rate=null;
    if(doneAts.length){const win=Math.min(7,Math.max(1,(now-Math.min(...doneAts))/864e5));rate=doneAts.filter(x=>x>=now-wk).length/win;}
    const need=days>0?open.length/days:null;
    let status,tone,detail;
    if(days<0){status="Passed";tone="neutral";detail=open.length?open.length+" tasks due by then are still open.":"Everything due by then is done.";}
    else if(!open.length){status="Clear";tone="good";detail="Nothing left due by then.";}
    else if(rate==null){status="Tracking starts now";tone="neutral";detail="Need "+rate1(need||open.length)+" tasks/day. Your pace shows once you mark a few tasks done.";}
    else if(rate>=(need||Infinity)*0.999){status="On pace";tone="good";detail="Need "+rate1(need)+"/day · doing "+rate1(rate)+"/day (last 7 days).";}
    else{const short=Math.ceil(open.length-rate*Math.max(0,days));status="Behind";tone="bad";detail="Need "+rate1(need)+"/day · doing "+rate1(rate)+"/day. At this pace ~"+short+" won't be done.";}
    return {open,crit:open.filter(t=>t.crit).length,days,status,tone,detail};
  }
  function renderPace(){
    const g=$("pace");g.textContent="";if(!loaded)return;
    [["Before pre-launch","2026-10-20"],["Before launch","2026-11-01"]].forEach(([label,d])=>{
      const p=paceFor(d);
      g.append(h("div",{class:"ptile"},
        h("div",{class:"ph"},h("span",{text:label+" · "+fmt(d)}),h("span",{class:"pill "+p.tone,text:p.status})),
        h("div",{class:"pn"},h("b",{text:String(p.open.length)}),"open tasks due",p.crit?" · "+p.crit+" critical":"",p.days>0?" · "+p.days+" days left":""),
        h("div",{class:"pd",text:p.detail})));
    });
  }

  // ---------- attention, areas, board ----------
  function attnTile(title,tone,list){
    const ul=h("ul");list.slice(0,4).forEach(t=>ul.append(h("li",null,h("button",{onclick:()=>openEditor(t)},h("span",{class:"lt",text:t.t}),h("span",{class:"ld",text:fmt(t.d)})))));
    return h("div",{class:"atile",style:"--tone:var("+tone+")"},
      h("div",{class:"ah"},h("span",{text:title}),h("b",{text:String(list.length)})),
      list.length?ul:h("div",{class:"none",text:"Nothing here. Good."}),
      list.length>4?h("div",{class:"more",text:"+"+(list.length-4)+" more"}):null);
  }
  function renderAttn(){
    const a=$("attn");a.textContent="";if(!loaded)return;
    const open=tasks.filter(t=>t.s!=="done");
    const over=open.filter(isOver).sort(sortT);
    const week=open.filter(t=>{const n=daysTo(t.d);return n!=null&&n>=0&&n<=7;}).sort(sortT);
    const blk=open.filter(t=>t.s==="blocked"||isWaiting(t)||(t.crit&&t.s==="todo"&&daysTo(t.d)!=null&&daysTo(t.d)<=10)).sort(sortT);
    a.append(attnTile("Overdue","--bad",over),attnTile("Due this week","--warn",week),attnTile("Blocked, waiting or critical","--c-content",blk));
  }

  function renderAreas(){
    const g=$("areas");g.textContent="";if(!loaded)return;
    const total=tasks.length,done=tasks.filter(t=>t.s==="done").length;
    g.append(h("button",{class:"area all","aria-pressed":ui.area===""?"true":"false",onclick:()=>setArea("")},
      h("span",{class:"an"},h("span",{class:"sw",text:"✦"}),"All areas"),
      h("span",{class:"ac"},h("b",{text:done+"/"+total}),h("span",{text:"done"})),
      h("span",{class:"bar"},h("i",{style:"width:"+(total?done/total*100:0)+"%"})),
      h("span",{class:"nx",text:tasks.filter(t=>t.s!=="done").length+" open tasks"})));
    allAreas().forEach(name=>{
      const ts=tasks.filter(t=>t.c===name);if(!ts.length&&!AREAS.some(a=>a.n===name))return;
      const d=ts.filter(t=>t.s==="done").length,over=ts.filter(isOver).length;
      const nx=ts.filter(t=>t.s!=="done").sort(sortT)[0];
      g.append(h("button",{class:"area",style:acStyle(name),"aria-pressed":ui.area===name?"true":"false",onclick:()=>setArea(ui.area===name?"":name)},
        over?h("span",{class:"flag",text:over+" late"}):null,
        h("span",{class:"an"},h("span",{class:"sw",text:name[0]}),name),
        h("span",{class:"ac"},h("b",{text:d+"/"+ts.length}),h("span",{text:"done"})),
        h("span",{class:"bar"},h("i",{style:"width:"+(ts.length?d/ts.length*100:0)+"%"})),
        h("span",{class:"nx",text:nx?"Next: "+nx.t+" · "+fmt(nx.d):ts.length?"All done":"No tasks yet"})));
    });
  }

  function renderOwners(){
    const p=$("ownerPills");p.textContent="";
    const owners=[...new Set([...PEOPLE,"Both",...tasks.map(t=>t.o).filter(Boolean)])];
    if(ui.owner&&!owners.includes(ui.owner))ui.owner="";
    [["","Everyone"],...owners.map(o=>[o,o])].forEach(([v,l])=>p.append(h("button",{"aria-pressed":ui.owner===v?"true":"false",onclick:()=>{ui.owner=v;renderBoard();renderOwners();}},l)));
    const ol=$("ownerList");ol.textContent="";[...owners,"Vendor","CA"].forEach(o=>ol.append(h("option",{value:o})));
    const cl=$("catList");cl.textContent="";allAreas().forEach(c=>cl.append(h("option",{value:c})));
  }

  function waitLines(t){
    if(t.s==="done")return null;
    const od=openDeps(t);if(!od.length)return null;
    return h("div",{class:"wait"},...od.map(d=>{
      const late=d.d&&t.d&&d.d>t.d;
      return h("span",{class:late?"late":null,text:(late?"⚠ ":"↳ ")+"Waits on: "+d.t+(d.o?" · "+d.o:"")+(late?" · due "+fmt(d.d)+", after this":"")});
    }));
  }
  function card(t){
    const n=daysTo(t.d),over=isOver(t),soon=!over&&t.s!=="done"&&n!=null&&n<=3;
    let dt=fmt(t.d);if(t.s!=="done"&&n!=null){if(n<0)dt+=" · "+(-n)+"d late";else if(n===0)dt+=" · today";else if(n<=7)dt+=" · "+n+"d";}
    return h("article",{class:"card"+(t.s==="done"?" done":""),style:acStyle(t.c)},
      h("div",{class:"top"},h("span",{class:"due"+(over?" over":soon?" soon":""),text:dt}),t.crit?h("span",{class:"crit",text:"Critical"}):ui.area?null:h("span",{class:"cat-lbl",text:t.c||""})),
      h("button",{class:"ct",onclick:()=>openEditor(t),text:t.t||"(untitled)"}),
      t.n?h("div",{class:"cn",text:t.n}):null,
      waitLines(t),
      h("div",{class:"bot"},
        h("span",{class:"who"},h("span",{class:"av",text:initials(t.o)}),t.o||"Unassigned"),
        h("button",{class:"stat s-"+t.s,disabled:!canWrite,title:"Tap to move to "+STATUS[NEXT[t.s]],"aria-label":"Status "+STATUS[t.s]+". Tap to change to "+STATUS[NEXT[t.s]],onclick:()=>setStatus(t,NEXT[t.s])},STATUS[t.s])));
  }

  function renderBoard(){
    const c=$("cards");c.textContent="";
    const bt=$("boardTitle");bt.setAttribute("style",ui.area?acStyle(ui.area):"--ac:var(--ink)");bt.lastChild.textContent=ui.area||"All tasks";
    if(!loaded){c.append(h("div",{class:"msg",text:"Loading the shared checklist…"}));return;}
    const q=ui.q.trim().toLowerCase();
    const rows=tasks.filter(t=>(!ui.area||t.c===ui.area)&&(!ui.owner||t.o===ui.owner)&&(!ui.hideDone||t.s!=="done")&&(!q||((t.t||"")+" "+(t.n||"")).toLowerCase().includes(q)))
      .sort((a,b)=>(a.s==="done")-(b.s==="done")||sortT(a,b));
    if(!rows.length){c.append(h("div",{class:"empty",text:tasks.length?"No tasks match. Clear the search or pick another owner.":"No tasks yet. Tap “+ Add task”."}));return;}
    rows.forEach(t=>c.append(card(t)));
  }

  function render(){renderBand();renderMyDay();renderNumbers();renderPace();renderAttn();renderAreas();if(loaded)renderOwners();renderBoard();$("hidedone").checked=ui.hideDone;}
  function setArea(a){ui.area=a;ls.set("ila_area",a);renderAreas();renderBoard();}

  // ---------- writes ----------
  function handleErr(e){
    if(e&&e.code==="forbidden"){canWrite=false;$("addBtn").hidden=true;render();toast("You can view this board but not change it.");}
    else toast("Couldn't save. Check your connection and try again.");
  }
  async function setStatus(t,s){
    if(!db)return;
    try{await db.tasks.update(t.id,{s,u:Date.now(),done_at:s==="done"?Date.now():null});if(s==="done")toast("Done ✓");}catch(e){handleErr(e);}
  }

  // ---------- standup ----------
  function standupText(){
    const m=me(),now=Date.now();
    const last=Number(ls.get("ila_standup_"+m))||0;
    const since=Math.max(last||now-864e5,now-3*864e5);
    const done=tasks.filter(t=>t.s==="done"&&isMine(t)&&Number(t.done_at)>=since);
    const {today,next,waiting}=myLists();
    const day=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
    const L=[];
    L.push("*ILAAURA standup · "+day+" · "+m+"*");
    const sec=(title,list,fn)=>{if(!list.length)return;L.push("",title);list.forEach(t=>L.push("• "+fn(t)));};
    sec("✅ Done",done,t=>t.t);
    sec("🎯 Today",today,t=>t.t+(daysTo(t.d)<0?" ("+(-daysTo(t.d))+"d late)":""));
    sec("⏭ Next",next,t=>t.t+" · "+fmt(t.d));
    sec("⛔ Waiting",waiting,t=>{const d=openDeps(t)[0];return t.t+(d?" — on "+d.t+(d.o?" ("+d.o+")":""):" — blocked");});
    if(!done.length&&!today.length&&!next.length&&!waiting.length)L.push("","Nothing on my list right now.");
    const nums=METRICS.filter(x=>!x.budget).map(x=>{const r=evalMetric(x);return r.cur?"• "+x.n+": "+r.f(r.cur.v)+" · "+r.status.toLowerCase()+(r.need&&r.tone==="bad"?" · "+r.need.toLowerCase():""):null;}).filter(Boolean);
    const c=cpo();if(!c.text.includes("—"))nums.push("• "+c.text);
    if(nums.length){L.push("","📈 Numbers",...nums);}
    const p=paceFor("2026-10-20");
    if(p.days>=0&&p.open.length)L.push("","⏱ Pre-launch: "+p.open.length+" tasks left, "+p.status.toLowerCase());
    L.push("",location.origin+location.pathname);
    return L.join("\n");
  }
  $("standupBtn").onclick=()=>{
    if(!me()){toast("Pick your name first.");return;}
    const w=window.open("https://wa.me/?text="+encodeURIComponent(standupText()),"_blank");
    ls.set("ila_standup_"+me(),String(Date.now()));
    if(!w)toast("Allow pop-ups to open WhatsApp.");
  };

  // ---------- task editor ----------
  function paintStatus(){const w=$("f_s");w.textContent="";for(const k in STATUS)w.append(h("button",{type:"button",class:"stat s-"+k,"aria-pressed":curStatus===k?"true":"false",onclick:()=>{curStatus=k;paintStatus();}},STATUS[k]));}
  function paintDeps(){
    const w=$("f_deps");w.textContent="";
    curDeps.forEach(id=>{const d=byId(id);if(!d)return;
      w.append(h("span",{class:"chip"},h("span",{text:(d.s==="done"?"✓ ":"")+d.t}),h("button",{type:"button","aria-label":"Remove",onclick:()=>{curDeps=curDeps.filter(x=>x!==id);paintDeps();}},"×")));});
  }
  function dependsOn(fromId,targetId,seen=new Set()){
    if(fromId===targetId)return true;if(seen.has(fromId))return false;seen.add(fromId);
    const t=byId(fromId);return !!t&&(t.dep||[]).some(d=>dependsOn(d,targetId,seen));
  }
  $("f_depin").addEventListener("change",e=>{
    const v=e.target.value.trim().toLowerCase();if(!v)return;
    const pool=tasks.filter(t=>t.id!==editingId);
    const hit=pool.find(t=>(t.t||"").toLowerCase()===v)||(()=>{const m=pool.filter(t=>(t.t||"").toLowerCase().includes(v));return m.length===1?m[0]:null;})();
    if(!hit){toast("No single task matches that. Pick one from the list.");return;}
    if(editingId&&dependsOn(hit.id,editingId)){toast("That would make the two tasks wait on each other.");return;}
    if(!curDeps.includes(hit.id))curDeps.push(hit.id);
    e.target.value="";paintDeps();
  });
  function openEditor(t){
    if(!canWrite&&!t)return;
    editingId=t?t.id:null;
    $("dlgTitle").textContent=t?"Edit task":"Add task";
    $("f_t").value=t?t.t||"":"";
    $("f_c").value=t?t.c||"":(ui.area||"");
    $("f_o").value=t?t.o||"":(ui.owner||"");
    $("f_d").value=t?t.d||"":"";
    $("f_p").value=t?t.p||"med":"med";
    $("f_crit").checked=!!(t&&t.crit);
    $("f_n").value=t?t.n||"":"";
    curStatus=t?t.s||"todo":"todo";paintStatus();
    curDeps=t?[...(t.dep||[])]:[];paintDeps();$("f_depin").value="";
    const tl=$("taskList");tl.textContent="";tasks.filter(x=>x.id!==editingId).sort(sortT).forEach(x=>tl.append(h("option",{value:x.t})));
    const del=$("delBtn");del.hidden=!t||!canWrite;del.textContent="Delete";del.dataset.armed="";
    $("saveBtn").hidden=!canWrite;
    $("dlg").showModal();
  }
  $("cancelBtn").onclick=()=>$("dlg").close();
  $("delBtn").onclick=async()=>{const b=$("delBtn");if(!b.dataset.armed){b.dataset.armed="1";b.textContent="Tap again to delete";return;}
    try{await db.tasks.remove(editingId);$("dlg").close();toast("Task deleted");}catch(e){handleErr(e);}};
  $("frm").addEventListener("submit",async e=>{
    e.preventDefault();
    const orig=editingId?byId(editingId):null,now=Date.now();
    const done_at=curStatus!=="done"?null:(orig&&orig.s==="done"&&orig.done_at)?orig.done_at:now;
    const data={t:$("f_t").value.trim(),c:$("f_c").value.trim()||"Other",o:$("f_o").value.trim(),d:$("f_d").value,s:curStatus,p:$("f_p").value,crit:$("f_crit").checked,n:$("f_n").value.trim(),dep:curDeps.filter(byId),done_at,u:now};
    if(!data.t||!db)return;
    const b=$("saveBtn");b.disabled=true;
    try{if(editingId)await db.tasks.update(editingId,data);else await db.tasks.upsert(data);$("dlg").close();toast(editingId?"Saved":"Task added");}
    catch(err){handleErr(err);}finally{b.disabled=false;}
  });
  $("addBtn").onclick=()=>openEditor(null);
  $("q").addEventListener("input",e=>{ui.q=e.target.value;renderBoard();});
  $("hidedone").onchange=e=>{ui.hideDone=e.target.checked;ls.set("ila_hide",ui.hideDone?"1":"0");renderBoard();};

  // ---------- numbers dialog ----------
  $("numBtn").onclick=()=>{
    $("n_day").value=TODAY;
    const f=$("numFields");f.textContent="";
    METRICS.forEach(m=>{const l=latest(m.k);
      f.append(h("label",{class:"fg"},m.n+(m.money?" (₹, total)":" (total)"),
        h("input",{id:"n_"+m.k,class:"field",type:"number",min:"0",step:"any",inputmode:"decimal",placeholder:l?"Last: "+num(l.v)+" on "+fmt(l.day):"e.g. 0"})));});
    $("numDlg").showModal();
  };
  $("numCancel").onclick=()=>$("numDlg").close();
  $("numFrm").addEventListener("submit",async e=>{
    e.preventDefault();
    const day=$("n_day").value;if(!day||!db)return;
    const rows=METRICS.map(m=>{const raw=$("n_"+m.k).value;return raw===""?null:{id:day+":"+m.k,day,k:m.k,v:Number(raw),u:Date.now(),by:me()};}).filter(Boolean);
    if(!rows.length){$("numDlg").close();return;}
    if(rows.some(r=>!(r.v>=0))){toast("Numbers must be 0 or more.");return;}
    const b=$("numSave");b.disabled=true;
    try{for(const r of rows)await db.metrics.upsert(r);$("numDlg").close();toast("Numbers updated");}
    catch(err){handleErr(err);}finally{b.disabled=false;}
  });

  // ---------- targets dialog ----------
  let tgtDraft=[];
  function paintTargets(){
    const f=$("tgtFields");f.textContent="";
    METRICS.forEach(m=>{
      const g=h("div",{class:"tgrp"},h("b",{text:m.n+(m.money?" (₹)":"")+(m.budget?" · budget":"")}));
      tgtDraft.filter(r=>r.k===m.k).sort((a,b)=>a.day<b.day?-1:1).forEach(r=>g.append(h("div",{class:"trow"},
        h("input",{class:"field",type:"date",value:r.day,"aria-label":"Date",onchange:e=>{r.day=e.target.value;}}),
        h("input",{class:"field",type:"number",min:"0",step:"any",value:String(r.v),"aria-label":"Total by then",onchange:e=>{r.v=Number(e.target.value);}}),
        h("button",{type:"button","aria-label":"Remove checkpoint",onclick:()=>{tgtDraft=tgtDraft.filter(x=>x!==r);paintTargets();}},"×"))));
      g.append(h("button",{type:"button",class:"linkbtn",onclick:()=>{tgtDraft.push({k:m.k,day:TODAY,v:0});paintTargets();}},"+ Add checkpoint"));
      f.append(g);
    });
    const c=tgtDraft.find(r=>r.k==="cpo");
    f.append(h("div",{class:"tgrp"},h("b",{text:"Cost per order ceiling (₹)"}),
      h("input",{class:"field",type:"number",min:"0",step:"any",value:c?String(c.v):"","aria-label":"Cost per order ceiling",onchange:e=>{const v=e.target.value;tgtDraft=tgtDraft.filter(x=>x.k!=="cpo");if(v!=="")tgtDraft.push({k:"cpo",day:"",v:Number(v)});}})));
  }
  $("tgtBtn").onclick=()=>{tgtDraft=targets().map(r=>({k:r.k,day:r.day,v:Number(r.v)}));paintTargets();$("tgtDlg").showModal();};
  $("tgtReset").onclick=()=>{tgtDraft=DEFAULT_TARGETS.map(r=>({k:r.k,day:r.day,v:r.v}));paintTargets();};
  $("tgtCancel").onclick=()=>$("tgtDlg").close();
  $("tgtFrm").addEventListener("submit",async e=>{
    e.preventDefault();if(!db)return;
    const rows=tgtDraft.filter(r=>r.k==="cpo"||r.day).map(r=>({id:r.k==="cpo"?"cpo":r.k+":"+r.day,k:r.k,day:r.k==="cpo"?"":r.day,v:r.v}));
    if(rows.some(r=>!(r.v>=0))){toast("Targets must be 0 or more.");return;}
    const keep=new Set(rows.map(r=>r.id));
    const b=$("tgtSave");b.disabled=true;
    try{
      for(const r of targetRows)if(!keep.has(r.id))await db.targets.remove(r.id);
      for(const r of rows)await db.targets.upsert(r);
      $("tgtDlg").close();toast("Targets saved");
    }catch(err){handleErr(err);}finally{b.disabled=false;}
  });

  // ---------- boot ----------
  renderBand();

  function showApp(){$("gate").hidden=true;$("app").hidden=false;render();}
  function showGate(msg,withForm){$("app").hidden=true;$("gate").hidden=false;$("gateMsg").textContent=msg;$("gateForm").hidden=!withForm;}
  async function startDb(tables){
    db=tables;showApp();
    const live=()=>toast("Live updates paused. Reload to reconnect.");
    try{
      await Promise.all([
        tables.tasks.start(rows=>{tasks=rows.map(t=>({...t,dep:Array.isArray(t.dep)?t.dep:[]}));loaded=true;render();},live),
        tables.metrics.start(rows=>{metrics=rows;renderNumbers();},live),
        tables.targets.start(rows=>{targetRows=rows;renderNumbers();},live)]);
    }catch(e){$("cards").textContent="";$("cards").append(h("div",{class:"empty",text:"Couldn't load the board. Check your connection and reload."}));}
  }

  const cfg=window.ILAAURA_CONFIG||{};
  if(!cfg.supabaseUrl||!cfg.supabaseAnonKey){$("localNote").hidden=false;startDb(IlaStore.local());return;}
  if(!window.supabase){showGate("Couldn't load the sign-in library. Check your connection and reload.",false);return;}

  // Read before the client consumes the URL: did the person arrive from an emailed sign-in link?
  const cameFromLink=/type=(magiclink|signup|recovery|invite)/.test(location.hash)||/[?&]code=/.test(location.search);
  // Sessions are kept in this browser and refreshed automatically, so people stay signed in until they sign out.
  const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let started=false;

  const shareMsg="Hi Shamika! Our ILAAURA launch board is live 🎉\n"+location.origin+location.pathname+"\n\nSign in with your email and tap the link Supabase sends you (check spam the first time). Anything either of us changes shows up for the other straight away.";
  $("waShare").href="https://wa.me/?text="+encodeURIComponent(shareMsg);
  $("signOut").onclick=async()=>{await sb.auth.signOut();location.reload();};
  $("gateForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const email=$("gateEmail").value.trim(),password=$("gatePass").value,b=$("gateBtn");if(!email)return;
    if(!password){toast("Enter your password, or use the email link below.");$("gatePass").focus();return;}
    b.disabled=true;
    const {error}=await sb.auth.signInWithPassword({email,password});
    b.disabled=false;
    if(error)$("gateMsg").textContent=/invalid/i.test(error.message)?"That email and password don't match. If you haven't set a password yet, use the email link below, then set one.":"Couldn't sign in: "+error.message;
  });
  $("linkBtn").onclick=async()=>{
    const email=$("gateEmail").value.trim();
    if(!$("gateEmail").checkValidity()||!email){toast("Enter your email first.");$("gateEmail").focus();return;}
    const b=$("linkBtn");b.disabled=true;
    const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:false}});
    b.disabled=false;
    if(error)toast("Couldn't send the link: "+error.message);
    else showGate("Check "+email+" for a sign-in link. Open it in this same browser, then set a password.",false);
  };

  function openPw(first){
    $("pwMsg").textContent=first?"You're signed in. Set a password so next time you can sign in straight away, without an email link.":"Then you can sign in with your email and password, without waiting for an email link.";
    $("pwNew").value="";$("pwAgain").value="";$("pwDlg").showModal();
  }
  $("pwBtn").onclick=()=>openPw(false);
  $("pwCancel").onclick=()=>$("pwDlg").close();
  $("pwFrm").addEventListener("submit",async e=>{
    e.preventDefault();
    const a=$("pwNew").value,b2=$("pwAgain").value;
    if(a.length<8){toast("Use at least 8 characters.");return;}
    if(a!==b2){toast("The two passwords don't match.");return;}
    const b=$("pwSave");b.disabled=true;
    const {error}=await sb.auth.updateUser({password:a,data:{has_password:true}});
    b.disabled=false;
    if(error){toast("Couldn't save the password: "+error.message);return;}
    $("pwDlg").close();toast("Password saved. Use it next time you sign in.");
  });

  async function onSignedIn(session){
    if(started)return;started=true;
    const email=session.user.email||"";
    $("userEmail").textContent=email;$("user").hidden=false;
    const {data,error}=await sb.from("board_members").select("*");
    if(error){showGate("Couldn't check your access. Reload to try again.",false);return;}
    if(!data.length){showGate(email+" isn't on this board yet. Ask the board owner to add you, then reload.",false);return;}
    memberName=data[0].name||"";
    $("pwEmail").value=email;
    if((session.user.user_metadata||{}).has_password)$("pwBtn").textContent="Change password";
    startDb(IlaStore.supabase(sb));
    if(cameFromLink&&!(session.user.user_metadata||{}).has_password)openPw(true);
  }
  sb.auth.onAuthStateChange((event,session)=>{
    // Supabase advises against awaiting its own calls inside this callback.
    if(session)setTimeout(()=>onSignedIn(session),0);
    else if(!started)showGate("Sign in with your email and password.",true);
  });
})();
