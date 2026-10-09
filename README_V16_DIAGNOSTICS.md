# ZoneMatch V16 — Scan Diagnostics + Yahoo Quote 401 Guard

## Why this version
Render logs show Yahoo Finance HTTP 401 (`Invalid Crumb` / quote feature unauthorized). The app's `fast_info` fallback calls Yahoo quote endpoints and can create these errors when the intraday chart endpoint has no bar. V16 removes that fallback; it does not invent prices.

## Diagnostics added
After a scan, the status reports how many symbols returned usable historical OHLCV data, how many failed, and rejection counts for eligible zones, HTF reaction, direction, execution-zone proximity, and analysis errors. A completed scan with zero matches now says it completed, rather than showing “No scan run yet.”

## Update on GitHub
Replace only `server.py` and `app.js` with these files, commit to `main`, and wait for Render to redeploy. Then press Refresh Scan once and share the status line and rejection counts.

## Data integrity
No synthetic prices or zones are added. Yahoo's quote endpoint may still be unavailable. Historical/intraday chart data can also fail; V16 exposes data-success/failure counts so that failure is not mistaken for a genuine zero-match scan. This is not a guarantee of tick-live market data.
