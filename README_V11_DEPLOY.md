# ZoneMatch Scanner — V11 Deployment Ready

## Final execution mapping
- YIT → Quarterly
- HYIT → Monthly
- QIT → Weekly
- MIT → Daily
- WIT → Daily

**125 Minutes is not used anywhere in V11.**

## Core validation
`python test_core_rules.py`

Expected result: `ALL CORE TESTS PASSED`

## Run locally
```bash
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

## Render
This package includes `render.yaml` and `Procfile`.

Important: the scanner should only be presented as live after the deployed backend successfully connects to the configured market-data source. Do not fabricate market prices or validation counts.

## Scanner logic
- Fresh HTF zones only
- HTF reaction validation
- Fresh execution zones
- Same-direction HTF + execution match
- Combined chart
- 50 SMA trend: U / D / S
- Execution-timeframe RSI: OB / OS / Normal
- RBR / RBD / DBR / DBD pattern support
- NIFTY 500 universe
