"""
ZoneMatch Scanner V12 — root dashboard fix.

Run:
  pip install fastapi uvicorn pandas numpy yfinance requests
  uvicorn server:app --reload

Important:
- NIFTY 500 membership is loaded from the official NSE Indices CSV.
- HTF candles can be built from verified Yahoo Finance market history.
- Execution mapping: YIT→Quarterly, HYIT→Monthly, QIT→Weekly, MIT→Daily, WIT→Daily.
"""
from __future__ import annotations
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import io, time, json, math, requests
import numpy as np
import pandas as pd

import os
from datetime import datetime, timedelta


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
        "execution_provider_status":"Historical daily data source; execution timeframe follows the configured mapping"
    }

@app.get("/api/htf/{symbol}")
def htf(symbol:str):
    if yf is None:
        return {"ok":False,"error":"Install yfinance first"}
    _, result=fetch_symbol(symbol.upper())
    if result is None:
        return {"ok":False,"symbol":symbol.upper(),"error":"No verified historical data returned"}
    return {"ok":True,**result}


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





def get_latest_quote(symbol: str):
    """Best available Yahoo quote: latest 1-minute close during the session, otherwise latest available quote."""
    if yf is None:
        return {"ok": False, "error": "yfinance is not installed"}
    ticker = yf.Ticker(symbol.upper().strip() + ".NS")
    # Prefer latest intraday bar, which updates during market hours when Yahoo provides it.
    try:
        intraday = ticker.history(period="1d", interval="1m", auto_adjust=False)
        if intraday is not None and not intraday.empty and "Close" in intraday:
            clean = intraday["Close"].dropna()
            if not clean.empty:
                idx = clean.index[-1]
                return {"ok": True, "symbol": symbol.upper(), "price": round(float(clean.iloc[-1]), 4),
                        "timestamp": str(idx), "source": "Yahoo Finance latest 1-minute bar",
                        "quote_type": "latest_available"}
    except Exception:
        pass
    # Fallback to Yahoo fast_info if intraday bars are unavailable.
    try:
        p = ticker.fast_info.get("last_price")
        if p is not None and float(p) > 0:
            return {"ok": True, "symbol": symbol.upper(), "price": round(float(p), 4),
                    "timestamp": None, "source": "Yahoo Finance fast_info", "quote_type": "latest_available"}
    except Exception:
        pass
    return {"ok": False, "symbol": symbol.upper(), "error": "Yahoo Finance did not return a current/latest quote"}

@app.get("/api/quote/{symbol}")
def quote_data(symbol: str):
    return get_latest_quote(symbol)

@app.get("/api/chart/{symbol}")
def chart_data(symbol: str, htf: str = Query("YIT", pattern="^(YIT|HYIT|QIT|MIT|WIT)$")):
    """Return real Yahoo Finance daily OHLCV candles and calculated indicators/zones.

    This endpoint uses historical daily candles, not tick-by-tick intraday data.
    """
    if yf is None:
        return {"ok": False, "error": "yfinance is not installed"}
    symbol = symbol.upper().strip()
    try:
        hist = yf.Ticker(symbol + ".NS").history(period="2y", interval="1d", auto_adjust=False)
        d = normalize_ohlcv(hist)
        if d.empty or len(d) < 60:
            return {"ok": False, "symbol": symbol, "error": "Insufficient verified daily OHLCV data from Yahoo Finance"}
        d.index = pd.to_datetime(d.index)
        if getattr(d.index, "tz", None) is not None:
            d.index = d.index.tz_localize(None)
        d = d[~d.index.duplicated(keep="last")].sort_index()
        # Chart candles represent completed daily sessions only. During market hours,
        # remove today's still-forming daily candle; the current quote is shown separately.
        now_ist = pd.Timestamp.now(tz="Asia/Kolkata")
        if not d.empty and now_ist.hour < 15 or (not d.empty and now_ist.hour == 15 and now_ist.minute < 30):
            last_day = pd.Timestamp(d.index[-1]).date()
            if last_day == now_ist.date():
                d = d.iloc[:-1]
        if len(d) < 60:
            return {"ok": False, "symbol": symbol, "error": "Insufficient completed daily candles"}
        # Build timeframes from actual daily candles; no generated/mock prices.
        frames = {"Y": make_tf(d, "YE"), "HY": make_tf(d, "2QS"), "Q": make_tf(d, "QE"),
                  "M": make_tf(d, "ME"), "W": make_tf(d, "W-FRI"), "D": d}
        htf_key = {"YIT":"Y", "HYIT":"HY", "QIT":"Q", "MIT":"M", "WIT":"W"}[htf]
        exec_key = {"YIT":"Q", "HYIT":"M", "QIT":"W", "MIT":"D", "WIT":"D"}[htf]
        hzones = zone_candidates(frames[htf_key], 180)
        ezones = zone_candidates(frames[exec_key], 180)
        hzone = hzones[-1] if hzones else None
        if hzone:
            compatible = [z for z in ezones if z["type"] == hzone["type"]]
            ezone = compatible[-1] if compatible else (ezones[-1] if ezones else None)
        else:
            ezone = ezones[-1] if ezones else None
        closes = d["Close"]
        sma = closes.rolling(50).mean()
        rsi_series = rsi(closes)
        rows=[]
        for i, (idx, row) in enumerate(d.tail(180).iterrows()):
            si = len(d)-len(d.tail(180))+i
            rows.append({
                "date": str(pd.Timestamp(idx).date()),
                "open": round(float(row["Open"]), 4), "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4), "close": round(float(row["Close"]), 4),
                "volume": int(float(row.get("Volume", 0) or 0)),
                "sma50": None if pd.isna(sma.iloc[si]) else round(float(sma.iloc[si]), 4),
                "rsi": round(float(rsi_series.iloc[si]), 2)
            })
        trends={k:trend_12_3_6(frames[k]) for k in ["Y","HY","Q","M","W"]}
        latest=rows[-1]
        quote = get_latest_quote(symbol)
        current_price = quote.get("price") if quote.get("ok") else latest["close"]
        return {"ok":True,"symbol":symbol,"source":"Yahoo Finance completed daily OHLCV",
                "timeframe":"1D completed-session candles; CMP uses latest available Yahoo quote",
                "htf":htf,"execution_timeframe":EXEC_MAP[htf],
                "candles":rows,"last_price":latest["close"],"current_price":current_price,
                "quote_source":quote.get("source","Last completed daily close"),
                "quote_timestamp":quote.get("timestamp"),
                "quote_is_current":bool(quote.get("ok")),"trends":trends,
                "execution_rsi":latest["rsi"],
                "htf_zone":hzone,"execution_zone":ezone,
                "htf_reaction": bool(hzone and hzone.get("reaction",0)>=1.0),
                "match_direction": bool(hzone and ezone and hzone["type"]==ezone["type"]),
                "note":"Candles show completed daily sessions. CMP is the latest Yahoo quote when available; it is not guaranteed tick-by-tick."}
    except Exception as e:
        return {"ok":False,"symbol":symbol,"error":"Chart data fetch/calculation failed: "+str(e)}


# Serve the dashboard at / and its CSS/JS assets from the project root.
BASE_DIR = Path(__file__).resolve().parent
@app.get("/", include_in_schema=False)
def dashboard():
    return FileResponse(BASE_DIR / "index.html")

@app.get("/style.css", include_in_schema=False)
def dashboard_css():
    return FileResponse(BASE_DIR / "style.css", media_type="text/css")

@app.get("/app.js", include_in_schema=False)
def dashboard_js():
    return FileResponse(BASE_DIR / "app.js", media_type="application/javascript")
