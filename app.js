let realRows = [];
let htf="YIT", zone="ALL", pattern="ALL";
const tfNames={Y:"Y",HY:"HY",Q:"Q",M:"M",W:"W"};
const executionMap={YIT:"QUARTERLY",HYIT:"MONTHLY",QIT:"WEEKLY",MIT:"DAILY",WIT:"125 MINUTES"};
function trendMark(v){return v==="U"?"⬆️":v==="D"?"⬇️":"↔️"}
function trendClass(v){return v==="U"?"up":v==="D"?"down":"side"}
function trendHTML(tr){return ["Y","HY","Q","M","W"].map(k=>`<span title="${({Y:"Yearly",HY:"Half-Yearly",Q:"Quarterly",M:"Monthly",W:"Weekly"})[k]} trend: ${{U:"Up",D:"Down",S:"Sideways"}[tr?.[k]||"S"]}" class="trend-chip ${trendClass(tr?.[k]||"S")}">${k}${trendMark(tr?.[k]||"S")}</span>`).join(" ")}

let activeMainTab="MATCHES";
const setupMap={YIT:{reaction:"Yearly",execution:"Quarterly"},HYIT:{reaction:"Half-Yearly",execution:"Monthly"},QIT:{reaction:"Quarterly",execution:"Weekly"},MIT:{reaction:"Monthly",execution:"Daily"},WIT:{reaction:"Weekly",execution:"125 Minutes"}};
function ensureMainTabs(){
 const cards=document.getElementById("cards"); if(!cards || document.getElementById("mainViewTabs")) return;
 const bar=document.createElement("div");bar.id="mainViewTabs";bar.style.cssText="display:flex;gap:8px;margin:14px 0 10px;flex-wrap:wrap";
 const mk=(id,label)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.dataset.tab=id;b.style.cssText="border:1px solid #36516d;border-radius:8px;padding:9px 14px;background:#102033;color:#dce9f7;font-weight:700";b.onclick=()=>{activeMainTab=id;bar.querySelectorAll('button').forEach(q=>{q.style.background=q===b?'#245b48':'#102033';q.style.borderColor=q===b?'#36d58e':'#36516d'});cards.style.display=id==='MATCHES'?'grid':'none';const panel=document.getElementById('htfReactionPanel');if(panel)panel.style.display=id==='REACTION'?'block':'none';const zp=document.getElementById('zoneSetupPanel');if(zp)zp.style.display=id==='ZONE'?'block':'none';if(id==='REACTION')renderReactionPanel();if(id==='ZONE')renderZoneSetupPanel()};bar.appendChild(b);return b};
 mk("MATCHES","Execution Match");mk("REACTION","HTF Reaction");mk("ZONE","ZONE");cards.parentElement.insertBefore(bar,cards);
 const panel=document.createElement("div");panel.id="htfReactionPanel";panel.style.cssText="display:none;gap:8px";cards.parentElement.insertBefore(panel,cards);
 const zp=document.createElement("div");zp.id="zoneSetupPanel";zp.style.cssText="display:none;gap:8px";cards.parentElement.insertBefore(zp,cards);
}
function zoneLabel(z){return z?`${z.type} ₹${Number(z.low).toFixed(2)}–₹${Number(z.high).toFixed(2)} · ${z.base_date||"date n/a"}`:"—"}
function renderReactionPanel(){
 const panel=document.getElementById('htfReactionPanel');if(!panel)return;
 const rows=realRows.filter(x=>Number(x.htf_reaction)>=1);
 if(!rows.length){panel.innerHTML='<div style="padding:14px;color:#9db1c9">या स्कॅनमध्ये Reaction आलेले matching stocks सापडले नाहीत. Refresh Scan करा.</div>';return}
 const labels={Y:"Yearly",HY:"Half-Yearly",Q:"Quarterly",M:"Monthly",W:"Weekly",D:"Daily"};
 panel.innerHTML=rows.map(x=>{const z=x.all_timeframe_zones||{};const reactionTf=x.reaction_timeframe||(setupMap[x.htf]||{}).reaction||x.htf;const setupName=x.htf||"—";const execName=(setupMap[x.htf]||{}).execution||x.execution_timeframe||"—";return `<article style="background:#0d1b2b;border:1px solid #29445e;border-radius:10px;padding:12px;margin:8px 0;color:#e7eff9"><div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap"><b style="font-size:16px">${x.symbol}</b><span style="color:#65e0a2">Reaction TF: ${reactionTf} · ${x.zone_type} · ${x.htf_reaction} ATR</span><button class="view" onclick='openRealChart(${JSON.stringify(x).replace(/'/g,"&#39;")})'>View Chart</button></div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:8px"><span class="tag purple">Setup: ${setupName}</span><span class="tag purple">Execution: ${execName}</span></div><div style="font-size:12px;color:#9db1c9;margin-top:9px">All available timeframe zones (not only selected Reaction TF)</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:6px;margin-top:6px">${Object.entries(labels).map(([k,n])=>`<span class="tag">${n}: ${zoneLabel(z[k])}</span>`).join("")}</div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:9px"><span class="tag">Weekly Follow-up: ${zoneLabel(x.weekly_followup)}</span><span class="tag">Daily Follow-up: ${zoneLabel(x.daily_followup)}</span></div></article>`}).join('');
}
function renderZoneSetupPanel(){
 const panel=document.getElementById('zoneSetupPanel');if(!panel)return;
 const map={YIT:['Yearly','Quarterly'],HYIT:['Half-Yearly','Monthly'],QIT:['Quarterly','Weekly'],MIT:['Monthly','Daily'],WIT:['Weekly','125 Minutes']};
 const rows=realRows;
 panel.innerHTML='<div style="padding:10px;color:#9db1c9">Direct-trade setup mapping · सर्व HTF चे निकाल एकाच स्कॅनमधून</div>'+Object.entries(map).map(([setup,v])=>{const matches=rows.filter(x=>x.htf===setup);return `<section style="background:#0d1b2b;border:1px solid #29445e;border-radius:10px;padding:12px;margin:8px 0;color:#e7eff9"><b style="font-size:16px">${setup}</b><div style="margin:7px 0;color:#9db1c9">Reaction: ${v[0]} → Execution: ${v[1]}</div>${matches.length?matches.map(x=>`<div style="border-top:1px solid #29445e;padding:9px 0"><b>${x.symbol}</b> · ${x.zone_type} · ${x.htf_reaction} ATR <button class="view" onclick='openRealChart(${JSON.stringify(x).replace(/'/g,"&#39;")})'>Trade Chart</button><div class="tagrow"><span class="tag">Entry Zone ₹${Number(x.execution_zone_low).toFixed(2)}–₹${Number(x.execution_zone_high).toFixed(2)}</span><span class="tag purple">${x.execution_timeframe}</span></div></div>`).join(''):'<div style="color:#8297b0;padding:8px 0">या स्कॅनमध्ये या Setup साठी Match मिळाला नाही.</div>'}</section>`}).join('');
}

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
let activeZoneLayer = "HTF";
function ensureZoneLayerTabs(){
 const meta=document.getElementById("chartMeta"); if(!meta || document.getElementById("zoneLayerTabs")) return;
 const wrap=document.createElement("div"); wrap.id="zoneLayerTabs";
 wrap.style.cssText="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:10px 0 12px;padding:2px 0 8px;width:100%;max-width:100%;box-sizing:border-box;position:relative;z-index:2";
 const tabs=[["HTF","HTF"],["Y","Y"],["HY","HY"],["Q","Q"],["M","M"],["W","W"],["D","D"],["125","125m"],["ALL","ALL"]];
 tabs.forEach(([key,label])=>{const b=document.createElement("button");b.type="button";b.dataset.layer=key;b.textContent=label;
  b.style.cssText="min-width:0;width:100%;box-sizing:border-box;border:1px solid #36516d;border-radius:24px;padding:10px 4px;background:#102033;color:#dce9f7;font-size:13px;font-weight:700;white-space:nowrap";
  b.onclick=async()=>{activeZoneLayer=key;wrap.querySelectorAll("button").forEach(q=>{q.style.background=q===b?"#245b48":"#102033";q.style.borderColor=q===b?"#36d58e":"#36516d"});await reloadChartLayer(key)};
  wrap.appendChild(b);
 });
 meta.insertAdjacentElement("afterend",wrap);
 const trend=document.getElementById("trendBadges");
 if(trend){trend.style.display="none";}
 if(meta){meta.style.cssText+=";max-width:100%;overflow-wrap:anywhere;white-space:normal;box-sizing:border-box";}
 const title=document.getElementById("chartTitle");
 if(title){title.style.cssText+=";max-width:100%;overflow-wrap:anywhere;white-space:normal";}
 const chart=document.getElementById("chart");
 if(chart){chart.style.maxWidth="100%";chart.style.height="auto";chart.style.display="block";}
 const first=wrap.querySelector('[data-layer="HTF"]');if(first)first.click();
}
async function reloadChartLayer(layer){
 const x=window.zoneMatchScanRow;if(!x)return;
 const meta=document.getElementById("chartMeta");
 if(meta)meta.textContent=`Loading verified ${layer} timeframe candles…`;
 try{
  const r=await fetch(`/api/chart/${encodeURIComponent(x.symbol)}?htf=${encodeURIComponent(x.htf||htf)}&layer=${encodeURIComponent(layer)}`);
  const j=await r.json();if(!j.ok)throw new Error(j.error||"No chart data returned");
  document.getElementById("chartMeta").textContent=`${j.source} • ${j.timeframe} • Candle close: ${j.candles.at(-1).date} • CMP ₹${Number(j.current_price).toLocaleString("en-IN")} (${j.quote_source})`;
  document.getElementById("rsiInfo").textContent=`${j.execution_rsi} • ${j.execution_rsi>=70?"OB":j.execution_rsi<=30?"OS":"Normal"} (selected chart timeframe)`;
  document.getElementById("trendBadges").innerHTML="";
  window.zoneMatchChartData=j;drawRealChart(j,x);
 }catch(e){
  const c=document.getElementById("chart"),ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle="#07111d";ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="#ffb6b6";ctx.font="20px Arial";ctx.fillText("REAL CHART DATA UNAVAILABLE",40,90);ctx.font="15px Arial";ctx.fillStyle="#dce9f7";ctx.fillText(String(e.message||e),40,125);ctx.fillText("No synthetic candles are shown.",40,155);
  if(meta)meta.textContent=`Could not load ${layer} timeframe. Select another timeframe or retry.`;
 }
}

async function openRealChart(x){
 activeZoneLayer="HTF"; ensureZoneLayerTabs();
 const modal=document.getElementById("modal");
 // Open the chart as a dedicated full-page view within the same website.
 const chartUrl = new URL(window.location.href);
 chartUrl.searchParams.set("chart", x.symbol);
 chartUrl.searchParams.set("htf", x.htf || htf);
 history.pushState({zoneMatchChart: true, symbol: x.symbol}, "", chartUrl);
 modal.classList.remove("hidden");
 Object.assign(modal.style, {
   position:"fixed", inset:"0", zIndex:"99999", width:"100vw", height:"100dvh",
   maxWidth:"none", maxHeight:"none", margin:"0", padding:"12px",
   overflowY:"auto", borderRadius:"0", background:"#07111d"
 });
 document.body.style.overflow="hidden";
 document.getElementById("chartTitle").textContent=`${x.symbol} • Combined Chart`;
 document.getElementById("chartMeta").textContent=`Fetching verified historical OHLCV candles from Yahoo Finance…`;
 document.getElementById("htfInfo").textContent=`${x.htf} → ${x.execution_timeframe}`;
 document.getElementById("execInfo").textContent=`${x.execution_timeframe} • Fresh ${x.zone_type}`;
 document.getElementById("rsiInfo").textContent=`${x.execution_rsi} • ${x.execution_rsi_status}`;
 document.getElementById("matchInfo").textContent=`${x.zone_type} + ${x.zone_type} = MATCH`;
 document.getElementById("trendBadges").innerHTML=trendHTML(x.trend);
 renderRulePanel(x.rules);
 try{
   window.zoneMatchScanRow=x;
   const r=await fetch(`/api/chart/${encodeURIComponent(x.symbol)}?htf=${encodeURIComponent(x.htf||htf)}&layer=HTF`);
   const j=await r.json();
   if(!j.ok) throw new Error(j.error||"No chart data returned");
   document.getElementById("chartMeta").textContent=`${j.source} • ${j.timeframe} • Candle close: ${j.candles.at(-1).date} • CMP ₹${Number(j.current_price).toLocaleString("en-IN")} (${j.quote_source})`;
   document.getElementById("rsiInfo").textContent=`${j.execution_rsi} • ${j.execution_rsi>=70?"OB":j.execution_rsi<=30?"OS":"Normal"} (Execution only)`;
   document.getElementById("trendBadges").innerHTML="";
   window.zoneMatchChartData=j;window.zoneMatchScanRow=x;
   drawRealChart(j,x);
 }catch(e){
   const c=document.getElementById("chart"),ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle="#07111d";ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="#ffb6b6";ctx.font="24px Arial";ctx.fillText("REAL CHART DATA UNAVAILABLE",55,100);ctx.font="17px Arial";ctx.fillStyle="#dce9f7";ctx.fillText(String(e.message||e),55,140);ctx.fillText("No synthetic candles are shown.",55,180);
   document.getElementById("chartMeta").textContent="Could not fetch verified chart data. Please retry.";
 }
}
function closeChart(){
 const modal=document.getElementById("modal");
 modal.classList.add("hidden");
 modal.removeAttribute("style");
 document.body.style.overflow="";
 const u=new URL(window.location.href);
 if(u.searchParams.has("chart")) {
   u.searchParams.delete("chart"); u.searchParams.delete("htf");
   history.pushState({}, "", u);
 }
}
window.addEventListener("popstate",()=>{
 const modal=document.getElementById("modal");
 if(modal && !modal.classList.contains("hidden")) closeChart();
});
function drawRealChart(j,scanRow){
 const c=document.getElementById("chart"),ctx=c.getContext("2d"),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle="#07111d";ctx.fillRect(0,0,w,h);
 const d=j.candles||[]; if(!d.length)return;
 const left=62,right=w-85,top=42,priceBottom=h-185,volTop=h-130,volBottom=h-75,rsiTop=h-65,rsiBottom=h-18;
 const allZones=j.zones_by_timeframe||{};
 let layerZones=[];
 if(activeZoneLayer==="Y") layerZones=(allZones.Y||[]).map(z=>({...z,_tf:"YEARLY"}));
 else if(activeZoneLayer==="HY") layerZones=(allZones.HY||[]).map(z=>({...z,_tf:"HALF-YEARLY"}));
 else if(activeZoneLayer==="Q") layerZones=(allZones.Q||[]).map(z=>({...z,_tf:"QUARTERLY"}));
 else if(activeZoneLayer==="MONTH") layerZones=(allZones.M||[]).map(z=>({...z,_tf:"MONTHLY"}));
 else if(activeZoneLayer==="M") layerZones=(allZones.M||[]).map(z=>({...z,_tf:"MIT / DAILY"}));
 else if(activeZoneLayer==="W") layerZones=(allZones["125"]||[]).map(z=>({...z,_tf:"WIT / 125 MIN"}));
 else if(activeZoneLayer==="DW") layerZones=[...(allZones.D||[]).map(z=>({...z,_tf:"DAILY"})),...(allZones.W||[]).map(z=>({...z,_tf:"WEEKLY FOLLOW-UP"}))];
 else if(activeZoneLayer==="ALL") layerZones=[...["Y","HY","Q","M","W","D"].flatMap(k=>(allZones[k]||[]).slice(-2).map(z=>({...z,_tf:({Y:"YEARLY",HY:"HALF-YEARLY",Q:"QUARTERLY",M:"MONTHLY",W:"WEEKLY",D:"DAILY"})[k]}))),...(allZones["125"]||[]).slice(-2).map(z=>({...z,_tf:"WIT / 125 MIN"}))];
 else layerZones=[...(j.htf_zone?[{...j.htf_zone,_tf:`${j.htf} HTF`}]:[]),...(j.execution_zone?[{...j.execution_zone,_tf:`${j.execution_timeframe} EXECUTION`}]:[])];
 // Limit overlays to the most recent valid zones so the price scale remains readable.
 layerZones=layerZones.slice(-8);
 const zoneVals=[];for(const z of layerZones)if(z){zoneVals.push(Number(z.low),Number(z.high))}
 const lo=Math.min(...d.map(x=>x.low).concat(zoneVals.length?zoneVals:[]));const hi=Math.max(...d.map(x=>x.high).concat(zoneVals.length?zoneVals:[]));const pad=(hi-lo)*.06||1;const min=lo-pad,max=hi+pad;
 const y=v=>priceBottom-(v-min)/(max-min)*(priceBottom-top);const x=i=>left+i*(right-left)/d.length;const cw=Math.max(2,(right-left)/d.length*.62);
 ctx.strokeStyle="#18304c";ctx.lineWidth=1;for(let yy=top;yy<priceBottom;yy+=45){ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke()};for(let xx=left;xx<right;xx+=(right-left)/8){ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,rsiBottom);ctx.stroke()}
 function zone(z,color,label){
  if(!z || !Number.isFinite(Number(z.low)) || !Number.isFinite(Number(z.high))) return;
  const y1=y(Number(z.high)),y2=y(Number(z.low));
  // Anchor each zone at its actual base date on the daily candle timeline.
  const base=String(z.base_date||"");
  let startIndex=d.findIndex(v=>v.date>=base);
  if(startIndex<0) startIndex=0; // zone predates visible candles: show from left edge
  const zx=Math.max(left,x(startIndex));
  const zoneWidth=Math.max(4,right-zx);
  ctx.fillStyle=color;ctx.fillRect(zx,Math.min(y1,y2),zoneWidth,Math.max(2,Math.abs(y2-y1)));
  ctx.strokeStyle=color.replace("0.15","0.9");ctx.strokeRect(zx,Math.min(y1,y2),zoneWidth,Math.max(2,Math.abs(y2-y1)));
  ctx.fillStyle="#dce9f7";ctx.font="12px Arial";
  ctx.fillText(`${label} ${z.type} ₹${Number(z.low).toFixed(2)}–₹${Number(z.high).toFixed(2)}`,zx+5,Math.min(y1,y2)+15);
}
 layerZones.forEach((z,i)=>{const demand=z.type==="DEMAND";const color=demand?"rgba(55,211,145,0.15)":"rgba(255,102,112,0.15)";zone(z,color,`${z._tf||"ZONE"} ${z.type}`)});
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
   const dep=String(j.htf_zone.departure_date||j.htf_zone.base_date||"");
   let depIndex=d.findIndex(v=>v.date>=dep); if(depIndex<0) depIndex=0;
   const rx=Math.min(right-18,Math.max(left+18,x(depIndex)+cw/2));
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
function renderRealRows(rows){realRows=rows||[];ensureMainTabs();render();if(activeMainTab==="REACTION")renderReactionPanel();if(activeMainTab==="ZONE")renderZoneSetupPanel()}
async function runRealNifty500Scan(){
 const btn=document.querySelector(".refresh"),old=btn.textContent;btn.textContent="Scanning NIFTY 500…";btn.disabled=true;
 const status=document.getElementById("providerStatus");
 status.textContent="Starting verified-data scan…";status.className="providerStatus wait";
 const diag=document.getElementById("scanDiagnostics");if(diag)diag.textContent="";
 try{
  const h=document.querySelector("#htf button.active")?.dataset.value||htf||"YIT",z=document.querySelector("#zone button.active")?.dataset.zone||"ALL",p=document.querySelector("#pattern button.active")?.dataset.pattern||"ALL";
  htf=h;
  const batchSize=20,total=500,batches=Math.ceil(total/batchSize),maxAttempts=3;
  const key=`zonematch.scan.v2:${h}:${z}:${p}`;
  let state=null;
  try{state=JSON.parse(localStorage.getItem(key)||"null")}catch(_){state=null}
  if(!state||state.total!==total||state.batchSize!==batchSize||!Array.isArray(state.completed)||!Array.isArray(state.failed)||!Array.isArray(state.rows)){
   state={total,batchSize,completed:[],failed:[],rows:[],dataOK:0,dataFailed:0,elapsed:0,setupCounts:{YIT:0,HYIT:0,QIT:0,MIT:0,WIT:0},rejects:{no_eligible_zones:0,reaction_failed:0,direction_failed:0,proximity_failed:0,other_analysis_errors:0},phase:"main",nextBatch:0};
  }
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(state))}catch(e){status.textContent=`Progress save failed (browser storage): ${e.message||e}`}};
  const mergeRows=(rows)=>{const map=new Map(state.rows.map(x=>[`${x.symbol}|${x.htf||""}|${x.zone_type||""}|${x.zone_low||x.low||""}|${x.zone_high||x.high||""}`,x]));for(const x of rows||[])map.set(`${x.symbol}|${x.htf||""}|${x.zone_type||""}|${x.zone_low||x.low||""}|${x.zone_high||x.high||""}`,x);state.rows=[...map.values()];state.rows.sort((a,b)=>(b.strength||0)-(a.strength||0));};
  const addStats=(j)=>{state.dataOK+=Number(j.data_success||0);state.dataFailed+=Number(j.data_failed||0);state.elapsed+=Number(j.elapsed_sec||0);for(const k of Object.keys(state.setupCounts))state.setupCounts[k]+=Number((j.matches_by_setup||{})[k]||0);for(const k of Object.keys(state.rejects))state.rejects[k]+=Number((j.rejection_reasons||{})[k]||0)};
  const renderProgress=(message)=>{renderRealRows(state.rows);status.textContent=message;};
  window.lastScanCompleted=false;renderProgress(`Resuming scan • ${state.completed.length}/${batches} batches completed • ${state.rows.length} saved matches`);
  async function scanOne(batch,attempt,phase){
   const offset=batch*batchSize;
   btn.textContent=`${phase==="retry"?"Retrying failed":"Scanning"} batch ${batch+1}/${batches} • attempt ${attempt}/${maxAttempts}`;
   status.textContent=`${phase==="retry"?"Retrying failed batch":"Scanning batch"} ${batch+1}/${batches} • attempt ${attempt}/${maxAttempts} • ${state.completed.length}/${batches} completed • ${state.rows.length} saved matches`;
   const url=`/api/scan-all?limit=${batchSize}&offset=${offset}&zone_type=${encodeURIComponent(z)}&pattern=${encodeURIComponent(p)}`;
   const controller=new AbortController(),timeoutId=setTimeout(()=>controller.abort(),120000);let r,j;
   try{r=await fetch(url,{signal:controller.signal});j=await r.json()}catch(e){throw new Error(e.name==="AbortError"?`Batch ${batch+1} timed out after 120 seconds`:e.message||String(e))}finally{clearTimeout(timeoutId)}
   if(!r.ok||!j.ok)throw new Error(j.detail||j.error||`Batch ${batch+1} failed`);
   mergeRows(j.rows||[]);addStats(j);state.completed=[...new Set([...state.completed,batch])];state.failed=state.failed.filter(x=>x!==batch);save();renderProgress(`Batch ${batch+1}/${batches} saved • ${state.completed.length}/${batches} completed • ${state.rows.length} saved matches`);
  }
  // Resume remaining main-pass batches; keep going even when a batch exhausts retries.
  state.phase="main";save();
  for(let batch=0;batch<batches;batch++){
   if(state.completed.includes(batch))continue;
   let ok=false,lastError="";
   for(let attempt=1;attempt<=maxAttempts&&!ok;attempt++){
    try{await scanOne(batch,attempt,"main");ok=true}catch(e){lastError=e.message||String(e);state.failed=[...new Set([...state.failed,batch])];save();status.textContent=`Batch ${batch+1} failed attempt ${attempt}/${maxAttempts}: ${lastError} • continuing to next batch`;await new Promise(resolve=>setTimeout(resolve,700*attempt));}
   }
   if(!ok){state.failed=[...new Set([...state.failed,batch])];save()}
  }
  // Final retry pass: only batches that failed the main pass are retried.
  state.phase="retry";save();
  for(const batch of [...state.failed]){
   let ok=false,lastError="";
   for(let attempt=1;attempt<=maxAttempts&&!ok;attempt++){
    try{await scanOne(batch,attempt,"retry");ok=true}catch(e){lastError=e.message||String(e);status.textContent=`Final retry: batch ${batch+1} failed attempt ${attempt}/${maxAttempts}: ${lastError}`;await new Promise(resolve=>setTimeout(resolve,1000*attempt));}
   }
   if(!ok){state.failed=[...new Set([...state.failed,batch])];save()}
  }
  state.phase=state.failed.length?"finished_with_failures":"complete";state.nextBatch=null;save();window.lastScanCompleted=state.failed.length===0;renderRealRows(state.rows);
  status.textContent=`Scan ${state.failed.length?"finished with failed batches":"completed"} • ${state.completed.length}/${batches} batches completed • ${state.failed.length} failed batches remaining • ${state.dataOK} data OK • ${state.dataFailed} data failed • ${state.rows.length} saved matches`;
  status.className=state.dataOK>0?"providerStatus ok":"providerStatus wait";
  let finalDiag=document.getElementById("scanDiagnostics");if(!finalDiag){finalDiag=document.createElement("div");finalDiag.id="scanDiagnostics";finalDiag.className="providerStatus";status.insertAdjacentElement("afterend",finalDiag)}
  finalDiag.textContent=`Matches by setup — YIT ${state.setupCounts.YIT} • HYIT ${state.setupCounts.HYIT} • QIT ${state.setupCounts.QIT} • MIT ${state.setupCounts.MIT} • WIT ${state.setupCounts.WIT} | Rejected: no zones ${state.rejects.no_eligible_zones} • reaction ${state.rejects.reaction_failed} • direction ${state.rejects.direction_failed} • proximity ${state.rejects.proximity_failed} • errors ${state.rejects.other_analysis_errors}${state.failed.length?` | Failed batches: ${state.failed.map(x=>x+1).join(", ")}`:""}`;
 }catch(e){document.getElementById("providerStatus").textContent=`Scan stopped: ${e.message||e} • partial matches shown: ${realRows.length}`;document.getElementById("providerStatus").className="providerStatus wait"}
 finally{btn.textContent=old;btn.disabled=false}
}
document.querySelectorAll("#htf button").forEach(b=>b.onclick=()=>{
 document.querySelectorAll("#htf button").forEach(z=>z.classList.remove("active"));
 b.classList.add("active");
 htf=b.dataset.value;
 document.getElementById("executionMappingBanner").textContent=`${b.dataset.value} → ${executionMap[b.dataset.value]} execution`;
 realRows=[]; window.lastScanCompleted=false; render();
 // Changing the selected higher timeframe immediately starts a new scan.
 runRealNifty500Scan();
});
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

window.addEventListener("DOMContentLoaded",()=>{ensureMainTabs();const b=document.querySelector("#executionMappingBanner");if(b)b.textContent="YIT → Quarterly • HYIT → Monthly • QIT → Weekly • MIT → Daily • WIT → 125 Minutes";});
