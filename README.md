# World Cup 2026 Simulator

<p><a href="https://github.com/sponsors/shfqrkhn?o=esb"><strong>Sponsor this project</strong></a></p>

**Current Data Version:** shown in the deployed app's Data health view from embedded `BASE_DATA`.

Static, offline-capable simulator for the 48-team, 104-match FIFA World Cup 2026 format. It combines embedded results, FIFA-style group ranking, knockout rules, venue/weather/rest/travel context, transparent model assumptions, seeded randomness, and Monte Carlo tournament runs into one portable web app.

- **Status:** Completed tournament snapshot; simulator and audit remain available
- **Live Demo:** [shfqrkhn.github.io/FIFA-WC-Sim](https://shfqrkhn.github.io/FIFA-WC-Sim/)
- **Repository ZIP:** [Download current main ZIP](https://github.com/shfqrkhn/FIFA-WC-Sim/archive/refs/heads/main.zip)
- **License:** MIT
- **Entrypoint:** `docs/index.html`
- **Maintainer handoff:** [`docs/AI_MAINTAINER_HANDOFF.md`](./docs/AI_MAINTAINER_HANDOFF.md)
- **Repository ZIP policy:** [`docs/REPO_ZIP_POLICY.md`](./docs/REPO_ZIP_POLICY.md)

## Screenshot

![World Cup 2026 Simulator dashboard](./docs/assets/simulator-dashboard.png)

## Quick Start

1. Open the live demo.
2. On the **Sim** tab, press **Run predictions**.
3. Read **Most likely champions** first.
4. Use **Groups**, **Bracket**, and **Chances** for more detail.
5. Open **Prediction settings** only if you want to adjust seed, run count, match style, host boost, or weather.
6. Use **Stats**, **How**, **Data**, **Checks**, **Health**, and **Sources** for deeper audit detail.

## Final Tournament Snapshot

- ESPN-backed completed results: **104 / 104**; no overdue or unplayed matches.
- Champion: **Spain**, after a 1–0 extra-time final win over Argentina (ESPN event `760517`).
- Third place: **England**, after a 6–4 win over France (ESPN event `760516`).
- Immutable audit: **82 frozen / 82 settled / 0 unresolved / 0 rejected** forecasts.
- Match-level comparison: **35** latest eligible pre-kickoff rows; **47** earlier snapshots remain audit-only. Field-score W/D/L accuracy is **25/35** and knockout advancement accuracy is **23/29**.
- Calibration is inactive (`validation_worsened_rollback`): the unchanged chronological held-out gate worsened both Brier score and log loss, so the public simulator retains raw probabilities.

This is a source-bounded project snapshot, not an official-completeness, historical-replay, certainty, or betting claim.

## Repository Layout

The repo intentionally contains more than the single-file app because it owns data updates, audit scoring, calibration validation, smoke tests, and Pages deployment.

Tracked project files:

- `docs/index.html`: static app entrypoint and embedded `BASE_DATA`.
- `docs/AI_MAINTAINER_HANDOFF.md`: public-safe continuation map for future expert AI maintainers.
- `docs/assets/`: README/demo assets.
- `data/*.json`: latest-update health, prediction audit ledger, calibration state, prospective backtest audit, and manual override example.
- `scripts/`: data update, validation, prediction audit, calibration, rescue, and refinement scripts.
- `tests/`: unit, regression, no-leakage, workflow, and browser smoke tests.
- `.github/workflows/`: daily update, match-window update, PR validation, security, and UI smoke automation.

Ignored local/private files are private-file guardrails:

- `offline/omnios-documents/`: private OmniOS/source notes; must remain untracked and must not be pushed.
- `offline/prediction-hub/`: private prediction research workspace; must remain untracked and must not be pushed.
- `OMNI_HANDOVER.md`: private handoff notes; must remain untracked and must not be pushed.
- `linkedin-post-package/`: local LinkedIn assets; must remain untracked.
- `.codex-remote-attachments/`, `node_modules/`, `playwright-report/`, `test-results/`, `scripts/__pycache__/`, `data/scoreboards/`, `data/latest-simulation.json`, and `data/manual-overrides.json`.

## App Sections

- **Sim:** primary flow, Run predictions button, today's matches, champion probabilities, and sample path.
- **Groups:** standings, played results, projected remaining results, and best-third-place queue.
- **Bracket:** projected knockout path from Round of 32 through final.
- **Chances:** team probabilities for winning and reaching later rounds.
- **Stats:** current tournament snapshot, schedule progress, top-scorer status, fair-play inputs, and simulator-side award projections.
- **How:** assumptions, coefficients, match inputs, expected goals, venue/weather effects, and scoreline logic.
- **Data:** JSON import/export/reset for advanced users.
- **Checks:** in-app regression and tournament-shape self-tests.
- **Health:** data version, validation history, patch history, forecast audit, known risks, and update checklist.
- **Sources:** source notes and update protocol.

Top scorers can be empty because the automated scoreboard feed updates match scores, not official player scorer tables. Stale scorer rows are cleared instead of reused. A verified manual `currentStats.topScorers` patch may supply a dated scorer snapshot; otherwise scorer rows remain empty. Award projections are simulator-side estimates from embedded team/star assumptions and Monte Carlo progression; missing player-age, goalkeeper, and full discipline ledgers remain unavailable rather than invented.

### Chances

The Chances table shows each team's Monte Carlo probability of winning the cup and reaching later rounds.

## Prediction Model

The app keeps Monte Carlo as the tournament-level simulator. Individual matches use a transparent ensemble model:

1. FIFA ranking prior and rank-seeded Elo-style rating.
2. Tournament pedigree and listed star-depth proxy.
3. Embedded current form from played tournament matches.
4. Attack/defense scoring profile.
5. Venue, climate, weather, rest/travel, host/co-host advantage, and group-table incentive context.
6. Source-backed availability hooks for confirmed lineup, goalkeeper, suspension, and key-absence modifiers.
7. Scoreline sampling with knockout extra time and penalties.
8. FIFA-style group ranking, best-third-place allocation, and knockout resolution.
9. Monte Carlo aggregation for champion, finalist, semifinal, quarterfinal, and R16 probabilities.

Unavailable lineups, injuries, suspensions, referee assignments, scorer snapshots, and incomplete discipline ledgers remain neutral unless a reliable source-backed patch is embedded.

## Prediction Audit, Backtest, And Calibration

Pre-match predictions can be frozen into `data/prediction-audit.json` before kickoff. After results are embedded, `scripts/score-predictions.mjs` scores frozen records with Brier score, log loss, scoreline error, calibration bucket, and failure class.

`scripts/update-calibration.mjs` uses only settled frozen predictions. Calibration remains separate from the base model and is disabled as `insufficient_sample` until at least 30 resolved predictions exist. If validation worsens raw Brier/log-loss performance, calibration rolls back and raw probabilities remain active.

Do not retrofit or deploy a model fit on already-settled tournament outcomes. Those outcomes remain diagnostic evidence only; calibration may change only through the existing chronological held-out gate.

`scripts/backtest-audit.mjs` builds `data/backtest-audit.json` from the same frozen ledger. It reports sample size, raw model metrics, calibration benchmark metrics, uniform WDL and rank-prior baselines, confidence buckets, stage splits, failure classes, and limitations. This is a prospective backtest only; it does not reconstruct old matchdays with future data.

`scripts/comparative-results.mjs` generates `data/comparative-results.json` and the embedded **Prediction vs actual** cards. It compares only eligible settled immutable pre-kickoff forecasts with embedded ESPN completed finals, including field-score W/D/L, knockout advancement, exact-score accuracy, scoreline error, confidence reliability, stage and failure-class splits, and raw/uniform/rank-prior metrics. Knockout advancement is reported separately so a penalty-decided tied score remains a draw for W/D/L scoring while the projected advancing team is still evaluated.

Current match counts, overdue-match status, audit sample size, calibration status, backtest scores, and comparative statistics are generated artifacts. Check **Stats**, **Data**, **Checks**, and **Health** plus `data/update-health.json`, `data/backtest-audit.json`, and `data/comparative-results.json`.

## Post-Tournament Update Reproduction

Tournament cron schedules are retired after 104/104. The following guarded paths remain available through `workflow_dispatch` for a documented source-backed correction or reproducibility check:

- `.github/workflows/daily-base-data-update.yml` runs the full updater, idempotence, calibration, unit, simulation, and BASE_DATA gates.
- `.github/workflows/match-window-data-update.yml` preserves the pre/post-match and active-match-lock behavior for audit reproduction.
- `.github/workflows/publication-watchdog.yml` still follows manually dispatched updater runs and can also be dispatched directly to recover a stranded bot PR.

The retained active-match lock still rejects partial-score mutation during any manual replay. The publication watchdog provides guarded stranded-PR recovery after manually dispatched updater runs; it no longer needs a tournament cron schedule.

Both updater paths reconcile immutable frozen records from the former automation branches before changing artifacts. A validated change is proposed through a bot PR; required BASE_DATA and security contexts must pass before auto-merge. The publisher then dispatches `deploy-pages.yml` and fails unless that exact merged commit deploys successfully. No update workflow pushes generated data directly to `main`.

The workflows write an Actions summary with the final data version, 104/104 progress, audit counts, raw-only calibration status, and backtest metrics. `BASE_DATA PR check` validates pull requests, while `Static UI smoke` covers desktop and mobile layouts. Future corrections must remain source-backed and must never rewrite frozen forecasts or tune on final outcomes.

## Sources

Sources and retained update adapters:

- ESPN public soccer scoreboard API for completed match scores and matched kickoff timestamps.
- Open-Meteo for upcoming-match venue weather where available.
- Embedded schedule and venue coordinates for rest/travel context.
- Embedded FIFA ranking fields for rank-seeded Elo-style priors.
- Embedded standings for conservative group-table incentive adjustments.
- Optional local `data/manual-overrides.json` patches following `data/manual-overrides.example.json`; overrides must include source metadata and stay narrow. This is the guarded manual path for verified availability, scorer snapshots, and discipline/fair-play corrections.

Official FIFA pages remain the preferred manual authority for fixtures, reports, rankings, regulations, scorer snapshots, discipline, and disputed data.

Not automatically updated:

- Lineups, injuries, suspensions, and referee assignments.
- Confirmed goalkeeper/key-absence modifiers unless verified source metadata is patched.
- Full disciplinary/fair-play card ledger beyond embedded known conduct notes unless a verified manual conduct snapshot is patched.
- Betting odds, gambling-market data, prediction-market data, or sportsbook data. These are not used.

## Manual Update And Rescue

Standard update:

```bash
node scripts/update-base-data.mjs
```

Deterministic no-fetch repair/enrichment:

```bash
node scripts/update-base-data.mjs --no-fetch
```

If scheduled Actions and `workflow_dispatch` both fail, use the exact trigger word `WC_DATA_RESCUE`:

```bash
node scripts/manual-update-trigger.mjs --trigger WC_DATA_RESCUE
```

The rescue path runs the same guarded update flow as automation, refuses dirty candidate artifacts, restores candidate files on validation failure, and does not commit unless `--commit` is supplied. Use `--push` only after a validated local commit is intended; scheduled automation should use the bot PR path instead.

Audit/calibration maintenance:

```bash
node scripts/freeze-predictions.mjs
node scripts/score-predictions.mjs
node scripts/update-calibration.mjs
node scripts/backtest-audit.mjs
node scripts/validate-calibration.mjs
```

## Validation

Recommended full local gate:

```bash
npm install
npm run qa:full
```

Focused data/refinement gate:

```bash
npm run qa
```

Browser smoke:

```bash
npm run ui:smoke
```

Useful individual gates:

```bash
python scripts/validate_base_data.py
node scripts/build-html.mjs
npm run validate
node scripts/validate-calibration.mjs
npm run backtest
npm test
python scripts/test_idempotence.py
npm run smoke
```

On PowerShell, use `foreach` loops for wildcard script checks.

## Iterative Refinement Gate

The exact trigger phrase is `Iterate until reaching THE END. `, including one trailing space.

```bash
node scripts/refinement-pass.mjs --trigger "Iterate until reaching THE END. "
```

The refinement pass performs up to three no-fetch convergence passes: guarded updater, syntax checks, data validation, calibration validation, unit/regression tests, simulation smoke, idempotence, and diff hygiene. On successful convergence it prints exactly `THE END`.

## Deployment

GitHub Pages serves the static `docs/` app. There is no backend, account, tracking script, or build service required for normal use.

## Repository ZIP And Local Use

- **Live/PWA:** Use the live demo in a modern browser.
- **Local ZIP:** Download the current main repository ZIP, extract it, open the `docs/` folder in a terminal, and serve it with a local static server:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/`. Use a local server instead of opening `index.html` directly, so browser behavior matches the deployed static app.
- **Self-host:** Upload the `docs/` folder contents from the repository ZIP to any static host.

## Disclaimer

This simulator is educational and informational only. It is not official FIFA data, live scoring authority, betting advice, gambling advice, investment advice, financial advice, or prediction-market advice. Outputs are probabilistic simulations, not guarantees or recommendations. Do not use these predictions to place bets, trade contracts, or risk money.

Verify current facts, match results, injuries, suspensions, lineups, rankings, and official regulations against trusted sources before relying on them.

## Stability

The project is guarded by syntax checks, runtime smoke tests, ensemble-model checks, Monte Carlo invariant tests, third-place allocation checks across all 495 valid combinations, corrupt-cache rejection tests, storage-failure tests, malformed saved-data repair tests, penalty shootout validation, frozen-prediction audit/backtest checks, calibration fail-closed checks, no-leakage checks, idempotence checks, and responsive UI regression checks.
