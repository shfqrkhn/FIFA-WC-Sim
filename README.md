# World Cup 2026 Simulator

Static, offline-capable simulator for the 48-team FIFA World Cup 2026 format.

- **Status:** Active flagship
- **Live Demo:** [shfqrkhn.github.io/FIFA-WC-Sim](https://shfqrkhn.github.io/FIFA-WC-Sim/)
- **Portfolio Role:** Sports analytics and simulation flagship.

World Cup 2026 Simulator combines embedded results, tournament rules, venue context, model assumptions, seeded randomness, and Monte Carlo tournament runs into one portable web app.

## Screenshot

![World Cup 2026 Simulator dashboard](./docs/assets/simulator-dashboard.png)

## Why This Exists

Fans need more than a bracket graphic. This project makes tournament outcomes inspectable: group tables, projected knockout paths, win probabilities, model assumptions, data health, and validation checks are all visible.

## What It Does

- Simulates the 48-team, 104-match World Cup 2026 format.
- Applies FIFA-style group ranking and knockout rules.
- Runs Monte Carlo tournament projections.
- Shows champion probabilities, group standings, bracket paths, and data health.
- Keeps transparency sections for model logic, sources, checks, and maintenance.

## Quick Start

1. Open the live demo.
2. Go to the Sim tab.
3. Press Run predictions.
4. Read Most likely champions first.
5. Inspect the sample tournament path, groups, bracket, and chances.
6. Use How, Data, Checks, Health, and Sources when you want audit detail.

## Privacy And Data Model

- Static app; no account required.
- Runs in the browser.
- Uses repository-owned data and generated artifacts.
- No personal data is required to use the simulator.

## Relationship To Other Projects

This is one of the four active flagships. It should remain standalone because it has a specific audience, time-sensitive subject matter, and a stronger data/update pipeline than the general utility repos.

## Repository Layout

```text
.
├── docs/index.html
├── docs/assets/
├── data/
├── scripts/
├── tests/
└── .github/workflows/
```

## Validation

```powershell
npm test
npm run smoke
```

Use the existing scripts and workflows for data refresh, validation, and UI smoke checks.

## Maintenance

Keep match data, source notes, health checks, and model assumptions explicit. Do not hide uncertainty; mark unavailable data instead of inventing it.

## License

See `LICENSE`.
