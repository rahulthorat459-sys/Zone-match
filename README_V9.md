# V9 — NIFTY 500 Validation Ready

V9 adds validation diagnostics around the scanner.

Before deployment:
1. Run a complete NIFTY 500 scan for each YIT/HYIT/QIT/MIT/WIT.
2. Compare counts of Demand/Supply and RBR/RBD/DBR/DBD.
3. Inspect individual symbols with `/api/validate-zone/{symbol}`.
4. Reject any zone that has been retested.
5. Only after this validation should the live website be updated.

Final execution mapping:
YIT → Quarterly
HYIT → Monthly
QIT → Weekly
MIT → Daily
WIT → Daily

125 Minutes = OFF.
