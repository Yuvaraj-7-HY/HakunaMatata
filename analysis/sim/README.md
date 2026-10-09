# Simulator notes (units and assumptions)

All data is **generated**. Every number is **illustrative, not a real plant
measurement**. This file documents the units and the modelling assumptions so
the rest of the project (and the judges) can judge what the numbers do and do
not mean.

## Sampling
- One row per machine per **10 minutes**. 144 rows per machine per day.
- Time starts at a fixed wall-clock (currently 2026-03-01 08:00) so runs are reproducible.

## Columns and units
| Column | Unit | Notes |
|---|---|---|
| `ts` | timestamp | sample time |
| `machine_id` | — | e.g. `M-04` |
| `vibration_rms` | mm/s | velocity RMS, broad band (illustrative scaling) |
| `vibration_kurtosis` | — | dimensionless; healthy ≈ 3.0 (Gaussian-like) |
| `temperature_c` | °C | bearing/housing temperature |
| `current_a` | A | motor drive current |
| `load_pct` | % (0–100) | job/process load fraction |
| `speed_rpm` | rpm | discrete speed levels per machine type |
| `ambient_c` | °C | ambient air temperature |

## Operating regime
- **Load** is piecewise-constant jobs of 2–8 h drawn from U(0.20, 0.95).
- **Speed** is a discrete level per type (CNC spindle: 1200/1500/1800 rpm), chosen by the load bucket.
- **Ambient** = base + daily sinusoid (peaks ~15:00) + slow AR(1) wander; a heat-wave nuisance adds a step.

## Healthy signal model
- `vibration_rms = base·(1 + a·load + b·speed_factor) + AR(1) noise` — regime-driven.
- `temperature_c = ambient + first-order thermal lag toward base_temp_rise·load + noise`
  (time constant τ = 45 min for the CNC spindle).
- `current_a = base·(1 + c·load) + AR(1) noise`.
- `vibration_kurtosis ≈ 3 + small AR(1) noise` — **insensitive to load**, so kurtosis is a clean marker of mechanical degradation rather than a load detector.

## Degradation (ground truth)
Progress `g` goes 0 → 1 over `[onset, failure]`, shape `linear` or `exponential`.
`bearing_wear` applies, in order:
- kurtosis up **early** (`+3·√g`),
- vibration RMS up **mid** (`×(1+0.9·g^1.5)`),
- temperature up **late** (`+12·g³`).

That ordering is deliberate: a plot should show kurtosis, then RMS, then
temperature departing from the healthy band, while load is normal.

## Nuisance events
Look like faults but are not. M1: `load_surge` (days 18–22). M2 adds heat waves,
startup transients, sensor dropouts, and maintenance resets.

## Determinism
`simulate(scenario)` seeds `numpy.random.default_rng(scenario.seed)`. Same
scenario ⇒ byte-identical readings (see `tests/test_sim.py`).

## Boundary
Nothing under `analysis/detector/` may import from `analysis/sim/`. Ground truth
(`events_*`) is used only by the evaluation harness and tests.
