# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/aryuniko69-dev/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/aryuniko69-dev/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar scores every major pre-token DeFi protocol on what its token would be worth if its record stayed as it is — an implied value measured from the sealed DefiLlama snapshot itself (TVL, 7-day momentum, track-record age, and a category factor computed from the live-token protocols in the same category, nothing hardcoded) — and hands every protocol a concrete farm plan with dollar costs and time estimates. It ranks 226 protocols (the 40-protocol watchlist plus the strongest below-floor candidates), splits the live-token set, and renders a dark phosphor radar dashboard with sortable columns, search, category filters, a detail drawer with factor charts and snapshot-derived risk panels.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=keen-walrus-36&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
