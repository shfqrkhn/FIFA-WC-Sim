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

- Mark this repo safe to publish only when the current pass proves a clean synced tree, no GitHub Releases, no protected tracked paths, no open secret/dependabot/code-scanning alerts or a documented code-scanning not-applicable/no-analysis state, passing required gates, and working live or repository-ZIP distribution surface.
- Runtime app code scanning uses `.github/workflows/codeql.yml` with CodeQL JavaScript analysis; missing or failed analysis must be reported as `PASS_WITH_LIMITATIONS`, `NOT_RUN`, or `NO_GO`.
- If any proof is missing, stale, or contradicted by GitHub/repo/source state, record the repo as `PASS_WITH_LIMITATIONS`, `NOT_RUN`, `BLOCKED`, or `NO_GO` instead of safe.
- The final status table must name remaining risks rather than implying safety from silence.

## Input Accessibility Evidence

- Critical tournament workflows must remain usable with one available input mode: keyboard only, mouse/pointer only, touch only, or platform-limited input only.
- Accessibility claims require current evidence from responsive UI smoke, static checks, focus/label review, platform text-entry support, and tap-target/no-overflow checks where applicable.
- If keyboard-only, mouse-only, touch-only, or platform-limited operation lacks direct coverage, label it `PASS_WITH_LIMITATIONS` or `NOT_RUN`; do not claim full accessibility from responsive rendering alone.

## Single Input Directive Evidence

- After initial setup, every critical workflow must be fully operable with one available input mode: keyboard only, mouse/pointer only, touch only, or platform-limited input only.
- No critical workflow may require a combined keyboard-plus-pointer, keyboard-plus-touch, hover-plus-keyboard, drag-plus-keyboard, or browser-popup path.
- Controls must expose visible focus, click/tap alternatives, platform text-entry support where text is unavoidable, and nonblocking status/recovery paths for degraded HID conditions.
- If keyboard-only, mouse-only, touch-only, or platform-limited operation is not directly covered in the current pass, downgrade the affected claim to `PASS_WITH_LIMITATIONS` or `NOT_RUN`.

## Design Language Evidence

- UI changes must preserve a modern minimalist, utilitarian, professional, joyful, responsive, tournament-contextual design language with local CSS/tokens, semantic native controls, visible focus, reduced-motion-safe transitions, no horizontal overflow, and no component overlap.
- Signature Ecosystem Evidence: FIFA-WC-Sim must look and feel like part of the shared `shfqrkhn` ecosystem while staying contextual to source-backed tournament simulation and dense match comparison.
- MIT UI libraries/resources such as Uiverse, Open Props, Primer, Radix Colors, Pico CSS, Heroicons, Bootstrap Icons, Floating UI, or A11y Dialog are inspiration sources only unless a source-backed, license-checked, tested need justifies a dependency.
- Reject browser JS popups, blocking overlays, arbitrary component copy-paste, mixed visual systems, unbounded animation, external CDNs, or styling that makes match facts harder to compare.

## Recovery And Data Safety Evidence

- User-controlled import, export, reset, browser-storage, corrupt-cache, and malformed saved-data claims must remain fail-closed and tied to current tests or explicit manual evidence.
- Recovery claims may cover local state repair and guarded workflow recovery only within tested paths; they must not imply hidden upload, remote backup, or automatic reconstruction of missing source data.
- If a storage, import/export, or recovery path is not covered in the current pass, label it `PASS_WITH_LIMITATIONS` or `NOT_RUN` before public use.

## Mission-Critical Reliability Evidence

- Critical prediction, source-data, simulation, import/export/reset, and workflow automation paths must stay self-checking, crash-recoverable, state-explicit, modular, maintainable, simple, one-input accessible, and TDD/SDD-backed.
- Runtime and automation failures must fail closed with visible status, preserved frozen predictions, no invented match data, no browser popup APIs, and no hidden upload.
- New complexity is acceptable only when it directly improves resilience, usability, source provenance, state clarity, or maintainability and is covered by current tests or explicit evidence.
- Autonomous AI-assisted development must start from current files, add or update tests before broad data/UI/workflow changes, keep claims inside evidence boundaries, and leave a reproducible recovery path.

## Source Gap Disclosure Evidence

- Match facts visible in outside products, previews, search cards, broadcasts, or articles are not evidence for this app until they are embedded through a guarded update, source-backed manual override, or documented source note.
- Unknown kickoff times, scorer rows, discipline ledgers, availability, injuries, lineups, goalkeeper changes, and referee assignments must remain neutral, unavailable, or explicitly source-gap labeled rather than inferred from memory, search snippets, screenshots, or unofficial aggregation.
- Frozen-prediction audit labels may classify verified-missing or neutral-unless-verified availability statuses as source-limited evidence, but they must not change frozen forecast probabilities or invent match facts.
- Any future adapter for these fields must record provenance, freshness, and failure behavior before the public UI, README, or model can claim coverage.

## Final Tournament Closure Evidence

- Source-data checkpoint `cb2bad1` embeds 104/104 ESPN completed finals with no overdue or unplayed matches: M103 France 4-6 England (`760516`) and M104 Spain 1-0 Argentina after extra time (`760517`). Spain is champion and England is third.
- The immutable ledger contains 82 frozen and 82 settled forecasts, with 0 unresolved and 0 rejected. The match report selects one latest eligible pre-kickoff record for each of 35 settled matches and retains 47 earlier snapshots only in the audit ledger.
- Final match-level metrics are W/D/L 25/35, exact score 0/35, and knockout advancement 23/29. These are prospective source-bounded diagnostics, not historical replay or certainty claims.
- Calibration is inactive as `validation_worsened_rollback`: the rebuilt proposal, trained only on the earlier chronological partition, worsened held-out Brier from `0.336868249974` to `0.358304915269` and log loss from `0.612656004659` to `0.636251719016` at n=25. Raw probabilities remain active; final outcomes were not used to relax, tune, or replace the gate.
- Tournament cron schedules are retired. Daily and match-window workflows retain `workflow_dispatch`; publication recovery retains `workflow_run` and `workflow_dispatch`; local `WC_DATA_RESCUE` remains available. Any future correction must be intentional, source-backed, validated, and deployed from the exact merge commit.
- Permanent limits remain: ESPN is the machine-readable score feed rather than an official-completeness guarantee; scorer, attendance, lineup, injury, suspension, goalkeeper, referee, and full discipline inputs remain unavailable or neutral unless separately verified; accessibility evidence does not certify every assistive technology.
- Closure class: `PASS_WITH_LIMITATIONS` unless the current publication pass also proves clean/synced main, required checks, no open PR or unique automation artifact, zero GitHub alerts/releases, protected-path and ZIP safety, and exact-commit live Pages deployment.

## Claim Boundaries

| Area | Class | Evidence | Limit |
| --- | --- | --- | --- |
| Static/offline app | `PASS` | README, `docs/index.html`, local-file behavior, `npm run ui:smoke` | Browser storage availability can still vary by device. |
| No betting/odds/markets | `PASS` | README, validator, public-surface tests | Do not add market-derived inputs. |
| Source-backed match data | `PASS_WITH_LIMITATIONS` | BASE_DATA automation, source notes, validator, source gap disclosure | Unknown kickoff, scorer, discipline, lineup, injury, availability, goalkeeper, and referee data remain neutral unless verified. |
| Frozen predictions/no future leakage | `PASS_WITH_LIMITATIONS` | prediction audit, calibration tests, no-leakage tests | Any future correction must preserve all frozen records and settled scores. |
| Raw/calibrated separation | `PASS_WITH_LIMITATIONS` | calibration state and tests | Final held-out validation worsened; raw-only rollback must remain active unless the unchanged prospective gate proves otherwise. |
| Repository ZIP safety | `PASS_WITH_LIMITATIONS` | `docs/REPO_ZIP_POLICY.md`, `git archive`, protected-path scan | GitHub-generated ZIP should be rechecked before public-facing download changes. |
| Input accessibility | `PASS_WITH_LIMITATIONS` | `npm run ui:smoke`, responsive UI checks, public-surface tests | Does not certify screen-reader behavior or every browser assistive setup. |
| Single input operation | `PASS_WITH_LIMITATIONS` | input accessibility evidence, UI smoke, static controls, no browser popup policy | Does not certify every OS assistive technology or unusual HID/browser pairing. |
| Design language/UI safety | `PASS_WITH_LIMITATIONS` | handoff/evidence docs, public-surface tests, UI smoke, visual/manual checks where run | Does not certify every viewport or assistive technology; contextual tournament surfaces may differ from other repos. |
| Signature ecosystem fit | `PASS_WITH_LIMITATIONS` | shared signature design system reference, design evidence, public-surface tests, UI smoke | Does not require identical UI components; tournament data density and match comparison remain domain-specific. |
| Recovery/data safety | `PASS_WITH_LIMITATIONS` | README, corrupt-cache/storage-failure/malformed saved-data checks, UI smoke | Does not recover missing source data or replace source-backed BASE_DATA workflows. |
| Mission-critical reliability | `PASS_WITH_LIMITATIONS` | mission-critical reliability evidence, tests, QA, UI smoke, workflow evidence | Does not certify official data completeness, external source availability, or regulated-grade infrastructure. |

## Required Before Public-Facing Change

- `git status --short --ignored`
- `git rev-list --left-right --count 'HEAD...@{u}'`
- `gh release list --limit 5` returns no releases
- `npm run qa:full`
- `git diff --check`
- protected-path scan for ignored/private artifacts, exports, backups, logs, and scratch folders
- live Pages check after runtime or public-surface changes
