# World Cup 2026 Simulator

**Current Data Version:** shown in the deployed app's Data health view from embedded `BASE_DATA`.

World Cup 2026 Simulator is a static, offline-capable web app for exploring the 48-team, 104-match FIFA World Cup 2026 format. It combines embedded match results, an ensemble prediction engine, venue/weather context, host advantage, seeded randomness, FIFA-style group ranking, knockout rules, and Monte Carlo tournament simulation in one portable HTML file.

[Live Demo](https://shfqrkhn.github.io/FIFA-WC-Sim/)

## Screenshot

![World Cup 2026 Simulator dashboard](docs/assets/simulator-dashboard.png)

## Quick Start

1. Open the live app.
2. On the **Sim** tab, keep the defaults or adjust the scenario name, number of prediction runs, match style, host boost, and weather setting.
3. Press **Run predictions**.
4. Read **Most likely champions** first. This is the quickest summary of the tournament outlook.
5. Review **Sample tournament path** to see one representative bracket path that matches the top Monte Carlo outcome.
6. Use **Groups**, **Bracket**, and **Odds** for more detail.
7. Use **How**, **Data**, **Checks**, **Health**, and **Sources** only when you want deeper transparency or maintenance detail.

## Main Tabs

### Sim

The main screen is designed to answer the most common question first: who is most likely to win?

Controls:

* **Scenario name:** a seed for repeatable results. The same seed and settings produce the same sample tournament path.
* **Prediction runs:** how many Monte Carlo tournament runs to perform. More runs produce smoother probabilities and take longer.
* **Match style:** balanced, steadier, or more upsets.
* **Host boost:** turns host/co-host expected-goal advantage on or off.
* **Weather:** uses live weather if available, venue climate estimates, or no weather adjustment.

### Groups

Shows current group standings, played results, projected upcoming scores, and the best third-place queue. Played matches stay fixed; unplayed matches are filled by the prediction engine.

### Bracket

Shows the projected knockout bracket from the Round of 32 through the final. The bracket wraps across smaller desktop and mobile screens to avoid horizontal scrolling.

### Odds

Shows each team's Monte Carlo probability of winning the cup and reaching later rounds.

### How

Explains the prediction model, coefficients, assumptions, match inputs, expected goals, venue/weather effects, host terms, and scoreline logic.

### Data, Checks, Health, Sources

These are advanced sections. They keep transparency and maintenance information available without crowding the main user flow:

* **Data:** JSON import/export/reset tools.
* **Checks:** built-in regression and tournament-shape self-tests.
* **Health:** data version, validation history, patch history, known risks, and update checklist.
* **Sources:** source list and update protocol.

## How the Prediction Engine Works

The app keeps Monte Carlo as the tournament-level simulator. Under each tournament run, individual matches are predicted by an ensemble match model:

1. **Ranking prior:** FIFA ranking provides a broad strength baseline.
2. **Tournament pedigree proxy:** titles, deep runs, and listed star depth add historical and squad-strength context.
3. **Current form:** embedded tournament points, goal difference, goals for, and goals against adjust teams as results arrive.
4. **Attack/defense profile:** played-match scoring and defending patterns influence expected goals.
5. **Context terms:** venue, climate, weather, rest/travel, host/co-host advantage, and editable match context adjust expected goals.
6. **Scoreline sampler:** expected goals are converted into scorelines with a bounded low-score correlation adjustment, then knockout draws go to extra time and penalties.
7. **Tournament simulation:** group standings, best third-place teams, legal knockout slots, and each knockout round are resolved.
8. **Monte Carlo aggregation:** thousands of runs are counted into champion, finalist, semifinal, quarterfinal, and round-of-16 probabilities.

The displayed sample path is selected from the Monte Carlo run that represents the top champion/finalist pairing, so the main result, Groups, Bracket, and favorites board stay aligned.

## Data Sources and Updates

The embedded data includes:

* Teams, groups, venues, and knockout slots.
* Played group-stage results.
* FIFA ranking priors and team-strength assumptions.
* Venue, climate, rest/travel, and weather context.
* Fair-play/team-conduct inputs where available.
* Source notes, validation history, and known data-quality gaps.

Scheduled update workflows refresh available BASE_DATA inputs and run validation. Missing factors such as lineups, injuries, suspensions, and referee assignments remain neutral unless reliable data is added.

## Privacy and Offline Use

The app runs in the browser and does not require an account, backend service, tracking script, or build step. Data edits are stored locally when browser storage is available. Optional live weather and external bracket data requests only run when triggered by the app flow and available in the browser.

## Disclaimer

This simulator is for educational and informational use only. It is not official FIFA data, live scoring authority, betting advice, gambling advice, investment advice, financial advice, or prediction-market advice. Outputs are probabilistic simulations, not guarantees or recommendations. Do not use these predictions to place bets, trade contracts, or risk money. If you use them elsewhere, you are responsible for your own decisions and may lose money.

Current facts, match results, injuries, suspensions, lineups, rankings, and official regulations should be verified against trusted sources before relying on them.

## Stability

The project is guarded by syntax checks, runtime smoke tests, ensemble-model checks, Monte Carlo invariant tests, third-place allocation checks across all 495 valid combinations, corrupt-cache rejection tests, storage-failure tests, malformed saved-data repair tests, penalty shootout validation, and responsive UI regression checks.
