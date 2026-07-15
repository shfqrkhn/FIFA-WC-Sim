# AI Maintainer Handoff

Last audited: 2026-07-15
Branch at audit: `main`
HEAD at audit: verify current `main` before relying on this snapshot.
Refresh context: post-parallel update pass reconciliation for a future unified GitHub projects chat.

This document is a public-safe continuation map for a future expert AI agent. Treat it as a starting receipt, not as a substitute for re-reading the current repo.

## Mission

Maintain the static, offline-capable World Cup 2026 simulator in `docs/index.html` without weakening prediction quality, data integrity, automation reliability, privacy, speed, or scope control.

The app must remain:

- Static and GitHub Pages friendly.
- Autonomous through guarded GitHub Actions updates.
- Offline-capable from embedded `BASE_DATA`.
- Transparent about probabilistic assumptions and data gaps.
- Free of tracking, hidden remote scripts, betting, odds, gambling, sportsbook, market-edge, or prediction-market features.
- A future Prediction Hub can grow from this repo only if it preserves the current simulator's frozen-audit, no-leakage, source-backed, static/offline, and raw-vs-calibrated governance.

## OmniOS Transfer Contract

- Product truth: static/offline World Cup simulator, not a betting, odds, market, or official FIFA product.
- Execution truth: preserve the guarded BASE_DATA update path, PR-based automation, branch checks, and documented local gates before publishing.
- Evidence truth: use `docs/EVIDENCE_RECEIPT.md`, prediction audits, calibration/backtest receipts, source notes, and tests; public claims must stay within `PASS` or `PASS_WITH_LIMITATIONS`.
- Operations truth: live Pages or current main repository ZIP are the only distribution paths; GitHub Releases stay absent.
- Reliability truth: keep prediction, source-data, simulation, import/export/reset, and automation paths self-checking, crash-recoverable, state-explicit, modular, maintainable, simple, one-input accessible, and TDD/SDD-backed; remove complexity that does not improve resilience or usability.
- Ecosystem truth: follow the shared signature design system in `shfqrkhn/.github/docs/SIGNATURE_DESIGN_SYSTEM.md` for public UI/UX changes; adapt it to tournament simulation rather than copying components blindly.
- Design truth: keep UI changes modern minimalist, utilitarian, professional, joyful, responsive, and contextual to tournament simulation; use local CSS/tokens and native controls first, treat MIT UI libraries/resources as inspiration only unless a source-backed need justifies a dependency, and reject browser JS popups, blocking overlays, overlapping components, inaccessible controls, unbounded motion, or arbitrary component copy-paste.
- Single input truth: after setup, critical workflows must remain fully operable by keyboard only, mouse/pointer only, touch only, or platform-limited input only; never require a combined input-mode path for core tournament use.
- Transfer truth: update this handoff and the evidence receipt whenever source, workflow, prediction, or public-surface guarantees change.

## Doctrine Delta Decision

- After incidents, rescue runs, maturity passes, or repeated failures, classify reusable lessons as `promote`, `reject`, `quarantine`, or `keep_local`.
- Promote only source-backed, reusable, non-secret lessons that strengthen a gate, checklist, source rule, or failure guard without weakening prediction integrity.
- Keep private, project-specific, speculative, or unverified lessons out of public repos unless the user explicitly approves publication.

## Current State Snapshot

Verify these values before relying on them; they describe the repo at the audit above.

- App entrypoint: `docs/index.html`.
- App version: `1.2.2` from `package.json`.
- Embedded data version: `2026-07-15-accuracy-enriched`.
- Embedded data generated at: `2026-07-15T21:15:26Z`.
- Latest source-backed update settled M102 England 1-2 Argentina from ESPN completed-final event `760515`; M101 France 0-2 Spain is also embedded from event `760514`.
- Latest update receipt: `data/latest-update.json`.
- Health receipt: `data/update-health.json`.
- Played matches: 102 of 104.
- Group matches: 72 of 72 played.
- Knockout matches: 30 of 32 played.
- Overdue unplayed matches: 0.
- Next scheduled match day in embedded data: `2026-07-18`.
- Frozen prediction records: 80.
- Settled frozen predictions: 76; comparative report presents 33 settled matches, one latest eligible pre-kickoff forecast per match, with 43 earlier snapshots retained only in the immutable audit.
- Calibration status: `active`, retained only because the chronological held-out Brier and log-loss gate passed.
- Calibration threshold: 30 resolved predictions.
- Backtest status: `sufficient_for_calibration_review`, prospective frozen-ledger audit only.
- Raw frozen-ledger benchmark: Brier `0.331805570014`, log loss `0.606026648862`, count `76`.
- Ignored local runtime file currently expected after simulation/test runs: `data/latest-simulation.json`.

## Public Files To Know

- `README.md`: user-facing overview, update protocol, sources, validation, disclaimer.
- `docs/index.html`: single-file app shell, embedded `BASE_DATA`, model, UI, local storage, self-tests.
- `docs/AI_MAINTAINER_HANDOFF.md`: this public-safe continuation map.
- `docs/assets/`: public README/demo assets.
- Private Prediction Hub planning references may exist in the local GH workspace docs bundle; do not publish or copy them by default.
- `data/latest-update.json`: latest update receipt.
- `data/update-health.json`: generated health and data-quality receipt.
- `data/prediction-audit.json`: immutable frozen prediction ledger.
- `data/calibration-state.json`: conservative calibration state, kept separate from base model output.
- `data/backtest-audit.json`: prospective backtest report from frozen records.
- `data/comparative-results.json`: settled-only immutable forecast-vs-actual report, embedded into Stats/Data/Checks/Health.
- `data/manual-overrides.example.json`: source-backed override schema example.
- `scripts/`: update, enrichment, scoring, calibration, QA, idempotence, and rescue tools.
- `tests/`: unit, regression, no-leakage, workflow, calibration, backtest, and UI smoke tests.
- `.github/workflows/`: daily update, match-window update, BASE_DATA PR check, security, and static UI smoke workflows.
- `.github/FUNDING.yml`: GitHub Sponsor metadata.

## Private Or Ignored Files

Do not commit, publish, link, or summarize private/offline material unless the user explicitly asks and confirms scope.

Currently ignored/private categories include:

- `offline/`
- `offline/omnios-documents/`
- `offline/prediction-hub/`
- `OMNI_HANDOVER.md`
- `linkedin-post-package/`
- `data/manual-overrides.json`
- `data/latest-simulation.json`
- `data/scoreboards/`
- `node_modules/`
- `playwright-report/`
- `test-results/`
- `.codex-remote-attachments/`
- `scripts/__pycache__/`

Before any commit, run:

```bash
git status --short --ignored
git ls-files offline OMNI_HANDOVER.md linkedin-post-package .codex-remote-attachments data/manual-overrides.json data/latest-simulation.json data/scoreboards
```

The second command should print nothing.

## Automation

Daily update workflow:

- File: `.github/workflows/daily-base-data-update.yml`
- Schedule: `37 11 * * *` UTC and `37 17 * * *` UTC.
- Purpose: morning update plus safety update for delayed feeds or missed runs.
- Manual fallback: `workflow_dispatch`.
- Publish path: opens or updates `automation/daily-base-data-update` as a bot pull request after validation; it must not push generated data directly to `main`.

Match-window workflow:

- File: `.github/workflows/match-window-data-update.yml`
- Schedule: every 30 minutes during June/July UTC days.
- Script: `node scripts/match-window-update.mjs`.
- Behavior: no-ops unless near a pre-kickoff slot, post-match slot, or bounded stale-result recovery window.
- Guardrail: active-match lock refuses full updates during live-match windows and permits freeze-only records for later matches when safe.
- Publish path: opens or updates `automation/match-window-base-data-update` as a bot pull request after validation; it must not push generated data directly to `main`.
- Repository setting required: GitHub Actions workflow permissions must allow Actions to create pull requests; otherwise validation and branch push can pass while `gh pr create` fails.
- Bot PR checks: publisher dispatches `base-data-pr-check.yml` and `security-check.yml` on the automation branch because PRs created with `GITHUB_TOKEN` do not reliably trigger pull-request workflows.
- Immutable audit reconciliation: both scheduled workflows fetch the daily and match-window automation branches and run `scripts/reconcile-prediction-audits.mjs` before updating, preserving distinct pre-kickoff forecasts while deduplicating equivalent records.
- Transactional publication gate: Actions proposes changes through a bot PR, dispatches required BASE_DATA and security checks, requests GitHub auto-merge only after both contexts pass, waits for the merge, explicitly deploys that merged commit with `deploy-pages.yml`, and fails if merge or deployment is not proven.
- Recovery watchdog: `publication-watchdog.yml` runs after every daily or match-window updater, every 15 minutes on June/July weekends, and via `workflow_dispatch`. It revalidates, merges, and deploys any stranded automation PR; validation conflicts remain failed and visible rather than discarding immutable records.

BASE_DATA PR check:

- File: `.github/workflows/base-data-pr-check.yml`
- Runs on pull requests and manual dispatch.
- Executes Python/Node syntax checks, base-data validation, calibration validation, unit tests, and simulation smoke so branch protection can require a PR-safe check.

Static UI smoke:

- File: `.github/workflows/ui-smoke.yml`
- Runs on relevant `main` pushes and manual dispatch.
- Executes Playwright against the static app.

Pages deployment:

- File: `.github/workflows/deploy-pages.yml`.
- Runs for relevant `main` pushes and explicit publication dispatches.
- Deploys the repository `docs/` artifact through GitHub Pages Actions and reports the deployed URL.

If workflows fail, inspect logs first. Patch repo-caused failures only. Treat GitHub platform delays/outages as transient unless logs show a repo defect.

## Data Update Flow

Primary guarded update:

```bash
node scripts/update-base-data.mjs
```

No-fetch deterministic repair/enrichment:

```bash
node scripts/update-base-data.mjs --no-fetch
```

Manual rescue trigger:

```bash
node scripts/manual-update-trigger.mjs --trigger WC_DATA_RESCUE
```

Rescue uses the same guarded path, refuses partial failed candidates, and does not commit unless explicitly told to do so.

Generated artifacts that update workflows may propose by bot pull request after validation:

- `docs/index.html`
- `data/latest-update.json`
- `data/update-health.json`
- `data/prediction-audit.json`
- `data/calibration-state.json`
- `data/backtest-audit.json`
- `data/comparative-results.json`

Local-only runtime artifacts such as `data/latest-simulation.json`, `data/scoreboards/`, `data/manual-overrides.json`, `playwright-report/`, and `test-results/` must remain ignored.

On Windows, `npm run qa` can leave generated JSON files showing as modified even when `git diff -- data/*.json` is empty. Treat that as line-ending/stat noise, not a data update; restore only those no-diff generated artifacts before committing docs.

## Prediction Governance

Preserve these rules:

- Freeze pre-match predictions before kickoff.
- Never score predictions created after kickoff.
- Never calibrate using future data.
- Never retrofit or deploy a fit on already-settled tournament outcomes; use them only for diagnostics and the existing chronological held-out calibration gate.
- Keep frozen predictions immutable after creation.
- Keep raw base model output and calibrated output separable.
- Keep calibration disabled below the threshold.
- Roll back or fail closed if calibration worsens validation metrics.
- Keep unavailable lineups, injuries, suspensions, referees, scorer snapshots, and incomplete discipline ledgers neutral unless reliable source-backed data exists.
- Do not use betting, odds, sportsbook, wagering, market-edge, or prediction-market data.
- If expanding toward Prediction Hub, keep the architecture as platform + templates + instances: shared shell/governance, reusable event templates, and concrete event instances. FIFA and UEFA can be first-class; March Madness, NBA playoffs, tennis slams, cricket tournaments, or other events must inherit the same frozen-ledger and source-health gates rather than weakening them.

Failure classes currently supported:

- `overconfident_favorite`
- `underestimated_draw`
- `bad_weather_adjustment`
- `bad_host_adjustment`
- `bad_recent_form_weight`
- `bad_attack_defense_weight`
- `knockout_penalty_variance`
- `missing_lineup_or_suspension_data`
- `pure_variance`
- `data_quality_or_source_gap`

Source-limited lineup/suspension statuses can feed the failure class audit, but they are derived audit labels only; do not rewrite existing frozen forecast probabilities or invent availability facts.

## UI Consistency Invariants

The app should use one authoritative match display path for visible match facts. Sim Today, Groups, Bracket, Stats/Data, and explanation views must not contradict each other.

Verify consistency for:

- Match number.
- Stage/round/group.
- Teams.
- Score.
- Venue.
- User-local kickoff time.
- Played state.
- Winner/loser.
- Draw, AET, and penalty notes.
- MC summary visibility.

Specific rules:

- Today's matches sort by user-local kickoff time, then match number.
- Today's matches show the same MC summary as Bracket for pending matches.
- Completed matches must not show stale pending-style MC prediction text.
- If a match has a real final result, display the result state, not a forecast.

## Required Local Checks

Run the full gate after material changes:

```bash
npm run qa:full
```

Useful focused checks:

```bash
python scripts/validate_base_data.py
node scripts/run-sim.mjs
node scripts/validate-calibration.mjs
node scripts/backtest-audit.mjs --no-write
node tests/run-all.mjs
python scripts/test_idempotence.py
```

Minimum expected structural invariants:

- 48 teams.
- 72 group matches.
- 32 knockout matches.
- 104 total matches.
- No duplicate teams or match numbers.
- Played matches have finite sane scores.
- Unplayed matches do not contain fake results.
- Monte Carlo runs without errors.
- Local storage and corrupt-cache safety are preserved.
- Responsive layout avoids horizontal page scroll on supported viewports.

## Safe Continuation Protocol

1. Read `git status --short --ignored`.
2. Confirm branch and HEAD.
3. Inspect any tracked dirty files before editing.
4. Confirm private/ignored files are not tracked.
5. Read `README.md`, this handoff, workflow files, `package.json`, and relevant scripts/tests.
6. Inspect `data/latest-update.json`, `data/update-health.json`, `data/prediction-audit.json`, `data/calibration-state.json`, `data/backtest-audit.json`, and `data/comparative-results.json`.
7. If changing embedded data, use guarded scripts instead of manual JSON edits whenever possible.
8. If changing UI/model logic, add or update targeted tests first when practical.
9. Run focused checks, then `npm run qa:full`; use `npm run qa` or `npm run ui:smoke` only when a narrower check is intentionally sufficient.
10. Review `git diff --check` and `git diff`.
11. Commit and push only when the user asks or the active task explicitly requires it.

## Known Limits

- Automated scores come from ESPN public scoreboard matching, with official FIFA preferred for manual dispute resolution.
- Weather enrichment can be missing for unplayed matches and must degrade to neutral/climate assumptions.
- Top scorers are empty unless a reliable scorer feed or source-backed manual `currentStats.topScorers` patch is supplied.
- Award projections are simulator-side estimates, not official FIFA predictions.
- Full discipline, lineups, injuries, suspensions, goalkeeper changes, and referee assignments are not automatically ingested.
- The backtest is prospective from frozen records, not a historical replay.
- Calibration is currently inactive because the resolved sample is below threshold.

## High-ROI Future Work

Only implement if source-backed and covered by tests:

- Populate the official/manual scorer snapshot path when a reliable source is available.
- Populate source-backed discipline/fair-play ledger patches when reliable source data is available.
- Populate source-backed availability patches for confirmed suspensions, key absences, and goalkeeper changes when reliable source data is available.
- Improve workflow observability only where it reduces real debugging time.
- Keep expanding frozen-prediction audit sample through the rest of the tournament.

Avoid:

- New dependencies without repeated need and replacement path.
- Hidden remote runtime calls from the app.
- Cosmetic rewrites that do not improve correctness or usability.
- Model complexity that cannot be validated against frozen predictions.

## Reusable Next-Agent Prompt

```text
Repo: D:\VSCode\GH\FIFA-WC-Sim / https://github.com/shfqrkhn/FIFA-WC-Sim

Objective: continue evidence-first maintenance of the static/offline World Cup 2026 simulator. Inspect current files before relying on prior chat.

Start by checking git branch, HEAD, dirty/ignored files, private-file tracking, README, docs/AI_MAINTAINER_HANDOFF.md, workflows, package scripts, docs/index.html, data receipts, prediction audit, calibration state, and backtest audit.

Preserve: static/offline app, autonomous guarded updates, one authoritative match display path, no data invention, no tracking, no betting/odds/markets, neutral missing inputs, immutable pre-match frozen predictions, no future leakage, separable fail-closed calibration, responsive UI, and existing tests.

Patch only material issues affecting correctness, data freshness, automation reliability, no-leakage, UI clarity, docs accuracy, or maintainability. Prefer shared helpers and existing patterns.

Run relevant targeted tests plus: python scripts/validate_base_data.py, node scripts/run-sim.mjs, node scripts/validate-calibration.mjs, node scripts/backtest-audit.mjs --no-write, node tests/run-all.mjs, and npm run qa:full for public-facing changes.

Do not commit ignored/private/offline files. Commit/push to main only if explicitly requested or required by the task after checks pass.
```
