"""
ZoneMatch Scanner V2 — real-data foundation.

Run:
  pip install fastapi uvicorn pandas numpy yfinance requests
  uvicorn server_v2:app --reload

Important:
- NIFTY 500 membership is loaded from the official NSE Indices CSV.
- HTF candles can be built from verified Yahoo Finance market history.
- 125-minute execution data is NOT fabricated. A broker/data-provider adapter
  must be connected before Execution Match results are marked valid.
"""
from __future__ import annotations
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import io, time, json, math, requests
import numpy as np
import pandas as pd

import os
from datetime import datetime, timedelta

DHAN_BASE = "https://api.dhan.co/v2"
DHAN_TOKEN = os.getenv("DHAN_ACCESS_TOKEN", "").strip()
DHAN_CLIENT_ID = os.getenv("DHAN_CLIENT_ID", "").strip()
DHAN_MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master.csv"

def dhan_ready():
    return bool(DHAN_TOKEN and DHAN_CLIENT_ID)

def dhan_security_map():
    """Map NSE equity trading symbols to Dhan Security IDs."""
    cache = CACHE / "dhan_scrip_master.csv"
    try:
        r = requests.get(DHAN_MASTER_URL, timeout=30, headers={"User-Agent":"Mozilla/5.0"})
        r.raise_for_status()
        cache.write_bytes(r.content)
    except Exception:
        if not cache.exists():
            raise
    df = pd.read_csv(cache, low_memory=False)
    # Compact master names can vary slightly between releases.
    sym_col = next((c for c in df.columns if c in ["SEM_TRADING_SYMBOL","SM_SYMBOL_NAME","SYMBOL_NAME"]), None)
    id_col = next((c for c in df.columns if c in ["SEM_SECURITY_ID","SECURITY_ID"]), None)
    seg_col = next((c for c in df.columns if c in ["SEM_SEGMENT","SEGMENT"]), None)
    exch_col = next((c for c in df.columns if c in ["SEM_EXM_EXCH_ID","EXCH_ID"]), None)
    inst_col = next((c for c in df.columns if c in ["SEM_INSTRUMENT_NAME","INSTRUMENT"]), None)
    if not sym_col or not id_col:
        raise RuntimeError("Dhan instrument master columns not recognized")
    df[sym_col]=df[sym_col].astype(str).str.strip()
    out={}
    for _,r in df.iterrows():
        if seg_col and str(r[seg_col]).upper() not in ("E","EQUITY"):
            continue
        if exch_col and str(r[exch_col]).upper()!="NSE":
            continue
        if inst_col and str(r[inst_col]).upper() not in ("EQUITY","ES","NA",""):
            # Keep equity rows; skip obvious derivative rows.
            continue
        out[str(r[sym_col]).strip()] = str(r[id_col]).strip()
    return out

def dhan_intraday_5m(security_id, from_dt, to_dt):
    if not dhan_ready():
        raise RuntimeError("Dhan credentials not configured")
    payload={
        "securityId":str(security_id),
        "exchangeSegment":"NSE_EQ",
        "instrument":"EQUITY",
        "interval":"5",
        "oi":False,
        "fromDate":from_dt.strftime("%Y-%m-%d %H:%M:%S"),
        "toDate":to_dt.strftime("%Y-%m-%d %H:%M:%S")
    }
    r=requests.post(
        DHAN_BASE+"/charts/intraday",
        headers={"Accept":"application/json","Content-Type":"application/json",
                 "access-token":DHAN_TOKEN},
        json=payload, timeout=30
    )
    r.raise_for_status()
    j=r.json()
    if not all(k in j for k in ("open","high","low","close","volume","timestamp")):
        raise RuntimeError(f"Unexpected Dhan response: {j}")
    n=min(map(len,[j["open"],j["high"],j["low"],j["close"],j["volume"],j["timestamp"]]))
    if n==0: return pd.DataFrame()
    # Dhan V2 returns UNIX timestamps according to current documentation.
    idx=pd.to_datetime(j["timestamp"][:n], unit="s", utc=True).tz_convert("Asia/Kolkata").tz_localize(None)
    return pd.DataFrame({
        "Open":j["open"][:n],"High":j["high"][:n],"Low":j["low"][:n],
        "Close":j["close"][:n],"Volume":j["volume"][:n]
    }, index=idx).sort_index()

def aggregate_125_from_5m(df):
    """Exactly 25 x 5-minute candles = 125 minutes.
    Session-aligned groups start at 09:15, 11:20 and 13:25 IST.
    """
    if df.empty: return df
    d=df.between_time("09:15","15:30").copy()
    d["session_day"]=d.index.date
    # 09:15 + 125-minute buckets; use minutes since session start.
    mins=(d.index.hour*60+d.index.minute)-(9*60+15)
    d["bucket"]=(mins//125).astype(int)
    g=d.groupby(["session_day","bucket"], sort=True)
    out=g.agg({"Open":"first","High":"max","Low":"min","Close":"last","Volume":"sum"}).dropna()
    out.index=pd.to_datetime([f"{day} {9*60+15+bucket*125//60:02d}:{(9*60+15+bucket*125)%60:02d}:00"
                              for day,bucket in out.index])
    return out

def execution_125_for_symbol(symbol, days=90):
    sm=dhan_security_map()
    sid=sm.get(symbol)
    if not sid:
        raise RuntimeError(f"No Dhan securityId for {symbol}")
    end=datetime.now()
    start=end-timedelta(days=min(days,90))
    five=dhan_intraday_5m(sid,start,end)
    return aggregate_125_from_5m(five)

try:
    import yfinance as yf
except Exception:
    yf = None

app = FastAPI(title="ZoneMatch Scanner V2")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

NIFTY500_CSV = "https://www.niftyindices.com/IndexConstituent/ind_nifty500list.csv"
CACHE = Path(".zonematch_cache")
CACHE.mkdir(exist_ok=True)

EXEC_MAP = {"YIT":"Quarterly","HYIT":"Monthly","QIT":"Weekly","MIT":"Daily","WIT":"Daily"}

def get_symbols():
    cache = CACHE / "nifty500.csv"
    try:
        r = requests.get(NIFTY500_CSV, timeout=20, headers={"User-Agent":"Mozilla/5.0"})
        r.raise_for_status()
        cache.write_bytes(r.content)
    except Exception:
        if not cache.exists():
            raise
    df = pd.read_csv(io.BytesIO(cache.read_bytes()))
    sym_col = next(c for c in df.columns if "symbol" in c.lower())
    return df, df[sym_col].astype(str).str.strip().tolist()

def normalize_ohlcv(df):
    if df is None or len(df) == 0:
        return pd.DataFrame()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
    cols = {c.lower(): c for c in df.columns}
    wanted = {}
    for k in ["open","high","low","close","volume"]:
        if k in cols: wanted[k] = cols[k]
    out = df.rename(columns={v:k.title() for k,v in wanted.items()})
    return out[[c for c in ["Open","High","Low","Close","Volume"] if c in out.columns]].dropna()

def atr(df, n=14):
    h,l,c=df["High"],df["Low"],df["Close"]
    tr=pd.concat([(h-l),(h-c.shift()).abs(),(l-c.shift()).abs()],axis=1).max(axis=1)
    return tr.rolling(n).mean()

def rsi(series, n=14):
    d=series.diff()
    up=d.clip(lower=0).ewm(alpha=1/n, adjust=False).mean()
    dn=(-d.clip(upper=0)).ewm(alpha=1/n, adjust=False).mean()
    rs=up/dn.replace(0,np.nan)
    return (100-(100/(1+rs))).fillna(50)

def trend_12_3_6(df):
    """User-specified 50 SMA / 7th candle / 12-3-6 clock method.

    We use the 7th candle back as the reference candle. The horizontal
    reference is the 50-SMA value at that candle. Current 50-SMA is then
    classified by the clock relationship:
      12–3 => U, 3–6 => D, close to 3 => S.
    """
    if len(df) < 60:
        return "S"
    sma=df["Close"].rolling(50).mean()
    ref=float(sma.iloc[-7])
    cur=float(sma.iloc[-1])
    # A transparent numerical mapping: relative displacement from the
    # reference line, normalized by recent SMA slope/price scale.
    scale=max(float(df["Close"].iloc[-1])*0.002, float(df["Close"].tail(14).std())*0.15)
    delta=cur-ref
    if abs(delta) <= scale:
        return "S"
    return "U" if delta>0 else "D"

def make_tf(df, rule):
    return df.resample(rule).agg({"Open":"first","High":"max","Low":"min","Close":"last","Volume":"sum"}).dropna()


def detect_pattern(df, base_i):
    """Detect the four classic base/displacement patterns from the local sequence."""
    if base_i < 2 or base_i + 1 >= len(df):
        return "BASE"
    a=df.iloc[base_i-1]
    b=df.iloc[base_i]
    c=df.iloc[base_i+1]
    a_bull=a["Close"]>a["Open"]
    a_bear=a["Close"]<a["Open"]
    c_bull=c["Close"]>c["Open"]
    c_bear=c["Close"]<c["Open"]
    if a_bull and c_bull: return "RBR"
    if a_bull and c_bear: return "RBD"
    if a_bear and c_bull: return "DBR"
    if a_bear and c_bear: return "DBD"
    return "BASE"


def zone_candidates(df, lookback=180):
    """Strict fresh-zone detector.

    Definition used by this version:
      1. Base candle has a small body relative to ATR.
      2. A displacement candle immediately leaves the base by >= 1 ATR.
      3. Zone = base candle High/Low range.
      4. No later candle may overlap/touch the zone.
      5. Reaction strength = displacement / ATR.
      6. The most recent qualifying fresh zone is returned.

    This is deliberately deterministic and conservative; it does not label
    an already-tested zone as fresh.
    """
    if len(df) < 40:
        return []
    d=df.tail(lookback).copy()
    a=atr(d).bfill()
    body=(d["Close"]-d["Open"]).abs()
    rng=(d["High"]-d["Low"]).replace(0,np.nan)
    base=(body <= a*0.55) & (body/rng <= 0.60)

    out=[]
    for i in range(2,len(d)-2):
        if not bool(base.iloc[i]):
            continue

        # Require a decisive departure over the next 1–3 candles.
        best=None
        for j in range(i+1,min(i+4,len(d))):
            move_up=float(d["Close"].iloc[j]-d["High"].iloc[i])
            move_dn=float(d["Low"].iloc[j]-d["Close"].iloc[i])
            atr_i=max(float(a.iloc[i]),1e-9)
            if move_up >= atr_i:
                best=("DEMAND",j,move_up/atr_i)
                break
            if move_dn >= atr_i:
                best=("SUPPLY",j,move_dn/atr_i)
                break
        if best is None:
            continue

        typ,j,reaction=best
        lo=float(d["Low"].iloc[i])
        hi=float(d["High"].iloc[i])

        # The departure itself must close away from the base.
        if typ=="DEMAND" and float(d["Close"].iloc[j]) <= hi:
            continue
        if typ=="SUPPLY" and float(d["Close"].iloc[j]) >= lo:
            continue

        # Freshness: every candle after departure must remain completely
        # outside the zone. Any overlap invalidates freshness.
        later=d.iloc[j+1:]
        if not later.empty:
            touched=((later["Low"] <= hi) & (later["High"] >= lo)).any()
            if touched:
                continue

        out.append({
            "type":typ,
            "pattern":detect_pattern(d,i),
            "low":lo,
            "high":hi,
            "base_date":str(d.index[i].date()),
            "departure_date":str(d.index[j].date()),
            "reaction":round(float(reaction),3),
            "fresh":True
        })
    return out[-10:]


def analyze_symbol(symbol, hist):
    d=normalize_ohlcv(hist)
    if d.empty or len(d)<80:
        return None
    d.index=pd.to_datetime(d.index)
    if d.index.tz is not None: d.index=d.index.tz_localize(None)
    d=d[~d.index.duplicated(keep="last")].sort_index()
    frames={
        "Y":make_tf(d,"YE"),
        "HY":make_tf(d,"2QS"),
        "Q":make_tf(d,"QE"),
        "M":make_tf(d,"ME"),
        "W":make_tf(d,"W-FRI"),
    }
    trends={k:trend_12_3_6(v) for k,v in frames.items()}
    zones={k:zone_candidates(v) for k,v in frames.items()}
    latest=float(d["Close"].iloc[-1])
    return {"symbol":symbol,"ltp":latest,"trends":trends,"zones":zones}

def fetch_symbol(symbol):
    if yf is None:
        raise RuntimeError("yfinance is not installed")
    try:
        t=yf.Ticker(symbol+".NS")
        h=t.history(period="5y", interval="1d", auto_adjust=False)
        return symbol, analyze_symbol(symbol,h)
    except Exception as e:
        return symbol, None

@app.get("/api/health")
def health():
    return {"ok":True,"service":"ZoneMatch Scanner V2","data":"official NIFTY500 membership + Yahoo historical HTF"}

@app.get("/api/universe")
def universe():
    df, syms=get_symbols()
    return {"count":len(syms),"source":NIFTY500_CSV,"symbols":syms}

@app.get("/api/config")
def config():
    return {
        "universe":"NIFTY500",
        "htf":["YIT","HYIT","QIT","MIT","WIT"],
        "execution_map":EXEC_MAP,
        "execution_timeframe":"Daily",
        "trend_method":"50 SMA + 7-candle reference + 12/3/6",
        "rsi":"Execution timeframe only",
        "fresh_only":True,
        "execution_provider_status":"NOT_CONNECTED — no synthetic 125m data"
    }

@app.get("/api/htf/{symbol}")
def htf(symbol:str):
    if yf is None:
        return {"ok":False,"error":"Install yfinance first"}
    _, result=fetch_symbol(symbol.upper())
    if result is None:
        return {"ok":False,"symbol":symbol.upper(),"error":"No verified historical data returned"}
    return {"ok":True,**result}


@app.get("/api/dhan/status")
def dhan_status():
    return {
        "configured": dhan_ready(),
        "provider": "DhanHQ",
        "source_interval": "5 Minutes",
        "execution_interval": "Daily",
        "construction": "25 x 5-minute candles, session aligned from 09:15 IST",
        "credentials": "Environment variables only; never put the access token in frontend code."
    }

@app.get("/api/execution125/{symbol}")
def execution125(symbol:str, days:int=Query(30, ge=1, le=90)):
    """Return verified Dhan 5m -> exact 125m candles for one NSE equity."""
    if not dhan_ready():
        return {"ok":False,"symbol":symbol.upper(),
                "error":"Dhan access is not configured. Set DHAN_ACCESS_TOKEN and DHAN_CLIENT_ID on the server."}
    try:
        d=execution_125_for_symbol(symbol.upper(), days)
        rows=[]
        for idx,r in d.tail(200).iterrows():
            rows.append({"time":idx.isoformat(),"open":float(r.Open),"high":float(r.High),
                         "low":float(r.Low),"close":float(r.Close),"volume":float(r.Volume)})
        return {"ok":True,"symbol":symbol.upper(),"timeframe":"125 Minutes",
                "source":"DhanHQ 5m historical → 25-bar aggregation","rows":rows}
    except Exception as e:
        return {"ok":False,"symbol":symbol.upper(),"error":str(e)}

@app.get("/api/execution-match/{symbol}")
def execution_match(symbol:str, htf:str=Query("YIT", pattern="^(YIT|HYIT|QIT|MIT|WIT)$")):
    """Compute the execution side only when verified 125m data is available."""
    if not dhan_ready():
        return {"ok":False,"execution_match":False,"status":"WAITING_DHAN_CONNECTION"}
    try:
        d=execution_125_for_symbol(symbol.upper(), 30)
        if len(d)<60:
            return {"ok":False,"execution_match":False,"status":"INSUFFICIENT_125M_DATA"}
        zones=zone_candidates(d, lookback=min(180,len(d)))
        rrsi=float(rsi(d["Close"]).iloc[-1])
        latest=float(d["Close"].iloc[-1])
        fresh=[z for z in zones if z["fresh"]]
        return {
            "ok":True,"symbol":symbol.upper(),"htf":htf,
            "execution_timeframe":"Daily",
            "execution_zones":fresh,
            "execution_rsi":round(rrsi,2),
            "execution_rsi_status":"OB" if rrsi>=70 else "OS" if rrsi<=30 else "Normal",
            "note":"HTF + execution directional matching is performed only after a fresh HTF zone and fresh execution zone are both present."
        }
    except Exception as e:
        return {"ok":False,"execution_match":False,"status":"ERROR","error":str(e)}



@app.get("/api/validate-zone/{symbol}")
def validate_zone(symbol:str, timeframe:str=Query("D", pattern="^(Y|HY|Q|M|W|D)$")):
    """Return the calculated fresh zones for one symbol/timeframe for testing."""
    if yf is None:
        return {"ok":False,"error":"yfinance is not installed"}
    try:
        d=normalize_ohlcv(yf.Ticker(symbol.upper()+".NS").history(period="5y", interval="1d", auto_adjust=False))
        if d.empty:
            return {"ok":False,"symbol":symbol.upper(),"error":"No market data"}
        d.index=pd.to_datetime(d.index)
        if d.index.tz is not None: d.index=d.index.tz_localize(None)
        frames={"Y":make_tf(d,"YE"),"HY":make_tf(d,"2QS"),"Q":make_tf(d,"QE"),
                "M":make_tf(d,"ME"),"W":make_tf(d,"W-FRI"),"D":d}
        z=zone_candidates(frames[timeframe],180)
        return {"ok":True,"symbol":symbol.upper(),"timeframe":timeframe,
                "fresh_zone_count":len(z),"zones":z}
    except Exception as e:
        return {"ok":False,"symbol":symbol.upper(),"error":str(e)}


@app.get("/api/validation-summary")
def validation_summary():
    return {
        "status":"READY_FOR_NIFTY500_VALIDATION",
        "universe":"NIFTY500",
        "fresh_zone_rule":"strict",
        "reaction_rule":"departure >= 1 ATR",
        "execution_mapping":EXEC_MAP,
        "match_rule":"same direction + fresh HTF + fresh execution + execution near zone",
        "rsi":"execution timeframe only",
        "trend":"50 SMA / 7-candle / U-D-S",
        "125_minutes":False
    }

@app.get("/api/scan")
def scan(
    htf: str = Query("YIT", pattern="^(YIT|HYIT|QIT|MIT|WIT)$"),
    limit: int = Query(500, ge=1, le=500),
    zone_type: str = Query("ALL", pattern="^(ALL|DEMAND|SUPPLY)$"),
    pattern: str = Query("ALL", pattern="^(ALL|RBR|RBD|DBR|DBD)$")
):
    """NIFTY500 one-cycle scan using the final execution mapping.

    YIT -> Quarterly
    HYIT -> Monthly
    QIT -> Weekly
    MIT -> Daily
    WIT -> Daily

    Match = fresh HTF zone + HTF reaction + fresh execution zone
            + same direction + price near execution zone.
    """
    _, symbols = get_symbols()
    symbols = symbols[:limit]
    rows = []
    started = time.time()

    htf_key = {"YIT":"Y","HYIT":"HY","QIT":"Q","MIT":"M","WIT":"W"}[htf]
    exec_key = {"YIT":"Q","HYIT":"M","QIT":"W","MIT":"D","WIT":"D"}[htf]

    def build_one(sym):
        if yf is None:
            return None
        try:
            d = normalize_ohlcv(
                yf.Ticker(sym + ".NS").history(period="5y", interval="1d", auto_adjust=False)
            )
            if d.empty or len(d) < 80:
                return None
            d.index = pd.to_datetime(d.index)
            if d.index.tz is not None:
                d.index = d.index.tz_localize(None)
            d = d[~d.index.duplicated(keep="last")].sort_index()

            frames = {
                "Y": make_tf(d, "YE"),
                "HY": make_tf(d, "2QS"),
                "Q": make_tf(d, "QE"),
                "M": make_tf(d, "ME"),
                "W": make_tf(d, "W-FRI"),
                "D": d
            }

            hzones = [z for z in zone_candidates(frames[htf_key], 180) if z["fresh"] and (zone_type=="ALL" or z["type"]==zone_type) and (pattern=="ALL" or z.get("pattern")==pattern)]
            ezones = [z for z in zone_candidates(frames[exec_key], 180) if z["fresh"]]
            if not hzones or not ezones:
                return None

            hz = hzones[-1]
            if hz["reaction"] < 1.0:
                return None

            matches = [z for z in ezones if z["type"] == hz["type"]]
            if not matches:
                return None

            latest = float(d["Close"].iloc[-1])
            ez = min(matches, key=lambda z: abs(latest-(z["low"]+z["high"])/2)/max(latest,1))
            proximity = abs(latest-(ez["low"]+ez["high"])/2)/max(latest,1)*100
            if proximity > 5:
                return None

            trends = {k: trend_12_3_6(frames[k]) for k in ["Y","HY","Q","M","W"]}
            rrsi = float(rsi(frames[exec_key]["Close"]).iloc[-1])
            strength = min(100, round(55 + min(hz["reaction"],3)*10 + max(0,5-proximity)*5))

            return {
                "symbol": sym, "ltp": latest, "htf": htf,
                "zone_type": hz["type"],
                "htf_pattern": hz.get("pattern","BASE"), "execution_pattern": ez.get("pattern","BASE"),
                "pattern": hz.get("pattern","BASE"),
                "htf_zone_low": hz["low"], "htf_zone_high": hz["high"],
                "htf_base_date": hz["base_date"], "htf_reaction": round(hz["reaction"],2),
                "execution_timeframe": EXEC_MAP[htf],
                "execution_zone_low": ez["low"], "execution_zone_high": ez["high"],
                "execution_base_date": ez["base_date"],
                "execution_match": True, "match": "MATCH",
                "proximity_pct": round(proximity,3), "strength": strength,
                "trend": trends, "execution_rsi": round(rrsi,2),
                "execution_rsi_status": "OB" if rrsi >= 70 else "OS" if rrsi <= 30 else "Normal",
                "rules": {
                    "fresh_htf": True,
                    "htf_reaction": hz["reaction"] >= 1.0,
                    "fresh_execution": True,
                    "same_direction": hz["type"] == ez["type"],
                    "execution_near_zone": proximity <= 5.0,
                    "final_match": True
                }
            }
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = [ex.submit(build_one, s) for s in symbols]
        for f in as_completed(futures):
            item = f.result()
            if item:
                rows.append(item)

    rows.sort(key=lambda x: (-x["strength"], x["proximity_pct"]))
    return {
        "ok": True,
        "scan_type": "NIFTY500_ONCE_PER_CYCLE",
        "symbols_requested": len(symbols),
        "rows": rows,
        "matches": len(rows),
        "demand_matches": sum(1 for x in rows if x["zone_type"]=="DEMAND"),
        "supply_matches": sum(1 for x in rows if x["zone_type"]=="SUPPLY"),
        "pattern_counts": {p:sum(1 for x in rows if x.get("pattern")==p) for p in ["RBR","RBD","DBR","DBD","BASE"]},
        "execution_mapping": EXEC_MAP,
        "fresh_only": True,
        "elapsed_sec": round(time.time()-started,2)
    }
