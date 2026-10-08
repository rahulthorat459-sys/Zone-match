# V8 Fresh Zone Logic

A zone is accepted only when:

1. Base candle has a small body relative to ATR.
2. A decisive departure occurs within the next 1–3 candles.
3. Departure is at least 1 ATR away from the base boundary.
4. Demand departure closes above the base high; Supply departure closes below the base low.
5. After departure, no later candle is allowed to touch/overlap the base range.
6. Reaction strength = departure distance / base ATR.

This makes the scanner conservative: tested/revisited zones are excluded.

The exact proprietary rule can be tightened later if the user provides a different candle/base definition.
