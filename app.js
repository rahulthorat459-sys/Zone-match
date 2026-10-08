const data=[
["ABBOTINDIA","Healthcare",25910,98,"DEMAND","RBR","MONTHLY","QUARTERLY",23800,23980,48.38,14,{"Y":"U","HY":"U","Q":"S","M":"U","W":"U"}],
["KIMS","Healthcare",781.95,96,"DEMAND","RBR","MONTHLY","QUARTERLY",706.85,716.2,70.45,5,{"Y":"U","HY":"U","Q":"U","M":"U","W":"S"}],
["DEVYANI","Consumer Services",138.51,96,"DEMAND","RBR","DAILY","WEEKLY",125.09,127.4,63.37,2,{"Y":"U","HY":"U","Q":"U","M":"S","W":"U"}],
["LICI","Financial Services",400,95,"DEMAND","RBR","QUARTERLY","WEEKLY",340.5,345.2,39.79,10,{"Y":"U","HY":"U","Q":"U","M":"S","W":"U"}],
["BSE","Financial Services",3259,93,"DEMAND","RBR","QUARTERLY","WEEKLY",2959,3005,42.37,6,{"Y":"U","HY":"U","Q":"S","M":"U","W":"U"}],
["ABB","Capital Goods",7130.5,91,"DEMAND","RBR","DAILY","WEEKLY",6885,6960,55.2,3,{"Y":"U","HY":"U","Q":"U","M":"U","W":"U"}],
["ENRIN","Capital Goods",3109.1,93,"DEMAND","RBR","QUARTERLY","WEEKLY",2935,2980,52.1,4,{"Y":"U","HY":"U","Q":"U","M":"U","W":"U"}],
["SRF","Chemicals",2536,93,"DEMAND","RBR","MONTHLY","QUARTERLY",2308,2360,46.2,7,{"Y":"U","HY":"U","Q":"S","M":"U","W":"U"}]
];
let htf="YIT", zone="ALL", pattern="ALL", fresh=true;

function executionFor(h){return {YIT:"QUARTERLY",HYIT:"MONTHLY",QIT:"WEEKLY",MIT:"DAILY",WIT:"125 MINUTES"}[h]}
function render(){
 let q=(document.getElementById("search").value||"").toLowerCase();
 let arr=data.filter(x=>(zone==="ALL"||x[4]===zone)&&(pattern==="ALL"||x[5]===pattern)&&(x[0]+x[1]).toLowerCase().includes(q));
 arr.sort((a,b)=>b[3]-a[3]);
 document.getElementById("total").textContent=arr.length;
 document.getElementById("demand").textContent=arr.filter(x=>x[4]=="DEMAND").length;
 document.getElementById("supply").textContent=arr.filter(x=>x[4]=="SUPPLY").length;
 document.getElementById("fresh").textContent=arr.length;
 document.getElementById("showing").textContent=`Showing ${arr.length} of ${data.length} matches`;
 document.getElementById("cards").innerHTML=arr.map((x,i)=>card(x,i)).join("");
}
function card(x,i){
 let [sym,sector,price,score,zt,pat,htfzone,exec,lo,hi,rsi,age,tr]=x;
 let rsiState=rsi>=70?"OB":rsi<=30?"OS":"Normal";
 return `<article class="card">
  <div class="cardTop"><span class="grade">A+</span><div class="scorebar"><i style="width:${score}%"></i></div><b>${score}</b></div>
  <div class="symbol">${sym}</div><div class="sector">${sector}</div>
  <div class="tagrow"><span class="price">CMP ₹${price.toLocaleString("en-IN")}</span></div>
  <div class="tagrow"><span class="tag">${exec}</span><span class="tag green">● ${zt}</span><span class="tag">${pat}</span><span class="tag purple">Zone + HTF</span></div>
  <div class="info"><span>Fresh zone</span><b>₹${lo.toLocaleString("en-IN")} – ₹${hi.toLocaleString("en-IN")}</b></div>
  <div class="info"><span>HTF</span><b>${htfzone}</b></div>
  <div class="info"><span>Trend</span><b class="trend">${tr.Y} / ${tr.HY} / ${tr.Q} / ${tr.M} / ${tr.W}</b></div>
  <div class="info"><span>Zone age</span><b>${age} periods</b></div>
  <div class="info"><span>Execution RSI</span><b>${rsi.toFixed(2)} • ${rsiState}</b></div>
  <button class="view" onclick='openChart(${JSON.stringify(x)})'>📊 VIEW COMBINED CHART</button>
 </article>`
}
function openChart(x){
 let [sym,sector,price,score,zt,pat,htfzone,exec,lo,hi,rsi,age,tr]=x;
 document.getElementById("modal").classList.remove("hidden");
 document.getElementById("chartTitle").textContent=`${sym} • Combined Chart`;
 document.getElementById("chartMeta").textContent=`${sector} • ${zt} • ${pat} • Fresh HTF + Execution Match`;
 document.getElementById("htfInfo").textContent=`${htf} → ${htfzone}`;
 document.getElementById("execInfo").textContent=`${exec} • Fresh ${zt}`;
 document.getElementById("rsiInfo").textContent=`${rsi.toFixed(2)} • ${rsi>=70?"OB":rsi<=30?"OS":"Normal"}`;
 document.getElementById("matchInfo").textContent=`${zt} + ${zt} = MATCH`;
 document.getElementById("trendBadges").innerHTML=Object.entries(tr).map(([k,v])=>`<span class="badge ${v==="U"?"up":v==="D"?"down":"side"}">${k}: ${v}</span>`).join("");
 drawChart(x);
}
function closeChart(){document.getElementById("modal").classList.add("hidden")}
function drawChart(x){
 const c=document.getElementById("chart"),ctx=c.getContext("2d"),w=c.width,h=c.height;
 ctx.clearRect(0,0,w,h); ctx.fillStyle="#07111d"; ctx.fillRect(0,0,w,h);

 // Synthetic visual candles are used only for the chart illustration in the UI.
 // The scanner's actual match result comes from the backend calculation.
 const seed=(x[0]||"X").split("").reduce((a,b)=>a+b.charCodeAt(0),0);
 const n=92, px=(w-105)/n, vals=[];
 for(let i=0;i<n;i++) vals.push(x[2]*(.94+i*.0012+Math.sin(i*.22+seed)*.035+Math.sin(i*.071)*.055));
 const max=Math.max(...vals)*1.05,min=Math.min(...vals)*.95;
 const yy=v=>42+(max-v)/(max-min)*(h-185);

 // Grid
 ctx.strokeStyle="#18304c"; ctx.lineWidth=1;
 for(let y=55;y<h-105;y+=48){ctx.beginPath();ctx.moveTo(48,y);ctx.lineTo(w-30,y);ctx.stroke();}
 for(let i=0;i<=8;i++){let xx=55+i*(w-95)/8;ctx.beginPath();ctx.moveTo(xx,42);ctx.lineTo(xx,h-90);ctx.stroke();}

 // 50 SMA
 const sma=[];
 for(let i=0;i<n;i++){
   const a=Math.max(0,i-49), arr=vals.slice(a,i+1);
   sma.push(arr.reduce((p,q)=>p+q,0)/arr.length);
 }
 ctx.strokeStyle="#f0c85b";ctx.lineWidth=2;ctx.beginPath();
 sma.forEach((v,i)=>{let xx=55+i*px,y=yy(v);i?ctx.lineTo(xx,y):ctx.moveTo(xx,y)});ctx.stroke();
 ctx.fillStyle="#f0c85b";ctx.font="11px Arial";ctx.fillText("50 SMA",w-90,yy(sma[n-1])-7);

 // Candles
 vals.forEach((v,i)=>{
   const xx=55+i*px, o=v*(1+Math.sin(i*2.3+seed)*.006), cl=v*(1+Math.cos(i*1.8+seed)*.006);
   const hi=Math.max(o,cl)*1.007, lo=Math.min(o,cl)*.993;
   const up=cl>=o; ctx.strokeStyle=up?"#36d58e":"#ff6670"; ctx.fillStyle=ctx.strokeStyle;
   ctx.beginPath();ctx.moveTo(xx,yy(hi));ctx.lineTo(xx,yy(lo));ctx.stroke();
   const top=yy(Math.max(o,cl)), bot=yy(Math.min(o,cl));
   ctx.fillRect(xx-2.5,top,5,Math.max(3,bot-top));
 });

 // HTF zone
 const hLo=Number(x[8]),hHi=Number(x[9]);
 const z1=yy(hLo),z2=yy(hHi),zt=Math.min(z1,z2),zh=Math.abs(z1-z2);
 ctx.fillStyle=x[4]==="SUPPLY"?"rgba(255,92,105,.17)":"rgba(53,211,145,.17)";
 ctx.fillRect(55,zt,w-100,Math.max(18,zh));
 ctx.strokeStyle=x[4]==="SUPPLY"?"#ff6470":"#45d99a";
 ctx.strokeRect(55,zt,w-100,Math.max(18,zh));
 ctx.font="bold 13px Arial";ctx.fillStyle="#dce9f7";
 ctx.fillText(`HTF FRESH ${x[4]||"ZONE"}`,70,zt+20);
 ctx.font="11px Arial";ctx.fillStyle="#8ea5bf";
 ctx.fillText(`Zone ₹${hLo.toFixed(2)} – ₹${hHi.toFixed(2)}`,70,zt+37);

 // Execution zone: narrower highlighted band inside the HTF zone when available.
 let eLo=hLo+(hHi-hLo)*.25, eHi=hLo+(hHi-hLo)*.55;
 if(x.length>13 && Number.isFinite(Number(x[13]))){ eLo=Number(x[13]); eHi=Number(x[14]); }
 const ez1=yy(eLo),ez2=yy(eHi),et=Math.min(ez1,ez2);
 ctx.setLineDash([6,5]);ctx.strokeStyle="#9b7cf4";ctx.strokeRect(w*.36,et,w*.50,Math.max(16,Math.abs(ez1-ez2)));ctx.setLineDash([]);
 ctx.fillStyle="#b99cff";ctx.font="bold 11px Arial";ctx.fillText(`EXECUTION ${x[7]||""} • MATCH`,w*.38,et-7);

 // Reaction arrow
 const ax=w*.30, ay=zt+zh+35;
 ctx.strokeStyle="#49dba0";ctx.fillStyle="#49dba0";ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(ax,ay+35);ctx.lineTo(ax,ay);ctx.stroke();
 ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax-5,ay+8);ctx.moveTo(ax,ay);ctx.lineTo(ax+5,ay+8);ctx.stroke();
 ctx.font="11px Arial";ctx.fillText("HTF REACTION",ax-42,ay+52);

 // Current price
 const cp=yy(Number(x[2]));ctx.setLineDash([3,4]);ctx.strokeStyle="#d8e2ef";ctx.beginPath();ctx.moveTo(55,cp);ctx.lineTo(w-30,cp);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle="#e7eff9";ctx.font="bold 11px Arial";ctx.fillText(`CMP ₹${Number(x[2]).toFixed(2)}`,w-130,cp-7);

 // Volume area
 const vh=h-85;ctx.fillStyle="#0c1d31";ctx.fillRect(55,vh,w-100,45);
 for(let i=0;i<n;i++){const xx=55+i*px;const bar=8+Math.abs(Math.sin(i*1.7+seed))*28;ctx.fillStyle="#23415d";ctx.fillRect(xx-2,vh+45-bar,4,bar);}
 ctx.fillStyle="#7088a4";ctx.font="9px Arial";ctx.fillText("VOLUME",58,vh+12);

 // RSI panel — execution only
 const rTop=h-35;ctx.strokeStyle="#283f5a";ctx.beginPath();ctx.moveTo(55,rTop);ctx.lineTo(w-45,rTop);ctx.stroke();
 const rv=Number(x[10]||50);const rY=rTop-(rv-50)*.45;
 ctx.strokeStyle="#bb80df";ctx.lineWidth=2;ctx.beginPath();
 for(let i=0;i<n;i++){let xx=55+i*px,y=rY+Math.sin(i*.4)*8;i?ctx.lineTo(xx,y):ctx.moveTo(xx,y)}ctx.stroke();
 ctx.fillStyle="#bb80df";ctx.font="10px Arial";ctx.fillText(`RSI ${rv.toFixed(2)} • ${rv>=70?"OB":rv<=30?"OS":"Normal"} (Execution)`,60,rTop-8);

 // Legend
 ctx.font="10px Arial";ctx.fillStyle="#7f96b0";
 ctx.fillText("50 SMA",60,22);ctx.fillText("HTF Fresh Zone",125,22);ctx.fillText("Execution Zone",230,22);ctx.fillText("Reaction",330,22);
}
document.querySelectorAll("#htf button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#htf button").forEach(z=>z.classList.remove("active"));b.classList.add("active");htf=b.dataset.value;render()});
document.querySelectorAll("#zone button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#zone button").forEach(z=>z.classList.remove("active"));b.classList.add("active");zone=b.dataset.zone;render()});
document.querySelectorAll("#pattern button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#pattern button").forEach(z=>z.classList.remove("active"));b.classList.add("active");pattern=b.dataset.pattern;render()});
document.getElementById("search").oninput=render;
function scan(){render()}
render();
async function checkProvider(){
  const el=document.getElementById("providerStatus");
  try{
    const r=await fetch("/api/config"); const j=await r.json();
    el.textContent="● EXECUTION MAPPING: YIT → Quarterly • HYIT → Monthly • QIT → Weekly • MIT → Daily • WIT → Daily";
    el.className="providerStatus ok";
  }catch(e){
    el.textContent="○ Backend not connected • UI demo mode";
    el.className="providerStatus wait";
  }
}
checkProvider();

async function runRealNifty500Scan(){
  const btn=document.querySelector(".refresh");
  const old=btn.textContent; btn.textContent="Scanning NIFTY 500…"; btn.disabled=true;
  try{
    const h=document.querySelector("#htf button.active")?.dataset.value||"YIT";
    const z=document.querySelector("#zone button.active")?.dataset.zone||"ALL"; const p=document.querySelector("#pattern button.active")?.dataset.pattern||"ALL";
    const r=await fetch(`/api/scan?htf=${h}&limit=500&zone_type=${z}&pattern=${p}`);
    const j=await r.json();
    if(j.ok && Array.isArray(j.rows)){
      renderRealRows(j.rows);
      return;
    }
  }catch(e){}
  finally{btn.textContent=old;btn.disabled=false}
}
function renderRealRows(rows){
  document.getElementById("total").textContent=rows.length;
  document.getElementById("demand").textContent=rows.filter(x=>x.zone_type==="DEMAND").length;
  document.getElementById("supply").textContent=rows.filter(x=>x.zone_type==="SUPPLY").length;
  document.getElementById("fresh").textContent=rows.length;
  document.getElementById("showing").textContent=`Showing ${rows.length} valid HTF + Execution matches`;
  document.getElementById("cards").innerHTML=rows.map(x=>`
  <article class="card">
    <div class="cardTop"><span class="grade">MATCH</span><div class="scorebar"><i style="width:${x.strength}%"></i></div><b>${x.strength}</b></div>
    <div class="symbol">${x.symbol}</div><div class="sector">NIFTY 500</div>
    <div class="tagrow"><span class="price">CMP ₹${Number(x.ltp).toLocaleString("en-IN")}</span></div>
    <div class="tagrow"><span class="tag green">● ${x.zone_type}</span><span class="tag">${x.execution_timeframe}</span><span class="tag purple">HTF + EXECUTION</span><span class="tag">${x.htf_pattern||x.pattern}</span><span class="tag">${x.execution_pattern||"-"}</span></div>
    <div class="info"><span>HTF Zone</span><b>₹${Number(x.htf_zone_low).toFixed(2)} – ₹${Number(x.htf_zone_high).toFixed(2)}</b></div>
    <div class="info"><span>Execution Zone</span><b>₹${Number(x.execution_zone_low).toFixed(2)} – ₹${Number(x.execution_zone_high).toFixed(2)}</b></div>
    <div class="info"><span>HTF Reaction</span><b>${x.htf_reaction} ATR</b></div>
    <div class="info"><span>Trend</span><b class="trend">${x.trend.Y}/${x.trend.HY}/${x.trend.Q}/${x.trend.M}/${x.trend.W}</b></div>
    <div class="info"><span>Execution RSI</span><b>${x.execution_rsi} • ${x.execution_rsi_status}</b></div>
    <div class="info"><span>Proximity</span><b>${x.proximity_pct}%</b></div>
    <button class="view" onclick='openRealChart(${JSON.stringify(x)})'>📊 VIEW COMBINED CHART</button>
  </article>`).join("");
}
document.querySelector(".refresh").onclick=runRealNifty500Scan;

function ruleText(r){
  return Object.entries(r||{}).map(([k,v])=>`${v?"✓":"✕"} ${k.replaceAll("_"," ")}`).join(" • ");
}

function renderRulePanel(rules){
 const el=document.getElementById("rulePanel"); if(!el)return;
 const labels={fresh_htf:"Fresh HTF Zone",htf_reaction:"HTF Reaction",fresh_execution:"Fresh Execution Zone",same_direction:"Same Direction",execution_near_zone:"Execution Near Zone",final_match:"Final Match"};
 el.innerHTML='<div class="ruleTitle">SCANNER RULES</div>'+Object.entries(labels).map(([k,v])=>`<span class="rule ${rules&&rules[k]?'pass':'fail'}">${rules&&rules[k]?'✓ PASS':'✕ FAIL'} ${v}</span>`).join("");
}
