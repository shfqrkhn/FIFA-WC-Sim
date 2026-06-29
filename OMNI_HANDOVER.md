# FIFA-WC-Sim Handoff

## Mission

Maintain a static, offline-capable World Cup 2026 simulator that updates embedded data autonomously, validates before commit, and keeps prediction claims educational and source-bounded.

## Hard Constraints

- Keep the app runnable from `docs/index.html` with embedded `BASE_DATA`.
- No betting, odds, gambling, sportsbook, wagering, market-edge, or prediction-market features.
- Do not invent unavailable data. Missing lineups, injuries, suspensions, referees, and incomplete discipline ledgers stay neutral unless source-backed manual patches exist.
- Base model output and calibrated output must remain separable.
- Calibration must fail closed below the minimum resolved sample or when validation worsens.
- Never commit failed or partial data updates.

## Source Of Truth

- App entrypoint: `docs/index.html`
- Embedded data: `BASE_DATA` inside `docs/index.html`
- Audit ledger: `data/prediction-audit.json`
- Calibration state: `data/calibration-state.json`
- Latest update health: `data/latest-update.json`, `data/update-health.json`
- Main update path: `scripts/update-base-data.mjs`
- Manual rescue trigger: `WC_DATA_RESCUE`

## Autonomous Update Flow

1. Freeze eligible pre-match predictions.
2. Ingest completed match scores only from configured reliable public sources or source-backed manual overrides.
3. Refresh form, rank-seeded Elo-style inputs, rest/travel, weather, data quality, and maintenance notes.
4. Score frozen predictions after results are embedded.
5. Update calibration only from eligible settled frozen predictions.
6. Validate data, audit, calibration, deterministic behavior, and UI smoke.
7. Commit only validated candidate artifacts.

Daily and match-window GitHub Actions run this path. If Actions fail, run:

```bash
node scripts/manual-update-trigger.mjs --trigger WC_DATA_RESCUE
```

Use `--commit --push` only after the guarded local run passes.

## Prediction Audit

Frozen records are immutable pre-match snapshots. Scoring uses Brier score, log loss, scoreline error, calibration bucket, and failure class. Benchmark metrics compare the raw model against simple references such as uniform WDL and rank-only prior; benchmarks are evidence only and do not alter probabilities.

## OmniOS Feedback Loop

Use the local ignored `offline/omnios-documents/` package as the doctrine input for app hardening, especially OmniFocaOS, OmniDevOS, OmniRedTeamOS, and the core framework. After app work reveals durable lessons, update `offline/omnios-documents/FIFA-WC-Sim-lessons.md` and fold only source-backed, generally reusable lessons back into the OmniOS documents.

Loop:

1. Apply OmniOS rules to improve this app.
2. Capture observed app failures, repairs, gates, and useful patterns.
3. Reject one-off or domain-specific details that would overfit future apps.
4. Promote reusable lessons into the ignored OmniOS notes or documents.
5. Reuse those improved OmniOS documents as input for future app builds.

This repo should commit the app-side implementation, tests, and handoff. It should not commit the downloaded OmniOS source documents.

## Calibration Rule

If resolved predictions are below `MIN_RESOLVED_PREDICTIONS`, show raw probabilities and mark `insufficient_sample`. At or above the threshold, promote conservative bucket calibration only when validation does not worsen Brier or log loss. Otherwise rollback to raw model output.

## QA Gate

Recommended full local check:

```bash
npm install
node scripts/qa.mjs
npm run ui:smoke
```

Useful focused checks:

```bash
python scripts/validate_base_data.py
node scripts/validate-calibration.mjs
node tests/run-all.mjs
python scripts/test_idempotence.py
node scripts/run-sim.mjs
```

## Fresh-Agent Fire Drill

1. Run `git status --short --branch`.
2. Read `README.md`, this file, `.github/workflows/*.yml`, and `scripts/update-base-data.mjs`.
3. Run `node scripts/validate-calibration.mjs` and `python scripts/validate_base_data.py`.
4. If data is stale, run the guarded updater or `WC_DATA_RESCUE`.
5. If any gate fails, fix the root cause before committing.
6. Push only after the working tree contains intentional validated changes.

## Evidence Checklist

- Data version and generated timestamp changed only after validated updates.
- Played flags and scores match completed results.
- Unplayed matches carry no fake scores.
- Audit scoring never uses predictions frozen after kickoff.
- Calibration state matches the embedded public calibration state.
- Health tab discloses data limitations, validation status, and benchmark scoring.
