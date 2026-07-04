# Release Artifact Policy

This repo may publish static app and data-release artifacts only. Release claims must stay bounded by the current checked receipts and tests.

## Allowed

- `docs/index.html`, public README assets, package manifests, workflows, scripts, tests, and source-backed `data/*.json` receipts.
- Generated World Cup data artifacts committed by guarded update workflows after validation.
- Documentation that describes known limitations, data gaps, and validation commands.

## Forbidden

- `offline/`, `linkedin-post-package/`, `.codex-remote-attachments/`, `node_modules/`, `test-results/`, `playwright-report/`, `scripts/__pycache__/`, `data/scoreboards/`, `data/latest-simulation.json`, and `data/manual-overrides.json`.
- API keys, credentials, private notes, local exports, user-specific paths, PII, raw provider payloads, or generated scratch files.
- Invented match, scorer, discipline, availability, injury, suspension, lineup, referee, odds, betting, sportsbook, or market data.

## Release Claims

- Allowed: static/offline simulator, source-backed generated data, transparent probabilistic model, frozen prediction audit, raw/calibrated separation, and explicit data-gap disclosure.
- Not claimed unless separately evidenced: official scorer feed automation, complete discipline ledger automation, lineup/injury/suspension/referee freshness, public prediction-platform readiness, or release-grade external provider/currentness guarantees.

## Verification

Before publishing release assets, run:

```bash
npm test
npm run qa
npm run ui:smoke
git diff --check
```

Release review must include `git status --short --ignored` and a protected-path scan proving forbidden local artifacts remain untracked.
