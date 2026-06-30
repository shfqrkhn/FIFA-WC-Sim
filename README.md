# World Cup 2026 Simulator

**Current Data Version:** shown in the deployed app's Data health view from embedded `BASE_DATA`.

World Cup 2026 Simulator is a static, offline-capable web app for exploring the 48-team, 104-match FIFA World Cup 2026 format. It combines embedded match results, an ensemble prediction engine, venue/weather context, host advantage, seeded randomness, FIFA-style group ranking, knockout rules, and Monte Carlo tournament simulation in one portable HTML file.

[Live Demo](https://shfqrkhn.github.io/FIFA-WC-Sim/)

## Screenshot

![World Cup 2026 Simulator dashboard](docs/assets/simulator-dashboard.png)

## Quick Start

1. Open the live app.
2. On the **Sim** tab, press **Run predictions**.
3. Optionally expand **Prediction settings** to adjust the scenario name, number of prediction runs, match style, host boost, and weather setting.
4. Read **Most likely champions** first. This is the quickest summary of the tournament outlook.
5. Review **Sample tournament path** to see one representative bracket path that matches the top Monte Carlo outcome.
6. Use **Groups**, **Bracket**, and **Chances** for more detail.
7. Use **How**, **Data**, **Checks**, **Health**, and **Sources** only when you want deeper transparency or maintenance detail.

## Repository Layout

The GitHub repo intentionally contains more than the single-file app because it also owns data updates, audit scoring, calibration validation, smoke tests, and Pages deployment.

Tracked project files:

* `docs/index.html`: static app entrypoint and embedded `BASE_DATA`.
* `docs/assets/`: README/demo assets only.
* `data/*.json`: generated update health, prediction audit, calibration state, and manual override example.
* `scripts/`: data update, validation, prediction audit, calibration, rescue, and refinement scripts.
* `tests/`: unit, regression, no-leakage, workflow, and browser smoke tests.
* `.github/workflows/`: daily, match-window, and UI-smoke automation.
* `OMNI_HANDOVER.md`: current handoff, recovery checklist, and OmniOS feedback loop.

Local-only ignored files:

* `offline/omnios-documents/`: private OmniOS/source documents and local lesson notes. This folder is ignored by `.gitignore` and should not appear in GitHub.
* `node_modules/`, `playwright-report/`, `test-results/`, `data/scoreboards/`, `data/latest-simulation.json`, and `data/manual-overrides.json`.

## Main Tabs

### Sim

The main screen is designed to answer the most common question first: who is most likely to win?

Prediction settings:

* **Scenario name:** a seed for repeatable results. The same seed and settings produce the same sample tournament path.
* **Prediction runs:** how many Monte Carlo tournament runs to perform. More runs produce smoother probabilities and take longer.
* **Match style:** balanced, steadier, or more upsets.
* **Host boost:** turns host/co-host expected-goal advantage on or off.
* **Weather:** uses live weather if available, venue climate estimates, or no weather adjustment.

### Groups

Shows current group standings, played results, projected upcoming scores, and the best third-place queue. Played matches stay fixed; unplayed matches are filled by the prediction engine.

### Bracket

Shows the projected knockout bracket from the Round of 32 through the final. The bracket wraps across smaller desktop and mobile screens to avoid horizontal scrolling.

### Chances

Shows each team's Monte Carlo probability of winning the cup and reaching later rounds.

### How

Explains the prediction model, coefficients, assumptions, match inputs, expected goals, venue/weather effects, host terms, and scoreline logic.

### Data, Checks, Health, Sources

These are advanced sections. They keep transparency and maintenance information available without crowding the main user flow:

* **Data:** JSON import/export/reset tools.
* **Checks:** built-in regression and tournament-shape self-tests.
* **Health:** data version, validation history, patch history, known risks, and update checklist.
* **Sources:** source list and update protocol.

The **Stats** tab keeps actual leaderboards separate from projections. Top scorers can be empty because the automated scoreboard feed updates match scores, not official player scorer tables; stale scorer rows are cleared instead of reused. Award projections are simulator-side estimates from embedded team/star assumptions and Monte Carlo progression, with missing player-age, goalkeeper, and full discipline ledgers marked as unavailable rather than invented.

## How the Prediction Engine Works

The app keeps Monte Carlo as the tournament-level simulator. Under each tournament run, individual matches are predicted by an ensemble match model:

1. **Ranking prior:** FIFA ranking provides a broad strength baseline.
2. **Tournament pedigree proxy:** titles, deep runs, and listed star depth add historical and squad-strength context.
3. **Current form:** embedded tournament points, goal difference, goals for, and goals against adjust teams as results arrive.
4. **Attack/defense profile:** played-match scoring and defending patterns influence expected goals.
5. **Context terms:** venue, climate, weather, rest/travel, host/co-host advantage, final group-table incentive state, and editable match context adjust expected goals.
6. **Source-backed availability hooks:** confirmed lineup, goalkeeper, suspension, and key-absence modifiers can apply only when verified source metadata is embedded; otherwise they remain neutral.
7. **Scoreline sampler:** expected goals are converted into scorelines with a bounded low-score correlation adjustment, then knockout draws go to extra time and penalties.
8. **Tournament simulation:** group standings, best third-place teams, legal knockout slots, and each knockout round are resolved.
9. **Monte Carlo aggregation:** thousands of runs are counted into champion, finalist, semifinal, quarterfinal, and round-of-16 probabilities.

The displayed sample path is selected from the Monte Carlo run that represents the top champion/finalist pairing, so the main result, Groups, Bracket, and favorites board stay aligned.

### Prediction Audit and Calibration

The maintenance scripts can freeze pre-match model predictions into `data/prediction-audit.json` before results are known. Once match results are embedded, `scripts/score-predictions.mjs` scores those frozen records with Brier score, log loss, scoreline error, calibration bucket, and failure class.

`scripts/update-calibration.mjs` uses only already-settled frozen predictions. Calibration is conservative, remains separate from the base model, and stays disabled as `insufficient_sample` until at least 30 resolved predictions exist. If validation does not improve or tie raw Brier/log-loss performance, calibrated probabilities are rolled back and the app continues to show raw model probabilities.

The calibration state also records benchmark metrics for the raw model, uniform WDL probabilities, and a rank-only prior. These benchmarks are shown as evidence in the Data health view; they do not change displayed probabilities by themselves.

`scripts/backtest-audit.mjs` builds `data/backtest-audit.json` from the same frozen ledger. It reports resolved frozen-prediction count, Brier score, log loss, favorite hit rate, scoreline error, confidence-bucket accuracy, stage splits, failure classes, and comparisons against uniform and rank-prior baselines. This is a prospective audit only: it uses predictions frozen before kickoff and already settled after final results. It does not reconstruct historical matchdays from archival inputs, so it avoids future-data leakage instead of pretending to be a full historical replay.

This audit loop is educational and informational only. It is used to detect overconfidence and calibration drift, not to provide betting advice.

## Data Sources and Updates

The embedded data includes:

* Teams, groups, venues, and knockout slots.
* Played match results, including resolved knockout results as they become available.
* FIFA ranking priors, rank-seeded Elo-style ratings, and team-strength assumptions.
* Venue, climate, rest/travel, and weather context.
* Fair-play/team-conduct inputs where available.
* Simulator-side award projections, separated from official award/leaderboard data.
* Source notes, validation history, and known data-quality gaps.

### Automated Update Status

Daily auto-update exists at `.github/workflows/daily-base-data-update.yml`.

It runs on:

* `37 11 * * *` UTC: 07:37 America/Montreal during EDT, 06:37 during EST.
* `37 17 * * *` UTC: safety run for delayed feeds or a missed morning run.
* `*/30 0-23 * 6,7 *` UTC, represented as three UTC-hour blocks in `.github/workflows/match-window-data-update.yml`: match-window checks every 30 minutes during June/July while no-oping outside guarded update windows.
* `workflow_dispatch`: manual fallback from GitHub Actions.

GitHub cron is UTC-only and can be delayed or skipped by GitHub infrastructure. The safety run, match-window checks, and manual dispatch are intentional; one morning-only run is not sufficient for reliable maintenance. America/Montreal local time shifts with DST because the cron schedule remains UTC.

The daily workflow runs `node scripts/update-base-data.mjs`, then idempotence, prediction-audit calibration validation, unit tests, and simulation smoke checks. It commits only `docs/index.html`, `data/latest-update.json`, `data/update-health.json`, `data/prediction-audit.json`, `data/calibration-state.json`, and `data/backtest-audit.json`, and only after validation passes.

The match-window workflow runs `node scripts/match-window-update.mjs`. That script no-ops unless the current UTC time is near a configured pre-kickoff slot, a normal post-match slot, or the bounded stale-result recovery window for unplayed matches. It refuses full updates during the active-match lock, so in-progress matches are not mutated by partial scores or weather/context refreshes; if a later match needs a pre-kickoff freeze during that lock, it runs a freeze-only path. Full runs delegate to the same rollback-capable `scripts/update-base-data.mjs` path and commit only validated candidate artifacts.

Both update workflows write a GitHub Actions job summary with data version, played-match counts, overdue unplayed match count, latest scoreboard changes, prediction-audit counts, and calibration status. A separate static UI smoke workflow runs Playwright against `docs/index.html` for desktop and mobile layouts.

### Automated Sources

The updater currently uses:

* ESPN public soccer scoreboard API for machine-readable completed match scores and matched kickoff timestamps.
* Open-Meteo for upcoming-match venue weather where available.
* Embedded schedule and venue coordinates for rest/travel context.
* Embedded FIFA ranking fields for the rank-seeded Elo-style model input.
* Embedded standings for conservative final group-table incentive adjustments.
* Optional local `data/manual-overrides.json` patches that follow `data/manual-overrides.example.json`; these must include source metadata and can only touch narrow verified availability, lineup, context, suspension, injury, and conduct fields.
* Official FIFA pages remain the preferred manual authority for fixtures, reports, rankings, regulations, discipline, and disputed data.

### Not Automatically Updated

The updater does not invent unavailable data. These remain neutral unless reliable data is manually patched:

* Lineups, injuries, suspensions, and referee assignments.
* Confirmed lineup, goalkeeper, suspension, and key-absence modifiers unless verified source metadata is patched into embedded availability fields.
* Full disciplinary/fair-play card ledger beyond embedded known conduct notes.
* Official fixture or venue rewrites beyond matched scoreboard kickoff timestamps when no stable unauthenticated source adapter is configured.
* Betting odds or gambling-market data, which are not used.

### Manual Update

```bash
node scripts/update-base-data.mjs
```

Use `--no-fetch` for deterministic local repair/enrichment without network calls:

```bash
node scripts/update-base-data.mjs --no-fetch
```

### Emergency Manual Trigger

If scheduled GitHub Actions and `workflow_dispatch` both fail, use the trigger word `WC_DATA_RESCUE`.

For a local guarded rescue run:

```bash
node scripts/manual-update-trigger.mjs --trigger WC_DATA_RESCUE
```

That command runs the same prediction-supporting update path as automation: freeze pre-match predictions, ingest completed scores, refresh form/Elo-style inputs, rest/travel, weather, data health, audit scoring, calibration, and validation. It refuses to run without the exact trigger word, refuses to overwrite already-dirty candidate data artifacts, restores candidate files on validation failure, and does not commit unless `--commit` is supplied. Use `--push` only after a validated local commit is intended.

Audit/calibration maintenance can also be run one step at a time:

```bash
node scripts/freeze-predictions.mjs
node scripts/score-predictions.mjs
node scripts/update-calibration.mjs
node scripts/backtest-audit.mjs
node scripts/validate-calibration.mjs
```

### Local Validation

Recommended full local gate:

```bash
npm install
npm run qa
```

Browser smoke test:

```bash
npm run ui:smoke
```

Individual gates:

```bash
python scripts/validate_base_data.py
for f in scripts/*.mjs; do node --check "$f"; done
node scripts/build-html.mjs
npm run validate
node scripts/validate-calibration.mjs
npm run backtest
npm test
python scripts/test_idempotence.py
npm run smoke
```

On PowerShell, use `foreach` loops for wildcard script checks.

### Iterative Refinement Gate

The exact trigger phrase is `Iterate until reaching THE END. `, including one trailing space after the period.

When that phrase is used for a repo refinement pass, run:

```bash
node scripts/refinement-pass.mjs --trigger "Iterate until reaching THE END. "
```

The script performs up to three no-fetch convergence passes. Each pass runs the guarded updater, syntax checks, data validation, calibration validation, unit/regression tests, simulation smoke, idempotence, and diff hygiene. It stops only when candidate data artifacts are stable and every gate passes. On successful convergence it prints exactly `THE END`; otherwise it fails with the first material gate that did not pass.

## Deployment

The app entrypoint is `docs/index.html`. GitHub Pages serves the static `docs/` artifact for the live demo. There is no build service or backend required for normal app use.

## Maintenance Note

Data updates must preserve the static/offline app shell. Failed source fetches degrade to neutral or cached inputs and must not be committed as partial updates. Current facts, fixture changes, fair-play/cards, lineups, injuries, suspensions, and regulations should be cross-checked against official FIFA or other reliable sources before changing model inputs.

For a concise fresh-agent handoff, runbook, recovery checklist, and OmniOS feedback loop, see `OMNI_HANDOVER.md`. If present locally, the ignored `offline/omnios-documents/` workspace can hold upstream OmniOS lessons from this app. It is intentionally absent from GitHub and must remain untracked.

## Privacy and Offline Use

The app runs in the browser and does not require an account, backend service, tracking script, or build step. Data edits are stored locally when browser storage is available. Optional live weather and external bracket data requests only run when triggered by the app flow and available in the browser.

## Disclaimer

This simulator is for educational and informational use only. It is not official FIFA data, live scoring authority, betting advice, gambling advice, investment advice, financial advice, or prediction-market advice. Outputs are probabilistic simulations, not guarantees or recommendations. Do not use these predictions to place bets, trade contracts, or risk money. If you use them elsewhere, you are responsible for your own decisions and may lose money.

Current facts, match results, injuries, suspensions, lineups, rankings, and official regulations should be verified against trusted sources before relying on them.

## Stability

The project is guarded by syntax checks, runtime smoke tests, ensemble-model checks, Monte Carlo invariant tests, third-place allocation checks across all 495 valid combinations, corrupt-cache rejection tests, storage-failure tests, malformed saved-data repair tests, penalty shootout validation, and responsive UI regression checks.
