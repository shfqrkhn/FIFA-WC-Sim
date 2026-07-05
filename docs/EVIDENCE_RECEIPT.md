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

## Input Accessibility Evidence

- Critical tournament workflows must remain usable by keyboard-only, mouse/pointer-only, and touch-only users.
- Accessibility claims require current evidence from responsive UI smoke, static checks, focus/label review, and tap-target/no-overflow checks where applicable.
- If a workflow lacks direct input-mode coverage, label it `PASS_WITH_LIMITATIONS` or `NOT_RUN`; do not claim full accessibility from responsive rendering alone.

## Recovery And Data Safety Evidence

- User-controlled import, export, reset, browser-storage, corrupt-cache, and malformed saved-data claims must remain fail-closed and tied to current tests or explicit manual evidence.
- Recovery claims may cover local state repair and guarded workflow recovery only within tested paths; they must not imply hidden upload, remote backup, or automatic reconstruction of missing source data.
- If a storage, import/export, or recovery path is not covered in the current pass, label it `PASS_WITH_LIMITATIONS` or `NOT_RUN` before public use.

## Source Gap Disclosure Evidence

- Match facts visible in outside products, previews, search cards, broadcasts, or articles are not evidence for this app until they are embedded through a guarded update, source-backed manual override, or documented source note.
- Unknown kickoff times, scorer rows, discipline ledgers, availability, injuries, lineups, goalkeeper changes, and referee assignments must remain neutral, unavailable, or explicitly source-gap labeled rather than inferred from memory, search snippets, screenshots, or unofficial aggregation.
- Any future adapter for these fields must record provenance, freshness, and failure behavior before the public UI, README, or model can claim coverage.

## Claim Boundaries

| Area | Class | Evidence | Limit |
| --- | --- | --- | --- |
| Static/offline app | `PASS` | README, `docs/index.html`, local-file behavior, `npm run ui:smoke` | Browser storage availability can still vary by device. |
| No betting/odds/markets | `PASS` | README, validator, public-surface tests | Do not add market-derived inputs. |
| Source-backed match data | `PASS_WITH_LIMITATIONS` | BASE_DATA automation, source notes, validator, source gap disclosure | Unknown kickoff, scorer, discipline, lineup, injury, availability, goalkeeper, and referee data remain neutral unless verified. |
| Frozen predictions/no future leakage | `PASS_WITH_LIMITATIONS` | prediction audit, calibration tests, no-leakage tests | Requires continued freeze-before-kickoff discipline. |
| Raw/calibrated separation | `PASS_WITH_LIMITATIONS` | calibration state and tests | Calibration stays disabled until sample thresholds are met. |
| Repository ZIP safety | `PASS_WITH_LIMITATIONS` | `docs/REPO_ZIP_POLICY.md`, protected-path scan | GitHub-generated ZIP should be rechecked before public-facing download changes. |
| Input accessibility | `PASS_WITH_LIMITATIONS` | `npm run ui:smoke`, responsive UI checks, public-surface tests | Does not certify screen-reader behavior or every browser assistive setup. |
| Recovery/data safety | `PASS_WITH_LIMITATIONS` | README, corrupt-cache/storage-failure/malformed saved-data checks, UI smoke | Does not recover missing source data or replace source-backed BASE_DATA workflows. |

## Required Before Public-Facing Change

- `git status --short --ignored`
- `git rev-list --left-right --count HEAD..."@{u}"`
- `npm run qa:full`
- `git diff --check`
- protected-path scan for ignored/private artifacts
- live Pages check after runtime or public-surface changes
