# ZoneMatch Scanner V10 — Core Validation Gate

V10 adds an offline deterministic test suite for the core scanner rules.

Tests cover:
- Fresh zone creation after a decisive departure.
- Retest/touch invalidation.
- Trend output restricted to U / D / S.

Important:
A full NIFTY 500 live validation requires running the backend with network access and a valid market-data source. This package does not fabricate a validation result when that connection is unavailable.

Final mapping:
YIT → Quarterly
HYIT → Monthly
QIT → Weekly
MIT → Daily
WIT → Daily

125 Minutes = OFF.
