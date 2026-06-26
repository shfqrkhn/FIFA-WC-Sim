# World Cup 2026 Simulator 🏆⚽

**Current Data Version:** shown in the deployed app's Maintenance view from embedded `BASE_DATA`.

**A fast, offline-first tournament simulator for exploring the 2026 FIFA World Cup.**

Welcome to World Cup 2026 Simulator, a single-file web app built for quick tournament runs, Monte Carlo probability estimates, group-stage tracking, knockout-path exploration, and transparent model inspection.

[**Live Demo**](https://shfqrkhn.github.io/FIFA-WC-Sim/)

## Screenshot

![World Cup 2026 Simulator dashboard](docs/assets/simulator-dashboard.png)

## 🌟 What is World Cup 2026 Simulator?

World Cup 2026 Simulator is a **free, static, offline-capable** app for simulating the full 48-team, 104-match FIFA World Cup 2026 format. It combines embedded group results, FIFA ranking priors, team-strength assumptions, venue effects, weather context, home/co-host advantage, seeded randomness, knockout logic, and Monte Carlo runs into one portable HTML file.

The app is designed to be transparent: model assumptions, coefficients, match explanations, data patches, source notes, and audit checks are visible inside the interface.

## 🚀 Getting Started

Using the simulator is simple.

1. **Visit the App:** Open your browser and go to: [shfqrkhn.github.io/FIFA-WC-Sim/](https://shfqrkhn.github.io/FIFA-WC-Sim/)
2. **Run Monte Carlo:** Choose a seed, number of runs, model mode, home-advantage setting, and weather mode, then click **Run Monte Carlo**.
3. **Review the Probability Board:** Stay on the Simulator page to compare top champion probabilities and likely tournament paths.
4. **Explore Detail:** Use Groups, Bracket, Monte Carlo, Stats, Transparency, Model/Data, Audit, Maintenance, and Sources when deeper inspection is needed.
5. **Save Offline:** Because the app is a standalone HTML file with no required dependencies, you can save it locally and keep using the embedded simulator without a network connection. Optional live data refreshes require internet access.

## 🧭 Main Features

### 📊 Simulator Dashboard

The main dashboard is optimized around the probability board and core controls:

* **Monte Carlo runs:** Estimate title probabilities across repeated seeded tournament simulations.
* **Compact controls:** Adjust seed, run count, mode, home advantage, and weather behavior.
* **Auto-refresh flow:** Relevant optional data refreshes are triggered through the Monte Carlo workflow instead of extra manual buttons.
* **Responsive UI:** Designed for desktop, tablet, mobile, touch, mouse, keyboard, and constrained input conditions.

### 🏟️ Group Stage

The Groups section shows the full group-stage picture:

* Embedded played results.
* Projected unplayed results when simulated.
* FIFA-style group ranking logic.
* Best third-place qualification queue.
* Fair-play/team-conduct inputs where available.

### 🧩 Knockout Bracket

The Bracket section simulates the full knockout stage:

* Round of 32 through Final.
* Legal third-place assignment.
* FIFA Annex C-aware exact mapping when available.
* Legal fallback allocator when exact external mapping is unavailable.
* Extra time and penalty shootout modeling.

### 🎲 Monte Carlo Table

The Monte Carlo section provides deeper probability output:

* Champion probability.
* Final appearance.
* Semifinal, quarterfinal, round-of-16, and round-of-32 appearance rates.
* Seeded repeatability for comparable runs.

### 🔎 Transparency Ledger

The Transparency section explains how results are generated:

* Power formulas.
* Expected-goals calculations.
* Venue, climate, altitude, and host/co-host adjustments.
* Manual match-context modifiers.
* Match-by-match explanation ledgers.

### 🛠️ Model/Data, Audit, and Maintenance

The app includes built-in reliability tooling:

* Editable JSON data patching.
* Import/export support.
* Safe local persistence.
* Structural data repair.
* Integrity audit.
* Regression checks for bracket allocation, cached data, storage failures, malformed saved data, Monte Carlo accounting, and UI accessibility paths.
* Maintenance handoff prompt for future AI-assisted updates.

## 🔒 Privacy and Offline Use

World Cup 2026 Simulator runs in your browser. Data edits are stored locally through browser storage when available, and the app continues to work when storage is blocked or unavailable.

No account, tracking script, backend service, or required third-party dependency is needed. Optional live weather and Annex C refreshes use public web requests only when triggered by the app flow and available in the browser.

## ⚠️ Important Disclaimer

This is a probabilistic simulator, not an official FIFA product, live scoring authority, prediction guarantee, or betting tool. Current facts, match results, injuries, suspensions, lineups, rankings, and official regulations should be verified against trusted sources before relying on them.

## 🤝 Community

Use the simulator to explore scenarios, compare assumptions, test tournament paths, and discuss World Cup probabilities. If you improve the model, data, UI, accessibility, or audit coverage, consider contributing those changes back to the project.

## 🏆 Stability Verified

World Cup 2026 Simulator has been iteratively hardened through syntax checks, runtime smoke tests, Monte Carlo invariant tests, third-place allocation checks across all 495 valid combinations, corrupt-cache rejection tests, storage-failure tests, malformed saved-data repair tests, penalty shootout validation, and responsive UI regression passes.
