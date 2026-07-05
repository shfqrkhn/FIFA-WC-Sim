# Repository ZIP Policy

Users should run the live GitHub Pages app or download the repository through **Code > Download ZIP**. The repository ZIP must remain safe to inspect, extract, and run locally without requiring a separate GitHub Release.

## Allowed

- `docs/index.html`, public README assets, package manifests, workflows, scripts, tests, and source-backed `data/*.json` receipts.
- Generated World Cup data artifacts committed by guarded update workflows after validation.
- Documentation that describes known limitations, data gaps, and validation commands.

## Forbidden

- `offline/`, `linkedin-post-package/`, `.codex-remote-attachments/`, `node_modules/`, `test-results/`, `playwright-report/`, `scripts/__pycache__/`, `data/scoreboards/`, `data/latest-simulation.json`, and `data/manual-overrides.json`.
- API keys, credentials, private notes, local exports, user-specific paths, PII, raw provider payloads, or generated scratch files.
- Invented match, scorer, discipline, availability, injury, suspension, lineup, referee, odds, betting, sportsbook, or market data.

## Public Claims

- Allowed: static/offline simulator, source-backed generated data, transparent probabilistic model, frozen prediction audit, raw/calibrated separation, and explicit data-gap disclosure.
- Not claimed unless separately evidenced: official scorer feed automation, complete discipline ledger automation, lineup/injury/suspension/referee freshness, public prediction-platform readiness, or external provider/currentness guarantees.

## Verification

Before pushing public ZIP/download-facing changes, run:

```bash
npm run qa:full
git diff --check
```

Repository ZIP review must include `git status --short --ignored` and a protected-path scan proving forbidden local artifacts remain untracked.
