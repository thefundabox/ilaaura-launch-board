(function(){
  const AREAS=[
    {n:"Legal & GST",v:"--c-legal"},{n:"Product & QC",v:"--c-product"},{n:"Store & payments",v:"--c-store"},
    {n:"Content & videos",v:"--c-content"},{n:"Marketing & community",v:"--c-mktg"},
    {n:"Shipping & Diwali delivery",v:"--c-ship"},{n:"Launch ops",v:"--c-ops"}];
  const MILES=[{k:"Pre-launch",d:"2026-10-20",key:true},{k:"Launch",d:"2026-11-01",key:true},{k:"Dhanteras",d:"2026-11-06"},{k:"Diwali",d:"2026-11-08"}];
  const STATUS={todo:"To do",doing:"In progress",blocked:"Blocked",done:"Done"};
  const NEXT={todo:"doing",doing:"done",blocked:"doing",done:"todo"};
  const PRI={high:0,med:1,low:2};
  let tasks=[],loaded=false,store=null,editingId=null,canWrite=true,curStatus="todo";
  const ui={area:"",owner:"",q:"",hideDone:false};
  try{ui.hideDone=localStorage.getItem("ila_hide")==="1";ui.area=localStorage.getItem("ila_area")||"";}catch(e){}

  const $=id=>document.getElementById(id);
  function h(tag,attrs,...kids){const el=document.createElement(tag);if(attrs)for(const k in attrs){const v=attrs[k];if(v==null||v===false)continue;if(k==="class")el.className=v;else if(k==="text")el.textContent=v;else if(k==="style")el.setAttribute("style",v);else if(k.startsWith("on"))el.addEventListener(k.slice(2),v);else el.setAttribute(k,v===true?"":v);}for(const c of kids){if(c==null)continue;el.append(c.nodeType?c:document.createTextNode(c));}return el;}
  const T0=(()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());})();
  function daysTo(iso){if(!iso)return null;const [y,m,d]=iso.split("-").map(Number);return Math.round((new Date(y,m-1,d)-T0)/864e5);}
  const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fmt(iso){if(!iso)return "No date";const [,m,d]=iso.split("-").map(Number);return d+" "+MON[m-1];}
  function toast(m){const t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,3000);}
  function areaVar(name){const a=AREAS.find(x=>x.n===name);return a?a.v:"--c-other";}
  function acStyle(name){return "--ac:var("+areaVar(name)+")";}
  const isOver=t=>t.s!=="done"&&t.d&&daysTo(t.d)<0;
  const sortT=(a,b)=>{const ad=a.d||"9999",bd=b.d||"9999";if(ad!==bd)return ad<bd?-1:1;return (PRI[a.p]??1)-(PRI[b.p]??1)||(a.t||"").localeCompare(b.t||"");};
  const initials=o=>{if(!o)return "?";if(o.toLowerCase()==="both")return "A+S";return o.trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();};
  function allAreas(){const extra=[...new Set(tasks.map(t=>t.c).filter(c=>c&&!AREAS.some(a=>a.n===c)))].sort();return [...AREAS.map(a=>a.n),...extra];}

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
    const blk=open.filter(t=>t.s==="blocked"||(t.crit&&t.s==="todo"&&daysTo(t.d)!=null&&daysTo(t.d)<=10)).sort(sortT);
    a.append(attnTile("Overdue","--bad",over),attnTile("Due this week","--warn",week),attnTile("Blocked or critical, not started","--c-content",blk));
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
    const owners=[...new Set(["Aamir","Shamika","Both",...tasks.map(t=>t.o).filter(Boolean)])];
    if(ui.owner&&!owners.includes(ui.owner))ui.owner="";
    [["","Everyone"],...owners.map(o=>[o,o])].forEach(([v,l])=>p.append(h("button",{"aria-pressed":ui.owner===v?"true":"false",onclick:()=>{ui.owner=v;renderBoard();renderOwners();}},l)));
    const ol=$("ownerList");ol.textContent="";[...owners,"Vendor","CA"].forEach(o=>ol.append(h("option",{value:o})));
    const cl=$("catList");cl.textContent="";allAreas().forEach(c=>cl.append(h("option",{value:c})));
  }

  function card(t){
    const n=daysTo(t.d),over=isOver(t),soon=!over&&t.s!=="done"&&n!=null&&n<=3;
    let dueTxt=fmt(t.d);if(t.s!=="done"&&n!=null){if(n<0)dueTxt+=" · "+(-n)+"d late";else if(n===0)dueTxt+=" · today";else if(n<=7)dueTxt+=" · "+n+"d";}
    return h("article",{class:"card"+(t.s==="done"?" done":""),style:acStyle(t.c)},
      h("div",{class:"top"},h("span",{class:"due"+(over?" over":soon?" soon":""),text:dueTxt}),t.crit?h("span",{class:"crit",text:"Critical"}):ui.area?null:h("span",{class:"cat-lbl",text:t.c||""})),
      h("button",{class:"ct",onclick:()=>openEditor(t),text:t.t||"(untitled)"}),
      t.n?h("div",{class:"cn",text:t.n}):null,
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

  function render(){renderBand();renderAttn();renderAreas();if(loaded)renderOwners();renderBoard();$("hidedone").checked=ui.hideDone;}
  function setArea(a){ui.area=a;try{localStorage.setItem("ila_area",a);}catch(e){}renderAreas();renderBoard();}

  async function setStatus(t,s){
    if(!store)return;
    try{await store.update(t.id,{s,u:Date.now()});if(s==="done")toast("Done ✓");}catch(e){handleErr(e);}
  }
  function handleErr(e){
    if(e&&e.code==="forbidden"){canWrite=false;$("addBtn").hidden=true;render();toast("You can view this board but not change it.");}
    else toast("Couldn't save. Check your connection and try again.");
  }

  function paintStatus(){const w=$("f_s");w.textContent="";for(const k in STATUS)w.append(h("button",{type:"button",class:"stat s-"+k,"aria-pressed":curStatus===k?"true":"false",onclick:()=>{curStatus=k;paintStatus();}},STATUS[k]));}
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
    const del=$("delBtn");del.hidden=!t||!canWrite;del.textContent="Delete";del.dataset.armed="";
    $("saveBtn").hidden=!canWrite;
    $("dlg").showModal();
  }
  $("cancelBtn").onclick=()=>$("dlg").close();
  $("delBtn").onclick=async()=>{const b=$("delBtn");if(!b.dataset.armed){b.dataset.armed="1";b.textContent="Tap again to delete";return;}
    try{await store.remove(editingId);$("dlg").close();toast("Task deleted");}catch(e){handleErr(e);}};
  $("frm").addEventListener("submit",async e=>{
    e.preventDefault();
    const data={t:$("f_t").value.trim(),c:$("f_c").value.trim()||"Other",o:$("f_o").value.trim(),d:$("f_d").value,s:curStatus,p:$("f_p").value,crit:$("f_crit").checked,n:$("f_n").value.trim(),u:Date.now()};
    if(!data.t||!store)return;
    const b=$("saveBtn");b.disabled=true;
    try{if(editingId)await store.set(editingId,data);else await store.add(data);$("dlg").close();toast(editingId?"Saved":"Task added");}
    catch(err){handleErr(err);}finally{b.disabled=false;}
  });
  $("addBtn").onclick=()=>openEditor(null);
  $("q").addEventListener("input",e=>{ui.q=e.target.value;renderBoard();});
  $("hidedone").onchange=e=>{ui.hideDone=e.target.checked;try{localStorage.setItem("ila_hide",ui.hideDone?"1":"0");}catch(_){}renderBoard();};

  // ---- boot ----
  renderBand();

  function showApp(){$("gate").hidden=true;$("app").hidden=false;render();}
  function showGate(msg,withForm){$("app").hidden=true;$("gate").hidden=false;$("gateMsg").textContent=msg;$("gateForm").hidden=!withForm;}
  async function startStore(s){
    store=s;showApp();
    try{await s.start(list=>{tasks=list;loaded=true;render();},()=>toast("Live updates paused. Reload to reconnect."));}
    catch(e){$("cards").textContent="";$("cards").append(h("div",{class:"empty",text:"Couldn't load the board. Check your connection and reload."}));}
  }

  const cfg=window.ILAAURA_CONFIG||{};
  if(!cfg.supabaseUrl||!cfg.supabaseAnonKey){$("localNote").hidden=false;startStore(IlaStore.localStore());return;}
  if(!window.supabase){showGate("Couldn't load the sign-in library. Check your connection and reload.",false);return;}

  const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
  let started=false;

  $("signOut").onclick=async()=>{await sb.auth.signOut();location.reload();};
  $("gateForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const email=$("gateEmail").value.trim(),b=$("gateBtn");if(!email)return;
    b.disabled=true;
    const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
    b.disabled=false;
    if(error)toast("Couldn't send the link: "+error.message);
    else showGate("Check "+email+" for a sign-in link. You can close this tab.",false);
  });

  async function onSignedIn(session){
    if(started)return;started=true;
    const email=session.user.email||"";
    $("userEmail").textContent=email;$("user").hidden=false;
    const {data,error}=await sb.from("board_members").select("email");
    if(error){showGate("Couldn't check your access. Reload to try again.",false);return;}
    if(!data.length){showGate(email+" isn't on this board yet. Ask the board owner to add you, then reload.",false);return;}
    startStore(IlaStore.supabaseStore(sb));
  }
  sb.auth.onAuthStateChange((event,session)=>{
    // Supabase advises against awaiting its own calls inside this callback.
    if(session)setTimeout(()=>onSignedIn(session),0);
    else if(!started)showGate("Enter your email and we'll send you a sign-in link.",true);
  });
})();
