let realRows = [];
let htf="YIT", zone="ALL", pattern="ALL";
const tfNames={Y:"Y",HY:"HY",Q:"Q",M:"M",W:"W"};
const executionMap={YIT:"QUARTERLY",HYIT:"MONTHLY",QIT:"WEEKLY",MIT:"DAILY",WIT:"DAILY"};
function trendMark(v){return v==="U"?"⬆️":v==="D"?"⬇️":"↔️"}
function trendClass(v){return v==="U"?"up":v==="D"?"down":"side"}
function trendHTML(tr){return ["Y","HY","Q","M","W"].map(k=>`<span title="${({Y:"Yearly",HY:"Half-Yearly",Q:"Quarterly",M:"Monthly",W:"Weekly"})[k]} trend: ${{U:"Up",D:"Down",S:"Sideways"}[tr?.[k]||"S"]}" class="trend-chip ${trendClass(tr?.[k]||"S")}">${k}${trendMark(tr?.[k]||"S")}</span>`).join(" ")}
function render(){
 const q=(document.getElementById("search").value||"").toLowerCase();
 let arr=realRows.filter(x=>(zone==="ALL"||x.zone_type===zone)&&(pattern==="ALL"||(x.htf_pattern||x.pattern)===pattern)&&x.symbol.toLowerCase().includes(q));
 const sort=document.getElementById("sort")?.value||"score";
 if(sort==="proximity") arr.sort((a,b)=>a.proximity_pct-b.proximity_pct); else if(sort==="age") arr.sort((a,b)=>String(b.htf_base_date).localeCompare(String(a.htf_base_date))); else arr.sort((a,b)=>b.strength-a.strength);
 document.getElementById("total").textContent=arr.length;
 document.getElementById("demand").textContent=arr.filter(x=>x.zone_type==="DEMAND").length;
 document.getElementById("supply").textContent=arr.filter(x=>x.zone_type==="SUPPLY").length;
 document.getElementById("fresh").textContent=arr.length;
 document.getElementById("showing").textContent=realRows.length?`Showing ${arr.length} of ${realRows.length} verified scanner matches`:(window.lastScanCompleted?"Scan completed — no stocks matched the selected rules.":"No scan run yet — tap Refresh Scan to fetch real NIFTY 500 results.");
 document.getElementById("cards").innerHTML=arr.map(card).join("");
}
function card(x){
 return `<article class="card">
 <div class="cardTop"><span class="grade">MATCH</span><div class="scorebar"><i style="width:${x.strength}%"></i></div><b>${x.strength}</b></div>
 <div class="symbol">${x.symbol}</div><div class="sector">NIFTY 500 • Yahoo Finance historical data</div>
 <div class="tagrow"><span class="price">CMP ₹<span data-cmp="${x.symbol}">${Number(x.ltp).toLocaleString("en-IN")}</span></span></div>
 <div class="tagrow"><span class="tag green">● ${x.zone_type}</span><span class="tag">${x.execution_timeframe}</span><span class="tag purple">HTF + EXECUTION</span><span class="tag">${x.htf_pattern||x.pattern||"-"}</span></div>
 <div class="info"><span>HTF Fresh Zone</span><b>₹${Number(x.htf_zone_low).toFixed(2)} – ₹${Number(x.htf_zone_high).toFixed(2)}</b></div>
 <div class="info"><span>Execution Zone</span><b>₹${Number(x.execution_zone_low).toFixed(2)} – ₹${Number(x.execution_zone_high).toFixed(2)}</b></div>
 <div class="info"><span>HTF Reaction</span><b>${x.htf_reaction} ATR</b></div>
 <div class="info"><span>Trend (Y/HY/Q/M/W)</span><b class="trend-list">${trendHTML(x.trend)}</b></div>
 <div class="info"><span>Execution RSI</span><b>${x.execution_rsi} • ${x.execution_rsi_status}</b></div>
 <div class="info"><span>Proximity</span><b>${x.proximity_pct}%</b></div>
 <button class="view" onclick='openRealChart(${JSON.stringify(x).replace(/'/g,"&#39;")})'>📊 VIEW COMBINED CHART</button></article>`;
}
async function openRealChart(x){
 const modal=document.getElementById("modal"); modal.classList.remove("hidden");
 document.getElementById("chartTitle").textContent=`${x.symbol} • Combined Chart`;
 document.getElementById("chartMeta").textContent=`Fetching verified historical OHLCV candles from Yahoo Finance…`;
 document.getElementById("htfInfo").textContent=`${x.htf} → ${x.execution_timeframe}`;
 document.getElementById("execInfo").textContent=`${x.execution_timeframe} • Fresh ${x.zone_type}`;
 document.getElementById("rsiInfo").textContent=`${x.execution_rsi} • ${x.execution_rsi_status}`;
 document.getElementById("matchInfo").textContent=`${x.zone_type} + ${x.zone_type} = MATCH`;
 document.getElementById("trendBadges").innerHTML=trendHTML(x.trend);
 renderRulePanel(x.rules);
 try{
   const r=await fetch(`/api/chart/${encodeURIComponent(x.symbol)}?htf=${encodeURIComponent(x.htf||htf)}`);
   const j=await r.json();
   if(!j.ok) throw new Error(j.error||"No chart data returned");
   document.getElementById("chartMeta").textContent=`${j.source} • ${j.timeframe} • Candle close: ${j.candles.at(-1).date} • CMP ₹${Number(j.current_price).toLocaleString("en-IN")} (${j.quote_source})`;
   document.getElementById("rsiInfo").textContent=`${j.execution_rsi} • ${j.execution_rsi>=70?"OB":j.execution_rsi<=30?"OS":"Normal"} (Execution only)`;
   document.getElementById("trendBadges").innerHTML=trendHTML(j.trends);
   drawRealChart(j,x);
 }catch(e){
   const c=document.getElementById("chart"),ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle="#07111d";ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="#ffb6b6";ctx.font="24px Arial";ctx.fillText("REAL CHART DATA UNAVAILABLE",55,100);ctx.font="17px Arial";ctx.fillStyle="#dce9f7";ctx.fillText(String(e.message||e),55,140);ctx.fillText("No synthetic candles are shown.",55,180);
   document.getElementById("chartMeta").textContent="Could not fetch verified chart data. Please retry.";
 }
}
function closeChart(){document.getElementById("modal").classList.add("hidden")}
function drawRealChart(j,scanRow){
 const c=document.getElementById("chart"),ctx=c.getContext("2d"),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle="#07111d";ctx.fillRect(0,0,w,h);
 const d=j.candles||[]; if(!d.length)return;
 const left=62,right=w-85,top=42,priceBottom=h-185,volTop=h-130,volBottom=h-75,rsiTop=h-65,rsiBottom=h-18;
 const zoneVals=[];for(const z of [j.htf_zone,j.execution_zone])if(z){zoneVals.push(Number(z.low),Number(z.high))}
 const lo=Math.min(...d.map(x=>x.low).concat(zoneVals.length?zoneVals:[]));const hi=Math.max(...d.map(x=>x.high).concat(zoneVals.length?zoneVals:[]));const pad=(hi-lo)*.06||1;const min=lo-pad,max=hi+pad;
 const y=v=>priceBottom-(v-min)/(max-min)*(priceBottom-top);const x=i=>left+i*(right-left)/d.length;const cw=Math.max(2,(right-left)/d.length*.62);
 ctx.strokeStyle="#18304c";ctx.lineWidth=1;for(let yy=top;yy<priceBottom;yy+=45){ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke()};for(let xx=left;xx<right;xx+=(right-left)/8){ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,rsiBottom);ctx.stroke()}
 function zone(z,color,label){if(!z)return;const y1=y(z.high),y2=y(z.low);ctx.fillStyle=color;ctx.fillRect(left,Math.min(y1,y2),right-left,Math.max(2,Math.abs(y2-y1)));ctx.strokeStyle=color.replace("0.15","0.9");ctx.strokeRect(left,Math.min(y1,y2),right-left,Math.max(2,Math.abs(y2-y1)));ctx.fillStyle="#dce9f7";ctx.font="12px Arial";ctx.fillText(`${label} ${z.type} ₹${Number(z.low).toFixed(2)}–₹${Number(z.high).toFixed(2)}`,left+8,Math.min(y1,y2)+15)}
 zone(j.htf_zone,"rgba(55,211,145,0.15)","HTF FRESH");zone(j.execution_zone,"rgba(155,124,244,0.15)","EXECUTION FRESH");
 // Real OHLC candles
 d.forEach((v,i)=>{const xx=x(i)+cw/2,yo=y(v.open),yc=y(v.close),yh=y(v.high),yl=y(v.low),up=v.close>=v.open;ctx.strokeStyle=up?"#36d58e":"#ff6670";ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(xx,yh);ctx.lineTo(xx,yl);ctx.stroke();ctx.fillRect(xx-cw/2,Math.min(yo,yc),cw,Math.max(1.5,Math.abs(yc-yo))) });
 // Actual 50 SMA line
 ctx.strokeStyle="#f0c85b";ctx.lineWidth=2;ctx.beginPath();let started=false;d.forEach((v,i)=>{if(v.sma50==null)return;const xx=x(i)+cw/2,yy=y(v.sma50);if(!started){ctx.moveTo(xx,yy);started=true}else ctx.lineTo(xx,yy)});ctx.stroke();ctx.fillStyle="#f0c85b";ctx.font="12px Arial";ctx.fillText("50 SMA",right-55,top+12);
 // Current price line
 const last=d[d.length-1], current=Number(j.current_price||last.close);
 // Current CMP line is separate from the last completed daily candle close.
 ctx.setLineDash([5,4]);ctx.strokeStyle="#e7eff9";ctx.beginPath();ctx.moveTo(left,y(current));ctx.lineTo(right,y(current));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#fff";ctx.fillText(`CMP ₹${current.toFixed(2)}`,right-105,y(current)-7);
 ctx.fillStyle="#8198b3";ctx.font="11px Arial";ctx.fillText(`Last completed close ₹${last.close.toFixed(2)}`,left+8,top+30);
 // Real volume bars
 const vmax=Math.max(1,...d.map(v=>v.volume||0));d.forEach((v,i)=>{const bh=((v.volume||0)/vmax)*(volBottom-volTop);ctx.fillStyle=v.close>=v.open?"#245e54":"#633942";ctx.fillRect(x(i),volBottom-bh,Math.max(1,cw),bh)});ctx.fillStyle="#8198b3";ctx.font="11px Arial";ctx.fillText("VOLUME",left,volTop-5);
 // Execution RSI values from daily candle series
 ctx.strokeStyle="#bb80df";ctx.lineWidth=2;ctx.beginPath();d.forEach((v,i)=>{const rv=v.rsi??50,yy=rsiBottom-(rv/100)*(rsiBottom-rsiTop);i?ctx.lineTo(x(i)+cw/2,yy):ctx.moveTo(x(i)+cw/2,yy)});ctx.stroke();ctx.strokeStyle="#39455d";for(const rv of [30,70]){const yy=rsiBottom-(rv/100)*(rsiBottom-rsiTop);ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke()}ctx.fillStyle="#bb80df";ctx.fillText(`RSI(14) ${last.rsi} • Execution`,left,rsiTop+10);
 // HTF reaction marker and match/confluence annotation based on backend-computed zones.
 if(j.htf_reaction && j.htf_zone){
   const rx=left+Math.min(right-left-18, Math.max(18,(right-left)*0.28));
   const ry=y((Number(j.htf_zone.low)+Number(j.htf_zone.high))/2);
   ctx.strokeStyle="#39d98a";ctx.fillStyle="#39d98a";ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(rx,ry-30);ctx.lineTo(rx,ry-7);ctx.stroke();
   ctx.beginPath();ctx.moveTo(rx-5,ry-13);ctx.lineTo(rx,ry-6);ctx.lineTo(rx+5,ry-13);ctx.stroke();
   ctx.font="11px Arial";ctx.fillText("HTF REACTION",Math.min(right-95,rx+7),ry-32);
 }
 if(j.match_direction){ctx.fillStyle="#c8b4ff";ctx.font="bold 12px Arial";ctx.fillText("HTF + EXECUTION MATCH",left+8,top+17);}
 ctx.fillStyle="#8198b3";ctx.font="11px Arial";ctx.fillText(`${d[0].date}  →  ${last.date}`,left,h-4);
}
function renderRulePanel(rules){const el=document.getElementById("rulePanel");if(!el)return;const labels={fresh_htf:"Fresh HTF Zone",htf_reaction:"HTF Reaction",fresh_execution:"Fresh Execution Zone",same_direction:"Same Direction",execution_near_zone:"Execution Near Zone",final_match:"Final Match"};el.innerHTML='<div class="ruleTitle">SCANNER RULES</div>'+Object.entries(labels).map(([k,v])=>`<span class="rule ${rules&&rules[k]?'pass':'fail'}">${rules&&rules[k]?'✓ PASS':'✕ FAIL'} ${v}</span>`).join("")}
function renderRealRows(rows){realRows=rows||[];render()}
async function runRealNifty500Scan(){
 const btn=document.querySelector(".refresh"),old=btn.textContent;btn.textContent="Scanning NIFTY 500…";btn.disabled=true;
 document.getElementById("providerStatus").textContent="Starting verified-data scan…";
 document.getElementById("providerStatus").className="providerStatus wait";
 const diag=document.getElementById("scanDiagnostics"); if(diag)diag.textContent="";
 try{
  const h=document.querySelector("#htf button.active")?.dataset.value||"YIT",z=document.querySelector("#zone button.active")?.dataset.zone||"ALL",p=document.querySelector("#pattern button.active")?.dataset.pattern||"ALL";
  const batchSize=50,total=500,batches=Math.ceil(total/batchSize),allRows=[];
  let dataOK=0,dataFailed=0,elapsed=0;const rejects={no_eligible_zones:0,reaction_failed:0,direction_failed:0,proximity_failed:0,other_analysis_errors:0};
  window.lastScanCompleted=false;renderRealRows([]);
  for(let batch=0;batch<batches;batch++){
   const offset=batch*batchSize;
   btn.textContent=`Scanning ${offset+1}–${Math.min(offset+batchSize,total)} / ${total}…`;
   document.getElementById("providerStatus").textContent=`Scanning batch ${batch+1}/${batches} • symbols ${offset+1}–${Math.min(offset+batchSize,total)} of ${total}`;
   const url=`/api/scan?htf=${encodeURIComponent(h)}&limit=${batchSize}&offset=${offset}&zone_type=${encodeURIComponent(z)}&pattern=${encodeURIComponent(p)}`;
   const r=await fetch(url);const j=await r.json();
   if(!r.ok||!j.ok)throw new Error(j.detail||j.error||`Batch ${batch+1} failed`);
   allRows.push(...(j.rows||[]));dataOK+=Number(j.data_success||0);dataFailed+=Number(j.data_failed||0);elapsed+=Number(j.elapsed_sec||0);
   for(const k of Object.keys(rejects))rejects[k]+=Number((j.rejection_reasons||{})[k]||0);
   // Keep partial matches visible while the remaining batches continue.
   allRows.sort((a,b)=>(b.strength||0)-(a.strength||0));renderRealRows(allRows);
   document.getElementById("providerStatus").textContent=`Scanning ${Math.min(offset+batchSize,total)}/${total} • ${dataOK} data OK • ${dataFailed} failed • ${allRows.length} matches so far`;
  }
  window.lastScanCompleted=true;renderRealRows(allRows);
  document.getElementById("providerStatus").textContent=`Scan completed • ${dataOK} data OK • ${dataFailed} failed • ${allRows.length} matches • ${elapsed.toFixed(2)}s combined batch time`;
  document.getElementById("providerStatus").className=(dataOK>0?"providerStatus ok":"providerStatus wait");
  let finalDiag=document.getElementById("scanDiagnostics");if(!finalDiag){finalDiag=document.createElement("div");finalDiag.id="scanDiagnostics";finalDiag.className="providerStatus";document.getElementById("providerStatus").insertAdjacentElement("afterend",finalDiag)}
  finalDiag.textContent=`Rejected: no zones ${rejects.no_eligible_zones} • reaction ${rejects.reaction_failed} • direction ${rejects.direction_failed} • proximity ${rejects.proximity_failed} • errors ${rejects.other_analysis_errors}`;
 }catch(e){
  document.getElementById("providerStatus").textContent=`Scan stopped: ${e.message||e} • partial matches shown: ${realRows.length}`;
  document.getElementById("providerStatus").className="providerStatus wait";
 }finally{btn.textContent=old;btn.disabled=false}
}
document.querySelectorAll("#htf button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#htf button").forEach(z=>z.classList.remove("active"));b.classList.add("active");document.getElementById("executionMappingBanner").textContent=`${b.dataset.value} → ${executionMap[b.dataset.value]} execution`;realRows=[];render()});
document.querySelectorAll("#zone button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#zone button").forEach(z=>z.classList.remove("active"));b.classList.add("active");zone=b.dataset.zone;render()});
document.querySelectorAll("#pattern button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#pattern button").forEach(z=>z.classList.remove("active"));b.classList.add("active");pattern=b.dataset.pattern;render()});
document.getElementById("search").oninput=render;document.getElementById("sort").onchange=render;document.querySelector(".refresh").onclick=runRealNifty500Scan;
async function refreshCMPs(){
 const syms=[...new Set([...document.querySelectorAll("[data-cmp]")].map(el=>el.dataset.cmp))];
 if(!syms.length)return;
 // Limit concurrent quote requests to reduce Yahoo throttling.
 let i=0;const workers=Array.from({length:5},async()=>{while(i<syms.length){const sym=syms[i++];try{const r=await fetch(`/api/quote/${encodeURIComponent(sym)}`);const j=await r.json();if(j.ok){document.querySelectorAll(`[data-cmp="${CSS.escape(sym)}"]`).forEach(el=>el.textContent=Number(j.price).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}));}}catch(e){/* keep last verified value; never fabricate CMP */}}});
 await Promise.all(workers);
}
async function checkProvider(){try{const r=await fetch("/api/config"),j=await r.json();document.getElementById("providerStatus").textContent="Backend connected • completed daily candles + latest available CMP quote";document.getElementById("providerStatus").className="providerStatus ok";}catch(e){document.getElementById("providerStatus").textContent="Backend unavailable";document.getElementById("providerStatus").className="providerStatus wait"}}
render();checkProvider();
// Run one NIFTY 500 scan automatically on first page load; user can re-scan manually later.
window.addEventListener("load",()=>{setTimeout(runRealNifty500Scan,250)});
setInterval(refreshCMPs,90000);
