# Evidence Receipt

This public-safe receipt keeps FIFA-WC-Sim claims tied to evidence instead of chat history.

## Evidence Classes

- `PASS`: directly covered by current files, tests, or checks.
- `PASS_WITH_LIMITATIONS`: true only within the stated scope.
- `NOT_RUN`: not checked in the current pass.
- `BLOCKED`: cannot be checked until an external condition changes.
- `NO_GO`: failed or unsafe; do not publish until fixed.

## Claim Firewall Invariant

- Every public technical, security, privacy, download, data, forecast, workflow, or model claim must map to a `Claim Boundaries` row or be added with evidence before publication.
- Public claims may not exceed `PASS` or `PASS_WITH_LIMITATIONS`; `NOT_RUN`, `BLOCKED`, and `NO_GO` items must stay unpublished or be labeled as unavailable.
- Volatile match data, source freshness, workflow state, and GitHub settings must be rechecked from current repo state before reliance.

## Currentness Watchdog

- Recheck claim evidence before public-facing changes, not on a fixed calendar.
- If current evidence is stale, missing, inaccessible, or contradicted by source/repo/GitHub state, downgrade the affected claim to `NOT_RUN`, `BLOCKED`, or `NO_GO`.
- Do not preserve old status snapshots as proof after match data, source notes, generated receipts, workflows, branch protection, or public model wording changes.

## Safe-To-Publish Receipt

- Mark this repo safe to publish only when the current pass proves a clean synced tree, no GitHub Releases, no protected tracked paths, no open security/dependabot alerts, passing required gates, and working live or repository-ZIP distribution surface.
- If any proof is missing, stale, or contradicted by GitHub/repo/source state, record the repo as `PASS_WITH_LIMITATIONS`, `NOT_RUN`, `BLOCKED`, or `NO_GO` instead of safe.
- The final status table must name remaining risks rather than implying safety from silence.

## Claim Boundaries

| Area | Class | Evidence | Limit |
| --- | --- | --- | --- |
| Static/offline app | `PASS` | README, `docs/index.html`, local-file behavior, `npm run ui:smoke` | Browser storage availability can still vary by device. |
| No betting/odds/markets | `PASS` | README, validator, public-surface tests | Do not add market-derived inputs. |
| Source-backed match data | `PASS_WITH_LIMITATIONS` | BASE_DATA automation, source notes, validator | Unknown scorer, discipline, lineup, injury, and referee data remain neutral unless verified. |
| Frozen predictions/no future leakage | `PASS_WITH_LIMITATIONS` | prediction audit, calibration tests, no-leakage tests | Requires continued freeze-before-kickoff discipline. |
| Raw/calibrated separation | `PASS_WITH_LIMITATIONS` | calibration state and tests | Calibration stays disabled until sample thresholds are met. |
| Repository ZIP safety | `PASS_WITH_LIMITATIONS` | `docs/REPO_ZIP_POLICY.md`, protected-path scan | GitHub-generated ZIP should be rechecked before public-facing download changes. |

## Required Before Public-Facing Change

- `git status --short --ignored`
- `git rev-list --left-right --count HEAD..."@{u}"`
- `npm test`
- `npm run qa`
- `npm run ui:smoke`
- `git diff --check`
- protected-path scan for ignored/private artifacts
- live Pages check after runtime or public-surface changes
