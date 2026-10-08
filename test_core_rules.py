import sys
from pathlib import Path
import pandas as pd
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from server_v9 import zone_candidates, atr, trend_12_3_6

def candles(rows):
    return pd.DataFrame(rows, columns=["Open","High","Low","Close","Volume"],
                        index=pd.date_range("2025-01-01", periods=len(rows), freq="D"))

def test_fresh_demand():
    # Long enough warm-up; final base + strong departure, then no retest.
    rows=[]
    price=100.0
    for i in range(45):
        rows.append((price, price+0.2, price-0.2, price+0.05, 1000))
        price += 0.05
    rows += [
        (102.2,102.35,102.0,102.25,1000), # base
        (102.25,104.0,102.2,103.9,2500),  # departure
        (103.9,104.2,103.7,104.1,1600),
        (104.1,104.5,103.9,104.3,1500),
    ]
    z=zone_candidates(candles(rows),180)
    assert z, "Expected a fresh zone"
    assert z[-1]["fresh"] is True

def test_retested_zone_is_removed():
    rows=[]
    price=100.0
    for i in range(45):
        rows.append((price,price+0.2,price-0.2,price+0.05,1000)); price+=0.05
    rows += [
        (102.2,102.35,102.0,102.25,1000),
        (102.25,104.0,102.2,103.9,2500),
        (103.9,104.2,103.7,104.1,1600),
        (104.1,104.5,103.9,104.3,1500),
        (104.3,104.4,101.9,102.1,2200), # touches base zone => invalid
    ]
    z=zone_candidates(candles(rows),180)
    assert not z or all(x["base_date"] != "2025-02-15" for x in z)

def test_trend_output():
    rows=[]
    for i in range(70):
        p=100+i*0.5
        rows.append((p,p+1,p-0.2,p+0.7,1000))
    t=trend_12_3_6(candles(rows))
    assert t in {"U","D","S"}

if __name__=="__main__":
    test_fresh_demand()
    test_retested_zone_is_removed()
    test_trend_output()
    print("ALL CORE TESTS PASSED")
